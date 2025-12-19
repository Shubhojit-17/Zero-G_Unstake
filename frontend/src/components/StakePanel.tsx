'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContracts } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { CONTRACTS, ERC20ABI, StakingVaultABI } from '@/config/web3';

interface StakePanelProps {
  onStakeComplete?: () => void;
}

export function StakePanel({ onStakeComplete }: StakePanelProps) {
  const { address, isConnected } = useAccount();
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
      // Notify parent that stake is complete
      if (onStakeComplete) {
        onStakeComplete();
      }
    }
  }, [isStakeSuccess, step, hasCalledCallback, refetch, onStakeComplete]);

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
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        📥 Stake Tokens
        <span className="text-xs bg-blue-600 px-2 py-0.5 rounded-full">Step 1</span>
      </h3>

      {step === 'idle' && (
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Stake your ZGT tokens to test the Zero-G rescue flow. Tokens will be locked for 60 seconds.
          </p>

          <div className="space-y-2">
            <label className="text-sm text-slate-400">Amount to Stake</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.0"
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
              />
              <button
                onClick={setMaxAmount}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm"
              >
                MAX
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Balance: {balance ? formatEther(balance) : '0'} ZGT
            </p>
          </div>

          <button
            onClick={handleStake}
            disabled={!amount || parseFloat(amount) <= 0}
            className="w-full btn-primary py-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            🔒 Stake ZGT
          </button>
        </div>
      )}

      {(step === 'approving' || (isApproving || isApproveConfirming)) && (
        <div className="text-center py-6">
          <div className="text-4xl mb-3 animate-spin">⏳</div>
          <h4 className="font-semibold mb-2">Approving Token Spend</h4>
          <p className="text-sm text-slate-400">
            Please confirm the approval in your wallet...
          </p>
        </div>
      )}

      {(step === 'staking' || (isStaking || isStakeConfirming)) && !isApproving && !isApproveConfirming && (
        <div className="text-center py-6">
          <div className="text-4xl mb-3 animate-spin">⏳</div>
          <h4 className="font-semibold mb-2">Staking Tokens</h4>
          <p className="text-sm text-slate-400">
            Please confirm the stake transaction in your wallet...
          </p>
        </div>
      )}

      {step === 'success' && (
        <div className="text-center py-6">
          <div className="text-4xl mb-3">✅</div>
          <h4 className="font-semibold mb-2 text-green-400">Tokens Staked!</h4>
          <p className="text-sm text-slate-400 mb-4">
            Your tokens are now staked. Wait 60 seconds for the lock to expire, then use Zero-G Rescue!
          </p>
          {stakeHash && (
            <a
              href={`https://sepolia.etherscan.io/tx/${stakeHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:text-purple-300 text-sm underline block mb-4"
            >
              View on Etherscan →
            </a>
          )}
          <button onClick={handleReset} className="btn-secondary px-6">
            Done
          </button>
        </div>
      )}

      {step === 'error' && (
        <div className="text-center py-6">
          <div className="text-4xl mb-3">❌</div>
          <h4 className="font-semibold mb-2 text-red-400">Error</h4>
          <p className="text-sm text-slate-400 mb-4">{error}</p>
          <button onClick={handleReset} className="btn-secondary px-6">
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
