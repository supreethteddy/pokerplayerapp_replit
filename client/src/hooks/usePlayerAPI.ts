/**
 * React hooks for Player API integration
 * Uses React Query for data fetching, caching, and state management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from './use-toast';
import {
  playerAuthService,
  playerBalanceService,
  waitlistService,
  tablesService,
  creditRequestService,
  playerStatsService,
  fnbService,
  type PlayerLoginDto,
  type PlayerSignupDto,
  type UpdatePlayerProfileDto,
  type ChangePlayerPasswordDto,
  type JoinWaitlistDto,
  type RequestCreditDto,
  type CreateFNBOrderDto,
  type UpdateFNBOrderDto,
} from '@/lib/api';

/**
 * Query keys for React Query
 */
export const QUERY_KEYS = {
  playerProfile: ['player', 'profile'],
  playerBalance: ['player', 'balance'],
  playerTransactions: (limit?: number, offset?: number) => ['player', 'transactions', limit, offset],
  playerStats: ['player', 'stats'],
  waitlistStatus: ['waitlist', 'status'],
  availableTables: ['tables', 'available'],
  tableDetails: (tableId: string) => ['tables', 'details', tableId],
  fnbMenu: ['fnb', 'menu'],
  fnbOrders: ['fnb', 'orders'],
} as const;

// ============================================================================
// Authentication Hooks
// ============================================================================

/**
 * Hook for player login
 */
export function usePlayerLogin() {
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: (credentials: PlayerLoginDto) => playerAuthService.login(credentials),
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: 'Welcome back!',
          description: 'You have successfully logged in.',
          className: 'bg-green-600 text-white',
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Login failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook for player signup
 */
export function usePlayerSignup() {
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: (signupData: PlayerSignupDto) => playerAuthService.signup(signupData),
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: 'Account created!',
          description: 'Welcome to the club!',
          className: 'bg-green-600 text-white',
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Signup failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook to get player profile
 */
export function usePlayerProfile() {
  return useQuery({
    queryKey: QUERY_KEYS.playerProfile,
    queryFn: () => playerAuthService.getProfile(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to update player profile
 */
export function useUpdatePlayerProfile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: (profileData: UpdatePlayerProfileDto) => 
      playerAuthService.updateProfile(profileData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.playerProfile });
      toast({
        title: 'Profile updated',
        description: 'Your profile has been successfully updated.',
        className: 'bg-green-600 text-white',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Update failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook to change player password
 */
export function useChangePlayerPassword() {
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: (passwordData: ChangePlayerPasswordDto) => 
      playerAuthService.changePassword(passwordData),
    onSuccess: () => {
      toast({
        title: 'Password changed',
        description: 'Your password has been successfully changed.',
        className: 'bg-green-600 text-white',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Password change failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// ============================================================================
// Balance and Transaction Hooks
// ============================================================================

/**
 * Hook to get player balance
 * Note: Use useRealtimeBalance() hook in your component for real-time updates
 */
export function usePlayerBalance() {
  return useQuery({
    queryKey: QUERY_KEYS.playerBalance,
    queryFn: () => playerBalanceService.getBalance(),
    staleTime: 30 * 1000, // 30 seconds
    // No refetchInterval - use Supabase Realtime instead!
  });
}

/**
 * Hook to get player transactions
 */
export function usePlayerTransactions(limit: number = 50, offset: number = 0) {
  return useQuery({
    queryKey: QUERY_KEYS.playerTransactions(limit, offset),
    queryFn: () => playerBalanceService.getTransactions(limit, offset),
    staleTime: 60 * 1000, // 1 minute
  });
}

// ============================================================================
// Waitlist Hooks
// ============================================================================

/**
 * Hook to join waitlist
 */
export function useJoinWaitlist() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: (data: JoinWaitlistDto) => waitlistService.joinWaitlist(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.waitlistStatus });
      toast({
        title: 'Added to waitlist',
        description: data.message,
        className: 'bg-green-600 text-white',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to join waitlist',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook to get waitlist status
 * Note: Use useRealtimeWaitlist() hook in your component for real-time updates
 */
export function useWaitlistStatus() {
  return useQuery({
    queryKey: QUERY_KEYS.waitlistStatus,
    queryFn: () => waitlistService.getWaitlistStatus(),
    staleTime: 30 * 1000, // 30 seconds
    // No refetchInterval - use Supabase Realtime instead!
  });
}

/**
 * Hook to cancel waitlist entry
 */
export function useCancelWaitlist() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: (entryId: string) => waitlistService.cancelWaitlist(entryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.waitlistStatus });
      toast({
        title: 'Removed from waitlist',
        description: 'You have been removed from the waitlist.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to cancel',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// ============================================================================
// Table Hooks
// ============================================================================

/**
 * Hook to get available tables
 * Note: Use useRealtimeTables() hook in your component for real-time updates
 */
export function useAvailableTables() {
  return useQuery({
    queryKey: QUERY_KEYS.availableTables,
    queryFn: () => tablesService.getAvailableTables(),
    staleTime: 30 * 1000, // 30 seconds
    // No refetchInterval - use Supabase Realtime instead!
  });
}

/**
 * Hook to get table details
 */
export function useTableDetails(tableId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.tableDetails(tableId),
    queryFn: () => tablesService.getTableDetails(tableId),
    enabled: !!tableId,
    staleTime: 30 * 1000, // 30 seconds
  });
}

// ============================================================================
// Credit Request Hooks
// ============================================================================

/**
 * Hook to request credit
 */
export function useRequestCredit() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: (data: RequestCreditDto) => creditRequestService.requestCredit(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.playerBalance });
      toast({
        title: 'Credit requested',
        description: data.message,
        className: 'bg-green-600 text-white',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Credit request failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// ============================================================================
// Stats Hooks
// ============================================================================

/**
 * Hook to get player stats
 */
export function usePlayerStats() {
  return useQuery({
    queryKey: QUERY_KEYS.playerStats,
    queryFn: () => playerStatsService.getPlayerStats(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// ============================================================================
// Food & Beverage Hooks
// ============================================================================

/**
 * Hook to get F&B menu
 */
export function useFNBMenu() {
  return useQuery({
    queryKey: QUERY_KEYS.fnbMenu,
    queryFn: () => fnbService.getMenu(),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Hook to create F&B order
 */
export function useCreateFNBOrder() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: (orderData: CreateFNBOrderDto) => fnbService.createOrder(orderData),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.fnbOrders });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.playerBalance });
      toast({
        title: 'Order placed',
        description: data.message,
        className: 'bg-green-600 text-white',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Order failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook to get F&B orders
 */
export function useFNBOrders() {
  return useQuery({
    queryKey: QUERY_KEYS.fnbOrders,
    queryFn: () => fnbService.getOrders(),
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
  });
}

/**
 * Hook to update F&B order
 */
export function useUpdateFNBOrder() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: ({ orderId, updateData }: { orderId: string; updateData: UpdateFNBOrderDto }) => 
      fnbService.updateOrder(orderId, updateData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.fnbOrders });
      toast({
        title: 'Order updated',
        description: 'Your order has been updated.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Update failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook to cancel F&B order
 */
export function useCancelFNBOrder() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: (orderId: string) => fnbService.cancelOrder(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.fnbOrders });
      toast({
        title: 'Order cancelled',
        description: 'Your order has been cancelled.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Cancellation failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}










