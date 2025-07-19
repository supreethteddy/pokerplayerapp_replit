import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
// Switch removed - preferences section eliminated
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
// Dialog removed for document viewer
import { 
  Spade, 
  Table, 
  Clock, 
  // Settings icon removed - preferences section eliminated 
  BarChart3, 
  User, 
  LogOut,
  Users,
  CreditCard,
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  AlertTriangle,
  Phone,
  Gift,
  Play,
  Image,
  Star,
  Calendar,
  MessageCircle,
  MessageSquare,
  Send,
  Bell,
  Trophy
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import type { Table as TableType, SeatRequest, KycDocument } from "@shared/schema";
import BalanceDisplay from "./BalanceDisplay";
import OfferBanner from "./OfferBanner";
import OfferCarousel from "./OfferCarousel";


// Scrollable Offers Display Component
const ScrollableOffersDisplay = () => {
  const { data: offers, isLoading } = useQuery({
    queryKey: ['/api/staff-offers'],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const trackOfferView = useMutation({
    mutationFn: (offerId: string) => 
      apiRequest("POST", "/api/offer-views", { offer_id: offerId }),
  });

  // Always show demo offers for testing
  const demoOffers = [
    {
      id: 'demo-welcome',
      title: 'Welcome Bonus',
      description: 'Get 100% bonus on your first deposit up to ₹5,000. Join today and double your gaming power with our exclusive welcome package for new players. Start your poker journey with enhanced bankroll.',
      image_url: '/api/placeholder-welcome-bonus.jpg',
      offer_type: 'banner',
      is_active: true
    },
    {
      id: 'demo-weekend',
      title: 'Weekend Special',
      description: 'Double loyalty points on all weekend games. Play Friday to Sunday and earn twice the rewards for all your poker sessions with enhanced multipliers and special tournament access.',
      image_url: '/api/placeholder-weekend-special.jpg',  
      offer_type: 'carousel',
      is_active: true
    },
    {
      id: 'demo-tournament',
      title: 'Free Tournament Entry',
      description: 'Complimentary entry to our Sunday ₹10,000 guaranteed tournament. No entry fee required for qualified players. Register now to secure your spot in this weekly championship event.',
      image_url: '/api/placeholder-tournament.jpg',
      offer_type: 'popup', 
      is_active: true
    }
  ];

  // Use staff offers if available, otherwise demo offers
  const displayOffers = (offers && offers.length > 0) ? offers : demoOffers;

  return (
    <div className="space-y-4">
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <Gift className="w-5 h-5 mr-2 text-emerald-500" />
            Special Offers ({displayOffers.length})
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Scrollable offers container */}
      <div className="max-h-[600px] overflow-y-auto space-y-4 pr-2 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800">
        {displayOffers.map((offer: any) => (
          <Card 
            key={offer.id} 
            className="bg-slate-800 border-slate-700 hover:border-emerald-500/50 transition-colors"
            onClick={() => trackOfferView.mutate(offer.id)}
          >
            <CardContent className="p-0">
              {/* Dynamic Image/Video Display */}
              <div className="relative">
                {offer.video_url ? (
                  <div className="aspect-video rounded-t-lg overflow-hidden bg-slate-900">
                    <video 
                      className="w-full h-full object-cover" 
                      poster={offer.image_url}
                      controls
                      preload="metadata"
                    >
                      <source src={offer.video_url} type="video/mp4" />
                      <div className="flex items-center justify-center h-full">
                        <Play className="w-12 h-12 text-white" />
                      </div>
                    </video>
                  </div>
                ) : offer.image_url ? (
                  <div className="aspect-video rounded-t-lg overflow-hidden bg-slate-900">
                    <img 
                      src={offer.image_url} 
                      alt={offer.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                    <div className="hidden flex items-center justify-center h-full">
                      <Image className="w-12 h-12 text-slate-400" />
                    </div>
                  </div>
                ) : (
                  <div className="aspect-video rounded-t-lg bg-gradient-to-br from-emerald-600 to-emerald-800 flex items-center justify-center">
                    <Gift className="w-16 h-16 text-white" />
                  </div>
                )}
                
                {/* Offer type badge */}
                <Badge 
                  className={`absolute top-3 right-3 ${
                    offer.offer_type === 'banner' ? 'bg-blue-600' :
                    offer.offer_type === 'carousel' ? 'bg-purple-600' :
                    'bg-orange-600'
                  }`}
                >
                  {offer.offer_type}
                </Badge>
              </div>

              {/* Dynamic Content Area */}
              <div className="p-6">
                <h3 className="text-xl font-bold text-white mb-3">
                  {offer.title}
                </h3>
                
                {/* Dynamic description with responsive sizing */}
                <div className="text-slate-300 leading-relaxed mb-4">
                  <p className={`${
                    offer.description.length > 200 ? 'text-sm' : 
                    offer.description.length > 100 ? 'text-base' : 'text-lg'
                  }`}>
                    {offer.description}
                  </p>
                </div>

                {/* Date range if available */}
                {(offer.start_date || offer.end_date) && (
                  <div className="flex items-center text-sm text-slate-400 mb-4">
                    <Calendar className="w-4 h-4 mr-2" />
                    {offer.start_date && new Date(offer.start_date).toLocaleDateString()} 
                    {offer.start_date && offer.end_date && ' - '}
                    {offer.end_date && new Date(offer.end_date).toLocaleDateString()}
                  </div>
                )}

                {/* Action button */}
                <Button 
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    trackOfferView.mutate(offer.id);
                  }}
                >
                  <Star className="w-4 h-4 mr-2" />
                  View Offer Details
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

// VIP Points Display Component
const VipPointsDisplay = ({ userId }: { userId: number }) => {
  const { data: vipData, isLoading } = useQuery({
    queryKey: ['/api/vip-points/calculate', userId],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { toast } = useToast();

  const redeemPoints = useMutation({
    mutationFn: (redemption: { redemptionType: string; pointsRequired: number }) =>
      apiRequest("POST", "/api/vip-points/redeem", {
        playerId: userId,
        ...redemption
      }),
    onSuccess: () => {
      toast({
        title: "Redemption Request Sent",
        description: "Your VIP points redemption request has been sent for approval.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Redemption Failed",
        description: error.message || "Failed to process redemption request.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <Star className="w-5 h-5 mr-2 text-yellow-500" />
            VIP Points
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  const vipPoints = vipData?.calculation?.totalVipPoints || 0;
  const breakdown = vipData?.calculation;

  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center">
          <Star className="w-5 h-5 mr-2 text-yellow-500" />
          VIP Points System
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Total Points */}
        <div className="text-center p-4 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-lg">
          <div className="text-3xl font-bold text-yellow-400">
            {vipPoints.toFixed(1)}
          </div>
          <div className="text-slate-300 text-sm">Total VIP Points</div>
        </div>

        {/* Points Breakdown */}
        {breakdown && (
          <div className="space-y-2">
            <div className="text-white font-semibold text-sm">Points Breakdown:</div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-slate-300">
                <span>Big Blind (₹{breakdown.avgBigBlind} × 0.5)</span>
                <span className="text-yellow-400">{breakdown.bigBlindPoints.toFixed(1)}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Rs Played (₹{breakdown.totalRsPlayed} × 0.3)</span>
                <span className="text-yellow-400">{breakdown.rsPlayedPoints.toFixed(1)}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Visit Frequency ({breakdown.visitFrequency} days × 0.2)</span>
                <span className="text-yellow-400">{breakdown.frequencyPoints.toFixed(1)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Redemption Options */}
        <div className="space-y-2">
          <div className="text-white font-semibold text-sm">Redeem Points:</div>
          <div className="grid grid-cols-1 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
              disabled={vipPoints < 500 || redeemPoints.isPending}
              onClick={() => redeemPoints.mutate({ redemptionType: "Tournament Ticket", pointsRequired: 500 })}
            >
              Tournament Ticket (500 pts)
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
              disabled={vipPoints < 300 || redeemPoints.isPending}
              onClick={() => redeemPoints.mutate({ redemptionType: "Buy-in Discount", pointsRequired: 300 })}
            >
              Buy-in Discount (300 pts)
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
              disabled={vipPoints < 1000 || redeemPoints.isPending}
              onClick={() => redeemPoints.mutate({ redemptionType: "Premium Product", pointsRequired: 1000 })}
            >
              Premium Product (1000 pts)
            </Button>
          </div>
        </div>

        {/* Formula Display */}
        <div className="text-xs text-slate-400 p-2 bg-slate-900 rounded">
          <strong>Formula:</strong> VIP Points = (Big Blind × 0.5) + (Rs Played × 0.3) + (Visit Frequency × 0.2)
        </div>
      </CardContent>
    </Card>
  );
};

export default function PlayerDashboard() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [callTime, setCallTime] = useState("02:45");
  const [location, setLocation] = useLocation();

  
  // Feedback system state
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [sendingFeedback, setSendingFeedback] = useState(false);
  
  // GRE Chat state variables
  const [chatMessage, setChatMessage] = useState("");
  const [sendingChatMessage, setSendingChatMessage] = useState(false);
  
  // Tournament state variables
  const [tournamentActionLoading, setTournamentActionLoading] = useState(false);
  
  // Handle tab navigation from URL parameters
  const getActiveTabFromUrl = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    return tab || 'game';
  };
  
  const [activeTab, setActiveTab] = useState(getActiveTabFromUrl());
  
  // Update tab when URL changes
  useEffect(() => {
    setActiveTab(getActiveTabFromUrl());
  }, [location]);
  
  // Document viewer removed as per requirements

  // Fetch live tables with optimized settings
  const { data: tables, isLoading: tablesLoading } = useQuery<TableType[]>({
    queryKey: ['/api/tables'],
    refetchInterval: 1000, // Even faster 1 second refresh
    refetchOnWindowFocus: true, // Refresh when window gains focus
    refetchOnMount: true, // Always refetch on mount
    refetchOnReconnect: true, // Refresh on reconnect
    staleTime: 0, // Always consider data stale for fresh updates
    gcTime: 0, // Don't cache old data (renamed from cacheTime)
    retry: 3,
    retryDelay: 500,
  });

  // Fetch seat requests with reduced frequency
  const { data: seatRequests, isLoading: requestsLoading } = useQuery<SeatRequest[]>({
    queryKey: ['/api/seat-requests', user?.id],
    enabled: !!user?.id,
    refetchInterval: 1500, // Refresh every 1.5 seconds for ultra-fast sync
    refetchOnWindowFocus: true,
    staleTime: 0, // Always get fresh data
  });

  // Fetch tournaments from staff portal
  const { data: tournaments, isLoading: tournamentsLoading } = useQuery({
    queryKey: ['/api/tournaments'],
    refetchInterval: 5000, // Refresh every 5 seconds
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  // Tournament Interest Handler - sends to GRE
  const handleTournamentInterest = async (tournamentId: string) => {
    if (!user?.id) return;
    
    setTournamentActionLoading(true);
    try {
      const response = await apiRequest("POST", "/api/gre-chat/send", {
        playerId: user.id,
        playerName: `${user.firstName} ${user.lastName}`,
        message: `Player is interested in Tournament ID: ${tournamentId}`,
        timestamp: new Date().toISOString()
      });

      if (response.ok) {
        toast({
          title: "Interest Registered",
          description: "Your interest has been sent to our Guest Relations team",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to register interest. Please try again.",
        variant: "destructive"
      });
    } finally {
      setTournamentActionLoading(false);
    }
  };

  // Tournament Registration Handler - adds to player management system
  const handleTournamentRegister = async (tournamentId: string) => {
    if (!user?.id) return;
    
    setTournamentActionLoading(true);
    try {
      const response = await apiRequest("POST", "/api/tournaments/register", {
        playerId: user.id,
        tournamentId,
        playerName: `${user.firstName} ${user.lastName}`,
        email: user.email
      });

      if (response.ok) {
        toast({
          title: "Registration Successful",
          description: "You have been registered for the tournament",
        });
        // Refresh tournaments to update registered player count
        queryClient.invalidateQueries({ queryKey: ['/api/tournaments'] });
      }
    } catch (error: any) {
      toast({
        title: "Registration Failed",
        description: error.message || "Failed to register for tournament",
        variant: "destructive"
      });
    } finally {
      setTournamentActionLoading(false);
    }
  };

  // Preferences removed as per requirements

  // Fetch KYC documents using new system
  const { data: kycDocuments, isLoading: kycLoading } = useQuery<KycDocument[]>({
    queryKey: [`/api/documents/player/${user?.id}`],
    enabled: !!user?.id,
  });

  // Join wait-list mutation
  const joinWaitListMutation = useMutation({
    mutationFn: async (tableId: number) => {
      const response = await apiRequest('POST', '/api/seat-requests', {
        playerId: user?.id,
        tableId,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/seat-requests'] });
      toast({
        title: "Joined Wait-List",
        description: "You've been added to the table wait-list",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Join",
        description: error.message || "Could not join wait-list",
        variant: "destructive",
      });
    },
  });

  // Leave wait-list mutation
  const leaveWaitListMutation = useMutation({
    mutationFn: async (tableId: number) => {
      const response = await apiRequest('DELETE', `/api/seat-requests/${user?.id}/${tableId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/seat-requests'] });
      toast({
        title: "Left Wait-List",
        description: "You've been removed from the table wait-list",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Leave",
        description: error.message || "Could not leave wait-list",
        variant: "destructive",
      });
    },
  });

  // Preferences update removed as per requirements

  // KYC document upload mutation using new system
  const uploadKycDocumentMutation = useMutation({
    mutationFn: async ({ documentType, file }: { documentType: string; file: File }) => {
      const reader = new FileReader();
      return new Promise((resolve, reject) => {
        reader.onload = async (event) => {
          const dataUrl = event.target?.result as string;
          try {
            const response = await apiRequest('POST', '/api/documents/upload', {
              playerId: user?.id,
              documentType,
              fileName: file.name,
              fileUrl: dataUrl,
            });
            resolve(response.json());
          } catch (error) {
            reject(error);
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/documents/player/${user?.id}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/players/supabase'] });
      toast({
        title: "Document Uploaded",
        description: "Your KYC document has been uploaded successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload KYC document",
        variant: "destructive",
      });
    },
  });

  // Helper functions
  const isTableJoined = (tableId: number) => {
    return seatRequests?.some(req => req.tableId === tableId);
  };

  const getWaitListPosition = (tableId: number) => {
    const request = seatRequests?.find(req => req.tableId === tableId);
    return request?.position || 0;
  };

  const handleJoinWaitList = (tableId: number) => {
    joinWaitListMutation.mutate(tableId);
  };

  const handleLeaveWaitList = (tableId: number) => {
    leaveWaitListMutation.mutate(tableId);
  };

  // Credit request state and mutations
  const [creditAmount, setCreditAmount] = useState("");
  const [creditNote, setCreditNote] = useState("");
  const [showCreditForm, setShowCreditForm] = useState(false);

  // Fetch credit requests for player
  const { data: creditRequests, isLoading: creditRequestsLoading } = useQuery({
    queryKey: [`/api/credit-requests/${user?.id}`],
    enabled: !!user?.id,
    refetchInterval: 2000, // Refresh every 2 seconds
  });

  // Fetch push notifications for the current player
  const { data: notifications, isLoading: notificationsLoading } = useQuery({
    queryKey: [`/api/push-notifications/${user?.id}`],
    enabled: !!user?.id,
    refetchInterval: 2000, // Real-time notifications
    refetchOnWindowFocus: true,
    staleTime: 0
  });

  // Submit feedback function
  const submitFeedback = async () => {
    if (!feedbackMessage.trim() || !user?.id) {
      toast({
        title: "Error",
        description: "Please enter a message",
        variant: "destructive"
      });
      return;
    }

    setSendingFeedback(true);
    try {
      const response = await apiRequest("POST", "/api/feedback", {
        playerId: user.id,
        message: feedbackMessage.trim()
      });

      const result = await response.json();
      if (response.ok) {
        toast({
          title: "Feedback Sent",
          description: "Your message has been sent to management",
        });
        setFeedbackMessage("");
      } else {
        throw new Error(result.error || "Failed to send feedback");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send feedback. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSendingFeedback(false);
    }
  };

  // GRE Chat functionality
  const sendChatMessage = async () => {
    if (!chatMessage.trim() || !user?.id) {
      toast({
        title: "Error",
        description: "Please enter a message",
        variant: "destructive"
      });
      return;
    }

    setSendingChatMessage(true);
    try {
      const response = await apiRequest("POST", "/api/gre-chat/send", {
        playerId: user.id,
        playerName: `${user.firstName} ${user.lastName}`,
        message: chatMessage.trim(),
        timestamp: new Date().toISOString()
      });

      const result = await response.json();
      if (response.ok) {
        toast({
          title: "Message Sent",
          description: "Your message has been sent to our team",
        });
        setChatMessage("");
        // Trigger chat messages refresh
        queryClient.invalidateQueries({ queryKey: [`/api/gre-chat/messages/${user.id}`] });
      } else {
        throw new Error(result.error || "Failed to send message");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send message. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSendingChatMessage(false);
    }
  };

  // Fetch GRE chat messages
  const { data: chatMessages, isLoading: chatLoading } = useQuery({
    queryKey: [`/api/gre-chat/messages/${user?.id}`],
    enabled: !!user?.id,
    refetchInterval: 2000, // Real-time chat updates
    refetchOnWindowFocus: true,
    staleTime: 0
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
      queryClient.invalidateQueries({ queryKey: [`/api/credit-requests/${user?.id}`] });
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

    submitCreditRequestMutation.mutate({
      playerId: user?.id!,
      requestedAmount: parseFloat(creditAmount),
      requestNote: creditNote || `Credit request for ₹${creditAmount}`,
    });
  };

  // VIP Club redemption mutation
  const vipRedeemMutation = useMutation({
    mutationFn: async ({ playerId, rewardType, pointsCost }: { playerId: number; rewardType: string; pointsCost: number }) => {
      const response = await apiRequest("POST", "/api/vip-club/redeem", { playerId, rewardType, pointsCost });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Redemption Successful!",
        description: `${data.message}. You have ${data.remainingPoints} points remaining.`,
      });
      // Refresh user data to update points display
      queryClient.invalidateQueries({ queryKey: ["/api/players/supabase", user?.email] });
    },
    onError: (error: any) => {
      toast({
        title: "Redemption Failed",
        description: error.message || "Failed to redeem points",
        variant: "destructive",
      });
    },
  });

  const handleVipRedeem = (rewardType: string, pointsCost: number) => {
    if (!user?.id) return;
    
    vipRedeemMutation.mutate({
      playerId: user.id,
      rewardType,
      pointsCost
    });
  };

  // PAN Card management
  const [panCardNumber, setPanCardNumber] = useState("");
  const [showTransactions, setShowTransactions] = useState(false);

  // PAN Card update mutation
  const updatePanCardMutation = useMutation({
    mutationFn: async ({ playerId, panCardNumber }: { playerId: number; panCardNumber: string }) => {
      const response = await apiRequest("POST", `/api/players/${playerId}/pan-card`, { panCardNumber });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "PAN Card Updated",
        description: "Your PAN card number has been updated successfully",
      });
      // Clear the input
      setPanCardNumber("");
      // Refresh user data
      queryClient.invalidateQueries({ queryKey: ["/api/players/supabase", user?.email] });
    },
    onError: (error: any) => {
      toast({
        title: "PAN Card Update Failed",
        description: error.message || "Failed to update PAN card number",
        variant: "destructive",
      });
    },
  });

  // Transaction history query
  const { data: transactions, isLoading: transactionsLoading } = useQuery({
    queryKey: ["/api/players", user?.id, "transactions"],
    queryFn: async () => {
      if (!user?.id) return [];
      const response = await fetch(`/api/players/${user.id}/transactions?limit=10`);
      if (!response.ok) {
        throw new Error('Failed to fetch transactions');
      }
      return response.json();
    },
    enabled: !!user?.id && showTransactions,
  });

  const handlePanCardUpdate = () => {
    if (!user?.id || !panCardNumber) {
      toast({
        title: "Invalid Input",
        description: "Please enter a valid PAN card number",
        variant: "destructive",
      });
      return;
    }

    if (panCardNumber.length !== 10) {
      toast({
        title: "Invalid PAN Card",
        description: "PAN card number must be exactly 10 characters",
        variant: "destructive",
      });
      return;
    }

    // Validate PAN card format
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
    if (!panRegex.test(panCardNumber)) {
      toast({
        title: "Invalid PAN Card Format",
        description: "PAN card format should be AAAAA9999A (5 letters, 4 numbers, 1 letter)",
        variant: "destructive",
      });
      return;
    }

    updatePanCardMutation.mutate({
      playerId: user.id,
      panCardNumber
    });
  };

  // Update call time periodically
  useEffect(() => {
    if (user) {
      const interval = setInterval(() => {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        setCallTime(`${hours}:${minutes}`);
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [user, callTime]);

  // Preference change handler removed as per requirements

  // File type validation
  const validateFileType = (file: File): boolean => {
    const allowedTypes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'application/pdf'
    ];
    
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.pdf'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    return allowedTypes.includes(file.type) && allowedExtensions.includes(fileExtension);
  };

  const validateFileSize = (file: File): boolean => {
    const maxSize = 5 * 1024 * 1024; // 5MB
    return file.size <= maxSize;
  };

  const handleKycDocumentUpload = (documentType: string, file: File) => {
    console.log('Starting file upload:', { documentType, fileName: file.name, fileSize: file.size, fileType: file.type });
    
    // Validate file type
    if (!validateFileType(file)) {
      console.log('File type validation failed:', { type: file.type, name: file.name });
      toast({
        title: "Invalid File Type",
        description: "Please upload JPG, PNG, or PDF files only",
        variant: "destructive",
      });
      return;
    }

    // Validate file size
    if (!validateFileSize(file)) {
      console.log('File size validation failed:', { size: file.size, maxSize: 5 * 1024 * 1024 });
      toast({
        title: "File Too Large",
        description: "File size must be less than 5MB",
        variant: "destructive",
      });
      return;
    }

    console.log('File validation passed, starting upload');
    uploadKycDocumentMutation.mutate({ documentType, file });
  };

  // Document viewing removed as per requirements

  const getKycDocumentStatus = (documentType: string) => {
    // Map display types to actual database types
    const typeMap: { [key: string]: string } = {
      'id': 'government_id',
      'utility': 'utility_bill',
      'photo': 'profile_photo'
    };
    
    const actualType = typeMap[documentType] || documentType;
    
    // Find the latest document for this type (by createdAt date), using both Supabase and local URLs
    const docs = kycDocuments?.filter(d => d.documentType === actualType && d.fileUrl);
    if (!docs || docs.length === 0) return 'missing';
    
    const latestDoc = docs.reduce((latest, current) => {
      return new Date(current.createdAt!) > new Date(latest.createdAt!) ? current : latest;
    });
    
    return latestDoc.status;
  };

  const getKycStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-amber-500" />;
      case 'rejected':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <FileText className="w-4 h-4 text-slate-400" />;
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Card className="max-w-md w-full bg-slate-900 border-slate-800">
          <CardContent className="p-6">
            <div className="text-center space-y-4">
              <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mx-auto">
                <User className="w-6 h-6 text-slate-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Not Authenticated</h2>
                <p className="text-slate-400">Please log in to access your dashboard</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 w-full overflow-x-hidden">
      <div className="max-w-full px-3 py-2 sm:px-4 sm:py-4 lg:px-6 lg:py-6">
        {/* Header - Responsive */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 sm:mb-4 space-y-2 sm:space-y-0">
          <div className="w-full sm:w-auto min-w-0">
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-white truncate">Player Dashboard</h1>
            <p className="text-slate-400 text-xs sm:text-sm lg:text-base truncate">Welcome back, {user?.firstName}!</p>
          </div>
          <Button
            onClick={signOut}
            variant="outline"
            size="sm"
            className="border-slate-600 text-slate-400 hover:bg-slate-700 hover:text-white w-full sm:w-auto flex-shrink-0"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>

        {/* Navigation Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full max-w-full">
          <TabsList className="flex w-full justify-between mb-3 sm:mb-4 bg-slate-800 border border-slate-700 rounded-lg p-1 overflow-hidden gap-1">
            <TabsTrigger 
              value="game" 
              className="flex-1 px-2 sm:px-3 lg:px-4 py-2 text-xs sm:text-sm font-medium rounded-md data-[state=active]:bg-emerald-600 data-[state=active]:text-white hover:bg-slate-700 transition-colors text-slate-300 flex items-center justify-center min-w-0"
            >
              <Spade className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
            </TabsTrigger>
            <TabsTrigger 
              value="balance" 
              className="flex-1 px-2 sm:px-3 lg:px-4 py-2 text-xs sm:text-sm font-medium rounded-md data-[state=active]:bg-emerald-600 data-[state=active]:text-white hover:bg-slate-700 transition-colors text-slate-300 flex items-center justify-center min-w-0"
            >
              <Gift className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
            </TabsTrigger>
            <TabsTrigger 
              value="stats" 
              className="flex-1 px-2 sm:px-3 lg:px-4 py-2 text-xs sm:text-sm font-medium rounded-md data-[state=active]:bg-emerald-600 data-[state=active]:text-white hover:bg-slate-700 transition-colors text-slate-300 flex items-center justify-center min-w-0"
            >
              <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
            </TabsTrigger>
            <TabsTrigger 
              value="profile" 
              className="flex-1 px-2 sm:px-3 lg:px-4 py-2 text-xs sm:text-sm font-medium rounded-md data-[state=active]:bg-emerald-600 data-[state=active]:text-white hover:bg-slate-700 transition-colors text-slate-300 flex items-center justify-center min-w-0"
            >
              <User className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
            </TabsTrigger>
            <TabsTrigger 
              value="feedback" 
              className="flex-1 px-2 sm:px-3 lg:px-4 py-2 text-xs sm:text-sm font-medium rounded-md data-[state=active]:bg-emerald-600 data-[state=active]:text-white hover:bg-slate-700 transition-colors text-slate-300 flex items-center justify-center min-w-0"
            >
              <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
            </TabsTrigger>

          </TabsList>

          {/* Tab Content Areas */}
          <div className="w-full max-w-full overflow-hidden">

            {/* Game Tab */}
            <TabsContent value="game" className="space-y-3 sm:space-y-4 w-full max-w-full">
              {/* Staff-Managed Offer Carousel */}
              <OfferCarousel onOfferClick={(offerId) => {
                // Switch to offers tab when carousel item is clicked
                const offersTab = document.querySelector('[value="balance"]') as HTMLElement;
                if (offersTab) offersTab.click();
              }} />
              
              <div className="w-full max-w-full space-y-3 sm:space-y-4">
                {/* Cash Tables & Tournaments Sub-Tabs */}
                <Tabs defaultValue="cash" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 bg-slate-800 border border-slate-700">
                    <TabsTrigger value="cash" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-300">
                      <Table className="w-4 h-4 mr-2" />
                      Cash Tables
                    </TabsTrigger>
                    <TabsTrigger value="tournaments" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-300">
                      <Trophy className="w-4 h-4 mr-2" />
                      Tournaments
                    </TabsTrigger>
                  </TabsList>

                  {/* Cash Tables Tab */}
                  <TabsContent value="cash" className="mt-4">
                    <Card className="bg-slate-800 border-slate-700 w-full max-w-full overflow-hidden">
                      <CardHeader>
                        <CardTitle className="text-white flex items-center">
                          <Table className="w-5 h-5 mr-2 text-emerald-500" />
                          Cash Tables
                        </CardTitle>
                      </CardHeader>
                <CardContent>
                  {tablesLoading ? (
                    <div className="space-y-4">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-20 bg-slate-700" />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {tables?.map((table) => (
                        <div
                          key={table.id}
                          className="bg-slate-700 p-4 rounded-lg"
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h3 className="font-semibold text-white">{table.name}</h3>
                              <p className="text-sm text-slate-400">{table.gameType}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-slate-400">Stakes</p>
                              <p className="text-lg font-semibold text-emerald-500">
                                {table.stakes}
                              </p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 mb-3">
                            <div className="text-center">
                              <Users className="w-4 h-4 text-slate-400 mx-auto mb-1" />
                              <p className="text-xs text-slate-400">Players</p>
                              <p className="text-sm font-semibold text-white">
                                {table.currentPlayers}/{table.maxPlayers}
                              </p>
                            </div>
                            <div className="text-center">
                              <div className="w-4 h-4 bg-amber-500 rounded-full mx-auto mb-1" />
                              <p className="text-xs text-slate-400">Avg Stack</p>
                              <p className="text-sm font-semibold text-amber-500">
                                ₹{table.avgStack}
                              </p>
                            </div>
                          </div>

                          <div className="flex justify-between items-center">
                            <div className="flex items-center space-x-2">
                              {isTableJoined(table.id) ? (
                                <>
                                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                                    Joined
                                  </Badge>
                                  <span className="text-sm text-slate-400">
                                    Position: {getWaitListPosition(table.id)}
                                  </span>
                                  <Button
                                    onClick={() => handleLeaveWaitList(table.id)}
                                    disabled={leaveWaitListMutation.isPending}
                                    size="sm"
                                    variant="outline"
                                    className="border-red-500 text-red-400 hover:bg-red-500/10"
                                  >
                                    {leaveWaitListMutation.isPending ? (
                                      <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin mr-2" />
                                    ) : null}
                                    Leave
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  onClick={() => handleJoinWaitList(table.id)}
                                  disabled={joinWaitListMutation.isPending}
                                  size="sm"
                                  className="bg-emerald-500 hover:bg-emerald-600 text-white"
                                >
                                  {joinWaitListMutation.isPending ? (
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                                  ) : null}
                                  Join Wait-List
                                </Button>
                              )}
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              <Badge variant="secondary" className="bg-slate-600 text-slate-300">
                                {table.isActive ? 'Active' : 'Inactive'}
                              </Badge>
                              <Button
                                onClick={() => setLocation(`/table/${table.id}`)}
                                size="sm"
                                variant="outline"
                                className="border-blue-500 text-blue-400 hover:bg-blue-500/10"
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                View
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {(!tables || tables.length === 0) && (
                        <div className="text-center py-8">
                          <Table className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                          <p className="text-slate-400">No tables available</p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Tournaments Tab */}
                  <TabsContent value="tournaments" className="mt-4">
                    <Card className="bg-slate-800 border-slate-700 w-full max-w-full overflow-hidden">
                      <CardHeader>
                        <CardTitle className="text-white flex items-center">
                          <Trophy className="w-5 h-5 mr-2 text-yellow-500" />
                          Tournaments
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {tournamentsLoading ? (
                          <div className="space-y-4">
                            {[1, 2, 3].map((i) => (
                              <Skeleton key={i} className="h-24 bg-slate-700" />
                            ))}
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {tournaments?.map((tournament) => (
                              <div
                                key={tournament.id}
                                className="bg-slate-700 p-4 rounded-lg"
                              >
                                <div className="flex justify-between items-start mb-3">
                                  <div>
                                    <h3 className="font-semibold text-white">{tournament.name}</h3>
                                    <p className="text-sm text-slate-400">{tournament.game_type}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm text-slate-400">Buy-in</p>
                                    <p className="text-lg font-semibold text-yellow-500">
                                      ₹{tournament.buy_in?.toLocaleString()}
                                    </p>
                                  </div>
                                </div>
                                
                                <div className="grid grid-cols-3 gap-4 mb-3">
                                  <div className="text-center">
                                    <Users className="w-4 h-4 text-slate-400 mx-auto mb-1" />
                                    <p className="text-xs text-slate-400">Players</p>
                                    <p className="text-sm font-semibold text-white">
                                      {tournament.registered_players}/{tournament.max_players}
                                    </p>
                                  </div>
                                  <div className="text-center">
                                    <Clock className="w-4 h-4 text-slate-400 mx-auto mb-1" />
                                    <p className="text-xs text-slate-400">Start Time</p>
                                    <p className="text-sm font-semibold text-emerald-500">
                                      {new Date(tournament.start_time).toLocaleTimeString([], { 
                                        hour: '2-digit', 
                                        minute: '2-digit' 
                                      })}
                                    </p>
                                  </div>
                                  <div className="text-center">
                                    <Trophy className="w-4 h-4 text-yellow-500 mx-auto mb-1" />
                                    <p className="text-xs text-slate-400">Prize Pool</p>
                                    <p className="text-sm font-semibold text-yellow-500">
                                      ₹{tournament.prize_pool?.toLocaleString()}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex justify-between items-center">
                                  <div className="flex items-center space-x-2">
                                    <Badge 
                                      className={`${
                                        tournament.status === 'upcoming' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' :
                                        tournament.status === 'running' ? 'bg-green-500/20 text-green-300 border-green-500/30' :
                                        tournament.status === 'finished' ? 'bg-gray-500/20 text-gray-300 border-gray-500/30' :
                                        'bg-slate-500/20 text-slate-300 border-slate-500/30'
                                      }`}
                                    >
                                      {tournament.status?.charAt(0).toUpperCase() + tournament.status?.slice(1)}
                                    </Badge>
                                    <span className="text-sm text-slate-400">
                                      {tournament.tournament_type}
                                    </span>
                                  </div>
                                  
                                  <div className="flex items-center space-x-2">
                                    {tournament.status === 'upcoming' && (
                                      <>
                                        <Button
                                          onClick={() => handleTournamentInterest(tournament.id)}
                                          disabled={tournamentActionLoading}
                                          size="sm"
                                          variant="outline"
                                          className="border-blue-500 text-blue-400 hover:bg-blue-500/10"
                                        >
                                          {tournamentActionLoading ? (
                                            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mr-2" />
                                          ) : null}
                                          Interested
                                        </Button>
                                        <Button
                                          onClick={() => handleTournamentRegister(tournament.id)}
                                          disabled={tournamentActionLoading}
                                          size="sm"
                                          className="bg-yellow-500 hover:bg-yellow-600 text-black"
                                        >
                                          {tournamentActionLoading ? (
                                            <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin mr-2" />
                                          ) : null}
                                          Register
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                            
                            {(!tournaments || tournaments.length === 0) && (
                              <div className="text-center py-8">
                                <Trophy className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                                <p className="text-slate-400">No tournaments available</p>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>

                {/* Preferences section removed as per requirements */}
              </div>
            </TabsContent>

          {/* Offers Tab - Staff Managed */}
          <TabsContent value="balance" className="space-y-4">
            <ScrollableOffersDisplay />
          </TabsContent>

          {/* Stats Tab */}
          <TabsContent value="stats" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Gaming Statistics */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center">
                    <BarChart3 className="w-5 h-5 mr-2 text-emerald-500" />
                    Gaming Statistics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300">Games Played</span>
                    <span className="text-white font-semibold">{user?.gamesPlayed || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300">Hours Played</span>
                    <span className="text-white font-semibold">{user?.hoursPlayed || "0.00"} hrs</span>
                  </div>
                </CardContent>
              </Card>

              {/* Financial Statistics */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center">
                    <CreditCard className="w-5 h-5 mr-2 text-emerald-500" />
                    Financial Overview
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300">Current Balance</span>
                    <span className="text-emerald-500 font-semibold">₹{user?.balance || "0.00"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300">Credit Limit</span>
                    <span className="text-blue-500 font-semibold">
                      {user?.creditApproved ? "₹50,000" : "Not Approved"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* VIP Club Loyalty Program */}
            <Card className="bg-gradient-to-r from-yellow-900/20 to-yellow-800/20 border-yellow-600/30">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <Star className="w-5 h-5 mr-2 text-yellow-500" />
                  VIP Club - Loyalty Program
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-center py-12">
                {/* VIP Shop Button Only */}
                <Link href="/vip-shop">
                  <Button 
                    className="bg-gradient-to-r from-yellow-600 to-yellow-700 hover:from-yellow-700 hover:to-yellow-800 text-white font-bold py-6 px-12 text-xl rounded-xl transition-all transform hover:scale-105 shadow-lg"
                    size="lg"
                  >
                    <Star className="w-8 h-8 mr-3" />
                    Open VIP Shop
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:gap-6">
              {/* Profile Summary */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center">
                    <User className="w-5 h-5 mr-2 text-emerald-500" />
                    Profile
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Profile Details */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-slate-700 rounded-lg">
                      <span className="text-sm text-slate-300">Name</span>
                      <span className="text-sm text-white font-medium">{user?.firstName} {user?.lastName}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-slate-700 rounded-lg">
                      <span className="text-sm text-slate-300">Email</span>
                      <span className="text-sm text-white font-medium">{user?.email}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-slate-700 rounded-lg">
                      <span className="text-sm text-slate-300">Phone</span>
                      <span className="text-sm text-white font-medium">{user?.phone}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-slate-700 rounded-lg">
                      <span className="text-sm text-slate-300">KYC Status</span>
                      <div className="flex items-center">
                        {user?.kycStatus === 'approved' ? (
                          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">Verified</Badge>
                        ) : user?.kycStatus === 'verified' ? (
                          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">Verified</Badge>
                        ) : user?.kycStatus === 'pending' ? (
                          <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">Pending</Badge>
                        ) : (
                          <Badge variant="destructive">Not Verified</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* KYC Documents Management */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center">
                    <FileText className="w-5 h-5 mr-2 text-emerald-500" />
                    KYC Documents
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {kycLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-12 bg-slate-700" />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* File type information */}
                      <div className="mb-4 p-3 bg-slate-700 rounded-lg">
                        <p className="text-xs text-slate-300 mb-1">
                          <strong>Supported file types:</strong> JPG, PNG, PDF (max 5MB each)
                        </p>
                        <p className="text-xs text-slate-400">
                          Upload clear, high-quality images of your documents for faster verification
                        </p>
                      </div>
                      {/* Debug: Show KYC documents count */}
                      <div className="text-xs text-slate-500 mb-2">
                        {kycDocuments ? `Found ${kycDocuments.length} documents` : 'No documents found'}
                      </div>
                      {/* ID Document */}
                      <div className="flex items-center justify-between p-3 bg-slate-700 rounded-lg">
                        <div className="flex items-center space-x-3 flex-1">
                          {getKycStatusIcon(getKycDocumentStatus('id'))}
                          <div className="flex-1">
                            <p className="text-sm font-medium text-white">ID Document</p>
                            <p className="text-xs text-slate-400 capitalize">{getKycDocumentStatus('id')}</p>
                            {kycDocuments?.filter(d => d.documentType === 'government_id' && d.fileUrl).length > 0 && (
                              <div className="flex items-center space-x-2 mt-1">
                                <p className="text-xs text-emerald-500">
                                  {kycDocuments.filter(d => d.documentType === 'government_id' && d.fileUrl)[0].fileName}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-stretch space-y-2">
                          {/* View button positioned above other buttons */}
                          {kycDocuments?.filter(d => d.documentType === 'government_id' && d.fileUrl).length > 0 && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="text-xs border-slate-600 text-slate-400 hover:bg-slate-700 w-full"
                              onClick={() => {
                                const doc = kycDocuments.filter(d => d.documentType === 'government_id' && d.fileUrl)[0];
                                if (doc && doc.fileUrl) {
                                  try {
                                    const documentUrl = doc.fileUrl.startsWith('http') 
                                      ? doc.fileUrl 
                                      : `/api/documents/view/${doc.id}`;
                                    console.log('Opening document:', documentUrl);
                                    const newTab = window.open(documentUrl, '_blank', 'noopener,noreferrer');
                                    if (!newTab) {
                                      window.location.href = documentUrl;
                                    }
                                  } catch (error) {
                                    console.error('Error opening document:', error);
                                    toast({
                                      title: "Error",
                                      description: "Unable to open document",
                                      variant: "destructive",
                                    });
                                  }
                                }
                              }}
                            >
                              <Eye className="w-3 h-3 mr-1" />
                              View Document
                            </Button>
                          )}
                          
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
                            {/* Only show upload/reupload if not approved or if no documents */}
                            {(getKycDocumentStatus('id') !== 'approved' || kycDocuments?.filter(d => d.documentType === 'government_id' && d.fileUrl).length === 0) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => document.getElementById('id-document-upload')?.click()}
                                disabled={uploadKycDocumentMutation.isPending}
                                className="border-slate-600 hover:bg-slate-600 w-full sm:w-auto"
                              >
                                <Upload className="w-4 h-4 mr-1" />
                                {kycDocuments?.filter(d => d.documentType === 'government_id' && d.fileUrl).length > 0 ? 'Reupload' : 'Upload'}
                              </Button>
                            )}
                            
                            {/* Show request change button if approved */}
                            {getKycDocumentStatus('id') === 'approved' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  toast({
                                    title: "Request Change",
                                    description: "Change request functionality will be available in the next update",
                                  });
                                }}
                                className="border-amber-600 text-amber-400 hover:bg-amber-600/20 w-full sm:w-auto"
                              >
                                <AlertTriangle className="w-4 h-4 mr-1" />
                                <span className="text-xs sm:text-sm">Request Change</span>
                              </Button>
                            )}
                          </div>
                        </div>
                        <input
                          id="id-document-upload"
                          type="file"
                          accept=".jpg,.jpeg,.png,.pdf"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            console.log('File input changed for ID:', { file: file?.name, hasFile: !!file });
                            if (file) {
                              handleKycDocumentUpload('government_id', file);
                              // Reset the input value to allow re-uploading same file
                              e.target.value = '';
                            }
                          }}
                        />
                      </div>

                      {/* Address Document */}
                      <div className="flex items-center justify-between p-3 bg-slate-700 rounded-lg">
                        <div className="flex items-center space-x-3 flex-1">
                          {getKycStatusIcon(getKycDocumentStatus('utility'))}
                          <div className="flex-1">
                            <p className="text-sm font-medium text-white">Address Proof</p>
                            <p className="text-xs text-slate-400 capitalize">{getKycDocumentStatus('utility')}</p>
                            {kycDocuments?.filter(d => d.documentType === 'utility_bill' && d.fileUrl).length > 0 && (
                              <div className="flex items-center space-x-2 mt-1">
                                <p className="text-xs text-emerald-500">
                                  {kycDocuments.filter(d => d.documentType === 'utility_bill' && d.fileUrl)[0].fileName}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-stretch space-y-2">
                          {/* View button positioned above other buttons */}
                          {kycDocuments?.filter(d => d.documentType === 'profile_photo' && d.fileUrl).length > 0 && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="text-xs border-slate-600 text-slate-400 hover:bg-slate-700 w-full"
                              onClick={() => {
                                const doc = kycDocuments.filter(d => d.documentType === 'profile_photo' && d.fileUrl)[0];
                                if (doc && doc.fileUrl) {
                                  try {
                                    const documentUrl = doc.fileUrl.startsWith('http') 
                                      ? doc.fileUrl 
                                      : `/api/documents/view/${doc.id}`;
                                    console.log('Opening document:', documentUrl);
                                    const newTab = window.open(documentUrl, '_blank', 'noopener,noreferrer');
                                    if (!newTab) {
                                      window.location.href = documentUrl;
                                    }
                                  } catch (error) {
                                    console.error('Error opening document:', error);
                                    toast({
                                      title: "Error",
                                      description: "Unable to open document",
                                      variant: "destructive",
                                    });
                                  }
                                }
                              }}
                            >
                              <Eye className="w-3 h-3 mr-1" />
                              View Document
                            </Button>
                          )}
                          
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
                            {/* Only show upload/reupload if not approved or if no documents */}
                            {(getKycDocumentStatus('photo') !== 'approved' || kycDocuments?.filter(d => d.documentType === 'profile_photo' && d.fileUrl).length === 0) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => document.getElementById('photo-document-upload')?.click()}
                                disabled={uploadKycDocumentMutation.isPending}
                                className="border-slate-600 hover:bg-slate-600 w-full sm:w-auto"
                              >
                                <Upload className="w-4 h-4 mr-1" />
                                {kycDocuments?.filter(d => d.documentType === 'profile_photo' && d.fileUrl).length > 0 ? 'Reupload' : 'Upload'}
                              </Button>
                            )}
                            
                            {/* Show request change button if approved */}
                            {getKycDocumentStatus('photo') === 'approved' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  toast({
                                    title: "Request Change",
                                    description: "Change request functionality will be available in the next update",
                                  });
                                }}
                                className="border-amber-600 text-amber-400 hover:bg-amber-600/20 w-full sm:w-auto"
                              >
                                <AlertTriangle className="w-4 h-4 mr-1" />
                                <span className="text-xs sm:text-sm">Request Change</span>
                              </Button>
                            )}
                          </div>
                        </div>
                        <input
                          id="address-document-upload"
                          type="file"
                          accept=".jpg,.jpeg,.png,.pdf"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            console.log('File input changed for Address:', { file: file?.name, hasFile: !!file });
                            if (file) {
                              handleKycDocumentUpload('utility_bill', file);
                              // Reset the input value to allow re-uploading same file
                              e.target.value = '';
                            }
                          }}
                        />
                      </div>

                      {/* Photo Document */}
                      <div className="flex items-center justify-between p-3 bg-slate-700 rounded-lg">
                        <div className="flex items-center space-x-3 flex-1">
                          {getKycStatusIcon(getKycDocumentStatus('photo'))}
                          <div className="flex-1">
                            <p className="text-sm font-medium text-white">Photo</p>
                            <p className="text-xs text-slate-400 capitalize">{getKycDocumentStatus('photo')}</p>
                            {kycDocuments?.filter(d => d.documentType === 'profile_photo' && d.fileUrl).length > 0 && (
                              <div className="flex items-center space-x-2 mt-1">
                                <p className="text-xs text-emerald-500">
                                  {kycDocuments.filter(d => d.documentType === 'profile_photo' && d.fileUrl)[0].fileName}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-stretch space-y-2">
                          {/* View button positioned above other buttons */}
                          {kycDocuments?.filter(d => d.documentType === 'profile_photo' && d.fileUrl).length > 0 && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="text-xs border-slate-600 text-slate-400 hover:bg-slate-700 w-full"
                              onClick={() => {
                                const doc = kycDocuments.filter(d => d.documentType === 'profile_photo' && d.fileUrl)[0];
                                if (doc && doc.fileUrl) {
                                  try {
                                    const documentUrl = doc.fileUrl.startsWith('http') 
                                      ? doc.fileUrl 
                                      : `/api/documents/view/${doc.id}`;
                                    console.log('Opening document:', documentUrl);
                                    const newTab = window.open(documentUrl, '_blank', 'noopener,noreferrer');
                                    if (!newTab) {
                                      window.location.href = documentUrl;
                                    }
                                  } catch (error) {
                                    console.error('Error opening document:', error);
                                    toast({
                                      title: "Error",
                                      description: "Unable to open document",
                                      variant: "destructive",
                                    });
                                  }
                                }
                              }}
                            >
                              <Eye className="w-3 h-3 mr-1" />
                              View Document
                            </Button>
                          )}
                          
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
                            {/* Only show upload/reupload if not approved or if no documents */}
                            {(getKycDocumentStatus('photo') !== 'approved' || kycDocuments?.filter(d => d.documentType === 'profile_photo' && d.fileUrl).length === 0) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => document.getElementById('photo-document-upload')?.click()}
                                disabled={uploadKycDocumentMutation.isPending}
                                className="border-slate-600 hover:bg-slate-600 w-full sm:w-auto"
                              >
                                <Upload className="w-4 h-4 mr-1" />
                                {kycDocuments?.filter(d => d.documentType === 'profile_photo' && d.fileUrl).length > 0 ? 'Reupload' : 'Upload'}
                              </Button>
                            )}
                            
                            {/* Show request change button if approved */}
                            {getKycDocumentStatus('photo') === 'approved' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  toast({
                                    title: "Request Change",
                                    description: "Change request functionality will be available in the next update",
                                  });
                                }}
                                className="border-amber-600 text-amber-400 hover:bg-amber-600/20 w-full sm:w-auto"
                              >
                                <AlertTriangle className="w-4 h-4 mr-1" />
                                <span className="text-xs sm:text-sm">Request Change</span>
                              </Button>
                            )}
                          </div>
                        </div>
                        <input
                          id="photo-document-upload"
                          type="file"
                          accept=".jpg,.jpeg,.png,.pdf"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            console.log('File input changed for Photo:', { file: file?.name, hasFile: !!file });
                            if (file) {
                              handleKycDocumentUpload('profile_photo', file);
                              // Reset the input value to allow re-uploading same file
                              e.target.value = '';
                            }
                          }}
                        />
                      </div>

                      {/* Upload status */}
                      {uploadKycDocumentMutation.isPending && (
                        <div className="flex items-center space-x-2 p-3 bg-slate-700 rounded-lg">
                          <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-sm text-slate-300">Uploading document...</span>
                        </div>
                      )}

                      {/* Document Summary */}
                      {kycDocuments && kycDocuments.length > 0 && (
                        <div className="mt-4 p-4 bg-slate-700 rounded-lg">
                          <h4 className="text-sm font-medium text-white mb-3">Document Upload History</h4>
                          <div className="mb-3 p-2 bg-slate-800 rounded border border-slate-600">
                            <p className="text-xs text-slate-300">
                              <strong>Note:</strong> Some older documents may need to be re-uploaded to view them. 
                              New uploads will be viewable immediately.
                            </p>
                          </div>
                          <div className="space-y-2">
                            {kycDocuments.map((doc) => (
                              <div key={doc.id} className="flex items-center justify-between py-2 border-b border-slate-600 last:border-b-0">
                                <div className="flex items-center space-x-3 flex-1">
                                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                                  <div className="flex-1">
                                    <p className="text-xs font-medium text-white capitalize">{doc.documentType} Document</p>
                                    <p className="text-xs text-slate-400">{doc.fileName}</p>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Badge 
                                    variant={doc.status === 'approved' ? 'default' : doc.status === 'pending' ? 'secondary' : 'destructive'}
                                    className="text-xs"
                                  >
                                    {doc.status}
                                  </Badge>
                                  <span className="text-xs text-slate-500">
                                    {new Date(doc.createdAt!).toLocaleDateString()}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* PAN Card Management */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center">
                    <CreditCard className="w-5 h-5 mr-2 text-emerald-500" />
                    PAN Card Verification
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* PAN Card Number Input */}
                  <div className="space-y-3">
                    <div className="p-3 bg-slate-700 rounded-lg">
                      <p className="text-xs text-slate-300 mb-2">
                        <strong>PAN Card Format:</strong> AAAAA9999A (5 letters, 4 numbers, 1 letter)
                      </p>
                      <p className="text-xs text-slate-400">
                        Your PAN card number must be unique and cannot be used by other players
                      </p>
                    </div>
                    
                    <div className="flex flex-col space-y-2">
                      <label htmlFor="pan-number" className="text-sm font-medium text-white">
                        PAN Card Number
                      </label>
                      <input
                        id="pan-number"
                        type="text"
                        placeholder="AAAAA9999A"
                        maxLength={10}
                        value={panCardNumber}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        style={{ textTransform: 'uppercase' }}
                        onChange={(e) => {
                          setPanCardNumber(e.target.value.toUpperCase());
                        }}
                      />
                    </div>
                    
                    <Button 
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                      disabled={updatePanCardMutation.isPending}
                      onClick={handlePanCardUpdate}
                    >
                      {updatePanCardMutation.isPending ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                          Updating...
                        </>
                      ) : (
                        'Update PAN Card Number'
                      )}
                    </Button>
                  </div>

                  {/* PAN Card Document Upload */}
                  <div className="space-y-3 pt-4 border-t border-slate-600">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-white">PAN Card Document</h4>
                        <p className="text-xs text-slate-400">Upload clear image of your PAN card</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => document.getElementById('pan-document-upload')?.click()}
                        className="border-slate-600 hover:bg-slate-600"
                      >
                        <Upload className="w-4 h-4 mr-1" />
                        Upload
                      </Button>
                    </div>
                    
                    <input
                      id="pan-document-upload"
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          // TODO: Add PAN card document upload
                          console.log('PAN Card Document:', file.name);
                        }
                      }}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Transaction History */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center">
                    <FileText className="w-5 h-5 mr-2 text-emerald-500" />
                    Transaction History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <select 
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      value={showTransactions ? 'view' : ''}
                      onChange={(e) => {
                        setShowTransactions(e.target.value === 'view');
                      }}
                    >
                      <option value="">Select action...</option>
                      <option value="view">View Last 10 Transactions</option>
                    </select>
                    
                    {/* Transaction List */}
                    {showTransactions && (
                      <div className="bg-slate-700 rounded-lg p-4">
                        {transactionsLoading ? (
                          <div className="flex items-center justify-center py-4">
                            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                            <span className="ml-2 text-sm text-slate-300">Loading transactions...</span>
                          </div>
                        ) : transactions && transactions.length > 0 ? (
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium text-white mb-3">Recent Transactions</h4>
                            {transactions.map((transaction: any, index: number) => (
                              <div key={index} className="flex justify-between items-center py-2 border-b border-slate-600 last:border-b-0">
                                <div>
                                  <p className="text-sm text-white">{transaction.type}</p>
                                  <p className="text-xs text-slate-400">
                                    {new Date(transaction.created_at).toLocaleDateString()} at {new Date(transaction.created_at).toLocaleTimeString()}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className={`text-sm font-medium ${transaction.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {transaction.amount >= 0 ? '+' : ''}₹{Math.abs(transaction.amount)}
                                  </p>
                                  <p className="text-xs text-slate-400">{transaction.status}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-300 text-center">
                            No transactions found
                          </p>
                        )}
                      </div>
                    )}
                    
                    {!showTransactions && (
                      <div className="bg-slate-700 rounded-lg p-4">
                        <p className="text-sm text-slate-300 text-center">
                          Select "View Last 10 Transactions" to see your recent activity
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Mobile App Connection */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center">
                    <svg className="w-5 h-5 mr-2 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    Mobile App
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center">
                    <div className="w-20 h-20 bg-slate-700 rounded-xl flex items-center justify-center mx-auto mb-4">
                      <svg className="w-10 h-10 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="text-sm text-slate-300 mb-4">Connect your mobile device for the best gaming experience</p>
                  </div>

                  {/* QR Code or App Links */}
                  <div className="space-y-3">
                    <div className="bg-slate-700 p-4 rounded-lg text-center">
                      <div className="w-32 h-32 bg-white rounded-lg mx-auto mb-3 flex items-center justify-center">
                        <span className="text-2xl">📱</span>
                      </div>
                      <p className="text-xs text-slate-400">Scan QR code to download mobile app</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <button className="bg-slate-700 hover:bg-slate-600 p-3 rounded-lg transition-colors">
                        <div className="flex items-center justify-center space-x-2">
                          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                          </svg>
                          <span className="text-xs text-white">iOS</span>
                        </div>
                      </button>
                      <button className="bg-slate-700 hover:bg-slate-600 p-3 rounded-lg transition-colors">
                        <div className="flex items-center justify-center space-x-2">
                          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.198l2.807 1.626a1 1 0 010 1.73l-2.808 1.626L15.699 12l1.999-2.491zM5.864 2.658L16.802 8.99l-2.303 2.303-8.635-8.635z"/>
                          </svg>
                          <span className="text-xs text-white">Android</span>
                        </div>
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
              </div>
            </TabsContent>

            {/* Feedback Tab */}
            <TabsContent value="feedback" className="flex-1 overflow-y-auto">
              <div className="space-y-4">
                {/* Feedback to Management */}
                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center">
                      <MessageCircle className="w-5 h-5 mr-2 text-emerald-500" />
                      Send Feedback to Management
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white">Message</label>
                      <textarea
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
                        rows={5}
                        value={feedbackMessage}
                        onChange={(e) => setFeedbackMessage(e.target.value)}
                        placeholder="Share your feedback, suggestions, or concerns with our management team..."
                        disabled={sendingFeedback}
                      />
                    </div>
                    <Button 
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                      onClick={submitFeedback}
                      disabled={sendingFeedback || !feedbackMessage.trim()}
                    >
                      {sendingFeedback ? (
                        <div className="animate-spin w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full" />
                      ) : (
                        <Send className="w-4 h-4 mr-2" />
                      )}
                      {sendingFeedback ? "Sending..." : "Send Feedback"}
                    </Button>
                  </CardContent>
                </Card>

                {/* Guest Relations Support */}
                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader className="pb-4 border-b border-slate-700">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-emerald-500/20 rounded-full">
                        <MessageCircle className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <CardTitle className="text-white text-lg">
                          Guest Relations Support
                        </CardTitle>
                        <div className="flex items-center space-x-2 text-sm text-slate-400">
                          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                          <span>Available 24/7</span>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Chat Messages Display */}
                    <div className="max-h-[400px] overflow-y-auto space-y-4 bg-slate-900 p-4 rounded-lg">
                      {chatLoading ? (
                        <div className="text-center text-slate-400 py-8">
                          <MessageCircle className="w-8 h-8 mx-auto mb-2 animate-pulse" />
                          Loading chat history...
                        </div>
                      ) : chatMessages && chatMessages.length > 0 ? (
                        chatMessages.map((message: any, index: number) => (
                          <div
                            key={index}
                            className={`flex ${
                              message.sender === 'player' || message.sender_type === 'player' ? 'justify-end' : 'justify-start'
                            }`}
                          >
                            <div className="flex items-end space-x-2 max-w-[80%]">
                              {(message.sender === 'gre' || message.sender_type === 'gre') && (
                                <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center">
                                  <MessageCircle className="w-4 h-4 text-white" />
                                </div>
                              )}
                              <div>
                                <div
                                  className={`rounded-lg px-3 py-2 ${
                                    message.sender === 'player' || message.sender_type === 'player'
                                      ? 'bg-blue-600 text-white'
                                      : 'bg-slate-700 text-slate-100'
                                  }`}
                                >
                                  <p className="text-sm">{message.message}</p>
                                </div>
                                <div className="flex items-center mt-1 space-x-2">
                                  <span className="text-xs text-slate-500">
                                    {new Date(message.timestamp || message.created_at).toLocaleTimeString([], { 
                                      hour: '2-digit', 
                                      minute: '2-digit' 
                                    })}
                                  </span>
                                </div>
                              </div>
                              {(message.sender === 'player' || message.sender_type === 'player') && (
                                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                                  <span className="text-xs text-white font-medium">You</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center text-slate-400 py-8">
                          <MessageCircle className="w-12 h-12 mx-auto mb-4 text-slate-600" />
                          <h3 className="text-lg font-medium text-slate-300 mb-2">
                            Start a Conversation
                          </h3>
                          <p className="text-sm">
                            Our Guest Relations team is here to help you with any questions or concerns.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Quick Actions */}
                    <div className="space-y-2">
                      <div className="text-xs text-slate-400 font-medium">Quick Actions:</div>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          "I need help with my account",
                          "Technical support",
                          "Payment history",
                          "Game assistance"
                        ].map((quickMessage) => (
                          <Button
                            key={quickMessage}
                            variant="outline"
                            size="sm"
                            onClick={() => setChatMessage(quickMessage)}
                            className="text-xs border-slate-600 text-slate-300 hover:bg-slate-700 h-auto py-2 px-3 text-left justify-start"
                          >
                            {quickMessage}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Chat Input */}
                    <div className="flex gap-2 pt-4 border-t border-slate-700">
                      <Input
                        value={chatMessage}
                        onChange={(e) => setChatMessage(e.target.value)}
                        placeholder="Type your message..."
                        className="flex-1 bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        disabled={sendingChatMessage}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendChatMessage();
                          }
                        }}
                      />
                      <Button 
                        onClick={sendChatMessage}
                        disabled={sendingChatMessage || !chatMessage.trim()}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        {sendingChatMessage ? (
                          <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Notifications from Management */}
                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center">
                      <Bell className="w-5 h-5 mr-2 text-emerald-500" />
                      Notifications from Management
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-[400px] overflow-y-auto space-y-3">
                      {notificationsLoading ? (
                        <div className="space-y-3">
                          {[1, 2, 3].map((i) => (
                            <div key={i} className="bg-slate-700 p-3 rounded-lg animate-pulse">
                              <div className="h-4 bg-slate-600 rounded mb-2"></div>
                              <div className="h-3 bg-slate-600 rounded w-3/4"></div>
                            </div>
                          ))}
                        </div>
                      ) : notifications && notifications.length > 0 ? (
                        notifications.map((notification: any) => (
                          <div 
                            key={notification.id} 
                            className={`p-4 rounded-lg border-l-4 ${
                              notification.priority === 'urgent' ? 'border-red-500 bg-red-900/20' :
                              notification.priority === 'high' ? 'border-yellow-500 bg-yellow-900/20' :
                              'border-emerald-500 bg-emerald-900/20'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h4 className="font-medium text-white mb-1">{notification.title}</h4>
                                <p className="text-slate-300 text-sm mb-2">{notification.message}</p>
                                <div className="flex items-center text-xs text-slate-400">
                                  <span className="bg-slate-700 px-2 py-1 rounded mr-2">
                                    {notification.sender_role.toUpperCase()}
                                  </span>
                                  <span>{notification.sender_name}</span>
                                  <span className="mx-2">•</span>
                                  <span>{new Date(notification.created_at).toLocaleString()}</span>
                                </div>
                              </div>
                              {notification.priority === 'urgent' && (
                                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 ml-2" />
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8">
                          <Bell className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                          <p className="text-slate-400 text-sm">No notifications yet</p>
                          <p className="text-slate-500 text-xs">You'll receive real-time messages from staff here</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>


    </div>
  );
}