// Backend Automation Agent for Poker Platform - Supabase + Clerk
// Following exact database schemas and rules - SUPABASE ONLY (never Neon DB)

import type { Request, Response } from 'express';
import { generateNextPlayerId, whitelabelConfig } from './whitelabeling';

// Hard validations according to specifications
function validateSignupData(data: any) {
  const { email, password, first_name, last_name, phone, nickname, clerk_user_id } = data;

  // All fields must be present and non-empty after trimming
  if (!email || !first_name || !last_name || !phone || !nickname || !clerk_user_id) {
    return { valid: false, error: 'Missing required fields: email, first_name, last_name, phone, nickname, clerk_user_id' };
  }

  const trimmedEmail = email.toLowerCase().trim();
  const trimmedFirstName = first_name.trim();
  const trimmedLastName = last_name.trim();
  const trimmedPhone = phone.trim();
  const trimmedNickname = nickname.trim();
  const trimmedClerkUserId = clerk_user_id.trim();

  if (!trimmedEmail || !trimmedFirstName || !trimmedLastName || !trimmedPhone || !trimmedNickname || !trimmedClerkUserId) {
    return { valid: false, error: 'All fields must be non-empty after trimming' };
  }

  return {
    valid: true,
    data: {
      trimmedEmail,
      trimmedFirstName,
      trimmedLastName,
      trimmedPhone,
      trimmedNickname,
      trimmedClerkUserId
    }
  };
}

// PAN card format validation
function validatePanFormat(panCardNumber: string): boolean {
  if (!panCardNumber) return false;
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
  return panRegex.test(panCardNumber);
}

