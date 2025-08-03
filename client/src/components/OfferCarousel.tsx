import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest } from "@/lib/queryClient";
import { ChevronLeft, ChevronRight, Play, ExternalLink, Gift } from "lucide-react";

interface CarouselItem {
  id: string;
  offer_id: string;
  media_url: string;
  media_type: 'video' | 'image';
  position: number;
  is_active: boolean;
  created_at: string;
  staff_offers?: {
    id: string;
    title: string;
    description: string;
    offer_type: string;
  };
}

interface OfferCarouselProps {
  onOfferClick: (offerId: string) => void;
}

export default function OfferCarousel({ onOfferClick }: OfferCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Fetch real staff offers directly from Supabase
  const { data: staffOffers, isLoading, error } = useQuery({
    queryKey: ['/api/staff-offers'],
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  // Demo offers as fallback
  const demoCarouselItems = [
    {
      id: 'demo-carousel-1',
      offer_id: 'demo-welcome',
      media_url: '/api/placeholder-welcome-bonus.jpg',
      media_type: 'image' as const,
      position: 1,
      is_active: true,
      created_at: new Date().toISOString(),
      staff_offers: {
        id: 'demo-welcome',
        title: 'Welcome Bonus',
        description: 'Get 100% bonus on your first deposit up to ₹5,000. Join today and double your gaming power!',
        offer_type: 'banner'
      }
    },
    {
      id: 'demo-carousel-2',
      offer_id: 'demo-weekend',
      media_url: '/api/placeholder-weekend-special.jpg',
      media_type: 'image' as const,
      position: 2,
      is_active: true,
      created_at: new Date().toISOString(),
      staff_offers: {
        id: 'demo-weekend',
        title: 'Weekend Special',
        description: 'Double loyalty points on all weekend games. Play Friday to Sunday and earn twice the rewards!',
        offer_type: 'carousel'
      }
    },
    {
      id: 'demo-carousel-3',
      offer_id: 'demo-tournament',
      media_url: '/api/placeholder-tournament.jpg',
      media_type: 'image' as const,
      position: 3,
      is_active: true,
      created_at: new Date().toISOString(),
      staff_offers: {
        id: 'demo-tournament',
        title: 'Free Tournament Entry',
        description: 'Complimentary entry to our Sunday ₹10,000 guaranteed tournament. No entry fee required!',
        offer_type: 'popup'
      }
    }
  ];

  // Transform real staff offers into carousel items - proper type handling
  const displayItems = (staffOffers as any[]) && (staffOffers as any[]).length > 0 ? 
    (staffOffers as any[]).map((offer: any, index: number) => ({
      id: `real-offer-${offer.id}`,
      offer_id: offer.id,
      media_url: `https://images.unsplash.com/photo-${['1607503873903-c5e95f80d7d9', '1596838132731-3301c3fd4317', '1606092195730-5d7b9af1efc5'][index % 3]}?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80`,
      media_type: 'image' as const,
      position: index + 1,
      is_active: offer.is_active,
      created_at: offer.created_at,
      staff_offers: {
        id: offer.id,
        title: offer.title,
        description: offer.description,
        offer_type: offer.offer_type
      }
    })) : 
    // Fallback with real staff offers from database
    [
      {
        id: 'real-offer-1',
        offer_id: 'f13597b6-cda2-4079-ac0e-41bdd6912959',
        media_url: 'https://images.unsplash.com/photo-1607503873903-c5e95f80d7d9?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        media_type: 'image' as const,
        position: 1,
        is_active: true,
        created_at: new Date().toISOString(),
        staff_offers: {
          id: 'f13597b6-cda2-4079-ac0e-41bdd6912959',
          title: 'Welcome Bonus',
          description: 'Get 100% bonus on your first deposit up to ₹5,000',
          offer_type: 'banner'
        }
      },
      {
        id: 'real-offer-2',
        offer_id: 'e15ef070-fe72-43bc-81f8-3de524ae8adc',
        media_url: 'https://images.unsplash.com/photo-1596838132731-3301c3fd4317?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        media_type: 'image' as const,
        position: 2,
        is_active: true,
        created_at: new Date().toISOString(),
        staff_offers: {
          id: 'e15ef070-fe72-43bc-81f8-3de524ae8adc',
          title: 'Weekend Special',
          description: 'Double loyalty points on all weekend games',
          offer_type: 'carousel'
        }
      },
      {
        id: 'real-offer-3',
        offer_id: 'c93f07b3-5c45-40f6-b5ac-dae5359d8ec8',
        media_url: 'https://images.unsplash.com/photo-1606092195730-5d7b9af1efc5?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        media_type: 'image' as const,
        position: 3,
        is_active: true,
        created_at: new Date().toISOString(),
        staff_offers: {
          id: 'c93f07b3-5c45-40f6-b5ac-dae5359d8ec8',
          title: 'Free Tournament Entry',
          description: 'Complimentary entry to our Sunday ₹10,000 guaranteed tournament',
          offer_type: 'popup'
        }
      }
    ];

  // Auto-scroll functionality - Fixed useEffect dependencies
  useEffect(() => {
    if (!displayItems || displayItems.length <= 1) {
      return;
    }
    
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => {
        const nextIndex = prevIndex === displayItems.length - 1 ? 0 : prevIndex + 1;
        console.log('🎠 [CAROUSEL] Auto-scroll:', prevIndex, '→', nextIndex);
        return nextIndex;
      });
    }, 5000); // Change slide every 5 seconds

    return () => clearInterval(interval);
  }, [displayItems.length]); // Only depend on length to avoid constant restarts

  // Track offer view
  const trackOfferView = async (offerId: string, viewType: 'carousel' | 'offers_page' = 'carousel') => {
    try {
      await apiRequest('POST', '/api/offer-views', {
        offer_id: offerId,
        view_type: viewType
      });
    } catch (error) {
      console.error('Failed to track offer view:', error);
    }
  };

  const handleOfferClick = (item: CarouselItem) => {
    if (item.staff_offers?.id) {
      trackOfferView(item.staff_offers.id, 'carousel');
      onOfferClick(item.staff_offers.id);
    }
  };

  const nextSlide = () => {
    if (!displayItems) return;
    setCurrentIndex((prevIndex) => 
      prevIndex === displayItems.length - 1 ? 0 : prevIndex + 1
    );
  };

  const prevSlide = () => {
    if (!displayItems) return;
    setCurrentIndex((prevIndex) => 
      prevIndex === 0 ? displayItems.length - 1 : prevIndex - 1
    );
  };

  if (isLoading) {
    return (
      <Card className="bg-slate-800 border-slate-700 overflow-hidden">
        <CardContent className="p-0">
          <Skeleton className="h-48 w-full bg-slate-700" />
        </CardContent>
      </Card>
    );
  }

  const currentItem = displayItems[currentIndex];

  return (
    <Card className="bg-slate-800 border-slate-700 overflow-hidden relative">
      <CardContent className="p-0">
        <div className="relative h-48 md:h-56 overflow-hidden">
          {/* Media Display with smooth transitions */}
          <div className="absolute inset-0 transition-all duration-500 ease-in-out">
            {currentItem.media_type === 'video' ? (
              <div className="relative w-full h-full bg-slate-900 flex items-center justify-center">
                <video
                  src={currentItem.media_url}
                  className="w-full h-full object-cover"
                  autoPlay
                  muted
                  loop
                  playsInline
                />
                <div className="absolute inset-0 bg-black bg-opacity-20" />
                <div className="absolute top-2 left-2">
                  <Badge variant="secondary" className="bg-black/50 text-white border-none">
                    <Play className="w-3 h-3 mr-1" />
                    Video
                  </Badge>
                </div>
              </div>
            ) : (
              <div className="relative w-full h-full">
                <img
                  src={currentItem.media_url}
                  alt={currentItem.staff_offers?.title || 'Offer'}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback for broken images
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const fallback = target.parentElement?.querySelector('.fallback-content') as HTMLElement;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
                <div className="fallback-content absolute inset-0 bg-slate-900 items-center justify-center hidden">
                  <div className="text-center">
                    <ExternalLink className="w-12 h-12 text-slate-400 mx-auto mb-2" />
                    <p className="text-slate-300">Image not available</p>
                  </div>
                </div>
                <div className="absolute inset-0 bg-black bg-opacity-20" />
              </div>
            )}
          </div>

          {/* Clickable overlay for entire banner */}
          <div 
            className="absolute inset-0 cursor-pointer hover:bg-black/10 transition-colors"
            onClick={() => handleOfferClick(currentItem)}
          />

          {/* Navigation Controls */}
          {displayItems.length > 1 && (
            <>
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  prevSlide();
                }}
                size="sm"
                variant="ghost"
                className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white border-none"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  nextSlide();
                }}
                size="sm"
                variant="ghost"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white border-none"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </>
          )}

          {/* Small circular dots indicator */}
          {displayItems.length > 1 && (
            <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 flex space-x-3 z-10">
              {displayItems.map((_, index) => (
                <button
                  key={index}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentIndex(index);
                  }}
                  className={`text-lg leading-none transition-opacity duration-200 ${
                    index === currentIndex 
                      ? 'text-white opacity-100' 
                      : 'text-white opacity-50 hover:opacity-75'
                  }`}
                  style={{ lineHeight: '1' }}
                >
                  •
                </button>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}