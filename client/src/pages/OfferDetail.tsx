import { useLocation, useRoute } from 'wouter';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ExternalLink, Calendar, Clock, Gift, Users } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';

// Demo offers data (will be replaced with API data when staff portal creates offers)
const demoOffers = [
  {
    id: 'demo-welcome',
    title: 'Welcome Bonus',
    description: 'Get started with our amazing welcome bonus! New players receive 100% match bonus up to ₹10,000 on their first deposit. This exclusive offer is available for the first 7 days after registration. Terms and conditions apply.',
    image: '/api/placeholder-welcome-bonus.jpg',
    terms: [
      'Valid for new players only',
      'Minimum deposit of ₹1,000 required',
      'Bonus must be used within 7 days',
      'Wagering requirements: 30x bonus amount',
      'Maximum cashout: ₹50,000'
    ],
    validUntil: '2025-08-31',
    category: 'New Player Bonus',
    url: 'https://example.com/welcome-bonus'
  },
  {
    id: 'demo-weekend',
    title: 'Weekend Special',
    description: 'Double your winnings this weekend! Join our weekend tournament series with guaranteed prize pools. Every Saturday and Sunday, participate in multiple tournaments with buy-ins starting from just ₹500. Special weekend cashback offers available.',
    image: '/api/placeholder-weekend-special.jpg',
    terms: [
      'Available Saturday and Sunday only',
      'Minimum buy-in: ₹500',
      'Guaranteed prize pools',
      '20% cashback on losses up to ₹5,000',
      'Must play minimum 3 tournaments'
    ],
    validUntil: '2025-12-31',
    category: 'Tournament Special',
    url: 'https://example.com/weekend-special'
  },
  {
    id: 'demo-tournament',
    title: 'Free Tournament',
    description: 'Join our free weekly tournament with ₹10,000 guaranteed prize pool! No entry fee required. Play every Thursday at 8 PM IST. Top 10 players receive cash prizes. Perfect opportunity for beginners to win real money without any risk.',
    image: '/api/placeholder-tournament.jpg',
    terms: [
      'Completely free entry',
      'Every Thursday 8 PM IST',
      'Guaranteed ₹10,000 prize pool',
      'Top 10 players receive prizes',
      'Registration opens 2 hours before start'
    ],
    validUntil: '2025-12-31',
    category: 'Free Tournament',
    url: 'https://example.com/free-tournament'
  }
];

export default function OfferDetail() {
  const [, params] = useRoute('/offer/:id');
  const [, setLocation] = useLocation();
  const offerId = params?.id;

  // Find the offer (demo data for now)
  const offer = demoOffers.find(o => o.id === offerId);

  if (!offer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-green-700 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center text-white py-20">
            <h1 className="text-2xl font-bold mb-4">Offer Not Found</h1>
            <Button 
              onClick={() => setLocation('/dashboard?tab=balance')}
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
            onClick={() => setLocation('/dashboard?tab=balance')}
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Offers
          </Button>
          <div className="text-white text-sm opacity-75">
            {offer.category}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-4 pb-8">
        {/* Main Card */}
        <Card className="bg-black/20 border-white/10 text-white overflow-hidden">
          {/* Hero Image */}
          <div className="relative h-64 bg-gradient-to-r from-orange-500 to-orange-600 flex items-center justify-center">
            <img 
              src={offer.image} 
              alt={offer.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                // Fallback to gradient background if image fails
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
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
                {offer.terms.map((term, index) => (
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
                  <div className="text-sm text-white/60">Valid Until</div>
                  <div className="font-semibold">{new Date(offer.validUntil).toLocaleDateString()}</div>
                </div>
              </div>
              
              <div className="flex items-center space-x-3 bg-white/5 p-3 rounded-lg">
                <Users className="w-5 h-5 text-blue-400" />
                <div>
                  <div className="text-sm text-white/60">Category</div>
                  <div className="font-semibold">{offer.category}</div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              {offer.url && (
                <Button 
                  onClick={() => window.open(offer.url, '_blank')}
                  className="bg-green-600 hover:bg-green-700 text-white flex-1"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Visit Offer Page
                </Button>
              )}
              <Button 
                variant="outline"
                onClick={() => setLocation('/dashboard?tab=balance')}
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