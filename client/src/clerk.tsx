import { ClerkProvider } from '@clerk/clerk-react';
import { ReactNode } from 'react';

interface ClerkWrapperProps {
  children: ReactNode;
}

export function ClerkWrapper({ children }: ClerkWrapperProps) {
  const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

  // Enhanced validation and error handling
  if (!clerkKey) {
    console.error('❌ [CLERK] Missing VITE_CLERK_PUBLISHABLE_KEY');
    throw new Error('Missing Clerk Publishable Key');
  }

  if (!clerkKey.startsWith('pk_test_') && !clerkKey.startsWith('pk_live_')) {
    console.error('❌ [CLERK] Invalid key format:', clerkKey.substring(0, 20) + '...');
    throw new Error('Invalid Clerk key format - must start with pk_test_ or pk_live_');
  }

  console.log('✅ [CLERK] Initializing with key:', clerkKey.substring(0, 25) + '...');

  return (
    <ClerkProvider 
      publishableKey={clerkKey}
      appearance={{
        elements: {
          rootBox: 'mx-auto',
          card: 'bg-slate-800 border border-slate-700 text-white',
          headerTitle: 'text-white',
          formButtonPrimary: 'bg-emerald-600 hover:bg-emerald-700'
        }
      }}
    >
      {children}
    </ClerkProvider>
  );
}