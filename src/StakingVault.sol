// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IERC20.sol";
import "./interfaces/IStakingVault.sol";

/**
 * @title StakingVault
 * @author Zero-G Unstake Team
 * @notice A simple time-locked staking vault for ERC20 tokens
 * @dev Users stake tokens which are locked for a configurable duration
 */
contract StakingVault is IStakingVault {
    // ============ Errors ============
    error ZeroAmount();
    error ZeroAddress();
    error NoStake();
    error StillLocked(uint256 unlockTime, uint256 currentTime);
    error TransferFailed();

    // ============ State Variables ============
    
    /// @notice The ERC20 token being staked
    address public immutable override stakingToken;
    
    /// @notice Duration tokens are locked after staking (in seconds)
    uint256 public immutable override lockDuration;

    /// @notice Mapping of user address to their stake info
    struct StakeInfo {
        uint256 amount;
        uint256 unlockTime;
    }
    mapping(address => StakeInfo) private _stakes;

    // ============ Constructor ============

    /**
     * @notice Deploy a new StakingVault
     * @param _stakingToken The ERC20 token to stake
     * @param _lockDuration The lock duration in seconds
     */
    constructor(address _stakingToken, uint256 _lockDuration) {
        if (_stakingToken == address(0)) revert ZeroAddress();
        stakingToken = _stakingToken;
        lockDuration = _lockDuration;
    }

    // ============ External Functions ============

    /**
     * @notice Stake tokens into the vault
     * @param amount The amount of tokens to stake
     * @dev Tokens are locked for `lockDuration` seconds from stake time
     * @dev If user already has a stake, amounts are added and lock is reset
     */
    function stake(uint256 amount) external override {
        if (amount == 0) revert ZeroAmount();

        // Transfer tokens from user to vault
        bool success = IERC20(stakingToken).transferFrom(msg.sender, address(this), amount);
        if (!success) revert TransferFailed();

        // Update stake info
        _stakes[msg.sender].amount += amount;
        _stakes[msg.sender].unlockTime = block.timestamp + lockDuration;

        emit Staked(msg.sender, amount, _stakes[msg.sender].unlockTime);
    }

    /**
     * @notice Unstake all tokens from the vault
     * @dev Reverts if lock period has not expired
     * @dev Transfers all staked tokens back to the user
     */
    function unstake() external override {
        StakeInfo storage stakeInfo = _stakes[msg.sender];
        
        if (stakeInfo.amount == 0) revert NoStake();
        if (block.timestamp < stakeInfo.unlockTime) {
            revert StillLocked(stakeInfo.unlockTime, block.timestamp);
        }

        uint256 amount = stakeInfo.amount;
        
        // Clear stake before transfer (CEI pattern)
        stakeInfo.amount = 0;
        stakeInfo.unlockTime = 0;

        // Transfer tokens back to user
        bool success = IERC20(stakingToken).transfer(msg.sender, amount);
        if (!success) revert TransferFailed();

        emit Unstaked(msg.sender, amount);
    }

    // ============ View Functions ============

    /**
     * @notice Get stake info for a user
     * @param user The address to query
     * @return amount The staked amount
     * @return unlockAt The unlock timestamp
     */
    function stakes(address user) external view override returns (uint256 amount, uint256 unlockAt) {
        StakeInfo storage stakeInfo = _stakes[user];
        return (stakeInfo.amount, stakeInfo.unlockTime);
    }

    /**
     * @notice Check if a user can unstake
     * @param user The address to check
     * @return True if the user has a stake and it's unlocked
     */
    function canUnstake(address user) external view override returns (bool) {
        StakeInfo storage stakeInfo = _stakes[user];
        return stakeInfo.amount > 0 && block.timestamp >= stakeInfo.unlockTime;
    }

    /**
     * @notice Get the staked balance for a user
     * @param user The address to query
     * @return The staked amount
     */
    function stakedBalance(address user) external view override returns (uint256) {
        return _stakes[user].amount;
    }

    /**
     * @notice Get the unlock time for a user
     * @param user The address to query
     * @return The unlock timestamp (0 if no stake)
     */
    function unlockTime(address user) external view returns (uint256) {
        return _stakes[user].unlockTime;
    }

    /**
     * @notice Get time remaining until unlock
     * @param user The address to query
     * @return Seconds remaining (0 if already unlocked or no stake)
     */
    function timeUntilUnlock(address user) external view returns (uint256) {
        uint256 unlock = _stakes[user].unlockTime;
        if (unlock == 0 || block.timestamp >= unlock) return 0;
        return unlock - block.timestamp;
    }
}
