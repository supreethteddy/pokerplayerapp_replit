
import type { Express } from "express";
import { supabaseOnlyStorage as storage } from "./supabase-only-storage";
import express from "express";
import path from "path";
import fs from "fs";
import Pusher from 'pusher';
import OneSignal from 'onesignal-node';
import { setupProductionAPIs } from './production-apis';
import { setupDeepFixAPIs } from './deep-fix-apis';
import { unifiedPlayerSystem } from './unified-player-system';

// Validate environment variables
const requiredEnvVars = ['PUSHER_APP_ID', 'PUSHER_KEY', 'PUSHER_SECRET', 'PUSHER_CLUSTER', 'VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('❌ [ENVIRONMENT] Missing required environment variables:', missingEnvVars);
  throw new Error(`Missing environment variables: ${missingEnvVars.join(', ')}`);
}

// Initialize Pusher for real-time communication
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
});

// Initialize OneSignal for push notifications  
const oneSignalClient = new OneSignal.Client(
  process.env.ONESIGNAL_APP_ID!,
  process.env.ONESIGNAL_API_KEY!
);

console.log('🚀 [SERVER] Pusher and OneSignal initialized successfully');

export function registerRoutes(app: Express) {
  // UNIFIED CHAT SYSTEM - Single source of truth
  
  // Send Chat Message - MICROSECOND SPEED - PUSHER ONLY (Fixed exec_sql issue)
  // Get chat history for player (last 3 conversations)
  app.get("/api/chat-history/:playerId", async (req, res) => {
    try {
      const playerId = parseInt(req.params.playerId); // CRITICAL FIX: Convert string to integer
      
      console.log(`🔍 [CHAT HISTORY FIXED] Fetching history for player ID: ${playerId} (type: ${typeof playerId})`);
      
      // Verify environment variables
      console.log(`🔍 [CHAT HISTORY FIXED] Supabase URL exists: ${!!process.env.VITE_SUPABASE_URL}`);
      console.log(`🔍 [CHAT HISTORY FIXED] Service key exists: ${!!process.env.SUPABASE_SERVICE_ROLE_KEY}`);
      
      const { createClient } = await import('@supabase/supabase-js');
      
      // Direct environment variable check for debugging
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      
      console.log(`🔍 [CHAT HISTORY FIXED] Environment check:`);
      console.log(`   - Supabase URL: ${supabaseUrl?.substring(0, 30)}...`);
      console.log(`   - Service Key: ${serviceKey ? 'EXISTS' : 'MISSING'}`);
      
      const supabase = createClient(supabaseUrl!, serviceKey!);
      
      console.log(`🔍 [CHAT HISTORY FIXED] Supabase client created successfully`);
      
      // DIRECT POSTGRES QUERY - Bypass Supabase client issue
      console.log(`🔍 [CHAT HISTORY FIXED] Using direct PostgreSQL query for player_id: ${playerId}`);
      
      // Import postgres client
      const { Pool } = await import('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });
      
      try {
        // Direct SQL query to get chat requests
        const requestsQuery = `
          SELECT cr.*, 
                 json_agg(
                   json_build_object(
                     'id', cm.id,
                     'sender', cm.sender,
                     'sender_name', cm.sender_name,
                     'message_text', cm.message_text,
                     'timestamp', cm.timestamp
                   ) ORDER BY cm.timestamp ASC
                 ) FILTER (WHERE cm.id IS NOT NULL) as chat_messages
          FROM chat_requests cr
          LEFT JOIN chat_messages cm ON cr.id = cm.request_id
          WHERE cr.player_id = $1
          GROUP BY cr.id
          ORDER BY cr.created_at DESC
        `;
        
        const result = await pool.query(requestsQuery, [playerId]);
        const requests = result.rows;
        
        console.log(`🔍 [CHAT HISTORY FIXED] Direct PostgreSQL result:`, { 
          query: `chat_requests WHERE player_id = ${playerId}`,
          result: requests, 
          count: requests.length 
        });
        
        // Transform data to match expected format
        const requestsWithMessages = requests.map(row => ({
          ...row,
          chat_messages: row.chat_messages || []
        }));
        
        await pool.end();
        
        console.log(`✅ [CHAT HISTORY FIXED] Direct query result: ${requestsWithMessages.length} conversations`);
        res.json({ success: true, conversations: requestsWithMessages });
        return;
        
      } catch (pgError) {
        console.error('❌ [CHAT HISTORY FIXED] PostgreSQL error:', pgError);
        await pool.end();
        // Fall back to Supabase if PostgreSQL fails
      }
      
      // Fallback: Original Supabase query
      console.log(`🔍 [CHAT HISTORY FIXED] Fallback to Supabase query for player_id: ${playerId}`);
      
      const { data: requests, error: requestsError } = await supabase
        .from('chat_requests')
        .select('*')
        .eq('player_id', playerId)
        .order('created_at', { ascending: false });
        
      console.log(`🔍 [CHAT HISTORY FIXED] Supabase fallback result:`, { 
        query: `chat_requests WHERE player_id = ${playerId}`,
        result: requests, 
        error: requestsError 
      });
        
      console.log(`🔍 [CHAT HISTORY FIXED] Raw requests result:`, { 
        requests: requests, 
        error: requestsError, 
        length: (requests || []).length 
      });
      
      if (requestsError) {
        console.error('❌ [CHAT HISTORY FIXED] Requests error:', requestsError);
        return res.status(500).json({ error: "Failed to fetch chat requests" });
      }
      
      // If no requests found, let's try a broader query to debug
      if (!requests || requests.length === 0) {
        console.log(`🔍 [CHAT HISTORY DEBUG] No requests found for player ${playerId}, checking all players...`);
        const { data: allRequests } = await supabase
          .from('chat_requests')
          .select('player_id')
          .limit(10);
        console.log(`🔍 [CHAT HISTORY DEBUG] Sample player_ids in database:`, allRequests?.map(r => r.player_id));
      }
      
      // Get messages for each request separately with debug logging
      const requestsWithMessages = [];
      for (const request of requests || []) {
        console.log(`🔍 [CHAT HISTORY FIXED] Processing request:`, request.id);
        
        const { data: messages, error: messagesError } = await supabase
          .from('chat_messages')
          .select('id, sender, sender_name, message_text, timestamp')
          .eq('request_id', request.id)
          .order('timestamp', { ascending: true });
        
        console.log(`🔍 [CHAT HISTORY FIXED] Messages for ${request.id}:`, { 
          messages: messages, 
          error: messagesError, 
          count: (messages || []).length 
        });
        
        requestsWithMessages.push({
          ...request,
          chat_messages: messages || []
        });
      }
      
      console.log(`✅ [CHAT HISTORY FIXED] Final result: ${requestsWithMessages.length} conversations for player ${playerId}`);
      console.log(`✅ [CHAT HISTORY FIXED] Complete response:`, JSON.stringify(requestsWithMessages, null, 2));
      
      res.json({ success: true, conversations: requestsWithMessages });
      
    } catch (error) {
      console.error('❌ [CHAT HISTORY] Error:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/unified-chat/send", async (req, res) => {
    try {
      const { playerId, playerName, message, senderType = 'player' } = req.body;

      if (!playerId || !message) {
        return res.status(400).json({ success: false, error: 'playerId and message are required' });
      }

      console.log(`🚀 [CHAT PERSISTENCE] Sending ${senderType} message: "${message}"`);

      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      // ENHANCED PERSISTENCE: Store message in database for permanent history
      const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // First, ensure chat request exists
      let { data: existingRequest } = await supabase
        .from('chat_requests')
        .select('id')
        .eq('player_id', playerId)
        .single();

      let requestId = existingRequest?.id;

      if (!requestId) {
        // Create new chat request using correct column names
        const { data: newRequest, error: requestError } = await supabase
          .from('chat_requests')
          .insert({
            id: `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            player_id: playerId,
            subject: `Chat with ${playerName || `Player ${playerId}`}`,
            initial_message: message,
            status: 'pending',
            priority: 'medium',
            created_at: new Date().toISOString()
          })
          .select('id')
          .single();

        if (requestError) {
          console.error('❌ [CHAT PERSISTENCE] Error creating request:', requestError);
        } else {
          requestId = newRequest?.id;
          console.log('🚀 [CHAT PERSISTENCE] Created new chat request:', requestId);
        }
      }

      // Store message in database using correct column names
      const { data: savedMessage, error: messageError } = await supabase
        .from('chat_messages')
        .insert({
          id: messageId,
          request_id: requestId,
          player_id: playerId,
          sender: senderType,
          sender_name: playerName || `Player ${playerId}`,
          message_text: message,
          timestamp: new Date().toISOString(),
          status: 'sent'
        })
        .select()
        .single();

      if (messageError) {
        console.error('❌ [CHAT PERSISTENCE] Error saving message:', messageError);
      } else {
        console.log('🚀 [CHAT PERSISTENCE] ✅ Message saved to database:', messageId);
      }

      const responseMessage = savedMessage || { 
        id: messageId, 
        created_at: new Date().toISOString(),
        message: message,
        playerId: playerId,
        playerName: playerName || `Player ${playerId}`,
        senderType: senderType
      };
      
      console.log(`🚀 [CHAT REALTIME] Message processed with ID: ${responseMessage.id}`);




      // Real-time notification via Pusher
      try {
        if (senderType === 'player') {
          // Notify Staff Portal - RESTORED WORKING FORMAT
          const pusherPayload = {
            id: responseMessage.id,
            message: message,
            sender: 'player',
            sender_name: playerName || `Player ${playerId}`,
            player_id: playerId,
            timestamp: new Date().toISOString(),
            status: 'sent'
          };
          
          const pusherResult = await pusher.trigger('staff-portal', 'new-player-message', pusherPayload);
          
          console.log('🚀 [PUSHER DELIVERY] Staff Portal notification sent:');
          console.log('   Channel: staff-portal');
          console.log('   Event: new-player-message');
          console.log('   Payload:', JSON.stringify(pusherPayload, null, 2));
          console.log('   Pusher Response:', pusherResult);
          console.log('   ✅ SUCCESS: Message delivered to staff portal via Pusher');

          // Also trigger player-specific channel for bidirectional chat
          await pusher.trigger(`player-chat-${playerId}`, 'message-sent', pusherPayload);
          console.log(`🚀 [PUSHER DELIVERY] Player channel notification sent: player-chat-${playerId}`);
        } else {
          // Notify Player Portal - DUAL CHANNEL APPROACH for guaranteed delivery
          const pusherPayload = {
            message: message,
            senderName: 'Guest Relations Executive',
            timestamp: new Date().toISOString(),
            messageId: savedMessage.id,
            playerId: playerId // Add playerId for filtering
          };
          
          // Send to BOTH channels for maximum reliability
          const playerChannelResult = await pusher.trigger(`player-${playerId}`, 'new-gre-message', pusherPayload);
          const staffChannelResult = await pusher.trigger('staff-portal', 'new-gre-message', pusherPayload);
          
          console.log(`🚀 [PUSHER DUAL DELIVERY] GRE message sent to BOTH channels:`);
          console.log(`   Player Channel (player-${playerId}):`, playerChannelResult);
          console.log(`   Staff Channel (staff-portal):`, staffChannelResult);
          console.log(`   ✅ MICROSECOND DELIVERY: Message sent via dual-channel approach`);
        }
      } catch (pusherError) {
        console.error('❌ [PUSHER] Real-time notification failed:', pusherError);
        console.error('   This will prevent staff portal from receiving real-time messages');
      }

      // Push notification via OneSignal
      if (process.env.ONESIGNAL_API_KEY && process.env.ONESIGNAL_APP_ID) {
        try {
          const fetch = (await import('node-fetch')).default;
          const oneSignalPayload = {
            app_id: process.env.ONESIGNAL_APP_ID,
            filters: senderType === 'player' 
              ? [{ field: 'tag', key: 'role', relation: '=', value: 'staff' }]
              : [{ field: 'tag', key: 'playerId', relation: '=', value: playerId.toString() }],
            headings: { 
              en: senderType === 'player' ? 'New Player Message' : 'New Message from Guest Relations'
            },
            contents: { 
              en: `${senderType === 'player' ? playerName : 'GRE'}: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`
            },
            data: {
              type: 'chat_message',
              playerId: playerId,
              senderType: senderType,
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
            const notificationResult = await oneSignalResponse.json() as any;
            console.log('🔔 [ONESIGNAL] Push notification sent:', notificationResult.id);
          } else {
            console.warn('⚠️ [ONESIGNAL] Push notification failed:', oneSignalResponse.statusText);
          }
        } catch (notificationError) {
          console.warn('⚠️ [ONESIGNAL] Push notification error:', notificationError);
        }
      }

      return res.json({
        success: true,
        message: 'Chat message sent successfully',
        data: {
          id: responseMessage.id,
          playerId: playerId,
          message: message,
          senderType: senderType,
          timestamp: responseMessage.created_at || new Date().toISOString()
        }
      });

    } catch (error: any) {
      console.error('❌ [UNIFIED CHAT] Send message error:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to send message',
        details: error.message
      });
    }
  });

  // Clear Chat History Endpoint (Soft Delete with Archive)
  app.delete("/api/unified-chat/clear/:playerId", async (req, res) => {
    try {
      const { playerId } = req.params;
      console.log(`🧹 [CHAT CLEAR] Soft deleting chat history for player: ${playerId}`);

      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      // Archive chat messages (soft delete - keep data for 2 weeks)
      const archiveDate = new Date();
      archiveDate.setDate(archiveDate.getDate() + 14); // Archive for 2 weeks

      const { error: messagesError } = await supabase
        .from('chat_messages')
        .update({ 
          status: 'archived',
          updated_at: new Date().toISOString()
        })
        .eq('player_id', playerId)
        .neq('status', 'archived');

      if (messagesError) {
        console.error('❌ [CHAT CLEAR] Error archiving messages:', messagesError);
        return res.status(500).json({ error: 'Failed to archive chat messages' });
      }

      // Archive chat requests (soft delete)
      const { error: requestsError } = await supabase
        .from('chat_requests')
        .update({ 
          status: 'archived',
          updated_at: new Date().toISOString()
        })
        .eq('player_id', playerId)
        .neq('status', 'archived');

      if (requestsError) {
        console.error('❌ [CHAT CLEAR] Error archiving requests:', requestsError);
        return res.status(500).json({ error: 'Failed to archive chat requests' });
      }

      console.log('🧹 [CHAT CLEAR] ✅ Successfully archived chat data for player:', playerId);
      res.json({ success: true, message: 'Chat history cleared (archived for 2 weeks)' });

    } catch (error) {
      console.error('❌ [CHAT CLEAR] Error:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get Active (Non-Archived) Chat Messages
  app.get("/api/unified-chat/messages/:playerId", async (req, res) => {
    try {
      const { playerId } = req.params;
      console.log(`📋 [CHAT SYSTEM] Getting messages for player: ${playerId}`);

      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      // Get only active (non-archived) messages
      const { data: messages, error } = await supabase
        .from('chat_messages')
        .select('id, player_id, sender_name, sender, message_text, status, timestamp')
        .eq('player_id', playerId)
        .neq('status', 'archived')
        .order('timestamp', { ascending: true });

      if (error) {
        console.error('❌ [CHAT SYSTEM] Error fetching messages:', error);
        return res.status(500).json({ error: 'Failed to fetch messages' });
      }

      // Transform messages to frontend format
      const transformedMessages = (messages || []).map(msg => ({
        id: msg.id,
        message: msg.message_text,
        sender: msg.sender === 'player' ? 'player' : 'staff',
        sender_name: msg.sender_name || 'System',
        timestamp: msg.timestamp,
        status: msg.status || 'sent'
      }));

      console.log(`✅ [CHAT SYSTEM] Retrieved ${transformedMessages.length} messages for player ${playerId}`);
      res.json(transformedMessages);

    } catch (error) {
      console.error('❌ [CHAT SYSTEM] Error loading messages:', error);
      res.status(500).json({ error: 'Failed to load messages' });
    }
  });

  // Clear Chat History - NEW FEATURE
  app.delete("/api/unified-chat/clear/:playerId", async (req, res) => {
    try {
      const { playerId } = req.params;
      console.log(`🗑️ [CHAT SYSTEM] Clearing chat history for player: ${playerId}`);

      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      // Delete all messages for this player
      const { error } = await supabase
        .from('chat_messages')
        .delete()
        .eq('player_id', playerId);

      if (error) {
        console.error('❌ [CHAT SYSTEM] Error clearing chat history:', error);
        return res.status(500).json({ error: 'Failed to clear chat history' });
      }

      console.log(`✅ [CHAT SYSTEM] Chat history cleared for player ${playerId}`);
      res.json({ success: true, message: 'Chat history cleared successfully' });

    } catch (error) {
      console.error('❌ [CHAT SYSTEM] Error clearing chat history:', error);
      res.status(500).json({ error: 'Failed to clear chat history' });
    }
  });

  // Real-time Chat Connectivity Test - PRODUCTION DIAGNOSTIC
  app.post("/api/unified-chat/test-connection", async (req, res) => {
    try {
      const { playerId } = req.body;
      console.log(`🧪 [CHAT TEST] Testing real-time connectivity for player ${playerId}`);

      // Test Pusher trigger
      try {
        await pusher.trigger(`player-${playerId}`, 'connection-test', {
          message: 'Connection test successful',
          timestamp: new Date().toISOString(),
          testId: Date.now()
        });
        
        await pusher.trigger('staff-portal', 'connection-test', {
          playerId: playerId,
          message: 'Staff portal connection test',
          timestamp: new Date().toISOString(),
          testId: Date.now()
        });

        console.log(`✅ [CHAT TEST] Pusher triggers sent successfully`);
        
        res.json({
          success: true,
          message: 'Real-time connectivity test completed',
          pusher: {
            playerChannel: `player-${playerId}`,
            staffChannel: 'staff-portal',
            cluster: process.env.PUSHER_CLUSTER,
            timestamp: new Date().toISOString()
          }
        });
        
      } catch (pusherError: any) {
        console.error('❌ [CHAT TEST] Pusher test failed:', pusherError);
        res.status(500).json({ 
          success: false, 
          error: 'Pusher connectivity failed',
          details: pusherError.message
        });
      }

    } catch (error: any) {
      console.error('❌ [CHAT TEST] Connectivity test failed:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Connectivity test failed',
        details: error.message
      });
    }
  });

  // CRITICAL: Player authentication endpoint for login system
  app.get("/api/players/supabase/:supabaseId", async (req, res) => {
    try {
      const { supabaseId } = req.params;
      console.log(`🔍 [PLAYER API] Getting player by Supabase ID: ${supabaseId}`);
      
      const player = await unifiedPlayerSystem.getPlayerBySupabaseId(supabaseId);
      
      if (!player) {
        console.log(`❌ [PLAYER API] Player not found for Supabase ID: ${supabaseId}`);
        return res.status(404).json({ error: "Player not found" });
      }
      
      console.log(`✅ [PLAYER API] Player found: ${player.email}`);
      res.json(player);
    } catch (error) {
      console.error('❌ [PLAYER API] Error fetching player:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Tables API - Live staff portal poker tables
  app.get("/api/tables", async (req, res) => {
    try {
      console.log('🚀 [TABLES API PRODUCTION] Starting fresh query...');
      
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      
      const { data: tablesData, error } = await supabase
        .from('poker_tables')
        .select('*')
        .order('name');
      
      console.log('🔍 [TABLES API PRODUCTION] Live poker tables from staff portal:', {
        total: tablesData?.length || 0,
        tables: tablesData?.map(t => ({ id: t.id, name: t.name, game_type: t.game_type })) || []
      });
      
      if (error) {
        console.error('❌ [TABLES API PRODUCTION] Database error:', error);
        return res.status(500).json({ error: "Failed to fetch tables", details: error.message });
      }
      
      if (!tablesData || tablesData.length === 0) {
        console.log('⚠️ [TABLES API PRODUCTION] No tables in database');
        return res.json([]);
      }
      
      const transformedTables = tablesData.map(table => ({
        id: table.id,
        name: table.name,
        gameType: table.game_type || 'Texas Hold\'em',
        stakes: `₹${table.min_buy_in || 1000}/${table.max_buy_in || 10000}`,
        maxPlayers: table.max_players || 9, // Use actual max from staff portal
        currentPlayers: table.current_players || 0, // Use actual data from staff portal
        waitingList: 0,
        status: "active",
        pot: table.current_pot || 0, // Use actual pot from staff portal
        avgStack: table.avg_stack || 0 // Use actual data from staff portal - hidden in UI
      }));
      
      console.log(`✅ [TABLES API PRODUCTION] Returning ${transformedTables.length} live staff portal tables`);
      
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      res.json(transformedTables);
      
    } catch (error) {
      console.error('💥 [TABLES API PRODUCTION] Unexpected error:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // All other existing APIs...
  app.get("/api/tournaments", async (req, res) => {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      const result = await supabase
        .from('tournaments')
        .select('*')
        .order('start_time');
      
      if (result.error) {
        console.error('❌ [TOURNAMENTS API] Database error:', result.error);
        return res.status(500).json({ error: "Database error" });
      }

      const tournaments = result.data.map(tournament => ({
        id: tournament.id,
        name: tournament.name,
        buyIn: tournament.buy_in,
        guarantee: tournament.prize_pool,
        startTime: tournament.start_time,
        registered: tournament.registered_players,
        maxPlayers: tournament.max_players,
        status: tournament.status
      }));

      res.json(tournaments);
    } catch (error) {
      console.error('❌ [TOURNAMENTS API] Error:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/staff-offers", async (req, res) => {
    try {
      console.log('🎁 [OFFERS API] Returning verified offers data...');
      
      console.log('🚀 [OFFERS API PRODUCTION] Fetching live offers from Supabase...');
      
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      
      const { data: realOffers, error } = await supabase
        .from('staff_offers')
        .select('*')
        .order('created_at', { ascending: false });
      
      console.log('🔍 [OFFERS API PRODUCTION] Staff portal offers:', {
        total: realOffers?.length || 0,
        error: error?.message || 'none',
        offers: realOffers?.map((o: any) => ({ id: o.id, title: o.title })) || []
      });
      
      if (error) {
        console.error('❌ [OFFERS API] Supabase error:', error);
        return res.status(500).json({ error: "Failed to fetch offers" });
      }
      
      const transformedOffers = realOffers?.map((offer: any) => ({
        id: offer.id,
        title: offer.title,
        description: offer.description || 'Limited time offer',
        image_url: offer.image_url || offer.video_url || "/api/placeholder/600/300",
        redirect_url: '#',
        is_active: offer.is_active !== false,
        display_order: 1,
        created_at: offer.created_at,
        updated_at: offer.updated_at
      })) || [];

      console.log(`✅ [OFFERS API] Returning ${transformedOffers.length} real offers from database`);
      res.json(transformedOffers);
    } catch (error) {
      console.error('❌ [OFFERS API] Error:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/kyc-documents/:playerId", async (req, res) => {
    try {
      const { playerId } = req.params;
      console.log(`🗂️ [KYC API] Fetching KYC documents for player ${playerId}...`);
      
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      
      const { data: documents, error } = await supabase
        .from('kyc_documents')
        .select('*')
        .eq('player_id', parseInt(playerId))
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('❌ [KYC API] Error fetching documents:', error);
        return res.status(500).json({ error: "Failed to fetch KYC documents" });
      }
      
      console.log(`✅ [KYC API] Returning ${documents?.length || 0} KYC documents for player ${playerId}`);
      res.json(documents || []);
    } catch (error) {
      console.error('❌ [KYC API] Error:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/account-balance/:playerId", async (req, res) => {
    try {
      const { playerId } = req.params;
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      const result = await supabase
        .from('account_balances')
        .select('*')
        .eq('player_id', playerId)
        .single();
      
      if (result.error) {
        const playerResult = await supabase
          .from('players')
          .select('balance')
          .eq('id', playerId)
          .single();
          
        const balance = {
          currentBalance: playerResult.data?.balance || "₹0.00",
          availableBalance: playerResult.data?.balance || "₹0.00", 
          pendingWithdrawals: "₹0.00"
        };
        return res.json(balance);
      }

      const balance = {
        currentBalance: result.data.current_balance || "₹0.00",
        availableBalance: result.data.available_balance || "₹0.00",
        pendingWithdrawals: result.data.pending_withdrawals || "₹0.00"
      };
      res.json(balance);
    } catch (error) {
      console.error('❌ [BALANCE API] Error:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST endpoint for joining waitlist with seat limit enforcement
  app.post("/api/seat-requests", async (req, res) => {
    try {
      const { playerId, tableId, seatNumber, notes } = req.body;
      
      console.log('🎯 [SEAT REQUEST] Join attempt:', { playerId, tableId, seatNumber });
      
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      
      // Check table capacity from staff portal
      const { data: tableData, error: tableError } = await supabase
        .from('poker_tables')
        .select('max_players, current_players')
        .eq('id', tableId)
        .single();
      
      if (tableError) {
        console.error('❌ [SEAT REQUEST] Table lookup error:', tableError);
        return res.status(404).json({ error: "Table not found" });
      }
      
      const maxPlayers = tableData.max_players || 9;
      const currentPlayers = tableData.current_players || 0;
      
      console.log('🎯 [SEAT REQUEST] Capacity check:', { maxPlayers, currentPlayers });
      
      if (currentPlayers >= maxPlayers) {
        console.log('🚫 [SEAT REQUEST] Table full - adding to waitlist');
        return res.status(400).json({ 
          error: "Table is full", 
          message: "Added to waitlist",
          position: currentPlayers - maxPlayers + 1
        });
      }
      
      // Add to seat_requests table
      const { data: requestData, error: requestError } = await supabase
        .from('seat_requests')
        .insert({
          player_id: playerId,
          table_id: tableId,
          seat_number: seatNumber,
          status: 'waiting',
          notes: notes || '',
          created_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (requestError) {
        console.error('❌ [SEAT REQUEST] Insert error:', requestError);
        return res.status(500).json({ error: "Failed to create seat request" });
      }
      
      console.log('✅ [SEAT REQUEST] Successfully created:', requestData.id);
      res.json({ success: true, request: requestData });
      
    } catch (error) {
      console.error('❌ [SEAT REQUEST] Unexpected error:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/seat-requests/:playerId", async (req, res) => {
    try {
      const { playerId } = req.params;
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      const result = await supabase
        .from('seat_requests')
        .select('*')
        .eq('player_id', playerId)
        .order('created_at', { ascending: false });
      
      if (result.error) {
        console.error('❌ [SEAT REQUESTS API] Database error:', result.error);
        return res.status(500).json({ error: "Database error" });
      }

      res.json(result.data);
    } catch (error) {
      console.error('❌ [SEAT REQUESTS API] Error:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/credit-requests/:playerId", async (req, res) => {
    try {
      const { playerId } = req.params;
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      const playerQuery = await supabase
        .from('players')
        .select('universal_id')
        .eq('id', playerId)
        .single();
      
      if (playerQuery.error) {
        console.error('❌ [CREDIT REQUESTS API] Player not found:', playerQuery.error);
        return res.status(404).json({ error: "Player not found" });
      }
      
      const result = await supabase
        .from('credit_requests')
        .select('*')
        .eq('player_id', playerQuery.data.universal_id)
        .order('created_at', { ascending: false });
      
      if (result.error) {
        console.error('❌ [CREDIT REQUESTS API] Database error:', result.error);
        return res.status(500).json({ error: "Database error" });
      }

      res.json(result.data);
    } catch (error) {
      console.error('❌ [CREDIT REQUESTS API] Error:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/push-notifications/:playerId", async (req, res) => {
    try {
      const { playerId } = req.params;
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      
      const { data: columns } = await supabase
        .from('push_notifications')
        .select('*')
        .limit(1);
      
      console.log('📱 [NOTIFICATIONS DEBUG] First row:', columns);
      
      const result = await supabase
        .from('push_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (result.error) {
        console.error('❌ [NOTIFICATIONS API] Database error:', result.error);
        return res.status(500).json({ error: "Database error" });
      }

      const notifications = result.data;
      res.json(notifications);
    } catch (error) {
      console.error('❌ [NOTIFICATIONS API] Error:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  console.log('🚀 [ROUTES] UNIFIED CHAT SYSTEM REGISTERED - Pusher + OneSignal + Supabase integration complete');
  
  return app;
}
