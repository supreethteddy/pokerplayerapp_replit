import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

// Create Supabase client with service role key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export interface SupabaseDocumentRecord {
  id: number;
  playerId: number;
  documentType: string;
  fileName: string;
  fileUrl: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
}

export class SupabaseDocumentStorage {
  private bucketName = 'kyc-documents';

  constructor() {
    this.initializeBucket();
  }

  private async initializeBucket() {
    try {
      // Check if bucket exists
      const { data: buckets } = await supabase.storage.listBuckets();
      const bucketExists = buckets?.some(bucket => bucket.name === this.bucketName);

      if (!bucketExists) {
        // Create bucket if it doesn't exist
        const { error } = await supabase.storage.createBucket(this.bucketName, {
          public: true,
          allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'],
          fileSizeLimit: 5242880 // 5MB
        });

        if (error) {
          console.error('Error creating Supabase bucket:', error);
        } else {
          console.log('✅ Supabase storage bucket created successfully');
        }
      } else {
        // Update existing bucket to be public
        const { error } = await supabase.storage.updateBucket(this.bucketName, {
          public: true
        });

        if (error) {
          console.error('Error updating Supabase bucket policy:', error);
        } else {
          console.log('✅ Supabase storage bucket updated to public successfully');
        }
      }
    } catch (error) {
      console.error('Error initializing Supabase bucket:', error);
    }
  }

