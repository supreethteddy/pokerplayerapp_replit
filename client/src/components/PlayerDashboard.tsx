import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Spade, 
  Table, 
  Clock, 
  Settings, 
  BarChart3, 
  User, 
  LogOut,
  Users,
  CreditCard,
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  Eye,
  AlertCircle
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import type { Table as TableType, SeatRequest, PlayerPrefs, KycDocument } from "@shared/schema";
import BalanceManager from "./BalanceManager";


export default function PlayerDashboard() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [callTime, setCallTime] = useState("02:45");
  const [selectedDocument, setSelectedDocument] = useState<KycDocument | null>(null);
  const [showDocumentViewer, setShowDocumentViewer] = useState(false);

  // Fetch live tables with reduced frequency
  const { data: tables, isLoading: tablesLoading } = useQuery<TableType[]>({
    queryKey: ['/api/tables'],
    refetchInterval: 10000, // Refresh every 10 seconds instead of 5
  });

  // Fetch seat requests with reduced frequency
  const { data: seatRequests, isLoading: requestsLoading } = useQuery<SeatRequest[]>({
    queryKey: ['/api/seat-requests', user?.id],
    enabled: !!user?.id,
    refetchInterval: 5000, // Refresh every 5 seconds instead of 2
  });

  // Fetch player preferences
  const { data: preferences, isLoading: prefsLoading } = useQuery<PlayerPrefs>({
    queryKey: ['/api/player-prefs', user?.id],
    enabled: !!user?.id,
  });

  // Fetch KYC documents
  const { data: kycDocuments, isLoading: kycLoading } = useQuery<KycDocument[]>({
    queryKey: ['/api/kyc-documents/player', user?.id],
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

  // Update preferences mutation
  const updatePreferencesMutation = useMutation({
    mutationFn: async (newPrefs: Partial<PlayerPrefs>) => {
      const response = await apiRequest('PATCH', `/api/player-prefs/${user?.id}`, newPrefs);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/player-prefs'] });
      toast({
        title: "Preferences Updated",
        description: "Your notification preferences have been saved",
      });
    },
  });

  // KYC document upload mutation
  const uploadKycDocumentMutation = useMutation({
    mutationFn: async ({ documentType, file }: { documentType: string; file: File }) => {
      const reader = new FileReader();
      return new Promise((resolve, reject) => {
        reader.onload = async (event) => {
          const dataUrl = event.target?.result as string;
          try {
            const response = await apiRequest('POST', '/api/kyc-documents', {
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
      queryClient.invalidateQueries({ queryKey: ['/api/kyc-documents/player'] });
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

  const handlePreferenceChange = (key: keyof PlayerPrefs, value: boolean) => {
    updatePreferencesMutation.mutate({ [key]: value });
  };

  const handleKycDocumentUpload = (documentType: string, file: File) => {
    uploadKycDocumentMutation.mutate({ documentType, file });
  };

  const handleViewDocument = (doc: KycDocument) => {
    setSelectedDocument(doc);
    setShowDocumentViewer(true);
  };

  const getKycDocumentStatus = (documentType: string) => {
    // Find the latest document for this type (by createdAt date)
    const docs = kycDocuments?.filter(d => d.documentType === documentType);
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
    <div className="min-h-screen bg-slate-950 pb-20">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Player Dashboard</h1>
            <p className="text-slate-400">Welcome back, {user.firstName}!</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-sm text-slate-400">Current Time</p>
              <p className="text-lg font-semibold text-white">{callTime}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={signOut}
              className="border-slate-600 text-slate-400 hover:bg-slate-800"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="game" className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-slate-800 border-slate-700">
            <TabsTrigger value="game" className="text-slate-400 data-[state=active]:text-white">
              <Spade className="w-4 h-4 mr-2" />
              Game
            </TabsTrigger>
            <TabsTrigger value="balance" className="text-slate-400 data-[state=active]:text-white">
              <CreditCard className="w-4 h-4 mr-2" />
              Balance
            </TabsTrigger>
            <TabsTrigger value="stats" className="text-slate-400 data-[state=active]:text-white">
              <BarChart3 className="w-4 h-4 mr-2" />
              Stats
            </TabsTrigger>
            <TabsTrigger value="profile" className="text-slate-400 data-[state=active]:text-white">
              <User className="w-4 h-4 mr-2" />
              Profile
            </TabsTrigger>
          </TabsList>

          {/* Game Tab */}
          <TabsContent value="game" className="space-y-4">
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
                          className="bg-slate-700 p-4 rounded-lg border border-slate-600"
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h3 className="font-semibold text-white">{table.name}</h3>
                              <p className="text-sm text-slate-400">{table.gameType}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-slate-400">Stakes</p>
                              <p className="text-lg font-semibold text-emerald-400">
                                ₹{table.smallBlind}/{table.bigBlind}
                              </p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-4 mb-3">
                            <div className="text-center">
                              <Users className="w-4 h-4 text-slate-400 mx-auto mb-1" />
                              <p className="text-xs text-slate-400">Players</p>
                              <p className="text-sm font-semibold text-white">
                                {table.currentPlayers}/{table.maxPlayers}
                              </p>
                            </div>
                            <div className="text-center">
                              <div className="w-4 h-4 bg-emerald-500 rounded-full mx-auto mb-1" />
                              <p className="text-xs text-slate-400">Pot</p>
                              <p className="text-sm font-semibold text-emerald-400">
                                ₹{table.currentPot}
                              </p>
                            </div>
                            <div className="text-center">
                              <div className="w-4 h-4 bg-amber-500 rounded-full mx-auto mb-1" />
                              <p className="text-xs text-slate-400">Avg Stack</p>
                              <p className="text-sm font-semibold text-amber-400">
                                ₹{table.averageStack}
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
                              </div>
                            ) : (
                              <Button
                                onClick={() => handleJoinWaitList(table.id)}
                                disabled={joinWaitListMutation.isPending}
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700"
                              >
                                {joinWaitListMutation.isPending ? (
                                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                                ) : null}
                                Join Wait-List
                              </Button>
                            )}
                            <Badge variant="secondary" className="bg-slate-600 text-slate-300">
                              {table.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Preferences */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center">
                    <Settings className="w-5 h-5 mr-2 text-emerald-500" />
                    Preferences
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {prefsLoading ? (
                    <div className="space-y-4">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-12 bg-slate-700" />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="sound-notifications" className="text-slate-200">
                          Sound Notifications
                        </Label>
                        <Switch
                          id="sound-notifications"
                          checked={preferences?.soundNotifications || false}
                          onCheckedChange={(checked) => handlePreferenceChange('soundNotifications', checked)}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="email-notifications" className="text-slate-200">
                          Email Notifications
                        </Label>
                        <Switch
                          id="email-notifications"
                          checked={preferences?.emailNotifications || false}
                          onCheckedChange={(checked) => handlePreferenceChange('emailNotifications', checked)}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="auto-rebuy" className="text-slate-200">
                          Auto Re-buy
                        </Label>
                        <Switch
                          id="auto-rebuy"
                          checked={preferences?.autoRebuy || false}
                          onCheckedChange={(checked) => handlePreferenceChange('autoRebuy', checked)}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Balance Tab */}
          <TabsContent value="balance" className="space-y-4">
            <BalanceManager />
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
                    <span className="text-emerald-400 font-semibold">₹{user.totalWinnings}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Total Losses</span>
                    <span className="text-red-400 font-semibold">₹{user.totalLosses}</span>
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
                    <span className="text-emerald-400 font-semibold">₹{user.totalDeposits}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Total Withdrawals</span>
                    <span className="text-amber-400 font-semibold">₹{user.totalWithdrawals}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
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
                  {/* Profile Photo */}
                  <div className="flex flex-col items-center mb-6">
                    <div className="relative">
                      <div className="w-20 h-20 bg-slate-700 rounded-full flex items-center justify-center">
                        {user?.profilePhoto ? (
                          <img src={user.profilePhoto} alt="Profile" className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <User className="w-8 h-8 text-slate-400" />
                        )}
                      </div>
                      <button className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center hover:bg-emerald-600 transition-colors">
                        <span className="text-white text-xs">+</span>
                      </button>
                    </div>
                    <p className="text-sm text-slate-400 mt-2">Click + to upload photo</p>
                  </div>

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
                            {kycDocuments?.filter(d => d.documentType === 'id').length > 0 && (
                              <p className="text-xs text-emerald-400 cursor-pointer hover:text-emerald-300"
                                 onClick={() => handleViewDocument(kycDocuments.filter(d => d.documentType === 'id')[0])}>
                                {kycDocuments.filter(d => d.documentType === 'id')[0].fileName}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {kycDocuments?.filter(d => d.documentType === 'id').length > 0 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleViewDocument(kycDocuments.filter(d => d.documentType === 'id')[0])}
                              className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-600"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => document.getElementById('id-document-upload')?.click()}
                            disabled={uploadKycDocumentMutation.isPending}
                            className="border-slate-600 hover:bg-slate-600"
                          >
                            <Upload className="w-4 h-4 mr-1" />
                            {kycDocuments?.filter(d => d.documentType === 'id').length > 0 ? 'Replace' : 'Upload'}
                          </Button>
                        </div>
                        <input
                          id="id-document-upload"
                          type="file"
                          accept="image/*,.pdf"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleKycDocumentUpload('id', file);
                          }}
                        />
                      </div>

                      {/* Address Document */}
                      <div className="flex items-center justify-between p-3 bg-slate-700 rounded-lg">
                        <div className="flex items-center space-x-3 flex-1">
                          {getKycStatusIcon(getKycDocumentStatus('address'))}
                          <div className="flex-1">
                            <p className="text-sm font-medium text-white">Address Proof</p>
                            <p className="text-xs text-slate-400 capitalize">{getKycDocumentStatus('address')}</p>
                            {kycDocuments?.filter(d => d.documentType === 'address').length > 0 && (
                              <p className="text-xs text-emerald-400 cursor-pointer hover:text-emerald-300"
                                 onClick={() => handleViewDocument(kycDocuments.filter(d => d.documentType === 'address')[0])}>
                                {kycDocuments.filter(d => d.documentType === 'address')[0].fileName}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {kycDocuments?.filter(d => d.documentType === 'address').length > 0 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleViewDocument(kycDocuments.filter(d => d.documentType === 'address')[0])}
                              className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-600"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => document.getElementById('address-document-upload')?.click()}
                            disabled={uploadKycDocumentMutation.isPending}
                            className="border-slate-600 hover:bg-slate-600"
                          >
                            <Upload className="w-4 h-4 mr-1" />
                            {kycDocuments?.filter(d => d.documentType === 'address').length > 0 ? 'Replace' : 'Upload'}
                          </Button>
                        </div>
                        <input
                          id="address-document-upload"
                          type="file"
                          accept="image/*,.pdf"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleKycDocumentUpload('address', file);
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
                            {kycDocuments?.filter(d => d.documentType === 'photo').length > 0 && (
                              <p className="text-xs text-emerald-400 cursor-pointer hover:text-emerald-300"
                                 onClick={() => handleViewDocument(kycDocuments.filter(d => d.documentType === 'photo')[0])}>
                                {kycDocuments.filter(d => d.documentType === 'photo')[0].fileName}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {kycDocuments?.filter(d => d.documentType === 'photo').length > 0 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleViewDocument(kycDocuments.filter(d => d.documentType === 'photo')[0])}
                              className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-600"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => document.getElementById('photo-document-upload')?.click()}
                            disabled={uploadKycDocumentMutation.isPending}
                            className="border-slate-600 hover:bg-slate-600"
                          >
                            <Upload className="w-4 h-4 mr-1" />
                            {kycDocuments?.filter(d => d.documentType === 'photo').length > 0 ? 'Replace' : 'Upload'}
                          </Button>
                        </div>
                        <input
                          id="photo-document-upload"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleKycDocumentUpload('photo', file);
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
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleViewDocument(doc)}
                                    className="h-6 w-6 p-0 text-slate-400 hover:text-white hover:bg-slate-600"
                                  >
                                    <Eye className="w-3 h-3" />
                                  </Button>
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

      {/* Document Viewer Dialog */}
      <Dialog open={showDocumentViewer} onOpenChange={setShowDocumentViewer}>
        <DialogContent className="max-w-4xl max-h-[80vh] bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">
              {selectedDocument ? `${selectedDocument.documentType} Document - ${selectedDocument.fileName}` : 'View Document'}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-4">
            {selectedDocument && (
              <>
                <div className="w-full max-w-2xl">
                  <img 
                    src={selectedDocument.fileUrl} 
                    alt={selectedDocument.fileName}
                    className="w-full h-auto rounded-lg border border-slate-600"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                </div>
                <div className="text-center space-y-2">
                  <p className="text-sm text-slate-300">
                    <strong>Document Type:</strong> {selectedDocument.documentType}
                  </p>
                  <p className="text-sm text-slate-300">
                    <strong>File Name:</strong> {selectedDocument.fileName}
                  </p>
                  <p className="text-sm text-slate-300">
                    <strong>Status:</strong> 
                    <Badge 
                      variant={selectedDocument.status === 'approved' ? 'default' : selectedDocument.status === 'pending' ? 'secondary' : 'destructive'}
                      className="ml-2"
                    >
                      {selectedDocument.status}
                    </Badge>
                  </p>
                  <p className="text-sm text-slate-300">
                    <strong>Uploaded:</strong> {new Date(selectedDocument.createdAt!).toLocaleDateString()}
                  </p>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}