import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { io } from 'socket.io-client';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3333/api';
const websocketBase = API_BASE_URL.endsWith('/api')
  ? API_BASE_URL.slice(0, -4)
  : API_BASE_URL.replace(/\/$/, '');

type BlindUpdatePayload = {
  currentRound: number;
  currentSb: number;
  currentBb: number;
  name: string;
  id: string;
};

/**
 * Subscribe to Socket.IO + Supabase Realtime for tournament updates.
 * Socket.IO fires immediately when backend advances blinds.
 * Supabase fires for all other tournament changes (start/stop/pause/eliminate).
 *
 * onBlindsUpdated is called (via a stable ref) whenever blinds change —
 * use it to show toast notifications in the calling component.
 */
export function useRealtimeTournaments(
  playerId: number | string | null | undefined,
  clubId?: string | null,
  onBlindsUpdated?: (payload: BlindUpdatePayload) => void,
) {
  const queryClient = useQueryClient();

  // Stable ref so the socket handler always calls the latest callback
  // without needing to reconnect when the callback reference changes.
  const onBlindsUpdatedRef = useRef(onBlindsUpdated);
  useEffect(() => {
    onBlindsUpdatedRef.current = onBlindsUpdated;
  });

  useEffect(() => {
    if (!playerId) return;

    const refetchTournamentQueries = () => {
      // type:'all' ensures inactive queries (e.g. tab not visible) also refetch
      queryClient.refetchQueries({ queryKey: ['/api/player-tournaments/upcoming'], type: 'all' });
      queryClient.refetchQueries({ queryKey: ['/api/player-tournaments/my-registrations'], type: 'all' });
      queryClient.invalidateQueries({ queryKey: ['tournament-player-status'] });
      queryClient.invalidateQueries({ queryKey: ['player-tournament-statuses'] });
    };

    // ── Socket.IO: instant blind advance notifications ──────────────────────
    const socket = io(`${websocketBase}/realtime`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity,
    });

    socket.on('connect', () => {
      if (clubId) socket.emit('subscribe:club', { clubId, playerId: String(playerId) });
    });

    socket.on('tournament:blinds-updated', (data: any) => {
      const t: BlindUpdatePayload | undefined = data?.tournament;
      if (!t) return;

      console.log('🎯 [REALTIME TOURNAMENT] blinds-updated:', t.currentSb, '/', t.currentBb);

      // Immediately patch the upcoming tournaments cache so the card updates
      // without waiting for a refetch (works even if TournamentsTab is unmounted)
      queryClient.setQueryData(
        ['/api/player-tournaments/upcoming', clubId],
        (old: any) => {
          if (!old?.tournaments) return old;
          return {
            ...old,
            tournaments: old.tournaments.map((tournament: any) =>
              tournament.id === t.id
                ? {
                    ...tournament,
                    currentRound: t.currentRound,
                    currentSb: t.currentSb,
                    currentBb: t.currentBb,
                  }
                : tournament,
            ),
          };
        },
      );

      // Also trigger a full refetch so all related queries stay fresh
      refetchTournamentQueries();

      // Notify caller for toast
      onBlindsUpdatedRef.current?.(t);
    });

    // ── Supabase Realtime: all other tournament row changes ──────────────────
    const tournamentsChannel = supabase
      .channel(`tournaments-${clubId || 'all'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments' }, () => {
        refetchTournamentQueries();
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') console.log('✅ [REALTIME] Subscribed to tournaments');
        else if (status === 'CHANNEL_ERROR') console.warn('❌ [REALTIME] Tournaments subscription error');
      });

    const playerTournamentsChannel = supabase
      .channel(`tournament-players-${playerId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_players', filter: `player_id=eq.${playerId}` }, () => {
        refetchTournamentQueries();
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') console.log('✅ [REALTIME] Subscribed to tournament_players');
        else if (status === 'CHANNEL_ERROR') console.warn('❌ [REALTIME] tournament_players subscription error');
      });

    return () => {
      socket.disconnect();
      supabase.removeChannel(tournamentsChannel);
      supabase.removeChannel(playerTournamentsChannel);
    };
  }, [playerId, clubId, queryClient]);
}
