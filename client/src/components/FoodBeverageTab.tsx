import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { io, Socket } from 'socket.io-client';
import { API_BASE_URL, STORAGE_KEYS } from '@/lib/api/config';
import type { ClubBranding } from "@/lib/clubBranding";
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
  Image as ImageIcon,
  AlertCircle
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
  cancellationReason?: string | null;
  rejectionReason?: string | null;
}

interface FoodBeverageTabProps {
  user: any;
  clubBranding?: ClubBranding | null;
}

export default function FoodBeverageTab({ user, clubBranding }: FoodBeverageTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  
  // Order state
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [showOrderDialog, setShowOrderDialog] = useState(false);
  const [orderNotes, setOrderNotes] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [showThankYouDialog, setShowThankYouDialog] = useState(false);
  const [viewMode, setViewMode] = useState<'menu' | 'orders'>('menu');

  // Real-time updates via WebSocket
  useEffect(() => {
    const clubId = localStorage.getItem('clubId') || sessionStorage.getItem('clubId');
    
    if (!clubId || !user?.id) return;

    const websocketBase =
      import.meta.env.VITE_WEBSOCKET_URL ||
      (API_BASE_URL.endsWith('/api')
        ? API_BASE_URL.slice(0, -4)
        : API_BASE_URL.replace(/\/$/, ''));

    const socket = io(`${websocketBase}/realtime`, {
      auth: { clubId, playerId: user.id },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('subscribe:player', { playerId: user.id, clubId });
      socket.emit('subscribe:club', { clubId, playerId: user.id });
    });

    // Listen for menu updates
    socket.on('menu-updated', () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/player/fnb/menu'] });
    });
    
    // Listen for ads updates
    socket.on('ads-updated', () => {
      queryClient.invalidateQueries({ queryKey: ['/api/food-beverage/ads'] });
    });

    // Listen for order status updates
    socket.on('order-status-updated', (data: any) => {
      if (data.playerId === user.id) {
        queryClient.invalidateQueries({ queryKey: ['/api/auth/player/fnb/orders'] });
        toast({
          title: "Order Update",
          description: `Your order #${data.orderNumber} is now ${data.status}`,
        });
      }
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [queryClient, user?.id]);

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
      <div className="space-y-4 sm:space-y-6">
        <div className="text-center py-6 sm:py-8">
          <UtensilsCrossed className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 animate-pulse" style={{ color: clubBranding?.skinColor || '#10b981' }} />
          <p className="text-white text-sm sm:text-base">Loading menu...</p>
        </div>
      </div>
    );
  }

  // Helper function to get club-branded button styles
  const getClubButtonStyle = (variant: 'primary' | 'secondary' = 'primary') => {
    if (!clubBranding) return {};
    if (variant === 'primary') {
      return { backgroundColor: clubBranding.skinColor };
    }
    return { borderColor: clubBranding.skinColor, color: clubBranding.skinColor };
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header with Cart and view toggle - Mobile Responsive */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div className="w-full sm:w-auto">
          <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center">
            <UtensilsCrossed className="w-5 h-5 sm:w-6 sm:h-6 mr-2" style={{ color: clubBranding?.skinColor || '#10b981' }} />
            Food & Beverage
          </h2>
          <p className="text-slate-400 text-sm sm:text-base mt-1">Order directly to your table</p>
        </div>
        <div className="flex items-center space-x-2 sm:space-x-3 w-full sm:w-auto">
          <div className="bg-slate-800 rounded-full p-1 flex flex-1 sm:flex-initial w-full sm:w-auto">
            <button
              className={`px-3 sm:px-4 py-2 sm:py-1.5 text-xs sm:text-sm rounded-full transition-all duration-200 min-h-[44px] sm:min-h-[36px] flex-1 sm:flex-initial font-medium ${
                viewMode === 'menu'
                  ? 'text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
              style={viewMode === 'menu' && clubBranding ? { 
                backgroundColor: clubBranding.skinColor,
                boxShadow: `0 2px 8px ${clubBranding.skinColor}40`
              } : undefined}
              onClick={() => setViewMode('menu')}
            >
              Menu
            </button>
            <button
              className={`px-3 sm:px-4 py-2 sm:py-1.5 text-xs sm:text-sm rounded-full transition-all duration-200 min-h-[44px] sm:min-h-[36px] flex-1 sm:flex-initial font-medium ${
                viewMode === 'orders'
                  ? 'text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
              style={viewMode === 'orders' && clubBranding ? { 
                backgroundColor: clubBranding.skinColor,
                boxShadow: `0 2px 8px ${clubBranding.skinColor}40`
              } : undefined}
              onClick={() => setViewMode('orders')}
            >
              My Orders
            </button>
          </div>
          {totalCartItems > 0 && (
            <Button 
              onClick={() => setShowOrderDialog(true)}
              className="hover:opacity-90 relative min-h-[44px] sm:min-h-[40px] text-xs sm:text-sm px-3 sm:px-4 font-medium shadow-md transition-all duration-200"
              style={getClubButtonStyle('primary')}
            >
              <ShoppingCart className="w-4 h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Cart</span>
              <Badge className="ml-1 sm:ml-2 text-white text-[10px] sm:text-xs px-1.5 sm:px-2 font-semibold" style={clubBranding ? { backgroundColor: clubBranding.skinColor, opacity: 0.9 } : { backgroundColor: '#065f46' }}>
                {totalCartItems}
              </Badge>
            </Button>
          )}
        </div>
      </div>

      {/* Menu view */}
      {viewMode === 'menu' && (
        <>
      {/* Menu Items Grid - Mobile Responsive */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        {items.map((item) => {
          const quantity = getItemQuantity(item.id);
          const price = parseFloat(item.price) || 0;
          const isFree = price === 0;
          
          return (
                <Card
                  key={item.id}
                  className="bg-slate-800 border-slate-700 hover:border-slate-600 transition-colors h-full flex flex-col"
                >
              <CardContent className="p-3 sm:p-4 lg:p-5 flex-1 flex flex-col">
                <div className="space-y-2 sm:space-y-3 flex-1 flex flex-col">
                  {/* Image - Mobile Responsive */}
                  <OptimizedImage 
                    src={item.image_url}
                    alt={item.name}
                    className="w-full h-36 sm:h-44 lg:h-48 rounded-lg object-cover"
                  />
                  
                  {/* Item Details */}
                  <div className="flex-1 flex flex-col">
                    <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="text-white font-semibold text-sm sm:text-base flex-1 min-w-0">
                            {item.name}
                          </h3>
                          <Badge
                            variant={
                              item.category === 'food' ? 'default' : 'secondary'
                            }
                            className="text-xs flex-shrink-0"
                          >
                        {item.category}
                      </Badge>
                    </div>
                        <p className="text-slate-400 text-xs sm:text-sm mt-1 line-clamp-2">
                          {item.description}
                        </p>
                    
                    {/* Price - Mobile Responsive */}
                    <div className="flex items-center justify-between mt-2 sm:mt-3">
                      <span className="font-bold text-base sm:text-lg" style={{ color: clubBranding?.skinColor || '#10b981' }}>
                        {isFree ? 'Free' : `₹${price.toFixed(2)}`}
                      </span>
                      
                      {/* Quantity Controls - Mobile Responsive */}
                      <div className="flex items-center space-x-1.5 sm:space-x-2">
                        {quantity > 0 && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-9 w-9 sm:h-10 sm:w-10 p-0 min-h-[36px] sm:min-h-[40px] border-2 hover:opacity-90 transition-all"
                              style={getClubButtonStyle('secondary')}
                              onClick={() => removeFromCart(item.id)}
                            >
                              <Minus className="w-4 h-4 sm:w-5 sm:h-5" />
                            </Button>
                            <Badge className="text-white px-3 sm:px-4 text-sm sm:text-base min-h-[36px] sm:min-h-[40px] flex items-center font-semibold shadow-sm" style={clubBranding ? { backgroundColor: clubBranding.skinColor } : { backgroundColor: '#059669' }}>
                              {quantity}
                            </Badge>
                          </>
                        )}
                        <Button
                          size="sm"
                          className="hover:opacity-90 h-9 sm:h-10 px-3 sm:px-4 text-xs sm:text-sm min-h-[36px] sm:min-h-[40px] font-medium shadow-md transition-all"
                          style={getClubButtonStyle('primary')}
                          onClick={() => addToCart(item)}
                        >
                          <Plus className="w-4 h-4 sm:w-5 sm:h-5 mr-1" />
                          <span className="hidden xs:inline">Add</span>
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

      {/* Empty State - Mobile Responsive */}
      {items.length === 0 && !itemsLoading && (
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-6 sm:p-8 text-center">
            <UtensilsCrossed className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 text-slate-500" />
                <h3 className="text-white text-base sm:text-lg font-semibold mb-2">
                  No Menu Items Available
                </h3>
                <p className="text-slate-400 text-sm sm:text-base">
                  The kitchen menu is currently being updated. Please check back
                  later.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Orders view - Mobile Responsive */}
      {viewMode === 'orders' && (
        <div className="space-y-3 sm:space-y-4">
          {ordersLoading && (
            <div className="text-center py-4 sm:py-6 text-slate-400 text-xs sm:text-sm">
              Loading your orders...
            </div>
          )}

          {!ordersLoading && orders.length === 0 && (
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-4 sm:p-6 text-center space-y-2">
                <UtensilsCrossed className="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-2 text-slate-500" />
                <h3 className="text-white font-semibold text-sm sm:text-base">
                  No orders placed yet
                </h3>
                <p className="text-slate-400 text-xs sm:text-sm">
                  Your food & beverage orders will appear here once you place
                  them.
                </p>
              </CardContent>
            </Card>
          )}

          {activeOrders.length > 0 && (
            <div className="space-y-2 sm:space-y-3">
              <h3 className="text-sm sm:text-base font-semibold" style={{ color: clubBranding?.skinColor || '#10b981' }}>
                Current Orders
              </h3>
              <div className="space-y-2 sm:space-y-3">
                {activeOrders.map((order) => (
                  <Card
                    key={order.id}
                    className="bg-slate-800 border-slate-700"
                  >
                    <CardContent className="p-3 sm:p-4 space-y-2">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-slate-400">
                            Order #{order.orderNumber}
                          </div>
                          <div className="text-xs sm:text-sm text-slate-300">
                            Table: {order.tableNumber || 'N/A'}
                          </div>
                        </div>
                        <Badge className="text-xs sm:text-sm flex-shrink-0">
                          {order.status.charAt(0).toUpperCase() +
                            order.status.slice(1)}
                        </Badge>
                      </div>
                      <div className="space-y-1 text-xs sm:text-sm text-slate-300">
                        {order.items.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex justify-between items-center gap-2"
                          >
                            <span className="flex-1 min-w-0 truncate">
                              {item.name} x{item.quantity}
                            </span>
                            <span className="flex-shrink-0">₹{(item.price * item.quantity).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pt-2 border-t border-slate-700 mt-2 text-xs sm:text-sm">
                        <span className="text-slate-400">
                          Placed:{' '}
                          {new Date(order.createdAt).toLocaleTimeString()}
                        </span>
                        <span className="font-semibold" style={{ color: clubBranding?.skinColor || '#10b981' }}>
                          {(() => {
                            const total = Number(order.totalAmount) || 0;
                            return `Total ₹${total.toFixed(2)}`;
                          })()}
                        </span>
                      </div>
                      {order.status === 'cancelled' && (order.cancellationReason || order.rejectionReason) && (
                        <div className="mt-2 p-2 bg-red-900/20 border border-red-700/30 rounded text-xs sm:text-sm">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                            <div>
                              <span className="text-red-300 font-semibold">Cancellation Reason: </span>
                              <span className="text-red-200">{order.cancellationReason || order.rejectionReason}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {pastOrders.length > 0 && (
            <div className="space-y-2 sm:space-y-3">
              <h3 className="text-sm sm:text-base font-semibold text-slate-300">
                Order History
              </h3>
              <div className="space-y-2 sm:space-y-3">
                {pastOrders.map((order) => (
                  <Card
                    key={order.id}
                    className="bg-slate-800 border-slate-700"
                  >
                    <CardContent className="p-3 sm:p-4 space-y-2 text-xs sm:text-sm">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-slate-400">
                            Order #{order.orderNumber}
                          </div>
                          <div className="text-xs text-slate-500">
                            {new Date(order.createdAt).toLocaleString()}
                          </div>
                        </div>
                        <Badge
                          className="text-white text-xs sm:text-sm flex-shrink-0"
                          style={
                            order.status === 'delivered'
                              ? clubBranding ? { backgroundColor: clubBranding.skinColor } : { backgroundColor: '#059669' }
                              : order.status === 'cancelled'
                              ? { backgroundColor: '#dc2626' }
                              : {}
                          }
                        >
                          {order.status.charAt(0).toUpperCase() +
                            order.status.slice(1)}
                        </Badge>
                      </div>
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 sm:gap-2 mt-1">
                        <span className="text-slate-300 flex-1 min-w-0 truncate">
                          {order.items.map((i) => i.name).join(', ')}
                        </span>
                        <span className="font-semibold flex-shrink-0" style={{ color: clubBranding?.skinColor || '#10b981' }}>
                          {(() => {
                            const total = Number(order.totalAmount) || 0;
                            return `₹${total.toFixed(2)}`;
                          })()}
                        </span>
                      </div>
                      {order.status === 'cancelled' && (order.cancellationReason || order.rejectionReason) && (
                        <div className="mt-2 p-2 bg-red-900/20 border border-red-700/30 rounded text-xs sm:text-sm">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                            <div>
                              <span className="text-red-300 font-semibold">Cancellation Reason: </span>
                              <span className="text-red-200">{order.cancellationReason || order.rejectionReason}</span>
                            </div>
                          </div>
                        </div>
                      )}
          </CardContent>
        </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Order Dialog - Mobile Responsive */}
      <Dialog open={showOrderDialog} onOpenChange={setShowOrderDialog}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md w-[95vw] sm:w-full max-h-[90vh] sm:max-h-[85vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center text-base sm:text-lg">
              <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 mr-2" style={{ color: clubBranding?.skinColor || '#10b981' }} />
              Review Order
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-3 sm:space-y-4">
            {/* Order Items */}
            <div className="space-y-2 max-h-[200px] sm:max-h-[300px] overflow-y-auto">
              {cart.map((item) => (
                <div key={item.itemId} className="flex justify-between items-center py-2 border-b border-slate-700 text-sm sm:text-base">
                  <div className="flex-1 min-w-0">
                    <span className="text-white block truncate">{item.name}</span>
                    <span className="text-slate-400 text-xs sm:text-sm">x{item.quantity}</span>
                  </div>
                  <span className="font-semibold ml-2 flex-shrink-0" style={{ color: clubBranding?.skinColor || '#10b981' }}>
                    ₹{(parseFloat(item.price) * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            
            {/* Total */}
            <div className="flex justify-between items-center text-base sm:text-lg font-bold border-t border-slate-700 pt-3">
              <span className="text-white">Total:</span>
              <span style={{ color: clubBranding?.skinColor || '#10b981' }}>₹{calculateTotal()}</span>
            </div>
            
            {/* Table Number */}
            <div className="space-y-2">
              <label className="text-xs sm:text-sm text-slate-300">Table Number (Optional)</label>
              <Input
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                placeholder="Enter your table number"
                className="bg-slate-700 border-slate-600 text-white h-10 sm:h-11 text-sm sm:text-base"
              />
            </div>
            
            {/* Notes */}
            <div className="space-y-2">
              <label className="text-xs sm:text-sm text-slate-300">Special Instructions (Optional)</label>
              <Textarea
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder="Any special requests or dietary restrictions..."
                className="bg-slate-700 border-slate-600 text-white text-sm sm:text-base"
                rows={3}
              />
            </div>
            
            {/* Place Order Button */}
            <Button
              onClick={handlePlaceOrder}
              disabled={placeOrderMutation.isPending}
              className="w-full hover:opacity-90 min-h-[48px] sm:min-h-[52px] text-sm sm:text-base font-semibold shadow-lg transition-all duration-200"
              style={getClubButtonStyle('primary')}
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

      {/* Thank You Dialog - Mobile Responsive */}
      <Dialog open={showThankYouDialog} onOpenChange={setShowThankYouDialog}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-sm w-[95vw] sm:w-full">
          <div className="text-center space-y-3 sm:space-y-4 p-2 sm:p-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full mx-auto flex items-center justify-center" style={clubBranding ? { backgroundColor: clubBranding.skinColor } : { backgroundColor: '#059669' }}>
              <CheckCircle2 className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-white mb-2">Order Placed!</h3>
              <p className="text-slate-300 text-sm sm:text-base px-2">
                Thank you for your order. The kitchen has been notified and will prepare your items shortly.
              </p>
            </div>
            <div className="flex items-center justify-center text-sm sm:text-base" style={{ color: clubBranding?.skinColor || '#10b981' }}>
              <Star className="w-4 h-4 mr-1" />
              <span>Estimated delivery: 15-20 minutes</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}