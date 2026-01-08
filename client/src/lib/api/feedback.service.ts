import { BaseAPIService } from './base';

/**
 * Feedback Service
 * Handles player feedback and support requests
 */
class FeedbackService extends BaseAPIService {
  /**
   * Submit player feedback
   */
  async submitFeedback(data: {
    playerId: string;
    message: string;
    category?: 'general' | 'bug' | 'suggestion' | 'complaint' | 'support';
    rating?: number; // 1-5 stars
  }): Promise<{
    success: boolean;
    message: string;
    feedbackId: string;
    timestamp: string;
  }> {
    return this.request('POST', '/feedback', data);
  }

  /**
   * Get player's submitted feedback
   */
  async getMyFeedback(limit = 20): Promise<{
    feedback: Array<{
      id: string;
      message: string;
      category: string;
      rating?: number;
      status: 'pending' | 'reviewed' | 'resolved';
      response?: string;
      submittedAt: string;
      respondedAt?: string;
    }>;
  }> {
    return this.request('GET', `/feedback/my-feedback?limit=${limit}`);
  }

  /**
   * Get feedback statistics
   */
  async getFeedbackStats(): Promise<{
    totalSubmitted: number;
    pending: number;
    resolved: number;
    averageRating: number;
    responseTime: string; // e.g., "2 hours"
  }> {
    return this.request('GET', '/feedback/stats');
  }
}

export const feedbackService = new FeedbackService();







