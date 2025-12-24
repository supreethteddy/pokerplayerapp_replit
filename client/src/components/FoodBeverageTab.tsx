import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import Pusher from 'pusher-js';
import { 
  ShoppingCart, 
  Plus, 
  Minus, 
  UtensilsCrossed,
  Coffee,
  ExternalLink,
  CheckCircle2,
  Clock,
  Star,
  Video,
  Image as ImageIcon
} from "lucide-react";

interface FoodBeverageItem {
  id: number;
  name: string;
  description: string;
  price: string;
  image_url?: string;
  category: string;
  is_available: boolean;
  display_order: number;
}

interface AdsOffer {
  id: number;
  title: string;
  description?: string;
  image_url?: string;
  video_url?: string;
  target_url?: string;
  ad_type: string;
  is_active: boolean;
  display_order: number;
}

interface OrderItem {
  itemId: number;
  name: string;
  price: string;
  quantity: number;
}

type FnbOrderStatus = 'pending' | 'processing' | 'ready' | 'delivered' | 'cancelled';

interface PlayerFnbOrder {
  id: string;
  orderNumber: string;
  tableNumber: string;
  items: { name: string; quantity: number; price: number }[];
  totalAmount: number;
  status: FnbOrderStatus;
  createdAt: string;
  updatedAt: string;
  statusHistory?: { status: FnbOrderStatus; timestamp: string; updatedBy: string }[] | null;
}

interface FoodBeverageTabProps {
  user: any;
}

