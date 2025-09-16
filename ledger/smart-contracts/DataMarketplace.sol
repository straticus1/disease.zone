// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

interface IHealthCredit {
    function processResearchPayment(address researcher, uint256 amount, string calldata datasetId) external;
    function rewardDataContribution(address contributor, uint256 amount, string calldata dataType) external;
}

/**
 * @title DataMarketplace
 * @dev Decentralized marketplace for anonymized health research data
 *
 * Features:
 * - NFT-based dataset licenses
 * - HEALTH token payments
 * - Automated revenue sharing
 * - Access control and compliance
 * - Data quality scoring
 * - Research collaboration tools
 */
contract DataMarketplace is ERC721, AccessControl, ReentrancyGuard, Pausable {
    using Counters for Counters.Counter;

    // Role definitions
    bytes32 public constant DATA_PROVIDER_ROLE = keccak256("DATA_PROVIDER_ROLE");
    bytes32 public constant RESEARCHER_ROLE = keccak256("RESEARCHER_ROLE");
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");

    // Contracts
    IHealthCredit public healthCredit;

    // Counters
    Counters.Counter private _datasetIds;
    Counters.Counter private _licenseIds;

    // Dataset structure
    struct Dataset {
        uint256 id;
        string name;
        string description;
        string dataType; // HIV, COVID, CANCER, etc.
        string ipfsHash; // Metadata stored on IPFS
        address provider;
        uint256 price; // Price in HEALTH tokens
        uint256 qualityScore; // 1-100 quality rating
        uint256 recordCount;
        uint256 totalSales;
        uint256 totalRevenue;
        bool isActive;
        bool isCompliant;
        uint256 createdAt;
        string[] tags;
        string complianceHash; // Hash of compliance documentation
    }

    // License NFT structure
    struct License {
        uint256 id;
        uint256 datasetId;
        address researcher;
        uint256 purchasePrice;
        uint256 purchasedAt;
        uint256 expiresAt;
        string researchPurpose;
        bool isActive;
        string[] restrictions;
    }

    // Storage
    mapping(uint256 => Dataset) public datasets;
    mapping(uint256 => License) public licenses;
    mapping(address => uint256[]) public providerDatasets;
    mapping(address => uint256[]) public researcherLicenses;
    mapping(uint256 => uint256[]) public datasetLicenses;

    // Revenue sharing (basis points: 10000 = 100%)
    uint256 public platformFee = 500; // 5%
    uint256 public providerShare = 9500; // 95%

    // Quality scoring
    mapping(uint256 => mapping(address => uint256)) public datasetRatings;
    mapping(uint256 => uint256) public datasetRatingCount;

    // Events
    event DatasetCreated(uint256 indexed datasetId, address indexed provider, string dataType);
    event DatasetPurchased(uint256 indexed datasetId, uint256 indexed licenseId, address indexed researcher, uint256 price);
    event DatasetRated(uint256 indexed datasetId, address indexed rater, uint256 rating);
    event RevenueDistributed(uint256 indexed datasetId, address indexed provider, uint256 amount);
    event ComplianceUpdated(uint256 indexed datasetId, bool isCompliant);

    constructor(address _healthCredit) ERC721("HealthDataLicense", "HDL") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(DATA_PROVIDER_ROLE, msg.sender);
        _grantRole(RESEARCHER_ROLE, msg.sender);
        _grantRole(COMPLIANCE_ROLE, msg.sender);

        healthCredit = IHealthCredit(_healthCredit);
    }

    /**
     * @dev Create a new dataset listing
     * @param name Dataset name
     * @param description Dataset description
     * @param dataType Type of health data
     * @param ipfsHash IPFS hash containing metadata
     * @param price Price in HEALTH credits
     * @param recordCount Number of records in dataset
     * @param tags Array of tags for categorization
     */
    function createDataset(
        string calldata name,
        string calldata description,
        string calldata dataType,
        string calldata ipfsHash,
        uint256 price,
        uint256 recordCount,
        string[] calldata tags
    ) external onlyRole(DATA_PROVIDER_ROLE) whenNotPaused returns (uint256) {
        require(bytes(name).length > 0, "Name cannot be empty");
        require(bytes(dataType).length > 0, "Data type cannot be empty");
        require(price > 0, "Price must be positive");
        require(recordCount > 0, "Record count must be positive");

        _datasetIds.increment();
        uint256 datasetId = _datasetIds.current();

        Dataset storage dataset = datasets[datasetId];
        dataset.id = datasetId;
        dataset.name = name;
        dataset.description = description;
        dataset.dataType = dataType;
        dataset.ipfsHash = ipfsHash;
        dataset.provider = msg.sender;
        dataset.price = price;
        dataset.recordCount = recordCount;
        dataset.qualityScore = 50; // Initial neutral score
        dataset.isActive = true;
        dataset.isCompliant = false; // Requires compliance approval
        dataset.createdAt = block.timestamp;
        dataset.tags = tags;

        providerDatasets[msg.sender].push(datasetId);

        emit DatasetCreated(datasetId, msg.sender, dataType);

        return datasetId;
    }

    /**
     * @dev Purchase access to a dataset
     * @param datasetId ID of the dataset to purchase
     * @param researchPurpose Description of research purpose
     * @param durationDays License duration in days
     */
    function purchaseDataset(
        uint256 datasetId,
        string calldata researchPurpose,
        uint256 durationDays
    ) external onlyRole(RESEARCHER_ROLE) nonReentrant whenNotPaused returns (uint256) {
        Dataset storage dataset = datasets[datasetId];
        require(dataset.isActive, "Dataset not active");
        require(dataset.isCompliant, "Dataset not compliant");
        require(durationDays > 0 && durationDays <= 365, "Invalid duration");
        require(bytes(researchPurpose).length > 0, "Research purpose required");

        uint256 totalPrice = dataset.price;

        // Process payment through HEALTH credits
        healthCredit.processResearchPayment(msg.sender, totalPrice, dataset.name);

        // Mint license NFT
        _licenseIds.increment();
        uint256 licenseId = _licenseIds.current();
        _mint(msg.sender, licenseId);

        // Create license record
        License storage license = licenses[licenseId];
        license.id = licenseId;
        license.datasetId = datasetId;
        license.researcher = msg.sender;
        license.purchasePrice = totalPrice;
        license.purchasedAt = block.timestamp;
        license.expiresAt = block.timestamp + (durationDays * 1 days);
        license.researchPurpose = researchPurpose;
        license.isActive = true;

        // Update tracking
        researcherLicenses[msg.sender].push(licenseId);
        datasetLicenses[datasetId].push(licenseId);

        // Update dataset stats
        dataset.totalSales++;
        dataset.totalRevenue += totalPrice;

        // Distribute revenue
        _distributeRevenue(datasetId, totalPrice);

        emit DatasetPurchased(datasetId, licenseId, msg.sender, totalPrice);

        return licenseId;
    }

    /**
     * @dev Rate a dataset (only license holders)
     * @param datasetId Dataset to rate
     * @param rating Rating from 1-10
     */
    function rateDataset(uint256 datasetId, uint256 rating) external {
        require(rating >= 1 && rating <= 10, "Rating must be 1-10");
        require(_hasValidLicense(msg.sender, datasetId), "Must have valid license");
        require(datasetRatings[datasetId][msg.sender] == 0, "Already rated");

        datasetRatings[datasetId][msg.sender] = rating;
        datasetRatingCount[datasetId]++;

        // Update quality score (weighted average)
        _updateQualityScore(datasetId);

        emit DatasetRated(datasetId, msg.sender, rating);
    }

    /**
     * @dev Update dataset compliance status (compliance role only)
     * @param datasetId Dataset to update
     * @param isCompliant Compliance status
     * @param complianceHash Hash of compliance documentation
     */
    function updateCompliance(
        uint256 datasetId,
        bool isCompliant,
        string calldata complianceHash
    ) external onlyRole(COMPLIANCE_ROLE) {
        Dataset storage dataset = datasets[datasetId];
        require(dataset.id != 0, "Dataset does not exist");

        dataset.isCompliant = isCompliant;
        dataset.complianceHash = complianceHash;

        emit ComplianceUpdated(datasetId, isCompliant);
    }

    /**
     * @dev Get datasets by data type
     * @param dataType Type of health data
     * @param limit Maximum number of results
     * @return Array of dataset IDs
     */
    function getDatasetsByType(string calldata dataType, uint256 limit)
        external view returns (uint256[] memory) {

        uint256[] memory results = new uint256[](limit);
        uint256 count = 0;
        uint256 totalDatasets = _datasetIds.current();

        for (uint256 i = 1; i <= totalDatasets && count < limit; i++) {
            if (datasets[i].isActive &&
                datasets[i].isCompliant &&
                keccak256(abi.encodePacked(datasets[i].dataType)) == keccak256(abi.encodePacked(dataType))) {
                results[count] = i;
                count++;
            }
        }

        // Resize array to actual count
        uint256[] memory finalResults = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            finalResults[i] = results[i];
        }

        return finalResults;
    }

    /**
     * @dev Get researcher's active licenses
     * @param researcher Address of researcher
     * @return Array of active license IDs
     */
    function getActiveLicenses(address researcher) external view returns (uint256[] memory) {
        uint256[] memory userLicenses = researcherLicenses[researcher];
        uint256 activeCount = 0;

        // Count active licenses
        for (uint256 i = 0; i < userLicenses.length; i++) {
            if (licenses[userLicenses[i]].isActive &&
                licenses[userLicenses[i]].expiresAt > block.timestamp) {
                activeCount++;
            }
        }

        // Build result array
        uint256[] memory activeLicenses = new uint256[](activeCount);
        uint256 index = 0;
        for (uint256 i = 0; i < userLicenses.length; i++) {
            if (licenses[userLicenses[i]].isActive &&
                licenses[userLicenses[i]].expiresAt > block.timestamp) {
                activeLicenses[index] = userLicenses[i];
                index++;
            }
        }

        return activeLicenses;
    }

    /**
     * @dev Check if researcher has valid license for dataset
     * @param researcher Address of researcher
     * @param datasetId Dataset ID
     * @return True if valid license exists
     */
    function hasValidLicense(address researcher, uint256 datasetId) external view returns (bool) {
        return _hasValidLicense(researcher, datasetId);
    }

    /**
     * @dev Set platform fee (admin only)
     * @param newFee New fee in basis points
     */
    function setPlatformFee(uint256 newFee) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newFee <= 1000, "Fee cannot exceed 10%");
        platformFee = newFee;
        providerShare = 10000 - newFee;
    }

    /**
     * @dev Pause the marketplace
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @dev Unpause the marketplace
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // Internal functions
    function _hasValidLicense(address researcher, uint256 datasetId) internal view returns (bool) {
        uint256[] memory userLicenses = researcherLicenses[researcher];

        for (uint256 i = 0; i < userLicenses.length; i++) {
            License memory license = licenses[userLicenses[i]];
            if (license.datasetId == datasetId &&
                license.isActive &&
                license.expiresAt > block.timestamp) {
                return true;
            }
        }
        return false;
    }

    function _distributeRevenue(uint256 datasetId, uint256 totalPrice) internal {
        Dataset storage dataset = datasets[datasetId];

        uint256 platformAmount = (totalPrice * platformFee) / 10000;
        uint256 providerAmount = (totalPrice * providerShare) / 10000;

        // Note: In a real implementation, you would transfer tokens here
        // For this example, we're assuming the marketplace contract holds the tokens

        emit RevenueDistributed(datasetId, dataset.provider, providerAmount);
    }

    function _updateQualityScore(uint256 datasetId) internal {
        Dataset storage dataset = datasets[datasetId];
        uint256 ratingCount = datasetRatingCount[datasetId];

        if (ratingCount == 0) return;

        uint256 totalRating = 0;
        uint256 totalDatasets = _datasetIds.current();

        // Calculate average rating (simplified - in practice you'd store cumulative ratings)
        // This is a placeholder for the actual rating calculation
        dataset.qualityScore = 75; // Placeholder
    }

    // Required overrides
    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}