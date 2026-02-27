import { useUltraFastAuth } from "@/hooks/useUltraFastAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useRouter } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAvailableTables, useWaitlistStatus, useCancelWaitlist, QUERY_KEYS } from "@/hooks/usePlayerAPI";
import { useRealtimeTables } from "@/hooks/useRealtimeTables";
import { useRealtimeWaitlist } from "@/hooks/useRealtimeWaitlist";
import { useRealtimeBalance } from "@/hooks/useRealtimeBalance";
import { useRealtimeBuyIn } from "@/hooks/useRealtimeBuyIn";
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";
import { useRealtimeCreditRequests } from "@/hooks/useRealtimeCreditRequests";
import { useRealtimeTournaments } from "@/hooks/useRealtimeTournaments";
import { useRealtimeProfileRequests } from "@/hooks/useRealtimeProfileRequests";
import { useRealtimeOffers } from "@/hooks/useRealtimeOffers";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
// Switch removed - preferences section eliminated
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast, toast } from "@/hooks/use-toast";
// Dialog removed for document viewer
import {
  Spade,
  Table,
  Clock,
  // Settings icon removed - preferences section eliminated
  BarChart3,
  User,
  LogOut,
  Users,
  CreditCard,
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  AlertTriangle,
  Phone,
  Gift,
  Play,
  Image,
  Star,
  Calendar,
  MessageCircle,
  MessageSquare,
  Send,
  Bell,
  Trophy,
  X,
  Plus,
  Info,
  RotateCcw,
  Trash2,
  Coffee,
  Lock,
  Timer,
  Edit3,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useState, useEffect, useCallback } from "react";
import type {
  Table as TableType,
  SeatRequest,
  KycDocument,
} from "@shared/schema";
import DualBalanceDisplay from "./DualBalanceDisplay";
import { PlayerBalanceDisplay } from "./PlayerBalanceDisplay";
import { PlayerTransactionHistory } from "./PlayerTransactionHistory";
import { PlaytimeTracker } from "./PlaytimeTracker";
// Cash-out and credit transfer removed - players can only view balance, all financial operations handled by cashier
// TableOperations removed - players can only view balance, all operations handled by managers/cashiers
import OfferBanner from "./OfferBanner";
import OfferCarousel from "./OfferCarousel";
import NotificationPopup from "./NotificationPopup";
import TableView from "./TableView";

import PlayerChatSystem from "./PlayerChatSystem";
import NotificationHistoryTab from "./NotificationHistoryTab";
import FoodBeverageTab from "./FoodBeverageTab";
import CreditRequestCard from "./CreditRequestCard";
import { useSeatAssignment } from "@/hooks/useSeatAssignment";

// API Base URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3333/api';
import { usePlayerGameStatus } from "@/hooks/usePlayerGameStatus";
import { whitelabelConfig } from "@/lib/whitelabeling";
import { fetchClubBranding, applyClubBranding, getGradientClasses, getGradientStyle, type ClubBranding } from "@/lib/clubBranding";
import { usePlayerBalance } from "@/hooks/usePlayerBalance";

