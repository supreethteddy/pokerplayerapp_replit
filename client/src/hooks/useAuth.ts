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
  clubId: string; // Player's club ID - REQUIRED for all API calls
  clubCode: string; // Player's club code
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
    console.log('🔍 [PLAYER AUTH] Loading player data after Supabase auth:', supabaseUserId);
    
    try {
      // Get stored clubId and playerId from localStorage
      const storedPlayerId = localStorage.getItem('playerId');
      const storedClubId = localStorage.getItem('clubId');
      
      if (!storedPlayerId || !storedClubId) {
        console.log('⚠️  [PLAYER AUTH] Missing session data - user needs to login');
        setUser(null);
        setLoading(false);
        return;
      }
      
      // Fetch player profile using correct endpoint
      const response = await fetch('/api/auth/player/me', {
        credentials: 'include',
        cache: 'no-cache',
        headers: {
          'Content-Type': 'application/json',
          'x-player-id': storedPlayerId,
          'x-club-id': storedClubId
        }
      });
      
      if (!response.ok) {
        if (response.status === 401 || response.status === 404) {
          console.log('🚫 [PLAYER AUTH] Session invalid - clearing and redirecting to login');
          localStorage.removeItem('playerId');
          localStorage.removeItem('clubId');
          localStorage.removeItem('clubCode');
          await supabase.auth.signOut();
          setUser(null);
          setLoading(false);
          return;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('✅ [PLAYER AUTH] Profile loaded:', data);
      
      if (!data.player || !data.club) {
        throw new Error('Invalid profile data');
      }
      
      // Set user data with clubId
      const enhancedUserData = {
        id: data.player.id,
        email: data.player.email,
        firstName: data.player.name?.split(' ')[0] || data.player.email.split('@')[0],
        lastName: data.player.name?.split(' ').slice(1).join(' ') || '',
        phone: data.player.phoneNumber || '',
        clubId: data.club.id,
        clubCode: data.club.code || localStorage.getItem('clubCode') || '',
        kycStatus: data.player.kycStatus,
        balance: '0.00',
        realBalance: '0.00',
        creditBalance: '0.00',
        creditLimit: '0.00',
        creditApproved: false,
        totalBalance: '0.00',
        totalDeposits: '0.00',
        totalWithdrawals: '0.00',
        totalWinnings: '0.00',
        totalLosses: '0.00',
        gamesPlayed: 0,
        hoursPlayed: '0'
      };
      
      console.log('🎉 [PLAYER AUTH] User session restored with clubId:', enhancedUserData.clubId);
      setUser(enhancedUserData);
      setLoading(false);
      
    } catch (error: any) {
      console.error('❌ [PLAYER AUTH] Error loading profile:', error);
      // Clear session on error
      localStorage.removeItem('playerId');
      localStorage.removeItem('clubId');
      localStorage.removeItem('clubCode');
        setUser(null);
        setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, firstName: string, lastName: string, phone: string) => {
    console.log('📝 [ULTRA-FAST AUTH] Signing up:', email);
    
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

      // Use our backend automation signup endpoint with whitelabeling system
      const response = await fetch('/api/auth/signup-automation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          email,
          password,
          first_name: firstName,
          last_name: lastName,
          phone,
          nickname: `${firstName}${Math.floor(Math.random() * 1000)}`, // Generate simple nickname
          clerk_user_id: `user_${email.replace('@', '_').replace('.', '_')}_${Date.now()}`
        })
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('❌ [ULTRA-FAST AUTH] Backend signup error:', data);
        throw new Error(data.error || data.message || 'Failed to create account');
      }

      console.log('✅ [BACKEND AUTOMATION] Signup successful:', email);

      // Handle backend automation response structure
      if (data.success && data.player) {
        toast({
          title: "Account Created Successfully!",
          description: `Welcome ${data.player.first_name}! Player Code: ${data.player.player_code}`,
        });
        
        // Store player data for KYC workflow
        sessionStorage.setItem('kyc_redirect', JSON.stringify({
          id: data.player.id,
          playerId: data.player.id,
          email: data.player.email,
          firstName: data.player.first_name,
          lastName: data.player.last_name,
          playerCode: data.player.player_code,
          kycStatus: 'pending'
        }));
      } else {
        toast({
          title: "Account Created!",
          description: "Please complete your verification process.",
        });
      }

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

  const signIn = async (email: string, password: string, clubCode: string) => {
    console.log('🔐 [PLAYER AUTH] Signing in:', email, 'Club:', clubCode);
    setLoading(true);
    
    try {
      // Use correct player login endpoint that requires clubCode
      const response = await fetch('/api/auth/player/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ clubCode, email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('❌ [PLAYER AUTH] Backend sign in error:', data);
        setLoading(false);
        
        // Handle specific error cases from backend
        let title = "Sign In Failed";
        let description = data.message || data.error || "Invalid credentials";
        
        if (data.message?.includes('Invalid club code')) {
          title = "Invalid Club Code";
          description = "Please check your club code and try again.";
        } else if (data.error === "EMAIL_VERIFICATION_REQUIRED") {
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

      console.log('✅ [PLAYER AUTH] Backend authentication successful', data);
      
      // Check if response has proper structure
      if (!data.player || !data.club) {
        console.error('❌ [PLAYER AUTH] Invalid response structure:', data);
        throw new Error('Invalid response from server');
      }

      const { player, club } = data;
      
      // STRICT KYC verification - block ALL non-approved statuses
      if (player.kycStatus !== 'approved') {
        console.log('🚫 [PLAYER AUTH] KYC not approved - blocking login:', player.kycStatus);
        setLoading(false);
        
        let statusMessage;
        switch (player.kycStatus) {
          case 'pending':
            statusMessage = "Wait for KYC approval";
            break;
          case 'submitted':
            statusMessage = "Wait for KYC approval";
            break;
          case 'rejected':
            statusMessage = "Your KYC documents were rejected. Please contact support for assistance.";
            break;
          case 'incomplete':
            statusMessage = "Please complete your KYC verification process.";
            break;
          default:
            statusMessage = "Wait for KYC approval";
        }
        
        toast({
          title: "Access Denied",
          description: statusMessage,
          variant: "destructive",
        });
        
        setUser(null);
        return { success: false };
      }
      
      // ✅ CRITICAL: Store clubId and clubCode in localStorage for all API calls
      localStorage.setItem('playerId', player.id);
      localStorage.setItem('clubId', club.id);
      localStorage.setItem('clubCode', club.code || clubCode);
      
      console.log('✅ [PLAYER AUTH] Stored session data:', {
        playerId: player.id,
        clubId: club.id,
        clubCode: club.code || clubCode
      });
      
      // Try to sign in with Supabase if player has supabaseId
      if (player.supabaseId) {
        try {
          const { error: supabaseError } = await supabase.auth.signInWithPassword({
            email,
            password
          });
          
          if (supabaseError && !supabaseError.message.includes('email_not_confirmed')) {
            console.warn('🔄 [PLAYER AUTH] Supabase sign-in issue, using direct auth:', supabaseError.message);
          }
        } catch (supabaseError) {
          console.warn('🔄 [PLAYER AUTH] Supabase auth warning (continuing with direct auth):', supabaseError);
        }
        }
        
      // Set user data with clubId and clubCode
        const enhancedUserData = {
        id: player.id,
        email: player.email,
        firstName: player.name?.split(' ')[0] || player.email.split('@')[0],
        lastName: player.name?.split(' ').slice(1).join(' ') || '',
        phone: player.phoneNumber || '',
        clubId: club.id, // ← CRITICAL: clubId from backend
        clubCode: club.code || clubCode, // ← CRITICAL: clubCode
        kycStatus: player.kycStatus,
        balance: '0.00', // Will be loaded separately
        realBalance: '0.00',
        creditBalance: '0.00',
        creditLimit: '0.00',
        creditApproved: false,
        totalBalance: '0.00',
        totalDeposits: '0.00',
        totalWithdrawals: '0.00',
        totalWinnings: '0.00',
        totalLosses: '0.00',
        gamesPlayed: 0,
        hoursPlayed: '0'
        };
        
      console.log('🎉 [PLAYER AUTH] User data set with clubId:', enhancedUserData);
        setUser(enhancedUserData);
        
        // Set session storage flag to trigger loading screen
        sessionStorage.setItem('just_signed_in', 'true');
        
        setLoading(false);
      console.log('✅ [PLAYER AUTH] Authentication complete - Player ID:', player.id, 'Club ID:', club.id);
        
        toast({
          title: "Welcome Back",
        description: `Signed in to ${club.name}`,
        });

        return { success: true };

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
