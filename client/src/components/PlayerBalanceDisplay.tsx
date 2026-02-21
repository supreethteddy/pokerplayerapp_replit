import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePlayerBalance } from '../hooks/usePlayerBalance';
import { useRealtimeBuyIn } from '../hooks/useRealtimeBuyIn';
import { getAuthHeaders, API_BASE_URL, STORAGE_KEYS } from '../lib/api/config';

interface PlayerBalanceDisplayProps {
  playerId: string;
  showBreakdown?: boolean;
}

export function PlayerBalanceDisplay({ playerId, showBreakdown = true }: PlayerBalanceDisplayProps) {
  const { balance, isLoading, cashBalance, tableBalance, totalBalance, error } = usePlayerBalance(playerId);
  const queryClient = useQueryClient();
  const [showBuyInForm, setShowBuyInForm] = useState(false);
  const [buyInAmount, setBuyInAmount] = useState('');
  const [buyInMessage, setBuyInMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Supabase real-time: instant updates when buy-in is approved/rejected or transactions change
  useRealtimeBuyIn(playerId);

  // Fetch player's buy-in request status (initial load, then updated via real-time)
  const { data: buyInRequests } = useQuery<any[]>({
    queryKey: ['buyin-requests', playerId],
    queryFn: async () => {
      const clubId = localStorage.getItem(STORAGE_KEYS.CLUB_ID) || sessionStorage.getItem(STORAGE_KEYS.CLUB_ID);
      const headers = getAuthHeaders(playerId, clubId || undefined);
      const response = await fetch(`${API_BASE_URL}/auth/player/buyin-requests`, {
        method: 'GET',
        headers,
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!playerId,
    // No polling - Supabase real-time handles updates
  });

  const pendingBuyIn = buyInRequests?.find((r: any) => r.status === 'pending');

  // Submit buy-in REQUEST to staff
  const tableBuyInMutation = useMutation({
    mutationFn: async (amount: number) => {
      const clubId = localStorage.getItem(STORAGE_KEYS.CLUB_ID) || sessionStorage.getItem(STORAGE_KEYS.CLUB_ID);
      const headers = getAuthHeaders(playerId, clubId || undefined);
      const response = await fetch(`${API_BASE_URL}/auth/player/table-buyin`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Failed to submit buy-in request');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setBuyInMessage({ type: 'success', text: data.message || 'Buy-in request sent to staff!' });
      setBuyInAmount('');
      setShowBuyInForm(false);
      queryClient.invalidateQueries({ queryKey: ['buyin-requests', playerId] });
      queryClient.invalidateQueries({ queryKey: [`/api/auth/player/balance`] });
      queryClient.invalidateQueries({ queryKey: ['player', 'transactions'] });
      setTimeout(() => setBuyInMessage(null), 5000);
    },
    onError: (error: any) => {
      setBuyInMessage({ type: 'error', text: error.message || 'Request failed' });
      setTimeout(() => setBuyInMessage(null), 5000);
    },
  });

  if (!playerId) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
        <div className="text-center text-slate-400">Invalid player ID</div>
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
        <div className="text-center text-red-400">Error loading balance: {error.message}</div>
      </div>
    );
  }

  const creditEnabled = (balance as any)?.creditEnabled || false;
  const creditLimit = parseFloat((balance as any)?.creditLimit || '0');
  const creditUsed = parseFloat((balance as any)?.creditUsed || '0');
  const remainingCreditToRequest = parseFloat((balance as any)?.availableCredit || (balance as any)?.creditBalance || '0');
  const currentCashBalance = parseFloat((balance as any)?.availableBalance || (balance as any)?.cashBalance || '0');

  const currentTableBalance = parseFloat((balance as any)?.tableBalance || '0');
  const creditUsedOnTable = parseFloat((balance as any)?.creditUsedOnTable || '0');
  const cashOnTable = parseFloat((balance as any)?.cashOnTable || '0');
  const isSeated = (balance as any)?.isSeated || false;

  return (
    <div className="space-y-4">
      {/* When SEATED: Table Balance is the main display */}
      {isSeated ? (
        <>
          {/* Table Balance - PRIMARY display when seated */}
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

              {/* Status messages */}
              {buyInMessage && (
                <div className={`mb-3 p-2 rounded-lg text-sm font-medium ${buyInMessage.type === 'success' ? 'bg-emerald-500/30 text-emerald-100' : 'bg-red-500/30 text-red-100'}`}>
                  {buyInMessage.text}
                </div>
              )}

              {/* Pending Buy-In Request indicator */}
              {pendingBuyIn && (
                <div className="mb-3 p-3 bg-yellow-500/20 border border-yellow-400/30 rounded-lg animate-pulse">
                  <div className="text-sm font-semibold text-yellow-200">
                    ⏳ Buy-In Request Pending: ₹{pendingBuyIn.requestedAmount?.toLocaleString()}
                  </div>
                  <div className="text-xs text-yellow-300/70 mt-1">Waiting for staff approval...</div>
                </div>
              )}

              {/* Club Buy-In Request Button */}
              {!showBuyInForm ? (
                <button
                  onClick={() => setShowBuyInForm(true)}
                  disabled={!!pendingBuyIn}
                  className="mt-2 w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 disabled:opacity-50 text-white font-semibold py-3 px-6 rounded-lg transition-all text-sm"
                >
                  {pendingBuyIn
                    ? 'Buy-In Request Pending...'
                    : '💰 Request Club Buy-In'}
                </button>
              ) : (
                <div className="mt-3 bg-black/30 rounded-lg p-4 space-y-3">
                  <div className="text-left text-sm opacity-90 font-medium">
                    Request Buy-In Amount
                  </div>
                  <div className="text-left text-xs opacity-60">
                    This request will be sent to staff for approval. Your table balance will increase once approved.
                  </div>
                  <input
                    type="number"
                    min="1"
                    value={buyInAmount}
                    onChange={(e) => setBuyInAmount(e.target.value)}
                    placeholder="Enter amount"
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/50 text-center text-xl font-bold focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const amt = parseFloat(buyInAmount);
                        if (isNaN(amt) || amt <= 0) {
                          setBuyInMessage({ type: 'error', text: 'Enter a valid amount' });
                          setTimeout(() => setBuyInMessage(null), 3000);
                          return;
                        }
                        tableBuyInMutation.mutate(amt);
                      }}
                      disabled={tableBuyInMutation.isPending}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-3 px-4 rounded-lg transition-all"
                    >
                      {tableBuyInMutation.isPending ? (
                        <span className="flex items-center justify-center">
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                          Sending...
                        </span>
                      ) : 'Submit Request'}
                    </button>
                    <button
                      onClick={() => { setShowBuyInForm(false); setBuyInAmount(''); setBuyInMessage(null); }}
                      className="bg-white/20 hover:bg-white/30 text-white font-semibold py-3 px-4 rounded-lg transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="text-sm opacity-75 bg-black/20 rounded-full px-4 py-2 inline-block mt-3">
                All your money is on the table
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* When NOT SEATED: Show wallet balance as primary */}
          <div className={`rounded-lg p-6 text-white shadow-lg ${currentCashBalance < 0 ? 'bg-gradient-to-r from-red-600 to-red-700' : 'bg-gradient-to-r from-emerald-600 to-green-700'}`}>
            <div className="text-center">
              <h2 className="text-lg font-medium opacity-90 mb-2">Available Cash Balance</h2>
              <div className="text-5xl font-bold mb-2">₹{currentCashBalance.toLocaleString()}</div>
              {currentCashBalance < 0 && (
                <div className="text-sm font-semibold bg-red-900/50 rounded-full px-4 py-2 mb-2">
                  ⚠️ Negative Balance - Amount Owed to Cashier
                </div>
              )}
              <div className="text-sm opacity-75 bg-black/20 rounded-full px-4 py-2 inline-block">
                Visit cashier counter for cash-out
              </div>
            </div>
          </div>

          {/* Credit Info - Only when NOT seated */}
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
                  Credits auto-applied when you join a table
                </div>
              </div>
            </div>
          )}

          {/* Total Balance Summary - only when NOT seated */}
          <div className="bg-gradient-to-r from-slate-700 to-slate-800 rounded-lg p-4 text-white shadow-lg border border-slate-600">
            <div className="text-center">
              <h3 className="text-md font-medium opacity-90 mb-2">Total Balance Summary</h3>
              <div className="text-3xl font-bold mb-2">
                ₹{(currentCashBalance + creditUsed).toLocaleString()}
              </div>
              <div className="text-xs opacity-75 space-y-1">
                <div>
                  Wallet: ₹{currentCashBalance.toLocaleString()}
                  {creditUsed > 0 && (
                    <span className="ml-1 text-[10px] text-purple-300">
                      + ₹{creditUsed.toLocaleString()} approved credit
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  All balance moves to table when you sit down
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Real-time indicator */}
      <div className="flex items-center justify-center text-xs opacity-70 text-slate-400">
        <div className="w-2 h-2 bg-green-300 rounded-full animate-pulse mr-2"></div>
        Live Balance Updates Active
      </div>
    </div>
  );
}
