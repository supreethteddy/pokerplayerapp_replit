import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

interface Transaction {
  id: number;
  player_id: number;
  type: string;
  amount: string;
  description: string;
  created_at: string;
  staff_id: string;
}

interface PlayerTransactionHistoryProps {
  playerId: string;
  limit?: number;
}

export function PlayerTransactionHistory({ playerId, limit = 10 }: PlayerTransactionHistoryProps) {
  const { data: transactionsData, isLoading } = useQuery({
    queryKey: [`/api/auth/player/transactions`, playerId, limit],
    queryFn: async () => {
      const response = await fetch(`/api/auth/player/transactions?limit=${limit}`, {
        headers: {
          'x-player-id': playerId,
          'x-club-id': localStorage.getItem('clubId') || sessionStorage.getItem('clubId') || '',
        },
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch transactions');
      }
      const data = await response.json();
      return data.transactions || [];
    },
    enabled: !!playerId,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const transactions = transactionsData || [];

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'cash_in': return '💰';
      case 'cash_out': return '💳';
      case 'table_buy_in': return '🎯';
      case 'table_cash_out': return '🏆';
      case 'add_credit': return '💳';
      case 'clear_credit': return '🔄';
      default: return '💸';
    }
  };

  const getTransactionLabel = (type: string) => {
    switch (type) {
      case 'cash_in': 
      case 'funds_added': return 'Funds Added';
      case 'cash_out': 
      case 'cashier_withdrawal': return 'Cash Withdrawal';
      case 'table_buy_in': return 'Table Buy-in';
      case 'table_cash_out': return 'Table Cash-out';
      case 'add_credit': return 'Add Credit';
      case 'clear_credit': return 'Clear Credit';
      default: return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  const getAmountColor = (type: string) => {
    switch (type) {
      case 'add_credit': return 'text-blue-400'; // Blue for add credit
      case 'clear_credit': return 'text-orange-400'; // Orange for clear credit
      case 'cash_in':
      case 'table_cash_out': 
      case 'funds_added': return 'text-emerald-400'; // Green for cash in/funds added
      case 'cash_out':
      case 'cashier_withdrawal':
      case 'table_buy_in': return 'text-red-400'; // Red for cash out/withdrawals
      default: return 'text-slate-400';
    }
  };

  const getAmountPrefix = (type: string) => {
    switch (type) {
      case 'add_credit': return '+'; // Positive for add credit
      case 'clear_credit': return '-'; // Negative for clear credit
      case 'cash_in':
      case 'table_cash_out':
      case 'funds_added': return '+'; // Positive for funds added
      case 'cash_out':
      case 'cashier_withdrawal':
      case 'table_buy_in': return '-'; // Negative for withdrawals
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
                    {new Date(transaction.created_at).toLocaleDateString()} at{' '}
                    {new Date(transaction.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {transaction.description && (
                    <div className="text-xs text-slate-500 mt-1">
                      {transaction.description}
                    </div>
                  )}
                  {transaction.staff_id && (
                    <div className="text-xs text-slate-500">
                      Processed by: {transaction.staff_id}
                    </div>
                  )}
                </div>
              </div>
              <div className={`text-right font-bold text-lg ${getAmountColor(transaction.type)}`}>
                {getAmountPrefix(transaction.type)}₹{parseFloat(transaction.amount).toLocaleString()}
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