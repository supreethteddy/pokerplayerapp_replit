import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/**
 * Hook to subscribe to real-time balance updates via Supabase Realtime
 * Automatically updates React Query cache when player balance changes
 */
export function useRealtimeBalance(playerId: number | string | null | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!playerId) return;

    // Subscribe to real-time changes on players table (balance field)
    const channel = supabase
      .channel(`player-balance-${playerId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE', // Only UPDATE (balance changes)
          schema: 'public',
          table: 'players',
          filter: `id=eq.${playerId}`,
        },
        (payload) => {
          console.log('💰 [REALTIME] Balance change detected for player:', playerId, payload.new);
          
          // Invalidate balance queries to refetch
          queryClient.invalidateQueries({ queryKey: ['player', 'balance'] });
          queryClient.invalidateQueries({ queryKey: ['/api/balance', playerId] });
          queryClient.invalidateQueries({ queryKey: ['/api/players/supabase'] });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ [REALTIME] Subscribed to balance for player:', playerId);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ [REALTIME] Balance subscription error');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [playerId, queryClient]);
}









