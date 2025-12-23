import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useUltraFastAuth } from "./hooks/useUltraFastAuth";
import { useToast } from "@/hooks/use-toast";

import AuthWrapper from "./components/AuthWrapper";
// Clerk removed
import SafeAuthWrapper from "./components/AuthErrorBoundary";
import PlayerDashboard from "./components/PlayerDashboard";
import KYCVerification from "./components/KYCVerification";
// Removed non-player routes/components
import LoadingScreen from "./components/LoadingScreen";
import NotificationBubbleManager from "./components/NotificationBubbleManager";
import { useState, useEffect } from "react";

import NotFound from "@/pages/not-found";

function AppContent() {
  // Use legacy authentication for user interface, but signup will create users in both systems
  const useClerk = false;

  // Use legacy authentication for smooth user experience
  const { user, loading, authChecked } = useUltraFastAuth();
  
  // Toast hook for notifications
  const { toast } = useToast();

  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL LOGIC
  const [showLoadingScreen, setShowLoadingScreen] = useState(false);
  const [hasShownLoadingScreen, setHasShownLoadingScreen] = useState(false);

  // Reset all states when user signs out to prevent loading loops
  useEffect(() => {
    if (!user && authChecked && !loading) {
      setShowLoadingScreen(false);
      setHasShownLoadingScreen(false);
      console.log('🔄 [APP] States reset after sign out');
    }
  }, [user, authChecked, loading]);

  // Welcome video for pure Supabase authentication (no Clerk sync needed)
  useEffect(() => {
    if (user && !loading && !hasShownLoadingScreen) {
      const justSignedIn = sessionStorage.getItem('just_signed_in');
      const videoPlayed = sessionStorage.getItem('welcome_video_played');

      console.log('🎬 [VIDEO CHECK] justSignedIn:', !!justSignedIn, 'videoPlayed:', videoPlayed, 'hasShownLoadingScreen:', hasShownLoadingScreen);

      // Show loading screen if user just signed in and video hasn't been played this session
      if (justSignedIn === 'true' && videoPlayed !== 'true') {
        console.log('🎬 [PURE SUPABASE] Showing welcome video for new login');
        setShowLoadingScreen(true);
        setHasShownLoadingScreen(true); // Mark as shown to prevent re-triggers
        // Don't remove just_signed_in yet - let LoadingScreen handle cleanup
        console.log('🎬 [PURE SUPABASE] LoadingScreen will handle video playback');
      } else {
        console.log('🎬 [VIDEO SKIP] Conditions not met for video - proceeding to dashboard');
        setHasShownLoadingScreen(true);
      }
    }
  }, [user, loading, hasShownLoadingScreen]);

  // Handle email verification success - MUST BE BEFORE ANY CONDITIONAL RETURNS
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const verified = urlParams.get('verified');
    if (verified === 'true') {
      toast({
        title: "Email Verified Successfully! ✅",
        description: "Your email has been verified. Please sign in to continue.",
        duration: 6000,
        className: "bg-green-600 text-white",
      });
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [toast]);

  // Debug logging for routing
  console.log('🔍 [APP ROUTING] user:', !!user, 'loading:', loading, 'authChecked:', authChecked);
  if (user) {
    console.log('🔍 [APP ROUTING] User details:', { id: user.id, email: user.email });
  }

  // Only player portal is exposed; KYC flow and non-player pages are removed

  // Ultra-fast authentication loading with optimized state management
  if (!authChecked || (loading && !user)) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white font-medium">Connecting your account...</p>
          <p className="text-slate-500 text-sm mt-2">Ultra-fast authentication in progress...</p>
        </div>
      </div>
    );
  }

  // Show KYC workflow if redirect data exists (this part is now handled above the return statement)
  // if (kycRedirectData) {
  //   // Store player ID in session storage for KYC workflow
  //   if (kycRedirectData.playerId) {
  //     sessionStorage.setItem('playerId', kycRedirectData.playerId.toString());
  //     localStorage.setItem('playerId', kycRedirectData.playerId.toString());
  //     console.log('🔍 [APP] Stored player ID:', kycRedirectData.playerId);
  //   }

  //   return (
  //     <div className="min-h-screen bg-slate-900 dark">
  //       <KYCWorkflow 
  //         playerData={kycRedirectData} 
  //         onComplete={handleKYCComplete}
  //       />
  //     </div>
  //   );
  // }

  // Welcome video for pure Supabase authentication
  if (showLoadingScreen) {
    return (
      <LoadingScreen 
        onComplete={() => {
          console.log('🎬 [APP] Loading screen completed - setting showLoadingScreen to false');
          console.log('🎬 [APP] Current user state:', !!user, 'authChecked:', authChecked);
          setShowLoadingScreen(false);
        }} 
      />
    );
  }

  return (
    <div className="dark">
      {/* Global Push Notification Manager - Active when user is logged in */}
      {user && <NotificationBubbleManager />}

      <Switch>
        <Route path="/">
          {user ? <Redirect to="/dashboard" /> : <AuthWrapper />}
        </Route>
        <Route path="/kyc">
          <KYCVerification />
        </Route>
        <Route path="/dashboard">
          {user ? (
            <PlayerDashboard key={`dashboard-${user.id}`} user={user} />
          ) : (
            <Redirect to="/" />
          )}
        </Route>
        
        <Route component={NotFound} />
      </Switch>
    </div>
  );
}

function App() {
  // Use legacy authentication interface while signup creates users in both systems
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SafeAuthWrapper>
          <AppContent />
        </SafeAuthWrapper>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;