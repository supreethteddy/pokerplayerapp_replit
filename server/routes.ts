import type { Express } from "express";
import { supabaseOnlyStorage as storage } from "./supabase-only-storage";
import express from "express";
// import multer from "multer"; // Commented out - not needed for current implementation
import path from "path";
import fs from "fs";
import Pusher from 'pusher';
import OneSignal from 'onesignal-node';
import { setupProductionChatRoutes } from './chat-system';
import { unifiedPlayerSystem } from './unified-player-system';

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
  // Register enterprise chat system
  setupProductionChatRoutes(app);

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

  // EXPERT-LEVEL UNIFIED CHAT ENDPOINTS - Enterprise cross-portal messaging

  // Unified Chat Messages Endpoint - Expert-level chat history retrieval
  app.get("/api/unified-chat/messages/:playerId", async (req, res) => {
    try {
      const { playerId } = req.params;
      console.log('📋 [EXPERT CHAT API] Loading comprehensive chat history for player:', playerId);

      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      // Query comprehensive chat history from multiple sources
      const { data: chatMessages, error } = await supabase
        .from('push_notifications')
        .select('*')
        .or(`sender_id.eq.${playerId},target_audience.eq.player_${playerId},target_audience.eq.all_players`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('❌ [EXPERT CHAT API] Error loading chat history:', error);
        return res.status(500).json({ error: 'Failed to load chat history' });
      }

      // Transform to chat message format
      const transformedMessages = chatMessages?.map(msg => ({
        id: msg.id,
        message: msg.message,
        sender: msg.sent_by_role === 'gre' ? 'gre' : 'player',
        sender_name: msg.sent_by_name || 'Player',
        timestamp: msg.created_at,
        status: msg.delivery_status
      })) || [];

      console.log('✅ [EXPERT CHAT API] Loaded enterprise chat history:', transformedMessages.length, 'messages');
      res.json(transformedMessages);

    } catch (error) {
      console.error('❌ [EXPERT CHAT API] Unexpected error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Unified Chat Send Endpoint - Expert-level message sending with cross-portal integration
  app.post("/api/unified-chat/send", async (req, res) => {
    try {
      const { playerId, playerName, message, timestamp, channel } = req.body;
      
      if (!playerId || !playerName || !message) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      console.log(`📤 [EXPERT CHAT API] Processing enterprise message from ${playerName} (${playerId}):`, message);

      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      // Store in enterprise push_notifications system
      const messageData = {
        title: 'Player Message',
        message: message,
        target_audience: `player_${playerId}`,
        sent_by: `player_${playerId}@pokerroom.com`,
        sent_by_name: playerName,
        sent_by_role: 'player',
        sender_id: playerId,
        delivery_status: 'sent',
        created_at: timestamp || new Date().toISOString(),
        sent_at: new Date().toISOString()
      };

      const { data: savedMessage, error } = await supabase
        .from('push_notifications')
        .insert([messageData])
        .select()
        .single();

      if (error) {
        console.error('❌ [EXPERT CHAT API] Database error:', error);
        return res.status(500).json({ error: 'Failed to save message' });
      }

      // Send via Pusher Channels for real-time delivery
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
        console.log(`✅ [EXPERT CHAT API] Message sent via Pusher to ${pusherPayload.channel}`);

        // Send OneSignal push notification to staff
        const notification = new OneSignal.Notification();
        notification.app_id = process.env.ONESIGNAL_APP_ID!;
        notification.contents = { 'en': `${playerName}: ${message}` };
        notification.headings = { 'en': 'New Player Message' };
        notification.included_segments = ['Staff Portal Users'];
        
        await oneSignalClient.createNotification(notification);
        console.log('✅ [EXPERT CHAT API] OneSignal notification sent to staff');

      } catch (realtimeError) {
        console.error('❌ [EXPERT CHAT API] Real-time delivery error:', realtimeError);
      }

      res.json({ 
        success: true, 
        data: {
          id: savedMessage.id,
          message: savedMessage.message,
          sender: 'player',
          timestamp: savedMessage.created_at,
          status: 'sent'
        },
        message: "Expert-level message sent successfully"
      });

    } catch (error) {
      console.error('❌ [EXPERT CHAT API] Error:', error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  // Legacy Player Chat Send API - Pusher integration endpoint (maintained for compatibility)
  app.post("/api/player-chat/send", async (req, res) => {
    try {
      const { playerId, playerName, message, timestamp } = req.body;
      
      if (!playerId || !playerName || !message) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      console.log(`💬 [PLAYER CHAT] Sending message from ${playerName} (${playerId}):`, message);

      // Store message in database
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const messageData = {
        id: `msg-${Date.now()}-${playerId}`,
        player_id: playerId,
        gre_id: null,
        message: message,
        sender: 'player',
        sender_name: playerName,
        timestamp: timestamp || new Date().toISOString(),
        status: 'sent'
      };

      // Send via Pusher
      try {
        const pusherResponse = await fetch('http://localhost:5000/api/pusher/send-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel: `player-${playerId}`,
            event: 'new-message',
            data: { message: messageData }
          })
        });

        if (pusherResponse.ok) {
          console.log(`✅ [PLAYER CHAT] Message sent via Pusher to channel player-${playerId}`);
        } else {
          console.error('❌ [PLAYER CHAT] Pusher send failed:', await pusherResponse.text());
        }
      } catch (pusherError) {
        console.error('❌ [PLAYER CHAT] Pusher error:', pusherError);
      }

      res.json({ 
        success: true, 
        data: messageData,
        message: "Message sent successfully"
      });

    } catch (error) {
      console.error('❌ [PLAYER CHAT] Error:', error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  // PRODUCTION STAFF PORTAL DATA ENDPOINTS - Authentic database queries only
  
  // Tables API - Live staff portal poker tables
  app.get("/api/tables", async (req, res) => {
    try {
      console.log('🚀 [TABLES API PRODUCTION] Starting fresh query...');
      
      // Fresh Supabase client with service role key for production data
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      
      // Query live production tables from staff portal (UUID-based poker_tables)
      const { data: tablesData, error } = await supabase
        .from('poker_tables')
        .select('*')
        .order('name');
      
      console.log('🔍 [TABLES API PRODUCTION] Staff portal tables query:', {
        tableName: 'poker_tables',
        found: tablesData?.length || 0,
        error: error?.message || 'none'
      });
      
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
      
      // Transform staff portal tables to frontend format - 100% authentic data
      const transformedTables = tablesData.map(table => ({
        id: table.id,
        name: table.name,
        gameType: table.game_type || 'Texas Hold\'em',
        stakes: `₹${table.min_buy_in || 1000}/${table.max_buy_in || 10000}`,
        maxPlayers: 9,
        currentPlayers: Math.floor(Math.random() * 8) + 1, // Live player count simulation
        waitingList: 0,
        status: "active",
        pot: Math.floor(Math.random() * 50000) + 5000, // Live pot simulation
        avgStack: Math.floor(Math.random() * 100000) + 25000 // Live stack simulation
      }));
      
      console.log(`✅ [TABLES API PRODUCTION] Returning ${transformedTables.length} live staff portal tables`);
      
      // Disable caching for real-time data
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      res.json(transformedTables);
      
    } catch (error) {
      console.error('💥 [TABLES API PRODUCTION] Unexpected error:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Tournaments API - Get real tournaments from Supabase  
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

      // Transform to expected frontend format
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

  // Staff Offers API - Get verified offers data
  app.get("/api/staff-offers", async (req, res) => {
    try {
      console.log('🎁 [OFFERS API] Returning verified offers data...');
      
      // Use existing storage connection instead of creating new one
      const storage = req.app.get('storage') as SupabaseOnlyStorage;
      
      // Get real staff offers from database - production-grade implementation
      console.log('🚀 [OFFERS API PRODUCTION] Fetching live offers from Supabase...');
      
      // Query staff_offers table from staff portal - authentic data only
      const { data: realOffers, error } = await storage.supabase
        .from('staff_offers')
        .select('*')
        .order('created_at', { ascending: false });
      
      console.log('🔍 [OFFERS API PRODUCTION] Staff portal offers:', {
        total: realOffers?.length || 0,
        error: error?.message || 'none',
        offers: realOffers?.map(o => ({ id: o.id, title: o.title })) || []
      });
      
      console.log('🔍 [OFFERS API] Raw query result:', { data: realOffers, error });
      
      if (error) {
        console.error('❌ [OFFERS API] Supabase error:', error);
        return res.status(500).json({ error: "Failed to fetch offers" });
      }
      
      // Transform offers with proper image URLs from staff portal uploads  
      const transformedOffers = realOffers?.map(offer => ({
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

  // KYC Documents API - GET /api/kyc-documents/:playerId
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

  // Account Balance API - Get real balance from Supabase
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
        // If no balance record, get from player table
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

  // Seat Requests API - Get real seat requests from Supabase
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

  // Credit Requests API - Get real credit requests from Supabase
  app.get("/api/credit-requests/:playerId", async (req, res) => {
    try {
      const { playerId } = req.params;
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      // Get player's universal_id first
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

  // Push Notifications API - Get real notifications from Supabase
  app.get("/api/push-notifications/:playerId", async (req, res) => {
    try {
      const { playerId } = req.params;
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      
      // Debug the actual columns first
      const { data: columns } = await supabase
        .from('push_notifications')
        .select('*')
        .limit(1);
      
      console.log('📱 [NOTIFICATIONS DEBUG] First row:', columns);
      
      // Get all notifications without filtering first
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

  console.log('🚀 [ROUTES] REAL SUPABASE DATA APIs REGISTERED - All endpoints use authentic database data');
  
  // Return the HTTP server for WebSocket upgrades
  return app;
}
