import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { 
  DollarSign, 
  Plus, 
  Minus, 
  TrendingUp, 
  TrendingDown, 
  History, 
  CreditCard,
  Clock
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Transaction } from "@shared/schema";

export default function BalanceManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showDepositDialog, setShowDepositDialog] = useState(false);
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
  const [showTransactionHistory, setShowTransactionHistory] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [transactionNote, setTransactionNote] = useState("");

  // Fetch transactions
  const { data: transactions, isLoading: transactionsLoading } = useQuery<Transaction[]>({
    queryKey: ['/api/transactions/player', user?.id],
    enabled: !!user?.id,
  });

  // Deposit mutation
  const depositMutation = useMutation({
    mutationFn: async (amount: string) => {
      const response = await apiRequest('POST', `/api/players/${user?.id}/balance`, {
        amount,
        type: 'deposit',
        description: transactionNote || 'Cash deposit',
        staffId: 'cashier'
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/players'] });
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
      setShowDepositDialog(false);
      setDepositAmount("");
      setTransactionNote("");
      toast({
        title: "Deposit Successful",
        description: `$${depositAmount} has been added to your account`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Deposit Failed",
        description: error.message || "Failed to process deposit",
        variant: "destructive",
      });
    },
  });

  // Withdrawal mutation
  const withdrawMutation = useMutation({
    mutationFn: async (amount: string) => {
      const response = await apiRequest('POST', `/api/players/${user?.id}/balance`, {
        amount,
        type: 'withdrawal',
        description: transactionNote || 'Cash withdrawal',
        staffId: 'cashier'
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/players'] });
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
      setShowWithdrawDialog(false);
      setWithdrawAmount("");
      setTransactionNote("");
      toast({
        title: "Withdrawal Successful",
        description: `$${withdrawAmount} has been withdrawn from your account`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Withdrawal Failed",
        description: error.message || "Failed to process withdrawal",
        variant: "destructive",
      });
    },
  });

  const handleDeposit = () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid deposit amount",
        variant: "destructive",
      });
      return;
    }
    depositMutation.mutate(depositAmount);
  };

  const handleWithdraw = () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid withdrawal amount",
        variant: "destructive",
      });
      return;
    }
    
    const currentBalance = parseFloat(user?.balance || "0");
    const withdrawalAmount = parseFloat(withdrawAmount);
    
    if (withdrawalAmount > currentBalance) {
      toast({
        title: "Insufficient Balance",
        description: "You don't have enough balance for this withdrawal",
        variant: "destructive",
      });
      return;
    }
    
    withdrawMutation.mutate(withdrawAmount);
  };

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(parseFloat(amount));
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'deposit':
        return <Plus className="w-4 h-4 text-green-500" />;
      case 'withdrawal':
        return <Minus className="w-4 h-4 text-red-500" />;
      case 'win':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'loss':
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      default:
        return <DollarSign className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Balance Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Account Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-500">
                {formatCurrency(user?.balance || "0")}
              </div>
              <div className="text-sm text-gray-500">Current Balance</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-blue-500">
                {formatCurrency(user?.totalDeposits || "0")}
              </div>
              <div className="text-sm text-gray-500">Total Deposits</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-red-500">
                {formatCurrency(user?.totalWithdrawals || "0")}
              </div>
              <div className="text-sm text-gray-500">Total Withdrawals</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-green-600">
                {formatCurrency((parseFloat(user?.totalWinnings || "0") - parseFloat(user?.totalLosses || "0")).toFixed(2))}
              </div>
              <div className="text-sm text-gray-500">Net Winnings</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Dialog open={showDepositDialog} onOpenChange={setShowDepositDialog}>
          <DialogTrigger asChild>
            <Button className="bg-green-600 hover:bg-green-700">
              <Plus className="w-4 h-4 mr-2" />
              Add Funds
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Funds to Account</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="deposit-amount">Amount ($)</Label>
                <Input
                  id="deposit-amount"
                  type="number"
                  placeholder="0.00"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <Label htmlFor="deposit-note">Note (optional)</Label>
                <Textarea
                  id="deposit-note"
                  placeholder="Transaction note..."
                  value={transactionNote}
                  onChange={(e) => setTransactionNote(e.target.value)}
                />
              </div>
              <Button 
                onClick={handleDeposit} 
                className="w-full"
                disabled={depositMutation.isPending}
              >
                {depositMutation.isPending ? "Processing..." : "Add Funds"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showWithdrawDialog} onOpenChange={setShowWithdrawDialog}>
          <DialogTrigger asChild>
            <Button variant="outline" className="border-red-500 text-red-500 hover:bg-red-50">
              <Minus className="w-4 h-4 mr-2" />
              Cash Out
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Withdraw Funds</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="text-sm text-gray-600">
                Available Balance: {formatCurrency(user?.balance || "0")}
              </div>
              <div>
                <Label htmlFor="withdraw-amount">Amount ($)</Label>
                <Input
                  id="withdraw-amount"
                  type="number"
                  placeholder="0.00"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  min="0"
                  step="0.01"
                  max={user?.balance || "0"}
                />
              </div>
              <div>
                <Label htmlFor="withdraw-note">Note (optional)</Label>
                <Textarea
                  id="withdraw-note"
                  placeholder="Transaction note..."
                  value={transactionNote}
                  onChange={(e) => setTransactionNote(e.target.value)}
                />
              </div>
              <Button 
                onClick={handleWithdraw} 
                className="w-full"
                disabled={withdrawMutation.isPending}
              >
                {withdrawMutation.isPending ? "Processing..." : "Cash Out"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showTransactionHistory} onOpenChange={setShowTransactionHistory}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <History className="w-4 h-4 mr-2" />
              Transaction History
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Transaction History</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {transactionsLoading ? (
                <div className="text-center py-4">Loading transactions...</div>
              ) : transactions && transactions.length > 0 ? (
                transactions.map((transaction) => (
                  <div key={transaction.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {getTransactionIcon(transaction.type)}
                      <div>
                        <div className="font-medium capitalize">{transaction.type}</div>
                        <div className="text-sm text-gray-500">
                          {new Date(transaction.createdAt!).toLocaleString()}
                        </div>
                        {transaction.description && (
                          <div className="text-sm text-gray-600">{transaction.description}</div>
                        )}
                      </div>
                    </div>
                    <div className={`font-semibold ${
                      transaction.type === 'deposit' || transaction.type === 'win' 
                        ? 'text-green-600' 
                        : 'text-red-600'
                    }`}>
                      {transaction.type === 'deposit' || transaction.type === 'win' ? '+' : '-'}
                      {formatCurrency(transaction.amount)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No transactions yet
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Player Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Player Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-500">
                {user?.gamesPlayed || 0}
              </div>
              <div className="text-sm text-gray-500">Games Played</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-500">
                {user?.hoursPlayed || "0.00"}h
              </div>
              <div className="text-sm text-gray-500">Hours Played</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(user?.totalWinnings || "0")}
              </div>
              <div className="text-sm text-gray-500">Total Winnings</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-500">
                {formatCurrency(user?.totalLosses || "0")}
              </div>
              <div className="text-sm text-gray-500">Total Losses</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}