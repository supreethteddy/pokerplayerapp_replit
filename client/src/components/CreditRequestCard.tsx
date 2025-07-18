import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard, Plus, Clock, CheckCircle, XCircle, AlertCircle, DollarSign } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface CreditRequest {
  id: string;
  playerId: number;
  requestedAmount: number;
  currentBalance: number;
  status: string;
  requestNote: string;
  adminNote?: string;
  approvedBy?: number;
  approvedAt?: string;
  rejectedReason?: string;
  createdAt: string;
  universalId: string;
}

export default function CreditRequestCard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [showCreditForm, setShowCreditForm] = useState(false);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditNote, setCreditNote] = useState("");

  // Check if user is credit approved (we'll get this from the user data)
  const isCreditApproved = user?.creditApproved || false; // This will be updated from backend

  // Fetch credit requests for player
  const { data: creditRequests, isLoading: creditRequestsLoading } = useQuery<CreditRequest[]>({
    queryKey: ['credit-requests', user?.id],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/credit-requests/${user?.id}`);
      return response.json();
    },
    enabled: !!user?.id && isCreditApproved,
    refetchInterval: 2000, // Refresh every 2 seconds
  });

  // Submit credit request mutation
  const submitCreditRequestMutation = useMutation({
    mutationFn: async ({ playerId, requestedAmount, requestNote }: { playerId: number; requestedAmount: number; requestNote: string }) => {
      const response = await apiRequest('POST', '/api/credit-requests', {
        playerId,
        requestedAmount,
        requestNote,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-requests', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/players/supabase'] });
      setCreditAmount("");
      setCreditNote("");
      setShowCreditForm(false);
      toast({
        title: "Credit Request Submitted",
        description: "Your credit request has been submitted to the Super Admin for approval",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Request Failed",
        description: error.message || "Could not submit credit request",
        variant: "destructive",
      });
    },
  });

  const handleCreditRequest = () => {
    if (!creditAmount || parseFloat(creditAmount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid credit amount",
        variant: "destructive",
      });
      return;
    }

    if (parseFloat(creditAmount) > 1000000) {
      toast({
        title: "Amount Too High",
        description: "Credit amount cannot exceed ₹10,00,000",
        variant: "destructive",
      });
      return;
    }

    submitCreditRequestMutation.mutate({
      playerId: user?.id!,
      requestedAmount: parseFloat(creditAmount),
      requestNote: creditNote || `Credit request for ₹${parseFloat(creditAmount).toLocaleString('en-IN')}`,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
            <CheckCircle className="w-3 h-3 mr-1" />
            Approved
          </Badge>
        );
      case 'rejected':
        return (
          <Badge className="bg-red-500/20 text-red-300 border-red-500/30">
            <XCircle className="w-3 h-3 mr-1" />
            Rejected
          </Badge>
        );
      case 'pending':
      default:
        return (
          <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Don't show credit card if user is not credit approved
  if (!isCreditApproved) {
    return null;
  }

  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center justify-between">
          <div className="flex items-center">
            <CreditCard className="w-5 h-5 mr-2 text-blue-500" />
            Credit System
          </div>
          <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">
            Credit Approved
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Credit Request Form */}
        {!showCreditForm ? (
          <div className="text-center">
            <Button
              onClick={() => setShowCreditForm(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Request Credit
            </Button>
            <p className="text-sm text-slate-400 mt-2">
              You are approved for credit. Request funds from the Super Admin.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label htmlFor="credit-amount" className="text-sm text-slate-300">
                Credit Amount (₹)
              </Label>
              <Input
                id="credit-amount"
                type="number"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                placeholder="Enter amount (e.g., 50000)"
                className="bg-slate-700 border-slate-600 text-white"
                min="1"
                max="1000000"
              />
            </div>
            
            <div>
              <Label htmlFor="credit-note" className="text-sm text-slate-300">
                Note (Optional)
              </Label>
              <Textarea
                id="credit-note"
                value={creditNote}
                onChange={(e) => setCreditNote(e.target.value)}
                placeholder="Add a note about why you need this credit..."
                className="bg-slate-700 border-slate-600 text-white"
                rows={3}
              />
            </div>

            <div className="flex space-x-2">
              <Button
                onClick={handleCreditRequest}
                disabled={submitCreditRequestMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white flex-1"
              >
                {submitCreditRequestMutation.isPending ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                ) : (
                  <DollarSign className="w-4 h-4 mr-2" />
                )}
                Submit Credit Request
              </Button>
              <Button
                onClick={() => {
                  setShowCreditForm(false);
                  setCreditAmount("");
                  setCreditNote("");
                }}
                variant="outline"
                className="border-slate-600 text-slate-400 hover:bg-slate-700"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Credit Request History */}
        {creditRequestsLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 bg-slate-700" />
            <Skeleton className="h-16 bg-slate-700" />
          </div>
        ) : creditRequests && creditRequests.length > 0 ? (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-slate-300 border-b border-slate-600 pb-2">
              Recent Credit Requests
            </h4>
            {creditRequests.slice(0, 3).map((request) => (
              <div key={request.id} className="bg-slate-700 rounded-lg p-3">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-sm font-medium text-white">
                      ₹{parseFloat(request.requestedAmount.toString()).toLocaleString('en-IN')}
                    </p>
                    <p className="text-xs text-slate-400">
                      {formatDateTime(request.createdAt)}
                    </p>
                  </div>
                  {getStatusBadge(request.status)}
                </div>
                
                {request.requestNote && (
                  <p className="text-xs text-slate-400 mb-2">
                    {request.requestNote}
                  </p>
                )}
                
                {request.adminNote && (
                  <div className="bg-slate-600 rounded p-2 mt-2">
                    <p className="text-xs text-slate-300">
                      <strong>Admin Note:</strong> {request.adminNote}
                    </p>
                  </div>
                )}
                
                {request.rejectedReason && (
                  <div className="bg-red-500/10 rounded p-2 mt-2">
                    <p className="text-xs text-red-300">
                      <strong>Rejection Reason:</strong> {request.rejectedReason}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4">
            <AlertCircle className="w-8 h-8 text-slate-500 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No credit requests yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}