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

  // Fetch player balance from our backend API using the dual balance endpoint
  const { data: balance, isLoading, error } = useQuery<PlayerBalance>({
    queryKey: [`/api/account-balance/${playerId}`],
    refetchInterval: 3000, // Refetch every 3 seconds for real-time credit updates
    staleTime: 0, // Always consider data stale for fresh credit updates from staff portal
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
        
        // Invalidate and refetch balance immediately for credit updates
        queryClient.invalidateQueries({ queryKey: [`/api/account-balance/${playerId}`] });
      }
    });

    // Listen for staff portal credit approvals
    channel.bind('credit_approved', (data: any) => {
      if (data.playerId?.toString() === playerId) {
        console.log('✅ [REAL-TIME CREDIT] Credit approved by staff:', data);
        
        // Immediately refresh balance to show new credit_balance
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
    creditBalance: parseFloat((balance as any)?.creditBalance || '0'),
    creditLimit: parseFloat((balance as any)?.creditLimit || '0'),
    creditApproved: (balance as any)?.creditApproved || false,
    tableBalance: 0, // Hidden from player view
    totalBalance: parseFloat((balance as any)?.totalBalance || (balance as any)?.currentBalance || balance?.cashBalance || '0')
  };
}