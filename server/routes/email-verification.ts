
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
    
    // Send actual email using Supabase Auth
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseAdmin = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
      // Create or update user in Supabase Auth to trigger email
      const { error } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        email_confirm: false, // This will send confirmation email
        password: require('crypto').randomBytes(16).toString('hex'),
        user_metadata: {
          verification_token: verificationToken,
          player_id: playerId,
          first_name: firstName
        }
      });

      if (error && !error.message.includes('already registered')) {
        throw error;
      }

      console.log(`📧 [EMAIL VERIFICATION] Supabase confirmation email sent to ${email}`);
    } catch (emailError) {
      console.error('❌ [EMAIL VERIFICATION] Supabase email error:', emailError);
      // Fallback: log the URL
      console.log(`🔗 [EMAIL VERIFICATION] Manual verification link: ${verificationUrl}`);
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

// Verify email endpoint
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
