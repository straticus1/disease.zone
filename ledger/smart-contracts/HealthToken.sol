// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title HealthToken (HEALTH)
 * @dev Governance token for the disease.zone health data ecosystem
 *
 * Features:
 * - ERC20 compliant with burning capability
 * - Governance voting through delegation
 * - Role-based access control
 * - Pausable for emergency stops
 * - Permit functionality for gasless transactions
 * - Data contribution rewards
 * - Research access payments
 */
contract HealthToken is ERC20, ERC20Burnable, ERC20Permit, ERC20Votes, AccessControl, Pausable {

    // Role definitions
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant REWARDS_ROLE = keccak256("REWARDS_ROLE");

    // Token economics
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10**18; // 1 billion tokens
    uint256 public constant INITIAL_SUPPLY = 100_000_000 * 10**18; // 100 million initial

    // Reward tracking
    mapping(address => uint256) public dataContributions;
    mapping(address => uint256) public researchPurchases;
    mapping(address => uint256) public totalRewardsEarned;

    // Events
    event DataContributionRewarded(address indexed contributor, uint256 amount, string dataType);
    event ResearchAccessPurchased(address indexed researcher, uint256 amount, string datasetId);
    event TokensStaked(address indexed staker, uint256 amount);
    event TokensUnstaked(address indexed staker, uint256 amount);

    constructor()
        ERC20("HealthToken", "HEALTH")
        ERC20Permit("HealthToken")
    {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(REWARDS_ROLE, msg.sender);

        // Mint initial supply to deployer
        _mint(msg.sender, INITIAL_SUPPLY);
    }

    /**
     * @dev Mint tokens for data contribution rewards
     * @param to Address to receive the reward tokens
     * @param amount Amount of tokens to mint
     * @param dataType Type of health data contributed
     */
    function rewardDataContribution(address to, uint256 amount, string calldata dataType)
        external
        onlyRole(REWARDS_ROLE)
        whenNotPaused
    {
        require(totalSupply() + amount <= MAX_SUPPLY, "Exceeds maximum supply");
        require(to != address(0), "Cannot reward zero address");
        require(amount > 0, "Reward amount must be positive");

        _mint(to, amount);

        dataContributions[to] += amount;
        totalRewardsEarned[to] += amount;

        emit DataContributionRewarded(to, amount, dataType);
    }

    /**
     * @dev Process research access payment
     * @param researcher Address of the researcher
     * @param amount Amount of tokens to be paid
     * @param datasetId ID of the dataset being accessed
     */
    function processResearchPayment(address researcher, uint256 amount, string calldata datasetId)
        external
        onlyRole(REWARDS_ROLE)
        whenNotPaused
    {
        require(balanceOf(researcher) >= amount, "Insufficient balance");
        require(amount > 0, "Payment amount must be positive");

        // Burn tokens as payment (deflationary mechanism)
        _burn(researcher, amount);

        researchPurchases[researcher] += amount;

        emit ResearchAccessPurchased(researcher, amount, datasetId);
    }

    /**
     * @dev Mint new tokens (restricted to MINTER_ROLE)
     * @param to Address to receive minted tokens
     * @param amount Amount to mint
     */
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) whenNotPaused {
        require(totalSupply() + amount <= MAX_SUPPLY, "Exceeds maximum supply");
        _mint(to, amount);
    }

    /**
     * @dev Pause all token transfers (emergency function)
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @dev Unpause all token transfers
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /**
     * @dev Get user's contribution statistics
     * @param user Address to query
     * @return dataRewards Total rewards from data contributions
     * @return researchSpending Total spending on research access
     * @return netContribution Net contribution to the ecosystem
     */
    function getUserStats(address user) external view returns (
        uint256 dataRewards,
        uint256 researchSpending,
        uint256 netContribution
    ) {
        dataRewards = dataContributions[user];
        researchSpending = researchPurchases[user];
        netContribution = dataRewards > researchSpending ? dataRewards - researchSpending : 0;
    }

    /**
     * @dev Bulk reward multiple contributors (gas optimized)
     * @param recipients Array of recipient addresses
     * @param amounts Array of reward amounts
     * @param dataType Type of data contributed
     */
    function bulkRewardContributions(
        address[] calldata recipients,
        uint256[] calldata amounts,
        string calldata dataType
    ) external onlyRole(REWARDS_ROLE) whenNotPaused {
        require(recipients.length == amounts.length, "Array length mismatch");
        require(recipients.length <= 100, "Too many recipients"); // Gas limit protection

        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }

        require(totalSupply() + totalAmount <= MAX_SUPPLY, "Exceeds maximum supply");

        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "Invalid recipient");
            require(amounts[i] > 0, "Invalid amount");

            _mint(recipients[i], amounts[i]);
            dataContributions[recipients[i]] += amounts[i];
            totalRewardsEarned[recipients[i]] += amounts[i];

            emit DataContributionRewarded(recipients[i], amounts[i], dataType);
        }
    }

    // Required overrides for multiple inheritance
    function _beforeTokenTransfer(address from, address to, uint256 amount)
        internal
        override(ERC20)
        whenNotPaused
    {
        super._beforeTokenTransfer(from, to, amount);
    }

    function _afterTokenTransfer(address from, address to, uint256 amount)
        internal
        override(ERC20, ERC20Votes)
    {
        super._afterTokenTransfer(from, to, amount);
    }

    function _mint(address to, uint256 amount)
        internal
        override(ERC20, ERC20Votes)
    {
        super._mint(to, amount);
    }

    function _burn(address account, uint256 amount)
        internal
        override(ERC20, ERC20Votes)
    {
        super._burn(account, amount);
    }
}