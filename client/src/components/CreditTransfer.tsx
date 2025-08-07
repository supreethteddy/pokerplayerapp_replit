import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { CreditCard, ArrowRight } from 'lucide-react';

interface CreditTransferProps {
  playerId: string;
  availableCredit: number;
  onTransferComplete?: () => void;
}

export function CreditTransfer({ playerId, availableCredit, onTransferComplete }: CreditTransferProps) {
  const [transferAmount, setTransferAmount] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const transferMutation = useMutation({
    mutationFn: async (amount: number) => {
      return apiRequest('POST', `/api/player/${playerId}/credit-transfer`, {
        amount,
        type: 'credit_to_cash'
      });
    },
    onSuccess: () => {
      toast({
        title: "Credit Transferred Successfully",
        description: `₹${transferAmount} has been added to your available balance`,
        variant: "default",
      });
      
      setTransferAmount('');
      
      // Invalidate balance queries to refresh the display
      queryClient.invalidateQueries({ queryKey: [`/api/player/${playerId}/balance`] });
      queryClient.invalidateQueries({ queryKey: [`/api/player/${playerId}/transactions`] });
      
      onTransferComplete?.();
    },
    onError: (error: any) => {
      toast({
        title: "Transfer Failed",
        description: error?.message || "Failed to transfer credit to balance",
        variant: "destructive",
      });
    },
  });

  const handleTransfer = () => {
    const amount = parseFloat(transferAmount);
    
    if (!amount || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount to transfer",
        variant: "destructive",
      });
      return;
    }

    if (amount > availableCredit) {
      toast({
        title: "Insufficient Credit",
        description: "Transfer amount cannot exceed available credit",
        variant: "destructive",
      });
      return;
    }

    transferMutation.mutate(amount);
  };

  const handleMaxTransfer = () => {
    if (availableCredit > 0) {
      setTransferAmount(availableCredit.toString());
    }
  };

  if (availableCredit <= 0) {
    return (
      <div className="text-center py-6">
        <CreditCard className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400 mb-2">No credit balance available</p>
        <p className="text-sm text-slate-500">Contact cashier to load credit to your account</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-blue-900 dark:text-blue-200">
            Available Credit
          </span>
          <span className="text-lg font-bold text-blue-900 dark:text-blue-200">
            ₹{availableCredit.toLocaleString()}
          </span>
        </div>
        <p className="text-xs text-blue-800 dark:text-blue-300">
          Credit loaded by cashier • Ready to transfer
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              type="number"
              placeholder="Enter amount to transfer"
              value={transferAmount}
              onChange={(e) => setTransferAmount(e.target.value)}
              max={availableCredit}
              min="1"
              step="1"
              disabled={transferMutation.isPending}
            />
          </div>
          <Button
            variant="outline"
            onClick={handleMaxTransfer}
            disabled={transferMutation.isPending}
            className="px-3"
          >
            Max
          </Button>
        </div>

        <Button
          onClick={handleTransfer}
          disabled={transferMutation.isPending || !transferAmount || parseFloat(transferAmount) <= 0}
          className="w-full bg-emerald-600 hover:bg-emerald-700"
        >
          {transferMutation.isPending ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
          ) : (
            <ArrowRight className="w-4 h-4 mr-2" />
          )}
          Add to Available Balance
        </Button>
      </div>

      <div className="text-xs text-slate-500 text-center">
        Transfer credit to your cash balance to start playing
      </div>
    </div>
  );
}