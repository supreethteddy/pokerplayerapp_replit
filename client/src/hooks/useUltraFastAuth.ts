import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
// REMOVED: useInvisibleClerk for pure Supabase authentication

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string; // Added for full name
  nickname: string; // Added for nickname
  phone: string;
  kycStatus: string;
  balance: string;
  realBalance: string;
  creditBalance: string;
  creditLimit: string;
  creditApproved: boolean;
  totalBalance: string;
  supabaseOnly: boolean;
  player_id?: string; // Added for player ID
}

export interface AuthResult {
  success: boolean;
  error?: string;
  redirectToKYC?: boolean;
  existing?: boolean;
  player?: any;
  playerData?: any;
}

export function useUltraFastAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const { toast } = useToast();
  const syncInProgress = useRef(false);
  const fetchController = useRef<AbortController | null>(null);

  // REMOVED: Invisible Clerk integration for pure Supabase authentication

  useEffect(() => {
    console.log('🚀 [ULTRA-FAST AUTH] Initializing...');

    // Check current session immediately
    checkSessionUltraFast();

    // PURE PLAYERS TABLE AUTH: Disable Supabase auth state listeners
    console.log('🎯 [PURE PLAYERS AUTH] Skipping Supabase auth state listeners - using players table only');
    const subscription = { unsubscribe: () => {} }; // Mock subscription for cleanup

    return () => {
      subscription.unsubscribe();
      if (fetchController.current) {
        fetchController.current.abort();
      }
    };
  }, []);

  const checkSessionUltraFast = async () => {
    try {
      // Check if user is stored in sessionStorage from recent login
      const storedUser = sessionStorage.getItem('authenticated_user');
      const justSignedIn = sessionStorage.getItem('just_signed_in');

      if (storedUser && justSignedIn) {
        try {
          const userData = JSON.parse(storedUser);
          console.log('🔄 [SESSION RESTORE] Restoring user from session:', userData.email);
          setUser(userData);
          setAuthChecked(true);
          setLoading(false);
          return;
        } catch (error) {
          console.error('❌ [SESSION RESTORE] Failed to parse stored user:', error);
          sessionStorage.removeItem('authenticated_user');
          sessionStorage.removeItem('just_signed_in');
        }
      }

      // PURE PLAYERS TABLE AUTH: Skip Supabase auth session checking
      console.log('🎯 [PURE PLAYERS AUTH] Skipping Supabase session check - using players table only');
      setLoading(false);
      setAuthChecked(true);
    } catch (error) {
      console.error('❌ [ULTRA-FAST AUTH] Session check error:', error);
      setLoading(false);
      setAuthChecked(true);
    }
  };

  const fetchUserDataUltraFast = async (supabaseUserId: string) => {
    // Cancel any existing fetch
    if (fetchController.current) {
      fetchController.current.abort();
    }

    fetchController.current = new AbortController();

    try {
      console.log('⚡ [ULTRA-FAST AUTH] Fetching user data for:', supabaseUserId);

      const response = await fetch(`/api/players/supabase/${supabaseUserId}`, {
        credentials: 'include',
        cache: 'no-cache',
        signal: fetchController.current.signal,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.log('🚫 [ULTRA-FAST AUTH] Player not found - signing out');
          await handleSignOut();
          return;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const userData = await response.json();

      // PRODUCTION FIX: Use exact field names from backend response
      const enhancedUserData: AuthUser = {
        ...userData,
        fullName: `${userData.firstName || ''} ${userData.lastName || ''}`.trim(), // Concatenate first and last name
        realBalance: userData.balance || '0.00',
        creditBalance: userData.creditBalance || '0.00', // FIXED: Use correct field name
        creditLimit: userData.creditLimit || '0.00',
        creditApproved: userData.creditApproved || false,
        totalBalance: userData.totalBalance || (parseFloat(userData.balance || '0.00') + parseFloat(userData.creditBalance || '0.00')).toFixed(2),
        isClerkSynced: !!userData.clerkUserId,
        player_id: userData.player_id // Ensure player_id is included
      };

      console.log('✅ [ULTRA-FAST AUTH] User loaded:', enhancedUserData.email, 'ID:', enhancedUserData.id);

      setUser(enhancedUserData);
      setLoading(false);

      // DISABLED: Background Clerk sync removed for pure Supabase auth

    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('❌ [ULTRA-FAST AUTH] Fetch error:', error);
        // Don't let errors prevent the app from loading
        setLoading(false);
        setAuthChecked(true);
      }
    }
  };

  const backgroundClerkSync = async (userData: AuthUser) => {
    if (syncInProgress.current) return;

    syncInProgress.current = true;

    try {
      console.log('🔗 [BACKGROUND CLERK SYNC] Starting for:', userData.email);

      // Fire-and-forget Clerk sync
      fetch('/api/auth/clerk-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clerkUserId: `supabase_${userData.id}`,
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          phone: userData.phone,
          emailVerified: userData.kycStatus === 'verified'
        }),
      }).then(response => {
        if (response.ok) {
          console.log('✅ [BACKGROUND CLERK SYNC] Success for:', userData.email);
          // Update user state silently
          setUser(prev => prev ? { ...prev, isClerkSynced: true } : null);
        }
      }).catch(error => {
        console.warn('⚠️ [BACKGROUND CLERK SYNC] Failed (non-critical):', error.message);
      }).finally(() => {
        syncInProgress.current = false;
      });

    } catch (error) {
      console.warn('⚠️ [BACKGROUND CLERK SYNC] Error (non-critical):', error);
      syncInProgress.current = false;
    }
  };

  const handleSignOut = async () => {
    console.log('🚪 [ULTRA-FAST AUTH] Starting handleSignOut cleanup...');

    // Clear all user data and session info
    setUser(null);
    setLoading(false);
    setAuthChecked(true); // Ensure auth is marked as checked
    syncInProgress.current = false;

    // Clear ALL session storage items that might cause loading loops
    sessionStorage.removeItem('just_signed_in');
    sessionStorage.removeItem('kyc_redirect');
    sessionStorage.removeItem('authenticated_user'); // NEW: Clear stored user data
    sessionStorage.removeItem('welcome_video_played'); // Clear video flag so it plays again on next login
    sessionStorage.removeItem('welcome_video_starting'); // Clear starting flag

    // Clear any local storage items
    localStorage.removeItem('clerk-db-jwt');
    localStorage.removeItem('auth_token');

    console.log('🧹 [ULTRA-FAST AUTH] Session cleanup completed - all auth data cleared');

    // CRITICAL FIX: Force navigation to login screen
    setTimeout(() => {
      console.log('🔄 [ULTRA-FAST AUTH] Forcing navigation to login screen...');
      window.location.href = '/';
    }, 100);
  };

  // Helper to generate sequential player ID
  const generatePlayerId = async (existingPlayerIds: string[]) => {
    // Use simple player ID generation instead of complex whitelabeling config
    const player_id_prefix = 'PLAYER';
    const player_id_number_length = 4;

    let playerId: string;
    let counter = 1;

    while (true) {
      const paddedCounter = String(counter).padStart(player_id_number_length, '0');
      playerId = `${player_id_prefix}-${paddedCounter}`;

      if (!existingPlayerIds.includes(playerId)) {
        return playerId;
      }
      counter++;
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      console.log('🔐 [ULTRA-FAST AUTH] Signing in:', email);

      // PRODUCTION-GRADE INTEGRATED AUTHENTICATION
      // Use our custom backend endpoint that handles both Clerk + Supabase integration
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Authentication failed' }));
        throw new Error(errorData.error || 'Authentication failed');
      }

      const { success, user, message } = await response.json();

      if (!success || !user) {
        throw new Error('Authentication failed');
      }

      console.log('✅ [ULTRA-FAST AUTH] Integrated auth successful:', user.email);

      // Set user data directly from our integrated backend
      const enhancedUserData: AuthUser = {
        ...user,
        fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim(), // Concatenate first and last name
        nickname: user.nickname || '', // Ensure nickname is set
        realBalance: user.balance || '0.00',
        creditBalance: user.creditBalance || '0.00',
        creditLimit: user.creditLimit || '0.00',
        creditApproved: user.creditApproved || false,
        totalBalance: user.totalBalance || '0.00',
        supabaseOnly: true,
        player_id: user.player_id // Ensure player_id is included
      };

      // PURE PLAYERS TABLE AUTH: Skip Supabase auth session creation
      console.log('🎯 [PURE PLAYERS AUTH] Using players table authentication only - skipping Supabase auth');

      // CRITICAL FIX: Force user state update with session persistence
      setUser(enhancedUserData);
      setAuthChecked(true);
      setLoading(false);

      // Store user in sessionStorage for persistence across navigation
      sessionStorage.setItem('authenticated_user', JSON.stringify(enhancedUserData));

      console.log('✅ [DEBUG] User state set:', enhancedUserData);
      console.log('✅ [DEBUG] User ID:', enhancedUserData.id);
      console.log('💾 [SESSION] User stored in sessionStorage for persistence');

      // Force immediate re-render and state verification
      setTimeout(() => {
        console.log('🔍 [DEBUG] Forcing state verification...');
        setUser(enhancedUserData); // Set again to ensure persistence
        console.log('✅ [DEBUG] User state verified and locked in');
      }, 50);

      // Log authentication activity  
      logAuthActivity('login', email, user.supabaseId || user.id);

      // Set session storage flag for loading screen
      sessionStorage.setItem('just_signed_in', 'true');

      toast({
        title: "Welcome back!",
        description: message || "Successfully signed in to your account.",
      });

      // FORCE REDIRECT: If state management fails, force browser redirect
      setTimeout(() => {
        console.log('🚀 [FORCE REDIRECT] Redirecting to dashboard...');
        window.location.href = '/dashboard';
      }, 500);

      return { success: true };

    } catch (error: any) {
      console.error('❌ [ULTRA-FAST AUTH] Sign in error:', error);
      setLoading(false);

      toast({
        title: "Sign In Failed",
        description: error.message || "Please check your credentials and try again.",
        variant: "destructive",
      });

      return { success: false, error: error.message };
    }
  };

  const signUp = async (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    phone: string,
    nickname: string,
  ): Promise<AuthResult> => {
    console.log('📝 [ULTRA-FAST AUTH] SignUp data being sent:', {
      email,
      hasPassword: !!password,
      firstName,
      lastName,
      nickname,
      phone
    });
    try {
      setLoading(true);
      console.log('📝 [ULTRA-FAST AUTH] Signing up:', email);

      // Fetch existing player IDs to ensure uniqueness for new player ID generation
      let existingPlayerIds: string[] = [];
      try {
        const { data: players, error } = await supabase
          .from('players')
          .select('player_id');
        if (error) {
          console.warn('⚠️ [SIGNUP] Could not fetch existing player IDs:', error.message);
        } else if (players) {
          existingPlayerIds = players.map((p: any) => p.player_id).filter(Boolean);
        }
      } catch (fetchError) {
        console.warn('⚠️ [SIGNUP] Error fetching existing player IDs:', fetchError);
      }

      // Generate the new player ID
      const newPlayerId = await generatePlayerId(existingPlayerIds);

      // PRODUCTION-GRADE INTEGRATED SIGNUP
      // Use our custom backend endpoint that handles both Clerk + Supabase integration
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          firstName,
          lastName,
          phone,
          nickname, // This was missing!
          fullName: `${firstName} ${lastName}`.trim(), // Include full name
          player_id: newPlayerId, // Include generated player ID
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Signup failed' }));

        // Handle duplicate email with user-friendly message
        if (response.status === 409 && errorData.code === 'EMAIL_EXISTS') {
          throw new Error('This email is already registered. Please use the login form instead.');
        }

        throw new Error(errorData.error || 'Signup failed');
      }

      const { success, player, existing, redirectToKYC, isFullyVerified, needsEmailVerification, needsKYCUpload, needsKYCApproval, message } = await response.json();

      if (!success) {
        throw new Error('Signup failed');
      }

      console.log('✅ [ULTRA-FAST AUTH] Integrated signup successful:', player?.email);
      console.log('🔍 [ULTRA-FAST AUTH] Signup response:', { existing, isFullyVerified, redirectToKYC, needsEmailVerification, needsKYCUpload, needsKYCApproval });

      // CRITICAL FIX: Only treat as fully verified if isFullyVerified is explicitly true
      if (isFullyVerified && player) {
        console.log('🎯 [ULTRA-FAST AUTH] Fully verified user - redirecting to dashboard');

        // CRITICAL FIX: Create Supabase session for existing user
        try {
          const { data: supabaseAuth, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
          });

          if (error) {
            console.warn('⚠️ [ULTRA-FAST AUTH] Supabase session creation warning:', error.message);
            // Continue anyway as our backend authentication was successful
          } else {
            console.log('✅ [ULTRA-FAST AUTH] Supabase session established for existing user');
          }
        } catch (sessionError) {
          console.warn('⚠️ [ULTRA-FAST AUTH] Supabase session creation failed, continuing:', sessionError);
        }

        // Set user data like a normal sign-in
        const enhancedUserData: AuthUser = {
          ...player,
          fullName: `${player.firstName || ''} ${player.lastName || ''}`.trim(), // Concatenate first and last name
          nickname: player.nickname || '', // Ensure nickname is set
          realBalance: player.balance || '0.00',
          creditBalance: player.creditBalance || '0.00',
          creditLimit: player.creditLimit || '0.00',
          creditApproved: player.creditApproved || false,
          totalBalance: player.totalBalance || '0.00',
          isClerkSynced: true,
          player_id: player.player_id // Ensure player_id is included
        };

        setUser(enhancedUserData);
        setLoading(false);

        // CRITICAL FIX: Set session storage flag for loading screen
        sessionStorage.setItem('just_signed_in', 'true');

        toast({
          title: "Welcome back!",
          description: "Successfully signed in to your account.",
        });

        return {
          success: true,
          existing: true,
          redirectToKYC: false,
          player,
          playerData: player
        };
      }

      // RESTORED DEPLOYED VERSION LOGIC: Check if KYC redirect is needed for any incomplete verification
      if ((redirectToKYC || needsEmailVerification || needsKYCUpload || needsKYCApproval) && player) {
        console.log('🎯 [ULTRA-FAST AUTH] KYC redirect required for player:', player.id);

        // Store KYC redirect data for App.tsx to handle
        const kycData = {
          id: player.id,
          playerId: player.id,
          email: player.email,
          firstName: player.firstName,
          lastName: player.lastName,
          kycStatus: player.kycStatus || 'pending',
          existing: existing || false,
          message: existing ? 'Existing account found - proceeding to KYC' : 'New account created - proceeding to KYC'
        };

        sessionStorage.setItem('kyc_redirect', JSON.stringify(kycData));

        // CRITICAL FIX: Store minimal user data for authentication persistence through KYC redirect
        const kycUserData: AuthUser = {
          id: player.id,
          playerId: player.playerId || player.id,
          email: player.email,
          firstName: player.firstName,
          lastName: player.lastName,
          fullName: `${player.firstName || ''} ${player.lastName || ''}`.trim(),
          nickname: player.nickname || '',
          phone: player.phone || '',
          kycStatus: player.kycStatus || 'pending',
          balance: player.balance || '0.00',
          emailVerified: player.emailVerified || false,
          realBalance: player.balance || '0.00',
          creditBalance: '0.00',
          creditLimit: '0.00',
          creditApproved: false,
          totalBalance: player.balance || '0.00',
          supabaseOnly: true,
          player_id: player.player_id || player.id
        };

        // CRITICAL FIX: Set user authentication state BEFORE triggering KYC redirect
        setUser(kycUserData);
        setLoading(false);

        // Store user authentication for KYC workflow persistence
        sessionStorage.setItem('authenticated_user', JSON.stringify(kycUserData));
        sessionStorage.setItem('kyc_flow_active', 'true');

        toast({
          title: existing ? "Account Found" : "Account Created Successfully!",
          description: existing ? "Redirecting to KYC process..." : "Redirecting to document upload process..."
        });

        // Trigger page reload to start KYC workflow
        setTimeout(() => {
          window.location.reload();
        }, 1500);

        return {
          success: true,
          existing: existing || false,
          redirectToKYC: true,
          player,
          playerData: player // Add alias for compatibility
        };
      } else {
        toast({
          title: existing ? "Account Found" : "Account Created",
          description: message || "Welcome to the platform!",
        });

        // Set loading flag for redirect
        setLoading(false);

        return {
          success: true,
          existing: existing || false,
          redirectToKYC: redirectToKYC || false,
          player,
          playerData: player // Add alias for compatibility
        };
      }

    } catch (error: any) {
      console.error('❌ [ULTRA-FAST AUTH] Sign up error:', error);
      setLoading(false);

      toast({
        title: "Sign Up Failed",
        description: error.message || "Please try again.",
        variant: "destructive",
      });

      return { success: false, error: error.message };
    }
  };

  const signOut = async () => {
    try {
      console.log('🚪 [ULTRA-FAST AUTH] Signing out:', user?.email);

      if (user) {
        // Log logout activity BEFORE clearing user data
        await logAuthActivity('logout', user.email, user.id);
      }

      // PURE SUPABASE: Skip Supabase authsignOut since we're not using sessions
      console.log('🎯 [PURE SUPABASE] Skipping Supabase session signOut - using players table only');

      // Show success toast BEFORE clearing state
      toast({
        title: "Signed Out",
        description: "You have been signed out successfully",
      });

      // Clear all authentication state and redirect
      await handleSignOut();

    } catch (error: any) {
      console.error('❌ [ULTRA-FAST AUTH] Sign out error:', error);

      // Even if there's an error, still clear the user state
      toast({
        title: "Signed Out",
        description: "You have been signed out successfully", // Don't show error to user
      });

      await handleSignOut();
    }
  };

  // Activity logging function
  const logAuthActivity = async (action: string, email: string, userId: string) => {
    try {
      await fetch('/api/auth/log-activity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          email,
          userId,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
        }),
      });

      console.log(`📊 [AUTH LOG] ${action.toUpperCase()} logged for:`, email);
    } catch (error) {
      console.warn('⚠️ [AUTH LOG] Failed to log activity:', error);
    }
  };

  // Welcome email function
  const sendWelcomeEmail = async (email: string, firstName: string) => {
    try {
      await fetch('/api/auth/send-welcome-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          firstName,
        }),
      });

      console.log('📧 [WELCOME EMAIL] Sent to:', email);
    } catch (error) {
      console.warn('⚠️ [WELCOME EMAIL] Failed to send:', error);
    }
  };

  return {
    user,
    loading,
    authChecked,
    signIn,
    signUp,
    signOut,
  };
}