import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface OfferBanner {
  id: number;
  title: string;
  imageUrl: string;
  offerDescription?: string;
  redirectUrl?: string;
  isActive: boolean;
  displayOrder: number;
}

interface OfferBannerProps {
  onOfferClick: (offerId: number) => void;
}

export default function OfferBanner({ onOfferClick }: OfferBannerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Fetch offer banners
  const { data: banners, isLoading } = useQuery<OfferBanner[]>({
    queryKey: ['/api/offer-banners'],
    staleTime: 30000,
  });

  const activeBanners = banners?.filter(banner => banner.isActive) || [];

  // Auto-scroll functionality
  useEffect(() => {
    if (activeBanners.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % activeBanners.length);
    }, 5000); // Change slide every 5 seconds

    return () => clearInterval(interval);
  }, [activeBanners.length]);

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  const goToPrevious = () => {
    setCurrentIndex((prev) => 
      prev === 0 ? activeBanners.length - 1 : prev - 1
    );
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % activeBanners.length);
  };

  const handleBannerClick = (banner: OfferBanner) => {
    onOfferClick(banner.id);
  };

  if (isLoading) {
    return (
      <Card className="bg-slate-800 border-slate-700 mb-4">
        <CardContent className="p-0">
          <div className="h-32 bg-slate-700 animate-pulse rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (!activeBanners.length) {
    return (
      <Card className="bg-slate-800 border-slate-700 mb-4">
        <CardContent className="p-6 text-center">
          <p className="text-slate-400">No active offers available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-800 border-slate-700 mb-4 overflow-hidden">
      <CardContent className="p-0 relative">
        <div className="relative h-32 overflow-hidden">
          {/* Banner Images */}
          <div 
            className="flex transition-transform duration-500 ease-in-out h-full"
            style={{ transform: `translateX(-${currentIndex * 100}%)` }}
          >
            {activeBanners.map((banner) => (
              <div
                key={banner.id}
                className="min-w-full h-full relative cursor-pointer group"
                onClick={() => handleBannerClick(banner)}
              >
                <img
                  src={banner.imageUrl}
                  alt={banner.title}
                  className="w-full h-full object-cover"
                />
                {/* Overlay */}
                <div className="absolute inset-0 bg-black bg-opacity-30 group-hover:bg-opacity-20 transition-all duration-300" />
                
                {/* Banner Content */}
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black to-transparent">
                  <h3 className="text-white font-semibold text-lg mb-1">{banner.title}</h3>
                  {banner.offerDescription && (
                    <p className="text-slate-200 text-sm line-clamp-2">{banner.offerDescription}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <ExternalLink className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400 text-sm">Click to view offer</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Navigation Arrows */}
          {activeBanners.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white border-none"
                onClick={goToPrevious}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white border-none"
                onClick={goToNext}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </>
          )}

          {/* Dots Indicator */}
          {activeBanners.length > 1 && (
            <div className="absolute bottom-2 right-2 flex space-x-2">
              {activeBanners.map((_, index) => (
                <button
                  key={index}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    index === currentIndex ? 'bg-emerald-400' : 'bg-white bg-opacity-50'
                  }`}
                  onClick={() => goToSlide(index)}
                />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}