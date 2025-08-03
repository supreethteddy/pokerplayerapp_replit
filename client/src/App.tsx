import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "./hooks/useAuth";
import AuthLayout from "./components/AuthLayout";
import PlayerDashboard from "./components/PlayerDashboard";
import VipShop from "./pages/VipShop";
import TableView from "./pages/TableView";
import OfferDetail from "./pages/OfferDetail";
import LoadingScreen from "./components/LoadingScreen";
import PushNotificationManager from "./components/PushNotificationManager";
import { useState, useEffect } from "react";

import NotFound from "@/pages/not-found";
import ThankYou from "@/pages/thank-you";

// Initialize OneSignal for push notifications
function initializeOneSignal() {
  useEffect(() => {
    const setupOneSignal = async () => {
      try {
        const OneSignal = (await import('react-onesignal')).default;
        
        await OneSignal.init({
          appId: '77e9b5e8-b38a-4d08-94d2-5b8f39ea4ac1',
          allowLocalhostAsSecureOrigin: true,
          notifyButton: { enable: false }
        });

        const playerId = localStorage.getItem('playerId') || 'unknown';
        await OneSignal.setExternalUserId(`player-${playerId}`);

        OneSignal.on('notificationClick', (event: any) => {
          console.log('Notification clicked:', event);
          if (event.data?.type === 'chat_message') {
            // Handle chat notification click
          }
        });

        console.log('OneSignal initialized for player notifications');
      } catch (error) {
        console.error('OneSignal initialization error:', error);
      }
    };

    setupOneSignal();
  }, []);
}

function AppContent() {
  const { user, loading } = useAuth();
  const [showLoadingScreen, setShowLoadingScreen] = useState(false);
  const [hasShownLoadingScreen, setHasShownLoadingScreen] = useState(false);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white font-medium">Loading...</p>
          <p className="text-slate-500 text-sm mt-2">If this takes too long, try refreshing the page</p>
        </div>
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
      {user && <PushNotificationManager />}
      
      <Switch>
        <Route path="/">
          {user ? <Redirect to="/dashboard" /> : <AuthLayout />}
        </Route>
        <Route path="/dashboard">
          {user ? <PlayerDashboard /> : <Redirect to="/" />}
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
        <Route path="/thank-you">
          <ThankYou />
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
        <Toaster />
        <AppContent />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
