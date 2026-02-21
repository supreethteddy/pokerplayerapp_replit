import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export function useRealtimeTournaments(playerId: number | string | null | undefined, clubId?: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!playerId) return;

    const channels: any[] = [];

    const tournamentsChannel = supabase
      .channel(`tournaments-${clubId || 'all'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tournaments',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['/api/player-tournaments'] });
          queryClient.invalidateQueries({ queryKey: ['player-tournaments'] });
        }
      )
      .subscribe();
    channels.push(tournamentsChannel);

    const playerTournamentsChannel = supabase
      .channel(`tournament-players-${playerId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tournament_players',
          filter: `player_id=eq.${playerId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['/api/player-tournaments'] });
          queryClient.invalidateQueries({ queryKey: ['player-tournaments'] });
          queryClient.invalidateQueries({ queryKey: ['tournament-my-status'] });
        }
      )
      .subscribe();
    channels.push(playerTournamentsChannel);

    return () => {
      channels.forEach(ch => supabase.removeChannel(ch));
    };
  }, [playerId, clubId, queryClient]);
}
