'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAccount, useReadContracts, useBalance } from 'wagmi';
import { formatEther } from 'viem';
import { CONTRACTS, StakingVaultABI, UnstakeDelegateABI, ERC20ABI } from '@/config/web3';

interface StakeInfoProps {
  onRescueClick: () => void;
}

export function StakeInfo({ onRescueClick }: StakeInfoProps) {
  const { address, isConnected } = useAccount();
  const { data: ethBalance } = useBalance({ address });
  const [currentTime, setCurrentTime] = useState(Math.floor(Date.now() / 1000));

  // Dynamic timer - updates every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Read stake data
  const { data, isLoading, refetch } = useReadContracts({
    contracts: [
      {
        address: CONTRACTS.vault,
        abi: StakingVaultABI,
        functionName: 'stakedBalance',
        args: address ? [address] : undefined,
      },
      {
        address: CONTRACTS.vault,
        abi: StakingVaultABI,
        functionName: 'unlockTime',
        args: address ? [address] : undefined,
      },
      {
        address: CONTRACTS.vault,
        abi: StakingVaultABI,
        functionName: 'canUnstake',
        args: address ? [address] : undefined,
      },
      {
        address: CONTRACTS.token,
        abi: ERC20ABI,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
      },
      {
        address: CONTRACTS.delegate,
        abi: UnstakeDelegateABI,
        functionName: 'estimateRescue',
        args: address ? [CONTRACTS.vault, address] : undefined,
      },
    ],
  });

  // Parse data - do this before any conditional returns
  const stakedBalance = data?.[0]?.result as bigint | undefined;
  const unlockTime = data?.[1]?.result as bigint | undefined;
  const canUnstake = data?.[2]?.result as boolean | undefined;
  const tokenBalance = data?.[3]?.result as bigint | undefined;
  const rescueEstimate = data?.[4]?.result as [bigint, bigint, bigint, boolean] | undefined;

  // Calculate time values
  const now = BigInt(currentTime);
  const isLocked = unlockTime ? unlockTime > now : false;
  const timeLeft = unlockTime ? Math.max(0, Number(unlockTime - now)) : 0;
  const hasStake = stakedBalance && stakedBalance > 0n;
  const hasLowGas = ethBalance && ethBalance.value < BigInt(1e15);

  // Auto-refetch when lock expires - MUST be before conditional returns
  useEffect(() => {
    if (hasStake && !isLocked && timeLeft <= 0 && unlockTime && unlockTime > 0n) {
      refetch();
    }
  }, [hasStake, isLocked, timeLeft, unlockTime, refetch]);

  const formatTime = (seconds: number) => {
    if (seconds <= 0) return 'Unlocked!';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  // Conditional returns AFTER all hooks
  if (!isConnected) {
    return (
      <div className="card text-center py-12">
        <div className="text-6xl mb-4">🔌</div>
        <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
        <p className="text-slate-400">
          Connect your wallet to view your stake and rescue tokens
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="card text-center py-12">
        <div className="animate-spin text-4xl mb-4">⏳</div>
        <p className="text-slate-400">Loading stake data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Balance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <div className="text-sm text-slate-400 mb-1">Wallet Balance</div>
          <div className="text-2xl font-bold">
            {tokenBalance ? formatEther(tokenBalance) : '0'} ZGT
          </div>
        </div>
        <div className="card">
          <div className="text-sm text-slate-400 mb-1">BNB for Gas</div>
          <div className={`text-2xl font-bold ${hasLowGas ? 'text-amber-400' : ''}`}>
            {ethBalance ? parseFloat(formatEther(ethBalance.value)).toFixed(4) : '0'} BNB
            {hasLowGas && <span className="text-sm ml-2">⚠️ Low</span>}
          </div>
        </div>
      </div>

      {/* Stake Status */}
      <div className={`card ${hasStake ? 'glow-purple' : ''}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Your Stake</h3>
          {hasStake && (
            <span
              className={`px-3 py-1 rounded-full text-sm border ${
                isLocked ? 'status-locked' : 'status-ready'
              }`}
            >
              {isLocked ? '🔒 Locked' : '✅ Ready'}
            </span>
          )}
        </div>

        {hasStake ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Staked Amount</span>
              <span className="text-xl font-bold">
                {formatEther(stakedBalance)} ZGT
              </span>
            </div>

            {isLocked && (
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Time Remaining</span>
                <span className="text-xl font-mono text-amber-400">
                  {formatTime(timeLeft)}
                </span>
              </div>
            )}

            {rescueEstimate && canUnstake && (
              <div className="bg-slate-900/50 rounded-lg p-4 space-y-2">
                <div className="text-sm text-slate-400 mb-2">Rescue Preview</div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Unstake Amount</span>
                  <span>{formatEther(rescueEstimate[0])} ZGT</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Relayer Fee (1%)</span>
                  <span className="text-amber-400">-{formatEther(rescueEstimate[1])} ZGT</span>
                </div>
                <div className="border-t border-slate-700 pt-2 flex justify-between font-bold">
                  <span>You Receive</span>
                  <span className="text-green-400">{formatEther(rescueEstimate[2])} ZGT</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400">
            <div className="text-4xl mb-2">📭</div>
            <p>No active stake found</p>
          </div>
        )}
      </div>

      {/* Rescue Button */}
      {hasStake && (
        <button
          onClick={onRescueClick}
          disabled={isLocked || !canUnstake}
          className={`w-full btn-primary text-lg py-4 flex items-center justify-center gap-3 ${
            !isLocked && canUnstake ? 'glow-green' : ''
          }`}
        >
          {isLocked ? (
            <>
              🔒 Locked - Wait {formatTime(timeLeft)}
            </>
          ) : (
            <>
              🚀 Rescue Now (Zero Gas!)
            </>
          )}
        </button>
      )}

      {/* Info Banner */}
      {hasStake && hasLowGas && !isLocked && (
        <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <div>
              <h4 className="font-semibold text-purple-300">Perfect for Zero-G!</h4>
              <p className="text-sm text-slate-400">
                You have low BNB but tokens are ready to unstake. 
                Use Zero-G Unstake to rescue your tokens without paying gas!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Refresh Button */}
      <button
        onClick={() => refetch()}
        className="w-full btn-secondary flex items-center justify-center gap-2"
      >
        🔄 Refresh Data
      </button>
    </div>
  );
}
