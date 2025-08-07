import React from 'react';
import { useQuery } from '@tanstack/react-query';

interface Transaction {
  id: number;
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
  const { data: transactions = [], isLoading } = useQuery<Transaction[]>({
    queryKey: [`/api/player/${playerId}/transactions`],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'cash_in': return '💰';
      case 'cash_out': return '💳';
      case 'table_buy_in': return '🎯';
      case 'table_cash_out': return '🏆';
      default: return '💸';
    }
  };

  const getTransactionLabel = (type: string) => {
    switch (type) {
      case 'cash_in': return 'Funds Added';
      case 'cash_out': return 'Cash Withdrawal';
      case 'table_buy_in': return 'Table Buy-in';
      case 'table_cash_out': return 'Table Cash-out';
      default: return type;
    }
  };

  const getAmountColor = (type: string) => {
    return ['cash_in', 'table_cash_out'].includes(type) 
      ? 'text-green-600 dark:text-green-400' 
      : 'text-red-600 dark:text-red-400';
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
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Recent Transactions</h3>
      </div>
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {transactions.slice(0, limit).map((transaction) => (
          <div key={transaction.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{getTransactionIcon(transaction.type)}</span>
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {getTransactionLabel(transaction.type)}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {new Date(transaction.created_at).toLocaleDateString()} at{' '}
                    {new Date(transaction.created_at).toLocaleTimeString()}
                  </div>
                  {transaction.description && (
                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {transaction.description}
                    </div>
                  )}
                  {transaction.staff_id && (
                    <div className="text-xs text-gray-400 dark:text-gray-500">
                      Processed by: {transaction.staff_id}
                    </div>
                  )}
                </div>
              </div>
              <div className={`text-lg font-semibold ${getAmountColor(transaction.type)}`}>
                {['cash_in', 'table_cash_out'].includes(transaction.type) ? '+' : '-'}
                ₹{parseFloat(transaction.amount).toLocaleString()}
              </div>
            </div>
          </div>
        ))}
        
        {transactions.length === 0 && (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            No transactions found
          </div>
        )}
      </div>
    </div>
  );
}