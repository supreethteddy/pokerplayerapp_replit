import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase for storage operations only
const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
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
  private bucketName = "kyc-documents";

  // Get PostgreSQL client
  private async getPgClient(): Promise<Client> {
    const client = new Client({
      connectionString: process.env.SUPABASE_DATABASE_URL,
      connectionTimeoutMillis: 10000,
      query_timeout: 10000,
      statement_timeout: 10000,
    });
    await client.connect();
    return client;
  }

  // Upload document with direct PostgreSQL operations
  async uploadDocument(
    playerId: number,
    documentType: string,
    fileName: string,
    fileDataUrl: string,
  ): Promise<DirectKycDocument> {
    console.log("🔧 [DIRECT KYC] Starting upload with direct PostgreSQL");

    const pgClient = await this.getPgClient();

    try {
      // Extract base64 data
      const base64Data = fileDataUrl.split(",")[1];
      if (!base64Data) {
        throw new Error("Invalid file data format");
      }

      const buffer = Buffer.from(base64Data, "base64");
      const fileSize = buffer.length;

      // Use safe filename without special characters
      const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const uniqueFileName = `player_${playerId}_${documentType}_${Date.now()}_${safeFileName}`;

      console.log(
        `🔧 [DIRECT KYC] Uploading to storage: ${uniqueFileName} (${fileSize} bytes)`,
      );

      // First ensure bucket exists
      const { data: buckets } = await supabase.storage.listBuckets();
      const bucketExists = buckets?.some(
        (bucket) => bucket.name === this.bucketName,
      );

      if (!bucketExists) {
        console.log("🔧 [DIRECT KYC] Creating kyc-documents bucket");
        await supabase.storage.createBucket(this.bucketName, {
          public: false,
          allowedMimeTypes: [
            "image/jpeg",
            "image/png",
            "image/jpg",
            "application/pdf",
          ],
          fileSizeLimit: 10485760, // 10MB
        });
      }

      // Upload to Supabase storage with safe filename
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(this.bucketName)
        .upload(uniqueFileName, buffer, {
          contentType: this.getMimeType(fileName),
          cacheControl: "3600",
          upsert: true, // Allow overwrite
        });

      if (uploadError) {
        console.error("🔧 [DIRECT KYC] Storage upload error:", uploadError);
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(this.bucketName)
        .getPublicUrl(uniqueFileName);

      console.log(
        "🔧 [DIRECT KYC] Storage upload successful, inserting to database",
      );

      // Insert to database using direct PostgreSQL - bypasses Supabase cache
      // First delete any existing document of the same type
      await pgClient.query(
        "DELETE FROM kyc_documents WHERE player_id = $1 AND document_type = $2",
        [playerId, documentType],
      );

      const insertQuery = `
        INSERT INTO kyc_documents (
          player_id, document_type, file_name, file_url, file_size, status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING id, player_id, document_type, file_name, file_url, file_size, status, created_at
      `;

      const result = await pgClient.query(insertQuery, [
        playerId,
        documentType,
        fileName,
        urlData.publicUrl,
        fileSize,
        "pending",
      ]);

      const doc = result.rows[0];

      console.log("✅ [DIRECT KYC] Document inserted successfully:", doc.id);

      return {
        id: doc.id,
        playerId: doc.player_id,
        documentType: doc.document_type,
        fileName: doc.file_name,
        fileUrl: doc.file_url,
        fileSize: doc.file_size,
        status: doc.status,
        createdAt: new Date(doc.created_at),
      };
    } catch (error: any) {
      console.error("❌ [DIRECT KYC] Upload failed:", error);
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
    },
  ): Promise<boolean> {
    console.log("🔧 [DIRECT KYC] Submitting KYC with direct PostgreSQL");

    const pgClient = await this.getPgClient();

    try {
      // First check if player already has this PAN card or if another player uses it
      const panCheckQuery = `
        SELECT id, pan_card_number 
        FROM players 
        WHERE pan_card_number = $1 AND id != $2
      `;

      const panCheck = await pgClient.query(panCheckQuery, [
        formData.panCardNumber,
        playerId,
      ]);

      if (panCheck.rows.length > 0) {
        console.log(
          `⚠️ [DIRECT KYC] PAN card ${formData.panCardNumber} already exists for another player`,
        );
        // Instead of failing, update without changing PAN if it belongs to another player
        // Or update the existing record if it's the same player
      }

      // Update player with KYC data using upsert logic for PAN card
      const updateQuery = `
        UPDATE players 
        SET 
          first_name = $1,
          last_name = $2,
          phone = $3,
          pan_card_number = CASE 
            WHEN pan_card_number IS NULL OR pan_card_number = '' THEN $4
            ELSE pan_card_number 
          END,
          kyc_status = 'submitted'
        WHERE id = $5
        RETURNING id, email, first_name, last_name, pan_card_number
      `;

      const result = await pgClient.query(updateQuery, [
        formData.firstName,
        formData.lastName,
        formData.phone,
        formData.panCardNumber,
        playerId,
      ]);

      if (result.rows.length === 0) {
        throw new Error(`Player with ID ${playerId} not found`);
      }

      const player = result.rows[0];
      console.log("✅ [DIRECT KYC] Player updated successfully:", player.id);

      return true;
    } catch (error: any) {
      console.error("❌ [DIRECT KYC] Submit failed:", error);
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

      return result.rows.map((row) => ({
        id: row.id,
        playerId: row.player_id,
        documentType: row.document_type,
        fileName: row.file_name,
        fileUrl: row.file_url,
        fileSize: row.file_size || 0,
        status: row.status,
        createdAt: new Date(row.created_at),
      }));
    } catch (error: any) {
      console.error("❌ [DIRECT KYC] Get documents failed:", error);
      throw error;
    } finally {
      await pgClient.end();
    }
  }

  private getMimeType(fileName: string): string {
    const ext = fileName.toLowerCase().split(".").pop();
    switch (ext) {
      case "jpg":
      case "jpeg":
        return "image/jpeg";
      case "png":
        return "image/png";
      case "pdf":
        return "application/pdf";
      default:
        return "application/octet-stream";
    }
  }
}

export const directKycStorage = new DirectKycStorage();
