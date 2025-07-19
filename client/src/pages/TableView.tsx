import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Users, Crown, Spade, Heart, Diamond, Club } from "lucide-react";
import { useState } from "react";

interface Player {
  id: number;
  username: string;
  stack: number;
  position: number;
  cards?: string[];
  avatar?: string;
  isDealer?: boolean;
  isSmallBlind?: boolean;
  isBigBlind?: boolean;
  action?: 'fold' | 'call' | 'raise' | 'check' | 'all-in';
}

interface TableData {
  id: string;
  name: string;
  gameType: string;
  stakes: string;
  pot: number;
  players: Player[];
  maxPlayers: number;
  communityCards: string[];
  isActive: boolean;
}

const PokerCard = ({ card }: { card: string }) => {
  const getSuit = (suit: string) => {
    switch (suit.toLowerCase()) {
      case 'h': return { icon: Heart, color: 'text-red-500' };
      case 'd': return { icon: Diamond, color: 'text-red-500' };
      case 'c': return { icon: Club, color: 'text-gray-800' };
      case 's': return { icon: Spade, color: 'text-gray-800' };
      default: return { icon: Spade, color: 'text-gray-800' };
    }
  };

  if (!card || card === 'XX') {
    return (
      <div className="w-12 h-16 bg-blue-900 border border-white rounded-lg flex items-center justify-center">
        <div className="w-8 h-10 bg-blue-800 rounded border"></div>
      </div>
    );
  }

  const value = card.slice(0, -1);
  const suit = card.slice(-1);
  const { icon: SuitIcon, color } = getSuit(suit);

  return (
    <div className="w-12 h-16 bg-white border border-gray-300 rounded-lg flex flex-col items-center justify-between p-1">
      <div className={`text-sm font-bold ${color}`}>{value}</div>
      <SuitIcon className={`w-4 h-4 ${color}`} />
      <div className={`text-sm font-bold ${color} rotate-180`}>{value}</div>
    </div>
  );
};

