import { BaseAPIService } from './base';

/**
 * Documents Service
 * Handles KYC document uploads and verification
 */
class DocumentsService extends BaseAPIService {
  /**
   * Upload KYC document (with or without file)
   */
  async uploadKYCDocument(data: {
    type: 'id_proof' | 'address_proof' | 'photo' | 'pan_card' | 'other';
    name: string;
    url?: string;
  }): Promise<{
    success: boolean;
    message: string;
    document: any;
    totalDocuments: number;
  }> {
    return this.request('POST', '/player-documents/upload', data);
  }

  /**
   * Get player's uploaded documents
   */
  async getMyDocuments(): Promise<{
    documents: Array<{
      id: string;
      type: string;
      name: string;
      url: string;
      status: 'pending' | 'approved' | 'rejected';
      uploadedAt: string;
      size: number;
      mimeType: string;
    }>;
    kycStatus: string;
    kycApprovedAt: string | null;
    totalDocuments: number;
  }> {
    return this.request('GET', '/player-documents/my');
  }

  /**
   * Delete a document
   */
  async deleteDocument(documentId: string): Promise<{
    success: boolean;
    message: string;
    totalDocuments: number;
  }> {
    return this.request('DELETE', `/player-documents/${documentId}`);
  }

  /**
   * Upload file with FormData
   */
  async uploadFile(file: File, data?: { type?: string; name?: string }): Promise<{
    success: boolean;
    message: string;
    document: any;
    totalDocuments: number;
  }> {
    const formData = new FormData();
    formData.append('file', file);
    if (data?.type) formData.append('type', data.type);
    if (data?.name) formData.append('name', data.name);

    // Use fetch directly for file upload
    const response = await fetch(`${this.baseURL}/player-documents/upload`, {
      method: 'POST',
      body: formData,
      headers: {
        'x-player-id': this.getPlayerId() || '',
        'x-club-id': this.getClubId() || '',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'File upload failed');
    }

    return response.json();
  }
}

export const documentsService = new DocumentsService();







