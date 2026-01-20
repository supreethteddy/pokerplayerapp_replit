/**
 * Waitlist API Service
 * Handles waitlist operations for players
 */

import { BaseAPIService } from './base';
import { API_ENDPOINTS } from './config';

/**
 * Waitlist entry status
 */
export enum WaitlistStatus {
  WAITING = 'waiting',
  SEATED = 'seated',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show',
}

/**
 * Waitlist entry
 */
export interface WaitlistEntry {
  id: string;
  playerId: string;
  clubId: string;
  tableType?: string;
  partySize: number;
  status: WaitlistStatus;
  position?: number;
  estimatedWaitTime?: number; // in minutes
  joinedAt: string;
  seatedAt?: string;
  cancelledAt?: string;
  notes?: string;
}

/**
 * Join waitlist request
 */
export interface JoinWaitlistDto {
  tableType?: string;
  partySize?: number;
  requestedSeat?: number; // Requested seat number (1-10)
}

/**
 * Waitlist status response (matches backend API response)
 */
export interface WaitlistStatusResponse {
  onWaitlist: boolean;
  isSeated: boolean;
  entry?: {
    id: string;
    playerName: string;
    partySize: number;
    tableType: string;
    status: string;
    tableNumber: number;
    seatNumber?: number;
    seatedAt?: string;
    createdAt: string;
  };
  position: number | null;
  totalInQueue: number | null;
  availableTables: number | null;
  tableInfo?: {
    tableId: string;
    tableName: string;
    tableStatus: string;
    gameType: string;
  };
  message?: string;
}

/**
 * Waitlist Service
 */
export class WaitlistService extends BaseAPIService {
  /**
   * Join waitlist
   */
  async joinWaitlist(data: JoinWaitlistDto = {}): Promise<{
    success: boolean;
    message: string;
    entry: WaitlistEntry;
  }> {
    return this.post<{
      success: boolean;
      message: string;
      entry: WaitlistEntry;
    }>(API_ENDPOINTS.waitlist.join, data);
  }

  /**
   * Get waitlist status
   */
  async getWaitlistStatus(): Promise<WaitlistStatusResponse> {
    return this.get<WaitlistStatusResponse>(API_ENDPOINTS.waitlist.getStatus);
  }

  /**
   * Cancel waitlist entry
   */
  async cancelWaitlist(entryId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    return this.delete<{
      success: boolean;
      message: string;
    }>(API_ENDPOINTS.waitlist.cancel(entryId));
  }

  /**
   * Check if player is on waitlist
   */
  async isOnWaitlist(): Promise<boolean> {
    try {
      const status = await this.getWaitlistStatus();
      return status.currentEntry?.status === WaitlistStatus.WAITING;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get player's current position in waitlist
   */
  async getCurrentPosition(): Promise<number | null> {
    try {
      const status = await this.getWaitlistStatus();
      return status.currentEntry?.position || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get estimated wait time
   */
  async getEstimatedWaitTime(): Promise<number | null> {
    try {
      const status = await this.getWaitlistStatus();
      return status.currentEntry?.estimatedWaitTime || null;
    } catch (error) {
      return null;
    }
  }
}

// Export singleton instance
export const waitlistService = new WaitlistService();











