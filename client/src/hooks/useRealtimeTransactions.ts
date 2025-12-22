import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/**
 * Hook to subscribe to real-time transaction updates via Supabase Realtime
 * Automatically updates React Query cache when new transactions are created
 */
export function useRealtimeTransactions(playerId: number | string | null | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!playerId) return;

    // Subscribe to real-time changes on transactions table (if it exists in Supabase)
    // Note: This assumes transactions are stored in Supabase. If they're in the Nest backend,
    // you might need to use Pusher or a different mechanism
    const channel = supabase
      .channel(`player-transactions-${playerId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT', // New transactions
          schema: 'public',
          table: 'transactions', // Adjust table name if different
          filter: `player_id=eq.${playerId}`,
        },
        (payload) => {
          console.log('💳 [REALTIME] New transaction detected:', payload.new);
          
          // Invalidate transaction queries to refetch
          queryClient.invalidateQueries({ queryKey: ['player', 'transactions'] });
          queryClient.invalidateQueries({ queryKey: ['transactions', playerId] });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ [REALTIME] Subscribed to transactions for player:', playerId);
        } else if (status === 'CHANNEL_ERROR') {
          console.warn('⚠️ [REALTIME] Transactions table might not exist or Realtime not enabled');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [playerId, queryClient]);
}



