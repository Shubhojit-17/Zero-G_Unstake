// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ZeroGToken.sol";
import "../src/StakingVault.sol";
import "../src/UnstakeDelegate.sol";

/**
 * @title ZeroGUnstakeTest
 * @notice Comprehensive tests for the Zero-G Unstake system
 */
contract ZeroGUnstakeTest is Test {
    // Contracts
    ZeroGToken public token;
    StakingVault public vault;
    UnstakeDelegate public delegate;

    // Actors
    address public deployer = makeAddr("deployer");
    address public user = makeAddr("user");
    address public relayer = makeAddr("relayer");

    // Constants
    uint256 constant INITIAL_SUPPLY = 1_000_000 * 1e18;
    uint256 constant USER_TOKENS = 1000 * 1e18;
    uint256 constant LOCK_DURATION = 3600; // 1 hour

    function setUp() public {
        vm.startPrank(deployer);
        
        // Deploy token
        token = new ZeroGToken(INITIAL_SUPPLY, deployer);
        
        // Deploy vault
        vault = new StakingVault(address(token), LOCK_DURATION);
        
        // Deploy delegate
        delegate = new UnstakeDelegate();
        
        // Send tokens to user
        token.transfer(user, USER_TOKENS);
        
        vm.stopPrank();
    }

    // ============ ZeroGToken Tests ============

    function test_TokenDeployment() public view {
        assertEq(token.name(), "Zero-G Token");
        assertEq(token.symbol(), "ZGT");
        assertEq(token.decimals(), 18);
        assertEq(token.totalSupply(), INITIAL_SUPPLY);
    }

    function test_TokenTransfer() public {
        vm.prank(user);
        token.transfer(relayer, 100 * 1e18);
        
        assertEq(token.balanceOf(relayer), 100 * 1e18);
        assertEq(token.balanceOf(user), USER_TOKENS - 100 * 1e18);
    }

    // ============ StakingVault Tests ============

    function test_VaultDeployment() public view {
        assertEq(vault.stakingToken(), address(token));
        assertEq(vault.lockDuration(), LOCK_DURATION);
    }

    function test_Stake() public {
        vm.startPrank(user);
        token.approve(address(vault), USER_TOKENS);
        vault.stake(USER_TOKENS);
        vm.stopPrank();

        assertEq(vault.stakedBalance(user), USER_TOKENS);
        assertEq(token.balanceOf(user), 0);
        assertEq(token.balanceOf(address(vault)), USER_TOKENS);
    }

    function test_CannotUnstakeBeforeLockExpiry() public {
        // Stake tokens
        vm.startPrank(user);
        token.approve(address(vault), USER_TOKENS);
        vault.stake(USER_TOKENS);
        
        // Try to unstake immediately
        vm.expectRevert();
        vault.unstake();
        vm.stopPrank();
    }

    function test_UnstakeAfterLockExpiry() public {
        // Stake tokens
        vm.startPrank(user);
        token.approve(address(vault), USER_TOKENS);
        vault.stake(USER_TOKENS);
        vm.stopPrank();

        // Warp time past lock
        vm.warp(block.timestamp + LOCK_DURATION + 1);

        // Unstake
        vm.prank(user);
        vault.unstake();

        assertEq(token.balanceOf(user), USER_TOKENS);
        assertEq(vault.stakedBalance(user), 0);
    }

    function test_CanUnstakeCheck() public {
        // Before staking
        assertFalse(vault.canUnstake(user));

        // Stake
        vm.startPrank(user);
        token.approve(address(vault), USER_TOKENS);
        vault.stake(USER_TOKENS);
        vm.stopPrank();

        // After staking but before unlock
        assertFalse(vault.canUnstake(user));

        // After unlock
        vm.warp(block.timestamp + LOCK_DURATION + 1);
        assertTrue(vault.canUnstake(user));
    }

    // ============ UnstakeDelegate Tests ============

    function test_DelegateConstants() public view {
        assertEq(delegate.BPS_DENOMINATOR(), 10000);
        assertEq(delegate.DEFAULT_RELAYER_FEE_BPS(), 100); // 1%
        assertEq(delegate.getRelayerFeeBps(), 100);
    }

    function test_EstimateRescue() public {
        // Stake tokens
        vm.startPrank(user);
        token.approve(address(vault), USER_TOKENS);
        vault.stake(USER_TOKENS);
        vm.stopPrank();

        // Check estimate before unlock
        (
            uint256 stakedAmount,
            uint256 estimatedFee,
            uint256 userWouldReceive,
            bool canRescue
        ) = delegate.estimateRescue(address(vault), user);

        assertEq(stakedAmount, USER_TOKENS);
        assertEq(estimatedFee, USER_TOKENS / 100); // 1%
        assertEq(userWouldReceive, USER_TOKENS - (USER_TOKENS / 100));
        assertFalse(canRescue);

        // After unlock
        vm.warp(block.timestamp + LOCK_DURATION + 1);
        (, , , canRescue) = delegate.estimateRescue(address(vault), user);
        assertTrue(canRescue);
    }

    function test_ExecuteRescue_ViaEIP7702Simulation() public {
        // Stake tokens
        vm.startPrank(user);
        token.approve(address(vault), USER_TOKENS);
        vault.stake(USER_TOKENS);
        vm.stopPrank();

        // Warp past lock
        vm.warp(block.timestamp + LOCK_DURATION + 1);

        // Simulate EIP-7702: Deploy delegate code at user's address
        // In a real EIP-7702 scenario, the user's EOA would have the delegate's code
        // For testing, we etch the delegate bytecode to the user's address
        bytes memory delegateCode = address(delegate).code;
        vm.etch(user, delegateCode);

        // Now the user address has the delegate's code
        // When we call executeRescue on 'user', it runs the delegate logic
        // but in the context of the user's address (address(this) == user)
        
        uint256 maxFee = USER_TOKENS / 50; // 2% max fee (more than 1%)

        // Execute rescue - called by relayer, but code runs at user's address
        vm.prank(relayer);
        UnstakeDelegate(user).executeRescue(
            address(vault),
            relayer,
            maxFee
        );

        // Verify results
        uint256 expectedFee = USER_TOKENS / 100; // 1%
        uint256 expectedUserReceives = USER_TOKENS - expectedFee;

        assertEq(token.balanceOf(user), expectedUserReceives, "User should receive tokens minus fee");
        assertEq(token.balanceOf(relayer), expectedFee, "Relayer should receive fee");
        assertEq(vault.stakedBalance(user), 0, "User stake should be cleared");
    }

    function test_ExecuteRescue_RevertIfLocked() public {
        // Stake tokens
        vm.startPrank(user);
        token.approve(address(vault), USER_TOKENS);
        vault.stake(USER_TOKENS);
        vm.stopPrank();

        // Etch delegate code to user
        vm.etch(user, address(delegate).code);

        // Try to rescue while still locked
        vm.prank(relayer);
        vm.expectRevert(UnstakeDelegate.CannotUnstake.selector);
        UnstakeDelegate(user).executeRescue(
            address(vault),
            relayer,
            USER_TOKENS
        );
    }

    function test_ExecuteRescue_RevertIfFeeTooHigh() public {
        // Stake tokens
        vm.startPrank(user);
        token.approve(address(vault), USER_TOKENS);
        vault.stake(USER_TOKENS);
        vm.stopPrank();

        // Warp past lock
        vm.warp(block.timestamp + LOCK_DURATION + 1);

        // Etch delegate code to user
        vm.etch(user, address(delegate).code);

        // Set max fee lower than actual fee
        uint256 tooLowMaxFee = USER_TOKENS / 200; // 0.5% (less than 1%)

        vm.prank(relayer);
        vm.expectRevert();
        UnstakeDelegate(user).executeRescue(
            address(vault),
            relayer,
            tooLowMaxFee
        );
    }

    // ============ Integration Test ============

    function test_FullRescueFlow() public {
        // === Phase 1: User stakes tokens ===
        vm.startPrank(user);
        token.approve(address(vault), USER_TOKENS);
        vault.stake(USER_TOKENS);
        vm.stopPrank();

        // Verify user state: has stake, no tokens, no BNB
        assertEq(token.balanceOf(user), 0, "User should have 0 tokens");
        assertEq(vault.stakedBalance(user), USER_TOKENS, "User should have stake");
        assertFalse(vault.canUnstake(user), "Should not be able to unstake yet");

        // === Phase 2: Time passes, lock expires ===
        vm.warp(block.timestamp + LOCK_DURATION + 1);
        assertTrue(vault.canUnstake(user), "Should be able to unstake now");

        // === Phase 3: EIP-7702 Rescue ===
        // Simulate the EIP-7702 delegation by etching delegate code to user's EOA
        vm.etch(user, address(delegate).code);

        // Record balances before
        uint256 relayerBalanceBefore = token.balanceOf(relayer);

        // Relayer executes the rescue transaction
        uint256 maxFee = 20 * 1e18; // 20 tokens max fee
        vm.prank(relayer);
        UnstakeDelegate(user).executeRescue(
            address(vault),
            relayer,
            maxFee
        );

        // === Phase 4: Verify final state ===
        uint256 expectedFee = USER_TOKENS / 100; // 1% = 10 tokens
        uint256 expectedUserBalance = USER_TOKENS - expectedFee; // 990 tokens

        assertEq(vault.stakedBalance(user), 0, "Stake should be cleared");
        assertEq(token.balanceOf(user), expectedUserBalance, "User should have tokens minus fee");
        assertEq(
            token.balanceOf(relayer), 
            relayerBalanceBefore + expectedFee, 
            "Relayer should receive fee"
        );

        // User never needed BNB - rescue successful!
    }

    // ============ Fuzz Tests ============

    function testFuzz_StakeAndRescue(uint256 stakeAmount) public {
        // Bound stake amount to reasonable range
        stakeAmount = bound(stakeAmount, 1e18, USER_TOKENS);

        // Record user balance before staking
        uint256 userBalanceBefore = token.balanceOf(user);

        // Stake
        vm.startPrank(user);
        token.approve(address(vault), stakeAmount);
        vault.stake(stakeAmount);
        vm.stopPrank();

        // User's remaining balance after staking
        uint256 userBalanceAfterStake = token.balanceOf(user);
        assertEq(userBalanceAfterStake, userBalanceBefore - stakeAmount, "User balance after stake");

        // Warp past lock
        vm.warp(block.timestamp + LOCK_DURATION + 1);

        // Etch delegate code
        vm.etch(user, address(delegate).code);

        // Execute rescue
        uint256 maxFee = stakeAmount; // Accept any fee up to full amount
        vm.prank(relayer);
        UnstakeDelegate(user).executeRescue(
            address(vault),
            relayer,
            maxFee
        );

        // Verify fee calculation
        // Fee is calculated on the RECEIVED amount (stakeAmount), not total balance
        uint256 expectedFee = stakeAmount / 100;
        uint256 expectedUserFinal = userBalanceAfterStake + stakeAmount - expectedFee;
        
        assertEq(token.balanceOf(relayer), expectedFee, "Fee should be 1%");
        assertEq(token.balanceOf(user), expectedUserFinal, "User gets stake minus fee plus previous balance");
    }
}
