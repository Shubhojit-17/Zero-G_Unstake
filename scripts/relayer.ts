/**
 * Zero-G Unstake - Relayer Service
 * 
 * This script runs the relayer bot that:
 * 1. Monitors for rescue requests (signed EIP-7702 authorizations)
 * 2. Validates the rescue can be executed
 * 3. Submits the transaction with the authorization list (MEV-protected)
 * 4. Pays gas upfront and gets reimbursed in tokens
 * 
 * Usage: npm run relayer
 * 
 * MEV Protection:
 * - Uses private mempools when available (Flashbots/MEV Blocker)
 * - Automatically falls back to public mempool on testnets
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  formatEther,
  parseEther,
  encodeFunctionData,
  type Hex,
  type TransactionReceipt,
} from 'viem';
import {
  sepolia,
  getRelayerAccount,
  getContractAddresses,
} from './utils/config';
import {
  StakingVaultABI,
  UnstakeDelegateABI,
  ZeroGTokenABI,
} from './utils/abis';
import {
  createMevProtectedRelayer,
  type MevProtectionConfig,
} from './utils/mevProtection';

// Types for EIP-7702
interface SignedAuthorization {
  contractAddress: `0x${string}`;
  chainId: number;
  nonce: bigint;
  v: number;
  r: `0x${string}`;
  s: `0x${string}`;
}

interface RescueRequest {
  userAddress: `0x${string}`;
  vaultAddress: `0x${string}`;
  authorization: SignedAuthorization;
  maxFee: bigint;
  timestamp: number;
}

// Create clients
const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(),
});

const relayerAccount = getRelayerAccount();

const walletClient = createWalletClient({
  account: relayerAccount,
  chain: sepolia,
  transport: http(),
});

/**
 * Check if a rescue request is valid and can be executed
 */
async function validateRescueRequest(request: RescueRequest): Promise<{
  valid: boolean;
  reason?: string;
  estimate?: {
    stakedAmount: bigint;
    estimatedFee: bigint;
    userWouldReceive: bigint;
  };
}> {
  const contracts = getContractAddresses();

  try {
    // Check if user can unstake
    const canUnstake = await publicClient.readContract({
      address: request.vaultAddress,
      abi: StakingVaultABI,
      functionName: 'canUnstake',
      args: [request.userAddress],
    });

    if (!canUnstake) {
      // Get more details about why
      const [amount, unlockTime] = await publicClient.readContract({
        address: request.vaultAddress,
        abi: StakingVaultABI,
        functionName: 'stakes',
        args: [request.userAddress],
      });

      if (amount === 0n) {
        return { valid: false, reason: 'User has no stake in this vault' };
      }

      const currentTime = BigInt(Math.floor(Date.now() / 1000));
      if (unlockTime > currentTime) {
        const remaining = unlockTime - currentTime;
        return {
          valid: false,
          reason: `Stake still locked. ${remaining} seconds remaining.`,
        };
      }
    }

    // Get rescue estimate
    const [stakedAmount, estimatedFee, userWouldReceive, canRescue] =
      await publicClient.readContract({
        address: contracts.delegate,
        abi: UnstakeDelegateABI,
        functionName: 'estimateRescue',
        args: [request.vaultAddress, request.userAddress],
      });

    if (!canRescue) {
      return { valid: false, reason: 'Cannot rescue at this time' };
    }

    // Check max fee
    if (estimatedFee > request.maxFee) {
      return {
        valid: false,
        reason: `Fee ${formatEther(estimatedFee)} exceeds max ${formatEther(request.maxFee)}`,
      };
    }

    return {
      valid: true,
      estimate: { stakedAmount, estimatedFee, userWouldReceive },
    };
  } catch (error) {
    return { valid: false, reason: `Validation error: ${error}` };
  }
}

// MEV Protection configuration (can be overridden via environment)
const mevConfig: Partial<MevProtectionConfig> = {
  enabled: process.env.MEV_PROTECTION !== 'false', // Enabled by default
  provider: (process.env.MEV_PROVIDER as 'flashbots' | 'mev-blocker' | 'public') || 'mev-blocker',
  fallbackToPublic: true,
  maxRetries: 3,
};

/**
 * Execute a rescue transaction with EIP-7702 authorization
 * Uses MEV protection to prevent front-running/sandwich attacks
 */
