import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usePlayerBalance } from '../hooks/usePlayerBalance';
import { useToast } from '@/hooks/use-toast';

interface CashOutRequestProps {
  playerId: string;
}

export function CashOutRequest({ playerId }: CashOutRequestProps) {
  const [amount, setAmount] = useState('');
  const [isRequesting, setIsRequesting] = useState(false);
  const { cashBalance, creditBalance, totalBalance } = usePlayerBalance(playerId);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const requestCashOut = useMutation({
    mutationFn: async (data: { amount: number; playerId: string }) => {
      const response = await fetch('/api/cash-out-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: data.playerId,
          amount: data.amount,
          requestedAt: new Date().toISOString(),
          cashBalance: cashBalance,
          creditBalance: creditBalance,
          totalBalance: totalBalance,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit cash-out request');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Cash-out Request Submitted",
        description: "Your request has been sent to the cashier. Please visit the cashier counter to collect your funds.",
        variant: "default",
      });
      setAmount('');
      setIsRequesting(false);
      queryClient.invalidateQueries({ queryKey: [`/api/player/${playerId}/balance`] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const requestAmount = parseFloat(amount);
    
    if (requestAmount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }
    
    // Different validation based on whether player has credit
    if (creditBalance === 0) {
      // No credit - validate against cash balance only
      if (requestAmount > cashBalance) {
        toast({
          title: "Insufficient Cash Balance",
          description: `Available cash: ₹${cashBalance.toLocaleString()}`,
          variant: "destructive",
        });
        return;
      }
    } else {
      // Has credit - validate against total balance
      if (requestAmount > totalBalance) {
        toast({
          title: "Insufficient Total Balance",
          description: `Available balance: ₹${totalBalance.toLocaleString()} (Cash: ₹${cashBalance.toLocaleString()}, Credit: ₹${creditBalance.toLocaleString()})`,
          variant: "destructive",
        });
        return;
      }

      // Show warning if credit will be deducted
      if (requestAmount > cashBalance && creditBalance > 0) {
        const creditDeduction = requestAmount - cashBalance;
        toast({
          title: "Credit Deduction Notice",
          description: `Cash-out will deduct ₹${creditDeduction.toLocaleString()} from your credit balance. Net receivable: ₹${cashBalance.toLocaleString()}`,
          variant: "default",
        });
      }
    }

    requestCashOut.mutate({ amount: requestAmount, playerId });
  };

  if (!isRequesting) {
    return (
      <button
        onClick={() => setIsRequesting(true)}
        className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors"
      >
        Request Cash-Out
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">
          Cash-Out Amount
        </label>
        <input
          type="number"
          min="1"
          max={creditBalance === 0 ? cashBalance : totalBalance}
          step="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          placeholder="Enter amount"
          required
        />
        {creditBalance === 0 ? (
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Available for cash-out: ₹{cashBalance.toLocaleString()}
          </div>
        ) : (
          <>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Available: ₹{totalBalance.toLocaleString()} (Cash: ₹{cashBalance.toLocaleString()}, Credit: ₹{creditBalance.toLocaleString()})
            </div>
            <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              Note: Cash-out deducts credit first, you receive cash portion only
            </div>
          </>
        )}
      </div>
      
      <div className="flex space-x-2">
        <button
          type="submit"
          disabled={requestCashOut.isPending}
          className="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700 transition-colors disabled:opacity-50"
        >
          {requestCashOut.isPending ? 'Submitting...' : 'Submit Request'}
        </button>
        <button
          type="button"
          onClick={() => setIsRequesting(false)}
          className="flex-1 bg-gray-600 text-white py-2 rounded hover:bg-gray-700 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}