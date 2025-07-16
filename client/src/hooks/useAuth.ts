import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  kycStatus: string;
  balance: string;
  totalDeposits: string;
  totalWithdrawals: string;
  totalWinnings: string;
  totalLosses: string;
  gamesPlayed: number;
  hoursPlayed: string;
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [signupCooldown, setSignupCooldown] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    let mounted = true;

    // Force loading to false after 5 seconds to prevent infinite loading
    const forceTimeout = setTimeout(() => {
      if (mounted) {
        console.log('Force timeout - ending loading state');
        setLoading(false);
      }
    }, 5000);

    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      
      console.log('Initial session check:', session?.user ? 'User found' : 'No user');
      if (session?.user) {
        fetchUserData(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      
      console.log('Auth state changed:', event, session?.user ? 'User present' : 'No user');
      
      try {
        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
          await fetchUserData(session.user.id);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          queryClient.clear();
          setLoading(false);
        } else if (event === 'INITIAL_SESSION' && !session?.user) {
          setLoading(false);
        }
      } catch (error) {
        console.error('Error in auth state change handler:', error);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearTimeout(forceTimeout);
    };
  }, []);

  const fetchUserData = async (supabaseUserId: string) => {
    console.log('Starting fetchUserData for:', supabaseUserId);
    
    // Set loading state if not already set
    if (!loading) {
      setLoading(true);
    }
    
    try {
      // Fetch player data using Supabase ID with shorter timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`/api/players/supabase/${supabaseUserId}`, {
        signal: controller.signal,
        credentials: 'include',
        cache: 'no-cache'
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        if (response.status === 401) {
          // Handle unauthorized gracefully during authentication
          console.log('Unauthorized during authentication, this is normal');
          return;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const userData = await response.json();
      console.log('User data fetched successfully:', userData);
      setUser(userData);
      console.log('User state updated, current loading state:', loading);
    } catch (error) {
      console.error('Error fetching user data:', error);
      
      // Handle different error types
      if (error?.name === 'AbortError') {
        console.log('Fetch aborted due to timeout');
      } else if (error?.message && error.message.includes('404')) {
        console.log('Player not found in database, signing out');
        try {
          await supabase.auth.signOut();
        } catch (signOutError) {
          console.error('Error signing out:', signOutError);
        }
      } else if (error?.name === 'AbortError') {
        console.log('Fetch aborted due to timeout');
        // Don't show toast for timeout, just set loading to false
        setLoading(false);
      } else {
        toast({
          title: "Authentication Error",
          description: "Failed to fetch user data. Please sign in again.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, firstName: string, lastName: string, phone: string) => {
    if (signupCooldown) {
      toast({
        title: "Rate Limited",
        description: "Please wait 60 seconds between signup attempts",
        variant: "destructive",
      });
      return { success: false };
    }

    try {
      setSignupCooldown(true);
      setTimeout(() => setSignupCooldown(false), 60000);

      // Create Supabase auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        // Handle specific Supabase auth errors
        if (authError.message.includes('already registered')) {
          throw new Error('This email is already registered. Please sign in instead.');
        }
        throw authError;
      }

      // Create player record with Supabase ID
      const playerData = {
        email,
        password, // In production, this should be hashed
        firstName,
        lastName,
        phone,
        supabaseId: authData.user?.id, // Link to Supabase auth user
      };

      const playerResponse = await apiRequest('POST', '/api/players', playerData);
      
      if (!playerResponse.ok) {
        const errorData = await playerResponse.json();
        throw new Error(errorData.error || 'Failed to create player account');
      }
      
      const createdPlayer = await playerResponse.json();

      // Create default player preferences using the created player's ID
      await apiRequest('POST', '/api/player-prefs', {
        playerId: createdPlayer.id,
      });

      toast({
        title: "Account Created",
        description: "Please complete KYC verification to continue",
      });

      return { success: true };
    } catch (error: any) {
      console.error('Signup error:', error);
      
      // Handle specific error cases
      let errorMessage = "Failed to create account";
      if (error.message) {
        errorMessage = error.message;
      } else if (error.error) {
        errorMessage = error.error;
      }
      
      // Clear signup cooldown on error
      setSignupCooldown(false);
      
      toast({
        title: "Signup Failed",
        description: errorMessage,
        variant: "destructive",
      });
      return { success: false };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // Handle specific error cases
        if (error.message.includes('email_not_confirmed')) {
          toast({
            title: "Email Not Confirmed",
            description: "Please check your email and click the confirmation link",
            variant: "destructive",
          });
          return { success: false };
        }
        throw error;
      }

      toast({
        title: "Welcome Back",
        description: "Successfully signed in",
      });

      return { success: true };
    } catch (error: any) {
      console.error('Signin error:', error);
      toast({
        title: "Sign In Failed",
        description: error.message || "Invalid credentials",
        variant: "destructive",
      });
      return { success: false };
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      toast({
        title: "Signed Out",
        description: "You have been signed out successfully",
      });
    } catch (error: any) {
      console.error('Signout error:', error);
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
    signupCooldown,
    signUp,
    signIn,
    signOut,
  };
}
