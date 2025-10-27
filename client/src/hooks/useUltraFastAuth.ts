import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

export function useUltraFastAuth() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const { toast } = useToast();

  // Local mock user storage helpers (frontend-only)
  const getMockUsers = (): any[] => {
    try {
      return JSON.parse(localStorage.getItem('mock_users') || '[]');
    } catch {
      return [];
    }
  };
  const saveMockUsers = (users: any[]) => {
    localStorage.setItem('mock_users', JSON.stringify(users));
  };

  // Initialize authentication state on mount
  useEffect(() => {
    console.log('🚀 [ULTRA-FAST AUTH] Initializing...');
    
    // Check for any existing authentication state
    const checkAuthState = async () => {
      try {
        // Check for any stored user data or sessions
        const storedUser = sessionStorage.getItem('authenticated_user');
        if (storedUser) {
          try {
            const userData = JSON.parse(storedUser);
            setUser(userData);
            console.log('🎯 [ULTRA-FAST AUTH] Found stored user session');
          } catch (e) {
            sessionStorage.removeItem('authenticated_user');
          }
        }
      } catch (error) {
        console.error('❌ [ULTRA-FAST AUTH] Auth state check failed:', error);
      } finally {
        setAuthChecked(true);
        console.log('✅ [ULTRA-FAST AUTH] Authentication check completed');
      }
    };

    checkAuthState();
  }, []);

  const handleSignOut = async () => {
    setUser(null);
    setAuthChecked(true);
    sessionStorage.removeItem('authenticated_user');
    sessionStorage.removeItem('kyc_redirect');
    sessionStorage.removeItem('kyc_flow_active');
  };

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      console.log('🔑 [ULTRA-FAST AUTH] Frontend-only sign in:', email);

      const users = getMockUsers();
      const existing = users.find((u) => u.email === email && u.password === password);

      if (!existing) {
        throw new Error('Invalid email or password');
      }

      const userData = {
        id: existing.id,
        email: existing.email,
        firstName: existing.firstName || '',
        lastName: existing.lastName || '',
        phone: existing.phone || '',
        nickname: existing.nickname || '',
        kycStatus: existing.kycStatus || 'verified',
        balance: existing.balance || '0.00',
        currentCredit: existing.currentCredit || '0.00',
        creditLimit: existing.creditLimit || '0.00',
        creditApproved: !!existing.creditApproved,
        emailVerified: !!existing.emailVerified,
      };

      setUser(userData);
      setAuthChecked(true);

      // Store session
      sessionStorage.setItem('authenticated_user', JSON.stringify(userData));
      sessionStorage.setItem('just_signed_in', 'true');

      // Directly proceed to dashboard in frontend-only mode
      sessionStorage.removeItem('kyc_redirect');
      sessionStorage.removeItem('kyc_flow_active');
      setTimeout(() => {
        window.location.reload();
      }, 300);

      console.log('✅ [ULTRA-FAST AUTH] Sign in successful:', userData.email);

      toast({
        title: "Welcome back!",
        description: `Signed in successfully as ${userData.firstName}`,
      });

      return { success: true, user: userData };

    } catch (error: any) {
      console.error('❌ [ULTRA-FAST AUTH] Sign in error:', error);

      toast({
        title: "Sign In Failed",
        description: error.message || 'Invalid email or password',
        variant: "destructive",
      });

      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    nickname: string,
    phone: string
  ) => {
    try {
      console.log('🆕 [ULTRA-FAST AUTH] Frontend-only sign up:', email);

      const users = getMockUsers();
      const exists = users.some((u) => u.email === email);
      if (exists) {
        throw new Error('This email is already registered. Please sign in instead.');
      }

      const newUser = {
        id: Date.now().toString(),
        email,
        password,
        firstName,
        lastName,
        nickname,
        phone,
        kycStatus: 'verified',
        balance: '0.00',
        currentCredit: '0.00',
        creditLimit: '0.00',
        creditApproved: false,
        emailVerified: true,
      };
      users.push(newUser);
      saveMockUsers(users);

      toast({
        title: 'Account Created',
        description: `Welcome ${nickname || firstName}! You can sign in now.`,
      });

      // Auto-login for convenience
      setUser({ ...newUser, password: undefined });
      setAuthChecked(true);
      sessionStorage.setItem('authenticated_user', JSON.stringify({ ...newUser, password: undefined }));
      sessionStorage.setItem('just_signed_in', 'true');
      setTimeout(() => window.location.reload(), 300);

      return { success: true, user: newUser };
    } catch (error: any) {
      console.error('❌ [ULTRA-FAST AUTH] Sign up error:', error);
      toast({ title: 'Sign Up Failed', description: error.message || 'Unable to create account', variant: 'destructive' });
      return { success: false, error: error.message };
    }
  };

  const signOut = async () => {
    try {
      console.log('🚪 [ULTRA-FAST AUTH] Signing out:', user?.email);

      // Frontend-only: no server logout

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

  // Removed server-side logging and emails in frontend-only mode

  return {
    user,
    loading,
    authChecked,
    signIn,
    signUp,
    signOut,
  };
}