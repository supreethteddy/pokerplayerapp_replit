import { BaseAPIService } from './base';

/**
 * VIP Points Calculation Logic
 * - Players earn 1 point per ₹100 spent in games
 * - Points can be redeemed for rewards at different tiers
 * - Club points have different calculation (1 point per ₹50)
 */

export interface VIPTier {
  name: 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';
  minPoints: number;
  benefits: string[];
  multiplier: number; // Points earning multiplier
}

export const VIP_TIERS: VIPTier[] = [
  {
    name: 'Bronze',
    minPoints: 0,
    benefits: ['Basic support', 'Standard tournaments'],
    multiplier: 1.0
  },
  {
    name: 'Silver',
    minPoints: 1000,
    benefits: ['Priority support', 'Exclusive tournaments', '5% rakeback'],
    multiplier: 1.2
  },
  {
    name: 'Gold',
    minPoints: 5000,
    benefits: ['VIP support', 'Premium tournaments', '10% rakeback', 'Birthday bonus'],
    multiplier: 1.5
  },
  {
    name: 'Platinum',
    minPoints: 15000,
    benefits: ['Dedicated manager', 'Luxury tournaments', '15% rakeback', 'Monthly cashback'],
    multiplier: 2.0
  },
  {
    name: 'Diamond',
    minPoints: 50000,
    benefits: ['Personal concierge', 'Exclusive events', '20% rakeback', 'VIP lounge access'],
    multiplier: 3.0
  }
];

/**
 * VIP Service
 * Handles VIP points, club points, and redemptions
 */
class VIPService extends BaseAPIService {
  /**
   * Calculate VIP points earned from amount spent
   * Formula: 1 point per ₹100 spent × tier multiplier
   */
  calculateVIPPointsEarned(amountSpent: number, currentTier: VIPTier = VIP_TIERS[0]): number {
    const basePoints = Math.floor(amountSpent / 100);
    return Math.floor(basePoints * currentTier.multiplier);
  }

  /**
   * Calculate club points earned from amount spent
   * Formula: 1 point per ₹50 spent (more generous than VIP points)
   */
  calculateClubPointsEarned(amountSpent: number): number {
    return Math.floor(amountSpent / 50);
  }

  /**
   * Get player's current VIP tier based on total points
   */
  getVIPTier(totalPoints: number): VIPTier {
    // Find the highest tier the player qualifies for
    for (let i = VIP_TIERS.length - 1; i >= 0; i--) {
      if (totalPoints >= VIP_TIERS[i].minPoints) {
        return VIP_TIERS[i];
      }
    }
    return VIP_TIERS[0]; // Default to Bronze
  }

  /**
   * Calculate points needed for next tier
   */
  getPointsToNextTier(totalPoints: number): { pointsNeeded: number; nextTier: VIPTier } | null {
    const currentTier = this.getVIPTier(totalPoints);
    const currentTierIndex = VIP_TIERS.findIndex(t => t.name === currentTier.name);
    
    if (currentTierIndex === VIP_TIERS.length - 1) {
      return null; // Already at max tier
    }

    const nextTier = VIP_TIERS[currentTierIndex + 1];
    return {
      pointsNeeded: nextTier.minPoints - totalPoints,
      nextTier
    };
  }

  /**
   * Redeem VIP points for rewards
   */
  async redeemVIPPoints(data: {
    points: number;
    rewardType: string;
    rewardId?: string;
  }): Promise<{
    success: boolean;
    message: string;
    remainingPoints: number;
  }> {
    return this.request('POST', '/vip-points/redeem', data);
  }

  /**
   * Redeem club points for benefits
   */
  async redeemClubPoints(data: {
    points: number;
    benefitType: string;
    benefitId?: string;
  }): Promise<{
    success: boolean;
    message: string;
    remainingPoints: number;
  }> {
    return this.request('POST', '/vip-club/redeem', data);
  }

  /**
   * Get VIP points balance and history
   */
  async getVIPPointsBalance(): Promise<{
    totalPoints: number;
    availablePoints: number;
    currentTier: string;
    history: Array<{
      date: string;
      points: number;
      type: 'earned' | 'redeemed';
      description: string;
    }>;
  }> {
    return this.request('GET', '/vip-points/balance');
  }

  /**
   * Get club points balance and history
   */
  async getClubPointsBalance(): Promise<{
    totalPoints: number;
    availablePoints: number;
    history: Array<{
      date: string;
      points: number;
      type: 'earned' | 'redeemed';
      description: string;
    }>;
  }> {
    return this.request('GET', '/vip-club/balance');
  }

  /**
   * Get available rewards for VIP points
   */
  async getAvailableRewards(): Promise<{
    rewards: Array<{
      id: string;
      name: string;
      description: string;
      pointsCost: number;
      available: boolean;
    }>;
  }> {
    return this.request('GET', '/vip-points/rewards');
  }
}

export const vipService = new VIPService();


