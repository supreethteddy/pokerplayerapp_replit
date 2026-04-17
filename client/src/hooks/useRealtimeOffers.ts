import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3333/api';
const websocketBase = API_BASE_URL.endsWith('/api')
  ? API_BASE_URL.slice(0, -4)
  : API_BASE_URL.replace(/\/$/, '');

export function useRealtimeOffers() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const clubId =
      localStorage.getItem('clubId') ||
      sessionStorage.getItem('clubId') ||
      localStorage.getItem('club_id') ||
      sessionStorage.getItem('club_id');
    if (!clubId) return;

    const playerId =
      localStorage.getItem('playerId') ||
      sessionStorage.getItem('playerId') ||
      localStorage.getItem('userId') ||
      sessionStorage.getItem('userId');

    const token = localStorage.getItem('auth_token') || localStorage.getItem('playerToken');
    const socket = io(`${websocketBase}/realtime`, {
      auth: { token, clubId: String(clubId), playerId: playerId ? String(playerId) : undefined },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: Infinity,
    });

    socket.on('connect', () => {
      socket.emit('subscribe:club', {
        clubId: String(clubId),
        ...(playerId ? { playerId: String(playerId) } : {}),
      });
    });

    socket.on('offers:updated', () => {
      console.log('🎁 [SOCKET] Offers updated');
      queryClient.invalidateQueries({ queryKey: ['/api/player-offers/active'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/player/push-notifications'] });
    });

    // So offers drop shortly after expires_at without an admin action (no extra socket event at exact time).
    const poll = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['/api/player-offers/active'] });
    }, 120_000);

    return () => {
      clearInterval(poll);
      socket.disconnect();
    };
  }, [queryClient]);
}
