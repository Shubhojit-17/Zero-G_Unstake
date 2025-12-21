'use client';

import Image from 'next/image';
import { ConnectKitButton } from 'connectkit';

export function Header() {
  return (
    <header className="border-b border-white/5 backdrop-blur-xl bg-slate-900/30 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative w-12 h-12">
            <Image 
              src="/logo.png" 
              alt="Zero-G Unstake Logo" 
              width={48} 
              height={48}
              className="rounded-xl"
              priority
            />
          </div>
          <div>
            <h1 className="text-xl font-bold gradient-text">
              Zero-G Unstake
            </h1>
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
              Gasless Emergency Exit
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 backdrop-blur-sm">
            <div className="relative">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <div className="absolute inset-0 w-2 h-2 rounded-full bg-amber-500 animate-ping opacity-75" />
            </div>
            <span className="text-sm font-medium text-amber-400">BSC Testnet</span>
          </div>
          <div className="connect-btn-wrapper">
            <ConnectKitButton />
          </div>
        </div>
      </div>
    </header>
  );
}
