
import { useEffect } from "react";
import { useLocation } from "wouter";
import LoadingScreen from "./LoadingScreen";

export default function EmailVerificationHandler() {
  const [location, setLocation] = useLocation();

  useEffect(() => {
    // Parse URL search parameters manually
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const email = urlParams.get('email');

    if (!token || !email) {
      console.error('Missing verification parameters');
      // Redirect to login with error
      setTimeout(() => setLocation('/auth?error=Invalid verification link'), 2000);
      return;
    }

    // Call verification endpoint - use the correct backend route
    fetch(`/api/email-verification/verify-email?token=${token}&email=${encodeURIComponent(email)}`)
      .then(response => {
        if (response.ok) {
          console.log('✅ Email verification successful');
          // Redirect to login with success message
          setTimeout(() => setLocation('/auth?verified=true'), 2000);
        } else {
          return response.text().then(data => {
            // Backend might return HTML error page, so handle both
            if (data.includes('Invalid') || data.includes('expired')) {
              throw new Error('Verification link invalid or expired');
            } else {
              throw new Error('Verification failed');
            }
          });
        }
      })
      .catch(error => {
        console.error('Email verification error:', error);
        // Redirect to login with error
        setTimeout(() => setLocation(`/auth?error=${encodeURIComponent(error.message)}`), 2000);
      });
  }, [setLocation]);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold text-white mb-2">Verifying Your Email...</h2>
        <p className="text-slate-400">Please wait while we confirm your email address.</p>
      </div>
    </div>
  );
}
