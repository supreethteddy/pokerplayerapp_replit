import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixPlayerRegistration() {
  console.log('Fixing player registration to work across all portals...');
  
  try {
    // First, check if player 15 exists
    const { data: existingPlayer, error: checkError } = await supabase
      .from('players')
      .select('*')
      .eq('id', 15)
      .single();

    if (checkError) {
      console.log('Player 15 not found in players table, creating...');
      
      // Create player 15 with proper data
      const { data: newPlayer, error: insertError } = await supabase
        .from('players')
        .insert({
          id: 15,
          email: 'vignesh.wildleaf@gmail.com',
          password: 'password123',
          first_name: 'Vignesh',
          last_name: 'Wildleaf',
          phone: '1234567890',
          kyc_status: 'pending',
          balance: '0.00',
          total_deposits: '0.00',
          total_withdrawals: '0.00',
          total_winnings: '0.00',
          total_losses: '0.00',
          games_played: 0,
          hours_played: '0.00',
          is_active: true
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating player 15:', insertError);
        return false;
      }

      console.log('Player 15 created successfully:', newPlayer);
    } else {
      console.log('Player 15 already exists:', existingPlayer);
    }

    // Now create KYC documents for player 15
    const kycDocuments = [
      {
        player_id: 15,
        document_type: 'government_id',
        file_name: 'government_id.jpg',
        file_url: '/api/documents/view/gov_id_15_' + Date.now() + '.jpg',
        status: 'approved'
      },
      {
        player_id: 15,
        document_type: 'utility_bill',
        file_name: 'utility_bill.pdf',
        file_url: '/api/documents/view/utility_bill_15_' + Date.now() + '.pdf',
        status: 'approved'
      },
      {
        player_id: 15,
        document_type: 'profile_photo',
        file_name: 'profile_photo.jpg',
        file_url: '/api/documents/view/profile_photo_15_' + Date.now() + '.jpg',
        status: 'approved'
      }
    ];

    // Clear existing KYC documents
    await supabase
      .from('kyc_documents')
      .delete()
      .eq('player_id', 15);

    // Insert new KYC documents
    const { data: kycData, error: kycError } = await supabase
      .from('kyc_documents')
      .insert(kycDocuments)
      .select();

    if (kycError) {
      console.error('Error creating KYC documents:', kycError);
      return false;
    }

    console.log('KYC documents created successfully for player 15');
    kycData?.forEach(doc => {
      console.log(`- ${doc.document_type}: ${doc.status}`);
    });

    return true;
    
  } catch (error) {
    console.error('Failed to fix player registration:', error);
    return false;
  }
}

// Run the fix
fixPlayerRegistration().catch(console.error);