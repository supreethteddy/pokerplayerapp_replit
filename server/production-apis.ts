import { Express } from 'express';
import { createClient } from '@supabase/supabase-js';

// Production-grade API implementations for offline poker club
export function setupProductionAPIs(app: Express) {
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Comprehensive Offers API - Fixed Implementation
  app.get("/api/staff-offers", async (req, res) => {
    try {
      console.log('🎁 [COMPREHENSIVE FIX] Fetching offers...');
      
      // First try offer_banners, then fallback to staff_offers
      let offers = null;
      let error = null;

      // Try offer_banners first
      const { data: bannerOffers, error: bannerError } = await supabase
        .from('offer_banners')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (!bannerError && bannerOffers && bannerOffers.length > 0) {
        offers = bannerOffers;
        console.log(`✅ [COMPREHENSIVE FIX] Found ${offers.length} offers from offer_banners`);
      } else {
        // Fallback to staff_offers
        const { data: staffOffers, error: staffError } = await supabase
          .from('staff_offers')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (!staffError && staffOffers) {
          offers = staffOffers;
          console.log(`✅ [COMPREHENSIVE FIX] Found ${offers.length} offers from staff_offers`);
        } else {
          error = staffError || bannerError;
        }
      }
      
      if (error || !offers) {
        console.error('❌ [COMPREHENSIVE FIX] Database error:', error);
        return res.status(500).json({ error: "Failed to fetch offers" });
      }
      
      // Transform to unified format
      const transformedOffers = offers.map((offer: any) => ({
        id: offer.id,
        title: offer.title,
        description: offer.offer_description || offer.description || 'Limited time offer',
        image_url: offer.image_url || "/api/placeholder/600/300",
        redirect_url: offer.redirect_url || '#',
        is_active: offer.is_active,
        offer_type: 'banner',
        display_order: offer.display_order || 1,
        created_at: offer.created_at,
        updated_at: offer.updated_at
      }));

      res.json(transformedOffers);
    } catch (error) {
      console.error('❌ [COMPREHENSIVE FIX] Error:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Comprehensive Chat Send API - Fixed Implementation
  app.post("/api/unified-chat/send", async (req, res) => {
    try {
      const { playerId, playerName, message, timestamp } = req.body;
      
      if (!playerId || !playerName || !message) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      console.log(`📤 [COMPREHENSIVE CHAT] Sending message from ${playerName} (${playerId}): ${message}`);

      const messageTimestamp = timestamp || new Date().toISOString();
      const { v4: uuidv4 } = await import('uuid');
      const messageId = uuidv4();
      const sessionId = uuidv4();

      // Store in GRE chat messages with minimal required fields
      const { data: savedMessage, error: chatError } = await supabase
        .from('gre_chat_messages')
        .insert([{
          id: messageId,
          session_id: sessionId,
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
        console.error('❌ [COMPREHENSIVE CHAT] Error saving message:', chatError);
        return res.status(500).json({ error: 'Failed to save chat message' });
      }

      console.log('✅ [COMPREHENSIVE CHAT] Message saved successfully');

      res.json({
        success: true,
        data: savedMessage
      });

    } catch (error) {
      console.error('❌ [COMPREHENSIVE CHAT] Error:', error);
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

  // Comprehensive Waitlist Join API - Fixed Implementation
  app.post("/api/waitlist/join", async (req, res) => {
    try {
      const { playerId, tableId, preferredSeat, tableName } = req.body;
      
      console.log(`🎯 [COMPREHENSIVE WAITLIST] Player ${playerId} joining waitlist for table ${tableName}`);

      // Generate UUID for the entry
      const { v4: uuidv4 } = await import('uuid');
      const entryId = uuidv4();

      // Insert with minimal required fields
      const { data: waitlistEntry, error } = await supabase
        .from('seat_requests')
        .insert([{
          id: entryId,
          player_id: playerId,
          table_id: tableId,
          status: 'waiting',
          position: preferredSeat || 1,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) {
        console.error('❌ [COMPREHENSIVE WAITLIST] Error:', error);
        return res.status(500).json({ error: 'Failed to join waitlist' });
      }

      console.log('✅ [COMPREHENSIVE WAITLIST] Player added successfully');

      res.json({
        success: true,
        data: waitlistEntry
      });

    } catch (error) {
      console.error('❌ [COMPREHENSIVE WAITLIST] Error:', error);
      res.status(500).json({ error: "Failed to join waitlist" });
    }
  });
}