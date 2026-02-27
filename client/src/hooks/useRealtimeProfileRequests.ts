import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

// Dispatched when an admin approves a field update — useUltraFastAuth listens and patches user state immediately.
export type PlayerProfileUpdatedDetail = { fieldName: string; newValue: string };

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
        (payload: any) => {
          // Always refresh the requests list
          queryClient.invalidateQueries({ queryKey: ['/api/auth/player/profile-change-requests'] });

          // If the request was just approved, immediately patch the player profile in memory
          const record = payload?.new;
          if (record?.status === 'approved' && record?.field_name && record?.requested_value != null) {
            window.dispatchEvent(
              new CustomEvent<PlayerProfileUpdatedDetail>('player-profile-updated', {
                detail: { fieldName: record.field_name, newValue: String(record.requested_value) },
              })
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [playerId, queryClient]);
}
