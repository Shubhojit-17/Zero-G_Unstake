'use client';

import { useRef, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { Header } from '@/components/Header';
import { StakePanel } from '@/components/StakePanel';
import { RescuePanel, RescuePanelRef } from '@/components/RescuePanel';
import { LiveActivityFeed, LiveActivityFeedRef } from '@/components/LiveActivityFeed';

export default function Home() {
  const { isConnected } = useAccount();
  const rescuePanelRef = useRef<RescuePanelRef>(null);
  const activityFeedRef = useRef<LiveActivityFeedRef>(null);

  // Refresh all data when stake completes
  const handleStakeComplete = useCallback(() => {
    // Refresh rescue panel data
    rescuePanelRef.current?.refresh();
    // Refresh activity feed
    activityFeedRef.current?.refresh();
  }, []);

  // Refresh activity feed when rescue completes
  const handleRescueComplete = useCallback(() => {
    activityFeedRef.current?.refresh();
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0a0a14] via-[#0f0f1e] to-[#0a0a14] bg-grid">
      {/* Ambient background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-[120px] animate-pulse-slow" />
        <div className="absolute bottom-1/4 -right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-[120px] animate-pulse-slow" style={{ animationDelay: '1.5s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-pink-500/10 rounded-full blur-[150px]" />
      </div>

      <div className="relative z-10">
        <Header />

        <div className="container mx-auto px-4 py-16">
          {/* Hero Section */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 mb-6">
              <span className="text-sm font-medium text-purple-400">✨ Powered by EIP-7702</span>
            </div>
            <h1 className="text-6xl md:text-7xl font-bold mb-6 gradient-text leading-tight">
              Zero-G Unstake
            </h1>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
              Gasless emergency exit from staking contracts.
              <br />
              <span className="text-purple-400 font-medium">
                Rescue your tokens even with zero ETH for gas.
              </span>
            </p>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-6 mb-16 max-w-4xl mx-auto">
            <div className="feature-card group">
              <div className="feature-icon">⛽</div>
              <h3 className="text-lg font-bold mb-2 text-white group-hover:text-purple-400 transition-colors">Gasless</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                No ETH needed. Relayers pay gas and take a small token fee.
              </p>
            </div>
            <div className="feature-card group">
              <div className="feature-icon">🔐</div>
              <h3 className="text-lg font-bold mb-2 text-white group-hover:text-purple-400 transition-colors">MEV Protected</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Transactions go through private mempools to prevent frontrunning.
              </p>
            </div>
            <div className="feature-card group">
              <div className="feature-icon">⚡</div>
              <h3 className="text-lg font-bold mb-2 text-white group-hover:text-purple-400 transition-colors">Instant</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                One-click rescue. Sign once and let the relayer handle the rest.
              </p>
            </div>
          </div>

          {/* Main Content */}
          {isConnected ? (
            <div className="space-y-8 max-w-2xl mx-auto">
              {/* Stake Panel - Always visible for testing */}
              <StakePanel onStakeComplete={handleStakeComplete} />
              
              {/* Rescue Panel - Shows stake info and rescue flow */}
              <RescuePanel ref={rescuePanelRef} onRescueComplete={handleRescueComplete} />
            </div>
          ) : (
            <div className="card max-w-lg mx-auto text-center py-16 glow-purple">
              <div className="text-7xl mb-8 animate-float">🔗</div>
              <h2 className="text-3xl font-bold mb-4 gradient-text">Connect Your Wallet</h2>
              <p className="text-slate-400 mb-8 leading-relaxed">
                Connect your wallet to view your stake and access the rescue feature.
              </p>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/50 border border-slate-700/50">
                <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                <span className="text-sm text-slate-400">Sepolia Testnet Required</span>
              </div>
            </div>
          )}

          {/* Live Activity Feed - Shows real-time blockchain events */}
          {isConnected && (
            <div className="mt-10 max-w-2xl mx-auto">
              <LiveActivityFeed ref={activityFeedRef} />
            </div>
          )}

          {/* How It Works */}
          <div className="mt-20 max-w-3xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold gradient-text inline-block">How It Works</h2>
            </div>
            <div className="space-y-4">
              <div className="flex items-start gap-5 p-5 card group">
                <div className="step-circle shrink-0">1</div>
                <div>
                  <h3 className="font-bold text-lg mb-2 text-white group-hover:text-purple-400 transition-colors">Sign Authorization</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    You sign an EIP-7702 authorization that temporarily delegates your account to the
                    UnstakeDelegate contract. This signature is <span className="text-green-400 font-medium">free</span> - no gas required.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-5 p-5 card group">
                <div className="step-circle shrink-0">2</div>
                <div>
                  <h3 className="font-bold text-lg mb-2 text-white group-hover:text-purple-400 transition-colors">Relayer Executes</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    A gas-paying relayer submits your authorization along with an unstake call. The
                    transaction is sent through <span className="text-purple-400 font-medium">MEV-protected</span> channels for safety.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-5 p-5 card group">
                <div className="step-circle shrink-0">3</div>
                <div>
                  <h3 className="font-bold text-lg mb-2 text-white group-hover:text-purple-400 transition-colors">Receive Tokens</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    Your staked tokens are withdrawn and sent to your wallet. The relayer takes a
                    small fee (<span className="text-amber-400 font-medium">1%</span>) from the tokens as compensation for gas.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <footer className="mt-20 pt-8 border-t border-white/5 text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-sm">
                🚀
              </div>
              <span className="text-lg font-bold gradient-text">Zero-G Unstake</span>
            </div>
            <p className="text-slate-500 text-sm">
              Built for BSC Hackathon 2025 • Powered by EIP-7702 •{' '}
              <a
                href="https://github.com/Shubhojit-17/Zero-G_Unstake"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-300 transition-colors"
              >
                GitHub →
              </a>
            </p>
          </footer>
        </div>
      </div>
    </main>
  );
}
