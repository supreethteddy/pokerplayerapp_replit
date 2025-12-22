import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/**
 * Hook to subscribe to real-time notifications via Supabase Realtime
 * Automatically updates React Query cache when new notifications arrive
 */
export function useRealtimeNotifications(playerId: number | string | null | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!playerId) return;

    // Initial fetch
    const fetchNotifications = async () => {
      try {
        const response = await fetch(`/api/push-notifications/${playerId}`);
        if (response.ok) {
          const data = await response.json();
          queryClient.setQueryData(['/api/push-notifications', playerId], data);
        }
      } catch (error) {
        console.error('❌ [REALTIME NOTIFICATIONS] Initial fetch failed:', error);
      }
    };

    fetchNotifications();

    // Subscribe to real-time changes on push_notifications table
    const channel = supabase
      .channel(`player-notifications-${playerId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'push_notifications',
          filter: `player_id=eq.${playerId}`,
        },
        (payload) => {
          console.log('🔔 [REALTIME] Notification change detected:', payload.eventType, payload.new || payload.old);
          
          // Invalidate and refetch to get latest data
          queryClient.invalidateQueries({ queryKey: ['/api/push-notifications', playerId] });
          
          // Also invalidate the bell badge count
          queryClient.invalidateQueries({ queryKey: [`/api/push-notifications/${playerId}`] });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ [REALTIME] Subscribed to notifications for player:', playerId);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ [REALTIME] Notification subscription error');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [playerId, queryClient]);
}



