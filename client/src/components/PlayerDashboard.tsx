import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import type { Table as TableType, SeatRequest, PlayerPrefs } from "@shared/schema";
import BalanceManager from "./BalanceManager";


export default function PlayerDashboard() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [callTime, setCallTime] = useState("02:45");

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

  // Simulate call time countdown
  useEffect(() => {
    if (user && callTime) {
      const interval = setInterval(() => {
        setCallTime(prev => {
          const [minutes, seconds] = prev.split(':').map(Number);
          if (seconds > 0) {
            return `${minutes.toString().padStart(2, '0')}:${(seconds - 1).toString().padStart(2, '0')}`;
          } else if (minutes > 0) {
            return `${(minutes - 1).toString().padStart(2, '0')}:59`;
          }
          return "00:00";
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [user, callTime]);

  const handlePreferenceChange = (key: keyof PlayerPrefs, value: boolean) => {
    updatePreferencesMutation.mutate({ [key]: value });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'waiting':
        return <Badge variant="secondary" className="bg-amber-500/20 text-amber-300 border-amber-500/30">Waiting</Badge>;
      case 'approved':
        return <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Mobile-Optimized Header */}
      <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-40">
        <div className="mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center">
                <Spade className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-white">Player Dashboard</h1>
                <p className="text-xs sm:text-sm text-slate-400">
                  <span className="text-emerald-400">{user?.firstName} {user?.lastName}</span>
                  <span className="hidden sm:inline ml-2 text-slate-500">|</span>
                  <span className="block sm:inline sm:ml-2 text-emerald-400">Balance: ₹{parseFloat(user?.balance || "0").toFixed(2)}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 sm:space-x-4">
              {/* Call Time Countdown (if seated) */}
              {user && (
                <div className="bg-red-500/20 text-red-300 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-mono border border-red-500/30">
                  <Clock className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1" />
                  <span className="hidden sm:inline">{callTime}</span>
                  <span className="sm:hidden">{callTime.slice(0, 4)}</span>
                </div>
              )}
              
              <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white w-8 h-8 sm:w-10 sm:h-10">
                <User className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
              
              <Button variant="ghost" size="icon" onClick={signOut} className="text-slate-400 hover:text-white w-8 h-8 sm:w-10 sm:h-10">
                <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-7xl">
        <Tabs defaultValue="tables" className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-slate-800 border-slate-700 mb-4 sm:mb-6">
            <TabsTrigger value="tables" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <Table className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Tables</span>
              <span className="sm:hidden">Game</span>
            </TabsTrigger>
            <TabsTrigger value="balance" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <CreditCard className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Balance</span>
              <span className="sm:hidden">₹</span>
            </TabsTrigger>
            <TabsTrigger value="stats" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <BarChart3 className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Stats</span>
              <span className="sm:hidden">📊</span>
            </TabsTrigger>
            <TabsTrigger value="profile" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <User className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Profile</span>
              <span className="sm:hidden">👤</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tables" className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              {/* Live Tables */}
              <div className="lg:col-span-2">
                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center justify-between">
                      <div className="flex items-center">
                        <Table className="w-5 h-5 mr-2 text-emerald-500" />
                        Live Tables
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                        <span className="text-sm text-slate-400">Live</span>
                      </div>
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
                        className="bg-slate-700 rounded-lg p-3 sm:p-4 border border-slate-600 hover:border-emerald-500/50 transition-colors"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 space-y-2 sm:space-y-0">
                          <div className="flex items-center space-x-3">
                            <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                            <div>
                              <h3 className="font-semibold text-white text-sm sm:text-base">{table.name}</h3>
                              <p className="text-xs sm:text-sm text-slate-400">{table.gameType} • {table.stakes}</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between sm:justify-end">
                            <div className="text-right">
                              <div className="text-xs sm:text-sm text-slate-400">Players</div>
                              <div className="text-white font-semibold flex items-center">
                                <Users className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                                {table.currentPlayers}/{table.maxPlayers}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                          <div className="flex items-center space-x-4">
                            <div className="text-xs sm:text-sm">
                              <span className="text-slate-400">Pot:</span>
                              <span className="text-emerald-400 font-semibold ml-1">₹{table.pot}</span>
                            </div>
                            <div className="text-xs sm:text-sm">
                              <span className="text-slate-400">Avg:</span>
                              <span className="text-white font-semibold ml-1">₹{table.avgStack}</span>
                            </div>
                          </div>
                          <Button 
                            onClick={() => joinWaitListMutation.mutate(table.id)}
                            disabled={joinWaitListMutation.isPending}
                            className="bg-emerald-500 hover:bg-emerald-600 w-full sm:w-auto text-xs sm:text-sm py-2 sm:py-3"
                          >
                            {joinWaitListMutation.isPending ? 'Joining...' : 'Join Wait-List'}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4 sm:space-y-6">
            {/* Seat Requests */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <Clock className="w-5 h-5 mr-2 text-indigo-500" />
                  Seat Requests
                </CardTitle>
              </CardHeader>

              <CardContent>
                {requestsLoading ? (
                  <div className="space-y-3">
                    {[1, 2].map((i) => (
                      <Skeleton key={i} className="h-16 bg-slate-700" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {seatRequests?.length === 0 ? (
                      <p className="text-slate-400 text-center py-4">No active seat requests</p>
                    ) : (
                      seatRequests?.map((request) => (
                        <div key={request.id} className="bg-slate-700 rounded-lg p-3 border border-slate-600">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-white font-medium">
                              Table {request.tableId}
                            </span>
                            {getStatusBadge(request.status)}
                          </div>
                          <div className="flex items-center justify-between text-xs text-slate-400">
                            <span>Position: #{request.position}</span>
                            <span>Est. wait: {request.estimatedWait} min</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Notification Preferences */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <Settings className="w-5 h-5 mr-2 text-slate-400" />
                  Notifications
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
                      <div>
                        <Label className="text-sm font-medium text-white">Seat Available</Label>
                        <p className="text-xs text-slate-400">Get notified when a seat becomes available</p>
                      </div>
                      <Switch
                        checked={preferences?.seatAvailable ?? true}
                        onCheckedChange={(checked) => handlePreferenceChange('seatAvailable', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-medium text-white">Call Time Warning</Label>
                        <p className="text-xs text-slate-400">Alert when call time is running low</p>
                      </div>
                      <Switch
                        checked={preferences?.callTimeWarning ?? true}
                        onCheckedChange={(checked) => handlePreferenceChange('callTimeWarning', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-medium text-white">Game Updates</Label>
                        <p className="text-xs text-slate-400">Tournament and game announcements</p>
                      </div>
                      <Switch
                        checked={preferences?.gameUpdates ?? false}
                        onCheckedChange={(checked) => handlePreferenceChange('gameUpdates', checked)}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Player Stats */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <BarChart3 className="w-5 h-5 mr-2 text-indigo-500" />
                  Session Stats
                </CardTitle>
              </CardHeader>

              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-emerald-400">
                      ₹{((parseFloat(user?.totalWinnings || "0") - parseFloat(user?.totalLosses || "0")) || 0).toFixed(2)}
                    </div>
                    <div className="text-xs text-slate-400">Net P&L</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">{user?.hoursPlayed || "0.00"}h</div>
                    <div className="text-xs text-slate-400">Time Played</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">{user?.gamesPlayed || 0}</div>
                    <div className="text-xs text-slate-400">Games Played</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">
                      {user?.gamesPlayed ? ((parseFloat(user?.totalWinnings || "0") / user.gamesPlayed) * 100).toFixed(1) : "0.0"}%
                    </div>
                    <div className="text-xs text-slate-400">Win Rate</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="balance" className="space-y-6">
          <BalanceManager />
        </TabsContent>

        <TabsContent value="stats" className="space-y-6">
          <div className="text-center text-slate-400">
            Player statistics and analytics coming soon...
          </div>
        </TabsContent>

        <TabsContent value="profile" className="space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Profile Information */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <User className="w-5 h-5 mr-2 text-emerald-500" />
                  Profile Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Profile Photo Upload */}
                <div className="text-center">
                  <div className="relative inline-block">
                    <div className="w-24 h-24 sm:w-32 sm:h-32 bg-slate-700 rounded-full flex items-center justify-center border-2 border-slate-600 overflow-hidden">
                      {user?.profilePhoto ? (
                        <img 
                          src={user.profilePhoto} 
                          alt="Profile" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="w-12 h-12 sm:w-16 sm:h-16 text-slate-400" />
                      )}
                    </div>
                    <button 
                      className="absolute bottom-0 right-0 bg-emerald-500 hover:bg-emerald-600 text-white p-2 rounded-full border-2 border-slate-800 transition-colors"
                      onClick={() => document.getElementById('profile-photo-upload')?.click()}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                    <input
                      id="profile-photo-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file && user?.id) {
                          try {
                            // Create a data URL from the file for immediate preview
                            const reader = new FileReader();
                            reader.onload = async (event) => {
                              const dataUrl = event.target?.result as string;
                              
                              // Update profile photo via API
                              const response = await apiRequest('POST', `/api/players/${user.id}/profile-photo`, {
                                photoUrl: dataUrl
                              });
                              
                              if (response.ok) {
                                // Refresh user data to show updated photo
                                queryClient.invalidateQueries({ queryKey: ['/api/players/supabase'] });
                                toast({
                                  title: "Profile Photo Updated",
                                  description: "Your profile photo has been updated successfully",
                                });
                              }
                            };
                            reader.readAsDataURL(file);
                          } catch (error) {
                            toast({
                              title: "Upload Failed",
                              description: "Failed to upload profile photo. Please try again.",
                              variant: "destructive",
                            });
                          }
                        }
                      }}
                    />
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
    </div>
  );
}
