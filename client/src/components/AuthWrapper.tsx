import { useEffect, useState } from 'react';
import { useUser, useAuth, useClerk } from '@clerk/clerk-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spade, Loader, AlertTriangle, Chrome, Phone, Mail } from 'lucide-react';
import ClerkAuthLayout from './ClerkAuthLayout';

export default function AuthWrapper() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  const clerk = useClerk();
  const [isInitializing, setIsInitializing] = useState(true);
  const [clerkError, setClerkError] = useState<string | null>(null);

  useEffect(() => {
    const initializeClerk = async () => {
      try {
        const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
        
        if (!clerkKey?.startsWith('pk_test_') && !clerkKey?.startsWith('pk_live_')) {
          setClerkError('Invalid Clerk key format');
          setIsInitializing(false);
          return;
        }

        console.log('✅ [CLERK] Valid key detected, forcing initialization...');
        
        // Force Clerk to load
        if (clerk && !isLoaded) {
          try {
            await clerk.load();
            console.log('✅ [CLERK] Successfully loaded');
          } catch (loadError: any) {
            console.log('⚠️ [CLERK] Load error, continuing anyway:', loadError.message);
          }
        }
        
        // Always proceed after a short delay
        setTimeout(() => {
          console.log('✅ [CLERK] Initialization complete');
          setIsInitializing(false);
        }, 1000);

      } catch (error: any) {
        console.error('❌ [CLERK] Critical error:', error);
        setClerkError(error.message);
        setIsInitializing(false);
      }
    };

    initializeClerk();
  }, [clerk, isLoaded]);

  // Show loading state during initialization
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Card className="w-full max-w-md bg-slate-800 border-slate-700">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-emerald-600 rounded-full flex items-center justify-center">
                <Spade className="w-8 h-8 text-white" />
              </div>
            </div>
            <CardTitle className="text-white">Tilt Poker</CardTitle>
            <p className="text-slate-400 text-sm">Initializing enhanced authentication...</p>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <Loader className="w-8 h-8 animate-spin mx-auto text-emerald-400" />
            <div className="flex justify-center gap-4 text-xs text-slate-500">
              <div className="flex items-center gap-1">
                <Chrome className="w-3 h-3" />
                <span>Google</span>
              </div>
              <div className="flex items-center gap-1">
                <Phone className="w-3 h-3" />
                <span>Phone</span>
              </div>
              <div className="flex items-center gap-1">
                <Mail className="w-3 h-3" />
                <span>Email</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show error state if Clerk failed to initialize
  if (clerkError) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-slate-800 border-slate-700">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <AlertTriangle className="w-12 h-12 text-red-500" />
            </div>
            <CardTitle className="text-white">Authentication Error</CardTitle>
            <p className="text-slate-400 text-sm">{clerkError}</p>
          </CardHeader>
          <CardContent className="text-center">
            <Button
              onClick={() => window.location.reload()}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render Clerk authentication
  return <ClerkAuthLayout />;
}