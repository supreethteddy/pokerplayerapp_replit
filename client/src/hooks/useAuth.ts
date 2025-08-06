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
    
    try {
      // Use a shorter timeout and immediate loading state fix
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // Reduced timeout
      
      const response = await fetch(`/api/players/supabase/${supabaseUserId}`, {
        signal: controller.signal,
        credentials: 'include',
        cache: 'no-cache'
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        if (response.status === 401) {
          console.log('Unauthorized during authentication, this is normal');
          setLoading(false);
          return;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const userData = await response.json();
      console.log('User data fetched successfully:', userData);
      setUser(userData);
      setLoading(false); // Immediately set loading to false
      console.log('✅ Authentication complete - user logged in:', userData.firstName, userData.lastName);
    } catch (error) {
      console.error('Error fetching user data:', error);
      
      // Handle different error types gracefully
      if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
        console.log('Fetch aborted due to timeout');
      } else if (error && typeof error === 'object' && 'message' in error && 
                 typeof error.message === 'string' && error.message.includes('404')) {
        console.log('Player not found in database, signing out');
        await supabase.auth.signOut();
      }
      
      setLoading(false);
    }
  };

  const signUp = async (emailOrPhone: string, password: string, firstName: string, lastName: string, phone: string) => {
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

      // Determine if input is email or phone
      const isEmail = emailOrPhone.includes('@');
      const email = isEmail ? emailOrPhone : `${phone}@placeholder.com`; // Temporary email for phone users
      
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
        email: isEmail ? emailOrPhone : '', // Use actual email if provided, empty if phone
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

  const signIn = async (identifier: string, password: string) => {
    try {
      // Check if identifier is email or phone
      const isEmail = identifier.includes('@');
      
      let authResult;
      if (isEmail) {
        authResult = await supabase.auth.signInWithPassword({
          email: identifier,
          password,
        });
      } else {
        // For phone authentication, we need to find the user by phone first
        // Then use their email for authentication
        const { data: players, error: findError } = await supabase
          .from('players')
          .select('email')
          .eq('phone', identifier)
          .single();
          
        if (findError || !players?.email) {
          throw new Error('Phone number not found. Please check your number or sign up.');
        }
        
        authResult = await supabase.auth.signInWithPassword({
          email: players.email,
          password,
        });
      }
      
      const { error } = authResult;

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

      // Set session storage flag to trigger loading screen
      sessionStorage.setItem('just_signed_in', 'true');
      
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
