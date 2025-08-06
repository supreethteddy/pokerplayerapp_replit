import { useEffect, useState } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spade, Loader, AlertTriangle } from 'lucide-react';
import ClerkAuthLayout from './ClerkAuthLayout';
import AuthLayout from '../components/AuthLayout';

export default function AuthWrapper() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  const [authMethod, setAuthMethod] = useState<'clerk' | 'legacy' | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Check if Clerk is working properly
        const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
        
        if (clerkKey?.startsWith('pk_test_') || clerkKey?.startsWith('pk_live_')) {
          console.log('✅ [AUTH] Clerk key is valid, waiting for initialization...');
          
          // Wait a bit for Clerk to initialize
          setTimeout(() => {
            if (isLoaded) {
              console.log('✅ [AUTH] Clerk loaded successfully');
              setAuthMethod('clerk');
            } else {
              console.log('⚠️ [AUTH] Clerk failed to load, falling back to legacy');
              setAuthMethod('legacy');
            }
            setIsInitializing(false);
          }, 3000);
        } else {
          console.log('⚠️ [AUTH] Invalid Clerk key, using legacy authentication');
          setAuthMethod('legacy');
          setIsInitializing(false);
        }
      } catch (error) {
        console.error('❌ [AUTH] Initialization error:', error);
        setAuthMethod('legacy');
        setIsInitializing(false);
      }
    };

    initializeAuth();
  }, [isLoaded]);

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
            <CardTitle className="text-white">Loading Authentication</CardTitle>
            <p className="text-slate-400 text-sm">Initializing secure login system...</p>
          </CardHeader>
          <CardContent className="text-center">
            <Loader className="w-8 h-8 animate-spin mx-auto text-emerald-400" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show authentication selection if method not determined
  if (!authMethod) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-slate-800 border-slate-700">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <AlertTriangle className="w-12 h-12 text-amber-500" />
            </div>
            <CardTitle className="text-white">Choose Authentication Method</CardTitle>
            <p className="text-slate-400 text-sm">Select your preferred sign-in method</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={() => setAuthMethod('clerk')}
              className="w-full bg-emerald-600 hover:bg-emerald-700"
            >
              Enhanced Authentication
              <span className="text-xs block opacity-80">Google • Phone • Advanced Security</span>
            </Button>
            
            <Button
              onClick={() => setAuthMethod('legacy')}
              variant="outline"
              className="w-full border-slate-600 hover:bg-slate-700"
            >
              Standard Authentication
              <span className="text-xs block opacity-80">Email & Password</span>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render the appropriate authentication system
  return authMethod === 'clerk' ? <ClerkAuthLayout /> : <AuthLayout />;
}