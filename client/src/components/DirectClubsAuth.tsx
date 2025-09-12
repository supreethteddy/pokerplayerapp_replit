import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Eye, EyeOff, Phone, Mail } from "lucide-react";
import { useUltraFastAuth } from "../hooks/useUltraFastAuth";
import { useToast } from "@/hooks/use-toast";

export default function DirectClubsAuth() {
  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberPassword, setRememberPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form states
  const [signinEmail, setSigninEmail] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [nickname, setNickname] = useState(""); // Added nickname state

  // Validation states
  const [emailError, setEmailError] = useState("");
  const [nicknameError, setNicknameError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [validatingEmail, setValidatingEmail] = useState(false);
  const [validatingNickname, setValidatingNickname] = useState(false);
  const [validatingPhone, setValidatingPhone] = useState(false);

  const { signIn, signUp } = useUltraFastAuth();
  const { toast } = useToast();

  // Debounced validation function
  const validateField = useCallback(async (field: string, value: string) => {
    if (!value.trim()) {
      // Clear error if field is empty
      if (field === 'email') setEmailError("");
      if (field === 'nickname') setNicknameError("");
      if (field === 'phone') setPhoneError("");
      return;
    }

    try {
      // Set loading state
      if (field === 'email') setValidatingEmail(true);
      if (field === 'nickname') setValidatingNickname(true);
      if (field === 'phone') setValidatingPhone(true);

      const response = await fetch('/api/players/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field, value: value.trim() })
      });

      const result = await response.json();

      if (response.ok && result.exists) {
        const errorMessage = `This ${field} is already registered`;
        if (field === 'email') setEmailError(errorMessage);
        if (field === 'nickname') setNicknameError(errorMessage);
        if (field === 'phone') setPhoneError(errorMessage);
      } else {
        // Clear error if no duplicate found
        if (field === 'email') setEmailError("");
        if (field === 'nickname') setNicknameError("");
        if (field === 'phone') setPhoneError("");
      }
    } catch (error) {
      console.error(`Validation error for ${field}:`, error);
      // Don't show validation errors on network failure
    } finally {
      // Clear loading state
      if (field === 'email') setValidatingEmail(false);
      if (field === 'nickname') setValidatingNickname(false);
      if (field === 'phone') setValidatingPhone(false);
    }
  }, []);

  // Debounce validation calls
  useEffect(() => {
    if (activeTab === 'signup') {
      if (signupEmail) {
        const timer = setTimeout(() => validateField('email', signupEmail), 500);
        return () => clearTimeout(timer);
      } else {
        // Clear error immediately when email is empty
        setEmailError("");
      }
    }
  }, [signupEmail, activeTab, validateField]);

  useEffect(() => {
    if (activeTab === 'signup') {
      if (nickname) {
        const timer = setTimeout(() => validateField('nickname', nickname), 500);
        return () => clearTimeout(timer);
      } else {
        // Clear error immediately when nickname is empty
        setNicknameError("");
      }
    }
  }, [nickname, activeTab, validateField]);

  useEffect(() => {
    if (activeTab === 'signup') {
      if (phone) {
        const timer = setTimeout(() => validateField('phone', phone), 500);
        return () => clearTimeout(timer);
      } else {
        // Clear error immediately when phone is empty
        setPhoneError("");
      }
    }
  }, [phone, activeTab, validateField]);

  // Remove authentication check - let App.tsx routing handle redirects

  // Google authentication removed - using email/phone only

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (activeTab === "signin") {
        if (!signinEmail) {
          throw new Error("Please enter your email");
        }

        const result = await signIn(signinEmail, password);

        if (result.success) {
          toast({
            title: "Welcome back!",
            description: "Successfully signed in to your account.",
          });
          // Success is handled by useAuth hook - redirect will happen automatically
        } else {
          // Handle specific authentication failures
          if (result.redirectToKYC) {
            toast({
              title: "KYC Verification Required",
              description: result.error || "Please complete your KYC verification before signing in.",
              variant: "destructive",
            });
          } else {
            throw new Error(result.error || "Sign in failed");
          }
        }
      } else {
        // Concatenate first and last name for full_name
        const fullName = `${firstName} ${lastName}`;
        
        if (!signupEmail || !firstName || !lastName || !phone || !nickname) {
          throw new Error("Please fill in all required fields");
        }

        // Check for validation errors or ongoing validation
        if (emailError || nicknameError || phoneError) {
          throw new Error("Please fix the validation errors before submitting");
        }

        // Block submission if validation is in progress
        if (validatingEmail || validatingNickname || validatingPhone) {
          throw new Error("Please wait for validation to complete");
        }

        const result = await signUp(
          signupEmail,
          password,
          firstName, // Pass the first name
          lastName, // Pass the last name
          phone,
          nickname, // Pass the nickname
        );

        if (result.success) {
          // Backend already sends verification email, show success message
          toast({
            title: "Registration Successful!",
            description: "Please check your email and click the verification link to complete your account setup.",
          });

          // Check if we need to redirect to KYC process
          if (result.redirectToKYC) {
            console.log(
              "🎯 [AUTH] Redirecting to KYC process for player:",
              result.player?.id,
            );
            
            // CRITICAL FIX: Explicit redirect to KYC page without auto-login
            sessionStorage.setItem('kyc_flow_active', 'true');
            sessionStorage.setItem('kyc_redirect', JSON.stringify({
              id: result.player?.id,
              playerId: result.player?.id,
              email: result.player?.email || signupEmail,
              firstName: result.player?.firstName || firstName,
              lastName: result.player?.lastName || lastName,
              nickname: result.player?.nickname || nickname,
              kycStatus: result.player?.kyc_status || 'pending'
            }));
            
            // Force immediate redirect to KYC page
            setTimeout(() => {
              window.location.href = '/kyc';
            }, 500);
          }
        } else {
          throw new Error(result.error || "Sign up failed");
        }
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      toast({
        title: activeTab === "signin" ? "Sign In Failed" : "Sign Up Failed",
        description: error.message || "Please try again",
        variant: "destructive",
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
              onClick={() => setActiveTab("signin")}
              className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "signin"
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-gray-400 hover:text-white"
              }`}
            >
              Log In
            </button>
            <button
              onClick={() => setActiveTab("signup")}
              className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "signup"
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-gray-400 hover:text-white"
              }`}
            >
              Sign Up
            </button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 px-6">
          {/* Email/Password Form */}
          <form onSubmit={handleEmailAuth} className="space-y-4">
            {activeTab === "signup" && (
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
                <div>
                  <Input
                    type="tel"
                    placeholder="Phone Number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 h-12"
                    data-testid="input-phone"
                  />
                  {(phoneError || validatingPhone) && (
                    <p className="text-red-500 text-xs mt-1 ml-1">
                      {validatingPhone ? "Checking..." : phoneError}
                    </p>
                  )}
                </div>
                {/* Nickname Input */}
                <div>
                  <Input
                    type="text"
                    placeholder="Nickname"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 h-12"
                    data-testid="input-nickname"
                    required
                  />
                  {(nicknameError || validatingNickname) && (
                    <p className="text-red-500 text-xs mt-1 ml-1">
                      {validatingNickname ? "Checking..." : nicknameError}
                    </p>
                  )}
                </div>
              </>
            )}

            <div>
              <Input
                type="email"
                placeholder="Enter Email Address"
                value={activeTab === "signin" ? signinEmail : signupEmail}
                onChange={(e) => activeTab === "signin" ? setSigninEmail(e.target.value) : setSignupEmail(e.target.value)}
                className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 h-12"
                data-testid={activeTab === "signin" ? "input-email-signin" : "input-email-signup"}
                required
              />
              {activeTab === "signup" && (emailError || validatingEmail) && (
                <p className="text-red-500 text-xs mt-1 ml-1">
                  {validatingEmail ? "Checking..." : emailError}
                </p>
              )}
            </div>

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
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </Button>
            </div>

            {activeTab === "signin" && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="remember"
                  checked={rememberPassword}
                  onCheckedChange={(v) => setRememberPassword(!!v)}
                  className="h-4 w-4 shrink-0 rounded-sm border-gray-600 bg-gray-800 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 data-[state=checked]:text-white"
                />
                <label
                  htmlFor="remember"
                  className="text-sm text-gray-300 select-none cursor-pointer whitespace-nowrap"
                >
                  Remember password
                </label>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 h-12 mt-6"
            >
              {loading
                ? "Please wait..."
                : activeTab === "signin"
                  ? "Log In"
                  : "Sign Up"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}