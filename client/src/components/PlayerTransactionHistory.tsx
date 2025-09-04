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
  const [showAll, setShowAll] = useState(false);
  
  const { data: transactions = [], isLoading } = useQuery<Transaction[]>({
    queryKey: [`/api/player/${playerId}/transactions`, showAll ? 100 : limit],
    queryFn: async () => {
      const response = await fetch(`/api/player/${playerId}/transactions?limit=${showAll ? 100 : limit}`);
      if (!response.ok) {
        throw new Error('Failed to fetch transactions');
      }
      const data = await response.json();
      // Filter transactions for this specific player only
      return data.filter((transaction: Transaction) => transaction.player_id === parseInt(playerId));
    },
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
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
          {showAll ? 'All Transactions' : 'Recent Transactions'}
        </h3>
        <button
          onClick={() => setShowAll(!showAll)}
          className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
        >
          {showAll ? 'Show Recent' : 'Show All'}
        </button>
      </div>
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {(showAll ? transactions : transactions.slice(0, limit)).map((transaction) => (
          <div key={transaction.id} className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                <span className="text-lg flex-shrink-0 w-6 h-6 flex items-center justify-center">{getTransactionIcon(transaction.type)}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 dark:text-white truncate">
                    {getTransactionLabel(transaction.type)}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                    {new Date(transaction.created_at).toLocaleDateString()} at{' '}
                    {new Date(transaction.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {transaction.description && (
                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-1 truncate">
                      {transaction.description}
                    </div>
                  )}
                  {transaction.staff_id && (
                    <div className="text-xs text-gray-400 dark:text-gray-500 truncate">
                      Processed by: {transaction.staff_id}
                    </div>
                  )}
                </div>
              </div>
              <div className={`text-right flex-shrink-0 ${getAmountColor(transaction.type)}`}>
                <div className="text-base font-bold">
                  {['cash_in', 'table_cash_out'].includes(transaction.type) ? '+' : '-'}
                  ₹{parseFloat(transaction.amount).toLocaleString()}
                </div>
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