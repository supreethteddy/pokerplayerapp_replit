import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { useToast } from '@/hooks/use-toast';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3333/api';
const websocketBase = API_BASE_URL.endsWith('/api')
  ? API_BASE_URL.slice(0, -4)
  : API_BASE_URL.replace(/\/$/, '');

export function useRealtimeKycStatus(playerId: number | string | null | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (!playerId) return;

    console.log('🔐 [SOCKET KYC] Subscribing to KYC status updates for player:', playerId);

    const token = localStorage.getItem('auth_token') || localStorage.getItem('playerToken');
    const socket = io(`${websocketBase}/realtime`, {
      auth: { playerId: String(playerId), token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: Infinity,
    });

    socket.on('kyc:status-changed', (data: any) => {
      if (!data?.playerId || String(data.playerId) !== String(playerId)) return;

      const kycStatus: string = data.kycStatus || '';
      console.log('🔐 [SOCKET KYC] Status changed:', kycStatus);

      if (kycStatus === 'approved' || kycStatus === 'verified') {
        toast({
          title: '🎉 KYC Approved!',
          description: 'Your KYC verification has been approved! You can now access all features.',
          duration: 8000,
        });
      } else if (kycStatus === 'rejected') {
        toast({
          title: '❌ KYC Rejected',
          description: 'Your KYC verification was rejected. Please contact support or resubmit documents.',
          variant: 'destructive',
          duration: 8000,
        });
      }

      queryClient.invalidateQueries({ queryKey: ['/api/auth/player/me'] });
      queryClient.invalidateQueries({ queryKey: ['player', 'profile'] });
      queryClient.refetchQueries({ queryKey: ['/api/auth/player/me'] });
    });

    socket.on('connect', () => {
      console.log('✅ [SOCKET KYC] Connected');
    });

    return () => {
      console.log('🔌 [SOCKET KYC] Disconnecting');
      socket.disconnect();
    };
  }, [playerId, queryClient, toast]);
}
