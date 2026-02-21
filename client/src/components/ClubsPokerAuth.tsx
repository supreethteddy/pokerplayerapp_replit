import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { X, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export default function ClubsPokerAuth() {
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberPassword, setRememberPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');

  const { signIn, signUp } = useAuth();
  const { toast } = useToast();

  const handleGoogleAuth = async () => {
    setLoading(true);
    try {
      // Simulate Google auth for now - replace with actual Google OAuth
      toast({
        title: "Google Authentication",
        description: "Google sign-in will be available in the full version.",
        variant: "default"
      });
    } catch (error: any) {
      toast({
        title: "Authentication Error",
        description: "Failed to authenticate with Google",
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
        const result = await signIn(email, password);

        if (result.success) {
          sessionStorage.setItem('just_signed_in', 'true');
          toast({
            title: "Welcome back!",
            description: "Successfully signed in to your account."
          });
        } else {
          throw new Error('Sign in failed');
        }
      } else {
        const result = await signUp(email, password, firstName, lastName, phone);

        if (result.success) {
          sessionStorage.setItem('just_signed_in', 'true');
          toast({
            title: "Account created!",
            description: "Welcome to Clubs Poker!"
          });
        } else {
          throw new Error('Sign up failed');
        }
      }
    } catch (error: any) {
      toast({
        title: activeTab === 'signin' ? "Sign In Failed" : "Sign Up Failed",
        description: error.message || "Authentication failed",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-gray-900 border-gray-700 relative">
        {/* Close button */}
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-4 right-4 text-gray-400 hover:text-white z-10"
        >
          <X className="w-5 h-5" />
        </Button>

        <CardHeader className="text-center pb-4">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-2xl">C</span>
            </div>
          </div>
          <h1 className="text-white text-xl font-semibold mb-6">CLUBS POKER</h1>

          {/* Tab Navigation */}
          <div className="flex border-b border-gray-600 mb-6">
            <button
              onClick={() => setActiveTab('signin')}
              className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'signin'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-white'
                }`}
            >
              Log In
            </button>
            <button
              onClick={() => setActiveTab('signup')}
              className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'signup'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-white'
                }`}
            >
              Sign Up
            </button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 px-6">
          {/* Google Sign In Button */}
          <Button
            onClick={handleGoogleAuth}
            disabled={loading}
            className="w-full bg-gray-200 hover:bg-gray-300 text-black font-medium py-3 border-0 h-12"
          >
            <div className="flex items-center justify-center gap-3">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              <span>{activeTab === 'signin' ? 'Log In with Google' : 'Sign Up with Google'}</span>
            </div>
          </Button>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-gray-600"></div>
            <span className="text-gray-400 text-sm">or</span>
            <div className="flex-1 h-px bg-gray-600"></div>
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
                  className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 h-12"
                  required
                />
                <Input
                  type="text"
                  placeholder="Last Name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 h-12"
                  required
                />
              </div>
            )}

            {activeTab === 'signup' && (
              <Input
                type="tel"
                placeholder="Phone Number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 h-12"
              />
            )}

            <Input
              type="email"
              placeholder="Enter Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 h-12"
              required
            />

            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Enter Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 h-12 pr-12"
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white h-6 w-6 p-0"
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
                    className="border-gray-600 data-[state=checked]:bg-blue-600"
                  />
                  <label htmlFor="remember" className="text-sm text-gray-300">
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
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 h-12 mt-6"
            >
              {loading ? 'Please wait...' : (activeTab === 'signin' ? 'Log In' : 'Sign Up')}
            </Button>

            <div className="mt-4 text-center">
              <Button
                type="button"
                variant="link"
                className="text-gray-400 hover:text-white"
                onClick={() => {
                  localStorage.removeItem('clubId');
                  sessionStorage.removeItem('clubId');
                  localStorage.removeItem('clubCode');
                  sessionStorage.removeItem('clubCode');
                  window.location.reload();
                }}
              >
                Change Club
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}