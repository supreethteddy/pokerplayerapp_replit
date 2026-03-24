import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3333/api';
const websocketBase = API_BASE_URL.endsWith('/api')
  ? API_BASE_URL.slice(0, -4)
  : API_BASE_URL.replace(/\/$/, '');

export function useRealtimeBuyIn(playerId: number | string | null | undefined) {
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

    const invalidateBalance = () => {
      queryClient.invalidateQueries({ queryKey: [`/api/auth/player/balance`] });
      queryClient.invalidateQueries({ queryKey: [`/api/auth/player/transactions`] });
    };

    socket.on('buyin:status-changed', (data: any) => {
      if (!data?.playerId || String(data.playerId) !== String(playerId)) return;
      console.log('🔔 [SOCKET] Buy-in request status changed:', data?.request?.status);
      queryClient.invalidateQueries({ queryKey: ['buyin-requests', String(playerId)] });
      invalidateBalance();
    });

    socket.on('transaction:new', (data: any) => {
      if (!data?.playerId || String(data.playerId) !== String(playerId)) return;
      console.log('💰 [SOCKET] New transaction for player');
      invalidateBalance();
    });

    socket.on('balance:updated', (data: any) => {
      if (!data?.playerId || String(data.playerId) !== String(playerId)) return;
      console.log('💰 [SOCKET] Balance updated for player');
      invalidateBalance();
    });

    return () => {
      socket.disconnect();
    };
  }, [playerId, queryClient]);
}
