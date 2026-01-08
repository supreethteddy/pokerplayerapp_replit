import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

/**
 * Real-time KYC status updates hook
 * Subscribes to player table changes for KYC status updates
 * When admin approves KYC, player gets notified immediately
 */
export function useRealtimeKycStatus(playerId: number | string | null | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (!playerId) return;

    console.log('🔐 [REALTIME KYC] Subscribing to KYC status updates for player:', playerId);

    const channel = supabase
      .channel(`player-kyc-${playerId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'players',
          filter: `id=eq.${playerId}`,
        },
        (payload) => {
          console.log('🔐 [REALTIME KYC] Player data updated:', payload);
          
          const newData = payload.new as any;
          const oldData = payload.old as any;

          // Check if KYC status changed
          if (newData.kyc_status !== oldData.kyc_status) {
            console.log('🎉 [REALTIME KYC] KYC Status changed:', {
              old: oldData.kyc_status,
              new: newData.kyc_status
            });

            // Show success notification if KYC was approved
            if (newData.kyc_status === 'approved' || newData.kyc_status === 'verified') {
              toast({
                title: '🎉 KYC Approved!',
                description: 'Your KYC verification has been approved! You can now access all features.',
                duration: 8000,
              });
            } else if (newData.kyc_status === 'rejected') {
              toast({
                title: '❌ KYC Rejected',
                description: 'Your KYC verification was rejected. Please contact support or resubmit documents.',
                variant: 'destructive',
                duration: 8000,
              });
            }

            // Invalidate queries to refetch with new KYC status
            queryClient.invalidateQueries({ queryKey: ['/api/auth/player/me'] });
            queryClient.invalidateQueries({ queryKey: ['player', 'profile'] });
            
            // Force refetch of player data to update UI
            queryClient.refetchQueries({ queryKey: ['/api/auth/player/me'] });
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ [REALTIME KYC] Successfully subscribed to KYC updates');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ [REALTIME KYC] Channel subscription error');
        } else if (status === 'TIMED_OUT') {
          console.error('⏱️ [REALTIME KYC] Channel subscription timed out');
        } else {
          console.log('🔐 [REALTIME KYC] Channel status:', status);
        }
      });

    return () => {
      console.log('🔌 [REALTIME KYC] Unsubscribing from KYC updates');
      supabase.removeChannel(channel);
    };
  }, [playerId, queryClient, toast]);
}







