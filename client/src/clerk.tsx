import { ClerkProvider } from '@clerk/clerk-react';
import { ReactNode } from 'react';

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

// Make Clerk optional - if no key provided, skip Clerk integration
if (!publishableKey) {
  console.log('⚠️ Clerk key not found - using legacy authentication only');
}

interface ClerkWrapperProps {
  children: ReactNode;
}

export function ClerkWrapper({ children }: ClerkWrapperProps) {
  // If no Clerk key, just render children directly
  if (!publishableKey) {
    return <>{children}</>;
  }

  return (
    <ClerkProvider publishableKey={publishableKey}>
      {children}
    </ClerkProvider>
  );
}