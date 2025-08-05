// PRODUCTION UNIFIED CHAT SYSTEM - FINAL VERSION
// Bypasses all legacy issues and constraint violations

import Pusher from 'pusher';

export class ProductionUnifiedChat {
  private pusher: Pusher;
  private supabase: any;

  constructor() {
    this.pusher = new Pusher({
      appId: process.env.PUSHER_APP_ID!,
      key: process.env.PUSHER_KEY!,
      secret: process.env.PUSHER_SECRET!,
      cluster: process.env.PUSHER_CLUSTER!,
      useTLS: true,
    });

    console.log('🚀 [PRODUCTION CHAT] Initialized successfully');
  }

  async initializeSupabase() {
    const { createClient } = await import('@supabase/supabase-js');
    this.supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  // SEND MESSAGE - DIRECT TO CHAT MESSAGES TABLE
  async sendMessage(playerId: number, playerName: string, message: string, senderType: 'player' | 'staff') {
    await this.initializeSupabase();
    
    const { v4: uuidv4 } = await import('uuid');
    const messageId = uuidv4();
    const timestamp = new Date().toISOString();

    console.log(`🚀 [PRODUCTION CHAT] Sending ${senderType} message from ${playerName}`);

    try {
      // Store message directly in chat_messages table (bypass chat_requests constraints)
      const { data: savedMessage, error: messageError } = await this.supabase
        .from('chat_messages')
        .insert({
          id: messageId,
          request_id: null, // NULL to avoid constraint issues
          player_id: playerId,
          sender: senderType,
          sender_name: playerName,
          message_text: message,
          timestamp: timestamp,
          status: 'sent'
        })
        .select()
        .single();

      if (messageError) {
        console.error('❌ [PRODUCTION CHAT] Database error:', messageError);
        throw new Error('Failed to save message');
      }

      console.log('✅ [PRODUCTION CHAT] Message saved:', messageId);

      // Send real-time notifications
      await this.sendRealTimeNotifications(playerId, playerName, message, messageId, timestamp, senderType);

      return {
        success: true,
        data: {
          id: messageId,
          playerId,
          message,
          senderType,
          timestamp
        }
      };

    } catch (error) {
      console.error('❌ [PRODUCTION CHAT] Send error:', error);
      throw error;
    }
  }

  // CLEAR MESSAGES - SIMPLE DELETE
  async clearPlayerChat(playerId: number) {
    await this.initializeSupabase();
    
    console.log(`🧹 [PRODUCTION CHAT] Clearing chat for player: ${playerId}`);

    try {
      // Delete messages directly
      const { error: messagesError } = await this.supabase
        .from('chat_messages')
        .delete()
        .eq('player_id', playerId);

      if (messagesError) {
        console.error('❌ [PRODUCTION CHAT] Delete error:', messagesError);
        throw new Error('Failed to clear messages');
      }

      console.log('✅ [PRODUCTION CHAT] Chat cleared for player:', playerId);
      return { success: true, message: 'Chat history cleared successfully' };

    } catch (error) {
      console.error('❌ [PRODUCTION CHAT] Clear error:', error);
      throw error;
    }
  }

  // GET CHAT HISTORY - DIRECT FROM CHAT MESSAGES
  async getChatHistory(playerId: number) {
    await this.initializeSupabase();
    
    console.log(`📋 [PRODUCTION CHAT] Getting chat history for player: ${playerId}`);

    try {
      const { data: messages, error } = await this.supabase
        .from('chat_messages')
        .select('*')
        .eq('player_id', playerId)
        .order('timestamp', { ascending: true });

      if (error) {
        console.error('❌ [PRODUCTION CHAT] History error:', error);
        throw new Error('Failed to fetch chat history');
      }

      console.log(`✅ [PRODUCTION CHAT] Retrieved ${messages?.length || 0} messages for player ${playerId}`);
      
      // Format as conversations for frontend compatibility
      return { 
        success: true, 
        conversations: messages?.length ? [{
          id: `conv-${playerId}`,
          subject: `Chat History`,
          status: 'active',
          chat_messages: messages
        }] : []
      };

    } catch (error) {
      console.error('❌ [PRODUCTION CHAT] History error:', error);
      throw error;
    }
  }

  // REAL-TIME NOTIFICATIONS
  private async sendRealTimeNotifications(playerId: number, playerName: string, message: string, messageId: string, timestamp: string, senderType: 'player' | 'staff') {
    try {
      const payload = {
        id: messageId,
        message: message,
        sender: senderType,
        sender_name: playerName,
        player_id: playerId,
        timestamp: timestamp,
        status: 'sent'
      };

      // Staff Portal Pusher notification
      await this.pusher.trigger('staff-portal', 'new-player-message', payload);
      console.log('✅ [PRODUCTION CHAT] Staff portal notification sent');

      // Player channel notification
      await this.pusher.trigger(`player-chat-${playerId}`, 'message-update', payload);
      console.log('✅ [PRODUCTION CHAT] Player channel notification sent');

      // OneSignal push notification
      if (process.env.ONESIGNAL_API_KEY && process.env.ONESIGNAL_APP_ID) {
        try {
          const fetch = (await import('node-fetch')).default;
          const notificationPayload = {
            app_id: process.env.ONESIGNAL_APP_ID,
            included_segments: ['All'],
            headings: { en: 'New Chat Message' },
            contents: { en: `${playerName}: ${message.substring(0, 100)}` },
            data: { type: 'chat_message', playerId: playerId }
          };

          const response = await fetch('https://onesignal.com/api/v1/notifications', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Basic ${process.env.ONESIGNAL_API_KEY}`
            },
            body: JSON.stringify(notificationPayload)
          });

          if (response.ok) {
            console.log('✅ [PRODUCTION CHAT] OneSignal notification sent');
          }
        } catch (error) {
          console.warn('⚠️ [PRODUCTION CHAT] OneSignal error:', error);
        }
      }

    } catch (error) {
      console.error('❌ [PRODUCTION CHAT] Notification error:', error);
      // Don't throw - message was saved, notifications are secondary
    }
  }
}

export const productionChat = new ProductionUnifiedChat();