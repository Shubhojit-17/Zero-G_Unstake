import { NextRequest, NextResponse } from 'next/server';
import { createWalletClient, createPublicClient, http, parseAbi } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// Contract addresses from environment
const CONTRACTS = {
  vault: process.env.STAKING_VAULT_ADDRESS as `0x${string}`,
  delegate: process.env.UNSTAKE_DELEGATE_ADDRESS as `0x${string}`,
};

const UnstakeDelegateABI = parseAbi([
  'function rescueStake(address vault, address user, uint256 maxFeeBps) external returns (uint256)',
  'function estimateRescue(address vault, address user) external view returns (uint256 amount, uint256 fee, uint256 netAmount)',
]);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userAddress, vaultAddress, authorization, maxFeeBps = 200 } = body;

    // Validate inputs
    if (!userAddress || !authorization) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get relayer private key from environment
    const relayerPrivateKey = process.env.RELAYER_PRIVATE_KEY as `0x${string}`;
    if (!relayerPrivateKey) {
      return NextResponse.json({ error: 'Relayer not configured' }, { status: 500 });
    }

    const relayerAccount = privateKeyToAccount(relayerPrivateKey);

    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http(process.env.SEPOLIA_RPC || 'https://ethereum-sepolia-rpc.publicnode.com'),
    });

    const walletClient = createWalletClient({
      account: relayerAccount,
      chain: sepolia,
      transport: http(process.env.SEPOLIA_RPC || 'https://ethereum-sepolia-rpc.publicnode.com'),
    });

    // Check if user has staked tokens
    const estimate = await publicClient.readContract({
      address: CONTRACTS.delegate,
      abi: UnstakeDelegateABI,
      functionName: 'estimateRescue',
      args: [vaultAddress || CONTRACTS.vault, userAddress],
    });

    if (estimate[0] === 0n) {
      return NextResponse.json({ error: 'No stake to rescue' }, { status: 400 });
    }

    // Convert authorization to proper format
    const formattedAuth = {
      address: authorization.address as `0x${string}`,
      chainId: Number(authorization.chainId),
      nonce: Number(authorization.nonce),
      r: authorization.r as `0x${string}`,
      s: authorization.s as `0x${string}`,
      yParity: authorization.yParity,
    };

    // Send rescue transaction with EIP-7702 authorization
    const txHash = await walletClient.sendTransaction({
      to: userAddress,
      data: encodeFunctionCall('rescueStake', [vaultAddress || CONTRACTS.vault, userAddress, BigInt(maxFeeBps)]),
      authorizationList: [formattedAuth],
      gas: 500000n,
    });

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      confirmations: 1,
    });

    return NextResponse.json({
      success: true,
      txHash,
      blockNumber: receipt.blockNumber.toString(),
      gasUsed: receipt.gasUsed.toString(),
      estimate: {
        amount: estimate[0].toString(),
        fee: estimate[1].toString(),
        netAmount: estimate[2].toString(),
      },
    });
  } catch (error: any) {
    console.error('Rescue API error:', error);
    return NextResponse.json(
      { error: error.message || 'Rescue transaction failed' },
      { status: 500 }
    );
  }
}

// Helper to encode function call
function encodeFunctionCall(
  functionName: string,
  args: any[]
): `0x${string}` {
  const { encodeFunctionData } = require('viem');
  return encodeFunctionData({
    abi: UnstakeDelegateABI,
    functionName,
    args,
  });
}

export async function GET() {
  return NextResponse.json({
    service: 'Zero-G Unstake Relayer API',
    endpoints: {
      POST: {
        description: 'Submit a rescue transaction',
        body: {
          userAddress: 'Address of the user to rescue',
          vaultAddress: 'Optional - staking vault address',
          authorization: 'EIP-7702 signed authorization object',
          maxFeeBps: 'Optional - max fee in basis points (default: 200 = 2%)',
        },
      },
    },
  });
}
