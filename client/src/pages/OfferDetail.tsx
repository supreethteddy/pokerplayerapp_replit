import { useLocation, useRoute } from 'wouter';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ExternalLink, Calendar, Clock, Gift, Users, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';

export default function OfferDetail() {
  const [, params] = useRoute('/offer/:id');
  const [, setLocation] = useLocation();
  const offerId = params?.id;

  // Fetch real offer data from staff portal database
  const { data: offer, isLoading, error } = useQuery({
    queryKey: [`/api/staff-offers/${offerId}`],
    enabled: !!offerId,
    retry: 1
  });

  // Generate terms from description (basic fallback)
  const generateTerms = (description: string) => {
    if (!description) return ['Terms and conditions apply'];
    
    const sentences = description.split('.').filter(s => s.trim().length > 0);
    return sentences.length > 1 ? sentences.slice(0, 3).map(s => s.trim()) : ['Terms and conditions apply'];
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-green-700">
        <div className="sticky top-0 bg-black/20 backdrop-blur-sm border-b border-white/10 p-4 z-10">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <Button
              onClick={() => setLocation('/dashboard?tab=offers')}
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/10"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Offers
            </Button>
          </div>
        </div>
        <div className="max-w-4xl mx-auto p-4 pb-8">
          <Card className="bg-black/20 border-white/10 text-white overflow-hidden">
            <Skeleton className="h-64 bg-slate-700" />
            <div className="p-6 space-y-6">
              <Skeleton className="h-8 bg-slate-700" />
              <Skeleton className="h-24 bg-slate-700" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Skeleton className="h-16 bg-slate-700" />
                <Skeleton className="h-16 bg-slate-700" />
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Error or not found state
  if (error || !offer) {

    return (
      <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-green-700 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center text-white py-20">
            <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-4">
              {error ? 'Error Loading Offer' : 'Offer Not Found'}
            </h1>
            <p className="text-white/70 mb-6">
              {error ? 'There was a problem loading this offer. Please try again.' : 'The offer you\'re looking for doesn\'t exist or has been removed.'}
            </p>
            <Button 
              onClick={() => setLocation('/dashboard?tab=offers')}
              variant="outline"
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Offers
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-green-700">
      {/* Header */}
      <div className="sticky top-0 bg-black/20 backdrop-blur-sm border-b border-white/10 p-4 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Button
            onClick={() => setLocation('/dashboard?tab=offers')}
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Offers
          </Button>
          <div className="text-white text-sm opacity-75">
            {offer.offer_type?.charAt(0).toUpperCase() + offer.offer_type?.slice(1) || 'Special Offer'}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-4 pb-8">
        {/* Main Card */}
        <Card className="bg-black/20 border-white/10 text-white overflow-hidden">
          {/* Hero Image */}
          <div className="relative h-64 bg-gradient-to-r from-orange-500 to-orange-600 flex items-center justify-center">
            {offer.image_url ? (
              <img 
                src={offer.image_url} 
                alt={offer.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback to gradient background if image fails
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : null}
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
              <div className="text-center">
                <Gift className="w-16 h-16 text-white mx-auto mb-4" />
                <h1 className="text-3xl font-bold text-white">{offer.title}</h1>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Description */}
            <div>
              <h2 className="text-xl font-semibold mb-3">Offer Details</h2>
              <p className="text-white/90 leading-relaxed">{offer.description}</p>
            </div>

            {/* Terms & Conditions */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Terms & Conditions</h3>
              <ul className="space-y-2">
                {generateTerms(offer.description).map((term, index) => (
                  <li key={index} className="flex items-start">
                    <div className="w-2 h-2 bg-green-400 rounded-full mt-2 mr-3 flex-shrink-0" />
                    <span className="text-white/80">{term}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Offer Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center space-x-3 bg-white/5 p-3 rounded-lg">
                <Calendar className="w-5 h-5 text-green-400" />
                <div>
                  <div className="text-sm text-white/60">
                    {offer.end_date ? 'Valid Until' : 'Created'}
                  </div>
                  <div className="font-semibold">
                    {offer.end_date 
                      ? new Date(offer.end_date).toLocaleDateString() 
                      : new Date(offer.created_at).toLocaleDateString()
                    }
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-3 bg-white/5 p-3 rounded-lg">
                <Users className="w-5 h-5 text-blue-400" />
                <div>
                  <div className="text-sm text-white/60">Type</div>
                  <div className="font-semibold">
                    {offer.offer_type?.charAt(0).toUpperCase() + offer.offer_type?.slice(1) || 'Special Offer'}
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              {offer.video_url && (
                <Button 
                  onClick={() => window.open(offer.video_url, '_blank')}
                  className="bg-blue-600 hover:bg-blue-700 text-white flex-1"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Watch Video
                </Button>
              )}
              <Button 
                variant="outline"
                onClick={() => setLocation('/dashboard?tab=offers')}
                className="bg-white/10 border-white/20 text-white hover:bg-white/20 flex-1"
              >
                View All Offers
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}