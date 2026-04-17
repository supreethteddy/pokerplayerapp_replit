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

    const invalidateBalance = () => {
      queryClient.invalidateQueries({ queryKey: ['/api/balance', playerId] });
      queryClient.invalidateQueries({ queryKey: ['/api/balance'] });
      queryClient.invalidateQueries({ queryKey: [`/api/auth/player/balance`] });
      queryClient.invalidateQueries({ queryKey: [`/api/auth/player/transactions`] });
      // PlayerTransactionHistory uses usePlayerTransactions → ['player', 'transactions', ...]
      queryClient.invalidateQueries({ queryKey: ['player', 'transactions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/player-playtime/current', playerId] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/player/waitlist', playerId] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/player/waitlist'] });
    };

    socket.on('buyin:status-changed', (data: any) => {
      if (!data?.playerId || String(data.playerId) !== String(playerId)) return;
      console.log('🔔 [SOCKET] Buy-in request status changed:', data?.request?.status);
      queryClient.invalidateQueries({ queryKey: ['buyin-requests', String(playerId)] });
      queryClient.invalidateQueries({ queryKey: ['buyin-requests', playerId] });
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

    socket.on('buyout:status-changed', (data: any) => {
      if (!data?.playerId || String(data.playerId) !== String(playerId)) return;
      console.log('🔔 [SOCKET] Buy-out request status changed:', data?.request?.status);
      invalidateBalance();
    });

    return () => {
      socket.disconnect();
    };
  }, [playerId, queryClient]);
}
