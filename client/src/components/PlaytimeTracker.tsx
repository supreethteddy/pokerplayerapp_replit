import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Clock, 
  Play, 
  DollarSign, 
  AlertTriangle, 
  CheckCircle, 
  Timer, 
  Coins, 
  TrendingUp,
  History,
  Award,
  Target,
  X,
  Maximize2
} from "lucide-react";

interface PlaytimeTrackerProps {
  playerId: number;
}

interface LiveSession {
  id: string;
  player_id: number;
  table_id: string;
  table: {
    id: string;
    name: string;
    game_type: string;
    stakes: string;
    max_players: number;
    current_players: number;
  };
  buy_in_amount: number;
  current_chips: number;
  sessionDurationMinutes: number;
  profitLoss: number;
  minPlayTimeMinutes: number;
  callTimeWindowMinutes: number;
  callTimePlayPeriodMinutes: number;
  cashoutWindowMinutes: number;
  minPlayTimeCompleted: boolean;
  callTimeEligible: boolean;
  canCashOut: boolean;
  sessionStartTime: string;
  status: 'active' | 'completed';
}

export default function PlaytimeTracker({ playerId }: PlaytimeTrackerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [callTimeActive, setCallTimeActive] = useState(false);
  const [callTimeEnd, setCallTimeEnd] = useState<Date | null>(null);
  
  // Fetch live session data
  const { data: liveSessionData, isLoading: sessionLoading, refetch: refetchSession } = useQuery({
    queryKey: ['/api/live-sessions', playerId],
    enabled: !!playerId,
    refetchInterval: 10000, // Update every 10 seconds
  });

  const session: LiveSession | null = liveSessionData?.hasActiveSession ? liveSessionData.session : null;

  // Timer states
  const [currentTime, setCurrentTime] = useState(new Date());
  const [timeUntilMinPlay, setTimeUntilMinPlay] = useState(0);
  const [timeUntilCallTime, setTimeUntilCallTime] = useState(0);
  const [callTimeRemaining, setCallTimeRemaining] = useState(0);

  // Update timer every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
      updateTimers();
    }, 1000);

    return () => clearInterval(interval);
  }, [session]);

  // Show modal when session becomes active
  useEffect(() => {
    if (session && !showSessionModal) {
      setShowSessionModal(true);
    }
  }, [session]);

  // Calculate timer values
  const updateTimers = () => {
    if (!session?.sessionStartTime) return;

    const sessionStart = new Date(session.sessionStartTime);
    const now = new Date();
    const sessionDuration = Math.floor((now.getTime() - sessionStart.getTime()) / 1000 / 60); // in minutes

    // Time until minimum play time is completed
    const minPlayComplete = sessionDuration >= (session.minPlayTimeMinutes || 30);
    setTimeUntilMinPlay(minPlayComplete ? 0 : (session.minPlayTimeMinutes || 30) - sessionDuration);

    // Time until call time window opens
    const callTimeWindowOpen = sessionDuration >= (session.callTimeWindowMinutes || 45);
    setTimeUntilCallTime(callTimeWindowOpen ? 0 : (session.callTimeWindowMinutes || 45) - sessionDuration);

    // Call time countdown
    if (callTimeActive && callTimeEnd) {
      const remaining = Math.max(0, Math.floor((callTimeEnd.getTime() - now.getTime()) / 1000 / 60));
      setCallTimeRemaining(remaining);
      
      if (remaining === 0) {
        setCallTimeActive(false);
        setCallTimeEnd(null);
      }
  };

  // Call Time Button Handler
  const callTimeMutation = useMutation({
    mutationFn: () => apiRequest(`/api/live-sessions/${playerId}/call-time`, {
      method: 'POST',
      body: JSON.stringify({})
    }),
    onSuccess: (data) => {
      setCallTimeActive(true);
      setCallTimeEnd(new Date(data.callTimeEnd));
      toast({
        title: "Call Time Started",
        description: data.message,
      });
      refetchSession();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start call time",
        variant: "destructive",
      });
    }
  });

  // Cash Out Button Handler
  const cashOutMutation = useMutation({
    mutationFn: () => apiRequest(`/api/live-sessions/${playerId}/cash-out`, {
      method: 'POST',
      body: JSON.stringify({ staffId: 'player_portal' })
    }),
    onSuccess: (data) => {
      toast({
        title: "Cash Out Successful",
        description: data.message,
      });
      setShowSessionModal(false);
      refetchSession();
      queryClient.invalidateQueries({ queryKey: ['/api/balance', playerId] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to process cash out",
        variant: "destructive",
      });
    }
  });

  // Format time display
  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString()}`;
  };

  if (sessionLoading) {
    return (
      <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Timer className="h-5 w-5" />
            Live Session Tracker
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-400">Loading session data...</div>
        </CardContent>
      </Card>
    );
  }

  if (!session) {
    return (
      <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Timer className="h-5 w-5" />
            Live Session Tracker
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-400">
            <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No active session</p>
            <p className="text-sm">Join a table to start tracking your playtime</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Compact Live Session Indicator */}
      <Card className="bg-gradient-to-br from-green-900 to-green-800 border-green-600 cursor-pointer" 
            onClick={() => setShowSessionModal(true)}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-green-100 font-medium">LIVE SESSION</span>
              </div>
              <Badge variant="secondary" className="bg-green-700 text-green-100">
                {session.table.name}
              </Badge>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-green-100 text-sm">Playing Time</div>
                <div className="text-green-100 font-bold">{formatTime(session.sessionDurationMinutes)}</div>
              </div>
              <Maximize2 className="h-4 w-4 text-green-300" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Animated Session Modal */}
      <Dialog open={showSessionModal} onOpenChange={setShowSessionModal}>
        <DialogContent className="max-w-2xl bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 bg-green-400 rounded-full animate-pulse"></div>
                <span>Live Session - {session.table.name}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowSessionModal(false)}>
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Table Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-800 p-4 rounded-lg">
                <div className="text-gray-400 text-sm">Table</div>
                <div className="font-bold">{session.table.name}</div>
                <div className="text-sm text-gray-300">{session.table.game_type}</div>
              </div>
              <div className="bg-gray-800 p-4 rounded-lg">
                <div className="text-gray-400 text-sm">Stakes</div>
                <div className="font-bold">{session.table.stakes}</div>
                <div className="text-sm text-gray-300">{session.table.current_players}/{session.table.max_players} players</div>
              </div>
            </div>

            {/* Session Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-blue-900/20 p-4 rounded-lg text-center">
                <Coins className="h-6 w-6 mx-auto mb-2 text-blue-400" />
                <div className="text-blue-400 text-sm">Buy-in</div>
                <div className="font-bold text-lg">{formatCurrency(session.buy_in_amount)}</div>
              </div>
              <div className="bg-yellow-900/20 p-4 rounded-lg text-center">
                <DollarSign className="h-6 w-6 mx-auto mb-2 text-yellow-400" />
                <div className="text-yellow-400 text-sm">Current Chips</div>
                <div className="font-bold text-lg">{formatCurrency(session.current_chips)}</div>
              </div>
              <div className={`p-4 rounded-lg text-center ${session.profitLoss >= 0 ? 'bg-green-900/20' : 'bg-red-900/20'}`}>
                <TrendingUp className={`h-6 w-6 mx-auto mb-2 ${session.profitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`} />
                <div className={`text-sm ${session.profitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>P&L</div>
                <div className="font-bold text-lg">{formatCurrency(session.profitLoss)}</div>
              </div>
            </div>

            {/* Timer Display */}
            <div className="bg-gray-800 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-400" />
                  <span className="font-medium">Session Time</span>
                </div>
                <div className="text-2xl font-bold text-blue-400">
                  {formatTime(session.sessionDurationMinutes)}
                </div>
              </div>
              
              {/* Min Play Time Progress */}
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                  <span>Minimum Play Time</span>
                  <span>{session.minPlayTimeCompleted ? 'Completed' : `${timeUntilMinPlay}m remaining`}</span>
                </div>
                <Progress 
                  value={Math.min(100, (session.sessionDurationMinutes / session.minPlayTimeMinutes) * 100)}
                  className="h-2"
                />
              </div>

              {/* Call Time Progress */}
              {callTimeActive && (
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-orange-400">Call Time Active</span>
                    <span className="text-orange-400">{callTimeRemaining}m remaining</span>
                  </div>
                  <Progress 
                    value={(callTimeRemaining / session.callTimePlayPeriodMinutes) * 100}
                    className="h-2 bg-orange-900"
                  />
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              {/* Call Time Button */}
              <Button
                onClick={() => callTimeMutation.mutate()}
                disabled={!session.callTimeEligible || callTimeActive || callTimeMutation.isPending}
                className="flex-1 bg-orange-600 hover:bg-orange-700 disabled:opacity-50"
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                {callTimeActive ? `Call Time Active (${callTimeRemaining}m)` : 
                 session.callTimeEligible ? 'Start Call Time' : 
                 `Call Time in ${timeUntilCallTime}m`}
              </Button>

              {/* Cash Out Button */}
              <Button
                onClick={() => cashOutMutation.mutate()}
                disabled={!session.canCashOut || cashOutMutation.isPending}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50"
              >
                <DollarSign className="h-4 w-4 mr-2" />
                {session.canCashOut ? 'Cash Out' : `Cash Out in ${timeUntilMinPlay}m`}
              </Button>
            </div>

            {/* Session Rules */}
            <div className="bg-gray-800/50 p-3 rounded text-xs text-gray-400">
              <div className="font-medium mb-2">Session Rules:</div>
              <ul className="space-y-1">
                <li>• Minimum play time: {session.minPlayTimeMinutes} minutes</li>
                <li>• Call time available after: {session.callTimeWindowMinutes} minutes</li>
                <li>• Call time duration: {session.callTimePlayPeriodMinutes} minutes</li>
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

      {/* Session Ledger */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <History className="w-5 h-5 mr-2 text-purple-500" />
            Session Activity Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ledgerLoading ? (
            <div className="text-center text-slate-400 py-4">Loading session history...</div>
          ) : sessionLedger && sessionLedger.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {sessionLedger.map((entry: any, index: number) => (
                <div key={index} className="flex justify-between items-center p-3 bg-slate-900/50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`w-2 h-2 rounded-full ${
                      entry.type === 'buy_in' ? 'bg-green-500' :
                      entry.type === 'cash_out' ? 'bg-blue-500' :
                      entry.type === 'rake' ? 'bg-red-500' :
                      entry.type === 'tip' ? 'bg-yellow-500' :
                      'bg-gray-500'
                    }`} />
                    <div>
                      <div className="text-white text-sm font-medium">{entry.description}</div>
                      <div className="text-slate-400 text-xs">{new Date(entry.createdAt).toLocaleTimeString()}</div>
                    </div>
                  </div>
                  <div className={`text-sm font-bold ${
                    entry.type === 'buy_in' ? 'text-green-400' :
                    entry.type === 'cash_out' ? 'text-blue-400' :
                    'text-red-400'
                  }`}>
                    {entry.type === 'buy_in' ? '+' : entry.type === 'cash_out' ? '+' : '-'}₹{entry.amount}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-slate-400 py-4">
              <Award className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No session activity yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}