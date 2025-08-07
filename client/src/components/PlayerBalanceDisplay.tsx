import React from 'react';
import { usePlayerBalance } from '../hooks/usePlayerBalance';

interface PlayerBalanceDisplayProps {
  playerId: string;
  showBreakdown?: boolean;
}

export function PlayerBalanceDisplay({ playerId, showBreakdown = true }: PlayerBalanceDisplayProps) {
  const { balance, isLoading, cashBalance, tableBalance, totalBalance } = usePlayerBalance(playerId);

  if (isLoading) {
    return (
      <div className="animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg p-4">
        <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded mb-2"></div>
        <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded"></div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-green-500 to-blue-600 rounded-lg p-6 text-white">
      <div className="text-center">
        <h2 className="text-lg font-medium opacity-90">Available Balance</h2>
        <div className="text-4xl font-bold mb-4">₹{cashBalance.toLocaleString()}</div>
        <div className="text-sm opacity-75 mt-2">
          Available for withdrawal at cashier
        </div>
      </div>
      
      {/* Real-time indicator */}
      <div className="flex items-center justify-center mt-4 text-xs opacity-70">
        <div className="w-2 h-2 bg-green-300 rounded-full animate-pulse mr-2"></div>
        Live Balance Updates
      </div>
    </div>
  );
}