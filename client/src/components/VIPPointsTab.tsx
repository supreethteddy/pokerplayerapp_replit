import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Star, Award, Gift, TrendingUp, Crown, Sparkles } from "lucide-react";
import { vipService } from "@/lib/api";

interface VIPPointsTabProps {
  user: any;
}

export default function VIPPointsTab({ user }: VIPPointsTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch VIP points data
  const { data: vipData, isLoading: vipLoading } = useQuery({
    queryKey: ['/api/player-vip/points', user?.id],
    queryFn: async () => {
      const response = await fetch('http://localhost:3333/api/player-vip/points', {
        headers: {
          'x-player-id': user?.id || '',
          'x-club-id': localStorage.getItem('clubId') || '',
        },
      });
      if (!response.ok) throw new Error('Failed to fetch VIP points');
      return response.json();
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch club points
  const { data: clubPointsData } = useQuery({
    queryKey: ['/api/player-vip/club-points', user?.id],
    queryFn: async () => {
      const response = await fetch('http://localhost:3333/api/player-vip/club-points', {
        headers: {
          'x-player-id': user?.id || '',
          'x-club-id': localStorage.getItem('clubId') || '',
        },
      });
      if (!response.ok) throw new Error('Failed to fetch club points');
      return response.json();
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  // Fetch available rewards
  const { data: rewardsData } = useQuery({
    queryKey: ['/api/player-vip/rewards'],
    queryFn: async () => {
      const response = await fetch('http://localhost:3333/api/player-vip/rewards', {
        headers: {
          'x-club-id': localStorage.getItem('clubId') || '',
        },
      });
      if (!response.ok) throw new Error('Failed to fetch rewards');
      return response.json();
    },
    refetchInterval: 60000, // Refresh every minute
  });

  // Redeem points mutation
  const redeemMutation = useMutation({
    mutationFn: async ({ rewardId, points }: { rewardId: string; points: number }) => {
      const response = await fetch('http://localhost:3333/api/player-vip/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-player-id': user?.id || '',
          'x-club-id': localStorage.getItem('clubId') || '',
        },
        body: JSON.stringify({ rewardId, pointsToRedeem: points }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to redeem points');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/player-vip/points'] });
      toast({
        title: "✓ Points Redeemed!",
        description: "Your reward will be processed shortly",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Redemption Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'Bronze': return 'bg-orange-700 text-orange-100 border-orange-500';
      case 'Silver': return 'bg-gray-400 text-gray-900 border-gray-300';
      case 'Gold': return 'bg-yellow-500 text-yellow-900 border-yellow-400';
      case 'Platinum': return 'bg-cyan-500 text-cyan-900 border-cyan-400';
      case 'Diamond': return 'bg-purple-600 text-purple-100 border-purple-400';
      default: return 'bg-slate-600 text-slate-100 border-slate-500';
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
      {/* VIP Status Card */}
      <div className="lg:col-span-2 space-y-4">
        <Card className="bg-gradient-to-br from-purple-900 to-purple-800 border-purple-500">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Crown className="w-6 h-6 mr-2 text-yellow-400" />
              VIP Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {vipLoading ? (
              <div className="animate-pulse space-y-3">
                <div className="h-16 bg-purple-700 rounded"></div>
                <div className="h-24 bg-purple-700 rounded"></div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Current Tier */}
                <div className="bg-purple-700/30 p-6 rounded-lg border border-purple-400/30">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-2xl font-bold text-white">Current Tier</h3>
                    <Badge className={`text-lg px-4 py-2 ${getTierColor(vipData?.tier || 'Bronze')}`}>
                      {vipData?.tier || 'Bronze'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-3xl font-bold text-white">
                        {vipData?.vipPoints?.toLocaleString() || 0}
                      </p>
                      <p className="text-purple-200">VIP Points</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-yellow-400">
                        {vipData?.multiplier}x
                      </p>
                      <p className="text-purple-200">Multiplier</p>
                    </div>
                  </div>
                </div>

                {/* Progress to Next Tier */}
                {vipData?.nextTier && (
                  <div className="bg-purple-700/20 p-4 rounded-lg border border-purple-400/20">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-purple-200">Next Tier: {vipData.nextTier.name}</p>
                      <p className="text-white font-semibold">
                        {vipData.nextTier.pointsToNext} points to go
                      </p>
                    </div>
                    <div className="w-full bg-purple-900 rounded-full h-3">
                      <div
                        className="bg-gradient-to-r from-yellow-400 to-yellow-600 h-3 rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, ((vipData.vipPoints / vipData.nextTier.pointsRequired) * 100))}%`
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* All Tiers */}
                <div>
                  <h4 className="text-white font-semibold mb-3 flex items-center">
                    <Award className="w-4 h-4 mr-2 text-yellow-400" />
                    All VIP Tiers
                  </h4>
                  <div className="space-y-2">
                    {vipData?.allTiers?.map((tier: any) => (
                      <div
                        key={tier.name}
                        className={`p-3 rounded-lg border ${
                          tier.name === vipData.tier
                            ? 'bg-purple-600/40 border-purple-400'
                            : 'bg-purple-900/20 border-purple-700/30'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <Badge className={`${getTierColor(tier.name)} mr-3`}>
                              {tier.name}
                            </Badge>
                            <span className="text-purple-200 text-sm">
                              {tier.minPoints.toLocaleString()}+ points
                            </span>
                          </div>
                          <span className="text-yellow-400 font-semibold">
                            {tier.multiplier}x
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Club Points */}
                {clubPointsData && (
                  <div className="bg-emerald-900/30 p-4 rounded-lg border border-emerald-500/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-emerald-200 mb-1">Club Points</p>
                        <p className="text-2xl font-bold text-white">
                          {clubPointsData.clubPoints?.toLocaleString() || 0}
                        </p>
                      </div>
                      <Sparkles className="w-8 h-8 text-emerald-400" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Rewards Catalog */}
      <div className="space-y-4">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Gift className="w-5 h-5 mr-2 text-emerald-500" />
              Available Rewards
            </CardTitle>
          </CardHeader>
          <CardContent>
            {rewardsData?.rewards?.length > 0 ? (
              <div className="space-y-3">
                {rewardsData.rewards.map((reward: any) => (
                  <div
                    key={reward.id}
                    className="bg-slate-700 p-4 rounded-lg border border-slate-600"
                  >
                    <h4 className="text-white font-semibold mb-1">
                      {reward.name}
                    </h4>
                    <p className="text-slate-300 text-sm mb-3">
                      {reward.description}
                    </p>
                    <div className="flex items-center justify-between">
                      <Badge className="bg-emerald-600 text-white">
                        {reward.pointsCost} points
                      </Badge>
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => redeemMutation.mutate({ rewardId: reward.id, points: reward.pointsCost })}
                        disabled={!reward.available || (vipData?.vipPoints || 0) < reward.pointsCost || redeemMutation.isPending}
                      >
                        {redeemMutation.isPending ? 'Redeeming...' : 'Redeem'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 text-sm text-center py-4">
                No rewards available at the moment
              </p>
            )}
          </CardContent>
        </Card>

        {/* How to Earn Points */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center text-sm">
              <TrendingUp className="w-4 h-4 mr-2 text-emerald-500" />
              How to Earn Points
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-slate-300">
              <p>• Play games: 1 point per ₹10 spent</p>
              <p>• Tier multipliers boost earnings</p>
              <p>• Referrals earn bonus points</p>
              <p>• Special events offer double points</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
