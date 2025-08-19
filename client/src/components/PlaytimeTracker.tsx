import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, DollarSign, Play, Phone, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface LiveSession {
  id: string;
  playerId: string;
  tableId: string;
  tableName: string;
  buyInAmount: number;
  currentBalance: number;
  sessionStartTime: string;
  isActive: boolean;
  canCallTime: boolean;
  canCashOut: boolean;
  minPlayTimeMinutes: number;
  callTimeWindowMinutes: number;
  callTimePlayPeriodMinutes: number;
  callTimeEndTime?: string;
  isInCallTime: boolean;
}

interface PlaytimeTrackerProps {
  playerId: string;
}

export function PlaytimeTracker({ playerId }: PlaytimeTrackerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch live session data
  const { data: session, isLoading, error } = useQuery<LiveSession>({
    queryKey: ['/api/live-session', playerId],
    refetchInterval: 1000, // Update every second for real-time tracking
    enabled: !!playerId,
  });

  // Call Time mutation
  const callTimeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/live-session/${playerId}/call-time`, {
        method: 'POST',
      });
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Call Time Activated",
        description: "You have initiated call time. Complete your current hand within the time limit.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/live-session', playerId] });
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
      const response = await apiRequest(`/api/live-session/${playerId}/cash-out`, {
        method: 'POST',
      });
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Cash Out Initiated",
        description: "Your cash out request has been sent to staff for processing.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/live-session', playerId] });
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

  // Auto-open dialog when session becomes active
  useEffect(() => {
    if (session?.isActive && !isDialogOpen) {
      setIsDialogOpen(true);
    }
  }, [session?.isActive, isDialogOpen]);

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
    if (!session?.sessionStartTime || session.canCallTime) return 0;
    
    const start = new Date(session.sessionStartTime);
    const now = new Date();
    const minutesPlayed = (now.getTime() - start.getTime()) / (1000 * 60);
    const timeUntilCallTime = session.callTimeWindowMinutes - minutesPlayed;
    
    return Math.max(0, Math.ceil(timeUntilCallTime));
  };

  // Calculate time until cash out available
  const getTimeUntilCashOut = () => {
    if (!session?.sessionStartTime || session.canCashOut) return 0;
    
    const start = new Date(session.sessionStartTime);
    const now = new Date();
    const minutesPlayed = (now.getTime() - start.getTime()) / (1000 * 60);
    const timeUntilCashOut = session.minPlayTimeMinutes - minutesPlayed;
    
    return Math.max(0, Math.ceil(timeUntilCashOut));
  };

  // Calculate call time remaining
  const getCallTimeRemaining = () => {
    if (!session?.isInCallTime || !session.callTimeEndTime) return 0;
    
    const end = new Date(session.callTimeEndTime);
    const now = new Date();
    const remaining = (end.getTime() - now.getTime()) / (1000 * 60);
    
    return Math.max(0, Math.ceil(remaining));
  };

  const sessionDuration = getSessionDuration();
  const timeUntilCallTime = getTimeUntilCallTime();
  const timeUntilMinPlay = getTimeUntilCashOut();
  const callTimeRemaining = getCallTimeRemaining();

  // Don't render if no session or not loading
  if (isLoading) {
    return null;
  }

  if (error || !session?.isActive) {
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
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-800/50 p-3 rounded text-center">
                <div className="text-lg font-semibold text-white">₹{session.buyInAmount.toLocaleString()}</div>
                <div className="text-xs text-slate-400">Buy-in</div>
              </div>
              <div className="bg-slate-800/50 p-3 rounded text-center">
                <div className="text-lg font-semibold text-emerald-500">₹{session.currentBalance.toLocaleString()}</div>
                <div className="text-xs text-slate-400">Current</div>
              </div>
            </div>

            {/* Call Time Status */}
            {session.isInCallTime && (
              <div className="bg-orange-500/20 border border-orange-500/50 p-3 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Phone className="h-4 w-4 text-orange-500 mr-2" />
                    <span className="text-orange-300 font-medium">Call Time Active</span>
                  </div>
                  <Badge className="bg-orange-500/30 text-orange-200">
                    {callTimeRemaining}m remaining
                  </Badge>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex space-x-3">
              {/* Call Time Button */}
              <Button
                onClick={() => callTimeMutation.mutate()}
                disabled={!session.canCallTime || callTimeMutation.isPending || session.isInCallTime}
                className="flex-1 bg-orange-600 hover:bg-orange-700 disabled:opacity-50"
              >
                <Phone className="h-4 w-4 mr-2" />
                {session.isInCallTime ? 'Call Time Active' : 
                 session.canCallTime ? 'Call Time' : 
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