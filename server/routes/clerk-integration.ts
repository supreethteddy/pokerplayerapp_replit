import express from 'express';
import { supabase } from '../lib/supabase';

const router = express.Router();

// Clerk webhook handler for user events
router.post('/clerk/webhook', async (req, res) => {
  try {
    const { type, data } = req.body;
    
    console.log('🔐 [CLERK WEBHOOK] Received:', type);
    
    switch (type) {
      case 'user.created':
        await handleUserCreated(data);
        break;
      case 'user.updated':
        await handleUserUpdated(data);
        break;
      case 'user.deleted':
        await handleUserDeleted(data);
        break;
      default:
        console.log('🔐 [CLERK WEBHOOK] Unhandled event:', type);
    }
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('❌ [CLERK WEBHOOK] Error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

async function handleUserCreated(userData: any) {
  try {
    const { id, email_addresses, first_name, last_name, phone_numbers, verification } = userData;
    const primaryEmail = email_addresses?.[0]?.email_address;
    const primaryPhone = phone_numbers?.[0]?.phone_number || '';
    const emailVerified = email_addresses?.[0]?.verification?.status === 'verified';
    
    console.log('📞 [CLERK WEBHOOK] Phone numbers array:', phone_numbers);
    console.log('📞 [CLERK WEBHOOK] Primary phone extracted:', primaryPhone);
    
    if (!primaryEmail) {
      console.error('❌ [CLERK] No primary email for user:', id);
      return;
    }
    
    // Create player record with Clerk ID
    const { data: newPlayer, error: createError } = await supabase
      .from('players')
      .insert({
        email: primaryEmail,
        first_name: first_name || 'Unknown',
        last_name: last_name || 'User',
        phone: primaryPhone || '',
        clerk_user_id: id,
        clerk_synced_at: new Date().toISOString(),
        kyc_status: emailVerified ? 'pending' : 'incomplete',
        password: 'clerk_managed', // Clerk manages authentication
        universal_id: `clerk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        balance: '0.00',
        current_credit: '0.00',
        credit_limit: '0.00',
        credit_approved: false,
        is_active: true
      })
      .select()
      .single();
    
    if (createError) {
      console.error('❌ [CLERK] Failed to create player:', createError);
      return;
    }
    
    console.log('✅ [CLERK] Player created:', newPlayer.email, 'with ID:', newPlayer.id);
    
  } catch (error) {
    console.error('❌ [CLERK] Error in handleUserCreated:', error);
  }
}

async function handleUserUpdated(userData: any) {
  try {
    const { id, email_addresses, first_name, last_name, phone_numbers } = userData;
    const primaryEmail = email_addresses?.[0]?.email_address;
    const primaryPhone = phone_numbers?.[0]?.phone_number || '';
    const emailVerified = email_addresses?.[0]?.verification?.status === 'verified';
    
    console.log('📞 [CLERK WEBHOOK UPDATE] Phone numbers array:', phone_numbers);
    console.log('📞 [CLERK WEBHOOK UPDATE] Primary phone extracted:', primaryPhone);
    
    // Update existing player with Clerk ID
    const { data: updatedPlayer, error: updateError } = await supabase
      .from('players')
      .update({ 
        email: primaryEmail,
        first_name: first_name || 'Unknown',
        last_name: last_name || 'User',
        phone: primaryPhone || '',
        clerk_synced_at: new Date().toISOString(),
        kyc_status: emailVerified && userData.kyc_status === 'incomplete' ? 'pending' : userData.kyc_status
      })
      .eq('clerk_user_id', id)
      .select()
      .single();
    
    if (updateError) {
      console.log('⚠️ [CLERK] Player not found for update:', id);
      return;
    }
    
    console.log('✅ [CLERK] Player updated:', updatedPlayer.email);
    
  } catch (error) {
    console.error('❌ [CLERK] Error in handleUserUpdated:', error);
  }
}

async function handleUserDeleted(userData: any) {
  try {
    const { id } = userData;
    
    // Soft delete - mark as inactive instead of hard delete
    const { error: deleteError } = await supabase
      .from('players')
      .update({ 
        is_active: false,
        clerk_user_id: null,
        clerk_synced_at: new Date().toISOString()
      })
      .eq('clerk_user_id', id);
    
    if (deleteError) {
      console.error('❌ [CLERK] Failed to deactivate player:', deleteError);
      return;
    }
    
    console.log('✅ [CLERK] Player deactivated for deleted Clerk user:', id);
    
  } catch (error) {
    console.error('❌ [CLERK] Error in handleUserDeleted:', error);
  }
}

export default router;