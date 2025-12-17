// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IUnstakeDelegate
 * @notice Interface for the EIP-7702 delegate contract
 */
interface IUnstakeDelegate {
    /// @notice Emitted when a rescue unstake is executed
    event RescueExecuted(
        address indexed user,
        address indexed vault,
        address indexed relayer,
        uint256 totalUnstaked,
        uint256 relayerFee,
        uint256 userReceived
    );

    /// @notice Execute a rescue unstake operation
    /// @param vault The staking vault address
    /// @param relayer The relayer address to reimburse
    /// @param maxFee The maximum fee (in tokens) the user is willing to pay
    function executeRescue(
        address vault,
        address relayer,
        uint256 maxFee
    ) external;
}
