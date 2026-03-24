import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3333/api';
const websocketBase = API_BASE_URL.endsWith('/api')
  ? API_BASE_URL.slice(0, -4)
  : API_BASE_URL.replace(/\/$/, '');

export function useRealtimeTransactions(playerId: number | string | null | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!playerId) return;

    const token = localStorage.getItem('auth_token') || localStorage.getItem('playerToken');
    const socket = io(`${websocketBase}/realtime`, {
      auth: { playerId: String(playerId), token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: Infinity,
    });

    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ['player', 'transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transactions', playerId] });
    };

    socket.on('transaction:new', (data: any) => {
      if (!data?.playerId || String(data.playerId) !== String(playerId)) return;
      console.log('💳 [SOCKET] New transaction detected for player:', playerId);
      invalidate();
    });

    return () => {
      socket.disconnect();
    };
  }, [playerId, queryClient]);
}
