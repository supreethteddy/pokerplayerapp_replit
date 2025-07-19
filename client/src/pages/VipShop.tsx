import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Star, Gift, Trophy, Shirt, CreditCard, Crown, ShoppingCart, Package, Truck } from "lucide-react";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";

interface VipShopCategory {
  id: string;
  name: string;
  description: string;
  display_order: number;
}

interface VipShopItem {
  id: string;
  category_id: string;
  name: string;
  description: string;
  long_description: string;
  point_cost: number;
  image_url: string;
  is_available: boolean;
  stock_quantity: number;
  terms_conditions: string;
  redemption_instructions: string;
}

interface VipShopBanner {
  id: string;
  title: string;
  subtitle: string;
  image_url: string;
  link_url: string;
}

interface RedemptionRequest {
  item_id: string;
  delivery_address?: string;
  delivery_phone?: string;
  special_instructions?: string;
}

const getCategoryIcon = (categoryName: string) => {
  switch (categoryName.toLowerCase()) {
    case 'tournament tickets':
      return <Trophy className="w-5 h-5" />;
    case 'merchandise':
      return <Shirt className="w-5 h-5" />;
    case 'bonuses & credits':
      return <CreditCard className="w-5 h-5" />;
    case 'exclusive access':
      return <Crown className="w-5 h-5" />;
    default:
      return <Gift className="w-5 h-5" />;
  }
};

