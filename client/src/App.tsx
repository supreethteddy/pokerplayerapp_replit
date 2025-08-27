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
  // Temporarily disable Clerk to use legacy authentication system
  const useClerk = false; // Disabled until Clerk keys are properly configured
  
  // Use legacy authentication for now
  const { user, loading, authChecked } = useUltraFastAuth();
  
  // Debug logging for routing
  console.log('🔍 [APP ROUTING] user:', !!user, 'loading:', loading, 'authChecked:', authChecked);
  if (user) {
    console.log('🔍 [APP ROUTING] User details:', { id: user.id, email: user.email });
  }
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

  // Check for KYC redirect from signup process
  useEffect(() => {
    const kycData = sessionStorage.getItem('kyc_redirect');
    if (kycData) {
      try {
        const parsedData = JSON.parse(kycData);
        
        // Convert playerId to id for KYC component compatibility
        if (parsedData.playerId && !parsedData.id) {
          parsedData.id = parsedData.playerId;
        }
        
        setKycRedirectData(parsedData);
        console.log('🎯 [APP] KYC redirect detected:', parsedData);
      } catch (error) {
        console.error('Error parsing KYC redirect data:', error);
        sessionStorage.removeItem('kyc_redirect');
      }
    }
  }, []);

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

  // Show KYC workflow if redirect data exists
  if (kycRedirectData) {
    // Store player ID in session storage for KYC workflow
    if (kycRedirectData.playerId) {
      sessionStorage.setItem('playerId', kycRedirectData.playerId.toString());
      localStorage.setItem('playerId', kycRedirectData.playerId.toString());
      console.log('🔍 [APP] Stored player ID:', kycRedirectData.playerId);
    }
    
    return (
      <div className="min-h-screen bg-slate-900 dark">
        <KYCWorkflow 
          playerData={kycRedirectData} 
          onComplete={handleKYCComplete}
        />
      </div>
    );
  }

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
    <div className="min-h-screen bg-slate-900 dark">
      {/* Global Push Notification Manager - Active when user is logged in */}
      {user && <NotificationBubbleManager />}
      
      <Switch>
        <Route path="/">
          {user ? <Redirect to="/dashboard" /> : (useClerk ? <ClerkAuthWrapper><div /></ClerkAuthWrapper> : <AuthWrapper />)}
        </Route>
        <Route path="/dashboard">
          {user ? <PlayerDashboard user={user} /> : <Redirect to="/" />}
        </Route>
        <Route path="/thank-you">
          <ThankYou />
        </Route>
        <Route path="/kyc-upload">
          {user ? <PlayerDashboard user={user} /> : <Redirect to="/thank-you" />}
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
        <Route component={NotFound} />
      </Switch>
    </div>
  );
}

function App() {
  // Use legacy authentication system for now
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
