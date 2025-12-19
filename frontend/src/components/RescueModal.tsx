'use client';

import { useState } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { CONTRACTS, RELAYER_API } from '@/config/web3';

interface RescueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (txHash: string) => void;
}

type Step = 'confirm' | 'signing' | 'submitting' | 'success' | 'error';

export function RescueModal({ isOpen, onClose, onSuccess }: RescueModalProps) {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [step, setStep] = useState<Step>('confirm');
  const [error, setError] = useState<string>('');
  const [txHash, setTxHash] = useState<string>('');

  const handleRescue = async () => {
    if (!walletClient || !address) return;

    try {
      setStep('signing');
      setError('');

      // Sign EIP-7702 authorization
      // Note: viem 2.x uses 'address' property for signAuthorization
      const authorization = await walletClient.signAuthorization({
        address: CONTRACTS.delegate,
      });

      setStep('submitting');

      // Submit to relayer API
      const response = await fetch(`${RELAYER_API}/rescue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: address,
          vaultAddress: CONTRACTS.vault,
          authorization: {
            address: authorization.address,
            chainId: authorization.chainId,
            nonce: authorization.nonce,
            r: authorization.r,
            s: authorization.s,
            yParity: authorization.yParity,
          },
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
      onSuccess(result.txHash);
    } catch (err: any) {
      console.error('Rescue error:', err);
      setError(err.message || 'An error occurred');
      setStep('error');
    }
  };

  const handleClose = () => {
    setStep('confirm');
    setError('');
    setTxHash('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl">
        {step === 'confirm' && (
          <>
            <div className="text-center mb-6">
              <div className="text-5xl mb-4">🚀</div>
              <h2 className="text-2xl font-bold mb-2">Confirm Rescue</h2>
              <p className="text-slate-400">
                You're about to rescue your staked tokens using Zero-G Unstake.
              </p>
            </div>

            <div className="bg-slate-900/50 rounded-lg p-4 mb-6 space-y-3">
              <div className="flex items-start gap-3">
                <span className="text-green-400">✓</span>
                <span className="text-sm">No gas required from you</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-green-400">✓</span>
                <span className="text-sm">1% fee paid in tokens</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-green-400">✓</span>
                <span className="text-sm">MEV-protected transaction</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-green-400">✓</span>
                <span className="text-sm">Instant execution</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={handleClose} className="flex-1 btn-secondary">
                Cancel
              </button>
              <button onClick={handleRescue} className="flex-1 btn-primary">
                Sign & Rescue
              </button>
            </div>
          </>
        )}

        {step === 'signing' && (
          <div className="text-center py-8">
            <div className="text-5xl mb-4 animate-pulse">✍️</div>
            <h2 className="text-xl font-bold mb-2">Sign Authorization</h2>
            <p className="text-slate-400">
              Please sign the EIP-7702 authorization in your wallet.
              <br />
              <span className="text-sm text-purple-400">This is FREE - no gas required!</span>
            </p>
          </div>
        )}

        {step === 'submitting' && (
          <div className="text-center py-8">
            <div className="text-5xl mb-4 animate-spin">⏳</div>
            <h2 className="text-xl font-bold mb-2">Submitting Rescue</h2>
            <p className="text-slate-400">
              The relayer is submitting your rescue transaction...
            </p>
          </div>
        )}

        {step === 'success' && (
          <div className="text-center py-8">
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-xl font-bold mb-2 text-green-400">Rescue Successful!</h2>
            <p className="text-slate-400 mb-4">
              Your tokens have been unstaked and sent to your wallet.
            </p>
            <a
              href={`https://sepolia.etherscan.io/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:text-purple-300 text-sm underline"
            >
              View on Etherscan →
            </a>
            <button onClick={handleClose} className="w-full btn-primary mt-6">
              Done
            </button>
          </div>
        )}

        {step === 'error' && (
          <div className="text-center py-8">
            <div className="text-5xl mb-4">❌</div>
            <h2 className="text-xl font-bold mb-2 text-red-400">Rescue Failed</h2>
            <p className="text-slate-400 mb-4">{error}</p>
            <div className="flex gap-3">
              <button onClick={handleClose} className="flex-1 btn-secondary">
                Close
              </button>
              <button onClick={() => setStep('confirm')} className="flex-1 btn-primary">
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
