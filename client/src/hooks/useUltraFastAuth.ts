import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
// REMOVED: useInvisibleClerk for pure Supabase authentication

// Password validation utility
export const validatePassword = (password: string) => {
  const requirements = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
  };

  const score = Object.values(requirements).filter(Boolean).length;

  return {
    isValid: requirements.length && requirements.uppercase && requirements.lowercase && requirements.number,
    requirements,
    strength: score <= 2 ? 'weak' : score <= 4 ? 'medium' : 'strong',
    score
  };
};

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
  isClerkSynced?: boolean; // Added to track Clerk sync status
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
      const kycFlowActive = sessionStorage.getItem('kyc_flow_active');

      // CRITICAL FIX: Restore authentication for both login and KYC flows
      if (storedUser && (justSignedIn || kycFlowActive)) {
        try {
          const userData = JSON.parse(storedUser);
          console.log('🔄 [SESSION RESTORE] Restoring user from session:', userData.email);

          if (kycFlowActive) {
            console.log('🔐 [KYC AUTH] Authentication restored for KYC workflow');
          }

          setUser(userData);
          setAuthChecked(true);
          setLoading(false);
          return;
        } catch (error) {
          console.error('❌ [SESSION RESTORE] Failed to parse stored user:', error);
          sessionStorage.removeItem('authenticated_user');
          sessionStorage.removeItem('just_signed_in');
          sessionStorage.removeItem('kyc_flow_active');
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

  // Helper to generate sequential player code
  const generatePlayerId = async (existingPlayerCodes: string[]) => {
    // Use simple player code generation instead of complex whitelabeling config
    const player_code_prefix = 'PLAYER';
    const player_code_number_length = 4;

    let playerCode: string;
    let counter = 1;

    while (true) {
      const paddedCounter = String(counter).padStart(player_code_number_length, '0');
      playerCode = `${player_code_prefix}-${paddedCounter}`;

      if (!existingPlayerCodes.includes(playerCode)) {
        return playerCode;
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

      let errorMessage = 'Sign in failed. Please try again.';

      if (error.errors && error.errors.length > 0) {
        const clerkError = error.errors[0];
        const code = clerkError.code;
        const message = clerkError.message;

        switch (code) {
          case 'form_identifier_not_found':
            errorMessage = 'No account found with this email address. Please sign up first.';
            break;
          case 'form_password_incorrect':
            errorMessage = 'Incorrect password. Please try again.';
            break;
          case 'form_param_format_invalid':
            errorMessage = 'Please enter a valid email address.';
            break;
          case 'too_many_requests':
            errorMessage = 'Too many failed attempts. Please wait a moment before trying again.';
            break;
          default:
            errorMessage = message || 'Sign in failed. Please check your credentials.';
        }
      } else if (error.message) {
        const msg = error.message.toLowerCase();
        if (msg.includes('identifier') && msg.includes('not found')) {
          errorMessage = 'No account found with this email address. Please sign up first.';
        } else if (msg.includes('password') && msg.includes('incorrect')) {
          errorMessage = 'Incorrect password. Please try again.';
        } else {
          errorMessage = error.message;
        }
      }

      toast({
        title: "Sign In Failed",
        description: errorMessage,
        variant: "destructive",
      });

      return { success: false, error: errorMessage };
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

    // Client-side password validation
    if (password.length < 8) {
      return {
        success: false,
        error: 'Password must be at least 8 characters long.'
      };
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      return {
        success: false,
        error: 'Password must contain at least one uppercase letter, one lowercase letter, and one number.'
      };
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return {
        success: false,
        error: 'Please enter a valid email address.'
      };
    }

    try {
      setLoading(true);
      console.log('📝 [ULTRA-FAST AUTH] Signing up:', email);

      // Fetch existing player codes to ensure uniqueness for new player code generation
      let existingPlayerCodes: string[] = [];
      try {
        const { data: players, error } = await supabase
          .from('players')
          .select('player_code');
        if (error) {
          console.warn('⚠️ [SIGNUP] Could not fetch existing player codes:', error.message);
        } else if (players) {
          existingPlayerCodes = players.map((p: any) => p.player_code).filter(Boolean);
        }
      } catch (fetchError) {
        console.warn('⚠️ [SIGNUP] Error fetching existing player codes:', fetchError);
      }

      // Generate the new player code
      const newPlayerCode = await generatePlayerId(existingPlayerCodes);

      // PRODUCTION-GRADE BACKEND AUTOMATION SIGNUP
      // Use our backend automation endpoint with POKEPLAYER whitelabeling system
      const response = await fetch('/api/auth/signup-automation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          first_name: firstName,
          last_name: lastName,
          phone,
          nickname,
          clerk_user_id: `user_${email.replace('@', '_').replace('.', '_')}_${Date.now()}`
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

      const { success, player, message } = await response.json();

      if (!success) {
        throw new Error('Signup failed');
      }

      console.log('✅ [BACKEND AUTOMATION] Signup successful:', player?.email);
      console.log('🎯 [BACKEND AUTOMATION] Player created with nickname:', player?.nickname);

      // Handle backend automation response
      if (success && player) {
        // Check if this is an existing player or new player based on KYC status
        const isNewPlayer = !player.existing && player.kyc_status === 'pending';
        const needsKYC = player.kyc_status === 'pending' || player.kyc_status === 'submitted';

        console.log('🎯 [SIGNUP FLOW] Player status:', {
          isNewPlayer,
          kycStatus: player.kyc_status,
          needsKYC,
          existing: player.existing
        });

        if (needsKYC) {
          // Store KYC redirect data with proper field mapping
          const kycData = {
            id: player.id,
            playerId: player.id,
            email: player.email || email,
            firstName: player.first_name || player.firstName || firstName,
            lastName: player.last_name || player.lastName || lastName,
            nickname: player.nickname || nickname,
            kycStatus: player.kyc_status || 'pending',
            existing: player.existing || false
          };

          console.log('🎯 [KYC REDIRECT] Storing KYC data:', kycData);

          sessionStorage.setItem('kyc_redirect', JSON.stringify(kycData));
          sessionStorage.setItem('kyc_flow_active', 'true');

          // Store authenticated user for KYC flow
          const kycUserData: AuthUser = {
            id: player.id.toString(),
            email: player.email || email,
            firstName: player.first_name || player.firstName || firstName,
            lastName: player.last_name || player.lastName || lastName,
            fullName: `${player.first_name || firstName} ${player.last_name || lastName}`.trim(),
            nickname: player.nickname || nickname,
            phone: player.phone || phone || '',
            kycStatus: player.kyc_status || 'pending',
            balance: '0.00',
            realBalance: '0.00',
            creditBalance: '0.00',
            creditLimit: '0.00',
            creditApproved: false,
            totalBalance: '0.00',
            supabaseOnly: true,
            player_id: player.id.toString()
          };

          sessionStorage.setItem('authenticated_user', JSON.stringify(kycUserData));

          toast({
            title: isNewPlayer ? "Account Created Successfully!" : "Welcome back!",
            description: isNewPlayer ? `Welcome ${player.nickname || nickname}! Please check your email to verify your account before proceeding.` : "Please complete your KYC verification.",
          });

          // Force immediate redirect to KYC workflow
          setTimeout(() => {
            console.log('🔄 [KYC REDIRECT] Redirecting to KYC workflow');
            window.location.reload();
          }, 1000);

          return {
            success: true,
            existing: player.existing || false,
            redirectToKYC: true,
            player,
            playerData: player
          };
        } else {
          // User is fully verified - proceed to dashboard
          const enhancedUserData: AuthUser = {
            ...player,
            fullName: `${player.firstName || player.first_name || ''} ${player.lastName || player.last_name || ''}`.trim(),
            nickname: player.nickname || nickname,
            realBalance: player.balance || '0.00',
            creditBalance: player.creditBalance || '0.00',
            creditLimit: player.creditLimit || '0.00',
            creditApproved: player.creditApproved || false,
            totalBalance: player.totalBalance || '0.00',
            isClerkSynced: true,
            player_id: player.player_id || player.id
          };

          setUser(enhancedUserData);
          setLoading(false);
          sessionStorage.setItem('authenticated_user', JSON.stringify(enhancedUserData));
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
      }

      // This should never execute for backend automation since we handle KYC above
      return { success: false, error: 'Unexpected signup flow' };

    } catch (error: any) {
      console.error('❌ [ULTRA-FAST AUTH] Sign up error:', error);
      setLoading(false);

      let errorMessage = 'Account creation failed. Please try again.';

      if (error.errors && error.errors.length > 0) {
        const errorDetail = error.errors[0];
        const code = errorDetail.code;
        const message = errorDetail.message;

        // Handle specific error codes
        switch (code) {
          case 'form_password_pwned':
            errorMessage = 'This password has been found in a data breach. Please choose a more secure password.';
            break;
          case 'form_password_length_too_short':
            errorMessage = 'Password must be at least 8 characters long.';
            break;
          case 'form_password_validation_failed':
            errorMessage = 'Password must contain at least 8 characters, including uppercase, lowercase, and a number.';
            break;
          case 'form_identifier_exists':
          case 'form_identifier_not_available':
            errorMessage = 'An account with this email already exists. Please sign in instead.';
            break;
          case 'form_param_format_invalid':
            if (message?.toLowerCase().includes('email')) {
              errorMessage = 'Please enter a valid email address.';
            } else if (message?.toLowerCase().includes('phone')) {
              errorMessage = 'Please enter a valid phone number.';
            } else {
              errorMessage = 'Please check your input format and try again.';
            }
            break;
          case 'form_param_nil':
            errorMessage = 'Please fill in all required fields.';
            break;
          default:
            // Use the original message for unhandled errors
            errorMessage = message || 'Account creation failed. Please try again.';
        }
      } else if (error.message) {
        // Handle generic error messages
        const msg = error.message.toLowerCase();
        if (msg.includes('password')) {
          errorMessage = 'Password does not meet requirements. Please use at least 8 characters with uppercase, lowercase, and numbers.';
        } else if (msg.includes('email') && msg.includes('exists')) {
          errorMessage = 'An account with this email already exists. Please sign in instead.';
        } else {
          errorMessage = error.message;
        }
      }

      toast({
        title: "Sign Up Failed",
        description: errorMessage,
        variant: "destructive",
      });

      return { success: false, error: errorMessage };
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