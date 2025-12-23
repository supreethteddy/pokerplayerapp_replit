import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/**
 * Hook to subscribe to real-time offers via Supabase Realtime
 * Automatically updates React Query cache when offers are created/updated/deleted
 */
export function useRealtimeOffers() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Subscribe to real-time changes on staff_offers table
    const channel = supabase
      .channel('realtime-offers')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'staff_offers',
          filter: 'is_active=eq.true', // Only active offers
        },
        (payload) => {
          console.log('🎁 [REALTIME] Offer change detected:', payload.eventType, payload.new || payload.old);
          
          // Invalidate offers query to refetch
          queryClient.invalidateQueries({ queryKey: ['/api/player-offers/active'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'offer_banners', // Also watch offer_banners
          filter: 'is_active=eq.true',
        },
        (payload) => {
          console.log('🎁 [REALTIME] Offer banner change detected:', payload.eventType);
          queryClient.invalidateQueries({ queryKey: ['/api/player-offers/active'] });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ [REALTIME] Subscribed to offers');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ [REALTIME] Offers subscription error');
        }
      });

    // Initial fetch
    const fetchOffers = async () => {
      try {
        const response = await fetch('/api/player-offers/active');
        if (response.ok) {
          const data = await response.json();
          queryClient.setQueryData(['/api/player-offers/active'], data);
        }
      } catch (error) {
        // Silently skip if endpoint not available
      }
    };

    fetchOffers();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}



