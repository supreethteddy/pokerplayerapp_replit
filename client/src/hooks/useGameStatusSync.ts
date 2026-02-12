import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import { useUltraFastAuth } from './useUltraFastAuth';
import { API_BASE_URL, STORAGE_KEYS } from '@/lib/api/config';

/**
 * Centralized synchronization hook for game status changes
 * Ensures all game-related queries update simultaneously when seat assignments happen
 */
export function useGameStatusSync() {
  const queryClient = useQueryClient();
  const { user } = useUltraFastAuth();
  const previousStatus = useRef<string>('unknown');

  // Invalidate all game-related queries simultaneously
  const invalidateAllGameQueries = () => {
    if (!user?.id) return;

    console.log('🔄 [GAME SYNC] Invalidating all game-related queries for immediate synchronization');

    // Invalidate all game-status related queries at once
    queryClient.invalidateQueries({ queryKey: ['/api/auth/player/waitlist', user.id] });
    queryClient.invalidateQueries({ queryKey: ['/api/player-playtime/current', user.id] });
    queryClient.invalidateQueries({ queryKey: ['/api/tables'] });
    
    // Also invalidate balance as it may change with seat assignments
    queryClient.invalidateQueries({ queryKey: ['/api/auth/player/balance', user.id] });
  };

  // Monitor for state transitions (waitlist → seated)
  const checkForStateTransition = () => {
    if (!user?.id) return;

    // Get current waitlist status data to check for status changes
    const waitlistData = queryClient.getQueryData(['/api/auth/player/waitlist', user.id]) as any;
    
    if (waitlistData) {
      const currentStatus = waitlistData.isSeated ? 'seated' : waitlistData.onWaitlist ? 'waiting' : 'none';
      
      // If status changed from waiting to seated, immediately invalidate everything
      if (previousStatus.current === 'waiting' && currentStatus === 'seated') {
        console.log('🎯 [STATE TRANSITION] Player transitioned from waiting to seated - triggering immediate sync');
        invalidateAllGameQueries();
      }
      
      previousStatus.current = currentStatus;
    }
  };

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

    const socket = io(`${websocketBase}/realtime`, {
      auth: { clubId, playerId: user.id },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socket.on('connect', () => {
      console.log('✅ [GAME SYNC] Connected to WebSocket');
      socket.emit('subscribe:player', { playerId: user.id, clubId });
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

    return () => {
      socket.disconnect();
    };
  }, [user?.id, queryClient]);

  // Periodic state transition checking
  useEffect(() => {
    if (!user?.id) return;

    const intervalId = setInterval(checkForStateTransition, 2000); // Check every 2 seconds
    return () => clearInterval(intervalId);
  }, [user?.id, queryClient]);

  return { invalidateAllGameQueries };
}