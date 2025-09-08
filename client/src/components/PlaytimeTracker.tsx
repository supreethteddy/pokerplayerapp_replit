import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, DollarSign, Play, Phone, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface LiveSession {
  id: number;
  playerId: number;
  tableId: string;
  tableName: string;
  gameType: string;
  stakes: string;
  buyInAmount: number;
  currentChips: number;
  sessionDuration: number;
  startedAt: string;
  status: string;
  minPlayTimeMinutes: number;
  callTimeWindowMinutes: number;
  callTimePlayPeriodMinutes: number;
  cashoutWindowMinutes: number;
  minPlayTimeCompleted: boolean;
  callTimeEligible: boolean;
  canCashOut: boolean;
  isLive: boolean;
  sessionStartTime: string;
  
  // Enhanced cashout window properties (from backend calculations)
  cashoutWindowStartMinutes: number;
  cashoutWindowEndMinutes: number;
  inCashoutWindow: boolean;
  cashoutTimeRemaining: number;
}

interface PlaytimeTrackerProps {
  playerId: string;
}

export function PlaytimeTracker({ playerId }: PlaytimeTrackerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Listen for real-time timing rule updates from staff portal
  useEffect(() => {
    if (!playerId) return;

    // Import Pusher asynchronously for real-time synchronization
    import('pusher-js').then(({ default: Pusher }) => {
      const pusher = new Pusher(import.meta.env.VITE_PUSHER_KEY, {
        cluster: import.meta.env.VITE_PUSHER_CLUSTER,
      });

      const playerChannel = pusher.subscribe(`player-${playerId}`);
      
      // Listen for timing rule updates with nanosecond-level sync
      playerChannel.bind('timing_rules_updated', (data: any) => {
        console.log('🔧 [TIMING RULES] Staff updated table rules:', data);
        
        // Show immediate notification to player
        toast({
          title: "Table Rules Updated",
          description: `${data.tableName}: Timing rules changed by ${data.updatedBy}`,
          variant: "default",
        });

        // Invalidate session query to fetch updated timing configuration
        queryClient.invalidateQueries({ queryKey: ['/api/live-sessions', playerId] });
      });

      return () => {
        playerChannel.unbind('timing_rules_updated');
        pusher.unsubscribe(`player-${playerId}`);
        pusher.disconnect();
      };
    }).catch(console.error);
  }, [playerId, toast, queryClient]);

  // Fetch live session data with proper response structure
  const { data: sessionResponse, isLoading, error } = useQuery<{hasActiveSession: boolean, session: LiveSession | null}>({
    queryKey: ['/api/live-sessions', playerId],
    refetchInterval: 1000, // Update every second for real-time tracking
    enabled: !!playerId,
  });

  const session = sessionResponse?.hasActiveSession ? sessionResponse.session : null;

  // Call Time mutation
  const callTimeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/live-sessions/${playerId}/call-time`);
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Call Time Activated",
        description: "You have initiated call time. Complete your current hand within the time limit.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/live-sessions', playerId] });
    },
    onError: (error: any) => {
      toast({
        title: "Call Time Failed",
        description: error.message || "Failed to activate call time",
        variant: "destructive",
      });
    },
  });

  // Cash Out mutation
  const cashOutMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/live-sessions/${playerId}/cash-out`);
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Cash Out Initiated",
        description: "Your cash out request has been sent to staff for processing.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/live-sessions', playerId] });
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Cash Out Failed",
        description: error.message || "Failed to initiate cash out",
        variant: "destructive",
      });
    },
  });

  // Auto-open dialog when session becomes active (only once)
  const [hasAutoOpened, setHasAutoOpened] = useState(false);
  useEffect(() => {
    if (session?.isLive && !isDialogOpen && !hasAutoOpened) {
      setIsDialogOpen(true);
      setHasAutoOpened(true);
    }
    // Reset auto-open flag when session ends
    if (!session?.isLive) {
      setHasAutoOpened(false);
    }
  }, [session?.isLive, isDialogOpen, hasAutoOpened]);

  // Calculate session duration
  const getSessionDuration = () => {
    if (!session?.sessionStartTime) return "00:00:00";
    
    const start = new Date(session.sessionStartTime);
    const now = new Date();
    const diff = now.getTime() - start.getTime();
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Calculate time until call time available
  const getTimeUntilCallTime = () => {
    if (!session?.sessionStartTime || session.callTimeEligible) return 0;
    
    const start = new Date(session.sessionStartTime);
    const now = new Date();
    const minutesPlayed = (now.getTime() - start.getTime()) / (1000 * 60);
    const timeUntilCallTime = session.callTimeWindowMinutes - minutesPlayed;
    
    return Math.max(0, Math.ceil(timeUntilCallTime));
  };

  // Calculate cashout window timing using enhanced backend data
  const getCashoutWindowStatus = () => {
    if (!session) return { inWindow: false, timeRemaining: 0, timeUntilWindow: 0 };
    
    // Use backend's real-time calculations with dynamic timing rules
    const inWindow = session.inCashoutWindow || false;
    const timeRemaining = session.cashoutTimeRemaining || 0;
    
    // Calculate time until window opens if not in window and before start time
    let timeUntilWindow = 0;
    if (!inWindow && session.sessionStartTime) {
      const start = new Date(session.sessionStartTime);
      const now = new Date();
      const minutesPlayed = (now.getTime() - start.getTime()) / (1000 * 60);
      const windowStartTime = session.cashoutWindowStartMinutes || session.minPlayTimeMinutes || 30;
      
      if (minutesPlayed < windowStartTime) {
        timeUntilWindow = Math.ceil(windowStartTime - minutesPlayed);
      }
    }
    
    return { inWindow, timeRemaining, timeUntilWindow };
  };

  const sessionDuration = getSessionDuration();
  const timeUntilCallTime = getTimeUntilCallTime();
  const cashoutStatus = getCashoutWindowStatus();
  
  // Calculate time until minimum play time is completed
  const getTimeUntilMinPlay = () => {
    if (!session?.sessionStartTime || session.minPlayTimeCompleted) return 0;
    
    const start = new Date(session.sessionStartTime);
    const now = new Date();
    const minutesPlayed = (now.getTime() - start.getTime()) / (1000 * 60);
    const timeUntilMinPlay = session.minPlayTimeMinutes - minutesPlayed;
    
    return Math.max(0, Math.ceil(timeUntilMinPlay));
  };
  
  const timeUntilMinPlay = getTimeUntilMinPlay();

  // Don't render if no session or not loading
  if (isLoading) {
    return null;
  }

  if (error || !session?.isLive) {
    return null;
  }

  return (
    <>
      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => setIsDialogOpen(true)}
          className="w-16 h-16 rounded-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 shadow-lg hover:shadow-emerald-500/25 transition-all duration-300"
        >
          <Play className="h-6 w-6" />
        </Button>
      </div>

      {/* Session Details Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md bg-slate-900 border-slate-700">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-white flex items-center">
                <Clock className="h-5 w-5 mr-2 text-emerald-500" />
                Live Session - {session.tableName}
              </DialogTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsDialogOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          <div className="space-y-4">
            {/* Session Timer */}
            <div className="text-center bg-slate-800 p-4 rounded-lg">
              <div className="text-2xl font-mono font-bold text-white mb-1">
                {sessionDuration}
              </div>
              <div className="text-sm text-slate-400">Session Time</div>
            </div>

            {/* Balance Info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-800/50 p-3 rounded text-center">
                <div className="text-lg font-semibold text-white">₹{session.buyInAmount.toLocaleString()}</div>
                <div className="text-xs text-slate-400">Buy-in</div>
              </div>
              <div className="bg-slate-800/50 p-3 rounded text-center">
                <div className="text-lg font-semibold text-emerald-500">₹{session.currentChips.toLocaleString()}</div>
                <div className="text-xs text-slate-400">Current Chips</div>
              </div>
            </div>

            {/* Table Information */}
            <div className="bg-slate-800/50 p-3 rounded">
              <div className="text-center">
                <div className="text-sm text-slate-400">Table: {session.tableName}</div>
                <div className="text-sm text-slate-300">{session.gameType} • {session.stakes}</div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3">
              {/* Call Time Button */}
              <Button
                onClick={() => callTimeMutation.mutate()}
                disabled={!session.callTimeEligible || callTimeMutation.isPending}
                className="flex-1 bg-orange-600 hover:bg-orange-700 disabled:opacity-50"
              >
                <Phone className="h-4 w-4 mr-2" />
                {session.callTimeEligible ? 'Call Time' : `Call Time in ${timeUntilCallTime}m`}
              </Button>

              {/* Cash Out Button - Only shows during window */}
              {cashoutStatus.inWindow ? (
                <Button
                  onClick={() => cashOutMutation.mutate()}
                  disabled={cashOutMutation.isPending}
                  className={`flex-1 ${
                    cashoutStatus.timeRemaining <= 5 
                      ? 'bg-red-600 hover:bg-red-700 animate-pulse' 
                      : 'bg-green-600 hover:bg-green-700'
                  } transition-all duration-300`}
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Cash Out ({cashoutStatus.timeRemaining}m left)
                </Button>
              ) : (
                <Button
                  disabled={true}
                  className="flex-1 bg-gray-600 opacity-50 cursor-not-allowed"
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  {cashoutStatus.timeUntilWindow > 0 
                    ? `Cash Out in ${cashoutStatus.timeUntilWindow}m`
                    : 'Cash Out Window Closed'
                  }
                </Button>
              )}
            </div>

            {/* Enhanced Status Indicators with Cashout Window */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className={`p-2 rounded ${session.minPlayTimeCompleted ? 'bg-green-900/50 border border-green-500/50' : 'bg-red-900/50 border border-red-500/50'}`}>
                <div className="flex items-center justify-between">
                  <span className={session.minPlayTimeCompleted ? 'text-green-400' : 'text-red-400'}>
                    Min Play
                  </span>
                  <span className={session.minPlayTimeCompleted ? 'text-green-300' : 'text-red-300'}>
                    {session.minPlayTimeCompleted ? '✓' : `${timeUntilMinPlay}m`}
                  </span>
                </div>
              </div>
              <div className={`p-2 rounded ${session.callTimeEligible ? 'bg-green-900/50 border border-green-500/50' : 'bg-yellow-900/50 border border-yellow-500/50'}`}>
                <div className="flex items-center justify-between">
                  <span className={session.callTimeEligible ? 'text-green-400' : 'text-yellow-400'}>
                    Call Time
                  </span>
                  <span className={session.callTimeEligible ? 'text-green-300' : 'text-yellow-300'}>
                    {session.callTimeEligible ? '✓' : `${timeUntilCallTime}m`}
                  </span>
                </div>
              </div>
              <div className={`p-2 rounded ${
                cashoutStatus.inWindow 
                  ? (cashoutStatus.timeRemaining <= 5 
                      ? 'bg-red-900/50 border border-red-500/50 animate-pulse' 
                      : 'bg-green-900/50 border border-green-500/50')
                  : 'bg-gray-900/50 border border-gray-500/50'
              }`}>
                <div className="flex items-center justify-between">
                  <span className={
                    cashoutStatus.inWindow 
                      ? (cashoutStatus.timeRemaining <= 5 ? 'text-red-400' : 'text-green-400')
                      : 'text-gray-400'
                  }>
                    Cashout
                  </span>
                  <span className={
                    cashoutStatus.inWindow 
                      ? (cashoutStatus.timeRemaining <= 5 ? 'text-red-300' : 'text-green-300')
                      : 'text-gray-300'
                  }>
                    {cashoutStatus.inWindow 
                      ? `${cashoutStatus.timeRemaining}m` 
                      : (cashoutStatus.timeUntilWindow > 0 ? `${cashoutStatus.timeUntilWindow}m` : '✗')
                    }
                  </span>
                </div>
              </div>
            </div>

            {/* Dynamic Timing Rules with Real-Time Updates */}
            <div className="bg-gray-800/50 p-3 rounded text-xs text-gray-400 border border-gray-700">
              <div className="font-medium mb-2 flex items-center justify-between">
                <span>Staff-Configurable Timing Rules:</span>
                <Badge variant="outline" className="text-xs px-2 py-1 bg-blue-900/30 border-blue-500/50 text-blue-300">
                  Live
                </Badge>
              </div>
              <ul className="space-y-1">
                <li className="flex justify-between">
                  <span>• Minimum play time:</span> 
                  <span className="font-medium text-white">{session.minPlayTimeMinutes}m</span>
                </li>
                <li className="flex justify-between">
                  <span>• Call time window:</span> 
                  <span className="font-medium text-white">{session.callTimeWindowMinutes}m</span>
                </li>
                <li className="flex justify-between">
                  <span>• Call time duration:</span> 
                  <span className="font-medium text-white">{session.callTimePlayPeriodMinutes}m</span>
                </li>
                <li className="flex justify-between">
                  <span>• Cashout window:</span> 
                  <span className="font-medium text-white">{session.cashoutWindowMinutes}m</span>
                </li>
              </ul>
              <div className="mt-2 pt-2 border-t border-gray-700 text-xs text-gray-500">
                Cashout window: {session.cashoutWindowStartMinutes}m - {session.cashoutWindowEndMinutes}m
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}