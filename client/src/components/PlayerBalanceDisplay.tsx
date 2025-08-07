import React from 'react';
import { usePlayerBalance } from '../hooks/usePlayerBalance';

interface PlayerBalanceDisplayProps {
  playerId: string;
  showBreakdown?: boolean;
}

export function PlayerBalanceDisplay({ playerId, showBreakdown = true }: PlayerBalanceDisplayProps) {
  const { balance, isLoading, cashBalance, tableBalance, totalBalance, error } = usePlayerBalance(playerId);

  if (!playerId) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
        <div className="text-center text-slate-400">
          Invalid player ID
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-slate-600 rounded mb-4"></div>
          <div className="h-12 bg-slate-600 rounded mb-2"></div>
          <div className="h-4 bg-slate-600 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-800 border border-red-700 rounded-lg p-6">
        <div className="text-center text-red-400">
          Error loading balance: {error.message}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-emerald-600 to-green-700 rounded-lg p-6 text-white shadow-lg">
      <div className="text-center">
        <h2 className="text-lg font-medium opacity-90 mb-2">Available Cash Balance</h2>
        <div className="text-5xl font-bold mb-4">₹{cashBalance?.toLocaleString() || '0'}</div>
        <div className="text-sm opacity-75 bg-black/20 rounded-full px-4 py-2 inline-block">
          Ready for withdrawal at cashier counter
        </div>
      </div>
      
      {/* Real-time indicator */}
      <div className="flex items-center justify-center mt-6 text-xs opacity-70">
        <div className="w-2 h-2 bg-green-300 rounded-full animate-pulse mr-2"></div>
        Live Balance Updates Active
      </div>
    </div>
  );
}