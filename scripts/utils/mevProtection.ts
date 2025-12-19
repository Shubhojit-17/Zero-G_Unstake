/**
 * MEV Protection Utilities
 * 
 * Provides MEV-safe transaction submission via private mempools:
 * - Flashbots Protect (Ethereum Mainnet)
 * - MEV Blocker (Multi-chain)
 * - Fallback to public mempool
 * 
 * On testnets, MEV protection is simulated (testnets don't have MEV issues)
 */

import {
  createWalletClient,
  createPublicClient,
  http,
  type Account,
  type Chain,
  type Hash,
  type TransactionRequest,
} from 'viem';
import { sepolia } from './config';

// ============ Types ============

export interface MevProtectionConfig {
  enabled: boolean;
  provider: 'flashbots' | 'mev-blocker' | 'public';
  maxRetries: number;
  fallbackToPublic: boolean;
}

export interface ProtectedTransactionResult {
  hash: Hash;
  provider: string;
  wasProtected: boolean;
}

// ============ RPC Endpoints ============

/**
 * MEV Protection RPC endpoints by network
 * Note: Testnet endpoints are public since MEV isn't a concern there
 */
const MEV_RPC_ENDPOINTS: Record<number, Record<string, string>> = {
  // Ethereum Mainnet
  1: {
    flashbots: 'https://rpc.flashbots.net',
    'mev-blocker': 'https://rpc.mevblocker.io',
    public: 'https://eth.llamarpc.com',
  },
  // Sepolia Testnet (no real MEV protection, use public)
  11155111: {
    flashbots: 'https://ethereum-sepolia-rpc.publicnode.com', // Simulated
    'mev-blocker': 'https://ethereum-sepolia-rpc.publicnode.com', // Simulated
    public: 'https://ethereum-sepolia-rpc.publicnode.com',
  },
  // BSC Mainnet
  56: {
    flashbots: 'https://bsc-dataseed.binance.org', // No Flashbots on BSC
    'mev-blocker': 'https://bsc-dataseed.binance.org',
    public: 'https://bsc-dataseed.binance.org',
  },
  // BSC Testnet
  97: {
    flashbots: 'https://data-seed-prebsc-1-s1.binance.org:8545',
    'mev-blocker': 'https://data-seed-prebsc-1-s1.binance.org:8545',
    public: 'https://data-seed-prebsc-1-s1.binance.org:8545',
  },
};

// ============ Default Config ============

const DEFAULT_CONFIG: MevProtectionConfig = {
  enabled: true,
  provider: 'mev-blocker',
  maxRetries: 3,
  fallbackToPublic: true,
};

// ============ MEV Protection Class ============

export class MevProtectedRelayer {
  private config: MevProtectionConfig;
  private chain: Chain;
  private account: Account;

  constructor(
    account: Account,
    chain: Chain = sepolia,
    config: Partial<MevProtectionConfig> = {}
  ) {
    this.account = account;
    this.chain = chain;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get the appropriate RPC URL based on protection settings
   */
  private getRpcUrl(): string {
    const chainId = this.chain.id;
    const endpoints = MEV_RPC_ENDPOINTS[chainId];

    if (!endpoints) {
      console.warn(`⚠️ No MEV endpoints configured for chain ${chainId}, using default`);
      return this.chain.rpcUrls.default.http[0];
    }

    if (!this.config.enabled) {
      return endpoints.public;
    }

    return endpoints[this.config.provider] || endpoints.public;
  }

  /**
   * Create a wallet client with MEV protection
   */
  private createProtectedClient() {
    const rpcUrl = this.getRpcUrl();
    
    return createWalletClient({
      account: this.account,
      chain: this.chain,
      transport: http(rpcUrl),
    });
  }

  /**
   * Create a public client for reading state
   */
  createPublicClient() {
    return createPublicClient({
      chain: this.chain,
      transport: http(this.getRpcUrl()),
    });
  }

  /**
   * Send a transaction with MEV protection
   */
  async sendProtectedTransaction(
    tx: TransactionRequest & { authorizationList?: any[] }
  ): Promise<ProtectedTransactionResult> {
    const client = this.createProtectedClient();
    const provider = this.config.enabled ? this.config.provider : 'public';

    console.log(`\n🛡️  MEV Protection: ${this.config.enabled ? 'ENABLED' : 'DISABLED'}`);
    if (this.config.enabled) {
      console.log(`   Provider: ${provider}`);
      console.log(`   RPC: ${this.getRpcUrl()}`);
    }

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        console.log(`   Attempt ${attempt}/${this.config.maxRetries}...`);

        const hash = await client.sendTransaction({
          ...tx,
          account: this.account,
          chain: this.chain,
        } as any);

        console.log(`   ✅ Transaction submitted: ${hash}`);

        return {
          hash,
          provider,
          wasProtected: this.config.enabled && provider !== 'public',
        };
      } catch (error: any) {
        lastError = error;
        console.error(`   ❌ Attempt ${attempt} failed:`, error.message);

        // If this was a protected attempt and fallback is enabled, try public
        if (
          this.config.enabled &&
          this.config.fallbackToPublic &&
          attempt === this.config.maxRetries
        ) {
          console.log('   🔄 Falling back to public mempool...');
          this.config.enabled = false;
          return this.sendProtectedTransaction(tx);
        }
      }
    }

    throw lastError || new Error('Transaction failed after all retries');
  }

  /**
   * Get current protection status
   */
  getStatus(): { enabled: boolean; provider: string; rpc: string } {
    return {
      enabled: this.config.enabled,
      provider: this.config.provider,
      rpc: this.getRpcUrl(),
    };
  }

  /**
   * Check if the network supports real MEV protection
   */
  supportsRealMevProtection(): boolean {
    // Only Ethereum mainnet has real MEV protection infrastructure
    return this.chain.id === 1;
  }
}

// ============ Helper Functions ============

/**
 * Create a MEV-protected relayer with default settings
 */
export function createMevProtectedRelayer(
  account: Account,
  chain: Chain = sepolia,
  options?: Partial<MevProtectionConfig>
): MevProtectedRelayer {
  return new MevProtectedRelayer(account, chain, options);
}

/**
 * Quick helper to send a protected transaction
 */
export async function sendMevProtectedTransaction(
  account: Account,
  chain: Chain,
  tx: TransactionRequest & { authorizationList?: any[] },
  options?: Partial<MevProtectionConfig>
): Promise<ProtectedTransactionResult> {
  const relayer = createMevProtectedRelayer(account, chain, options);
  return relayer.sendProtectedTransaction(tx);
}
