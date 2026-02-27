import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/**
 * Subscribe to Supabase Realtime for tournaments and tournament_players.
 * Invalidates the exact query keys used by TournamentsTab and PlayerDashboard
 * so start/end session, pause, complete, eliminate all update the UI without refresh.
 */
export function useRealtimeTournaments(playerId: number | string | null | undefined, clubId?: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!playerId) return;

    const invalidateTournamentQueries = () => {
      queryClient.invalidateQueries({ queryKey: ['/api/player-tournaments/upcoming'] });
      queryClient.invalidateQueries({ queryKey: ['/api/player-tournaments/my-registrations'] });
      queryClient.invalidateQueries({ queryKey: ['tournament-player-status'] });
      queryClient.invalidateQueries({ queryKey: ['player-tournament-statuses'] });
    };

    const channels: ReturnType<typeof supabase.channel>[] = [];

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
          invalidateTournamentQueries();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ [REALTIME] Subscribed to tournaments');
        } else if (status === 'CHANNEL_ERROR') {
          console.warn('❌ [REALTIME] Tournaments subscription error');
        }
      });
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
          invalidateTournamentQueries();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ [REALTIME] Subscribed to tournament_players');
        } else if (status === 'CHANNEL_ERROR') {
          console.warn('❌ [REALTIME] tournament_players subscription error');
        }
      });
    channels.push(playerTournamentsChannel);

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, [playerId, clubId, queryClient]);
}
