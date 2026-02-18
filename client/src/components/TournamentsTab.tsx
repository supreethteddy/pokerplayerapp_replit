import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Trophy,
  Calendar,
  Users,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  Lock,
  Timer,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface TournamentsTabProps {
  user: any;
  kycApproved: boolean;
}

/**
 * Computes late registration state for a tournament
 */
function getLateRegInfo(tournament: any): {
  isActive: boolean;
  lateRegAllowed: boolean;
  lateRegOpen: boolean;
  lateRegExpired: boolean;
  remainingSeconds: number;
} {
  const isActive = tournament.status === "active" || tournament.status === "running";
  if (!isActive || !tournament.sessionStartedAt) {
    return { isActive, lateRegAllowed: false, lateRegOpen: false, lateRegExpired: false, remainingSeconds: 0 };
  }

  const lateRegMinutes = tournament.lateRegistrationMinutes || 0;
  if (lateRegMinutes <= 0) {
    return { isActive: true, lateRegAllowed: false, lateRegOpen: false, lateRegExpired: true, remainingSeconds: 0 };
  }

  const sessionStart = new Date(tournament.sessionStartedAt).getTime();
  const lateRegEndTime = sessionStart + lateRegMinutes * 60 * 1000;
  const now = Date.now();
  const remaining = Math.max(0, Math.floor((lateRegEndTime - now) / 1000));

  return {
    isActive: true,
    lateRegAllowed: true,
    lateRegOpen: remaining > 0,
    lateRegExpired: remaining <= 0,
    remainingSeconds: remaining,
  };
}

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Component that renders a live countdown timer for late registration
 */
