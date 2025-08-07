import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import Pusher from 'pusher-js';

interface PlayerBalance {
  playerId?: number;
  cashBalance?: number;
  tableBalance?: number;
  totalBalance?: number;
  creditLimit?: string;
  availableCredit?: number;
  // New dual balance format
  currentBalance?: string;
  creditBalance?: string;
  creditApproved?: boolean;
}

export function usePlayerBalance(playerId: string) {
  const queryClient = useQueryClient();

  // Fetch player balance from our backend API using the working endpoint
  const { data: balance, isLoading, error } = useQuery<PlayerBalance>({
    queryKey: [`/api/account-balance/${playerId}`],
    refetchInterval: 5000, // Refetch every 5 seconds as fallback
    staleTime: 0, // Always consider data stale for fresh updates
  });

  // Real-time balance updates via Pusher (optional)
  useEffect(() => {
    if (!playerId) return;

    // Only connect to Pusher if environment variables are available
    const pusherKey = import.meta.env.VITE_PUSHER_KEY;
    const pusherCluster = import.meta.env.VITE_PUSHER_CLUSTER;
    
    if (!pusherKey || !pusherCluster) {
      console.log('⚠️ [BALANCE] Pusher not configured, using polling only');
      return;
    }

    try {
      const pusher = new Pusher(pusherKey, {
        cluster: pusherCluster,
      });

    const channel = pusher.subscribe('cross-portal-sync');
    
    channel.bind('player_balance_update', (data: any) => {
      if (data.playerId?.toString() === playerId) {
        console.log('💰 [REAL-TIME BALANCE] Update received:', data);
        
        // Invalidate and refetch balance immediately
        queryClient.invalidateQueries({ queryKey: [`/api/account-balance/${playerId}`] });
      }
    });

    channel.bind('wallet_transaction', (data: any) => {
      if (data.playerId?.toString() === playerId) {
        console.log('💳 [REAL-TIME BALANCE] Transaction update:', data);
        
        // Invalidate balance and transaction queries
        queryClient.invalidateQueries({ queryKey: [`/api/account-balance/${playerId}`] });
        queryClient.invalidateQueries({ queryKey: [`/api/player/${playerId}/transactions`] });
      }
    });

    // Listen for direct player balance updates
    const playerChannel = pusher.subscribe(`player-${playerId}`);
    
    playerChannel.bind('balance_updated', (data: any) => {
      console.log('💰 [REAL-TIME BALANCE] Direct player update:', data);
      queryClient.invalidateQueries({ queryKey: [`/api/account-balance/${playerId}`] });
    });

    playerChannel.bind('cash_out_request_submitted', (data: any) => {
      console.log('💳 [REAL-TIME BALANCE] Cash-out request submitted:', data);
      // Could show notification here
    });

      return () => {
        pusher.unsubscribe('cross-portal-sync');
        pusher.unsubscribe(`player-${playerId}`);
        pusher.disconnect();
      };
    } catch (error) {
      console.error('❌ [BALANCE] Pusher connection failed:', error);
    }
  }, [playerId, queryClient]);

  return {
    balance,
    isLoading,
    error,
    cashBalance: parseFloat((balance as any)?.currentBalance || balance?.cashBalance || '0'),
    tableBalance: 0, // Hidden from player view
    totalBalance: parseFloat((balance as any)?.currentBalance || balance?.cashBalance || '0'), // Only show cash balance
  };
}