import { useUser, useAuth } from '@clerk/clerk-react';
import { useState, useEffect } from 'react';

interface UserData {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  kycStatus?: string;
  balance?: string;
  realBalance?: string;
  creditBalance?: string;
  creditLimit?: string;
  creditApproved?: boolean;
  totalBalance?: string;
  clerkUserId?: string;
  isClerkSynced?: boolean;
}

export function useClerkSupabaseAuth() {
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  const { isSignedIn } = useAuth();
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    async function syncWithSupabase() {
      if (!clerkLoaded) return;
      
      setLoading(true);
      setSyncError(null);

      try {
        if (isSignedIn && clerkUser) {
          console.log('⚡ [CLERK-SUPABASE AUTH] Syncing user:', clerkUser.primaryEmailAddress?.emailAddress);

          // Sync Clerk user with Supabase database
          const response = await fetch('/api/auth/clerk-user-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clerkUserId: clerkUser.id,
              email: clerkUser.primaryEmailAddress?.emailAddress,
              firstName: clerkUser.firstName || '',
              lastName: clerkUser.lastName || '',
              phone: clerkUser.primaryPhoneNumber?.phoneNumber || '',
              emailVerified: clerkUser.primaryEmailAddress?.verification?.status === 'verified'
            })
          });

          if (response.ok) {
            const userData = await response.json();
            setUser(userData);
            console.log('✅ [CLERK-SUPABASE AUTH] User synced successfully:', userData.email);
          } else {
            const error = await response.text();
            console.error('❌ [CLERK-SUPABASE AUTH] Sync failed:', error);
            setSyncError(error);
            setUser(null);
          }
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('❌ [CLERK-SUPABASE AUTH] Sync error:', error);
        setSyncError(error instanceof Error ? error.message : 'Authentication sync failed');
        setUser(null);
      } finally {
        setLoading(false);
        setAuthChecked(true);
      }
    }

    syncWithSupabase();
  }, [clerkLoaded, isSignedIn, clerkUser?.id]);

  return {
    user,
    loading,
    authChecked,
    isAuthenticated: isSignedIn && !!user,
    syncError,
    clerkUser
  };
}