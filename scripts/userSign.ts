/**
 * Zero-G Unstake - User Authorization Signing
 * 
 * This script allows a user to:
 * 1. Check their stake status
 * 2. Sign an EIP-7702 authorization
 * 3. Generate a rescue request for the relayer
 * 
 * Usage: npm run sign
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  formatEther,
  parseEther,
  type Hex,
} from 'viem';
import {
  sepolia,
  getUserAccount,
  getContractAddresses,
} from './utils/config';
import {
  StakingVaultABI,
  UnstakeDelegateABI,
  ZeroGTokenABI,
} from './utils/abis';
import * as fs from 'fs';

// Create clients
const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(),
});

const userAccount = getUserAccount();

const walletClient = createWalletClient({
  account: userAccount,
  chain: sepolia,
  transport: http(),
});

/**
 * Get user's stake information
 */
async function getUserStakeInfo() {
  const contracts = getContractAddresses();

  // Get stake info
  const [stakedAmount, unlockTime] = await publicClient.readContract({
    address: contracts.vault,
    abi: StakingVaultABI,
    functionName: 'stakes',
    args: [userAccount.address],
  });

  // Check if can unstake
  const canUnstake = await publicClient.readContract({
    address: contracts.vault,
    abi: StakingVaultABI,
    functionName: 'canUnstake',
    args: [userAccount.address],
  });

  // Get token balance
  const tokenBalance = await publicClient.readContract({
    address: contracts.token,
    abi: ZeroGTokenABI,
    functionName: 'balanceOf',
    args: [userAccount.address],
  });

  // Get BNB balance
  const bnbBalance = await publicClient.getBalance({
    address: userAccount.address,
  });

  // Get rescue estimate
  const [estStaked, estFee, estUserReceives, canRescue] = await publicClient.readContract({
    address: contracts.delegate,
    abi: UnstakeDelegateABI,
    functionName: 'estimateRescue',
    args: [contracts.vault, userAccount.address],
  });

  return {
    address: userAccount.address,
    stakedAmount,
    unlockTime,
    canUnstake,
    tokenBalance,
    bnbBalance,
    estimate: {
      stakedAmount: estStaked,
      fee: estFee,
      userReceives: estUserReceives,
      canRescue,
    },
  };
}

/**
 * Sign an EIP-7702 authorization for the UnstakeDelegate
 */
async function signRescueAuthorization() {
  const contracts = getContractAddresses();

  console.log('\n📝 Signing EIP-7702 authorization...');
  console.log(`   Delegating to: ${contracts.delegate}`);

  // Get the user's current nonce
  const nonce = await publicClient.getTransactionCount({
    address: userAccount.address,
  });

  // Sign the authorization
  // This allows the user's EOA to temporarily use the delegate's code
  const authorization = await walletClient.signAuthorization({
    contractAddress: contracts.delegate,
  });

  console.log('   ✅ Authorization signed');

  return {
    contractAddress: contracts.delegate,
    chainId: sepolia.id,
    nonce: BigInt(nonce),
    v: authorization.v,
    r: authorization.r,
    s: authorization.s,
  };
}

/**
 * Generate a complete rescue request
 */
async function generateRescueRequest(maxFeeBps: number = 200) {
  const contracts = getContractAddresses();
  const info = await getUserStakeInfo();

  if (info.stakedAmount === 0n) {
    throw new Error('No stake found. Cannot generate rescue request.');
  }

  // Calculate max fee (e.g., 2% of staked amount)
  const maxFee = (info.stakedAmount * BigInt(maxFeeBps)) / 10000n;

  // Sign authorization
  const authorization = await signRescueAuthorization();

  // Create rescue request
  const request = {
    userAddress: userAccount.address,
    vaultAddress: contracts.vault,
    authorization: {
      contractAddress: authorization.contractAddress,
      chainId: authorization.chainId,
      nonce: authorization.nonce.toString(),
      v: authorization.v,
      r: authorization.r,
      s: authorization.s,
    },
    maxFee: maxFee.toString(),
    timestamp: Date.now(),
  };

  return request;
}

