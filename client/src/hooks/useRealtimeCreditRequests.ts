import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3333/api';
const websocketBase = API_BASE_URL.endsWith('/api')
  ? API_BASE_URL.slice(0, -4)
  : API_BASE_URL.replace(/\/$/, '');

export function useRealtimeCreditRequests(playerId: number | string | null | undefined) {
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
      socket.emit('subscribe:player', { playerId: String(playerId), clubId: String(clubId) });
      socket.emit('subscribe:club', { clubId: String(clubId), playerId: String(playerId) });
    });

    const invalidateCredit = () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/player/credit-requests', playerId] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/player/credit-requests'] });
      queryClient.invalidateQueries({ queryKey: ['credit-requests'] });
    };

    socket.on('credit:status-changed', (data: any) => {
      if (!data?.playerId || String(data.playerId) !== String(playerId)) return;
      console.log('💳 [SOCKET] Credit request status changed:', data);
      invalidateCredit();
    });

    // Backward/forward compatible alias.
    socket.on('credit:request-updated', (data: any) => {
      if (!data?.playerId || String(data.playerId) !== String(playerId)) return;
      invalidateCredit();
    });

    return () => {
      socket.disconnect();
    };
  }, [playerId, queryClient]);
}