  async uploadDocument(playerId: number, documentType: string, fileName: string, dataUrl: string): Promise<SupabaseDocumentRecord> {
    try {
      // Generate unique file name using timestamp
      const fileExtension = fileName.split('.').pop();
      const timestamp = Date.now();
      const uniqueFileName = `${playerId}/${documentType}/${timestamp}.${fileExtension}`;

      // Convert data URL to file buffer
      const base64Data = dataUrl.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');

      // Upload file to Supabase storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(this.bucketName)
        .upload(uniqueFileName, buffer, {
          contentType: this.getMimeType(fileName),
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw new Error(`Failed to upload to Supabase storage: ${uploadError.message}`);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(this.bucketName)
        .getPublicUrl(uniqueFileName);

      // Store document metadata in Supabase database (ID will be auto-generated)
      const { data: dbData, error: dbError } = await supabase
        .from('kyc_documents')
        .insert({
          player_id: playerId,
          document_type: documentType,
          file_name: fileName,
          file_url: urlData.publicUrl,
          status: 'pending'
        })
        .select()
        .single();

      if (dbError) {
        // If database insert fails, clean up the uploaded file
        await supabase.storage
          .from(this.bucketName)
          .remove([uniqueFileName]);
        throw new Error(`Failed to save document metadata: ${dbError.message}`);
      }

      // Create document record with auto-generated ID
      const document: SupabaseDocumentRecord = {
        id: dbData.id,
        playerId: dbData.player_id,
        documentType: dbData.document_type,
        fileName: dbData.file_name,
        fileUrl: dbData.file_url,
        status: dbData.status,
        createdAt: new Date(dbData.created_at)
      };

      console.log(`✅ Document uploaded to Supabase: ${dbData.id}`);
      return document;

    } catch (error: any) {
      console.error('Error uploading document to Supabase:', error);
      throw error;
    }
  }

  async getPlayerDocuments(playerId: number): Promise<SupabaseDocumentRecord[]> {
    try {
      console.log(`🔍 [SupabaseDocumentStorage] Querying kyc_documents for player_id: ${playerId}`);
      
      // Test database connection and table state
      const { data: countData, error: countError } = await supabase
        .from('kyc_documents')
        .select('*', { count: 'exact' });
      
      console.log(`📊 [SupabaseDocumentStorage] Total documents in table: ${countData?.length || 0}`);
      
      const { data, error } = await supabase
        .from('kyc_documents')
        .select('*')
        .eq('player_id', playerId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error(`❌ [SupabaseDocumentStorage] Database error:`, error);
        throw new Error(`Failed to get documents: ${error.message}`);
      }

      console.log(`📄 [SupabaseDocumentStorage] Raw data from Supabase:`, data);
      console.log(`📊 [SupabaseDocumentStorage] Found ${data?.length || 0} documents in kyc_documents table for player ${playerId}`);

      // Return empty array if no documents
      if (!data || data.length === 0) {
        console.log(`✅ [SupabaseDocumentStorage] No documents found - returning empty array`);
        return [];
      }

      const transformedDocs = data.map(doc => ({
        id: doc.id,
        playerId: doc.player_id,
        documentType: doc.document_type,
        fileName: doc.file_name,
        fileUrl: doc.file_url,
        status: doc.status,
        createdAt: new Date(doc.created_at)
      }));

      console.log(`✅ [SupabaseDocumentStorage] Transformed documents:`, transformedDocs);
      return transformedDocs;

    } catch (error: any) {
      console.error('❌ [SupabaseDocumentStorage] Error getting player documents:', error);
      throw error;
    }
  }

  async getDocument(docId: string): Promise<SupabaseDocumentRecord | undefined> {
    try {
      const { data, error } = await supabase
        .from('kyc_documents')
        .select('*')
        .eq('id', docId)
        .single();

      if (error || !data) {
        return undefined;
      }

      return {
        id: data.id,
        playerId: data.player_id,
        documentType: data.document_type,
        fileName: data.file_name,
        fileUrl: data.file_url,
        status: data.status,
        createdAt: new Date(data.created_at)
      };

    } catch (error: any) {
      console.error('Error getting document from Supabase:', error);
      return undefined;
    }
  }

  async getDocumentFile(docId: string): Promise<{ buffer: Buffer; mimeType: string; fileName: string } | undefined> {
    try {
      // Get document metadata
      const document = await this.getDocument(docId);
      if (!document) {
        return undefined;
      }

      // Extract file path from URL
      const url = new URL(document.fileUrl);
      const filePath = url.pathname.split('/').slice(-3).join('/'); // Get last 3 parts of path

      // Download file from Supabase storage
      const { data, error } = await supabase.storage
        .from(this.bucketName)
        .download(filePath);

      if (error || !data) {
        console.error('Error downloading file from Supabase:', error);
        return undefined;
      }

      // Convert blob to buffer
      const buffer = Buffer.from(await data.arrayBuffer());

      return {
        buffer,
        mimeType: this.getMimeType(document.fileName),
        fileName: document.fileName
      };

    } catch (error: any) {
      console.error('Error getting document file from Supabase:', error);
      return undefined;
    }
  }

  async updateDocumentStatus(docId: string, status: 'pending' | 'approved' | 'rejected'): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('kyc_documents')
        .update({ status })
        .eq('id', docId);

      if (error) {
        console.error('Error updating document status:', error);
        return false;
      }

      return true;
    } catch (error: any) {
      console.error('Error updating document status:', error);
      return false;
    }
  }

  async deleteDocument(docId: string): Promise<boolean> {
    try {
      // Get document to find file path
      const document = await this.getDocument(docId);
      if (!document) {
        return false;
      }

      // Extract file path from URL
      const url = new URL(document.fileUrl);
      const filePath = url.pathname.split('/').slice(-3).join('/');

      // Delete file from storage
      const { error: storageError } = await supabase.storage
        .from(this.bucketName)
        .remove([filePath]);

      if (storageError) {
        console.error('Error deleting file from storage:', storageError);
      }

      // Delete database record
      const { error: dbError } = await supabase
        .from('kyc_documents')
        .delete()
        .eq('id', docId);

      if (dbError) {
        console.error('Error deleting document record:', dbError);
        return false;
      }

      return true;
    } catch (error: any) {
      console.error('Error deleting document:', error);
      return false;
    }
  }

  private getMimeType(fileName: string): string {
    const extension = fileName.toLowerCase().split('.').pop();
    switch (extension) {
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

export const supabaseDocumentStorage = new SupabaseDocumentStorage();