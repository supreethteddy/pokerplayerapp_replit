import React from 'react';
import { usePlayerTransactions } from '@/hooks/usePlayerAPI';
import { TransactionType, TransactionStatus } from '@/lib/api';

interface PlayerTransactionHistoryProps {
  playerId: string;
  limit?: number;
}

export function PlayerTransactionHistory({ playerId, limit = 10 }: PlayerTransactionHistoryProps) {
  const { data: transactionsResponse, isLoading, error } = usePlayerTransactions(limit);

  const transactions = transactionsResponse?.transactions || [];

  const getTransactionIcon = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('club buy in') || t.includes('deposit')) return '🏦';
    if (t.includes('club buy out') || t.includes('withdrawal') || t.includes('cashout')) return '💵';
    if (t.includes('table buy in') || t.includes('buy_in')) return '🎯';
    if (t.includes('table buy out') || t.includes('cash_out')) return '🎲';
    if (t.includes('credit')) return '💳';
    if (t.includes('debit')) return '📤';
    if (t.includes('bonus')) return '💰';
    if (t.includes('refund')) return '🔄';
    if (t.includes('rake') || t.includes('fee')) return '✂️';
    if (t.includes('tip')) return '🤲';
    if (t.includes('win')) return '🏆';
    if (t.includes('loss')) return '📉';
    return '💸';
  };

  const getTransactionLabel = (type: string) => {
    // Convert snake_case or specific types to readable labels
    const t = type.toLowerCase();
    if (t === 'club buy in') return 'Club Deposit';
    if (t === 'club buy out') return 'Club Withdrawal';
    if (t === 'table buy in' || t === 'buy_in') return 'Table Buy-in';
    if (t === 'table buy out' || t === 'cash_out') return 'Table Cash-out';

    // Replace underscores with spaces and capitalize
    return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const getAmountColor = (type: string) => {
    const t = type.toLowerCase();
    // Positive flows
    if (t.includes('club buy in') || t.includes('table buy out') ||
      t.includes('deposit') || t.includes('refund') ||
      t.includes('bonus') || t.includes('win') || t.includes('credit')) {
      return 'text-emerald-400';
    }
    // Negative flows
    if (t.includes('club buy out') || t.includes('table buy in') ||
      t.includes('withdrawal') || t.includes('cashout') ||
      t.includes('buy_in') || t.includes('buy in') ||
      t.includes('rake') || t.includes('fee') ||
      t.includes('tip') || t.includes('loss') || t.includes('debit')) {
      return 'text-red-400';
    }
    return 'text-slate-400';
  };

  const getAmountPrefix = (type: string) => {
    const t = type.toLowerCase();
    // Positive flows
    if (t.includes('club buy in') || t.includes('table buy out') ||
      t.includes('deposit') || t.includes('refund') ||
      t.includes('bonus') || t.includes('win') || t.includes('credit')) {
      return '+';
    }
    // Negative flows
    if (t.includes('club buy out') || t.includes('table buy in') ||
      t.includes('withdrawal') || t.includes('cashout') ||
      t.includes('buy_in') || t.includes('buy in') ||
      t.includes('rake') || t.includes('fee') ||
      t.includes('tip') || t.includes('loss') || t.includes('debit')) {
      return '-';
    }
    return '';
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(limit)].map((_, i) => (
          <div key={i} className="animate-pulse bg-slate-800 border border-slate-700 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-slate-700 rounded-lg"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-slate-700 rounded w-1/4"></div>
                <div className="h-3 bg-slate-700 rounded w-1/2"></div>
              </div>
              <div className="h-6 bg-slate-700 rounded w-16"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-center">
        <p className="text-red-400 text-sm">Failed to load transactions</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {transactions.slice(0, limit).map((transaction) => (
        <div key={transaction.id} className="bg-slate-700/50 hover:bg-slate-700 border border-slate-600/30 rounded-lg p-4 transition-all duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              <div className="w-10 h-10 bg-slate-800/80 rounded-xl flex items-center justify-center border border-slate-600/50 shadow-inner">
                <span className="text-xl">{getTransactionIcon(transaction.type)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-semibold text-slate-100 truncate">
                    {getTransactionLabel(transaction.type)}
                  </span>
                  {transaction.metadata?.gameType && (
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${transaction.metadata.gameType === 'poker'
                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}>
                      {transaction.metadata.gameType === 'poker' ? '♠ Poker' : '🃏 Rummy'}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400 flex items-center gap-2">
                  <span>
                    {new Date(transaction.createdAt).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      timeZone: 'Asia/Kolkata'
                    })}
                  </span>
                  <span className="w-1 h-1 bg-slate-600 rounded-full"></span>
                  <span>
                    {new Date(transaction.createdAt).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: 'Asia/Kolkata'
                    })}
                  </span>
                </div>
                {transaction.description && (
                  <div className="text-[11px] text-slate-500 mt-1 italic truncate">
                    {transaction.description}
                  </div>
                )}
                {transaction.notes && (
                  <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                    {transaction.notes}
                  </div>
                )}
                <div className="text-[10px] mt-1">
                  <span className={`px-1.5 py-0.5 rounded-full ${transaction.status === TransactionStatus.COMPLETED
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : transaction.status === TransactionStatus.PENDING
                        ? 'bg-amber-500/10 text-amber-400'
                        : 'bg-red-500/10 text-red-400'
                    }`}>
                    {transaction.status}
                  </span>
                </div>
              </div>
            </div>
            <div className={`text-right font-bold text-lg ${getAmountColor(transaction.type)} pl-4`}>
              {getAmountPrefix(transaction.type)}₹{Math.abs(transaction.amount).toLocaleString()}
            </div>
          </div>
        </div>
      ))}

      {transactions.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 px-4 rounded-xl border border-dashed border-slate-700 bg-slate-800/20">
          <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mb-3">
            <span className="text-2xl">📋</span>
          </div>
          <p className="text-slate-400 text-sm font-medium">No transactions found</p>
          <p className="text-slate-500 text-xs mt-1">Your recent activity will appear here</p>
        </div>
      )}
    </div>
  );
}