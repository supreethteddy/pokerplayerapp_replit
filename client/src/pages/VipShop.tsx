import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { 
  Star, 
  ArrowLeft,
  Gift,
  Trophy,
  CreditCard,
  Package
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";

export default function VipShop() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch VIP points calculation
  const { data: vipData, isLoading: vipLoading } = useQuery({
    queryKey: ['/api/vip-points/calculate', user?.id],
    enabled: !!user?.id,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const redeemPoints = useMutation({
    mutationFn: (redemption: { redemptionType: string; pointsRequired: number }) =>
      apiRequest("POST", "/api/vip-points/redeem", {
        playerId: user?.id,
        ...redemption
      }),
    onSuccess: () => {
      toast({
        title: "Redemption Request Sent",
        description: "Your VIP points redemption request has been sent for approval.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/vip-points/calculate'] });
    },
    onError: (error: any) => {
      toast({
        title: "Redemption Failed",
        description: error.message || "Failed to process redemption request.",
        variant: "destructive",
      });
    },
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white">Please log in to access VIP Shop</div>
      </div>
    );
  }

  const vipPoints = vipData?.calculation?.totalVipPoints || 0;
  const breakdown = vipData?.calculation;

  return (
    <div className="min-h-screen bg-slate-900 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link href="/">
            <Button variant="outline" className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-white flex items-center">
            <Star className="w-8 h-8 mr-3 text-yellow-500" />
            VIP Shop
          </h1>
        </div>

        {/* VIP Points Display */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Star className="w-5 h-5 mr-2 text-yellow-500" />
              Your VIP Points
            </CardTitle>
          </CardHeader>
          <CardContent>
            {vipLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <div className="space-y-4">
                {/* Total Points */}
                <div className="text-center p-6 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-lg">
                  <div className="text-4xl font-bold text-yellow-400">
                    {vipPoints.toFixed(1)}
                  </div>
                  <div className="text-slate-300 text-lg">Total VIP Points</div>
                </div>

                {/* Points Breakdown */}
                {breakdown && (
                  <div className="space-y-3">
                    <div className="text-white font-semibold text-lg">Points Breakdown:</div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-slate-700 p-4 rounded-lg text-center">
                        <div className="text-yellow-400 text-2xl font-bold">
                          {(breakdown.buyInPoints || breakdown.bigBlindPoints || 0).toFixed(1)}
                        </div>
                        <div className="text-slate-300 text-sm">
                          Buy-in (₹{breakdown.avgBuyIn || breakdown.avgBigBlind || 0} × 0.1)
                        </div>
                      </div>
                      <div className="bg-slate-700 p-4 rounded-lg text-center">
                        <div className="text-yellow-400 text-2xl font-bold">
                          {(breakdown.rsPlayedPoints || breakdown.hoursPlayedPoints || 0).toFixed(1)}
                        </div>
                        <div className="text-slate-300 text-sm">
                          Rs Played (₹{breakdown.totalRsPlayed || breakdown.totalHoursPlayed || 0} × 3)
                        </div>
                      </div>
                      <div className="bg-slate-700 p-4 rounded-lg text-center">
                        <div className="text-yellow-400 text-2xl font-bold">
                          {breakdown.frequencyPoints.toFixed(1)}
                        </div>
                        <div className="text-slate-300 text-sm">
                          Visit Frequency ({breakdown.visitFrequency} days × 5)
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Formula Display */}
                <div className="text-sm text-slate-400 p-3 bg-slate-900 rounded text-center">
                  <strong>Formula:</strong> VIP Points = (Buy-in × 0.1) + (Rs Played × 3) + (Visit Frequency × 5)
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Redemption Options */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Tournament Tickets */}
          <Card className="bg-slate-800 border-slate-700 hover:border-yellow-500/50 transition-colors">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <Trophy className="w-5 h-5 mr-2 text-yellow-500" />
                Tournament Tickets
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-400">500</div>
                <div className="text-slate-300">Points Required</div>
              </div>
              <p className="text-slate-300 text-sm">
                Get free entry to our premium tournaments with guaranteed prize pools.
              </p>
              <Button
                onClick={() => redeemPoints.mutate({ redemptionType: "Tournament Ticket", pointsRequired: 500 })}
                disabled={vipPoints < 500 || redeemPoints.isPending}
                className="w-full bg-yellow-600 hover:bg-yellow-700 text-white"
              >
                {redeemPoints.isPending ? "Processing..." : "Redeem Now"}
              </Button>
            </CardContent>
          </Card>

          {/* Buy-in Discounts */}
          <Card className="bg-slate-800 border-slate-700 hover:border-green-500/50 transition-colors">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <CreditCard className="w-5 h-5 mr-2 text-green-500" />
                Buy-in Discounts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-400">300</div>
                <div className="text-slate-300">Points Required</div>
              </div>
              <p className="text-slate-300 text-sm">
                Get 10% discount on your next table buy-in for any game type.
              </p>
              <Button
                onClick={() => redeemPoints.mutate({ redemptionType: "Buy-in Discount", pointsRequired: 300 })}
                disabled={vipPoints < 300 || redeemPoints.isPending}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                {redeemPoints.isPending ? "Processing..." : "Redeem Now"}
              </Button>
            </CardContent>
          </Card>

          {/* Premium Products */}
          <Card className="bg-slate-800 border-slate-700 hover:border-purple-500/50 transition-colors">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <Package className="w-5 h-5 mr-2 text-purple-500" />
                Premium Products
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-400">1000</div>
                <div className="text-slate-300">Points Required</div>
              </div>
              <p className="text-slate-300 text-sm">
                Exclusive poker merchandise, branded accessories, and premium gifts.
              </p>
              <Button
                onClick={() => redeemPoints.mutate({ redemptionType: "Premium Product", pointsRequired: 1000 })}
                disabled={vipPoints < 1000 || redeemPoints.isPending}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
              >
                {redeemPoints.isPending ? "Processing..." : "Redeem Now"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Additional Information */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Gift className="w-5 h-5 mr-2 text-emerald-500" />
              How to Earn VIP Points
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="text-center p-4 bg-slate-700 rounded-lg">
                <div className="text-emerald-400 font-bold text-lg">Big Blind</div>
                <div className="text-slate-300">Play at higher stakes tables to earn more points from big blind amounts</div>
              </div>
              <div className="text-center p-4 bg-slate-700 rounded-lg">
                <div className="text-blue-400 font-bold text-lg">Rs Played</div>
                <div className="text-slate-300">The more you play and wager, the more points you accumulate</div>
              </div>
              <div className="text-center p-4 bg-slate-700 rounded-lg">
                <div className="text-yellow-400 font-bold text-lg">Daily Visits</div>
                <div className="text-slate-300">Log in daily to boost your visit frequency multiplier</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}