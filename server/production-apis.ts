import { Express } from 'express';
import { createClient } from '@supabase/supabase-js';

// Production-grade API implementations for offline poker club
export function setupProductionAPIs(app: Express) {
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fixed Offers API - Working Implementation
  app.get("/api/staff-offers", async (req, res) => {
    try {
      console.log('🎁 [UNIFIED OFFERS] Fetching offers from offer_banners table...');
      
      const { data: offers, error } = await supabase
        .from('offer_banners')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('❌ [UNIFIED OFFERS] Database error:', error);
        return res.status(500).json({ error: "Failed to fetch offers" });
      }
      
      console.log(`✅ [UNIFIED OFFERS] Found ${offers?.length || 0} active offers`);
      
      // Transform using exact column names from offer_banners
      const transformedOffers = offers?.map((offer: any) => ({
        id: offer.id,
        title: offer.title,
        description: offer.offer_description || 'Limited time offer',
        image_url: offer.image_url || "/api/placeholder/600/300",
        redirect_url: offer.redirect_url || '#',
        is_active: offer.is_active,
        offer_type: 'banner',
        display_order: offer.display_order || 1,
        created_at: offer.created_at,
        updated_at: offer.updated_at
      })) || [];

      res.json(transformedOffers);
    } catch (error) {
      console.error('❌ [UNIFIED OFFERS] Error:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Unified Chat Send API - Working Implementation
  app.post("/api/unified-chat/send", async (req, res) => {
    try {
      const { playerId, playerName, message, timestamp } = req.body;
      
      if (!playerId || !playerName || !message) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      console.log(`📤 [UNIFIED CHAT] Sending message from ${playerName} (${playerId}): ${message}`);

      const messageTimestamp = timestamp || new Date().toISOString();

      // Store in GRE chat messages using exact column structure
      const { data: savedMessage, error: chatError } = await supabase
        .from('gre_chat_messages')
        .insert([{
          player_id: parseInt(playerId),
          player_name: playerName,
          message: message,
          sender: 'player',
          sender_name: playerName,
          timestamp: messageTimestamp,
          status: 'sent',
          created_at: messageTimestamp
        }])
        .select()
        .single();

      if (chatError) {
        console.error('❌ [UNIFIED CHAT] Error saving message:', chatError);
        return res.status(500).json({ error: 'Failed to save chat message' });
      }

      console.log('✅ [UNIFIED CHAT] Message saved successfully');

      res.json({
        success: true,
        data: savedMessage
      });

    } catch (error) {
      console.error('❌ [UNIFIED CHAT] Error:', error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  // Fixed Tables API - Static Values for Offline Poker Club
  app.get("/api/tables", async (req, res) => {
    try {
      console.log('🚀 [PRODUCTION TABLES] Fetching static poker tables...');
      
      const { data: tables, error } = await supabase
        .from('poker_tables')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('❌ [PRODUCTION TABLES] Error:', error);
        return res.status(500).json({ error: "Database error" });
      }

      // Transform to static offline poker club format
      const transformedTables = tables?.map((table: any) => ({
        id: table.id,
        name: table.name,
        gameType: table.game_type,
        // STATIC VALUES - No auto-updating for offline club
        minBuyIn: table.min_buy_in || 100,
        maxBuyIn: table.max_buy_in || 1000,
        smallBlind: table.small_blind || 5,
        bigBlind: table.big_blind || 10,
        maxPlayers: table.max_players || 9,
        // Static values set by manager - NO AUTO-UPDATING
        currentPlayers: table.current_players || 0,
        averageStack: table.average_stack || 500,
        status: table.status || 'active',
        waitingList: 0 // Will be populated by actual waitlist API
      })) || [];

      console.log(`✅ [PRODUCTION TABLES] Returning ${transformedTables.length} static tables`);
      res.json(transformedTables);

    } catch (error) {
      console.error('❌ [PRODUCTION TABLES] Error:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Unified Waitlist Join API - Using correct seat_requests columns
  app.post("/api/waitlist/join", async (req, res) => {
    try {
      const { playerId, tableId, preferredSeat, tableName } = req.body;
      
      console.log(`🎯 [UNIFIED WAITLIST] Player ${playerId} joining waitlist for table ${tableName}`);

      // Insert using exact column names from seat_requests table
      const { data: waitlistEntry, error } = await supabase
        .from('seat_requests')
        .insert([{
          player_id: playerId,
          table_id: tableId,
          status: 'waiting',
          position: preferredSeat,
          notes: `Player joining ${tableName}`,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) {
        console.error('❌ [UNIFIED WAITLIST] Error:', error);
        return res.status(500).json({ error: 'Failed to join waitlist' });
      }

      console.log('✅ [UNIFIED WAITLIST] Player added successfully');

      res.json({
        success: true,
        data: waitlistEntry
      });

    } catch (error) {
      console.error('❌ [UNIFIED WAITLIST] Error:', error);
      res.status(500).json({ error: "Failed to join waitlist" });
    }
  });
}