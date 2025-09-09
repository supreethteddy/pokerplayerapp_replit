import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, DollarSign, Play, Phone, X, Eye, ArrowRight } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useGameStatusSync } from "@/hooks/useGameStatusSync";

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
  isLive: boolean;
  sessionStartTime: string;

  // STATE MACHINE PROPERTIES
  sessionPhase: string; // 'MINIMUM_PLAY' | 'CALL_TIME_AVAILABLE' | 'CALL_TIME_ACTIVE' | 'CASH_OUT_WINDOW'
  minPlayTimeCompleted: boolean;
  callTimeAvailable: boolean;
  callTimeActive: boolean;
  callTimeRemaining: number;
  cashOutWindowActive: boolean;
  canCashOut: boolean;
  cashOutTimeRemaining: number;

  // TABLE CONFIGURATION (from poker_tables)
  min_play_time: number;
  call_time_duration: number;
  cash_out_window: number;

  // SEAT REQUEST TIMING (from seat_requests)
  min_play_time_minutes: number;
  call_time_window_minutes: number;
  call_time_play_period_minutes: number;
  cashout_window_minutes: number;
  call_time_started: string | null;
  call_time_ends: string | null;
  cashout_window_active: boolean;
  cashout_window_ends: string | null;
}

interface PlaytimeTrackerProps {
  playerId: string;
  gameStatus?: any; // Add game status for fallback session data
}

