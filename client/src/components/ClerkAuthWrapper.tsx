import React from 'react';
import { ClerkProvider, SignIn, SignUp, useClerk, useUser } from '@clerk/clerk-react';
import { useToast } from '@/hooks/use-toast';

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

interface ClerkAuthWrapperProps {
  children: React.ReactNode;
}

// Clerk authentication component for unified login
function ClerkAuthIntegration() {
  const { user, isLoaded, isSignedIn } = useUser();
  const { toast } = useToast();

  React.useEffect(() => {
    if (isLoaded && isSignedIn && user) {
      console.log('🔐 [CLERK] User signed in:', user.emailAddresses[0]?.emailAddress);
      
      // Sync with Supabase database
      syncClerkUserWithDatabase(user);
    }
  }, [isLoaded, isSignedIn, user]);

  const syncClerkUserWithDatabase = async (clerkUser: any) => {
    try {
      const response = await fetch('/api/auth/clerk-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clerkUserId: clerkUser.id,
          email: clerkUser.emailAddresses[0]?.emailAddress,
          firstName: clerkUser.firstName,
          lastName: clerkUser.lastName,
          phone: clerkUser.phoneNumbers[0]?.phoneNumber,
          emailVerified: clerkUser.emailAddresses[0]?.verification?.status === 'verified',
        }),
      });

      if (response.ok) {
        const userData = await response.json();
        console.log('✅ [CLERK] User synced with database:', userData.email);
        
        // Notify user of successful verification
        if (userData.kycStatus === 'pending') {
          toast({
            title: "Welcome!",
            description: "Account created successfully. Please complete KYC verification.",
          });
        }
      }
    } catch (error) {
      console.error('❌ [CLERK] Sync error:', error);
      toast({
        title: "Sync Error",
        description: "Failed to sync account. Please contact support.",
        variant: "destructive",
      });
    }
  };

  if (!isLoaded) {
    return <div className="flex items-center justify-center min-h-screen bg-black">
      <div className="text-white">Loading authentication...</div>
    </div>;
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-white text-2xl font-bold mb-2">CLUBS POKER</h1>
            <p className="text-gray-400">Sign in to access your player portal</p>
          </div>
          <SignIn 
            appearance={{
              variables: {
                colorPrimary: '#3b82f6',
                colorBackground: '#111827',
                colorInputBackground: '#374151',
                colorInputText: '#f9fafb',
              }
            }}
            signUpUrl="/sign-up"
          />
        </div>
      </div>
    );
  }

  return null; // User is signed in, let the main app handle routing
}

// Clerk wrapper component
export default function ClerkAuthWrapper({ children }: ClerkAuthWrapperProps) {
  if (!CLERK_PUBLISHABLE_KEY) {
    console.warn('⚠️ [CLERK] Missing publishable key, falling back to Supabase auth');
    return <>{children}</>;
  }

  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
      <div className="min-h-screen">
        <ClerkAuthIntegration />
        {children}
      </div>
    </ClerkProvider>
  );
}

// Clerk Sign Up component for registration page
export function ClerkSignUpPage() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-white text-2xl font-bold mb-2">Join CLUBS POKER</h1>
          <p className="text-gray-400">Create your player account</p>
        </div>
        <SignUp 
          appearance={{
            variables: {
              colorPrimary: '#3b82f6',
              colorBackground: '#111827',
              colorInputBackground: '#374151',
              colorInputText: '#f9fafb',
            }
          }}
          signInUrl="/sign-in"
        />
      </div>
    </div>
  );
}