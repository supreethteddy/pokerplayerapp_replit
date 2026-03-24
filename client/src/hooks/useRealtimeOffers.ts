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
    const token = localStorage.getItem('auth_token') || localStorage.getItem('playerToken');
    const socket = io(`${websocketBase}/realtime`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: Infinity,
    });

    socket.on('offers:updated', () => {
      console.log('🎁 [SOCKET] Offers updated');
      queryClient.invalidateQueries({ queryKey: ['/api/player-offers/active'] });
    });

    return () => {
      socket.disconnect();
    };
  }, [queryClient]);
}