export default function FoodBeverageTab({ user }: FoodBeverageTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Order state
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [showOrderDialog, setShowOrderDialog] = useState(false);
  const [orderNotes, setOrderNotes] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [showThankYouDialog, setShowThankYouDialog] = useState(false);
  const [viewMode, setViewMode] = useState<'menu' | 'orders'>('menu');

  // Real-time updates via Pusher
  useEffect(() => {
    if (!import.meta.env.VITE_PUSHER_KEY) return;

    const pusher = new Pusher(import.meta.env.VITE_PUSHER_KEY, {
      cluster: import.meta.env.VITE_PUSHER_CLUSTER || 'ap2',
      forceTLS: true
    });

    const channel = pusher.subscribe('food-beverage');
    
    // Listen for menu updates
    channel.bind('menu-updated', () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/player/fnb/menu'] });
    });
    
    // Listen for ads updates
    channel.bind('ads-updated', () => {
      queryClient.invalidateQueries({ queryKey: ['/api/food-beverage/ads'] });
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe('food-beverage');
      pusher.disconnect();
    };
  }, [queryClient]);

  // Fetch menu items with real-time updates (authenticated via apiRequest so x-club-id is sent)
  const { data: menuItems, isLoading: itemsLoading } = useQuery<{
    success?: boolean;
    menuItems?: FoodBeverageItem[];
    items?: FoodBeverageItem[];
  }>({
    queryKey: ["/api/auth/player/fnb/menu"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/auth/player/fnb/menu");
      return await response.json();
    },
    refetchInterval: 5000, // 5 second refresh
    refetchOnWindowFocus: true,
    staleTime: 0,
    retry: 3,
  });

  // NOTE: F&B ads API is not implemented yet on the backend.
  // We intentionally removed the ads polling to avoid 404 errors
  // while keeping the menu and ordering system fully functional.

  // Player FNB orders (current + history)
  const {
    data: ordersResponse,
    isLoading: ordersLoading,
  } = useQuery<{ success: boolean; orders: PlayerFnbOrder[] }>({
    queryKey: ['/api/auth/player/fnb/orders'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/auth/player/fnb/orders');
      return await response.json();
    },
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  // Place order mutation
  const placeOrderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      return apiRequest("POST", "/api/auth/player/fnb/order", orderData);
    },
    onSuccess: () => {
      setCart([]);
      setOrderNotes('');
      setTableNumber('');
      setShowOrderDialog(false);
      setShowThankYouDialog(true);
      
      toast({
        title: "Order Placed!",
        description: "Your order has been sent to the kitchen.",
      });

      // Auto-close thank you dialog after 3 seconds
      setTimeout(() => {
        setShowThankYouDialog(false);
      }, 3000);
    },
    onError: (error: any) => {
      toast({
        title: "Order Failed",
        description: error.message || "Failed to place order. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Add item to cart
  const addToCart = (item: FoodBeverageItem) => {
    setCart(prev => {
      const existingItem = prev.find(cartItem => cartItem.itemId === item.id);
      if (existingItem) {
        return prev.map(cartItem =>
          cartItem.itemId === item.id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        );
      } else {
        return [...prev, {
          itemId: item.id,
          name: item.name,
          price: item.price,
          quantity: 1
        }];
      }
    });
  };

  // Remove from cart
  const removeFromCart = (itemId: number) => {
    setCart(prev => {
      const existingItem = prev.find(cartItem => cartItem.itemId === itemId);
      if (existingItem && existingItem.quantity > 1) {
        return prev.map(cartItem =>
          cartItem.itemId === itemId
            ? { ...cartItem, quantity: cartItem.quantity - 1 }
            : cartItem
        );
      } else {
        return prev.filter(cartItem => cartItem.itemId !== itemId);
      }
    });
  };

  // Get item quantity in cart
  const getItemQuantity = (itemId: number) => {
    const item = cart.find(cartItem => cartItem.itemId === itemId);
    return item ? item.quantity : 0;
  };

  // Calculate total
  const calculateTotal = () => {
    return cart.reduce((total, item) => {
      const price = parseFloat(item.price) || 0;
      return total + (price * item.quantity);
    }, 0).toFixed(2);
  };

  // Handle place order
  const handlePlaceOrder = () => {
    // Check KYC status first
    const kycStatus = (user as any)?.kycStatus;
    if (kycStatus !== 'approved' && kycStatus !== 'verified') {
      toast({
        title: "KYC Verification Required",
        description: "Please complete your KYC verification before placing food orders. Go to Profile tab to submit your documents.",
        variant: "destructive"
      });
      return;
    }

    if (cart.length === 0) {
      toast({
        title: "Empty Cart",
        description: "Please add items to your cart before placing an order.",
        variant: "destructive"
      });
      return;
    }

    placeOrderMutation.mutate({
      playerId: user?.id,
      playerName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
      items: cart,
      totalAmount: calculateTotal(),
      notes: orderNotes.trim() || null,
      tableNumber: tableNumber.trim() || null
    });
  };

  // Handle ad click
  const handleAdClick = (ad: AdsOffer) => {
    if (ad.target_url) {
      window.open(ad.target_url, '_blank', 'noopener,noreferrer');
    }
  };

  // Optimized image component with lazy loading
  const OptimizedImage = ({ src, alt, className }: { src?: string; alt: string; className?: string }) => {
    if (!src) {
      return (
        <div className={`${className} bg-slate-700 flex items-center justify-center`}>
          <UtensilsCrossed className="w-8 h-8 text-slate-500" />
        </div>
      );
    }

    return (
      <img 
        src={src} 
        alt={alt}
        className={className}
        loading="lazy"
        style={{ maxWidth: '200px', objectFit: 'cover' }}
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
    );
  };

  const items = menuItems?.menuItems || menuItems?.items || [];
  const totalCartItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const orders: PlayerFnbOrder[] = ordersResponse?.orders || [];
  const activeOrders = orders.filter(
    (o) => o.status === 'pending' || o.status === 'processing' || o.status === 'ready',
  );
  const pastOrders = orders;

  if (itemsLoading && viewMode === 'menu') {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <UtensilsCrossed className="w-12 h-12 mx-auto mb-4 text-emerald-500 animate-pulse" />
          <p className="text-white">Loading menu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Cart and view toggle */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center">
            <UtensilsCrossed className="w-6 h-6 mr-2 text-emerald-500" />
            Food & Beverage
          </h2>
          <p className="text-slate-400">Order directly to your table</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="bg-slate-800 rounded-full p-1 flex">
            <button
              className={`px-3 py-1 text-xs rounded-full ${
                viewMode === 'menu'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-300'
              }`}
              onClick={() => setViewMode('menu')}
            >
              Menu
            </button>
            <button
              className={`px-3 py-1 text-xs rounded-full ${
                viewMode === 'orders'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-300'
              }`}
              onClick={() => setViewMode('orders')}
            >
              My Orders
            </button>
        </div>
        {totalCartItems > 0 && (
          <Button 
            onClick={() => setShowOrderDialog(true)}
            className="bg-emerald-600 hover:bg-emerald-700 relative"
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            Cart
              <Badge className="ml-2 bg-emerald-800 text-white">
                {totalCartItems}
              </Badge>
          </Button>
        )}
        </div>
      </div>

      {/* Menu view */}
      {viewMode === 'menu' && (
        <>
      {/* Menu Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((item) => {
          const quantity = getItemQuantity(item.id);
          const price = parseFloat(item.price) || 0;
          const isFree = price === 0;
          
          return (
                <Card
                  key={item.id}
                  className="bg-slate-800 border-slate-700 hover:border-slate-600 transition-colors"
                >
              <CardContent className="p-4">
                <div className="space-y-3">
                  {/* Image */}
                  <OptimizedImage 
                    src={item.image_url}
                    alt={item.name}
                    className="w-full h-40 rounded-lg object-cover"
                  />
                  
                  {/* Item Details */}
                  <div>
                    <div className="flex items-start justify-between">
                          <h3 className="text-white font-semibold">
                            {item.name}
                          </h3>
                          <Badge
                            variant={
                              item.category === 'food' ? 'default' : 'secondary'
                            }
                            className="text-xs"
                          >
                        {item.category}
                      </Badge>
                    </div>
                        <p className="text-slate-400 text-sm mt-1">
                          {item.description}
                        </p>
                    
                    {/* Price */}
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-emerald-400 font-bold text-lg">
                        {isFree ? 'Free' : `₹${price.toFixed(2)}`}
                      </span>
                      
                      {/* Quantity Controls */}
                      <div className="flex items-center space-x-2">
                        {quantity > 0 && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 w-8 p-0"
                              onClick={() => removeFromCart(item.id)}
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                            <Badge className="bg-emerald-600 text-white px-3">
                              {quantity}
                            </Badge>
                          </>
                        )}
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 h-8 px-3"
                          onClick={() => addToCart(item)}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Add
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Empty State */}
      {items.length === 0 && !itemsLoading && (
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-8 text-center">
            <UtensilsCrossed className="w-16 h-16 mx-auto mb-4 text-slate-500" />
                <h3 className="text-white text-lg font-semibold mb-2">
                  No Menu Items Available
                </h3>
                <p className="text-slate-400">
                  The kitchen menu is currently being updated. Please check back
                  later.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Orders view */}
      {viewMode === 'orders' && (
        <div className="space-y-4">
          {ordersLoading && (
            <div className="text-center py-6 text-slate-400 text-sm">
              Loading your orders...
            </div>
          )}

          {!ordersLoading && orders.length === 0 && (
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-6 text-center space-y-2">
                <UtensilsCrossed className="w-10 h-10 mx-auto mb-2 text-slate-500" />
                <h3 className="text-white font-semibold">
                  No orders placed yet
                </h3>
                <p className="text-slate-400 text-sm">
                  Your food & beverage orders will appear here once you place
                  them.
                </p>
              </CardContent>
            </Card>
          )}

          {activeOrders.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-emerald-300">
                Current Orders
              </h3>
              <div className="space-y-3">
                {activeOrders.map((order) => (
                  <Card
                    key={order.id}
                    className="bg-slate-800 border-slate-700"
                  >
                    <CardContent className="p-4 space-y-2">
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="text-xs text-slate-400">
                            Order #{order.orderNumber}
                          </div>
                          <div className="text-sm text-slate-300">
                            Table: {order.tableNumber || 'N/A'}
                          </div>
                        </div>
                        <Badge>
                          {order.status.charAt(0).toUpperCase() +
                            order.status.slice(1)}
                        </Badge>
                      </div>
                      <div className="space-y-1 text-sm text-slate-300">
                        {order.items.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex justify-between items-center"
                          >
                            <span>
                              {item.name} x{item.quantity}
                            </span>
                            <span>₹{(item.price * item.quantity).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-slate-700 mt-2 text-sm">
                        <span className="text-slate-400">
                          Placed:{' '}
                          {new Date(order.createdAt).toLocaleTimeString()}
                        </span>
                        <span className="text-emerald-400 font-semibold">
                          {(() => {
                            const total = Number(order.totalAmount) || 0;
                            return `Total ₹${total.toFixed(2)}`;
                          })()}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {pastOrders.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-300">
                Order History
              </h3>
              <div className="space-y-3">
                {pastOrders.map((order) => (
                  <Card
                    key={order.id}
                    className="bg-slate-800 border-slate-700"
                  >
                    <CardContent className="p-4 space-y-1 text-sm">
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="text-xs text-slate-400">
                            Order #{order.orderNumber}
                          </div>
                          <div className="text-xs text-slate-500">
                            {new Date(order.createdAt).toLocaleString()}
                          </div>
                        </div>
                        <Badge
                          className={
                            order.status === 'delivered'
                              ? 'bg-emerald-600 text-white'
                              : order.status === 'cancelled'
                              ? 'bg-red-600 text-white'
                              : ''
                          }
                        >
                          {order.status.charAt(0).toUpperCase() +
                            order.status.slice(1)}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-slate-300">
                          {order.items.map((i) => i.name).join(', ')}
                        </span>
                        <span className="text-emerald-400 font-semibold">
                          {(() => {
                            const total = Number(order.totalAmount) || 0;
                            return `₹${total.toFixed(2)}`;
                          })()}
                        </span>
                      </div>
          </CardContent>
        </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Order Dialog */}
      <Dialog open={showOrderDialog} onOpenChange={setShowOrderDialog}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <ShoppingCart className="w-5 h-5 mr-2 text-emerald-500" />
              Review Order
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Order Items */}
            <div className="space-y-2">
              {cart.map((item) => (
                <div key={item.itemId} className="flex justify-between items-center py-2 border-b border-slate-700">
                  <div>
                    <span className="text-white">{item.name}</span>
                    <span className="text-slate-400 ml-2">x{item.quantity}</span>
                  </div>
                  <span className="text-emerald-400 font-semibold">
                    ₹{(parseFloat(item.price) * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            
            {/* Total */}
            <div className="flex justify-between items-center text-lg font-bold border-t border-slate-700 pt-3">
              <span className="text-white">Total:</span>
              <span className="text-emerald-400">₹{calculateTotal()}</span>
            </div>
            
            {/* Table Number */}
            <div className="space-y-2">
              <label className="text-sm text-slate-300">Table Number (Optional)</label>
              <Input
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                placeholder="Enter your table number"
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
            
            {/* Notes */}
            <div className="space-y-2">
              <label className="text-sm text-slate-300">Special Instructions (Optional)</label>
              <Textarea
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder="Any special requests or dietary restrictions..."
                className="bg-slate-700 border-slate-600 text-white"
                rows={3}
              />
            </div>
            
            {/* Place Order Button */}
            <Button
              onClick={handlePlaceOrder}
              disabled={placeOrderMutation.isPending}
              className="w-full bg-emerald-600 hover:bg-emerald-700"
            >
              {placeOrderMutation.isPending ? (
                <>
                  <Clock className="w-4 h-4 mr-2 animate-spin" />
                  Placing Order...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Place Order
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Thank You Dialog */}
      <Dialog open={showThankYouDialog} onOpenChange={setShowThankYouDialog}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-sm">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-600 rounded-full mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white mb-2">Order Placed!</h3>
              <p className="text-slate-300">
                Thank you for your order. The kitchen has been notified and will prepare your items shortly.
              </p>
            </div>
            <div className="flex items-center justify-center text-emerald-400 text-sm">
              <Star className="w-4 h-4 mr-1" />
              <span>Estimated delivery: 15-20 minutes</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}