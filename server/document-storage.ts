import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import { fileStorage } from './file-storage';

// Simple in-memory document storage
export interface DocumentRecord {
  id: string;
  playerId: number;
  documentType: string;
  fileName: string;
  fileId: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
}

export class DocumentStorage {
  private documents: Map<string, DocumentRecord> = new Map();
  private currentId = 1;

  async uploadDocument(playerId: number, documentType: string, fileName: string, dataUrl: string): Promise<DocumentRecord> {
    console.log(`[DocumentStorage] Uploading document for player ${playerId}: ${fileName}`);
    
    // Store the actual file
    const storedFile = await fileStorage.storeFile(fileName, dataUrl);
    
    // Create document record
    const docId = `doc_${this.currentId++}`;
    const document: DocumentRecord = {
      id: docId,
      playerId,
      documentType,
      fileName,
      fileId: storedFile.id,
      status: 'pending',
      createdAt: new Date()
    };
    
    this.documents.set(docId, document);
    
    console.log(`[DocumentStorage] Document uploaded: ${docId} -> fileId: ${storedFile.id}`);
    
    return document;
  }

  async getPlayerDocuments(playerId: number): Promise<DocumentRecord[]> {
    const docs = Array.from(this.documents.values()).filter(doc => doc.playerId === playerId);
    console.log(`[DocumentStorage] Found ${docs.length} documents for player ${playerId}`);
    return docs;
  }

  async getDocument(docId: string): Promise<DocumentRecord | undefined> {
    return this.documents.get(docId);
  }

  async getDocumentFile(docId: string): Promise<{ buffer: Buffer; mimeType: string; fileName: string } | undefined> {
    const document = this.documents.get(docId);
    if (!document) {
      console.log(`[DocumentStorage] Document not found: ${docId}`);
      return undefined;
    }
    
    const fileBuffer = await fileStorage.getFileBuffer(document.fileId);
    if (!fileBuffer) {
      console.log(`[DocumentStorage] File not found for document: ${docId}`);
      return undefined;
    }
    
    const storedFile = await fileStorage.getFile(document.fileId);
    if (!storedFile) {
      console.log(`[DocumentStorage] File metadata not found: ${document.fileId}`);
      return undefined;
    }
    
    console.log(`[DocumentStorage] Serving file for document ${docId}: ${storedFile.originalName} (${fileBuffer.length} bytes)`);
    
    return {
      buffer: fileBuffer,
      mimeType: storedFile.mimeType,
      fileName: storedFile.originalName
    };
  }

  async updateDocumentStatus(docId: string, status: 'pending' | 'approved' | 'rejected'): Promise<boolean> {
    const document = this.documents.get(docId);
    if (!document) return false;
    
    document.status = status;
    this.documents.set(docId, document);
    
    console.log(`[DocumentStorage] Updated document ${docId} status to: ${status}`);
    return true;
  }

  async deleteDocument(docId: string): Promise<boolean> {
    const document = this.documents.get(docId);
    if (!document) return false;
    
    // Delete the actual file
    await fileStorage.deleteFile(document.fileId);
    
    // Delete the document record
    this.documents.delete(docId);
    
    console.log(`[DocumentStorage] Deleted document: ${docId}`);
    return true;
  }
}

export const documentStorage = new DocumentStorage();