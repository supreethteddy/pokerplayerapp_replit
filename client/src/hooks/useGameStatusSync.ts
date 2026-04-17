import { useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { useUltraFastAuth } from './useUltraFastAuth';
import { API_BASE_URL } from '@/lib/api/config';
import {
  patchPlaytimeCachesFromTableSocket,
  type TableStatusSocketPayload,
} from '@/lib/tableSessionLivePatch';

/**
 * Centralized synchronization hook for game status changes
 * Ensures all game-related queries update simultaneously when seat assignments happen
 */
export function useGameStatusSync() {
  const queryClient = useQueryClient();
  const { user } = useUltraFastAuth();
  const previousStatus = useRef<string>('unknown');

  const invalidateAllGameQueries = useCallback(() => {
    console.log('🔄 [GAME SYNC] Syncing game-related queries (immediate playtime refetch)');

    // Default query staleTime is Infinity; invalidation alone can feel "late". Force a network
    // refetch for every playtime cache variant (PlaytimeTracker + seated-sessions, any id shape).
    void queryClient.refetchQueries({
      queryKey: ['/api/player-playtime/current'],
      type: 'all',
    });

    if (!user?.id) return;

    const uid = String(user.id);

    void queryClient.refetchQueries({ queryKey: ['/api/auth/player/waitlist', uid], type: 'all' });
    void queryClient.refetchQueries({ queryKey: ['/api/auth/player/balance'], type: 'all' });
    queryClient.invalidateQueries({ queryKey: ['/api/auth/player/waitlist', uid] });
    queryClient.invalidateQueries({ queryKey: ['/api/tables'] });
    queryClient.invalidateQueries({ queryKey: ['tables'] });
    queryClient.invalidateQueries({ queryKey: ['/api/auth/player/balance', uid] });
  }, [queryClient, user?.id]);

  const checkForStateTransition = useCallback(() => {
    if (!user?.id) return;

    const uid = String(user.id);
    const waitlistData = queryClient.getQueryData(['/api/auth/player/waitlist', uid]) as any;

    if (waitlistData) {
      const currentStatus = waitlistData.isSeated ? 'seated' : waitlistData.onWaitlist ? 'waiting' : 'none';

      if (previousStatus.current === 'waiting' && currentStatus === 'seated') {
        console.log('🎯 [STATE TRANSITION] Player transitioned from waiting to seated - triggering immediate sync');
        invalidateAllGameQueries();
      }

      previousStatus.current = currentStatus;
    }
  }, [user?.id, queryClient, invalidateAllGameQueries]);

  // Set up WebSocket real-time synchronization
  useEffect(() => {
    if (!user?.id) return;

    const clubId = localStorage.getItem('clubId') || sessionStorage.getItem('clubId');
    
    if (!clubId) {
      console.warn('⚠️ [GAME SYNC] No clubId found, skipping real-time updates');
      return;
    }

    const websocketBase =
      import.meta.env.VITE_WEBSOCKET_URL ||
      (API_BASE_URL.endsWith('/api')
        ? API_BASE_URL.slice(0, -4)
        : API_BASE_URL.replace(/\/$/, ''));

    const uid = String(user.id);

    const socket = io(`${websocketBase}/realtime`, {
      auth: {
        clubId,
        playerId: uid,
        token: localStorage.getItem('auth_token') || localStorage.getItem('playerToken'),
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      reconnectionAttempts: Infinity,
    });

    socket.on('connect', () => {
      console.log('✅ [GAME SYNC] Connected to WebSocket');
      // Club first so `table:status-changed` (club broadcast) is not missed during subscribe race.
      socket.emit('subscribe:club', { clubId, playerId: uid });
      socket.emit('subscribe:player', { playerId: uid, clubId });
    });

    socket.on('table:status-changed', (payload: TableStatusSocketPayload) => {
      void queryClient.cancelQueries({ queryKey: ['/api/player-playtime/current'] });
      patchPlaytimeCachesFromTableSocket(queryClient, uid, payload);
      invalidateAllGameQueries();
    });

    // Listen for seat assignment events with immediate query invalidation
    socket.on('seat_assigned', (data: any) => {
      console.log('🪑 [SEAT ASSIGNMENT] Real-time notification received:', data);
      invalidateAllGameQueries();
    });

    // Listen for table updates that might affect player status
    socket.on('table_updated', (data: any) => {
      console.log('🔄 [TABLE UPDATE] Real-time notification received:', data);
      invalidateAllGameQueries();
    });

    socket.on('waitlist:status-changed', (data: any) => {
      if (!data?.playerId || String(data.playerId) !== uid) return;
      console.log('🔄 [GAME SYNC] waitlist:status-changed — refetch session');
      invalidateAllGameQueries();
    });

    socket.on('balance:updated', (data: any) => {
      if (!data?.playerId || String(data.playerId) !== uid) return;
      invalidateAllGameQueries();
    });

    socket.on('transaction:new', (data: any) => {
      if (!data?.playerId || String(data.playerId) !== uid) return;
      invalidateAllGameQueries();
    });

    socket.on('buyout:status-changed', (data: any) => {
      if (!data?.playerId || String(data.playerId) !== uid) return;
      invalidateAllGameQueries();
    });

    return () => {
      socket.disconnect();
    };
  }, [user?.id, queryClient, invalidateAllGameQueries]);

  // Periodic state transition checking
  useEffect(() => {
    if (!user?.id) return;

    const intervalId = setInterval(checkForStateTransition, 2000); // Check every 2 seconds
    return () => clearInterval(intervalId);
  }, [user?.id, checkForStateTransition]);

  return { invalidateAllGameQueries };
}