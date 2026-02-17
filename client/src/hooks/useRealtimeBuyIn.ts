import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/**
 * Hook to subscribe to real-time buy-in request status changes via Supabase Realtime.
 * When staff approves/rejects a buy-in request, the player sees it instantly.
 * Also listens for financial_transactions changes to update balance in real-time.
 */
export function useRealtimeBuyIn(playerId: number | string | null | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!playerId) return;

    const channel = supabase
      .channel(`buyin-status-${playerId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'buyin_requests',
          filter: `player_id=eq.${playerId}`,
        },
        (payload) => {
          const newStatus = payload.new?.status;
          console.log('🔔 [REALTIME] Buy-in request updated:', newStatus, payload.new);

          // Invalidate buy-in requests and balance queries
          queryClient.invalidateQueries({ queryKey: ['buyin-requests', String(playerId)] });
          queryClient.invalidateQueries({ queryKey: [`/api/auth/player/balance`] });
          queryClient.invalidateQueries({ queryKey: [`/api/auth/player/transactions`] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'financial_transactions',
          filter: `player_id=eq.${playerId}`,
        },
        (payload) => {
          console.log('💰 [REALTIME] New transaction for player:', payload.new?.type, payload.new?.amount);

          // Invalidate balance and transaction queries immediately
          queryClient.invalidateQueries({ queryKey: [`/api/auth/player/balance`] });
          queryClient.invalidateQueries({ queryKey: [`/api/auth/player/transactions`] });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ [REALTIME] Subscribed to buy-in updates for player:', playerId);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ [REALTIME] Buy-in subscription error for player:', playerId);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [playerId, queryClient]);
}
