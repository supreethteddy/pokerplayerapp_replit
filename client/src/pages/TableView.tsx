import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Users, Clock, DollarSign, UserPlus, Plus } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function TableView() {
  const { tableId } = useParams();
  const [, setLocation] = useLocation();
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fetch table data from API
  const { data: tables } = useQuery({
    queryKey: ['/api/tables'],
    refetchInterval: 2000,
  });
  
  // Fetch user data
  const { data: user } = useQuery({
    queryKey: ['/api/user'],
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
    mutationFn: (seatNumber: number) => 
      apiRequest("POST", "/api/waitlist", {
        tableId,
        gameType: currentTable?.gameType || "Texas Hold'em",
        minBuyIn: currentTable?.stakes?.split('/')[0]?.replace('₹', '') || 1000,
        maxBuyIn: currentTable?.stakes?.split('/')[1]?.replace('₹', '') || 10000,
        seatNumber,
        notes: `Player reserved seat ${seatNumber}`
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/seat-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/waitlist'] });
      toast({
        title: "Seat Reserved",
        description: `You've reserved seat ${selectedSeat} for ${currentTable?.name}`,
      });
      setSelectedSeat(null);
      // Navigate back to dashboard after successful reservation
      setTimeout(() => setLocation('/'), 1500);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to reserve seat. Please try again.",
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
                      className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer"
                      style={{ left: `${x}%`, top: `${y}%` }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isOccupied) {
                          console.log(`Seat ${seatNumber} clicked!`);
                          setSelectedSeat(seatNumber);
                        }
                      }}
                    >
                      {/* Player Seat */}
                      <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center shadow-lg transition-all duration-300 ${
                        isOccupied 
                          ? 'bg-gradient-to-br from-blue-600 to-blue-700 border-blue-500 cursor-not-allowed' 
                          : isSelected 
                            ? 'border-emerald-500 shadow-emerald-500/50 scale-110 bg-gradient-to-br from-emerald-700 to-emerald-800 hover:scale-105' 
                            : 'bg-gradient-to-br from-slate-700 to-slate-800 border-slate-600 hover:border-emerald-500 hover:shadow-emerald-500/25 hover:scale-105'
                      }`}>
                        {isOccupied ? (
                          <span className="text-white text-xs font-bold">
                            {seatedPlayer.player.firstName.charAt(0)}{seatedPlayer.player.lastName.charAt(0)}
                          </span>
                        ) : (
                          <Plus className="w-5 h-5 text-emerald-400 font-bold" />
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
                    onClick={() => joinWaitlistMutation.mutate(selectedSeat)}
                    disabled={joinWaitlistMutation.isPending}
                    className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white shadow-lg hover:shadow-emerald-500/25 transition-all duration-300"
                  >
                    {joinWaitlistMutation.isPending ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    ) : (
                      <UserPlus className="w-4 h-4 mr-2" />
                    )}
                    Reserve Seat
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
    </div>
  );
}