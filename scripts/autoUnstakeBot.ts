/**
 * Zero-G Unstake - Auto-Unstake Bot
 * 
 * This service automatically monitors for users with:
 * 1. Expired stake locks
 * 2. Pre-signed EIP-7702 authorizations
 * 
 * When both conditions are met, it automatically executes the rescue.
 * 
 * Architecture:
 * - Monitors StakingVault for Staked events
 * - Stores pre-signed authorizations from users
 * - Periodically checks for rescuable stakes
 * - Executes rescue when eligible
 * 
 * Usage: npm run bot
 */

import {
  createPublicClient,
  http,
  formatEther,
  parseEther,
  encodeFunctionData,
  type Hex,
  type Log,
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
import * as fs from 'fs';
import * as path from 'path';

// ============ Types ============

interface SignedAuthorization {
  address: `0x${string}`;
  chainId: number;
  nonce: number;
  r: `0x${string}`;
  s: `0x${string}`;
  yParity: number;
}

interface RegisteredUser {
  userAddress: `0x${string}`;
  authorization: SignedAuthorization;
  maxFeeBps: number;
  registeredAt: number;
  lastChecked?: number;
  rescued?: boolean;
  rescueTxHash?: string;
}

interface StakeInfo {
  userAddress: `0x${string}`;
  amount: bigint;
  unlockTime: bigint;
  canRescue: boolean;
}

interface BotConfig {
  checkIntervalMs: number;
  maxConcurrentRescues: number;
  minProfitBps: number;
  mevProtection: Partial<MevProtectionConfig>;
}

// ============ Constants ============

const DEFAULT_CONFIG: BotConfig = {
  checkIntervalMs: 30000, // Check every 30 seconds
  maxConcurrentRescues: 5,
  minProfitBps: 50, // Minimum 0.5% profit to execute
  mevProtection: {
    enabled: true,
    provider: 'mev-blocker',
    fallbackToPublic: true,
  },
};

const DATA_DIR = path.join(process.cwd(), '.bot-data');
const REGISTRATIONS_FILE = path.join(DATA_DIR, 'registrations.json');

// ============ Storage ============

/**
 * Simple file-based storage for registered users
 * In production, use a database like PostgreSQL/Redis
 */
class UserRegistry {
  private users: Map<string, RegisteredUser> = new Map();

  constructor() {
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(REGISTRATIONS_FILE)) {
        const data = JSON.parse(fs.readFileSync(REGISTRATIONS_FILE, 'utf-8'));
        for (const user of data) {
          this.users.set(user.userAddress.toLowerCase(), user);
        }
        console.log(`📂 Loaded ${this.users.size} registered users from disk`);
      }
    } catch (error) {
      console.warn('⚠️ Could not load registrations:', error);
    }
  }

  private saveToDisk(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const data = Array.from(this.users.values());
      fs.writeFileSync(REGISTRATIONS_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('❌ Could not save registrations:', error);
    }
  }

  register(user: RegisteredUser): void {
    this.users.set(user.userAddress.toLowerCase(), user);
    this.saveToDisk();
    console.log(`✅ Registered user ${user.userAddress} for auto-unstake`);
  }

  unregister(userAddress: string): void {
    this.users.delete(userAddress.toLowerCase());
    this.saveToDisk();
  }

  get(userAddress: string): RegisteredUser | undefined {
    return this.users.get(userAddress.toLowerCase());
  }

  getAll(): RegisteredUser[] {
    return Array.from(this.users.values());
  }

  getPending(): RegisteredUser[] {
    return this.getAll().filter(u => !u.rescued);
  }

  markRescued(userAddress: string, txHash: string): void {
    const user = this.get(userAddress);
    if (user) {
      user.rescued = true;
      user.rescueTxHash = txHash;
      this.saveToDisk();
    }
  }

  updateLastChecked(userAddress: string): void {
    const user = this.get(userAddress);
    if (user) {
      user.lastChecked = Date.now();
    }
  }
}

// ============ Auto-Unstake Bot ============

class AutoUnstakeBot {
  private config: BotConfig;
  private registry: UserRegistry;
  private publicClient;
  private relayerAccount;
  private contracts;
  private isRunning = false;
  private intervalId?: NodeJS.Timeout;

