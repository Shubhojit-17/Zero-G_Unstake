// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/ZeroGToken.sol";
import "../src/StakingVault.sol";

/**
 * @title SetupTestUser
 * @notice Script to setup a test user with tokens staked in the vault
 * @dev This simulates a user who has staked tokens and now needs rescue
 * 
 * Run with: forge script script/SetupTestUser.s.sol --rpc-url $BSC_TESTNET_RPC --broadcast
 */
contract SetupTestUser is Script {
    // Amount to send to test user
    uint256 constant USER_TOKEN_AMOUNT = 1000 * 1e18; // 1000 tokens
    
    // Amount user will stake
    uint256 constant STAKE_AMOUNT = 1000 * 1e18; // All tokens

    function run() external {
        // Load environment variables
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        uint256 userPrivateKey = vm.envUint("USER_PRIVATE_KEY");
        
        address deployer = vm.addr(deployerPrivateKey);
        address user = vm.addr(userPrivateKey);
        
        address tokenAddress = vm.envAddress("ZERO_G_TOKEN_ADDRESS");
        address vaultAddress = vm.envAddress("STAKING_VAULT_ADDRESS");

        ZeroGToken token = ZeroGToken(tokenAddress);
        StakingVault vault = StakingVault(vaultAddress);

        console.log("=== Setting Up Test User ===");
        console.log("Deployer:", deployer);
        console.log("User:", user);
        console.log("Token:", tokenAddress);
        console.log("Vault:", vaultAddress);

        // Step 1: Deployer sends tokens to user
        console.log("\n--- Step 1: Transfer tokens to user ---");
        vm.startBroadcast(deployerPrivateKey);
        token.transfer(user, USER_TOKEN_AMOUNT);
        vm.stopBroadcast();
        console.log("Transferred", USER_TOKEN_AMOUNT / 1e18, "ZGT to user");

        // Step 2: User approves vault and stakes
        console.log("\n--- Step 2: User stakes tokens ---");
        vm.startBroadcast(userPrivateKey);
        token.approve(vaultAddress, STAKE_AMOUNT);
        vault.stake(STAKE_AMOUNT);
        vm.stopBroadcast();
        
        // Verify stake
        (uint256 stakedAmount, uint256 unlockTime) = vault.stakes(user);
        console.log("User staked:", stakedAmount / 1e18, "ZGT");
        console.log("Unlock time:", unlockTime);
        console.log("Current time:", block.timestamp);

        console.log("\n=== Setup Complete ===");
        console.log("User now has 0 ZGT in wallet (all staked)");
        console.log("User needs to wait for unlock time, then can be rescued");
        console.log("To simulate 0 BNB, do NOT send any tBNB to the user address");
    }
}
