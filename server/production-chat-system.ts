/**
 * 🚀 PRODUCTION-GRADE REAL-TIME CHAT SYSTEM
 * 100% Pusher Channels + OneSignal + Supabase Integration
 * August 3, 2025
 */

import express from 'express';
import Pusher from 'pusher';
import { supabase } from './db';
import postgres from 'postgres';

// Initialize services using environment secrets
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
});

// Use the established working Supabase client from the project
const staffPortalSupabase = supabase;

// Direct SQL connection for reliable INSERT operations (bypasses Supabase client issues)
const sql = postgres(process.env.DATABASE_URL!, {
  ssl: 'require'
});

export function setupProductionChatRoutes(app: express.Application) {

  // 🔧 TEST: Supabase INSERT operation test
  app.get('/api/production-chat/test', async (req, res) => {
    try {
      console.log('🧪 [TEST] Testing Supabase INSERT operation...');
      
      // First, test Supabase client connection
      const { data: connectionTest, error: connectionError } = await staffPortalSupabase
        .from('gre_chat_sessions')
        .select('id')
        .limit(1);

      if (connectionError) {
        console.error('❌ [TEST] Supabase connection failed:', connectionError);
        return res.json({ success: false, error: connectionError, errorDetails: JSON.stringify(connectionError) });
      }

      console.log('✅ [TEST] Supabase connection working, found sessions:', connectionTest?.length || 0);

      // Test INSERT on a different table to isolate the issue
      const { data: sessionData, error: sessionError } = await staffPortalSupabase
        .from('gre_chat_sessions')
        .insert({
          player_id: 99999,
          status: 'pending'
        })
        .select()
        .single();

      if (sessionError) {
        console.error('❌ [TEST] Session INSERT failed:', sessionError);
        return res.json({ success: false, error: sessionError, errorDetails: JSON.stringify(sessionError) });
      }

      // If session insert works, try message insert
      const { data, error } = await staffPortalSupabase
        .from('gre_chat_messages')
        .insert({
          session_id: sessionData.id,
          player_id: 29,
          message: 'Test with valid session_id',
          sender: 'player'
        })
        .select()
        .single();
        
      if (error) {
        console.error('❌ [TEST] INSERT failed:', error);
        console.error('❌ [TEST] Error type:', typeof error);
        console.error('❌ [TEST] Error keys:', Object.keys(error));
        return res.json({ success: false, error: error, errorDetails: JSON.stringify(error) });
      }
      
      console.log('✅ [TEST] INSERT successful:', data);
      return res.json({ success: true, message: 'INSERT working properly', insertedData: data });
      
    } catch (error: any) {
      console.error('❌ [TEST] INSERT exception:', error);
      return res.json({ success: false, exception: error.message });
    }
  });
  
  // 🚀 PRODUCTION: Send chat message endpoint
  app.post('/api/production-chat/send', async (req, res) => {
    try {
      const { playerId, message, senderType = 'player', playerName } = req.body;

      if (!playerId || !message) {
        return res.status(400).json({ success: false, error: 'playerId and message are required' });
      }

      console.log(`📨 [PRODUCTION] Sending message from ${senderType} ${playerId}: "${message}"`);

      // Step 1: Get or create active chat session
      let sessionId = null;
      const { data: existingSessions } = await staffPortalSupabase
        .from('gre_chat_sessions')
        .select('id')
        .eq('player_id', playerId)
        .eq('status', 'active')
        .limit(1);

      if (existingSessions && existingSessions.length > 0) {
        sessionId = existingSessions[0].id;
        console.log(`✅ [PRODUCTION] Using existing session: ${sessionId}`);
      } else {
        // Create new session using direct SQL (reliable)
        const newSessions = await sql`
          INSERT INTO gre_chat_sessions (player_id, status)
          VALUES (${playerId}, 'active')
          RETURNING id
        `;
        sessionId = newSessions[0].id;
        console.log(`✅ [PRODUCTION] Created new session: ${sessionId}`);
      }

      // Step 2: Insert message using direct SQL (bypasses Supabase client issues)
      const insertedMessage = await sql`
        INSERT INTO gre_chat_messages (session_id, player_id, player_name, message, sender, sender_name, timestamp)
        VALUES (${sessionId}, ${playerId}, ${playerName || 'Player'}, ${message}, ${senderType}, ${playerName || 'Player'}, ${new Date().toISOString()})
        RETURNING *
      `;

      const chatMessage = insertedMessage[0];
      console.log(`✅ [PRODUCTION] Message inserted with ID: ${chatMessage.id}`);

      // Step 3: Send real-time notification via Pusher Channels
      const channelName = `player-${playerId}`;
      await pusher.trigger(channelName, 'new-message', {
        id: chatMessage.id,
        sessionId: chatMessage.session_id,
        playerId: chatMessage.player_id,
        playerName: chatMessage.player_name,
        message: chatMessage.message,
        sender: chatMessage.sender,
        senderName: chatMessage.sender_name,
        timestamp: chatMessage.timestamp,
        status: chatMessage.status
      });

      console.log(`✅ [PRODUCTION] Pusher notification sent to channel: ${channelName}`);

      // Step 4: Send OneSignal push notification (if configured)
      if (process.env.ONESIGNAL_API_KEY && process.env.ONESIGNAL_APP_ID) {
        try {
          const fetch = (await import('node-fetch')).default;
          const oneSignalResponse = await fetch('https://onesignal.com/api/v1/notifications', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Basic ${process.env.ONESIGNAL_API_KEY}`
            },
            body: JSON.stringify({
              app_id: process.env.ONESIGNAL_APP_ID,
              filters: [{ field: 'tag', key: 'playerId', relation: '=', value: playerId.toString() }],
              headings: { en: 'New Chat Message' },
              contents: { en: message.substring(0, 100) }
            })
          });

          if (oneSignalResponse.ok) {
            console.log(`✅ [PRODUCTION] OneSignal push notification sent for player ${playerId}`);
          } else {
            console.warn(`⚠️ [PRODUCTION] OneSignal notification failed: ${oneSignalResponse.statusText}`);
          }
        } catch (pushError) {
          console.warn('⚠️ [PRODUCTION] OneSignal notification error:', pushError);
        }
      }

      return res.json({
        success: true,
        message: 'Chat message sent successfully',
        data: {
          id: chatMessage.id,
          sessionId: chatMessage.session_id,
          playerId: chatMessage.player_id,
          message: chatMessage.message,
          sender: chatMessage.sender,
          timestamp: chatMessage.timestamp,
          status: chatMessage.status
        }
      });

    } catch (error: any) {
      console.error('❌ [PRODUCTION] Send message error:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to send message',
        details: error.message
      });
    }
  });

  // 📋 PRODUCTION: Get chat messages for a player
  app.get('/api/production-chat/messages/:playerId', async (req, res) => {
    try {
      const { playerId } = req.params;

      if (!playerId) {
        return res.status(400).json({ success: false, error: 'playerId is required' });
      }

      console.log(`📋 [PRODUCTION] Getting chat messages for player: ${playerId}`);

      // Get messages using direct SQL (reliable) - query directly by player_id
      const playerIdInt = parseInt(playerId);
      const messages = await sql`
        SELECT 
          id,
          session_id,
          player_id,
          player_name,
          message,
          sender,
          sender_name,
          timestamp,
          status
        FROM gre_chat_messages
        WHERE player_id = ${playerIdInt}
        ORDER BY timestamp ASC
      `;

      console.log(`✅ [PRODUCTION] Retrieved ${messages.length} messages for player ${playerId}`);

      return res.json(messages.map(msg => ({
        id: msg.id,
        message: msg.message,
        sender: msg.sender,
        sender_name: msg.sender_name,
        timestamp: msg.timestamp,
        status: msg.status
      })));

    } catch (error: any) {
      console.error('❌ [PRODUCTION] Get messages error:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to retrieve messages',
        details: error.message
      });
    }
  });

  // 🚀 GRE → PLAYER: Send Message with Real-time Broadcast + Push Notification  
  app.post('/api/production-chat/gre-send', async (req, res) => {
    try {
      const { sessionId, playerId, message, greName, greId } = req.body;
      
      if (!sessionId || !playerId || !message || !greName) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      console.log('🚀 [PRODUCTION CHAT] GRE message:', { sessionId, playerId, greName, messageLength: message.length });

      // 1. DATABASE: Save GRE message
      const { data: savedMessage, error: messageError } = await staffPortalSupabase
        .from('gre_chat_messages')
        .insert([{
          session_id: sessionId,
          player_id: parseInt(playerId),
          message: message,
          sender: 'gre',
          sender_name: greName,
          timestamp: new Date().toISOString(),
          status: 'sent'
        }])
        .select()
        .single();

      if (messageError) {
        console.error('❌ [PRODUCTION CHAT] GRE message save failed:', messageError);
        return res.status(500).json({ error: 'Failed to save message' });
      }

      // 2. PUSHER: Real-time broadcast to player
      try {
        await pusher.trigger(`player-${playerId}`, 'new-message', {
          message: savedMessage,
          sender: 'gre',
          senderName: greName,
          timestamp: new Date().toISOString()
        });
        console.log('🚀 [PUSHER] Message sent to player channel');

        // Staff confirmation
        await pusher.trigger('staff-portal', 'message-confirmed', {
          messageId: savedMessage.id,
          playerId: playerId,
          status: 'delivered'
        });

      } catch (pusherError) {
        console.error('❌ [PUSHER] Player broadcast failed:', pusherError);
      }

      // 3. ONESIGNAL: Push notification to player
      try {
        const oneSignalPayload = {
          app_id: process.env.ONESIGNAL_APP_ID,
          filters: [
            { field: 'tag', key: 'player_id', relation: '=', value: playerId.toString() }
          ],
          headings: { en: 'New Message from Guest Relations' },
          contents: { 
            en: `${greName}: ${message.length > 50 ? message.substring(0, 50) + '...' : message}` 
          },
          data: {
            type: 'chat_message',
            sessionId: sessionId,
            greName: greName,
            action: 'open_chat'
          },
          priority: 10
        };

        const oneSignalResponse = await fetch('https://onesignal.com/api/v1/notifications', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${process.env.ONESIGNAL_API_KEY}`
          },
          body: JSON.stringify(oneSignalPayload)
        });

        if (oneSignalResponse.ok) {
          const notificationResult = await oneSignalResponse.json();
          console.log('🔔 [ONESIGNAL] Player notification sent:', notificationResult.id);
        } else {
          const errorText = await oneSignalResponse.text();
          console.error('❌ [ONESIGNAL] Player notification failed:', errorText);
        }
      } catch (notificationError) {
        console.error('❌ [ONESIGNAL] Player notification error:', notificationError);
      }

      console.log('✅ [PRODUCTION CHAT] GRE message complete');
      res.json({ 
        success: true, 
        message: savedMessage,
        pusherChannel: `player-${playerId}`
      });
      
    } catch (error: any) {
      console.error('❌ [PRODUCTION CHAT] GRE send error:', error);
      res.status(500).json({ error: 'Internal server error', details: error.message });
    }
  });



  // 📋 GET: Active chat sessions for staff portal
  app.get('/api/production-chat/sessions', async (req, res) => {
    try {
      const { data: sessions, error } = await staffPortalSupabase
        .from('gre_chat_sessions')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ [PRODUCTION CHAT] Sessions fetch failed:', error);
        return res.status(500).json({ error: 'Failed to fetch sessions' });
      }

      console.log(`📋 [PRODUCTION CHAT] Retrieved ${sessions?.length || 0} active sessions`);
      res.json(sessions || []);
      
    } catch (error: any) {
      console.error('❌ [PRODUCTION CHAT] Sessions error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  console.log('🚀 [PRODUCTION CHAT] All routes registered successfully');
}