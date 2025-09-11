
import { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { LoadingScreen } from "./LoadingScreen";

export default function EmailVerificationHandler() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token');
    const email = searchParams.get('email');

    if (!token || !email) {
      navigate('/email-verified?error=Invalid verification link');
      return;
    }

    // Call verification endpoint
    fetch(`/api/auth/verify?token=${token}&email=${encodeURIComponent(email)}`)
      .then(response => {
        if (response.ok) {
          navigate('/email-verified?success=true');
        } else {
          return response.json().then(data => {
            throw new Error(data.error || 'Verification failed');
          });
        }
      })
      .catch(error => {
        console.error('Email verification error:', error);
        navigate(`/email-verified?error=${encodeURIComponent(error.message)}`);
      });
  }, [searchParams, navigate]);

  return <LoadingScreen message="Verifying your email..." />;
}
