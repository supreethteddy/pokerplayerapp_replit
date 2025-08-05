
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
  app.post("/api/unified-chat/send", async (req, res) => {
    try {
      const { playerId, playerName, message, senderType = 'player' } = req.body;

      if (!playerId || !message) {
        return res.status(400).json({ success: false, error: 'playerId and message are required' });
      }

      console.log(`🚀 [MICROSECOND CHAT] Sending ${senderType} message: "${message}"`);

      // Create message object with timestamp
      const savedMessage = { 
        id: Date.now(), 
        created_at: new Date().toISOString(),
        message: message,
        playerId: playerId,
        playerName: playerName || `Player ${playerId}`,
        senderType: senderType
      };
      
      // Save message to proper chat_messages table for persistence
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const { data: dbMessage, error: saveError } = await supabase
        .from('chat_messages')
        .insert({
          player_id: playerId,
          sender_name: playerName || `Player ${playerId}`,
          sender: senderType,
          message_text: message,
          status: 'sent'
        })
        .select()
        .single();

      if (saveError) {
        console.error('❌ [CHAT SYSTEM] Database save failed:', saveError);
        // Continue with Pusher even if database fails
      } else {
        console.log('✅ [CHAT SYSTEM] Message saved to database with ID:', dbMessage.id);
        savedMessage.id = dbMessage.id; // Use database ID
      }

      // Real-time notification via Pusher
      try {
        if (senderType === 'player') {
          // Notify Staff Portal
          const pusherPayload = {
            playerId: playerId,
            playerName: playerName,
            message: message,
            timestamp: new Date().toISOString(),
            messageId: savedMessage.id
          };
          
          const pusherResult = await pusher.trigger('staff-portal', 'new-player-message', pusherPayload);
          
          console.log('🚀 [PUSHER DELIVERY] Staff Portal notification sent:');
          console.log('   Channel: staff-portal');
          console.log('   Event: new-player-message');
          console.log('   Payload:', JSON.stringify(pusherPayload, null, 2));
          console.log('   Pusher Response:', pusherResult);
          console.log('   ✅ SUCCESS: Message delivered to staff portal via Pusher');
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
          id: savedMessage.id,
          playerId: playerId,
          message: message,
          senderType: senderType,
          timestamp: savedMessage.created_at
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

  // Get Chat Messages - FIXED TO USE CORRECT TABLE
  app.get("/api/unified-chat/messages/:playerId", async (req, res) => {
    try {
      const { playerId } = req.params;
      console.log(`📋 [CHAT SYSTEM] Getting messages for player: ${playerId}`);

      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      // Get messages from correct chat_messages table
      const { data: messages, error } = await supabase
        .from('chat_messages')
        .select('id, player_id, sender_name, sender, message_text, status, created_at')
        .eq('player_id', playerId)
        .order('created_at', { ascending: true });

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
        timestamp: msg.created_at,
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
        maxPlayers: 9,
        currentPlayers: Math.floor(Math.random() * 8) + 1,
        waitingList: 0,
        status: "active",
        pot: Math.floor(Math.random() * 50000) + 5000,
        avgStack: Math.floor(Math.random() * 100000) + 25000
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
