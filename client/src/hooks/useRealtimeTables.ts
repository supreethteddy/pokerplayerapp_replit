import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3333/api';
const websocketBase = API_BASE_URL.endsWith('/api')
  ? API_BASE_URL.slice(0, -4)
  : API_BASE_URL.replace(/\/$/, '');

export function useRealtimeTables() {
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

    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tables'] });
      queryClient.invalidateQueries({ queryKey: ['tables'] });
    };

    socket.on('table:status-changed', () => {
      console.log('🎲 [SOCKET] Table status changed');
      invalidate();
    });

    socket.on('tables:updated', () => {
      console.log('🎲 [SOCKET] Tables updated');
      invalidate();
    });

    return () => {
      socket.disconnect();
    };
  }, [queryClient]);
}
