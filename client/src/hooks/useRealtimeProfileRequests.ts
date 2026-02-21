import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export function useRealtimeProfileRequests(playerId: number | string | null | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!playerId) return;

    const channel = supabase
      .channel(`profile-requests-${playerId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'player_profile_change_requests',
          filter: `player_id=eq.${playerId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['/api/auth/player/profile-change-requests'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [playerId, queryClient]);
}
