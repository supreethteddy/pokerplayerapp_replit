import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Users, Clock, DollarSign, UserPlus, Plus, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useUltraFastAuth } from "@/hooks/useUltraFastAuth";

export default function TableView() {
  const { tableId } = useParams();
  const [, setLocation] = useLocation();
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  console.log('🎯 TableView render - selectedSeat:', selectedSeat, 'showJoinDialog:', showJoinDialog);

  // Fetch table data from API with reduced refresh rate
  const { data: tables } = useQuery({
    queryKey: ['/api/tables'],
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 15000, // Consider data fresh for 15 seconds
  });

  // Add type safety for tables array
  const tablesArray = Array.isArray(tables) ? tables : [];

  // Use the working ultra-fast auth system (same as PlayerDashboard)
  const { user, loading: authLoading } = useUltraFastAuth();

  const currentTable = tablesArray.find((table: any) => table.id === tableId);

  // Check if user is already on waitlist for this table (optimized to only run when user is loaded)
  const { data: userWaitlist } = useQuery({
    queryKey: ['/api/seat-requests', user?.id],
    enabled: !!user?.id && !authLoading,
  });

  // Add type safety for userWaitlist array
  const waitlistArray = Array.isArray(userWaitlist) ? userWaitlist : [];

  // Get seated players for this table
  const { data: seatedPlayers } = useQuery({
    queryKey: ['/api/table-seats', tableId],
    enabled: !!tableId,
    refetchInterval: 15000, // Refresh every 15 seconds instead of 2 seconds
    staleTime: 10000, // Consider data fresh for 10 seconds
  });

  // Query to check if current user is seated at this table
  const { data: userSeatedInfo } = useQuery({
    queryKey: ['/api/table-seats', user?.id],
    enabled: !!user?.id && !!tableId,
    refetchInterval: 10000,
  });

  // Add type safety for seatedPlayers array
  const seatedPlayersArray = Array.isArray(seatedPlayers) ? seatedPlayers : [];

  const isOnWaitlist = waitlistArray.some((req: any) => req.tableId === tableId);
  const waitlistEntry = waitlistArray.find((req: any) => req.tableId === tableId);

  // Check if current user is seated at this table
  const userSeatedArray = Array.isArray(userSeatedInfo) ? userSeatedInfo : [];
  const userSeatInfo = userSeatedArray.find((seat: any) => seat.tableId === tableId && seat.status === 'seated');
  const isUserSeated = !!userSeatInfo;

  // Join waitlist with seat reservation
  const joinWaitlistMutation = useMutation({
    mutationFn: async (seatNumber: number) => {
      if (!user?.id || !currentTable?.id) {
        throw new Error("User or table not found");
      }

      console.log(`🎯 [TABLE VIEW JOIN] Joining waitlist for seat ${seatNumber} on table ${currentTable.id}`);
      console.log(`🎯 [TABLE VIEW JOIN] Request payload:`, {
        playerId: user.id,
        tableId: currentTable.id,
        seatNumber: seatNumber,
        notes: `Seat ${seatNumber} request from table view`
      });

      const response = await apiRequest('POST', '/api/seat-requests', {
        playerId: user.id,
        tableId: currentTable.id,
        seatNumber: seatNumber,
        notes: `Seat ${seatNumber} request from table view`
      });

      console.log(`🎯 [TABLE VIEW JOIN] API Response status:`, response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`🎯 [TABLE VIEW JOIN] API Error response:`, errorText);

        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || `HTTP ${response.status}` };
        }

        throw new Error(errorData.error || errorData.message || `Server Error: ${response.status}`);
      }

      const result = await response.json();
      console.log(`🎯 [TABLE VIEW JOIN] API Success response:`, result);
      return result;
    },
    onSuccess: (data) => {
      console.log('✅ [TABLE VIEW JOIN] Waitlist join successful:', data);
      toast({
        title: "Joined Waitlist!",
        description: `You've been added to the waitlist successfully`,
      });
      setSelectedSeat(null);
      queryClient.invalidateQueries({ queryKey: ["/api/seat-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tables"] });
      // Navigate back to dashboard after successful join
      setTimeout(() => setLocation('/'), 2000);
    },
    onError: (error: any) => {
      console.error('❌ [TABLE VIEW JOIN] Waitlist join failed:', error);

      // Handle "already on waitlist" scenario specifically
      if (error.message && error.message.includes('Already on waitlist')) {
        toast({
          title: "Already on Waitlist",
          description: "You're already waiting for this table. Check your dashboard for status.",
          className: "bg-amber-500 text-white border-amber-600",
        });
        // Navigate back to dashboard to see existing waitlist entry
        setTimeout(() => setLocation('/'), 1500);
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to join waitlist",
          variant: "destructive",
        });
      }
    },
  });

  if (!currentTable) {
    return (
      <div className="min-h-screen bg-slate-900 text-white p-4 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Table not found</h2>
          <Button onClick={() => setLocation("/")}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white">
      {/* Header */}
      <div className="p-4 flex items-center justify-between">
        <Button 
          variant="ghost" 
          onClick={() => setLocation('/')}
          className="text-white hover:bg-white/20"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">{currentTable.name}</h1>
          <p className="text-slate-300">{currentTable.gameType} • {currentTable.stakes}</p>
        </div>

        <div className="w-16"></div> {/* Spacer for centering */}
      </div>

      {/* Waitlist Status Banner */}
      {isOnWaitlist && waitlistEntry && (
        <div className="mx-4 mb-4 p-4 bg-gradient-to-r from-amber-600/20 to-amber-500/20 border border-amber-500/50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-amber-200 font-semibold">You're on the waitlist!</h3>
              <p className="text-amber-100 text-sm">
                Waiting for seat {waitlistEntry.seatNumber || waitlistEntry.preferredSeat} • Position in queue: {waitlistEntry.position || 'TBD'}
              </p>
            </div>
            <div className="text-amber-300">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        </div>
      )}

      {/* Main Table Area - Staff Portal Style */}
      <div className="flex-1 flex flex-col items-center px-4 py-8">
        <div className="relative w-full max-w-4xl">
          {/* Poker Table - Oval Shape matching staff portal */}
          <div className="relative aspect-[5/3] max-w-2xl mx-auto mb-12 mt-8">
            {/* Table Background with Golden Border */}
            <div className="absolute inset-0 rounded-[50%] bg-gradient-to-br from-amber-600 via-yellow-500 to-amber-600 p-2 shadow-2xl">
              {/* Green Felt Surface */}
              <div className="absolute inset-2 rounded-[50%] bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-800 shadow-inner">

                {/* Seat Positions - 9 seats arranged around oval, skipping 12 o'clock dealer position */}
                {Array.from({ length: 9 }, (_, index) => {
                  const seatNumber = index + 1;
                  // Calculate angle skipping 12 o'clock position (dealer position)
                  // We have 10 total positions (9 players + 1 dealer), so each position is 36 degrees apart
                  // Start from 1:12 position (36 degrees from top) and go clockwise
                  const totalPositions = 10; // 9 players + 1 dealer
                  const angleStep = (2 * Math.PI) / totalPositions;
                  const angle = (index + 1) * angleStep - Math.PI / 2; // +1 to skip dealer at index 0
                  const radiusX = 42;
                  const radiusY = 32;
                  const x = 50 + radiusX * Math.cos(angle);
                  const y = 50 + radiusY * Math.sin(angle);
                  const isSelected = selectedSeat === seatNumber;

                  // Check if this seat is occupied by a seated player
                  const seatedPlayer = seatedPlayersArray.find((p: any) => p.seatNumber === seatNumber);
                  const isOccupied = !!seatedPlayer;
                  
                  // Show detailed player info when seated
                  const playerBuyIn = seatedPlayer?.session_buy_in_amount || seatedPlayer?.sessionBuyInAmount || 0;

                  return (
                    <div
                      key={seatNumber}
                      className="absolute transform -translate-x-1/2 -translate-y-1/2 z-50"
                      style={{ left: `${x}%`, top: `${y}%` }}
                    >
                      {/* ELEGANT SEAT BUTTON */}
                      <div 
                        className={`w-10 h-10 rounded-full border-2 flex items-center justify-center shadow-lg transition-all duration-300 select-none ${
                          isOccupied 
                            ? 'bg-gradient-to-br from-blue-600 to-blue-700 border-blue-500 cursor-not-allowed' 
                            : isSelected 
                              ? 'border-emerald-400 shadow-emerald-500/50 scale-110 bg-gradient-to-br from-emerald-600 to-emerald-700 animate-pulse cursor-pointer' 
                              : 'bg-gradient-to-br from-slate-700 to-slate-800 border-slate-600 hover:border-emerald-400 hover:shadow-emerald-400/50 hover:scale-105 cursor-pointer active:scale-95'
                        }`}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log(`🎯 SEAT ${seatNumber} CLICKED!!! User available:`, !!user, 'User ID:', user?.id);
                          // Always open dialog regardless of user loading state
                          console.log(`🎯 Opening dialog for seat ${seatNumber}`);
                          setSelectedSeat(seatNumber);
                          setShowJoinDialog(true);
                        }}
                        onMouseDown={(e) => {
                          console.log(`🎯 Mouse down on seat ${seatNumber}`);
                        }}
                        style={{ 
                          pointerEvents: 'auto',
                          touchAction: 'manipulation'
                        }}
                      >
                        {isOccupied ? (
                          <span className="text-white text-xs font-bold">
                            {seatedPlayer.player.firstName.charAt(0)}{seatedPlayer.player.lastName.charAt(0)}
                          </span>
                        ) : (
                          <Plus className={`w-3 h-3 text-emerald-400 font-bold transition-transform duration-300 ${
                            isSelected ? 'rotate-45 scale-110' : 'hover:rotate-90 hover:scale-110'
                          }`} />
                        )}
                      </div>
                      {/* Seat Label with Enhanced Info */}
                      <div className={`absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-center transition-colors ${
                        isOccupied 
                          ? 'text-blue-400' 
                          : isSelected 
                            ? 'text-emerald-400' 
                            : 'text-slate-300'
                      }`}>
                        <div className="text-xs font-medium">
                          {isOccupied ? seatedPlayer.player.firstName : `Seat ${seatNumber}`}
                        </div>
                        {isOccupied && playerBuyIn > 0 && (
                          <div className="text-[10px] text-slate-400 bg-slate-800/80 px-1 rounded mt-1">
                            ₹{playerBuyIn.toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Dealer Position - Visible outside the table */}
                <div 
                  className="absolute transform -translate-x-1/2 -translate-y-1/2 z-40"
                  style={{ left: '50%', top: '8%' }}
                >
                  <div className="w-7 h-7 bg-gradient-to-br from-yellow-600 to-yellow-700 rounded-full border-2 border-yellow-500 flex items-center justify-center shadow-xl">
                    <span className="text-xs font-bold text-white">D</span>
                  </div>
                  <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 text-xs text-yellow-400 font-medium whitespace-nowrap">
                    Dealer
                  </div>
                </div>

                {/* Center Pot Area */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    {/* Pot Display */}
                    <div className="bg-gradient-to-br from-yellow-600 via-amber-500 to-orange-500 border-2 border-yellow-400/80 px-4 py-2 rounded-lg text-center shadow-xl">
                      <div className="text-yellow-200 text-xs font-semibold">POT</div>
                      <div className="text-white text-lg font-bold">₹0</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Table Info Cards - Staff Portal Style */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 w-full max-w-4xl">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4 text-center">
              <Users className="w-8 h-8 text-blue-400 mx-auto mb-2" />
              <div className="text-slate-400 text-sm">Players</div>
              <div className="text-white text-xl font-bold">{seatedPlayersArray.length || 0}/{currentTable?.maxPlayers || 9}</div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4 text-center">
              <DollarSign className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <div className="text-slate-400 text-sm">Buy-in Range</div>
              <div className="text-white text-lg font-bold">{currentTable?.stakes || 'N/A'}</div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4 text-center">
              <Clock className="w-8 h-8 text-purple-400 mx-auto mb-2" />
              <div className="text-slate-400 text-sm">Blinds</div>
              <div className="text-white text-lg font-bold">₹10/₹20</div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4 text-center">
              <Clock className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
              <div className="text-slate-400 text-sm">Status</div>
              <div className="text-white text-lg font-bold">Waiting</div>
            </CardContent>
          </Card>
        </div>

        {/* Seated Player Controls - Call Time & Session Info */}
        {isUserSeated && userSeatInfo && (
          <div className="mt-8 w-full max-w-4xl">
            <Card className="bg-gradient-to-r from-blue-800 to-blue-900 border-blue-600">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                    <h3 className="text-xl font-bold text-blue-200">
                      You are seated at Seat {userSeatInfo.seatNumber}
                    </h3>
                  </div>
                  <div className="text-blue-300 text-sm">
                    Session: {Math.floor((Date.now() - new Date(userSeatInfo.session_start_time || userSeatInfo.sessionStartTime).getTime()) / 60000)} min
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Buy-in Info */}
                  <div className="bg-blue-900/50 rounded-lg p-4 border border-blue-700">
                    <div className="flex items-center space-x-2 mb-2">
                      <DollarSign className="w-5 h-5 text-emerald-400" />
                      <span className="text-blue-200 font-semibold">Session Buy-in</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      ₹{(userSeatInfo.session_buy_in_amount || userSeatInfo.sessionBuyInAmount || 0).toLocaleString()}
                    </div>
                  </div>

                  {/* Call Time Status */}
                  <div className="bg-blue-900/50 rounded-lg p-4 border border-blue-700">
                    <div className="flex items-center space-x-2 mb-2">
                      <Clock className="w-5 h-5 text-yellow-400" />
                      <span className="text-blue-200 font-semibold">Call Time</span>
                    </div>
                    <div className="text-lg font-bold text-white">
                      {userSeatInfo.call_time_started ? (
                        <div className="text-red-400">Active</div>
                      ) : (
                        <div className="text-green-400">Available</div>
                      )}
                    </div>
                    {userSeatInfo.call_time_started && userSeatInfo.call_time_ends && (
                      <div className="text-sm text-blue-300 mt-1">
                        Ends: {new Date(userSeatInfo.call_time_ends).toLocaleTimeString()}
                      </div>
                    )}
                  </div>

                  {/* Cashout Window */}
                  <div className="bg-blue-900/50 rounded-lg p-4 border border-blue-700">
                    <div className="flex items-center space-x-2 mb-2">
                      <ArrowLeft className="w-5 h-5 text-purple-400" />
                      <span className="text-blue-200 font-semibold">Cash Out</span>
                    </div>
                    <div className="text-lg font-bold text-white">
                      {userSeatInfo.cashout_window_active ? (
                        <div className="text-green-400">Available</div>
                      ) : (
                        <div className="text-slate-400">Pending</div>
                      )}
                    </div>
                    {userSeatInfo.cashout_window_active && userSeatInfo.cashout_window_ends && (
                      <div className="text-sm text-blue-300 mt-1">
                        Until: {new Date(userSeatInfo.cashout_window_ends).toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons for Seated Players */}
                <div className="flex justify-center space-x-4 mt-6">
                  <Button
                    variant="outline"
                    className="bg-yellow-600 hover:bg-yellow-700 text-white border-yellow-500"
                    disabled={!!userSeatInfo.call_time_started}
                  >
                    <Clock className="w-4 h-4 mr-2" />
                    {userSeatInfo.call_time_started ? 'Call Time Active' : 'Request Call Time'}
                  </Button>
                  
                  <Button
                    variant="outline"
                    className="bg-purple-600 hover:bg-purple-700 text-white border-purple-500"
                    disabled={!userSeatInfo.cashout_window_active}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    {userSeatInfo.cashout_window_active ? 'Cash Out' : 'Cash Out Unavailable'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Seat Selection and Join Controls */}
        {!isUserSeated && (
          <div className="mt-8 text-center">
            {selectedSeat ? (
              <div className="space-y-4">
              <div className="bg-slate-800 border border-emerald-500/50 rounded-lg p-4 max-w-md mx-auto">
                <h3 className="text-emerald-400 font-semibold mb-2">Seat {selectedSeat} Selected</h3>
                <p className="text-slate-300 text-sm mb-2">Reserve this seat position for {currentTable?.name}</p>
                <p className="text-slate-400 text-xs mb-4">Note: Multiple players can reserve the same seat. Staff will assign final seating.</p>
                <div className="flex gap-3 justify-center">
                  <Button
                    onClick={() => {
                      console.log(`🎯 Reserving seat ${selectedSeat} - Button clicked`);
                      joinWaitlistMutation.mutate(selectedSeat);
                    }}
                    disabled={joinWaitlistMutation.isPending}
                    className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white shadow-lg hover:shadow-emerald-500/25 transition-all duration-300"
                  >
                    {joinWaitlistMutation.isPending ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    ) : (
                      <UserPlus className="w-4 h-4 mr-2" />
                    )}
                    Reserve Seat {selectedSeat}
                  </Button>
                  <Button
                    onClick={() => setSelectedSeat(null)}
                    variant="outline"
                    className="border-slate-600 text-slate-300 hover:bg-slate-700"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 max-w-md mx-auto">
              <p className="text-slate-300 text-sm">Click on any seat to reserve your preferred position</p>
              <p className="text-slate-400 text-xs mt-2">Staff will manage final table assignments</p>
            </div>
          )}
          </div>
        )}

        {/* Info Text */}
        <div className="mt-8 text-center text-slate-400">
          <p className="text-sm">This is a local offline poker game managed by casino staff.</p>
          <p className="text-xs mt-2">Players are seated by super admin, admin, or manager only.</p>
        </div>
      </div>

      {/* Seat Selection Confirmation Dialog */}
      <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-emerald-400 text-xl">Join Table Waitlist</DialogTitle>
            <DialogDescription className="text-slate-300">
              Confirm your seat reservation for {currentTable?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
              <h4 className="font-semibold text-emerald-400 mb-2">Table Information</h4>
              <div className="text-sm space-y-1 text-slate-300">
                <div>• Table: {currentTable?.name}</div>
                <div>• Game: {currentTable?.gameType}</div>
                <div>• Stakes: {currentTable?.stakes}</div>
                <div>• Preferred Seat: {selectedSeat}</div>
              </div>
            </div>

            <div className="bg-amber-900/20 border border-amber-600/50 rounded-lg p-3">
              <p className="text-amber-200 text-sm">
                <strong>Note:</strong> You will be added to the waitlist for this table. 
                Staff will assign seating when a spot becomes available.
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowJoinDialog(false);
                  setSelectedSeat(null);
                }}
                className="border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white hover:border-slate-500"
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>

              <Button
                onClick={() => {
                  if (selectedSeat && user?.id) {
                    console.log(`🎯 Joining waitlist for seat ${selectedSeat}`);
                    joinWaitlistMutation.mutate(selectedSeat);
                    setShowJoinDialog(false);
                  }
                }}
                disabled={joinWaitlistMutation.isPending || !user?.id || authLoading}
                className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white"
              >
                {joinWaitlistMutation.isPending ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                ) : (
                  <UserPlus className="w-4 h-4 mr-2" />
                )}
                Confirm Seat {selectedSeat}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}