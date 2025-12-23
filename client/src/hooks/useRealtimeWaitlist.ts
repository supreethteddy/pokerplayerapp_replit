import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/**
 * Hook to subscribe to real-time waitlist updates via Supabase Realtime
 * Automatically updates React Query cache when waitlist changes
 */
export function useRealtimeWaitlist(playerId: number | string | null | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!playerId) return;

    // Subscribe to real-time changes on waitlist table
    // Note: Using 'waitlist' table (not 'seat_requests' which may not exist)
    const channel = supabase
      .channel(`player-waitlist-${playerId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'waitlist',
          filter: `player_id=eq.${playerId}`,
        },
        (payload) => {
          console.log('🎯 [REALTIME] Waitlist change detected:', payload.eventType, payload.new || payload.old);
          
          // Invalidate waitlist queries to refetch
          queryClient.invalidateQueries({ queryKey: ['/api/seat-requests', playerId] });
          queryClient.invalidateQueries({ queryKey: ['waitlist', 'status'] });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ [REALTIME] Subscribed to waitlist for player:', playerId);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ [REALTIME] Waitlist subscription error');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [playerId, queryClient]);
}




