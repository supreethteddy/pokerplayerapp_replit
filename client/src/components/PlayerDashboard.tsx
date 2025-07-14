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
  Activity
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import type { Table as TableType, SeatRequest, PlayerPrefs } from "@shared/schema";
import BalanceManager from "./BalanceManager";
import HealthMonitor from "./HealthMonitor";

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
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center">
              <Spade className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Player Dashboard</h1>
              <p className="text-sm text-slate-400">
                Welcome back, <span className="text-emerald-400">{user?.firstName} {user?.lastName}</span>
                <span className="ml-2 text-slate-500">|</span>
                <span className="ml-2 text-emerald-400">Balance: ₹{parseFloat(user?.balance || "0").toFixed(2)}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Call Time Countdown (if seated) */}
            {user && (
              <div className="bg-red-500/20 text-red-300 px-3 py-1 rounded-full text-sm font-mono border border-red-500/30">
                <Clock className="w-4 h-4 inline mr-1" />
                <span>{callTime}</span>
              </div>
            )}
            
            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
              <User className="w-5 h-5" />
            </Button>
            
            <Button variant="ghost" size="icon" onClick={signOut} className="text-slate-400 hover:text-white">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <Tabs defaultValue="tables" className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-slate-800 border-slate-700 mb-6">
            <TabsTrigger value="tables" className="flex items-center gap-2">
              <Table className="w-4 h-4" />
              Tables
            </TabsTrigger>
            <TabsTrigger value="balance" className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Balance
            </TabsTrigger>
            <TabsTrigger value="stats" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Stats
            </TabsTrigger>
            <TabsTrigger value="health" className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Health
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tables" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                        className="bg-slate-700 rounded-lg p-4 border border-slate-600 hover:border-emerald-500/50 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                            <div>
                              <h3 className="font-semibold text-white">{table.name} - {table.gameType}</h3>
                              <p className="text-sm text-slate-400">{table.stakes} Stakes</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-slate-400">Players</div>
                            <div className="text-white font-semibold flex items-center">
                              <Users className="w-4 h-4 mr-1" />
                              {table.currentPlayers}/{table.maxPlayers}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="text-sm">
                              <span className="text-slate-400">Pot:</span>
                              <span className="text-emerald-400 font-semibold ml-1">₹{table.pot}</span>
                            </div>
                            <div className="text-sm">
                              <span className="text-slate-400">Avg. Stack:</span>
                              <span className="text-white font-semibold ml-1">₹{table.avgStack}</span>
                            </div>
                          </div>
                          <Button 
                            onClick={() => joinWaitListMutation.mutate(table.id)}
                            disabled={joinWaitListMutation.isPending}
                            className="bg-emerald-500 hover:bg-emerald-600"
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
          <div className="space-y-6">
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

        <TabsContent value="health" className="space-y-6">
          <HealthMonitor />
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}
