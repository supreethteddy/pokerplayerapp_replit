import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/**
 * Hook to subscribe to real-time table updates via Supabase Realtime
 * Automatically updates React Query cache when tables change
 */
export function useRealtimeTables() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Subscribe to real-time changes on tables table
    const channel = supabase
      .channel('realtime-tables')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'tables',
        },
        (payload) => {
          console.log('🎲 [REALTIME] Table change detected:', payload.eventType, payload.new || payload.old);
          
          // Invalidate table queries to refetch
          queryClient.invalidateQueries({ queryKey: ['/api/tables'] });
          queryClient.invalidateQueries({ queryKey: ['tables', 'available'] });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ [REALTIME] Subscribed to tables');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ [REALTIME] Tables subscription error');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}









