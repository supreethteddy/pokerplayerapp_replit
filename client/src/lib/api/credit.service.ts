/**
 * Credit Request API Service
 * Handles credit requests for players
 */

import { BaseAPIService } from './base';
import { API_ENDPOINTS } from './config';

/**
 * Credit request status
 */
export enum CreditRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

/**
 * Credit request
 */
export interface CreditRequest {
  id: string;
  playerId: string;
  clubId: string;
  amount: number;
  status: CreditRequestStatus;
  notes?: string;
  requestedAt: string;
  processedAt?: string;
  processedBy?: string;
  rejectionReason?: string;
}

/**
 * Request credit data
 */
export interface RequestCreditDto {
  amount: number;
  notes?: string;
}

/**
 * Credit request response
 */
export interface CreditRequestResponse {
  success: boolean;
  message: string;
  request: CreditRequest;
}

/**
 * Credit Request Service
 */
export class CreditRequestService extends BaseAPIService {
  /**
   * Request credit
   */
  async requestCredit(data: RequestCreditDto): Promise<CreditRequestResponse> {
    return this.post<CreditRequestResponse>(API_ENDPOINTS.credit.request, data);
  }

  /**
   * Get player's credit requests (helper method using transaction service)
   */
  async getCreditRequests(): Promise<CreditRequest[]> {
    // Note: This would need to be implemented in the backend
    // For now, we'll return an empty array
    // In a real implementation, you might have a dedicated endpoint
    return [];
  }

  /**
   * Get pending credit requests
   */
  async getPendingCreditRequests(): Promise<CreditRequest[]> {
    const requests = await this.getCreditRequests();
    return requests.filter((req) => req.status === CreditRequestStatus.PENDING);
  }

  /**
   * Check if player has pending credit request
   */
  async hasPendingCreditRequest(): Promise<boolean> {
    const pending = await this.getPendingCreditRequests();
    return pending.length > 0;
  }

  /**
   * Calculate total credit requested
   */
  async getTotalCreditRequested(): Promise<number> {
    const requests = await this.getCreditRequests();
    return requests
      .filter((req) => req.status === CreditRequestStatus.PENDING)
      .reduce((sum, req) => sum + req.amount, 0);
  }

  /**
   * Calculate total credit approved
   */
  async getTotalCreditApproved(): Promise<number> {
    const requests = await this.getCreditRequests();
    return requests
      .filter((req) => req.status === CreditRequestStatus.APPROVED)
      .reduce((sum, req) => sum + req.amount, 0);
  }
}

// Export singleton instance
export const creditRequestService = new CreditRequestService();






