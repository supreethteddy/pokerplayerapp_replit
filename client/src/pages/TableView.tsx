import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Users, Clock, DollarSign } from "lucide-react";

export default function TableView() {
  const { tableId } = useParams();
  const [, setLocation] = useLocation();
  
  // Fetch table data from API
  const { data: tables } = useQuery({
    queryKey: ['/api/tables'],
    refetchInterval: 2000,
  });
  
  const currentTable = tables?.find((table: any) => table.id === tableId);
  
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
                  
                  return (
                    <div
                      key={seatNumber}
                      className="absolute transform -translate-x-1/2 -translate-y-1/2"
                      style={{ left: `${x}%`, top: `${y}%` }}
                    >
                      {/* Player Seat */}
                      <div className="w-16 h-16 bg-gradient-to-br from-slate-700 to-slate-800 rounded-full border-2 border-slate-600 flex items-center justify-center shadow-lg">
                        <Users className="w-6 h-6 text-slate-400" />
                      </div>
                      {/* Seat Label */}
                      <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs text-white font-semibold">
                        Seat {seatNumber}
                      </div>
                    </div>
                  );
                })}

                {/* Center Pot Area */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    {/* Dealer Button */}
                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2">
                      <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full border-2 border-yellow-300 flex items-center justify-center shadow-lg">
                        <span className="text-xs font-bold text-black">D</span>
                      </div>
                    </div>
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
              <div className="text-white text-xl font-bold">0/{currentTable.maxPlayers || 9}</div>
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

        {/* Info Text */}
        <div className="mt-8 text-center text-slate-400">
          <p className="text-sm">This is a local offline poker game managed by casino staff.</p>
          <p className="text-xs mt-2">Players are seated by super admin, admin, or manager only.</p>
        </div>
      </div>
    </div>
  );
}