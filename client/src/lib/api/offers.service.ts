import { BaseAPIService } from './base';

/**
 * Offers Service
 * Handles player offers and promotions
 */
class OffersService extends BaseAPIService {
  /**
   * Record that player viewed an offer
   */
  async recordOfferView(offerId: string | number): Promise<{
    success: boolean;
  }> {
    return this.request('POST', '/offer-views', {
      offer_id: offerId
    });
  }

  /**
   * Get all active offers for player
   */
  async getActiveOffers(): Promise<{
    offers: Array<{
      id: string;
      title: string;
      description: string;
      imageUrl?: string;
      validUntil: string;
      viewed?: boolean;
    }>;
  }> {
    return this.request('GET', '/offers/active');
  }

  /**
   * Claim an offer
   */
  async claimOffer(offerId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    return this.request('POST', `/offers/${offerId}/claim`);
  }
}

export const offersService = new OffersService();





