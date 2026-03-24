import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3333/api';
const websocketBase = API_BASE_URL.endsWith('/api')
  ? API_BASE_URL.slice(0, -4)
  : API_BASE_URL.replace(/\/$/, '');

// Dispatched when an admin approves a field update — useUltraFastAuth listens and patches user state immediately.
export type PlayerProfileUpdatedDetail = { fieldName: string; newValue: string };

export function useRealtimeProfileRequests(playerId: number | string | null | undefined) {
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

    socket.on('profile-request:updated', (data: any) => {
      if (data?.playerId && String(data.playerId) !== String(playerId)) return;
      console.log('📝 [SOCKET] Profile request updated:', data?.status);

      queryClient.invalidateQueries({ queryKey: ['/api/auth/player/profile-change-requests'] });

      // If approved, dispatch a DOM event so useUltraFastAuth can patch the player state immediately
      if (data?.status === 'approved' && data?.fieldName && data?.newValue != null) {
        window.dispatchEvent(
          new CustomEvent<PlayerProfileUpdatedDetail>('player-profile-updated', {
            detail: { fieldName: data.fieldName, newValue: String(data.newValue) },
          })
        );
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [playerId, queryClient]);
}
