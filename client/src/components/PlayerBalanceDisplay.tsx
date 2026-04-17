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

  const pendingBuyIn = buyInRequests?.find(
    (r: any) => String(r?.status || '').toLowerCase() === 'pending'
  );

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
  const remainingCreditToRequest = parseFloat((balance as any)?.availableCredit || (balance as any)?.creditBalance || '0');
  const creditUsedRaw = parseFloat(String((balance as any)?.creditUsed ?? 'NaN'));
  const creditOnLine = Number.isFinite(creditUsedRaw)
    ? Math.max(0, creditUsedRaw)
    : Math.max(0, creditLimit - remainingCreditToRequest);
  const creditRepaidRaw = parseFloat(String((balance as any)?.creditRepaidViaWallet ?? 'NaN'));
  const creditRepaidViaWallet = Number.isFinite(creditRepaidRaw) ? Math.max(0, creditRepaidRaw) : 0;
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

              {currentTableBalance > 0 && (
                <div className="text-sm opacity-75 bg-black/20 rounded-full px-4 py-2 inline-block mt-3">
                  All your money is on the table
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Wallet (cash) — always its own card when not seated */}
          <div className={`rounded-lg p-6 text-white shadow-lg ${currentCashBalance < 0 ? 'bg-gradient-to-r from-red-600 to-red-700' : 'bg-gradient-to-r from-emerald-600 to-green-700'}`}>
            <div className="text-center">
              <h2 className="text-lg font-medium opacity-90 mb-2">Available Cash Balance</h2>
              <div className="text-5xl font-bold mb-2">₹{currentCashBalance.toLocaleString()}</div>
              {currentCashBalance < 0 && (
                <div className="text-sm font-semibold bg-red-900/50 rounded-full px-4 py-2 mb-2">
                  ⚠️ Negative Balance - Amount Owed to Club
                </div>
              )}
              <div className="text-sm opacity-75 bg-black/20 rounded-full px-4 py-2 inline-block">
                Visit cashier counter for payback
              </div>
            </div>
          </div>

          {/* Credit facility — separate card when enabled */}
          {creditEnabled && creditLimit > 0 && (
            <div className="bg-gradient-to-r from-blue-600 to-purple-700 rounded-lg p-6 text-white shadow-lg">
              <div className="text-center">
                <h2 className="text-lg font-medium opacity-90 mb-3">Credit line</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3 text-left sm:text-center">
                  <div className="bg-black/20 rounded-lg p-3">
                    <div className="text-xs opacity-75 mb-1">Total credit</div>
                    <div className="text-xl sm:text-2xl font-bold">₹{creditLimit.toLocaleString()}</div>
                  </div>
                  <div className="bg-black/20 rounded-lg p-3">
                    <div className="text-xs opacity-75 mb-1">Credit used</div>
                    <div className="text-xl sm:text-2xl font-bold text-rose-300">₹{creditRepaidViaWallet.toLocaleString()}</div>
                  </div>
                  <div className="bg-black/20 rounded-lg p-3">
                    <div className="text-xs opacity-75 mb-1">Credit on line</div>
                    <div className="text-xl sm:text-2xl font-bold text-amber-200">₹{creditOnLine.toLocaleString()}</div>
                  </div>
                  <div className="bg-black/20 rounded-lg p-3">
                    <div className="text-xs opacity-75 mb-1">Credit remaining</div>
                    <div className="text-xl sm:text-2xl font-bold text-emerald-200">₹{remainingCreditToRequest.toLocaleString()}</div>
                  </div>
                </div>
                <p className="text-[11px] text-white/70 bg-black/15 rounded-lg px-3 py-2 mb-3">
                  Credit used (red) counts your negative wallet toward the line. Credit on line is still drawn. Used + on line + remaining equals your total limit.
                </p>
                <p className="text-base font-semibold text-white/95 tracking-tight">
                  You can request up to ₹{remainingCreditToRequest.toLocaleString()} (credit remaining).
                </p>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-3 text-xs text-slate-300 leading-relaxed">
            {!creditEnabled || creditLimit <= 0 ? (
              <p>
                For cash table minimum buy-in, we only check your <strong>wallet</strong>. Add money at the cashier if you are short.
              </p>
            ) : currentCashBalance < 0 ? (
              <p>
                Your wallet is negative: you cannot join a table until you repay at cashier. Credit is not auto-added while joining.
              </p>
            ) : (
              <p>
                On join/seating, we use your <strong>wallet + credit remaining</strong>. Only free/remaining credit is added to the table on join; credit already on line stays on line.
              </p>
            )}
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
