import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, Wallet, Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface DualBalanceDisplayProps {
  className?: string;
}

export default function DualBalanceDisplay({ className = "" }: DualBalanceDisplayProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Credit request mutation
  const creditRequestMutation = useMutation({
    mutationFn: async (amount: number) => {
      return apiRequest("POST", "/api/credit-requests", {
        playerId: user?.id,
        requestedAmount: amount,
        reason: "Credit request from player portal"
      });
    },
    onSuccess: () => {
      toast({
        title: "Credit Request Sent",
        description: "Your credit request has been sent to the cashier for approval.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/credit-requests"] });
    },
    onError: (error: any) => {
      toast({
        title: "Credit Request Failed",
        description: error.message || "Failed to send credit request",
        variant: "destructive",
      });
    },
  });

  if (!user) return null;

  const realBalance = parseFloat(user.realBalance || user.balance || '0.00');
  const creditBalance = parseFloat(user.creditBalance || '0.00');
  const creditLimit = parseFloat(user.creditLimit || '0.00');
  const totalBalance = realBalance + creditBalance;

  const handleCreditRequest = () => {
    if (creditLimit <= 0) {
      toast({
        title: "Credit Not Available",
        description: "You don't have credit approval. Contact staff for credit setup.",
        variant: "destructive",
      });
      return;
    }

    if (creditBalance >= creditLimit) {
      toast({
        title: "Credit Limit Reached",
        description: `You've reached your credit limit of ₹${creditLimit.toFixed(2)}.`,
        variant: "destructive",
      });
      return;
    }

    const remainingCredit = creditLimit - creditBalance;
    creditRequestMutation.mutate(remainingCredit);
  };

  return (
    <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 ${className}`}>
      {/* Real Cash Balance */}
      <Card className="bg-gradient-to-br from-emerald-800 to-emerald-900 border-emerald-600">
        <CardHeader className="pb-3">
          <CardTitle className="text-emerald-100 text-sm font-medium flex items-center">
            <Wallet className="w-4 h-4 mr-2" />
            Real Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-white">
            ₹{realBalance.toFixed(2)}
          </div>
          <p className="text-emerald-200 text-xs mt-1">
            Cash deposits & buy-ins
          </p>
        </CardContent>
      </Card>

      {/* Credit Balance */}
      <Card className="bg-gradient-to-br from-amber-800 to-amber-900 border-amber-600">
        <CardHeader className="pb-3">
          <CardTitle className="text-amber-100 text-sm font-medium flex items-center">
            <CreditCard className="w-4 h-4 mr-2" />
            Credit Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-white">
            ₹{creditBalance.toFixed(2)}
          </div>
          <p className="text-amber-200 text-xs mt-1">
            Limit: ₹{creditLimit.toFixed(2)}
          </p>
          {user.creditApproved && creditBalance < creditLimit && (
            <Button
              size="sm"
              variant="outline"
              className="mt-2 text-amber-200 border-amber-400 hover:bg-amber-700"
              onClick={handleCreditRequest}
              disabled={creditRequestMutation.isPending}
            >
              <Plus className="w-3 h-3 mr-1" />
              Request Credit
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Total Available Balance */}
      <Card className="bg-gradient-to-br from-blue-800 to-blue-900 border-blue-600">
        <CardHeader className="pb-3">
          <CardTitle className="text-blue-100 text-sm font-medium flex items-center">
            <Plus className="w-4 h-4 mr-2" />
            Total Available
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-white">
            ₹{totalBalance.toFixed(2)}
          </div>
          <p className="text-blue-200 text-xs mt-1">
            Real + Credit combined
          </p>
        </CardContent>
      </Card>
    </div>
  );
}