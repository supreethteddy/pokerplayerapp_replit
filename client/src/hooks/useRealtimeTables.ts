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
    const token = localStorage.getItem('auth_token') || localStorage.getItem('playerToken');
    const socket = io(`${websocketBase}/realtime`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: Infinity,
    });

    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tables'] });
      queryClient.invalidateQueries({ queryKey: ['tables', 'available'] });
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
