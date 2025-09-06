import { useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import Pusher from 'pusher-js';
import { useToast } from '@/hooks/use-toast';

interface TableNotificationData {
  tableId: string;
  tableName: string;
  seatNumber: number;
  gameType: string;
  minBuyIn: number;
  maxBuyIn: number;
  tableStatus: string;
}

export function useSeatAssignment(playerId: string | number) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const pusherRef = useRef<Pusher | null>(null);

  useEffect(() => {
    if (!playerId) return;

    console.log('🪑 [SEAT ASSIGNMENT] Initializing listener for player:', playerId);

    // Initialize Pusher if not already done
    if (!pusherRef.current) {
      const pusherKey = import.meta.env.VITE_PUSHER_KEY;
      const pusherCluster = import.meta.env.VITE_PUSHER_CLUSTER || 'ap2';

      if (!pusherKey) {
        console.error('❌ [SEAT ASSIGNMENT] VITE_PUSHER_KEY not found');
        return;
      }

      const pusher = new Pusher(pusherKey, {
        cluster: pusherCluster,
        forceTLS: true
      });

      pusherRef.current = pusher;

      pusher.connection.bind('connected', () => {
        console.log('✅ [SEAT ASSIGNMENT] Connected to Pusher');
      });

      pusher.connection.bind('disconnected', () => {
        console.log('❌ [SEAT ASSIGNMENT] Disconnected from Pusher');
      });
    }

    // Subscribe to player-specific channel for seat assignments
    const playerChannel = pusherRef.current.subscribe(`player-${playerId}`);

    // Listen for table assignment events (player assigned to table)
    playerChannel.bind('table-assignment', (data: TableNotificationData) => {
      console.log('🪑 [TABLE ASSIGNMENT] Player assigned to table:', data);

      // Show notification to player
      toast({
        title: "🪑 Seat Assigned!",
        description: `You've been assigned to seat ${data.seatNumber} at ${data.tableName}. Taking you to the table...`,
        duration: 5000,
      });

      // Wait a moment for the user to see the notification, then navigate
      setTimeout(() => {
        setLocation(`/table/${data.tableId}`);
      }, 2000);
    });

    // Listen for table activation events (table becomes active)
    playerChannel.bind('table-activation', (data: TableNotificationData) => {
      console.log('🚀 [TABLE ACTIVATION] Table became active:', data);

      // Show notification to player
      toast({
        title: "🚀 Table Active!",
        description: `${data.tableName} is now active! Game starting at seat ${data.seatNumber}...`,
        duration: 5000,
      });

      // Wait a moment for the user to see the notification, then navigate
      setTimeout(() => {
        setLocation(`/table/${data.tableId}`);
      }, 2000);
    });

    console.log(`📡 [TABLE NOTIFICATIONS] Listening for table-assignment and table-activation events on player-${playerId}`);

    // Cleanup function
    return () => {
      if (pusherRef.current) {
        pusherRef.current.unsubscribe(`player-${playerId}`);
        pusherRef.current.disconnect();
        pusherRef.current = null;
      }
    };
  }, [playerId, setLocation, toast]);

  return {
    isListening: !!pusherRef.current
  };
}