import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  Target
} from "lucide-react";

interface PlaytimeTrackerProps {
  playerId: number;
  currentSession?: any; // Current active session from seatRequests
}

interface SessionTimer {
  sessionStartTime: string;
  minPlayTimeMinutes: number;
  callTimeWindowMinutes: number;
  callTimePlayPeriodMinutes: number;
  cashoutWindowMinutes: number;
  callTimeStarted?: string;
  callTimeEnds?: string;
  cashoutWindowActive: boolean;
  cashoutWindowEnds?: string;
}

export default function PlaytimeTracker({ playerId, currentSession }: PlaytimeTrackerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Timer states
  const [currentTime, setCurrentTime] = useState(new Date());
  const [timeUntilMinPlay, setTimeUntilMinPlay] = useState(0);
  const [timeUntilCallTime, setTimeUntilCallTime] = useState(0);
  const [callTimeRemaining, setCallTimeRemaining] = useState(0);
  const [cashoutTimeRemaining, setCashoutTimeRemaining] = useState(0);

  // Update timer every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
      updateTimers();
    }, 1000);

    return () => clearInterval(interval);
  }, [currentSession]);

  // Calculate timer values
  const updateTimers = () => {
    if (!currentSession?.sessionStartTime) return;

    const sessionStart = new Date(currentSession.sessionStartTime);
    const now = new Date();
    const sessionDuration = Math.floor((now.getTime() - sessionStart.getTime()) / 1000 / 60); // in minutes

    // Time until minimum play time is completed
    const minPlayComplete = sessionDuration >= (currentSession.minPlayTimeMinutes || 30);
    setTimeUntilMinPlay(minPlayComplete ? 0 : (currentSession.minPlayTimeMinutes || 30) - sessionDuration);

    // Call time logic
    if (currentSession.callTimeStarted && currentSession.callTimeEnds) {
      const callTimeEnd = new Date(currentSession.callTimeEnds);
      const remaining = Math.floor((callTimeEnd.getTime() - now.getTime()) / 1000 / 60);
      setCallTimeRemaining(Math.max(0, remaining));
    }

    // Cashout window logic
    if (currentSession.cashoutWindowActive && currentSession.cashoutWindowEnds) {
      const cashoutEnd = new Date(currentSession.cashoutWindowEnds);
      const remaining = Math.floor((cashoutEnd.getTime() - now.getTime()) / 1000 / 60);
      setCashoutTimeRemaining(Math.max(0, remaining));
    }
  };

  // Fetch session ledger/account history
  const { data: sessionLedger, isLoading: ledgerLoading } = useQuery({
    queryKey: ['/api/session-ledger', playerId, currentSession?.id],
    enabled: !!playerId && !!currentSession?.id,
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Start call time mutation
  const startCallTimeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/session/start-call-time', {
        sessionId: currentSession.id,
        playerId: playerId
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Call Time Started",
        description: `You have ${currentSession.callTimeWindowMinutes || 10} minutes to call time`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/seat-requests'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start call time",
        variant: "destructive",
      });
    },
  });

  // Cash out mutation
  const cashOutMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/session/cash-out', {
        sessionId: currentSession.id,
        playerId: playerId
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Cash Out Successful",
        description: "Your session has been ended and cash out processed",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/seat-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/balance'] });
    },
    onError: (error: any) => {
      toast({
        title: "Cash Out Failed",
        description: error.message || "Failed to process cash out",
        variant: "destructive",
      });
    },
  });

  if (!currentSession) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <Clock className="w-5 h-5 mr-2 text-blue-500" />
            Play Time Tracker
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-slate-400 py-8">
            <Play className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No active session</p>
            <p className="text-sm mt-2">Join a table to start tracking play time</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const sessionStart = new Date(currentSession.sessionStartTime);
  const sessionDuration = Math.floor((currentTime.getTime() - sessionStart.getTime()) / 1000 / 60);
  const minPlayProgress = Math.min(100, (sessionDuration / (currentSession.minPlayTimeMinutes || 30)) * 100);
  const canCallTime = sessionDuration >= (currentSession.minPlayTimeMinutes || 30);
  const isCallTimeActive = currentSession.callTimeStarted && callTimeRemaining > 0;
  const canCashOut = currentSession.cashoutWindowActive && cashoutTimeRemaining > 0;

  return (
    <div className="space-y-4">
      {/* Main Timer Card */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center justify-between">
            <div className="flex items-center">
              <Clock className="w-5 h-5 mr-2 text-blue-500" />
              Play Time Tracker
            </div>
            <Badge className={`${
              canCallTime ? 'bg-green-600' : 'bg-yellow-600'
            }`}>
              {canCallTime ? 'Eligible for Call Time' : 'Minimum Play Required'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Session Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-slate-400">Table</div>
              <div className="text-white font-semibold">{currentSession.tableName || 'Unknown'}</div>
            </div>
            <div>
              <div className="text-slate-400">Session Duration</div>
              <div className="text-white font-semibold">{Math.floor(sessionDuration / 60)}h {sessionDuration % 60}m</div>
            </div>
          </div>

          {/* Minimum Play Time Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Minimum Play Time</span>
              <span className="text-white">{timeUntilMinPlay > 0 ? `${timeUntilMinPlay}m remaining` : 'Complete'}</span>
            </div>
            <Progress value={minPlayProgress} className="h-2" />
          </div>

          {/* Call Time Section */}
          {canCallTime && !isCallTimeActive && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-white font-semibold">Call Time Available</span>
                <Button
                  onClick={() => startCallTimeMutation.mutate()}
                  disabled={startCallTimeMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700"
                  size="sm"
                >
                  <Timer className="w-4 h-4 mr-2" />
                  Start Call Time
                </Button>
              </div>
            </div>
          )}

          {/* Active Call Time */}
          {isCallTimeActive && (
            <div className="space-y-3 p-4 bg-blue-900/30 rounded-lg border border-blue-500/30">
              <div className="flex items-center justify-between">
                <span className="text-blue-400 font-semibold flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Call Time Active
                </span>
                <Badge className="bg-blue-600">{callTimeRemaining}m remaining</Badge>
              </div>
              <div className="text-sm text-blue-300">
                You have {callTimeRemaining} minutes to continue playing or request cashout
              </div>
            </div>
          )}

          {/* Cashout Window */}
          {canCashOut && (
            <div className="space-y-3 p-4 bg-green-900/30 rounded-lg border border-green-500/30">
              <div className="flex items-center justify-between">
                <span className="text-green-400 font-semibold flex items-center">
                  <DollarSign className="w-4 h-4 mr-2" />
                  Cashout Window Open
                </span>
                <Badge className="bg-green-600">{cashoutTimeRemaining}m remaining</Badge>
              </div>
              <Button
                onClick={() => cashOutMutation.mutate()}
                disabled={cashOutMutation.isPending}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                <Coins className="w-4 h-4 mr-2" />
                Cash Out Now
              </Button>
            </div>
          )}

          {/* Session Financial Summary */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-slate-900/50 rounded-lg">
            <div className="text-center">
              <div className="text-slate-400 text-sm">Session Buy-in</div>
              <div className="text-green-400 font-bold">₹{currentSession.sessionBuyInAmount || '0.00'}</div>
            </div>
            <div className="text-center">
              <div className="text-slate-400 text-sm">Current Chips</div>
              <div className="text-blue-400 font-bold">₹{(parseFloat(currentSession.sessionBuyInAmount || '0') - parseFloat(currentSession.sessionRakeAmount || '0') - parseFloat(currentSession.sessionTipAmount || '0')).toFixed(2)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

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