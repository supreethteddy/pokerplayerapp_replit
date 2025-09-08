import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useUltraFastAuth } from './useUltraFastAuth';

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
    queryClient.invalidateQueries({ queryKey: ['/api/seat-requests', user.id] });
    queryClient.invalidateQueries({ queryKey: ['/api/table-seats', user.id] });
    queryClient.invalidateQueries({ queryKey: ['/api/live-sessions', user.id] });
    queryClient.invalidateQueries({ queryKey: ['/api/tables'] });
    queryClient.invalidateQueries({ queryKey: ['/api/table-status'] });
    
    // Also invalidate balance as it may change with seat assignments
    queryClient.invalidateQueries({ queryKey: ['/api/balance', user.id] });
  };

  // Monitor for state transitions (waitlist → seated)
  const checkForStateTransition = () => {
    if (!user?.id) return;

    // Get current seat-requests data to check for status changes
    const seatRequestsData = queryClient.getQueryData(['/api/seat-requests', user.id]) as any[];
    
    if (Array.isArray(seatRequestsData)) {
      const hasSeatedSession = seatRequestsData.some((req: any) => req.status === 'seated');
      const currentStatus = hasSeatedSession ? 'seated' : 'waiting';
      
      // If status changed from waiting to seated, immediately invalidate everything
      if (previousStatus.current === 'waiting' && currentStatus === 'seated') {
        console.log('🎯 [STATE TRANSITION] Player transitioned from waiting to seated - triggering immediate sync');
        invalidateAllGameQueries();
      }
      
      previousStatus.current = currentStatus;
    }
  };

  // Set up Pusher real-time synchronization
  useEffect(() => {
    if (!user?.id) return;

    let pusher: any;
    let playerChannel: any;

    // Import Pusher asynchronously for real-time seat assignment notifications
    import('pusher-js').then(({ default: Pusher }) => {
      pusher = new Pusher(import.meta.env.VITE_PUSHER_KEY, {
        cluster: import.meta.env.VITE_PUSHER_CLUSTER,
      });

      playerChannel = pusher.subscribe(`player-${user.id}`);
      
      // Listen for seat assignment events with immediate query invalidation
      playerChannel.bind('seat_assigned', (data: any) => {
        console.log('🪑 [SEAT ASSIGNMENT] Real-time notification received:', data);
        invalidateAllGameQueries();
      });

      // Listen for table updates that might affect player status
      playerChannel.bind('table_updated', (data: any) => {
        console.log('🔄 [TABLE UPDATE] Real-time notification received:', data);
        invalidateAllGameQueries();
      });

      return () => {
        if (playerChannel) {
          playerChannel.unbind('seat_assigned');
          playerChannel.unbind('table_updated');
          pusher.unsubscribe(`player-${user.id}`);
        }
        if (pusher) {
          pusher.disconnect();
        }
      };
    }).catch(console.error);

    return () => {
      if (playerChannel) {
        playerChannel.unbind('seat_assigned');
        playerChannel.unbind('table_updated');
        pusher?.unsubscribe(`player-${user.id}`);
      }
      if (pusher) {
        pusher.disconnect();
      }
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