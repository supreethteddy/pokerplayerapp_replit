import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CarouselItem {
  id: string;
  offer_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  position: number;
  is_active: boolean;
  created_at: string;
  staff_offers: {
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

  // Fetch real staff offers directly from Supabase - production data only
  const { data: staffOffers, isLoading, error } = useQuery({
    queryKey: ['/api/staff-offers'],
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  // Transform real staff offers into carousel items - 100% live data
  const displayItems = (staffOffers as any[]) && (staffOffers as any[]).length > 0 ? 
    (staffOffers as any[]).map((offer: any, index: number) => ({
      id: `real-offer-${offer.id}`,
      offer_id: offer.id,
      media_url: offer.image_url || offer.image || `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDUwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI1MDAiIGhlaWdodD0iMzAwIiBmaWxsPSIjMkEyQTJBIi8+Cjx0ZXh0IHg9IjI1MCIgeT0iMTUwIiBmaWxsPSIjNzU3NTc1IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTYiPk5vIEltYWdlPC90ZXh0Pgo8L3N2Zz4=`,
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
    })) : [];

  // Auto-scroll functionality
  useEffect(() => {
    if (displayItems.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => {
        const nextIndex = (prevIndex + 1) % displayItems.length;
        console.log('🎠 [CAROUSEL] Auto-scroll:', prevIndex, '→', nextIndex);
        return nextIndex;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [displayItems.length]);

  if (isLoading) {
    return (
      <div className="flex space-x-4 overflow-hidden">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="min-w-[300px] bg-gradient-to-br from-gray-800 to-gray-900 animate-pulse">
            <CardContent className="p-0">
              <div className="w-full h-48 bg-gray-700 rounded-lg"></div>
              <div className="p-4">
                <div className="h-4 bg-gray-600 rounded mb-2"></div>
                <div className="h-3 bg-gray-600 rounded w-2/3"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    console.error('❌ [OFFERS CAROUSEL] Error loading offers:', error);
    return (
      <div className="text-center py-8">
        <p className="text-gray-400">Unable to load offers</p>
      </div>
    );
  }

  // Show message if no offers available (production requirement: no fallback data)
  if (!displayItems || displayItems.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-400">No offers available</p>
      </div>
    );
  }

  const nextSlide = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % displayItems.length);
  };

  const prevSlide = () => {
    setCurrentIndex((prevIndex) => (prevIndex - 1 + displayItems.length) % displayItems.length);
  };

  return (
    <div className="relative w-full">
      <div className="overflow-hidden rounded-lg">
        <div 
          className="flex transition-transform duration-300 ease-in-out"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {displayItems.map((item) => (
            <div key={item.id} className="w-full flex-shrink-0">
              <Card 
                className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 cursor-pointer hover:scale-105 transition-transform duration-200"
                onClick={() => onOfferClick(item.offer_id)}
              >
                <CardContent className="p-0">
                  <img
                    src={item.media_url}
                    alt={item.staff_offers.title}
                    className="w-full h-48 object-cover rounded-lg"
                    onError={(e) => {
                      e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDUwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI1MDAiIGhlaWdodD0iMzAwIiBmaWxsPSIjMkEyQTJBIi8+Cjx0ZXh0IHg9IjI1MCIgeT0iMTUwIiBmaWxsPSIjNzU3NTc1IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTYiPk5vIEltYWdlPC90ZXh0Pgo8L3N2Zz4=';
                    }}
                  />
                  <div className="p-4">
                    <h3 className="text-lg font-semibold text-white mb-2">
                      {item.staff_offers.title}
                    </h3>
                    <p className="text-gray-300 text-sm">
                      {item.staff_offers.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation buttons */}
      {displayItems.length > 1 && (
        <>
          <Button
            variant="outline"
            size="icon"
            className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/50 border-gray-600 hover:bg-black/70"
            onClick={prevSlide}
          >
            <ChevronLeft className="h-4 w-4 text-white" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/50 border-gray-600 hover:bg-black/70"
            onClick={nextSlide}
          >
            <ChevronRight className="h-4 w-4 text-white" />
          </Button>
        </>
      )}

      {/* Dots indicator */}
      {displayItems.length > 1 && (
        <div className="flex justify-center mt-4 space-x-2">
          {displayItems.map((_, index) => (
            <button
              key={index}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === currentIndex ? 'bg-blue-500' : 'bg-gray-600'
              }`}
              onClick={() => setCurrentIndex(index)}
            />
          ))}
        </div>
      )}
    </div>
  );
}