import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useUltraFastAuth } from "./hooks/useUltraFastAuth";

import AuthWrapper from "./components/AuthWrapper";
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
  const { user, loading, authChecked } = useUltraFastAuth();
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

  // Show loading screen when user signs in 
  useEffect(() => {
    if (user && !loading && !hasShownLoadingScreen) {
      // Check if user just signed in or is returning to a session
      const justSignedIn = sessionStorage.getItem('just_signed_in');
      
      // Always show loading screen for fresh sign-ins
      if (justSignedIn) {
        console.log('Fresh sign-in detected - showing loading screen with video');
        setShowLoadingScreen(true);
        sessionStorage.removeItem('just_signed_in');
      }
      setHasShownLoadingScreen(true);
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

  // Show loading screen after sign-in
  if (showLoadingScreen) {
    return (
      <LoadingScreen 
        onComplete={() => setShowLoadingScreen(false)} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 dark">
      {/* Global Push Notification Manager - Active when user is logged in */}
      {user && <NotificationBubbleManager />}
      
      <Switch>
        <Route path="/">
          {user ? <Redirect to="/dashboard" /> : <AuthWrapper />}
        </Route>
        <Route path="/dashboard">
          {user ? <PlayerDashboard /> : <Redirect to="/" />}
        </Route>
        <Route path="/thank-you">
          <ThankYou />
        </Route>
        <Route path="/kyc-upload">
          {user ? <PlayerDashboard /> : <Redirect to="/thank-you" />}
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
          <AuthWrapper />
        </Route>
        <Route path="/sign-up">
          <AuthWrapper />
        </Route>
        <Route component={NotFound} />
      </Switch>
    </div>
  );
}

function App() {
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
