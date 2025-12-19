'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { ConnectKitProvider } from 'connectkit';
import { config } from '@/config/web3';
import { useState } from 'react';
import { ToastProvider } from '@/components/Toast';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider
          theme="midnight"
          options={{
            initialChainId: 11155111, // Sepolia
          }}
          customTheme={{
            '--ck-font-family': 'Inter, system-ui, sans-serif',
            '--ck-accent-color': '#8b5cf6',
            '--ck-accent-text-color': '#ffffff',
            '--ck-body-background': 'rgba(15, 15, 30, 0.95)',
            '--ck-body-background-secondary': 'rgba(30, 30, 60, 0.8)',
            '--ck-body-background-tertiary': 'rgba(40, 40, 80, 0.6)',
            '--ck-border-radius': '16px',
            '--ck-body-color': '#ffffff',
            '--ck-body-color-muted': '#a1a1aa',
          }}
        >
          <ToastProvider>
            {children}
          </ToastProvider>
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
