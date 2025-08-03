import type { Express } from 'express';

export const registerChatSystemApis = (app: Express) => {
  console.log('🎯 [CHAT SYSTEM] Registering chat APIs...');

  // Chat History API - Load existing messages
  app.get("/api/unified-chat/messages/:playerId", async (req, res) => {
    try {
      const { playerId } = req.params;
      console.log(`📖 [EXPERT CHAT API] Loading chat history for player ${playerId}`);

      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      // Fetch from multiple sources and combine
      const [gre_messages, chat_requests, push_notifications] = await Promise.all([
        supabase.from('gre_chat_messages').select('*').eq('player_id', parseInt(playerId)),
        supabase.from('chat_requests').select('*').eq('player_id', parseInt(playerId)),
        supabase.from('push_notifications').select('*').eq('target_audience', `player_${playerId}`)
      ]);

      // Combine all messages
      const allMessages: any[] = [];

      // Add GRE messages
      gre_messages.data?.forEach(msg => {
        allMessages.push({
          id: msg.id,
          message: msg.message,
          sender: msg.sender || 'gre',
          sender_name: msg.sender_name || msg.player_name || 'Guest Relations',
          timestamp: msg.timestamp || msg.created_at,
          status: msg.status || 'sent'
        });
      });

      // Add chat requests as messages
      chat_requests.data?.forEach(req => {
        if (req.message && req.message.length > 0) {
          allMessages.push({
            id: `req-${req.id}`,
            message: req.message,
            sender: 'player',
            sender_name: req.player_name || 'Player',
            timestamp: req.created_at,
            status: req.status || 'sent'
          });
        }
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

  // Send Chat Message - DISABLED: Using ULTIMATE CHAT FIX in deep-fix-apis.ts
  console.log('✅ [CHAT-SYSTEM] Chat send endpoint disabled - using ULTIMATE CHAT FIX');

  console.log('✅ [CHAT SYSTEM] Chat system APIs registered successfully');
};