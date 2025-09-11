
import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertCircle } from "lucide-react";

export default function EmailVerificationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [verificationStatus, setVerificationStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');

    if (success === 'true') {
      setVerificationStatus('success');
      setMessage('Your email has been successfully verified! You can now complete your KYC process.');
    } else if (error) {
      setVerificationStatus('error');
      setMessage(decodeURIComponent(error));
    } else {
      setVerificationStatus('error');
      setMessage('Invalid verification link or token has expired.');
    }
  }, [searchParams]);

  const handleContinue = () => {
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-gray-900 border-gray-700">
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center mb-4">
            {verificationStatus === 'success' ? (
              <CheckCircle className="w-16 h-16 text-green-500" />
            ) : (
              <AlertCircle className="w-16 h-16 text-red-500" />
            )}
          </div>
          <h1 className="text-white text-xl font-semibold">
            {verificationStatus === 'success' ? 'Email Verified!' : 'Verification Failed'}
          </h1>
        </CardHeader>

        <CardContent className="text-center space-y-4">
          <p className="text-gray-300">
            {message}
          </p>
          
          <Button
            onClick={handleContinue}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 h-12"
          >
            Continue to Login
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
