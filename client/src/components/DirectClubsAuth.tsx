import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { X, Eye, EyeOff, Phone, Mail, ShieldCheck, FileText } from "lucide-react";
import { useUltraFastAuth } from "../hooks/useUltraFastAuth";
import { useToast } from "@/hooks/use-toast";
import { whitelabelConfig } from "@/lib/whitelabeling";
import { API_BASE_URL } from "@/lib/api/config";
import { fetchClubBranding, fetchClubBrandingByCode, createBrandingFromVerifyResponse, applyClubBranding, getGradientClasses, getGradientStyle, type ClubBranding } from "@/lib/clubBranding";

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

  // Terms & Conditions modal state
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [pendingKycRedirect, setPendingKycRedirect] = useState<any>(null);

  // Password reset modal state (for login)
  const [showPasswordResetModal, setShowPasswordResetModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordResetLoading, setPasswordResetLoading] = useState(false);
  const [pendingLoginCredentials, setPendingLoginCredentials] = useState<{ email: string, password: string, clubCode: string } | null>(null);

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
        const mustResetPasswordRaw = (result as any)?.mustResetPassword;

        // Check if password reset is required (handle both TRUE/FALSE and true/false)
        const mustResetPassword = mustResetPasswordRaw === true ||
          mustResetPasswordRaw === 'true' ||
          mustResetPasswordRaw === 'TRUE' ||
          mustResetPasswordRaw === 1;

        console.log("🔐 [AUTH] Password reset check - raw:", mustResetPasswordRaw, "parsed:", mustResetPassword);

        // Check if password reset is required
        if (mustResetPassword) {
          console.log("🔐 [AUTH] Password reset required for user:", signinEmail);
          setPendingLoginCredentials({
            email: signinEmail,
            password: password,
            clubCode: clubCodeInput.trim().toUpperCase()
          });
          setShowPasswordResetModal(true);
          setLoading(false);
          return;
        }

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
              "🎯 [AUTH] Preparing KYC redirect for player:",
              resultPlayer?.id,
            );
            console.log("📋 [TERMS] Club branding terms:", clubBranding?.termsAndConditions ? "Available" : "Not available (will show default)");

            // Store KYC redirect data
            const kycRedirectData = {
              id: resultPlayer?.id,
              playerId: resultPlayer?.id,
              email: resultPlayer?.email || signupEmail,
              firstName: resultPlayer?.firstName || firstName,
              lastName: resultPlayer?.lastName || lastName,
              nickname: resultPlayer?.nickname || nickname,
              referredBy: resultPlayer?.referredBy || referralCode || '',
              kycStatus: resultPlayer?.kyc_status || 'pending',
              clubId: (result as any)?.club?.id || resultPlayer?.clubId || sessionStorage.getItem('clubId'),
              clubCode: clubCodeInput.trim().toUpperCase()
            };

            // Show Terms & Conditions modal before redirecting to KYC
            console.log("📋 [TERMS] Showing Terms & Conditions modal before KYC redirect");
            setPendingKycRedirect(kycRedirectData);
            setShowTermsModal(true);
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

  // Watch for club code changes and update branding (only when club code actually changes)
  useEffect(() => {
    let lastClubCode: string | null = null;
    let lastClubId: string | null = null;

    const checkClubCodeChange = async () => {
      const currentClubCode = sessionStorage.getItem("clubCode");
      const currentClubId = sessionStorage.getItem("clubId") || sessionStorage.getItem("club_id");

      // Only proceed if club code or ID actually changed
      if (currentClubCode === lastClubCode && currentClubId === lastClubId) {
        return; // No change, skip
      }

      lastClubCode = currentClubCode;
      lastClubId = currentClubId;

      if (currentClubCode && currentClubId) {
        // Check if we need to update branding
        const storedBranding = sessionStorage.getItem("club_branding");
        let needsUpdate = true;

        if (storedBranding) {
          try {
            const branding = JSON.parse(storedBranding);
            if (branding.clubCode === currentClubCode && branding.clubId === currentClubId) {
              needsUpdate = false;
              // Still apply it in case it wasn't applied
              if (!clubBranding || clubBranding.clubCode !== currentClubCode) {
                console.log("✅ [AUTH] Applying stored branding for club:", currentClubCode);
                setClubBranding(branding);
                applyClubBranding(branding);
              }
              return; // Already have correct branding, no need to fetch
            }
          } catch (e) {
            // Invalid stored branding, need to fetch
          }
        }

        if (needsUpdate) {
          console.log("🔄 [AUTH] Club code changed, fetching new branding...");
          try {
            const branding = await fetchClubBranding(currentClubId);
            if (branding) {
              setClubBranding(branding);
              applyClubBranding(branding);
              sessionStorage.setItem("club_branding", JSON.stringify(branding));
            }
          } catch (error) {
            console.error("❌ [AUTH] Failed to fetch branding on club code change:", error);
          }
        }
      }
    };

    // Check immediately on mount
    checkClubCodeChange();

    // Only check periodically if we don't have branding yet (max 5 times, then stop)
    let checkCount = 0;
    const maxChecks = 5;
    const interval = setInterval(() => {
      checkCount++;
      if (checkCount > maxChecks) {
        clearInterval(interval);
        return;
      }
      checkClubCodeChange();
    }, 3000); // Check every 3 seconds, max 5 times (15 seconds total)

    return () => clearInterval(interval);
  }, []); // Empty dependency array - only run on mount

  // Get gradient classes and style
  const gradientClasses = clubBranding ? getGradientClasses(clubBranding.gradient) : '';
  const gradientStyle = clubBranding ? getGradientStyle(clubBranding.gradient) : {};

  // Helper function to get logo URL (prioritize database logo, fallback to default)
  const getLogoUrl = (): string | null => {
    // Priority 1: Logo from database (clubBranding)
    if (clubBranding?.logoUrl) {
      return clubBranding.logoUrl;
    }
    // Priority 2: Default logo from whitelabelConfig
    if (whitelabelConfig.logoUrl) {
      return whitelabelConfig.logoUrl;
    }
    return null;
  };

  return (
    <div
      className={`min-h-screen flex items-center justify-center pt-4 sm:pt-5 px-3 sm:px-4 pb-3 sm:pb-4 ${gradientClasses || 'bg-black'}`}
      style={Object.keys(gradientStyle).length > 0 ? gradientStyle : undefined}
    >
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
            {getLogoUrl() ? (
              <img
                src={getLogoUrl()!}
                alt={clubBranding?.clubName || whitelabelConfig.companyName || 'Club'}
                className="w-12 h-12 sm:w-16 sm:h-16 rounded-full object-cover border-2 border-slate-700"
                onError={(e) => {
                  // Fallback to default logo if database logo fails to load
                  const img = e.target as HTMLImageElement;
                  const defaultLogo = whitelabelConfig.logoUrl;
                  if (defaultLogo && img.src !== defaultLogo) {
                    console.warn("⚠️ [AUTH LOGO] Database logo failed to load, using default logo");
                    img.src = defaultLogo;
                  } else {
                    // If default also fails, show fallback icon
                    img.style.display = 'none';
                    const parent = img.parentElement;
                    if (parent && !parent.querySelector('.logo-fallback')) {
                      const fallback = document.createElement('div');
                      fallback.className = 'logo-fallback w-12 h-12 sm:w-16 sm:h-16 bg-blue-600 rounded-full flex items-center justify-center';
                      fallback.style.backgroundColor = clubBranding?.skinColor || '#3b82f6';
                      fallback.innerHTML = `<span class="text-white font-bold text-xl sm:text-2xl">${clubBranding?.clubName?.[0] || 'C'}</span>`;
                      parent.appendChild(fallback);
                    }
                  }
                }}
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
                  className={`flex-1 py-2.5 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-medium border-b-2 transition-colors min-h-[44px] sm:min-h-[48px] flex items-center justify-center ${activeTab === "signin"
                      ? "border-blue-500 text-blue-400"
                      : "border-transparent text-gray-400 hover:text-white"
                    }`}
                >
                  Log In
                </button>
                <button
                  onClick={() => setActiveTab("signup")}
                  className={`flex-1 py-2.5 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-medium border-b-2 transition-colors min-h-[44px] sm:min-h-[48px] flex items-center justify-center ${activeTab === "signup"
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

                  // Console log the API response to verify gradient and skinColor
                  console.log("🎨 [AUTH] API Response for club code:", trimmedCode, result);
                  console.log("🎨 [AUTH] Gradient from API:", result.gradient);
                  console.log("🎨 [AUTH] Skin Color from API:", result.skinColor || result.skin_color);

                  if (result.valid === true) {
                    // Club code is valid - grant access
                    const clubId = result.clubId || result.id;
                    setClubCodeVerified(true);
                    setClubCodeError("");
                    sessionStorage.setItem("club_code_verified", trimmedCode);
                    sessionStorage.setItem("club_id", clubId);
                    sessionStorage.setItem("clubId", clubId); // Also store with camelCase for API
                    sessionStorage.setItem("clubCode", trimmedCode); // Store club code
                    sessionStorage.setItem("club_name", result.clubName || result.name || "");

                    // Always fetch full branding from the branding endpoint after verifying code
                    try {
                      console.log("🎨 [AUTH] Fetching full branding from API for club ID:", clubId);

                      // Always fetch from branding endpoint to ensure we have the latest data from Supabase
                      if (clubId) {
                        console.log(`🔄 [AUTH] Fetching branding from /clubs/${clubId}/branding endpoint...`);
                        const fetchedBranding = await fetchClubBranding(clubId);
                        if (fetchedBranding) {
                          console.log("✅ [AUTH] Branding fetched from API successfully:", {
                            gradient: fetchedBranding.gradient,
                            skinColor: fetchedBranding.skinColor,
                            logoUrl: fetchedBranding.logoUrl
                          });
                          setClubBranding(fetchedBranding);
                          applyClubBranding(fetchedBranding);
                          // Store branding for use across app
                          sessionStorage.setItem("club_branding", JSON.stringify(fetchedBranding));
                        } else {
                          // Fallback: try to create branding from verify response if API call fails
                          console.warn("⚠️ [AUTH] Failed to fetch from branding endpoint, trying verify response data...");
                          const branding = createBrandingFromVerifyResponse(result, trimmedCode);
                          if (branding) {
                            console.log("✅ [AUTH] Using branding from verify response");
                            setClubBranding(branding);
                            applyClubBranding(branding);
                            sessionStorage.setItem("club_branding", JSON.stringify(branding));
                          } else {
                            console.warn("⚠️ [AUTH] No branding available, using defaults");
                          }
                        }
                      } else {
                        console.error("❌ [AUTH] No clubId found in verify response");
                      }
                    } catch (brandingError) {
                      console.error("❌ [AUTH] Failed to load club branding:", brandingError);
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
                  className="w-full hover:opacity-90 text-white font-medium py-2.5 sm:py-3 h-11 sm:h-12 mt-4 sm:mt-6 text-sm sm:text-base min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: clubBranding?.skinColor || '#3b82f6' }}
                >
                  {loading
                    ? "Please wait..."
                    : activeTab === "signin"
                      ? "Log In"
                      : "Sign Up"}
                </Button>

                <div className="mt-4 text-center">
                  <Button
                    type="button"
                    variant="link"
                    className="text-gray-400 hover:text-white"
                    onClick={() => {
                      setClubCodeVerified(false);
                      setClubCodeInput('');
                      setClubBranding(null);
                      localStorage.removeItem('clubId');
                      sessionStorage.removeItem('clubId');
                      localStorage.removeItem('clubCode');
                      sessionStorage.removeItem('clubCode');
                      sessionStorage.removeItem('club_code_verified');
                      sessionStorage.removeItem('club_id');
                      sessionStorage.removeItem('club_name');
                      sessionStorage.removeItem('club_branding');
                      window.location.reload();
                    }}
                  >
                    Change Club
                  </Button>
                </div>
              </form>
            </>
          )}
        </CardContent>
      </Card>

      {/* Terms & Conditions Modal */}
      <Dialog open={showTermsModal} onOpenChange={setShowTermsModal}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-2xl w-[95vw] sm:w-full max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center text-lg sm:text-xl" style={{ color: clubBranding?.skinColor || '#10b981' }}>
              <FileText className="w-5 h-5 mr-2" />
              Terms & Conditions
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-sm">
              Please read and accept the terms and conditions to continue
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-2 py-4">
            <div className="prose prose-invert max-w-none">
              {clubBranding?.termsAndConditions ? (
                <div
                  className="text-slate-300 text-sm sm:text-base whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{
                    __html: clubBranding.termsAndConditions
                  }}
                />
              ) : (
                <div className="text-slate-300 text-sm sm:text-base space-y-3">
                  <p className="font-semibold text-base sm:text-lg" style={{ color: clubBranding?.skinColor || '#10b981' }}>
                    Play at Your Own Risk
                  </p>
                  <p>
                    By using this platform, you acknowledge that gambling involves risk. Please play responsibly and within your means.
                  </p>
                  <p>
                    If you feel you may have a gambling problem, please seek help immediately.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2 pt-4 border-t border-slate-700">
            <Checkbox
              id="terms-accept"
              checked={termsAccepted}
              onCheckedChange={(v) => setTermsAccepted(!!v)}
              className="h-4 w-4 min-h-[16px] min-w-[16px] max-h-[16px] max-w-[16px] shrink-0 rounded border-gray-600 bg-gray-800 data-[state=checked]:border-current data-[state=checked]:text-white"
              style={{ '--checkbox-color': clubBranding?.skinColor || '#3b82f6' } as any}
            />
            <label
              htmlFor="terms-accept"
              className="text-xs sm:text-sm text-slate-300 select-none cursor-pointer flex-1"
            >
              I have read and agree to the Terms & Conditions
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowTermsModal(false);
                setTermsAccepted(false);
                setPendingKycRedirect(null);
              }}
              className="flex-1 hover:opacity-90"
              style={clubBranding ? { borderColor: clubBranding.skinColor, color: clubBranding.skinColor } : {}}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!termsAccepted) {
                  toast({
                    title: "Acceptance Required",
                    description: "Please accept the Terms & Conditions to continue",
                    variant: "destructive",
                  });
                  return;
                }

                if (pendingKycRedirect) {
                  // Store KYC redirect data
                  sessionStorage.setItem('kyc_flow_active', 'true');
                  sessionStorage.setItem('kyc_redirect', JSON.stringify(pendingKycRedirect));

                  // Close modal and redirect
                  setShowTermsModal(false);
                  setTermsAccepted(false);

                  setTimeout(() => {
                    window.location.href = '/kyc';
                  }, 300);
                }
              }}
              disabled={!termsAccepted}
              className="flex-1 hover:opacity-90 text-white font-medium min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: clubBranding?.skinColor || '#3b82f6' }}
            >
              Accept & Continue
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Password Reset Modal (for login) */}
      <Dialog open={showPasswordResetModal} onOpenChange={setShowPasswordResetModal}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md w-[95vw] sm:w-full">
          <DialogHeader>
            <DialogTitle className="flex items-center text-lg sm:text-xl" style={{ color: clubBranding?.skinColor || '#10b981' }}>
              <ShieldCheck className="w-5 h-5 mr-2" />
              Password Reset Required
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-sm">
              You must update your password before logging in
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="relative">
              <Input
                type={showNewPassword ? "text" : "password"}
                placeholder="New Password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 h-11 sm:h-12 pr-11 sm:pr-12 text-sm sm:text-base"
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white h-7 w-7 sm:h-8 sm:w-8 p-0"
                onClick={() => setShowNewPassword(!showNewPassword)}
              >
                {showNewPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </Button>
            </div>

            <div className="relative">
              <Input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm New Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 h-11 sm:h-12 pr-11 sm:pr-12 text-sm sm:text-base"
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white h-7 w-7 sm:h-8 sm:w-8 p-0"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </Button>
            </div>

            {newPassword && confirmPassword && newPassword !== confirmPassword && (
              <p className="text-red-500 text-xs">Passwords do not match</p>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowPasswordResetModal(false);
                setNewPassword("");
                setConfirmPassword("");
                setPendingLoginCredentials(null);
              }}
              className="flex-1 hover:opacity-90"
              style={clubBranding ? { borderColor: clubBranding.skinColor, color: clubBranding.skinColor } : {}}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!newPassword || !confirmPassword) {
                  toast({
                    title: "Password Required",
                    description: "Please enter and confirm your new password",
                    variant: "destructive",
                  });
                  return;
                }

                if (newPassword !== confirmPassword) {
                  toast({
                    title: "Password Mismatch",
                    description: "Passwords do not match",
                    variant: "destructive",
                  });
                  return;
                }

                if (newPassword.length < 6) {
                  toast({
                    title: "Password Too Short",
                    description: "Password must be at least 6 characters",
                    variant: "destructive",
                  });
                  return;
                }

                setPasswordResetLoading(true);
                try {
                  console.log("🔐 [PASSWORD RESET] Calling reset password API for:", pendingLoginCredentials?.email);

                  // Call API to reset password with current/temporary password for security
                  const response = await fetch(`${API_BASE_URL}/auth/player/reset-password`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      email: pendingLoginCredentials?.email,
                      currentPassword: pendingLoginCredentials?.password, // ✅ Player just typed this to login
                      newPassword: newPassword,
                      clubCode: pendingLoginCredentials?.clubCode,
                    }),
                  });

                  if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ message: 'Failed to reset password' }));
                    throw new Error(errorData.message || 'Failed to reset password');
                  }

                  const result = await response.json();
                  console.log("🔐 [PASSWORD RESET] API response:", result);

                  if (result.success) {
                    console.log("✅ [PASSWORD RESET] Password updated successfully");
                    toast({
                      title: "Password Updated",
                      description: "Your password has been updated successfully. Logging you in...",
                    });

                    // Close modal and clear state
                    setShowPasswordResetModal(false);
                    setNewPassword("");
                    setConfirmPassword("");

                    // Store credentials temporarily for login
                    const email = pendingLoginCredentials?.email;
                    const clubCode = pendingLoginCredentials?.clubCode;
                    setPendingLoginCredentials(null);

                    // Now attempt login with new password
                    if (email && clubCode) {
                      console.log("🔐 [PASSWORD RESET] Attempting login with new password");
                      setTimeout(async () => {
                        setLoading(true);
                        const loginResult = await signIn(
                          email,
                          newPassword,
                          clubCode
                        );
                        setLoading(false);
                        console.log("🔐 [PASSWORD RESET] Login result after password reset:", loginResult);
                        if (!loginResult.success && !loginResult.mustResetPassword) {
                          toast({
                            title: "Login Failed",
                            description: "Please try logging in again with your new password",
                            variant: "destructive",
                          });
                        }
                      }, 500);
                    }
                  } else {
                    throw new Error(result.message || "Failed to update password");
                  }
                } catch (error: any) {
                  console.error("❌ [PASSWORD RESET] Password reset error:", error);
                  toast({
                    title: "Password Reset Failed",
                    description: error.message || "Failed to update password. Please try again.",
                    variant: "destructive",
                  });
                } finally {
                  setPasswordResetLoading(false);
                }
              }}
              disabled={passwordResetLoading || !newPassword || !confirmPassword || newPassword !== confirmPassword}
              className="flex-1 hover:opacity-90 text-white font-medium min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: clubBranding?.skinColor || '#3b82f6' }}
            >
              {passwordResetLoading ? "Updating..." : "Update Password"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}