import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3333/api';
const websocketBase = API_BASE_URL.endsWith('/api')
  ? API_BASE_URL.slice(0, -4)
  : API_BASE_URL.replace(/\/$/, '');

export function useRealtimeWaitlist(playerId: number | string | null | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!playerId) return;

    const clubId =
      localStorage.getItem('clubId') ||
      sessionStorage.getItem('clubId') ||
      localStorage.getItem('club_id') ||
      sessionStorage.getItem('club_id');
    if (!clubId) return;

    const token = localStorage.getItem('auth_token') || localStorage.getItem('playerToken');
    const socket = io(`${websocketBase}/realtime`, {
      auth: { playerId: String(playerId), clubId: String(clubId), token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: Infinity,
    });

    socket.on('connect', () => {
      // Mandatory for server-side scoped emissions (playerSubscriptions/clubSubscriptions).
      socket.emit('subscribe:player', { playerId: String(playerId), clubId: String(clubId) });
      socket.emit('subscribe:club', { clubId: String(clubId), playerId: String(playerId) });
    });

    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ['/api/seat-requests', playerId] });
      queryClient.invalidateQueries({ queryKey: ['waitlist', 'status'] });
      // Keep both waitlist query shapes in sync (legacy + game-status hook).
      queryClient.invalidateQueries({ queryKey: ['/api/auth/player/waitlist', playerId] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/player/waitlist'] });
      void queryClient.refetchQueries({ queryKey: ['/api/auth/player/waitlist', String(playerId)], type: 'all' });
      void queryClient.refetchQueries({ queryKey: ['/api/auth/player/balance'], type: 'all' });
    };

    socket.on('waitlist:position-updated', (data: any) => {
      if (!data?.playerId || String(data.playerId) !== String(playerId)) return;
      console.log('🎯 [SOCKET] Waitlist position updated:', data);
      invalidate();
    });

    socket.on('waitlist:status-changed', (data: any) => {
      if (!data?.playerId || String(data.playerId) !== String(playerId)) return;
      console.log('🎯 [SOCKET] Waitlist status changed:', data);
      invalidate();
    });

    return () => {
      socket.disconnect();
    };
  }, [playerId, queryClient]);
}
