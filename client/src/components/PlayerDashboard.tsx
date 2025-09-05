import { useUltraFastAuth } from "@/hooks/useUltraFastAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useRouter } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  Trophy,
  X,
  Plus,
  Info,
  RotateCcw,
  Trash2,
  Coffee
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import type { Table as TableType, SeatRequest, KycDocument } from "@shared/schema";
import DualBalanceDisplay from "./DualBalanceDisplay";
import { PlayerBalanceDisplay } from "./PlayerBalanceDisplay";
import { PlayerTransactionHistory } from "./PlayerTransactionHistory";
import { PlaytimeTracker } from "./PlaytimeTracker";
// Cash-out and credit transfer removed - players can only view balance, all financial operations handled by cashier
// TableOperations removed - players can only view balance, all operations handled by managers/cashiers
import OfferBanner from "./OfferBanner";
import OfferCarousel from "./OfferCarousel";
import NotificationPopup from "./NotificationPopup";

import PlayerChatSystem from "./PlayerChatSystem";
import NotificationHistoryTab from "./NotificationHistoryTab";
import FoodBeverageTab from "./FoodBeverageTab";


// Scrollable Offers Display Component
const ScrollableOffersDisplay = () => {
  const { data: offers, isLoading, error } = useQuery({
    queryKey: ['/api/staff-offers'],
    refetchInterval: 5000, // Refresh every 5 seconds
    retry: 1, // Only retry once to avoid spamming
  });

  const trackOfferView = useMutation({
    mutationFn: (offerId: string) => 
      apiRequest("POST", "/api/offer-views", { offer_id: offerId }),
  });

  // Use only real staff offers from database - no fallback demo data
  const displayOffers = (offers && Array.isArray(offers)) ? offers : [];

  // Handle error state gracefully
  if (error) {
    return (
      <div className="space-y-4">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Gift className="w-5 h-5 mr-2 text-emerald-500" />
              Special Offers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-slate-400 text-center py-8">
              <Gift className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No offers available at the moment</p>
              <p className="text-sm mt-2">Check back later for special promotions!</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <Gift className="w-5 h-5 mr-2 text-emerald-500" />
            Special Offers ({Array.isArray(displayOffers) ? displayOffers.length : 0})
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Show message when no offers available */}
      {displayOffers.length === 0 && !isLoading && (
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-8">
            <div className="text-slate-400 text-center">
              <Gift className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No special offers available at the moment</p>
              <p className="text-sm mt-2">Check back later for exclusive promotions!</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scrollable offers container */}
      <div className="max-h-[600px] overflow-y-auto space-y-4 pr-2 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800">
        {Array.isArray(displayOffers) && displayOffers.map((offer: any) => (
          <Card 
            key={offer.id}
            id={`offer-${offer.id}`}
            className="bg-gradient-to-br from-emerald-800 to-emerald-900 border-emerald-600 hover:border-emerald-400 transition-all duration-300"
            onClick={() => trackOfferView.mutate(offer.id)}
          >
            <CardContent className="p-0">
              {/* Staff portal media or fallback */}
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
                    </video>
                  </div>
                ) : offer.image_url ? (
                  <div className="aspect-video rounded-t-lg overflow-hidden bg-slate-900">
                    <img 
                      src={offer.image_url} 
                      alt={offer.title}
                      className="w-full h-full object-cover"
                    />
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
                    // Navigate to offer detail page using Wouter
                    window.location.href = `/offer/${offer.id}`;
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

  const vipPoints = (vipData as any)?.totalVipPoints || 0;
  const breakdown = vipData as any;

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
                <span>Big Blind (₹{breakdown?.avgBigBlind || 0} × 0.5)</span>
                <span className="text-yellow-400">{(breakdown?.bigBlindPoints || 0).toFixed(1)}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Rs Played (₹{breakdown?.totalRsPlayed || 0} × 0.3)</span>
                <span className="text-yellow-400">{(breakdown?.rsPlayedPoints || 0).toFixed(1)}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Visit Frequency ({breakdown?.visitFrequency || 0} days × 0.2)</span>
                <span className="text-yellow-400">{(breakdown?.frequencyPoints || 0).toFixed(1)}</span>
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

interface PlayerDashboardProps {
  user?: any;
}

function PlayerDashboard({ user: userProp }: PlayerDashboardProps) {
  const { user: authUser, signOut } = useUltraFastAuth();

  // Use prop user if available, fallback to auth user
  const user = userProp || authUser;
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
  const [showTournaments, setShowTournaments] = useState(false);

  // Chat Dialog state
  const [chatDialogOpen, setChatDialogOpen] = useState(false);

  // Unified Chat messages state (CRITICAL FIX)
  const [unifiedChatMessages, setUnifiedChatMessages] = useState<any[]>([]);


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

  // Email verification notification state
  const [showEmailVerificationBanner, setShowEmailVerificationBanner] = useState(false);

  // Check if user needs email verification - integrated with Clerk auth
  useEffect(() => {
    if (user && user.email && !(user as any).emailVerified) {
      setShowEmailVerificationBanner(true);
    }
  }, [user]);

  // Fetch live tables with smart background refresh
  // Fetch tables data from API with reduced refresh rate
  const { data: tables, isLoading: tablesLoading } = useQuery<TableType[]>({
    queryKey: ['/api/tables'],
    refetchInterval: 30000, // Refresh every 30 seconds instead of 2 seconds
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
    staleTime: 15000, // Consider data fresh for 15 seconds
    gcTime: 5000, // Keep cached data for 5 seconds
    retry: 3,
    retryDelay: 1000,
    // Smart update strategy - only trigger re-render if data actually changed
    structuralSharing: true,
  });

  // Fetch seat requests with smart refresh
  const { data: seatRequests, isLoading: requestsLoading } = useQuery<SeatRequest[]>({
    queryKey: ['/api/seat-requests', user?.id],
    enabled: !!user?.id,
    refetchInterval: 5000, // Background refresh every 5 seconds
    refetchOnWindowFocus: true,
    staleTime: 3000, // Consider data fresh for 3 seconds
    gcTime: 10000, // Keep cached for 10 seconds
    structuralSharing: true, // Only re-render if data structure changed
  });

  // Fetch active seated sessions with smart refresh
  const { data: seatedSessions, isLoading: seatedLoading } = useQuery({
    queryKey: ['/api/table-seats', user?.id],
    enabled: !!user?.id,
    refetchInterval: 8000, // Check every 8 seconds for active sessions
    refetchOnWindowFocus: true,
    staleTime: 5000, // Consider fresh for 5 seconds
    gcTime: 15000, // Keep cached for 15 seconds
    structuralSharing: true,
  });

  // Check table status with intelligent refresh
  const { data: tableStatuses } = useQuery({
    queryKey: ['/api/table-statuses', seatRequests?.map(req => req.tableId)],
    queryFn: async () => {
      if (!seatRequests || seatRequests.length === 0) return {};

      const statusPromises = seatRequests.map(async (req: any) => {
        try {
          const response = await fetch(`/api/table-status/${req.tableId}`);
          if (response.ok) {
            const status = await response.json();
            return { [req.tableId]: status };
          }
        } catch (error) {
          console.warn(`Failed to fetch status for table ${req.tableId}`);
        }
        return { [req.tableId]: null };
      });

      const statusResults = await Promise.all(statusPromises);
      return statusResults.reduce((acc, curr) => ({ ...acc, ...curr }), {});
    },
    enabled: !!seatRequests && seatRequests.length > 0,
    refetchInterval: 10000, // Check every 10 seconds - less aggressive
    staleTime: 8000, // Consider fresh for 8 seconds
    gcTime: 20000, // Keep cached for 20 seconds
    structuralSharing: true, // Only update if actual changes detected
  });

  // Find current active session for playtime tracking
  const currentActiveSession = seatRequests?.find(req => 
    req.status === 'active' && req.sessionStartTime
  );

  // Fetch tournaments from staff portal
  const { data: tournaments, isLoading: tournamentsLoading } = useQuery({
    queryKey: ['/api/tournaments'],
    refetchInterval: 5000, // Refresh every 5 seconds
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  // Fetch dual balance system data with smart refresh
  const { data: accountBalance, isLoading: balanceLoading } = useQuery({
    queryKey: ['/api/balance', user?.id],
    enabled: !!user?.id,
    refetchInterval: 15000, // Refresh every 15 seconds - balance changes are less frequent
    refetchOnWindowFocus: true,
    staleTime: 10000, // Consider fresh for 10 seconds
    gcTime: 30000, // Keep cached for 30 seconds
    structuralSharing: true, // Only update UI if balance actually changed
  });

  // Tournament Interest Handler - sends to GRE
  const handleTournamentInterest = async (tournamentId: string) => {
    if (!user?.id) return;

    setTournamentActionLoading(true);
    try {
      const response = await apiRequest("POST", "/api/unified-chat/send", {
        playerId: user.id,
        playerName: `${user.firstName} ${user.lastName}`,
        message: `Player is interested in Tournament ID: ${tournamentId}`,
        senderType: 'player'
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
        variant: "destructive",
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

  // Simple join waitlist - no seat selection required
  const joinWaitListMutation = useMutation({
    mutationFn: async (tableId: string) => {
      console.log('🎯 [SIMPLE JOIN] Joining waitlist for table:', tableId, 'player:', user?.id);
      const response = await apiRequest('POST', '/api/seat-requests', {
        playerId: user?.id,
        tableId: tableId,
        tableName: tables?.find((t: any) => t.id === tableId)?.name || 'Table',
        seatNumber: 1 // Default seat preference
      });
      return response.json();
    },
    onSuccess: () => {
      console.log('✅ [SIMPLE JOIN] Success!');
      queryClient.invalidateQueries({ queryKey: ['/api/seat-requests'] });
      toast({
        title: "Joined Waitlist",
        description: "You've been added to the waitlist successfully",
      });
    },
    onError: (error: any) => {
      console.error('❌ [SIMPLE JOIN] Error:', error);
      toast({
        title: "Failed to Join",
        description: error.message || "Could not join waitlist",
        variant: "destructive",
      });
    },
  });

  // Leave wait-list mutation
  const leaveWaitListMutation = useMutation({
    mutationFn: async (tableId: string) => {
      console.log(`🚪 [LEAVE WAITLIST] Attempting to leave waitlist for table: ${tableId}`);

      const response = await apiRequest('DELETE', `/api/seat-requests/${user?.id}/${tableId}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [LEAVE WAITLIST] API Error response:`, errorText);

        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || `HTTP ${response.status}` };
        }

        throw new Error(errorData.error || errorData.message || `Server Error: ${response.status}`);
      }

      const result = await response.json();
      console.log(`✅ [LEAVE WAITLIST] Success:`, result);
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/seat-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tables'] });
      toast({
        title: "Left Wait-List",
        description: data.message || "You've been removed from the table wait-list",
      });
    },
    onError: (error: any) => {
      console.error('❌ [LEAVE WAITLIST] Mutation error:', error);
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
              fileData: dataUrl,
              fileSize: file.size,
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
  const isTableJoined = (tableId: string) => {
    return seatRequests?.some(req => req.tableId === tableId);
  };

  const getWaitListPosition = (tableId: string) => {
    const request = seatRequests?.find(req => req.tableId === tableId);
    return request?.position || 0;
  };

  const handleJoinWaitList = (tableId: string) => {
    console.log('🎯 [HANDLE JOIN] Navigating to table view for seat selection:', tableId);
    // Navigate to table view first, then seat selection will complete the join
    setLocation(`/table/${tableId}`);
  };

  // Simplified direct join functionality - no seat selection dialog

  const handleLeaveWaitList = (tableId: string) => {
    leaveWaitListMutation.mutate(tableId);
  };

  // Removed cleanup and leave all mutations as requested

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

  // Fetch push notifications with smart background refresh
  const { data: notifications, isLoading: notificationsLoading } = useQuery({
    queryKey: [`/api/push-notifications/${user?.id}`],
    enabled: !!user?.id,
    refetchInterval: 30000, // Check every 30 seconds - notifications are handled via push system
    refetchOnWindowFocus: true,
    staleTime: 20000, // Consider fresh for 20 seconds
    gcTime: 60000, // Keep cached for 1 minute
    structuralSharing: true, // Only update if new notifications
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
        variant: "destructive",
      });
    } finally {
      setSendingFeedback(false);
    }
  };

  // GRE Chat functionality - Now using WebSocket for real-time chat
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

    // 🚨 ENTERPRISE-GRADE FRONTEND DEBUG LOGGING - PRODUCTION DATA VALIDATION
    console.log('🛑 FRONTEND DEBUG: === PLAYER MESSAGE SEND START ===');
    console.log('🔍 FRONTEND DEBUG: Sending player message | Details:', {
      playerId: user.id,
      playerName: `${user.firstName} ${user.lastName}`,
      messageText: chatMessage.trim(),
      senderType: 'player',
      timestamp: new Date().toISOString(),
      websocketConnected: wsConnected,
      validation: 'PRODUCTION_USER_CONTEXT_ONLY'
    });

    // PRODUCTION DATA VALIDATION - NO MOCK/TEST DATA ALLOWED
    if (!user.id || typeof user.id === 'string' || chatMessage.includes('test') || chatMessage.includes('demo')) {
      console.error('❌ FRONTEND DEBUG: INVALID USER MESSAGE CONTEXT - Mock/test data detected');
      toast({
        title: "Error",
        description: "Invalid message context - only production data allowed",
        variant: "destructive"
      });
      setSendingChatMessage(false);
      return;
    }

    // Try WebSocket first for real-time chat
    if (wsConnection && wsConnected) {
      try {
        console.log('🔍 FRONTEND DEBUG: WebSocket message transmission | Details:', {
          connectionState: wsConnection.readyState,
          expectedState: WebSocket.OPEN,
          messageLength: chatMessage.trim().length,
          validation: 'PRODUCTION_WEBSOCKET_SEND'
        });

        // Create the message object for immediate display
        const newMessage = {
          id: Date.now().toString(),
          player_id: user.id,
          message: chatMessage.trim(),
          sender_type: 'player',
          timestamp: new Date().toISOString(),
          is_read: false
        };

        // Add to local state immediately for instant display (optimistic UI update)
        console.log('🔍 FRONTEND DEBUG: Adding optimistic message | Details:', {
          messageId: newMessage.id,
          playerId: newMessage.player_id,
          messagePreview: newMessage.message.substring(0, 50) + '...',
          validation: 'PRODUCTION_OPTIMISTIC_UPDATE'
        });
        setUnifiedChatMessages(prev => [...prev, newMessage]);

        // EXACT Staff Portal message format - PRODUCTION DATA ONLY
        const websocketPayload = {
          type: 'player_message',              // EXACT string expected by Staff Portal
          playerId: user.id,                   // Integer from database
          playerName: `${user.firstName} ${user.lastName}`, // Player's full name
          playerEmail: user.email,             // Valid email address
          message: chatMessage.trim(),         // The actual message content
          messageText: chatMessage.trim(),     // Duplicate for compatibility
          timestamp: new Date().toISOString()  // ISO timestamp string
        };

        console.log('🔍 FRONTEND DEBUG: WebSocket payload transmission | Details:', {
          payloadType: websocketPayload.type,
          playerId: websocketPayload.playerId,
          playerName: websocketPayload.playerName,
          messageLength: websocketPayload.message.length,
          validation: 'PRODUCTION_WEBSOCKET_PAYLOAD'
        });

        wsConnection.send(JSON.stringify(websocketPayload));

        console.log('✅ FRONTEND DEBUG: WebSocket message sent successfully | Details:', {
          messageLength: chatMessage.trim().length,
          playerId: user.id,
          timestamp: new Date().toISOString(),
          validation: 'PRODUCTION_WEBSOCKET_SUCCESS'
        });

        toast({
          title: "Message Sent",
          description: "Your message has been sent to our team via real-time chat",
        });
        setChatMessage("");
        setSendingChatMessage(false);
        console.log('🛑 FRONTEND DEBUG: === PLAYER MESSAGE SEND END (WEBSOCKET SUCCESS) ===');
        return;
      } catch (error: any) {
        console.error('❌ FRONTEND DEBUG: WebSocket transmission failed | Details:', {
          error: error.message,
          connectionState: wsConnection?.readyState,
          validation: 'WEBSOCKET_FALLBACK_TRIGGERED'
        });
        console.error('📤 Falling back to REST API for message delivery');
      }
    }

    // Fallback to REST API if WebSocket is not available
    try {
      console.log('🔍 FRONTEND DEBUG: REST API fallback initiated | Details:', {
        reason: wsConnection ? 'WebSocket send failed' : 'WebSocket not connected',
        playerId: user.id,
        messageLength: chatMessage.trim().length,
        validation: 'PRODUCTION_REST_FALLBACK'
      });

      // Create the message object for immediate display
      const newMessage = {
        id: Date.now().toString(),
        player_id: user.id,
        message: chatMessage.trim(),
        sender_type: 'player',
        timestamp: new Date().toISOString(),
        is_read: false
      };

      // Add to local state immediately for instant display
      setUnifiedChatMessages(prev => [...prev, newMessage]);

      const response = await apiRequest("POST", "/api/unified-chat/send", {
        playerId: user.id,
        playerName: `${user.firstName} ${user.lastName}`,
        message: chatMessage.trim(),
        senderType: 'player'
      });

      const result = await response.json();
      if (response.ok) {
        console.log('✅ FRONTEND DEBUG: REST API message sent successfully | Details:', {
          responseStatus: response.status,
          messageId: result.message?.id,
          playerId: user.id,
          validation: 'PRODUCTION_REST_SUCCESS'
        });

        toast({
          title: "Message Sent",
          description: "Your message has been sent to our team",
        });
        setChatMessage("");
        console.log('🛑 FRONTEND DEBUG: === PLAYER MESSAGE SEND END (REST SUCCESS) ===');
        // Message successfully sent - no need for REST API refresh since WebSocket handles real-time updates
      } else {
        console.error('❌ FRONTEND DEBUG: REST API message send failed | Details:', {
          responseStatus: response.status,
          errorMessage: result.error,
          validation: 'PRODUCTION_REST_FAILURE'
        });
        // Remove the message from local state if sending failed
        setUnifiedChatMessages(prev => prev.filter(msg => msg.id !== newMessage.id));
        throw new Error(result.error || "Failed to send message");
      }
    } catch (error: any) {
      console.error('❌ FRONTEND DEBUG: REST API request failed | Details:', {
        error: error.message,
        validation: 'REST_REQUEST_FAILURE'
      });
      toast({
        title: "Error",
        description: error.message || "Failed to send message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSendingChatMessage(false);
      console.log('🛑 FRONTEND DEBUG: === PLAYER MESSAGE SEND END (WITH ERRORS) ===');
    }
  };

  // UNIFIED CHAT MESSAGE MANAGEMENT - Single source of truth

  const [chatLoading, setChatLoading] = useState(false);

  // WebSocket connection for real-time GRE chat
  const [wsConnection, setWsConnection] = useState<WebSocket | null>(null);
  const [wsConnected, setWsConnected] = useState(false);


  // Initialize WebSocket connection for real-time chat
  useEffect(() => {
    if (user?.id && !wsConnection) {
      setChatLoading(true);
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/chat-ws`;

      console.log('🔗 [WEBSOCKET] Connecting to:', wsUrl);
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('✅ [WEBSOCKET] Connected successfully');
        setWsConnected(true);

        // Staff Portal authentication format
        ws.send(JSON.stringify({
          type: 'authenticate',
          playerId: user.id,
          playerName: `${user.firstName} ${user.lastName}`,
          playerEmail: user.email
        }));

        // Request chat history
        ws.send(JSON.stringify({
          type: 'get_messages',
          playerId: user.id
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // 🛑 CRITICAL DEBUG: COMPLETE MESSAGE PAYLOAD LOGGING
          console.log('🛑 CRITICAL DEBUG === WEBSOCKET RECEIVE START ===');
          console.log('RECV RAW PAYLOAD:', JSON.stringify(data, null, 2));
          console.log('RECV PAYLOAD KEYS:', Object.keys(data));
          console.log('RECV PAYLOAD TYPES:', Object.entries(data).map(([k,v]) => `${k}: ${typeof v}`));

          if (data.type === 'authenticated') {
            console.log('🔐 [WEBSOCKET] Authentication successful');
          }

          if (data.type === 'chat_history') {
            console.log('📋 [WEBSOCKET] Chat history received:', data.messages.length, 'messages');

            // 🛑 GOD-LEVEL DEBUG: COMPLETE CHAT HISTORY ANALYSIS
            console.log('🛑 GOD-LEVEL DEBUG === CHAT HISTORY PROCESSING ===');
            console.log('INCOMING MESSAGES FROM WS/DB:', JSON.stringify(data.messages, null, 2));
            console.log('CURRENT FILTER VARS:', {
              currentUserId: user.id,
              currentUserIdType: typeof user.id,
              totalMessages: data.messages?.length || 0
            });

            // Analyze each message for filtering compatibility
            data.messages?.forEach((msg: any, index: number) => {
              console.log(`MESSAGE ${index + 1} ANALYSIS:`, {
                messageKeys: Object.keys(msg),
                playerId: msg.player_id,
                playerIdType: typeof msg.player_id,
                sessionId: msg.session_id,
                sender: msg.sender,
                messagePreview: msg.message?.substring(0, 30) + '...',
                willBeFiltered: msg.player_id !== user.id ? 'YES - DROPPED' : 'NO - INCLUDED',
                filterReason: msg.player_id !== user.id ? `${msg.player_id} !== ${user.id}` : 'ID MATCH'
              });
            });

            // Set unified messages - single source of truth
            setUnifiedChatMessages(data.messages || []);
            setChatLoading(false);

            console.log('✅ GOD-LEVEL DEBUG: Chat history state updated with', data.messages?.length || 0, 'messages');
          }

          // 🛑 CRITICAL: GRE MESSAGE PROCESSING WITH COMPLETE DEBUG
          if (data.type === 'gre_message') {
            console.log('🛑 CRITICAL DEBUG: GRE MESSAGE PROCESSING');
            console.log('GRE RECV - Original Keys:', Object.keys(data));
            console.log('GRE RECV - playerId variants:', {
              playerId: data.playerId,
              player_id: data.player_id,
              playerIdType: typeof data.playerId,
              player_idType: typeof data.player_id
            });
            console.log('GRE RECV - Current User ID:', user.id, typeof user.id);

            // CRITICAL: COMPREHENSIVE ID STANDARDIZATION
            const normalizedPlayerId = parseInt(data.playerId) || parseInt(data.player_id) || parseInt(data.targetPlayerId) || user.id;
            const messageMatch = normalizedPlayerId === user.id;

            console.log('GRE RECV - ID VALIDATION:', {
              normalizedPlayerId,
              currentUserId: user.id,
              messageMatch,
              shouldDisplay: messageMatch
            });

            if (messageMatch) {
              const normalizedGreMessage = {
                id: data.messageId || data.id || Date.now().toString(),
                player_id: normalizedPlayerId,
                session_id: data.sessionId || data.session_id,
                message: data.message || data.content || data.messageText,
                sender: 'gre',
                sender_name: data.greStaffName || data.gre_staff_name || data.sender_name || 'GRE Staff',
                timestamp: data.timestamp || new Date().toISOString(),
                status: 'sent'
              };

              console.log('✅ GRE RECV - ADDING TO UI:', normalizedGreMessage);
              setUnifiedChatMessages(prev => {
                const updated = [...prev, normalizedGreMessage];
                console.log('✅ GRE RECV - UI STATE UPDATED:', updated.length, 'total messages');
                return updated;
              });
            } else {
              console.warn('❌ GRE RECV - MESSAGE REJECTED - ID MISMATCH:', {
                receivedId: normalizedPlayerId,
                expectedId: user.id,
                reason: 'PLAYER_ID_MISMATCH'
              });
            }
          }

          if (data.type === 'new_message') {
            console.log('🔍 FRONTEND DEBUG: New message received | Raw payload:', data);

            // STANDARDIZED MESSAGE TRANSFORMATION
            const normalizedMessage = {
              id: data.message?.id || data.id || Date.now().toString(),
              player_id: parseInt(data.message?.player_id) || parseInt(data.playerId) || user.id,
              session_id: data.message?.session_id || data.sessionId,
              message: data.message?.message || data.content,
              sender: data.message?.sender || data.sender,
              sender_name: data.message?.sender_name || data.senderName,
              timestamp: data.message?.timestamp || data.timestamp,
              status: data.message?.status || 'sent'
            };

            console.log('🔍 FRONTEND DEBUG: Normalized new message | Details:', {
              originalPlayerId: data.message?.player_id || data.playerId,
              normalizedPlayerId: normalizedMessage.player_id,
              currentUserId: user.id,
              validation: 'UNIFIED_ID_MAPPING_APPLIED'
            });

            // PRODUCTION DATA VALIDATION - Only add if IDs match exactly
            if (normalizedMessage.player_id === user.id) {
              setUnifiedChatMessages(prev => [...prev, normalizedMessage]);
              console.log('✅ FRONTEND DEBUG: New message added to UI | PlayerId match confirmed');
            } else {
              console.warn('❌ FRONTEND DEBUG: New message rejected - PlayerId mismatch:', {
                receivedPlayerId: normalizedMessage.player_id,
                expectedPlayerId: user.id,
                validation: 'ID_MISMATCH_BLOCKED'
              });
            }
            // Real-time message added via WebSocket - no REST API refresh needed
          }

          if (data.type === 'session_started') {
            console.log('✅ [WEBSOCKET] Chat session started with GRE:', data.data?.greStaffName);
            toast({
              title: "Chat Connected",
              description: `Connected with ${data.data?.greStaffName || 'Support Staff'}`,
            });
          }

          if (data.type === 'session_closed') {
            console.log('🔒 [WEBSOCKET] Chat session closed by GRE:', data.reason);
            toast({
              title: "Chat Session Ended",
              description: data.reason || "Chat session has been closed by support staff",
            });
          }

          if (data.type === 'acknowledgment') {
            console.log('✅ [WEBSOCKET] Message delivery confirmed');
          }

          if (data.type === 'message_sent') {
            console.log('✅ [WEBSOCKET] Message sent confirmation');
            // Add the sent message to local state immediately for instant display
            if (data.message) {
              setUnifiedChatMessages(prev => [...prev, data.message]);
            }
            // Also refresh chat history
            ws.send(JSON.stringify({
              type: 'get_messages',
              playerId: user.id
            }));
            // Refresh REST API data for consistency
            queryClient.invalidateQueries({ queryKey: [`/api/gre-chat/messages/${user.id}`] });
          }

          if (data.type === 'chat_closed') {
            console.log('🔒 [WEBSOCKET] Chat session closed by GRE');
            // Show confirmation dialog
            if (confirm('GRE staff has closed this chat session. Would you like to clear the chat history?')) {
              setUnifiedChatMessages([]);
              setChatMessage("");
              toast({
                title: "Chat Closed",
                description: "Chat session has been closed and cleared.",
              });
            }
          }

        } catch (error) {
          console.error('❌ [WEBSOCKET] Error parsing message:', error);
        }
      };

      ws.onclose = () => {
        console.log('🔌 [WEBSOCKET] Connection closed');
        setWsConnected(false);
        setWsConnection(null);
      };

      ws.onerror = (error) => {
        console.error('❌ [WEBSOCKET] Connection error:', error);
        setWsConnected(false);
      };

      setWsConnection(ws);
    }

    // Cleanup WebSocket on unmount
    return () => {
      if (wsConnection) {
        wsConnection.close();
      }
    };
  }, [user?.id]);

  // Debug: Log unified messages to console
  useEffect(() => {
    // Chat integration complete - using PlayerChatSystem component
  }, []);

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
      playerId: Number(user?.id),
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
      playerId: Number(user.id),
      rewardType,
      pointsCost
    });
  };

  // PAN Card management
  const [panCardNumber, setPanCardNumber] = useState("");
  const [showTransactions, setShowTransactions] = useState<'last10' | 'all' | null>(null);

  // Transaction color helpers
  const getTransactionAmountColor = (type: string) => {
    switch (type) {
      case 'add_credit': return 'text-blue-400'; // Blue for add credit
      case 'clear_credit': return 'text-orange-400'; // Orange for clear credit
      case 'cash_in':
      case 'table_cash_out': 
      case 'funds_added': return 'text-emerald-400'; // Green for cash in/funds added
      case 'cash_out':
      case 'cashier_withdrawal':
      case 'table_buy_in': return 'text-red-400'; // Red for cash out/withdrawals
      default: return 'text-slate-400';
    }
  };

  const getTransactionAmountPrefix = (type: string) => {
    switch (type) {
      case 'add_credit': return '+'; // Positive for add credit
      case 'clear_credit': return '-'; // Negative for clear credit
      case 'cash_in':
      case 'table_cash_out':
      case 'funds_added': return '+'; // Positive for funds added
      case 'cash_out':
      case 'cashier_withdrawal':
      case 'table_buy_in': return '-'; // Negative for withdrawals
      default: return '';
    }
  };

  // Seat selection state for waitlist
  const [showSeatDialog, setShowSeatDialog] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [selectedTableName, setSelectedTableName] = useState<string | null>(null);
  const [selectedSeatNumber, setSelectedSeatNumber] = useState<number | null>(null);

  // PAN Card validation function (matching KYC workflow)
  const isValidPAN = (pan: string): boolean => {
    const panRegex = /^[A-Z]{3}[ABCFGHLJPTF][A-Z][0-9]{4}[A-Z]$/;
    return panRegex.test(pan);
  };

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
    queryKey: ['transactions', user?.id, showTransactions], // Added showTransactions to query key
    queryFn: async () => {
      if (!user?.id) return [];

      const limit = showTransactions === 'all' ? 100 : 10; // Fetch 100 if 'all', otherwise 10
      const response = await fetch(`/api/player/${user.id}/transactions?limit=${limit}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch transactions');
      }

      return response.json();
    },
    enabled: !!user?.id && !!showTransactions, // Enable query only if user and showTransactions are set
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

    // Validate PAN card format using the new function
    if (!isValidPAN(panCardNumber)) {
      toast({
        title: "Invalid PAN Card Format",
        description: "Please enter a valid PAN card number",
        variant: "destructive",
      });
      return;
    }

    updatePanCardMutation.mutate({
      playerId: Number(user.id),
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

  // Format document types for display
  const formatDocumentType = (type: string) => {
    const typeMap: Record<string, string> = {
      'government_id': 'Government ID',
      'id_document': 'Government ID', 
      'address_proof': 'Address Proof',
      'utility_bill': 'Address Proof',
      'pan_card': 'PAN Card',
      'profile_photo': 'Profile Photo',
      'photo': 'Profile Photo'
    };
    return typeMap[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  function formatSubmissionDate(dateString: string) {
    if (!dateString) return 'No date available';

    try {
      const date = new Date(dateString);

      // Check if the date is valid
      if (isNaN(date.getTime())) {
        return 'No date available';
      }

      // Format as "Aug 30, 2025 at 6:39 AM"
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }) + ' at ' + date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      return 'No date available';
    }
  }

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

  // Authentication is handled at App level, no need for additional loading screen here
  // This was causing the persistent "Loading your dashboard..." screen after video completion
  console.log('🎯 [PLAYER DASHBOARD] Rendering with user:', !!user, user?.email);

  // Safety guard - if no user, return nothing and let App.tsx handle routing
  if (!user) {
    console.log('🎯 [PLAYER DASHBOARD] No user prop - returning null to let App handle routing');
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-900 w-full overflow-x-hidden">
      {/* Email Verification Banner */}
      {showEmailVerificationBanner && user?.email && !(user as any)?.emailVerified && (
        <div className="bg-amber-600 border-b border-amber-500 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2 text-white" />
              <span className="text-white font-medium">
                Please verify your email address. Check your inbox for the verification link.
              </span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="text-white hover:bg-amber-700"
              onClick={() => setShowEmailVerificationBanner(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Push Notification Popup System */}
      <NotificationPopup 
        userId={Number(user.id)} 
        onChatNotificationClick={() => setChatDialogOpen(true)}
      />

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
              value="offers" 
              className="flex-1 px-2 sm:px-3 lg:px-4 py-2 text-xs sm:text-sm font-medium rounded-md data-[state=active]:bg-emerald-600 data-[state=active]:text-white hover:bg-slate-700 transition-colors text-slate-300 flex items-center justify-center min-w-0"
            >
              <Gift className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
            </TabsTrigger>
            <TabsTrigger 
              value="food" 
              className="flex-1 px-2 sm:px-3 lg:px-4 py-2 text-xs sm:text-sm font-medium rounded-md data-[state=active]:bg-emerald-600 data-[state=active]:text-white hover:bg-slate-700 transition-colors text-slate-300 flex items-center justify-center min-w-0"
            >
              <Coffee className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
            </TabsTrigger>
            <TabsTrigger 
              value="session" 
              className="flex-1 px-2 sm:px-3 lg:px-4 py-2 text-xs sm:text-sm font-medium rounded-md data-[state=active]:bg-emerald-600 data-[state=active]:text-white hover:bg-slate-700 transition-colors text-slate-300 flex items-center justify-center min-w-0"
            >
              <Clock className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
            </TabsTrigger>
            <TabsTrigger 
              value="balance" 
              className="flex-1 px-2 sm:px-3 lg:px-4 py-2 text-xs sm:text-sm font-medium rounded-md data-[state=active]:bg-emerald-600 data-[state=active]:text-white hover:bg-slate-700 transition-colors text-slate-300 flex items-center justify-center min-w-0"
            >
              <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
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
            <TabsTrigger 
              value="notifications" 
              className="flex-1 px-2 sm:px-3 lg:px-4 py-2 text-xs sm:text-sm font-medium rounded-md data-[state=active]:bg-emerald-600 data-[state=active]:text-white hover:bg-slate-700 transition-colors text-slate-300 flex items-center justify-center min-w-0 relative overflow-visible"
            >
              <div className="relative flex items-center justify-center">
                <Bell className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
                {notifications && Array.isArray(notifications) && notifications.length > 0 ? (
                  <span className="absolute -top-2 -right-2 min-w-[16px] h-4 bg-red-500 rounded-full text-white font-bold flex items-center justify-center px-1" style={{ fontSize: '0.6rem', lineHeight: '1' }}>
                    {notifications.length > 99 ? '99+' : notifications.length}
                  </span>
                ) : null}
              </div>
            </TabsTrigger>

          </TabsList>

          {/* Tab Content Areas */}
          <div className="w-full max-w-full overflow-hidden">

            {/* Game Tab */}
            <TabsContent value="game" className="space-y-3 sm:space-y-4 w-full max-w-full">
              {/* Active Table Sessions - Show where player is currently seated */}
              {seatedSessions && Array.isArray(seatedSessions) && seatedSessions.length > 0 && (
                <Card className="bg-gradient-to-r from-emerald-800 to-emerald-900 border-emerald-500 w-full max-w-full">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-white flex items-center justify-center text-lg">
                      <Play className="w-5 h-5 mr-2 text-emerald-400" />
                      🪑 You Are Seated!
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {seatedSessions.map((session: any) => (
                        <div key={session.id} className="bg-emerald-700/30 p-4 rounded-lg border border-emerald-500/30">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h3 className="font-semibold text-white text-lg">{session.tableName}</h3>
                              <p className="text-emerald-200">{session.gameType}</p>
                              <p className="text-emerald-300 text-sm">Seat {session.seatNumber}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-emerald-200">Session Started</p>
                              <p className="text-sm font-medium text-white">
                                {session.sessionStartTime ? 
                                  new Date(session.sessionStartTime).toLocaleTimeString() : 
                                  'Just now'
                                }
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4 mb-3">
                            <div className="text-center bg-emerald-800/50 rounded-lg p-3">
                              <p className="text-xs text-emerald-200">Buy-in</p>
                              <p className="text-lg font-semibold text-emerald-300">
                                ₹{parseFloat(session.sessionBuyIn || '0').toLocaleString()}
                              </p>
                            </div>
                            <div className="text-center bg-emerald-800/50 rounded-lg p-3">
                              <p className="text-xs text-emerald-200">Stakes</p>
                              <p className="text-lg font-semibold text-emerald-300">
                                ₹{session.minBuyIn?.toLocaleString()}/{session.maxBuyIn?.toLocaleString()}
                              </p>
                            </div>
                          </div>

                          <div className="flex justify-center">
                            <Button
                              onClick={() => setLocation(`/table/${session.tableId}`)}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              View Table
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Staff-Managed Offer Carousel */}
              <OfferCarousel onOfferClick={(offerId) => {
                console.log('🎯 [OFFER CLICK] Navigating to offer detail:', offerId);
                // Navigate directly to offer detail page
                window.location.href = `/offer/${offerId}`;
              }} />

              <div className="w-full max-w-full space-y-3 sm:space-y-4">
                {/* Toggle State for Cash Tables vs Tournaments - Improved Alignment */}
                <div className="flex items-center justify-center space-x-2 mb-6 bg-slate-800/50 rounded-xl p-1 max-w-md mx-auto">
                  <button
                    onClick={() => setShowTournaments(false)}
                    className={`flex-1 flex items-center justify-center px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                      !showTournaments 
                        ? 'bg-emerald-600 text-white shadow-lg transform scale-105' 
                        : 'bg-transparent text-slate-300 hover:bg-slate-700/50'
                    }`}
                  >
                    <Table className="w-4 h-4 mr-2 flex-shrink-0" />
                    <span className="hidden sm:inline">Cash Tables</span>
                    <span className="sm:hidden">Cash</span>
                  </button>
                  <button
                    onClick={() => setShowTournaments(true)}
                    className={`flex-1 flex items-center justify-center px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                      showTournaments 
                        ? 'bg-emerald-600 text-white shadow-lg transform scale-105' 
                        : 'bg-transparent text-slate-300 hover:bg-slate-700/50'
                    }`}
                  >
                    <Trophy className="w-4 h-4 mr-2 flex-shrink-0" />
                    <span className="hidden sm:inline">Tournaments</span>
                    <span className="sm:hidden">Tourneys</span>
                  </button>
                </div>

                {/* Removed waitlist management controls as requested */}

                {/* Cash Tables Display - Improved Layout */}
                {!showTournaments && (
                  <Card className="bg-slate-800/80 border-slate-700/50 w-full max-w-full overflow-hidden backdrop-blur-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-white flex items-center justify-center text-lg">
                        <Table className="w-5 h-5 mr-2 text-emerald-500" />
                        Live Cash Tables
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
                      {tables && tables.map((table) => (
                        <div
                          key={table.id}
                          className="bg-slate-700 p-4 rounded-lg"
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h3 className="font-semibold text-white">{table.name}</h3>
                              <p className="text-sm text-slate-400">{table.gameType}</p>
                              {/* Game Status Indicator */}
                              <div className="flex items-center space-x-2 mt-1">
                                <div className={`w-2 h-2 rounded-full ${
                                  table.gameStarted ? 'bg-red-500' : 'bg-green-500'
                                }`}></div>
                                <span className={`text-xs ${
                                  table.gameStarted ? 'text-red-400' : 'text-green-400'
                                }`}>
                                  {table.gameStarted ? 'Game In Progress' : 'Accepting Players'}
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-slate-400">Stakes</p>
                              <p className="text-lg font-semibold text-emerald-500">
                                {table.stakes}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-4 mb-3">
                            <div className="text-center">
                              <Users className="w-4 h-4 text-slate-400 mx-auto mb-1" />
                              <p className="text-xs text-slate-400">Players</p>
                              <p className="text-sm font-semibold text-white">
                                {table.currentPlayers || 0}/{table.maxPlayers || 9}
                              </p>
                            </div>
                            {/* Average Stack element hidden as requested */}
                          </div>

                          <div className="flex justify-between items-center">
                            <div className="flex items-center space-x-2">
                              {isTableJoined(String(table.id)) ? (
                                <>
                                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                                    Joined
                                  </Badge>
                                  <span className="text-sm text-slate-400">
                                    Position: {getWaitListPosition(String(table.id))}
                                  </span>
                                  {/* Show game status for waitlisted players */}
                                  {tableStatuses?.[String(table.id)] && (
                                    <div className="flex items-center space-x-1">
                                      {tableStatuses[String(table.id)].gameStarted ? (
                                        <span className="text-xs text-amber-400">⚠️ Game started</span>
                                      ) : (
                                        <span className="text-xs text-green-400">✅ Can join now</span>
                                      )}
                                    </div>
                                  )}
                                  <Button
                                    onClick={() => handleLeaveWaitList(String(table.id))}
                                    disabled={leaveWaitListMutation.isPending}
                                    size="sm"
                                    variant="outline"
                                    className="bg-gradient-to-r from-slate-600/30 to-slate-500/30 border border-slate-400/50 text-slate-300 hover:from-slate-500/40 hover:to-slate-400/40 hover:border-slate-300 hover:text-slate-200 transition-all duration-300 shadow-lg hover:shadow-slate-500/25 backdrop-blur-sm"
                                  >
                                    {leaveWaitListMutation.isPending ? (
                                      <div className="w-4 h-4 border-2 border-slate-300 border-t-transparent rounded-full animate-spin mr-2" />
                                    ) : null}
                                    Leave
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  onClick={() => handleJoinWaitList(String(table.id))}
                                  disabled={joinWaitListMutation.isPending}
                                  size="sm"
                                  className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white shadow-lg hover:shadow-emerald-500/25 transition-all duration-300 border border-emerald-500/30 backdrop-blur-sm"
                                >
                                  {joinWaitListMutation.isPending ? (
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                                  ) : (
                                    <Plus className="w-4 h-4 mr-2" />
                                  )}
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
                                className="bg-gradient-to-r from-emerald-600/20 to-emerald-500/20 border border-emerald-500/50 text-emerald-300 hover:from-emerald-500/30 hover:to-emerald-400/30 hover:border-emerald-400 hover:text-emerald-200 transition-all duration-300 shadow-lg hover:shadow-emerald-500/25 backdrop-blur-sm"
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                View
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}

                      {(!(tables as any) || (tables as any)?.length === 0) && (
                        <div className="text-center py-8">
                          <Table className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                          <p className="text-slate-400">No tables available</p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
                  </Card>
                )}

                {/* Tournaments Display - Improved Layout */}
                {showTournaments && (
                  <Card className="bg-slate-800/80 border-slate-700/50 w-full max-w-full overflow-hidden backdrop-blur-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-white flex items-center justify-center text-lg">
                        <Trophy className="w-5 h-5 mr-2 text-yellow-500" />
                        Active Tournaments
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
                            {(tournaments as any)?.map((tournament: any) => (
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
                                      {tournament.status ? tournament.status.charAt(0).toUpperCase() + tournament.status.slice(1) : 'Unknown'}
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

                            {(!(tournaments as any) || (tournaments as any)?.length === 0) && (
                              <div className="text-center py-8">
                                <Trophy className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                                <p className="text-slate-400">No tournaments available</p>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                )}

                {/* Preferences section removed as per requirements */}
              </div>
            </TabsContent>

          {/* Offers Tab - Staff Managed */}
          <TabsContent value="offers" className="space-y-4">
            <ScrollableOffersDisplay />
          </TabsContent>

          {/* Food & Beverage Tab */}
          <TabsContent value="food" className="space-y-4">
            <FoodBeverageTab user={user} />
          </TabsContent>

          {/* Session Tab - Advanced Playtime Tracking */}
          <TabsContent value="session" className="space-y-4">
            <div className="max-w-4xl mx-auto">
              <PlaytimeTracker 
                playerId={user?.id?.toString() || ''} 
              />
            </div>
          </TabsContent>

          {/* Balance Tab - Simplified Cash Balance System */}
          <TabsContent value="balance" className="space-y-4">
            {/* Simplified Balance Display - Single Cash Balance Only */}
            <div className="space-y-6">
              {/* Main Balance Card */}
              <div className="max-w-2xl mx-auto">
                <PlayerBalanceDisplay playerId={user?.id?.toString() || ''} />
              </div>

              {/* Balance Display Only - All financial operations handled by cashier */}
              <div className="max-w-4xl mx-auto">
                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center">
                      <Info className="w-5 h-5 mr-2 text-blue-500" />
                      Financial Operations Notice
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center p-6 bg-blue-950/50 rounded-lg border border-blue-800">
                      <CreditCard className="w-12 h-12 mx-auto mb-4 text-blue-400" />
                      <h3 className="text-lg font-semibold text-white mb-2">Visit Cashier Counter</h3>
                      <p className="text-slate-300 mb-4">
                        All cash-out and credit operations are handled exclusively by our cashier team.
                      </p>
                      <div className="space-y-2 text-sm text-slate-400">
                        <p>• Cash withdrawals: Visit cashier with your player ID</p>
                        <p>• Credit transfers: Managed by cashier staff only</p>
                        <p>• Balance updates: Real-time after cashier transactions</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center">
                      <BarChart3 className="w-5 h-5 mr-2 text-emerald-500" />
                      Recent Transactions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-60 overflow-y-auto">
                      <PlayerTransactionHistory playerId={user?.id?.toString() || ''} limit={5} />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Cashier Workflow Information */}
              <Card className="bg-emerald-900/20 border border-emerald-500/30 max-w-3xl mx-auto">
                <CardContent className="p-6">
                  <div className="text-center">
                    <h3 className="text-emerald-300 font-semibold text-lg mb-4">Dual Balance System</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                      <div className="bg-slate-800/50 rounded-lg p-4">
                        <div className="text-emerald-400 font-medium mb-2">1. Load Cash/Credit</div>
                        <div className="text-slate-300">Cashier loads cash balance or approved credit</div>
                      </div>
                      <div className="bg-slate-800/50 rounded-lg p-4">
                        <div className="text-blue-400 font-medium mb-2">2. Transfer Credit</div>
                        <div className="text-slate-300">Move approved credit to available cash</div>
                      </div>
                      <div className="bg-slate-800/50 rounded-lg p-4">
                        <div className="text-emerald-400 font-medium mb-2">3. Play</div>
                        <div className="text-slate-300">Manager handles table operations</div>
                      </div>
                      <div className="bg-slate-800/50 rounded-lg p-4">
                        <div className="text-emerald-400 font-medium mb-2">4. Cash Out</div>
                        <div className="text-slate-300">Request withdrawal with cashier</div>
                      </div>
                    </div>
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
                            {Array.isArray(kycDocuments) && kycDocuments.filter(d => d.documentType === 'government_id' && d.fileUrl).length > 0 && (
                              <div className="flex items-center space-x-2 mt-1">
                                <p className="text-xs text-emerald-500">
                                  {Array.isArray(kycDocuments) ? kycDocuments.filter(d => d.documentType === 'government_id' && d.fileUrl)[0]?.fileName : ''}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-stretch space-y-2">
                          {/* View button positioned above other buttons */}
                          {Array.isArray(kycDocuments) && kycDocuments.filter(d => d.documentType === 'government_id' && d.fileUrl).length > 0 && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="text-xs border-slate-600 text-slate-400 hover:bg-slate-700 w-full"
                              onClick={() => {
                                const doc = Array.isArray(kycDocuments) ? kycDocuments.filter(d => d.documentType === 'government_id' && d.fileUrl)[0] : null;
                                if (doc && doc.fileUrl) {
                                  try {
                                    // Clear browser cache for this specific document and open in new tab
                                    const documentUrl = `/api/documents/view/${doc.id}?v=${Date.now()}`;
                                    console.log('Opening document:', documentUrl);

                                    const newTab = window.open('about:blank', '_blank');
                                    if (newTab) {
                                      newTab.location.href = documentUrl;
                                    } else {
                                      // Fallback if popup blocked
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
                            {(getKycDocumentStatus('id') !== 'approved' || (kycDocuments as any)?.filter((d: any) => d.documentType === 'government_id' && d.fileUrl).length === 0) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => document.getElementById('id-document-upload')?.click()}
                                disabled={uploadKycDocumentMutation.isPending}
                                className="border-slate-600 hover:bg-slate-600 w-full sm:w-auto"
                              >
                                <Upload className="w-4 h-4 mr-1" />
                                {(kycDocuments as any)?.filter((d: any) => d.documentType === 'government_id' && d.fileUrl).length > 0 ? 'Reupload' : 'Upload'}
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
                            {Array.isArray(kycDocuments) && kycDocuments.filter(d => d.documentType === 'utility_bill' && d.fileUrl).length > 0 && (
                              <div className="flex items-center space-x-2 mt-1">
                                <p className="text-xs text-emerald-500">
                                  {Array.isArray(kycDocuments) ? kycDocuments.filter(d => d.documentType === 'utility_bill' && d.fileUrl)[0]?.fileName : ''}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-stretch space-y-2">
                          {/* View button positioned above other buttons */}
                          {Array.isArray(kycDocuments) && kycDocuments.filter(d => d.documentType === 'utility_bill' && d.fileUrl).length > 0 && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="text-xs border-slate-600 text-slate-400 hover:bg-slate-700 w-full"
                              onClick={() => {
                                const doc = Array.isArray(kycDocuments) ? kycDocuments.filter(d => d.documentType === 'utility_bill' && d.fileUrl)[0] : null;
                                if (doc && doc.fileUrl) {
                                  try {
                                    // Clear browser cache for this specific document and open in new tab
                                    const documentUrl = `/api/documents/view/${doc.id}?v=${Date.now()}`;
                                    console.log('Opening document:', documentUrl);

                                    const newTab = window.open('about:blank', '_blank');
                                    if (newTab) {
                                      newTab.location.href = documentUrl;
                                    } else {
                                      // Fallback if popup blocked
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
                            {(getKycDocumentStatus('utility') !== 'approved' || (kycDocuments as any)?.filter((d: any) => d.documentType === 'utility_bill' && d.fileUrl).length === 0) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => document.getElementById('utility-document-upload')?.click()}
                                disabled={uploadKycDocumentMutation.isPending}
                                className="border-slate-600 hover:bg-slate-600 w-full sm:w-auto"
                              >
                                <Upload className="w-4 h-4 mr-1" />
                                {(kycDocuments as any)?.filter((d: any) => d.documentType === 'utility_bill' && d.fileUrl).length > 0 ? 'Reupload' : 'Upload'}
                              </Button>
                            )}

                            {/* Show request change button if approved */}
                            {getKycDocumentStatus('utility') === 'approved' && (
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
                          id="utility-document-upload"
                          type="file"
                          accept=".jpg,.jpeg,.png,.pdf"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            console.log('File input changed for Utility Bill:', { file: file?.name, hasFile: !!file });
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
                            {Array.isArray(kycDocuments) && kycDocuments.filter(d => d.documentType === 'profile_photo' && d.fileUrl).length > 0 && (
                              <div className="flex items-center space-x-2 mt-1">
                                <p className="text-xs text-emerald-500">
                                  {Array.isArray(kycDocuments) ? kycDocuments.filter(d => d.documentType === 'profile_photo' && d.fileUrl)[0]?.fileName : ''}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-stretch space-y-2">
                          {/* View button positioned above other buttons */}
                          {Array.isArray(kycDocuments) && kycDocuments.filter(d => d.documentType === 'profile_photo' && d.fileUrl).length > 0 && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="text-xs border-slate-600 text-slate-400 hover:bg-slate-700 w-full"
                              onClick={() => {
                                const doc = Array.isArray(kycDocuments) ? kycDocuments.filter(d => d.documentType === 'profile_photo' && d.fileUrl)[0] : null;
                                if (doc && doc.fileUrl) {
                                  try {
                                    // Clear browser cache for this specific document and open in new tab
                                    const documentUrl = `/api/documents/view/${doc.id}?v=${Date.now()}`;
                                    console.log('Opening document:', documentUrl);

                                    const newTab = window.open('about:blank', '_blank');
                                    if (newTab) {
                                      newTab.location.href = documentUrl;
                                    } else {
                                      // Fallback if popup blocked
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
                            {(getKycDocumentStatus('photo') !== 'approved' || (Array.isArray(kycDocuments) && kycDocuments.filter(d => d.documentType === 'profile_photo' && d.fileUrl).length === 0)) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => document.getElementById('photo-document-upload')?.click()}
                                disabled={uploadKycDocumentMutation.isPending}
                                className="border-slate-600 hover:bg-slate-600 w-full sm:w-auto"
                              >
                                <Upload className="w-4 h-4 mr-1" />
                                {Array.isArray(kycDocuments) && kycDocuments.filter(d => d.documentType === 'profile_photo' && d.fileUrl).length > 0 ? 'Reupload' : 'Upload'}
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
                            {kycDocuments.map((doc) => {
                              // Use createdAt as the timestamp
                              const dateToFormat = doc.createdAt;
                              const formattedDate = dateToFormat ? formatSubmissionDate(dateToFormat.toString()) : 'No date';

                              const formattedType = formatDocumentType(doc.documentType || 'document');
                              return (
                                <div key={doc.id} className="flex items-center justify-between py-2 border-b border-slate-600 last:border-b-0">
                                  <div className="flex items-center space-x-3 flex-1">
                                    <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                                    <div className="flex-1">
                                      <p className="text-xs font-medium text-white">
                                        {formattedType}
                                      </p>
                                      <p className="text-xs text-slate-400">{doc.fileName}</p>
                                      <p className="text-xs text-slate-500">
                                        {formattedDate}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <Badge 
                                      variant={doc.status === 'approved' ? 'default' : doc.status === 'pending' ? 'secondary' : 'destructive'}
                                      className="text-xs"
                                    >
                                      {doc.status}
                                    </Badge>
                                  </div>
                                </div>
                              )
                            })}
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
                      <p className="text-xs text-slate-400">
                        Your PAN card number must be unique and cannot be used by other players
                      </p>
                    </div>

                    <div className="flex flex-col space-y-2">
                      <label htmlFor="pan-number" className="text-sm font-medium text-white">
                        PAN Card Number
                      </label>
                      <Input
                        value={panCardNumber}
                        onChange={(e) => setPanCardNumber(e.target.value.toUpperCase())}
                        className={`bg-slate-700 border-slate-600 text-white h-12 ${
                          panCardNumber && !isValidPAN(panCardNumber) ? 'border-red-500' : ''
                        }`}
                        placeholder="ABCPF1234G"
                        maxLength={10}
                      />
                      {panCardNumber && !isValidPAN(panCardNumber) && (
                        <p className="text-red-400 text-xs mt-2">
                          Invalid PAN card format. Please enter a valid PAN card number.
                        </p>
                      )}
                    </div>

                    <Button 
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                      onClick={handlePanCardUpdate}
                      disabled={updatePanCardMutation.isPending || !isValidPAN(panCardNumber)}
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

                  {/* PAN Card Document Upload - Now with full functionality like other KYC docs */}
                  <div className="space-y-3 pt-4 border-t border-slate-600">
                    <div className="flex items-center justify-between p-3 bg-slate-700 rounded-lg">
                      <div className="flex items-center space-x-3 flex-1">
                        {getKycStatusIcon(getKycDocumentStatus('pan_card'))}
                        <div className="flex-1">
                          <p className="text-sm font-medium text-white">PAN Card Document</p>
                          <p className="text-xs text-slate-400 capitalize">{getKycDocumentStatus('pan_card')}</p>
                          {Array.isArray(kycDocuments) && kycDocuments.filter(d => d.documentType === 'pan_card' && d.fileUrl).length > 0 && (
                            <div className="flex items-center space-x-2 mt-1">
                              <p className="text-xs text-emerald-500">
                                {Array.isArray(kycDocuments) ? kycDocuments.filter(d => d.documentType === 'pan_card' && d.fileUrl)[0]?.fileName : ''}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-stretch space-y-2">
                        {/* View button positioned above other buttons */}
                        {Array.isArray(kycDocuments) && kycDocuments.filter(d => d.documentType === 'pan_card' && d.fileUrl).length > 0 && (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="text-xs border-slate-600 text-slate-400 hover:bg-slate-700 w-full"
                            onClick={() => {
                              const doc = Array.isArray(kycDocuments) ? kycDocuments.filter(d => d.documentType === 'pan_card' && d.fileUrl)[0] : null;
                              if (doc && doc.fileUrl) {
                                try {
                                  // Clear browser cache for this specific document and open in new tab
                                  const documentUrl = `/api/documents/view/${doc.id}?v=${Date.now()}`;
                                  console.log('Opening document:', documentUrl);

                                  const newTab = window.open('about:blank', '_blank');
                                  if (newTab) {
                                    newTab.location.href = documentUrl;
                                  } else {
                                    // Fallback if popup blocked
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
                          {(getKycDocumentStatus('pan_card') !== 'approved' || (Array.isArray(kycDocuments) && kycDocuments.filter(d => d.documentType === 'pan_card' && d.fileUrl).length === 0)) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => document.getElementById('pan-document-upload')?.click()}
                              disabled={uploadKycDocumentMutation.isPending}
                              className="border-slate-600 hover:bg-slate-600 w-full sm:w-auto"
                            >
                              <Upload className="w-4 h-4 mr-1" />
                              {Array.isArray(kycDocuments) && kycDocuments.filter(d => d.documentType === 'pan_card' && d.fileUrl).length > 0 ? 'Reupload' : 'Upload'}
                            </Button>
                          )}

                          {/* Show request change button if approved */}
                          {getKycDocumentStatus('pan_card') === 'approved' && (
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
                        id="pan-document-upload"
                        type="file"
                        accept=".jpg,.jpeg,.png,.pdf"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          console.log('File input changed for PAN Card:', { file: file?.name, hasFile: !!file });
                          if (file) {
                            handleKycDocumentUpload('pan_card', file);
                            // Reset the input value to allow re-uploading same file
                            e.target.value = '';
                          }
                        }}
                      />
                    </div>
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
                      value={showTransactions || ''} // Use '' for initial empty value
                      onChange={(e) => {
                        setShowTransactions(e.target.value as any); // Cast to any to allow string values
                      }}
                    >
                      <option value="">Select action...</option>
                      <option value="last10">View Last 10 Transactions</option>
                      <option value="all">View All Transactions</option>
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
                            <h4 className="text-sm font-medium text-white mb-3">
                              {showTransactions === 'last10' ? 'Last 10 Transactions' : 'All Transactions'}
                            </h4>
                            <div className="max-h-80 overflow-y-auto space-y-2">
                              {(showTransactions === 'last10' ? transactions.slice(0, 10) : transactions).map((transaction: any, index: number) => (
                                <div key={index} className="flex justify-between items-center py-2 border-b border-slate-600 last:border-b-0">
                                  <div>
                                    <p className="text-sm text-white">{transaction.type}</p>
                                    <p className="text-xs text-slate-400">
                                      {new Date(transaction.created_at).toLocaleDateString()} at{' '}
                                      {new Date(transaction.created_at).toLocaleTimeString()}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className={`text-sm font-medium ${getTransactionAmountColor(transaction.type)}`}>
                                      {getTransactionAmountPrefix(transaction.type)}₹{Math.abs(transaction.amount)}
                                    </p>
                                    <p className="text-xs text-slate-400">{transaction.status}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                            {showTransactions === 'last10' && transactions.length > 10 && (
                              <p className="text-xs text-slate-400 text-center mt-2">
                                Showing 10 of {transactions.length} transactions
                              </p>
                            )}
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
                          Select an option above to see your recent activity
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

                {/* Guest Relations Support - Unified Chat System */}
                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader className="pb-4 border-b border-slate-700">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-emerald-500/20 rounded-full">
                          <MessageCircle className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                          <CardTitle className="text-white text-lg">
                            Guest Relations Support
                          </CardTitle>
                          <div className="flex items-center space-x-2 text-sm text-slate-400">
                            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                            <span>Unified Chat System Active</span>
                          </div>
                        </div>
                      </div>
                      <Button
                        onClick={() => setChatDialogOpen(true)}
                        className="bg-emerald-600 hover:bg-emerald-700"
                        size="sm"
                      >
                        <MessageCircle className="w-4 h-4 mr-2" />
                        Open Chat
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-center py-8">
                      <MessageCircle className="w-12 h-12 mx-auto mb-4 text-emerald-400" />
                      <h3 className="text-lg font-semibold text-white mb-2">
                        Professional Support Available
                      </h3>
                      <p className="text-slate-400 mb-4">
                        Connect with our Guest Relations team for immediate assistance with any questions or concerns.
                      </p>
                      <div className="text-emerald-400 text-sm font-medium">
                        <MessageCircle className="w-5 h-5 mr-2 inline" />
                        Real-time support available
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Notifications Tab */}
            <TabsContent value="notifications" className="space-y-3 sm:space-y-4 w-full max-w-full">
              <NotificationHistoryTab />
            </TabsContent>

          </div>
        </Tabs>



        {/* Full Chat Dialog that opens from "Open Chat" button */}
        <Dialog open={chatDialogOpen} onOpenChange={setChatDialogOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[80vh] bg-slate-800 border-slate-700">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center">
                <MessageCircle className="w-5 h-5 mr-2 text-emerald-400" />
                Guest Relations Support
              </DialogTitle>
            </DialogHeader>

            {/* Chat System Integration - Direct PostgreSQL connection to Staff Portal */}
            {chatDialogOpen && user?.id && (
              <PlayerChatSystem 
                playerId={Number(user.id)}
                playerName={`${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.email || 'Player'}
                isInDialog={true}
                onClose={() => setChatDialogOpen(false)}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Live Session Tracking removed - already in Session tab */}

      </div>
    </div>
  );
};

export default PlayerDashboard;