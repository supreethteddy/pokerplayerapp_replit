import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { usePlayerBalance } from "@/hooks/usePlayerBalance";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Clock, CheckCircle, XCircle, DollarSign } from "lucide-react";
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

  // Get balance to check credit status
  const { balance } = usePlayerBalance(user?.id?.toString() || "");
  const creditEnabled = (balance as any)?.creditEnabled || false;
  const totalCredit = parseFloat(
    String((balance as any)?.totalCredit ?? (balance as any)?.creditLimit ?? '0'),
  );
  const creditRemaining = parseFloat(
    String((balance as any)?.creditRemaining ?? (balance as any)?.availableCredit ?? '0'),
  );

  const isRequestPending = (status: string) =>
    String(status || '').toLowerCase() === 'pending';

  // Socket.IO: instant updates when credit request is approved/rejected
  useEffect(() => {
    if (!user?.id) return;
    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3333/api';
    const wsBase = API_BASE_URL.endsWith('/api') ? API_BASE_URL.slice(0, -4) : API_BASE_URL.replace(/\/$/, '');
    const token = localStorage.getItem('auth_token') || localStorage.getItem('playerToken');
    const clubId =
      localStorage.getItem('clubId') ||
      sessionStorage.getItem('clubId') ||
      localStorage.getItem('club_id') ||
      sessionStorage.getItem('club_id');
    const socket = io(`${wsBase}/realtime`, {
      auth: { playerId: String(user.id), clubId: clubId || undefined, token },
      transports: ['websocket', 'polling'],
      reconnection: true,
    });
    socket.on('connect', () => {
      if (clubId) {
        socket.emit('subscribe:player', { playerId: String(user.id), clubId });
        socket.emit('subscribe:club', { clubId, playerId: String(user.id) });
      }
    });
    const bump = () => {
      queryClient.invalidateQueries({ queryKey: ['credit-requests', user.id] });
      queryClient.invalidateQueries({ queryKey: [`/api/auth/player/balance`] });
    };
    socket.on('credit:status-changed', (data: any) => {
      if (data?.playerId && String(data.playerId) !== String(user.id)) return;
      bump();
    });
    socket.on('credit:request-updated', (data: any) => {
      if (data?.playerId && String(data.playerId) !== String(user.id)) return;
      bump();
    });
    socket.on('credit:facility-changed', (data: any) => {
      if (data?.playerId && String(data.playerId) !== String(user.id)) return;
      bump();
    });
    return () => { socket.disconnect(); };
  }, [user?.id, queryClient]);

  // Fetch credit requests for player (initial load, real-time handles updates)
  const { data: creditRequests, isLoading: creditRequestsLoading } = useQuery<CreditRequest[]>({
    queryKey: ['credit-requests', user?.id],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/auth/player/credit-requests');
      return response.json();
    },
    enabled: !!user?.id && creditEnabled,
    staleTime: 3000,
  });

  const hasPendingCreditRequest = useMemo(
    () => !!(creditRequests || []).some((r) => isRequestPending(r.status)),
    [creditRequests],
  );

  const sortedCreditRequests = useMemo(() => {
    if (!creditRequests?.length) return [];
    return [...creditRequests].sort((a, b) => {
      const ap = isRequestPending(a.status) ? 0 : 1;
      const bp = isRequestPending(b.status) ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [creditRequests]);

  // Submit credit request mutation
  const submitCreditRequestMutation = useMutation({
    mutationFn: async ({ requestedAmount, requestNote }: { requestedAmount: number; requestNote: string }) => {
      const response = await apiRequest('POST', '/api/auth/player/credit-request', {
        amount: requestedAmount,
        notes: requestNote,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-requests', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/player/balance'] });
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
      // Parse error message from backend
      let errorMessage = "Could not submit credit request";
      
      if (error?.message) {
        const msg = error.message;
        
        // Extract the actual error message (after status code)
        if (
          msg.includes("A pending credit request already exists") ||
          msg.includes("already have a pending credit request")
        ) {
          errorMessage =
            "You already have a pending credit request. Wait until staff approves or rejects it before sending another.";
        } else if (msg.includes("Credit facility is not enabled")) {
          errorMessage = "Credit facility is not enabled for your account. Please contact club management.";
        } else if (msg.includes("KYC verification")) {
          errorMessage = "Please complete KYC verification before requesting credit.";
        } else if (msg.includes("Amount exceeds")) {
          errorMessage = "Requested amount exceeds your available credit limit.";
        } else if (msg.includes(":")) {
          // Extract message after status code (e.g., "400: message" -> "message")
          const parts = msg.split(":");
          errorMessage = parts.slice(1).join(":").trim();
        } else {
          errorMessage = msg;
        }
      }
      
      toast({
        title: "Credit Request Failed",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleCreditRequest = () => {
    if (hasPendingCreditRequest) {
      toast({
        title: "Pending request",
        description: "Wait until your current credit request is approved or rejected before sending another.",
        variant: "destructive",
      });
      return;
    }
    if (!creditAmount || parseFloat(creditAmount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid credit amount",
        variant: "destructive",
      });
      return;
    }

    const requestedAmount = parseFloat(creditAmount);
    
    if (requestedAmount > creditRemaining) {
      toast({
        title: "Amount exceeds credit remaining",
        description: `You can only request up to ₹${creditRemaining.toLocaleString()} (credit remaining on your line).`,
        variant: "destructive",
      });
      return;
    }

    if (requestedAmount > 1000000) {
      toast({
        title: "Amount Too High",
        description: "Credit amount cannot exceed ₹10,00,000",
        variant: "destructive",
      });
      return;
    }

    submitCreditRequestMutation.mutate({
      requestedAmount: requestedAmount,
      requestNote: creditNote || `Credit request for ₹${requestedAmount.toLocaleString('en-IN')}`,
    });
  };

  const getStatusBadge = (status: string) => {
    const s = (status || '').toLowerCase();
    switch (s) {
      case 'approved':
        return (
          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
            <CheckCircle className="w-3 h-3 mr-1" />
            Approved
          </Badge>
        );
      case 'rejected':
      case 'denied':
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
      timeZone: 'Asia/Kolkata',
    });
  };

  // Don't show credit card if user is not credit enabled
  if (!creditEnabled || totalCredit <= 0) {
    return null;
  }

  const requestBlocked = hasPendingCreditRequest || creditRemaining <= 0;

  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardContent className="pt-6 space-y-4">
        {hasPendingCreditRequest && (
          <div className="flex items-center justify-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            <Clock className="w-4 h-4 shrink-0" />
            Awaiting approval on your last credit request
          </div>
        )}

        {/* Credit Request Form — balances live in Wallet & credit line above */}
        {!showCreditForm ? (
          <div className="text-center">
            <Button
              onClick={() => setShowCreditForm(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={requestBlocked}
            >
              <Plus className="w-4 h-4 mr-2" />
              Request Credit
            </Button>
            <p className="mt-3 text-center text-base font-semibold text-slate-200">
              {hasPendingCreditRequest
                ? "You already have a pending request. Wait until staff approves or rejects it before sending another."
                : creditRemaining > 0
                  ? `You can request up to ₹${creditRemaining.toLocaleString()} (credit remaining).`
                  : "You have no credit remaining on your line."}
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
                placeholder={`Enter amount (max: ₹${creditRemaining.toLocaleString()})`}
                className="bg-slate-700 border-slate-600 text-white"
                min="1"
                max={creditRemaining}
              />
              <p className="text-xs text-slate-400 mt-1">
                Credit remaining: ₹{creditRemaining.toLocaleString()}
              </p>
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
                disabled={submitCreditRequestMutation.isPending || hasPendingCreditRequest}
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

        {/* Past credit requests only when there is history (no empty-state card). */}
        {!creditRequestsLoading && creditRequests && creditRequests.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-slate-300 border-b border-slate-600 pb-2">
              Past credit requests
            </h4>
            {sortedCreditRequests.slice(0, 5).map((request) => (
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
        )}
      </CardContent>
    </Card>
  );
}