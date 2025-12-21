import { NextRequest, NextResponse } from 'next/server';
import { createWalletClient, createPublicClient, http, parseAbi, encodeFunctionData } from 'viem';
import { bscTestnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// Contract addresses from environment
const CONTRACTS = {
  vault: process.env.STAKING_VAULT_ADDRESS as `0x${string}`,
  delegate: process.env.UNSTAKE_DELEGATE_ADDRESS as `0x${string}`,
};

const UnstakeDelegateABI = parseAbi([
  'function executeRescue(address vault, address relayer, uint256 maxFee) external',
  'function estimateRescue(address vault, address user) external view returns (uint256 amount, uint256 fee, uint256 netAmount, bool canRescue)',
]);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userAddress, vaultAddress, maxFeeBps = 200 } = body;

    // Validate inputs
    if (!userAddress) {
      return NextResponse.json({ error: 'Missing user address' }, { status: 400 });
    }

    // Get private keys from environment
    const relayerPrivateKey = process.env.RELAYER_PRIVATE_KEY as `0x${string}`;
    const userPrivateKey = process.env.USER_PRIVATE_KEY as `0x${string}`;
    
    if (!relayerPrivateKey) {
      return NextResponse.json({ error: 'Relayer not configured' }, { status: 500 });
    }
    if (!userPrivateKey) {
      return NextResponse.json({ error: 'User private key not configured for demo' }, { status: 500 });
    }

    const relayerAccount = privateKeyToAccount(relayerPrivateKey);
    const userAccount = privateKeyToAccount(userPrivateKey);

    // Verify the user address matches the configured user
    if (userAddress.toLowerCase() !== userAccount.address.toLowerCase()) {
      return NextResponse.json({ 
        error: `Demo mode: Only the configured test wallet can use this. Expected ${userAccount.address}` 
      }, { status: 400 });
    }

    const publicClient = createPublicClient({
      chain: bscTestnet,
      transport: http(process.env.BSC_TESTNET_RPC || 'https://bsc-testnet-rpc.publicnode.com'),
    });

    const relayerWalletClient = createWalletClient({
      account: relayerAccount,
      chain: bscTestnet,
      transport: http(process.env.BSC_TESTNET_RPC || 'https://bsc-testnet-rpc.publicnode.com'),
    });

    const userWalletClient = createWalletClient({
      account: userAccount,
      chain: bscTestnet,
      transport: http(process.env.BSC_TESTNET_RPC || 'https://bsc-testnet-rpc.publicnode.com'),
    });

    const vault = vaultAddress || CONTRACTS.vault;

    // Check if user has staked tokens
    const estimate = await publicClient.readContract({
      address: CONTRACTS.delegate,
      abi: UnstakeDelegateABI,
      functionName: 'estimateRescue',
      args: [vault, userAddress],
    });

    if (estimate[0] === 0n) {
      return NextResponse.json({ error: 'No stake to rescue' }, { status: 400 });
    }

    if (!estimate[3]) {
      return NextResponse.json({ error: 'Stake is still locked' }, { status: 400 });
    }

    // Sign EIP-7702 authorization server-side (since MetaMask doesn't support it yet)
    console.log('Signing EIP-7702 authorization for user:', userAddress);
    const authorization = await userWalletClient.signAuthorization({
      contractAddress: CONTRACTS.delegate,
    });

    console.log('Authorization signed:', {
      address: authorization.contractAddress,
      chainId: authorization.chainId,
      nonce: authorization.nonce,
    });

    // Calculate max fee (2% of staked amount)
    const maxFee = (estimate[0] * BigInt(maxFeeBps)) / 10000n;

    // Encode the executeRescue call
    const callData = encodeFunctionData({
      abi: UnstakeDelegateABI,
      functionName: 'executeRescue',
      args: [vault, relayerAccount.address, maxFee],
    });

    console.log('Submitting EIP-7702 rescue transaction...');

    // Send rescue transaction with EIP-7702 authorization
    const txHash = await relayerWalletClient.sendTransaction({
      to: userAddress,
      data: callData,
      authorizationList: [authorization],
      gas: 500000n,
    });

    console.log('Transaction submitted:', txHash);

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      confirmations: 1,
    });

    console.log('Transaction confirmed in block:', receipt.blockNumber);

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

export async function GET() {
  return NextResponse.json({
    service: 'Zero-G Unstake Relayer API',
    version: '1.0.0',
    note: 'Demo mode - EIP-7702 signing happens server-side since MetaMask does not support it yet',
    endpoints: {
      POST: {
        description: 'Submit a rescue transaction',
        body: {
          userAddress: 'Address of the user to rescue',
          vaultAddress: 'Optional - staking vault address',
          maxFeeBps: 'Optional - max fee in basis points (default: 200 = 2%)',
        },
      },
    },
  });
}
