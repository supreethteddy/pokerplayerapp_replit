import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usePlayerBalance } from '../hooks/usePlayerBalance';
import { useToast } from '@/hooks/use-toast';

interface TableOperationsProps {
  playerId: string;
}

export function TableOperations({ playerId }: TableOperationsProps) {
  const [buyInAmount, setBuyInAmount] = useState('');
  const [cashOutAmount, setCashOutAmount] = useState('');
  const [tableId, setTableId] = useState('Table-1');
  const { cashBalance, tableBalance } = usePlayerBalance(playerId);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const buyInMutation = useMutation({
    mutationFn: async (data: { playerId: string; tableId: string; amount: number }) => {
      const response = await fetch('/api/table/buy-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: data.playerId,
          tableId: data.tableId,
          amount: data.amount,
          staffId: 'player_portal'
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process buy-in');
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Buy-in Successful",
        description: `₹${parseFloat(buyInAmount).toLocaleString()} deducted from your balance. New balance: ₹${data.newBalance.toLocaleString()}`,
        variant: "default",
      });
      setBuyInAmount('');
      queryClient.invalidateQueries({ queryKey: [`/api/player/${playerId}/balance`] });
      queryClient.invalidateQueries({ queryKey: [`/api/player/${playerId}/transactions`] });
    },
    onError: (error: any) => {
      toast({
        title: "Buy-in Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const cashOutMutation = useMutation({
    mutationFn: async (data: { playerId: string; tableId: string; amount: number }) => {
      const response = await fetch('/api/table/cash-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: data.playerId,
          tableId: data.tableId,
          amount: data.amount,
          staffId: 'player_portal'
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process cash-out');
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Cash-out Successful",
        description: `₹${parseFloat(cashOutAmount).toLocaleString()} added to your balance. New balance: ₹${data.newBalance.toLocaleString()}`,
        variant: "default",
      });
      setCashOutAmount('');
      queryClient.invalidateQueries({ queryKey: [`/api/player/${playerId}/balance`] });
      queryClient.invalidateQueries({ queryKey: [`/api/player/${playerId}/transactions`] });
    },
    onError: (error: any) => {
      toast({
        title: "Cash-out Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleBuyIn = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(buyInAmount);
    
    if (amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid buy-in amount",
        variant: "destructive",
      });
      return;
    }
    
    if (amount > cashBalance) {
      toast({
        title: "Insufficient Balance",
        description: `Available cash balance: ₹${cashBalance.toLocaleString()}`,
        variant: "destructive",
      });
      return;
    }

    buyInMutation.mutate({ playerId, tableId, amount });
  };

  const handleCashOut = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(cashOutAmount);
    
    if (amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid cash-out amount",
        variant: "destructive",
      });
      return;
    }

    cashOutMutation.mutate({ playerId, tableId, amount });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-white">Table Operations</h3>
      
      {/* Table Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">
          Select Table
        </label>
        <select 
          value={tableId} 
          onChange={(e) => setTableId(e.target.value)}
          className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value="Table-1">Table 1</option>
          <option value="Table-2">Table 2</option>
          <option value="Table-3">Table 3</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Buy-in Form */}
        <form onSubmit={handleBuyIn} className="space-y-4">
          <h4 className="font-medium text-gray-900 dark:text-white">Table Buy-in</h4>
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">
              Buy-in Amount
            </label>
            <input
              type="number"
              min="1"
              max={cashBalance}
              step="1"
              value={buyInAmount}
              onChange={(e) => setBuyInAmount(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Enter amount"
              required
            />
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Available: ₹{cashBalance.toLocaleString()}
            </div>
          </div>
          <button
            type="submit"
            disabled={buyInMutation.isPending}
            className="w-full bg-red-600 text-white py-2 rounded hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {buyInMutation.isPending ? 'Processing...' : 'Buy-in (Deduct Balance)'}
          </button>
        </form>

        {/* Cash-out Form */}
        <form onSubmit={handleCashOut} className="space-y-4">
          <h4 className="font-medium text-gray-900 dark:text-white">Table Cash-out</h4>
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">
              Cash-out Amount
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={cashOutAmount}
              onChange={(e) => setCashOutAmount(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Enter chips amount"
              required
            />
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Current table balance: ₹{tableBalance.toLocaleString()}
            </div>
          </div>
          <button
            type="submit"
            disabled={cashOutMutation.isPending}
            className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {cashOutMutation.isPending ? 'Processing...' : 'Cash-out (Add Balance)'}
          </button>
        </form>
      </div>
    </div>
  );
}