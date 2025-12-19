import { createWalletClient, createPublicClient, http, parseEther, formatEther } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import * as dotenv from 'dotenv';

dotenv.config();

async function transfer() {
  // Use deployer instead of relayer
  const deployer = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY as `0x${string}`);
  const userAddress = privateKeyToAccount(process.env.USER_PRIVATE_KEY as `0x${string}`).address;
  
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(process.env.SEPOLIA_RPC),
  });
  
  const walletClient = createWalletClient({
    account: deployer,
    chain: sepolia,
    transport: http(process.env.SEPOLIA_RPC),
  });
  
  // Check balances
  const deployerBal = await publicClient.getBalance({ address: deployer.address });
  const userBal = await publicClient.getBalance({ address: userAddress });
  
  console.log('Deployer balance:', formatEther(deployerBal), 'ETH');
  console.log('User balance:', formatEther(userBal), 'ETH');
  console.log('User address:', userAddress);
  
  // Check if user has code (EIP-7702 delegation)
  const userCode = await publicClient.getCode({ address: userAddress });
  console.log('User has code:', userCode ? 'Yes' : 'No');
  
  // Transfer 0.002 ETH to user (enough for a few transactions)
  const amount = parseEther('0.002');
  console.log('\nTransferring 0.002 ETH to user...');
  
  const hash = await walletClient.sendTransaction({
    to: userAddress,
    value: amount,
    gas: 50000n, // Explicit gas limit
  });
  
  console.log('TX Hash:', hash);
  
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log('Confirmed in block:', receipt.blockNumber);
  
  const newUserBal = await publicClient.getBalance({ address: userAddress });
  console.log('\n✅ New user balance:', formatEther(newUserBal), 'ETH');
}

transfer().catch(console.error);
