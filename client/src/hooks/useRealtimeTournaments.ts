import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
 * Subscribe to Socket.IO for all tournament updates.
 * Handles blind advances, start/stop/pause/eliminate via club and player events.
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
      queryClient.refetchQueries({ queryKey: ['/api/player-tournaments/upcoming'], type: 'all' });
      queryClient.refetchQueries({ queryKey: ['/api/player-tournaments/my-registrations'], type: 'all' });
      queryClient.invalidateQueries({ queryKey: ['tournament-player-status'] });
      queryClient.invalidateQueries({ queryKey: ['player-tournament-statuses'] });
    };

    const token = localStorage.getItem('auth_token') || localStorage.getItem('playerToken');
    const socket = io(`${websocketBase}/realtime`, {
      auth: {
        clubId,
        playerId: String(playerId),
        token,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity,
    });

    socket.on('connect', () => {
      socket.emit('subscribe:player', { playerId: String(playerId), clubId });
      if (clubId) socket.emit('subscribe:club', { clubId, playerId: String(playerId) });
    });

    socket.on('tournament:blinds-updated', (data: any) => {
      const t: BlindUpdatePayload | undefined = data?.tournament;
      if (!t) return;

      console.log('🎯 [SOCKET TOURNAMENT] blinds-updated:', t.currentSb, '/', t.currentBb);

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

      refetchTournamentQueries();
      onBlindsUpdatedRef.current?.(t);
    });

    socket.on('tournament:updated', (data: any) => {
      if (data?.clubId && clubId && data.clubId !== clubId) return;
      console.log('🏆 [SOCKET TOURNAMENT] tournament:updated');
      refetchTournamentQueries();
    });

    socket.on('tournament:player-updated', (data: any) => {
      if (data?.playerId && String(data.playerId) !== String(playerId)) return;
      console.log('🏆 [SOCKET TOURNAMENT] tournament:player-updated');
      refetchTournamentQueries();
    });

    return () => {
      socket.disconnect();
    };
  }, [playerId, clubId, queryClient]);
}
