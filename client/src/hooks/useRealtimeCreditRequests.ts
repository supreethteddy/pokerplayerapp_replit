import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export function useRealtimeCreditRequests(playerId: number | string | null | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!playerId) return;

    const channel = supabase
      .channel(`player-credits-${playerId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'credit_requests',
          filter: `player_id=eq.${playerId}`,
        },
        (payload) => {
          console.log('💳 [REALTIME] Credit request change:', payload.eventType);
          queryClient.invalidateQueries({ queryKey: [`/api/credit-requests/${playerId}`] });
          queryClient.invalidateQueries({ queryKey: ['credit-requests'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [playerId, queryClient]);
}
