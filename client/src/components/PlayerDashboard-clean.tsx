import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import PlayerChat from "@/components/PlayerChat";
import { 
  Table, 
  Trophy, 
  Eye, 
  Plus, 
  MessageCircle,
  Star,
  Gift,
  Clock,
  Send,
  CheckCircle2
} from "lucide-react";

const PlayerDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [sendingFeedback, setSendingFeedback] = useState(false);

  // Fetch player data
  const { data: player } = useQuery({
    queryKey: ["player", user?.id],
    queryFn: () => fetch(`/api/players/${user?.id}`).then(res => res.json()),
    enabled: !!user?.id
  });

  // Fetch tables data
  const { data: tables, isLoading: tablesLoading } = useQuery({
    queryKey: ["tables"],
    queryFn: () => fetch("/api/tables").then(res => res.json())
  });

  // Fetch tournaments data
  const { data: tournaments, isLoading: tournamentsLoading } = useQuery({
    queryKey: ["tournaments"],
    queryFn: () => fetch("/api/tournaments").then(res => res.json())
  });

  // Feedback submission
  const sendFeedback = async () => {
    if (!feedbackMessage.trim()) return;

    setSendingFeedback(true);
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: user?.id,
          message: feedbackMessage.trim()
        })
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Thank you for your feedback!"
        });
        setFeedbackMessage("");
      } else {
        throw new Error("Failed to send feedback");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send feedback. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSendingFeedback(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="text-center py-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            Welcome to the Player Portal
          </h1>
          <p className="text-slate-400">
            {user?.firstName ? `Hello, ${user.firstName}!` : "Ready to play?"}
          </p>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="tables" className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-slate-800/50 border border-slate-700">
            <TabsTrigger value="tables" className="text-white">
              <Table className="w-4 h-4 mr-2" />
              Tables
            </TabsTrigger>
            <TabsTrigger value="tournaments" className="text-white">
              <Trophy className="w-4 h-4 mr-2" />
              Tournaments
            </TabsTrigger>
            <TabsTrigger value="vip" className="text-white">
              <Star className="w-4 h-4 mr-2" />
              VIP Club
            </TabsTrigger>
            <TabsTrigger value="support" className="text-white">
              <MessageCircle className="w-4 h-4 mr-2" />
              Support
            </TabsTrigger>
          </TabsList>

          {/* Tables Tab */}
          <TabsContent value="tables">
            <Card className="bg-slate-800/80 border-slate-700/50">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <Table className="w-5 h-5 mr-2" />
                  Available Tables
                </CardTitle>
              </CardHeader>
              <CardContent>
                {tablesLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-24 bg-slate-700" />
                    ))}
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {tables?.map((table: any) => (
                      <Card key={table.id} className="bg-slate-700/50 border-slate-600">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="font-semibold text-white">
                              Table {table.id}
                            </h3>
                            <Badge variant={table.isActive ? "default" : "secondary"}>
                              {table.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <p className="text-slate-300 text-sm mb-3">
                            Stakes: {table.smallBlind}/{table.bigBlind}
                          </p>
                          <div className="flex gap-2">
                            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                              <Plus className="w-4 h-4 mr-1" />
                              Join
                            </Button>
                            <Button size="sm" variant="outline">
                              <Eye className="w-4 h-4 mr-1" />
                              View
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tournaments Tab */}
          <TabsContent value="tournaments">
            <Card className="bg-slate-800/80 border-slate-700/50">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <Trophy className="w-5 h-5 mr-2" />
                  Active Tournaments
                </CardTitle>
              </CardHeader>
              <CardContent>
                {tournamentsLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-24 bg-slate-700" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {tournaments?.map((tournament: any) => (
                      <Card key={tournament.id} className="bg-slate-700/50 border-slate-600">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-semibold text-white mb-1">
                                {tournament.name}
                              </h3>
                              <p className="text-slate-300 text-sm">
                                Buy-in: ${tournament.buyIn}
                              </p>
                              <p className="text-slate-400 text-xs">
                                <Clock className="w-3 h-3 inline mr-1" />
                                {new Date(tournament.startTime).toLocaleString()}
                              </p>
                            </div>
                            <Button size="sm" className="bg-yellow-600 hover:bg-yellow-700">
                              Register
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* VIP Club Tab */}
          <TabsContent value="vip">
            <Card className="bg-gradient-to-r from-yellow-900/50 to-yellow-800/50 border-yellow-700/50">
              <CardHeader>
                <CardTitle className="text-yellow-300 flex items-center">
                  <Star className="w-5 h-5 mr-2" />
                  VIP Club
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Gift className="w-16 h-16 mx-auto mb-4 text-yellow-400" />
                  <h3 className="text-xl font-bold text-yellow-300 mb-2">
                    VIP Benefits
                  </h3>
                  <p className="text-yellow-200 mb-4">
                    Earn points and unlock exclusive rewards
                  </p>
                  <div className="bg-yellow-800/30 rounded-lg p-4 max-w-sm mx-auto">
                    <p className="text-yellow-200">
                      Your VIP Points: <span className="font-bold text-yellow-300">
                        {player?.vipPoints || 0}
                      </span>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Support Tab */}
          <TabsContent value="support">
            <Card className="bg-slate-800/80 border-slate-700/50">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <MessageCircle className="w-5 h-5 mr-2" />
                  Customer Support
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center py-8">
                  <MessageCircle className="w-12 h-12 mx-auto mb-4 text-emerald-400" />
                  <h3 className="text-lg font-semibold text-white mb-2">
                    Professional Support Available
                  </h3>
                  <p className="text-slate-400 mb-4">
                    Connect with our Guest Relations team for immediate assistance.
                  </p>
                  <p className="text-emerald-400 font-medium">
                    Chat widget is available in the bottom-right corner
                  </p>
                </div>

                {/* Feedback Form */}
                <div className="border-t border-slate-700 pt-4">
                  <h4 className="text-white font-medium mb-3">Send Feedback</h4>
                  <Textarea
                    placeholder="Share your thoughts or report an issue..."
                    value={feedbackMessage}
                    onChange={(e) => setFeedbackMessage(e.target.value)}
                    className="bg-slate-700/50 border-slate-600 text-white mb-3"
                  />
                  <Button
                    onClick={sendFeedback}
                    disabled={sendingFeedback || !feedbackMessage.trim()}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    {sendingFeedback ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    Send Feedback
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modern Pusher/OneSignal Chat Widget */}
      <div className="fixed bottom-4 right-4 w-80">
        <PlayerChat 
          playerId={user?.id || 0}
          playerName={`${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Player'}
          playerEmail={user?.email || 'player@example.com'}
        />
      </div>
    </div>
  );
};

export default PlayerDashboard;