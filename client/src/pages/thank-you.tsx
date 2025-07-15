import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Mail, ArrowRight, RefreshCw, Copy, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

export default function ThankYou() {
  const [timeLeft, setTimeLeft] = useState(60);
  const [emailResent, setEmailResent] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);
  const { toast } = useToast();

  // Countdown timer for email resend
  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft]);

  // Animated background particles
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; size: number; opacity: number }>>([]);

  useEffect(() => {
    const generateParticles = () => {
      const newParticles = [];
      for (let i = 0; i < 20; i++) {
        newParticles.push({
          id: i,
          x: Math.random() * 100,
          y: Math.random() * 100,
          size: Math.random() * 4 + 2,
          opacity: Math.random() * 0.5 + 0.1
        });
      }
      setParticles(newParticles);
    };

    generateParticles();
    const interval = setInterval(generateParticles, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleResendEmail = async () => {
    try {
      // Simulate email resend
      await new Promise(resolve => setTimeout(resolve, 1000));
      setEmailResent(true);
      setTimeLeft(60);
      toast({
        title: "Email Resent",
        description: "Check your inbox for the confirmation email",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to resend email. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCopyEmail = () => {
    navigator.clipboard.writeText("vignesh.wildleaf@gmail.com");
    setEmailCopied(true);
    toast({
      title: "Email Copied",
      description: "Email address copied to clipboard",
    });
    setTimeout(() => setEmailCopied(false), 2000);
  };

  const handleOpenEmailApp = () => {
    // Try to open native email app
    window.location.href = "mailto:";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 relative overflow-hidden">
      {/* Animated background particles */}
      <div className="absolute inset-0 pointer-events-none">
        {particles.map((particle) => (
          <div
            key={particle.id}
            className="absolute w-2 h-2 bg-blue-400 rounded-full animate-pulse"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              transform: `scale(${particle.size / 4})`,
              opacity: particle.opacity,
              animation: `float ${3 + Math.random() * 2}s ease-in-out infinite`,
            }}
          />
        ))}
      </div>

      {/* Main content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl bg-slate-800/90 backdrop-blur-sm border-slate-700 shadow-2xl">
          <CardHeader className="text-center pb-6">
            <div className="mx-auto mb-4 w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
            <CardTitle className="text-3xl font-bold text-white mb-2">
              Thank You for Registering!
            </CardTitle>
            <p className="text-slate-300 text-lg">
              Welcome to the Poker Room Player Portal
            </p>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Success message */}
            <div className="text-center space-y-4">
              <div className="p-6 bg-gradient-to-r from-emerald-500/10 to-blue-500/10 rounded-xl border border-emerald-500/20">
                <h3 className="text-xl font-semibold text-white mb-2">
                  Registration Successful! 🎉
                </h3>
                <p className="text-slate-300">
                  Your account has been created successfully. We've sent a confirmation email to verify your account.
                </p>
              </div>

              {/* Email confirmation section */}
              <div className="p-6 bg-slate-700/50 rounded-xl border border-slate-600">
                <div className="flex items-center justify-center mb-4">
                  <Mail className="w-8 h-8 text-blue-400 mr-3" />
                  <div>
                    <h4 className="text-lg font-semibold text-white">Check Your Email</h4>
                    <p className="text-sm text-slate-400">Confirmation sent to:</p>
                  </div>
                </div>
                
                <div className="flex items-center justify-center space-x-2 mb-4">
                  <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 px-4 py-2 text-sm">
                    vignesh.wildleaf@gmail.com
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCopyEmail}
                    className="border-slate-600 text-slate-400 hover:bg-slate-700"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>

                <div className="flex items-center justify-center space-x-4 mb-4">
                  <Button
                    onClick={handleOpenEmailApp}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open Email App
                  </Button>
                  
                  <Button
                    onClick={handleResendEmail}
                    disabled={timeLeft > 0}
                    variant="outline"
                    className="border-slate-600 text-slate-400 hover:bg-slate-700"
                  >
                    {timeLeft > 0 ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Resend in {timeLeft}s
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Resend Email
                      </>
                    )}
                  </Button>
                </div>

                {emailResent && (
                  <div className="text-center">
                    <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                      ✓ Email Resent Successfully
                    </Badge>
                  </div>
                )}
              </div>

              {/* Next steps */}
              <div className="p-6 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-xl border border-purple-500/20">
                <h4 className="text-lg font-semibold text-white mb-3">What's Next?</h4>
                <div className="space-y-3 text-left">
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                      1
                    </div>
                    <div>
                      <p className="text-white font-medium">Confirm Your Email</p>
                      <p className="text-slate-400 text-sm">Click the confirmation link in your email</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                      2
                    </div>
                    <div>
                      <p className="text-white font-medium">Complete KYC Verification</p>
                      <p className="text-slate-400 text-sm">Upload your ID and address documents</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                      3
                    </div>
                    <div>
                      <p className="text-white font-medium">Start Playing</p>
                      <p className="text-slate-400 text-sm">Join table waitlists and enjoy poker games</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Link href="/login" className="flex-1">
                  <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                    <ArrowRight className="w-4 h-4 mr-2" />
                    Continue to Login
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  className="flex-1 border-slate-600 text-slate-400 hover:bg-slate-700"
                  onClick={() => window.location.reload()}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh Page
                </Button>
              </div>

              {/* Support section */}
              <div className="mt-6 p-4 bg-slate-700/30 rounded-lg">
                <p className="text-sm text-slate-400 mb-2">
                  Need help? Contact our support team
                </p>
                <div className="flex items-center justify-center space-x-4">
                  <a 
                    href="mailto:support@pokerroom.com" 
                    className="text-blue-400 hover:text-blue-300 text-sm"
                  >
                    support@pokerroom.com
                  </a>
                  <span className="text-slate-600">|</span>
                  <a 
                    href="tel:+911234567890" 
                    className="text-blue-400 hover:text-blue-300 text-sm"
                  >
                    +91 1234567890
                  </a>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CSS for floating animation */}
      <style jsx>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
        }
      `}</style>
    </div>
  );
}