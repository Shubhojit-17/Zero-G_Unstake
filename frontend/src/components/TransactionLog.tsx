'use client';

import { useEffect, useState } from 'react';

export interface TransactionStep {
  id: number;
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  timestamp?: Date;
  txHash?: string;
  data?: Record<string, string>;
}

interface TransactionLogProps {
  steps: TransactionStep[];
  isActive: boolean;
}

export function TransactionLog({ steps, isActive }: TransactionLogProps) {
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    if (!isActive) return;
    
    const startTime = Date.now();
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive]);

  if (steps.length === 0) return null;

  const getStatusIcon = (status: TransactionStep['status']) => {
    switch (status) {
      case 'pending':
        return '⏳';
      case 'in-progress':
        return '🔄';
      case 'completed':
        return '✅';
      case 'error':
        return '❌';
    }
  };

  const getStatusColor = (status: TransactionStep['status']) => {
    switch (status) {
      case 'pending':
        return 'border-slate-600 bg-slate-800/50';
      case 'in-progress':
        return 'border-purple-500 bg-purple-900/30 animate-pulse';
      case 'completed':
        return 'border-green-500 bg-green-900/30';
      case 'error':
        return 'border-red-500 bg-red-900/30';
    }
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          📋 Transaction Log
          {isActive && (
            <span className="text-sm text-purple-400 font-mono">
              ({elapsedTime}s)
            </span>
          )}
        </h3>
        {isActive && (
          <span className="px-2 py-1 bg-purple-600 text-white text-xs rounded-full animate-pulse">
            LIVE
          </span>
        )}
      </div>

      <div className="space-y-3">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={`p-3 rounded-lg border transition-all duration-300 ${getStatusColor(step.status)}`}
          >
            <div className="flex items-start gap-3">
              <span className={`text-xl ${step.status === 'in-progress' ? 'animate-spin' : ''}`}>
                {getStatusIcon(step.status)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm">
                    Step {index + 1}: {step.title}
                  </h4>
                  {step.timestamp && (
                    <span className="text-xs text-slate-500">
                      {step.timestamp.toLocaleTimeString()}
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-400 mt-1">{step.description}</p>
                
                {step.data && Object.keys(step.data).length > 0 && (
                  <div className="mt-2 space-y-1">
                    {Object.entries(step.data).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-xs">
                        <span className="text-slate-500">{key}:</span>
                        <span className="text-slate-300 font-mono truncate max-w-[200px]">
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {step.txHash && (
                  <a
                    href={`https://testnet.bscscan.com/tx/${step.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-purple-400 hover:text-purple-300 mt-2 inline-block"
                  >
                    View on BscScan →
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
