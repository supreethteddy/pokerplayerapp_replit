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
  // Calculate position around the elliptical table
  const angle = (position / total) * 2 * Math.PI - Math.PI / 2;
  const radiusX = 45; // Horizontal radius percentage
  const radiusY = 35; // Vertical radius percentage
  
  const x = 50 + radiusX * Math.cos(angle);
  const y = 50 + radiusY * Math.sin(angle);

  if (!player) {
    return (
      <div 
        className="absolute transform -translate-x-1/2 -translate-y-1/2"
        style={{ left: `${x}%`, top: `${y}%` }}
      >
        <div className="w-16 h-16 border-2 border-dashed border-gray-400 rounded-full flex items-center justify-center bg-gray-100/10">
          <Users className="w-6 h-6 text-gray-400" />
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
        {/* Player avatar and info */}
        <div className="bg-black border-2 border-yellow-500 rounded-lg p-2 min-w-[80px] text-center">
          {player.isDealer && (
            <div className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center">
              <Crown className="w-3 h-3 text-black" />
            </div>
          )}
          
          <div className="w-12 h-12 mx-auto mb-1 bg-gradient-to-br from-blue-400 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
            {player.username.slice(0, 2).toUpperCase()}
          </div>
          
          <div className="text-white text-xs font-semibold">{player.username}</div>
          <div className="text-yellow-400 text-xs">₹{player.stack.toLocaleString()}</div>
          
          {player.isSmallBlind && <Badge className="text-xs mt-1 bg-blue-600">SB</Badge>}
          {player.isBigBlind && <Badge className="text-xs mt-1 bg-red-600">BB</Badge>}
        </div>

        {/* Player cards */}
        {player.cards && player.cards.length > 0 && (
          <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 flex gap-1">
            {player.cards.map((card, idx) => (
              <PokerCard key={idx} card={card} />
            ))}
          </div>
        )}

        {/* Player action */}
        {player.action && (
          <div className="absolute -top-8 left-1/2 transform -translate-x-1/2">
            <Badge className={`text-xs ${
              player.action === 'fold' ? 'bg-gray-600' :
              player.action === 'call' ? 'bg-green-600' :
              player.action === 'raise' ? 'bg-orange-600' :
              player.action === 'all-in' ? 'bg-red-600' :
              'bg-blue-600'
            }`}>
              {player.action.toUpperCase()}
            </Badge>
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

  // Mock data for demonstration - replace with real data
  const mockTableData: TableData = {
    id: tableId || '',
    name: "Cash Table 1",
    gameType: "Texas Hold'em",
    stakes: "₹100/₹200",
    pot: 1500,
    maxPlayers: 6,
    communityCards: ['Ah', 'Kd', '9s', 'XX', 'XX'],
    isActive: true,
    players: [
      {
        id: 1,
        username: "IOSQA",
        stack: 4950,
        position: 0,
        cards: ['XX', 'XX'],
        isSmallBlind: true
      },
      {
        id: 2,
        username: "jagrub23",
        stack: 11960,
        position: 1,
        cards: ['XX', 'XX']
      },
      {
        id: 3,
        username: "krencyga1",
        stack: 480,
        position: 2,
        cards: ['XX', 'XX']
      },
      {
        id: 4,
        username: "vyomqa1",
        stack: 490,
        position: 3,
        cards: ['2h', '2c'],
        isDealer: true
      },
      {
        id: 5,
        username: "vyomqa2",
        stack: 8360,
        position: 4,
        cards: ['XX', 'XX']
      },
      {
        id: 6,
        username: "Nirav4545",
        stack: 4650,
        position: 5,
        cards: ['XX', 'XX'],
        isBigBlind: true
      }
    ]
  };

  const displayData = tableData || mockTableData;

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
    <div className="min-h-screen bg-gradient-to-b from-blue-900 via-blue-800 to-blue-700">
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
        </div>
        
        <Button 
          className="bg-blue-600 hover:bg-blue-700"
          onClick={() => {
            // Handle join table logic
            setLocation('/');
          }}
        >
          Join Similar
        </Button>
      </div>

      {/* Community Cards */}
      <div className="absolute top-20 right-4 flex gap-1 bg-black/50 p-2 rounded-lg">
        {displayData.communityCards.map((card, idx) => (
          <PokerCard key={idx} card={card} />
        ))}
      </div>

      {/* Main Table Area */}
      <div className="flex-1 relative px-4 py-8">
        <div className="relative w-full max-w-4xl mx-auto aspect-[4/3]">
          {/* Table Surface */}
          <div className="absolute inset-4 border-4 border-yellow-500 rounded-[50%] bg-gradient-to-br from-green-800 to-green-900 shadow-2xl">
            {/* Table felt pattern */}
            <div className="absolute inset-2 rounded-[50%] bg-gradient-to-br from-green-700 to-green-800 opacity-50"></div>
            
            {/* Center pot area */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
              <div className="text-white text-2xl font-bold mb-2">Pot: ₹{displayData.pot}</div>
              <div className="text-gray-300 text-sm">{displayData.gameType}</div>
              <div className="text-yellow-400 text-sm font-semibold mt-1">2/2(HOLD'EM)</div>
            </div>
          </div>

          {/* Player Seats */}
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

      {/* Action Buttons */}
      <div className="absolute bottom-0 left-0 right-0 bg-black/80 p-4">
        <div className="flex justify-center gap-4 max-w-md mx-auto">
          <Button className="flex-1 bg-gray-700 hover:bg-gray-600 text-white">
            F/C
          </Button>
          <Button className="flex-1 bg-gray-700 hover:bg-gray-600 text-white">
            Check
          </Button>
          <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white">
            Call Any
          </Button>
        </div>
      </div>
    </div>
  );
}