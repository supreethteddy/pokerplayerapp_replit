import { useState, useEffect } from 'react';
import { useSignIn, useSignUp, useAuth, useUser } from '@clerk/clerk-react';
import { useLocation } from 'wouter';
import { createClerkSupabaseUser } from '../hooks/useHybridAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { X, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function CustomClerkAuth() {
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberPassword, setRememberPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const { user, isSignedIn } = useUser();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // Handle successful authentication and sync with Supabase
  useEffect(() => {
    const syncUser = async () => {
      if (isSignedIn && user) {
        try {
          console.log('🔄 [CLERK] Syncing user with Supabase:', user.emailAddresses[0]?.emailAddress);
          
          // Create/sync user in Supabase
          const result = await createClerkSupabaseUser(user);
          
          if (result.success) {
            console.log('✅ [CLERK] User synced successfully');
            sessionStorage.setItem('just_signed_in', 'true');
            navigate('/dashboard');
          } else {
            console.error('❌ [CLERK] Sync failed:', result.error);
          }
        } catch (error: any) {
          console.error('❌ [CLERK] Sync error:', error);
        }
      }
    };

    syncUser();
  }, [isSignedIn, user, navigate]);

  const handleGoogleAuth = async () => {
    setLoading(true);
    try {
      if (activeTab === 'signin') {
        await signIn?.authenticateWithRedirect({
          strategy: 'oauth_google',
          redirectUrl: '/dashboard',
          redirectUrlComplete: '/dashboard'
        });
      } else {
        await signUp?.authenticateWithRedirect({
          strategy: 'oauth_google',
          redirectUrl: '/dashboard',
          redirectUrlComplete: '/dashboard'
        });
      }
    } catch (error: any) {
      console.error('Google auth error:', error);
      toast({
        title: "Authentication Error",
        description: error.message || "Failed to authenticate with Google",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (activeTab === 'signin') {
        const result = await signIn?.create({
          identifier: email,
          password: password
        });

        if (result?.status === 'complete') {
          await result.createdSessionId;
          toast({
            title: "Welcome back!",
            description: "Successfully signed in to your account."
          });
          // User sync and redirect will be handled by useEffect
        }
      } else {
        const result = await signUp?.create({
          emailAddress: email,
          password: password,
          firstName: firstName,
          lastName: lastName
        });

        if (result?.status === 'missing_requirements') {
          // Handle email verification
          await signUp?.prepareEmailAddressVerification({ strategy: 'email_code' });
          toast({
            title: "Verify your email",
            description: "Please check your email for a verification code."
          });
        } else if (result?.status === 'complete') {
          toast({
            title: "Account created!",
            description: "Welcome to Clubs Poker!"
          });
          // User sync and redirect will be handled by useEffect
        }
      }
    } catch (error: any) {
      console.error('Email auth error:', error);
      toast({
        title: activeTab === 'signin' ? "Sign In Failed" : "Sign Up Failed",
        description: error.errors?.[0]?.message || error.message || "Authentication failed",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-slate-800 border-slate-700 relative">
        {/* Close button */}
        <Button 
          variant="ghost" 
          size="sm" 
          className="absolute top-4 right-4 text-slate-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </Button>

        <CardHeader className="text-center pb-4">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-lg">C</span>
            </div>
          </div>
          <CardTitle className="text-white text-xl font-semibold mb-2">CLUBS POKER</CardTitle>
          
          {/* Tab Navigation */}
          <div className="flex border-b border-slate-600">
            <button
              onClick={() => setActiveTab('signin')}
              className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'signin'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              Log In
            </button>
            <button
              onClick={() => setActiveTab('signup')}
              className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'signup'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              Sign Up
            </button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Google Sign In Button */}
          <Button
            onClick={handleGoogleAuth}
            disabled={loading}
            className="w-full bg-white hover:bg-gray-100 text-black font-medium py-3 border-0"
          >
            <div className="flex items-center justify-center gap-3">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span>{activeTab === 'signin' ? 'Log In with Google' : 'Sign Up with Google'}</span>
            </div>
          </Button>

          {/* Divider */}
          <div className="flex items-center gap-4 my-4">
            <div className="flex-1 h-px bg-slate-600"></div>
            <span className="text-slate-400 text-sm">or</span>
            <div className="flex-1 h-px bg-slate-600"></div>
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleEmailAuth} className="space-y-4">
            {activeTab === 'signup' && (
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="text"
                  placeholder="First Name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                  required
                />
                <Input
                  type="text"
                  placeholder="Last Name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                  required
                />
              </div>
            )}

            <Input
              type="email"
              placeholder="Enter Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-slate-700 border-slate-600 text-white placeholder-slate-400"
              required
            />

            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Enter Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white placeholder-slate-400 pr-10"
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white h-6 w-6 p-0"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>

            {activeTab === 'signin' && (
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="remember"
                    checked={rememberPassword}
                    onCheckedChange={(checked) => setRememberPassword(checked as boolean)}
                    className="border-slate-600 data-[state=checked]:bg-blue-600"
                  />
                  <label htmlFor="remember" className="text-sm text-slate-300">
                    Remember password
                  </label>
                </div>
                <Button variant="link" className="text-blue-400 hover:text-blue-300 p-0 h-auto text-sm">
                  Forgot password?
                </Button>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3"
            >
              {loading ? 'Please wait...' : (activeTab === 'signin' ? 'Log In' : 'Sign Up')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}