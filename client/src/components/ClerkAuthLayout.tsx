import { useEffect } from 'react';
import { useUser, useAuth, SignIn, SignUp } from '@clerk/clerk-react';
import { useLocation } from 'wouter';
import { createClerkSupabaseUser } from '../hooks/useHybridAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spade, ArrowRight, Phone, Mail, Chrome } from 'lucide-react';
import { Link } from 'wouter';

export default function ClerkAuthLayout() {
  const { user, isLoaded } = useUser();
  const { isSignedIn } = useAuth();
  const [location, navigate] = useLocation();

  useEffect(() => {
    if (isLoaded && isSignedIn && user) {
      // Sync Clerk user with Supabase
      createClerkSupabaseUser(user).then(() => {
        console.log('Clerk user synchronized with Supabase');
        navigate('/dashboard');
      }).catch((err: Error) => {
        console.error('Error syncing Clerk user:', err);
        // Still navigate to dashboard even if sync fails
        navigate('/dashboard');
      });
    }
  }, [isLoaded, isSignedIn, user, navigate]);

  // Show loading state while Clerk initializes
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white">Initializing authentication...</div>
      </div>
    );
  }

  // Show sign-in page
  if (location === '/sign-in' || location === '/') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8">
          {/* Header */}
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-emerald-600 rounded-full flex items-center justify-center">
                <Spade className="w-8 h-8 text-white" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Welcome Back</h1>
            <p className="text-slate-400">Sign in to your poker account</p>
          </div>

          {/* Feature Preview Card */}
          <Card className="bg-slate-800 border-slate-700 mb-6">
            <CardContent className="p-4">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-emerald-400">
                  <Chrome className="w-4 h-4" />
                  <span>Google Sign-in</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-400">
                  <Phone className="w-4 h-4" />
                  <span>Phone Auth</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-400">
                  <Mail className="w-4 h-4" />
                  <span>Email</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Clerk SignIn Component */}
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <SignIn 
                appearance={{
                  elements: {
                    rootBox: "w-full",
                    card: "bg-transparent shadow-none",
                    headerTitle: "text-white",
                    headerSubtitle: "text-slate-400",
                    socialButtonsBlockButton: "bg-slate-700 border-slate-600 text-white hover:bg-slate-600 transition-colors",
                    socialButtonsBlockButtonText: "text-white font-medium",
                    socialButtonsBlockButtonArrow: "text-white",
                    formFieldInput: "bg-slate-700 border-slate-600 text-white placeholder-slate-400",
                    formFieldLabel: "text-slate-300",
                    formButtonPrimary: "bg-emerald-600 hover:bg-emerald-700 transition-colors",
                    footerActionLink: "text-emerald-400 hover:text-emerald-300",
                    dividerLine: "bg-slate-600",
                    dividerText: "text-slate-400",
                    phoneInputBox: "bg-slate-700 border-slate-600 text-white",
                    otpCodeFieldInput: "bg-slate-700 border-slate-600 text-white"
                  }
                }}
                afterSignInUrl="/dashboard"
                signUpUrl="/sign-up"
              />
            </CardContent>
          </Card>

          {/* Call to Action */}
          <div className="text-center">
            <p className="text-slate-400 text-sm mb-4">
              New to Tilt Poker?
            </p>
            <Link href="/sign-up">
              <Button variant="outline" className="border-emerald-600 text-emerald-400 hover:bg-emerald-600 hover:text-white">
                Create Account
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Show sign-up page
  if (location === '/sign-up') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8">
          {/* Header */}
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-emerald-600 rounded-full flex items-center justify-center">
                <Spade className="w-8 h-8 text-white" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Join Tilt Poker</h1>
            <p className="text-slate-400">Create your account and start playing</p>
          </div>

          {/* Feature Preview Card */}
          <Card className="bg-slate-800 border-slate-700 mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-center text-sm">Enhanced Security Features</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div className="text-center">
                  <Chrome className="w-6 h-6 mx-auto mb-1 text-emerald-400" />
                  <div className="text-slate-300">Google Sign-in</div>
                </div>
                <div className="text-center">
                  <Phone className="w-6 h-6 mx-auto mb-1 text-emerald-400" />
                  <div className="text-slate-300">Phone Verification</div>
                </div>
                <div className="text-center">
                  <Mail className="w-6 h-6 mx-auto mb-1 text-emerald-400" />
                  <div className="text-slate-300">Email Auth</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Clerk SignUp Component */}
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <SignUp 
                appearance={{
                  elements: {
                    rootBox: "w-full",
                    card: "bg-transparent shadow-none",
                    headerTitle: "text-white",
                    headerSubtitle: "text-slate-400",
                    socialButtonsBlockButton: "bg-slate-700 border-slate-600 text-white hover:bg-slate-600 transition-colors",
                    socialButtonsBlockButtonText: "text-white font-medium",
                    socialButtonsBlockButtonArrow: "text-white",
                    formFieldInput: "bg-slate-700 border-slate-600 text-white placeholder-slate-400",
                    formFieldLabel: "text-slate-300",
                    formButtonPrimary: "bg-emerald-600 hover:bg-emerald-700 transition-colors",
                    footerActionLink: "text-emerald-400 hover:text-emerald-300",
                    dividerLine: "bg-slate-600",
                    dividerText: "text-slate-400",
                    phoneInputBox: "bg-slate-700 border-slate-600 text-white",
                    otpCodeFieldInput: "bg-slate-700 border-slate-600 text-white"
                  }
                }}
                afterSignUpUrl="/dashboard"
                signInUrl="/sign-in"
              />
            </CardContent>
          </Card>

          {/* Back to Sign In */}
          <div className="text-center">
            <p className="text-slate-400 text-sm mb-4">
              Already have an account?
            </p>
            <Link href="/sign-in">
              <Button variant="outline" className="border-emerald-600 text-emerald-400 hover:bg-emerald-600 hover:text-white">
                Sign In
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Default fallback
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-white">Redirecting...</div>
    </div>
  );
}