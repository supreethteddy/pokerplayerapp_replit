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
      console.log('📊 [PLAYER TRANSACTIONS] Response:', data);
      console.log('📊 [PLAYER TRANSACTIONS] Transactions count:', data.transactions?.length || 0);
      return data.transactions || [];
    },
    enabled: !!playerId,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const transactions = transactionsData || [];

  const getTransactionIcon = (type: string) => {
    const t = type.toLowerCase();
    if (t === 'club buy in') return '🏦';
    if (t === 'club buy out') return '💵';
    if (t === 'table buy in') return '🎯';
    if (t === 'table buy out') return '🎲';
    if (t.includes('credit')) return '💳';
    if (t.includes('debit')) return '📤';
    if (t.includes('deposit') || t.includes('bonus')) return '💰';
    if (t.includes('cashout') || t.includes('withdrawal')) return '💵';
    if (t.includes('buy in')) return '🎯';
    if (t.includes('refund')) return '🔄';
    return '💸';
  };

  const getTransactionLabel = (type: string) => {
    return type;
  };

  const getAmountColor = (type: string) => {
    const t = type.toLowerCase();
    if (t === 'club buy in' || t === 'table buy out') return 'text-emerald-400';
    if (t === 'club buy out' || t === 'table buy in') return 'text-red-400';
    if (t === 'debit') return 'text-orange-400';
    if (t.includes('credit') || t.includes('bonus')) return 'text-blue-400';
    if (t.includes('deposit') || t.includes('refund')) return 'text-emerald-400';
    if (t.includes('cashout') || t.includes('withdrawal') || t.includes('buy in')) return 'text-red-400';
    return 'text-slate-400';
  };

  const getAmountPrefix = (type: string) => {
    const t = type.toLowerCase();
    if (t === 'club buy in' || t === 'table buy out') return '+';
    if (t === 'club buy out' || t === 'table buy in' || t === 'debit') return '-';
    if (t.includes('deposit') || t.includes('credit') || t.includes('bonus') || t.includes('refund')) return '+';
    if (t.includes('cashout') || t.includes('withdrawal') || t.includes('buy in')) return '-';
    return '';
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
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">
                      {getTransactionLabel(transaction.type)}
                    </span>
                    {(transaction as any).gameType && (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        (transaction as any).gameType === 'poker' 
                          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' 
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}>
                        {(transaction as any).gameType === 'poker' ? '♠ Poker' : '🃏 Rummy'}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-slate-400">
                    {new Date(transaction.createdAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })} at{' '}
                    {new Date(transaction.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}
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