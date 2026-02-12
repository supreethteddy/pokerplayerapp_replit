import { useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { io, Socket } from 'socket.io-client';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/lib/api/config';

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
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!playerId) return;

    console.log('🪑 [SEAT ASSIGNMENT] Initializing listener for player:', playerId);

    const clubId = localStorage.getItem('clubId') || sessionStorage.getItem('clubId');
    if (!clubId) {
      console.error('❌ [SEAT ASSIGNMENT] No clubId found in localStorage');
      return;
    }

    // Initialize WebSocket connection
    const websocketBase =
      import.meta.env.VITE_WEBSOCKET_URL ||
      (API_BASE_URL.endsWith('/api')
        ? API_BASE_URL.slice(0, -4)
        : API_BASE_URL.replace(/\/$/, ''));

    const socket = io(`${websocketBase}/realtime`, {
      auth: { clubId, playerId },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('✅ [SEAT ASSIGNMENT] Connected to WebSocket');
      socket.emit('subscribe:player', { playerId, clubId });
    });

    socket.on('disconnect', () => {
      console.log('❌ [SEAT ASSIGNMENT] Disconnected from WebSocket');
    });

    // Listen for table assignment events (player assigned to table)
    socket.on('table-assignment', (data: TableNotificationData) => {
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
    socket.on('table-activation', (data: TableNotificationData) => {
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
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [playerId, setLocation, toast]);

  return {
    isListening: !!socketRef.current
  };
}