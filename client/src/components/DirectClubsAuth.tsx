import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { X, Eye, EyeOff, Phone, Mail } from 'lucide-react';
import { useUltraFastAuth } from '../hooks/useUltraFastAuth';
import { useToast } from '@/hooks/use-toast';

export default function DirectClubsAuth() {
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberPassword, setRememberPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Form states
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  
  const { user, signIn, signUp } = useUltraFastAuth();
  const { toast } = useToast();

  // Show success message if user is authenticated
  if (user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white font-medium">Successfully signed in!</p>
          <p className="text-slate-400 text-sm mt-2">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  // Google authentication removed - using email/phone only

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (activeTab === 'signin') {
        if (!email) {
          throw new Error('Please enter your email');
        }
        
        const result = await signIn(email, password);
        
        if (result.success) {
          toast({
            title: "Welcome back!",
            description: "Successfully signed in to your account.",
          });
          // Success is handled by useAuth hook - redirect will happen automatically
        } else {
          throw new Error(result.error || 'Sign in failed');
        }
      } else {
        if (!email || !firstName || !lastName || !phone) {
          throw new Error('Please fill in all required fields');
        }
        
        const result = await signUp(email, password, firstName, lastName, phone);
        
        if (result.success) {
          // Check if we need to redirect to KYC process
          if (result.redirectToKYC) {
            console.log('🎯 [AUTH] Redirecting to KYC process for player:', result.player?.id);
            // KYC redirect will be handled by the parent component
          }
        } else {
          throw new Error(result.error || 'Sign up failed');
        }
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      toast({
        title: activeTab === 'signin' ? "Sign In Failed" : "Sign Up Failed",
        description: error.message || "Please try again",
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
              className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'signin'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              Log In
            </button>
            <button
              onClick={() => setActiveTab('signup')}
              className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'signup'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              Sign Up
            </button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 px-6">
          {/* Email/Password Form */}
          <form onSubmit={handleEmailAuth} className="space-y-4">
            {activeTab === 'signup' && (
              <>
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
                <Input
                  type="tel"
                  placeholder="Phone Number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 h-12"
                />
              </>
            )}

            <Input
              type="email"
              placeholder="Enter Email Address"
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
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
                <div className="flex items-center space-x-2 min-w-0 flex-shrink-0">
                  <Checkbox
                    id="remember"
                    checked={rememberPassword}
                    onCheckedChange={(checked) => setRememberPassword(checked as boolean)}
                    className="border-gray-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 w-4 h-4 min-w-[16px] min-h-[16px] flex-shrink-0 rounded-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <label htmlFor="remember" className="text-sm text-gray-300 select-none cursor-pointer flex-shrink-0 leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Remember password
                  </label>
                </div>
                <Button variant="link" className="text-blue-400 hover:text-blue-300 p-0 h-auto text-sm self-start sm:self-auto">
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
          </form>
        </CardContent>
      </Card>
    </div>
  );
}