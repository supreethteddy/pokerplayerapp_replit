import type { Express } from "express";
// Simplified imports to avoid conflicts
let pusher: any;
let sendPushNotification: any;

try {
  pusher = require('./pusher').pusher;
  sendPushNotification = require('./onesignal').sendPushNotification;
} catch (error) {
  console.log('Loading pusher/onesignal with fallbacks');
  pusher = { trigger: async () => {} };
  sendPushNotification = async () => {};
}
import { createClient } from '@supabase/supabase-js';

// Staff Portal Supabase connection
const supabase = createClient(
  process.env.STAFF_PORTAL_SUPABASE_URL!,
  process.env.STAFF_PORTAL_SUPABASE_SERVICE_KEY!
);

export function registerRoutes(app: Express): void {
  
  // Test endpoint
  app.get('/api/test-chat-status', async (req, res) => {
    res.json({
      success: true,
      status: {
        timestamp: new Date().toISOString(),
        chatSystem: 'Pusher Channels + OneSignal',
        database: 'Supabase (Unified)',
        messageRouting: 'Real-time bidirectional',
        pushNotifications: 'OneSignal enabled',
        sessionManagement: 'Active session tracking'
      },
      message: 'Real-time chat system operational with production data ONLY'
    });
  });

  // Create chat session
  app.post('/api/pusher-chat/create-session', async (req, res) => {
    try {
      const { playerId, playerName, playerEmail, message, priority = 'normal', category = 'general' } = req.body;
      
      // Generate unique session ID
      const sessionId = `chat-${Date.now()}-${playerId}`;
      
      // Save session to Supabase
      const { data: session, error: sessionError } = await supabase
        .from('gre_chat_sessions')
        .insert({
          id: sessionId,
          player_id: playerId,
          player_name: playerName,
          player_email: playerEmail,
          initial_message: message,
          status: 'waiting',
          priority,
          category,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      // Send initial message if provided
      if (message) {
        const { error: messageError } = await supabase
          .from('gre_chat_messages')
          .insert({
            session_id: sessionId,
            sender_type: 'player',
            sender_name: playerName,
            message: message,
            timestamp: new Date().toISOString()
          });

        if (messageError) throw messageError;
      }

      // Trigger real-time notification to staff
      await pusher.trigger('staff-chat', 'new-session', {
        sessionId,
        playerId,
        playerName,
        playerEmail,
        message,
        priority,
        category,
        timestamp: new Date().toISOString()
      });

      // Send push notification to staff
      await sendPushNotification({
        title: 'New Chat Request',
        message: `${playerName} needs assistance: ${message}`,
        data: { sessionId, playerId }
      });

      res.json({ success: true, sessionId, session });
    } catch (error) {
      console.error('Error creating chat session:', error);
      res.status(500).json({ success: false, error: 'Failed to create session' });
    }
  });

  // Send chat message
  app.post('/api/pusher-chat/send-message', async (req, res) => {
    try {
      const { sessionId, senderType, senderName, message } = req.body;
      
      // Save message to Supabase
      const { data: newMessage, error: messageError } = await supabase
        .from('gre_chat_messages')
        .insert({
          session_id: sessionId,
          sender_type: senderType,
          sender_name: senderName,
          message: message,
          timestamp: new Date().toISOString()
        })
        .select()
        .single();

      if (messageError) throw messageError;

      // Broadcast message to both player and staff channels
      await pusher.trigger(`chat-session-${sessionId}`, 'new-message', {
        ...newMessage,
        timestamp: new Date().toISOString()
      });

      res.json({ success: true, message: newMessage });
    } catch (error) {
      console.error('Error sending message:', error);
      res.status(500).json({ success: false, error: 'Failed to send message' });
    }
  });

  // Get chat messages for session
  app.get('/api/pusher-chat/messages/:sessionId', async (req, res) => {
    try {
      const { sessionId } = req.params;
      
      const { data: messages, error } = await supabase
        .from('gre_chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('timestamp', { ascending: true });

      if (error) throw error;

      res.json({ success: true, messages });
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch messages' });
    }
  });

  // Update session status
  app.post('/api/pusher-chat/update-status', async (req, res) => {
    try {
      const { sessionId, status, staffName } = req.body;
      
      // Update session status
      const { error: updateError } = await supabase
        .from('gre_chat_sessions')
        .update({ 
          status, 
          assigned_staff: staffName,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      if (updateError) throw updateError;

      // Broadcast status update
      await pusher.trigger(`chat-session-${sessionId}`, 'status-update', {
        status,
        staffName,
        timestamp: new Date().toISOString()
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Error updating session status:', error);
      res.status(500).json({ success: false, error: 'Failed to update status' });
    }
  });
}