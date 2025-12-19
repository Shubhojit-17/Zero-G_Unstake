'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContracts } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { CONTRACTS, ERC20ABI, StakingVaultABI } from '@/config/web3';
import { useToast } from '@/components/Toast';

interface StakePanelProps {
  onStakeComplete?: () => void;
}

export function StakePanel({ onStakeComplete }: StakePanelProps) {
  const { address, isConnected } = useAccount();
  const { showToast } = useToast();
  const [amount, setAmount] = useState<string>('');
  const [step, setStep] = useState<'idle' | 'approving' | 'staking' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string>('');
  const [hasCalledCallback, setHasCalledCallback] = useState(false);

  // Read token balance and allowance
  const { data: tokenData, refetch } = useReadContracts({
    contracts: [
      {
        address: CONTRACTS.token,
        abi: ERC20ABI,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
      },
      {
        address: CONTRACTS.token,
        abi: [...ERC20ABI, {
          name: 'allowance',
          type: 'function',
          stateMutability: 'view',
          inputs: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' },
          ],
          outputs: [{ name: '', type: 'uint256' }],
        }] as const,
        functionName: 'allowance',
        args: address ? [address, CONTRACTS.vault] : undefined,
      },
    ],
  });

  const balance = tokenData?.[0]?.result as bigint | undefined;
  const allowance = tokenData?.[1]?.result as bigint | undefined;

  // Approve transaction
  const { writeContract: approve, data: approveHash, isPending: isApproving } = useWriteContract();
  const { isLoading: isApproveConfirming, isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({
    hash: approveHash,
  });

  // Stake transaction
  const { writeContract: stake, data: stakeHash, isPending: isStaking } = useWriteContract();
  const { isLoading: isStakeConfirming, isSuccess: isStakeSuccess } = useWaitForTransactionReceipt({
    hash: stakeHash,
  });

  const handleStake = async () => {
    if (!amount || !address) return;

    try {
      setError('');
      const amountWei = parseEther(amount);

      // Check if we need approval
      if (!allowance || allowance < amountWei) {
        setStep('approving');
        approve({
          address: CONTRACTS.token,
          abi: ERC20ABI,
          functionName: 'approve',
          args: [CONTRACTS.vault, amountWei],
        });
      } else {
        // Already approved, stake directly
        setStep('staking');
        stake({
          address: CONTRACTS.vault,
          abi: StakingVaultABI,
          functionName: 'stake',
          args: [amountWei],
        });
      }
    } catch (err: any) {
      setError(err.message || 'Transaction failed');
      setStep('error');
    }
  };

  // Handle approval success - proceed to stake
  if (isApproveSuccess && step === 'approving') {
    setStep('staking');
    const amountWei = parseEther(amount);
    stake({
      address: CONTRACTS.vault,
      abi: StakingVaultABI,
      functionName: 'stake',
      args: [amountWei],
    });
  }

  // Handle stake success - call callback when done
  useEffect(() => {
    if (isStakeSuccess && step === 'staking' && !hasCalledCallback) {
      setStep('success');
      setHasCalledCallback(true);
      refetch();
      // Show success toast
      showToast('🔒 Tokens staked successfully! Lock period started.', 'success');
      // Notify parent that stake is complete
      if (onStakeComplete) {
        onStakeComplete();
      }
    }
  }, [isStakeSuccess, step, hasCalledCallback, refetch, onStakeComplete, showToast]);

  const handleReset = () => {
    setStep('idle');
    setAmount('');
    setError('');
    setHasCalledCallback(false);
    refetch();
  };

  const setMaxAmount = () => {
    if (balance) {
      setAmount(formatEther(balance));
    }
  };

  if (!isConnected) return null;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold flex items-center gap-3">
          <div className="feature-icon !w-10 !h-10 !mb-0 !text-lg">📥</div>
          Stake Tokens
        </h3>
        <span className="px-3 py-1 text-xs font-medium bg-blue-500/10 text-blue-400 rounded-full border border-blue-500/20">
          Step 1
        </span>
      </div>

      {step === 'idle' && (
        <div className="space-y-5">
          <p className="text-sm text-slate-400 leading-relaxed">
            Stake your ZGT tokens to test the Zero-G rescue flow. Tokens will be locked for <span className="text-purple-400 font-medium">60 seconds</span>.
          </p>

          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-300">Amount to Stake</label>
            <div className="flex gap-3">
              <input
                type="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.0"
                className="input-field flex-1"
              />
              <button
                onClick={setMaxAmount}
                className="px-5 py-3 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-xl text-sm font-medium text-purple-400 transition-all hover:border-purple-500/50"
              >
                MAX
              </button>
            </div>
            <p className="text-xs text-slate-500 flex items-center gap-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500" />
              Balance: <span className="text-slate-400">{balance ? formatEther(balance) : '0'} ZGT</span>
            </p>
          </div>

          <button
            onClick={handleStake}
            disabled={!amount || parseFloat(amount) <= 0}
            className="w-full btn-primary py-4 text-lg"
          >
            🔒 Stake ZGT
          </button>
        </div>
      )}

      {(step === 'approving' || (isApproving || isApproveConfirming)) && (
        <div className="text-center py-10">
          <div className="loader mx-auto mb-6" />
          <h4 className="text-lg font-semibold mb-2">Approving Token Spend</h4>
          <p className="text-sm text-slate-400">
            Please confirm the approval in your wallet...
          </p>
        </div>
      )}

      {(step === 'staking' || (isStaking || isStakeConfirming)) && !isApproving && !isApproveConfirming && (
        <div className="text-center py-10">
          <div className="loader mx-auto mb-6" />
          <h4 className="text-lg font-semibold mb-2">Staking Tokens</h4>
          <p className="text-sm text-slate-400">
            Please confirm the stake transaction in your wallet...
          </p>
        </div>
      )}

      {step === 'success' && (
        <div className="text-center py-10">
          <div className="w-16 h-16 rounded-2xl bg-green-500/20 border border-green-500/30 flex items-center justify-center text-3xl mx-auto mb-6">
            ✅
          </div>
          <h4 className="text-xl font-bold mb-3 text-green-400">Tokens Staked!</h4>
          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            Your tokens are now staked. Wait <span className="text-amber-400 font-medium">60 seconds</span> for the lock to expire, then use Zero-G Rescue!
          </p>
          {stakeHash && (
            <a
              href={`https://sepolia.etherscan.io/tx/${stakeHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 text-sm mb-6 transition-colors"
            >
              View on Etherscan
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          )}
          <div className="block">
            <button onClick={handleReset} className="btn-secondary px-8">
              Done
            </button>
          </div>
        </div>
      )}

      {step === 'error' && (
        <div className="text-center py-10">
          <div className="w-16 h-16 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-3xl mx-auto mb-6">
            ❌
          </div>
          <h4 className="text-xl font-bold mb-3 text-red-400">Error</h4>
          <p className="text-sm text-slate-400 mb-6">{error}</p>
          <button onClick={handleReset} className="btn-secondary px-8">
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
