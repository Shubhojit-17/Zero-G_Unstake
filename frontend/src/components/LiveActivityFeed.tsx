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
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          ⚡ Live Activity
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPolling(!isPolling)}
            className={`px-2 py-1 text-xs rounded ${isPolling ? 'bg-green-600' : 'bg-slate-600'}`}
          >
            {isPolling ? '🟢 Live' : '⏸️ Paused'}
          </button>
          <button
            onClick={fetchAllEvents}
            className="px-2 py-1 text-xs bg-slate-700 rounded hover:bg-slate-600"
          >
            🔄
          </button>
        </div>
      </div>

      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {events.map((event) => (
          <div
            key={event.id}
            className="flex items-center justify-between p-2 bg-slate-800/50 rounded-lg text-sm"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">{getEventIcon(event.type)}</span>
              <div>
                <span className={`font-medium ${getEventColor(event.type)}`}>
                  {event.type.toUpperCase()}
                </span>
                <span className="text-slate-400 ml-2">
                  {formatAddress(event.user)}
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono">{parseFloat(event.amount).toFixed(2)} ZGT</div>
              <a
                href={`https://sepolia.etherscan.io/tx/${event.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-purple-400 hover:text-purple-300"
              >
                Block #{event.blockNumber.toString()}
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});
