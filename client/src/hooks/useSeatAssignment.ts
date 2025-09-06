import { useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import Pusher from 'pusher-js';
import { useToast } from '@/hooks/use-toast';

interface SeatAssignmentData {
  tableId: string;
  seatNumber: number;
  assignedBy: string;
  assignedAt: string;
  message: string;
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

    // Listen for seat assignment events
    playerChannel.bind('seat-assigned', (data: SeatAssignmentData) => {
      console.log('🪑 [SEAT ASSIGNMENT] Player assigned to seat:', data);

      // Show notification to player
      toast({
        title: "🪑 Seat Assigned!",
        description: `You have been assigned to seat ${data.seatNumber}. Taking you to the table...`,
        duration: 5000,
      });

      // Wait a moment for the user to see the notification, then navigate
      setTimeout(() => {
        setLocation(`/table/${data.tableId}`);
      }, 2000);
    });

    console.log(`📡 [SEAT ASSIGNMENT] Listening for seat assignments on player-${playerId}`);

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