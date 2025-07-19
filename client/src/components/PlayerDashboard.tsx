import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
// Switch removed - preferences section eliminated
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Calendar
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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

export default function PlayerDashboard() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [callTime, setCallTime] = useState("02:45");
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
    <div className="min-h-screen bg-slate-900 p-4 sm:p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Player Dashboard</h1>
          <p className="text-slate-400">Welcome back, {user?.firstName}!</p>
        </div>
        <Button
          onClick={signOut}
          variant="outline"
          className="border-slate-600 text-slate-400 hover:bg-slate-700 hover:text-white"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </div>

      {/* Navigation Tabs */}
      <Tabs defaultValue="game" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-slate-800 border-slate-700">
          <TabsTrigger value="game" className="text-slate-300 data-[state=active]:text-white">
            <Spade className="w-4 h-4 mr-2" />
            Lobby
          </TabsTrigger>
          <TabsTrigger value="balance" className="text-slate-300 data-[state=active]:text-white">
            <CreditCard className="w-4 h-4 mr-2" />
            Offers
          </TabsTrigger>
          <TabsTrigger value="stats" className="text-slate-300 data-[state=active]:text-white">
            <BarChart3 className="w-4 h-4 mr-2" />
            Stats
          </TabsTrigger>
          <TabsTrigger value="profile" className="text-slate-300 data-[state=active]:text-white">
            <User className="w-4 h-4 mr-2" />
            Profile
          </TabsTrigger>
        </TabsList>

          {/* Game Tab */}
          <TabsContent value="game" className="space-y-4">
            {/* Staff-Managed Offer Carousel */}
            <OfferCarousel onOfferClick={(offerId) => {
              // Switch to offers tab when carousel item is clicked
              const offersTab = document.querySelector('[value="balance"]') as HTMLElement;
              if (offersTab) offersTab.click();
            }} />
            
            <div className="grid grid-cols-1 gap-4 sm:gap-6">
              {/* Live Tables */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center">
                    <Table className="w-5 h-5 mr-2 text-emerald-500" />
                    Live Tables
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
                          className="bg-slate-700 p-4 rounded-lg hover:bg-slate-600 transition-colors"
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
                            {isTableJoined(table.id) ? (
                              <div className="flex items-center space-x-2">
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
                              </div>
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
                            <Badge variant="secondary" className="bg-slate-600 text-slate-300">
                              {table.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Preferences section removed as per requirements */}
            </div>
          </TabsContent>

          {/* Offers Tab - Staff Managed */}
          <TabsContent value="balance" className="space-y-4">
            <ScrollableOffersDisplay />
          </TabsContent>

          {/* Stats Tab */}
          <TabsContent value="stats" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">Gaming Stats</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Games Played</span>
                    <span className="text-white font-semibold">{user.gamesPlayed}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Hours Played</span>
                    <span className="text-white font-semibold">{user.hoursPlayed}h</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Total Winnings</span>
                    <span className="text-emerald-500 font-semibold">₹{user.totalWinnings}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Total Losses</span>
                    <span className="text-red-500 font-semibold">₹{user.totalLosses}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">Financial Stats</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Current Balance</span>
                    <span className="text-white font-semibold">₹{user.balance}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Total Deposits</span>
                    <span className="text-emerald-500 font-semibold">₹{user.totalDeposits}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Total Withdrawals</span>
                    <span className="text-amber-500 font-semibold">₹{user.totalWithdrawals}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Account Management Notice */}
            <Card className="bg-amber-500/20 border-amber-400/30">
              <CardContent className="p-4">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-amber-200 font-medium mb-1">Account Management</div>
                    <div className="text-amber-100 text-opacity-90 text-sm">
                      For deposits, withdrawals, and other account transactions, please contact our cashier or support team. 
                      These operations require staff approval for security purposes.
                    </div>
                  </div>
                </div>
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
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="text-xs h-6 px-2 border-slate-600 text-slate-400 hover:bg-slate-700"
                                  onClick={() => {
                                    const doc = kycDocuments.filter(d => d.documentType === 'government_id' && d.fileUrl)[0];
                                    if (doc && doc.fileUrl) {
                                      try {
                                        // Use the document URL directly if it's a full URL, otherwise use the API endpoint
                                        const documentUrl = doc.fileUrl.startsWith('http') 
                                          ? doc.fileUrl 
                                          : `/api/documents/view/${doc.id}`;
                                        console.log('Opening document:', documentUrl);
                                        // Try to open in new tab, fallback to current tab
                                        const newTab = window.open(documentUrl, '_blank', 'noopener,noreferrer');
                                        if (!newTab) {
                                          // If popup blocked, open in current tab
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
                                  View
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {/* Only show upload/reupload if not approved or if no documents */}
                          {(getKycDocumentStatus('id') !== 'approved' || kycDocuments?.filter(d => d.documentType === 'government_id' && d.fileUrl).length === 0) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => document.getElementById('id-document-upload')?.click()}
                              disabled={uploadKycDocumentMutation.isPending}
                              className="border-slate-600 hover:bg-slate-600"
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
                                // TODO: Implement request change functionality
                                alert('Request change functionality will be implemented');
                              }}
                              className="border-amber-600 text-amber-400 hover:bg-amber-600/20"
                            >
                              <AlertTriangle className="w-4 h-4 mr-1" />
                              Request Change
                            </Button>
                          )}
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
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="text-xs h-6 px-2 border-slate-600 text-slate-400 hover:bg-slate-700"
                                  onClick={() => {
                                    const doc = kycDocuments.filter(d => d.documentType === 'utility_bill' && d.fileUrl)[0];
                                    if (doc && doc.fileUrl) {
                                      try {
                                        // Use the document URL directly if it's a full URL, otherwise use the API endpoint
                                        const documentUrl = doc.fileUrl.startsWith('http') 
                                          ? doc.fileUrl 
                                          : `/api/documents/view/${doc.id}`;
                                        console.log('Opening document:', documentUrl);
                                        // Try to open in new tab, fallback to current tab
                                        const newTab = window.open(documentUrl, '_blank', 'noopener,noreferrer');
                                        if (!newTab) {
                                          // If popup blocked, open in current tab
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
                                  View
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {/* Only show upload/reupload if not approved or if no documents */}
                          {(getKycDocumentStatus('utility') !== 'approved' || kycDocuments?.filter(d => d.documentType === 'utility_bill' && d.fileUrl).length === 0) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => document.getElementById('address-document-upload')?.click()}
                              disabled={uploadKycDocumentMutation.isPending}
                              className="border-slate-600 hover:bg-slate-600"
                            >
                              <Upload className="w-4 h-4 mr-1" />
                              {kycDocuments?.filter(d => d.documentType === 'utility_bill' && d.fileUrl).length > 0 ? 'Reupload' : 'Upload'}
                            </Button>
                          )}
                          
                          {/* Show request change button if approved */}
                          {getKycDocumentStatus('utility') === 'approved' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                // TODO: Implement request change functionality
                                alert('Request change functionality will be implemented');
                              }}
                              className="border-amber-600 text-amber-400 hover:bg-amber-600/20"
                            >
                              <AlertTriangle className="w-4 h-4 mr-1" />
                              Request Change
                            </Button>
                          )}
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
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="text-xs h-6 px-2 border-slate-600 text-slate-400 hover:bg-slate-700"
                                  onClick={() => {
                                    const doc = kycDocuments.filter(d => d.documentType === 'profile_photo' && d.fileUrl)[0];
                                    if (doc && doc.fileUrl) {
                                      try {
                                        // Use the document URL directly if it's a full URL, otherwise use the API endpoint
                                        const documentUrl = doc.fileUrl.startsWith('http') 
                                          ? doc.fileUrl 
                                          : `/api/documents/view/${doc.id}`;
                                        console.log('Opening document:', documentUrl);
                                        // Try to open in new tab, fallback to current tab
                                        const newTab = window.open(documentUrl, '_blank', 'noopener,noreferrer');
                                        if (!newTab) {
                                          // If popup blocked, open in current tab
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
                                  View
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {/* Only show upload/reupload if not approved or if no documents */}
                          {(getKycDocumentStatus('photo') !== 'approved' || kycDocuments?.filter(d => d.documentType === 'profile_photo' && d.fileUrl).length === 0) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => document.getElementById('photo-document-upload')?.click()}
                              disabled={uploadKycDocumentMutation.isPending}
                              className="border-slate-600 hover:bg-slate-600"
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
                                // TODO: Implement request change functionality
                                alert('Request change functionality will be implemented');
                              }}
                              className="border-amber-600 text-amber-400 hover:bg-amber-600/20"
                            >
                              <AlertTriangle className="w-4 h-4 mr-1" />
                              Request Change
                            </Button>
                          )}
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
        </Tabs>
    </div>
  );
}