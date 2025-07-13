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
  kycStatus: string;
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [signupCooldown, setSignupCooldown] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchUserData(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        await fetchUserData(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        queryClient.clear();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserData = async (userId: string) => {
    try {
      const response = await apiRequest('GET', `/api/players/${userId}`);
      const userData = await response.json();
      setUser(userData);
    } catch (error) {
      console.error('Error fetching user data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch user data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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

      if (authError) throw authError;

      // Create player record
      const playerData = {
        email,
        password, // In production, this should be hashed
        firstName,
        lastName,
        phone,
      };

      const playerResponse = await apiRequest('POST', '/api/players', playerData);
      const createdPlayer = await playerResponse.json();

      // Create default player preferences using the created player's ID
      await apiRequest('POST', '/api/player-prefs', {
        playerId: createdPlayer.id,
      });

      toast({
        title: "Account Created",
        description: "Please complete KYC verification to continue",
      });

      return { success: true };
    } catch (error: any) {
      console.error('Signup error:', error);
      toast({
        title: "Signup Failed",
        description: error.message || "Failed to create account",
        variant: "destructive",
      });
      return { success: false };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

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
