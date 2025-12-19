// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/ZeroGToken.sol";
import "../src/StakingVault.sol";
import "../src/UnstakeDelegate.sol";

/**
 * @title Deploy
 * @notice Deployment script for Zero-G Unstake contracts
 * @dev Run with: forge script script/Deploy.s.sol --rpc-url $BSC_TESTNET_RPC --broadcast --verify
 */
contract Deploy is Script {
    // Configuration
    uint256 constant INITIAL_TOKEN_SUPPLY = 1_000_000 * 1e18; // 1 million tokens
    uint256 constant LOCK_DURATION = 3600; // 3600 seconds (1 hour) as per requirements

    function run() external {
        // Load deployer private key from environment
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("=== Zero-G Unstake Deployment ===");
        console.log("Deployer:", deployer);
        console.log("Chain ID:", block.chainid);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy ZeroG Token
        ZeroGToken token = new ZeroGToken(INITIAL_TOKEN_SUPPLY, deployer);
        console.log("ZeroGToken deployed at:", address(token));

        // 2. Deploy StakingVault
        StakingVault vault = new StakingVault(address(token), LOCK_DURATION);
        console.log("StakingVault deployed at:", address(vault));
        console.log("  - Staking Token:", address(token));
        console.log("  - Lock Duration:", LOCK_DURATION, "seconds");

        // 3. Deploy UnstakeDelegate
        UnstakeDelegate delegate = new UnstakeDelegate();
        console.log("UnstakeDelegate deployed at:", address(delegate));

        vm.stopBroadcast();

        // Output summary for .env file
        console.log("\n=== Add these to your .env file ===");
        console.log("ZERO_G_TOKEN_ADDRESS=", address(token));
        console.log("STAKING_VAULT_ADDRESS=", address(vault));
        console.log("UNSTAKE_DELEGATE_ADDRESS=", address(delegate));
    }
}
