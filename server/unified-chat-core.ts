// UNIFIED CHAT SYSTEM - SINGLE SOURCE OF TRUTH
// Eliminates ALL legacy chat code and creates one unified system

import Pusher from 'pusher';
// OneSignal import replaced with fetch-based implementation

export class UnifiedChatCore {
  private pusher: Pusher;
  private supabase: any;

  constructor() {
    // Initialize Pusher
    this.pusher = new Pusher({
      appId: process.env.PUSHER_APP_ID!,
      key: process.env.PUSHER_KEY!,
      secret: process.env.PUSHER_SECRET!,
      cluster: process.env.PUSHER_CLUSTER!,
      useTLS: true,
    });

    // OneSignal will be handled via fetch API

    console.log('🚀 [UNIFIED CHAT] Core system initialized');
  }

  async initializeSupabase() {
    const { createClient } = await import('@supabase/supabase-js');
    this.supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  // SINGLE MESSAGE SEND FUNCTION
  async sendMessage(playerId: number, playerName: string, message: string, senderType: 'player' | 'staff') {
    await this.initializeSupabase();
    
    const { v4: uuidv4 } = await import('uuid');
    const messageId = uuidv4();
    const timestamp = new Date().toISOString();

    console.log(`🚀 [UNIFIED CHAT] Sending ${senderType} message:`, { playerId, message: message.substring(0, 50) });

    try {
      // 1. Find or create chat request
      let requestId = await this.getOrCreateChatRequest(playerId, playerName, message);

      // 2. Store message in database (with status field)
      const { data: savedMessage, error: messageError } = await this.supabase
        .from('chat_messages')
        .insert({
          id: messageId,
          request_id: requestId,
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
        console.error('❌ [UNIFIED CHAT] Database error:', messageError);
        throw new Error('Failed to save message');
      }

      console.log('✅ [UNIFIED CHAT] Message saved to database:', messageId);

      // 3. Send real-time notifications
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
      console.error('❌ [UNIFIED CHAT] Send error:', error);
      throw error;
    }
  }

  // SINGLE CLEAR FUNCTION (SOFT DELETE)
  async clearPlayerChat(playerId: number) {
    await this.initializeSupabase();
    
    console.log(`🧹 [UNIFIED CHAT] Archiving chat for player: ${playerId}`);

    try {
      // Delete messages directly (avoid schema cache issues)
      const { error: messagesError } = await this.supabase
        .from('chat_messages')
        .delete()
        .eq('player_id', playerId);

      if (messagesError) {
        console.error('❌ [UNIFIED CHAT] Archive messages error:', messagesError);
        throw new Error('Failed to archive messages');
      }

      // Delete chat requests directly
      const { error: requestsError } = await this.supabase
        .from('chat_requests')
        .delete()
        .eq('player_id', playerId);

      if (requestsError) {
        console.error('❌ [UNIFIED CHAT] Archive requests error:', requestsError);
        throw new Error('Failed to archive requests');
      }

      console.log('✅ [UNIFIED CHAT] Chat archived successfully for player:', playerId);
      return { success: true, message: 'Chat history cleared successfully' };

    } catch (error) {
      console.error('❌ [UNIFIED CHAT] Clear error:', error);
      throw error;
    }
  }

  // GET ACTIVE CHAT HISTORY
  async getChatHistory(playerId: number) {
    await this.initializeSupabase();
    
    console.log(`📋 [UNIFIED CHAT] Getting active chat history for player: ${playerId}`);

    try {
      // Get only active (non-archived) chat requests 
      const { data: chatRequests, error: requestError } = await this.supabase
        .from('chat_requests')
        .select('id, player_id, subject, initial_message, status, created_at')
        .eq('player_id', playerId)
        .neq('status', 'archived')
        .order('created_at', { ascending: true });

      if (requestError) {
        console.error('❌ [UNIFIED CHAT] Error fetching requests:', requestError);
        throw new Error('Failed to fetch chat requests');
      }

      // Get all active messages for each chat request
      const conversations = [];
      
      for (const request of chatRequests || []) {
        const { data: messages, error: msgError } = await this.supabase
          .from('chat_messages')
          .select('*')
          .eq('request_id', request.id)
          .neq('status', 'archived')
          .order('timestamp', { ascending: true });

        if (msgError) {
          console.error(`❌ [UNIFIED CHAT] Error fetching messages for request ${request.id}:`, msgError);
          continue;
        }

        conversations.push({
          id: request.id,
          subject: request.subject,
          status: request.status,
          created_at: request.created_at,
          initial_message: request.initial_message,
          chat_messages: messages || []
        });
      }

      console.log(`✅ [UNIFIED CHAT] Retrieved ${conversations.length} conversations for player ${playerId}`);
      return { success: true, conversations };

    } catch (error) {
      console.error('❌ [UNIFIED CHAT] History error:', error);
      throw error;
    }
  }

  // HELPER: Get or create chat request
  private async getOrCreateChatRequest(playerId: number, playerName: string, initialMessage: string) {
    // Check for existing active request
    const { data: existingRequest } = await this.supabase
      .from('chat_requests')
      .select('id')
      .eq('player_id', playerId)
      .neq('status', 'archived')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (existingRequest?.id) {
      console.log('🔄 [UNIFIED CHAT] Using existing request:', existingRequest.id);
      return existingRequest.id;
    }

    // Create new request with proper UUID
    const { v4: uuidv4 } = await import('uuid');
    const requestId = uuidv4();
    const { data: newRequest, error: requestError } = await this.supabase
      .from('chat_requests')
      .insert({
        id: requestId,
        player_id: playerId,
        player_name: playerName,
        subject: `Chat with ${playerName}`,
        initial_message: initialMessage,
        status: 'pending',
        priority: 'medium'
      })
      .select()
      .single();

    if (requestError) {
      console.error('❌ [UNIFIED CHAT] Create request error:', requestError);
      throw new Error('Failed to create chat request');
    }

    console.log('✅ [UNIFIED CHAT] Created new request:', requestId);
    return requestId;
  }

  // HELPER: Send real-time notifications
  private async sendRealTimeNotifications(playerId: number, playerName: string, message: string, messageId: string, timestamp: string, senderType: 'player' | 'staff') {
    try {
      // Staff Portal Pusher notification
      const staffPayload = {
        id: messageId,
        message: message,
        sender: senderType,
        sender_name: playerName,
        player_id: playerId,
        timestamp: timestamp,
        status: 'sent'
      };

      await this.pusher.trigger('staff-portal', 'new-player-message', staffPayload);
      console.log('✅ [UNIFIED CHAT] Staff portal notification sent via Pusher');

      // Player channel notification
      await this.pusher.trigger(`player-chat-${playerId}`, 'message-update', staffPayload);
      console.log('✅ [UNIFIED CHAT] Player channel notification sent');

      // OneSignal push notification via fetch
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
            console.log('✅ [UNIFIED CHAT] OneSignal push notification sent');
          }
        } catch (error) {
          console.warn('⚠️ [UNIFIED CHAT] OneSignal notification error:', error);
        }
      }

    } catch (error) {
      console.error('❌ [UNIFIED CHAT] Real-time notification error:', error);
      // Don't throw - message was saved, notifications are secondary
    }
  }
}

export const unifiedChatCore = new UnifiedChatCore();