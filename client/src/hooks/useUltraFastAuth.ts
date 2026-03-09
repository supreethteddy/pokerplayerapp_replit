import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/lib/api/config';
import type { PlayerProfileUpdatedDetail } from '@/hooks/useRealtimeProfileRequests';

// Global state to sync across hook instances
let globalUser: any = null;
let globalAuthChecked = false;
const listeners = new Set<() => void>();

const notifyListeners = () => {
  listeners.forEach(listener => listener());
};

export function useUltraFastAuth() {
  const [user, setUserState] = useState<any>(globalUser);
  const [loading, setLoading] = useState(false);
  const [authChecked, setAuthCheckedState] = useState(globalAuthChecked);
  const { toast } = useToast();

  const setUser = useCallback((newUser: any) => {
    globalUser = newUser;
    setUserState(newUser);
    notifyListeners();
  }, []);

  const setAuthChecked = useCallback((checked: boolean) => {
    globalAuthChecked = checked;
    setAuthCheckedState(checked);
    notifyListeners();
  }, []);

  // Listen for global state changes
  useEffect(() => {
    const handleGlobalChange = () => {
      setUserState(globalUser);
      setAuthCheckedState(globalAuthChecked);
    };

    listeners.add(handleGlobalChange);
    return () => {
      listeners.delete(handleGlobalChange);
    };
  }, []);

  // Initialize authentication state on mount
  useEffect(() => {
    console.log('🚀 [ULTRA-FAST AUTH] Initializing...');

    // Check for any existing authentication state
    const checkAuthState = async () => {
      try {
        // Check for any stored user data or sessions
        // Try sessionStorage first, then localStorage as fallback (iOS Capacitor resilience)
        const storedUser = sessionStorage.getItem('authenticated_user') || localStorage.getItem('authenticated_user');
        if (storedUser) {
          try {
            const userData = JSON.parse(storedUser);

            // CRITICAL: Validate stored data integrity
            const storedClubCode = sessionStorage.getItem('clubCode') || localStorage.getItem('clubCode');
            const storedPlayerId = sessionStorage.getItem('playerId') || localStorage.getItem('playerId');

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

            // Ensure both storages are in sync (iOS fix)
            sessionStorage.setItem('authenticated_user', JSON.stringify(userData));
            localStorage.setItem('authenticated_user', JSON.stringify(userData));

            setUser(userData);
            console.log('🎯 [ULTRA-FAST AUTH] Found stored user session');
          } catch (e) {
            console.error('❌ [AUTH] Failed to parse stored user:', e);
            sessionStorage.removeItem('authenticated_user');
            localStorage.removeItem('authenticated_user');
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

  // Listen for admin-approved field updates and patch user state immediately (no logout needed)
  useEffect(() => {
    const handler = (e: Event) => {
      const { fieldName, newValue } = (e as CustomEvent<PlayerProfileUpdatedDetail>).detail;

      setUser((prev: any) => {
        if (!prev) return prev;

        const patch: Record<string, string> = {};
        if (fieldName === 'name') {
          patch.name = newValue;
          const parts = newValue.trim().split(' ');
          patch.firstName = parts[0] || '';
          patch.lastName = parts.slice(1).join(' ') || '';
        } else if (fieldName === 'email') {
          patch.email = newValue;
        } else if (fieldName === 'phoneNumber') {
          patch.phone = newValue;
        }

        const updated = { ...prev, ...patch };

        // Keep sessionStorage in sync
        sessionStorage.setItem('authenticated_user', JSON.stringify(updated));

        // Update global user
        globalUser = updated;
        notifyListeners();

        return updated;
      });
    };

    window.addEventListener('player-profile-updated', handler);
    return () => window.removeEventListener('player-profile-updated', handler);
  }, []);

  const handleSignOut = async () => {
    setUser(null);
    setAuthChecked(true);
    sessionStorage.removeItem('authenticated_user');
    localStorage.removeItem('authenticated_user');
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
      console.log('🔍 [LOGIN] Player object:', result.player);
      console.log('🔍 [LOGIN] PAN Card from response:', result.player?.panCard);
      console.log('🔍 [LOGIN] Created At from response:', result.player?.createdAt);
      console.log('🔍 [LOGIN] Must reset password (raw):', result.mustResetPassword || result.player?.must_reset_password);

      // Check if password reset is required (handle both TRUE/FALSE and true/false)
      const mustResetPasswordRaw = result.mustResetPassword || result.player?.must_reset_password || result.player?.mustResetPassword;
      const mustResetPassword = mustResetPasswordRaw === true ||
        mustResetPasswordRaw === 'true' ||
        mustResetPasswordRaw === 'TRUE' ||
        mustResetPasswordRaw === 1;

      console.log('🔍 [LOGIN] Must reset password (parsed):', mustResetPassword);

      if (mustResetPassword) {
        console.log('🔐 [LOGIN] Password reset required - returning flag');
        return {
          success: false,
          mustResetPassword: true,
          error: 'Password reset required'
        };
      }

      // Split name into firstName and lastName if backend returns full name
      const fullName = result.player?.name || '';
      const nameParts = fullName.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      const userData = {
        id: result.player?.id || result.playerId,
        email: result.player?.email || email,
        name: fullName,
        firstName: result.player?.firstName || firstName,
        lastName: result.player?.lastName || lastName,
        phone: result.player?.phoneNumber || result.player?.phone || '',
        nickname: result.player?.nickname || '',
        playerId: result.player?.playerId || result.player?.nickname || '',
        panCard: result.player?.panCard || null,
        pan_card_number: result.player?.panCard || null,
        referredBy: result.player?.referredBy || '',
        clubCode: clubCode.toUpperCase(),
        clubId: result.club?.id || result.player?.club?.id || result.player?.clubId,
        kycStatus: result.player?.kycStatus || 'pending',
        kycDocuments: result.player?.kycDocuments || [],
        createdAt: result.player?.createdAt || null,
        created_at: result.player?.createdAt || null,
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

      // Store session in BOTH sessionStorage and localStorage for iOS Capacitor resilience
      sessionStorage.setItem('authenticated_user', JSON.stringify(userData));
      localStorage.setItem('authenticated_user', JSON.stringify(userData));
      sessionStorage.setItem('just_signed_in', 'true');
      localStorage.setItem('just_signed_in', 'true');

      // Store player and club IDs for API requests
      console.log('💾 [LOGIN] Storing playerId:', userData.id);
      console.log('💾 [LOGIN] Storing clubId:', userData.clubId);
      console.log('💾 [LOGIN] Storing clubCode:', userData.clubCode);

      sessionStorage.setItem('playerId', String(userData.id));
      sessionStorage.setItem('clubId', userData.clubId);
      sessionStorage.setItem('clubCode', userData.clubCode);
      // Also store in localStorage for iOS Capacitor
      localStorage.setItem('playerId', String(userData.id));
      localStorage.setItem('clubId', userData.clubId);
      localStorage.setItem('clubCode', userData.clubCode);

      console.log('✅ [LOGIN] Session storage updated');
      console.log('✅ [LOGIN] Verify - sessionStorage.clubId:', sessionStorage.getItem('clubId'));

      if (result.token) {
        sessionStorage.setItem('auth_token', result.token);
        localStorage.setItem('auth_token', result.token);
      }

      // Check KYC status
      if (userData.kycStatus !== 'approved' && userData.kycStatus !== 'verified') {
        sessionStorage.removeItem('kyc_redirect');
        sessionStorage.removeItem('kyc_flow_active');
      }

      // NOTE: Do NOT use window.location.reload() here.
      // On iOS Capacitor, reload() can lose sessionStorage, causing the
      // "Connecting your account" infinite loop. React state is already
      // updated above via setUser/setAuthChecked, so the UI will re-render.

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
      localStorage.setItem('authenticated_user', JSON.stringify(newUser));
      sessionStorage.setItem('just_signed_in', 'true');
      localStorage.setItem('just_signed_in', 'true');

      // Store player and club IDs for API requests (both storages for iOS)
      sessionStorage.setItem('playerId', String(newUser.id));
      sessionStorage.setItem('clubId', newUser.clubId);
      sessionStorage.setItem('clubCode', newUser.clubCode);
      localStorage.setItem('playerId', String(newUser.id));
      localStorage.setItem('clubId', newUser.clubId);
      localStorage.setItem('clubCode', newUser.clubCode);

      if (result.token) {
        sessionStorage.setItem('auth_token', result.token);
        localStorage.setItem('auth_token', result.token);
      }

      // Redirect to KYC if required
      if (newUser.kycStatus === 'pending') {
        sessionStorage.setItem('kyc_flow_active', 'true');
        sessionStorage.setItem('kyc_redirect', JSON.stringify(newUser));
        setTimeout(() => {
          window.location.href = '/kyc';
        }, 1000);
      }
      // NOTE: Do NOT use window.location.reload() here for iOS Capacitor compatibility.
      // React state is already updated via setUser/setAuthChecked above.

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
      localStorage.removeItem('auth_token');
      localStorage.removeItem('playerId');
      localStorage.removeItem('clubId');
      localStorage.removeItem('clubCode');
      localStorage.removeItem('just_signed_in');
      await handleSignOut();

    } catch (error: any) {
      console.error('❌ [AUTH] Sign out error:', error);

      // Even if there's an error, still clear the user state
      toast({
        title: "Signed Out",
        description: "You have been signed out successfully",
      });

      sessionStorage.removeItem('auth_token');
      localStorage.removeItem('auth_token');
      localStorage.removeItem('playerId');
      localStorage.removeItem('clubId');
      localStorage.removeItem('clubCode');
      localStorage.removeItem('just_signed_in');
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