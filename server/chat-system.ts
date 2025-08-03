// ENTERPRISE-GRADE REAL-TIME CHAT SYSTEM
// Production integration with Pusher Channels + OneSignal + Supabase

import { Express } from 'express';
import Pusher from 'pusher';
import OneSignal from 'onesignal-node';

// Initialize services
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
});

const oneSignalClient = new OneSignal.Client(
  process.env.ONESIGNAL_APP_ID!,
  process.env.ONESIGNAL_API_KEY!
);

export function setupProductionChatRoutes(app: Express) {
  console.log('🚀 [PRODUCTION CHAT] Setting up enterprise-grade chat system...');

  // EXPERT-LEVEL CHAT ENDPOINTS - Real-time bidirectional messaging

  // Get Chat Messages - Enterprise chat history with cross-portal integration
  app.get("/api/unified-chat/messages/:playerId", async (req, res) => {
    try {
      const { playerId } = req.params;
      console.log('📋 [EXPERT CHAT API] Loading comprehensive chat history for player:', playerId);

      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      // Query from multiple chat sources for comprehensive history
      const [gre_messages, chat_requests, push_notifications] = await Promise.all([
        supabase
          .from('gre_chat_messages')
          .select('*')
          .eq('player_id', playerId)
          .order('created_at', { ascending: true })
          .limit(50),
        
        supabase
          .from('chat_requests')
          .select('*')
          .eq('player_id', playerId)
          .order('created_at', { ascending: true })
          .limit(10),
          
        supabase
          .from('push_notifications')
          .select('*')
          .or(`sender_id.eq.${playerId},target_audience.eq.player_${playerId}`)
          .order('created_at', { ascending: true })
          .limit(20)
      ]);

      // Combine and transform all messages
      const allMessages = [];

      // Add GRE messages
      gre_messages.data?.forEach(msg => {
        allMessages.push({
          id: msg.id,
          message: msg.message,
          sender: msg.sender === 'player' ? 'player' : 'gre',
          sender_name: msg.sender === 'player' ? msg.player_name || 'Player' : msg.gre_name || 'GRE',
          timestamp: msg.created_at,
          status: 'sent'
        });
      });

      // Add chat request messages
      chat_requests.data?.forEach(req => {
        allMessages.push({
          id: `req-${req.id}`,
          message: req.message || 'Chat request initiated',
          sender: 'player',
          sender_name: req.player_name || 'Player',
          timestamp: req.created_at,
          status: req.status
        });
      });

      // Add notification messages
      push_notifications.data?.forEach(notif => {
        if (notif.message && notif.message.length > 0) {
          allMessages.push({
            id: `notif-${notif.id}`,
            message: notif.message,
            sender: notif.sent_by_role === 'gre' ? 'gre' : 'player',
            sender_name: notif.sent_by_name || 'System',
            timestamp: notif.created_at,
            status: notif.delivery_status || 'sent'
          });
        }
      });

      // Sort by timestamp
      allMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      console.log(`✅ [EXPERT CHAT API] Loaded ${allMessages.length} messages from multiple sources`);
      res.json(allMessages);

    } catch (error) {
      console.error('❌ [EXPERT CHAT API] Error loading chat history:', error);
      res.status(500).json({ error: 'Failed to load chat history' });
    }
  });

  // Send Chat Message - Enterprise real-time delivery with cross-portal notifications
  app.post("/api/unified-chat/send", async (req, res) => {
    try {
      const { playerId, playerName, message, timestamp, channel } = req.body;
      
      if (!playerId || !playerName || !message) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      console.log(`📤 [EXPERT CHAT API] Processing enterprise message from ${playerName} (${playerId}):`, message);

      // Use working supabase connection directly
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const messageTimestamp = timestamp || new Date().toISOString();

      // Store in primary GRE chat messages table
      const { data: savedMessage, error: chatError } = await supabase
        .from('gre_chat_messages')
        .insert([{
          player_id: parseInt(playerId),
          player_name: playerName,
          message: message,
          sender: 'player',
          sender_name: playerName,
          timestamp: messageTimestamp,
          status: 'sent'
        }])
        .select()
        .single();

      if (chatError) {
        console.error('❌ [EXPERT CHAT API] Chat message save error:', chatError);
        return res.status(500).json({ error: 'Failed to save chat message' });
      }

      // Store in push notifications for cross-portal visibility
      const { error: notifError } = await supabase
        .from('push_notifications')
        .insert([{
          title: 'Player Message',
          message: message,
          target_audience: `player_${playerId}`,
          sent_by: `player_${playerId}@pokerroom.com`,
          sent_by_name: playerName,
          sent_by_role: 'player',
          sender_id: playerId,
          delivery_status: 'sent',
          created_at: messageTimestamp,
          sent_at: messageTimestamp
        }]);

      if (notifError) {
        console.warn('⚠️ [EXPERT CHAT API] Push notification save warning:', notifError);
      }

      // Real-time delivery via Pusher Channels
      try {
        const pusherPayload = {
          channel: `player-${playerId}`,
          event: 'new-message',
          data: { 
            message: {
              id: savedMessage.id,
              message: savedMessage.message,
              sender: 'player',
              sender_name: playerName,
              timestamp: savedMessage.created_at,
              status: 'sent'
            }
          }
        };

        await pusher.trigger(pusherPayload.channel, pusherPayload.event, pusherPayload.data);
        console.log(`✅ [EXPERT CHAT API] Pusher delivery successful to ${pusherPayload.channel}`);

        // Notify staff portal via separate channel
        await pusher.trigger('staff-portal', 'new-player-message', {
          playerId,
          playerName,
          message,
          timestamp: messageTimestamp
        });
        console.log('✅ [EXPERT CHAT API] Staff portal notified via Pusher');

      } catch (pusherError) {
        console.error('❌ [EXPERT CHAT API] Pusher delivery error:', pusherError);
      }

      // Send OneSignal push notification to staff
      try {
        const notificationBody = {
          app_id: process.env.ONESIGNAL_APP_ID!,
          contents: { 'en': `${playerName}: ${message}` },
          headings: { 'en': 'New Player Message' },
          included_segments: ['Staff Portal Users'],
          data: {
            type: 'chat_message',
            playerId,
            playerName,
            message
          }
        };
        
        await oneSignalClient.createNotification(notificationBody);
        console.log('✅ [EXPERT CHAT API] OneSignal notification sent to staff');

      } catch (oneSignalError) {
        console.error('❌ [EXPERT CHAT API] OneSignal error:', oneSignalError);
      }

      res.json({ 
        success: true, 
        data: {
          id: savedMessage.id,
          message: savedMessage.message,
          sender: 'player',
          sender_name: playerName,
          timestamp: savedMessage.created_at,
          status: 'sent'
        },
        message: "Enterprise message sent with cross-portal delivery"
      });

    } catch (error) {
      console.error('❌ [EXPERT CHAT API] Unexpected error:', error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  // Initialize Chat Session - Start new GRE chat session
  app.post("/api/chat/start-session", async (req, res) => {
    try {
      const { playerId, playerName } = req.body;
      
      if (!playerId || !playerName) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      console.log(`🎯 [CHAT SESSION] Starting new session for ${playerName} (${playerId})`);

      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      // Create new chat session
      const { data: session, error } = await supabase
        .from('gre_chat_sessions')
        .insert([{
          player_id: playerId,
          player_name: playerName,
          status: 'waiting',
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) {
        console.error('❌ [CHAT SESSION] Error creating session:', error);
        return res.status(500).json({ error: 'Failed to create chat session' });
      }

      // Notify staff about new chat request
      await pusher.trigger('staff-portal', 'new-chat-request', {
        sessionId: session.id,
        playerId,
        playerName,
        timestamp: session.created_at
      });

      console.log(`✅ [CHAT SESSION] Session ${session.id} created for player ${playerName}`);
      res.json({ 
        success: true, 
        sessionId: session.id,
        status: 'waiting'
      });

    } catch (error) {
      console.error('❌ [CHAT SESSION] Error:', error);
      res.status(500).json({ error: "Failed to start chat session" });
    }
  });

  console.log('🚀 [PRODUCTION CHAT] All enterprise chat routes registered successfully');
}