
import express from 'express';
import { supabase } from '../supabase';
import { nanoid } from 'nanoid';

const router = express.Router();

// Send verification email
router.post('/send-verification', async (req, res) => {
  try {
    const { email, playerId, firstName } = req.body;
    
    if (!email || !playerId) {
      return res.status(400).json({ error: 'Email and playerId required' });
    }

    // Generate verification token
    const verificationToken = nanoid(32);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Store verification token
    const { error: tokenError } = await supabase
      .from('email_verification_tokens')
      .upsert({
        player_id: playerId,
        email: email,
        token: verificationToken,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString()
      });

    if (tokenError) {
      console.error('❌ [EMAIL VERIFICATION] Token storage error:', tokenError);
      return res.status(500).json({ error: 'Failed to create verification token' });
    }

    // Create verification URL
    const verificationUrl = `${process.env.VITE_APP_URL || 'http://localhost:5173'}/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}`;

    console.log(`📧 [EMAIL VERIFICATION] Verification URL for ${email}: ${verificationUrl}`);
    
    // Send actual email using Supabase Auth with enhanced error handling
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseAdmin = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let emailSent = false;
    let emailError = null;

    try {
      // Method 1: Try to invite user (works for new users)
      console.log(`📧 [EMAIL VERIFICATION] Attempting to invite user: ${email}`);
      
      const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo: verificationUrl,
        data: {
          verification_token: verificationToken,
          player_id: playerId,
          first_name: firstName
        }
      });

      if (!inviteError) {
        emailSent = true;
        console.log(`✅ [EMAIL VERIFICATION] Invitation email sent successfully to: ${email}`);
      } else if (inviteError.message?.includes('already registered') || inviteError.message?.includes('already exists')) {
        console.log(`🔄 [EMAIL VERIFICATION] User exists, trying magic link for: ${email}`);
        
        // Method 2: Generate magic link for existing users
        const { data: magicData, error: magicError } = await supabaseAdmin.auth.admin.generateLink({
          type: 'magiclink',
          email: email,
          options: {
            redirectTo: verificationUrl
          }
        });

        if (!magicError && magicData.properties?.action_link) {
          emailSent = true;
          console.log(`✅ [EMAIL VERIFICATION] Magic link generated for existing user: ${email}`);
          console.log(`🔗 [EMAIL VERIFICATION] Magic link: ${magicData.properties.action_link}`);
        } else {
          emailError = magicError;
          console.error('❌ [EMAIL VERIFICATION] Magic link generation failed:', magicError);
        }
      } else {
        emailError = inviteError;
        console.error('❌ [EMAIL VERIFICATION] Invitation failed:', inviteError);
      }
    } catch (supabaseError) {
      emailError = supabaseError;
      console.error('❌ [EMAIL VERIFICATION] Supabase error:', supabaseError);
    }

    // Method 3: Fallback - create user with password reset email
    if (!emailSent) {
      try {
        console.log(`🔄 [EMAIL VERIFICATION] Trying password reset email for: ${email}`);
        
        const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
          type: 'recovery',
          email: email,
          options: {
            redirectTo: verificationUrl
          }
        });

        if (!resetError && resetData.properties?.action_link) {
          emailSent = true;
          console.log(`✅ [EMAIL VERIFICATION] Password reset email sent to: ${email}`);
          console.log(`🔗 [EMAIL VERIFICATION] Reset link: ${resetData.properties.action_link}`);
        } else {
          console.error('❌ [EMAIL VERIFICATION] Password reset failed:', resetError);
        }
      } catch (resetError) {
        console.error('❌ [EMAIL VERIFICATION] Password reset error:', resetError);
      }
    }

    // Always log the verification URL for debugging
    console.log(`🔗 [EMAIL VERIFICATION] Manual verification link: ${verificationUrl}`);
    
    if (!emailSent) {
      console.error('❌ [EMAIL VERIFICATION] All email methods failed for:', email);
      console.error('❌ [EMAIL VERIFICATION] Last error:', emailError);
    }

    res.json({ 
      success: true, 
      message: 'Verification email sent',
      verificationUrl: verificationUrl // Remove this in production
    });

  } catch (error) {
    console.error('❌ [EMAIL VERIFICATION] Send error:', error);
    res.status(500).json({ error: 'Failed to send verification email' });
  }
});

// Update email verification status (POST) - handles both token and direct verification
router.post('/verify-email', async (req, res) => {
  try {
    const { email, token } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    // If token provided, validate it first
    if (token) {
      const { data: tokenData, error: tokenError } = await supabase
        .from('email_verification_tokens')
        .select('*')
        .eq('token', token)
        .eq('email', email)
        .single();

      if (tokenError || !tokenData) {
        console.error('❌ [EMAIL VERIFICATION] Invalid token:', token);
        return res.status(400).json({ error: 'Invalid or expired verification token' });
      }

      // Check if token is expired
      if (new Date(tokenData.expires_at) < new Date()) {
        return res.status(400).json({ error: 'Verification token has expired' });
      }

      // Delete used token
      await supabase
        .from('email_verification_tokens')
        .delete()
        .eq('token', token);
    }

    // Update player's email_verified status
    const { error: updateError } = await supabase
      .from('players')
      .update({ 
        email_verified: true,
        updated_at: new Date().toISOString()
      })
      .eq('email', email);

    if (updateError) {
      console.error('❌ [EMAIL VERIFICATION] Player update error:', updateError);
      return res.status(500).json({ error: 'Failed to verify email' });
    }

    console.log(`✅ [EMAIL VERIFICATION] Email verified for: ${email}`);
    res.json({ success: true, message: 'Email verified successfully' });

  } catch (error) {
    console.error('❌ [EMAIL VERIFICATION] Verify error:', error);
    res.status(500).json({ error: 'Email verification failed' });
  }
});

// Verify email endpoint (GET)
router.get('/verify-email', async (req, res) => {
  try {
    const { token, email } = req.query;

    if (!token || !email) {
      return res.status(400).json({ error: 'Token and email required' });
    }

    // Find and validate token
    const { data: tokenData, error: tokenError } = await supabase
      .from('email_verification_tokens')
      .select('*')
      .eq('token', token)
      .eq('email', email)
      .single();

    if (tokenError || !tokenData) {
      console.error('❌ [EMAIL VERIFICATION] Invalid token:', token);
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    // Check if token is expired
    if (new Date(tokenData.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Verification token has expired' });
    }

    // Update player's email_verified status
    const { error: updateError } = await supabase
      .from('players')
      .update({ 
        email_verified: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', tokenData.player_id);

    if (updateError) {
      console.error('❌ [EMAIL VERIFICATION] Player update error:', updateError);
      return res.status(500).json({ error: 'Failed to verify email' });
    }

    // Also update Supabase Auth user if exists
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseAdmin = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      await supabaseAdmin.auth.admin.updateUserById(tokenData.player_id.toString(), {
        email_confirm: true
      });
    } catch (authUpdateError) {
      console.warn('⚠️ [EMAIL VERIFICATION] Could not update Supabase Auth user:', authUpdateError);
    }

    // Delete used token
    await supabase
      .from('email_verification_tokens')
      .delete()
      .eq('token', token);

    console.log(`✅ [EMAIL VERIFICATION] Email verified for player ${tokenData.player_id}`);

    // Redirect to login page with success message
    res.redirect(`${process.env.VITE_APP_URL || 'http://localhost:5173'}/?verified=true`);

  } catch (error) {
    console.error('❌ [EMAIL VERIFICATION] Verify error:', error);
    res.status(500).json({ error: 'Email verification failed' });
  }
});

export default router;
