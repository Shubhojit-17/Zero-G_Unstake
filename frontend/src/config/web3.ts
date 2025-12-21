import { http, createConfig } from 'wagmi';
import { bscTestnet } from 'wagmi/chains';
import { getDefaultConfig } from 'connectkit';

// Contract addresses (deployed on BSC Testnet)
export const CONTRACTS = {
  token: '0xACDca6c55F4CBA946763413854341b9E5556212A' as `0x${string}`,
  vault: '0x5085d1DD5FbDA9166094C3a3dc41dea7Df8fD9e7' as `0x${string}`,
  delegate: '0x8ca2A267D31989FE05111cd46326AFA6971607AF' as `0x${string}`,
};

// Relayer API endpoint (for submitting rescue requests)
// Uses Next.js API route when running locally
export const RELAYER_API = process.env.NEXT_PUBLIC_RELAYER_API || '/api';

// Wagmi config with ConnectKit
export const config = createConfig(
  getDefaultConfig({
    chains: [bscTestnet],
    transports: {
      [bscTestnet.id]: http('https://bsc-testnet-rpc.publicnode.com'),
    },
    walletConnectProjectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || '',
    appName: 'Zero-G Unstake',
    appDescription: 'Gasless Emergency Exit - Unstake with Zero Gas',
    appUrl: 'https://zero-g-unstake.vercel.app',
    appIcon: 'https://zero-g-unstake.vercel.app/logo.png',
  })
);

// ABIs
export const StakingVaultABI = [
  {
    name: 'stake',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'unstake',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'stakedBalance',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'unlockTime',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'canUnstake',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'lockDuration',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'stakingToken',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

export const UnstakeDelegateABI = [
  {
    name: 'executeRescue',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'vault', type: 'address' },
      { name: 'relayer', type: 'address' },
      { name: 'maxFee', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'estimateRescue',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'vault', type: 'address' },
      { name: 'user', type: 'address' },
    ],
    outputs: [
      { name: 'stakedAmount', type: 'uint256' },
      { name: 'estimatedFee', type: 'uint256' },
      { name: 'userWouldReceive', type: 'uint256' },
      { name: 'canRescue', type: 'bool' },
    ],
  },
  {
    name: 'DEFAULT_RELAYER_FEE_BPS',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

export const ERC20ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
] as const;