export function PlaytimeTracker({ playerId, gameStatus }: PlaytimeTrackerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [liveTimer, setLiveTimer] = useState("00:00:00");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Use centralized synchronization for immediate updates
  const { invalidateAllGameQueries } = useGameStatusSync();

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

        // Use centralized invalidation for immediate synchronization
        invalidateAllGameQueries();
      });

      return () => {
        playerChannel.unbind('timing_rules_updated');
        pusher.unsubscribe(`player-${playerId}`);
        pusher.disconnect();
      };
    }).catch(console.error);
  }, [playerId, toast, queryClient]);

  // Fetch live session data with UNIFIED FAST REFRESH (3 seconds) for immediate synchronization
  const { data: sessionResponse, isLoading, error } = useQuery<{hasActiveSession: boolean, session: LiveSession | null}>({
    queryKey: ['/api/live-sessions', playerId],
    refetchInterval: 3000, // UNIFIED: Fast refresh matching other game status queries
    staleTime: 1000, // Consider fresh for 1 second only for immediate updates
    enabled: !!playerId,
  });

  const session = sessionResponse?.hasActiveSession ? sessionResponse.session : null;

  // FALLBACK LOGIC: If no session from API but gameStatus shows seated, use fallback data
  const fallbackSession = gameStatus?.seatedSessionFallback;
  const hasSeatedPlayerFromFallback = !session && fallbackSession && gameStatus?.isInActiveGame;

  console.log('🎯 [PLAYTIME TRACKER] Session check:', {
    playerId,
    hasApiSession: !!session,
    hasFallbackSession: !!fallbackSession,
    usesFallback: hasSeatedPlayerFromFallback,
    isInActiveGame: gameStatus?.isInActiveGame,
    fallbackData: fallbackSession,
    sessionResponse: sessionResponse?.hasActiveSession,
    shouldRender: (session || hasSeatedPlayerFromFallback)
  });

  // Live timer update with setInterval
  useEffect(() => {
    const startTime = session?.sessionStartTime || fallbackSession?.sessionStartTime;
    if (!startTime) {
      setLiveTimer("00:00:00");
      return;
    }

    const updateLiveTimer = () => {
      const start = new Date(startTime);
      const now = new Date();
      const diff = Math.max(0, now.getTime() - start.getTime()); // Ensure non-negative

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      setLiveTimer(timeString);
    };

    // Update immediately and then every second
    updateLiveTimer();
    const interval = setInterval(updateLiveTimer, 1000);

    return () => clearInterval(interval);
  }, [session?.sessionStartTime, fallbackSession?.sessionStartTime]);

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
    if (!session?.sessionStartTime) return "Session Starting...";

    const start = new Date(session?.sessionStartTime || new Date());
    const now = new Date();
    const diff = Math.max(0, now.getTime() - start.getTime());

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Calculate time until minimum play time (for MINIMUM_PLAY phase)
  const getTimeUntilMinPlay = () => {
    if (!session?.sessionStartTime || session?.minPlayTimeCompleted) return 0;

    const start = new Date(session?.sessionStartTime || new Date());
    const now = new Date();
    const minutesPlayed = (now.getTime() - start.getTime()) / (1000 * 60);
    const timeUntilMinPlay = (session?.min_play_time || session?.min_play_time_minutes || 30) - minutesPlayed;

    return Math.max(0, Math.ceil(timeUntilMinPlay));
  };

  // Get phase-specific status information (works with fallback)
  const getPhaseStatus = () => {
    if (!session && hasSeatedPlayerFromFallback) {
      return { 
        phase: 'Minimum Play Time', 
        description: 'Session tracking starting...', 
        timeRemaining: 0 
      };
    }
    if (!session) return { phase: 'UNKNOWN', description: '', timeRemaining: 0 };

    switch (session?.sessionPhase) {
      case 'MINIMUM_PLAY':
        return {
          phase: 'Minimum Play Time',
          description: `Must play ${session?.min_play_time || session?.min_play_time_minutes || 30} minutes minimum`,
          timeRemaining: getTimeUntilMinPlay()
        };
      case 'CALL_TIME_AVAILABLE':
        return {
          phase: 'Call Time Available',
          description: 'Can request call time',
          timeRemaining: 0
        };
      case 'CALL_TIME_ACTIVE':
        return {
          phase: 'Call Time Active',
          description: `${session?.call_time_duration || session?.call_time_play_period_minutes || 60}-minute countdown running`,
          timeRemaining: session?.callTimeRemaining || 0
        };
      case 'CASH_OUT_WINDOW':
        return {
          phase: 'Cash Out Window',
          description: `${session?.cash_out_window || session?.cashout_window_minutes || 15}-minute window to cash out`,
          timeRemaining: session?.cashOutTimeRemaining || 0
        };
      default:
        return {
          phase: 'Unknown',
          description: 'Session state unclear',
          timeRemaining: 0
        };
    }
  };

  const sessionDuration = getSessionDuration();
  const timeUntilMinPlay = getTimeUntilMinPlay();
  const phaseStatus = getPhaseStatus();


  // Enhanced condition checking: Show PlaytimeTracker if we have a session OR if fallback indicates player is seated
  if (isLoading && !hasSeatedPlayerFromFallback) {
    return null;
  }

  if (error && !hasSeatedPlayerFromFallback) {
    return null;
  }

  // Show PlaytimeTracker if we have an active session OR if fallback data indicates player is seated
  if (!session && !hasSeatedPlayerFromFallback) {
    console.log('🚫 [PLAYTIME TRACKER] Not rendering - no session and no fallback');
    return null;
  }

  console.log('✅ [PLAYTIME TRACKER] Rendering PlaytimeTracker!', { 
    hasSession: !!session, 
    hasFallback: hasSeatedPlayerFromFallback,
    startTime: session?.sessionStartTime || fallbackSession?.sessionStartTime
  });

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
                Live Session - {session?.tableName || fallbackSession?.tableName || 'Poker Table'}
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
                {liveTimer || "00:00:00"}
              </div>
              <div className="text-sm text-slate-400">
                {session?.sessionStartTime || fallbackSession?.sessionStartTime ? "Session Time" : "Session Starting..."}
              </div>
            </div>

            {/* Balance Info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-800/50 p-3 rounded text-center">
                <div className="text-lg font-semibold text-white">₹{(session?.buyInAmount || 1000).toLocaleString()}</div>
                <div className="text-xs text-slate-400">Buy-in</div>
              </div>
              <div className="bg-slate-800/50 p-3 rounded text-center">
                <div className="text-lg font-semibold text-emerald-500">₹{(session?.currentChips || 1000).toLocaleString()}</div>
                <div className="text-xs text-slate-400">Current Chips</div>
              </div>
            </div>

            {/* Table Information */}
            <div className="bg-slate-800/50 p-3 rounded">
              <div className="text-center">
                <div className="text-sm text-slate-400">Table: {session?.tableName || fallbackSession?.tableName || 'Unknown'}</div>
                <div className="text-sm text-slate-300">{session?.gameType || fallbackSession?.gameType || 'Texas Hold\'em'} • {session?.stakes || '₹1000.00/10000.00'}</div>
              </div>
            </div>

            {/* Current Phase Status */}
            <div className="bg-blue-900/20 border border-blue-500/30 p-3 rounded-lg">
              <div className="text-center">
                <div className="text-sm font-medium text-blue-300 mb-1">
                  Current Phase: {phaseStatus.phase}
                </div>
                <div className="text-xs text-blue-400">
                  {phaseStatus.description}
                </div>
                {phaseStatus.timeRemaining > 0 && (
                  <div className="text-lg font-mono font-bold text-blue-200 mt-2">
                    {phaseStatus.timeRemaining} minutes remaining
                  </div>
                )}
              </div>
            </div>

            {/* State Machine Status Indicators */}
            <div className="grid grid-cols-4 gap-2 text-xs">
              {/* Minimum Play Time */}
              <div className={`p-2 rounded ${session?.minPlayTimeCompleted ? 'bg-green-900/50 border border-green-500/50' : 'bg-slate-900/50 border border-slate-500/50'}`}>
                <div className="flex items-center justify-between">
                  <span className={session?.minPlayTimeCompleted ? 'text-green-400' : 'text-slate-400'}>
                    Min Play
                  </span>
                  <span className={session?.minPlayTimeCompleted ? 'text-green-300' : 'text-slate-300'}>
                    {session?.minPlayTimeCompleted ? '✓' : `${session?.minPlayTimeMinutes || 30}m`}
                  </span>
                </div>
                <div className={`mt-1 text-xs ${session?.minPlayTimeCompleted ? 'text-green-300' : 'text-slate-400'}`}>{session?.minPlayTimeCompleted ? 'Completed' : ''}</div>
              </div>

              {/* Call Time Available */}
              <div className={`p-2 rounded ${session?.callTimeAvailable ? 'bg-green-900/50 border border-green-500/50' : 'bg-slate-900/50 border border-slate-500/50'}`}>
                <div className="flex items-center justify-between">
                  <span className={session?.callTimeAvailable ? 'text-green-400' : 'text-slate-400'}>
                    Available
                  </span>
                  <span className={session?.callTimeAvailable ? 'text-green-300' : 'text-slate-300'}>
                    {session?.callTimeAvailable ? '✓' : '✗'}
                  </span>
                </div>
              </div>

              {/* Call Time Active */}
              <div className={`p-2 rounded ${session?.callTimeActive ? 'bg-orange-900/50 border border-orange-500/50' : 'bg-slate-900/50 border border-slate-500/50'}`}>
                <div className="flex items-center justify-between">
                  <span className={session?.callTimeActive ? 'text-orange-400' : 'text-slate-400'}>
                    Active
                  </span>
                  <span className={session?.callTimeActive ? 'text-orange-300' : 'text-slate-300'}>
                    {session?.callTimeActive ? `${session?.callTimeRemaining}m` : '✗'}
                  </span>
                </div>
              </div>

              {/* Cash Out Window */}
              <div className={`p-2 rounded ${
                session?.cashOutWindowActive 
                  ? (session?.cashOutTimeRemaining <= 5 
                      ? 'bg-red-900/50 border border-red-500/50 animate-pulse' 
                      : 'bg-blue-900/50 border border-blue-500/50')
                  : 'bg-slate-900/50 border border-slate-500/50'
              }`}>
                <div className="flex items-center justify-between">
                  <span className={
                    session?.cashOutWindowActive 
                      ? (session?.cashOutTimeRemaining <= 5 ? 'text-red-400' : 'text-blue-400')
                      : 'text-slate-400'
                  }>
                    Cash Out
                  </span>
                  <span className={
                    session?.cashOutWindowActive 
                      ? (session?.cashOutTimeRemaining <= 5 ? 'text-red-300' : 'text-blue-300')
                      : 'text-slate-300'
                  }>
                    {session?.cashOutWindowActive ? `${session?.cashOutTimeRemaining}m` : '✗'}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={async () => {
                  console.log('🎯 [CALL TIME] Starting call time for player:', playerId);
                  try {
                    const response = await apiRequest('POST', '/api/call-time/start', {
                      playerId: parseInt(playerId),
                      sessionId: session?.id
                    });
                    if (response.ok) {
                      queryClient.invalidateQueries({ queryKey: ['/api/live-sessions', playerId] });
                      toast({
                        title: "Call Time Started",
                        description: `Your ${session?.callTimeDurationMinutes || 60}-minute call time has begun.`,
                      });
                    }
                  } catch (error) {
                    console.error('Failed to start call time:', error);
                    toast({
                      title: "Error",
                      description: "Failed to start call time. Please try again.",
                      variant: "destructive"
                    });
                  }
                }}
                disabled={!session?.callTimeAvailable || session?.callTimeActive}
                className={`w-full py-3 ${
                  session?.callTimeAvailable && !session?.callTimeActive
                    ? 'bg-yellow-600 hover:bg-yellow-700 border-yellow-500 text-white'
                    : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                }`}
              >
                <Clock className="w-4 h-4 mr-2" />
                {session?.callTimeActive 
                  ? `Call Time: ${session?.callTimeRemaining || 0}m left`
                  : 'Start Call Time'
                }
              </Button>

              <Button
                onClick={async () => {
                  console.log('🎯 [CASH OUT] Requesting cash out for player:', playerId);
                  try {
                    const response = await apiRequest('POST', '/api/cash-out/request', {
                      playerId: parseInt(playerId),
                      sessionId: session?.id
                    });
                    if (response.ok) {
                      queryClient.invalidateQueries({ queryKey: ['/api/live-sessions', playerId] });
                      toast({
                        title: "Cash Out Requested",
                        description: "Your cash out request has been sent to management.",
                      });
                    }
                  } catch (error) {
                    console.error('Failed to request cash out:', error);
                    toast({
                      title: "Error",
                      description: "Failed to request cash out. Please try again.",
                      variant: "destructive"
                    });
                  }
                }}
                disabled={!session?.canCashOut}
                className={`w-full py-3 ${
                  session?.canCashOut
                    ? 'bg-green-600 hover:bg-green-700 border-green-500 text-white'
                    : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                }`}
              >
                <ArrowRight className="w-4 h-4 mr-2" />
                {session?.canCashOut 
                  ? `Cash Out (${session?.cashOutTimeRemaining || 0}m left)`
                  : 'Cash Out Unavailable'
                }
              </Button>
            </div>

            {/* Action Status */}
            <div className="text-xs text-center bg-slate-800/30 p-3 rounded border border-slate-600">
              {session?.callTimeAvailable && !session?.callTimeActive && (
                <div className="text-yellow-400">
                  <div className="font-medium">⏰ Call Time Available</div>
                  <div className="mt-1 text-xs text-yellow-300">Click to start {session?.callTimeDurationMinutes || 60}-minute countdown. After completion, you'll have {session?.cashOutWindowMinutes || 15} minutes to cash out.</div>
                </div>
              )}
              {session?.callTimeActive && (
                <div className="text-orange-400">
                  <div className="font-medium">🔄 Call Time Active</div>
                  <div className="mt-1 text-xs text-orange-300">Cash out window will open in {session?.callTimeRemaining || 0} minutes</div>
                </div>
              )}
              {session?.canCashOut && (
                <div className="text-green-400">
                  <div className="font-medium">💰 Cash Out Window Open!</div>
                  <div className="mt-1 text-xs text-green-300">You have {session?.cashOutTimeRemaining || 0} minutes to request cash out</div>
                </div>
              )}
              {!session?.callTimeAvailable && !session?.callTimeActive && !session?.canCashOut && (
                <div className="text-slate-300">
                  <div className="font-medium">⏱️ Minimum Play Time</div>
                  <div className="mt-1 text-xs text-slate-400">Complete {session?.minPlayTimeMinutes || 30} minutes before call time becomes available</div>
                </div>
              )}
            </div>

            {/* Table Configuration */}
            <div className="bg-slate-800/50 p-3 rounded text-xs border border-slate-600">
              <div className="font-medium mb-2 flex items-center justify-between text-slate-300">
                <span>Table Configuration:</span>
                <Badge variant="outline" className="text-xs px-2 py-1 bg-blue-900/30 border-blue-500/50 text-blue-300">
                  {session?.sessionPhase}
                </Badge>
              </div>
              <ul className="space-y-1 text-slate-400">
                <li className="flex justify-between">
                  <span>• Minimum play time:</span> 
                  <span className="font-medium text-white">{session?.min_play_time || session?.min_play_time_minutes || 30}m</span>
                </li>
                <li className="flex justify-between">
                  <span>• Call time duration:</span> 
                  <span className="font-medium text-white">{session?.call_time_duration || session?.call_time_play_period_minutes || 60}m</span>
                </li>
                <li className="flex justify-between">
                  <span>• Cash out window:</span> 
                  <span className="font-medium text-white">{session?.cash_out_window || session?.cashout_window_minutes || 15}m</span>
                </li>
              </ul>
              <div className="mt-2 pt-2 border-t border-slate-600 text-xs text-slate-500">
                State Machine: Min Play → Call Time Available → Call Time Active → Cash Out Window
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}