'use client';

import { useState, useEffect, useImperativeHandle, forwardRef, useCallback, useRef } from 'react';
import { useAccount, useReadContracts, useBalance } from 'wagmi';
import { formatEther } from 'viem';
import { CONTRACTS, StakingVaultABI, UnstakeDelegateABI, ERC20ABI, RELAYER_API } from '@/config/web3';
import { useToast } from '@/components/Toast';

type RescueStep = 'idle' | 'confirming' | 'submitting' | 'success' | 'error';

export interface RescuePanelRef {
  refresh: () => void;
}

interface RescuePanelProps {
  onRescueComplete?: () => void;
}

// LocalStorage key for auto-rescue preference
const AUTO_RESCUE_KEY = 'zerog-auto-rescue';

export const RescuePanel = forwardRef<RescuePanelRef, RescuePanelProps>(function RescuePanel(
  { onRescueComplete },
  ref
) {
  const { address, isConnected } = useAccount();
  const { data: ethBalance, refetch: refetchBalance } = useBalance({ address });
  const { showToast } = useToast();

  const [step, setStep] = useState<RescueStep>('idle');
  const [error, setError] = useState<string>('');
  const [txHash, setTxHash] = useState<string>('');
  const [currentTime, setCurrentTime] = useState(Math.floor(Date.now() / 1000));
  
  // Auto-rescue state
  const [autoRescueEnabled, setAutoRescueEnabled] = useState(false);
  const [autoRescueStatus, setAutoRescueStatus] = useState<'idle' | 'waiting' | 'executing' | 'done'>('idle');
  const autoRescueTriggered = useRef(false);

  // Read stake data - must be before executeAutoRescue callback
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

  // Parse data
  const stakedBalance = data?.[0]?.result as bigint | undefined;
  const unlockTime = data?.[1]?.result as bigint | undefined;
  const canUnstake = data?.[2]?.result as boolean | undefined;
  const tokenBalance = data?.[3]?.result as bigint | undefined;
  const rescueEstimate = data?.[4]?.result as [bigint, bigint, bigint, boolean] | undefined;

  // Dynamic timer
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Load auto-rescue preference from localStorage
  useEffect(() => {
    if (address) {
      const saved = localStorage.getItem(`${AUTO_RESCUE_KEY}-${address}`);
      if (saved === 'true') {
        setAutoRescueEnabled(true);
        setAutoRescueStatus('waiting');
      }
    }
  }, [address]);

  // Execute auto-rescue function
  const executeAutoRescue = useCallback(async () => {
    if (!address || autoRescueTriggered.current) return;
    
    autoRescueTriggered.current = true;
    setAutoRescueStatus('executing');
    setStep('submitting');
    setError('');

    try {
      const response = await fetch(`${RELAYER_API}/rescue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: address,
          vaultAddress: CONTRACTS.vault,
          maxFeeBps: 200,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Auto-rescue failed');
      }

      const result = await response.json();
      setTxHash(result.txHash);
      setStep('success');
      setAutoRescueStatus('done');
      
      // Clear auto-rescue preference after successful execution
      localStorage.removeItem(`${AUTO_RESCUE_KEY}-${address}`);
      setAutoRescueEnabled(false);
      
      // Show success toast
      showToast('🎉 Rescue successful! Tokens have been recovered.', 'success');
      
      refetch();
      refetchBalance();
      if (onRescueComplete) {
        onRescueComplete();
      }
    } catch (err: any) {
      console.error('Auto-rescue error:', err);
      setError(err.message || 'Auto-rescue failed');
      setStep('error');
      setAutoRescueStatus('idle');
      autoRescueTriggered.current = false;
      showToast('❌ Rescue failed. Please try again.', 'error');
    }
  }, [address, refetch, refetchBalance, onRescueComplete, showToast]);

  // Calculate time values
  const now = BigInt(currentTime);
  const isLocked = unlockTime ? unlockTime > now : false;
  const timeLeft = unlockTime ? Math.max(0, Number(unlockTime - now)) : 0;
  const hasStake = stakedBalance && stakedBalance > 0n;
  const hasLowGas = ethBalance && ethBalance.value < BigInt(1e15);

  // Auto-rescue trigger: Execute when lock expires and auto-rescue is enabled
  useEffect(() => {
    if (
      autoRescueEnabled &&
      autoRescueStatus === 'waiting' &&
      hasStake &&
      !isLocked &&
      canUnstake &&
      !autoRescueTriggered.current &&
      step === 'idle'
    ) {
      console.log('🚀 Auto-rescue triggered! Lock period expired.');
      executeAutoRescue();
    }
  }, [autoRescueEnabled, autoRescueStatus, hasStake, isLocked, canUnstake, step, executeAutoRescue]);

  // Toggle auto-rescue preference
  const toggleAutoRescue = () => {
    const newValue = !autoRescueEnabled;
    setAutoRescueEnabled(newValue);
    
    if (address) {
      if (newValue) {
        localStorage.setItem(`${AUTO_RESCUE_KEY}-${address}`, 'true');
        setAutoRescueStatus('waiting');
        autoRescueTriggered.current = false;
        showToast('⏰ Auto-rescue enabled! Will trigger when lock expires.', 'info');
      } else {
        localStorage.removeItem(`${AUTO_RESCUE_KEY}-${address}`);
        setAutoRescueStatus('idle');
        showToast('Auto-rescue disabled.', 'info');
      }
    }
  };

  // Expose refresh method via ref
  useImperativeHandle(ref, () => ({
    refresh: () => {
      refetch();
      refetchBalance();
    },
  }));

  const formatTime = (seconds: number) => {
    if (seconds <= 0) return 'Unlocked!';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  // Start rescue - show confirmation
  const handleStartRescue = () => {
    setStep('confirming');
    setError('');
    setTxHash('');
  };

  // Execute rescue via API (server handles EIP-7702 signing since MetaMask doesn't support it)
  const handleExecuteRescue = async () => {
    if (!address) return;

    try {
      setStep('submitting');
      setError('');

      // Submit to relayer API - server will handle EIP-7702 authorization
      const response = await fetch(`${RELAYER_API}/rescue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: address,
          vaultAddress: CONTRACTS.vault,
          maxFeeBps: 200, // 2% max fee
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Rescue failed');
      }

      const result = await response.json();
      setTxHash(result.txHash);
      setStep('success');
      // Show success toast
      showToast('🎉 Rescue successful! Tokens have been recovered.', 'success');
      refetch(); // Refresh stake data
      refetchBalance(); // Refresh balance
      if (onRescueComplete) {
        onRescueComplete();
      }
    } catch (err: any) {
      console.error('Rescue error:', err);
      setError(err.message || 'Failed to execute rescue');
      setStep('error');
      showToast('❌ Rescue failed. Please try again.', 'error');
    }
  };

  // Reset flow
  const handleReset = () => {
    setStep('idle');
    setError('');
    setTxHash('');
  };

  if (!isConnected) {
    return (
      <div className="card text-center py-12">
        <div className="text-6xl mb-4">🔌</div>
        <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
        <p className="text-slate-400">Connect your wallet to rescue your staked tokens</p>
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

      {/* Stake Status Card */}
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
              <span className="text-xl font-bold">{formatEther(stakedBalance)} ZGT</span>
            </div>

            {isLocked && (
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Time Remaining</span>
                <span className="text-xl font-mono text-amber-400">{formatTime(timeLeft)}</span>
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
        ) : step !== 'success' ? (
          <div className="text-center py-8 text-slate-400">
            <div className="text-4xl mb-2">📭</div>
            <p>No active stake found</p>
            <p className="text-sm mt-2">Stake some ZGT tokens above to test the rescue flow!</p>
          </div>
        ) : null}
      </div>

      {/* Rescue Flow Panel - Show for staked and unlocked tokens OR during active rescue flow */}
      {((hasStake && !isLocked && canUnstake) || step === 'confirming' || step === 'submitting' || step === 'success' || step === 'error') && (
        <div className="card glow-green">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            🚀 Zero-G Rescue
            <span className="text-xs bg-purple-600 px-2 py-0.5 rounded-full">EIP-7702</span>
          </h3>

          {/* Step Indicator */}
          <div className="flex items-center justify-between mb-6 text-sm">
            <div className={`flex items-center gap-2 ${step === 'idle' || step === 'confirming' ? 'text-purple-400' : step === 'submitting' || step === 'success' ? 'text-green-400' : 'text-slate-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step === 'idle' || step === 'confirming' ? 'border-purple-400 bg-purple-400/20' : step === 'submitting' || step === 'success' ? 'border-green-400 bg-green-400/20' : 'border-slate-600'}`}>
                {step === 'submitting' || step === 'success' ? '✓' : '1'}
              </div>
              <span className="hidden sm:inline">Confirm</span>
            </div>
            <div className="flex-1 h-0.5 mx-2 bg-slate-700">
              <div className={`h-full transition-all duration-300 ${step === 'success' ? 'bg-green-400 w-full' : step === 'submitting' ? 'bg-purple-400 w-1/2' : 'w-0'}`} />
            </div>
            <div className={`flex items-center gap-2 ${step === 'submitting' ? 'text-purple-400' : step === 'success' ? 'text-green-400' : 'text-slate-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step === 'submitting' ? 'border-purple-400 bg-purple-400/20' : step === 'success' ? 'border-green-400 bg-green-400/20' : 'border-slate-600'}`}>
                {step === 'success' ? '✓' : '2'}
              </div>
              <span className="hidden sm:inline">Rescue</span>
            </div>
          </div>

          {/* Step Content */}
          {step === 'idle' && (
            <div className="text-center py-4">
              <p className="text-slate-400 mb-4">
                Rescue your staked tokens without paying gas. The relayer handles everything!
              </p>
              <button onClick={handleStartRescue} className="btn-primary px-8 py-3 text-lg">
                🚀 Start Rescue
              </button>
            </div>
          )}

          {step === 'confirming' && (
            <div className="space-y-4">
              <div className="bg-slate-900/50 rounded-lg p-4 space-y-3">
                <h4 className="font-semibold text-purple-300">Confirm Zero-G Rescue</h4>
                <p className="text-sm text-slate-400">
                  You're about to rescue your staked tokens using EIP-7702 delegation.
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-green-400">✓</span>
                    <span>No gas required from you</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-green-400">✓</span>
                    <span>1% fee paid in tokens to relayer</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-green-400">✓</span>
                    <span>MEV-protected execution</span>
                  </div>
                </div>
                <div className="bg-slate-800 rounded p-3 text-sm mt-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">You'll receive:</span>
                    <span className="text-green-400 font-bold">
                      {rescueEstimate ? formatEther(rescueEstimate[2]) : '0'} ZGT
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={handleReset} className="flex-1 btn-secondary">
                  Cancel
                </button>
                <button onClick={handleExecuteRescue} className="flex-1 btn-primary glow-green">
                  ✅ Confirm Rescue
                </button>
              </div>
            </div>
          )}

          {step === 'submitting' && (
            <div className="text-center py-8">
              <div className="text-5xl mb-4 animate-spin">⏳</div>
              <h4 className="text-xl font-bold mb-2">
                {autoRescueStatus === 'executing' ? '⏰ Auto-Rescue in Progress' : 'Executing Rescue'}
              </h4>
              <p className="text-slate-400">
                {autoRescueStatus === 'executing' 
                  ? 'Lock period expired! Automatically executing rescue...'
                  : 'Signing EIP-7702 authorization and submitting transaction...'}
                <br />
                <span className="text-purple-400 text-sm">This may take a few seconds</span>
              </p>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center py-6">
              <div className="text-5xl mb-4">🎉</div>
              <h4 className="text-xl font-bold mb-2 text-green-400">Rescue Successful!</h4>
              <p className="text-slate-400 mb-4">
                Your tokens have been unstaked and sent to your wallet.
              </p>
              {tokenBalance && (
                <div className="bg-slate-900/50 rounded-lg p-4 mb-4 inline-block">
                  <div className="text-sm text-slate-400 mb-1">New Wallet Balance</div>
                  <div className="text-2xl font-bold text-green-400">{formatEther(tokenBalance)} ZGT</div>
                </div>
              )}
              <a
                href={`https://testnet.bscscan.com/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-300 text-sm underline block mb-4"
              >
                View on BscScan →
              </a>
              <button onClick={handleReset} className="btn-primary px-8">
                Done
              </button>
            </div>
          )}

          {step === 'error' && (
            <div className="text-center py-6">
              <div className="text-5xl mb-4">❌</div>
              <h4 className="text-xl font-bold mb-2 text-red-400">Rescue Failed</h4>
              <p className="text-slate-400 mb-4">{error}</p>
              <div className="flex gap-3 justify-center">
                <button onClick={handleReset} className="btn-secondary px-6">
                  Close
                </button>
                <button onClick={() => setStep('confirming')} className="btn-primary px-6">
                  Try Again
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Locked Message with Auto-Rescue Option */}
      {hasStake && isLocked && (
        <div className="card border-amber-500/30 bg-amber-900/10">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">🔒</span>
            <div>
              <h4 className="font-semibold text-amber-400">Stake is Locked</h4>
              <p className="text-sm text-slate-400">
                Wait {formatTime(timeLeft)} before you can rescue your tokens.
              </p>
            </div>
          </div>

          {/* Auto-Rescue Toggle */}
          <div className="border-t border-amber-500/20 pt-4 mt-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg">⏰</span>
                  <h5 className="font-semibold text-white">Automatic Unstake</h5>
                </div>
                <p className="text-sm text-slate-400 mt-1">
                  {autoRescueEnabled 
                    ? 'Rescue will execute automatically when lock expires' 
                    : 'Enable to auto-rescue tokens when the lock period ends'}
                </p>
              </div>
              <button
                onClick={toggleAutoRescue}
                className={`relative w-14 h-7 rounded-full transition-colors duration-200 ${
                  autoRescueEnabled ? 'bg-purple-600' : 'bg-slate-600'
                }`}
              >
                <span
                  className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform duration-200 ${
                    autoRescueEnabled ? 'translate-x-7' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {autoRescueEnabled && (
              <div className="mt-4 bg-purple-900/30 rounded-lg p-3 border border-purple-500/30">
                <div className="flex items-center gap-2 text-purple-300">
                  <span className="animate-pulse">●</span>
                  <span className="text-sm font-medium">
                    {autoRescueStatus === 'waiting' && 'Waiting for lock to expire...'}
                    {autoRescueStatus === 'executing' && 'Executing auto-rescue...'}
                    {autoRescueStatus === 'done' && 'Auto-rescue completed!'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Keep this page open. Rescue will trigger automatically in {formatTime(timeLeft)}.
                </p>
              </div>
            )}
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
});
