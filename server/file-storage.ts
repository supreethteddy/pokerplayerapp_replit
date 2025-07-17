// DEPRECATED - REPLACED WITH SUPABASE STORAGE
// This file has been completely replaced with Supabase Storage
// All file operations now use supabase-document-storage.ts
import { createClient } from '@supabase/supabase-js';

export interface StoredFile {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  createdAt: Date;
}

export class FileStorage {
  private files: Map<string, StoredFile> = new Map();
  private uploadsDir = path.join(process.cwd(), 'uploads');

  constructor() {
    this.ensureUploadsDir();
  }

  private async ensureUploadsDir() {
    try {
      await fs.access(this.uploadsDir);
    } catch {
      await fs.mkdir(this.uploadsDir, { recursive: true });
    }
  }

  async storeFile(fileName: string, dataUrl: string): Promise<StoredFile> {
    const fileId = nanoid();
    const timestamp = Date.now();
    
    // Parse the data URL
    const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      throw new Error('Invalid data URL format');
    }
    
    const mimeType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Create safe filename
    const ext = this.getExtensionFromMimeType(mimeType);
    const safeFileName = `${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}_${timestamp}${ext}`;
    const filePath = path.join(this.uploadsDir, safeFileName);
    
    // Write file
    await fs.writeFile(filePath, buffer);
    
    const storedFile: StoredFile = {
      id: fileId,
      originalName: fileName,
      mimeType,
      size: buffer.length,
      path: filePath,
      createdAt: new Date()
    };
    
    this.files.set(fileId, storedFile);
    
    console.log(`[FileStorage] Stored file: ${fileId} -> ${safeFileName} (${buffer.length} bytes)`);
    
    return storedFile;
  }

  async getFile(fileId: string): Promise<StoredFile | undefined> {
    return this.files.get(fileId);
  }

  async getFileBuffer(fileId: string): Promise<Buffer | undefined> {
    const file = this.files.get(fileId);
    if (!file) return undefined;
    
    try {
      return await fs.readFile(file.path);
    } catch (error) {
      console.error(`[FileStorage] Failed to read file ${fileId}:`, error);
      return undefined;
    }
  }

  async deleteFile(fileId: string): Promise<boolean> {
    const file = this.files.get(fileId);
    if (!file) return false;
    
    try {
      await fs.unlink(file.path);
      this.files.delete(fileId);
      console.log(`[FileStorage] Deleted file: ${fileId}`);
      return true;
    } catch (error) {
      console.error(`[FileStorage] Failed to delete file ${fileId}:`, error);
      return false;
    }
  }

  private getExtensionFromMimeType(mimeType: string): string {
    const extensions: { [key: string]: string } = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'application/pdf': '.pdf',
      'image/gif': '.gif',
      'image/webp': '.webp'
    };
    
    return extensions[mimeType] || '.bin';
  }

  listFiles(): StoredFile[] {
    return Array.from(this.files.values());
  }
}

export const fileStorage = new FileStorage();