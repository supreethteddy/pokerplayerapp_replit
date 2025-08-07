import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  kycStatus: string;
  balance: string;
  realBalance: string;
  creditBalance: string;
  creditLimit: string;
  creditApproved: boolean;
  totalBalance: string;
  totalDeposits: string;
  totalWithdrawals: string;
  totalWinnings: string;
  totalLosses: string;
  gamesPlayed: number;
  hoursPlayed: string;
  clerkUserId?: string;
  isClerkSynced?: boolean;
}

export function useEnhancedAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Check current session
    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email || 'No user');
        
        if (session?.user) {
          await fetchUserData(session.user.id);
        } else {
          setUser(null);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const checkSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Initial session check:', session?.user?.email || 'No user');
      
      if (session?.user) {
        await fetchUserData(session.user.id);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Session check error:', error);
      setLoading(false);
    }
  };

  const fetchUserData = async (supabaseUserId: string) => {
    try {
      const response = await fetch(`/api/players/supabase/${supabaseUserId}`, {
        credentials: 'include',
        cache: 'no-cache',
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          console.log('Player not found - signing out');
          await supabase.auth.signOut();
          setUser(null);
          setLoading(false);
          return;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const userData = await response.json();
      
      // Enhanced user data with dual balance system
      const enhancedUserData: AuthUser = {
        ...userData,
        realBalance: userData.balance || '0.00',
        creditBalance: userData.currentCredit || '0.00',
        creditLimit: userData.creditLimit || '0.00',
        creditApproved: userData.creditApproved || false,
        totalBalance: (parseFloat(userData.balance || '0.00') + parseFloat(userData.currentCredit || '0.00')).toFixed(2),
        isClerkSynced: !!userData.clerkUserId
      };
      
      console.log('User data fetched:', enhancedUserData.email, 'Clerk synced:', enhancedUserData.isClerkSynced);
      setUser(enhancedUserData);
      setLoading(false);
      
      // Auto-sync with Clerk if not already synced (behind the scenes)
      if (!enhancedUserData.isClerkSynced && enhancedUserData.email) {
        syncWithClerk(enhancedUserData);
      }
      
    } catch (error: any) {
      console.error('Fetch error:', error);
      setLoading(false);
    }
  };

  const syncWithClerk = async (userData: AuthUser) => {
    try {
      console.log('🔗 [BACKGROUND SYNC] Syncing user with Clerk:', userData.email);
      
      const response = await fetch('/api/auth/clerk-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clerkUserId: `supabase_${userData.id}`, // Generate unique Clerk ID
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          phone: userData.phone,
          emailVerified: userData.kycStatus === 'verified'
        }),
      });

      if (response.ok) {
        console.log('✅ [BACKGROUND SYNC] User synced with Clerk');
        // Update user state to reflect Clerk sync
        setUser(prev => prev ? { ...prev, isClerkSynced: true } : null);
      }
    } catch (error) {
      console.error('❌ [BACKGROUND SYNC] Clerk sync error:', error);
      // Don't show error to user - this is background sync
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;
      
      if (data.user) {
        // Set session storage flag for loading screen
        sessionStorage.setItem('just_signed_in', 'true');
        
        toast({
          title: "Welcome back!",
          description: "Successfully signed in to your account.",
        });
        
        return { success: true };
      }
      
      throw new Error('Sign in failed');
    } catch (error: any) {
      setLoading(false);
      toast({
        title: "Sign In Failed",
        description: error.message || "Please check your credentials and try again.",
        variant: "destructive",
      });
      return { success: false, error: error.message };
    }
  };

  const signUp = async (email: string, password: string, firstName: string, lastName: string, phone: string) => {
    try {
      setLoading(true);
      
      // First create the Supabase auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });
      
      if (authError) throw authError;
      
      if (!authData.user) {
        throw new Error('Failed to create account');
      }
      
      // Create player record
      const response = await fetch('/api/players', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          firstName,
          lastName,
          phone,
          supabaseUserId: authData.user.id,
          password, // This will be hashed on the server
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create player profile');
      }
      
      const playerData = await response.json();
      
      // Background sync with Clerk
      syncWithClerk({
        ...playerData,
        isClerkSynced: false
      });
      
      toast({
        title: "Account Created!",
        description: "Please check your email to verify your account.",
      });
      
      return { success: true };
    } catch (error: any) {
      setLoading(false);
      toast({
        title: "Sign Up Failed",
        description: error.message || "Failed to create account. Please try again.",
        variant: "destructive",
      });
      return { success: false, error: error.message };
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      setUser(null);
      
      toast({
        title: "Signed Out",
        description: "You have been signed out successfully",
      });
    } catch (error: any) {
      console.error('Sign out error:', error);
      toast({
        title: "Sign Out Failed",
        description: error.message || "Failed to sign out",
        variant: "destructive",
      });
    }
  };

  return {
    user,
    loading,
    signIn,
    signUp,
    signOut,
  };
}