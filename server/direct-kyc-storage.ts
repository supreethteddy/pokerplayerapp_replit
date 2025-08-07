import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase for storage operations only
const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface DirectKycDocument {
  id: number;
  playerId: number;
  documentType: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  status: string;
  createdAt: Date;
}

export class DirectKycStorage {
  private bucketName = 'kyc-documents';

  // Get PostgreSQL client
  private async getPgClient(): Promise<Client> {
    const client = new Client({
      connectionString: process.env.DATABASE_URL
    });
    await client.connect();
    return client;
  }

  // Upload document with direct PostgreSQL operations
  async uploadDocument(
    playerId: number,
    documentType: string,
    fileName: string,
    fileDataUrl: string
  ): Promise<DirectKycDocument> {
    console.log('🔧 [DIRECT KYC] Starting upload with direct PostgreSQL');
    
    const pgClient = await this.getPgClient();
    
    try {
      // Extract base64 data
      const base64Data = fileDataUrl.split(',')[1];
      if (!base64Data) {
        throw new Error('Invalid file data format');
      }
      
      const buffer = Buffer.from(base64Data, 'base64');
      const fileSize = buffer.length;
      const uniqueFileName = `${playerId}/${documentType}/${Date.now()}_${fileName}`;

      console.log(`🔧 [DIRECT KYC] Uploading to storage: ${uniqueFileName} (${fileSize} bytes)`);

      // Upload to Supabase storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(this.bucketName)
        .upload(uniqueFileName, buffer, {
          contentType: this.getMimeType(fileName),
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(this.bucketName)
        .getPublicUrl(uniqueFileName);

      console.log('🔧 [DIRECT KYC] Storage upload successful, inserting to database');

      // Insert to database using direct PostgreSQL - bypasses Supabase cache
      const insertQuery = `
        INSERT INTO kyc_documents (
          player_id, document_type, file_name, file_url, file_size, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING id, player_id, document_type, file_name, file_url, file_size, status, created_at
      `;

      const result = await pgClient.query(insertQuery, [
        playerId,
        documentType,
        fileName,
        urlData.publicUrl,
        fileSize,
        'pending'
      ]);

      const doc = result.rows[0];
      
      console.log('✅ [DIRECT KYC] Document inserted successfully:', doc.id);

      return {
        id: doc.id,
        playerId: doc.player_id,
        documentType: doc.document_type,
        fileName: doc.file_name,
        fileUrl: doc.file_url,
        fileSize: doc.file_size,
        status: doc.status,
        createdAt: new Date(doc.created_at)
      };

    } catch (error: any) {
      console.error('❌ [DIRECT KYC] Upload failed:', error);
      throw error;
    } finally {
      await pgClient.end();
    }
  }

  // Submit KYC with direct PostgreSQL operations
  async submitKyc(
    playerId: number,
    formData: {
      firstName: string;
      lastName: string;
      phone: string;
      panCardNumber: string;
      address: string;
    }
  ): Promise<boolean> {
    console.log('🔧 [DIRECT KYC] Submitting KYC with direct PostgreSQL');
    
    const pgClient = await this.getPgClient();
    
    try {
      // Update player with KYC data using direct PostgreSQL
      const updateQuery = `
        UPDATE players 
        SET 
          first_name = $1,
          last_name = $2,
          phone = $3,
          pan_card_number = $4,
          address = $5,
          kyc_status = 'submitted'
        WHERE id = $6
        RETURNING id, email, first_name, last_name
      `;

      const result = await pgClient.query(updateQuery, [
        formData.firstName,
        formData.lastName,
        formData.phone,
        formData.panCardNumber,
        formData.address,
        playerId
      ]);

      if (result.rows.length === 0) {
        throw new Error(`Player with ID ${playerId} not found`);
      }

      const player = result.rows[0];
      console.log('✅ [DIRECT KYC] Player updated successfully:', player.id);

      return true;

    } catch (error: any) {
      console.error('❌ [DIRECT KYC] Submit failed:', error);
      throw error;
    } finally {
      await pgClient.end();
    }
  }

  // Get player documents using direct PostgreSQL
  async getPlayerDocuments(playerId: number): Promise<DirectKycDocument[]> {
    const pgClient = await this.getPgClient();
    
    try {
      const query = `
        SELECT id, player_id, document_type, file_name, file_url, file_size, status, created_at
        FROM kyc_documents 
        WHERE player_id = $1 
        ORDER BY created_at DESC
      `;

      const result = await pgClient.query(query, [playerId]);

      return result.rows.map(row => ({
        id: row.id,
        playerId: row.player_id,
        documentType: row.document_type,
        fileName: row.file_name,
        fileUrl: row.file_url,
        fileSize: row.file_size || 0,
        status: row.status,
        createdAt: new Date(row.created_at)
      }));

    } catch (error: any) {
      console.error('❌ [DIRECT KYC] Get documents failed:', error);
      throw error;
    } finally {
      await pgClient.end();
    }
  }

  private getMimeType(fileName: string): string {
    const ext = fileName.toLowerCase().split('.').pop();
    switch (ext) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'pdf':
        return 'application/pdf';
      default:
        return 'application/octet-stream';
    }
  }
}

export const directKycStorage = new DirectKycStorage();