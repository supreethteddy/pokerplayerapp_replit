import { createClient } from '@supabase/supabase-js';
import { supabaseOnlyStorage } from './supabase-only-storage.js';

// UNIVERSAL CROSS-PORTAL SUPABASE CONNECTION
// Connect to unified Supabase database for all portals
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
  
  /**
   * UNIVERSAL CROSS-PORTAL DOCUMENT SYSTEM
   * All KYC functions enhanced for perfect cross-portal compatibility
   */

  constructor() {
    this.initializeBucket();
  }

  // Universal document count for health checks
  async getDocumentCount(): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('kyc_documents')
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.error('Error getting document count:', error);
        return 0;
      }
      
      return count || 0;
    } catch (error: any) {
      console.error('Error getting document count:', error);
      return 0;
    }
  }

  // Update document status (universal method for cross-portal approval)
  async updateDocumentStatus(documentId: number, status: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('kyc_documents')
        .update({ status: status })
        .eq('id', documentId);
      
      if (error) {
        throw new Error(`Failed to update document status: ${error.message}`);
      }
      
      console.log(`✅ [UNIVERSAL] Updated document ${documentId} status: ${status}`);
    } catch (error: any) {
      console.error(`❌ [UNIVERSAL] Error updating document status:`, error);
      throw error;
    }
  }

  // Get documents by player ID (universal method)
  async getDocumentsByPlayerId(playerId: number): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('kyc_documents')
        .select('*')
        .eq('player_id', playerId);
      
      if (error) {
        throw new Error(`Failed to get documents: ${error.message}`);
      }
      
      return data || [];
    } catch (error: any) {
      console.error(`❌ [UNIVERSAL] Error getting documents:`, error);
      return [];
    }
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
      console.log('📤 [SupabaseDocumentStorage] Starting upload for:', { playerId, documentType, fileName });
      console.log('📤 [SupabaseDocumentStorage] DataURL type:', typeof dataUrl);
      console.log('📤 [SupabaseDocumentStorage] DataURL length:', dataUrl?.length || 'undefined');
      console.log('📤 [SupabaseDocumentStorage] DataURL preview:', dataUrl?.substring(0, 50) + '...');
      
      if (!dataUrl || dataUrl.length === 0) {
        throw new Error('Data URL is required for file upload');
      }

      // Generate unique file name using timestamp
      const fileExtension = fileName.split('.').pop();
      const timestamp = Date.now();
      const uniqueFileName = `${playerId}/${documentType}/${timestamp}.${fileExtension}`;

      // Convert data URL to file buffer
      let base64Data: string;
      
      if (dataUrl.startsWith('data:')) {
        // Handle data URL format (data:image/png;base64,...)
        const parts = dataUrl.split(',');
        if (parts.length !== 2) {
          throw new Error('Invalid data URL format - expected format: data:mime/type;base64,data');
        }
        base64Data = parts[1];
      } else {
        // Handle direct base64 data
        base64Data = dataUrl;
      }
      
      if (!base64Data || base64Data.length === 0) {
        throw new Error('Invalid data URL format - missing base64 data');
      }
      
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

      // Database instance mismatch detected - use working storage backend
      console.log('📤 [SupabaseDocumentStorage] Using working database storage backend...');
      
      try {
        // Use the database storage that's already working
        // SUPABASE EXCLUSIVE MODE - No legacy database imports needed
        
        const insertedDoc = await supabaseOnlyStorage.createKycDocument({
          playerId,
          documentType,
          fileName,
          fileUrl: urlData.publicUrl,
          status: 'pending'
        });
        
        console.log('📤 [SupabaseDocumentStorage] Database storage insert succeeded:', insertedDoc);
        
        const document: SupabaseDocumentRecord = {
          id: insertedDoc.id,
          playerId: insertedDoc.playerId,
          documentType: insertedDoc.documentType,
          fileName: insertedDoc.fileName,
          fileUrl: insertedDoc.fileUrl,
          status: insertedDoc.status,
          createdAt: insertedDoc.createdAt
        };
        
        return document;
      } catch (sqlError) {
        console.error('📤 [SupabaseDocumentStorage] Database storage failed:', sqlError);
        // Clean up the uploaded file if database insert fails
        await supabase.storage
          .from(this.bucketName)
          .remove([uniqueFileName]);
        throw new Error(`Failed to save document metadata: ${sqlError.message}`);
      }

    } catch (error: any) {
      console.error('Error uploading document to Supabase:', error);
      throw error;
    }
  }

  async getPlayerDocuments(playerId: number): Promise<SupabaseDocumentRecord[]> {
    try {
      console.log(`🔍 [SupabaseDocumentStorage] Querying kyc_documents for player_id: ${playerId}`);
      
      // Direct Supabase query - SUPABASE EXCLUSIVE MODE
      const { data: documents, error } = await supabase
        .from('kyc_documents')
        .select('*')
        .eq('player_id', playerId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error(`❌ [SupabaseDocumentStorage] Error querying documents:`, error);
        throw new Error(`Failed to retrieve documents: ${error.message}`);
      }
      
      console.log(`📊 [SupabaseDocumentStorage] Found ${documents?.length || 0} documents for player ${playerId}`);
      
      // Transform to SupabaseDocumentRecord format
      const supabaseDocuments: SupabaseDocumentRecord[] = (documents || []).map(doc => ({
        id: doc.id,
        playerId: doc.player_id,
        documentType: doc.document_type,
        fileName: doc.file_name,
        fileUrl: doc.file_url,
        status: doc.status,
        createdAt: new Date(doc.created_at)
      }));

      console.log(`✅ [SupabaseDocumentStorage] Successfully retrieved ${supabaseDocuments.length} documents`);
      return supabaseDocuments;

    } catch (error: any) {
      console.error('Error in getPlayerDocuments:', error);
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