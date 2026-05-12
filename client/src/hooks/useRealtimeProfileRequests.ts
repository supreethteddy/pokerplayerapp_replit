import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { useToast } from '@/hooks/use-toast';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3333/api';
const websocketBase = API_BASE_URL.endsWith('/api')
  ? API_BASE_URL.slice(0, -4)
  : API_BASE_URL.replace(/\/$/, '');

/** Dispatched when an admin approves a scalar field — useUltraFastAuth patches user state. */
export type PlayerProfileUpdatedDetail = { fieldName: string; newValue: string };

const SCALAR_PROFILE_FIELDS = new Set(['name', 'email', 'phoneNumber', 'phone']);

export function useRealtimeProfileRequests(playerId: number | string | null | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!playerId) return;

    const clubId =
      localStorage.getItem('clubId') ||
      sessionStorage.getItem('clubId') ||
      localStorage.getItem('club_id') ||
      sessionStorage.getItem('club_id');
    if (!clubId) {
      console.warn('📝 [SOCKET] Profile requests: no clubId, skipping realtime');
      return;
    }

    const token = localStorage.getItem('auth_token') || localStorage.getItem('playerToken');
    const socket = io(`${websocketBase}/realtime`, {
      auth: { playerId: String(playerId), clubId: String(clubId), token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: Infinity,
    });

    const flushProfileRequestUpdate = (data: any) => {
      if (data?.playerId && String(data.playerId) !== String(playerId)) return;

      console.log('📝 [SOCKET] Profile request updated:', data?.status, data?.fieldName);

      queryClient.invalidateQueries({ queryKey: ['/api/auth/player/profile-change-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/documents/player'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/player/me'] });
      queryClient.invalidateQueries({ queryKey: ['player-profile'] });

      const st = data?.status;
      if (st === 'approved') {
        toast({
          title: 'Request approved',
          description: 'Your profile update was approved. Refreshing your details…',
          duration: 5000,
        });
      } else if (st === 'rejected') {
        toast({
          title: 'Request rejected',
          description:
            typeof data?.reviewNotes === 'string' && data.reviewNotes.trim()
              ? data.reviewNotes.trim()
              : 'Staff rejected this change. See details below.',
          variant: 'destructive',
          duration: 12000,
        });
      }

      if (
        st === 'approved' &&
        data?.fieldName &&
        data?.newValue != null &&
        SCALAR_PROFILE_FIELDS.has(String(data.fieldName))
      ) {
        window.dispatchEvent(
          new CustomEvent<PlayerProfileUpdatedDetail>('player-profile-updated', {
            detail: {
              fieldName: String(data.fieldName === 'phone' ? 'phoneNumber' : data.fieldName),
              newValue: String(data.newValue),
            },
          }),
        );
      }
    };

    const onProfileRequestUpdated = (data: any) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        flushProfileRequestUpdate(data);
      }, 200);
    };

    socket.on('connect', () => {
      socket.emit('subscribe:player', { playerId: String(playerId), clubId: String(clubId) });
      socket.emit('subscribe:club', { clubId: String(clubId), playerId: String(playerId) });
    });

    socket.on('profile-request:updated', onProfileRequestUpdated);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      socket.disconnect();
    };
  }, [playerId, queryClient, toast]);
}