function LateRegCountdown({ tournament }: { tournament: any }) {
  const [remaining, setRemaining] = useState(() => {
    const info = getLateRegInfo(tournament);
    return info.remainingSeconds;
  });

  useEffect(() => {
    const info = getLateRegInfo(tournament);
    setRemaining(info.remainingSeconds);

    if (!info.lateRegOpen) return;

    const interval = setInterval(() => {
      const updated = getLateRegInfo(tournament);
      setRemaining(updated.remainingSeconds);
      if (updated.remainingSeconds <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [tournament.sessionStartedAt, tournament.lateRegistrationMinutes]);

  if (remaining <= 0) {
    return (
      <div className="flex items-center gap-1.5 text-red-400 text-xs font-medium bg-red-500/10 px-2 py-1 rounded">
        <Lock className="w-3 h-3" />
        Late registration closed
      </div>
    );
  }

  const isUrgent = remaining <= 60;

  return (
    <div className={`flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded ${
      isUrgent
        ? "text-red-300 bg-red-500/20 animate-pulse"
        : "text-amber-300 bg-amber-500/15"
    }`}>
      <Timer className="w-3 h-3" />
      Late reg closes in {formatCountdown(remaining)}
    </div>
  );
}

export default function TournamentsTab({ user, kycApproved }: TournamentsTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setTick] = useState(0);

  // Force re-render every second for live countdown
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch upcoming tournaments
  const { data: tournamentsData, isLoading: tournamentsLoading } = useQuery<{
    tournaments: any[];
    total: number;
  }>({
    queryKey: ["/api/player-tournaments/upcoming", user?.clubId],
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        "/api/player-tournaments/upcoming"
      );
      if (!response.ok) throw new Error("Failed to fetch tournaments");
      return await response.json();
    },
    refetchInterval: 10000,
  });

  // Fetch my registrations
  const { data: myRegistrations, isLoading: registrationsLoading } = useQuery({
    queryKey: ["/api/player-tournaments/my-registrations", user?.id],
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        "/api/player-tournaments/my-registrations"
      );
      if (!response.ok) throw new Error("Failed to fetch registrations");
      return await response.json();
    },
    enabled: !!user?.id,
    refetchInterval: 10000,
  });

  // Register for tournament
  const registerMutation = useMutation({
    mutationFn: async (tournamentId: string) => {
      if (!kycApproved) {
        throw new Error(
          "Please complete KYC verification to register for tournaments"
        );
      }
      const response = await apiRequest(
        "POST",
        "/api/player-tournaments/register",
        { tournamentId }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to register");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/player-tournaments/my-registrations"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/player-tournaments/upcoming"],
      });
      toast({
        title: "Registered Successfully!",
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
      const response = await apiRequest(
        "DELETE",
        `/api/player-tournaments/register/${tournamentId}`
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to cancel");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/player-tournaments/my-registrations"],
      });
      toast({
        title: "Registration Cancelled",
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

  /**
   * Determine if a player can register for a tournament
   */
  const getRegistrationState = useCallback((tournament: any) => {
    const registered = isRegistered(tournament.id);
    const full = tournament.registeredPlayers >= tournament.maxPlayers;
    const preStartStatuses = ["scheduled", "upcoming", "registration_open", "registering"];
    const activeStatuses = ["active", "running"];

    if (registered) {
      return { canRegister: false, canCancel: true, reason: "registered", showButton: true };
    }

    if (preStartStatuses.includes(tournament.status)) {
      if (full) return { canRegister: false, canCancel: false, reason: "full", showButton: true };
      return { canRegister: true, canCancel: false, reason: "open", showButton: true };
    }

    if (activeStatuses.includes(tournament.status)) {
      const lateInfo = getLateRegInfo(tournament);

      if (!lateInfo.lateRegAllowed) {
        return { canRegister: false, canCancel: false, reason: "no_late_reg", showButton: true };
      }

      if (lateInfo.lateRegOpen) {
        if (full) return { canRegister: false, canCancel: false, reason: "full", showButton: true };
        return { canRegister: true, canCancel: false, reason: "late_reg_open", showButton: true };
      }

      return { canRegister: false, canCancel: false, reason: "late_reg_closed", showButton: true };
    }

    return { canRegister: false, canCancel: false, reason: "closed", showButton: false };
  }, [myRegistrations]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
      {/* Upcoming Tournaments */}
      <div className="lg:col-span-2 space-y-4">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Trophy className="w-5 h-5 mr-2 text-yellow-500" />
              Tournaments
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
                {tournamentsData.tournaments.map((tournament: any) => {
                  const regState = getRegistrationState(tournament);
                  const lateInfo = getLateRegInfo(tournament);

                  return (
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
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <Badge className={`${
                              lateInfo.isActive
                                ? "bg-green-600 text-white"
                                : "bg-emerald-600 text-white"
                            }`}>
                              {tournament.status === "active" || tournament.status === "running"
                                ? "Live"
                                : tournament.status?.charAt(0).toUpperCase() + tournament.status?.slice(1)}
                            </Badge>
                            {tournament.gameType && (
                              <Badge className="bg-slate-600 text-slate-200 text-xs">
                                {tournament.gameType === "rummy" ? "Rummy" : "Poker"}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div className="flex items-center text-slate-300 text-sm">
                          <Calendar className="w-4 h-4 mr-2 text-emerald-400" />
                          {new Date(tournament.startDate).toLocaleDateString()}
                        </div>
                        <div className="flex items-center text-slate-300 text-sm">
                          <Clock className="w-4 h-4 mr-2 text-emerald-400" />
                          {new Date(tournament.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="flex items-center text-slate-300 text-sm">
                          <DollarSign className="w-4 h-4 mr-2 text-yellow-400" />
                          Buy-in: ₹{tournament.buyIn?.toLocaleString()}
                        </div>
                        <div className="flex items-center text-slate-300 text-sm">
                          <Trophy className="w-4 h-4 mr-2 text-yellow-400" />
                          Prize: ₹{tournament.prizePool?.toLocaleString()}
                        </div>
                        <div className="flex items-center text-slate-300 text-sm col-span-2">
                          <Users className="w-4 h-4 mr-2 text-blue-400" />
                          {tournament.registeredPlayers}/{tournament.maxPlayers} players
                        </div>
                      </div>

                      {/* Late registration countdown for active tournaments */}
                      {lateInfo.isActive && (
                        <div className="mb-3">
                          {lateInfo.lateRegAllowed ? (
                            <LateRegCountdown tournament={tournament} />
                          ) : (
                            <div className="flex items-center gap-1.5 text-red-400 text-xs font-medium bg-red-500/10 px-2 py-1 rounded">
                              <Lock className="w-3 h-3" />
                              Tournament started - Registration closed
                            </div>
                          )}
                        </div>
                      )}

                      {/* Registration buttons */}
                      {regState.showButton && (
                        <div className="flex gap-2">
                          {regState.canCancel ? (
                            <Button
                              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                              onClick={() => cancelMutation.mutate(tournament.id)}
                              disabled={cancelMutation.isPending}
                            >
                              <XCircle className="w-4 h-4 mr-2" />
                              {cancelMutation.isPending ? "Cancelling..." : "Cancel Registration"}
                            </Button>
                          ) : regState.canRegister ? (
                            <Button
                              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                              onClick={() => registerMutation.mutate(tournament.id)}
                              disabled={!kycApproved || registerMutation.isPending}
                            >
                              <CheckCircle className="w-4 h-4 mr-2" />
                              {registerMutation.isPending
                                ? "Registering..."
                                : regState.reason === "late_reg_open"
                                ? "Late Register"
                                : "Register"}
                            </Button>
                          ) : (
                            <Button
                              className="flex-1 text-white opacity-60 cursor-not-allowed"
                              disabled
                            >
                              <Lock className="w-4 h-4 mr-2" />
                              {regState.reason === "full"
                                ? "Tournament Full"
                                : regState.reason === "no_late_reg"
                                ? "Registration Closed"
                                : regState.reason === "late_reg_closed"
                                ? "Late Registration Expired"
                                : "Registration Closed"}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
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
