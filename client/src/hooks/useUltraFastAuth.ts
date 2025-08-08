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
          console.log('✅ [ULTRA-FAST AUTH] User signed in');
          await fetchUserDataUltraFast(session.user.id);
          // Show blue welcome notification
          toast({
            title: "Welcome Back!",
            description: "You have successfully logged into the Poker Club portal.",
            className: "bg-blue-500 text-white border-blue-600",
          });
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
      
      // Ultra-fast user data preparation
      const enhancedUserData: AuthUser = {
        ...userData,
        realBalance: userData.balance || '0.00',
        creditBalance: userData.currentCredit || '0.00',
        creditLimit: userData.creditLimit || '0.00',
        creditApproved: userData.creditApproved || false,
        totalBalance: (parseFloat(userData.balance || '0.00') + parseFloat(userData.currentCredit || '0.00')).toFixed(2),
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
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;
      
      if (data.user) {
        // Log login activity
        logAuthActivity('login', email, data.user.id);
        
        // Set session storage flag for loading screen
        sessionStorage.setItem('just_signed_in', 'true');
        
        toast({
          title: "Welcome back!",
          description: "Successfully signed in to your account.",
        });
        
        // User data will be fetched by onAuthStateChange
        return { success: true };
      }
      
      throw new Error('Sign in failed');
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
      
      // First create the Supabase auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });
      
      if (authError) throw authError;
      
      if (!authData.user) {
        throw new Error('Failed to create account');
      }
      
      // Create player record with timeout handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
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
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create player profile');
      }
      
      const playerData = await response.json();
      
      // Check if this is an existing player redirect (existing players OR new players both go to KYC)
      if (playerData.id) {
        console.log('🔄 [SIGNUP] Player found/created - redirecting to KYC:', playerData.kycStatus);
        
        // Set session flag for KYC redirect with consistent data structure
        sessionStorage.setItem('kyc_redirect', JSON.stringify({
          id: playerData.id, // Use 'id' consistently
          playerId: playerData.id, // Also include playerId for compatibility
          email: playerData.email,
          firstName: playerData.firstName,
          lastName: playerData.lastName,
          kycStatus: playerData.kycStatus || 'pending'
        }));
        
        const message = playerData.existing 
          ? "Account Found! Redirecting to KYC document upload process..." 
          : "Account Created! Now redirecting to KYC document upload...";
        
        toast({
          title: playerData.existing ? "Account Found!" : "Account Created!",
          description: message,
        });
        
        // Redirect to KYC process - will be handled by App.tsx
        return { success: true, redirectToKYC: true, playerData };
      }
      
      // Log signup activity for new user
      logAuthActivity('signup', email, authData.user.id);
      
      // Background Clerk sync for new user
      backgroundClerkSync({
        ...playerData,
        isClerkSynced: false
      });
      
      // Send welcome email (fire-and-forget)
      sendWelcomeEmail(email, firstName).catch(console.warn);
      
      // Set session flag for KYC redirect
      sessionStorage.setItem('kyc_redirect', JSON.stringify({
        id: playerData.id,
        email: playerData.email,
        firstName: playerData.firstName,
        lastName: playerData.lastName,
        kycStatus: 'pending'
      }));
      
      toast({
        title: "Account Created!",
        description: "Now redirecting to KYC document upload...",
      });
      
      return { success: true, redirectToKYC: true, playerData };
    } catch (error: any) {
      console.error('❌ [ULTRA-FAST AUTH] Sign up error:', error);
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