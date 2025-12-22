import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Gift } from 'lucide-react';
import { useRealtimeOffers } from '@/hooks/useRealtimeOffers';

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

  // Enable real-time offers via Supabase Realtime
  useRealtimeOffers();

  // Fetch staff offers (now updated automatically via Realtime)
  const { data: offers, isLoading, error } = useQuery({
    queryKey: ['/api/staff-offers'],
    // No refetchInterval - Supabase Realtime handles updates automatically!
    retry: 1,
  });

  // Use only real staff offers from database - identical to offers tab logic
  const displayOffers = (offers && Array.isArray(offers)) ? offers : [];

  // Transform to carousel format with new offers schema
  const displayItems = displayOffers.length > 0 ? 
    displayOffers.map((offer: any, index: number) => ({
      id: offer.id,
      offer_id: offer.id,
      position: index + 1,
      is_active: offer.status === 'active',
      created_at: offer.created_at,
      staff_offers: {
        id: offer.id,
        title: offer.title,
        description: offer.description,
        offer_type: offer.offer_type,
        priority: offer.priority,
        target_audience: offer.target_audience,
        click_url: offer.click_url,
        // No image/video URLs in new schema
        image_url: null,
        video_url: null
      }
    })) : [];

  // Auto-scroll functionality with improved stability
  useEffect(() => {
    if (displayItems.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => {
        const nextIndex = (prevIndex + 1) % displayItems.length;
        console.log('🎠 [CAROUSEL] Auto-scroll:', prevIndex, '→', nextIndex);
        return nextIndex;
      });
    }, 4000); // Reduced timing to prevent layout issues

    return () => clearInterval(interval);
  }, [displayItems.length]);

  if (isLoading) {
    return (
      <div className="flex space-x-2 sm:space-x-4 overflow-hidden">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="min-w-[200px] sm:min-w-[300px] bg-gradient-to-br from-gray-800 to-gray-900 animate-pulse">
            <CardContent className="p-0">
              <div className="w-full h-32 sm:h-48 bg-gray-700 rounded-lg"></div>
              <div className="p-2 sm:p-4">
                <div className="h-3 sm:h-4 bg-gray-600 rounded mb-1 sm:mb-2"></div>
                <div className="h-2 sm:h-3 bg-gray-600 rounded w-2/3"></div>
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
    <div className="relative w-full max-w-full">
      <div className="overflow-hidden rounded-lg">
        <div 
          className="flex transition-transform duration-500 ease-in-out"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {displayItems.map((item) => (
            <div key={item.id} className="w-full flex-shrink-0 min-w-0">
              <Card 
                className="bg-gradient-to-br from-emerald-800 to-emerald-900 border-emerald-600 cursor-pointer hover:scale-[1.02] transition-transform duration-200 mx-1"
                onClick={() => onOfferClick(item.offer_id)}
              >
                <CardContent className="p-0">
                  <div className="w-full h-28 sm:h-40 md:h-48 bg-gradient-to-br from-emerald-600 to-emerald-800 flex items-center justify-center rounded-t-lg relative">
                    <Gift className="w-6 h-6 sm:w-12 sm:h-12 md:w-16 md:h-16 text-white" />
                    <div className="absolute top-1 left-1 sm:top-2 sm:left-2 bg-black bg-opacity-50 rounded px-1 py-0.5 sm:px-2 sm:py-1">
                      <span className="text-[10px] sm:text-xs text-white font-medium leading-none">
                        {item.staff_offers.offer_type?.toUpperCase()}
                      </span>
                    </div>
                    {item.staff_offers.priority > 0 && (
                      <div className="absolute top-1 right-1 sm:top-2 sm:right-2 bg-yellow-500 rounded-full w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 flex items-center justify-center">
                        <span className="text-[8px] sm:text-xs text-black font-bold leading-none">
                          {item.staff_offers.priority}
                        </span>
                      </div>
                    )}
                    <div className="absolute bottom-1 left-1 right-1 sm:bottom-2 sm:left-2 sm:right-2 text-center">
                      <span className="text-[10px] sm:text-xs text-white bg-black bg-opacity-50 rounded px-1 py-0.5 sm:px-2 sm:py-1 leading-none">
                        {item.staff_offers.target_audience?.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <div className="p-2 sm:p-3 md:p-4">
                    <h3 className="text-xs sm:text-sm md:text-lg font-semibold text-white mb-1 sm:mb-2 line-clamp-2">
                      {item.staff_offers.title}
                    </h3>
                    <p className="text-gray-300 text-[10px] sm:text-xs md:text-sm line-clamp-2">
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
          <button
            className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/60 border border-gray-600 hover:bg-black/80 w-8 h-8 p-0 z-10 rounded-full flex items-center justify-center transition-colors"
            onClick={prevSlide}
          >
            <ChevronLeft className="h-4 w-4 text-white" />
          </button>
          <button
            className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/60 border border-gray-600 hover:bg-black/80 w-8 h-8 p-0 z-10 rounded-full flex items-center justify-center transition-colors"
            onClick={nextSlide}
          >
            <ChevronRight className="h-4 w-4 text-white" />
          </button>
        </>
      )}

      {/* Dots indicator */}
      {displayItems.length > 1 && (
        <div className="flex justify-center mt-2 sm:mt-3 md:mt-4 space-x-1.5">
          {displayItems.map((_, index) => (
            <button
              key={index}
              className={`w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 rounded-full transition-colors duration-200 ${
                index === currentIndex ? 'bg-emerald-400' : 'bg-gray-500 hover:bg-gray-400'
              }`}
              onClick={() => setCurrentIndex(index)}
            />
          ))}
        </div>
      )}
    </div>
  );
}