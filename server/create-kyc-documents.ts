import { createClient } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';
// REMOVED: fileStorage import - using Supabase Storage directly

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function createKycDocuments() {
  console.log('Creating KYC documents for player 15...');
  
  try {
    // First, create some sample files
    const sampleFiles = [
      {
        type: 'government_id',
        name: 'government_id.jpg',
        dataUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k='
      },
      {
        type: 'utility_bill',
        name: 'utility_bill.pdf',
        dataUrl: 'data:application/pdf;base64,JVBERi0xLjQKJcOkw7zDtsOyDQo='
      },
      {
        type: 'profile_photo',
        name: 'profile_photo.jpg',
        dataUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k='
      }
    ];

    // Clear existing documents
    await supabase
      .from('kyc_documents')
      .delete()
      .eq('player_id', 15);

    // Create documents with Supabase Storage
    for (const file of sampleFiles) {
      // Store file using Supabase Storage directly
      const buffer = Buffer.from(file.dataUrl.split(',')[1], 'base64');
      const fileName = `15/${file.type}/${Date.now()}_${file.name}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('kyc-documents')
        .upload(fileName, buffer, {
          contentType: file.type.includes('pdf') ? 'application/pdf' : 'image/jpeg'
        });
      
      if (uploadError) {
        console.error('Upload error:', uploadError);
        continue;
      }
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('kyc-documents')
        .getPublicUrl(fileName);
      
      // Create KYC document record
      const { data, error } = await supabase
        .from('kyc_documents')
        .insert({
          player_id: 15,
          document_type: file.type,
          file_name: file.name,
          file_url: urlData.publicUrl,
          status: 'approved',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error(`Error creating ${file.type} document:`, error);
        return false;
      }

      console.log(`✅ Created ${file.type} document: ${data.id}`);
    }

    console.log('✅ All KYC documents created successfully');
    return true;
    
  } catch (error) {
    console.error('Failed to create KYC documents:', error);
    return false;
  }
}

// Run the creation
createKycDocuments().catch(console.error);