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
  const creditUsed = parseFloat((balance as any)?.creditUsed || '0'); // Total credit from approved credit requests
  const remainingCreditToRequest = parseFloat((balance as any)?.availableCredit || (balance as any)?.creditBalance || '0');
  const currentCashBalance = parseFloat((balance as any)?.availableBalance || (balance as any)?.cashBalance || '0');
  
  // NEW: Table balance tracking
  const currentTableBalance = parseFloat((balance as any)?.tableBalance || '0');
  const creditUsedOnTable = parseFloat((balance as any)?.creditUsedOnTable || '0');
  const cashOnTable = parseFloat((balance as any)?.cashOnTable || '0');
  const isSeated = (balance as any)?.isSeated || false;

  // When player is NOT seated, their effective playable balance should include
  // approved credit (creditUsed) in addition to wallet cash.
  const displayWalletBalance = isSeated
    ? currentCashBalance
    : currentCashBalance + creditUsed;

  const displayTotalBalance = isSeated
    ? currentCashBalance + currentTableBalance
    : currentCashBalance + creditUsed;
  
  console.log('💰 [BALANCE DISPLAY] Raw balance data:', balance);
  console.log('💰 [BALANCE DISPLAY] Cash Balance (wallet):', currentCashBalance);
  console.log('💰 [BALANCE DISPLAY] Table Balance:', currentTableBalance);
  console.log('💰 [BALANCE DISPLAY] Credit Used on Table:', creditUsedOnTable);
  console.log('💰 [BALANCE DISPLAY] Cash on Table:', cashOnTable);
  console.log('💰 [BALANCE DISPLAY] Is Seated:', isSeated);

  return (
    <div className="space-y-4">
      {/* Wallet Cash Balance (cash only) */}
      <div className={`rounded-lg p-6 text-white shadow-lg ${currentCashBalance < 0 ? 'bg-gradient-to-r from-red-600 to-red-700' : 'bg-gradient-to-r from-emerald-600 to-green-700'}`}>
        <div className="text-center">
          <h2 className="text-lg font-medium opacity-90 mb-2">
            {isSeated ? 'Wallet Balance' : 'Available Cash Balance'}
          </h2>
          <div className="text-5xl font-bold mb-2">₹{currentCashBalance.toLocaleString()}</div>
          {currentCashBalance < 0 && (
            <div className="text-sm font-semibold bg-red-900/50 rounded-full px-4 py-2 mb-2">
              ⚠️ Negative Balance - Amount Owed to Cashier
            </div>
          )}
          <div className="text-sm opacity-75 bg-black/20 rounded-full px-4 py-2 inline-block">
            {isSeated ? 'Money in wallet (not on table)' : 'Visit cashier counter for cash-out'}
          </div>
        </div>
      </div>

      {/* Table Balance - Only show if player is seated */}
      {isSeated && currentTableBalance > 0 && (
        <div className="bg-gradient-to-r from-amber-600 to-orange-700 rounded-lg p-6 text-white shadow-lg">
          <div className="text-center">
            <h2 className="text-lg font-medium opacity-90 mb-2">🎲 Table Balance</h2>
            <div className="text-5xl font-bold mb-4">₹{currentTableBalance.toLocaleString()}</div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="bg-black/20 rounded-lg p-3">
                <div className="text-xs opacity-75 mb-1">Cash on Table</div>
                <div className="text-2xl font-bold">₹{cashOnTable.toLocaleString()}</div>
              </div>
              <div className="bg-black/20 rounded-lg p-3">
                <div className="text-xs opacity-75 mb-1">Credit on Table</div>
                <div className="text-2xl font-bold">₹{creditUsedOnTable.toLocaleString()}</div>
              </div>
            </div>
            <div className="text-sm opacity-75 bg-black/20 rounded-full px-4 py-2 inline-block">
              Money currently on the table
            </div>
          </div>
        </div>
      )}

      {/* Credit Info - Only show if player has credit enabled */}
      {creditEnabled && creditLimit > 0 && (
        <div className="bg-gradient-to-r from-blue-600 to-purple-700 rounded-lg p-6 text-white shadow-lg">
          <div className="text-center">
            <h2 className="text-lg font-medium opacity-90 mb-2">Credit System</h2>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="bg-black/20 rounded-lg p-3">
                <div className="text-xs opacity-75 mb-1">Credit Limit</div>
                <div className="text-2xl font-bold">₹{creditLimit.toLocaleString()}</div>
              </div>
              <div className="bg-black/20 rounded-lg p-3">
                <div className="text-xs opacity-75 mb-1">Remaining</div>
                <div className="text-2xl font-bold">₹{remainingCreditToRequest.toLocaleString()}</div>
              </div>
            </div>
            <div className="text-sm opacity-75 bg-black/20 rounded-full px-4 py-2 inline-block">
              Request credits when needed
            </div>
          </div>
        </div>
      )}

      {/* Total Balance Summary */}
      <div className="bg-gradient-to-r from-slate-700 to-slate-800 rounded-lg p-4 text-white shadow-lg border border-slate-600">
        <div className="text-center">
          <h3 className="text-md font-medium opacity-90 mb-2">Total Balance Summary</h3>
          <div className="text-3xl font-bold mb-2">
            ₹{displayTotalBalance.toLocaleString()}
          </div>
          <div className="text-xs opacity-75 space-y-1">
            <div>
              Wallet: ₹{displayWalletBalance.toLocaleString()}
              {!isSeated && creditUsed > 0 && (
                <span className="ml-1 text-[10px] text-purple-300">
                  (includes ₹{creditUsed.toLocaleString()} approved credit)
                </span>
              )}
            </div>
            {isSeated && (
              <div>
                Table: ₹{currentTableBalance.toLocaleString()}
                {creditUsedOnTable > 0 && (
                  <span className="ml-1 text-[10px] text-purple-300">
                    (includes ₹{creditUsedOnTable.toLocaleString()} credit on table)
                  </span>
                )}
              </div>
            )}
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