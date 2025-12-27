import { BaseAPIService } from './base';

/**
 * Chat Service
 * Handles unified chat messaging for player support
 */
class ChatService extends BaseAPIService {
  /**
   * Send a chat message
   */
  async sendMessage(data: {
    playerId: string;
    message: string;
    sessionId?: string;
  }): Promise<{
    success: boolean;
    messageId: string;
    timestamp: string;
  }> {
    return this.request('POST', '/unified-chat/send', data);
  }

  /**
   * Get chat history for a player
   */
  async getChatHistory(playerId: string, limit = 50): Promise<{
    messages: Array<{
      id: string;
      message: string;
      sender: 'player' | 'staff';
      timestamp: string;
    }>;
  }> {
    return this.request('GET', `/unified-chat/${playerId}?limit=${limit}`);
  }

  /**
   * Get active chat session
   */
  async getActiveSession(playerId: string): Promise<{
    sessionId: string;
    status: 'active' | 'closed';
  } | null> {
    return this.request('GET', `/unified-chat/session/${playerId}`);
  }
}

export const chatService = new ChatService();





