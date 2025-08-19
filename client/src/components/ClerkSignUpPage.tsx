import { useState } from "react";
import { SignUp, useSignUp, useAuth } from "@clerk/clerk-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, Lock, User, Phone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ClerkSignUpPage() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const { isSignedIn } = useAuth();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    phone: "",
  });
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [code, setCode] = useState("");
  const { toast } = useToast();

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-emerald-500" />
          <p className="text-white">Loading sign-up...</p>
        </div>
      </div>
    );
  }

  if (isSignedIn) {
    // Redirect will be handled by the parent component
    return null;
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUp) return;

    setLoading(true);
    try {
      // CRITICAL: Check for existing player BEFORE Clerk signup to prevent duplicates
      console.log('🔍 [BULLETPROOF SIGNUP] Checking for existing player:', formData.email);
      
      try {
        // Use GET request to check existing player without creating
        const checkResponse = await fetch(`/api/players/check?email=${encodeURIComponent(formData.email)}`);
        
        if (checkResponse.ok) {
          const existingPlayerData = await checkResponse.json();
          console.log('🔄 [BULLETPROOF SIGNUP] Player already exists - redirecting to login/KYC:', existingPlayerData.kycStatus);
          
          toast({
            title: "Account Already Exists",
            description: "Please sign in with your existing account or complete KYC.",
            variant: "destructive"
          });
          
          // Redirect to login instead of creating duplicate
          setTimeout(() => {
            window.location.href = '/login';
          }, 2000);
          
          setLoading(false);
          return;
        }
      } catch (existingCheckError) {
        console.log('📝 [BULLETPROOF SIGNUP] No existing player found, safe to proceed with Clerk signup');
      }

      // Proceed with normal Clerk signup if no existing player
      await signUp.create({
        emailAddress: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phoneNumber: formData.phone,
      });

      // Send email verification
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setVerifying(true);
      toast({
        title: "Verification Required",
        description: "Please check your email for a verification code.",
      });
    } catch (err: any) {
      console.error("Sign-up error:", err);
      toast({
        title: "Sign-up failed",
        description: err.errors?.[0]?.message || "Please check your information and try again.",
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  const handleVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUp) return;

    setLoading(true);
    try {
      const completeSignUp = await signUp.attemptEmailAddressVerification({
        code,
      });

      if (completeSignUp.status === "complete") {
        await setActive({ session: completeSignUp.createdSessionId });
        
        // Sync with our backend
        try {
          await fetch('/api/auth/clerk-sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              clerkUserId: completeSignUp.createdUserId,
              email: formData.email,
              firstName: formData.firstName,
              lastName: formData.lastName,
              phone: formData.phone,
              emailVerified: true,
            }),
          });
        } catch (syncError) {
          console.error('Sync error:', syncError);
        }

        toast({
          title: "Account Created!",
          description: "Your account has been created and verified successfully.",
        });
      }
    } catch (err: any) {
      console.error("Verification error:", err);
      toast({
        title: "Verification failed",
        description: err.errors?.[0]?.message || "Invalid verification code.",
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  const updateFormData = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (verifying) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-slate-800 border-slate-700">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-white">
              Verify Your Email
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleVerification} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code" className="text-slate-300">
                  Verification Code
                </Label>
                <Input
                  id="code"
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="bg-slate-700 border-slate-600 text-white text-center text-lg"
                  placeholder="Enter 6-digit code"
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify Email"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-slate-800 border-slate-700">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-white">
            Join Poker Club
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Custom Sign-up Form */}
          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName" className="text-slate-300">
                  First Name
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="firstName"
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => updateFormData('firstName', e.target.value)}
                    className="pl-10 bg-slate-700 border-slate-600 text-white"
                    placeholder="First name"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName" className="text-slate-300">
                  Last Name
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="lastName"
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => updateFormData('lastName', e.target.value)}
                    className="pl-10 bg-slate-700 border-slate-600 text-white"
                    placeholder="Last name"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-300">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateFormData('email', e.target.value)}
                  className="pl-10 bg-slate-700 border-slate-600 text-white"
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-slate-300">
                Phone Number
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => updateFormData('phone', e.target.value)}
                  className="pl-10 bg-slate-700 border-slate-600 text-white"
                  placeholder="+1 (555) 123-4567"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => updateFormData('password', e.target.value)}
                  className="pl-10 bg-slate-700 border-slate-600 text-white"
                  placeholder="Create a strong password"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating Account...
                </>
              ) : (
                "Create Account"
              )}
            </Button>
          </form>

          {/* Clerk's pre-built SignUp component as fallback */}
          <div className="border-t border-slate-700 pt-6">
            <p className="text-slate-400 text-sm text-center mb-4">
              Or use advanced sign-up options:
            </p>
            <SignUp
              appearance={{
                baseTheme: "dark",
                elements: {
                  formButtonPrimary: "bg-emerald-600 hover:bg-emerald-700",
                  card: "bg-slate-800 border-slate-700",
                  headerTitle: "text-white",
                  headerSubtitle: "text-slate-400",
                },
              }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}