'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { Header } from '@/components/Header';
import { StakeInfo } from '@/components/StakeInfo';
import { RescueModal } from '@/components/RescueModal';

export default function Home() {
  const { isConnected } = useAccount();
  const [showRescueModal, setShowRescueModal] = useState(false);
  const [lastRescueTx, setLastRescueTx] = useState<string>('');

  const handleRescueClick = () => {
    setShowRescueModal(true);
  };

  const handleRescueSuccess = (txHash: string) => {
    setLastRescueTx(txHash);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <Header />

      <div className="container mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
            Zero-G Unstake
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Gasless emergency exit from staking contracts using EIP-7702.
            <br />
            <span className="text-purple-400">
              Rescue your tokens even with zero ETH for gas.
            </span>
          </p>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="card">
            <div className="text-3xl mb-3">⛽</div>
            <h3 className="font-bold mb-2">Gasless</h3>
            <p className="text-sm text-slate-400">
              No ETH needed. Relayers pay gas and take a small token fee.
            </p>
          </div>
          <div className="card">
            <div className="text-3xl mb-3">🔐</div>
            <h3 className="font-bold mb-2">MEV Protected</h3>
            <p className="text-sm text-slate-400">
              Transactions go through private mempools to prevent frontrunning.
            </p>
          </div>
          <div className="card">
            <div className="text-3xl mb-3">⚡</div>
            <h3 className="font-bold mb-2">Instant</h3>
            <p className="text-sm text-slate-400">
              One-click rescue. Sign once and let the relayer handle the rest.
            </p>
          </div>
        </div>

        {/* Main Content */}
        {isConnected ? (
          <StakeInfo onRescueClick={handleRescueClick} />
        ) : (
          <div className="card max-w-lg mx-auto text-center py-12">
            <div className="text-6xl mb-6">🔗</div>
            <h2 className="text-2xl font-bold mb-4">Connect Your Wallet</h2>
            <p className="text-slate-400 mb-6">
              Connect your wallet to view your stake and access the rescue feature.
            </p>
            <p className="text-sm text-slate-500">
              Make sure you're connected to Sepolia Testnet
            </p>
          </div>
        )}

        {/* Last Rescue Success Banner */}
        {lastRescueTx && (
          <div className="mt-8 max-w-2xl mx-auto bg-green-900/30 border border-green-700 rounded-xl p-4 text-center">
            <p className="text-green-400 font-medium">
              ✅ Last rescue successful!{' '}
              <a
                href={`https://sepolia.etherscan.io/tx/${lastRescueTx}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-green-300"
              >
                View tx →
              </a>
            </p>
          </div>
        )}

        {/* How It Works */}
        <div className="mt-16 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">How It Works</h2>
          <div className="space-y-4">
            <div className="flex items-start gap-4 p-4 bg-slate-800/50 rounded-lg">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-600 text-white font-bold text-sm shrink-0">
                1
              </span>
              <div>
                <h3 className="font-bold mb-1">Sign Authorization</h3>
                <p className="text-sm text-slate-400">
                  You sign an EIP-7702 authorization that temporarily delegates your account to the
                  UnstakeDelegate contract. This signature is <strong>free</strong> - no gas required.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-4 bg-slate-800/50 rounded-lg">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-600 text-white font-bold text-sm shrink-0">
                2
              </span>
              <div>
                <h3 className="font-bold mb-1">Relayer Executes</h3>
                <p className="text-sm text-slate-400">
                  A gas-paying relayer submits your authorization along with an unstake call. The
                  transaction is sent through MEV-protected channels for safety.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-4 bg-slate-800/50 rounded-lg">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-600 text-white font-bold text-sm shrink-0">
                3
              </span>
              <div>
                <h3 className="font-bold mb-1">Receive Tokens</h3>
                <p className="text-sm text-slate-400">
                  Your staked tokens are withdrawn and sent to your wallet. The relayer takes a
                  small fee (1%) from the tokens as compensation for gas.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-16 text-center text-slate-500 text-sm">
          <p>
            Built for BSC Hackathon 2025 • Powered by EIP-7702 •{' '}
            <a
              href="https://github.com/Shubhojit-17/Zero-G_Unstake"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:text-purple-300"
            >
              GitHub
            </a>
          </p>
        </footer>
      </div>

      <RescueModal
        isOpen={showRescueModal}
        onClose={() => setShowRescueModal(false)}
        onSuccess={handleRescueSuccess}
      />
    </main>
  );
}
