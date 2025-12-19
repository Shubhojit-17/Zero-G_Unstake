/**
 * Zero-G Unstake - Full Demo Script
 * 
 * This script runs a complete demonstration of the Zero-G Unstake flow:
 * 1. Setup: User stakes tokens
 * 2. Wait: Time passes, lock expires
 * 3. Problem: User has 0 BNB, cannot unstake
 * 4. Solution: User signs EIP-7702 authorization
 * 5. Rescue: Relayer submits transaction, user gets tokens
 * 
 * Usage: npm run demo
 * 
 * Note: This requires contracts to be deployed and configured in .env
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  formatEther,
  parseEther,
  encodeFunctionData,
} from 'viem';
import {
  sepolia,
  getDeployerAccount,
  getRelayerAccount,
  getUserAccount,
  getContractAddresses,
} from './utils/config';
import {
  StakingVaultABI,
  UnstakeDelegateABI,
  ZeroGTokenABI,
} from './utils/abis';

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(),
});

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║          Zero-G Unstake - Full Demo                           ║');
  console.log('║          Gasless Emergency Exit on BSC Testnet                ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');

  const contracts = getContractAddresses();
  const deployer = getDeployerAccount();
  const relayer = getRelayerAccount();
  const user = getUserAccount();

  const deployerWallet = createWalletClient({
    account: deployer,
    chain: sepolia,
    transport: http(),
  });

  const relayerWallet = createWalletClient({
    account: relayer,
    chain: sepolia,
    transport: http(),
  });

  const userWallet = createWalletClient({
    account: user,
    chain: sepolia,
    transport: http(),
  });

  console.log('\n📋 Configuration:');
  console.log(`   Token: ${contracts.token}`);
  console.log(`   Vault: ${contracts.vault}`);
  console.log(`   Delegate: ${contracts.delegate}`);
  console.log(`   Deployer: ${deployer.address}`);
  console.log(`   Relayer: ${relayer.address}`);
  console.log(`   User: ${user.address}`);

  // Check initial state
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📊 PHASE 1: Initial State Check');
  console.log('═══════════════════════════════════════════════════════════════');

  const userBnbBalance = await publicClient.getBalance({ address: user.address });
  const userTokenBalance = await publicClient.readContract({
    address: contracts.token,
    abi: ZeroGTokenABI,
    functionName: 'balanceOf',
    args: [user.address],
  });
  const [userStaked] = await publicClient.readContract({
    address: contracts.vault,
    abi: StakingVaultABI,
    functionName: 'stakes',
    args: [user.address],
  });

  console.log(`\n   User BNB: ${formatEther(userBnbBalance)} tBNB`);
  console.log(`   User ZGT: ${formatEther(userTokenBalance)} ZGT`);
  console.log(`   User Staked: ${formatEther(userStaked)} ZGT`);

  // If user has no tokens and no stake, we need to set them up
  if (userTokenBalance === 0n && userStaked === 0n) {
    console.log('\n   🔧 Setting up user with tokens...');

    // Transfer tokens from deployer to user
    const transferAmount = parseEther('1000');
    const transferHash = await deployerWallet.writeContract({
      address: contracts.token,
      abi: ZeroGTokenABI,
      functionName: 'transfer',
      args: [user.address, transferAmount],
    });
    await publicClient.waitForTransactionReceipt({ hash: transferHash });
    console.log(`   ✅ Transferred 1000 ZGT to user`);
  }

  // If user has tokens but no stake, stake them
  const currentUserTokens = await publicClient.readContract({
    address: contracts.token,
    abi: ZeroGTokenABI,
    functionName: 'balanceOf',
    args: [user.address],
  });

  if (currentUserTokens > 0n && userStaked === 0n) {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('📦 PHASE 2: User Stakes Tokens');
    console.log('═══════════════════════════════════════════════════════════════');

    // Approve vault
    console.log(`\n   Approving vault to spend ${formatEther(currentUserTokens)} ZGT...`);
    const approveHash = await userWallet.writeContract({
      address: contracts.token,
      abi: ZeroGTokenABI,
      functionName: 'approve',
      args: [contracts.vault, currentUserTokens],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveHash });
    console.log('   ✅ Approved');

    // Stake tokens
    console.log(`   Staking ${formatEther(currentUserTokens)} ZGT...`);
    const stakeHash = await userWallet.writeContract({
      address: contracts.vault,
      abi: StakingVaultABI,
      functionName: 'stake',
      args: [currentUserTokens],
    });
    await publicClient.waitForTransactionReceipt({ hash: stakeHash });
    console.log('   ✅ Staked');

    // Show new stake info
    const [newStaked, unlockTime] = await publicClient.readContract({
      address: contracts.vault,
      abi: StakingVaultABI,
      functionName: 'stakes',
      args: [user.address],
    });
    console.log(`\n   New Staked Amount: ${formatEther(newStaked)} ZGT`);
    console.log(`   Unlock Time: ${new Date(Number(unlockTime) * 1000).toISOString()}`);
  }

  // Wait for unlock
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('⏳ PHASE 3: Waiting for Lock Period');
  console.log('═══════════════════════════════════════════════════════════════');

  const lockDuration = await publicClient.readContract({
    address: contracts.vault,
    abi: StakingVaultABI,
    functionName: 'lockDuration',
  });

  let canUnstake = await publicClient.readContract({
    address: contracts.vault,
    abi: StakingVaultABI,
    functionName: 'canUnstake',
    args: [user.address],
  });

  if (!canUnstake) {
    console.log(`\n   Lock duration: ${lockDuration} seconds`);
    console.log('   Waiting for lock to expire...');

    while (!canUnstake) {
      const timeRemaining = await publicClient.readContract({
        address: contracts.vault,
        abi: StakingVaultABI,
        functionName: 'timeUntilUnlock',
        args: [user.address],
      });

      if (timeRemaining > 0n) {
        process.stdout.write(`\r   ⏱️  ${timeRemaining} seconds remaining...     `);
        await sleep(5000); // Check every 5 seconds
      }

      canUnstake = await publicClient.readContract({
        address: contracts.vault,
        abi: StakingVaultABI,
        functionName: 'canUnstake',
        args: [user.address],
      });
    }
    console.log('\n   ✅ Lock period expired!');
  } else {
    console.log('\n   ✅ Lock period already expired!');
  }

  // The rescue scenario
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('🚨 PHASE 4: The Problem - User Has 0 BNB');
  console.log('═══════════════════════════════════════════════════════════════');

  const finalUserBnb = await publicClient.getBalance({ address: user.address });
  const finalUserTokens = await publicClient.readContract({
    address: contracts.token,
    abi: ZeroGTokenABI,
    functionName: 'balanceOf',
    args: [user.address],
  });
  const [finalStaked] = await publicClient.readContract({
    address: contracts.vault,
    abi: StakingVaultABI,
    functionName: 'stakes',
    args: [user.address],
  });

  console.log(`\n   User BNB Balance: ${formatEther(finalUserBnb)} tBNB`);
  console.log(`   User ZGT Balance: ${formatEther(finalUserTokens)} ZGT`);
  console.log(`   User Staked: ${formatEther(finalStaked)} ZGT`);

  if (finalUserBnb > parseEther('0.001')) {
    console.log('\n   ⚠️  User has BNB! For a true demo, drain the user wallet first.');
    console.log('   Proceeding anyway to demonstrate the flow...');
  } else {
    console.log('\n   ✅ Perfect! User has 0 BNB but has staked tokens.');
    console.log('   Without Zero-G Unstake, these tokens would be TRAPPED!');
  }

  // EIP-7702 Rescue
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('🔐 PHASE 5: EIP-7702 Authorization');
  console.log('═══════════════════════════════════════════════════════════════');

  console.log('\n   User signs EIP-7702 authorization (NO GAS REQUIRED)...');

  // Sign authorization - user delegates their EOA to the UnstakeDelegate contract
  const authorization = await userWallet.signAuthorization({
    contractAddress: contracts.delegate,
  });

  console.log('   ✅ Authorization signed');
  console.log(`   Delegating EOA to: ${contracts.delegate}`);

  // Get rescue estimate
  const [estStaked, estFee, estUserReceives] = await publicClient.readContract({
    address: contracts.delegate,
    abi: UnstakeDelegateABI,
    functionName: 'estimateRescue',
    args: [contracts.vault, user.address],
  });

  console.log(`\n   📊 Rescue Preview:`);
  console.log(`      Unstaking: ${formatEther(estStaked)} ZGT`);
  console.log(`      Relayer Fee: ${formatEther(estFee)} ZGT (1%)`);
  console.log(`      User Receives: ${formatEther(estUserReceives)} ZGT`);

  // Execute rescue
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('🚀 PHASE 6: Relayer Executes Rescue');
  console.log('═══════════════════════════════════════════════════════════════');

  const relayerBalanceBefore = await publicClient.readContract({
    address: contracts.token,
    abi: ZeroGTokenABI,
    functionName: 'balanceOf',
    args: [relayer.address],
  });

  console.log(`\n   Relayer BNB: ${formatEther(await publicClient.getBalance({ address: relayer.address }))} tBNB`);
  console.log(`   Relayer ZGT: ${formatEther(relayerBalanceBefore)} ZGT`);

  console.log('\n   Submitting EIP-7702 rescue transaction...');

  // Encode the rescue call
  const rescueCallData = encodeFunctionData({
    abi: UnstakeDelegateABI,
    functionName: 'executeRescue',
    args: [contracts.vault, relayer.address, estFee * 2n], // 2x fee as max
  });

  // Submit the transaction with authorization list
  // EIP-7702 transactions require more gas than regular transactions
  const rescueTxHash = await relayerWallet.sendTransaction({
    to: user.address, // Call the user's EOA (which has delegate code via 7702)
    data: rescueCallData,
    authorizationList: [authorization],
    gas: 500000n, // EIP-7702 transactions need more gas
  });

  console.log(`   Transaction Hash: ${rescueTxHash}`);
  console.log('   Waiting for confirmation...');

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: rescueTxHash,
  });

  if (receipt.status === 'success') {
    console.log(`   ✅ Transaction confirmed in block ${receipt.blockNumber}`);
  } else {
    console.log('   ❌ Transaction failed!');
    return;
  }

  // Final state
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('🎉 PHASE 7: Final State - SUCCESS!');
  console.log('═══════════════════════════════════════════════════════════════');

  const userFinalBnb = await publicClient.getBalance({ address: user.address });
  const userFinalTokens = await publicClient.readContract({
    address: contracts.token,
    abi: ZeroGTokenABI,
    functionName: 'balanceOf',
    args: [user.address],
  });
  const [userFinalStaked] = await publicClient.readContract({
    address: contracts.vault,
    abi: StakingVaultABI,
    functionName: 'stakes',
    args: [user.address],
  });
  const relayerFinalTokens = await publicClient.readContract({
    address: contracts.token,
    abi: ZeroGTokenABI,
    functionName: 'balanceOf',
    args: [relayer.address],
  });

  console.log('\n   📊 User Final State:');
  console.log(`      BNB: ${formatEther(userFinalBnb)} tBNB (unchanged!)`);
  console.log(`      ZGT: ${formatEther(userFinalTokens)} ZGT`);
  console.log(`      Staked: ${formatEther(userFinalStaked)} ZGT`);

  console.log('\n   📊 Relayer Final State:');
  console.log(`      ZGT: ${formatEther(relayerFinalTokens)} ZGT`);
  console.log(`      Fee Earned: ${formatEther(relayerFinalTokens - relayerBalanceBefore)} ZGT`);

  console.log('\n   ✨ Summary:');
  console.log('   • User had 0 BNB but successfully unstaked their tokens');
  console.log('   • Relayer paid the gas and was reimbursed in ZGT');
  console.log('   • Everything happened in ONE atomic transaction');
  console.log('   • EIP-7702 enabled the "gasless" experience');

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('✅ Demo Complete! Zero-G Unstake Works!');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`\n   View on BSCScan: https://sepolia.etherscan.io/tx/${rescueTxHash}`);
}

main().catch(console.error);