export default function VipShop() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedItem, setSelectedItem] = useState<VipShopItem | null>(null);
  const [redemptionForm, setRedemptionForm] = useState<RedemptionRequest>({
    item_id: "",
    delivery_address: "",
    delivery_phone: "",
    special_instructions: ""
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch user's current points (from existing user data)
  const { data: user } = useQuery({
    queryKey: ["/api/player/profile"],
    staleTime: 30000,
  });

  // Calculate user's VIP points (10 points per game + 5 points per hour)
  const userPoints = user ? (user.gamesPlayed * 10) + (Math.floor(parseFloat(user.hoursPlayed)) * 5) : 0;

  // Fetch VIP shop data
  const { data: categories } = useQuery<VipShopCategory[]>({
    queryKey: ["/api/vip-shop/categories"],
    staleTime: 300000, // 5 minutes
  });

  const { data: items } = useQuery<VipShopItem[]>({
    queryKey: ["/api/vip-shop/items"],
    staleTime: 300000,
  });

  const { data: banners } = useQuery<VipShopBanner[]>({
    queryKey: ["/api/vip-shop/banners"],
    staleTime: 300000,
  });

  const { data: shopSettings } = useQuery({
    queryKey: ["/api/vip-shop/settings"],
    staleTime: 300000,
  });

  // Redemption mutation
  const redeemItemMutation = useMutation({
    mutationFn: (data: RedemptionRequest) => 
      apiRequest("POST", "/api/vip-shop/redeem", data),
    onSuccess: () => {
      toast({
        title: "Redemption Successful!",
        description: "Your item has been redeemed. Check your redemptions for updates.",
      });
      setSelectedItem(null);
      setRedemptionForm({
        item_id: "",
        delivery_address: "",
        delivery_phone: "",
        special_instructions: ""
      });
      queryClient.invalidateQueries({ queryKey: ["/api/vip-shop/redemptions"] });
    },
    onError: (error: any) => {
      toast({
        title: "Redemption Failed",
        description: error.message || "Unable to process redemption. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Filter items by category
  const filteredItems = items?.filter(item => 
    selectedCategory === "all" || item.category_id === selectedCategory
  ) || [];

  const handleRedemption = (item: VipShopItem) => {
    if (userPoints < item.point_cost) {
      toast({
        title: "Insufficient Points",
        description: `You need ${item.point_cost} points but only have ${userPoints} points.`,
        variant: "destructive",
      });
      return;
    }

    setSelectedItem(item);
    setRedemptionForm(prev => ({ ...prev, item_id: item.id }));
  };

  const submitRedemption = () => {
    if (!selectedItem) return;
    
    redeemItemMutation.mutate(redemptionForm);
  };

  const welcomeMessage = shopSettings?.find((s: any) => s.setting_key === 'shop_welcome_message')?.setting_value || 
    "Welcome to the VIP Shop! Redeem your loyalty points for exclusive rewards.";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="bg-slate-800/50 border-b border-slate-700">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
              <div className="flex items-center space-x-2">
                <Crown className="w-6 h-6 text-yellow-500" />
                <h1 className="text-2xl font-bold text-white">VIP Shop</h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="bg-gradient-to-r from-yellow-600 to-yellow-500 px-4 py-2 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Star className="w-5 h-5 text-white" />
                  <span className="text-white font-semibold">{userPoints.toLocaleString()} Points</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Welcome Banner */}
        <div className="mb-8">
          <Card className="bg-gradient-to-r from-purple-600 to-blue-600 border-none text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold mb-2">VIP Rewards Program</h2>
                  <p className="text-purple-100 mb-4">{welcomeMessage}</p>
                  <div className="flex items-center space-x-6 text-sm">
                    <div className="flex items-center space-x-2">
                      <Trophy className="w-4 h-4" />
                      <span>10 points per game</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Package className="w-4 h-4" />
                      <span>5 points per hour</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Truck className="w-4 h-4" />
                      <span>Free delivery on all items</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold">{userPoints.toLocaleString()}</div>
                  <div className="text-purple-200">Available Points</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Active Banners */}
        {banners && banners.length > 0 && (
          <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {banners.map((banner) => (
              <Card key={banner.id} className="bg-slate-800 border-slate-700 overflow-hidden">
                {banner.image_url && (
                  <div className="h-32 bg-cover bg-center" style={{ backgroundImage: `url(${banner.image_url})` }} />
                )}
                <CardContent className="p-4">
                  <h3 className="text-white font-semibold">{banner.title}</h3>
                  <p className="text-slate-400 text-sm">{banner.subtitle}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Category Tabs */}
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="space-y-6">
          <TabsList className="bg-slate-800 border-slate-700">
            <TabsTrigger value="all" className="data-[state=active]:bg-slate-700">
              <Gift className="w-4 h-4 mr-2" />
              All Items
            </TabsTrigger>
            {categories?.map((category) => (
              <TabsTrigger key={category.id} value={category.id} className="data-[state=active]:bg-slate-700">
                {getCategoryIcon(category.name)}
                <span className="ml-2 hidden sm:inline">{category.name}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={selectedCategory} className="space-y-6">
            {filteredItems.length === 0 ? (
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="p-8 text-center">
                  <Gift className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">No Items Available</h3>
                  <p className="text-slate-400">Check back soon for new VIP rewards!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredItems.map((item) => (
                  <Card key={item.id} className="bg-slate-800 border-slate-700 overflow-hidden hover:border-slate-600 transition-colors">
                    {item.image_url && (
                      <div className="h-48 bg-cover bg-center" style={{ backgroundImage: `url(${item.image_url})` }} />
                    )}
                    <CardHeader className="pb-4">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-white text-lg">{item.name}</CardTitle>
                        <Badge variant="secondary" className="bg-yellow-600 text-white">
                          {item.point_cost.toLocaleString()} pts
                        </Badge>
                      </div>
                      <p className="text-slate-400 text-sm">{item.description}</p>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-3">
                        {item.stock_quantity !== null && (
                          <div className="text-xs text-slate-500">
                            {item.stock_quantity > 0 ? `${item.stock_quantity} available` : 'Out of stock'}
                          </div>
                        )}
                        <Button 
                          onClick={() => handleRedemption(item)}
                          disabled={!item.is_available || (item.stock_quantity !== null && item.stock_quantity <= 0) || userPoints < item.point_cost}
                          className="w-full bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-700 hover:to-yellow-600 text-white"
                        >
                          <ShoppingCart className="w-4 h-4 mr-2" />
                          {userPoints < item.point_cost ? 'Insufficient Points' : 'Redeem Item'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Redemption Dialog */}
      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <ShoppingCart className="w-5 h-5 text-yellow-500" />
              <span>Redeem Item</span>
            </DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="font-semibold">{selectedItem.name}</h3>
                <p className="text-slate-400 text-sm">{selectedItem.long_description}</p>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-yellow-500 font-semibold">{selectedItem.point_cost.toLocaleString()} Points</span>
                  <span className="text-sm text-slate-400">You have: {userPoints.toLocaleString()} points</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="delivery_address">Delivery Address (if applicable)</Label>
                  <Textarea
                    id="delivery_address"
                    placeholder="Enter your complete delivery address..."
                    value={redemptionForm.delivery_address}
                    onChange={(e) => setRedemptionForm(prev => ({ ...prev, delivery_address: e.target.value }))}
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="delivery_phone">Contact Phone</Label>
                  <Input
                    id="delivery_phone"
                    placeholder="Your phone number"
                    value={redemptionForm.delivery_phone}
                    onChange={(e) => setRedemptionForm(prev => ({ ...prev, delivery_phone: e.target.value }))}
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="special_instructions">Special Instructions</Label>
                  <Textarea
                    id="special_instructions"
                    placeholder="Any special requests or instructions..."
                    value={redemptionForm.special_instructions}
                    onChange={(e) => setRedemptionForm(prev => ({ ...prev, special_instructions: e.target.value }))}
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>
              </div>

              {selectedItem.terms_conditions && (
                <div className="p-3 bg-slate-700 rounded-lg">
                  <h4 className="font-medium text-sm mb-2">Terms & Conditions</h4>
                  <p className="text-xs text-slate-400">{selectedItem.terms_conditions}</p>
                </div>
              )}

              <div className="flex space-x-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setSelectedItem(null)}
                  className="flex-1 border-slate-600 text-white hover:bg-slate-700"
                >
                  Cancel
                </Button>
                <Button
                  onClick={submitRedemption}
                  disabled={redeemItemMutation.isPending}
                  className="flex-1 bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-700 hover:to-yellow-600 text-white"
                >
                  {redeemItemMutation.isPending ? 'Processing...' : 'Confirm Redemption'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}