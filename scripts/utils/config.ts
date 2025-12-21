import { defineChain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * BSC Testnet chain definition
 */
export const bscTestnet = defineChain({
  id: 97,
  name: 'BSC Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Test BNB',
    symbol: 'tBNB',
  },
  rpcUrls: {
    default: {
      http: [process.env.BSC_TESTNET_RPC || 'https://bsc-testnet-rpc.publicnode.com'],
    },
  },
  blockExplorers: {
    default: {
      name: 'BscScan Testnet',
      url: 'https://testnet.bscscan.com',
    },
  },
  testnet: true,
});

/**
 * Get deployer account from private key
 */
export function getDeployerAccount() {
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('DEPLOYER_PRIVATE_KEY not set in environment');
  }
  return privateKeyToAccount(privateKey as `0x${string}`);
}

/**
 * Get relayer account from private key
 */
export function getRelayerAccount() {
  const privateKey = process.env.RELAYER_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('RELAYER_PRIVATE_KEY not set in environment');
  }
  return privateKeyToAccount(privateKey as `0x${string}`);
}

/**
 * Get user account from private key
 */
export function getUserAccount() {
  const privateKey = process.env.USER_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('USER_PRIVATE_KEY not set in environment');
  }
  return privateKeyToAccount(privateKey as `0x${string}`);
}

/**
 * Get deployed contract addresses from environment
 */
export function getContractAddresses() {
  const tokenAddress = process.env.ZERO_G_TOKEN_ADDRESS;
  const vaultAddress = process.env.STAKING_VAULT_ADDRESS;
  const delegateAddress = process.env.UNSTAKE_DELEGATE_ADDRESS;

  if (!tokenAddress || !vaultAddress || !delegateAddress) {
    throw new Error(
      'Contract addresses not set. Please deploy contracts first and update .env file.'
    );
  }

  return {
    token: tokenAddress as `0x${string}`,
    vault: vaultAddress as `0x${string}`,
    delegate: delegateAddress as `0x${string}`,
  };
}

/**
 * Relayer fee configuration
 */
export const RELAYER_FEE_BPS = parseInt(process.env.RELAYER_FEE_BPS || '100', 10);
