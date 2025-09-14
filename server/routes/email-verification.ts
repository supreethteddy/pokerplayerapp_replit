import express from 'express';
import { supabase } from '../supabase';

const router = express.Router();

// --- SEND CONFIRM-SIGNUP EMAIL ---
router.post('/send-verification', async (req, res) => {
  try {
    const { email, playerId, firstName, password } = req.body;
    if (!email || !playerId) return res.status(400).json({ error: 'Email and playerId required' });

    const { createClient } = await import('@supabase/supabase-js');
    const supabaseAnon = createClient(
      process.env.VITE_SUPABASE_URL!,              // already provided
      process.env.VITE_SUPABASE_ANON_KEY!         // already provided
    );

    // Supabase will confirm the auth user and then send user to this bridge,
    // where WE set players.email_verified=TRUE and finally redirect to login.
    const redirectAfterConfirm =
      `${process.env.PUBLIC_API_URL}/api/email-verification/confirm-bridge?email=${encodeURIComponent(email)}`;

    // 1) Try signup -> sends "Confirm signup" email using your Supabase SMTP/template
    const { error: signErr } = await supabaseAnon.auth.signUp({
      email,
      password: password || 'Temp#' + Math.random().toString(36).slice(2),
      options: { emailRedirectTo: redirectAfterConfirm }
    });

    // 2) If already registered and not confirmed -> resend confirm-signup
    if (signErr && /registered|exists/i.test(signErr.message || '')) {
      const { error: reErr } = await supabaseAnon.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: redirectAfterConfirm }
      });
      if (reErr) {
        console.error('❌ [RESEND SIGNUP]', reErr);
        return res.status(500).json({ error: 'Failed to resend confirmation email' });
      }
    } else if (signErr) {
      console.error('❌ [SIGNUP EMAIL]', signErr);
      return res.status(500).json({ error: 'Failed to send confirmation email' });
    }

    return res.json({ success: true, message: 'Confirmation email sent' });
  } catch (e) {
    console.error('❌ [SEND CONFIRM SIGNUP]', e);
    return res.status(500).json({ error: 'Failed to send confirmation email' });
  }
});

// --- BRIDGE: set email_verified then redirect to login ---
router.get('/confirm-bridge', async (req, res) => {
  try {
    const email = String(req.query.email || '');
    if (!email) return res.status(400).json({ error: 'Email required' });

    // 1) UPDATE FIRST
    const { error: updateError } = await supabase
      .from('players')
      .update({ email_verified: true, updated_at: new Date().toISOString() })
      .eq('email', email);

    if (updateError) {
      console.error('❌ [CONFIRM BRIDGE] Player update error:', updateError);
      return res.status(500).json({ error: 'Failed to verify email' });
    }

    // 2) REDIRECT TO LOGIN (same origin)
    return res.redirect(`${process.env.PUBLIC_APP_URL}/?verified=true`);
  } catch (e) {
    console.error('❌ [CONFIRM BRIDGE]', e);
    return res.status(500).json({ error: 'Bridge error' });
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

      }

    // 1) UPDATE FIRST
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

    // 2) THEN DELETE TOKEN (if provided)
    if (token) {
      await supabase
        .from('email_verification_tokens')
        .delete()
        .eq('token', token)
        .eq('email', email);
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
    const token = String(req.query.token || '');
    const email = String(req.query.email || '');

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

    // 1) UPDATE FIRST
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

    // 2) DELETE TOKEN
    await supabase
      .from('email_verification_tokens')
      .delete()
      .eq('token', token)
      .eq('email', email);

    console.log(`✅ [EMAIL VERIFICATION] Email verified for player ${tokenData.player_id}`);

    // 3) REDIRECT TO LOGIN PAGE ON FRONTEND
    res.redirect(`${process.env.PUBLIC_APP_URL}/?verified=true`);

  } catch (error) {
    console.error('❌ [EMAIL VERIFICATION] Verify error:', error);
    res.status(500).json({ error: 'Email verification failed' });
  }
});

export default router;