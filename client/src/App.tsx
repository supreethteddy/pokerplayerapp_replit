import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useUltraFastAuth } from "./hooks/useUltraFastAuth";
import { useHybridAuth } from "./hooks/useHybridAuth";
import { ClerkProvider } from '@clerk/clerk-react';

import AuthWrapper from "./components/AuthWrapper";
import ClerkAuthWrapper from "./components/ClerkAuthWrapper";
import SafeAuthWrapper from "./components/AuthErrorBoundary";
import PlayerDashboard from "./components/PlayerDashboard";
import KYCWorkflow from "./components/KYCWorkflow";
import VipShop from "./pages/VipShop";
import TableView from "./pages/TableView";
import OfferDetail from "./pages/OfferDetail";
import LoadingScreen from "./components/LoadingScreen";
import NotificationBubbleManager from "./components/NotificationBubbleManager";
import { useState, useEffect } from "react";

import NotFound from "@/pages/not-found";
import ThankYou from "@/pages/thank-you";
import InteractiveThankYouPage from "./components/InteractiveThankYouPage";

function AppContent() {
  // Use legacy authentication for user interface, but signup will create users in both systems
  const useClerk = false;

  // Use legacy authentication for smooth user experience
  const { user, loading, authChecked } = useUltraFastAuth();

  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL LOGIC
  const [showLoadingScreen, setShowLoadingScreen] = useState(false);
  const [hasShownLoadingScreen, setHasShownLoadingScreen] = useState(false);
  const [kycRedirectData, setKycRedirectData] = useState<any>(null);

  // Reset all states when user signs out to prevent loading loops
  useEffect(() => {
    if (!user && authChecked && !loading) {
      setShowLoadingScreen(false);
      setHasShownLoadingScreen(false);
      setKycRedirectData(null);
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

  // Debug logging for routing
  console.log('🔍 [APP ROUTING] user:', !!user, 'loading:', loading, 'authChecked:', authChecked);
  if (user) {
    console.log('🔍 [APP ROUTING] User details:', { id: user.id, email: user.email });
  }

  // Check for KYC redirect after signup
  const kycRedirect = sessionStorage.getItem('kyc_redirect');
  const kycFlowActive = sessionStorage.getItem('kyc_flow_active');

  if (kycRedirect && kycFlowActive === 'true') {
    try {
      const playerData = JSON.parse(kycRedirect);
      console.log('🎯 [AUTH] Redirecting to KYC process for player:', playerData.nickname || playerData.id);

      // Ensure we have proper authentication for KYC flow
      if (!user && sessionStorage.getItem('authenticated_user')) {
        console.log('🔐 [KYC AUTH] Restoring authentication for KYC workflow');
        // The user state will be restored by useUltraFastAuth hook
      }

      return (
        <KYCWorkflow 
          playerData={{
            id: playerData.id || playerData.playerId,
            email: playerData.email,
            firstName: playerData.firstName,
            lastName: playerData.lastName,
            nickname: playerData.nickname,
            kycStatus: playerData.kycStatus || 'pending'
          }}
          onComplete={() => {
            sessionStorage.removeItem('kyc_redirect');
            sessionStorage.removeItem('kyc_flow_active');
            sessionStorage.removeItem('authenticated_user');
            // Force reload to refresh authentication state
            window.location.reload();
          }}
        />
      );
    } catch (error) {
      console.error('❌ [KYC REDIRECT] Error parsing KYC data:', error);
      // Clear corrupted data and retry
      sessionStorage.removeItem('kyc_redirect');
      sessionStorage.removeItem('kyc_flow_active');
      sessionStorage.removeItem('authenticated_user');
      // Force a reload to clear the bad state and retry the signup flow
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      return <div className="min-h-screen bg-black flex items-center justify-center text-white">Loading...</div>;
    }
  }

  const handleKYCComplete = () => {
    console.log('✅ [APP] KYC process completed');
    setKycRedirectData(null);
    sessionStorage.removeItem('kyc_redirect');
  };

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
          {user ? <Redirect to="/dashboard" /> : (useClerk ? <ClerkAuthWrapper><div /></ClerkAuthWrapper> : <AuthWrapper />)}
        </Route>
        <Route path="/dashboard">
          {user ? <PlayerDashboard key={`dashboard-${user.id}`} user={user} /> : <Redirect to="/" />}
        </Route>
        <Route path="/thank-you">
          <ThankYou />
        </Route>
        <Route path="/kyc-upload">
          {user ? <Redirect to="/dashboard" /> : <Redirect to="/thank-you" />}
        </Route>
        <Route path="/kyc">
          {/* Handle direct KYC redirect from signup - check for KYC data first, then user auth */}
          {kycRedirectData ? (
            <div className="min-h-screen bg-slate-900 dark">
              <KYCWorkflow 
                playerData={kycRedirectData} 
                onComplete={handleKYCComplete}
              />
            </div>
          ) : user ? (
            <Redirect to="/dashboard" />
          ) : (
            <Redirect to="/" />
          )}
        </Route>
        <Route path="/vip-shop">
          {user ? <VipShop /> : <Redirect to="/" />}
        </Route>
        <Route path="/table/:tableId">
          {user ? <TableView /> : <Redirect to="/" />}
        </Route>
        <Route path="/offer/:id">
          {user ? <OfferDetail /> : <Redirect to="/" />}
        </Route>
        <Route path="/interactive-thank-you">
          <InteractiveThankYouPage 
            playerEmail="player@example.com" 
            playerName="Player" 
          />
        </Route>
        <Route path="/sign-in">
          {useClerk ? <ClerkAuthWrapper><div /></ClerkAuthWrapper> : <AuthWrapper />}
        </Route>
        <Route path="/sign-up">
          {useClerk ? <ClerkAuthWrapper><div /></ClerkAuthWrapper> : <AuthWrapper />}
        </Route>
        <Route path="/kyc-docs">
          {user ? <Redirect to="/dashboard" /> : <Redirect to="/" />}
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