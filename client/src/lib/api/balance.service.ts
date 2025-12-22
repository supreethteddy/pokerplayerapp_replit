/**
 * Player Balance and Transaction API Service
 * Handles balance inquiries and transaction history
 */

import { BaseAPIService } from './base';
import { API_ENDPOINTS } from './config';

/**
 * Player balance response
 */
export interface PlayerBalance {
  playerId: string;
  clubId: string;
  balance: number;
  creditLimit?: number;
  availableCredit?: number;
  currency: string;
  lastUpdated: string;
}

/**
 * Transaction types
 */
export enum TransactionType {
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
  BUY_IN = 'buy_in',
  CASH_OUT = 'cash_out',
  CREDIT = 'credit',
  DEBIT = 'debit',
  TRANSFER = 'transfer',
  FNB_ORDER = 'fnb_order',
  ADJUSTMENT = 'adjustment',
}

/**
 * Transaction status
 */
export enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/**
 * Transaction record
 */
export interface Transaction {
  id: string;
  playerId: string;
  clubId: string;
  type: TransactionType;
  amount: number;
  balance: number; // Balance after transaction
  status: TransactionStatus;
  description?: string;
  notes?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

/**
 * Transaction list response
 */
export interface TransactionListResponse {
  transactions: Transaction[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/**
 * Player Balance and Transaction Service
 */
export class PlayerBalanceService extends BaseAPIService {
  /**
   * Get player balance
   */
  async getBalance(): Promise<PlayerBalance> {
    return this.get<PlayerBalance>(API_ENDPOINTS.auth.getBalance);
  }

  /**
   * Get player transaction history
   */
  async getTransactions(
    limit: number = 50,
    offset: number = 0
  ): Promise<TransactionListResponse> {
    const endpoint = `${API_ENDPOINTS.auth.getTransactions}?limit=${limit}&offset=${offset}`;
    return this.get<TransactionListResponse>(endpoint);
  }

  /**
   * Get transactions by type
   */
  async getTransactionsByType(
    type: TransactionType,
    limit: number = 50,
    offset: number = 0
  ): Promise<TransactionListResponse> {
    const response = await this.getTransactions(limit, offset);
    
    // Filter transactions by type
    const filteredTransactions = response.transactions.filter(
      (transaction) => transaction.type === type
    );
    
    return {
      ...response,
      transactions: filteredTransactions,
      total: filteredTransactions.length,
    };
  }

  /**
   * Get transactions by date range
   */
  async getTransactionsByDateRange(
    startDate: Date,
    endDate: Date,
    limit: number = 100,
    offset: number = 0
  ): Promise<TransactionListResponse> {
    const response = await this.getTransactions(limit, offset);
    
    // Filter transactions by date range
    const filteredTransactions = response.transactions.filter((transaction) => {
      const transactionDate = new Date(transaction.createdAt);
      return transactionDate >= startDate && transactionDate <= endDate;
    });
    
    return {
      ...response,
      transactions: filteredTransactions,
      total: filteredTransactions.length,
    };
  }

  /**
   * Calculate total earnings
   */
  async getTotalEarnings(): Promise<number> {
    const response = await this.getTransactions(1000, 0); // Get all transactions
    
    const earnings = response.transactions
      .filter(
        (t) =>
          t.type === TransactionType.CASH_OUT && t.status === TransactionStatus.COMPLETED
      )
      .reduce((sum, t) => sum + t.amount, 0);
    
    return earnings;
  }

  /**
   * Calculate total deposits
   */
  async getTotalDeposits(): Promise<number> {
    const response = await this.getTransactions(1000, 0);
    
    const deposits = response.transactions
      .filter(
        (t) =>
          (t.type === TransactionType.DEPOSIT || t.type === TransactionType.BUY_IN) &&
          t.status === TransactionStatus.COMPLETED
      )
      .reduce((sum, t) => sum + t.amount, 0);
    
    return deposits;
  }

  /**
   * Get recent transactions (last 10)
   */
  async getRecentTransactions(): Promise<Transaction[]> {
    const response = await this.getTransactions(10, 0);
    return response.transactions;
  }
}

// Export singleton instance
export const playerBalanceService = new PlayerBalanceService();




