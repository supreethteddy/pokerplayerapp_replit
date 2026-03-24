import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { getAuthHeaders, API_BASE_URL, STORAGE_KEYS } from '../lib/api/config';

interface PlayerBalance {
  playerId?: number;
  cashBalance?: number;
  tableBalance?: number;
  totalBalance?: number;
  creditLimit?: string;
  availableCredit?: number;
  // New dual balance format
  currentBalance?: string;
  creditBalance?: string;
  creditApproved?: boolean;
}

export function usePlayerBalance(playerId: string) {
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);

  // Fetch player balance from our backend API using the correct dual balance endpoint
  const { data: balance, isLoading, error } = useQuery<PlayerBalance>({
    queryKey: [`/api/auth/player/balance`],
    queryFn: async () => {
      console.log('🔍 [BALANCE HOOK] Fetching balance...');
      console.log('🔍 [BALANCE HOOK] playerId:', playerId);

      // Get clubId from storage
      const clubId = localStorage.getItem(STORAGE_KEYS.CLUB_ID) ||
        sessionStorage.getItem(STORAGE_KEYS.CLUB_ID);

      console.log('🔍 [BALANCE HOOK] clubId:', clubId);

      const headers = getAuthHeaders(playerId, clubId || undefined);
      console.log('🔍 [BALANCE HOOK] Headers:', headers);

      const url = `${API_BASE_URL}/auth/player/balance`;
      console.log('🔍 [BALANCE HOOK] Fetching from:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers,
        credentials: 'include',
      });

      console.log('🔍 [BALANCE HOOK] Response status:', response.status);

      if (!response.ok) {
        const text = await response.text();
        console.error('❌ [BALANCE HOOK] Error:', text);
        throw new Error(`Failed to fetch balance: ${response.status} ${text}`);
      }

      const data = await response.json();
      console.log('✅ [BALANCE HOOK] Balance data:', data);
      return data;
    },
    staleTime: 5000,
    enabled: !!playerId,
  });

  // Real-time balance updates via WebSocket
  useEffect(() => {
    if (!playerId) return;

    const clubId = localStorage.getItem('clubId') || sessionStorage.getItem('clubId');

    if (!clubId) {
      console.warn('⚠️ [BALANCE] No clubId found, skipping real-time updates');
      return;
    }

    const websocketBase =
      import.meta.env.VITE_WEBSOCKET_URL ||
      (API_BASE_URL.endsWith('/api')
        ? API_BASE_URL.slice(0, -4)
        : API_BASE_URL.replace(/\/$/, ''));

    const socket = io(`${websocketBase}/realtime`, {
      auth: {
        clubId,
        playerId,
        token: localStorage.getItem('auth_token') || localStorage.getItem('playerToken'),
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      reconnectionAttempts: Infinity,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('✅ [BALANCE] Connected to WebSocket');
      socket.emit('subscribe:player', { playerId, clubId });
    });

    // Listen for balance update events
    socket.on('player_balance_update', (data: any) => {
      if (data.playerId?.toString() === playerId) {
        console.log('💰 [REAL-TIME BALANCE] Update received:', data);
        queryClient.invalidateQueries({ queryKey: [`/api/auth/player/balance`] });
      }
    });

    socket.on('credit_approved', (data: any) => {
      if (data.playerId?.toString() === playerId) {
        console.log('✅ [REAL-TIME CREDIT] Credit approved by staff:', data);
        queryClient.invalidateQueries({ queryKey: [`/api/auth/player/balance`] });
      }
    });

    socket.on('wallet_transaction', (data: any) => {
      if (data.playerId?.toString() === playerId) {
        console.log('💳 [REAL-TIME BALANCE] Transaction update:', data);
        queryClient.invalidateQueries({ queryKey: [`/api/auth/player/balance`] });
        queryClient.invalidateQueries({ queryKey: [`/api/auth/player/transactions`] });
      }
    });

    socket.on('balance_updated', (data: any) => {
      console.log('💰 [REAL-TIME BALANCE] Direct player update:', data);
      queryClient.invalidateQueries({ queryKey: [`/api/auth/player/balance`] });
    });

    socket.on('cash_out_request_submitted', (data: any) => {
      console.log('💳 [REAL-TIME BALANCE] Cash-out request submitted:', data);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [playerId, queryClient]);

  const cash = parseFloat((balance as any)?.availableBalance || (balance as any)?.currentBalance || (balance as any)?.cashBalance || '0');
  const creditDebt = parseFloat((balance as any)?.creditBalance || (balance as any)?.creditUsed || '0');
  const netBalance = (balance as any)?.totalBalance !== undefined
    ? parseFloat((balance as any)?.totalBalance)
    : (cash - creditDebt);

  return {
    balance,
    isLoading,
    error,
    cashBalance: cash,
    creditBalance: creditDebt,
    creditLimit: parseFloat((balance as any)?.creditLimit || '0'),
    creditApproved: (balance as any)?.creditApproved || false,
    tableBalance: parseFloat((balance as any)?.tableBalance || '0'),
    totalBalance: netBalance
  };
}