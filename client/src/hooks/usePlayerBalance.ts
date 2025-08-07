import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import Pusher from 'pusher-js';

interface PlayerBalance {
  playerId: number;
  cashBalance: number;
  tableBalance: number;
  totalBalance: number;
  creditLimit?: number;
  availableCredit?: number;
}

export function usePlayerBalance(playerId: string) {
  const queryClient = useQueryClient();

  // Fetch player balance from our backend API
  const { data: balance, isLoading, error } = useQuery<PlayerBalance>({
    queryKey: [`/api/player/${playerId}/balance`],
    refetchInterval: 10000, // Refetch every 10 seconds as fallback
  });

  // Real-time balance updates via Pusher
  useEffect(() => {
    if (!playerId) return;

    const pusher = new Pusher(import.meta.env.VITE_PUSHER_KEY, {
      cluster: import.meta.env.VITE_PUSHER_CLUSTER,
    });

    const channel = pusher.subscribe('cross-portal-sync');
    
    channel.bind('player_balance_update', (data: any) => {
      if (data.playerId?.toString() === playerId) {
        console.log('💰 [REAL-TIME BALANCE] Update received:', data);
        
        // Invalidate and refetch balance immediately
        queryClient.invalidateQueries({ queryKey: [`/api/player/${playerId}/balance`] });
      }
    });

    channel.bind('wallet_transaction', (data: any) => {
      if (data.playerId?.toString() === playerId) {
        console.log('💳 [REAL-TIME BALANCE] Transaction update:', data);
        
        // Invalidate balance and transaction queries
        queryClient.invalidateQueries({ queryKey: [`/api/player/${playerId}/balance`] });
        queryClient.invalidateQueries({ queryKey: [`/api/player/${playerId}/transactions`] });
      }
    });

    // Listen for direct player balance updates
    const playerChannel = pusher.subscribe(`player-${playerId}`);
    
    playerChannel.bind('balance_updated', (data: any) => {
      console.log('💰 [REAL-TIME BALANCE] Direct player update:', data);
      queryClient.invalidateQueries({ queryKey: [`/api/player/${playerId}/balance`] });
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
  }, [playerId, queryClient]);

  return {
    balance,
    isLoading,
    error,
    cashBalance: balance?.cashBalance || 0,
    tableBalance: balance?.tableBalance || 0,
    totalBalance: balance?.totalBalance || 0,
  };
}