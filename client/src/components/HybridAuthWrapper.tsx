import { useUser } from '@clerk/clerk-react';
import { useAuth } from '../hooks/useAuth';
import { useState, useEffect } from 'react';
import ClerkAuthLayout from './ClerkAuthLayout';
import AuthLayout from './AuthLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Shield, Users } from 'lucide-react';

// Hybrid authentication wrapper that supports both Clerk and legacy Supabase
export default function HybridAuthWrapper() {
  const { user: clerkUser, isLoaded } = useUser();
  const { user: supabaseUser, loading: supabaseLoading } = useAuth();
  const [authMode, setAuthMode] = useState<'clerk' | 'legacy' | null>(null);
  
  // Check if forced to use legacy from URL or error state
  const useLegacy = new URLSearchParams(window.location.search).get('use_legacy') === 'true';

  // Determine authentication mode
  useEffect(() => {
    if (isLoaded && !supabaseLoading) {
      if (clerkUser) {
        setAuthMode('clerk');
      } else if (supabaseUser) {
        setAuthMode('legacy');
      } else {
        setAuthMode(null);
      }
    }
  }, [clerkUser, supabaseUser, isLoaded, supabaseLoading]);

  // If loading, show loading state
  if (!isLoaded || supabaseLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  // If user is authenticated with either system, they're good to go
  if (authMode === 'clerk' || authMode === 'legacy') {
    return null; // Let the main app handle authenticated users
  }

  // Force legacy auth if URL parameter set
  if (useLegacy) {
    return <AuthLayout />;
  }

  // Show authentication choice for new users
  if (authMode === null) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-slate-800 border-slate-700">
          <CardContent className="p-6 space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-white mb-2">Welcome to Tilt</h1>
              <p className="text-slate-400">Choose your authentication method</p>
            </div>

            <div className="space-y-4">
              <Button
                onClick={() => setAuthMode('clerk')}
                className="w-full h-16 bg-emerald-600 hover:bg-emerald-700 flex flex-col items-center gap-2"
              >
                <Shield className="w-6 h-6" />
                <div className="text-center">
                  <div className="font-semibold">New Users - Clerk Auth</div>
                  <div className="text-xs opacity-80">Google Sign-in • Enhanced Security</div>
                </div>
              </Button>

              <Button
                onClick={() => setAuthMode('legacy')}
                variant="outline"
                className="w-full h-16 border-slate-600 hover:bg-slate-700 flex flex-col items-center gap-2"
              >
                <Users className="w-6 h-6" />
                <div className="text-center">
                  <div className="font-semibold">Existing Users - Legacy Auth</div>
                  <div className="text-xs opacity-80">Email & Password</div>
                </div>
              </Button>
            </div>

            <div className="text-center text-slate-500 text-xs">
              Choose based on whether you're a new or returning user
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show Clerk auth by default since it's now properly configured
  return <ClerkAuthLayout />;
}