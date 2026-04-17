import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3333/api';
const websocketBase = API_BASE_URL.endsWith('/api')
  ? API_BASE_URL.slice(0, -4)
  : API_BASE_URL.replace(/\/$/, '');

export function useRealtimeNotifications(playerId: number | string | null | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!playerId) return;
    const clubId =
      localStorage.getItem('clubId') ||
      sessionStorage.getItem('clubId') ||
      localStorage.getItem('club_id') ||
      sessionStorage.getItem('club_id');
    if (!clubId) return;

    // Initial fetch
    const fetchNotifications = async () => {
      try {
        const token = localStorage.getItem('auth_token') || localStorage.getItem('playerToken');
        const clubId =
          localStorage.getItem('clubId') ||
          sessionStorage.getItem('clubId') ||
          localStorage.getItem('club_id') ||
          sessionStorage.getItem('club_id');
        const response = await fetch(`${API_BASE_URL}/auth/player/push-notifications`, {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(clubId ? { 'x-club-id': clubId } : {}),
            'x-player-id': String(playerId),
          },
        });
        if (response.ok) {
          const data = await response.json();
          queryClient.setQueryData(['/api/auth/player/push-notifications', playerId], data);
        }
      } catch {
        // Silently skip if endpoint not available
      }
    };

    fetchNotifications();

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

    socket.on('notification:new', (data: any) => {
      if (data?.playerId && String(data.playerId) !== String(playerId)) return;
      console.log('🔔 [SOCKET] New notification for player:', playerId);
      queryClient.invalidateQueries({ queryKey: ['/api/auth/player/push-notifications', playerId] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/player/push-notifications'] });
    });

    socket.on('offers:updated', () => {
      queryClient.invalidateQueries({ queryKey: ['/api/player-offers/active'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/player/push-notifications', playerId] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/player/push-notifications'] });
    });

    return () => {
      socket.disconnect();
    };
  }, [playerId, queryClient]);
}