  constructor(config: Partial<BotConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.registry = new UserRegistry();
    this.relayerAccount = getRelayerAccount();
    this.contracts = getContractAddresses();

    this.publicClient = createPublicClient({
      chain: sepolia,
      transport: http(),
    });
  }

  /**
   * Register a user for auto-unstake
   */
  registerUser(
    userAddress: `0x${string}`,
    authorization: SignedAuthorization,
    maxFeeBps: number = 200
  ): void {
    this.registry.register({
      userAddress,
      authorization,
      maxFeeBps,
      registeredAt: Date.now(),
    });
  }

  /**
   * Get stake info for a user
   */
  async getStakeInfo(userAddress: `0x${string}`): Promise<StakeInfo> {
    const [stakedBalance, unlockTime, canUnstake] = await Promise.all([
      this.publicClient.readContract({
        address: this.contracts.vault,
        abi: StakingVaultABI,
        functionName: 'stakedBalance',
        args: [userAddress],
      }) as Promise<bigint>,
      this.publicClient.readContract({
        address: this.contracts.vault,
        abi: StakingVaultABI,
        functionName: 'unlockTime',
        args: [userAddress],
      }) as Promise<bigint>,
      this.publicClient.readContract({
        address: this.contracts.vault,
        abi: StakingVaultABI,
        functionName: 'canUnstake',
        args: [userAddress],
      }) as Promise<boolean>,
    ]);

    return {
      userAddress,
      amount: stakedBalance,
      unlockTime,
      canRescue: canUnstake && stakedBalance > 0n,
    };
  }

  /**
   * Execute a rescue for a registered user
   */
  async executeRescue(user: RegisteredUser): Promise<{ success: boolean; txHash?: string; error?: string }> {
    console.log(`\n🚀 Executing rescue for ${user.userAddress}`);

    try {
      // Get stake info
      const stakeInfo = await this.getStakeInfo(user.userAddress);
      
      if (!stakeInfo.canRescue) {
        return { success: false, error: 'Cannot rescue yet (locked or no stake)' };
      }

      // Calculate fee
      const maxFee = (stakeInfo.amount * BigInt(user.maxFeeBps)) / 10000n;

      // Create MEV-protected relayer
      const protectedRelayer = createMevProtectedRelayer(
        this.relayerAccount,
        sepolia,
        this.config.mevProtection
      );

      // Encode call data
      const callData = encodeFunctionData({
        abi: UnstakeDelegateABI,
        functionName: 'executeRescue',
        args: [this.contracts.vault, this.relayerAccount.address, maxFee],
      });

      // Submit transaction
      const result = await protectedRelayer.sendProtectedTransaction({
        to: user.userAddress,
        data: callData,
        gas: 500000n,
        authorizationList: [user.authorization] as any,
      });

      // Wait for confirmation
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash: result.hash,
      });