/**
 * Main function
 */
async function main() {
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║   Zero-G Unstake - User Authorization     ║');
  console.log('╚═══════════════════════════════════════════╝');

  const contracts = getContractAddresses();

  // Get and display user info
  console.log('\n📊 User Status:');
  const info = await getUserStakeInfo();
  console.log(`   Address: ${info.address}`);
  console.log(`   BNB Balance: ${formatEther(info.bnbBalance)} tBNB`);
  console.log(`   ZGT Balance: ${formatEther(info.tokenBalance)} ZGT`);

  console.log('\n📦 Stake Info:');
  console.log(`   Staked Amount: ${formatEther(info.stakedAmount)} ZGT`);
  if (info.unlockTime > 0n) {
    const unlockDate = new Date(Number(info.unlockTime) * 1000);
    console.log(`   Unlock Time: ${unlockDate.toISOString()}`);
    const now = Math.floor(Date.now() / 1000);
    if (info.unlockTime > BigInt(now)) {
      const remaining = Number(info.unlockTime) - now;
      console.log(`   Time Remaining: ${remaining} seconds`);
    } else {
      console.log(`   Status: ✅ UNLOCKED - Ready for rescue!`);
    }
  }
  console.log(`   Can Unstake: ${info.canUnstake}`);

  if (info.stakedAmount === 0n) {
    console.log('\n⚠️  No stake found. Nothing to rescue.');
    return;
  }

  console.log('\n💰 Rescue Estimate:');
  console.log(`   You will unstake: ${formatEther(info.estimate.stakedAmount)} ZGT`);
  console.log(`   Relayer fee: ${formatEther(info.estimate.fee)} ZGT (1%)`);
  console.log(`   You will receive: ${formatEther(info.estimate.userReceives)} ZGT`);
  console.log(`   Can rescue now: ${info.estimate.canRescue}`);

  if (!info.estimate.canRescue) {
    console.log('\n⏳ Cannot rescue yet. Please wait for the lock period to expire.');
    return;
  }

  // Check if user has gas (the whole point is they shouldn't need it!)
  if (info.bnbBalance === 0n) {
    console.log('\n🎯 Perfect scenario: You have 0 BNB but need to unstake!');
    console.log('   This is exactly what Zero-G Unstake is designed for.');
  } else {
    console.log('\n📝 Note: You have some BNB, but Zero-G Unstake will save it.');
    console.log('   The relayer will pay the gas and be reimbursed in ZGT.');
  }

  // Generate rescue request
  console.log('\n🔐 Generating rescue request...');
  const request = await generateRescueRequest(200); // 2% max fee

  // Save to file
  const filename = `rescue-request-${Date.now()}.json`;
  fs.writeFileSync(filename, JSON.stringify(request, null, 2));
  console.log(`   ✅ Rescue request saved to: ${filename}`);

  console.log('\n📤 Next Steps:');
  console.log('   Option A: Send request to relayer manually');
  console.log('      1. Send this file to the relayer service');
  console.log('      2. Or run: npm run relayer -- --request ./' + filename);
  
  console.log('\n   Option B: Register for auto-unstake bot');
  console.log('      The bot will automatically rescue you when eligible.');
  console.log('      Run this command to register:');
  
  // Create bot-compatible authorization format
  const botAuth = {
    address: request.authorization.contractAddress,
    chainId: request.authorization.chainId,
    nonce: Number(request.authorization.nonce),
    r: request.authorization.r,
    s: request.authorization.s,
    yParity: Number(request.authorization.v) === 27 ? 0 : 1,
  };
  console.log(`\n      npm run bot register ${request.userAddress} '${JSON.stringify(botAuth)}'`);

  console.log('\n   The relayer will submit your rescue transaction and you');
  console.log('   will receive your tokens minus the 1% fee!');
}

// Run
main().catch(console.error);