async function executeRescue(request: RescueRequest): Promise<{
  success: boolean;
  txHash?: Hex;
  receipt?: TransactionReceipt;
  error?: string;
  mevProtected?: boolean;
}> {
  const contracts = getContractAddresses();

  console.log('\n🚀 Executing rescue transaction...');
  console.log(`   User: ${request.userAddress}`);
  console.log(`   Vault: ${request.vaultAddress}`);
  console.log(`   Max Fee: ${formatEther(request.maxFee)} ZGT`);

  try {
    // Create MEV-protected relayer
    const protectedRelayer = createMevProtectedRelayer(relayerAccount, sepolia, mevConfig);
    
    // Encode the executeRescue call data
    const callData = encodeFunctionData({
      abi: UnstakeDelegateABI,
      functionName: 'executeRescue',
      args: [request.vaultAddress, relayerAccount.address, request.maxFee],
    });

    // Build the EIP-7702 transaction with MEV protection
    // The transaction is sent TO the user's address (which will have delegate code)
    // The authorizationList contains the signed delegation
    const result = await protectedRelayer.sendProtectedTransaction({
      to: request.userAddress,
      data: callData,
      gas: 500000n, // EIP-7702 transactions need more gas
      authorizationList: [
        {
          address: request.authorization.contractAddress,
          chainId: request.authorization.chainId,
          nonce: Number(request.authorization.nonce),
          r: request.authorization.r,
          s: request.authorization.s,
          yParity: request.authorization.v === 27 ? 0 : 1,
        },
      ] as any,
    });

    console.log(`   ✅ Transaction submitted: ${result.hash}`);
    console.log(`   🛡️  MEV Protected: ${result.wasProtected ? 'Yes' : 'No'}`);

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: result.hash,
    });

    if (receipt.status === 'success') {
      console.log(`   ✅ Transaction confirmed in block ${receipt.blockNumber}`);
      return { 
        success: true, 
        txHash: result.hash, 
        receipt,
        mevProtected: result.wasProtected,
      };
    } else {
      return { success: false, txHash: result.hash, error: 'Transaction reverted' };
    }
  } catch (error) {
    console.error(`   ❌ Transaction failed:`, error);
    return { success: false, error: String(error) };
  }
}

/**
 * Get relayer's current balance and status
 */
async function getRelayerStatus() {
  const contracts = getContractAddresses();

  const bnbBalance = await publicClient.getBalance({
    address: relayerAccount.address,
  });

  const tokenBalance = await publicClient.readContract({
    address: contracts.token,
    abi: ZeroGTokenABI,
    functionName: 'balanceOf',
    args: [relayerAccount.address],
  });

  return {
    address: relayerAccount.address,
    bnbBalance,
    tokenBalance,
  };
}

/**
 * Process a rescue request from a file or API
 * In production, this would listen to a queue, API, or blockchain events
 */
async function processRescueRequest(request: RescueRequest) {
  console.log('\n📥 Processing rescue request...');

  // Validate
  const validation = await validateRescueRequest(request);
  if (!validation.valid) {
    console.log(`❌ Validation failed: ${validation.reason}`);
    return;
  }

  console.log('✅ Request validated');
  console.log(`   Staked: ${formatEther(validation.estimate!.stakedAmount)} ZGT`);
  console.log(`   Fee: ${formatEther(validation.estimate!.estimatedFee)} ZGT`);
  console.log(`   User receives: ${formatEther(validation.estimate!.userWouldReceive)} ZGT`);

  // Execute
  const result = await executeRescue(request);

  if (result.success) {
    console.log('\n🎉 Rescue successful!');
    console.log(`   Tx: https://sepolia.etherscan.io/tx/${result.txHash}`);
  } else {
    console.log(`\n❌ Rescue failed: ${result.error}`);
  }
}

/**
 * Main relayer loop
 */
async function main() {
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║     Zero-G Unstake - Relayer Service      ║');
  console.log('╚═══════════════════════════════════════════╝');

  // Check relayer status
  const status = await getRelayerStatus();
  console.log('\n📊 Relayer Status:');
  console.log(`   Address: ${status.address}`);
  console.log(`   BNB Balance: ${formatEther(status.bnbBalance)} tBNB`);
  console.log(`   ZGT Balance: ${formatEther(status.tokenBalance)} ZGT`);

  if (status.bnbBalance < parseEther('0.01')) {
    console.log('\n⚠️  Warning: Low BNB balance! Please fund the relayer.');
  }

  const contracts = getContractAddresses();
  console.log('\n📝 Contract Addresses:');
  console.log(`   Token: ${contracts.token}`);
  console.log(`   Vault: ${contracts.vault}`);
  console.log(`   Delegate: ${contracts.delegate}`);

  console.log('\n👂 Relayer is ready to process rescue requests.');
  console.log('   In production, this would listen for incoming requests.');
  console.log('   For demo, use the userSign.ts script to generate a request.');

  // For demo purposes, we'll just show the relayer is running
  // In production, you would:
  // 1. Listen to a message queue (Redis, RabbitMQ, etc.)
  // 2. Watch blockchain events
  // 3. Expose an API endpoint for users to submit requests

  // Example: Process a single request if provided via command line
  if (process.argv[2] === '--request') {
    try {
      const requestFile = process.argv[3];
      const request = require(requestFile) as RescueRequest;
      await processRescueRequest(request);
    } catch (error) {
      console.log('\n💡 Usage: npm run relayer -- --request ./request.json');
    }
  }
}

// Run the relayer
main().catch(console.error);
