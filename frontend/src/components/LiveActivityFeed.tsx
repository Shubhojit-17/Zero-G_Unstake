'use client';

import { useEffect, useState, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { usePublicClient } from 'wagmi';
import { formatEther, parseAbiItem } from 'viem';
import { CONTRACTS } from '@/config/web3';

interface ActivityEvent {
  id: string;
  type: 'stake' | 'unstake' | 'rescue';
  user: string;
  amount: string;
  txHash: string;
  blockNumber: bigint;
  timestamp: Date;
}

export interface LiveActivityFeedRef {
  refresh: () => void;
}

export const LiveActivityFeed = forwardRef<LiveActivityFeedRef>(function LiveActivityFeed(_, ref) {
  const publicClient = usePublicClient();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [isPolling, setIsPolling] = useState(true);
  const initialFetchDone = useRef(false);

  const fetchAllEvents = useCallback(async () => {
    if (!publicClient) return;

    try {
      const currentBlock = await publicClient.getBlockNumber();
      // Fetch from last 1000 blocks to get all relevant history
      const fromBlock = currentBlock > 1000n ? currentBlock - 1000n : 0n;

      // Fetch Staked events
      const stakedLogs = await publicClient.getLogs({
        address: CONTRACTS.vault,
        event: parseAbiItem('event Staked(address indexed user, uint256 amount, uint256 unlockTime)'),
        fromBlock,
        toBlock: currentBlock,
      });

      // Fetch Unstaked events
      const unstakedLogs = await publicClient.getLogs({
        address: CONTRACTS.vault,
        event: parseAbiItem('event Unstaked(address indexed user, uint256 amount)'),
        fromBlock,
        toBlock: currentBlock,
      });

      // Fetch RescueExecuted events
      const rescueLogs = await publicClient.getLogs({
        address: CONTRACTS.delegate,
        event: parseAbiItem('event RescueExecuted(address indexed user, address indexed vault, uint256 amount, uint256 fee, address relayer)'),
        fromBlock,
        toBlock: currentBlock,
      });

      const allEvents: ActivityEvent[] = [];

      for (const log of stakedLogs) {
        allEvents.push({
          id: `${log.transactionHash}-${log.logIndex}-stake`,
          type: 'stake',
          user: log.args.user as string,
          amount: formatEther(log.args.amount as bigint),
          txHash: log.transactionHash,
          blockNumber: log.blockNumber,
          timestamp: new Date(),
        });
      }

      for (const log of unstakedLogs) {
        allEvents.push({
          id: `${log.transactionHash}-${log.logIndex}-unstake`,
          type: 'unstake',
          user: log.args.user as string,
          amount: formatEther(log.args.amount as bigint),
          txHash: log.transactionHash,
          blockNumber: log.blockNumber,
          timestamp: new Date(),
        });
      }

      for (const log of rescueLogs) {
        allEvents.push({
          id: `${log.transactionHash}-${log.logIndex}-rescue`,
          type: 'rescue',
          user: log.args.user as string,
          amount: formatEther(log.args.amount as bigint),
          txHash: log.transactionHash,
          blockNumber: log.blockNumber,
          timestamp: new Date(),
        });
      }

      // Sort by block number (newest first)
      allEvents.sort((a, b) => Number(b.blockNumber - a.blockNumber));

      // Keep only the latest 20 events
      setEvents(allEvents.slice(0, 20));
    } catch (err) {
      console.error('Error fetching events:', err);
    }
  }, [publicClient]);

  // Expose refresh method via ref
  useImperativeHandle(ref, () => ({
    refresh: () => {
      fetchAllEvents();
    },
  }));

  useEffect(() => {
    if (!isPolling) return;

    // Initial fetch
    if (!initialFetchDone.current) {
      fetchAllEvents();
      initialFetchDone.current = true;
    }

    // Poll every 3 seconds for more responsiveness
    const interval = setInterval(fetchAllEvents, 3000);
    return () => clearInterval(interval);
  }, [fetchAllEvents, isPolling]);

  const getEventIcon = (type: ActivityEvent['type']) => {
    switch (type) {
      case 'stake':
        return '📥';
      case 'unstake':
        return '📤';
      case 'rescue':
        return '🚀';
    }
  };

  const getEventColor = (type: ActivityEvent['type']) => {
    switch (type) {
      case 'stake':
        return 'text-blue-400';
      case 'unstake':
        return 'text-amber-400';
      case 'rescue':
        return 'text-green-400';
    }
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (events.length === 0) return null;

  return (
    <div className="card relative overflow-hidden">
      {/* Subtle animated background */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/10 via-transparent to-blue-900/10 pointer-events-none" />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center text-lg">
              ⚡
            </span>
            <span className="gradient-text">Live Activity</span>
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPolling(!isPolling)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-200 flex items-center gap-1.5 ${
                isPolling 
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30' 
                  : 'bg-slate-600/50 text-slate-400 border border-slate-600 hover:bg-slate-600'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isPolling ? 'bg-green-400 animate-pulse' : 'bg-slate-400'}`} />
              {isPolling ? 'Live' : 'Paused'}
            </button>
            <button
              onClick={fetchAllEvents}
              className="w-8 h-8 flex items-center justify-center bg-slate-700/50 rounded-lg border border-slate-600 hover:bg-slate-600 transition-all duration-200 hover:scale-105"
            >
              🔄
            </button>
          </div>
        </div>

        <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent pr-1">
          {events.map((event, index) => (
            <div
              key={event.id}
              className="flex items-center justify-between p-3 bg-slate-800/30 backdrop-blur-sm rounded-xl text-sm border border-slate-700/50 hover:border-slate-600/50 transition-all duration-200 group hover:bg-slate-800/50"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
                  event.type === 'stake' ? 'bg-blue-500/20 border border-blue-500/30' :
                  event.type === 'unstake' ? 'bg-amber-500/20 border border-amber-500/30' :
                  'bg-green-500/20 border border-green-500/30'
                }`}>
                  {getEventIcon(event.type)}
                </div>
                <div>
                  <span className={`font-semibold tracking-wide ${getEventColor(event.type)}`}>
                    {event.type.toUpperCase()}
                  </span>
                  <div className="flex items-center gap-1 text-slate-400 text-xs mt-0.5">
                    <span className="font-mono">{formatAddress(event.user)}</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono font-semibold">{parseFloat(event.amount).toFixed(2)} <span className="text-purple-400">ZGT</span></div>
                <a
                  href={`https://testnet.bscscan.com/tx/${event.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-slate-500 hover:text-purple-400 transition-colors inline-flex items-center gap-1 group-hover:text-purple-400"
                >
                  Block #{event.blockNumber.toString()}
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});