// Scrollable Offers Display Component
const ScrollableOffersDisplay = ({ branding }: { branding?: ClubBranding | null }) => {
  const {
    data: offersResponse,
    isLoading,
    error,
  } = useQuery<{ offers: any[]; total: number }>({
    queryKey: ["/api/player-offers/active"],
    queryFn: async () => {
      console.log('🎁 [OFFERS UI] Fetching offers from /api/player-offers/active');
      const response = await apiRequest("GET", "/api/player-offers/active");
      const data = await response.json();
      console.log('🎁 [OFFERS UI] Received data:', data);
      return data;
    },
    retry: 1,
  });

  const trackOfferView = useMutation({
    mutationFn: (offerId: string) =>
      apiRequest("POST", "/api/player-offers/view", { offerId }),
  });

  const [offerDetailsOpen, setOfferDetailsOpen] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<any | null>(null);

  // Use only real staff offers from database - no fallback demo data
  const displayOffers =
    offersResponse && Array.isArray(offersResponse.offers)
      ? offersResponse.offers
      : [];

  console.log('🎁 [OFFERS UI] displayOffers:', displayOffers);
  console.log('🎁 [OFFERS UI] error:', error);
  console.log('🎁 [OFFERS UI] isLoading:', isLoading);

  // Handle error state gracefully
  if (error) {
    return (
      <div className="space-y-4">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Gift className="w-5 h-5 mr-2 text-emerald-500" />
              Special Offers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-slate-400 text-center py-8">
              <Gift className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No offers available at the moment</p>
              <p className="text-sm mt-2">
                Check back later for special promotions!
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <Gift className="w-5 h-5 mr-2 text-emerald-500" />
            Special Offers (
            {Array.isArray(displayOffers) ? displayOffers.length : 0})
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Show message when no offers available */}
      {displayOffers.length === 0 && !isLoading && (
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-8">
            <div className="text-slate-400 text-center">
              <Gift className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No special offers available at the moment</p>
              <p className="text-sm mt-2">
                Check back later for exclusive promotions!
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scrollable offers container */}
      <div className="max-h-[600px] overflow-y-auto space-y-4 pr-2 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800">
        {Array.isArray(displayOffers) &&
          displayOffers.map((offer: any) => (
            <Card
              key={offer.id}
              id={`offer-${offer.id}`}
              className={`border-2 hover:opacity-90 transition-all duration-300 ${branding ? getGradientClasses(branding.gradient) : 'bg-gradient-to-br from-emerald-800 to-emerald-900 border-emerald-600'}`}
              onClick={() => trackOfferView.mutate(offer.id)}
              style={branding ? { borderColor: branding.skinColor } : {}}
            >
              <CardContent className="p-0">
                {/* Staff portal media or fallback */}
                <div className="relative">
                  {offer.video_url ? (
                    <div className="aspect-video rounded-t-lg overflow-hidden bg-slate-900">
                      <video
                        className="w-full h-full object-cover"
                        poster={offer.image_url}
                        controls
                        preload="metadata"
                      >
                        <source src={offer.video_url} type="video/mp4" />
                      </video>
                    </div>
                  ) : offer.image_url ? (
                    <div className="aspect-video rounded-t-lg overflow-hidden bg-slate-900">
                      <img
                        src={offer.image_url}
                        alt={offer.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className={`aspect-video rounded-t-lg flex items-center justify-center ${branding ? getGradientClasses(branding.gradient) : 'bg-gradient-to-br from-emerald-600 to-emerald-800'}`}>
                      <Gift className="w-16 h-16 text-white" />
                    </div>
                  )}

                  {/* Offer type badge */}
                  <Badge
                    className={`absolute top-3 right-3 ${offer.offer_type === "banner"
                      ? "bg-blue-600"
                      : offer.offer_type === "carousel"
                        ? "bg-purple-600"
                        : "bg-orange-600"
                      }`}
                  >
                    {offer.offer_type}
                  </Badge>
                </div>

                {/* Dynamic Content Area */}
                <div className="p-6">
                  <h3 className="text-xl font-bold text-white mb-3">
                    {offer.title}
                  </h3>

                  {/* Dynamic description with responsive sizing */}
                  {offer.description && (
                    <div className="text-slate-300 leading-relaxed mb-4">
                      <p
                        className={`${offer.description.length > 200
                          ? "text-sm"
                          : offer.description.length > 100
                            ? "text-base"
                            : "text-lg"
                          }`}
                      >
                        {offer.description}
                      </p>
                    </div>
                  )}

                  {/* Date range if available */}
                  {(offer.start_date || offer.end_date) && (
                    <div className="flex items-center text-sm text-slate-400 mb-4">
                      <Calendar className="w-4 h-4 mr-2" />
                      {offer.start_date &&
                        new Date(offer.start_date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}
                      {offer.start_date && offer.end_date && " - "}
                      {offer.end_date &&
                        new Date(offer.end_date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}
                    </div>
                  )}

                  {/* Action button */}
                  <Button
                    className="w-full hover:opacity-90"
                    style={branding ? { backgroundColor: branding.skinColor } : {}}
                    onClick={(e) => {
                      e.stopPropagation();
                      trackOfferView.mutate(offer.id);
                      // Use click_url if available, otherwise show details dialog
                      if (offer.click_url) {
                        window.open(offer.click_url, "_blank");
                      } else {
                        setSelectedOffer(offer);
                        setOfferDetailsOpen(true);
                      }
                    }}
                  >
                    <Star className="w-4 h-4 mr-2" />
                    {offer.click_url ? "Visit Offer" : "View Details"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
      </div>

      {/* Offer Details Dialog */}
      <Dialog open={offerDetailsOpen} onOpenChange={setOfferDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white text-2xl flex items-center">
              <Gift className="w-6 h-6 mr-2 text-emerald-500" />
              {selectedOffer?.title || "Offer Details"}
            </DialogTitle>
          </DialogHeader>
          {selectedOffer && (
            <div className="space-y-4">
              {/* Media */}
              {selectedOffer.video_url ? (
                <div className="aspect-video rounded-lg overflow-hidden bg-slate-900">
                  <video
                    className="w-full h-full object-cover"
                    poster={selectedOffer.image_url}
                    controls
                    preload="metadata"
                  >
                    <source src={selectedOffer.video_url} type="video/mp4" />
                  </video>
                </div>
              ) : selectedOffer.image_url ? (
                <div className="aspect-video rounded-lg overflow-hidden bg-slate-900">
                  <img
                    src={selectedOffer.image_url}
                    alt={selectedOffer.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className={`aspect-video rounded-lg flex items-center justify-center ${branding ? getGradientClasses(branding.gradient) : 'bg-gradient-to-br from-emerald-600 to-emerald-800'}`}>
                  <Gift className="w-16 h-16 text-white" />
                </div>
              )}

              {/* Description */}
              <div className="text-slate-300 leading-relaxed">
                <p className="whitespace-pre-wrap">{selectedOffer.description}</p>
              </div>

              {/* Offer Details */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-700">
                {selectedOffer.offer_type && (
                  <div>
                    <p className="text-slate-400 text-sm mb-1">Offer Type</p>
                    <Badge
                      className={
                        selectedOffer.offer_type === "banner"
                          ? "bg-blue-600"
                          : selectedOffer.offer_type === "carousel"
                            ? "bg-purple-600"
                            : "bg-orange-600"
                      }
                    >
                      {selectedOffer.offer_type}
                    </Badge>
                  </div>
                )}
                {selectedOffer.start_date && (
                  <div>
                    <p className="text-slate-400 text-sm mb-1">Start Date</p>
                    <p className="text-white">
                      {new Date(selectedOffer.start_date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}
                    </p>
                  </div>
                )}
                {selectedOffer.end_date && (
                  <div>
                    <p className="text-slate-400 text-sm mb-1">End Date</p>
                    <p className="text-white">
                      {new Date(selectedOffer.end_date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}
                    </p>
                  </div>
                )}
              </div>

              {/* Close Button */}
              <div className="flex justify-end pt-4">
                <Button
                  onClick={() => setOfferDetailsOpen(false)}
                  className="bg-slate-700 hover:bg-slate-600 text-white"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// VIP Points Display Component (Weighted Percentage Formula)
const VipPointsDisplay = ({ userId }: { userId: number }) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: vipData, isLoading } = useQuery({
    queryKey: ["/api/player-vip/points", userId],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/player-vip/points");
      return res.json();
    },
    staleTime: 60000,
  });

  const { data: vipProducts = [] } = useQuery({
    queryKey: ["/api/player-vip/products"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/player-vip/products");
      return res.json();
    },
    staleTime: 120000,
  });

  const { data: purchaseHistory = [] } = useQuery({
    queryKey: ["/api/player-vip/purchases", userId],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/player-vip/purchases");
      return res.json();
    },
    staleTime: 60000,
  });

  const purchaseMutation = useMutation({
    mutationFn: async (productId: string) => {
      const res = await apiRequest("POST", "/api/player-vip/purchase", { productId });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Purchase Successful", description: data?.message || "VIP product purchased!" });
      queryClient.invalidateQueries({ queryKey: ["/api/player-vip/points"] });
      queryClient.invalidateQueries({ queryKey: ["/api/player-vip/purchases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/player-vip/products"] });
    },
    onError: (error: any) => {
      toast({ title: "Purchase Failed", description: error?.message || "Could not purchase product.", variant: "destructive" });
    },
  });

  const [showStore, setShowStore] = useState(false);

  if (isLoading) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader><CardTitle className="text-white flex items-center"><Star className="w-5 h-5 mr-2 text-yellow-500" />VIP Points</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-20 w-full" /></CardContent>
      </Card>
    );
  }

  const d = vipData as any;
  const availablePoints = d?.availablePoints || 0;
  const earnedPoints = d?.earnedPoints || 0;
  const pointsSpent = d?.pointsSpent || 0;
  const tier = d?.tier || 'Bronze';
  const tierColor = d?.tierColor || '#CD7F32';
  const breakdown = d?.breakdown;
  const nextTier = d?.nextTier;
  const products = Array.isArray(vipProducts) ? vipProducts : (vipProducts?.products || vipProducts?.data || []);
  const purchases = Array.isArray(purchaseHistory) ? purchaseHistory : (purchaseHistory?.purchases || purchaseHistory?.data || []);
  const hasProducts = products.length > 0;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
  };

  return (
    <>
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center justify-between">
            <span className="flex items-center"><Star className="w-5 h-5 mr-2 text-yellow-500" />VIP Points</span>
            <Badge style={{ backgroundColor: tierColor + '33', color: tierColor, borderColor: tierColor }} className="text-xs border">{tier}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Points Summary */}
          <div className="text-center p-4 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-lg">
            <div className="text-3xl font-bold text-yellow-400">{availablePoints}</div>
            <div className="text-slate-300 text-sm">Available Points</div>
            {pointsSpent > 0 && <div className="text-xs text-slate-400 mt-1">Earned: {earnedPoints} · Spent: {pointsSpent}</div>}
          </div>

          {/* Next Tier Progress */}
          {nextTier && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-400">
                <span>{tier}</span>
                <span>{nextTier.name} ({nextTier.pointsRequired} pts)</span>
              </div>
              <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full transition-all" style={{ width: `${Math.min(100, (earnedPoints / nextTier.pointsRequired) * 100)}%` }} />
              </div>
              <div className="text-xs text-slate-500 text-center">{nextTier.pointsToNext} points to {nextTier.name}</div>
            </div>
          )}

          {/* Breakdown */}
          {breakdown && (
            <div className="space-y-2 bg-slate-900/50 p-3 rounded-lg">
              <div className="text-white font-semibold text-sm">Points Breakdown</div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-slate-300">
                  <span>Table Sessions</span>
                  <span className="text-slate-400">{breakdown.tableHours?.toFixed(1)}h</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Tournament Sessions</span>
                  <span className="text-slate-400">{breakdown.tournamentHours?.toFixed(1)}h</span>
                </div>
                <div className="flex justify-between text-slate-300 border-t border-slate-700 pt-1">
                  <span>Hours Score ({(breakdown.weightHours * 100).toFixed(0)}% weight)</span>
                  <span className="text-yellow-400">+{breakdown.hoursContribution}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Money Score (₹{breakdown.totalMoneySpent?.toLocaleString()} · {(breakdown.weightMoney * 100).toFixed(0)}% weight)</span>
                  <span className="text-yellow-400">+{breakdown.moneyContribution}</span>
                </div>
              </div>
            </div>
          )}

          {/* Formula */}
          <div className="text-xs text-slate-400 p-2 bg-slate-900 rounded">
            <strong>Formula:</strong> VIP Points = (40% × Hours Played) + (60% × Money Spent ÷ 100)
          </div>

          {/* VIP Store Button */}
          {hasProducts && (
            <Button
              onClick={() => setShowStore(true)}
              className="w-full bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 text-white"
            >
              <Star className="w-4 h-4 mr-2" /> VIP Store ({products.length} products)
            </Button>
          )}

          {/* Recent Purchases */}
          {purchases.length > 0 && (
            <div className="space-y-2">
              <div className="text-white font-semibold text-sm">Recent Purchases</div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {purchases.slice(0, 5).map((p: any) => (
                  <div key={p.id} className="flex justify-between items-center text-xs bg-slate-900/50 p-2 rounded">
                    <span className="text-slate-300">{p.productTitle}</span>
                    <span className="text-yellow-400">-{p.pointsSpent} pts · {formatDate(p.createdAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* VIP Store Modal */}
      {showStore && (
        <Dialog open={showStore} onOpenChange={setShowStore}>
          <DialogContent className="w-[95vw] max-w-lg max-h-[85vh] bg-slate-900 border-slate-700 overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center">
                <Star className="w-5 h-5 mr-2 text-yellow-500" />
                VIP Store
                <Badge className="ml-2 bg-yellow-500/20 text-yellow-400 border-yellow-500/30">{availablePoints} pts</Badge>
              </DialogTitle>
            </DialogHeader>
            <div className="overflow-y-auto flex-1 space-y-3 pr-1">
              {products.map((product: any) => {
                const canAfford = availablePoints >= product.points;
                const outOfStock = product.stock !== null && product.stock !== undefined && product.stock <= 0;
                const mainImage = product.images?.[0]?.url || product.imageUrl;
                return (
                  <div key={product.id} className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                    <div className="flex gap-3">
                      {mainImage && (
                        <img src={mainImage} alt={product.title} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-semibold text-sm truncate">{product.title}</div>
                        {product.description && <div className="text-xs text-slate-400 mt-0.5 line-clamp-2">{product.description}</div>}
                        <div className="flex items-center justify-between mt-2">
                          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">{product.points} pts</Badge>
                          {outOfStock ? (
                            <span className="text-xs text-red-400">Out of Stock</span>
                          ) : (
                            <Button
                              size="sm"
                              disabled={!canAfford || purchaseMutation.isPending}
                              onClick={() => { if (confirm(`Buy "${product.title}" for ${product.points} VIP points?`)) purchaseMutation.mutate(product.id); }}
                              className={canAfford ? 'bg-yellow-600 hover:bg-yellow-700 text-white text-xs' : 'bg-gray-700 text-gray-400 text-xs'}
                            >
                              {purchaseMutation.isPending ? '...' : canAfford ? 'Buy' : 'Not enough pts'}
                            </Button>
                          )}
                        </div>
                        {product.stock !== null && product.stock !== undefined && product.stock > 0 && (
                          <div className="text-xs text-slate-500 mt-1">{product.stock} left in stock</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {products.length === 0 && (
                <div className="text-center text-slate-400 py-8">No VIP products available</div>
              )}

              {/* Purchase History in Store */}
              {purchases.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-700">
                  <div className="text-white font-semibold text-sm mb-2">Your Purchases</div>
                  <div className="space-y-1">
                    {purchases.map((p: any) => (
                      <div key={p.id} className="flex justify-between items-center text-xs bg-slate-800/50 p-2 rounded">
                        <span className="text-slate-300">{p.productTitle}</span>
                        <span className="text-slate-400">{p.pointsSpent} pts · {formatDate(p.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

// ---- Late Registration Helpers ----
function getTournamentLateRegInfo(tournament: any): {
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
  const remaining = Math.max(0, Math.floor((lateRegEndTime - Date.now()) / 1000));
  return {
    isActive: true,
    lateRegAllowed: true,
    lateRegOpen: remaining > 0,
    lateRegExpired: remaining <= 0,
    remainingSeconds: remaining,
  };
}

function DashboardLateRegCountdown({ tournament }: { tournament: any }) {
  const [remaining, setRemaining] = useState(() => getTournamentLateRegInfo(tournament).remainingSeconds);

  useEffect(() => {
    const info = getTournamentLateRegInfo(tournament);
    setRemaining(info.remainingSeconds);
    if (!info.lateRegOpen) return;
    const interval = setInterval(() => {
      const updated = getTournamentLateRegInfo(tournament);
      setRemaining(updated.remainingSeconds);
      if (updated.remainingSeconds <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [tournament.sessionStartedAt, tournament.lateRegistrationMinutes]);

  if (remaining <= 0) {
    return (
      <span className="flex items-center gap-1 text-red-400 text-[0.65rem] font-medium">
        <Lock className="w-3 h-3" /> Late reg closed
      </span>
    );
  }
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const isUrgent = remaining <= 60;
  return (
    <span className={`flex items-center gap-1 text-[0.65rem] font-semibold ${isUrgent ? "text-red-300 animate-pulse" : "text-amber-300"}`}>
      <Timer className="w-3 h-3" />
      Late reg: {mins}:{secs.toString().padStart(2, "0")}
    </span>
  );
}

function TournamentSessionTimer({ tournament, large, isExited, exitedAt }: { tournament: any; large?: boolean; isExited?: boolean; exitedAt?: string | null }) {
  const [elapsed, setElapsed] = useState(0);
  const isPaused = !!tournament.pausedAt;
  const sessionEnded = !!isExited;

  useEffect(() => {
    if (!tournament.sessionStartedAt) return;
    const startTime = new Date(tournament.sessionStartedAt).getTime();
    const totalPausedSecs = parseInt(tournament.totalPausedSeconds) || 0;
    const pausedAtTime = tournament.pausedAt ? new Date(tournament.pausedAt).getTime() : null;
    const exitTime = exitedAt ? new Date(exitedAt).getTime() : null;

    const update = () => {
      if (sessionEnded && exitTime) {
        const elapsedUntilExit = Math.floor((exitTime - startTime) / 1000);
        setElapsed(Math.max(0, elapsedUntilExit - totalPausedSecs));
      } else if (isPaused && pausedAtTime) {
        const elapsedUntilPause = Math.floor((pausedAtTime - startTime) / 1000);
        setElapsed(Math.max(0, elapsedUntilPause - totalPausedSecs));
      } else {
        const totalRaw = Math.floor((Date.now() - startTime) / 1000);
        setElapsed(Math.max(0, totalRaw - totalPausedSecs));
      }
    };
    update();
    const shouldTick = !sessionEnded && !isPaused;
    const interval = shouldTick ? setInterval(update, 1000) : null;
    return () => { if (interval) clearInterval(interval); };
  }, [tournament.sessionStartedAt, tournament.pausedAt, tournament.totalPausedSeconds, isPaused, sessionEnded, exitedAt]);

  if (!tournament.sessionStartedAt) return null;

  const hrs = Math.floor(elapsed / 3600);
  const mins = Math.floor((elapsed % 3600) / 60);
  const secs = elapsed % 60;
  const timeStr = `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;

  if (large) {
    return (
      <div className={`text-3xl font-mono font-bold tabular-nums ${sessionEnded ? 'text-red-400' : isPaused ? 'text-yellow-300' : 'text-green-300'}`}>
        {timeStr}
        {sessionEnded && <p className="text-xs text-red-400/70 font-sans font-normal mt-1">Session Ended</p>}
      </div>
    );
  }

  if (sessionEnded) {
    return (
      <span className="flex items-center gap-1 text-[0.65rem] font-semibold text-red-400">
        <Timer className="w-3 h-3" />
        Eliminated
      </span>
    );
  }

  return (
    <span className={`flex items-center gap-1 text-[0.65rem] font-semibold ${isPaused ? 'text-yellow-300' : 'text-green-300'}`}>
      <Timer className="w-3 h-3" />
      Session: {timeStr} {isPaused && '(Paused)'}
    </span>
  );
}

function TournamentLevelTracker({ tournament }: { tournament: any }) {
  const [elapsed, setElapsed] = useState(0);
  const isPaused = !!tournament.pausedAt;

  useEffect(() => {
    if (!tournament.sessionStartedAt) return;
    const startTime = new Date(tournament.sessionStartedAt).getTime();
    const totalPausedSecs = parseInt(tournament.totalPausedSeconds) || 0;
    const pausedAtTime = tournament.pausedAt ? new Date(tournament.pausedAt).getTime() : null;

    const update = () => {
      if (isPaused && pausedAtTime) {
        setElapsed(Math.max(0, Math.floor((pausedAtTime - startTime) / 1000) - totalPausedSecs));
      } else {
        setElapsed(Math.max(0, Math.floor((Date.now() - startTime) / 1000) - totalPausedSecs));
      }
    };
    update();
    const interval = isPaused ? null : setInterval(update, 1000);
    return () => { if (interval) clearInterval(interval); };
  }, [tournament.sessionStartedAt, tournament.pausedAt, tournament.totalPausedSeconds, isPaused]);

  let structure = tournament.structure || {};
  if (typeof structure === 'string') {
    try { structure = JSON.parse(structure); } catch { structure = {}; }
  }

  const minutesPerLevel = parseInt(structure.minutes_per_level) || 15;
  const numberOfLevels = parseInt(structure.number_of_levels) || 15;
  const breakDuration = parseInt(structure.break_duration) || 10;
  const breakStructureStr = structure.break_structure || '';
  const lateRegMinutes = parseInt(structure.late_registration) || 0;

  let breakEveryNLevels = 0;
  const breakMatch = breakStructureStr.match(/(\d+)/);
  if (breakMatch) breakEveryNLevels = parseInt(breakMatch[1]);

  const elapsedMinutes = elapsed / 60;

  let currentLevel = 1;
  let timeAccountedFor = 0;
  let onBreak = false;
  let breakTimeRemaining = 0;

  for (let level = 1; level <= numberOfLevels; level++) {
    const levelEnd = timeAccountedFor + minutesPerLevel;
    if (elapsedMinutes < levelEnd) {
      currentLevel = level;
      break;
    }
    timeAccountedFor = levelEnd;
    currentLevel = level;
    if (breakEveryNLevels > 0 && level % breakEveryNLevels === 0 && level < numberOfLevels) {
      const breakEnd = timeAccountedFor + breakDuration;
      if (elapsedMinutes < breakEnd) {
        onBreak = true;
        breakTimeRemaining = Math.ceil(breakEnd - elapsedMinutes);
        break;
      }
      timeAccountedFor = breakEnd;
    }
  }

  let levelStartTime = 0;
  for (let l = 1; l < currentLevel; l++) {
    levelStartTime += minutesPerLevel;
    if (breakEveryNLevels > 0 && l % breakEveryNLevels === 0) levelStartTime += breakDuration;
  }
  const timeInCurrentLevel = elapsedMinutes - levelStartTime;
  const timeRemainingInLevel = Math.max(0, minutesPerLevel - timeInCurrentLevel);
  const remainingSecs = Math.ceil(timeRemainingInLevel * 60);
  const remMin = Math.floor(remainingSecs / 60);
  const remSec = remainingSecs % 60;

  const lateRegOpen = lateRegMinutes > 0 && elapsedMinutes <= lateRegMinutes;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-4 pt-0">
      <div className="bg-emerald-900/30 rounded-lg p-3 text-center border border-emerald-700/40">
        <p className="text-[0.65rem] text-emerald-400 uppercase tracking-wide">Current Level</p>
        <p className="text-xl font-bold text-white">{currentLevel} / {numberOfLevels}</p>
      </div>
      <div className={`rounded-lg p-3 text-center border ${onBreak ? 'bg-amber-900/30 border-amber-700/40' : 'bg-blue-900/30 border-blue-700/40'}`}>
        <p className={`text-[0.65rem] uppercase tracking-wide ${onBreak ? 'text-amber-400' : 'text-blue-400'}`}>
          {onBreak ? 'Break Time Left' : 'Time Left in Level'}
        </p>
        <p className={`text-xl font-bold font-mono ${onBreak ? 'text-amber-300' : 'text-white'}`}>
          {onBreak
            ? `${breakTimeRemaining} min`
            : `${remMin.toString().padStart(2, '0')}:${remSec.toString().padStart(2, '0')}`
          }
        </p>
      </div>
      <div className="bg-purple-900/30 rounded-lg p-3 text-center border border-purple-700/40">
        <p className="text-[0.65rem] text-purple-400 uppercase tracking-wide">Level Duration</p>
        <p className="text-xl font-bold text-white">{minutesPerLevel} min</p>
      </div>
      <div className="bg-slate-800 rounded-lg p-3 text-center border border-slate-700">
        <p className="text-[0.65rem] text-slate-400 uppercase tracking-wide">Features</p>
        <div className="flex flex-wrap justify-center gap-1 mt-1">
          {structure.allow_rebuys && <Badge className="bg-green-500/20 text-green-300 border-green-500/30 text-[0.55rem] px-1 py-0">Rebuy</Badge>}
          {structure.allow_reentry && <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-[0.55rem] px-1 py-0">Re-entry</Badge>}
          {structure.allow_addon && <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-[0.55rem] px-1 py-0">Add-on</Badge>}
          {lateRegOpen && <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30 text-[0.55rem] px-1 py-0">Late Reg Open</Badge>}
        </div>
      </div>
    </div>
  );
}

function TournamentSessionContent({ tournament, user, queryClient }: { tournament: any; user: any; queryClient: any }) {
  const [rebuyLoading, setRebuyLoading] = useState(false);

  const { data: playerStatus, refetch: refetchStatus } = useQuery({
    queryKey: ['tournament-player-status', tournament.id, user?.id],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/player-tournaments/${tournament.id}/my-status`);
      if (!res.ok) return { inTournament: true, isExited: false };
      return res.json();
    },
    enabled: !!tournament.id && !!user?.id,
    refetchInterval: 5000,
    staleTime: 2000,
  });

  const handleRebuyReentry = async (type: 'rebuy' | 'reentry') => {
    setRebuyLoading(true);
    try {
      const res = await apiRequest('POST', `/api/player-tournaments/${tournament.id}/rebuy`, { type });
      if (res.ok) {
        refetchStatus();
        queryClient.invalidateQueries({ queryKey: ['/api/player-tournaments/upcoming'] });
        queryClient.invalidateQueries({ queryKey: ['/api/balance'] });
        queryClient.invalidateQueries({ queryKey: ['player-tournament-statuses'] });
      }
    } catch (e) {
      console.error('Rebuy/re-entry failed:', e);
    } finally {
      setRebuyLoading(false);
    }
  };

  let structure = tournament.structure || {};
  if (typeof structure === 'string') {
    try { structure = JSON.parse(structure); } catch { structure = {}; }
  }
  const isPaused = !!tournament.pausedAt;
  const buyIn = parseFloat(tournament.buyIn || tournament.buy_in || 0);
  const lateRegMinutes = parseInt(structure.late_registration) || 0;
  const isExited = playerStatus?.isExited || false;
  const allowRebuys = playerStatus?.allowRebuys || structure.allow_rebuys || false;
  const allowReentry = playerStatus?.allowReentry || structure.allow_reentry || false;

  return (
    <div className="space-y-0">
      {/* Session Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 p-4 rounded-t-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            <h2 className="text-lg font-bold text-white">{tournament.name}</h2>
          </div>
          <Badge className={isPaused
            ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
            : isExited
              ? "bg-red-500/20 text-red-300 border-red-500/30"
              : "bg-green-500/20 text-green-300 border-green-500/30"
          }>
            {isPaused ? '⏸ Paused' : isExited ? '✕ Eliminated' : '● Live'}
          </Badge>
        </div>

        <div className="flex justify-center py-2">
          <TournamentSessionTimer tournament={tournament} large isExited={isExited} exitedAt={playerStatus?.exitedAt} />
        </div>
        {isPaused && !isExited && (
          <p className="text-center text-yellow-400/70 text-xs mt-1">
            Tournament paused{tournament.pausedAt ? ` since ${new Date(tournament.pausedAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}` : ''}
          </p>
        )}
      </div>

      {/* Exited Player Banner + Rebuy/Re-entry */}
      {isExited && (
        <div className="mx-4 mt-3 p-4 bg-red-900/20 border border-red-500/30 rounded-lg text-center space-y-3">
          <div>
            <p className="text-red-300 font-semibold text-sm">You have been eliminated</p>
            <p className="text-red-400/70 text-xs mt-1">
              Balance: ₹0 {playerStatus?.rebuyCount > 0 ? `• Rebuys used: ${playerStatus.rebuyCount}` : ''}
            </p>
          </div>
          {(allowRebuys || allowReentry) && (
            <div className="flex justify-center gap-3">
              {allowRebuys && (
                <Button
                  onClick={() => handleRebuyReentry('rebuy')}
                  disabled={rebuyLoading}
                  size="sm"
                  className="bg-green-600 hover:bg-green-500 text-white"
                >
                  {rebuyLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1" /> : <RotateCcw className="w-3.5 h-3.5 mr-1" />}
                  Rebuy (₹{buyIn.toLocaleString()})
                </Button>
              )}
              {allowReentry && (
                <Button
                  onClick={() => handleRebuyReentry('reentry')}
                  disabled={rebuyLoading}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-500 text-white"
                >
                  {rebuyLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1" /> : <Play className="w-3.5 h-3.5 mr-1" />}
                  Re-entry (₹{buyIn.toLocaleString()})
                </Button>
              )}
            </div>
          )}
          {!allowRebuys && !allowReentry && (
            <p className="text-slate-400 text-xs">Rebuys and re-entry are not available for this tournament.</p>
          )}
        </div>
      )}

      {/* Live Level Info */}
      <TournamentLevelTracker tournament={tournament} />

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-2 px-4 pb-2">
        <div className="bg-slate-800 rounded-lg p-2 text-center border border-slate-700">
          <p className="text-[0.6rem] text-slate-400 uppercase">Buy-in</p>
          <p className="text-sm font-bold text-yellow-400">₹{buyIn.toLocaleString()}</p>
        </div>
        <div className="bg-slate-800 rounded-lg p-2 text-center border border-slate-700">
          <p className="text-[0.6rem] text-slate-400 uppercase">Players</p>
          <p className="text-sm font-bold text-white">
            {tournament.registeredPlayers || 0}/{tournament.maxPlayers || tournament.max_players || 0}
          </p>
        </div>
        <div className="bg-slate-800 rounded-lg p-2 text-center border border-slate-700">
          <p className="text-[0.6rem] text-slate-400 uppercase">Prize Pool</p>
          <p className="text-sm font-bold text-yellow-400">₹{Number(tournament.prizePool || tournament.prize_pool || 0).toLocaleString()}</p>
        </div>
      </div>

      {/* Tournament Details */}
      <div className="px-4 pb-4">
        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
          <h3 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" /> Tournament Info
          </h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            {structure.tournament_type && (
              <>
                <span className="text-slate-400">Type</span>
                <span className="text-white font-medium">{structure.tournament_type}</span>
              </>
            )}
            {structure.starting_chips && (
              <>
                <span className="text-slate-400">Starting Chips</span>
                <span className="text-white font-medium">{Number(structure.starting_chips).toLocaleString()}</span>
              </>
            )}
            {structure.blind_structure && (
              <>
                <span className="text-slate-400">Blinds</span>
                <span className="text-white font-medium">{structure.blind_structure}</span>
              </>
            )}
            {lateRegMinutes > 0 && (
              <>
                <span className="text-slate-400">Late Registration</span>
                <span className="text-white font-medium">{lateRegMinutes} min</span>
              </>
            )}
            {structure.payout_structure && (
              <>
                <span className="text-slate-400">Payout</span>
                <span className="text-white font-medium">{structure.payout_structure}</span>
              </>
            )}
            <span className="text-slate-400">Rebuys</span>
            <span className="text-white font-medium">{structure.allow_rebuys ? 'Yes' : 'No'}</span>
            <span className="text-slate-400">Add-on</span>
            <span className="text-white font-medium">{structure.allow_addon ? 'Yes' : 'No'}</span>
            <span className="text-slate-400">Re-entry</span>
            <span className="text-white font-medium">{structure.allow_reentry ? 'Yes' : 'No'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface PlayerDashboardProps {
  user?: any;
}

function PlayerDashboard({ user: userProp }: PlayerDashboardProps) {
  const { user: authUser, signOut } = useUltraFastAuth();

  // Use prop user if available, fallback to auth user
  const baseUser = userProp || authUser;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 1-second tick for real-time countdown timers (e.g. late registration)
  const [, setLateRegTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setLateRegTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch fresh player profile data to ensure PAN card and other fields are up to date
  const { data: profileData } = useQuery({
    queryKey: ['player-profile', baseUser?.id],
    queryFn: async () => {
      if (!baseUser?.id) return null;
      try {
        const response = await fetch(`${API_BASE_URL}/auth/player/me`, {
          headers: {
            'x-player-id': baseUser.id.toString(),
            'x-club-id': (baseUser as any).clubId || '',
          },
          credentials: 'include',
        });
        if (!response.ok) {
          console.error('Failed to fetch player profile:', response.status);
          return null;
        }
        const data = await response.json();
        console.log('🔄 [PROFILE REFRESH] Fresh profile data:', data);
        return data.player || null;
      } catch (error) {
        console.error('Error fetching player profile:', error);
        return null;
      }
    },
    enabled: !!baseUser?.id,
    staleTime: 30000, // 30 seconds
  });

  // Merge fresh profile data with existing user data
  const user = profileData ? { ...baseUser, ...profileData } : baseUser;
  const [callTime, setCallTime] = useState("02:45");
  const [location, setLocation] = useLocation();

  // Club branding state
  const [clubBranding, setClubBranding] = useState<ClubBranding | null>(null);

  // Feedback system state
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackRating, setFeedbackRating] = useState<number>(0);
  const [sendingFeedback, setSendingFeedback] = useState(false);
  const [submittingProfileChange, setSubmittingProfileChange] = useState<
    string | null
  >(null);

  // Change request popup dialog state
  const [changeRequestDialog, setChangeRequestDialog] = useState<{
    open: boolean;
    fieldName: string;
    fieldLabel: string;
    currentValue: string;
    isDocument: boolean;
  }>({ open: false, fieldName: '', fieldLabel: '', currentValue: '', isDocument: false });
  const [changeRequestValue, setChangeRequestValue] = useState('');
  const [changeRequestFile, setChangeRequestFile] = useState<File | null>(null);
  const [uploadingChangeDoc, setUploadingChangeDoc] = useState(false);

  // GRE Chat state variables
  const [chatMessage, setChatMessage] = useState("");
  const [sendingChatMessage, setSendingChatMessage] = useState(false);

  // Tournament state variables
  const [tournamentActionLoading, setTournamentActionLoading] = useState(false);

  // Initialize seat assignment listener
  useSeatAssignment(user?.id);

  // Get player game status for restrictions and active game display
  const gameStatus = usePlayerGameStatus();

  // Get balance to check if credit is enabled
  const { balance: playerBalance } = usePlayerBalance(user?.id?.toString() || "");
  const creditEnabled = (playerBalance as any)?.creditEnabled || false;

  const [showTournaments, setShowTournaments] = useState(false);

  // Helper function to get club-branded button styles
  const getClubButtonStyle = (variant: 'primary' | 'secondary' = 'primary') => {
    if (!clubBranding) return {};
    if (variant === 'primary') {
      return { backgroundColor: clubBranding.skinColor };
    }
    return { borderColor: clubBranding.skinColor, color: clubBranding.skinColor };
  };

  // Helper function to get logo URL (prioritize database logo, fallback to default)
  const getLogoUrl = (): string | null => {
    // Priority 1: Logo from database (clubBranding)
    if (clubBranding?.logoUrl) {
      return clubBranding.logoUrl;
    }
    // Priority 2: Default logo from whitelabelConfig
    if (whitelabelConfig.logoUrl) {
      return whitelabelConfig.logoUrl;
    }
    return null;
  };

  // Helper function to get club name
  const getClubName = (): string => {
    return clubBranding?.clubName || whitelabelConfig.companyName || "Poker Club";
  };

  // Chat Dialog state
  const [chatDialogOpen, setChatDialogOpen] = useState(false);

  // Unified Chat messages state (CRITICAL FIX)
  const [unifiedChatMessages, setUnifiedChatMessages] = useState<any[]>([]);

  // TableView Dialog state
  const [tableViewDialogOpen, setTableViewDialogOpen] = useState(false);
  const [selectedTableViewTableId, setSelectedTableViewTableId] = useState<
    string | null
  >(null);

  // Handle tab navigation from URL parameters
  const getActiveTabFromUrl = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get("tab");
    return tab || "game";
  };

  const [activeTab, setActiveTab] = useState(getActiveTabFromUrl());
  const [refreshingSection, setRefreshingSection] = useState<string | null>(null);

  // Refresh handler: invalidates the right queries for the given section/tab
  const handleRefreshSection = async (section: string) => {
    setRefreshingSection(section);
    try {
      switch (section) {
        case "game":
        case "game-seated":
        case "game-tables":
        case "game-tournaments":
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["/api/tables"] }),
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.availableTables }),
            queryClient.invalidateQueries({ queryKey: ["/api/seat-requests"] }),
            queryClient.invalidateQueries({ queryKey: ["/api/table-seats"] }),
            queryClient.invalidateQueries({ queryKey: ["/api/table-statuses"] }),
            queryClient.invalidateQueries({ queryKey: ["/api/player-tournaments/upcoming"] }),
            queryClient.invalidateQueries({ queryKey: ["/api/player-tournaments/my-registrations"] }),
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.waitlistStatus }),
          ]);
          break;
        case "offers":
          await queryClient.invalidateQueries({ queryKey: ["/api/player-offers/active"] });
          break;
        case "food":
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["/api/auth/player/fnb/menu"] }),
            queryClient.invalidateQueries({ queryKey: ["/api/food-beverage/ads"] }),
            queryClient.invalidateQueries({ queryKey: ["/api/auth/player/fnb/orders"] }),
          ]);
          break;
        case "session":
          await queryClient.invalidateQueries({ queryKey: ["/api/player-playtime/current"] });
          break;
        case "balance":
        case "balance-transactions":
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["/api/balance"] }),
            queryClient.invalidateQueries({ queryKey: ["/api/auth/player/balance"] }),
            queryClient.invalidateQueries({ queryKey: ["/api/auth/player/transactions"] }),
            queryClient.invalidateQueries({ queryKey: ["/api/credit-requests"] }),
          ]);
          break;
        case "profile":
        case "profile-kyc":
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: [`/api/documents/player/${user?.id}`] }),
            queryClient.invalidateQueries({ queryKey: ["/api/players/supabase"] }),
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.waitlistStatus }),
          ]);
          break;
        case "feedback":
          await queryClient.invalidateQueries({ queryKey: ["/api/auth/player/feedback/history"] });
          break;
        case "notifications":
          await queryClient.invalidateQueries({ queryKey: ["/api/push-notifications"] });
          break;
        default:
          break;
      }
      toast({ title: "Refreshed", description: "Data updated." });
    } catch {
      toast({ title: "Refresh failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setRefreshingSection(null);
    }
  };

  // Update tab when URL changes
  useEffect(() => {
    setActiveTab(getActiveTabFromUrl());
  }, [location]);

  // Load club branding on mount
  useEffect(() => {
    const loadBranding = async () => {
      // Try to get from sessionStorage first
      const storedBranding = sessionStorage.getItem("club_branding");
      if (storedBranding) {
        try {
          const branding = JSON.parse(storedBranding);
          setClubBranding(branding);
          applyClubBranding(branding);
          return;
        } catch (e) {
          console.error("Failed to parse stored branding:", e);
        }
      }

      // Fetch from backend if not in storage
      if (user?.clubId) {
        try {
          const branding = await fetchClubBranding(user.clubId);
          if (branding) {
            setClubBranding(branding);
            applyClubBranding(branding);
            sessionStorage.setItem("club_branding", JSON.stringify(branding));
          }
        } catch (error) {
          console.error("Failed to fetch club branding:", error);
        }
      }
    };

    loadBranding();
  }, [user?.clubId]);

  // Document viewer removed as per requirements

  // Fetch live tables from backend API with realtime updates
  const { data: tablesData, isLoading: tablesLoading } = useAvailableTables();
  useRealtimeTables(); // Subscribe to realtime table updates

  // Fetch waitlist status
  const { data: waitlistData } = useWaitlistStatus();

  // Waitlist mutations
  const cancelWaitlistMutation = useCancelWaitlist();

  // Enable real-time updates via Supabase (replaces polling)
  useRealtimeWaitlist(user?.id);
  useRealtimeBalance(user?.id);
  useRealtimeBuyIn(user?.id);
  useRealtimeNotifications(user?.id);
  useRealtimeCreditRequests(user?.id);
  useRealtimeTournaments(user?.id, user?.clubId);
  useRealtimeProfileRequests(user?.id);
  useRealtimeOffers();

  // Map backend table data to dashboard format
  const tables = (tablesData?.tables || []).map((table: any) => {
    const isRummy = table.tableType === 'RUMMY';
    const gameTypeLabel = isRummy
      ? `Rummy${table.rummyVariant ? ` – ${table.rummyVariant}` : ''}`
      : table.tableType === 'CASH' ? "Cash Game (Poker)"
        : table.tableType === 'HIGH_STAKES' ? "High Stakes (Poker)"
          : table.tableType === 'TOURNAMENT' ? "Tournament (Poker)"
            : table.tableType === 'PRIVATE' ? "Private (Poker)"
              : "Texas Hold'em";
    const stakesLabel = isRummy
      ? (table.entryFee ? `Entry: ₹${Number(table.entryFee).toLocaleString()}` : 'Points Game')
      : `₹${table.minBuyIn || 0}/₹${table.maxBuyIn || 0}`;
    return {
      id: table.id,
      name: `Table ${table.tableNumber}`,
      gameType: gameTypeLabel,
      tableType: table.tableType,
      isRummy,
      rummyVariant: table.rummyVariant || null,
      entryFee: table.entryFee || null,
      pointsValue: table.pointsValue || null,
      numberOfDeals: table.numberOfDeals || null,
      dropPoints: table.dropPoints || null,
      maxPoints: table.maxPoints || null,
      stakes: stakesLabel,
      maxPlayers: table.maxSeats || 9,
      currentPlayers: table.currentSeats || 0,
      pot: 0,
      avgStack: 0,
      isActive: table.status === 'AVAILABLE',
    };
  });

  // Fetch seat requests with smart refresh
  const { data: seatRequests, isLoading: requestsLoading } = useQuery<
    SeatRequest[]
  >({
    queryKey: ["/api/seat-requests", user?.id],
    enabled: !!user?.id,
    refetchOnWindowFocus: true,
    staleTime: 3000,
    gcTime: 10000,
    structuralSharing: true,
  });

  const { data: seatedSessions, isLoading: seatedLoading } = useQuery<any[]>({
    queryKey: ["/api/table-seats", user?.id],
    enabled: !!user?.id,
    refetchOnWindowFocus: true,
    staleTime: 5000,
    gcTime: 15000,
    structuralSharing: true,
  });

  // Check table status with intelligent refresh
  const { data: tableStatuses } = useQuery({
    queryKey: ["/api/table-statuses", seatRequests?.map((req) => req.tableId)],
    queryFn: async () => {
      if (!seatRequests || seatRequests.length === 0) return {};

      const statusPromises = seatRequests.map(async (req: any) => {
        try {
          const response = await fetch(`/api/table-status/${req.tableId}`);
          if (response.ok) {
            const status = await response.json();
            return { [req.tableId]: status };
          }
        } catch (error) {
          console.warn(`Failed to fetch status for table ${req.tableId}`);
        }
        return { [req.tableId]: null };
      });

      const statusResults = await Promise.all(statusPromises);
      return statusResults.reduce((acc, curr) => ({ ...acc, ...curr }), {});
    },
    enabled: !!seatRequests && seatRequests.length > 0,
    staleTime: 8000,
    gcTime: 20000,
    structuralSharing: true,
  });

  // Find current active session for playtime tracking
  const currentActiveSession = seatRequests?.find(
    (req) => req.status === "active" && req.sessionStartTime
  );

  // Fetch tournaments for this club
  const {
    data: tournamentsResponse,
    isLoading: tournamentsLoading,
  } = useQuery<{
    tournaments: any[];
    total: number;
  }>({
    queryKey: ["/api/player-tournaments/upcoming", user?.clubId],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/player-tournaments/upcoming");
      if (!response.ok) {
        throw new Error("Failed to fetch tournaments");
      }
      return await response.json();
    },
    refetchOnWindowFocus: true,
    staleTime: 5000,
  });

  const tournaments = tournamentsResponse?.tournaments || [];

  const {
    data: registrationsResponse,
    isLoading: registrationsLoading,
  } = useQuery<{
    registrations: any[];
    total: number;
  }>({
    queryKey: ["/api/player-tournaments/my-registrations", user?.id],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/player-tournaments/my-registrations");
      if (!response.ok) {
        throw new Error("Failed to fetch registrations");
      }
      return await response.json();
    },
    enabled: !!user?.id,
    refetchOnWindowFocus: true,
    staleTime: 5000,
  });

  // Get registered tournament IDs from backend
  const registeredTournamentIds = registrationsResponse?.registrations?.map((r: any) => r.tournamentId) || [];

  // Helper function to check if player is registered
  const isRegistered = (tournamentId: string) => {
    return registeredTournamentIds.includes(tournamentId);
  };

  // Fetch player status for active registered tournaments
  const activeTournamentIds = tournaments
    ?.filter((t: any) => t.status === 'active' && registeredTournamentIds.includes(t.id))
    ?.map((t: any) => t.id) || [];

  const { data: playerTournamentStatuses } = useQuery<Record<string, any>>({
    queryKey: ['player-tournament-statuses', user?.id, activeTournamentIds.join(',')],
    queryFn: async () => {
      const statuses: Record<string, any> = {};
      for (const tid of activeTournamentIds) {
        try {
          const res = await apiRequest('GET', `/api/player-tournaments/${tid}/my-status`);
          if (res.ok) statuses[tid] = await res.json();
        } catch { /* ignore */ }
      }
      return statuses;
    },
    enabled: activeTournamentIds.length > 0 && !!user?.id,
    staleTime: 5000,
  });

  const [tournamentDetailsOpen, setTournamentDetailsOpen] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState<any | null>(
    null
  );
  const [tournamentSessionOpen, setTournamentSessionOpen] = useState(false);
  const [sessionTournament, setSessionTournament] = useState<any | null>(null);

  const handleViewTournamentSession = (tournament: any) => {
    setSessionTournament(tournament);
    setTournamentSessionOpen(true);
  };

  // Fetch dual balance system data with smart refresh
  const { data: accountBalance, isLoading: balanceLoading } = useQuery({
    queryKey: ["/api/balance", user?.id],
    enabled: !!user?.id,
    refetchOnWindowFocus: true,
    staleTime: 10000,
    gcTime: 30000,
    structuralSharing: true,
  });

  // Open tournament details dialog
  const handleViewTournamentDetails = (tournament: any) => {
    setSelectedTournament(tournament);
    setTournamentDetailsOpen(true);
  };

  // Tournament Registration Handler - adds to player management system
  const handleTournamentRegister = async (tournamentId: string) => {
    if (!user?.id) return;

    setTournamentActionLoading(true);
    try {
      const response = await apiRequest(
        "POST",
        "/api/player-tournaments/register",
        {
          tournamentId,
        }
      );

      if (response.ok) {
        const result = await response.json();
        toast({
          title: "Registration Successful",
          description: "You have been registered for the tournament",
        });

        // Save to localStorage as backup
        if (user?.id) {
          const current = registeredTournamentIds || [];
          const updated = [...current, tournamentId];
          localStorage.setItem(`tournament_registrations_${user.id}`, JSON.stringify(updated));
        }

        // Refresh tournaments and registrations to update UI
        queryClient.invalidateQueries({
          queryKey: ["/api/player-tournaments/upcoming"],
        });
        queryClient.invalidateQueries({
          queryKey: ["/api/player-tournaments/my-registrations"],
        });
      }
    } catch (error: any) {
      toast({
        title: "Registration Failed",
        description: error.message || "Failed to register for tournament",
        variant: "destructive",
      });
    } finally {
      setTournamentActionLoading(false);
    }
  };

  // Preferences removed as per requirements

  // Fetch KYC documents using new system
  const { data: kycDocuments, isLoading: kycLoading } = useQuery<KycDocument[]>(
    {
      queryKey: [`/api/documents/player/${user?.id}`],
      queryFn: async () => {
        if (!user?.id) return [];
        try {
          const response = await fetch(`${API_BASE_URL}/player-documents/my`, {
            headers: {
              'x-player-id': user.id.toString(),
              'x-club-id': (user as any).clubId || '',
            },
            credentials: 'include',
          });
          if (!response.ok) {
            console.error('Failed to fetch documents:', response.status);
            return [];
          }
          const data = await response.json();
          console.log('📄 [KYC DOCS] API Response:', data);

          // Map backend fields to frontend expected fields
          const mappedDocs = (data.documents || []).map((doc: any) => ({
            id: doc.id,
            documentType: doc.type || doc.documentType, // Backend uses 'type'
            fileUrl: doc.url || doc.fileUrl, // Backend uses 'url'
            fileName: doc.name || doc.fileName,
            status: doc.status || 'pending',
            createdAt: doc.uploadedAt || doc.createdAt,
            size: doc.size,
            mimeType: doc.mimeType,
          }));

          console.log('📄 [KYC DOCS] Mapped documents:', mappedDocs);
          return mappedDocs;
        } catch (error) {
          console.error('Error fetching KYC documents:', error);
          return [];
        }
      },
      enabled: !!user?.id,
    }
  );

  // Simple join waitlist - no seat selection required
  const joinWaitListMutation = useMutation({
    mutationFn: async (tableId: string) => {
      console.log(
        "🎯 [SIMPLE JOIN] Joining waitlist for table:",
        tableId,
        "player:",
        user?.id
      );
      const response = await apiRequest("POST", "/api/seat-requests", {
        playerId: user?.id,
        tableId: tableId,
        tableName: tables?.find((t: any) => t.id === tableId)?.name || "Table",
        seatNumber: 1, // Default seat preference
      });
      return response.json();
    },
    onSuccess: () => {
      console.log("✅ [SIMPLE JOIN] Success!");
      queryClient.invalidateQueries({ queryKey: ["/api/seat-requests"] });
      toast({
        title: "Joined Waitlist",
        description: "You've been added to the waitlist successfully",
      });
    },
    onError: (error: any) => {
      console.error("❌ [SIMPLE JOIN] Error:", error);
      toast({
        title: "Failed to Join",
        description: error.message || "Could not join waitlist",
        variant: "destructive",
      });
    },
  });

  // Leave wait-list mutation
  const leaveWaitListMutation = useMutation({
    mutationFn: async (tableId: string) => {
      console.log(
        `🚪 [LEAVE WAITLIST] Attempting to leave waitlist for table: ${tableId}`
      );

      const response = await apiRequest(
        "DELETE",
        `/api/seat-requests/${user?.id}/${tableId}`
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [LEAVE WAITLIST] API Error response:`, errorText);

        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || `HTTP ${response.status}` };
        }

        throw new Error(
          errorData.error ||
          errorData.message ||
          `Server Error: ${response.status}`
        );
      }

      const result = await response.json();
      console.log(`✅ [LEAVE WAITLIST] Success:`, result);
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/seat-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tables"] });
      toast({
        title: "Left Wait-List",
        description:
          data.message || "You've been removed from the table wait-list",
      });
    },
    onError: (error: any) => {
      console.error("❌ [LEAVE WAITLIST] Mutation error:", error);
      toast({
        title: "Failed to Leave",
        description: error.message || "Could not leave wait-list",
        variant: "destructive",
      });
    },
  });

  // Preferences update removed as per requirements

  // KYC document upload mutation using new system
  const uploadKycDocumentMutation = useMutation({
    mutationFn: async ({
      documentType,
      file,
    }: {
      documentType: string;
      file: File;
    }) => {
      const reader = new FileReader();
      return new Promise((resolve, reject) => {
        reader.onload = async (event) => {
          const dataUrl = event.target?.result as string;
          try {
            const response = await apiRequest("POST", "/api/documents/upload", {
              playerId: user?.id,
              documentType,
              fileName: file.name,
              fileData: dataUrl,
              fileSize: file.size,
            });
            resolve(response.json());
          } catch (error) {
            reject(error);
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/documents/player/${user?.id}`],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/players/supabase"] });
      toast({
        title: "Document Uploaded",
        description: "Your KYC document has been uploaded successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload KYC document",
        variant: "destructive",
      });
    },
  });

  // Helper functions
  const isTableJoined = (tableId: string) => {
    return seatRequests?.some((req: any) =>
      String(req.tableId || req.table_id) === String(tableId)
    );
  };

  const getWaitListPosition = (tableId: string) => {
    const request = seatRequests?.find((req: any) =>
      String(req.tableId || req.table_id) === String(tableId)
    );
    return request?.position || 0;
  };

  const handleJoinWaitList = (tableId: string) => {
    // Check if player is already on a waitlist
    if (waitlistData?.onWaitlist && waitlistData?.entry) {
      // Show warning that previous waitlist will be removed
      toast({
        title: "⚠️ Already on Waitlist",
        description: `You're currently on the waitlist for ${waitlistData.entry.tableType}. Joining a new table will remove you from the current waitlist. Continue?`,
        action: (
          <Button
            size="sm"
            onClick={() => {
              console.log("🎯 [HANDLE JOIN] Player confirmed - removing from old waitlist and joining new table:", tableId);
              // Navigate to table view - the backend will handle removing from old waitlist
              setLocation(`/table/${tableId}`);
            }}
            className="hover:opacity-90 text-white"
            style={getClubButtonStyle('primary')}
          >
            Continue
          </Button>
        ),
      });
      return;
    }

    console.log(
      "🎯 [HANDLE JOIN] Navigating to table view for seat selection:",
      tableId
    );
    // Navigate to table view first, then seat selection will complete the join
    setLocation(`/table/${tableId}`);
  };

  // Simplified direct join functionality - no seat selection dialog

  const handleLeaveWaitList = (tableId: string) => {
    leaveWaitListMutation.mutate(tableId);
  };

  // Removed cleanup and leave all mutations as requested

  // Credit request state and mutations
  const [creditAmount, setCreditAmount] = useState("");
  const [creditNote, setCreditNote] = useState("");
  const [showCreditForm, setShowCreditForm] = useState(false);

  // Fetch credit requests for player
  const { data: creditRequests, isLoading: creditRequestsLoading } = useQuery({
    queryKey: [`/api/credit-requests/${user?.id}`],
    enabled: !!user?.id,
  });

  const { data: notifications, isLoading: notificationsLoading } = useQuery({
    queryKey: [`/api/push-notifications/${user?.id}`],
    enabled: !!user?.id,
    refetchOnWindowFocus: true,
    staleTime: 20000,
    gcTime: 60000,
    structuralSharing: true,
  });

  // Helper to submit a per-field profile change request
  const submitProfileChangeRequest = async (
    fieldName: string,
    requestedValue: string,
    currentValue: string | null,
  ) => {
    if (!user?.id) {
      toast({
        title: "Error",
        description: "You must be logged in to request profile changes",
        variant: "destructive",
      });
      return;
    }

    if (!requestedValue.trim()) {
      toast({
        title: "Error",
        description: "Please enter the new value you want",
        variant: "destructive",
      });
      return;
    }

    setSubmittingProfileChange(fieldName);
    try {
      const response = await apiRequest(
        "POST",
        "/api/auth/player/profile-change-request",
        {
          fieldName,
          currentValue,
          requestedValue: requestedValue.trim(),
        },
      );

      const result = await response.json();
      if (response.ok && result?.success) {
        toast({
          title: "Request Sent",
          description:
            "Your profile change request has been sent to club staff for review.",
          className: "bg-emerald-600 text-white",
        });
        refetchProfileChanges();
      } else {
        throw new Error(result?.message || "Failed to submit request");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description:
          error.message || "Failed to submit profile change request.",
        variant: "destructive",
      });
    } finally {
      setSubmittingProfileChange(null);
    }
  };

  const openChangeRequestDialog = (fieldName: string, fieldLabel: string, currentValue: string, isDocument = false) => {
    setChangeRequestValue(isDocument ? '' : currentValue);
    setChangeRequestFile(null);
    setChangeRequestDialog({ open: true, fieldName, fieldLabel, currentValue, isDocument });
  };

  const handleChangeRequestSubmit = async () => {
    const { fieldName, currentValue, isDocument } = changeRequestDialog;

    if (isDocument) {
      if (!changeRequestFile) {
        toast({ title: "File Required", description: "Please upload the new document", variant: "destructive" });
        return;
      }
      setUploadingChangeDoc(true);
      try {
        const playerId = user?.id;
        const clubId = sessionStorage.getItem('clubId') || localStorage.getItem('clubId');
        if (!playerId || !clubId) throw new Error('Missing player or club ID');

        const docTypeMap: Record<string, string> = { government_id: 'government_id', pan_card: 'pan_card', profile_photo: 'profile_photo' };
        const docType = docTypeMap[fieldName] || fieldName;
        const formData = new FormData();
        formData.append('file', changeRequestFile);
        formData.append('documentType', docType);
        formData.append('fileName', changeRequestFile.name);

        const uploadRes = await fetch(`${API_BASE_URL}/player-documents/upload`, {
          method: 'POST',
          headers: { 'x-player-id': playerId, 'x-club-id': clubId },
          body: formData,
        });
        const uploadData = await uploadRes.json();
        const docUrl = uploadData?.document?.url || uploadData?.document?.fileUrl || '';

        await submitProfileChangeRequest(fieldName, docUrl || `New ${changeRequestDialog.fieldLabel} uploaded: ${changeRequestFile.name}`, currentValue || 'existing document');
        setChangeRequestDialog(prev => ({ ...prev, open: false }));
      } catch (error: any) {
        toast({ title: "Upload Failed", description: error.message || "Failed to upload document", variant: "destructive" });
      } finally {
        setUploadingChangeDoc(false);
      }
    } else {
      if (!changeRequestValue.trim()) {
        toast({ title: "Value Required", description: `Please enter the new ${changeRequestDialog.fieldLabel.toLowerCase()}`, variant: "destructive" });
        return;
      }
      await submitProfileChangeRequest(fieldName, changeRequestValue.trim(), currentValue || null);
      setChangeRequestDialog(prev => ({ ...prev, open: false }));
    }
  };

  // Fetch previously submitted feedback for this player
  const {
    data: feedbackHistory,
    isLoading: feedbackHistoryLoading,
    isError: feedbackHistoryError,
  } = useQuery<{
    success: boolean;
    feedback: { id: string; message: string; rating: number | null; created_at: string }[];
  }>({
    queryKey: ["/api/auth/player/feedback/history", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        "/api/auth/player/feedback/history",
      );
      return await response.json();
    },
    refetchOnWindowFocus: false,
  });

  // Fetch profile change request statuses
  const { data: profileChangeData, refetch: refetchProfileChanges } = useQuery<{
    success: boolean;
    requests: { id: string; fieldName: string; currentValue: string | null; requestedValue: string; status: string; reviewNotes: string | null; createdAt: string; reviewedAt: string | null }[];
  }>({
    queryKey: ['/api/auth/player/profile-change-requests', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/auth/player/profile-change-requests');
      return await response.json();
    },
    staleTime: 5000,
  });

  const getFieldChangeStatus = (fieldName: string) => {
    const requests = profileChangeData?.requests || [];
    const pending = requests.find(r => r.fieldName === fieldName && r.status === 'pending');
    if (pending) return { status: 'pending' as const, request: pending };
    const rejected = requests.find(r => r.fieldName === fieldName && r.status === 'rejected');
    if (rejected) return { status: 'rejected' as const, request: rejected };
    return { status: 'none' as const, request: null };
  };

  const dismissRejectedRequest = async (requestId: string) => {
    try {
      await apiRequest('POST', `/api/auth/player/profile-change-request/${requestId}/dismiss`);
      refetchProfileChanges();
    } catch (e) {
      console.error('Failed to dismiss request:', e);
    }
  };

  // Submit feedback function
  const submitFeedback = async () => {
    if (!feedbackMessage.trim() || !user?.id) {
      toast({
        title: "Error",
        description: "Please enter a message",
        variant: "destructive",
      });
      return;
    }

    setSendingFeedback(true);
    try {
      const response = await apiRequest("POST", "/api/auth/player/feedback", {
        message: feedbackMessage.trim(),
        rating: feedbackRating > 0 ? feedbackRating : null,
      });

      const result = await response.json();
      if (response.ok) {
        toast({
          title: "Feedback Sent",
          description: "Your message has been sent to management",
        });
        setFeedbackMessage("");
        setFeedbackRating(0);
      } else {
        throw new Error(result.error || "Failed to send feedback");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description:
          error.message || "Failed to send feedback. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSendingFeedback(false);
    }
  };

  // GRE Chat functionality - Now using WebSocket for real-time chat
  const sendChatMessage = async () => {
    if (!chatMessage.trim() || !user?.id) {
      toast({
        title: "Error",
        description: "Please enter a message",
        variant: "destructive",
      });
      return;
    }

    setSendingChatMessage(true);

    // 🚨 ENTERPRISE-GRADE FRONTEND DEBUG LOGGING - PRODUCTION DATA VALIDATION
    console.log("🛑 FRONTEND DEBUG: === PLAYER MESSAGE SEND START ===");
    console.log("🔍 FRONTEND DEBUG: Sending player message | Details:", {
      playerId: user.id,
      playerName: `${user.firstName} ${user.lastName}`,
      messageText: chatMessage.trim(),
      senderType: "player",
      timestamp: new Date().toISOString(),
      websocketConnected: wsConnected,
      validation: "PRODUCTION_USER_CONTEXT_ONLY",
    });

    // PRODUCTION DATA VALIDATION - NO MOCK/TEST DATA ALLOWED
    if (
      !user.id ||
      typeof user.id === "string" ||
      chatMessage.includes("test") ||
      chatMessage.includes("demo")
    ) {
      console.error(
        "❌ FRONTEND DEBUG: INVALID USER MESSAGE CONTEXT - Mock/test data detected"
      );
      toast({
        title: "Error",
        description: "Invalid message context - only production data allowed",
        variant: "destructive",
      });
      setSendingChatMessage(false);
      return;
    }

    // Try WebSocket first for real-time chat
    if (wsConnection && wsConnected) {
      try {
        console.log(
          "🔍 FRONTEND DEBUG: WebSocket message transmission | Details:",
          {
            connectionState: wsConnection.readyState,
            expectedState: WebSocket.OPEN,
            messageLength: chatMessage.trim().length,
            validation: "PRODUCTION_WEBSOCKET_SEND",
          }
        );

        // Create the message object for immediate display
        const newMessage = {
          id: Date.now().toString(),
          player_id: user.id,
          message: chatMessage.trim(),
          sender_type: "player",
          timestamp: new Date().toISOString(),
          is_read: false,
        };

        // Add to local state immediately for instant display (optimistic UI update)
        console.log("🔍 FRONTEND DEBUG: Adding optimistic message | Details:", {
          messageId: newMessage.id,
          playerId: newMessage.player_id,
          messagePreview: newMessage.message.substring(0, 50) + "...",
          validation: "PRODUCTION_OPTIMISTIC_UPDATE",
        });
        setUnifiedChatMessages((prev) => [...prev, newMessage]);

        // EXACT Staff Portal message format - PRODUCTION DATA ONLY
        const websocketPayload = {
          type: "player_message", // EXACT string expected by Staff Portal
          playerId: user.id, // Integer from database
          playerName: `${user.firstName} ${user.lastName}`, // Player's full name
          playerEmail: user.email, // Valid email address
          message: chatMessage.trim(), // The actual message content
          messageText: chatMessage.trim(), // Duplicate for compatibility
          timestamp: new Date().toISOString(), // ISO timestamp string
        };

        console.log(
          "🔍 FRONTEND DEBUG: WebSocket payload transmission | Details:",
          {
            payloadType: websocketPayload.type,
            playerId: websocketPayload.playerId,
            playerName: websocketPayload.playerName,
            messageLength: websocketPayload.message.length,
            validation: "PRODUCTION_WEBSOCKET_PAYLOAD",
          }
        );

        wsConnection.send(JSON.stringify(websocketPayload));

        console.log(
          "✅ FRONTEND DEBUG: WebSocket message sent successfully | Details:",
          {
            messageLength: chatMessage.trim().length,
            playerId: user.id,
            timestamp: new Date().toISOString(),
            validation: "PRODUCTION_WEBSOCKET_SUCCESS",
          }
        );

        toast({
          title: "Message Sent",
          description:
            "Your message has been sent to our team via real-time chat",
        });
        setChatMessage("");
        setSendingChatMessage(false);
        console.log(
          "🛑 FRONTEND DEBUG: === PLAYER MESSAGE SEND END (WEBSOCKET SUCCESS) ==="
        );
        return;
      } catch (error: any) {
        console.error(
          "❌ FRONTEND DEBUG: WebSocket transmission failed | Details:",
          {
            error: error.message,
            connectionState: wsConnection?.readyState,
            validation: "WEBSOCKET_FALLBACK_TRIGGERED",
          }
        );
        console.error("📤 Falling back to REST API for message delivery");
      }
    }

    // Fallback to REST API if WebSocket is not available
    try {
      console.log("🔍 FRONTEND DEBUG: REST API fallback initiated | Details:", {
        reason: wsConnection
          ? "WebSocket send failed"
          : "WebSocket not connected",
        playerId: user.id,
        messageLength: chatMessage.trim().length,
        validation: "PRODUCTION_REST_FALLBACK",
      });

      // Create the message object for immediate display
      const newMessage = {
        id: Date.now().toString(),
        player_id: user.id,
        message: chatMessage.trim(),
        sender_type: "player",
        timestamp: new Date().toISOString(),
        is_read: false,
      };

      // Add to local state immediately for instant display
      setUnifiedChatMessages((prev) => [...prev, newMessage]);

      const response = await apiRequest("POST", "/api/unified-chat/send", {
        playerId: user.id,
        playerName: `${user.firstName} ${user.lastName}`,
        message: chatMessage.trim(),
        senderType: "player",
      });

      const result = await response.json();
      if (response.ok) {
        console.log(
          "✅ FRONTEND DEBUG: REST API message sent successfully | Details:",
          {
            responseStatus: response.status,
            messageId: result.message?.id,
            playerId: user.id,
            validation: "PRODUCTION_REST_SUCCESS",
          }
        );

        toast({
          title: "Message Sent",
          description: "Your message has been sent to our team",
        });
        setChatMessage("");
        console.log(
          "🛑 FRONTEND DEBUG: === PLAYER MESSAGE SEND END (REST SUCCESS) ==="
        );
        // Message successfully sent - no need for REST API refresh since WebSocket handles real-time updates
      } else {
        console.error(
          "❌ FRONTEND DEBUG: REST API message send failed | Details:",
          {
            responseStatus: response.status,
            errorMessage: result.error,
            validation: "PRODUCTION_REST_FAILURE",
          }
        );
        // Remove the message from local state if sending failed
        setUnifiedChatMessages((prev) =>
          prev.filter((msg) => msg.id !== newMessage.id)
        );
        throw new Error(result.error || "Failed to send message");
      }
    } catch (error: any) {
      console.error("❌ FRONTEND DEBUG: REST API request failed | Details:", {
        error: error.message,
        validation: "REST_REQUEST_FAILURE",
      });
      toast({
        title: "Error",
        description:
          error.message || "Failed to send message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSendingChatMessage(false);
      console.log(
        "🛑 FRONTEND DEBUG: === PLAYER MESSAGE SEND END (WITH ERRORS) ==="
      );
    }
  };

  // UNIFIED CHAT MESSAGE MANAGEMENT - Single source of truth

  const [chatLoading, setChatLoading] = useState(false);

  // WebSocket connection for real-time GRE chat
  const [wsConnection, setWsConnection] = useState<WebSocket | null>(null);
  const [wsConnected, setWsConnected] = useState(false);

  // Table assignment notification state
  const [showAssignmentNotification, setShowAssignmentNotification] =
    useState(false);
  const [assignmentDetails, setAssignmentDetails] = useState<any>(null);

  // Listen for table assignment notifications via WebSocket (useSeatAssignment hook handles this now)
  // This is kept for backward compatibility and redundancy
  useEffect(() => {
    if (user?.id) {
      console.log('🪑 [TABLE ASSIGNMENT] Real-time notifications handled by useSeatAssignment hook');
      // Table assignment notifications are now handled by the useSeatAssignment hook
      // which uses Socket.IO instead of Pusher
    }
  }, [user?.id, toast, queryClient]);

  // ✅ Real-time chat is now handled by PlayerChatSystem component using Socket.IO
  // (Old WebSocket code removed - see PlayerChatSystem.tsx for new implementation)

  // Debug: Log unified messages to console
  useEffect(() => {
    // Chat integration complete - using PlayerChatSystem component
  }, []);

  // Submit credit request mutation
  const submitCreditRequestMutation = useMutation({
    mutationFn: async ({
      playerId,
      requestedAmount,
      requestNote,
    }: {
      playerId: number;
      requestedAmount: number;
      requestNote: string;
    }) => {
      const response = await apiRequest("POST", "/api/credit-requests", {
        playerId,
        requestedAmount,
        requestNote,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/credit-requests/${user?.id}`],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/players/supabase"] });
      setCreditAmount("");
      setCreditNote("");
      setShowCreditForm(false);
      toast({
        title: "Credit Request Submitted",
        description:
          "Your credit request has been submitted to the Super Admin for approval",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Request Failed",
        description: error.message || "Could not submit credit request",
        variant: "destructive",
      });
    },
  });

  const handleCreditRequest = () => {
    if (!creditAmount || parseFloat(creditAmount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid credit amount",
        variant: "destructive",
      });
      return;
    }

    submitCreditRequestMutation.mutate({
      playerId: Number(user?.id),
      requestedAmount: parseFloat(creditAmount),
      requestNote: creditNote || `Credit request for ₹${creditAmount}`,
    });
  };

  // VIP Club redemption mutation
  const vipRedeemMutation = useMutation({
    mutationFn: async ({
      playerId,
      rewardType,
      pointsCost,
    }: {
      playerId: number;
      rewardType: string;
      pointsCost: number;
    }) => {
      const response = await apiRequest("POST", "/api/vip-club/redeem", {
        playerId,
        rewardType,
        pointsCost,
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Redemption Successful!",
        description: `${data.message}. You have ${data.remainingPoints} points remaining.`,
      });
      // Refresh user data to update points display
      queryClient.invalidateQueries({
        queryKey: ["/api/players/supabase", user?.email],
      });
    },
    onError: (error: any) => {
      toast({
        title: "Redemption Failed",
        description: error.message || "Failed to redeem points",
        variant: "destructive",
      });
    },
  });

  const handleVipRedeem = (rewardType: string, pointsCost: number) => {
    if (!user?.id) return;

    vipRedeemMutation.mutate({
      playerId: Number(user.id),
      rewardType,
      pointsCost,
    });
  };

  // PAN Card management
  // PAN Card state - Initialize with existing PAN card number from user data
  const [panCardNumber, setPanCardNumber] = useState("");
  const [showTransactions, setShowTransactions] = useState<
    "last10" | "all" | null
  >(null);

  // Update PAN card state when user data loads - this ensures the field shows existing data
  useEffect(() => {
    if (user?.pan_card_number) {
      setPanCardNumber(user.pan_card_number);
    }
  }, [user?.pan_card_number]);

  // Transaction color helpers
  const getTransactionAmountColor = (type: string) => {
    switch (type) {
      case "add_credit":
        return "text-blue-400"; // Blue for add credit
      case "clear_credit":
        return "text-orange-400"; // Orange for clear credit
      case "cash_in":
      case "table_cash_out":
      case "funds_added":
        return "text-emerald-400"; // Green for cash in/funds added
      case "cash_out":
      case "cashier_withdrawal":
      case "table_buy_in":
        return "text-red-400"; // Red for cash out/withdrawals
      default:
        return "text-slate-400";
    }
  };

  const getTransactionAmountPrefix = (type: string) => {
    switch (type) {
      case "add_credit":
        return "+"; // Positive for add credit
      case "clear_credit":
        return "-"; // Negative for clear credit
      case "cash_in":
      case "table_cash_out":
      case "funds_added":
        return "+"; // Positive for funds added
      case "cash_out":
      case "cashier_withdrawal":
      case "table_buy_in":
        return "-"; // Negative for withdrawals
      default:
        return "";
    }
  };

  // Seat selection state for waitlist
  const [showSeatDialog, setShowSeatDialog] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [selectedTableName, setSelectedTableName] = useState<string | null>(
    null
  );
  const [selectedSeatNumber, setSelectedSeatNumber] = useState<number | null>(
    null
  );

  // PAN Card validation function (matching KYC workflow)
  const isValidPAN = (pan: string): boolean => {
    const panRegex = /^[A-Z]{3}[ABCFGHLJPTF][A-Z][0-9]{4}[A-Z]$/;
    return panRegex.test(pan);
  };

  // PAN Card update mutation
  const updatePanCardMutation = useMutation({
    mutationFn: async ({
      playerId,
      panCardNumber,
    }: {
      playerId: number;
      panCardNumber: string;
    }) => {
      const response = await apiRequest(
        "POST",
        `/api/players/${playerId}/pan-card`,
        { panCardNumber }
      );
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "PAN Card Updated",
        description: "Your PAN card number has been updated successfully",
      });
      // Clear the input
      setPanCardNumber("");
      // Refresh user data
      queryClient.invalidateQueries({
        queryKey: ["/api/players/supabase", user?.email],
      });
    },
    onError: (error: any) => {
      toast({
        title: "PAN Card Update Failed",
        description: error.message || "Failed to update PAN card number",
        variant: "destructive",
      });
    },
  });

  // Transaction history query
  const { data: transactions, isLoading: transactionsLoading } = useQuery({
    queryKey: ["transactions", user?.id, showTransactions], // Added showTransactions to query key
    queryFn: async () => {
      if (!user?.id) return [];

      const limit = showTransactions === "all" ? 100 : 10; // Fetch 100 if 'all', otherwise 10
      const response = await fetch(
        `${API_BASE_URL}/auth/player/transactions?limit=${limit}`,
        {
          headers: {
            'x-player-id': user.id.toString(),
            'x-club-id': (user as any).clubId || '',
          },
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch transactions");
      }

      const data = await response.json();
      console.log('📊 [TRANSACTIONS] Response:', data);
      return data.transactions || [];
    },
    enabled: !!user?.id && !!showTransactions, // Enable query only if user and showTransactions are set
  });

  const handlePanCardUpdate = () => {
    if (!user?.id || !panCardNumber) {
      toast({
        title: "Invalid Input",
        description: "Please enter a valid PAN card number",
        variant: "destructive",
      });
      return;
    }

    // Validate PAN card format using the new function
    if (!isValidPAN(panCardNumber)) {
      toast({
        title: "Invalid PAN Card Format",
        description: "Please enter a valid PAN card number",
        variant: "destructive",
      });
      return;
    }

    updatePanCardMutation.mutate({
      playerId: Number(user.id),
      panCardNumber,
    });
  };

  // Update call time periodically
  useEffect(() => {
    if (user) {
      const interval = setInterval(() => {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, "0");
        const minutes = now.getMinutes().toString().padStart(2, "0");
        setCallTime(`${hours}:${minutes}`);
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [user, callTime]);

  // File type validation
  const validateFileType = (file: File): boolean => {
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "application/pdf",
    ];

    const allowedExtensions = [".jpg", ".jpeg", ".png", ".pdf"];
    const fileExtension = file.name
      .toLowerCase()
      .substring(file.name.lastIndexOf("."));

    return (
      allowedTypes.includes(file.type) &&
      allowedExtensions.includes(fileExtension)
    );
  };

  const validateFileSize = (file: File): boolean => {
    const maxSize = 5 * 1024 * 1024; // 5MB
    return file.size <= maxSize;
  };

  // Format document types for display
  const formatDocumentType = (type: string) => {
    const typeMap: Record<string, string> = {
      government_id: "Government ID",
      id_document: "Government ID",
      address_proof: "Address Proof",
      utility_bill: "Address Proof",
      pan_card: "PAN Card",
      profile_photo: "Profile Photo",
      photo: "Profile Photo",
    };
    return (
      typeMap[type] ||
      type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
    );
  };

  function formatSubmissionDate(dateString: string) {
    if (!dateString) return "No date available";

    try {
      const date = new Date(dateString);

      // Check if the date is valid
      if (isNaN(date.getTime())) {
        return "No date available";
      }

      // Format as "Aug 30, 2025 at 6:39 AM"
      return (
        date.toLocaleDateString("en-IN", {
          year: "numeric",
          month: "short",
          day: "numeric",
          timeZone: "Asia/Kolkata",
        }) +
        " at " +
        date.toLocaleTimeString("en-IN", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
          timeZone: "Asia/Kolkata",
        })
      );
    } catch (error) {
      return "No date available";
    }
  }

  const handleKycDocumentUpload = (documentType: string, file: File) => {
    console.log("Starting file upload:", {
      documentType,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    });

    // Validate file type
    if (!validateFileType(file)) {
      console.log("File type validation failed:", {
        type: file.type,
        name: file.name,
      });
      toast({
        title: "Invalid File Type",
        description: "Please upload JPG, PNG, or PDF files only",
        variant: "destructive",
      });
      return;
    }

    // Validate file size
    if (!validateFileSize(file)) {
      console.log("File size validation failed:", {
        size: file.size,
        maxSize: 5 * 1024 * 1024,
      });
      toast({
        title: "File Too Large",
        description: "File size must be less than 5MB",
        variant: "destructive",
      });
      return;
    }

    console.log("File validation passed, starting upload");
    uploadKycDocumentMutation.mutate({ documentType, file });
  };

  // Document viewing removed as per requirements

  const getKycDocumentStatus = (documentType: string) => {
    // Map display types to actual database types
    const typeMap: { [key: string]: string } = {
      id: "government_id",
      utility: "utility_bill",
      photo: "profile_photo",
      pan: "pan_card",
    };

    const actualType = typeMap[documentType] || documentType;

    // Find the latest document for this type (by createdAt date), using both Supabase and local URLs
    const docs = kycDocuments?.filter(
      (d) => d.documentType === actualType && d.fileUrl
    );
    if (!docs || docs.length === 0) return "missing";

    const latestDoc = docs.reduce((latest, current) => {
      return new Date(current.createdAt!) > new Date(latest.createdAt!)
        ? current
        : latest;
    });

    // For govt_id and pan_card, if document exists, show as "uploaded" instead of "pending"
    if ((actualType === "government_id" || actualType === "pan_card") && latestDoc.status === "pending") {
      return "uploaded";
    }

    return latestDoc.status;
  };

  const getKycStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case "uploaded":
        return <FileText className="w-4 h-4 text-blue-500" />;
      case "pending":
        return <Clock className="w-4 h-4 text-amber-500" />;
      case "rejected":
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <FileText className="w-4 h-4 text-slate-400" />;
    }
  };

  // Authentication is handled at App level, no need for additional loading screen here
  // This was causing the persistent "Loading your dashboard..." screen after video completion
  console.log(
    "🎯 [PLAYER DASHBOARD] Rendering with user:",
    !!user,
    user?.email,
    "KYC Status:",
    user?.kycStatus
  );

  // Safety guard - if no user, return nothing and let App.tsx handle routing
  if (!user) {
    console.log(
      "🎯 [PLAYER DASHBOARD] No user prop - returning null to let App handle routing"
    );
    return null;
  }

  // KYC Status Check - Only log once if approved to avoid spam
  const [kycStatusLogged, setKycStatusLogged] = useState(false);

  useEffect(() => {
    const isApproved = user?.kycStatus === 'approved' || user?.kycStatus === 'verified';
    if (!kycStatusLogged) {
      console.log('🔍 [KYC CHECK] User KYC Status:', user?.kycStatus, 'Type:', typeof user?.kycStatus);
      if (isApproved) {
        console.log('✅ [KYC CHECK] KYC Approved - caching status');
        setKycStatusLogged(true); // Cache approved status, don't check again
      }
    }
  }, [user?.kycStatus, kycStatusLogged]);

  // Show pending screen if KYC is explicitly 'pending' or undefined (not yet approved)
  const isKycPending = !user?.kycStatus || user?.kycStatus === 'pending';
  const isKycApproved = user?.kycStatus === 'approved' || user?.kycStatus === 'verified';

  if (isKycPending && !isKycApproved) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center justify-center">
              <Clock className="w-8 h-8 mr-3 text-amber-500" />
              KYC Verification Pending
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 mx-auto bg-amber-500/20 rounded-full flex items-center justify-center">
                <Clock className="w-10 h-10 text-amber-400 animate-pulse" />
              </div>

              <h2 className="text-2xl font-bold text-white">
                Your Documents Are Under Review
              </h2>

              <p className="text-slate-300">
                Thank you for submitting your KYC documents. Our club staff is currently reviewing your information.
              </p>

              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <p className="text-amber-300 text-sm flex items-start">
                  <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
                  <span>
                    Account verification typically takes 24-48 hours. Please check back later or contact club staff if you have any questions.
                  </span>
                </p>
              </div>

              <div className="space-y-3 pt-4">
                <div className="flex items-center justify-center space-x-2 text-slate-400">
                  <CheckCircle className="w-5 h-5 text-emerald-500" />
                  <span>Documents Submitted Successfully</span>
                </div>
                <div className="flex items-center justify-center space-x-2 text-slate-400">
                  <Clock className="w-5 h-5 text-amber-500 animate-pulse" />
                  <span>Awaiting Staff Approval</span>
                </div>
              </div>
            </div>

            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    await signOut();
                    // After signing out, redirect player back to the main form/login page
                    window.location.href = "/";
                  } catch (error) {
                    console.error("Sign out error from KYC pending card:", error);
                  }
                }}
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get gradient classes and style for background
  const gradientClasses = clubBranding ? getGradientClasses(clubBranding.gradient) : '';
  const gradientStyle = clubBranding ? getGradientStyle(clubBranding.gradient) : {};

  return (
    <div
      className={`min-h-screen w-full overflow-x-hidden dashboard-container relative pt-4 sm:pt-5 lg:pt-6 ${gradientClasses || 'bg-slate-900'}`}
      style={Object.keys(gradientStyle).length > 0 ? gradientStyle : undefined}
    >
      {/* Active Game Status Banner */}
      {gameStatus.activeGameInfo && (
        <div
          className={`border-b px-3 sm:px-6 py-3 sm:py-4 notification-banner ${gameStatus.isInActiveGame
            ? "bg-gradient-to-r from-amber-600 to-amber-700 border-amber-500"
            : "bg-gradient-to-r from-emerald-600 to-emerald-700 border-emerald-500"
            }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0 gap-3">
            <div className="flex items-start sm:items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
              <div className="p-1.5 sm:p-2 bg-emerald-500/20 rounded-full flex-shrink-0">
                <Play className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-col space-y-1.5 sm:space-y-2">
                  <span className="text-white font-bold text-base sm:text-lg">
                    {gameStatus.isInActiveGame
                      ? "🎮 CURRENTLY PLAYING"
                      : "⏳ WAITING FOR GAME"}
                  </span>
                  {gameStatus.activeGameInfo.seatNumber && (
                    <Badge className="bg-white text-slate-900 font-bold w-fit text-xs sm:text-sm">
                      Seat #{gameStatus.activeGameInfo.seatNumber}
                    </Badge>
                  )}
                </div>
                <div className="text-white/90 text-xs sm:text-sm mt-1.5 sm:mt-2 break-words">
                  <span className="font-medium">
                    {gameStatus.activeGameInfo.tableName}
                  </span>{" "}
                  •
                  <span className="ml-1">
                    {gameStatus.activeGameInfo.gameType}
                  </span>
                  {gameStatus.activeGameInfo.position &&
                    gameStatus.activeGameInfo.position > 0 && (
                      <span className="ml-1">
                        • Position #{gameStatus.activeGameInfo.position}
                      </span>
                    )}
                </div>
              </div>
            </div>
            <div className="flex justify-center sm:justify-end flex-shrink-0">
              <Link href={`/table/${gameStatus.activeGameInfo.tableId}`}>
                <Button
                  className={`${gameStatus.isInActiveGame
                    ? "bg-white text-amber-700 hover:bg-amber-50"
                    : "bg-white text-emerald-700 hover:bg-emerald-50"
                    } font-semibold px-4 sm:px-6 text-sm sm:text-base min-h-[44px] w-full sm:w-auto`}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  {gameStatus.isInActiveGame ? "View Game" : "View Table"}
                </Button>
              </Link>
            </div>
          </div>
          {gameStatus.isInActiveGame && gameStatus.restrictionMessage && (
            <div className="mt-2 sm:mt-3 p-2 sm:p-3 bg-amber-500/20 rounded-lg border border-amber-400/30">
              <div className="flex items-start sm:items-center text-white">
                <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5 sm:mt-0" />
                <span className="text-xs sm:text-sm font-medium break-words">
                  {gameStatus.restrictionMessage}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Push Notification Popup System */}
      <NotificationPopup
        userId={Number(user.id)}
        onChatNotificationClick={() => setChatDialogOpen(true)}
      />

      {/* Table Assignment Notification Dialog */}
      <Dialog
        open={showAssignmentNotification}
        onOpenChange={setShowAssignmentNotification}
      >
        <DialogContent className="bg-emerald-800 border-emerald-600 text-white w-[95vw] sm:max-w-md p-4 sm:p-6">
          <DialogHeader className="pb-3 sm:pb-4">
            <DialogTitle className="text-emerald-300 text-lg sm:text-xl flex items-center">
              <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 mr-2 text-emerald-400" />
              Table Assignment Confirmed!
            </DialogTitle>
          </DialogHeader>

          {assignmentDetails && (
            <div className="space-y-3 sm:space-y-4">
              <div className="bg-emerald-900/50 rounded-lg p-3 sm:p-4 border border-emerald-500/30">
                <h3 className="font-semibold text-emerald-300 mb-2 sm:mb-3 text-sm sm:text-base">
                  You've been assigned to:
                </h3>
                <div className="space-y-2 text-emerald-100 text-sm sm:text-base">
                  <div className="flex justify-between items-center">
                    <span>Table:</span>
                    <span className="font-semibold text-right break-words ml-2">
                      {assignmentDetails.tableName}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Seat Number:</span>
                    <span className="font-semibold">
                      #{assignmentDetails.seatNumber}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Assigned by:</span>
                    <span className="font-semibold text-right break-words ml-2">
                      {assignmentDetails.staffName}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-amber-900/20 border border-amber-600/50 rounded-lg p-2.5 sm:p-3">
                <p className="text-amber-200 text-xs sm:text-sm">
                  🎯{" "}
                  <strong>
                    Please proceed to your assigned table immediately.
                  </strong>{" "}
                  Your seat is now reserved and the game may be starting soon.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-end">
                <Button
                  onClick={() =>
                    setLocation(`/table/${assignmentDetails.tableId}`)
                  }
                  className="hover:opacity-90 text-white w-full sm:w-auto min-h-[44px]"
                  style={getClubButtonStyle('primary')}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View Table
                </Button>

                <Button
                  onClick={() => setShowAssignmentNotification(false)}
                  variant="outline"
                  className="hover:opacity-90 w-full sm:w-auto min-h-[44px]"
                  style={getClubButtonStyle('secondary')}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="max-w-full px-3 py-3 sm:px-4 sm:py-4 lg:px-6 lg:py-6 dashboard-container">
        {/* Header - Responsive */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 sm:mb-4 lg:mb-6 space-y-3 sm:space-y-0 dashboard-header">
          <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 w-full sm:w-auto">
            {/* White Label Logo - Positioned in top left corner, above table area */}
            {getLogoUrl() && (
              <div
                className="pointer-events-none mb-2 sm:mb-0"
                id="whitelabel-logo-container"
              >
                <div className="flex items-center bg-slate-900/80 backdrop-blur-sm p-1.5 sm:p-2 shadow-lg border border-slate-700/50 rounded">
                  <img
                    src={getLogoUrl()!}
                    alt={getClubName()}
                    className="rounded-lg h-6 sm:h-8 md:h-10 lg:h-12 w-auto object-contain max-w-[120px] sm:max-w-[150px] md:max-w-[180px] lg:max-w-[220px]"
                    onError={(e) => {
                      // Fallback to default logo if database logo fails to load
                      const img = e.target as HTMLImageElement;
                      const defaultLogo = whitelabelConfig.logoUrl;
                      if (defaultLogo && img.src !== defaultLogo) {
                        console.warn("⚠️ [LOGO] Database logo failed to load, using default logo");
                        img.src = defaultLogo;
                      } else {
                        // Hide container if both logos fail
                        const container = document.getElementById(
                          "whitelabel-logo-container"
                        );
                        if (container) {
                          container.style.display = "none";
                        }
                      }
                    }}
                  />
                </div>
              </div>
            )}
            <div className="w-full sm:w-auto min-w-0 flex-1">
              <h1
                className="text-base sm:text-lg lg:text-xl xl:text-2xl font-bold truncate"
                style={{ color: clubBranding?.skinColor || '#ffffff' }}
              >
                Player Dashboard
              </h1>
              <p
                className="text-xs sm:text-sm lg:text-base truncate"
                style={{ color: clubBranding?.skinColor || '#94a3b8' }}
              >
                Welcome back, {user?.nickname || user?.firstName}!
              </p>
            </div>
          </div>
          <Button
            onClick={async () => {
              try {
                await signOut();
                // Force redirect to login page after successful sign out
                window.location.href = "/";
              } catch (error) {
                console.error("Sign out error:", error);
              }
            }}
            variant="outline"
            size="sm"
            className="hover:opacity-90 w-full sm:w-auto flex-shrink-0 mt-2 sm:mt-0"
            style={clubBranding ? { borderColor: clubBranding.skinColor, color: clubBranding.skinColor } : { borderColor: '#64748b', color: '#94a3b8' }}
          >
            <LogOut className="h-4 w-4 mr-2" />
            <span className="sm:inline">Sign Out</span>
          </Button>
        </div>

        {/* Navigation Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full max-w-full"
        >
          <TabsList
            className="flex w-full justify-between mb-3 sm:mb-4 lg:mb-6 bg-slate-800 border border-slate-700 rounded-lg p-0.5 sm:p-1 overflow-x-auto overflow-y-hidden gap-0.5 sm:gap-1 scrollbar-hide min-h-[48px] sm:min-h-[52px]"
            data-tabs-list
          >
            <TabsTrigger
              value="game"
              className="flex-1 px-2 sm:px-3 lg:px-4 py-2 sm:py-2.5 lg:py-3 text-xs sm:text-sm font-medium rounded-md data-[state=active]:text-white hover:bg-slate-700 transition-colors text-slate-300 flex items-center justify-center min-w-0 min-h-[44px] sm:min-h-[48px]"
              data-active-style="true"
              role="tab"
            >
              <Spade className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 flex-shrink-0" />
            </TabsTrigger>
            <TabsTrigger
              value="offers"
              className="flex-1 px-2 sm:px-3 lg:px-4 py-2 sm:py-2.5 lg:py-3 text-xs sm:text-sm font-medium rounded-md data-[state=active]:text-white hover:bg-slate-700 transition-colors text-slate-300 flex items-center justify-center min-w-0 min-h-[44px] sm:min-h-[48px]"
              data-active-style="true"
              role="tab"
            >
              <Gift className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 flex-shrink-0" />
            </TabsTrigger>
            <TabsTrigger
              value="food"
              className="flex-1 px-2 sm:px-3 lg:px-4 py-2 sm:py-2.5 lg:py-3 text-xs sm:text-sm font-medium rounded-md data-[state=active]:text-white hover:bg-slate-700 transition-colors text-slate-300 flex items-center justify-center min-w-0 min-h-[44px] sm:min-h-[48px]"
              data-active-style="true"
              role="tab"
            >
              <Coffee className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 flex-shrink-0" />
            </TabsTrigger>
            <TabsTrigger
              value="session"
              className="flex-1 px-2 sm:px-3 lg:px-4 py-2 sm:py-2.5 lg:py-3 text-xs sm:text-sm font-medium rounded-md data-[state=active]:text-white hover:bg-slate-700 transition-colors text-slate-300 flex items-center justify-center min-w-0 min-h-[44px] sm:min-h-[48px]"
              data-active-style="true"
              role="tab"
            >
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 flex-shrink-0" />
            </TabsTrigger>
            <TabsTrigger
              value="balance"
              className="flex-1 px-2 sm:px-3 lg:px-4 py-2 sm:py-2.5 lg:py-3 text-xs sm:text-sm font-medium rounded-md data-[state=active]:text-white hover:bg-slate-700 transition-colors text-slate-300 flex items-center justify-center min-w-0 min-h-[44px] sm:min-h-[48px]"
              data-active-style="true"
              role="tab"
            >
              <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 flex-shrink-0" />
            </TabsTrigger>
            <TabsTrigger
              value="profile"
              className="flex-1 px-2 sm:px-3 lg:px-4 py-2 sm:py-2.5 lg:py-3 text-xs sm:text-sm font-medium rounded-md data-[state=active]:text-white hover:bg-slate-700 transition-colors text-slate-300 flex items-center justify-center min-w-0 min-h-[44px] sm:min-h-[48px]"
              data-active-style="true"
              role="tab"
            >
              <User className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 flex-shrink-0" />
            </TabsTrigger>
            <TabsTrigger
              value="feedback"
              className="flex-1 px-2 sm:px-3 lg:px-4 py-2 sm:py-2.5 lg:py-3 text-xs sm:text-sm font-medium rounded-md data-[state=active]:text-white hover:bg-slate-700 transition-colors text-slate-300 flex items-center justify-center min-w-0 min-h-[44px] sm:min-h-[48px]"
              data-active-style="true"
              role="tab"
            >
              <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 flex-shrink-0" />
            </TabsTrigger>
            <TabsTrigger
              value="notifications"
              className="flex-1 px-2 sm:px-3 lg:px-4 py-2 sm:py-2.5 lg:py-3 text-xs sm:text-sm font-medium rounded-md data-[state=active]:text-white hover:bg-slate-700 transition-colors text-slate-300 flex items-center justify-center min-w-0 min-h-[44px] sm:min-h-[48px] relative overflow-visible"
              data-active-style="true"
              role="tab"
            >
              <div className="relative flex items-center justify-center">
                <Bell className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 flex-shrink-0" />
                {notifications &&
                  Array.isArray(notifications) &&
                  notifications.length > 0 ? (
                  <span
                    className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 min-w-[14px] sm:min-w-[16px] h-3.5 sm:h-4 bg-red-500 rounded-full text-white font-bold flex items-center justify-center px-0.5 sm:px-1 text-[0.5rem] sm:text-[0.6rem]"
                    style={{ lineHeight: "1" }}
                  >
                    {notifications.length > 99 ? "99+" : notifications.length}
                  </span>
                ) : null}
              </div>
            </TabsTrigger>
          </TabsList>

          {/* Tab Content Areas */}
          <div className="w-full max-w-full overflow-hidden">
            {/* Game Tab */}
            <TabsContent
              value="game"
              className="space-y-4 sm:space-y-6 w-full max-w-full"
            >
              {/* Tab-level refresh */}
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRefreshSection("game")}
                  disabled={!!refreshingSection}
                  className="text-slate-300 border-slate-600 hover:bg-slate-700 hover:text-white"
                >
                  {refreshingSection === "game" ? (
                    <span className="animate-spin w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full inline-block" />
                  ) : (
                    <RotateCcw className="w-4 h-4" />
                  )}
                  <span className="ml-2">Refresh</span>
                </Button>
              </div>
              {/* Active Table Sessions - Show where player is currently seated */}
              {Array.isArray(seatedSessions) && seatedSessions.length > 0 && (
                <Card className="bg-gradient-to-r from-emerald-800 to-emerald-900 border-emerald-500 w-full max-w-full">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between w-full">
                      <CardTitle className="text-white flex items-center justify-center text-lg">
                        <Play className="w-5 h-5 mr-2 text-emerald-400" />
                        🪑 You Are Seated!
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRefreshSection("game-seated")}
                        disabled={!!refreshingSection}
                        className="text-emerald-200 hover:text-white hover:bg-emerald-700/30"
                      >
                        {refreshingSection === "game-seated" ? (
                          <span className="animate-spin w-4 h-4 border-2 border-emerald-300 border-t-transparent rounded-full inline-block" />
                        ) : (
                          <RotateCcw className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {Array.isArray(seatedSessions) &&
                        seatedSessions.map((session: any) => (
                          <div
                            key={session.id}
                            className="bg-emerald-700/30 p-4 rounded-lg border border-emerald-500/30"
                          >
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <h3 className="font-semibold text-white text-lg">
                                  {session.tableName}
                                </h3>
                                <p className="text-emerald-200">
                                  {session.gameType}
                                </p>
                                <p className="text-emerald-300 text-sm">
                                  Seat {session.seatNumber}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm text-emerald-200">
                                  Session Started
                                </p>
                                <p className="text-sm font-medium text-white">
                                  {session.sessionStartTime
                                    ? new Date(
                                      session.sessionStartTime
                                    ).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })
                                    : "Just now"}
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:gap-4 mb-3">
                              <div className="text-center bg-emerald-800/50 rounded-lg p-2 sm:p-3">
                                <p className="text-xs sm:text-sm text-emerald-200">
                                  Buy-in
                                </p>
                                <p className="text-base sm:text-lg font-semibold text-emerald-300">
                                  ₹
                                  {parseFloat(
                                    session.sessionBuyIn || "0"
                                  ).toLocaleString()}
                                </p>
                              </div>
                              <div className="text-center bg-emerald-800/50 rounded-lg p-2 sm:p-3">
                                <p className="text-xs sm:text-sm text-emerald-200">
                                  Stakes
                                </p>
                                <p className="text-base sm:text-lg font-semibold text-emerald-300">
                                  ₹{session.minBuyIn?.toLocaleString()}/
                                  {session.maxBuyIn?.toLocaleString()}
                                </p>
                              </div>
                            </div>

                            <div className="flex justify-center">
                              <Button
                                onClick={() =>
                                  setLocation(`/table/${session.tableId}`)
                                }
                                className="hover:opacity-90 text-white font-semibold"
                                style={getClubButtonStyle('primary')}
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                View Table
                              </Button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Staff-Managed Offer Carousel */}
              <OfferCarousel
                onOfferClick={(offerId) => {
                  console.log(
                    "🎯 [OFFER CLICK] Switching to offers tab:",
                    offerId
                  );
                  // Switch to offers tab instead of navigating
                  setActiveTab("offers");
                }}
              />

              <div className="w-full max-w-full space-y-3 sm:space-y-4">
                {/* Toggle State for Cash Tables vs Tournaments - Improved Alignment */}
                <div className="flex items-center justify-center space-x-2 mb-6 bg-slate-800/50 rounded-xl p-1 max-w-md mx-auto">
                  <button
                    onClick={() => setShowTournaments(false)}
                    className={`flex-1 flex items-center justify-center px-4 py-3 rounded-lg font-medium transition-all duration-200 ${!showTournaments
                      ? "text-white shadow-lg transform scale-105"
                      : "bg-transparent text-slate-300 hover:bg-slate-700/50"
                      }`}
                    style={!showTournaments && clubBranding ? { backgroundColor: clubBranding.skinColor } : undefined}
                  >
                    <Table className="w-4 h-4 mr-2 flex-shrink-0" />
                    <span className="hidden sm:inline">Cash Tables</span>
                    <span className="sm:hidden">Cash</span>
                  </button>
                  <button
                    onClick={() => setShowTournaments(true)}
                    className={`flex-1 flex items-center justify-center px-4 py-3 rounded-lg font-medium transition-all duration-200 ${showTournaments
                      ? "text-white shadow-lg transform scale-105"
                      : "bg-transparent text-slate-300 hover:bg-slate-700/50"
                      }`}
                    style={showTournaments && clubBranding ? { backgroundColor: clubBranding.skinColor } : undefined}
                  >
                    <Trophy className="w-4 h-4 mr-2 flex-shrink-0" />
                    <span className="hidden sm:inline">Tournaments</span>
                    <span className="sm:hidden">Tourneys</span>
                  </button>
                </div>

                {/* Removed waitlist management controls as requested */}

                {/* Cash Tables Display - Improved Layout */}
                {!showTournaments && (
                  <Card className="bg-slate-800/80 border-slate-700/50 w-full max-w-full overflow-hidden backdrop-blur-sm">
                    <CardHeader className="pb-3">
                      {/* Club Logo in Table Area */}
                      {getLogoUrl() && (
                        <div className="flex justify-center mb-4">
                          <div className="flex items-center bg-slate-900/60 backdrop-blur-sm rounded-lg p-2 shadow-md border border-slate-700/30">
                            <img
                              src={getLogoUrl()!}
                              alt={getClubName()}
                              className="h-10 sm:h-12 md:h-14 w-auto object-contain max-w-[180px] sm:max-w-[220px] md:max-w-[260px]"
                              onError={(e) => {
                                // Fallback to default logo if database logo fails to load
                                const img = e.target as HTMLImageElement;
                                const defaultLogo = whitelabelConfig.logoUrl;
                                if (defaultLogo && img.src !== defaultLogo) {
                                  console.warn("⚠️ [LOGO] Database logo failed to load, using default logo");
                                  img.src = defaultLogo;
                                } else {
                                  // Hide container if both logos fail
                                  const container = img.parentElement;
                                  if (container) {
                                    container.style.display = 'none';
                                  }
                                }
                              }}
                            />
                          </div>
                        </div>
                      )}
                      <div className="flex items-center justify-center gap-2 w-full">
                        <CardTitle className="text-white flex items-center justify-center text-lg">
                          <Table className="w-5 h-5 mr-2 text-emerald-500" />
                          Live Cash Tables
                        </CardTitle>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRefreshSection("game-tables")}
                          disabled={!!refreshingSection}
                          className="text-slate-300 hover:text-white hover:bg-slate-700 ml-auto"
                        >
                          {refreshingSection === "game-tables" ? (
                            <span className="animate-spin w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full inline-block" />
                          ) : (
                            <RotateCcw className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {/* Global Waitlist Status - Shows table TYPE (not specific table) */}
                      {waitlistData?.onWaitlist && waitlistData?.entry && (
                        <div className="mb-4 bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Clock className="w-5 h-5 text-amber-500" />
                              <span className="font-semibold text-white">You're on the Waitlist!</span>
                            </div>
                            <Badge className="bg-amber-500 text-black">Position #{waitlistData.position}</Badge>
                          </div>
                          <div className="text-sm text-slate-300 space-y-1">
                            <p><strong>Table Type:</strong> {waitlistData.entry.tableType}</p>
                            <p><strong>Party Size:</strong> {waitlistData.entry.partySize}</p>
                            <p><strong>Status:</strong> <span className="text-amber-400">{waitlistData.entry.status}</span></p>
                            <p className="text-xs text-slate-400 mt-2">Joined: {new Date(waitlistData.entry.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
                            {waitlistData.totalInQueue > 1 && (
                              <p className="text-xs text-slate-400">{waitlistData.totalInQueue} players in queue</p>
                            )}
                          </div>
                          <Button
                            onClick={() => {
                              if (waitlistData?.entry?.id) {
                                cancelWaitlistMutation.mutate(waitlistData.entry.id);
                              }
                            }}
                            disabled={cancelWaitlistMutation.isPending}
                            size="sm"
                            variant="outline"
                            className="mt-3 w-full bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"
                          >
                            {cancelWaitlistMutation.isPending ? (
                              <>
                                <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin mr-2" />
                                Leaving...
                              </>
                            ) : (
                              'Leave Waitlist'
                            )}
                          </Button>
                        </div>
                      )}

                      {tablesLoading ? (
                        <div className="space-y-4">
                          {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-20 bg-slate-700" />
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-4 sm:space-y-6">
                          {/* Rummy Tables Section */}
                          {tables && tables.filter((t: any) => t.isRummy).length > 0 && (
                            <div className="space-y-2 sm:space-y-3">
                              <div className="flex items-center gap-2 px-1">
                                <span className="text-xs sm:text-sm font-bold text-rose-400 uppercase tracking-widest border-l-4 border-rose-500 pl-2">🃏 Rummy Tables</span>
                              </div>
                              <div className="grid grid-cols-1 gap-2.5 sm:gap-3.5">
                                {tables
                                  .filter((t: any) => t.isRummy)
                                  .map((table: any) => (
                                    <div
                                      key={table.id}
                                      className="p-2.5 sm:p-3 rounded-lg bg-rose-950/40 border border-rose-800/30"
                                    >
                                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-3 gap-3 sm:gap-0">
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="font-semibold text-white text-sm sm:text-base truncate">
                                              {table.name}
                                            </h3>
                                            <Badge className="bg-rose-600/80 text-white text-[10px] px-1.5 py-0 flex-shrink-0">RUMMY</Badge>
                                          </div>
                                          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                                            {table.gameType}
                                          </p>
                                          {/* Rummy extra info */}
                                          {(table.pointsValue || table.numberOfDeals) && (
                                            <p className="text-[10px] text-rose-300/80 mt-0.5">
                                              {table.pointsValue ? `₹${table.pointsValue}/pt` : ''}
                                              {table.pointsValue && table.numberOfDeals ? ' • ' : ''}
                                              {table.numberOfDeals ? `${table.numberOfDeals} deals` : ''}
                                            </p>
                                          )}
                                          {/* Game Status Indicator */}
                                          <div className="flex items-center space-x-2 mt-1.5 sm:mt-1">
                                            <div
                                              className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full flex-shrink-0 ${table.isActive
                                                ? "bg-red-500"
                                                : "bg-green-500"
                                                }`}
                                            ></div>
                                            <span
                                              className={`text-[0.65rem] sm:text-xs ${table.isActive
                                                ? "text-red-400"
                                                : "text-green-400"
                                                }`}
                                            >
                                              {table.isActive
                                                ? "Game In Progress"
                                                : "Accepting Players"}
                                            </span>
                                          </div>
                                        </div>
                                        <div className="text-left sm:text-right flex-shrink-0">
                                          <p className="text-xs sm:text-sm text-slate-400">
                                            Stakes
                                          </p>
                                          <p className="text-base sm:text-lg font-semibold text-emerald-500">
                                            {table.stakes}
                                          </p>
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-1 gap-3 sm:gap-4 mb-3">
                                        <div className="text-center">
                                          <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 mx-auto mb-1" />
                                          <p className="text-[0.65rem] sm:text-xs text-slate-400">
                                            Players
                                          </p>
                                          <p className="text-xs sm:text-sm font-semibold text-white">
                                            {table.currentPlayers || 0}/
                                            {table.maxPlayers || 9}
                                          </p>
                                        </div>
                                      </div>

                                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-2">
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:space-x-2 min-w-0 flex-1">
                                          {isTableJoined(String(table.id)) ? (
                                            <>
                                              <div className="flex flex-wrap items-center gap-2">
                                                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs sm:text-sm whitespace-nowrap">
                                                  Joined
                                                </Badge>
                                                <span className="text-xs sm:text-sm text-slate-400 whitespace-nowrap">
                                                  Position:{" "}
                                                  {getWaitListPosition(
                                                    String(table.id)
                                                  )}
                                                </span>
                                              </div>
                                              {tableStatuses &&
                                                typeof tableStatuses === "object" &&
                                                tableStatuses !== null &&
                                                String(table.id) in tableStatuses && (
                                                  <div className="flex items-center space-x-1">
                                                    {(
                                                      tableStatuses as Record<
                                                        string,
                                                        any
                                                      >
                                                    )[String(table.id)]
                                                      ?.gameStarted && (
                                                        <span className="text-[0.65rem] sm:text-xs text-amber-400">
                                                          ⚠️ Game started
                                                        </span>
                                                      )}
                                                  </div>
                                                )}
                                              {!(
                                                tableStatuses &&
                                                typeof tableStatuses === "object" &&
                                                (tableStatuses as any)[
                                                  String(table.id)
                                                ]?.gameStarted &&
                                                gameStatus.isInActiveGame &&
                                                gameStatus.activeGameInfo?.tableId ===
                                                String(table.id)
                                              ) && (
                                                  <Button
                                                    onClick={() =>
                                                      handleLeaveWaitList(
                                                        String(table.id)
                                                      )
                                                    }
                                                    disabled={
                                                      leaveWaitListMutation.isPending
                                                    }
                                                    size="sm"
                                                    variant="outline"
                                                    className="bg-gradient-to-r from-slate-600/30 to-slate-500/30 border border-slate-400/50 text-slate-300 hover:from-slate-500/40 hover:to-slate-400/40 hover:border-slate-300 hover:text-slate-200 transition-all duration-300 shadow-lg hover:shadow-slate-500/25 backdrop-blur-sm min-h-[44px] sm:min-h-[36px] text-xs sm:text-sm w-full sm:w-auto"
                                                  >
                                                    {leaveWaitListMutation.isPending ? (
                                                      <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-slate-300 border-t-transparent rounded-full animate-spin mr-2" />
                                                    ) : null}
                                                    Leave
                                                  </Button>
                                                )}
                                            </>
                                          ) : (waitlistData?.onWaitlist && (String(waitlistData.entry?.table_id || waitlistData.entry?.tableId || waitlistData.tableInfo?.tableId) === String(table.id))) ? (
                                            <div className="flex flex-col space-y-2 w-full">
                                              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2 sm:p-3">
                                                <div className="flex items-center justify-between mb-1">
                                                  <span className="text-xs sm:text-sm font-semibold text-amber-400">On Waitlist</span>
                                                  <Badge className="bg-amber-500 text-black text-xs">#{waitlistData.position}</Badge>
                                                </div>
                                                <p className="text-[0.65rem] sm:text-xs text-slate-300">
                                                  {waitlistData.entry?.tableType}
                                                </p>
                                              </div>
                                              <Button
                                                onClick={() => {
                                                  if (waitlistData?.entry?.id) {
                                                    cancelWaitlistMutation.mutate(waitlistData.entry.id);
                                                  }
                                                }}
                                                disabled={cancelWaitlistMutation.isPending}
                                                size="sm"
                                                variant="outline"
                                                className="bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20 min-h-[44px] sm:min-h-[36px] text-xs sm:text-sm w-full"
                                              >
                                                {cancelWaitlistMutation.isPending ? (
                                                  <>
                                                    <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin mr-2" />
                                                    Leaving...
                                                  </>
                                                ) : (
                                                  <>
                                                    <X className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                                                    Leave Waitlist
                                                  </>
                                                )}
                                              </Button>
                                            </div>
                                          ) : (
                                            <Button
                                              onClick={() =>
                                                handleJoinWaitList(String(table.id))
                                              }
                                              disabled={
                                                joinWaitListMutation.isPending ||
                                                gameStatus.isInActiveGame
                                              }
                                              size="sm"
                                              className="hover:opacity-90 text-white shadow-lg transition-all duration-300 border backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] sm:min-h-[36px] text-xs sm:text-sm w-full sm:w-auto"
                                              style={getClubButtonStyle('primary')}
                                            >
                                              {joinWaitListMutation.isPending ? (
                                                <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                                              ) : (
                                                <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                                              )}
                                              <span className="hidden sm:inline">Join Wait-List</span>
                                              <span className="sm:hidden">Join</span>
                                            </Button>
                                          )}
                                        </div>

                                        <div className="flex items-center justify-between sm:justify-end gap-2 sm:space-x-2 flex-shrink-0">
                                          <Badge
                                            variant="secondary"
                                            className="bg-slate-600 text-slate-300 text-xs sm:text-sm whitespace-nowrap"
                                          >
                                            {table.isActive ? "Active" : "Inactive"}
                                          </Badge>
                                          <Button
                                            onClick={() => {
                                              setSelectedTableViewTableId(
                                                String(table.id)
                                              );
                                              setTableViewDialogOpen(true);
                                            }}
                                            size="sm"
                                            variant="outline"
                                            className="border-2 hover:opacity-80 transition-all duration-300 shadow-lg backdrop-blur-sm min-h-[44px] sm:min-h-[36px] text-xs sm:text-sm px-3 sm:px-4"
                                            style={getClubButtonStyle('secondary')}
                                          >
                                            <Eye className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                                            View
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}

                          {/* Poker Tables Section */}
                          {tables && tables.filter((t: any) => !t.isRummy).length > 0 && (
                            <div className="space-y-2 sm:space-y-3">
                              <div className="flex items-center gap-2 px-1">
                                <span className="text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-widest border-l-4 border-slate-500 pl-2">♠ Poker Tables</span>
                              </div>
                              <div className="grid grid-cols-1 gap-2.5 sm:gap-3.5">
                                {tables
                                  .filter((t: any) => !t.isRummy)
                                  .map((table: any) => (
                                    <div
                                      key={table.id}
                                      className="p-2.5 sm:p-3 rounded-lg bg-slate-700"
                                    >
                                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-3 gap-3 sm:gap-0">
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="font-semibold text-white text-sm sm:text-base truncate">
                                              {table.name}
                                            </h3>
                                          </div>
                                          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                                            {table.gameType}
                                          </p>
                                          {/* Game Status Indicator */}
                                          <div className="flex items-center space-x-2 mt-1.5 sm:mt-1">
                                            <div
                                              className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full flex-shrink-0 ${table.isActive
                                                ? "bg-red-500"
                                                : "bg-green-500"
                                                }`}
                                            ></div>
                                            <span
                                              className={`text-[0.65rem] sm:text-xs ${table.isActive
                                                ? "text-red-400"
                                                : "text-green-400"
                                                }`}
                                            >
                                              {table.isActive
                                                ? "Game In Progress"
                                                : "Accepting Players"}
                                            </span>
                                          </div>
                                        </div>
                                        <div className="text-left sm:text-right flex-shrink-0">
                                          <p className="text-xs sm:text-sm text-slate-400">
                                            Stakes
                                          </p>
                                          <p className="text-base sm:text-lg font-semibold text-emerald-500">
                                            {table.stakes}
                                          </p>
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-1 gap-3 sm:gap-4 mb-3">
                                        <div className="text-center">
                                          <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 mx-auto mb-1" />
                                          <p className="text-[0.65rem] sm:text-xs text-slate-400">
                                            Players
                                          </p>
                                          <p className="text-xs sm:text-sm font-semibold text-white">
                                            {table.currentPlayers || 0}/
                                            {table.maxPlayers || 9}
                                          </p>
                                        </div>
                                      </div>

                                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-2">
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:space-x-2 min-w-0 flex-1">
                                          {isTableJoined(String(table.id)) ? (
                                            <>
                                              <div className="flex flex-wrap items-center gap-2">
                                                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs sm:text-sm whitespace-nowrap">
                                                  Joined
                                                </Badge>
                                                <span className="text-xs sm:text-sm text-slate-400 whitespace-nowrap">
                                                  Position:{" "}
                                                  {getWaitListPosition(
                                                    String(table.id)
                                                  )}
                                                </span>
                                              </div>
                                              {tableStatuses &&
                                                typeof tableStatuses === "object" &&
                                                tableStatuses !== null &&
                                                String(table.id) in tableStatuses && (
                                                  <div className="flex items-center space-x-1">
                                                    {(
                                                      tableStatuses as Record<
                                                        string,
                                                        any
                                                      >
                                                    )[String(table.id)]
                                                      ?.gameStarted && (
                                                        <span className="text-[0.65rem] sm:text-xs text-amber-400">
                                                          ⚠️ Game started
                                                        </span>
                                                      )}
                                                  </div>
                                                )}
                                              {!(
                                                tableStatuses &&
                                                typeof tableStatuses === "object" &&
                                                (tableStatuses as any)[
                                                  String(table.id)
                                                ]?.gameStarted &&
                                                gameStatus.isInActiveGame &&
                                                gameStatus.activeGameInfo?.tableId ===
                                                String(table.id)
                                              ) && (
                                                  <Button
                                                    onClick={() =>
                                                      handleLeaveWaitList(
                                                        String(table.id)
                                                      )
                                                    }
                                                    disabled={
                                                      leaveWaitListMutation.isPending
                                                    }
                                                    size="sm"
                                                    variant="outline"
                                                    className="bg-gradient-to-r from-slate-600/30 to-slate-500/30 border border-slate-400/50 text-slate-300 hover:from-slate-500/40 hover:to-slate-400/40 hover:border-slate-300 hover:text-slate-200 transition-all duration-300 shadow-lg hover:shadow-slate-500/25 backdrop-blur-sm min-h-[44px] sm:min-h-[36px] text-xs sm:text-sm w-full sm:w-auto"
                                                  >
                                                    {leaveWaitListMutation.isPending ? (
                                                      <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-slate-300 border-t-transparent rounded-full animate-spin mr-2" />
                                                    ) : null}
                                                    Leave
                                                  </Button>
                                                )}
                                            </>
                                          ) : (waitlistData?.onWaitlist && (String(waitlistData.entry?.table_id || waitlistData.entry?.tableId || waitlistData.tableInfo?.tableId) === String(table.id))) ? (
                                            <div className="flex flex-col space-y-2 w-full">
                                              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2 sm:p-3">
                                                <div className="flex items-center justify-between mb-1">
                                                  <span className="text-xs sm:text-sm font-semibold text-amber-400">On Waitlist</span>
                                                  <Badge className="bg-amber-500 text-black text-xs">#{waitlistData.position}</Badge>
                                                </div>
                                                <p className="text-[0.65rem] sm:text-xs text-slate-300">
                                                  {waitlistData.entry?.tableType}
                                                </p>
                                              </div>
                                              <Button
                                                onClick={() => {
                                                  if (waitlistData?.entry?.id) {
                                                    cancelWaitlistMutation.mutate(waitlistData.entry.id);
                                                  }
                                                }}
                                                disabled={cancelWaitlistMutation.isPending}
                                                size="sm"
                                                variant="outline"
                                                className="bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20 min-h-[44px] sm:min-h-[36px] text-xs sm:text-sm w-full"
                                              >
                                                {cancelWaitlistMutation.isPending ? (
                                                  <>
                                                    <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin mr-2" />
                                                    Leaving...
                                                  </>
                                                ) : (
                                                  <>
                                                    <X className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                                                    Leave Waitlist
                                                  </>
                                                )}
                                              </Button>
                                            </div>
                                          ) : (
                                            <Button
                                              onClick={() =>
                                                handleJoinWaitList(String(table.id))
                                              }
                                              disabled={
                                                joinWaitListMutation.isPending ||
                                                gameStatus.isInActiveGame
                                              }
                                              size="sm"
                                              className="hover:opacity-90 text-white shadow-lg transition-all duration-300 border backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] sm:min-h-[36px] text-xs sm:text-sm w-full sm:w-auto"
                                              style={getClubButtonStyle('primary')}
                                            >
                                              {joinWaitListMutation.isPending ? (
                                                <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                                              ) : (
                                                <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                                              )}
                                              <span className="hidden sm:inline">Join Wait-List</span>
                                              <span className="sm:hidden">Join</span>
                                            </Button>
                                          )}
                                        </div>

                                        <div className="flex items-center justify-between sm:justify-end gap-2 sm:space-x-2 flex-shrink-0">
                                          <Badge
                                            variant="secondary"
                                            className="bg-slate-600 text-slate-300 text-xs sm:text-sm whitespace-nowrap"
                                          >
                                            {table.isActive ? "Active" : "Inactive"}
                                          </Badge>
                                          <Button
                                            onClick={() => {
                                              setSelectedTableViewTableId(
                                                String(table.id)
                                              );
                                              setTableViewDialogOpen(true);
                                            }}
                                            size="sm"
                                            variant="outline"
                                            className="border-2 hover:opacity-80 transition-all duration-300 shadow-lg backdrop-blur-sm min-h-[44px] sm:min-h-[36px] text-xs sm:text-sm px-3 sm:px-4"
                                            style={getClubButtonStyle('secondary')}
                                          >
                                            <Eye className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                                            View
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}

                          {(!(tables as any) ||
                            (tables as any)?.length === 0) && (
                              <div className="text-center py-8">
                                <Table className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                                <p className="text-slate-400">
                                  No tables available
                                </p>
                              </div>
                            )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Tournaments Display - Improved Layout */}
                {showTournaments && (
                  <Card className="bg-slate-800/80 border-slate-700/50 w-full max-w-full overflow-hidden backdrop-blur-sm">
                    <CardHeader className="pb-3">
                      {/* Club Logo in Tournament Area */}
                      {getLogoUrl() && (
                        <div className="flex justify-center mb-4">
                          <div className="flex items-center bg-slate-900/60 backdrop-blur-sm rounded-lg p-2 shadow-md border border-slate-700/30">
                            <img
                              src={getLogoUrl()!}
                              alt={getClubName()}
                              className="h-10 sm:h-12 md:h-14 w-auto object-contain max-w-[180px] sm:max-w-[220px] md:max-w-[260px]"
                              onError={(e) => {
                                // Fallback to default logo if database logo fails to load
                                const img = e.target as HTMLImageElement;
                                const defaultLogo = whitelabelConfig.logoUrl;
                                if (defaultLogo && img.src !== defaultLogo) {
                                  console.warn("⚠️ [LOGO] Database logo failed to load, using default logo");
                                  img.src = defaultLogo;
                                } else {
                                  // Hide container if both logos fail
                                  const container = img.parentElement;
                                  if (container) {
                                    container.style.display = 'none';
                                  }
                                }
                              }}
                            />
                          </div>
                        </div>
                      )}
                      <div className="flex items-center justify-center gap-2 w-full">
                        <CardTitle className="text-white flex items-center justify-center text-lg">
                          <Trophy className="w-5 h-5 mr-2 text-yellow-500" />
                          Active Tournaments
                        </CardTitle>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRefreshSection("game-tournaments")}
                          disabled={!!refreshingSection}
                          className="text-slate-300 hover:text-white hover:bg-slate-700 ml-auto"
                        >
                          {refreshingSection === "game-tournaments" ? (
                            <span className="animate-spin w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full inline-block" />
                          ) : (
                            <RotateCcw className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
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
                          {(tournaments as any)?.map((tournament: any) => (
                            <div
                              key={tournament.id}
                              className="bg-slate-700 p-4 rounded-lg"
                            >
                              <div className="flex justify-between items-start mb-3">
                                <div>
                                  <h3 className="font-semibold text-white">
                                    {tournament.name}
                                  </h3>
                                  {tournament.description && (
                                    <p className="text-xs text-slate-400 mt-1">
                                      {tournament.description}
                                    </p>
                                  )}
                                </div>
                                <div className="text-right">
                                  <p className="text-sm text-slate-400">
                                    Buy-in
                                  </p>
                                  <p className="text-lg font-semibold text-yellow-500">
                                    ₹
                                    {Number(tournament.buyIn || tournament.buy_in || 0).toLocaleString()}
                                  </p>
                                </div>
                              </div>

                              <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:gap-4 mb-3">
                                <div className="text-center">
                                  <Users className="w-3 h-3 sm:w-4 sm:h-4 text-slate-400 mx-auto mb-1" />
                                  <p className="text-[0.65rem] sm:text-xs text-slate-400">
                                    Players
                                  </p>
                                  <p className="text-xs sm:text-sm font-semibold text-white">
                                    {(tournament.registeredPlayers ??
                                      tournament.registered_players ??
                                      0) || 0}
                                    /
                                    {tournament.maxPlayers ??
                                      tournament.max_players ??
                                      0}
                                  </p>
                                </div>
                                <div className="text-center">
                                  <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-slate-400 mx-auto mb-1" />
                                  <p className="text-[0.65rem] sm:text-xs text-slate-400">
                                    Start Time
                                  </p>
                                  <p className="text-xs sm:text-sm font-semibold text-emerald-500">
                                    {tournament.startDate
                                      ? new Date(
                                        tournament.startDate
                                      ).toLocaleTimeString('en-IN', {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                        timeZone: "Asia/Kolkata",
                                      })
                                      : "TBA"}
                                  </p>
                                </div>
                                <div className="text-center">
                                  <Trophy className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-500 mx-auto mb-1" />
                                  <p className="text-[0.65rem] sm:text-xs text-slate-400">
                                    Prize Pool
                                  </p>
                                  <p className="text-xs sm:text-sm font-semibold text-yellow-500">
                                    ₹
                                    {Number(
                                      tournament.prizePool ||
                                      tournament.prize_pool ||
                                      0
                                    ).toLocaleString()}
                                  </p>
                                </div>
                              </div>

                              {(() => {
                                const lateInfo = getTournamentLateRegInfo(tournament);
                                const preStartStatuses = ["scheduled", "upcoming", "registration_open", "registering"];
                                const activeStatuses = ["active", "running"];
                                const isPreStart = preStartStatuses.includes(tournament.status);
                                const isTournamentActive = activeStatuses.includes(tournament.status);
                                const playerRegistered = isRegistered(tournament.id);
                                const playerStatus = playerTournamentStatuses?.[tournament.id];
                                const playerExited = playerStatus?.isExited === true;
                                const isFull = (tournament.registeredPlayers ?? tournament.registered_players ?? 0) >= (tournament.maxPlayers ?? tournament.max_players ?? 999);

                                let canRegister = false;
                                let canCancel = false;
                                let buttonLabel = "Register";
                                let disabledLabel = "Registration Closed";

                                if (playerRegistered) {
                                  canCancel = true;
                                } else if (isPreStart) {
                                  canRegister = !isFull;
                                  disabledLabel = isFull ? "Tournament Full" : "Registration Closed";
                                } else if (isTournamentActive) {
                                  if (lateInfo.lateRegAllowed && lateInfo.lateRegOpen && !isFull) {
                                    canRegister = true;
                                    buttonLabel = "Late Register";
                                  } else if (isFull) {
                                    disabledLabel = "Tournament Full";
                                  } else if (!lateInfo.lateRegAllowed) {
                                    disabledLabel = "Registration Closed";
                                  } else {
                                    disabledLabel = "Late Reg Expired";
                                  }
                                }

                                return (
                                  <div className="space-y-2">
                                    {/* Active tournament info */}
                                    {isTournamentActive && (
                                      <div className="flex items-center justify-between">
                                        <Badge className="bg-green-500/20 text-green-300 border-green-500/30">
                                          Live
                                        </Badge>
                                        {playerRegistered ? (
                                          <TournamentSessionTimer tournament={tournament} isExited={playerExited} exitedAt={playerStatus?.exitedAt} />
                                        ) : lateInfo.lateRegAllowed ? (
                                          <DashboardLateRegCountdown tournament={tournament} />
                                        ) : (
                                          <span className="flex items-center gap-1 text-red-400 text-[0.65rem] font-medium">
                                            <Lock className="w-3 h-3" /> No late registration
                                          </span>
                                        )}
                                      </div>
                                    )}

                                    <div className="flex justify-between items-center">
                                      <div className="flex items-center space-x-2">
                                        {!isTournamentActive && (
                                          <Badge
                                            className={`${isPreStart
                                              ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
                                              : tournament.status === "finished"
                                                ? "bg-gray-500/20 text-gray-300 border-gray-500/30"
                                                : "bg-slate-500/20 text-slate-300 border-slate-500/30"
                                              }`}
                                          >
                                            {tournament.status
                                              ? tournament.status.charAt(0).toUpperCase() + tournament.status.slice(1)
                                              : "Unknown"}
                                          </Badge>
                                        )}
                                        {tournament.gameType && (
                                          <Badge className="bg-slate-600/50 text-slate-300 text-[0.6rem]">
                                            {tournament.gameType === "rummy" ? "Rummy" : "Poker"}
                                          </Badge>
                                        )}
                                      </div>

                                      <div className="flex items-center space-x-2">
                                        {(isPreStart || isTournamentActive) && (
                                          <>
                                            {isTournamentActive && playerRegistered ? (
                                              <Button
                                                onClick={() => handleViewTournamentSession(tournament)}
                                                size="sm"
                                                className={playerExited
                                                  ? "bg-red-700 hover:bg-red-600 text-white"
                                                  : "bg-green-600 hover:bg-green-500 text-white"
                                                }
                                              >
                                                {playerExited ? (
                                                  <><XCircle className="w-3 h-3 mr-1" /> Eliminated</>
                                                ) : (
                                                  <><Play className="w-3 h-3 mr-1" /> View Session</>
                                                )}
                                              </Button>
                                            ) : (
                                              <Button
                                                onClick={() => handleViewTournamentDetails(tournament)}
                                                size="sm"
                                                variant="outline"
                                                className="border-slate-500 text-slate-200 hover:bg-slate-600"
                                              >
                                                View Details
                                              </Button>
                                            )}
                                            {canCancel ? (
                                              !isTournamentActive && (
                                                <Button
                                                  size="sm"
                                                  disabled
                                                  className="text-white"
                                                  style={getClubButtonStyle('primary')}
                                                >
                                                  Registered
                                                </Button>
                                              )
                                            ) : canRegister ? (
                                              <Button
                                                onClick={() => handleTournamentRegister(tournament.id)}
                                                disabled={tournamentActionLoading}
                                                size="sm"
                                                className="bg-yellow-500 hover:bg-yellow-600 text-black"
                                              >
                                                {tournamentActionLoading ? (
                                                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin mr-2" />
                                                ) : null}
                                                {buttonLabel}
                                              </Button>
                                            ) : (
                                              <Button size="sm" disabled className="opacity-50 text-slate-400">
                                                <Lock className="w-3 h-3 mr-1" />
                                                {disabledLabel}
                                              </Button>
                                            )}
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          ))}

                          {(!(tournaments as any) ||
                            (tournaments as any)?.length === 0) && (
                              <div className="text-center py-8">
                                <Trophy className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                                <p className="text-slate-400">
                                  No tournaments available
                                </p>
                              </div>
                            )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Preferences section removed as per requirements */}
              </div>
            </TabsContent>

            {/* Offers Tab - Staff Managed */}
            <TabsContent value="offers" className="space-y-4 sm:space-y-6">
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRefreshSection("offers")}
                  disabled={!!refreshingSection}
                  className="text-slate-300 border-slate-600 hover:bg-slate-700 hover:text-white"
                >
                  {refreshingSection === "offers" ? (
                    <span className="animate-spin w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full inline-block" />
                  ) : (
                    <RotateCcw className="w-4 h-4" />
                  )}
                  <span className="ml-2">Refresh</span>
                </Button>
              </div>
              <ScrollableOffersDisplay branding={clubBranding} />
            </TabsContent>

            {/* Food & Beverage Tab */}
            <TabsContent value="food" className="space-y-4 sm:space-y-6">
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRefreshSection("food")}
                  disabled={!!refreshingSection}
                  className="text-slate-300 border-slate-600 hover:bg-slate-700 hover:text-white"
                >
                  {refreshingSection === "food" ? (
                    <span className="animate-spin w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full inline-block" />
                  ) : (
                    <RotateCcw className="w-4 h-4" />
                  )}
                  <span className="ml-2">Refresh</span>
                </Button>
              </div>
              <FoodBeverageTab user={user} clubBranding={clubBranding} />
            </TabsContent>

            {/* Session Tab - Advanced Playtime Tracking */}
            <TabsContent value="session" className="space-y-4 sm:space-y-6">
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRefreshSection("session")}
                  disabled={!!refreshingSection}
                  className="text-slate-300 border-slate-600 hover:bg-slate-700 hover:text-white"
                >
                  {refreshingSection === "session" ? (
                    <span className="animate-spin w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full inline-block" />
                  ) : (
                    <RotateCcw className="w-4 h-4" />
                  )}
                  <span className="ml-2">Refresh</span>
                </Button>
              </div>
              <div className="max-w-4xl mx-auto">
                {!gameStatus.isInActiveGame &&
                  !(
                    Array.isArray(seatedSessions) && seatedSessions.length > 0
                  ) ? (
                  <Card className="bg-slate-800 border-slate-700">
                    <CardContent className="p-8">
                      <div className="text-center">
                        <Clock className="w-12 h-12 mx-auto mb-4 text-slate-400 opacity-50" />
                        <h3 className="text-lg font-semibold text-white mb-2">
                          No Active Session
                        </h3>
                        <p className="text-slate-400 mb-4">
                          Join a table from the Tables tab to start tracking your playtime
                        </p>
                        <Button
                          variant="outline"
                          className="hover:opacity-90"
                          style={getClubButtonStyle('secondary')}
                          onClick={() => setActiveTab("game")}
                        >
                          Go to Tables
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <PlaytimeTracker
                    playerId={user?.id?.toString() || ""}
                    gameStatus={gameStatus}
                  />
                )}
              </div>
            </TabsContent>

            <TabsContent value="balance" className="space-y-4 sm:space-y-6">
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRefreshSection("balance")}
                  disabled={!!refreshingSection}
                  className="text-slate-300 border-slate-600 hover:bg-slate-700 hover:text-white"
                >
                  {refreshingSection === "balance" ? (
                    <span className="animate-spin w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full inline-block" />
                  ) : (
                    <RotateCcw className="w-4 h-4" />
                  )}
                  <span className="ml-2">Refresh</span>
                </Button>
              </div>
              {/* Balance Display */}
              {user?.id && (
                <PlayerBalanceDisplay
                  playerId={user.id.toString()}
                  showBreakdown={true}
                />
              )}

              {/* VIP Points */}
              {user?.id && <VipPointsDisplay userId={user.id} />}

              {/* Credit Request Card - Show if player has credit enabled */}
              {user?.id && creditEnabled && <CreditRequestCard />}

              {/* Transaction History */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <div className="flex items-center justify-between w-full">
                    <CardTitle className="text-white flex items-center">
                      <BarChart3 className="w-5 h-5 mr-2 text-emerald-500" />
                      Recent Transactions
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRefreshSection("balance-transactions")}
                      disabled={!!refreshingSection}
                      className="text-slate-300 hover:text-white hover:bg-slate-700"
                    >
                      {refreshingSection === "balance-transactions" ? (
                        <span className="animate-spin w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full inline-block" />
                      ) : (
                        <RotateCcw className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="max-h-60 overflow-y-auto">
                    <PlayerTransactionHistory
                      playerId={user?.id?.toString() || ""}
                      limit={10}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Profile Tab */}
            <TabsContent value="profile" className="space-y-4 sm:space-y-6">
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRefreshSection("profile")}
                  disabled={!!refreshingSection}
                  className="text-slate-300 border-slate-600 hover:bg-slate-700 hover:text-white"
                >
                  {refreshingSection === "profile" ? (
                    <span className="animate-spin w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full inline-block" />
                  ) : (
                    <RotateCcw className="w-4 h-4" />
                  )}
                  <span className="ml-2">Refresh</span>
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:gap-6">
                {/* Profile Summary */}
                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <div className="flex items-center justify-between w-full">
                      <CardTitle className="text-white flex items-center">
                        <User className="w-5 h-5 mr-2 text-emerald-500" />
                        Profile
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRefreshSection("profile")}
                        disabled={!!refreshingSection}
                        className="text-slate-300 hover:text-white hover:bg-slate-700"
                      >
                        {refreshingSection === "profile" ? (
                          <span className="animate-spin w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full inline-block" />
                        ) : (
                          <RotateCcw className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Profile Details with per-field change request actions */}
                    <div className="space-y-3">
                      {/* Name Field */}
                      {(() => {
                        const nameStatus = getFieldChangeStatus('name');
                        return (
                          <div className="p-3 bg-slate-700 rounded-lg space-y-2">
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                              <div>
                                <span className="text-sm text-slate-300 block">Name</span>
                                <span className="text-sm text-white font-medium">{user?.firstName} {user?.lastName}</span>
                              </div>
                              {nameStatus.status === 'pending' ? (
                                <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-yellow-500/20 text-yellow-300 rounded-lg text-xs font-semibold border border-yellow-500/30">
                                  <Clock className="w-3 h-3" /> Pending Review
                                </span>
                              ) : nameStatus.status === 'none' ? (
                                <Button size="sm" variant="outline" className="hover:opacity-90" style={getClubButtonStyle('secondary')} disabled={!!submittingProfileChange}
                                  onClick={() => openChangeRequestDialog('name', 'Name', `${user?.firstName || ""} ${user?.lastName || ""}`.trim())}>
                                  {submittingProfileChange === "name" ? "Sending..." : "Request Change"}
                                </Button>
                              ) : null}
                            </div>
                            {nameStatus.status === 'pending' && nameStatus.request && (
                              <div className="text-xs text-yellow-300/70 bg-yellow-500/10 rounded px-2 py-1">
                                Requested: <span className="font-medium text-yellow-200">{nameStatus.request.requestedValue}</span>
                                <span className="text-slate-400 ml-1">({new Date(nameStatus.request.createdAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })})</span>
                              </div>
                            )}
                            {nameStatus.status === 'rejected' && nameStatus.request && (
                              <div className="text-xs bg-red-500/10 rounded px-2 py-1.5 border border-red-500/20">
                                <div className="flex items-center justify-between">
                                  <span className="text-red-300 font-semibold">Request Rejected</span>
                                  <button onClick={() => dismissRejectedRequest(nameStatus.request!.id)} className="text-slate-400 hover:text-white text-[0.65rem] underline">Dismiss</button>
                                </div>
                                {nameStatus.request.reviewNotes && (
                                  <p className="text-red-300/70 mt-0.5">Reason: {nameStatus.request.reviewNotes}</p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Email Field */}
                      {(() => {
                        const emailStatus = getFieldChangeStatus('email');
                        return (
                          <div className="p-3 bg-slate-700 rounded-lg space-y-2">
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                              <div>
                                <span className="text-sm text-slate-300 block">Email</span>
                                <span className="text-sm text-white font-medium">{user?.email}</span>
                              </div>
                              {emailStatus.status === 'pending' ? (
                                <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-yellow-500/20 text-yellow-300 rounded-lg text-xs font-semibold border border-yellow-500/30">
                                  <Clock className="w-3 h-3" /> Pending Review
                                </span>
                              ) : emailStatus.status === 'none' ? (
                                <Button size="sm" variant="outline" className="hover:opacity-90" style={getClubButtonStyle('secondary')} disabled={!!submittingProfileChange}
                                  onClick={() => openChangeRequestDialog('email', 'Email', user?.email || '')}>
                                  {submittingProfileChange === "email" ? "Sending..." : "Request Change"}
                                </Button>
                              ) : null}
                            </div>
                            {emailStatus.status === 'pending' && emailStatus.request && (
                              <div className="text-xs text-yellow-300/70 bg-yellow-500/10 rounded px-2 py-1">
                                Requested: <span className="font-medium text-yellow-200">{emailStatus.request.requestedValue}</span>
                                <span className="text-slate-400 ml-1">({new Date(emailStatus.request.createdAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })})</span>
                              </div>
                            )}
                            {emailStatus.status === 'rejected' && emailStatus.request && (
                              <div className="text-xs bg-red-500/10 rounded px-2 py-1.5 border border-red-500/20">
                                <div className="flex items-center justify-between">
                                  <span className="text-red-300 font-semibold">Request Rejected</span>
                                  <button onClick={() => dismissRejectedRequest(emailStatus.request!.id)} className="text-slate-400 hover:text-white text-[0.65rem] underline">Dismiss</button>
                                </div>
                                {emailStatus.request.reviewNotes && (
                                  <p className="text-red-300/70 mt-0.5">Reason: {emailStatus.request.reviewNotes}</p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Phone Field */}
                      {(() => {
                        const phoneStatus = getFieldChangeStatus('phone');
                        return (
                          <div className="p-3 bg-slate-700 rounded-lg space-y-2">
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                              <div>
                                <span className="text-sm text-slate-300 block">Phone</span>
                                <span className="text-sm text-white font-medium">{user?.phone}</span>
                              </div>
                              {phoneStatus.status === 'pending' ? (
                                <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-yellow-500/20 text-yellow-300 rounded-lg text-xs font-semibold border border-yellow-500/30">
                                  <Clock className="w-3 h-3" /> Pending Review
                                </span>
                              ) : phoneStatus.status === 'none' ? (
                                <Button size="sm" variant="outline" className="hover:opacity-90" style={getClubButtonStyle('secondary')} disabled={!!submittingProfileChange}
                                  onClick={() => openChangeRequestDialog('phone', 'Phone', (user as any)?.phone || '')}>
                                  {submittingProfileChange === "phone" ? "Sending..." : "Request Change"}
                                </Button>
                              ) : null}
                            </div>
                            {phoneStatus.status === 'pending' && phoneStatus.request && (
                              <div className="text-xs text-yellow-300/70 bg-yellow-500/10 rounded px-2 py-1">
                                Requested: <span className="font-medium text-yellow-200">{phoneStatus.request.requestedValue}</span>
                                <span className="text-slate-400 ml-1">({new Date(phoneStatus.request.createdAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })})</span>
                              </div>
                            )}
                            {phoneStatus.status === 'rejected' && phoneStatus.request && (
                              <div className="text-xs bg-red-500/10 rounded px-2 py-1.5 border border-red-500/20">
                                <div className="flex items-center justify-between">
                                  <span className="text-red-300 font-semibold">Request Rejected</span>
                                  <button onClick={() => dismissRejectedRequest(phoneStatus.request!.id)} className="text-slate-400 hover:text-white text-[0.65rem] underline">Dismiss</button>
                                </div>
                                {phoneStatus.request.reviewNotes && (
                                  <p className="text-red-300/70 mt-0.5">Reason: {phoneStatus.request.reviewNotes}</p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      <div className="flex justify-between items-center p-3 bg-slate-700 rounded-lg">
                        <span className="text-sm text-slate-300">
                          PAN Card Number
                        </span>
                        <span className="text-sm text-white font-medium font-mono">
                          {(user as any)?.panCard || (user as any)?.pan_card_number || "Not provided"}
                        </span>
                      </div>

                      {(user as any)?.playerId && (
                        <div className="flex justify-between items-center p-3 bg-slate-700 rounded-lg">
                          <span className="text-sm text-slate-300">
                            Player ID / Nickname
                          </span>
                          <span className="text-sm text-white font-medium">
                            {(user as any)?.playerId}
                          </span>
                        </div>
                      )}

                      <div className="flex justify-between items-center p-3 bg-slate-700 rounded-lg">
                        <span className="text-sm text-slate-300">
                          Member Since
                        </span>
                        <span className="text-sm text-white font-medium">
                          {user?.created_at || user?.createdAt
                            ? new Date(user.created_at || user.createdAt).toLocaleDateString('en-IN', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              timeZone: 'Asia/Kolkata'
                            })
                            : "N/A"}
                        </span>
                      </div>

                      <div className="flex justify-between items-center p-3 bg-slate-700 rounded-lg">
                        <span className="text-sm text-slate-300">
                          KYC Status
                        </span>
                        <div className="flex items-center">
                          {user?.kycStatus === "approved" ? (
                            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                              Verified
                            </Badge>
                          ) : user?.kycStatus === "verified" ? (
                            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                              Verified
                            </Badge>
                          ) : user?.kycStatus === "pending" ? (
                            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">
                              Pending
                            </Badge>
                          ) : (
                            <Badge variant="destructive">Not Verified</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="pt-4 px-6 pb-2 text-xs text-slate-400 border-t border-slate-700">
                      <p className="mb-2">
                        <strong className="text-slate-300">Important:</strong> Your PAN Card number cannot be changed after submission for security and legal compliance.
                      </p>
                      <p>
                        Profile changes (Name, Email, Phone) are processed by club staff. Use the
                        per-field <strong>Request Change</strong> buttons above to submit
                        secure requests for updates.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Legal & Support Section */}
                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center">
                      <Shield className="w-5 h-5 mr-2 text-blue-500" />
                      Legal & Support
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-slate-700">
                      <Link href="/help" className="flex items-center justify-between p-4 hover:bg-slate-700/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <HelpCircle className="w-5 h-5 text-amber-500" />
                          <span className="text-sm font-medium text-white">Help & Support</span>
                        </div>
                        <ChevronLeft className="w-4 h-4 text-slate-500 rotate-180" />
                      </Link>

                      <Link href="/contact" className="flex items-center justify-between p-4 hover:bg-slate-700/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <Phone className="w-5 h-5 text-emerald-500" />
                          <span className="text-sm font-medium text-white">Contact Us</span>
                        </div>
                        <ChevronLeft className="w-4 h-4 text-slate-500 rotate-180" />
                      </Link>

                      <Link href="/privacy" className="flex items-center justify-between p-4 hover:bg-slate-700/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <Shield className="w-5 h-5 text-blue-500" />
                          <span className="text-sm font-medium text-white">Privacy Policy</span>
                        </div>
                        <ChevronLeft className="w-4 h-4 text-slate-500 rotate-180" />
                      </Link>
                    </div>
                  </CardContent>
                </Card>

                {/* Waitlist Status */}
                {waitlistData && waitlistData.entries && waitlistData.entries.length > 0 && (
                  <Card className="bg-slate-800 border-slate-700">
                    <CardHeader>
                      <CardTitle className="text-white flex items-center">
                        <Clock className="w-5 h-5 mr-2 text-amber-500" />
                        Current Waitlist Status
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {waitlistData.entries.map((entry: any, index: number) => (
                          <div key={entry.id} className="p-3 bg-slate-700 rounded-lg">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <p className="text-white font-medium">
                                  {entry.tableType?.replace(/_/g, ' ') || 'Any Table'}
                                </p>
                                <p className="text-sm text-slate-400">
                                  Position: #{index + 1}
                                </p>
                              </div>
                              <Badge className={
                                entry.status === 'PENDING'
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                  : entry.status === 'SEATED'
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                    : 'bg-slate-500/20 text-slate-300 border-slate-500/30'
                              }>
                                {entry.status}
                              </Badge>
                            </div>
                            {entry.partySize > 1 && (
                              <p className="text-sm text-slate-400">
                                Party Size: {entry.partySize}
                              </p>
                            )}
                            {entry.notes && (
                              <p className="text-sm text-slate-400 mt-1">
                                Note: {entry.notes}
                              </p>
                            )}
                            <p className="text-xs text-slate-500 mt-2">
                              Joined: {new Date(entry.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                            </p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* KYC Documents Management */}
                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <div className="flex items-center justify-between w-full">
                      <CardTitle className="text-white flex items-center">
                        <FileText className="w-5 h-5 mr-2 text-emerald-500" />
                        KYC Documents
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRefreshSection("profile-kyc")}
                        disabled={!!refreshingSection}
                        className="text-slate-300 hover:text-white hover:bg-slate-700"
                      >
                        {refreshingSection === "profile-kyc" ? (
                          <span className="animate-spin w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full inline-block" />
                        ) : (
                          <RotateCcw className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {kycLoading ? (
                      <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                          <Skeleton key={i} className="h-12 bg-slate-700" />
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {/* File type information */}
                        <div className="mb-4 p-3 bg-slate-700 rounded-lg">
                          <p className="text-xs text-slate-300 mb-1">
                            <strong>Supported file types:</strong> JPG, PNG, PDF
                            (max 5MB each)
                          </p>
                          <p className="text-xs text-slate-400">
                            Upload clear, high-quality images of your documents
                            for faster verification
                          </p>
                        </div>
                        {/* Debug: Show KYC documents count */}
                        <div className="text-xs text-slate-500 mb-2">
                          {kycDocuments
                            ? `Found ${kycDocuments.length} documents`
                            : "No documents found"}
                        </div>
                        {/* Govt ID */}
                        {(() => {
                          const govIdStatus = getFieldChangeStatus('government_id');
                          return (
                            <div className="p-3 bg-slate-700 rounded-lg space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3 flex-1">
                                  {getKycStatusIcon(getKycDocumentStatus("id"))}
                                  <div className="flex-1">
                                    <p className="text-sm font-medium text-white">Govt ID</p>
                                    <p className="text-xs text-slate-400 capitalize">{getKycDocumentStatus("id")}</p>
                                    {Array.isArray(kycDocuments) && kycDocuments.filter(d => d.documentType === "government_id" && d.fileUrl).length > 0 && (
                                      <p className="text-xs text-emerald-500 mt-1">
                                        {kycDocuments.filter(d => d.documentType === "government_id" && d.fileUrl)[0]?.fileName}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex flex-col items-stretch space-y-2">
                                  {Array.isArray(kycDocuments) && kycDocuments.filter(d => d.documentType === "government_id" && d.fileUrl).length > 0 && (
                                    <Button size="sm" variant="outline" className="text-xs border-slate-600 text-slate-400 hover:bg-slate-700 w-full"
                                      onClick={() => {
                                        const doc = kycDocuments.filter(d => d.documentType === "government_id" && d.fileUrl)[0];
                                        if (doc?.fileUrl) window.open(doc.fileUrl, "_blank");
                                      }}>
                                      <Eye className="w-3 h-3 mr-1" /> View Document
                                    </Button>
                                  )}
                                  {govIdStatus.status === 'pending' ? (
                                    <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-yellow-500/20 text-yellow-300 rounded-lg text-xs font-semibold border border-yellow-500/30">
                                      <Clock className="w-3 h-3" /> Pending Review
                                    </span>
                                  ) : (
                                    <Button size="sm" variant="outline"
                                      onClick={() => openChangeRequestDialog('government_id', 'Govt ID (Aadhaar)', 'existing document', true)}
                                      disabled={!!submittingProfileChange}
                                      className="border-amber-600 text-amber-400 hover:bg-amber-600/20 w-full">
                                      <AlertTriangle className="w-4 h-4 mr-1" /> Request Change
                                    </Button>
                                  )}
                                </div>
                              </div>
                              {govIdStatus.status === 'pending' && govIdStatus.request && (
                                <div className="text-xs text-yellow-300/70 bg-yellow-500/10 rounded px-2 py-1">
                                  New document submitted for review
                                  <span className="text-slate-400 ml-1">({new Date(govIdStatus.request.createdAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })})</span>
                                </div>
                              )}
                              {govIdStatus.status === 'rejected' && govIdStatus.request && (
                                <div className="text-xs bg-red-500/10 rounded px-2 py-1.5 border border-red-500/20">
                                  <div className="flex items-center justify-between">
                                    <span className="text-red-300 font-semibold">Document Change Rejected</span>
                                    <button onClick={() => dismissRejectedRequest(govIdStatus.request!.id)} className="text-slate-400 hover:text-white text-[0.65rem] underline">Dismiss</button>
                                  </div>
                                  {govIdStatus.request.reviewNotes && <p className="text-red-300/70 mt-0.5">Reason: {govIdStatus.request.reviewNotes}</p>}
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* PAN Card */}
                        {(() => {
                          const panStatus = getFieldChangeStatus('pan_card');
                          return (
                            <div className="p-3 bg-slate-700 rounded-lg space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3 flex-1">
                                  {getKycStatusIcon(getKycDocumentStatus("pan"))}
                                  <div className="flex-1">
                                    <p className="text-sm font-medium text-white">PAN Card</p>
                                    <p className="text-xs text-slate-400 capitalize">{getKycDocumentStatus("pan")}</p>
                                    {Array.isArray(kycDocuments) && kycDocuments.filter(d => d.documentType === "pan_card" && d.fileUrl).length > 0 && (
                                      <p className="text-xs text-emerald-500 mt-1">
                                        {kycDocuments.filter(d => d.documentType === "pan_card" && d.fileUrl)[0]?.fileName}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex flex-col items-stretch space-y-2">
                                  {Array.isArray(kycDocuments) && kycDocuments.filter(d => d.documentType === "pan_card" && d.fileUrl).length > 0 && (
                                    <Button size="sm" variant="outline" className="text-xs border-slate-600 text-slate-400 hover:bg-slate-700 w-full"
                                      onClick={() => {
                                        const doc = kycDocuments.filter(d => d.documentType === "pan_card" && d.fileUrl)[0];
                                        if (doc?.fileUrl) window.open(doc.fileUrl, "_blank");
                                      }}>
                                      <Eye className="w-3 h-3 mr-1" /> View Document
                                    </Button>
                                  )}
                                  {panStatus.status === 'pending' ? (
                                    <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-yellow-500/20 text-yellow-300 rounded-lg text-xs font-semibold border border-yellow-500/30">
                                      <Clock className="w-3 h-3" /> Pending Review
                                    </span>
                                  ) : (
                                    <Button size="sm" variant="outline"
                                      onClick={() => openChangeRequestDialog('pan_card', 'PAN Card', 'existing document', true)}
                                      disabled={!!submittingProfileChange}
                                      className="border-amber-600 text-amber-400 hover:bg-amber-600/20 w-full">
                                      <AlertTriangle className="w-4 h-4 mr-1" /> Request Change
                                    </Button>
                                  )}
                                </div>
                              </div>
                              {panStatus.status === 'pending' && panStatus.request && (
                                <div className="text-xs text-yellow-300/70 bg-yellow-500/10 rounded px-2 py-1">
                                  New document submitted for review
                                  <span className="text-slate-400 ml-1">({new Date(panStatus.request.createdAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })})</span>
                                </div>
                              )}
                              {panStatus.status === 'rejected' && panStatus.request && (
                                <div className="text-xs bg-red-500/10 rounded px-2 py-1.5 border border-red-500/20">
                                  <div className="flex items-center justify-between">
                                    <span className="text-red-300 font-semibold">Document Change Rejected</span>
                                    <button onClick={() => dismissRejectedRequest(panStatus.request!.id)} className="text-slate-400 hover:text-white text-[0.65rem] underline">Dismiss</button>
                                  </div>
                                  {panStatus.request.reviewNotes && <p className="text-red-300/70 mt-0.5">Reason: {panStatus.request.reviewNotes}</p>}
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Profile Photo Document */}
                        <div className="flex items-center justify-between p-3 bg-slate-700 rounded-lg">
                          <div className="flex items-center space-x-3 flex-1">
                            {getKycStatusIcon(getKycDocumentStatus("photo"))}
                            <div className="flex-1">
                              <p className="text-sm font-medium text-white">
                                Profile Photo
                              </p>
                              <p className="text-xs text-slate-400 capitalize">
                                {getKycDocumentStatus("photo")}
                              </p>
                              {Array.isArray(kycDocuments) &&
                                kycDocuments.filter(
                                  (d) =>
                                    d.documentType === "profile_photo" &&
                                    d.fileUrl
                                ).length > 0 && (
                                  <div className="flex items-center space-x-2 mt-1">
                                    <p className="text-xs text-emerald-500">
                                      {Array.isArray(kycDocuments)
                                        ? kycDocuments.filter(
                                          (d) =>
                                            d.documentType ===
                                            "profile_photo" && d.fileUrl
                                        )[0]?.fileName
                                        : ""}
                                    </p>
                                  </div>
                                )}
                            </div>
                          </div>
                          <div className="flex flex-col items-stretch space-y-2">
                            {/* View Document button */}
                            {Array.isArray(kycDocuments) &&
                              kycDocuments.filter(
                                (d) =>
                                  d.documentType === "profile_photo" &&
                                  d.fileUrl
                              ).length > 0 && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs border-slate-600 text-slate-400 hover:bg-slate-700 w-full"
                                  onClick={() => {
                                    const doc = Array.isArray(kycDocuments)
                                      ? kycDocuments.filter(
                                        (d) =>
                                          d.documentType ===
                                          "profile_photo" && d.fileUrl
                                      )[0]
                                      : null;
                                    if (doc && doc.fileUrl) {
                                      try {
                                        const documentUrl = doc.fileUrl;
                                        console.log(
                                          "Opening document:",
                                          documentUrl
                                        );
                                        window.open(documentUrl, "_blank");
                                      } catch (error) {
                                        console.error(
                                          "Error opening document:",
                                          error
                                        );
                                        toast({
                                          title: "Error",
                                          description:
                                            "Unable to open document",
                                          variant: "destructive",
                                        });
                                      }
                                    }
                                  }}
                                >
                                  <Eye className="w-3 h-3 mr-1" />
                                  View Document
                                </Button>
                              )}

                            {/* Upload/Reupload button - players can change their profile photo anytime */}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                document
                                  .getElementById("photo-document-upload")
                                  ?.click()
                              }
                              disabled={uploadKycDocumentMutation.isPending}
                              className="border-slate-600 hover:bg-slate-600 w-full"
                            >
                              <Upload className="w-4 h-4 mr-1" />
                              {Array.isArray(kycDocuments) &&
                                kycDocuments.filter(
                                  (d) =>
                                    d.documentType === "profile_photo" &&
                                    d.fileUrl
                                ).length > 0
                                ? "Change Photo"
                                : "Upload"}
                            </Button>
                          </div>
                        </div>
                        <input
                          id="photo-document-upload"
                          type="file"
                          accept=".jpg,.jpeg,.png,.pdf"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            console.log("File input changed for Photo:", {
                              file: file?.name,
                              hasFile: !!file,
                            });
                            if (file) {
                              handleKycDocumentUpload("profile_photo", file);
                              // Reset the input value to allow re-uploading same file
                              e.target.value = "";
                            }
                          }}
                        />

                        {/* Upload status */}
                        {uploadKycDocumentMutation.isPending && (
                          <div className="flex items-center space-x-2 p-3 bg-slate-700 rounded-lg">
                            <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-sm text-slate-300">
                              Uploading document...
                            </span>
                          </div>
                        )}

                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Transaction History */}
                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center">
                      <FileText className="w-5 h-5 mr-2 text-emerald-500" />
                      Transaction History
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <select
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        value={showTransactions || ""} // Use '' for initial empty value
                        onChange={(e) => {
                          setShowTransactions(e.target.value as any); // Cast to any to allow string values
                        }}
                      >
                        <option value="">Select action...</option>
                        <option value="last10">
                          View Last 10 Transactions
                        </option>
                      </select>

                      {/* Transaction List */}
                      {showTransactions && (
                        <div className="bg-slate-700 rounded-lg p-4">
                          {transactionsLoading ? (
                            <div className="flex items-center justify-center py-4">
                              <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                              <span className="ml-2 text-sm text-slate-300">
                                Loading transactions...
                              </span>
                            </div>
                          ) : Array.isArray(transactions) &&
                            transactions.length > 0 ? (
                            <div className="space-y-2">
                              <h4 className="text-sm font-medium text-white mb-3">
                                {showTransactions === "last10"
                                  ? "Last 10 Transactions"
                                  : "All Transactions"}
                              </h4>
                              <div className="max-h-80 overflow-y-auto space-y-2">
                                {(showTransactions === "last10"
                                  ? transactions.slice(0, 10)
                                  : transactions
                                ).map((transaction: any, index: number) => (
                                  <div
                                    key={index}
                                    className="flex justify-between items-center py-2 border-b border-slate-600 last:border-b-0"
                                  >
                                    <div>
                                      <p className="text-sm text-white">
                                        {transaction.type}
                                      </p>
                                      <p className="text-xs text-slate-400">
                                        {new Date(
                                          transaction.createdAt || transaction.created_at
                                        ).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}{" "}
                                        at{" "}
                                        {new Date(
                                          transaction.createdAt || transaction.created_at
                                        ).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}
                                      </p>
                                    </div>
                                    <div className="text-right">
                                      <p
                                        className={`text-sm font-medium ${getTransactionAmountColor(
                                          transaction.type
                                        )}`}
                                      >
                                        {getTransactionAmountPrefix(
                                          transaction.type
                                        )}
                                        ₹{Math.abs(transaction.amount)}
                                      </p>
                                      <p className="text-xs text-slate-400">
                                        {transaction.status}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              {showTransactions === "last10" &&
                                transactions.length > 10 && (
                                  <p className="text-xs text-slate-400 text-center mt-2">
                                    Showing 10 of {transactions.length}{" "}
                                    transactions
                                  </p>
                                )}
                            </div>
                          ) : (
                            <p className="text-sm text-slate-300 text-center">
                              No transactions found
                            </p>
                          )}
                        </div>
                      )}

                      {!showTransactions && (
                        <div className="bg-slate-700 rounded-lg p-4">
                          <p className="text-sm text-slate-300 text-center">
                            Select an option above to see your recent activity
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Mobile App Connection */}
                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center">
                      <svg
                        className="w-5 h-5 mr-2 text-emerald-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                        />
                      </svg>
                      Mobile App
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-center">
                      <div className="w-20 h-20 bg-slate-700 rounded-xl flex items-center justify-center mx-auto mb-4">
                        <svg
                          className="w-10 h-10 text-emerald-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                          />
                        </svg>
                      </div>
                      <p className="text-sm text-slate-300 mb-4">
                        Connect your mobile device for the best gaming
                        experience
                      </p>
                    </div>

                    {/* QR Code or App Links */}
                    <div className="space-y-3">
                      <div className="bg-slate-700 p-4 rounded-lg text-center">
                        <div className="w-32 h-32 bg-white rounded-lg mx-auto mb-3 flex items-center justify-center">
                          <span className="text-2xl">📱</span>
                        </div>
                        <p className="text-xs text-slate-400">
                          Scan QR code to download mobile app
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <button className="bg-slate-700 hover:bg-slate-600 p-3 rounded-lg transition-colors">
                          <div className="flex items-center justify-center space-x-2">
                            <svg
                              className="w-5 h-5 text-white"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                            >
                              <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                            </svg>
                            <span className="text-xs text-white">iOS</span>
                          </div>
                        </button>
                        <button className="bg-slate-700 hover:bg-slate-600 p-3 rounded-lg transition-colors">
                          <div className="flex items-center justify-center space-x-2">
                            <svg
                              className="w-5 h-5 text-white"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                            >
                              <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.198l2.807 1.626a1 1 0 010 1.73l-2.808 1.626L15.699 12l1.999-2.491zM5.864 2.658L16.802 8.99l-2.303 2.303-8.635-8.635z" />
                            </svg>
                            <span className="text-xs text-white">Android</span>
                          </div>
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Feedback Tab */}
            <TabsContent value="feedback" className="flex-1 overflow-y-auto">
              <div className="space-y-4 sm:space-y-6">
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRefreshSection("feedback")}
                    disabled={!!refreshingSection}
                    className="text-slate-300 border-slate-600 hover:bg-slate-700 hover:text-white"
                  >
                    {refreshingSection === "feedback" ? (
                      <span className="animate-spin w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full inline-block" />
                    ) : (
                      <RotateCcw className="w-4 h-4" />
                    )}
                    <span className="ml-2">Refresh</span>
                  </Button>
                </div>
                {/* Feedback to Management */}
                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <div className="flex items-center justify-between w-full">
                      <CardTitle className="text-white flex items-center">
                        <MessageCircle className="w-5 h-5 mr-2 text-emerald-500" />
                        Send Feedback to Management
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRefreshSection("feedback")}
                        disabled={!!refreshingSection}
                        className="text-slate-300 hover:text-white hover:bg-slate-700"
                      >
                        {refreshingSection === "feedback" ? (
                          <span className="animate-spin w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full inline-block" />
                        ) : (
                          <RotateCcw className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white">
                        Message
                      </label>
                      <textarea
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
                        rows={5}
                        value={feedbackMessage}
                        onChange={(e) => setFeedbackMessage(e.target.value)}
                        placeholder="Share your feedback, suggestions, or concerns with our management team..."
                        disabled={sendingFeedback}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white">
                        Rating <span className="text-slate-400 font-normal">(optional)</span>
                      </label>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setFeedbackRating(feedbackRating === star ? 0 : star)}
                            className="text-2xl transition-colors focus:outline-none"
                            disabled={sendingFeedback}
                          >
                            <span className={star <= feedbackRating ? 'text-yellow-400' : 'text-slate-600 hover:text-yellow-400/50'}>
                              ★
                            </span>
                          </button>
                        ))}
                        {feedbackRating > 0 && (
                          <span className="text-xs text-slate-400 ml-2">{feedbackRating}/5</span>
                        )}
                      </div>
                    </div>
                    <Button
                      className="w-full hover:opacity-90 text-white disabled:opacity-50"
                      style={getClubButtonStyle('primary')}
                      onClick={submitFeedback}
                      disabled={sendingFeedback || !feedbackMessage.trim()}
                    >
                      {sendingFeedback ? (
                        <div className="animate-spin w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full" />
                      ) : (
                        <Send className="w-4 h-4 mr-2" />
                      )}
                      {sendingFeedback ? "Sending..." : "Send Feedback"}
                    </Button>
                  </CardContent>
                </Card>

                {/* Previous Feedback History */}
                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <div className="flex items-center justify-between w-full">
                      <CardTitle className="text-white flex items-center">
                        <MessageCircle className="w-5 h-5 mr-2 text-emerald-400" />
                        Previous Feedback
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRefreshSection("feedback")}
                        disabled={!!refreshingSection}
                        className="text-slate-300 hover:text-white hover:bg-slate-700"
                      >
                        {refreshingSection === "feedback" ? (
                          <span className="animate-spin w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full inline-block" />
                        ) : (
                          <RotateCcw className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {feedbackHistoryLoading && (
                      <div className="space-y-2">
                        {[1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className="h-14 bg-slate-700/60 rounded-lg animate-pulse"
                          />
                        ))}
                      </div>
                    )}

                    {feedbackHistoryError && (
                      <div className="text-sm text-red-400">
                        Unable to load your previous feedback right now. Please
                        try again later.
                      </div>
                    )}

                    {!feedbackHistoryLoading &&
                      !feedbackHistoryError &&
                      (!feedbackHistory?.feedback ||
                        feedbackHistory.feedback.length === 0) && (
                        <div className="text-sm text-slate-400">
                          You haven&apos;t sent any feedback yet. Your previous
                          messages to management will appear here.
                        </div>
                      )}

                    {!feedbackHistoryLoading &&
                      !feedbackHistoryError &&
                      feedbackHistory?.feedback &&
                      feedbackHistory.feedback.length > 0 && (
                        <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                          {feedbackHistory.feedback.map((item) => (
                            <div
                              key={item.id}
                              className="p-3 bg-slate-700/60 rounded-lg border border-slate-600/60"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-slate-400">
                                  {new Date(
                                    item.created_at,
                                  ).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                                </span>
                                {item.rating != null && (
                                  <span className="text-xs text-yellow-400">
                                    {'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-slate-100 whitespace-pre-wrap">
                                {item.message}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                  </CardContent>
                </Card>

                {/* Guest Relations Support - Unified Chat System */}
                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader className="pb-4 border-b border-slate-700">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-emerald-500/20 rounded-full">
                          <MessageCircle className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                          <CardTitle className="text-white text-lg">
                            Guest Relations Support
                          </CardTitle>
                          <div className="flex items-center space-x-2 text-sm text-slate-400">
                            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                            <span>Unified Chat System Active</span>
                          </div>
                        </div>
                      </div>
                      <Button
                        onClick={() => setChatDialogOpen(true)}
                        className="hover:opacity-90"
                        style={getClubButtonStyle('primary')}
                        size="sm"
                      >
                        <MessageCircle className="w-4 h-4 mr-2" />
                        Open Chat
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-center py-8">
                      <MessageCircle className="w-12 h-12 mx-auto mb-4 text-emerald-400" />
                      <h3 className="text-lg font-semibold text-white mb-2">
                        Professional Support Available
                      </h3>
                      <p className="text-slate-400 mb-4">
                        Connect with our Guest Relations team for immediate
                        assistance with any questions or concerns.
                      </p>
                      <div className="text-emerald-400 text-sm font-medium">
                        <MessageCircle className="w-5 h-5 mr-2 inline" />
                        Real-time support available
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Notifications Tab */}
            <TabsContent
              value="notifications"
              className="space-y-4 sm:space-y-6 w-full max-w-full"
            >
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRefreshSection("notifications")}
                  disabled={!!refreshingSection}
                  className="text-slate-300 border-slate-600 hover:bg-slate-700 hover:text-white"
                >
                  {refreshingSection === "notifications" ? (
                    <span className="animate-spin w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full inline-block" />
                  ) : (
                    <RotateCcw className="w-4 h-4" />
                  )}
                  <span className="ml-2">Refresh</span>
                </Button>
              </div>
              <NotificationHistoryTab />
            </TabsContent>
          </div>
        </Tabs>

        {/* Full Chat Dialog that opens from "Open Chat" button */}
        <Dialog open={chatDialogOpen} onOpenChange={setChatDialogOpen}>
          <DialogContent
            forceMount
            className="w-[95vw] sm:max-w-2xl max-h-[85vh] sm:max-h-[80vh] bg-slate-800 border-slate-700 p-3 sm:p-6"
          >
            <DialogHeader className="pb-3 sm:pb-4">
              <DialogTitle className="text-white flex items-center text-base sm:text-lg">
                <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-emerald-400" />
                Guest Relations Support
              </DialogTitle>
            </DialogHeader>

            {/* Chat System Integration - Direct PostgreSQL connection to Staff Portal */}
            {user?.id && (
              <PlayerChatSystem
                playerId={user.id}
                playerName={
                  `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
                  user?.email ||
                  "Player"
                }
                isInDialog={true}
                clubBranding={clubBranding}
                onClose={() => setChatDialogOpen(false)}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Tournament Details Dialog */}
        <Dialog
          open={tournamentDetailsOpen}
          onOpenChange={(open) => {
            setTournamentDetailsOpen(open);
            if (!open) {
              setSelectedTournament(null);
            }
          }}
        >
          <DialogContent className="w-[95vw] sm:max-w-lg max-h-[80vh] bg-slate-900 border-slate-700 p-5 sm:p-6">
            {selectedTournament && (
              <>
                <DialogHeader className="pb-3">
                  <DialogTitle className="text-white flex items-center text-base sm:text-lg">
                    <Trophy className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-yellow-500" />
                    {selectedTournament.name}
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-3 text-sm text-slate-200">
                  {selectedTournament.description && (
                    <p className="text-slate-300">
                      {selectedTournament.description}
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-slate-400">Start Time</p>
                      <p className="font-semibold">
                        {selectedTournament.startDate
                          ? new Date(
                            selectedTournament.startDate
                          ).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
                          : "TBA"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Status</p>
                      <p className="font-semibold capitalize">
                        {selectedTournament.status || "upcoming"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Buy-in</p>
                      <p className="font-semibold text-yellow-400">
                        ₹
                        {Number(
                          selectedTournament.buyIn ||
                          selectedTournament.buy_in ||
                          0
                        ).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Prize Pool</p>
                      <p className="font-semibold text-yellow-400">
                        ₹
                        {Number(
                          selectedTournament.prizePool ||
                          selectedTournament.prize_pool ||
                          0
                        ).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Players</p>
                      <p className="font-semibold">
                        {(selectedTournament.registeredPlayers ??
                          selectedTournament.registered_players ??
                          0) || 0}
                        /
                        {selectedTournament.maxPlayers ||
                          selectedTournament.max_players ||
                          0}
                      </p>
                    </div>
                    {selectedTournament.structure && typeof selectedTournament.structure === 'object' && (
                      <>
                        <div>
                          <p className="text-xs text-slate-400">Type</p>
                          <p className="font-semibold">
                            {selectedTournament.structure.tournament_type || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Starting Chips</p>
                          <p className="font-semibold">
                            {selectedTournament.structure.starting_chips?.toLocaleString() || 'N/A'}
                          </p>
                        </div>
                        {selectedTournament.structure.entry_fee != null && (
                          <div>
                            <p className="text-xs text-slate-400">Entry Fee</p>
                            <p className="font-semibold">
                              ₹{Number(selectedTournament.structure.entry_fee).toLocaleString()}
                            </p>
                          </div>
                        )}
                        <div>
                          <p className="text-xs text-slate-400">Blind Levels</p>
                          <p className="font-semibold">
                            {selectedTournament.structure.minutes_per_level ? `${selectedTournament.structure.minutes_per_level} min` : 'N/A'}
                          </p>
                        </div>
                        {selectedTournament.structure.blind_structure && (
                          <div>
                            <p className="text-xs text-slate-400">Blind Structure</p>
                            <p className="font-semibold">
                              {selectedTournament.structure.blind_structure}
                            </p>
                          </div>
                        )}
                        {selectedTournament.structure.number_of_levels && (
                          <div>
                            <p className="text-xs text-slate-400">Number of Levels</p>
                            <p className="font-semibold">
                              {selectedTournament.structure.number_of_levels}
                            </p>
                          </div>
                        )}
                        {selectedTournament.structure.break_structure && (
                          <div>
                            <p className="text-xs text-slate-400">Break Structure</p>
                            <p className="font-semibold">
                              {selectedTournament.structure.break_structure}
                            </p>
                          </div>
                        )}
                        {selectedTournament.structure.break_duration && (
                          <div>
                            <p className="text-xs text-slate-400">Break Duration</p>
                            <p className="font-semibold">
                              {selectedTournament.structure.break_duration} min
                            </p>
                          </div>
                        )}
                        {selectedTournament.structure.late_registration && (
                          <div>
                            <p className="text-xs text-slate-400">Late Registration</p>
                            <p className="font-semibold">
                              {selectedTournament.structure.late_registration} min
                            </p>
                          </div>
                        )}
                        {selectedTournament.structure.payout_structure && (
                          <div>
                            <p className="text-xs text-slate-400">Payout Structure</p>
                            <p className="font-semibold">
                              {selectedTournament.structure.payout_structure}
                            </p>
                          </div>
                        )}
                        {selectedTournament.structure.seat_draw_method && (
                          <div>
                            <p className="text-xs text-slate-400">Seat Draw</p>
                            <p className="font-semibold">
                              {selectedTournament.structure.seat_draw_method}
                            </p>
                          </div>
                        )}
                        <div>
                          <p className="text-xs text-slate-400">Rebuys</p>
                          <p className="font-semibold">
                            {selectedTournament.structure.allow_rebuys ? 'Yes' : 'No'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Re-entry</p>
                          <p className="font-semibold">
                            {selectedTournament.structure.allow_reentry ? 'Yes' : 'No'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Add-on</p>
                          <p className="font-semibold">
                            {selectedTournament.structure.allow_addon ? 'Yes' : 'No'}
                          </p>
                        </div>
                        {selectedTournament.structure.bounty_amount > 0 && (
                          <div>
                            <p className="text-xs text-slate-400">Bounty</p>
                            <p className="font-semibold">
                              ₹{Number(selectedTournament.structure.bounty_amount).toLocaleString()}
                            </p>
                          </div>
                        )}
                      </>
                    )}
                    {selectedTournament.structure && typeof selectedTournament.structure === 'string' && (
                      <div className="col-span-2">
                        <p className="text-xs text-slate-400">Structure</p>
                        <p className="font-semibold">
                          {selectedTournament.structure}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Tournament Session Dialog - Live session view for registered players */}
        <Dialog
          open={tournamentSessionOpen}
          onOpenChange={(open) => {
            setTournamentSessionOpen(open);
            if (!open) setSessionTournament(null);
          }}
        >
          <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] bg-slate-900 border-slate-700 p-0 overflow-y-auto">
            {sessionTournament && <TournamentSessionContent tournament={sessionTournament} user={user} queryClient={queryClient} />}
          </DialogContent>
        </Dialog>

        {/* TableView Dialog - 3D Hologram Table View */}
        <Dialog
          open={tableViewDialogOpen}
          onOpenChange={setTableViewDialogOpen}
        >
          <DialogContent className="table-view-dialog fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 max-w-[98vw] sm:max-w-[95vw] md:max-w-[90vw] lg:max-w-[85vw] w-full max-h-[98vh] sm:max-h-[95vh] h-[98vh] sm:h-auto p-0 sm:p-2 bg-slate-900 border-slate-700 overflow-hidden flex flex-col">
            {selectedTableViewTableId && (
              <div className="flex-1 min-h-0 overflow-auto overflow-x-hidden">
                <TableView
                  tableId={selectedTableViewTableId}
                  clubBranding={clubBranding}
                  onNavigate={setLocation}
                  onClose={() => setTableViewDialogOpen(false)}
                />
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Live Session Tracking removed - already in Session tab */}

        {/* Change Request Popup Dialog */}
        <Dialog open={changeRequestDialog.open} onOpenChange={(open) => setChangeRequestDialog(prev => ({ ...prev, open }))}>
          <DialogContent className="max-w-md bg-slate-800 border-slate-700 text-white">
            <DialogHeader>
              <DialogTitle className="text-white text-lg flex items-center">
                <Edit3 className="w-5 h-5 mr-2 text-blue-400" />
                Request {changeRequestDialog.fieldLabel} Change
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {changeRequestDialog.currentValue && !changeRequestDialog.isDocument && (
                <div className="p-3 bg-slate-700/50 rounded-lg">
                  <p className="text-xs text-slate-400 mb-1">Current {changeRequestDialog.fieldLabel}</p>
                  <p className="text-sm text-white font-medium">{changeRequestDialog.currentValue}</p>
                </div>
              )}

              {changeRequestDialog.isDocument ? (
                <div className="space-y-3">
                  <p className="text-sm text-slate-300">Upload the new {changeRequestDialog.fieldLabel} document</p>
                  <div className="border-2 border-dashed border-slate-600 rounded-lg p-4 text-center">
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        if (file && file.size > 5 * 1024 * 1024) {
                          toast({ title: "File too large", description: "Max file size is 5MB", variant: "destructive" });
                          return;
                        }
                        setChangeRequestFile(file);
                      }}
                      className="block w-full text-sm text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer"
                    />
                    {changeRequestFile && (
                      <p className="text-xs text-emerald-400 mt-2 flex items-center justify-center gap-1">
                        <CheckCircle className="w-3 h-3" /> {changeRequestFile.name}
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">Supported: JPG, PNG, PDF (max 5MB)</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-sm text-slate-300 block">
                    New {changeRequestDialog.fieldLabel}
                  </label>
                  <Input
                    type={changeRequestDialog.fieldName === 'email' ? 'email' : changeRequestDialog.fieldName === 'phone' ? 'tel' : 'text'}
                    value={changeRequestValue}
                    onChange={(e) => setChangeRequestValue(e.target.value)}
                    placeholder={`Enter new ${changeRequestDialog.fieldLabel.toLowerCase()}`}
                    className="bg-slate-700 border-slate-600 text-white placeholder-slate-500 h-11"
                    autoFocus
                  />
                </div>
              )}
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setChangeRequestDialog(prev => ({ ...prev, open: false }))}
                className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </Button>
              <Button
                onClick={handleChangeRequestSubmit}
                disabled={!!submittingProfileChange || uploadingChangeDoc || (changeRequestDialog.isDocument ? !changeRequestFile : !changeRequestValue.trim())}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50"
              >
                {submittingProfileChange || uploadingChangeDoc ? "Submitting..." : "Submit Request"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div >
    </div >
  );
}

export default PlayerDashboard;
