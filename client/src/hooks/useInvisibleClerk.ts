import { useEffect } from 'react';

// Invisible Clerk integration hook
// This hook runs silently in the background to sync user data with Clerk
// DISABLED: Pure Supabase authentication only
export function useInvisibleClerk(user: any) {
  // Completely disabled for pure Supabase authentication
  console.log('🚫 [INVISIBLE CLERK] Disabled - using pure Supabase authentication only');

  // This hook doesn't return anything - it's purely background functionality
  return null;
}