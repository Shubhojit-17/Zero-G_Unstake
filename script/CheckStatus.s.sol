// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/ZeroGToken.sol";
import "../src/StakingVault.sol";
import "../src/UnstakeDelegate.sol";

/**
 * @title CheckStatus
 * @notice Utility script to check the status of all contracts and users
 * @dev Run with: forge script script/CheckStatus.s.sol --rpc-url $BSC_TESTNET_RPC
 */
contract CheckStatus is Script {
    function run() external view {
        // Load addresses from environment
        address tokenAddress = vm.envAddress("ZERO_G_TOKEN_ADDRESS");
        address vaultAddress = vm.envAddress("STAKING_VAULT_ADDRESS");
        address delegateAddress = vm.envAddress("UNSTAKE_DELEGATE_ADDRESS");
        
        address deployer = vm.addr(vm.envUint("DEPLOYER_PRIVATE_KEY"));
        address relayer = vm.addr(vm.envUint("RELAYER_PRIVATE_KEY"));
        address user = vm.addr(vm.envUint("USER_PRIVATE_KEY"));

        ZeroGToken token = ZeroGToken(tokenAddress);
        StakingVault vault = StakingVault(vaultAddress);
        UnstakeDelegate delegate = UnstakeDelegate(delegateAddress);

        console.log("=== Zero-G Unstake Status ===\n");

        console.log("--- Contracts ---");
        console.log("ZeroGToken:", tokenAddress);
        console.log("StakingVault:", vaultAddress);
        console.log("UnstakeDelegate:", delegateAddress);
        
        console.log("\n--- Vault Configuration ---");
        console.log("Staking Token:", vault.stakingToken());
        console.log("Lock Duration:", vault.lockDuration(), "seconds");
        console.log("Relayer Fee:", delegate.getRelayerFeeBps(), "bps (", delegate.getRelayerFeeBps() / 100, "%)");

        console.log("\n--- Account Balances ---");
        console.log("Deployer:", deployer);
        console.log("  ZGT Balance:", token.balanceOf(deployer) / 1e18);
        
        console.log("Relayer:", relayer);
        console.log("  ZGT Balance:", token.balanceOf(relayer) / 1e18);
        
        console.log("User:", user);
        console.log("  ZGT Balance:", token.balanceOf(user) / 1e18);

        console.log("\n--- User Stake Status ---");
        (uint256 stakedAmount, uint256 unlockTime) = vault.stakes(user);
        console.log("Staked Amount:", stakedAmount / 1e18, "ZGT");
        console.log("Unlock Time:", unlockTime);
        console.log("Current Time:", block.timestamp);
        console.log("Can Unstake:", vault.canUnstake(user));
        
        if (unlockTime > block.timestamp) {
            console.log("Time Until Unlock:", unlockTime - block.timestamp, "seconds");
        }

        // Estimate rescue
        if (stakedAmount > 0) {
            (
                uint256 estStaked,
                uint256 estFee,
                uint256 estUserReceives,
                bool canRescue
            ) = delegate.estimateRescue(vaultAddress, user);
            
            console.log("\n--- Rescue Estimate ---");
            console.log("Staked:", estStaked / 1e18, "ZGT");
            console.log("Relayer Fee:", estFee / 1e18, "ZGT");
            console.log("User Receives:", estUserReceives / 1e18, "ZGT");
            console.log("Can Rescue Now:", canRescue);
        }
    }
}