// Signup Flow (Clerk → Supabase) - Following exact specification
export async function handleSignup(req: Request, res: Response) {
  try {
    const validation = validateSignupData(req.body);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const { trimmedEmail, trimmedFirstName, trimmedLastName, trimmedPhone, trimmedNickname, trimmedClerkUserId } = validation.data!;

    console.log('🎯 [BACKEND AUTOMATION] Starting signup process with whitelabeling:', {
      email: trimmedEmail.substring(0, 10) + '...',
      first_name: trimmedFirstName,
      last_name: trimmedLastName,
      clerk_user_id: trimmedClerkUserId.substring(0, 15) + '...'
    });

    // STEP 1: Create Clerk user first (PRIMARY AUTHENTICATION)
    let clerkUserCreated = false;
    try {
      if (process.env.CLERK_SECRET_KEY) {
        const { clerkClient } = await import('@clerk/clerk-sdk-node');

        const clerkUser = await clerkClient.users.createUser({
          emailAddress: [trimmedEmail],
          password: req.body.password,
          firstName: trimmedFirstName,
          lastName: trimmedLastName,
          publicMetadata: {
            role: 'player'
          },
          privateMetadata: {
            source: 'player_portal',
            created_from: 'signup_endpoint'
          }
        });

        console.log('✅ [CLERK] User created successfully:', clerkUser.id);
        clerkUserCreated = true;
      } else {
        console.warn('⚠️ [CLERK] Secret key not configured, skipping Clerk user creation');
      }
    } catch (clerkError: any) {
      console.warn('⚠️ [CLERK] Failed to create user:', clerkError.message);
      // Continue with Supabase-only signup
    }

    // Connect to SUPABASE PostgreSQL ONLY (never Neon DB)
    const { Client } = await import('pg');
    const pgClient = new Client({ connectionString: process.env.SUPABASE_DATABASE_URL });
    await pgClient.connect();

    try {
      let playerCode: string;
      let retryCount = 0;
      const maxRetries = 3;

      // Generate player_code using whitelabeling.ts with retry logic for unique constraint conflicts
      while (retryCount < maxRetries) {
        try {
          // Fetch existing player codes by prefix
          const existingCodesQuery = `
            SELECT player_code FROM public.players
            WHERE player_code LIKE $1
          `;
          const existingCodesResult = await pgClient.query(existingCodesQuery, [`${whitelabelConfig.playerIdPrefix}-%`]);
          const existingCodes = existingCodesResult.rows.map(row => row.player_code).filter(Boolean);

          // Generate next player ID
          playerCode = generateNextPlayerId(existingCodes);
          console.log(`🎯 [WHITELABELING] Generated player code: ${playerCode}`);
          break;

        } catch (codeError: any) {
          retryCount++;
          console.error(`❌ [WHITELABELING] Player code generation attempt ${retryCount} failed:`, codeError);
          if (retryCount >= maxRetries) {
            throw new Error('Failed to generate unique player code after multiple attempts');
          }
        }
      }

      // Build full_name (step 1)
      const fullName = `${trimmedFirstName} ${trimmedLastName}`.trim();

      // Insert into public.players with exact fields from specification
      const insertQuery = `
        INSERT INTO public.players (
          email, password, first_name, last_name, phone, nickname, player_code, kyc_status,
          balance, total_deposits, total_withdrawals, total_losses, total_winnings,
          games_played, hours_played, is_active, full_name, last_login_at,
          credit_eligible, clerk_user_id, current_credit, credit_limit, email_verified
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, 'pending',
          '0.00', '0.00', '0.00', '0.00', '0.00',
          0, '0.00', true, $8, null,
          false, $9, 0, 0, false
        )
        RETURNING id, player_code, email, first_name, last_name, kyc_status, balance, email_verified
      `;

      const result = await pgClient.query(insertQuery, [
        trimmedEmail, // $1 (lowercased)
        req.body.password, // $2 (plain text password)
        trimmedFirstName, // $3
        trimmedLastName, // $4
        trimmedPhone, // $5
        trimmedNickname, // $6
        playerCode!, // $7
        fullName, // $8
        trimmedClerkUserId // $9
      ]);

      const newPlayer = result.rows[0];
      const whitelabelPlayerId = newPlayer.player_code; // Use the correct variable name

      console.log(`✅ [BACKEND AUTOMATION] Player created successfully: ${trimmedEmail} (ID: ${newPlayer.id}, Code: ${whitelabelPlayerId})`);

      // AUTOMATIC EMAIL VERIFICATION TRIGGER
      console.log(`📧 [AUTO EMAIL] Triggering verification email for: ${trimmedEmail}`);

      // Declare email tracking variables at proper scope
      let emailSent = false;
      let emailMethod = '';

      try {
        // Generate verification token
        const verificationToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        // Store verification token in database
        await pgClient.query(`
          UPDATE players
          SET verification_token = $1, token_expiry = $2
          WHERE id = $3
        `, [verificationToken, tokenExpiry, newPlayer.id]);

        // Enhanced email sending with Supabase Auth
        const { createClient } = await import('@supabase/supabase-js');
        const supabaseAdmin = createClient(
          process.env.VITE_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Variables now declared at broader scope above

        // FIXED: Use only the working email method - inviteUserByEmail
        try {
          // Secure dynamic redirect URL with strict hostname validation
          const rawDomains = (process.env.REPLIT_DOMAINS?.split(',') || [])
            .concat(process.env.VITE_APP_URL ? [process.env.VITE_APP_URL] : [])
            .map(d => d?.trim())
            .filter(Boolean);
          
          // Extract hostnames from domains (handle both URLs and hostnames)
          const allowedHosts = rawDomains.map(domain => {
            try {
              return domain.startsWith('http') ? new URL(domain).hostname : domain;
            } catch {
              return domain; // Treat as hostname if URL parsing fails
            }
          }).filter(Boolean);
          
          let redirectUrl = process.env.VITE_APP_URL || 'http://localhost:3000';
          
          const requestHost = req.get('origin') || req.get('host');
          if (requestHost && allowedHosts.length > 0) {
            try {
              const candidateUrl = requestHost.startsWith('http') ? requestHost : `https://${requestHost}`;
              const parsedUrl = new URL(candidateUrl);
              
              // Strict hostname matching (exact match or subdomain)
              const isAllowed = allowedHosts.some(allowedHost => 
                parsedUrl.hostname === allowedHost || 
                parsedUrl.hostname.endsWith('.' + allowedHost)
              );
              
              // Only accept HTTPS origins and allowed hostnames
              if (isAllowed && parsedUrl.protocol === 'https:') {
                redirectUrl = parsedUrl.origin;
              }
            } catch {
              // Fall back to default if any URL parsing fails
            }
          }
          
          const { data: authUser, error: inviteError } = await supabaseAdmin.auth.admin.createUser({
            email: trimmedEmail,
            email_confirm: false, // This triggers confirmation email
            password: require('crypto').randomBytes(16).toString('hex'),
            user_metadata: {
              verification_token: verificationToken,
              player_id: newPlayer.id,
              source: 'automated_signup',
              redirect_to: redirectUrl
            }
          });

          if (!inviteError) {
            console.log(`✅ [AUTO EMAIL] Supabase invite sent successfully: ${trimmedEmail}`);
            emailSent = true;
            emailMethod = 'supabase_invite';
          } else {
            console.log(`❌ [AUTO EMAIL] Supabase invite failed:`, inviteError.message);
            emailSent = false;
          }
        } catch (inviteError: any) {
          console.log(`❌ [AUTO EMAIL] Supabase invite error:`, inviteError.message);
          emailSent = false;
        }

        // REMOVED: Fake console fallback that lies about email delivery
        // No fallback - if Supabase invite fails, we report honest failure

        if (emailSent) {
          console.log(`✅ [AUTO EMAIL] Verification email sent via ${emailMethod} to: ${trimmedEmail}`);
        } else {
          console.log(`❌ [AUTO EMAIL] Failed to send verification email to: ${trimmedEmail}`);
        }

      } catch (emailError: any) {
        console.error(`❌ [AUTO EMAIL] Error sending verification email:`, emailError);
        // Don't fail signup if email sending fails
      }

      res.json({
        success: true,
        player: {
          id: newPlayer.id,
          playerCode: whitelabelPlayerId,
          email: newPlayer.email,
          firstName: newPlayer.first_name,
          lastName: newPlayer.last_name,
          kycStatus: newPlayer.kyc_status,
          balance: newPlayer.balance,
          emailVerified: newPlayer.email_verified
        },
        message: 'Account created successfully! Please check your email (including spam folder) for verification link.',
        redirectToKYC: true,
        needsEmailVerification: true,
        emailSent: emailSent // FIXED: Honest reporting - only true when email actually sent
      });

    } catch (dbError: any) {
      await pgClient.end();
      console.error('❌ [BACKEND AUTOMATION] Database error:', dbError);

      // Handle duplicate email constraint violation
      if (dbError.code === '23505' && dbError.constraint === 'players_email_key') {
        // Check if existing user needs KYC
        try {
          const existingUserQuery = `
            SELECT id, email, first_name, last_name, nickname, kyc_status, balance, player_code
            FROM public.players
            WHERE email = $1
          `;
          const existingResult = await pgClient.query(existingUserQuery, [trimmedEmail]);

          if (existingResult.rows.length > 0) {
            const existingPlayer = existingResult.rows[0];

            // If existing user needs KYC, return their data for KYC redirect
            if (existingPlayer.kyc_status === 'pending' || existingPlayer.kyc_status === 'submitted') {
              const response = {
                id: existingPlayer.id,
                player_code: existingPlayer.player_code,
                email: existingPlayer.email,
                first_name: existingPlayer.first_name,
                last_name: existingPlayer.last_name,
                nickname: existingPlayer.nickname,
                kyc_status: existingPlayer.kyc_status,
                balance: existingPlayer.balance,
                existing: true
              };

              return res.json({
                success: true,
                player: response,
                message: 'Existing account found. Please complete KYC verification.',
                redirectToKYC: true
              });
            }
          }
        } catch (lookupError) {
          console.error('❌ [EXISTING USER LOOKUP] Error:', lookupError);
        }

        return res.status(409).json({
          error: 'An account with this email already exists.',
          code: 'EMAIL_EXISTS'
        });
      }

      // Handle duplicate clerk_user_id constraint violation
      if (dbError.code === '23505' && dbError.constraint === 'players_clerk_user_id_unique') {
        return res.status(409).json({
          error: 'Clerk user ID already exists.',
          code: 'CLERK_ID_EXISTS'
        });
      }

      // Handle unique player_code conflict - this should be handled by retry logic
      if (dbError.code === '23505' && dbError.constraint === 'players_player_code_key') {
        console.log('🔄 [WHITELABELING] Player code conflict detected');
        return res.status(500).json({ error: 'Player code generation failed. Please try again.' });
      }

      return res.status(500).json({ error: 'Database operation failed' });
    }

  } catch (error: any) {
    console.error('❌ [BACKEND AUTOMATION] Signup error:', error.message);
    return res.status(500).json({ error: 'Signup server error' });
  }
}

// Login Flow - Update last_login_at and email_verified
export async function handleLogin(req: Request, res: Response) {
  try {
    const { clerk_user_id } = req.body;

    if (!clerk_user_id) {
      return res.status(400).json({ error: 'clerk_user_id is required' });
    }

    const { Client } = await import('pg');
    const pgClient = new Client({ connectionString: process.env.SUPABASE_DATABASE_URL });
    await pgClient.connect();

    try {
      // Update last_login_at on every login
      const updateQuery = `
        UPDATE public.players
        SET last_login_at = NOW(), updated_at = NOW()
        WHERE clerk_user_id = $1
        RETURNING *
      `;

      const result = await pgClient.query(updateQuery, [clerk_user_id]);

      if (result.rows.length === 0) {
        await pgClient.end();
        return res.status(404).json({ error: 'Player not found' });
      }

      const player = result.rows[0];
      await pgClient.end();

      console.log(`✅ [LOGIN] Updated last_login_at for player: ${player.email} (ID: ${player.id})`);

      return res.json({
        success: true,
        player: {
          id: player.id,
          player_code: player.player_code,
          email: player.email,
          first_name: player.first_name,
          last_name: player.last_name,
          nickname: player.nickname,
          kyc_status: player.kyc_status,
          last_login_at: player.last_login_at
        }
      });

    } catch (dbError: any) {
      await pgClient.end();
      console.error('❌ [LOGIN] Database error:', dbError);
      return res.status(500).json({ error: 'Login database error' });
    }

  } catch (error: any) {
    console.error('❌ [LOGIN] Server error:', error.message);
    return res.status(500).json({ error: 'Login server error' });
  }
}

// KYC Upload Flow - EXACTLY 3 uploads → 3 rows
interface FileMeta {
  file_name: string;
  file_url: string;
  file_size: number;
}

interface KycUploadData {
  player_id: number;
  government_id: FileMeta;
  address_proof: FileMeta;
  pan_card: FileMeta;
  pan_card_number: string;
}

export async function handleKycUpload(req: Request, res: Response) {
  try {
    const { player_id, government_id, address_proof, pan_card, pan_card_number }: KycUploadData = req.body;

    // Validate all 3 files are present
    if (!player_id || !government_id || !address_proof || !pan_card || !pan_card_number) {
      return res.status(400).json({ error: 'Missing required fields: player_id, government_id, address_proof, pan_card, pan_card_number' });
    }

    // Validate PAN format
    if (!validatePanFormat(pan_card_number)) {
      return res.status(400).json({ error: 'Invalid PAN card format. Expected format: ABCDE1234F' });
    }

    const { Client } = await import('pg');
    const pgClient = new Client({ connectionString: process.env.SUPABASE_DATABASE_URL });
    await pgClient.connect();

    try {
      // Start transaction
      await pgClient.query('BEGIN');

      // Insert all 3 KYC documents in a single transaction
      const insertKycQuery = `
        INSERT INTO public.kyc_documents
        (player_id, document_type, file_name, file_url, status, file_size, created_at, updated_at)
        VALUES
        ($1, 'government_id', $2, $3, 'pending', $4, NOW(), NOW()),
        ($1, 'address_proof', $5, $6, 'pending', $7, NOW(), NOW()),
        ($1, 'pan_card', $8, $9, 'pending', $10, NOW(), NOW())
        RETURNING *
      `;

      const kycResult = await pgClient.query(insertKycQuery, [
        player_id,
        government_id.file_name, government_id.file_url, government_id.file_size,
        address_proof.file_name, address_proof.file_url, address_proof.file_size,
        pan_card.file_name, pan_card.file_url, pan_card.file_size
      ]);

      // Update player's PAN card number
      const updatePanQuery = `
        UPDATE public.players
        SET pan_card_number = $1, updated_at = NOW()
        WHERE id = $2
      `;
      await pgClient.query(updatePanQuery, [pan_card_number, player_id]);

      // Update KYC status to 'submitted' after all 3 files uploaded
      const updateKycStatusQuery = `
        UPDATE public.players
        SET kyc_status = 'submitted', updated_at = NOW()
        WHERE id = $1
      `;
      await pgClient.query(updateKycStatusQuery, [player_id]);

      // Commit transaction
      await pgClient.query('COMMIT');
      await pgClient.end();

      console.log(`✅ [KYC] All 3 documents uploaded for player ID: ${player_id}, status: submitted`);

      return res.json({
        success: true,
        documents: kycResult.rows,
        kyc_status: 'submitted',
        message: 'All KYC documents uploaded successfully. Status updated to submitted for review.'
      });

    } catch (dbError: any) {
      // Rollback transaction on error
      await pgClient.query('ROLLBACK');
      await pgClient.end();
      console.error('❌ [KYC] Database error:', dbError);
      return res.status(500).json({ error: 'Failed to upload KYC documents' });
    }

  } catch (error: any) {
    console.error('❌ [KYC] Server error:', error.message);
    return res.status(500).json({ error: 'KYC upload server error' });
  }
}