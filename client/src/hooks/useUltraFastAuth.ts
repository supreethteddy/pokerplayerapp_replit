import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/lib/api/config';

export function useUltraFastAuth() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const { toast } = useToast();

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
            
            // CRITICAL: Validate stored data integrity
            const storedClubCode = sessionStorage.getItem('clubCode');
            const storedPlayerId = sessionStorage.getItem('playerId');
            
            // Check if club code doesn't match (corrupted data)
            if (storedClubCode && userData.clubCode && storedClubCode !== userData.clubCode) {
              console.error('❌ [AUTH] Corrupted session detected! Club code mismatch:', storedClubCode, '!=', userData.clubCode);
              console.error('❌ [AUTH] Forcing logout and clearing session...');
              sessionStorage.clear();
              localStorage.clear();
              setAuthChecked(true);
              return;
            }
            
            // Check if player ID is a timestamp (corrupted)
            if (storedPlayerId && !storedPlayerId.includes('-')) {
              console.error('❌ [AUTH] Corrupted session detected! Player ID is not a UUID:', storedPlayerId);
              console.error('❌ [AUTH] Forcing logout and clearing session...');
              sessionStorage.clear();
              localStorage.clear();
              setAuthChecked(true);
              return;
            }
            
            setUser(userData);
            console.log('🎯 [ULTRA-FAST AUTH] Found stored user session');
          } catch (e) {
            console.error('❌ [AUTH] Failed to parse stored user:', e);
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

  const signIn = async (email: string, password: string, clubCode?: string) => {
    setLoading(true);
    try {
      console.log('🔑 [AUTH] Backend sign in:', email, 'club:', clubCode);

      if (!clubCode) {
        throw new Error('Club code is required');
      }

      // Call backend login API
      const response = await fetch(`${API_BASE_URL}/auth/player/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clubCode: clubCode.toUpperCase(),
          email: email.toLowerCase().trim(),
          password: password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Invalid email or password');
      }

      console.log('🔍 [LOGIN] Backend response:', result);
      console.log('🔍 [LOGIN] Club ID from response:', result.club?.id);
      console.log('🔍 [LOGIN] Player ID from response:', result.player?.id);
      
      const userData = {
        id: result.player?.id || result.playerId,
        email: result.player?.email || email,
        firstName: result.player?.firstName || '',
        lastName: result.player?.lastName || '',
        phone: result.player?.phoneNumber || result.player?.phone || '',
        nickname: result.player?.nickname || '',
        referredBy: result.player?.referredBy || '',
        clubCode: clubCode.toUpperCase(),
        clubId: result.club?.id || result.player?.club?.id || result.player?.clubId,
        kycStatus: result.player?.kycStatus || 'pending',
        balance: result.player?.balance || '0.00',
        currentCredit: result.player?.currentCredit || '0.00',
        creditLimit: result.player?.creditLimit || '0.00',
        creditApproved: !!result.player?.creditApproved,
        emailVerified: !!result.player?.emailVerified,
      };
      
      console.log('✅ [LOGIN] User data to store:', userData);
      console.log('✅ [LOGIN] Club ID to store:', userData.clubId);

      setUser(userData);
      setAuthChecked(true);

      // Store session
      sessionStorage.setItem('authenticated_user', JSON.stringify(userData));
      sessionStorage.setItem('just_signed_in', 'true');
      
      // Store player and club IDs for API requests
      console.log('💾 [LOGIN] Storing playerId:', userData.id);
      console.log('💾 [LOGIN] Storing clubId:', userData.clubId);
      console.log('💾 [LOGIN] Storing clubCode:', userData.clubCode);
      
      sessionStorage.setItem('playerId', String(userData.id));
      sessionStorage.setItem('clubId', userData.clubId);
      sessionStorage.setItem('clubCode', userData.clubCode);
      
      console.log('✅ [LOGIN] Session storage updated');
      console.log('✅ [LOGIN] Verify - sessionStorage.clubId:', sessionStorage.getItem('clubId'));
      
      if (result.token) {
        sessionStorage.setItem('auth_token', result.token);
      }

      // Check KYC status
      if (userData.kycStatus !== 'approved' && userData.kycStatus !== 'verified') {
        sessionStorage.removeItem('kyc_redirect');
        sessionStorage.removeItem('kyc_flow_active');
      }

      setTimeout(() => {
        window.location.reload();
      }, 300);

      console.log('✅ [AUTH] Sign in successful:', userData.email);

      toast({
        title: "Welcome back!",
        description: `Signed in successfully as ${userData.firstName}`,
      });

      return { success: true, user: userData };

    } catch (error: any) {
      console.error('❌ [AUTH] Sign in error:', error);

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
    phone: string,
    clubCode?: string,
    referredBy?: string
  ) => {
    setLoading(true);
    try {
      console.log('🆕 [AUTH] Backend sign up:', email, 'club:', clubCode);

      if (!clubCode) {
        throw new Error('Club code is required');
      }

      // Call backend signup API
      const response = await fetch(`${API_BASE_URL}/auth/player/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clubCode: clubCode.toUpperCase(),
          email: email.toLowerCase().trim(),
          password: password,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          nickname: nickname.trim(),
          phoneNumber: phone.replace(/\D/g, ''),
          referralCode: referredBy || undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Unable to create account');
      }

      const newUser = {
        id: result.player?.id || result.playerId,
        email: result.player?.email || email,
        firstName: result.player?.firstName || firstName,
        lastName: result.player?.lastName || lastName,
        phone: result.player?.phoneNumber || phone,
        nickname: result.player?.nickname || nickname,
        referredBy: referredBy || '',
        clubCode: clubCode.toUpperCase(),
        clubId: result.club?.id || result.player?.club?.id || result.player?.clubId,
        kycStatus: result.player?.kycStatus || 'pending',
        balance: '0.00',
        currentCredit: '0.00',
        creditLimit: '0.00',
        creditApproved: false,
        emailVerified: false,
      };

      toast({
        title: 'Account Created',
        description: `Welcome ${nickname || firstName}! Please check your email to verify your account.`,
      });

      // Auto-login after signup
      setUser(newUser);
      setAuthChecked(true);
      sessionStorage.setItem('authenticated_user', JSON.stringify(newUser));
      sessionStorage.setItem('just_signed_in', 'true');
      
      // Store player and club IDs for API requests
      sessionStorage.setItem('playerId', String(newUser.id));
      sessionStorage.setItem('clubId', newUser.clubId);
      sessionStorage.setItem('clubCode', newUser.clubCode);
      
      if (result.token) {
        sessionStorage.setItem('auth_token', result.token);
      }

      // Redirect to KYC if required
      if (newUser.kycStatus === 'pending') {
        sessionStorage.setItem('kyc_flow_active', 'true');
        sessionStorage.setItem('kyc_redirect', JSON.stringify(newUser));
        setTimeout(() => {
          window.location.href = '/kyc';
        }, 1000);
      } else {
        setTimeout(() => window.location.reload(), 300);
      }

      return { success: true, user: newUser };
    } catch (error: any) {
      console.error('❌ [AUTH] Sign up error:', error);
      toast({ title: 'Sign Up Failed', description: error.message || 'Unable to create account', variant: 'destructive' });
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      console.log('🚪 [AUTH] Signing out:', user?.email);

      // Call backend logout if token exists
      const token = sessionStorage.getItem('auth_token');
      if (token) {
        try {
          await fetch(`${API_BASE_URL}/auth/logout`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
          });
        } catch (e) {
          console.log('Logout API call failed, continuing with local logout');
        }
      }

      // Show success toast BEFORE clearing state
      toast({
        title: "Signed Out",
        description: "You have been signed out successfully",
      });

      // Clear all authentication state
      sessionStorage.removeItem('auth_token');
      await handleSignOut();

    } catch (error: any) {
      console.error('❌ [AUTH] Sign out error:', error);

      // Even if there's an error, still clear the user state
      toast({
        title: "Signed Out",
        description: "You have been signed out successfully",
      });

      sessionStorage.removeItem('auth_token');
      await handleSignOut();
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