const PlayerSeat = ({ player, position, total }: { player: Player | null, position: number, total: number }) => {
  // Calculate position around the elliptical table - more realistic positioning
  const angle = (position / total) * 2 * Math.PI - Math.PI / 2;
  const radiusX = 42; // Horizontal radius percentage
  const radiusY = 32; // Vertical radius percentage
  
  const x = 50 + radiusX * Math.cos(angle);
  const y = 50 + radiusY * Math.sin(angle);

  if (!player) {
    // Empty holographic seat
    return (
      <div 
        className="absolute transform -translate-x-1/2 -translate-y-1/2"
        style={{ left: `${x}%`, top: `${y}%` }}
      >
        <div className="relative">
          {/* Holographic Empty Seat */}
          <div className="w-24 h-28 relative">
            {/* Holographic glow */}
            <div className="absolute inset-0 bg-cyan-400/20 rounded-full blur-md animate-pulse"></div>
            {/* Seat structure */}
            <div className="relative w-20 h-24 bg-gradient-to-b from-slate-800/80 to-slate-700/80 rounded-full border-2 border-cyan-400/40 shadow-lg backdrop-blur-sm">
              <div className="absolute inset-2 rounded-full border border-dashed border-cyan-400/60 bg-cyan-900/20 flex items-center justify-center">
                <span className="text-cyan-300 text-xs font-semibold">OPEN</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="absolute transform -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      <div className="relative">
        {/* Holographic Occupied Seat */}
        <div className="w-24 h-28 relative">
          {/* Player holographic aura */}
          <div className={`absolute inset-0 rounded-full blur-lg animate-pulse ${
            player.isDealer ? 'bg-yellow-400/30' :
            player.isSmallBlind ? 'bg-blue-400/30' :
            player.isBigBlind ? 'bg-red-400/30' :
            'bg-cyan-400/20'
          }`}></div>
          
          {/* 3D Seat Structure */}
          <div className="relative w-20 h-24 bg-gradient-to-b from-slate-800/90 to-slate-700/90 rounded-full border-2 border-cyan-400/50 shadow-lg backdrop-blur-sm">
            {/* Player Avatar */}
            <div className={`absolute inset-1 rounded-full flex items-center justify-center text-white font-bold text-sm border-2 backdrop-blur-sm ${
              player.isDealer ? 'bg-yellow-600/80 border-yellow-400' :
              player.isSmallBlind ? 'bg-blue-600/80 border-blue-400' :
              player.isBigBlind ? 'bg-red-600/80 border-red-400' :
              'bg-slate-700/80 border-cyan-400/50'
            }`}>
              {player.username.substring(0, 2).toUpperCase()}
            </div>
          </div>
        </div>

        {/* Holographic Player Info */}
        <div className="absolute -bottom-16 left-1/2 transform -translate-x-1/2 text-center min-w-24">
          <div className="text-cyan-200 text-xs font-semibold bg-slate-900/80 backdrop-blur-sm border border-cyan-400/30 px-2 py-1 rounded shadow-lg">
            {player.username}
          </div>
          <div className="text-cyan-300 text-xs font-bold bg-slate-900/80 backdrop-blur-sm border border-cyan-400/30 px-2 py-1 rounded mt-1 shadow-lg">
            ₹{player.stack.toLocaleString()}
          </div>
        </div>

        {/* Holographic Position Indicators */}
        {player.isDealer && (
          <div className="absolute -top-2 -right-2">
            <div className="absolute inset-0 bg-yellow-400 rounded-full blur-sm opacity-50 animate-pulse"></div>
            <div className="relative w-6 h-6 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-full border-2 border-yellow-300 flex items-center justify-center text-xs font-bold text-black shadow-lg">
              D
            </div>
          </div>
        )}
        {player.isSmallBlind && (
          <div className="absolute -top-2 -left-2">
            <div className="absolute inset-0 bg-blue-400 rounded-full blur-sm opacity-50 animate-pulse"></div>
            <div className="relative w-6 h-6 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full border-2 border-blue-300 flex items-center justify-center text-xs font-bold text-white shadow-lg">
              SB
            </div>
          </div>
        )}
        {player.isBigBlind && (
          <div className="absolute -top-2 -left-2">
            <div className="absolute inset-0 bg-red-400 rounded-full blur-sm opacity-50 animate-pulse"></div>
            <div className="relative w-6 h-6 bg-gradient-to-br from-red-500 to-red-600 rounded-full border-2 border-red-300 flex items-center justify-center text-xs font-bold text-white shadow-lg">
              BB
            </div>
          </div>
        )}

        {/* Holographic Player Cards */}
        {player.cards && player.cards.length > 0 && player.cards[0] !== 'XX' && (
          <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 flex gap-1">
            {player.cards.map((card, idx) => (
              <div key={idx} className="scale-75 transform hover:scale-90 transition-transform duration-200">
                <div className="relative">
                  <div className="absolute inset-0 bg-cyan-400/20 blur-sm rounded-lg"></div>
                  <PokerCard card={card} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default function TableView() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const tableId = params.tableId;

  // Fetch table data
  const { data: tableData, isLoading } = useQuery<TableData>({
    queryKey: ['/api/tables', tableId, 'view'],
    refetchInterval: 2000, // Refresh every 2 seconds for live updates
  });

  // Use real table data from Staff Portal - only show staff-added players
  const displayData = tableData || {
    id: tableId || '',
    name: "Loading...",
    gameType: "Texas Hold'em",
    stakes: "₹0/₹0",
    pot: 0,
    maxPlayers: 8,
    communityCards: [],
    isActive: false,
    players: []
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-900 to-blue-700 flex items-center justify-center">
        <div className="text-white text-xl">Loading table...</div>
      </div>
    );
  }

  // Create array of 6 positions for the table
  const seatPositions = Array.from({ length: displayData.maxPlayers }, (_, index) => {
    return displayData.players.find(p => p.position === index) || null;
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black">
      {/* Header */}
      <div className="p-4 flex items-center justify-between text-white">
        <Button 
          variant="ghost" 
          onClick={() => setLocation('/')}
          className="text-white hover:bg-white/20"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Lobby
        </Button>
        
        <div className="text-center">
          <h1 className="text-xl font-bold">{displayData.name}</h1>
          <p className="text-sm opacity-80">{displayData.gameType} • {displayData.stakes}</p>
          <p className="text-xs text-gray-400 mt-1">Offline Local Game</p>
        </div>
        
        <div className="text-right">
          <div className="text-sm text-gray-300">Players: {displayData.players.length}/{displayData.maxPlayers}</div>
          <div className="text-xs text-gray-400">Managed by Staff</div>
        </div>
      </div>

      {/* Main Table Area */}
      <div className="flex-1 relative px-4 py-8">
        <div className="relative w-full max-w-6xl mx-auto aspect-[5/3]">
          {/* Bellagio 3D Holographic Table */}
          <div className="absolute inset-0 perspective-1000">
            {/* 3D Table Base with Holographic Effect */}
            <div className="relative w-full h-full transform-gpu transition-transform duration-500 hover:scale-105">
              {/* Holographic Glow Ring */}
              <div className="absolute inset-0 rounded-[50%] animate-pulse">
                <div className="absolute inset-0 rounded-[50%] bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 opacity-20 blur-lg"></div>
                <div className="absolute inset-2 rounded-[50%] bg-gradient-to-r from-blue-400 via-cyan-500 to-teal-400 opacity-30 blur-md"></div>
              </div>
              
              {/* Main Table Structure */}
              <div className="absolute inset-0 rounded-[50%] shadow-2xl backdrop-blur-sm border border-cyan-400/30">
                {/* 3D Table Rail with Holographic Border */}
                <div className="absolute inset-1 rounded-[50%] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-2 border-cyan-500/40 shadow-inner">
                  {/* Holographic Felt Surface */}
                  <div className="absolute inset-3 rounded-[50%] bg-gradient-to-br from-emerald-900 via-teal-800 to-cyan-900 shadow-inner relative overflow-hidden">
                    {/* Animated Holographic Grid */}
                    <div className="absolute inset-0 rounded-[50%] opacity-20" 
                         style={{
                           backgroundImage: `
                             linear-gradient(45deg, transparent 40%, rgba(6, 182, 212, 0.3) 50%, transparent 60%),
                             radial-gradient(circle at 20% 20%, rgba(56, 189, 248, 0.2) 2px, transparent 2px),
                             radial-gradient(circle at 80% 80%, rgba(34, 197, 94, 0.2) 2px, transparent 2px)
                           `,
                           backgroundSize: '50px 50px, 20px 20px, 25px 25px',
                           animation: 'hologram-scan 4s infinite linear'
                         }}>
                    </div>
                    
                    {/* 3D Center Display */}
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                      {/* Holographic Info Panel */}
                      <div className="relative p-4 rounded-lg bg-slate-900/80 backdrop-blur-md border border-cyan-400/40 shadow-lg">
                        <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-cyan-500/10 to-blue-500/10"></div>
                        
                        {displayData.communityCards && displayData.communityCards.length > 0 ? (
                          <div className="flex gap-1 mb-4 justify-center relative z-10">
                            {displayData.communityCards.map((card, idx) => (
                              <div key={idx} className="transform hover:scale-110 transition-transform duration-200">
                                <PokerCard card={card} />
                              </div>
                            ))}
                          </div>
                        ) : null}
                        
                        <div className="relative z-10">
                          <div className="text-cyan-300 text-2xl font-bold mb-2 text-shadow-lg">
                            POT: ₹{displayData.pot.toLocaleString()}
                          </div>
                          <div className="text-blue-200 text-lg font-semibold">{displayData.gameType}</div>
                          <div className="text-xs text-cyan-400 mt-2 px-3 py-1 bg-cyan-900/50 rounded-full border border-cyan-400/30">
                            🏛️ BELLAGIO 3D HOLOGRAM
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 3D Dealer Button with Holographic Effect */}
                    <div className="absolute top-1/4 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                      <div className="relative">
                        <div className="absolute inset-0 bg-cyan-400 rounded-full blur-sm opacity-50 animate-pulse"></div>
                        <div className="relative w-10 h-10 bg-gradient-to-br from-white to-cyan-100 rounded-full border-2 border-cyan-400 flex items-center justify-center text-sm font-bold text-slate-900 shadow-lg transform hover:scale-110 transition-transform duration-200">
                          D
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Player Seats - Realistic Positioning */}
          {seatPositions.map((player, index) => (
            <PlayerSeat 
              key={index}
              player={player}
              position={index}
              total={displayData.maxPlayers}
            />
          ))}
        </div>
      </div>

      {/* Table Information */}
      <div className="absolute bottom-0 left-0 right-0 bg-black/90 p-4">
        <div className="max-w-4xl mx-auto text-white text-center">
          <div className="flex justify-between items-center text-sm">
            <div>
              <span className="text-gray-400">Status:</span>
              <span className={`ml-2 px-2 py-1 rounded text-xs ${
                displayData.isActive 
                  ? 'bg-green-600 text-white' 
                  : 'bg-red-600 text-white'
              }`}>
                {displayData.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="text-gray-400">
              This is an offline local poker game managed by casino staff
            </div>
            <div>
              <span className="text-gray-400">Max Players:</span>
              <span className="ml-2 text-white">{displayData.maxPlayers}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}