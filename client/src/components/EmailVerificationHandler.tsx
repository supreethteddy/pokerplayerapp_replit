
import { useEffect } from "react";
import { useLocation } from "wouter";
import { LoadingScreen } from "./LoadingScreen";

export default function EmailVerificationHandler() {
  const [location, setLocation] = useLocation();

  useEffect(() => {
    // Parse URL search parameters manually
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const email = urlParams.get('email');

    if (!token || !email) {
      setLocation('/email-verified?error=Invalid verification link');
      return;
    }

    // Call verification endpoint
    fetch(`/api/auth/verify?token=${token}&email=${encodeURIComponent(email)}`)
      .then(response => {
        if (response.ok) {
          setLocation('/email-verified?success=true');
        } else {
          return response.json().then(data => {
            throw new Error(data.error || 'Verification failed');
          });
        }
      })
      .catch(error => {
        console.error('Email verification error:', error);
        setLocation(`/email-verified?error=${encodeURIComponent(error.message)}`);
      });
  }, [location, setLocation]);

  return <LoadingScreen message="Verifying your email..." />;
}
