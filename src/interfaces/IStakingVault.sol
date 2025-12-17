// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IStakingVault
 * @notice Interface for staking vaults compatible with Zero-G Unstake
 */
interface IStakingVault {
    /// @notice Emitted when a user stakes tokens
    event Staked(address indexed user, uint256 amount, uint256 unlockTime);
    
    /// @notice Emitted when a user unstakes tokens
    event Unstaked(address indexed user, uint256 amount);

    /// @notice Returns the staking token address
    function stakingToken() external view returns (address);

    /// @notice Returns the lock duration in seconds
    function lockDuration() external view returns (uint256);

    /// @notice Returns stake info for a user
    /// @param user The address to query
    /// @return amount The staked amount
    /// @return unlockTime The timestamp when tokens can be unstaked
    function stakes(address user) external view returns (uint256 amount, uint256 unlockTime);

    /// @notice Stake tokens into the vault
    /// @param amount The amount to stake
    function stake(uint256 amount) external;

    /// @notice Unstake tokens from the vault
    /// @dev Reverts if lock period has not expired
    function unstake() external;

    /// @notice Check if a user can unstake
    /// @param user The address to check
    /// @return True if the user can unstake
    function canUnstake(address user) external view returns (bool);

    /// @notice Get the staked balance for a user
    /// @param user The address to query
    /// @return The staked amount
    function stakedBalance(address user) external view returns (uint256);
}
