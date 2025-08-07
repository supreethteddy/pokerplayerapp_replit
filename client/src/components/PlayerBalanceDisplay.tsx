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
        <h2 className="text-lg font-medium opacity-90">Total Balance</h2>
        <div className="text-4xl font-bold mb-4">₹{totalBalance.toLocaleString()}</div>
        
        {showBreakdown && (
          <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-white/20">
            <div className="text-center">
              <div className="text-sm opacity-75">Available Cash</div>
              <div className="text-xl font-semibold">₹{cashBalance.toLocaleString()}</div>
              <div className="text-xs opacity-60 mt-1">Ready for withdrawal</div>
            </div>
            <div className="text-center">
              <div className="text-sm opacity-75">At Tables</div>
              <div className="text-xl font-semibold">₹{tableBalance.toLocaleString()}</div>
              <div className="text-xs opacity-60 mt-1">Currently playing</div>
            </div>
          </div>
        )}
      </div>
      
      {/* Real-time indicator */}
      <div className="flex items-center justify-center mt-3 text-xs opacity-70">
        <div className="w-2 h-2 bg-green-300 rounded-full animate-pulse mr-2"></div>
        Live Balance Updates
      </div>
    </div>
  );
}