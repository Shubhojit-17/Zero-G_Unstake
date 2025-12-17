// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IERC20.sol";
import "./interfaces/IStakingVault.sol";
import "./interfaces/IUnstakeDelegate.sol";

/**
 * @title UnstakeDelegate
 * @author Zero-G Unstake Team
 * @notice EIP-7702 delegate contract that enables gasless unstaking
 * @dev This contract's code is "borrowed" by a user's EOA via EIP-7702
 *      When executed, it runs in the context of the user's EOA, allowing
 *      atomic unstake + relayer reimbursement without the user holding gas
 * 
 * SECURITY CONSIDERATIONS:
 * - This contract executes in the context of the delegating EOA
 * - All state reads/writes affect the EOA, not this contract
 * - Token transfers happen FROM the EOA's balance
 * - The relayer submits the transaction and pays gas upfront
 * - The relayer is reimbursed from the unstaked tokens
 */
contract UnstakeDelegate is IUnstakeDelegate {
    // ============ Errors ============
    error ZeroAddress();
    error CannotUnstake();
    error FeeTooHigh(uint256 requested, uint256 maxAllowed);
    error InsufficientUnstakedAmount();
    error TransferFailed();
    error NotDelegatedCall();

    // ============ Constants ============
    
    /// @notice Basis points denominator (100% = 10000)
    uint256 public constant BPS_DENOMINATOR = 10000;
    
    /// @notice Default relayer fee in basis points (1% = 100 bps)
    uint256 public constant DEFAULT_RELAYER_FEE_BPS = 100;

    // ============ Events ============
    
    // RescueExecuted is inherited from IUnstakeDelegate

    // ============ External Functions ============

    /**
     * @notice Execute a rescue unstake operation
     * @dev This function is called in the context of the user's EOA via EIP-7702
     *      The execution flow:
     *      1. Validate the user can unstake from the vault
     *      2. Call unstake() on the vault (tokens go to the EOA)
     *      3. Calculate the relayer fee
     *      4. Transfer fee to relayer
     *      5. Remaining tokens stay in the EOA
     * 
     * @param vault The staking vault address to unstake from
     * @param relayer The relayer address to reimburse for gas
     * @param maxFee Maximum fee (in tokens) the user accepts
     */
    function executeRescue(
        address vault,
        address relayer,
        uint256 maxFee
    ) external override {
        // Validate inputs
        if (vault == address(0)) revert ZeroAddress();
        if (relayer == address(0)) revert ZeroAddress();

        // Get vault info
        IStakingVault stakingVault = IStakingVault(vault);
        address token = stakingVault.stakingToken();
        
        // Check user can unstake (this checks lock period)
        // Note: msg.sender here is still the tx.origin because this code
        // executes in the EOA's context, but the EOA's address is address(this)
        // when running delegated code
        if (!stakingVault.canUnstake(address(this))) {
            revert CannotUnstake();
        }

        // Get staked amount before unstaking
        uint256 stakedAmount = stakingVault.stakedBalance(address(this));
        if (stakedAmount == 0) revert CannotUnstake();

        // Record balance before unstake
        uint256 balanceBefore = IERC20(token).balanceOf(address(this));

        // Execute unstake - tokens come to this EOA
        stakingVault.unstake();

        // Verify tokens received
        uint256 balanceAfter = IERC20(token).balanceOf(address(this));
        uint256 received = balanceAfter - balanceBefore;
        
        if (received == 0) revert InsufficientUnstakedAmount();

        // Calculate relayer fee (percentage of unstaked amount)
        uint256 relayerFee = (received * DEFAULT_RELAYER_FEE_BPS) / BPS_DENOMINATOR;
        
        // Enforce max fee limit
        if (relayerFee > maxFee) {
            revert FeeTooHigh(relayerFee, maxFee);
        }

        // Ensure fee doesn't exceed received amount
        if (relayerFee > received) {
            relayerFee = received;
        }

        // Transfer fee to relayer
        if (relayerFee > 0) {
            bool success = IERC20(token).transfer(relayer, relayerFee);
            if (!success) revert TransferFailed();
        }

        // Calculate what user keeps
        uint256 userReceived = received - relayerFee;

        emit RescueExecuted(
            address(this),  // The EOA that was rescued
            vault,
            relayer,
            received,
            relayerFee,
            userReceived
        );
    }

    /**
     * @notice Calculate the fee for a potential rescue operation
     * @dev View function to help users estimate costs before signing
     * @param vault The staking vault address
     * @param user The user address to check
     * @return stakedAmount The amount currently staked
     * @return estimatedFee The estimated relayer fee
     * @return userWouldReceive The amount user would receive after fee
     * @return canRescue Whether the rescue can be executed now
     */
    function estimateRescue(
        address vault,
        address user
    ) external view returns (
        uint256 stakedAmount,
        uint256 estimatedFee,
        uint256 userWouldReceive,
        bool canRescue
    ) {
        IStakingVault stakingVault = IStakingVault(vault);
        
        stakedAmount = stakingVault.stakedBalance(user);
        canRescue = stakingVault.canUnstake(user);
        
        if (stakedAmount > 0) {
            estimatedFee = (stakedAmount * DEFAULT_RELAYER_FEE_BPS) / BPS_DENOMINATOR;
            userWouldReceive = stakedAmount - estimatedFee;
        }
    }

    /**
     * @notice Get the current relayer fee in basis points
     * @return The fee in basis points (100 = 1%)
     */
    function getRelayerFeeBps() external pure returns (uint256) {
        return DEFAULT_RELAYER_FEE_BPS;
    }
}
