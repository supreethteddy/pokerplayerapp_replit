import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import Pusher from 'pusher-js';
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
    refetchInterval: 5000, // Refetch every 5 seconds for optimized performance
    staleTime: 0, // Always consider data stale for fresh credit updates from staff portal
    enabled: !!playerId, // Only run query if playerId exists
  });

  // Real-time balance updates via Pusher (optional)
  useEffect(() => {
    if (!playerId) return;

    try {
      // Use environment variables for Pusher configuration
      const pusherKey = import.meta.env.VITE_PUSHER_KEY;
      const pusherCluster = import.meta.env.VITE_PUSHER_CLUSTER;
      
      if (!pusherKey) {
        console.warn('⚠️ [BALANCE] VITE_PUSHER_KEY not configured, skipping real-time updates');
        return;
      }
      
      const pusher = new Pusher(pusherKey, {
        cluster: pusherCluster || 'ap2',
        forceTLS: true
      });

    const channel = pusher.subscribe('cross-portal-sync');
    
    channel.bind('player_balance_update', (data: any) => {
      if (data.playerId?.toString() === playerId) {
        console.log('💰 [REAL-TIME BALANCE] Update received:', data);
        
        // Invalidate and refetch balance immediately for credit updates
        queryClient.invalidateQueries({ queryKey: [`/api/auth/player/balance`] });
      }
    });

    // Listen for staff portal credit approvals
    channel.bind('credit_approved', (data: any) => {
      if (data.playerId?.toString() === playerId) {
        console.log('✅ [REAL-TIME CREDIT] Credit approved by staff:', data);
        
        // Immediately refresh balance to show new credit_balance
        queryClient.invalidateQueries({ queryKey: [`/api/auth/player/balance`] });
      }
    });

    channel.bind('wallet_transaction', (data: any) => {
      if (data.playerId?.toString() === playerId) {
        console.log('💳 [REAL-TIME BALANCE] Transaction update:', data);
        
        // Invalidate balance and transaction queries
        queryClient.invalidateQueries({ queryKey: [`/api/auth/player/balance`] });
        queryClient.invalidateQueries({ queryKey: [`/api/auth/player/transactions`] });
      }
    });

    // Listen for direct player balance updates
    const playerChannel = pusher.subscribe(`player-${playerId}`);
    
    playerChannel.bind('balance_updated', (data: any) => {
      console.log('💰 [REAL-TIME BALANCE] Direct player update:', data);
      queryClient.invalidateQueries({ queryKey: [`/api/auth/player/balance`] });
    });

    playerChannel.bind('cash_out_request_submitted', (data: any) => {
      console.log('💳 [REAL-TIME BALANCE] Cash-out request submitted:', data);
      // Could show notification here
    });

      return () => {
        pusher.unsubscribe('cross-portal-sync');
        pusher.unsubscribe(`player-${playerId}`);
        pusher.disconnect();
      };
    } catch (error) {
      console.error('❌ [BALANCE] Pusher connection failed:', error);
    }
  }, [playerId, queryClient]);

  return {
    balance,
    isLoading,
    error,
    cashBalance: parseFloat((balance as any)?.availableBalance || (balance as any)?.currentBalance || balance?.cashBalance || '0'),
    creditBalance: parseFloat((balance as any)?.creditBalance || '0'),
    creditLimit: parseFloat((balance as any)?.creditLimit || '0'),
    creditApproved: (balance as any)?.creditApproved || false,
    tableBalance: parseFloat((balance as any)?.tableBalance || '0'),
    totalBalance: parseFloat((balance as any)?.totalBalance || (balance as any)?.availableBalance || (balance as any)?.currentBalance || balance?.cashBalance || '0')
  };
}