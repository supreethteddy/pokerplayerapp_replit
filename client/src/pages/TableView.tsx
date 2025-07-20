import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Users, Clock, DollarSign, UserPlus, Plus, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function TableView() {
  const { tableId } = useParams();
  const [, setLocation] = useLocation();
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  console.log('🎯 TableView render - selectedSeat:', selectedSeat, 'showJoinDialog:', showJoinDialog);
  
  // Fetch table data from API
  const { data: tables } = useQuery({
    queryKey: ['/api/tables'],
    refetchInterval: 2000,
  });
  
  // Fetch user data from correct endpoint
  const { data: user } = useQuery({
    queryKey: ['/api/players/supabase'],
  });
  
  const currentTable = tables?.find((table: any) => table.id === tableId);
  
  // Check if user is already on waitlist for this table
  const { data: userWaitlist } = useQuery({
    queryKey: ['/api/seat-requests', user?.id],
    enabled: !!user?.id,
  });
  
  // Get seated players for this table
  const { data: seatedPlayers } = useQuery({
    queryKey: ['/api/table-seats', tableId],
    enabled: !!tableId,
    refetchInterval: 2000, // Refresh every 2 seconds to show real-time seat assignments
  });
  
  const isOnWaitlist = userWaitlist?.some((req: any) => req.tableId === tableId);
  
  // Join waitlist with seat reservation
  const joinWaitlistMutation = useMutation({
    mutationFn: async (seatNumber: number) => {
      if (!user?.id || !currentTable?.id) {
        throw new Error("User or table not found");
      }

      console.log(`🎯 Reserving seat ${seatNumber} for player ${user.id} on table ${currentTable.id}`);

      const requestData = {
        playerId: user.id,
        tableId: currentTable.id,
        status: "waiting",
        seatNumber: seatNumber,
        notes: `Player ${user.firstName} ${user.lastName} requested seat ${seatNumber}`
      };

      console.log('🎯 Sending request data:', requestData);

      const response = await apiRequest("POST", "/api/seat-requests", requestData);
      return response.json();
    },
    onSuccess: (data) => {
      console.log('✅ Seat reservation successful:', data);
      toast({
        title: "Seat Reserved!",
        description: `You've been added to the waitlist for seat ${selectedSeat}`,
      });
      setSelectedSeat(null);
      queryClient.invalidateQueries({ queryKey: ["/api/seat-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/table-seats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tables"] });
      // Navigate back to dashboard after successful reservation
      setTimeout(() => setLocation('/'), 2000);
    },
    onError: (error: any) => {
      console.error('❌ Seat reservation failed:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to join waitlist",
        variant: "destructive",
      });
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

      {/* Main Table Area - Staff Portal Style */}
      <div className="flex-1 flex flex-col items-center px-4 py-8">
        <div className="relative w-full max-w-4xl">
          {/* Poker Table - Oval Shape matching staff portal */}
          <div className="relative aspect-[5/3] max-w-2xl mx-auto">
            {/* Table Background with Golden Border */}
            <div className="absolute inset-0 rounded-[50%] bg-gradient-to-br from-amber-600 via-yellow-500 to-amber-600 p-2 shadow-2xl">
              {/* Green Felt Surface */}
              <div className="absolute inset-2 rounded-[50%] bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-800 shadow-inner">
                
                {/* Seat Positions - 9 seats as shown in staff portal */}
                {Array.from({ length: 9 }, (_, index) => {
                  const seatNumber = index + 1;
                  const angle = (index / 9) * 2 * Math.PI - Math.PI / 2;
                  const radiusX = 45;
                  const radiusY = 35;
                  const x = 50 + radiusX * Math.cos(angle);
                  const y = 50 + radiusY * Math.sin(angle);
                  const isSelected = selectedSeat === seatNumber;
                  
                  // Check if this seat is occupied by a seated player
                  const seatedPlayer = seatedPlayers?.find((p: any) => p.seatNumber === seatNumber);
                  const isOccupied = !!seatedPlayer;
                  
                  return (
                    <div
                      key={seatNumber}
                      className="absolute transform -translate-x-1/2 -translate-y-1/2 z-50"
                      style={{ left: `${x}%`, top: `${y}%` }}
                    >
                      {/* FULLY CLICKABLE SEAT BUTTON */}
                      <div 
                        className={`w-16 h-16 rounded-full border-2 flex items-center justify-center shadow-lg transition-all duration-300 select-none ${
                          isOccupied 
                            ? 'bg-gradient-to-br from-blue-600 to-blue-700 border-blue-500 cursor-not-allowed' 
                            : isSelected 
                              ? 'border-emerald-400 shadow-emerald-500/50 scale-110 bg-gradient-to-br from-emerald-600 to-emerald-700 animate-pulse cursor-pointer' 
                              : 'bg-gradient-to-br from-slate-700 to-slate-800 border-slate-600 hover:border-emerald-400 hover:shadow-emerald-400/50 hover:scale-110 cursor-pointer active:scale-95'
                        }`}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log(`🎯🎯🎯 SEAT ${seatNumber} CLICKED!!! Occupied: ${isOccupied}, User ID: ${user?.id}`);
                          if (!isOccupied && user?.id) {
                            console.log(`🎯 Setting selected seat to ${seatNumber} and opening dialog`);
                            setSelectedSeat(seatNumber);
                            setShowJoinDialog(true);
                          }
                        }}
                        onMouseDown={(e) => {
                          console.log(`🎯 Mouse down on seat ${seatNumber}`);
                        }}
                        onTouchStart={(e) => {
                          console.log(`🎯 Touch start on seat ${seatNumber}`);
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
                          <Plus className={`w-6 h-6 text-emerald-400 font-bold transition-transform duration-300 ${
                            isSelected ? 'rotate-45 scale-110' : 'hover:rotate-90 hover:scale-110'
                          }`} />
                        )}
                      </div>
                      {/* Seat Label */}
                      <div className={`absolute -bottom-5 left-1/2 transform -translate-x-1/2 text-xs font-semibold transition-colors ${
                        isOccupied 
                          ? 'text-blue-400' 
                          : isSelected 
                            ? 'text-emerald-400' 
                            : 'text-white'
                      }`}>
                        {isOccupied ? seatedPlayer.player.firstName : `Seat ${seatNumber}`}
                      </div>
                    </div>
                  );
                })}

                {/* Dealer Position - Outside the table */}
                <div 
                  className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10"
                  style={{ left: '50%', top: '15%' }}
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-yellow-600 to-yellow-700 rounded-full border-3 border-yellow-500 flex items-center justify-center shadow-lg">
                    <span className="text-sm font-bold text-white">D</span>
                  </div>
                  <div className="absolute -bottom-5 left-1/2 transform -translate-x-1/2 text-xs text-yellow-400 font-semibold">
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
              <div className="text-white text-xl font-bold">{seatedPlayers?.length || 0}/{currentTable.maxPlayers || 9}</div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4 text-center">
              <DollarSign className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <div className="text-slate-400 text-sm">Buy-in Range</div>
              <div className="text-white text-lg font-bold">{currentTable.stakes}</div>
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

        {/* Seat Selection and Join Controls */}
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
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              
              <Button
                onClick={() => {
                  if (selectedSeat) {
                    joinWaitlistMutation.mutate(selectedSeat);
                    setShowJoinDialog(false);
                  }
                }}
                disabled={joinWaitlistMutation.isPending}
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