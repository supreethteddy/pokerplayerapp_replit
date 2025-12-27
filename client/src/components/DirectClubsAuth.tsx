import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Eye, EyeOff, Phone, Mail, ShieldCheck } from "lucide-react";
import { useUltraFastAuth } from "../hooks/useUltraFastAuth";
import { useToast } from "@/hooks/use-toast";
import { whitelabelConfig } from "@/lib/whitelabeling";
import { API_BASE_URL } from "@/lib/api/config";
import { fetchClubBranding, applyClubBranding, getGradientClasses, type ClubBranding } from "@/lib/clubBranding";

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
  const [referralCode, setReferralCode] = useState("");
  const [clubCodeInput, setClubCodeInput] = useState("");
  const [clubCodeVerified, setClubCodeVerified] = useState(false);
  const [clubCodeError, setClubCodeError] = useState("");
  const [clubBranding, setClubBranding] = useState<ClubBranding | null>(null);

  // Validation states
  const [emailError, setEmailError] = useState("");
  const [nicknameError, setNicknameError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [validatingEmail, setValidatingEmail] = useState(false);
  const [validatingNickname, setValidatingNickname] = useState(false);
  const [validatingPhone, setValidatingPhone] = useState(false);

  const { signIn, signUp } = useUltraFastAuth();
  const { toast } = useToast();

  // Check for verification status from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const isVerified = urlParams.get('verified') === 'true';
  const verificationError = urlParams.get('error');

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
    // Check if club code was previously verified
    const storedClubCode = sessionStorage.getItem("club_code_verified");
    if (storedClubCode) {
      setClubCodeVerified(true);
      setClubCodeInput(storedClubCode);
    }

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
    if (!clubCodeVerified) {
      setClubCodeError("Please enter a valid club code to continue.");
      return;
    }
    setLoading(true);

    try {
      if (activeTab === "signin") {
        if (!signinEmail) {
          throw new Error("Please enter your email");
        }

        const result = await signIn(signinEmail, password, clubCodeInput.trim().toUpperCase());
        const redirectToKYC = (result as any)?.redirectToKYC;

        if (result.success) {
          toast({
            title: "Welcome back!",
            description: "Successfully signed in to your account.",
          });
          // Success is handled by useAuth hook - redirect will happen automatically
        } else {
          // Handle specific authentication failures
          if (redirectToKYC) {
            toast({
              title: "KYC Verification Required",
              description:
                result.error || "Please complete your KYC verification before signing in.",
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
          firstName,
          lastName,
          nickname,
          phone,
          clubCodeInput.trim().toUpperCase(),
          referralCode
        );

        const redirectToKYC = (result as any)?.redirectToKYC;
        const resultPlayer = (result as any)?.player;

        if (result.success) {
          // Backend already sends verification email, show success message
          toast({
            title: "Registration Successful!",
            description: "Please check your email and click the verification link to complete your account setup.",
          });

          // Check if we need to redirect to KYC process
          if (redirectToKYC) {
            console.log(
              "🎯 [AUTH] Redirecting to KYC process for player:",
              resultPlayer?.id,
            );

            // CRITICAL FIX: Explicit redirect to KYC page without auto-login
            sessionStorage.setItem('kyc_flow_active', 'true');
            sessionStorage.setItem('kyc_redirect', JSON.stringify({
              id: resultPlayer?.id,
              playerId: resultPlayer?.id,
              email: resultPlayer?.email || signupEmail,
              firstName: resultPlayer?.firstName || firstName,
              lastName: resultPlayer?.lastName || lastName,
              nickname: resultPlayer?.nickname || nickname,
              referredBy: resultPlayer?.referredBy || referralCode || '',
              kycStatus: resultPlayer?.kyc_status || 'pending',
              clubId: result.club?.id,
              clubCode: trimmedCode
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

  // Apply branding if already stored
  useEffect(() => {
    const storedBranding = sessionStorage.getItem("club_branding");
    if (storedBranding) {
      try {
        const branding = JSON.parse(storedBranding);
        setClubBranding(branding);
        applyClubBranding(branding);
      } catch (e) {
        console.error("Failed to parse stored branding:", e);
      }
    }
  }, []);

  return (
    <div className={`min-h-screen flex items-center justify-center p-3 sm:p-4 ${clubBranding ? getGradientClasses(clubBranding.gradient) : 'bg-black'}`}>
      <Card className="w-full max-w-md bg-gray-900 border-gray-700 relative">
        

        {/* Verification Success Message */}
        {isVerified && (
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-emerald-600/20 border border-emerald-500/30 rounded-lg text-center mx-3 sm:mx-6 mt-3 sm:mt-6">
            <div className="text-emerald-300 font-medium mb-1 text-sm sm:text-base">✅ Email Verified!</div>
            <div className="text-xs sm:text-sm text-emerald-400">Your email has been successfully verified. You can now sign in.</div>
          </div>
        )}

        {/* Verification Error Message */}
        {verificationError && (
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-red-600/20 border border-red-500/30 rounded-lg text-center mx-3 sm:mx-6 mt-3 sm:mt-6">
            <div className="text-red-300 font-medium mb-1 text-sm sm:text-base">❌ Verification Failed</div>
            <div className="text-xs sm:text-sm text-red-400">{decodeURIComponent(verificationError)}</div>
          </div>
        )}

        <CardHeader className="text-center mb-4 sm:mb-6 lg:mb-8 px-4 sm:px-6 pt-4 sm:pt-6">
          {/* Logo */}
          <div className="flex justify-center mb-4 sm:mb-6">
            {clubBranding?.logoUrl ? (
              <img 
                src={clubBranding.logoUrl} 
                alt={clubBranding.clubName} 
                className="w-12 h-12 sm:w-16 sm:h-16 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-600 rounded-full flex items-center justify-center" style={{ backgroundColor: clubBranding?.skinColor || '#3b82f6' }}>
                <span className="text-white font-bold text-xl sm:text-2xl">
                  {clubBranding?.clubName?.[0] || 'C'}
                </span>
              </div>
            )}
          </div>
          <h1 className="text-white text-lg sm:text-xl font-semibold mb-4 sm:mb-6">
            {clubBranding?.clubName || 'CLUBS POKER'}
          </h1>

          {!clubCodeVerified ? (
            <div className="text-gray-300 text-xs sm:text-sm mb-3 sm:mb-4 px-2 text-center">
              Enter your club code to continue
            </div>
          ) : (
            <>
              <div className="flex items-center justify-center space-x-2 text-emerald-400 text-xs sm:text-sm mb-3 sm:mb-4 px-2">
                <ShieldCheck className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                <span className="break-words">Access granted for club code: {clubCodeInput}</span>
              </div>

              {/* Tab Navigation - Only show after club code is verified */}
              <div className="flex border-b border-gray-600 mb-4 sm:mb-6">
                <button
                  onClick={() => setActiveTab("signin")}
                  className={`flex-1 py-2.5 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-medium border-b-2 transition-colors min-h-[44px] sm:min-h-[48px] flex items-center justify-center ${
                    activeTab === "signin"
                      ? "border-blue-500 text-blue-400"
                      : "border-transparent text-gray-400 hover:text-white"
                  }`}
                >
                  Log In
                </button>
                <button
                  onClick={() => setActiveTab("signup")}
                  className={`flex-1 py-2.5 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-medium border-b-2 transition-colors min-h-[44px] sm:min-h-[48px] flex items-center justify-center ${
                    activeTab === "signup"
                      ? "border-blue-500 text-blue-400"
                      : "border-transparent text-gray-400 hover:text-white"
                  }`}
                >
                  Sign Up
                </button>
              </div>
            </>
          )}
        </CardHeader>

        <CardContent className="space-y-3 sm:space-y-4 px-4 sm:px-6 pb-4 sm:pb-6">
          {/* Club Code Gate - First Step */}
          {!clubCodeVerified && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const trimmedCode = clubCodeInput.trim().toUpperCase();
                if (!trimmedCode) {
                  setClubCodeError("Please enter a club code.");
                  return;
                }
                
                setLoading(true);
                setClubCodeError("");
                
                try {
                  // Validate club code with backend API
                  const response = await fetch(`${API_BASE_URL}/clubs/verify-code`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ code: trimmedCode }),
                  });

                  const result = await response.json();

                  if (result.valid === true) {
                    // Club code is valid - grant access
                    setClubCodeVerified(true);
                    setClubCodeError("");
                    sessionStorage.setItem("club_code_verified", trimmedCode);
                    sessionStorage.setItem("club_id", result.clubId);
                    sessionStorage.setItem("clubId", result.clubId); // Also store with camelCase for API
                    sessionStorage.setItem("clubCode", trimmedCode); // Store club code
                    sessionStorage.setItem("club_name", result.clubName || "");
                    
                    // Fetch and apply club branding immediately
                    try {
                      const branding = await fetchClubBranding(result.clubId);
                      if (branding) {
                        setClubBranding(branding);
                        applyClubBranding(branding);
                        // Store branding for use across app
                        sessionStorage.setItem("club_branding", JSON.stringify(branding));
                      }
                    } catch (brandingError) {
                      console.error("Failed to load club branding:", brandingError);
                      // Continue even if branding fails
                    }
                  } else {
                    // Invalid club code
                    setClubCodeError(result.message || "Invalid club code. Please try again.");
                    setClubCodeInput("");
                  }
                } catch (error) {
                  console.error("Club code verification error:", error);
                  setClubCodeError("Unable to verify club code. Please check your club code.");
                } finally {
                  setLoading(false);
                }
              }}
              className="space-y-3"
            >
              <Input
                type="text"
                placeholder="Enter Club Code"
                value={clubCodeInput}
                onChange={(e) => {
                  setClubCodeInput(e.target.value.toUpperCase());
                  setClubCodeError("");
                }}
                className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 h-11 sm:h-12 uppercase text-sm sm:text-base"
                data-testid="input-clubcode"
                required
              />
              {clubCodeError && (
                <p className="text-red-500 text-xs mt-1 ml-1">{clubCodeError}</p>
              )}
              <Button
                type="submit"
                disabled={loading}
                className="w-full hover:opacity-90 text-white font-medium py-2.5 sm:py-3 h-11 sm:h-12 text-sm sm:text-base min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: clubBranding?.skinColor || '#3b82f6' }}
              >
                {loading ? "Verifying..." : "Verify Club Code"}
              </Button>
            </form>
          )}

          {/* Email/Password Form - Second Step */}
          {clubCodeVerified && (
            <>
          <form onSubmit={handleEmailAuth} className="space-y-3 sm:space-y-4">
            {activeTab === "signup" && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    type="text"
                    placeholder="First Name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 h-11 sm:h-12 text-sm sm:text-base"
                    required
                  />
                  <Input
                    type="text"
                    placeholder="Last Name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 h-11 sm:h-12 text-sm sm:text-base"
                    required
                  />
                </div>
                <div>
                  <Input
                    type="tel"
                    placeholder="Phone Number"
                    value={phone}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      setPhone(value);
                    }}
                    className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 h-11 sm:h-12 text-sm sm:text-base"
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
                    className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 h-11 sm:h-12 text-sm sm:text-base"
                    data-testid="input-nickname"
                    required
                  />
                  {(nicknameError || validatingNickname) && (
                    <p className="text-red-500 text-xs mt-1 ml-1">
                      {validatingNickname ? "Checking..." : nicknameError}
                    </p>
                  )}
                </div>
                <div>
                  <Input
                    type="text"
                    placeholder="Referral / Referred By (optional)"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value)}
                    className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 h-11 sm:h-12 text-sm sm:text-base"
                    data-testid="input-referral"
                  />
                </div>
              </>
            )}

            <div>
              <Input
                type="email"
                placeholder="Enter Email Address"
                value={activeTab === "signin" ? signinEmail : signupEmail}
                onChange={(e) => activeTab === "signin" ? setSigninEmail(e.target.value) : setSignupEmail(e.target.value)}
                className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 h-11 sm:h-12 text-sm sm:text-base"
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
                className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 h-11 sm:h-12 pr-11 sm:pr-12 text-sm sm:text-base"
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white h-7 w-7 sm:h-8 sm:w-8 p-0"
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
                  className="h-4 w-4 min-h-[16px] min-w-[16px] max-h-[16px] max-w-[16px] shrink-0 rounded border-gray-600 bg-gray-800 data-[state=checked]:border-current data-[state=checked]:text-white"
                  style={{ '--checkbox-color': clubBranding?.skinColor || '#3b82f6' } as any}
                />
                <label
                  htmlFor="remember"
                  className="text-xs sm:text-sm text-gray-300 select-none cursor-pointer whitespace-nowrap"
                >
                  Remember password
                </label>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 sm:py-3 h-11 sm:h-12 mt-4 sm:mt-6 text-sm sm:text-base min-h-[44px]"
            >
              {loading
                ? "Please wait..."
                : activeTab === "signin"
                  ? "Log In"
                  : "Sign Up"}
            </Button>
          </form>
          </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}