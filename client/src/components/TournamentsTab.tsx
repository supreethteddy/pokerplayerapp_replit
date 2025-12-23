import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Trophy, Calendar, Users, DollarSign, Clock, CheckCircle, XCircle } from "lucide-react";
import { API_BASE_URL } from "@/lib/api/config";

interface TournamentsTabProps {
  user: any;
  kycApproved: boolean;
}

export default function TournamentsTab({ user, kycApproved }: TournamentsTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch upcoming tournaments
  const { data: tournamentsData, isLoading: tournamentsLoading } = useQuery({
    queryKey: ['/api/player-tournaments/upcoming', user?.clubId],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/player-tournaments/upcoming`, {
        headers: {
          'x-club-id': localStorage.getItem('clubId') || '',
        },
      });
      if (!response.ok) throw new Error('Failed to fetch tournaments');
      return response.json();
    },
    refetchInterval: 30000,
  });

  // Fetch my registrations
  const { data: myRegistrations, isLoading: registrationsLoading } = useQuery({
    queryKey: ['/api/player-tournaments/my-registrations', user?.id],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/player-tournaments/my-registrations`, {
        headers: {
          'x-player-id': user?.id || '',
          'x-club-id': localStorage.getItem('clubId') || '',
        },
      });
      if (!response.ok) throw new Error('Failed to fetch registrations');
      return response.json();
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  // Register for tournament
  const registerMutation = useMutation({
    mutationFn: async (tournamentId: string) => {
      if (!kycApproved) {
        throw new Error('Please complete KYC verification to register for tournaments');
      }
      const response = await fetch(`${API_BASE_URL}/player-tournaments/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-player-id': user?.id || '',
          'x-club-id': localStorage.getItem('clubId') || '',
        },
        body: JSON.stringify({ tournamentId }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to register');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/player-tournaments/my-registrations'] });
      toast({
        title: "✓ Registered Successfully!",
        description: "You're registered for the tournament",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Registration Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Cancel registration
  const cancelMutation = useMutation({
    mutationFn: async (tournamentId: string) => {
      const response = await fetch(`${API_BASE_URL}/player-tournaments/register/${tournamentId}`, {
        method: 'DELETE',
        headers: {
          'x-player-id': user?.id || '',
          'x-club-id': localStorage.getItem('clubId') || '',
        },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to cancel');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/player-tournaments/my-registrations'] });
      toast({
        title: "✓ Registration Cancelled",
        description: "Your registration has been cancelled",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Cancellation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const isRegistered = (tournamentId: string) => {
    return myRegistrations?.registrations?.some((r: any) => r.tournamentId === tournamentId);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
      {/* Upcoming Tournaments */}
      <div className="lg:col-span-2 space-y-4">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Trophy className="w-5 h-5 mr-2 text-yellow-500" />
              Upcoming Tournaments
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tournamentsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse h-32 bg-slate-700 rounded-lg"></div>
                ))}
              </div>
            ) : tournamentsData?.tournaments?.length > 0 ? (
              <div className="space-y-4">
                {tournamentsData.tournaments.map((tournament: any) => (
                  <div
                    key={tournament.id}
                    className="bg-slate-700 p-4 rounded-lg border border-slate-600"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-white font-semibold text-lg flex items-center">
                          {tournament.name}
                          {isRegistered(tournament.id) && (
                            <CheckCircle className="w-4 h-4 ml-2 text-green-400" />
                          )}
                        </h3>
                        <Badge className="mt-1 bg-emerald-600 text-white">
                          {tournament.status}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="flex items-center text-slate-300 text-sm">
                        <Calendar className="w-4 h-4 mr-2 text-emerald-400" />
                        {new Date(tournament.startDate).toLocaleDateString()}
                      </div>
                      <div className="flex items-center text-slate-300 text-sm">
                        <Clock className="w-4 h-4 mr-2 text-emerald-400" />
                        {new Date(tournament.startDate).toLocaleTimeString()}
                      </div>
                      <div className="flex items-center text-slate-300 text-sm">
                        <DollarSign className="w-4 h-4 mr-2 text-yellow-400" />
                        Buy-in: ₹{tournament.buyIn}
                      </div>
                      <div className="flex items-center text-slate-300 text-sm">
                        <Trophy className="w-4 h-4 mr-2 text-yellow-400" />
                        Prize: ₹{tournament.prizePool.toLocaleString()}
                      </div>
                      <div className="flex items-center text-slate-300 text-sm col-span-2">
                        <Users className="w-4 h-4 mr-2 text-blue-400" />
                        {tournament.registeredPlayers}/{tournament.maxPlayers} players
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {isRegistered(tournament.id) ? (
                        <Button
                          className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                          onClick={() => cancelMutation.mutate(tournament.id)}
                          disabled={cancelMutation.isPending}
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          {cancelMutation.isPending ? 'Cancelling...' : 'Cancel Registration'}
                        </Button>
                      ) : (
                        <Button
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                          onClick={() => registerMutation.mutate(tournament.id)}
                          disabled={!kycApproved || registerMutation.isPending || tournament.registeredPlayers >= tournament.maxPlayers}
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          {registerMutation.isPending ? 'Registering...' : 'Register'}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Trophy className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">No upcoming tournaments</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* My Registrations */}
      <div className="space-y-4">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center text-sm">
              <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
              My Registrations
            </CardTitle>
          </CardHeader>
          <CardContent>
            {registrationsLoading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-16 bg-slate-700 rounded"></div>
                <div className="h-16 bg-slate-700 rounded"></div>
              </div>
            ) : myRegistrations?.registrations?.length > 0 ? (
              <div className="space-y-2">
                {myRegistrations.registrations.map((reg: any) => (
                  <div
                    key={reg.id}
                    className="bg-slate-700 p-3 rounded-lg border border-slate-600"
                  >
                    <p className="text-white font-semibold text-sm">{reg.tournamentName}</p>
                    <Badge className="mt-1 bg-green-600 text-white text-xs">
                      Registered
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 text-sm text-center py-4">
                No active registrations
              </p>
            )}
          </CardContent>
        </Card>

        {!kycApproved && (
          <Card className="bg-amber-900/20 border-amber-600">
            <CardContent className="pt-4">
              <p className="text-amber-200 text-sm text-center">
                Complete KYC verification to register for tournaments
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

