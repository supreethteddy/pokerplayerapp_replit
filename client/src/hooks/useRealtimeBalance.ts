import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3333/api';
const websocketBase = API_BASE_URL.endsWith('/api')
  ? API_BASE_URL.slice(0, -4)
  : API_BASE_URL.replace(/\/$/, '');

export function useRealtimeBalance(playerId: number | string | null | undefined) {
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

    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ['player', 'balance'] });
      queryClient.invalidateQueries({ queryKey: ['/api/balance', playerId] });
      queryClient.invalidateQueries({ queryKey: ['/api/balance'] });
      queryClient.invalidateQueries({ queryKey: ['/api/player-playtime/current', playerId] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/player/waitlist', playerId] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/player/waitlist'] });
      queryClient.invalidateQueries({ queryKey: ['/api/players/supabase'] });
    };

    socket.on('balance:updated', (data: any) => {
      if (!data?.playerId || String(data.playerId) !== String(playerId)) return;
      console.log('💰 [SOCKET] Balance updated for player:', playerId);
      invalidate();
    });

    socket.on('transaction:new', (data: any) => {
      if (!data?.playerId || String(data.playerId) !== String(playerId)) return;
      console.log('💰 [SOCKET] New transaction - refreshing balance');
      invalidate();
    });

    // Buy-in approval/rejection should also update balance widgets immediately.
    socket.on('buyin:status-changed', (data: any) => {
      if (!data?.playerId || String(data.playerId) !== String(playerId)) return;
      invalidate();
    });

    socket.on('buyout:status-changed', (data: any) => {
      if (!data?.playerId || String(data.playerId) !== String(playerId)) return;
      console.log('💰 [SOCKET] Buy-out status changed - refreshing balance/session');
      invalidate();
    });

    return () => {
      socket.disconnect();
    };
  }, [playerId, queryClient]);
}
