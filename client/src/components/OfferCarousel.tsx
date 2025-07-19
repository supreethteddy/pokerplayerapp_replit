import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { ChevronLeft, ChevronRight, Play, ExternalLink } from "lucide-react";

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

  // Fetch carousel items from staff portal
  const { data: carouselItems, isLoading, error } = useQuery<CarouselItem[]>({
    queryKey: ['/api/carousel-items'],
    refetchInterval: 30000, // Refresh every 30 seconds for staff updates
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  // Auto-scroll functionality
  useEffect(() => {
    if (!carouselItems || carouselItems.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => 
        prevIndex === carouselItems.length - 1 ? 0 : prevIndex + 1
      );
    }, 5000); // Change slide every 5 seconds

    return () => clearInterval(interval);
  }, [carouselItems]);

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
    if (!carouselItems) return;
    setCurrentIndex((prevIndex) => 
      prevIndex === carouselItems.length - 1 ? 0 : prevIndex + 1
    );
  };

  const prevSlide = () => {
    if (!carouselItems) return;
    setCurrentIndex((prevIndex) => 
      prevIndex === 0 ? carouselItems.length - 1 : prevIndex - 1
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

  if (error || !carouselItems || carouselItems.length === 0) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="p-6">
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <ExternalLink className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No Active Offers</h3>
            <p className="text-slate-400">
              Check back soon for exciting promotions and special offers from our team!
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentItem = carouselItems[currentIndex];

  return (
    <Card className="bg-slate-800 border-slate-700 overflow-hidden relative">
      <CardContent className="p-0">
        <div className="relative h-48 md:h-56">
          {/* Media Display */}
          <div className="absolute inset-0">
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

          {/* Content Overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
            <div className="flex justify-between items-end">
              <div className="flex-1">
                {currentItem.staff_offers && (
                  <>
                    <Badge 
                      variant="secondary" 
                      className="bg-emerald-600 text-white border-none mb-2"
                    >
                      {currentItem.staff_offers.offer_type}
                    </Badge>
                    <h3 className="text-white font-semibold text-lg mb-1">
                      {currentItem.staff_offers.title}
                    </h3>
                    <p className="text-slate-200 text-sm line-clamp-2">
                      {currentItem.staff_offers.description}
                    </p>
                  </>
                )}
              </div>
              <Button
                onClick={() => handleOfferClick(currentItem)}
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white ml-4"
              >
                View Offer
              </Button>
            </div>
          </div>

          {/* Navigation Controls */}
          {carouselItems.length > 1 && (
            <>
              <Button
                onClick={prevSlide}
                size="sm"
                variant="ghost"
                className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white border-none"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                onClick={nextSlide}
                size="sm"
                variant="ghost"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white border-none"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </>
          )}

          {/* Dots Indicator */}
          {carouselItems.length > 1 && (
            <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex space-x-1">
              {carouselItems.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`w-2 h-2 rounded-full transition-all duration-200 ${
                    index === currentIndex 
                      ? 'bg-white' 
                      : 'bg-white/50 hover:bg-white/75'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}