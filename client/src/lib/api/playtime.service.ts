import { BaseAPIService } from './base';

/**
 * Playtime/Session Service
 * Handles live game sessions, call-time management, and cash-out requests
 */
class PlaytimeService extends BaseAPIService {
  /**
   * Start a call-time for a player
   */
  async startCallTime(data: {
    playerId: string;
    tableId?: string;
    seatNumber?: number;
  }): Promise<{
    success: boolean;
    message: string;
    callTimeId: string;
    startedAt: string;
  }> {
    return this.request('POST', '/call-time/start', data);
  }

  /**
   * Record call-time for a live session
   */
  async recordSessionCallTime(playerId: string, data: {
    duration?: number;
    notes?: string;
  }): Promise<{
    success: boolean;
    message: string;
  }> {
    return this.request('POST', `/live-sessions/${playerId}/call-time`, data);
  }

  /**
   * Request cash-out from current session
   */
  async requestCashOut(data: {
    playerId: string;
    amount?: number;
    tableId?: string;
  }): Promise<{
    success: boolean;
    message: string;
    cashOutId: string;
    amount: number;
  }> {
    return this.request('POST', '/cash-out/request', data);
  }

  /**
   * Cash out from live session
   */
  async cashOutFromSession(playerId: string, data: {
    finalChips: number;
    notes?: string;
  }): Promise<{
    success: boolean;
    message: string;
    profitLoss: number;
  }> {
    return this.request('POST', `/live-sessions/${playerId}/cash-out`, data);
  }

  /**
   * Get current live session for player
   */
  async getCurrentSession(playerId: string): Promise<{
    session: {
      id: string;
      tableId: string;
      tableName: string;
      seatNumber: number;
      startedAt: string;
      buyIn: number;
      currentChips: number;
      duration: string;
    } | null;
  }> {
    return this.request('GET', `/live-sessions/${playerId}/current`);
  }

  /**
   * Get session history for player
   */
  async getSessionHistory(limit = 20): Promise<{
    sessions: Array<{
      id: string;
      tableId: string;
      tableName: string;
      startedAt: string;
      endedAt?: string;
      duration: number;
      buyIn: number;
      cashOut?: number;
      profitLoss: number;
    }>;
  }> {
    return this.request('GET', `/live-sessions/history?limit=${limit}`);
  }
}

export const playtimeService = new PlaytimeService();





