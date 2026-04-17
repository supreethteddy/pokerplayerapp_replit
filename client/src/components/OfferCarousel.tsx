import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, Gift } from 'lucide-react';
import { useRealtimeOffers } from '@/hooks/useRealtimeOffers';
import {
  getHiddenPromotionIdsFromHomeCarousel,
  hidePromotionFromHomeCarousel,
  PROMO_HOME_CAROUSEL_CHANGED_EVENT,
} from '@/lib/promotionHomeCarousel';

interface CarouselItem {
  id: string;
  offer_id: string;
  position: number;
  is_active: boolean;
  created_at: string;
  expires_at?: string | null;
  image_url: string | null;
  video_url: string | null;
  staff_offers: {
    id: string;
    title: string;
    description: string;
    offer_type: string;
    priority: number;
    click_url?: string | null;
    image_url: string | null;
    video_url: string | null;
  };
}

interface OfferCarouselProps {
  onOfferClick: (offerId: string) => void;
}

function isOfferExpired(offer: { expires_at?: string | null }) {
  const e = offer.expires_at;
  if (!e) return false;
  const t = new Date(e).getTime();
  return !Number.isNaN(t) && t <= Date.now();
}

export default function OfferCarousel({ onOfferClick }: OfferCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hideBump, setHideBump] = useState(0);

  // Enable real-time offers via Supabase Realtime
  useRealtimeOffers();

  // Fetch player-visible offers (not staff admin offers)
  const { data: offers, isLoading, error } = useQuery({
    queryKey: ['/api/player-offers/active'],
    // No refetchInterval - Supabase Realtime handles updates automatically!
    retry: 1,
  });

  // Use only player-visible offers payload from backend
  const displayOffers = Array.isArray((offers as any)?.offers)
    ? (offers as any).offers
    : (Array.isArray(offers) ? offers : []);

  // Transform to carousel format with new offers schema
  useEffect(() => {
    const fn = () => setHideBump((n) => n + 1);
    window.addEventListener(PROMO_HOME_CAROUSEL_CHANGED_EVENT, fn);
    return () => window.removeEventListener(PROMO_HOME_CAROUSEL_CHANGED_EVENT, fn);
  }, []);

  const displayItems: CarouselItem[] = displayOffers.length > 0 ?
    displayOffers.map((offer: any, index: number) => ({
      id: offer.id,
      offer_id: offer.id,
      position: index + 1,
      is_active: offer.is_active !== false,
      created_at: offer.created_at,
      expires_at: offer.expires_at ?? null,
      image_url: offer.image_url ?? null,
      video_url: offer.video_url ?? null,
      staff_offers: {
        id: offer.id,
        title: offer.title,
        description: offer.description,
        offer_type: offer.offer_type,
        priority: offer.priority ?? 0,
        click_url: offer.click_url,
        image_url: offer.image_url ?? null,
        video_url: offer.video_url ?? null,
      },
    })) : [];

  const hiddenIds = useMemo(() => {
    void hideBump;
    return getHiddenPromotionIdsFromHomeCarousel();
  }, [hideBump]);

  const carouselItems = useMemo(
    () =>
      displayItems.filter(
        (item) =>
          !hiddenIds.has(String(item.id)) && !isOfferExpired(item),
      ),
    [displayItems, hiddenIds],
  );

  const carouselKey = carouselItems.map((x) => x.id).join('|');

  useEffect(() => {
    setCurrentIndex((i) =>
      carouselItems.length === 0 ? 0 : Math.min(i, carouselItems.length - 1),
    );
  }, [carouselKey, carouselItems.length]);

  // Auto-scroll — only promos not yet opened on this device (carouselItems)
  useEffect(() => {
    if (carouselItems.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => {
        const nextIndex = (prevIndex + 1) % carouselItems.length;
        return nextIndex;
      });
    }, 4000);

    return () => clearInterval(interval);
  }, [carouselItems.length]);

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
    return null;
  }

  if (!displayItems || displayItems.length === 0) {
    return null;
  }

  if (!isLoading && carouselItems.length === 0) {
    return null;
  }

  const nextSlide = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % carouselItems.length);
  };

  const prevSlide = () => {
    setCurrentIndex((prevIndex) => (prevIndex - 1 + carouselItems.length) % carouselItems.length);
  };

  return (
    <div className="relative w-full max-w-full min-w-0">
      <div className="overflow-hidden rounded-lg">
        <div 
          className="flex transition-transform duration-500 ease-in-out"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {carouselItems.map((item) => (
            <div key={item.id} className="w-full flex-shrink-0 min-w-0 max-w-full">
              <Card 
                className="bg-gradient-to-br from-emerald-800 to-emerald-900 border-emerald-600 cursor-pointer hover:scale-[1.02] transition-transform duration-200 mx-1 max-w-full"
                onClick={() => {
                  hidePromotionFromHomeCarousel(String(item.offer_id));
                  onOfferClick(item.offer_id);
                }}
              >
                <CardContent className="p-0 overflow-hidden">
                  <div className="relative flex w-full max-w-full aspect-video max-h-[min(42svh,240px)] sm:max-h-56 items-center justify-center bg-black">
                    {item.video_url ? (
                      <video
                        className="max-h-full max-w-full object-contain"
                        poster={item.image_url || undefined}
                        muted
                        playsInline
                        preload="metadata"
                      >
                        <source src={item.video_url} type="video/mp4" />
                      </video>
                    ) : item.image_url ? (
                      <img
                        src={item.image_url}
                        alt=""
                        className="max-h-full max-w-full object-contain"
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-emerald-600 to-emerald-800">
                        <Gift className="w-6 h-6 sm:w-12 sm:h-12 md:w-16 md:h-16 text-white" />
                      </div>
                    )}
                    <div className="absolute top-1 left-1 sm:top-2 sm:left-2 bg-black/50 rounded px-1 py-0.5 sm:px-2 sm:py-1 z-10">
                      <span className="text-[10px] sm:text-xs text-white font-medium leading-none">
                        {item.staff_offers.offer_type?.toUpperCase()}
                      </span>
                    </div>
                    {item.staff_offers.priority > 0 && (
                      <div className="absolute top-1 right-1 sm:top-2 sm:right-2 bg-yellow-500 rounded-full w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 flex items-center justify-center z-10">
                        <span className="text-[8px] sm:text-xs text-black font-bold leading-none">
                          {item.staff_offers.priority}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-2 sm:p-3 md:p-4 min-w-0">
                    <h3 className="text-xs sm:text-sm md:text-lg font-semibold text-white mb-1 sm:mb-2 line-clamp-2 break-words">
                      {item.staff_offers.title}
                    </h3>
                    <p className="text-gray-300 text-[10px] sm:text-xs md:text-sm line-clamp-2 break-words">
                      {item.staff_offers.description}
                    </p>
                    {item.expires_at && !isOfferExpired(item) ? (
                      <p className="mt-1 text-[10px] sm:text-xs text-amber-200/90">
                        Expires{' '}
                        {new Date(item.expires_at).toLocaleString('en-IN', {
                          timeZone: 'Asia/Kolkata',
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </p>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation buttons */}
      {carouselItems.length > 1 && (
        <>
          <button
            type="button"
            className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/60 border border-gray-600 hover:bg-black/80 w-8 h-8 p-0 z-10 rounded-full flex items-center justify-center transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              prevSlide();
            }}
          >
            <ChevronLeft className="h-4 w-4 text-white" />
          </button>
          <button
            type="button"
            className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/60 border border-gray-600 hover:bg-black/80 w-8 h-8 p-0 z-10 rounded-full flex items-center justify-center transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              nextSlide();
            }}
          >
            <ChevronRight className="h-4 w-4 text-white" />
          </button>
        </>
      )}

      {/* Dots indicator */}
      {carouselItems.length > 1 && (
        <div className="flex justify-center mt-2 sm:mt-3 md:mt-4 space-x-1.5">
          {carouselItems.map((_: CarouselItem, index: number) => (
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