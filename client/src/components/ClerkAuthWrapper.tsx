import { ClerkProvider, SignedIn, SignedOut } from '@clerk/clerk-react';
import { useClerkSupabaseAuth } from '../hooks/useClerkSupabaseAuth';
import ClerkSignInPage from './ClerkSignInPage';
import ClerkSignUpPage from './ClerkSignUpPage';
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield } from 'lucide-react';

interface ClerkAuthWrapperProps {
  children: React.ReactNode;
}

function AuthenticatedContent({ children }: { children: React.ReactNode }) {
  const { user, loading, authChecked, isAuthenticated } = useClerkSupabaseAuth();

  if (!authChecked || loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white font-medium">Authenticating with Clerk...</p>
          <p className="text-slate-500 text-sm mt-2">Nanosecond-speed authentication in progress...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <AuthChoice />;
  }

  return <>{children}</>;
}

function AuthChoice() {
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | null>(null);

  if (authMode === 'signin') {
    return (
      <div className="min-h-screen bg-slate-900">
        <ClerkSignInPage />
        <div className="fixed top-4 right-4">
          <Button
            variant="ghost"
            onClick={() => setAuthMode(null)}
            className="text-slate-400 hover:text-white"
          >
            Back
          </Button>
        </div>
      </div>
    );
  }

  if (authMode === 'signup') {
    return (
      <div className="min-h-screen bg-slate-900">
        <ClerkSignUpPage />
        <div className="fixed top-4 right-4">
          <Button
            variant="ghost"
            onClick={() => setAuthMode(null)}
            className="text-slate-400 hover:text-white"
          >
            Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-slate-800 border-slate-700">
        <CardContent className="p-6 space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Welcome to LOCAL POKER CLUB</h1>
            <p className="text-slate-400">Secure authentication with Clerk</p>
          </div>

          <div className="space-y-4">
            <Button
              onClick={() => setAuthMode('signin')}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Sign In
            </Button>
            
            <Button
              onClick={() => setAuthMode('signup')}
              variant="outline"
              className="w-full border-slate-600 text-white hover:bg-slate-700"
            >
              Create Account
            </Button>
          </div>

          <div className="text-center text-slate-500 text-xs">
            Powered by enterprise-grade Clerk authentication
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ClerkAuthWrapper({ children }: ClerkAuthWrapperProps) {
  const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

  if (!clerkKey) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Configuration Error</h1>
          <p className="text-slate-400">Clerk publishable key not found</p>
        </div>
      </div>
    );
  }

  return (
    <ClerkProvider 
      publishableKey={clerkKey}
      appearance={{
        elements: {
          rootBox: 'mx-auto',
          card: 'bg-slate-800 border border-slate-700 text-white',
          headerTitle: 'text-white',
          headerSubtitle: 'text-slate-400',
          formButtonPrimary: 'bg-emerald-600 hover:bg-emerald-700',
          footerActionLink: 'text-emerald-400 hover:text-emerald-300'
        }
      }}
    >
      <SignedIn>
        <AuthenticatedContent>{children}</AuthenticatedContent>
      </SignedIn>
      <SignedOut>
        <AuthChoice />
      </SignedOut>
    </ClerkProvider>
  );
}