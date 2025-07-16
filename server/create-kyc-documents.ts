import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function createKycDocuments() {
  console.log('Creating KYC documents for player 14...');
  
  try {
    // Create sample KYC documents
    const kycDocuments = [
      {
        player_id: 14,
        document_type: 'government_id',
        file_name: 'government_id.jpg',
        file_url: '/api/documents/view/gov_id_1752676000000.jpg',
        status: 'approved'
      },
      {
        player_id: 14,
        document_type: 'utility_bill',
        file_name: 'utility_bill.pdf',
        file_url: '/api/documents/view/utility_bill_1752676000000.pdf',
        status: 'approved'
      },
      {
        player_id: 14,
        document_type: 'profile_photo',
        file_name: 'profile_photo.jpg',
        file_url: '/api/documents/view/profile_photo_1752676000000.jpg',
        status: 'approved'
      }
    ];

    // Insert KYC documents
    const { data: insertData, error: insertError } = await supabase
      .from('kyc_documents')
      .insert(kycDocuments)
      .select();

    if (insertError) {
      console.error('Error inserting KYC documents:', insertError);
      return false;
    }

    console.log('KYC documents created successfully:', insertData);
    return true;
    
  } catch (error) {
    console.error('Failed to create KYC documents:', error);
    return false;
  }
}

// Run the script
createKycDocuments().catch(console.error);