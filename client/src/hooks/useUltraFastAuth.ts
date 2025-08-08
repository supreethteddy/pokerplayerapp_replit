import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useInvisibleClerk } from './useInvisibleClerk';

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
  clerkUserId?: string;
  isClerkSynced?: boolean;
}

export function useUltraFastAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const { toast } = useToast();
  const syncInProgress = useRef(false);
  const fetchController = useRef<AbortController | null>(null);

  // Invisible Clerk integration - runs silently in background
  useInvisibleClerk(user);

  useEffect(() => {
    console.log('🚀 [ULTRA-FAST AUTH] Initializing...');
    
    // Check current session immediately
    checkSessionUltraFast();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 [ULTRA-FAST AUTH] State change:', event, session?.user?.email || 'No user');
        
        if (event === 'SIGNED_IN' && session?.user) {
          console.log('✅ [ULTRA-FAST AUTH] Supabase session established:', session.user.email);
          if (!user) {
            await fetchUserDataUltraFast(session.user.id);
          }
        } else if (event === 'SIGNED_OUT') {
          console.log('🚪 [ULTRA-FAST AUTH] User signed out');
          handleSignOut();
        }
        
        setAuthChecked(true);
      }
    );

    return () => {
      subscription.unsubscribe();
      if (fetchController.current) {
        fetchController.current.abort();
      }
    };
  }, []);

  const checkSessionUltraFast = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        console.log('🔍 [ULTRA-FAST AUTH] Existing session found:', session.user.email);
        await fetchUserDataUltraFast(session.user.id);
      } else {
        console.log('❌ [ULTRA-FAST AUTH] No existing session');
        setLoading(false);
      }
      
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
        realBalance: userData.balance || '0.00',
        creditBalance: userData.creditBalance || '0.00', // FIXED: Use correct field name
        creditLimit: userData.creditLimit || '0.00',
        creditApproved: userData.creditApproved || false,
        totalBalance: userData.totalBalance || (parseFloat(userData.balance || '0.00') + parseFloat(userData.creditBalance || '0.00')).toFixed(2),
        isClerkSynced: !!userData.clerkUserId
      };
      
      console.log('✅ [ULTRA-FAST AUTH] User loaded:', enhancedUserData.email, 'ID:', enhancedUserData.id);
      
      setUser(enhancedUserData);
      setLoading(false);
      
      // Background Clerk sync (non-blocking)
      if (!enhancedUserData.isClerkSynced && !syncInProgress.current) {
        backgroundClerkSync(enhancedUserData);
      }
      
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('❌ [ULTRA-FAST AUTH] Fetch error:', error);
        setLoading(false);
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
    setUser(null);
    setLoading(false);
    syncInProgress.current = false;
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
        realBalance: user.balance || '0.00',
        creditBalance: user.creditBalance || '0.00',
        creditLimit: user.creditLimit || '0.00',
        creditApproved: user.creditApproved || false,
        totalBalance: user.totalBalance || '0.00',
        isClerkSynced: user.isClerkSynced || true
      };
      
      // CRITICAL FIX: Create Supabase session to prevent logout loop
      try {
        const { data: supabaseAuth, error } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: password
        });
        
        if (error) {
          console.warn('⚠️ [ULTRA-FAST AUTH] Supabase session creation warning:', error.message);
          // Continue anyway as our backend authentication was successful
        } else {
          console.log('✅ [ULTRA-FAST AUTH] Supabase session established successfully');
        }
      } catch (sessionError) {
        console.warn('⚠️ [ULTRA-FAST AUTH] Supabase session creation failed, continuing with backend auth:', sessionError);
        // Continue anyway as our backend authentication was successful
      }
      
      setUser(enhancedUserData);
      setLoading(false);
      
      // Log authentication activity
      logAuthActivity('login', email, user.supabaseId || user.id);
      
      // Set session storage flag for loading screen
      sessionStorage.setItem('just_signed_in', 'true');
      
      toast({
        title: "Welcome back!",
        description: message || "Successfully signed in to your account.",
      });
      
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

  const signUp = async (email: string, password: string, firstName: string, lastName: string, phone: string) => {
    try {
      setLoading(true);
      console.log('📝 [ULTRA-FAST AUTH] Signing up:', email);
      
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
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Signup failed' }));
        throw new Error(errorData.error || 'Signup failed');
      }
      
      const { success, player, existing, redirectToKYC, message } = await response.json();
      
      if (!success) {
        throw new Error('Signup failed');
      }
      
      console.log('✅ [ULTRA-FAST AUTH] Integrated signup successful:', player?.email);
      
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
        // Log logout activity
        logAuthActivity('logout', user.email, user.id);
      }
      
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      await handleSignOut();
      
      toast({
        title: "Signed Out",
        description: "You have been signed out successfully",
      });
    } catch (error: any) {
      console.error('❌ [ULTRA-FAST AUTH] Sign out error:', error);
      toast({
        title: "Sign Out Failed",
        description: error.message || "Failed to sign out",
        variant: "destructive",
      });
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