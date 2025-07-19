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
    // Empty chair - styled like the images
    return (
      <div 
        className="absolute transform -translate-x-1/2 -translate-y-1/2"
        style={{ left: `${x}%`, top: `${y}%` }}
      >
        <div className="relative">
          {/* Chair back */}
          <div className="w-20 h-24 bg-gradient-to-b from-amber-900 to-amber-800 rounded-t-3xl border-2 border-amber-700 shadow-lg">
            {/* Chair seat */}
            <div className="absolute bottom-0 w-20 h-16 bg-gradient-to-b from-amber-800 to-amber-900 rounded-b-2xl border-2 border-amber-700">
              {/* Empty seat indicator */}
              <div className="absolute inset-2 rounded-lg border border-dashed border-amber-600 bg-amber-700/30 flex items-center justify-center">
                <span className="text-amber-400 text-xs font-semibold">OPEN</span>
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
        {/* Occupied Chair */}
        <div className="w-20 h-24 bg-gradient-to-b from-amber-900 to-amber-800 rounded-t-3xl border-2 border-amber-700 shadow-lg">
          {/* Chair seat with player */}
          <div className="absolute bottom-0 w-20 h-16 bg-gradient-to-b from-amber-800 to-amber-900 rounded-b-2xl border-2 border-amber-700">
            {/* Player avatar */}
            <div className={`absolute inset-1 rounded-lg flex items-center justify-center text-white font-bold text-sm ${
              player.isDealer ? 'bg-yellow-600 border-2 border-yellow-400' :
              player.isSmallBlind ? 'bg-blue-600 border-2 border-blue-400' :
              player.isBigBlind ? 'bg-red-600 border-2 border-red-400' :
              'bg-gray-700 border-2 border-gray-500'
            }`}>
              {player.username.substring(0, 2).toUpperCase()}
            </div>
          </div>
        </div>

        {/* Player name and stack - positioned below chair */}
        <div className="absolute -bottom-16 left-1/2 transform -translate-x-1/2 text-center min-w-24">
          <div className="text-white text-xs font-semibold bg-black/80 px-2 py-1 rounded shadow-lg">
            {player.username}
          </div>
          <div className="text-yellow-300 text-xs font-bold bg-black/80 px-2 py-1 rounded mt-1 shadow-lg">
            ₹{player.stack.toLocaleString()}
          </div>
        </div>

        {/* Position indicators */}
        {player.isDealer && (
          <div className="absolute -top-2 -right-2 w-6 h-6 bg-white rounded-full border-2 border-gray-300 flex items-center justify-center text-xs font-bold text-black shadow-lg">
            D
          </div>
        )}
        {player.isSmallBlind && (
          <div className="absolute -top-2 -left-2 w-6 h-6 bg-blue-500 rounded-full border-2 border-blue-300 flex items-center justify-center text-xs font-bold text-white shadow-lg">
            SB
          </div>
        )}
        {player.isBigBlind && (
          <div className="absolute -top-2 -left-2 w-6 h-6 bg-red-500 rounded-full border-2 border-red-300 flex items-center justify-center text-xs font-bold text-white shadow-lg">
            BB
          </div>
        )}

        {/* Player cards - only shown if player has cards */}
        {player.cards && player.cards.length > 0 && player.cards[0] !== 'XX' && (
          <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 flex gap-1">
            {player.cards.map((card, idx) => (
              <div key={idx} className="scale-75">
                <PokerCard card={card} />
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
        <div className="relative w-full max-w-5xl mx-auto aspect-[5/3]">
          {/* Realistic Poker Table Base - Dark Wood */}
          <div className="absolute inset-0 bg-gradient-to-br from-amber-900 via-amber-800 to-amber-900 rounded-[50%] shadow-2xl border-8 border-amber-700">
            {/* Table Rail - Leather Padding */}
            <div className="absolute inset-2 rounded-[50%] border-4 border-amber-600 bg-gradient-to-br from-amber-800 to-amber-700">
              {/* Felt Playing Surface */}
              <div className="absolute inset-4 rounded-[50%] bg-gradient-to-br from-emerald-800 via-emerald-700 to-emerald-800 shadow-inner">
                {/* Felt texture overlay */}
                <div className="absolute inset-0 rounded-[50%] bg-emerald-700 opacity-30" 
                     style={{
                       backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.1) 1px, transparent 0)`
                     }}>
                </div>
                
                {/* Center area with community cards */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                  {displayData.communityCards && displayData.communityCards.length > 0 ? (
                    <div className="flex gap-1 mb-4 justify-center">
                      {displayData.communityCards.map((card, idx) => (
                        <PokerCard key={idx} card={card} />
                      ))}
                    </div>
                  ) : null}
                  
                  <div className="text-white text-xl font-bold mb-1">Pot: ₹{displayData.pot}</div>
                  <div className="text-emerald-200 text-sm">{displayData.gameType}</div>
                  <div className="text-amber-300 text-xs font-semibold mt-1 px-2 py-1 bg-black/30 rounded">
                    LOCAL GAME
                  </div>
                </div>

                {/* Dealer chip position indicator */}
                <div className="absolute top-1/4 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                  <div className="w-8 h-8 bg-white rounded-full border-2 border-gray-300 flex items-center justify-center text-xs font-bold">
                    D
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