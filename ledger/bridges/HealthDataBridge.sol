// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title HealthDataBridge
 * @dev Cross-chain bridge for health data verification and transfer
 *
 * Features:
 * - Multi-signature verification
 * - Cross-chain data integrity proofs
 * - Hyperledger Fabric integration
 * - Automated compliance checking
 * - Emergency pause functionality
 */
contract HealthDataBridge is AccessControl, ReentrancyGuard, Pausable {

    // Role definitions
    bytes32 public constant VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE");
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");

    // Chain IDs
    uint256 public constant ETHEREUM_CHAIN_ID = 1;
    uint256 public constant POLYGON_CHAIN_ID = 137;
    uint256 public constant HEALTH_SUPERNET_CHAIN_ID = 1337;

    // Validation requirements
    uint256 public constant REQUIRED_VALIDATORS = 3;
    uint256 public constant VALIDATION_TIMEOUT = 24 hours;

    // Data structures
    struct HealthDataProof {
        bytes32 id;
        bytes32 dataHash;
        uint256 sourceChain;
        uint256 targetChain;
        address requester;
        string recordType; // HIV, COVID, OUTBREAK_ALERT, etc.
        uint256 timestamp;
        bool isCompliant;
        bytes32 complianceHash;
        uint8 validationCount;
        bool isFinalized;
        mapping(address => bool) validatorApprovals;
        string fabricTransactionId; // Hyperledger Fabric TX ID
    }

    struct CrossChainTransfer {
        bytes32 id;
        uint256 sourceChain;
        uint256 targetChain;
        address sourceContract;
        address targetContract;
        bytes32 dataHash;
        uint256 amount; // For token transfers
        address recipient;
        uint8 confirmationCount;
        bool isCompleted;
        mapping(address => bool) relayerConfirmations;
    }

    struct ComplianceCheck {
        bytes32 proofId;
        bool hipaaCompliant;
        bool gdprCompliant;
        bool researchApproved;
        string[] violations;
        address reviewer;
        uint256 reviewedAt;
    }

    // Storage
    mapping(bytes32 => HealthDataProof) public dataProofs;
    mapping(bytes32 => CrossChainTransfer) public transfers;
    mapping(bytes32 => ComplianceCheck) public complianceChecks;
    mapping(uint256 => address) public chainContracts; // chainId => contract address
    mapping(address => bool) public authorizedSources;

    // Tracking
    bytes32[] public pendingProofs;
    bytes32[] public finalizedProofs;
    mapping(address => uint256) public validatorReputations;

    // Events
    event DataProofSubmitted(bytes32 indexed proofId, uint256 sourceChain, uint256 targetChain, address requester);
    event DataProofValidated(bytes32 indexed proofId, address indexed validator, bool approved);
    event DataProofFinalized(bytes32 indexed proofId, bool success);
    event CrossChainTransferInitiated(bytes32 indexed transferId, uint256 sourceChain, uint256 targetChain);
    event CrossChainTransferCompleted(bytes32 indexed transferId, bool success);
    event ComplianceReviewed(bytes32 indexed proofId, bool compliant, address reviewer);
    event EmergencyPause(address indexed admin, string reason);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(VALIDATOR_ROLE, msg.sender);
        _grantRole(RELAYER_ROLE, msg.sender);
        _grantRole(COMPLIANCE_ROLE, msg.sender);

        // Initialize supported chains
        chainContracts[ETHEREUM_CHAIN_ID] = address(0); // To be set after deployment
        chainContracts[POLYGON_CHAIN_ID] = address(0);
        chainContracts[HEALTH_SUPERNET_CHAIN_ID] = address(0);
    }

    /**
     * @dev Submit health data proof for cross-chain verification
     * @param proofId Unique identifier for this proof
     * @param dataHash Hash of the health data
     * @param sourceChain Source blockchain chain ID
     * @param targetChain Target blockchain chain ID
     * @param recordType Type of health record
     * @param fabricTxId Associated Hyperledger Fabric transaction ID
     */
    function submitDataProof(
        bytes32 proofId,
        bytes32 dataHash,
        uint256 sourceChain,
        uint256 targetChain,
        string calldata recordType,
        string calldata fabricTxId
    ) external whenNotPaused {
        require(authorizedSources[msg.sender], "Unauthorized source");
        require(dataProofs[proofId].id == bytes32(0), "Proof already exists");
        require(dataHash != bytes32(0), "Invalid data hash");
        require(sourceChain != targetChain, "Same source and target chain");

        HealthDataProof storage proof = dataProofs[proofId];
        proof.id = proofId;
        proof.dataHash = dataHash;
        proof.sourceChain = sourceChain;
        proof.targetChain = targetChain;
        proof.requester = msg.sender;
        proof.recordType = recordType;
        proof.timestamp = block.timestamp;
        proof.isCompliant = false; // Requires compliance review
        proof.validationCount = 0;
        proof.isFinalized = false;
        proof.fabricTransactionId = fabricTxId;

        pendingProofs.push(proofId);

        emit DataProofSubmitted(proofId, sourceChain, targetChain, msg.sender);
    }

    /**
     * @dev Validate a health data proof (validator role required)
     * @param proofId ID of the proof to validate
     * @param approved Whether the validator approves this proof
     * @param signature Validator's signature for verification
     */
    function validateDataProof(
        bytes32 proofId,
        bool approved,
        bytes calldata signature
    ) external onlyRole(VALIDATOR_ROLE) whenNotPaused {
        HealthDataProof storage proof = dataProofs[proofId];
        require(proof.id != bytes32(0), "Proof does not exist");
        require(!proof.isFinalized, "Proof already finalized");
        require(!proof.validatorApprovals[msg.sender], "Already validated by this validator");
        require(block.timestamp <= proof.timestamp + VALIDATION_TIMEOUT, "Validation timeout expired");

        // Verify signature
        bytes32 message = keccak256(abi.encodePacked(proofId, approved, block.chainid));
        bytes32 ethSignedMessage = MessageHashUtils.toEthSignedMessageHash(message);
        require(ECDSA.recover(ethSignedMessage, signature) == msg.sender, "Invalid signature");

        proof.validatorApprovals[msg.sender] = true;

        if (approved) {
            proof.validationCount++;
            validatorReputations[msg.sender]++;
        }

        emit DataProofValidated(proofId, msg.sender, approved);

        // Check if we have enough validations
        if (proof.validationCount >= REQUIRED_VALIDATORS && proof.isCompliant) {
            _finalizeProof(proofId, true);
        }
    }

    /**
     * @dev Review compliance for a health data proof
     * @param proofId ID of the proof to review
     * @param hipaaCompliant HIPAA compliance status
     * @param gdprCompliant GDPR compliance status
     * @param researchApproved Research use approval
     * @param violations Array of compliance violations (if any)
     */
    function reviewCompliance(
        bytes32 proofId,
        bool hipaaCompliant,
        bool gdprCompliant,
        bool researchApproved,
        string[] calldata violations
    ) external onlyRole(COMPLIANCE_ROLE) whenNotPaused {
        HealthDataProof storage proof = dataProofs[proofId];
        require(proof.id != bytes32(0), "Proof does not exist");
        require(!proof.isFinalized, "Proof already finalized");

        bool isCompliant = hipaaCompliant && gdprCompliant && (violations.length == 0);

        ComplianceCheck storage check = complianceChecks[proofId];
        check.proofId = proofId;
        check.hipaaCompliant = hipaaCompliant;
        check.gdprCompliant = gdprCompliant;
        check.researchApproved = researchApproved;
        check.violations = violations;
        check.reviewer = msg.sender;
        check.reviewedAt = block.timestamp;

        proof.isCompliant = isCompliant;
        proof.complianceHash = keccak256(abi.encodePacked(
            hipaaCompliant, gdprCompliant, researchApproved, violations
        ));

        emit ComplianceReviewed(proofId, isCompliant, msg.sender);

        // If compliant and has enough validations, finalize
        if (isCompliant && proof.validationCount >= REQUIRED_VALIDATORS) {
            _finalizeProof(proofId, true);
        }
    }

    /**
     * @dev Initiate cross-chain transfer
     * @param transferId Unique transfer identifier
     * @param sourceChain Source blockchain
     * @param targetChain Target blockchain
     * @param sourceContract Source contract address
     * @param targetContract Target contract address
     * @param dataHash Hash of data being transferred
     * @param amount Amount to transfer (for tokens)
     * @param recipient Recipient address
     */
    function initiateCrossChainTransfer(
        bytes32 transferId,
        uint256 sourceChain,
        uint256 targetChain,
        address sourceContract,
        address targetContract,
        bytes32 dataHash,
        uint256 amount,
        address recipient
    ) external onlyRole(RELAYER_ROLE) whenNotPaused {
        require(transfers[transferId].id == bytes32(0), "Transfer already exists");
        require(chainContracts[sourceChain] != address(0), "Unsupported source chain");
        require(chainContracts[targetChain] != address(0), "Unsupported target chain");

        CrossChainTransfer storage transfer = transfers[transferId];
        transfer.id = transferId;
        transfer.sourceChain = sourceChain;
        transfer.targetChain = targetChain;
        transfer.sourceContract = sourceContract;
        transfer.targetContract = targetContract;
        transfer.dataHash = dataHash;
        transfer.amount = amount;
        transfer.recipient = recipient;
        transfer.confirmationCount = 0;
        transfer.isCompleted = false;

        emit CrossChainTransferInitiated(transferId, sourceChain, targetChain);
    }

    /**
     * @dev Confirm cross-chain transfer (relayer role required)
     * @param transferId ID of the transfer to confirm
     */
    function confirmCrossChainTransfer(bytes32 transferId) external onlyRole(RELAYER_ROLE) whenNotPaused {
        CrossChainTransfer storage transfer = transfers[transferId];
        require(transfer.id != bytes32(0), "Transfer does not exist");
        require(!transfer.isCompleted, "Transfer already completed");
        require(!transfer.relayerConfirmations[msg.sender], "Already confirmed by this relayer");

        transfer.relayerConfirmations[msg.sender] = true;
        transfer.confirmationCount++;

        if (transfer.confirmationCount >= REQUIRED_VALIDATORS) {
            transfer.isCompleted = true;
            emit CrossChainTransferCompleted(transferId, true);
        }
    }

    /**
     * @dev Get pending proofs for validation
     * @param limit Maximum number of proofs to return
     * @return Array of pending proof IDs
     */
    function getPendingProofs(uint256 limit) external view returns (bytes32[] memory) {
        uint256 count = pendingProofs.length > limit ? limit : pendingProofs.length;
        bytes32[] memory result = new bytes32[](count);

        uint256 resultIndex = 0;
        for (uint256 i = 0; i < pendingProofs.length && resultIndex < count; i++) {
            HealthDataProof storage proof = dataProofs[pendingProofs[i]];
            if (!proof.isFinalized) {
                result[resultIndex] = pendingProofs[i];
                resultIndex++;
            }
        }

        return result;
    }

    /**
     * @dev Get validator statistics
     * @param validator Address of the validator
     * @return reputation Validator's reputation score
     * @return totalValidations Total number of validations performed
     */
    function getValidatorStats(address validator) external view returns (uint256 reputation, uint256 totalValidations) {
        reputation = validatorReputations[validator];
        // In a real implementation, you'd track total validations separately
        totalValidations = reputation; // Simplified for this example
    }

    /**
     * @dev Set chain contract addresses (admin only)
     * @param chainId Blockchain chain ID
     * @param contractAddress Contract address on that chain
     */
    function setChainContract(uint256 chainId, address contractAddress) external onlyRole(DEFAULT_ADMIN_ROLE) {
        chainContracts[chainId] = contractAddress;
    }

    /**
     * @dev Add authorized data source (admin only)
     * @param source Address to authorize
     */
    function addAuthorizedSource(address source) external onlyRole(DEFAULT_ADMIN_ROLE) {
        authorizedSources[source] = true;
    }

    /**
     * @dev Remove authorized data source (admin only)
     * @param source Address to deauthorize
     */
    function removeAuthorizedSource(address source) external onlyRole(DEFAULT_ADMIN_ROLE) {
        authorizedSources[source] = false;
    }

    /**
     * @dev Emergency pause (admin only)
     * @param reason Reason for the pause
     */
    function emergencyPause(string calldata reason) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
        emit EmergencyPause(msg.sender, reason);
    }

    /**
     * @dev Unpause the contract (admin only)
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // Internal functions
    function _finalizeProof(bytes32 proofId, bool success) internal {
        HealthDataProof storage proof = dataProofs[proofId];
        proof.isFinalized = true;

        // Move from pending to finalized
        finalizedProofs.push(proofId);
        _removePendingProof(proofId);

        emit DataProofFinalized(proofId, success);
    }

    function _removePendingProof(bytes32 proofId) internal {
        for (uint256 i = 0; i < pendingProofs.length; i++) {
            if (pendingProofs[i] == proofId) {
                pendingProofs[i] = pendingProofs[pendingProofs.length - 1];
                pendingProofs.pop();
                break;
            }
        }
    }
}