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
      ? 'text-emerald-400' 
      : 'text-red-400';
  };

  const getAmountPrefix = (type: string) => {
    return ['cash_in', 'table_cash_out'].includes(type) ? '+' : '-';
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
          {showAll ? 'All Transactions' : 'Recent Transactions'}
        </h3>
        <button
          onClick={() => setShowAll(!showAll)}
          className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
        >
          {showAll ? 'Show All' : 'Show All'}
        </button>
      </div>
      <div className="space-y-3 p-4">
        {(showAll ? transactions : transactions.slice(0, limit)).map((transaction) => (
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