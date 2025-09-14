RedirectTo);

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: emailRedirectTo,
          data: {
            first_name: firstName,
            last_name: lastName,
            nickname: nickname,
            phone: phone
          }
        }
      });

      // Handle existing user case - resend confirmation email
      if (signUpError?.message?.includes('already registered')) {
        console.log('📧 [EMAIL VERIFICATION] User exists, resending confirmation email');
        await supabase.auth.resend({
          type: 'signup',
          email: email,
          options: { emailRedirectTo: emailRedirectTo }
        });
        console.log('✅ [EMAIL VERIFICATION] Confirmation email resent');
      } else if (signUpError) {
        throw new Error(`Email verification setup failed: ${signUpError.message}`);
      } else {
        console.log('✅ [EMAIL VERIFICATION] Confirmation email sent via client-side signUp');
      }

      // STEP 2: BACKEND PLAYER CREATION (WITHOUT EMAIL SENDING)
      // Use our backend automation endpoint with POKEPLAYER whitelabeling system
      const response = await fetch('/api/auth/signup-automation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Skip-Email': 'true' // Flag to skip email sending in backend
        },
        body: JSON.stringify({
          email,
          password,
          first_name: firstName,
          last_name: lastName,
          phone,
          nickname,
          clerk_user_id: `user_${email.replace('@', '_').replace('.', '_')}_${Date.now()}`,
          supabase_user_id: signUpData?.user?.id
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Signup failed' }));

        // Handle duplicate email with user-friendly message
        if (response.status === 409 && errorData.code === 'EMAIL_EXISTS') {
          throw new Error('This email is already registered. Please use the login form instead.');
        }

        throw new Error(errorData.error || 'Signup failed');
      }

      const { success, player, message } = await response.json();

      if (!success) {
        throw new Error('Signup failed');
      }

      console.log('✅ [BACKEND AUTOMATION] Signup successful:', player?.email);
      console.log('🎯 [BACKEND AUTOMATION] Player created with nickname:', player?.nickname);

      // Send welcome email after successful signup
      await sendWelcomeEmail(player?.email || email, player?.firstName || firstName);

      // Handle backend automation response
      if (success && player) {
        // CRITICAL FIX: ALL SIGNUPS must go to KYC - never auto-login after signup
        const isNewPlayer = !player.existing;
        
        console.log('🎯 [SIGNUP FLOW] Player status:', {
          isNewPlayer,
          kycStatus: player.kyc_status,
          existing: player.existing,
          signupFlow: 'ALWAYS_REDIRECT_TO_KYC'
        });

        // FIXED: Always redirect signups to KYC verification (never auto-login)
        if (true) { // Always true for signup flow
          // Store KYC redirect data with proper field mapping
          const kycData = {
            id: player.id,
            playerId: player.id,
            email: player.email || email,
            firstName: player.first_name || player.firstName || firstName,
            lastName: player.last_name || player.lastName || lastName,
            nickname: player.nickname || nickname,
            kycStatus: player.kyc_status || 'pending',
            existing: player.existing || false
          };

          console.log('🎯 [KYC REDIRECT] Storing KYC data:', kycData);

          sessionStorage.setItem('kyc_redirect', JSON.stringify(kycData));
          sessionStorage.setItem('kyc_flow_active', 'true');

          // DO NOT store authenticated_user - users must complete KYC before being logged in
          console.log('🚫 [SIGNUP SECURITY] User NOT logged in - must complete KYC verification first');

          toast({
            title: isNewPlayer ? "Account Created Successfully!" : "Welcome back!",
            description: isNewPlayer ? `Welcome ${player.nickname || nickname}! Please check your email to verify your account before proceeding to KYC.` : "Please complete your KYC verification.",
          });

          // Force immediate redirect to KYC workflow
          setTimeout(() => {
            console.log('🔄 [KYC REDIRECT] Redirecting to KYC workflow');
            window.location.reload();
          }, 1000);

          return {
            success: true,
            existing: player.existing || false,
            redirectToKYC: true,
            player,
            playerData: player
          };
        }
        // REMOVED: Auto-login branch that was bypassing KYC workflow
      }

      // This should never execute for backend automation since we handle KYC above
      return { success: false, error: 'Unexpected signup flow' };

    } catch (error: any) {
      console.error('❌ [ULTRA-FAST AUTH] Sign up error:', error);
      setLoading(false);

      let errorMessage = 'Account creation failed. Please try again.';

      if (error.errors && error.errors.length > 0) {
        const errorDetail = error.errors[0];
        const code = errorDetail.code;
        const message = errorDetail.message;

        // Handle specific error codes
        switch (code) {
          case 'form_password_pwned':
            errorMessage = 'This password has been found in a data breach. Please choose a more secure password.';
            break;
          case 'form_password_length_too_short':
            errorMessage = 'Password must be at least 8 characters long.';
            break;
          case 'form_password_validation_failed':
            errorMessage = 'Password must contain at least 8 characters, including uppercase, lowercase, and a number.';
            break;
          case 'form_identifier_exists':
          case 'form_identifier_not_available':
            errorMessage = 'An account with this email already exists. Please sign in instead.';
            break;
          case 'form_param_format_invalid':
            if (message?.toLowerCase().includes('email')) {
              errorMessage = 'Please enter a valid email address.';
            } else if (message?.toLowerCase().includes('phone')) {
              errorMessage = 'Please enter a valid phone number.';
            } else {
              errorMessage = 'Please check your input format and try again.';
            }
            break;
          case 'form_param_nil':
            errorMessage = 'Please fill in all required fields.';
            break;
          default:
            // Use the original message for unhandled errors
            errorMessage = message || 'Account creation failed. Please try again.';
        }
      } else if (error.message) {
        // Handle generic error messages
        const msg = error.message.toLowerCase();
        if (msg.includes('password')) {
          errorMessage = 'Password does not meet requirements. Please use at least 8 characters with uppercase, lowercase, and numbers.';
        } else if (msg.includes('email') && msg.includes('exists')) {
          errorMessage = 'An account with this email already exists. Please sign in instead.';
        } else {
          errorMessage = error.message;
        }
      }

      toast({
        title: "Sign Up Failed",
        description: errorMessage,
        variant: "destructive",
      });

      return { success: false, error: errorMessage };
    }
  };

  const signOut = async () => {
    try {
      console.log('🚪 [ULTRA-FAST AUTH] Signing out:', user?.email);

      if (user) {
        // Log logout activity BEFORE clearing user data
        await logAuthActivity('logout', user.email, user.id);
      }

      // PURE SUPABASE: Skip Supabase auth signOut since we're not using sessions
      console.log('🎯 [PURE SUPABASE] Skipping Supabase session signOut - using players table only');

      // Show success toast BEFORE clearing state
      toast({
        title: "Signed Out",
        description: "You have been signed out successfully",
      });

      // Clear all authentication state and redirect
      await handleSignOut();

    } catch (error: any) {
      console.error('❌ [ULTRA-FAST AUTH] Sign out error:', error);

      // Even if there's an error, still clear the user state
      toast({
        title: "Signed Out",
        description: "You have been signed out successfully", // Don't show error to user
      });

      await handleSignOut();
    }
  };

  // Activity logging function
  const logAuthActivity = async (action: string, email: string, userId: string) => {
    try {
      await fetch('/api/auth/log-activity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          email,
          userId,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
        }),
      });

      console.log(`📊 [AUTH LOG] ${action.toUpperCase()} logged for:`, email);
    } catch (error) {
      console.warn('⚠️ [AUTH LOG] Failed to log activity:', error);
    }
  };

  // Welcome email function
  const sendWelcomeEmail = async (email: string, firstName: string) => {
    try {
      await fetch('/api/auth/send-welcome-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          firstName,
        }),
      });

      console.log('📧 [WELCOME EMAIL] Sent to:', email);
    } catch (error) {
      console.warn('⚠️ [WELCOME EMAIL] Failed to send:', error);
    }
  };

  return {
    user,
    loading,
    authChecked,
    signIn,
    signUp,
    signOut,
  };
}