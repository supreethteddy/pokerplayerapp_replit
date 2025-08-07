import { useEffect } from 'react';

// Invisible Clerk integration hook
// This hook runs silently in the background to sync user data with Clerk
// without affecting the existing UI/UX
export function useInvisibleClerk(user: any) {
  useEffect(() => {
    // Only sync if user exists and has required data
    if (!user || !user.email) {
      return;
    }

    // Silent sync with Clerk backend
    const syncWithClerk = async () => {
      try {
        console.log('🔄 [INVISIBLE CLERK] Background sync initiated for:', user.email);
        
        const response = await fetch('/api/clerk/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            phone: user.phone,
            playerId: user.id,
            existingPlayer: true
          })
        });

        if (response.ok) {
          const data = await response.json();
          console.log('✅ [INVISIBLE CLERK] Background sync successful');
          
          // Store clerk_user_id if returned
          if (data.player?.clerkUserId) {
            localStorage.setItem('clerk_user_id', data.player.clerkUserId);
          }
        } else {
          console.log('ℹ️ [INVISIBLE CLERK] Sync skipped - user may not need Clerk integration');
        }
      } catch (error) {
        // Silent error - don't affect user experience
        console.log('ℹ️ [INVISIBLE CLERK] Background sync unavailable');
      }
    };

    // Run sync 2 seconds after user authentication to avoid blocking UI
    const timeoutId = setTimeout(syncWithClerk, 2000);
    
    return () => clearTimeout(timeoutId);
  }, [user?.id, user?.email]); // Re-sync if user changes

  // This hook doesn't return anything - it's purely background functionality
  return null;
}