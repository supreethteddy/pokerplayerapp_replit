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

  // Handle both old and new balance data formats
  const creditEnabled = (balance as any)?.creditEnabled || false;
  const creditLimit = parseFloat((balance as any)?.creditLimit || '0');
  const creditUsed = parseFloat((balance as any)?.creditUsed || '0'); // Approved credit amount
  const remainingCreditToRequest = parseFloat((balance as any)?.availableCredit || (balance as any)?.creditBalance || '0'); // Remaining to request
  const currentCashBalance = parseFloat((balance as any)?.availableBalance || (balance as any)?.currentBalance || balance?.cashBalance || '0');
  
  console.log('💰 [BALANCE DISPLAY] Raw balance data:', balance);
  console.log('💰 [BALANCE DISPLAY] creditEnabled:', creditEnabled);
  console.log('💰 [BALANCE DISPLAY] creditLimit:', creditLimit);
  console.log('💰 [BALANCE DISPLAY] creditUsed:', creditUsed);
  console.log('💰 [BALANCE DISPLAY] remainingCreditToRequest:', remainingCreditToRequest);
  console.log('💰 [BALANCE DISPLAY] Calculated currentCashBalance:', currentCashBalance);

  return (
    <div className="space-y-4">
      {/* Main Cash Balance */}
      <div className="bg-gradient-to-r from-emerald-600 to-green-700 rounded-lg p-6 text-white shadow-lg">
        <div className="text-center">
          <h2 className="text-lg font-medium opacity-90 mb-2">Available Cash Balance</h2>
          <div className="text-5xl font-bold mb-4">₹{currentCashBalance.toLocaleString()}</div>
          <div className="text-sm opacity-75 bg-black/20 rounded-full px-4 py-2 inline-block">
            Visit cashier counter for cash-out
          </div>
        </div>
      </div>

      {/* Credit Balance - Only show if player has credit enabled */}
      {creditEnabled && creditLimit > 0 && (
        <div className="bg-gradient-to-r from-blue-600 to-purple-700 rounded-lg p-6 text-white shadow-lg">
          <div className="text-center">
            <h2 className="text-lg font-medium opacity-90 mb-2">Approved Credit Balance</h2>
            <div className="text-4xl font-bold mb-2">₹{creditUsed.toLocaleString()}</div>
            <div className="text-sm opacity-75 mb-2">
              Credit Limit: ₹{creditLimit.toLocaleString()}
            </div>
            <div className="text-sm opacity-75 mb-2">
              Remaining to Request: ₹{remainingCreditToRequest.toLocaleString()}
            </div>
            <div className="text-sm opacity-75 bg-black/20 rounded-full px-4 py-2 inline-block">
              Credit only - Cannot be withdrawn
            </div>
          </div>
        </div>
      )}

      {/* Total Balance Summary - Cash + Approved Credit */}
      <div className="bg-gradient-to-r from-slate-700 to-slate-800 rounded-lg p-4 text-white shadow-lg border border-slate-600">
        <div className="text-center">
          <h3 className="text-md font-medium opacity-90 mb-2">Total Available Balance</h3>
          <div className="text-2xl font-bold">
            ₹{(currentCashBalance + creditUsed).toLocaleString()}
          </div>
          <div className="text-xs opacity-75 mt-1">
            Cash: ₹{currentCashBalance.toLocaleString()} + Credit: ₹{creditUsed.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Real-time indicator */}
      <div className="flex items-center justify-center text-xs opacity-70 text-slate-400">
        <div className="w-2 h-2 bg-green-300 rounded-full animate-pulse mr-2"></div>
        Live Balance Updates Active
      </div>
    </div>
  );
}