import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Users, Clock, DollarSign, UserPlus, Plus, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useUltraFastAuth } from "@/hooks/useUltraFastAuth";
import { usePlayerGameStatus } from "@/hooks/usePlayerGameStatus";
import { PlaytimeTracker } from "./PlaytimeTracker";
import { useAvailableTables, useJoinWaitlist, useWaitlistStatus, useCancelWaitlist, useTableDetails } from "@/hooks/usePlayerAPI";
import { Badge } from "@/components/ui/badge";

interface TableViewProps {
  tableId?: string;
  onNavigate?: (path: string) => void;
  onClose?: () => void;
  clubBranding?: any;
}

export default function TableView({ tableId: propTableId, onNavigate, onClose, clubBranding: _clubBranding }: TableViewProps) {
  // Normalize tableId to string for comparison
  const tableId = propTableId ? String(propTableId) : "1";
  const setLocation = onNavigate || ((path: string) => {
    console.log('Navigate to:', path);
  });

  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const { toast } = useToast();
  const { user } = useUltraFastAuth();
  const gameStatus = usePlayerGameStatus();

  // Fetch tables from backend API
  const { data: tablesData, isLoading: tablesLoading } = useAvailableTables();
  const tables = tablesData?.tables || [];
  const tablesArray = Array.isArray(tables) ? tables : [];

  // Join/Cancel waitlist mutations
  const joinWaitlistMutation = useJoinWaitlist();
  const cancelWaitlistMutation = useCancelWaitlist();

  // Find table by ID
  const currentTable = tablesArray.find((table: any) => String(table.id) === String(tableId)) as any;
  const isRummy = currentTable?.tableType === 'RUMMY' || currentTable?.isRummy === true;

  // Fetch real-time seated players for this table (polls every 5s)
  const [seatedPlayers, setSeatedPlayers] = useState<any[]>([]);
  const fetchSeatedPlayers = useCallback(async () => {
    if (!tableId || !user?.clubId) return;
    try {
      const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3333/api';
      const res = await fetch(`${API_BASE}/auth/player/tables/${tableId}`, {
        headers: {
          'x-club-id': String(user.clubId),
          'x-player-id': String(user.id || ''),
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.seatedPlayers)) {
          setSeatedPlayers(data.seatedPlayers);
        }
      }
    } catch {
      // Non-fatal
    }
  }, [tableId, user?.clubId, user?.id]);

  useEffect(() => {
    fetchSeatedPlayers();
    const interval = setInterval(fetchSeatedPlayers, 5000);
    return () => clearInterval(interval);
  }, [fetchSeatedPlayers]);

  const seatedPlayersArray = seatedPlayers;
  const potData = { pot: String(seatedPlayers.reduce((sum: number, p: any) => sum + (p.buyInAmount || 0), 0)) };

  // Fetch waitlist status
  const { data: waitlistDataRaw, isLoading: _waitlistLoading } = useWaitlistStatus();
  const waitlistData = waitlistDataRaw || { onWaitlist: false, isSeated: false, entries: [], position: null, entry: null, tableInfo: null };

  // Check if user is on waitlist for THIS specific table
  const waitlistEntry = (waitlistData as any).entry || (Array.isArray((waitlistData as any).entries) ? (waitlistData as any).entries.find((e: any) => String(e.tableId) === String(tableId)) : null);
  const isOnWaitlist = waitlistData.onWaitlist && (waitlistData.tableInfo?.tableId === tableId || (waitlistEntry && String(waitlistEntry.tableId) === String(tableId)) || !waitlistData.tableInfo);
  // (Note: If tableInfo is missing, we assume position is valid for this table for legacy support or simpler state)

  // isOnWaitlist and waitlistEntry are used below
  const isUserSeated = gameStatus.isInActiveGame && gameStatus.activeGameInfo?.tableId === tableId;
  const userSeatInfo = gameStatus.activeGameInfo || gameStatus.seatedSessionFallback;

  // Join waitlist with backend API
  const handleJoinWaitlist = (seatNumber: number) => {
    joinWaitlistMutation.mutate(
      {
        partySize: 1,
        tableType: currentTable?.gameVariant || currentTable?.type || 'Cash Game',
        requestedSeat: seatNumber // Send as requestedSeat (backend expects this field name)
      },
      {
        onSuccess: () => {
          toast({
            title: "Joined Waitlist!",
            description: `You've been added to the waitlist for seat ${seatNumber}`,
          });
          setSelectedSeat(null);
          setShowJoinDialog(false);
        },
        onError: (error: any) => {
          toast({
            title: "Failed to Join Waitlist",
            description: error.message || "Please try again",
            variant: "destructive",
          });
        }
      }
    );
  };

  if (!currentTable) {
    return (
      <div className="min-h-screen bg-slate-900 text-white p-4 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Table not found</h2>
          <Button onClick={() => onClose ? onClose() : setLocation("/")}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen sm:min-h-0 bg-gradient-to-b from-slate-900 to-slate-800 text-white h-full sm:h-auto pt-2 sm:pt-4">
      {/* Header */}
      <div className="p-3 sm:p-4 flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          onClick={() => onClose ? onClose() : setLocation('/')}
          className="text-white hover:bg-white/20 min-h-[44px] min-w-[44px] touch-manipulation flex-shrink-0"
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 sm:mr-2" />
          <span className="hidden sm:inline">Back</span>
        </Button>

        <div className="text-center flex-1 min-w-0 px-2">
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white truncate">{currentTable.name}</h1>
          <p className="text-xs sm:text-sm text-slate-300 truncate">{currentTable.gameType} • {currentTable.stakes}</p>
          {isRummy && currentTable.rummyVariant && (
            <p className="text-[10px] text-rose-300 truncate">{currentTable.rummyVariant}</p>
          )}
        </div>

        <div className="w-12 sm:w-16 flex-shrink-0"></div> {/* Spacer for centering */}
      </div>

      {/* Waitlist Status Banner - Only show if not seated */}
      {isOnWaitlist && waitlistEntry && !isUserSeated && (
        <div className="mx-3 sm:mx-4 mb-3 sm:mb-4 p-3 sm:p-4 bg-gradient-to-r from-amber-600/20 to-amber-500/20 border border-amber-500/50 rounded-lg">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="text-amber-200 font-semibold text-sm sm:text-base">You're on the waitlist!</h3>
              <p className="text-amber-100 text-xs sm:text-sm break-words">
                Waiting for seat {waitlistEntry.seatNumber} • Position in queue: {waitlistData.position || 'TBD'}
              </p>
            </div>
            <div className="text-amber-300 flex-shrink-0">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
        </div>
      )}

      {/* PlaytimeTracker for Seated Players */}
      {isUserSeated && user?.id && (
        <div className="mx-3 sm:mx-4 mb-3 sm:mb-4">
          <PlaytimeTracker playerId={user.id.toString()} gameStatus={gameStatus} />
        </div>
      )}

      {/* Main Table Area - Staff Portal Style */}
      <div className="flex-1 flex flex-col items-center px-2 sm:px-4 py-4 sm:py-8">
        <div className="relative w-full max-w-4xl">
          {/* Table - Round (Rummy) or Oval (Poker) */}
          <div className={`relative mx-auto mb-6 sm:mb-12 mt-4 sm:mt-8 ${isRummy ? 'aspect-square max-w-xs sm:max-w-sm' : 'aspect-[5/3] max-w-full sm:max-w-2xl'}`}>
            {/* Table Border */}
            <div className={`absolute inset-0 p-2 shadow-2xl ${isRummy ? 'rounded-full bg-gradient-to-br from-rose-700 via-red-600 to-rose-700' : 'rounded-[50%] bg-gradient-to-br from-amber-600 via-yellow-500 to-amber-600'}`}>
              {/* Felt Surface */}
              <div className={`absolute inset-2 shadow-inner ${isRummy ? 'rounded-full bg-gradient-to-br from-rose-900 via-rose-800 to-rose-950' : 'rounded-[50%] bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-800'}`}>

                {/* Dynamic Seat Positions */}
                {Array.from({ length: currentTable.maxSeats || currentTable.maxPlayers || 9 }, (_, index) => {
                  const seatNumber = index + 1;
                  const totalSeats = currentTable.maxSeats || currentTable.maxPlayers || 9;
                  const angle = (index * (2 * Math.PI / totalSeats)) - Math.PI / 2;
                  const radiusX = isRummy ? 38 : 42;
                  const radiusY = isRummy ? 38 : 32;
                  const x = 50 + radiusX * Math.cos(angle);
                  const y = 50 + radiusY * Math.sin(angle);
                  const isSelected = selectedSeat === seatNumber;

                  const seatedPlayer = seatedPlayersArray.find((p: any) => Number(p.seatNumber) === seatNumber);
                  const isOccupied = !!seatedPlayer;
                  const playerBuyIn = seatedPlayer?.buyInAmount || 0;

                  return (
                    <div
                      key={seatNumber}
                      className="absolute transform -translate-x-1/2 -translate-y-1/2 z-50"
                      style={{ left: `${x}%`, top: `${y}%` }}
                    >
                      {/* ELEGANT SEAT BUTTON */}
                      <div
                        className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 flex items-center justify-center shadow-lg transition-all duration-300 select-none min-w-[44px] min-h-[44px] sm:min-w-[40px] sm:min-h-[40px] ${isOccupied
                          ? 'bg-gradient-to-br from-blue-600 to-blue-700 border-blue-500 cursor-not-allowed'
                          : isSelected
                            ? 'border-emerald-400 shadow-emerald-500/50 scale-110 bg-gradient-to-br from-emerald-600 to-emerald-700 animate-pulse cursor-pointer'
                            : 'bg-gradient-to-br from-slate-700 to-slate-800 border-slate-600 hover:border-emerald-400 hover:shadow-emerald-400/50 hover:scale-105 cursor-pointer active:scale-95'
                          }`}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!isOccupied) {
                            setSelectedSeat(seatNumber);
                            setShowJoinDialog(true);
                          }
                        }}
                        style={{
                          pointerEvents: 'auto',
                          touchAction: 'manipulation'
                        }}
                      >
                        {isOccupied ? (
                          <span className="text-white text-[10px] sm:text-xs font-bold">
                            {seatedPlayer.initials || (seatedPlayer.nickname || seatedPlayer.name || seatedPlayer.playerName || 'P').charAt(0)}
                          </span>
                        ) : (
                          <Plus className={`w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400 font-bold transition-transform duration-300 ${isSelected ? 'rotate-45 scale-110' : 'hover:rotate-90 hover:scale-110'
                            }`} />
                        )}
                      </div>

                      {/* Seat Label with Enhanced Info */}
                      <div className={`absolute -bottom-6 sm:-bottom-8 left-1/2 transform -translate-x-1/2 text-center transition-colors ${isOccupied
                        ? 'text-blue-400'
                        : isSelected
                          ? 'text-emerald-400'
                          : 'text-slate-300'
                        }`}>
                        <div className="text-[10px] sm:text-xs font-medium">
                          {isOccupied ? (seatedPlayer.playerName?.split(' ')[0] || seatedPlayer.nickname || seatedPlayer.name || 'Player') : `Seat ${seatNumber}`}
                        </div>
                        {isOccupied && playerBuyIn > 0 && (
                          <div className="text-[8px] sm:text-[10px] text-slate-400 bg-slate-800/80 px-1 rounded mt-0.5 sm:mt-1">
                            ₹{playerBuyIn.toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Table Value Above Dealer */}
                <div
                  className="absolute transform -translate-x-1/2 -translate-y-1/2 z-40"
                  style={{ left: '50%', top: '8%' }}
                >
                  {/* Table Value / Entry Fee Card */}
                  <div className={`border-2 px-2 sm:px-4 py-1 sm:py-2 rounded-lg text-center shadow-xl mb-1 sm:mb-2 ${isRummy ? 'bg-gradient-to-br from-rose-700 via-rose-600 to-red-600 border-rose-400/80' : 'bg-gradient-to-br from-yellow-600 via-amber-500 to-orange-500 border-yellow-400/80'}`}>
                    <div className="text-yellow-200 text-[10px] sm:text-xs font-semibold">{isRummy ? 'Entry Fee' : 'Table Value'}</div>
                    <div className="text-white text-sm sm:text-lg font-bold">
                      {isRummy
                        ? (seatedPlayersArray.length > 0
                          ? `₹${(seatedPlayersArray.length * (Number(currentTable.entryFee) || 0)).toLocaleString()}`
                          : (currentTable.entryFee ? `₹${Number(currentTable.entryFee).toLocaleString()}` : '—'))
                        : `₹${potData?.pot ? parseFloat(potData.pot).toLocaleString() : '0'}`}
                    </div>
                  </div>

                  {/* Dealer Button Below */}
                  <div className="w-6 h-6 sm:w-7 sm:h-7 bg-gradient-to-br from-yellow-600 to-yellow-700 rounded-full border-2 border-yellow-500 flex items-center justify-center shadow-xl mx-auto">
                    <span className="text-[10px] sm:text-xs font-bold text-white">D</span>
                  </div>
                  <div className="text-[10px] sm:text-xs text-yellow-400 font-medium whitespace-nowrap text-center mt-0.5 sm:mt-1">
                    Dealer
                  </div>
                </div>

                {/* Center Logo */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-white rounded-lg p-1 sm:p-2 shadow-xl">
                    {isRummy ? (
                      <div className="flex flex-col items-center">
                        <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-rose-500 to-red-600 rounded-full flex items-center justify-center border-4 border-white shadow-lg">
                          <span className="text-white text-lg sm:text-2xl font-bold">🃏</span>
                        </div>
                        {currentTable.rummyVariant && (
                          <span className="text-[9px] sm:text-[11px] text-rose-200 font-semibold mt-1 text-center max-w-[80px] truncate">{currentTable.rummyVariant}</span>
                        )}
                      </div>
                    ) : (
                      <div className="bg-white rounded-lg p-1 sm:p-2 shadow-xl">
                        <img
                          src="/logo.png"
                          alt="Table Logo"
                          className="w-12 h-12 sm:w-16 sm:h-16 object-contain"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.parentElement!.innerHTML = '<div class="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center border-4 border-white shadow-lg"><span class="text-white text-lg sm:text-2xl font-bold">♠</span></div>';
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Table Info Cards - Staff Portal Style */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 mt-4 sm:mt-8 w-full max-w-4xl px-2 sm:px-0">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-2 sm:p-4 text-center">
              <Users className="w-6 h-6 sm:w-8 sm:h-8 text-blue-400 mx-auto mb-1 sm:mb-2" />
              <div className="text-slate-400 text-xs sm:text-sm">Players</div>
              <div className="text-white text-base sm:text-xl font-bold">{seatedPlayersArray.length || 0}/{currentTable?.capacity || currentTable?.maxSeats || currentTable?.maxPlayers || 9}</div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-2 sm:p-4 text-center">
              <DollarSign className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-400 mx-auto mb-1 sm:mb-2" />
              <div className="text-slate-400 text-xs sm:text-sm">{isRummy ? 'Entry / Stakes' : 'Buy-in Range'}</div>
              <div className="text-white text-sm sm:text-lg font-bold break-words">
                {currentTable.stakes || (currentTable.minBuyIn && currentTable.maxBuyIn ? `₹${currentTable.minBuyIn}-₹${currentTable.maxBuyIn}` : 'N/A')}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-2 sm:p-4 text-center">
              <Clock className="w-6 h-6 sm:w-8 sm:h-8 text-purple-400 mx-auto mb-1 sm:mb-2" />
              <div className="text-slate-400 text-xs sm:text-sm">{isRummy ? 'Points Value' : 'Blinds'}</div>
              <div className="text-white text-sm sm:text-lg font-bold">
                {isRummy
                  ? (currentTable.pointsValue ? `₹${Number(currentTable.pointsValue)}/pt` : '—')
                  : '₹10/₹20'}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-2 sm:p-4 text-center">
              <DollarSign className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-400 mx-auto mb-1 sm:mb-2" />
              <div className="text-slate-400 text-xs sm:text-sm">Table Value</div>
              <div className="text-emerald-400 text-sm sm:text-lg font-bold">
                {Number(potData.pot) > 0 ? `₹${Number(potData.pot).toLocaleString()}` : '₹0'}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Seated Player Controls - Call Time & Session Info */}
        {isUserSeated && userSeatInfo && (
          <div className="mt-4 sm:mt-8 w-full max-w-4xl px-2 sm:px-0">
            <Card className="bg-gradient-to-r from-blue-800 to-blue-900 border-blue-600">
              <CardContent className="p-3 sm:p-6">
                <div className="flex items-center justify-between mb-3 sm:mb-4 gap-2">
                  <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                    <div className="w-2 h-2 sm:w-3 sm:h-3 bg-green-400 rounded-full animate-pulse flex-shrink-0"></div>
                    <h3 className="text-base sm:text-lg md:text-xl font-bold text-blue-200 truncate">
                      You are seated at Seat {userSeatInfo.seatNumber}
                    </h3>
                  </div>
                  <div className="text-blue-300 text-xs sm:text-sm flex-shrink-0 hidden sm:block">
                    Seated at Table
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                  {/* Buy-in Info */}
                  <div className="bg-blue-900/50 rounded-lg p-4 border border-blue-700">
                    <div className="flex items-center space-x-2 mb-2">
                      <DollarSign className="w-5 h-5 text-emerald-400" />
                      <span className="text-blue-200 font-semibold">Session Buy-in</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {(() => {
                        const myPlayer = seatedPlayersArray.find((p: any) => Number(p.seatNumber) === userSeatInfo?.seatNumber);
                        const amount = myPlayer?.buyInAmount || (userSeatInfo as any).buyInAmount || (userSeatInfo as any).sessionBuyInAmount || 0;
                        return amount > 0 ? `₹${amount.toLocaleString()}` : (isUserSeated ? '₹0' : '—');
                      })()}
                    </div>
                  </div>

                  {/* Call Time Status */}
                  <div className="bg-blue-900/50 rounded-lg p-4 border border-blue-700">
                    <div className="flex items-center space-x-2 mb-2">
                      <Clock className="w-5 h-5 text-yellow-400" />
                      <span className="text-blue-200 font-semibold">Call Time</span>
                    </div>
                    <div className="text-lg font-bold text-white">
                      <div className="text-green-400">Available</div>
                    </div>
                  </div>

                  {/* Wallet Balance */}
                  <div className="bg-blue-900/50 rounded-lg p-4 border border-blue-700">
                    <div className="flex items-center space-x-2 mb-2">
                      <ArrowLeft className="w-5 h-5 text-purple-400" />
                      <span className="text-blue-200 font-semibold">Wallet Balance</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {(() => {
                        const myPlayer = seatedPlayersArray.find((p: any) => Number(p.seatNumber) === userSeatInfo?.seatNumber);
                        const bal = myPlayer?.walletBalance ?? null;
                        return bal !== null ? `₹${Number(bal).toLocaleString()}` : '—';
                      })()}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Waitlist Status Display */}
        {
          !isUserSeated && waitlistData?.onWaitlist && (
            <div className="mt-4 sm:mt-8 w-full max-w-4xl px-2 sm:px-0">
              <Card className="bg-amber-500/10 border-amber-500/30">
                <CardContent className="p-3 sm:p-6">
                  <div className="flex items-center justify-between mb-3 sm:mb-4 gap-2">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                      <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500 flex-shrink-0" />
                      <h3 className="text-base sm:text-lg md:text-xl font-bold text-white truncate">You're on the Waitlist!</h3>
                    </div>
                    <Badge className="bg-amber-500 text-black text-sm sm:text-lg px-2 sm:px-4 py-1 flex-shrink-0">Position #{waitlistData.position}</Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-4">
                    <div>
                      <div className="text-slate-400 text-sm">Table Type</div>
                      <div className="text-white font-semibold">{waitlistEntry?.tableType || 'Cash Game'}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-sm">Status</div>
                      <div className="text-amber-400 font-semibold">{waitlistEntry?.status || 'Waiting'}</div>
                    </div>
                  </div>
                  <div className="text-xs text-slate-400 mb-4">
                    Joined: {waitlistEntry?.createdAt ? new Date(waitlistEntry.createdAt).toLocaleString() : 'N/A'}
                  </div>
                  <Button
                    onClick={() => {
                      if (waitlistEntry?.id) {
                        cancelWaitlistMutation.mutate(waitlistEntry.id, {
                          onSuccess: () => {
                            toast({
                              title: "Left Waitlist",
                              description: "You have been removed from the waitlist.",
                            });
                          }
                        });
                      }
                    }}
                    disabled={cancelWaitlistMutation.isPending}
                    variant="outline"
                    className="w-full bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20 min-h-[44px] text-sm sm:text-base touch-manipulation"
                  >
                    {cancelWaitlistMutation.isPending ? (
                      <>
                        <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin mr-2" />
                        Leaving...
                      </>
                    ) : (
                      <>
                        <X className="w-4 h-4 mr-2" />
                        Leave Waitlist
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>
          )
        }

        {/* Seat Selection and Join Controls */}
        {
          !isUserSeated && !waitlistData?.onWaitlist && (
            <div className="mt-4 sm:mt-8 text-center px-2 sm:px-0">
              {selectedSeat ? (
                <div className="space-y-3 sm:space-y-4">
                  <div className="bg-slate-800 border border-emerald-500/50 rounded-lg p-3 sm:p-4 max-w-md mx-auto">
                    <h3 className="text-emerald-400 font-semibold mb-2 text-sm sm:text-base">Seat {selectedSeat} Selected</h3>
                    <p className="text-slate-300 text-xs sm:text-sm mb-2 break-words">Reserve this seat position for {currentTable?.name}</p>
                    <p className="text-slate-400 text-[0.65rem] sm:text-xs mb-3 sm:mb-4">Note: Multiple players can reserve the same seat. Staff will assign final seating.</p>
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-center">
                      <Button
                        onClick={() => {
                          handleJoinWaitlist(selectedSeat);
                        }}
                        className={`text-white shadow-lg transition-all duration-300 min-h-[44px] text-sm sm:text-base touch-manipulation w-full sm:w-auto ${isRummy ? 'bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 hover:shadow-rose-500/25' : 'bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 hover:shadow-emerald-500/25'}`}
                      >
                        <UserPlus className="w-4 h-4 mr-2" />
                        Reserve Seat {selectedSeat}
                      </Button>
                      <Button
                        onClick={() => setSelectedSeat(null)}
                        variant="outline"
                        className="border-slate-600 text-slate-300 hover:bg-slate-700 min-h-[44px] text-sm sm:text-base touch-manipulation w-full sm:w-auto"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 sm:p-4 max-w-md mx-auto">
                  <p className="text-slate-300 text-xs sm:text-sm">Click on any seat to reserve your preferred position</p>
                  <p className="text-slate-400 text-[0.65rem] sm:text-xs mt-2">Staff will manage final table assignments</p>
                </div>
              )}
            </div>
          )
        }

        {/* Info Text */}
        <div className="mt-4 sm:mt-8 text-center text-slate-400 px-2 sm:px-0">
          <p className="text-xs sm:text-sm">
            {isRummy ? 'This is a local offline rummy game managed by club staff.' : 'This is a local offline poker game managed by casino staff.'}
          </p>
          <p className="text-[0.65rem] sm:text-xs mt-2">Players are seated by super admin, admin, or manager only.</p>
        </div>
      </div>

      {/* Seat Selection Confirmation Dialog */}
      <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className={`text-lg sm:text-xl ${isRummy ? 'text-rose-400' : 'text-emerald-400'}`}>Join {isRummy ? 'Rummy' : ''} Table Waitlist</DialogTitle>
            <DialogDescription className="text-slate-300 text-sm sm:text-base">
              Confirm your seat reservation for {currentTable?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 sm:space-y-4">
            <div className="bg-slate-900 rounded-lg p-3 sm:p-4 border border-slate-700">
              <h4 className={`font-semibold mb-2 text-sm sm:text-base ${isRummy ? 'text-rose-400' : 'text-emerald-400'}`}>Table Information</h4>
              <div className="text-xs sm:text-sm space-y-1 text-slate-300">
                <div>• Table: {currentTable?.name}</div>
                <div>• Game: {currentTable?.gameVariant || currentTable?.type || currentTable?.gameType}</div>
                <div>• {isRummy ? 'Entry Fee' : 'Stakes'}: {currentTable?.stakes || (currentTable?.minBuyIn && currentTable?.maxBuyIn ? `₹${currentTable.minBuyIn}-₹${currentTable.maxBuyIn}` : 'Cash Game')}</div>
                {isRummy && currentTable?.pointsValue && <div>• Points Value: ₹{currentTable.pointsValue}/pt</div>}
                {isRummy && currentTable?.numberOfDeals && <div>• Deals: {currentTable.numberOfDeals}</div>}
                <div>• Preferred Seat: {selectedSeat}</div>
              </div>
            </div>

            <div className="bg-amber-900/20 border border-amber-600/50 rounded-lg p-2 sm:p-3">
              <p className="text-amber-200 text-xs sm:text-sm">
                <strong>Note:</strong> You will be added to the waitlist for this table.
                Staff will assign seating when a spot becomes available.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowJoinDialog(false);
                  setSelectedSeat(null);
                }}
                className="border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white hover:border-slate-500 min-h-[44px] text-sm sm:text-base touch-manipulation w-full sm:w-auto"
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>

              <Button
                onClick={() => {
                  if (selectedSeat) {
                    handleJoinWaitlist(selectedSeat);
                  }
                }}
                className={`text-white min-h-[44px] text-sm sm:text-base touch-manipulation w-full sm:w-auto ${isRummy ? 'bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800' : 'bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800'}`}
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Confirm Seat {selectedSeat}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

