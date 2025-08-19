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
  balance: string; // Real cash balance
  realBalance: string; // Real cash balance (same as balance)
  creditBalance: string; // Credit balance from cashier
  creditLimit: string; // Maximum credit allowed
  creditApproved: boolean; // Whether credit is approved
  totalBalance: string; // Real + Credit combined
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

    // Extended timeout - 5 seconds for reliable Supabase connection
    const forceTimeout = setTimeout(() => {
      if (mounted) {
        console.log('🕐 [AUTH] Force timeout - ending loading state');
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
    console.log('🔍 [AUTH] Fetching user data for:', supabaseUserId);
    
    try {
      // Extended timeout for reliable Supabase connection
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        console.log('⏰ [AUTH] Request timeout after 8 seconds - increasing timeout for better reliability');
      }, 8000);
      
      const response = await fetch(`/api/players/supabase/${supabaseUserId}`, {
        signal: controller.signal,
        credentials: 'include',
        cache: 'no-cache',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        if (response.status === 401) {
          console.log('🚫 [AUTH] Unauthorized - redirecting to login');
          setUser(null);
          setLoading(false);
          return;
        }
        if (response.status === 404) {
          console.log('🚫 [AUTH] Player not found - signing out');
          await supabase.auth.signOut();
          setUser(null);
          setLoading(false);
          return;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const userData = await response.json();
      console.log('✅ [AUTH] User data fetched:', userData.email, `(ID: ${userData.id})`);
      
      // Enhanced user data with dual balance system
      const enhancedUserData = {
        ...userData,
        realBalance: userData.balance || '0.00',
        creditBalance: userData.currentCredit || '0.00',
        creditLimit: userData.creditLimit || '0.00',
        creditApproved: userData.creditApproved || false,
        totalBalance: (parseFloat(userData.balance || '0.00') + parseFloat(userData.currentCredit || '0.00')).toFixed(2)
      };
      
      console.log('🎉 [AUTH] User data prepared:', enhancedUserData);
      setUser(enhancedUserData);
      setLoading(false);
      console.log('✅ [AUTH] Authentication complete - Player ID:', userData.id);
      
    } catch (error: any) {
      console.error('❌ [AUTH] Fetch error:', error);
      
      // Handle specific error types with proper state management
      if (error.name === 'AbortError') {
        console.log('⏰ [AUTH] Request timeout - keeping existing session state');
        // On timeout, stop loading but keep user authenticated if session exists
        setLoading(false);
        return; // Don't continue to other error handling
      } else if (error.message?.includes('404')) {
        console.log('🚫 [AUTH] Player not found - signing out');
        await supabase.auth.signOut();
        setUser(null);
        setLoading(false);
      } else {
        // Network errors - keep trying but stop loading, DON'T clear user state
        console.log('🔄 [AUTH] Network error - stopping loading state but keeping user session');
        setLoading(false);
        // Keep existing user state intact on network errors
      }
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
        clerkUserId: '', // Will be set when Clerk integration is activated
      };

      const playerResponse = await apiRequest('POST', '/api/players', playerData);
      
      if (!playerResponse.ok) {
        const errorData = await playerResponse.json();
        throw new Error(errorData.error || 'Failed to create player account');
      }
      
      const createdPlayer = await playerResponse.json();

      // Player preferences are now created automatically during player creation
      // No need to create them separately

      toast({
        title: "Account Created Successfully",
        description: "Please complete KYC verification to access your account.",
      });

      // Keep existing flow - don't redirect automatically

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
    console.log('🔐 [ULTRA-FAST AUTH] Signing in:', email);
    setLoading(true);
    
    try {
      // Use our backend authentication endpoint that handles all security gates
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('❌ [ULTRA-FAST AUTH] Backend sign in error:', data);
        setLoading(false);
        
        // Handle specific error cases from backend
        let title = "Sign In Failed";
        let description = data.message || data.error || "Invalid credentials";
        
        if (data.error === "EMAIL_VERIFICATION_REQUIRED") {
          title = "Email Not Verified";
          description = "Please verify your email address before logging in. Check your inbox for verification link.";
        } else if (data.error === "KYC_VERIFICATION_REQUIRED") {
          title = "KYC Approval Required";
          description = "Your KYC documents are being reviewed by our team. Please wait for approval.";
        }
        
        toast({
          title,
          description,
          variant: "destructive",
        });
        return { success: false };
      }

      console.log('✅ [ULTRA-FAST AUTH] Backend authentication successful');
      
      // Now sign in with Supabase using the returned auth token
      if (data.user && data.user.supabaseId) {
        // For users with existing Supabase auth, sign them in
        try {
          const { error: supabaseError } = await supabase.auth.signInWithPassword({
            email,
            password
          });
          
          if (supabaseError && !supabaseError.message.includes('email_not_confirmed')) {
            console.warn('🔄 [ULTRA-FAST AUTH] Supabase sign-in issue, using direct auth:', supabaseError.message);
          }
        } catch (supabaseError) {
          console.warn('🔄 [ULTRA-FAST AUTH] Supabase auth warning (continuing with direct auth):', supabaseError);
        }
        
        // Set user data directly from backend response
        const enhancedUserData = {
          ...data.user,
          realBalance: data.user.balance || '0.00',
          creditBalance: data.user.creditBalance || '0.00',
          creditLimit: data.user.creditLimit || '0.00',
          creditApproved: data.user.creditApproved || false,
          totalBalance: data.user.totalBalance || '0.00'
        };
        
        console.log('🎉 [ULTRA-FAST AUTH] User data set:', enhancedUserData);
        setUser(enhancedUserData);
        
        // Set session storage flag to trigger loading screen
        sessionStorage.setItem('just_signed_in', 'true');
        
        setLoading(false);
        console.log('✅ [ULTRA-FAST AUTH] Authentication complete - Player ID:', data.user.id);
        
        toast({
          title: "Welcome Back",
          description: "Successfully signed in",
        });

        return { success: true };
      } else {
        throw new Error('Invalid user data received');
      }

    } catch (error: any) {
      setLoading(false);
      console.error('Auth error:', error);
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
