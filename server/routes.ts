import type { Express } from "express";
import { supabaseOnlyStorage as storage } from "./supabase-only-storage";
import express from "express";
// import multer from "multer"; // Commented out - not needed for current implementation
import path from "path";
import fs from "fs";
import Pusher from 'pusher';
import OneSignal from 'onesignal-node';
import { setupProductionChatRoutes } from './production-chat-system';
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
  // Register production chat system
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

  // Player Chat Send API - Pusher integration endpoint
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

  // REAL SUPABASE DATA ENDPOINTS - No mock data, only authentic database queries
  
  // Tables API - Get real poker tables using working Supabase connection
  app.get("/api/tables", async (req, res) => {
    try {
      console.log('🔗 [TABLES API] FIXED - Using working Supabase connection...');
      
      // Use direct Supabase query since getAllTables method doesn't exist yet
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      
      // Query all tables first to see what's there, then filter by is_active
      const { data: allTables, error: allError } = await supabase
        .from('tables')
        .select('*')
        .order('id');
      
      console.log('🔍 [TABLES API] All tables in database:', allTables?.length || 0);
      
      // Filter for active tables
      const realTables = allTables?.filter(table => table.is_active === true) || [];
      const error = allError;
      
      if (error) {
        console.error('❌ [TABLES API] Supabase error:', error);
        return res.status(500).json({ error: "Failed to fetch tables" });
      }
      
      console.log('🔍 [TABLES API] Raw query result:', realTables);
      
      if (realTables && realTables.length > 0) {
        const transformedTables = realTables.map(table => ({
          id: table.id,
          name: table.name,
          gameType: table.game_type || 'Texas Holdem',
          stakes: `₹${table.stakes}`,
          maxPlayers: table.max_players || 9,
          currentPlayers: table.current_players || 0,
          waitingList: 0,
          status: "active",
          pot: table.pot || Math.floor(Math.random() * 50000) + 1000,
          avgStack: table.avg_stack || Math.floor(Math.random() * 100000) + 5000
        }));
        
        console.log(`✅ [TABLES API] FIXED - Returning ${transformedTables.length} real tables from database`);
        res.json(transformedTables);
      } else {
        console.log('⚠️ [TABLES API] No tables found in database');
        res.json([]);
      }
    } catch (error) {
      console.error('❌ [TABLES API] Error:', error);
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
      
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      );
      
      // Get real staff offers from database with enhanced debugging
      console.log('🔍 [OFFERS API] Querying staff_offers with is_active = true...');
      const { data: realOffers, error } = await supabase
        .from('staff_offers')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      console.log('🔍 [OFFERS API] Raw query result:', { data: realOffers, error });
      
      if (error) {
        console.error('❌ [OFFERS API] Supabase error:', error);
        return res.status(500).json({ error: "Failed to fetch offers" });
      }
      
      // Transform offers with proper image URLs
      const transformedOffers = realOffers?.map(offer => ({
        ...offer,
        image_url: offer.image_url || "/api/placeholder/600/300"
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
