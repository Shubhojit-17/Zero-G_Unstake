/**
 * Zero-G Unstake - Status Checker
 * 
 * Utility script to check the status of all contracts and accounts
 * 
 * Usage: npm run status
 */

import {
  createPublicClient,
  http,
  formatEther,
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

async function main() {
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║     Zero-G Unstake - Status Checker       ║');
  console.log('╚═══════════════════════════════════════════╝');

  let contracts;
  try {
    contracts = getContractAddresses();
  } catch (error) {
    console.log('\n❌ Contracts not deployed yet.');
    console.log('   Run: forge script script/Deploy.s.sol --rpc-url $BSC_TESTNET_RPC --broadcast');
    return;
  }

  console.log('\n📝 Contract Addresses:');
  console.log(`   ZeroGToken: ${contracts.token}`);
  console.log(`   StakingVault: ${contracts.vault}`);
  console.log(`   UnstakeDelegate: ${contracts.delegate}`);

  // Get vault config
  console.log('\n⚙️  Vault Configuration:');
  const stakingToken = await publicClient.readContract({
    address: contracts.vault,
    abi: StakingVaultABI,
    functionName: 'stakingToken',
  });
  const lockDuration = await publicClient.readContract({
    address: contracts.vault,
    abi: StakingVaultABI,
    functionName: 'lockDuration',
  });
  const feeBps = await publicClient.readContract({
    address: contracts.delegate,
    abi: UnstakeDelegateABI,
    functionName: 'getRelayerFeeBps',
  });

  console.log(`   Staking Token: ${stakingToken}`);
  console.log(`   Lock Duration: ${lockDuration} seconds`);
  console.log(`   Relayer Fee: ${feeBps} bps (${Number(feeBps) / 100}%)`);

  // Get accounts
  const deployer = getDeployerAccount();
  const relayer = getRelayerAccount();
  const user = getUserAccount();

  // Account balances
  console.log('\n👤 Account Balances:');

  for (const [name, account] of [
    ['Deployer', deployer],
    ['Relayer', relayer],
    ['User', user],
  ] as const) {
    const bnbBalance = await publicClient.getBalance({
      address: account.address,
    });
    const tokenBalance = await publicClient.readContract({
      address: contracts.token,
      abi: ZeroGTokenABI,
      functionName: 'balanceOf',
      args: [account.address],
    });

    console.log(`\n   ${name}: ${account.address}`);
    console.log(`      BNB: ${formatEther(bnbBalance)} tBNB`);
    console.log(`      ZGT: ${formatEther(tokenBalance)} ZGT`);
  }

  // User stake info
  console.log('\n📦 User Stake Status:');
  const [stakedAmount, unlockTime] = await publicClient.readContract({
    address: contracts.vault,
    abi: StakingVaultABI,
    functionName: 'stakes',
    args: [user.address],
  });
  const canUnstake = await publicClient.readContract({
    address: contracts.vault,
    abi: StakingVaultABI,
    functionName: 'canUnstake',
    args: [user.address],
  });

  console.log(`   Staked: ${formatEther(stakedAmount)} ZGT`);
  if (unlockTime > 0n) {
    const now = BigInt(Math.floor(Date.now() / 1000));
    console.log(`   Unlock Time: ${new Date(Number(unlockTime) * 1000).toISOString()}`);
    if (unlockTime > now) {
      console.log(`   Time Remaining: ${unlockTime - now} seconds`);
    }
  }
  console.log(`   Can Unstake: ${canUnstake}`);

  // Rescue estimate
  if (stakedAmount > 0n) {
    console.log('\n💰 Rescue Estimate:');
    const [estStaked, estFee, estUserReceives, canRescue] = await publicClient.readContract({
      address: contracts.delegate,
      abi: UnstakeDelegateABI,
      functionName: 'estimateRescue',
      args: [contracts.vault, user.address],
    });

    console.log(`   Staked Amount: ${formatEther(estStaked)} ZGT`);
    console.log(`   Relayer Fee: ${formatEther(estFee)} ZGT`);
    console.log(`   User Receives: ${formatEther(estUserReceives)} ZGT`);
    console.log(`   Can Rescue: ${canRescue}`);
  }

  console.log('\n✅ Status check complete!');
}

main().catch(console.error);
