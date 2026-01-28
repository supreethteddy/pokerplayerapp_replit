import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

interface Transaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PlayerTransactionHistoryProps {
  playerId: string;
  limit?: number;
}

export function PlayerTransactionHistory({ playerId, limit = 10 }: PlayerTransactionHistoryProps) {
  const { data: transactionsData, isLoading } = useQuery({
    queryKey: [`/api/auth/player/transactions`, playerId, limit],
    queryFn: async () => {
      // Try multiple endpoints as fallback
      const endpoints = [
        `/api/auth/player/transactions?limit=${limit}`,
        `/api/player/${playerId}/transactions?limit=${limit}`,
      ];

      let lastError: Error | null = null;
      
      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, {
            headers: {
              'x-player-id': playerId,
              'x-club-id': localStorage.getItem('clubId') || sessionStorage.getItem('clubId') || '',
              'Content-Type': 'application/json',
            },
            credentials: 'include',
          });

          if (response.ok) {
            const data = await response.json();
            // Handle different response formats
            if (Array.isArray(data)) {
              return data;
            } else if (data.transactions && Array.isArray(data.transactions)) {
              return data.transactions;
            } else if (data.data && Array.isArray(data.data)) {
              return data.data;
            }
            return [];
          }
        } catch (error) {
          lastError = error as Error;
          console.warn(`Failed to fetch from ${endpoint}:`, error);
          // Continue to next endpoint
        }
      }

      // If all endpoints failed, throw the last error
      if (lastError) {
        throw lastError;
      }
      throw new Error('Failed to fetch transactions from all endpoints');
    },
    enabled: !!playerId,
    refetchInterval: 30000, // Refetch every 30 seconds
    retry: 2, // Retry failed requests
  });

  const transactions = transactionsData || [];

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'cash_in': 
      case 'funds_added': 
      case 'deposit': return '💰';
      case 'cash_out': 
      case 'cashier_withdrawal': 
      case 'withdrawal': return '💳';
      case 'table_buy_in': return '🎯';
      case 'table_cash_out': return '🏆';
      case 'add_credit': 
      case 'credit_added': 
      case 'credit_approved': return '💳';
      case 'clear_credit': 
      case 'credit_cleared': return '🔄';
      case 'credit_transfer': return '🔄';
      default: return '💸';
    }
  };

  const getTransactionLabel = (type: string) => {
    switch (type) {
      case 'cash_in': 
      case 'funds_added': 
      case 'deposit': return 'Funds Added';
      case 'cash_out': 
      case 'cashier_withdrawal': 
      case 'withdrawal': return 'Cash Withdrawal';
      case 'table_buy_in': return 'Table Buy-in';
      case 'table_cash_out': return 'Table Cash-out';
      case 'add_credit': 
      case 'credit_added': 
      case 'credit_approved': return 'Credit Added';
      case 'clear_credit': 
      case 'credit_cleared': return 'Credit Cleared';
      case 'credit_transfer': return 'Credit Transfer';
      default: return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  const getAmountColor = (type: string) => {
    switch (type) {
      case 'add_credit': 
      case 'credit_added': 
      case 'credit_approved': return 'text-blue-400'; // Blue for add credit
      case 'clear_credit': 
      case 'credit_cleared': return 'text-orange-400'; // Orange for clear credit
      case 'cash_in':
      case 'table_cash_out': 
      case 'funds_added': 
      case 'deposit': return 'text-emerald-400'; // Green for cash in/funds added
      case 'cash_out':
      case 'cashier_withdrawal':
      case 'table_buy_in': 
      case 'withdrawal': return 'text-red-400'; // Red for cash out/withdrawals
      case 'credit_transfer': return 'text-purple-400'; // Purple for credit transfer
      default: return 'text-slate-400';
    }
  };

  const getAmountPrefix = (type: string) => {
    switch (type) {
      case 'add_credit': 
      case 'credit_added': 
      case 'credit_approved': return '+'; // Positive for add credit
      case 'clear_credit': 
      case 'credit_cleared': return '-'; // Negative for clear credit
      case 'cash_in':
      case 'table_cash_out':
      case 'funds_added': 
      case 'deposit': return '+'; // Positive for funds added
      case 'cash_out':
      case 'cashier_withdrawal':
      case 'table_buy_in': 
      case 'withdrawal': return '-'; // Negative for withdrawals
      case 'credit_transfer': return '±'; // Transfer indicator
      default: return '';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="animate-pulse bg-gray-100 dark:bg-gray-700 rounded p-3">
            <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded mb-2"></div>
            <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="bg-slate-800 border-slate-700 rounded-lg">
      <div className="px-4 py-3 border-b border-slate-700 flex justify-between items-center">
        <h3 className="text-lg font-medium text-white">
          Recent Transactions
        </h3>
        <button
          className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors cursor-default"
        >
          Last 10 Transactions
        </button>
      </div>
      <div className="space-y-3 p-4">
        {transactions.slice(0, limit).map((transaction) => (
          <div key={transaction.id} className="bg-slate-700 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3 flex-1">
                <div className="w-8 h-8 bg-slate-600 rounded-lg flex items-center justify-center">
                  <span className="text-lg">{getTransactionIcon(transaction.type)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white">
                    {getTransactionLabel(transaction.type)}
                  </div>
                  <div className="text-sm text-slate-400">
                    {new Date(transaction.createdAt).toLocaleDateString()} at{' '}
                    {new Date(transaction.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {transaction.notes && (
                    <div className="text-xs text-slate-500 mt-1">
                      {transaction.notes}
                    </div>
                  )}
                  <div className="text-xs text-slate-500">
                    Status: <span className={transaction.status === 'Completed' ? 'text-green-400' : 'text-yellow-400'}>{transaction.status}</span>
                  </div>
                </div>
              </div>
              <div className={`text-right font-bold text-lg ${getAmountColor(transaction.type)}`}>
                {getAmountPrefix(transaction.type)}₹{transaction.amount.toLocaleString()}
              </div>
            </div>
          </div>
        ))}
        
        {transactions.length === 0 && (
          <div className="text-center py-8 text-slate-400">
            No transactions found
          </div>
        )}
      </div>
    </div>
  );
}