      if (receipt.status === 'success') {
        this.registry.markRescued(user.userAddress, result.hash);
        console.log(`✅ Rescue successful! TX: ${result.hash}`);
        return { success: true, txHash: result.hash };
      } else {
        return { success: false, txHash: result.hash, error: 'Transaction reverted' };
      }
    } catch (error: any) {
      console.error(`❌ Rescue failed:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check all pending users and rescue eligible ones
   */
  async checkAndRescue(): Promise<void> {
    const pendingUsers = this.registry.getPending();
    
    if (pendingUsers.length === 0) {
      return;
    }

    console.log(`\n🔍 Checking ${pendingUsers.length} registered users...`);

    for (const user of pendingUsers.slice(0, this.config.maxConcurrentRescues)) {
      try {
        const stakeInfo = await this.getStakeInfo(user.userAddress);
        this.registry.updateLastChecked(user.userAddress);

        if (stakeInfo.canRescue) {
          console.log(`   📍 User ${user.userAddress}: ELIGIBLE for rescue`);
          console.log(`      Staked: ${formatEther(stakeInfo.amount)} ZGT`);
          
          await this.executeRescue(user);
        } else if (stakeInfo.amount > 0n) {
          const now = BigInt(Math.floor(Date.now() / 1000));
          const timeLeft = stakeInfo.unlockTime - now;
          console.log(`   ⏳ User ${user.userAddress}: Locked for ${timeLeft}s more`);
        }
      } catch (error) {
        console.error(`   ❌ Error checking ${user.userAddress}:`, error);
      }
    }
  }

  /**
   * Get bot status
   */
  async getStatus(): Promise<{
    isRunning: boolean;
    registeredUsers: number;
    pendingRescues: number;
    completedRescues: number;
    relayerBalance: string;
    relayerTokens: string;
  }> {
    const allUsers = this.registry.getAll();
    const [bnbBalance, tokenBalance] = await Promise.all([
      this.publicClient.getBalance({ address: this.relayerAccount.address }),
      this.publicClient.readContract({
        address: this.contracts.token,
        abi: ZeroGTokenABI,
        functionName: 'balanceOf',
        args: [this.relayerAccount.address],
      }) as Promise<bigint>,
    ]);

    return {
      isRunning: this.isRunning,
      registeredUsers: allUsers.length,
      pendingRescues: allUsers.filter(u => !u.rescued).length,
      completedRescues: allUsers.filter(u => u.rescued).length,
      relayerBalance: formatEther(bnbBalance),
      relayerTokens: formatEther(tokenBalance),
    };
  }

  /**
   * Start the bot
   */
  start(): void {
    if (this.isRunning) {
      console.log('⚠️ Bot is already running');
      return;
    }

    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║          Zero-G Unstake - Auto-Unstake Bot                    ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log(`\n📋 Configuration:`);
    console.log(`   Check Interval: ${this.config.checkIntervalMs / 1000}s`);
    console.log(`   Max Concurrent: ${this.config.maxConcurrentRescues}`);
    console.log(`   MEV Protection: ${this.config.mevProtection.enabled ? 'Enabled' : 'Disabled'}`);
    console.log(`   Relayer: ${this.relayerAccount.address}`);
    console.log(`\n📂 Data Directory: ${DATA_DIR}`);

    this.isRunning = true;

    // Initial check
    this.checkAndRescue();

    // Start periodic checks
    this.intervalId = setInterval(() => {
      this.checkAndRescue();
    }, this.config.checkIntervalMs);

    console.log('\n✅ Bot started! Monitoring for rescuable stakes...\n');
  }

  /**
   * Stop the bot
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    this.isRunning = false;
    console.log('🛑 Bot stopped');
  }
}

// ============ CLI Interface ============

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'start';

  const bot = new AutoUnstakeBot();

  switch (command) {
    case 'start':
      bot.start();
      
      // Handle graceful shutdown
      process.on('SIGINT', () => {
        console.log('\n\n🛑 Shutting down...');
        bot.stop();
        process.exit(0);
      });
      
      // Keep the process running
      console.log('Press Ctrl+C to stop the bot\n');
      break;

    case 'status':
      const status = await bot.getStatus();
      console.log('\n📊 Bot Status:');
      console.log(`   Running: ${status.isRunning ? 'Yes' : 'No'}`);
      console.log(`   Registered Users: ${status.registeredUsers}`);
      console.log(`   Pending Rescues: ${status.pendingRescues}`);
      console.log(`   Completed Rescues: ${status.completedRescues}`);
      console.log(`   Relayer ETH: ${status.relayerBalance}`);
      console.log(`   Relayer ZGT: ${status.relayerTokens}`);
      break;

    case 'register':
      // Example: npm run bot register <userAddress> <authJson>
      if (args.length < 3) {
        console.log('Usage: npm run bot register <userAddress> <authorizationJson>');
        console.log('Example: npm run bot register 0x123... \'{"address":"0x...","chainId":11155111,...}\'');
        process.exit(1);
      }
      const userAddress = args[1] as `0x${string}`;
      const authJson = JSON.parse(args[2]);
      bot.registerUser(userAddress, authJson);
      console.log(`✅ Registered ${userAddress} for auto-unstake`);
      break;

    case 'check':
      console.log('🔍 Running one-time check...');
      await bot.checkAndRescue();
      console.log('✅ Check complete');
      break;

    default:
      console.log('Zero-G Unstake Auto-Unstake Bot\n');
      console.log('Commands:');
      console.log('  start    - Start the bot (default)');
      console.log('  status   - Show bot status');
      console.log('  check    - Run a single check cycle');
      console.log('  register - Register a user for auto-unstake');
  }
}

// Export for use as module
export { AutoUnstakeBot, UserRegistry };

// Run if called directly
main().catch(console.error);
