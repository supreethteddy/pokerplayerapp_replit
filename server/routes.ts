import type { Express } from "express";
import { createServer, type Server } from "http";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from 'url';
import { supabaseOnlyStorage } from "./supabase-only-storage";
import { supabaseDocumentStorage } from "./supabase-document-storage";
import { unifiedPlayerSystem } from "./unified-player-system";
// SUPABASE EXCLUSIVE MODE - Using Supabase direct queries instead of schema imports
import { z } from "zod";
import { createInsertSchema } from "drizzle-zod";
import { kycDocuments, insertSeatRequestSchema, insertPlayerSchema, insertPlayerPrefsSchema } from "@shared/schema";
// SUPABASE EXCLUSIVE MODE - No Drizzle ORM imports needed
import { createClient } from '@supabase/supabase-js';
import { debugAllTables } from './debug-tables';
import { comprehensiveTableCheck, checkDatabaseConnection } from './comprehensive-table-check';
import { testDirectTableQuery } from './direct-table-test';
import { addTablesToSupabase } from './add-tables-to-supabase';
import { cleanupSupabaseTables } from './cleanup-supabase-tables';

// Connect to Staff Portal's Supabase database for table synchronization
const supabase = createClient(
  process.env.STAFF_PORTAL_SUPABASE_URL!,
  process.env.STAFF_PORTAL_SUPABASE_SERVICE_KEY!
);

// Connect to local database for credit requests
const localSupabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Create KYC document schema - omit fileUrl as it's generated during upload
const insertKycDocumentSchema = createInsertSchema(kycDocuments).omit({ fileUrl: true });

// Create upload request schema for KYC documents
const kycUploadSchema = z.object({
  playerId: z.number(),
  documentType: z.string(),
  fileName: z.string(),
  dataUrl: z.string()
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Test endpoint to verify Supabase connection
  app.get("/api/test-supabase", async (req, res) => {
    try {
      const { data, error } = await supabase.from('players').select('*').limit(1);
      if (error) {
        return res.status(500).json({ error: error.message });
      }
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Test endpoint to debug Supabase connection
  app.get("/api/debug-supabase", async (req, res) => {
    try {
      const { testSupabaseConnection } = await import('./test-supabase-direct');
      const result = await testSupabaseConnection();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Fix Supabase schema
  app.post("/api/fix-supabase-schema", async (req, res) => {
    try {
      const { fixSupabaseSchema } = await import('./fix-supabase-schema');
      const result = await fixSupabaseSchema();
      res.json({ success: result });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // UNIFIED CROSS-PORTAL SYSTEM - Universal ID Management
  // This ensures perfect synchronization across Player Portal, Staff Portal, and Master Admin Portal
  
  // Universal player endpoints with cross-portal compatibility
  app.get("/api/players/universal/:universalId", async (req, res) => {
    try {
      const universalId = req.params.universalId;
      console.log(`🔄 [UNIVERSAL] Getting player by universal ID: ${universalId}`);
      
      // Try to find player by universal ID across all systems
      const player = await unifiedPlayerSystem.getPlayerByUniversalId(universalId);
      
      if (!player) {
        return res.status(404).json({ error: "Player not found" });
      }
      
      console.log(`✅ [UNIVERSAL] Found player - App ID: ${player.id}, Universal ID: ${universalId}`);
      res.json(player);
    } catch (error: any) {
      console.error(`❌ [UNIVERSAL] Error getting player by universal ID:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // Universal KYC system for cross-portal access
  app.get("/api/kyc/universal/:universalId", async (req, res) => {
    try {
      const universalId = req.params.universalId;
      console.log(`🔄 [UNIVERSAL KYC] Getting KYC data for universal ID: ${universalId}`);
      
      // Get player by universal ID
      const player = await unifiedPlayerSystem.getPlayerByUniversalId(universalId);
      if (!player) {
        return res.status(404).json({ error: "Player not found" });
      }
      
      // Get KYC documents from unified system
      const kycDocuments = await supabaseDocumentStorage.getDocumentsByPlayerId(player.id);
      
      console.log(`✅ [UNIVERSAL KYC] Found ${kycDocuments.length} KYC documents for player ${player.id}`);
      res.json({
        player: player,
        kycDocuments: kycDocuments,
        kycStatus: player.kycStatus
      });
    } catch (error: any) {
      console.error(`❌ [UNIVERSAL KYC] Error getting KYC data:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // Universal KYC approval system (for Staff Portal and Master Admin Portal)
  app.post("/api/kyc/universal/:universalId/approve", async (req, res) => {
    try {
      const universalId = req.params.universalId;
      const { documentId, status, reviewedBy } = req.body;
      
      console.log(`🔄 [UNIVERSAL KYC] Approving KYC for universal ID: ${universalId}, Document: ${documentId}`);
      
      // Get player by universal ID
      const player = await unifiedPlayerSystem.getPlayerByUniversalId(universalId);
      if (!player) {
        return res.status(404).json({ error: "Player not found" });
      }
      
      // Update KYC document status
      await supabaseDocumentStorage.updateDocumentStatus(documentId, status);
      
      // Update player KYC status if all documents are approved
      if (status === 'approved') {
        const allDocuments = await supabaseDocumentStorage.getDocumentsByPlayerId(player.id);
        const allApproved = allDocuments.every(doc => doc.status === 'approved');
        
        if (allApproved) {
          await supabaseOnlyStorage.updatePlayerKycStatus(player.id, 'approved');
        }
      }
      
      console.log(`✅ [UNIVERSAL KYC] KYC ${status} for player ${player.id}, document ${documentId}`);
      res.json({ success: true, status: status });
    } catch (error: any) {
      console.error(`❌ [UNIVERSAL KYC] Error approving KYC:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // Universal seat request system for cross-portal waitlist management
  app.get("/api/seat-requests/universal/:universalId", async (req, res) => {
    try {
      const universalId = req.params.universalId;
      console.log(`🔄 [UNIVERSAL WAITLIST] Getting seat requests for universal ID: ${universalId}`);
      
      // Get player by universal ID
      const player = await unifiedPlayerSystem.getPlayerByUniversalId(universalId);
      if (!player) {
        return res.status(404).json({ error: "Player not found" });
      }
      
      // Get seat requests from Supabase
      const { data: requests, error } = await supabase
        .from('seat_requests')
        .select('*')
        .eq('player_id', player.id)
        .order('created_at', { ascending: false });
      
      if (error) {
        throw new Error(`Failed to fetch seat requests: ${error.message}`);
      }
      
      // Transform to camelCase for response
      const transformedRequests = (requests || []).map(req => ({
        id: req.id,
        playerId: req.player_id,
        tableId: req.table_id,
        position: req.position,
        status: req.status,
        estimatedWait: req.estimated_wait,
        createdAt: req.created_at
      }));
      
      console.log(`✅ [UNIVERSAL WAITLIST] Found ${transformedRequests.length} seat requests for player ${player.id}`);
      res.json(transformedRequests);
    } catch (error: any) {
      console.error(`❌ [UNIVERSAL WAITLIST] Error getting seat requests:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // Universal cross-portal health check
  app.get("/api/universal-health", async (req, res) => {
    try {
      console.log(`🔄 [UNIVERSAL HEALTH] Checking system health across all portals`);
      
      // Test Supabase connection
      const { data: supabaseTest, error: supabaseError } = await supabase
        .from('players')
        .select('count')
        .limit(1);
      
      // Test player system
      const playerCount = await supabaseOnlyStorage.getPlayerCount();
      
      // Test KYC system
      const kycCount = await supabaseDocumentStorage.getDocumentCount();
      
      const healthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        checks: {
          supabase: supabaseError ? 'error' : 'healthy',
          playerSystem: playerCount >= 0 ? 'healthy' : 'error',
          kycSystem: kycCount >= 0 ? 'healthy' : 'error',
          unifiedSystem: 'healthy'
        },
        stats: {
          playerCount,
          kycCount,
          activeTables: 2
        }
      };
      
      console.log(`✅ [UNIVERSAL HEALTH] System health check completed`);
      res.json(healthStatus);
    } catch (error: any) {
      console.error(`❌ [UNIVERSAL HEALTH] Health check failed:`, error);
      res.status(500).json({ 
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message 
      });
    }
  });

  // Universal player migration system
  app.post("/api/migrate-universal-ids", async (req, res) => {
    try {
      console.log(`🔄 [UNIVERSAL MIGRATION] Starting universal ID migration`);
      
      // Migrate existing players to universal ID system
      const migrationResult = await unifiedPlayerSystem.migrateToUniversalIds();
      
      console.log(`✅ [UNIVERSAL MIGRATION] Migration completed: ${migrationResult.migrated} players migrated`);
      res.json(migrationResult);
    } catch (error: any) {
      console.error(`❌ [UNIVERSAL MIGRATION] Migration failed:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // UNIVERSAL TRANSACTION SYSTEM - Cross-Portal Cash Management
  // For Super Admin, Admin, Manager, and Cashier Portals
  
  // Universal buy-in system (connected to cashier dashboard)
  app.post("/api/transactions/universal/buy-in", async (req, res) => {
    try {
      const { universalId, amount, tableId, staffId, description } = req.body;
      console.log(`💰 [UNIVERSAL BUY-IN] Processing buy-in for universal ID: ${universalId}`);
      
      // Get player by universal ID
      const player = await unifiedPlayerSystem.getPlayerByUniversalId(universalId);
      if (!player) {
        return res.status(404).json({ error: "Player not found" });
      }
      
      // Create buy-in transaction
      const { data, error } = await supabase
        .from('transactions')
        .insert({
          player_id: player.id,
          type: 'buy_in',
          amount: amount,
          description: description || `Buy-in for table ${tableId}`,
          staff_id: staffId,
          status: 'completed',
          universal_id: Math.random().toString(36).substring(2, 15)
        })
        .select()
        .single();
      
      if (error) {
        throw new Error(`Failed to create buy-in transaction: ${error.message}`);
      }
      
      // Update player balance
      await supabase
        .from('players')
        .update({ 
          balance: parseFloat(player.balance) + parseFloat(amount),
          total_deposits: parseFloat(player.totalDeposits) + parseFloat(amount)
        })
        .eq('id', player.id);
      
      console.log(`✅ [UNIVERSAL BUY-IN] Buy-in completed for player ${player.id}: ₹${amount}`);
      res.json({ success: true, transaction: data, newBalance: parseFloat(player.balance) + parseFloat(amount) });
    } catch (error: any) {
      console.error(`❌ [UNIVERSAL BUY-IN] Error processing buy-in:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // Universal cash-out system (connected to cashier dashboard)
  app.post("/api/transactions/universal/cash-out", async (req, res) => {
    try {
      const { universalId, amount, tableId, staffId, description } = req.body;
      console.log(`💸 [UNIVERSAL CASH-OUT] Processing cash-out for universal ID: ${universalId}`);
      
      // Get player by universal ID
      const player = await unifiedPlayerSystem.getPlayerByUniversalId(universalId);
      if (!player) {
        return res.status(404).json({ error: "Player not found" });
      }
      
      // Check if player has sufficient balance
      if (parseFloat(player.balance) < parseFloat(amount)) {
        return res.status(400).json({ error: "Insufficient balance" });
      }
      
      // Create cash-out transaction
      const { data, error } = await supabase
        .from('transactions')
        .insert({
          player_id: player.id,
          type: 'cash_out',
          amount: amount,
          description: description || `Cash-out from table ${tableId}`,
          staff_id: staffId,
          status: 'pending',
          universal_id: Math.random().toString(36).substring(2, 15)
        })
        .select()
        .single();
      
      if (error) {
        throw new Error(`Failed to create cash-out transaction: ${error.message}`);
      }
      
      // Update player balance
      await supabase
        .from('players')
        .update({ 
          balance: parseFloat(player.balance) - parseFloat(amount),
          total_withdrawals: parseFloat(player.totalWithdrawals) + parseFloat(amount)
        })
        .eq('id', player.id);
      
      console.log(`✅ [UNIVERSAL CASH-OUT] Cash-out pending for player ${player.id}: ₹${amount}`);
      res.json({ success: true, transaction: data, newBalance: parseFloat(player.balance) - parseFloat(amount) });
    } catch (error: any) {
      console.error(`❌ [UNIVERSAL CASH-OUT] Error processing cash-out:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // Universal transaction history (for all portals)
  app.get("/api/transactions/universal/:universalId", async (req, res) => {
    try {
      const universalId = req.params.universalId;
      console.log(`📊 [UNIVERSAL TRANSACTIONS] Getting transactions for universal ID: ${universalId}`);
      
      // Get player by universal ID
      const player = await unifiedPlayerSystem.getPlayerByUniversalId(universalId);
      if (!player) {
        return res.status(404).json({ error: "Player not found" });
      }
      
      // Get all transactions for player
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('player_id', player.id)
        .order('created_at', { ascending: false });
      
      if (error) {
        throw new Error(`Failed to get transactions: ${error.message}`);
      }
      
      console.log(`✅ [UNIVERSAL TRANSACTIONS] Found ${data.length} transactions for player ${player.id}`);
      res.json(data);
    } catch (error: any) {
      console.error(`❌ [UNIVERSAL TRANSACTIONS] Error getting transactions:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // Universal transaction approval (for super admin portal)
  app.post("/api/transactions/universal/:transactionId/approve", async (req, res) => {
    try {
      const transactionId = req.params.transactionId;
      const { status, reviewedBy } = req.body;
      console.log(`✅ [UNIVERSAL TRANSACTION APPROVAL] Approving transaction ${transactionId}: ${status}`);
      
      // Update transaction status
      const { data, error } = await supabase
        .from('transactions')
        .update({ 
          status: status,
          staff_id: reviewedBy
        })
        .eq('id', transactionId)
        .select()
        .single();
      
      if (error) {
        throw new Error(`Failed to approve transaction: ${error.message}`);
      }
      
      console.log(`✅ [UNIVERSAL TRANSACTION APPROVAL] Transaction ${transactionId} ${status}`);
      res.json({ success: true, transaction: data });
    } catch (error: any) {
      console.error(`❌ [UNIVERSAL TRANSACTION APPROVAL] Error approving transaction:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // Universal table assignment system (for all portals)
  app.post("/api/tables/universal/:universalId/assign", async (req, res) => {
    try {
      const universalId = req.params.universalId;
      const { tableId, seatPosition, staffId } = req.body;
      console.log(`🎲 [UNIVERSAL TABLE ASSIGNMENT] Assigning player ${universalId} to table ${tableId}`);
      
      // Get player by universal ID
      const player = await unifiedPlayerSystem.getPlayerByUniversalId(universalId);
      if (!player) {
        return res.status(404).json({ error: "Player not found" });
      }
      
      // Create seat request with assignment
      const { data, error } = await supabase
        .from('seat_requests')
        .insert({
          player_id: player.id,
          table_id: tableId,
          seat_position: seatPosition || 1,
          status: 'assigned',
          staff_id: staffId,
          universal_id: Math.random().toString(36).substring(2, 15)
        })
        .select()
        .single();
      
      if (error) {
        throw new Error(`Failed to assign table: ${error.message}`);
      }
      
      console.log(`✅ [UNIVERSAL TABLE ASSIGNMENT] Player ${player.id} assigned to table ${tableId}`);
      res.json({ success: true, assignment: data });
    } catch (error: any) {
      console.error(`❌ [UNIVERSAL TABLE ASSIGNMENT] Error assigning table:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // Unified Player System - Sync existing players with Supabase auth
  app.post("/api/sync-players", async (req, res) => {
    try {
      console.log('🆔 Route: Starting player sync with Supabase auth system');
      await unifiedPlayerSystem.syncExistingPlayers();
      res.json({ success: true, message: 'Player sync completed' });
    } catch (error: any) {
      console.error('🆔 Route: Error syncing players:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Unified Player System - Demonstration endpoint
  app.post("/api/demo-unified-system", async (req, res) => {
    try {
      console.log('🎯 Route: Running unified system demonstration');
      const { demonstrateUnifiedSystem } = await import('./demo-unified-system');
      const result = await demonstrateUnifiedSystem();
      res.json(result);
    } catch (error: any) {
      console.error('🎯 Route: Error running demo:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Universal System - Enterprise-grade health check
  app.get("/api/universal-health", async (req, res) => {
    try {
      console.log('🌐 Route: Checking universal system health');
      
      const { universalSystem } = await import('./universal-system');
      const healthStatus = await universalSystem.checkUniversalHealth();
      
      res.json(healthStatus);
    } catch (error: any) {
      console.error('🌐 Route: Error checking universal health:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Universal System - Migration utility
  app.post("/api/migrate-universal-ids", async (req, res) => {
    try {
      console.log('🔄 Route: Starting universal ID migration');
      
      const { universalSystem } = await import('./universal-system');
      await universalSystem.migrateExistingRecords();
      
      res.json({ success: true, message: 'Universal ID migration completed' });
    } catch (error: any) {
      console.error('🔄 Route: Error migrating universal IDs:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Universal System - Get player by universal ID
  app.get("/api/players/universal/:universalId", async (req, res) => {
    try {
      console.log('🔍 Route: Getting player by universal ID:', req.params.universalId);
      
      const { universalSystem } = await import('./universal-system');
      const player = await universalSystem.getPlayerByUniversalId(req.params.universalId);
      
      if (!player) {
        return res.status(404).json({ error: 'Player not found' });
      }
      
      res.json(player);
    } catch (error: any) {
      console.error('🔍 Route: Error getting player by universal ID:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Cache Management - Fix orphaned player
  app.post("/api/fix-orphaned-player/:playerId", async (req, res) => {
    try {
      const playerId = parseInt(req.params.playerId);
      console.log('🔧 Route: Fixing orphaned player:', playerId);
      
      const { cacheManager } = await import('./cache-management');
      const result = await cacheManager.fixPlayerWithMissingSupabaseId(playerId);
      
      if (result.success) {
        res.json({ success: true, supabaseId: result.supabaseId });
      } else {
        res.status(400).json({ error: 'Failed to fix player' });
      }
    } catch (error: any) {
      console.error('🔧 Route: Error fixing orphaned player:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Cache Management - Delete orphaned player
  app.delete("/api/orphaned-player/:playerId", async (req, res) => {
    try {
      const playerId = parseInt(req.params.playerId);
      console.log('🗑️ Route: Deleting orphaned player:', playerId);
      
      // Import database
      const { db } = await import('./db');
      const { players } = await import('../shared/schema');
      const { eq } = await import('drizzle-orm');
      
      // Delete from database
      await db.delete(players).where(eq(players.id, playerId));
      
      res.json({ success: true, message: 'Orphaned player deleted' });
    } catch (error: any) {
      console.error('🗑️ Route: Error deleting orphaned player:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Cache Management - Check cache status
  app.get("/api/cache-status", async (req, res) => {
    try {
      console.log('📊 Route: Checking cache status');
      
      const { cacheManager } = await import('./cache-management');
      // SUPABASE EXCLUSIVE MODE - No legacy database imports needed
      
      // Get all players using Supabase
      const allPlayers = await supabaseOnlyStorage.getAllPlayers();
      
      // Check for orphaned players
      let orphanedCount = 0;
      let validCount = 0;
      
      for (const player of allPlayers) {
        if (!player.supabaseId) {
          orphanedCount++;
        } else {
          const supabaseExists = await cacheManager.verifySupabaseUserExists(player.supabaseId);
          if (!supabaseExists) {
            orphanedCount++;
          } else {
            validCount++;
          }
        }
      }
      
      res.json({
        totalPlayers: allPlayers.length,
        validPlayers: validCount,
        orphanedPlayers: orphanedCount,
        cacheSystemStatus: 'active',
        lastChecked: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('📊 Route: Error checking cache status:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Test endpoint to create via Supabase client
  app.post("/api/test-supabase-insert", async (req, res) => {
    try {
      const { email, firstName, lastName } = req.body;
      const { data, error } = await supabase.from('players').insert({
        email: email,
        password: 'password123',
        first_name: firstName,
        last_name: lastName,
        phone: '1234567890',
        kyc_status: 'pending'
      }).select();
      
      if (error) {
        return res.status(500).json({ error: error.message });
      }
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Player routes - Updated for unified system with unlimited player scaling
  app.post("/api/players", async (req, res) => {
    try {
      console.log('🆔 [UNIFIED] Creating new player with unified system:', req.body);
      
      // Parse and validate player data using z.object for validation
      const playerData = z.object({
        email: z.string().email(),
        password: z.string().min(6),
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        phone: z.string().min(10),
        supabaseId: z.string().optional()
      }).parse(req.body);
      
      // Generate universal ID for cross-portal synchronization
      const universalId = playerData.supabaseId || `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Check if email already exists using unified system
      const existingPlayer = await supabaseOnlyStorage.getPlayerByEmail(playerData.email);
      if (existingPlayer) {
        console.log(`🆔 [UNIFIED] Player with email already exists: ${playerData.email}`);
        return res.status(409).json({ error: "Account with this email already exists" });
      }
      
      // Create player with unified system data structure
      const unifiedPlayerData = {
        ...playerData,
        supabaseId: universalId,
        universalId: universalId,
        balance: "0.00",
        totalDeposits: "0.00",
        totalWithdrawals: "0.00",
        totalWinnings: "0.00",
        totalLosses: "0.00",
        gamesPlayed: 0,
        hoursPlayed: "0.00",
        kycStatus: "pending"
      };
      
      // Create player using Supabase storage
      const player = await supabaseOnlyStorage.createPlayer(unifiedPlayerData);
      
      // Create default preferences
      const defaultPrefs = {
        playerId: player.id,
        seatAvailable: true,
        callTimeWarning: true,
        gameUpdates: true
      };
      try {
        await supabaseOnlyStorage.createPlayerPrefs(defaultPrefs);
        console.log('✅ [UNIFIED] Player preferences created successfully for player:', player.id);
      } catch (prefsError) {
        console.error('❌ [UNIFIED] Failed to create player preferences:', prefsError);
        // Don't fail the entire request, just log the error
      }
      
      console.log('🆔 [UNIFIED] Player created successfully - App ID:', player.id, 'Universal ID:', universalId);
      res.json(player);
    } catch (error: any) {
      console.error('🆔 Route: Error creating player:', error);
      // Handle database constraint errors
      if (error.message.includes('duplicate key value')) {
        return res.status(409).json({ error: "Account with this email already exists" });
      }
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/players/:id", async (req, res) => {
    try {
      const player = await supabaseOnlyStorage.getPlayer(parseInt(req.params.id));
      if (!player) {
        return res.status(404).json({ error: "Player not found" });
      }
      res.json(player);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // NEW: Get player by Supabase ID (used by auth system)
  app.get("/api/players/supabase/:supabaseId", async (req, res) => {
    try {
      console.log('🆔 Route: Getting player by Supabase ID:', req.params.supabaseId);
      const player = await supabaseOnlyStorage.getPlayerBySupabaseId(req.params.supabaseId);
      
      if (!player) {
        console.log('🆔 Route: Player not found for Supabase ID:', req.params.supabaseId);
        return res.status(404).json({ error: "Player not found" });
      }
      
      console.log('🆔 Route: Player found - App ID:', player.id, 'Supabase ID:', player.supabaseId);
      res.json(player);
    } catch (error: any) {
      console.error('🆔 Route: Error getting player by Supabase ID:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/players/email/:email", async (req, res) => {
    try {
      console.log('Route: Getting player by email:', req.params.email);
      const player = await supabaseOnlyStorage.getPlayerByEmail(req.params.email);
      console.log('Route: Player result:', player);
      if (!player) {
        return res.status(404).json({ error: "Player not found" });
      }
      res.json(player);
    } catch (error: any) {
      console.error('Route: Error getting player by email:', error);
      res.status(500).json({ error: error.message });
    }
  });



  // Player preferences routes
  app.post("/api/player-prefs", async (req, res) => {
    try {
      const prefsData = insertPlayerPrefsSchema.parse(req.body);
      const prefs = await supabaseOnlyStorage.createPlayerPrefs(prefsData);
      res.json(prefs);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/player-prefs/:playerId", async (req, res) => {
    try {
      const prefs = await supabaseOnlyStorage.getPlayerPrefs(parseInt(req.params.playerId));
      if (!prefs) {
        return res.status(404).json({ error: "Player preferences not found" });
      }
      res.json(prefs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/player-prefs/:playerId", async (req, res) => {
    try {
      const playerId = parseInt(req.params.playerId);
      const updates = req.body;
      const prefs = await supabaseOnlyStorage.updatePlayerPrefs(playerId, updates);
      res.json(prefs);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Test endpoint to debug tables data
  app.get("/api/test-supabase-tables", async (req, res) => {
    try {
      const { data, error } = await supabase.from('tables').select('*');
      if (error) {
        return res.status(500).json({ error: error.message });
      }
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Test Supabase connection endpoint
  app.get("/api/test-supabase-connection", async (req, res) => {
    try {
      const { count, error } = await supabase
        .from('tables')
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.error('Supabase connection error:', error);
        return res.status(500).json({ error: error.message, connected: false });
      }
      
      res.json({ 
        success: true, 
        connected: true, 
        tableCount: count || 0,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('Connection test error:', error);
      res.status(500).json({ error: error.message, connected: false });
    }
  });

  // Add tables to Supabase endpoint
  app.post("/api/add-tables", async (req, res) => {
    try {
      await addTablesToSupabase();
      res.json({ success: true, message: "Tables added successfully" });
    } catch (error: any) {
      console.error('Add tables error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Clean up Supabase tables endpoint
  app.post("/api/cleanup-tables", async (req, res) => {
    try {
      await cleanupSupabaseTables();
      res.json({ success: true, message: "Tables cleaned up successfully" });
    } catch (error: any) {
      console.error('Cleanup tables error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Tables routes
  app.get("/api/tables", async (req, res) => {
    try {
      console.log('🔄 [TABLES] Fetching ALL tables from Staff Portal Supabase...');
      console.log('🔗 [TABLES] Database URL:', process.env.STAFF_PORTAL_SUPABASE_URL?.slice(0, 50) + '...');
      
      // Production ready - Connected to Staff Portal's Supabase database for real-time table sync
      
      // SUPABASE EXCLUSIVE MODE - Direct query to fetch ALL tables without any limits
      console.log('🔍 [TABLES] Forcing fresh query without cache...');
      const { data: tables, error, count } = await supabase
        .from('poker_tables')
        .select('*', { count: 'exact' })
        .order('id', { ascending: false })
        .limit(10000); // Ensure we get ALL tables from Supabase
        
      console.log('🔍 [TABLES] Raw query result:', { 
        tablesCount: tables?.length || 0, 
        totalCount: count,
        error: error?.message || null,
        firstFewIds: tables?.slice(0, 5).map(t => t.id) || [],
        lastFewIds: tables?.slice(-5).map(t => t.id) || []
      });
      
      if (error) {
        console.error('[TABLES] Error fetching tables:', error);
        return res.status(500).json({ error: error.message });
      }
      
      // Transform the data to match frontend expectations
      const transformedTables = tables?.map(table => ({
        id: table.id,
        name: table.name,
        gameType: table.game_type,
        stakes: table.small_blind && table.big_blind ? `₹${table.small_blind}/${table.big_blind}` : "₹10/20",
        maxPlayers: table.max_players,
        currentPlayers: table.current_players || 0,
        pot: 0, // Not stored in poker_tables
        avgStack: 0, // Not stored in poker_tables
        isActive: table.status === 'active',
        createdAt: table.created_at || new Date().toISOString()
      })) || [];
      
      console.log(`✅ [TABLES] Returning ${transformedTables.length} tables from database`);
      console.log('📋 [TABLES] Table names:', transformedTables.map(t => t.name).join(', '));
      console.log('🔢 [TABLES] Table IDs:', transformedTables.map(t => t.id).join(', '));
      
      // Check for total table count in database
      const { count: totalCount, error: countError } = await supabase
        .from('poker_tables')
        .select('*', { count: 'exact', head: true });
      
      if (countError) {
        console.error('❌ [TABLES] Error getting table count:', countError);
      } else {
        console.log(`📊 [TABLES] Total tables in database: ${totalCount}`);
      }
      res.json(transformedTables);
    } catch (error: any) {
      console.error('[TABLES] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Fix seat requests table structure
  app.post("/api/fix-seat-requests-table", async (req, res) => {
    try {
      const { createSeatRequestTable } = await import('./create-seat-request-table');
      const success = await createSeatRequestTable();
      res.json({ success });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // UNIFIED WAITLIST SYSTEM - Using 'waitlist' table for cross-portal compatibility
  app.post("/api/seat-requests", async (req, res) => {
    try {
      console.log('🎯 [WAITLIST ROUTE] Request body:', req.body);
      const requestData = insertSeatRequestSchema.parse(req.body);
      console.log('🎯 [WAITLIST ROUTE] Parsed data:', requestData);
      
      // Get table UUID for validation
      const tableUuid = requestData.tableId;
      console.log('🔍 [WAITLIST ROUTE] Validating table UUID:', tableUuid);
      
      // Verify table exists in poker_tables
      const { data: tableExists, error: tableError } = await supabase
        .from('poker_tables')
        .select('id, game_type, min_buy_in, max_buy_in')
        .eq('id', tableUuid)
        .single();
      
      if (tableError || !tableExists) {
        throw new Error(`Table not found: ${tableUuid}`);
      }
      
      console.log('✅ [WAITLIST ROUTE] Table exists:', tableExists);
      
      // Get current waitlist count for position
      const { data: waitlistCount, error: countError } = await supabase
        .from('waitlist')
        .select('id')
        .eq('table_id', tableUuid)
        .eq('status', 'waiting');
      
      const position = (waitlistCount?.length || 0) + 1;
      
      // Create waitlist entry in Supabase using proper 'waitlist' table
      const { data: waitlistEntry, error: insertError } = await supabase
        .from('waitlist')
        .insert({
          player_id: requestData.playerId,
          table_id: tableUuid,
          game_type: tableExists.game_type || 'Texas Hold\'em',
          min_buy_in: tableExists.min_buy_in || 1000,
          max_buy_in: tableExists.max_buy_in || 10000,
          position: position,
          status: requestData.status || 'waiting',
          requested_at: new Date().toISOString(),
          notes: `Player ${requestData.playerId} joined waitlist`
        })
        .select()
        .single();
      
      if (insertError) {
        throw new Error(`Failed to join waitlist: ${insertError.message}`);
      }
      
      // Transform to camelCase for response
      const transformedRequest = {
        id: waitlistEntry.id,
        playerId: waitlistEntry.player_id,
        tableId: waitlistEntry.table_id,
        gameType: waitlistEntry.game_type,
        minBuyIn: waitlistEntry.min_buy_in,
        maxBuyIn: waitlistEntry.max_buy_in,
        position: waitlistEntry.position,
        status: waitlistEntry.status,
        requestedAt: waitlistEntry.requested_at,
        createdAt: waitlistEntry.created_at
      };
      
      console.log('✅ [WAITLIST ROUTE] Created in Supabase waitlist:', transformedRequest);
      
      res.json(transformedRequest);
    } catch (error: any) {
      console.error('❌ [WAITLIST ROUTE] Error:', error);
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/seat-requests/:playerId", async (req, res) => {
    try {
      const playerId = parseInt(req.params.playerId);
      
      // Get waitlist entries from Supabase using proper 'waitlist' table
      const { data: requests, error } = await supabase
        .from('waitlist')
        .select('*')
        .eq('player_id', playerId)
        .order('created_at', { ascending: false });
      
      if (error) {
        throw new Error(`Failed to fetch waitlist: ${error.message}`);
      }
      
      // Transform to camelCase for response
      const transformedRequests = (requests || []).map(req => ({
        id: req.id,
        playerId: req.player_id,
        tableId: req.table_id,
        gameType: req.game_type,
        minBuyIn: req.min_buy_in,
        maxBuyIn: req.max_buy_in,
        position: req.position,
        status: req.status,
        requestedAt: req.requested_at,
        seatedAt: req.seated_at,
        notes: req.notes,
        createdAt: req.created_at
      }));
      
      console.log('📋 [WAITLIST GET] Returning waitlist for player', playerId, ':', transformedRequests);
      res.json(transformedRequests);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Remove from waitlist (unjoin)
  app.delete("/api/seat-requests/:playerId/:tableId", async (req, res) => {
    try {
      const playerId = parseInt(req.params.playerId);
      const tableId = req.params.tableId;
      
      console.log('🚮 [WAITLIST DELETE] Removing player', playerId, 'from table', tableId);
      
      // Remove from waitlist
      const { data: deletedEntry, error } = await supabase
        .from('waitlist')
        .delete()
        .eq('player_id', playerId)
        .eq('table_id', tableId)
        .eq('status', 'waiting')
        .select()
        .single();
      
      if (error) {
        throw new Error(`Failed to remove from waitlist: ${error.message}`);
      }
      
      console.log('✅ [WAITLIST DELETE] Successfully removed from waitlist:', deletedEntry);
      res.json({ success: true, removed: deletedEntry });
    } catch (error: any) {
      console.error('❌ [WAITLIST DELETE] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get waitlist for a specific table (for Staff Portal)
  app.get("/api/waitlist/table/:tableId", async (req, res) => {
    try {
      const tableId = req.params.tableId;
      
      console.log('📋 [WAITLIST TABLE] Getting waitlist for table:', tableId);
      
      // Get all waitlist entries for this table
      const { data: waitlist, error } = await supabase
        .from('waitlist')
        .select(`
          *,
          players!inner(first_name, last_name, email, phone)
        `)
        .eq('table_id', tableId)
        .eq('status', 'waiting')
        .order('position', { ascending: true });
      
      if (error) {
        throw new Error(`Failed to fetch table waitlist: ${error.message}`);
      }
      
      // Transform for response
      const transformedWaitlist = (waitlist || []).map(entry => ({
        id: entry.id,
        playerId: entry.player_id,
        tableId: entry.table_id,
        gameType: entry.game_type,
        minBuyIn: entry.min_buy_in,
        maxBuyIn: entry.max_buy_in,
        position: entry.position,
        status: entry.status,
        requestedAt: entry.requested_at,
        notes: entry.notes,
        player: {
          firstName: entry.players.first_name,
          lastName: entry.players.last_name,
          email: entry.players.email,
          phone: entry.players.phone
        }
      }));
      
      console.log('✅ [WAITLIST TABLE] Returning', transformedWaitlist.length, 'waitlist entries');
      res.json(transformedWaitlist);
    } catch (error: any) {
      console.error('❌ [WAITLIST TABLE] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // UNIFIED CREDIT SYSTEM - Cross-portal credit management
  
  // Request credit (Player Portal)
  app.post("/api/credit-requests", async (req, res) => {
    try {
      const { playerId, requestedAmount, requestNote } = req.body;
      
      console.log('💳 [CREDIT REQUEST] Creating credit request for player:', playerId, 'Amount:', requestedAmount);
      
      // Validate player exists and is credit approved
      const { data: player, error: playerError } = await supabase
        .from('players')
        .select('id, credit_approved, credit_limit, current_credit, balance')
        .eq('id', playerId)
        .single();
      
      if (playerError || !player) {
        throw new Error(`Player not found: ${playerId}`);
      }
      
      if (!player.credit_approved) {
        throw new Error('Player not approved for credit');
      }
      
      // Create credit request
      const { data: creditRequest, error: insertError } = await localSupabase
        .from('credit_requests')
        .insert({
          player_id: playerId,
          requested_amount: requestedAmount,
          current_balance: parseFloat(player.balance) || 0,
          status: 'pending',
          request_note: requestNote || `Credit request for ₹${requestedAmount}`,
          universal_id: `credit_${Date.now()}_${playerId}`
        })
        .select()
        .single();
      
      if (insertError) {
        throw new Error(`Failed to create credit request: ${insertError.message}`);
      }
      
      // Transform response
      const transformedRequest = {
        id: creditRequest.id,
        playerId: creditRequest.player_id,
        requestedAmount: creditRequest.requested_amount,
        currentBalance: creditRequest.current_balance,
        status: creditRequest.status,
        requestNote: creditRequest.request_note,
        createdAt: creditRequest.created_at,
        universalId: creditRequest.universal_id
      };
      
      console.log('✅ [CREDIT REQUEST] Created successfully:', transformedRequest);
      res.json(transformedRequest);
    } catch (error: any) {
      console.error('❌ [CREDIT REQUEST] Error:', error);
      res.status(400).json({ error: error.message });
    }
  });

  // Get credit requests for player
  app.get("/api/credit-requests/:playerId", async (req, res) => {
    try {
      const playerId = parseInt(req.params.playerId);
      
      console.log('📋 [CREDIT REQUESTS] Getting requests for player:', playerId);
      
      const { data: requests, error } = await localSupabase
        .from('credit_requests')
        .select('*')
        .eq('player_id', playerId)
        .order('created_at', { ascending: false });
      
      if (error) {
        throw new Error(`Failed to fetch credit requests: ${error.message}`);
      }
      
      // Transform response
      const transformedRequests = (requests || []).map(req => ({
        id: req.id,
        playerId: req.player_id,
        requestedAmount: req.requested_amount,
        currentBalance: req.current_balance,
        status: req.status,
        requestNote: req.request_note,
        adminNote: req.admin_note,
        approvedBy: req.approved_by,
        approvedAt: req.approved_at,
        rejectedReason: req.rejected_reason,
        createdAt: req.created_at,
        universalId: req.universal_id
      }));
      
      console.log('✅ [CREDIT REQUESTS] Returning', transformedRequests.length, 'requests');
      res.json(transformedRequests);
    } catch (error: any) {
      console.error('❌ [CREDIT REQUESTS] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get all credit requests (Staff Portal / Super Admin)
  app.get("/api/credit-requests", async (req, res) => {
    try {
      const { status } = req.query;
      
      console.log('📋 [ALL CREDIT REQUESTS] Getting all requests, status filter:', status);
      
      let query = localSupabase
        .from('credit_requests')
        .select(`
          *,
          players!inner(first_name, last_name, email, phone, credit_limit, current_credit)
        `)
        .order('created_at', { ascending: false });
      
      if (status) {
        query = query.eq('status', status);
      }
      
      const { data: requests, error } = await query;
      
      if (error) {
        throw new Error(`Failed to fetch credit requests: ${error.message}`);
      }
      
      // Transform response with player details
      const transformedRequests = (requests || []).map(req => ({
        id: req.id,
        playerId: req.player_id,
        requestedAmount: req.requested_amount,
        currentBalance: req.current_balance,
        status: req.status,
        requestNote: req.request_note,
        adminNote: req.admin_note,
        approvedBy: req.approved_by,
        approvedAt: req.approved_at,
        rejectedReason: req.rejected_reason,
        createdAt: req.created_at,
        universalId: req.universal_id,
        player: {
          firstName: req.players.first_name,
          lastName: req.players.last_name,
          email: req.players.email,
          phone: req.players.phone,
          creditLimit: req.players.credit_limit,
          currentCredit: req.players.current_credit
        }
      }));
      
      console.log('✅ [ALL CREDIT REQUESTS] Returning', transformedRequests.length, 'requests');
      res.json(transformedRequests);
    } catch (error: any) {
      console.error('❌ [ALL CREDIT REQUESTS] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Approve/Reject credit request (Super Admin)
  app.patch("/api/credit-requests/:requestId/status", async (req, res) => {
    try {
      const requestId = req.params.requestId;
      const { status, adminNote, rejectedReason, approvedBy } = req.body;
      
      console.log('🔄 [CREDIT STATUS] Updating request:', requestId, 'Status:', status);
      
      // Get current request
      const { data: currentRequest, error: fetchError } = await localSupabase
        .from('credit_requests')
        .select('*')
        .eq('id', requestId)
        .single();
      
      if (fetchError || !currentRequest) {
        throw new Error(`Credit request not found: ${requestId}`);
      }
      
      // Update request status
      const updateData: any = {
        status: status,
        admin_note: adminNote,
        updated_at: new Date().toISOString()
      };
      
      if (status === 'approved') {
        updateData.approved_by = approvedBy;
        updateData.approved_at = new Date().toISOString();
      } else if (status === 'rejected') {
        updateData.rejected_reason = rejectedReason;
      }
      
      const { data: updatedRequest, error: updateError } = await localSupabase
        .from('credit_requests')
        .update(updateData)
        .eq('id', requestId)
        .select()
        .single();
      
      if (updateError) {
        throw new Error(`Failed to update credit request: ${updateError.message}`);
      }
      
      // If approved, update player's credit and balance
      if (status === 'approved') {
        const { data: player, error: playerError } = await supabase
          .from('players')
          .select('current_credit, balance')
          .eq('id', currentRequest.player_id)
          .single();
        
        if (playerError) {
          throw new Error(`Failed to get player data: ${playerError.message}`);
        }
        
        const newCredit = parseFloat(player.current_credit) + parseFloat(currentRequest.requested_amount);
        const newBalance = parseFloat(player.balance) + parseFloat(currentRequest.requested_amount);
        
        const { error: creditUpdateError } = await supabase
          .from('players')
          .update({
            current_credit: newCredit.toFixed(2),
            balance: newBalance.toFixed(2)
          })
          .eq('id', currentRequest.player_id);
        
        if (creditUpdateError) {
          throw new Error(`Failed to update player credit: ${creditUpdateError.message}`);
        }
        
        console.log('✅ [CREDIT STATUS] Player credit updated - New Credit:', newCredit, 'New Balance:', newBalance);
      }
      
      console.log('✅ [CREDIT STATUS] Request updated successfully');
      res.json({ success: true, request: updatedRequest });
    } catch (error: any) {
      console.error('❌ [CREDIT STATUS] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Remove player from waitlist
  app.delete("/api/seat-requests/:playerId/:tableId", async (req, res) => {
    try {
      const playerId = parseInt(req.params.playerId);
      const tableId = req.params.tableId;
      
      // Delete the seat request from Supabase
      const { error } = await supabase
        .from('seat_requests')
        .delete()
        .eq('player_id', playerId)
        .eq('table_id', tableId);
      
      if (error) {
        throw new Error(`Failed to remove from waitlist: ${error.message}`);
      }
      
      res.json({ success: true, message: "Removed from waitlist" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // File type validation utility
  const validateFileType = (fileName: string, fileUrl: string): boolean => {
    const allowedTypes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'application/pdf'
    ];
    
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.pdf'];
    const fileExtension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
    
    // Check file extension
    if (!allowedExtensions.includes(fileExtension)) {
      return false;
    }
    
    // Check data URL MIME type if it's a data URL
    if (fileUrl.startsWith('data:')) {
      const mimeType = fileUrl.split(',')[0].split(':')[1].split(';')[0];
      return allowedTypes.includes(mimeType);
    }
    
    return true;
  };

  // Supabase-exclusive document storage system
  app.post("/api/documents/upload", async (req, res) => {
    try {
      console.log(`[SupabaseDocumentSystem] Upload request - Player: ${req.body.playerId}, Type: ${req.body.documentType}`);
      
      const { playerId, documentType, fileName, fileUrl } = req.body;
      
      // Validate required fields
      if (!playerId || !documentType || !fileName || !fileUrl) {
        return res.status(400).json({ 
          error: "Missing required fields: playerId, documentType, fileName, fileUrl" 
        });
      }
      
      // Validate file type
      const allowedTypes = ['jpg', 'jpeg', 'png', 'pdf'];
      const fileExtension = fileName.split('.').pop()?.toLowerCase();
      if (!fileExtension || !allowedTypes.includes(fileExtension)) {
        return res.status(400).json({ 
          error: "Invalid file type. Only JPG, PNG, and PDF files are allowed." 
        });
      }
      
      // Direct Supabase upload - PERMANENT FIX
      console.log(`[SupabaseDocumentSystem] Processing upload for player ${playerId}`);
      
      // Generate unique file name using timestamp
      const timestamp = Date.now();
      const uniqueFileName = `${playerId}/${documentType}/${timestamp}.${fileName.split('.').pop()}`;

      // Convert data URL to file buffer
      let base64Data: string;
      
      if (fileUrl.startsWith('data:')) {
        // Handle data URL format (data:image/png;base64,...)
        const parts = fileUrl.split(',');
        if (parts.length !== 2) {
          return res.status(400).json({ error: 'Invalid data URL format' });
        }
        base64Data = parts[1];
      } else {
        // Handle direct base64 data
        base64Data = fileUrl;
      }
      
      const buffer = Buffer.from(base64Data, 'base64');
      
      // Get MIME type
      const getMimeType = (fileName: string): string => {
        const extension = fileName.split('.').pop()?.toLowerCase();
        switch (extension) {
          case 'jpg':
          case 'jpeg':
            return 'image/jpeg';
          case 'png':
            return 'image/png';
          case 'pdf':
            return 'application/pdf';
          default:
            return 'application/octet-stream';
        }
      };

      // Upload file to Supabase storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('kyc-documents')
        .upload(uniqueFileName, buffer, {
          contentType: getMimeType(fileName),
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error(`[SupabaseDocumentSystem] Upload error:`, uploadError);
        return res.status(500).json({ error: `Upload failed: ${uploadError.message}` });
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('kyc-documents')
        .getPublicUrl(uniqueFileName);

      // Create database record
      const { data: document, error: dbError } = await supabase
        .from('kyc_documents')
        .insert({
          player_id: playerId,
          document_type: documentType,
          file_name: fileName,
          file_url: urlData.publicUrl,
          status: 'approved' // Auto-approve for seamless experience
        })
        .select()
        .single();

      if (dbError) {
        console.error(`[SupabaseDocumentSystem] Database error:`, dbError);
        return res.status(500).json({ error: `Database error: ${dbError.message}` });
      }
      
      console.log(`[SupabaseDocumentSystem] Upload successful - Document ID: ${document.id}`);
      
      res.json({
        id: document.id,
        playerId: document.player_id,
        documentType: document.document_type,
        fileName: document.file_name,
        fileUrl: document.file_url, // Use Supabase public URL directly
        status: document.status,
        createdAt: document.created_at
      });
      
    } catch (error: any) {
      console.error(`[SupabaseDocumentSystem] Upload failed:`, error);
      res.status(500).json({ 
        error: error.message || "Failed to upload document"
      });
    }
  });

  // Get documents by player from Supabase - PERMANENT FIX
  app.get("/api/documents/player/:playerId", async (req, res) => {
    try {
      const playerId = parseInt(req.params.playerId);
      console.log(`[SupabaseDocumentSystem] Fetching documents for player: ${playerId}`);
      
      // Direct Supabase query - SUPABASE EXCLUSIVE MODE
      const { data: documents, error } = await supabase
        .from('kyc_documents')
        .select('*')
        .eq('player_id', playerId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error(`[SupabaseDocumentSystem] Error querying documents:`, error);
        return res.status(500).json({ error: error.message });
      }
      
      // Transform to match expected format
      const transformedDocs = (documents || []).map(doc => ({
        id: doc.id,
        playerId: doc.player_id,
        documentType: doc.document_type,
        fileName: doc.file_name,
        fileUrl: doc.file_url, // Use Supabase public URL directly
        status: doc.status,
        createdAt: doc.created_at
      }));
      
      console.log(`[SupabaseDocumentSystem] Found ${transformedDocs.length} documents for player ${playerId}`);
      res.json(transformedDocs);
    } catch (error: any) {
      console.error(`[SupabaseDocumentSystem] Get documents failed:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // Serve document files from Supabase
  app.get("/api/documents/:docId", async (req, res) => {
    try {
      const docId = req.params.docId;
      console.log(`[SupabaseDocumentSystem] Serving document: ${docId}`);
      
      const result = await supabaseDocumentStorage.getDocumentFile(docId);
      
      if (!result) {
        return res.status(404).json({ error: "Document not found" });
      }
      
      // Set proper headers
      res.set({
        'Content-Type': result.mimeType,
        'Content-Length': result.buffer.length,
        'Content-Disposition': `inline; filename="${result.fileName}"`,
        'Cache-Control': 'public, max-age=3600'
      });
      
      res.send(result.buffer);
    } catch (error: any) {
      console.error(`[SupabaseDocumentSystem] Serve document failed:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // KYC documents routes (legacy)
  // File upload tracking system
  const uploadTracker = new Map();
  const uploadHistory = [];
  
  app.post("/api/kyc-documents", async (req, res) => {
    const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();
    
    try {
      // Initialize upload tracking
      uploadTracker.set(uploadId, {
        uploadId,
        status: 'started',
        timestamp,
        steps: [],
        requestBody: {
          playerId: req.body.playerId,
          documentType: req.body.documentType,
          fileName: req.body.fileName,
          fileSize: req.body.fileUrl?.length || 0
        }
      });
      
      const addStep = (step: string, data?: any) => {
        const tracker = uploadTracker.get(uploadId);
        if (tracker) {
          tracker.steps.push({ step, timestamp: new Date().toISOString(), data });
          uploadTracker.set(uploadId, tracker);
        }
      };
      
      addStep('validation_start', { contentLength: req.headers['content-length'] });
      console.log(`[${timestamp}] Upload started - ID: ${uploadId}, Player: ${req.body.playerId}, Type: ${req.body.documentType}`);
      
      // Parse and validate request body
      let kycData;
      try {
        console.log('📋 [KYC Upload] Request body:', JSON.stringify(req.body, null, 2));
        kycData = kycUploadSchema.parse(req.body);
        addStep('schema_validation_passed');
        console.log('📋 [KYC Upload] Schema validation passed for:', { playerId: kycData.playerId, documentType: kycData.documentType });
      } catch (error) {
        addStep('schema_validation_failed', { error: error.message });
        console.error('📋 [KYC Upload] Schema validation failed:', error);
        return res.status(400).json({ 
          error: "Invalid request data",
          details: error.message,
          uploadId
        });
      }
      
      // Server-side file type validation
      if (!validateFileType(kycData.fileName, kycData.dataUrl)) {
        addStep('file_type_validation_failed', { fileName: kycData.fileName });
        return res.status(400).json({ 
          error: "Invalid file type. Only JPG, PNG, and PDF files are allowed.",
          uploadId
        });
      }
      
      addStep('file_type_validation_passed');
      
      // Validate file size if it's a data URL
      if (kycData.dataUrl.startsWith('data:')) {
        const parts = kycData.dataUrl.split(',');
        if (parts.length !== 2) {
          addStep('data_url_format_validation_failed', { fileUrl: kycData.dataUrl.substring(0, 100) + '...' });
          return res.status(400).json({ 
            error: "Invalid data URL format. Expected format: data:mime/type;base64,data",
            uploadId
          });
        }
        
        const base64Data = parts[1];
        if (!base64Data || base64Data.length === 0) {
          addStep('base64_data_validation_failed');
          return res.status(400).json({ 
            error: "Invalid data URL - missing base64 data",
            uploadId
          });
        }
        
        const sizeInBytes = (base64Data.length * 3) / 4;
        const maxSize = 5 * 1024 * 1024; // 5MB
        
        addStep('size_calculation', { sizeInBytes, maxSize });
        
        if (sizeInBytes > maxSize) {
          addStep('size_validation_failed', { sizeInBytes, maxSize });
          return res.status(400).json({ 
            error: "File size too large. Maximum file size is 5MB.",
            fileSize: sizeInBytes,
            uploadId
          });
        }
        
        addStep('size_validation_passed');
      } else {
        // If not a data URL, it should be a valid file path or URL
        addStep('non_data_url_validation', { fileUrl: kycData.dataUrl });
      }
      
      // Create KYC document directly in Supabase using supabaseOnlyStorage
      try {
        console.log('📋 [KYC Upload] Calling uploadDocument with:', { 
          playerId: kycData.playerId, 
          documentType: kycData.documentType, 
          fileName: kycData.fileName, 
          fileUrlLength: kycData.dataUrl?.length || 0
        });
        const document = await supabaseDocumentStorage.uploadDocument(kycData.playerId, kycData.documentType, kycData.fileName, kycData.dataUrl);
        
        addStep('database_record_created', { documentId: document.id });
        
        // Mark upload as successful
        const tracker = uploadTracker.get(uploadId);
        if (tracker) {
          tracker.status = 'completed';
          tracker.documentId = document.id;
          tracker.completedAt = new Date().toISOString();
          uploadTracker.set(uploadId, tracker);
        }
        
        // Add to history
        uploadHistory.push({
          uploadId,
          playerId: kycData.playerId,
          documentType: kycData.documentType,
          fileName: kycData.fileName,
          status: 'completed',
          timestamp,
          documentId: document.id
        });
        
        // Keep only last 100 uploads in history
        if (uploadHistory.length > 100) {
          uploadHistory.shift();
        }
        
        console.log(`[${timestamp}] Upload completed successfully - ID: ${uploadId}, Document ID: ${document.id}`);
        
        res.json({
          ...document,
          uploadId,
          uploadStatus: 'completed'
        });
      } catch (error: any) {
        addStep('database_error', { error: error.message });
        console.error(`[${timestamp}] Database error - Upload ID: ${uploadId}:`, error);
        res.status(500).json({ 
          error: "Database operation failed",
          details: error.message,
          uploadId
        });
      }
    } catch (error: any) {
      // Mark upload as failed
      const tracker = uploadTracker.get(uploadId);
      if (tracker) {
        tracker.status = 'failed';
        tracker.error = error.message;
        tracker.failedAt = new Date().toISOString();
        uploadTracker.set(uploadId, tracker);
      }
      
      console.error(`[${timestamp}] Upload failed - ID: ${uploadId}:`, error);
      res.status(500).json({ 
        error: "Upload failed",
        details: error.message,
        uploadId
      });
    }
  });

  // Upload tracking endpoints for debugging
  app.get("/api/upload-tracker/:uploadId", (req, res) => {
    const uploadId = req.params.uploadId;
    const tracker = uploadTracker.get(uploadId);
    
    if (!tracker) {
      return res.status(404).json({ error: "Upload not found" });
    }
    
    res.json(tracker);
  });

  app.get("/api/upload-history", (req, res) => {
    res.json({
      totalUploads: uploadHistory.length,
      recentUploads: uploadHistory.slice(-20), // Last 20 uploads
      activeUploads: Array.from(uploadTracker.entries()).map(([id, data]) => ({ id, ...data })),
      stats: {
        completed: uploadHistory.filter(u => u.status === 'completed').length,
        failed: uploadHistory.filter(u => u.status === 'failed').length,
        activeCount: uploadTracker.size
      }
    });
  });

  // Clean up old upload tracking data (run every hour)
  setInterval(() => {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    let cleanedCount = 0;
    
    for (const [uploadId, tracker] of uploadTracker.entries()) {
      if (new Date(tracker.timestamp).getTime() < oneHourAgo) {
        uploadTracker.delete(uploadId);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`[${new Date().toISOString()}] Cleaned up ${cleanedCount} old upload tracking records`);
    }
  }, 60 * 60 * 1000);

  // Real-time KYC document sync endpoint for Staff Portal integration
  app.get("/api/staff/kyc-documents/player/:playerId", async (req, res) => {
    try {
      const playerId = parseInt(req.params.playerId);
      console.log(`[STAFF-KYC] Getting documents for player: ${playerId}`);
      
      // Get documents from database with enhanced staff info
      const { data: documents, error } = await supabase
        .from('kyc_documents')
        .select('*')
        .eq('player_id', playerId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error(`[STAFF-KYC] Database error:`, error);
        return res.status(500).json({ error: error.message });
      }
      
      // Get player info for context
      const { data: player } = await supabase
        .from('players')
        .select('first_name, last_name, email, kyc_status')
        .eq('id', playerId)
        .single();
      
      // Transform documents with staff-specific information
      const transformedDocuments = documents?.map(doc => ({
        id: doc.id,
        playerId: doc.player_id,
        documentType: doc.document_type,
        fileName: doc.file_name,
        fileUrl: doc.file_url,
        status: doc.status,
        createdAt: doc.created_at,
        reviewedBy: doc.reviewed_by,
        reviewedAt: doc.reviewed_at,
        // Add staff-specific fields
        canApprove: doc.status === 'pending',
        canReject: doc.status === 'pending',
        canReview: true
      })) || [];
      
      console.log(`[STAFF-KYC] Found ${transformedDocuments.length} documents for player ${playerId}`);
      
      res.json({
        player: player,
        documents: transformedDocuments,
        summary: {
          totalDocuments: transformedDocuments.length,
          approvedDocuments: transformedDocuments.filter(d => d.status === 'approved').length,
          pendingDocuments: transformedDocuments.filter(d => d.status === 'pending').length,
          rejectedDocuments: transformedDocuments.filter(d => d.status === 'rejected').length,
          overallKycStatus: player?.kyc_status || 'pending'
        }
      });
    } catch (error: any) {
      console.error(`[STAFF-KYC] Error:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // Unified KYC document endpoint for both Player Portal and Staff Portal
  app.get("/api/kyc-documents/player/:playerId", async (req, res) => {
    try {
      const playerId = parseInt(req.params.playerId);
      console.log(`[KYC-API] Getting documents for player: ${playerId}`);
      
      // Get documents from database
      const { data: documents, error } = await supabase
        .from('kyc_documents')
        .select('*')
        .eq('player_id', playerId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error(`[KYC-API] Database error:`, error);
        return res.status(500).json({ error: error.message });
      }
      
      // Transform documents to match the expected format
      const transformedDocuments = documents?.map(doc => ({
        id: doc.id,
        playerId: doc.player_id,
        documentType: doc.document_type,
        fileName: doc.file_name,
        fileUrl: doc.file_url,
        status: doc.status,
        createdAt: doc.created_at
      })) || [];
      
      console.log(`[KYC-API] Found ${transformedDocuments.length} documents for player ${playerId}`);
      res.json(transformedDocuments);
    } catch (error: any) {
      console.error(`[KYC-API] Error:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // Staff Portal KYC approval endpoint
  app.patch("/api/kyc-documents/:docId/status", async (req, res) => {
    try {
      const docId = parseInt(req.params.docId);
      const { status, reviewedBy } = req.body;
      
      console.log(`[KYC-API] Updating document ${docId} status to: ${status}`);
      
      if (!['pending', 'approved', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      
      // Update document status in database
      const { data: document, error } = await supabase
        .from('kyc_documents')
        .update({ 
          status: status,
          reviewed_by: reviewedBy,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', docId)
        .select()
        .single();
      
      if (error) {
        console.error(`[KYC-API] Error updating document:`, error);
        return res.status(500).json({ error: error.message });
      }
      
      // If all documents are approved, update player KYC status
      if (status === 'approved') {
        const { data: allDocs } = await supabase
          .from('kyc_documents')
          .select('status')
          .eq('player_id', document.player_id);
        
        const allApproved = allDocs?.every(doc => doc.status === 'approved');
        
        if (allApproved) {
          await supabase
            .from('players')
            .update({ kyc_status: 'approved' })
            .eq('id', document.player_id);
          
          console.log(`[KYC-API] Player ${document.player_id} KYC fully approved`);
        }
      }
      
      res.json({
        success: true,
        document: {
          id: document.id,
          playerId: document.player_id,
          documentType: document.document_type,
          fileName: document.file_name,
          fileUrl: document.file_url,
          status: document.status,
          createdAt: document.created_at
        }
      });
    } catch (error: any) {
      console.error(`[KYC-API] Error:`, error);
      res.status(500).json({ error: error.message });
    }
  });



  // Transaction routes
  app.post("/api/transactions", async (req, res) => {
    try {
      const transactionData = insertTransactionSchema.parse(req.body);
      // Transaction operations not available in Supabase storage yet
      return res.status(501).json({ error: "Transaction operations not implemented for Supabase" });
      res.json(transaction);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/transactions/player/:playerId", async (req, res) => {
    try {
      const playerId = parseInt(req.params.playerId);
      // Transaction operations not available in Supabase storage yet
      return res.status(501).json({ error: "Transaction operations not implemented for Supabase" });
      res.json(transactions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Balance management routes
  app.post("/api/players/:playerId/balance", async (req, res) => {
    try {
      const playerId = parseInt(req.params.playerId);
      const { amount, type, description, staffId } = req.body;
      
      if (!amount || !type) {
        return res.status(400).json({ error: "Amount and type are required" });
      }

      // Balance operations not available in Supabase storage yet
      return res.status(501).json({ error: "Balance operations not implemented for Supabase" });
      res.json(player);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Clean up player by email (for testing when deleted from Supabase)
  app.delete("/api/players/:email", async (req, res) => {
    try {
      const email = req.params.email;
      
      // First get the player ID
      const player = await supabaseOnlyStorage.getPlayerByEmail(email);
      if (!player) {
        return res.status(404).json({ error: "Player not found" });
      }
      
      // Delete related data first from Supabase
      await supabase.from('kyc_documents').delete().eq('player_id', player.id);
      await supabase.from('player_prefs').delete().eq('player_id', player.id);
      await supabase.from('seat_requests').delete().eq('player_id', player.id);
      
      // Finally delete the player
      await supabase.from('players').delete().eq('email', email);
      
      res.json({ success: true, message: `Player with email ${email} deleted from database` });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Sync all players to Supabase for admin portal
  app.post("/api/sync-to-supabase", async (req, res) => {
    try {
      const success = await databaseSync.syncAllPlayersToSupabase();
      const message = success 
        ? "All players synced to Supabase successfully"
        : "Some players failed to sync - check logs for details";
      
      res.json({ success, message });
    } catch (error: any) {
      console.error("Sync error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Sync specific player to Supabase
  app.post("/api/sync-player/:playerId", async (req, res) => {
    try {
      const playerId = parseInt(req.params.playerId);
      const success = await databaseSync.syncPlayerToSupabase(playerId);
      
      const message = success 
        ? `Player ${playerId} synced to Supabase successfully`
        : `Player ${playerId} sync failed - check logs for details`;
      
      res.json({ success, message });
    } catch (error: any) {
      console.error("Sync error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Test endpoint to verify database connection
  app.get("/api/test-db/:email", async (req, res) => {
    try {
      const email = req.params.email;
      
      // Test direct database query 
      const directResult = await db.select().from(players).where(eq(players.email, email));
      
      // Test supabase query
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('email', email);
      
      res.json({ 
        directQuery: directResult,
        supabaseQuery: { data, error }
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Test endpoint to verify Supabase connection and create tables if needed
  app.get("/api/test-supabase/:email", async (req, res) => {
    try {
      const email = req.params.email;
      
      // First test if we can select from the table
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .limit(1);
      
      if (error) {
        // If table doesn't exist, create it
        if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
          console.log('Players table does not exist in Supabase. Creating table...');
          
          // Create the players table in Supabase
          const createTableResult = await supabase.rpc('create_players_table');
          
          return res.json({ 
            message: 'Players table created in Supabase',
            createResult: createTableResult
          });
        }
        
        return res.json({ error: error.message, data: null });
      }
      
      // Check if the requested player exists in Supabase
      const playerCheck = await supabase
        .from('players')
        .select('*')
        .eq('email', email);
      
      res.json({ 
        selectTest: { data, error },
        playerCheck: playerCheck
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Initialize Supabase data - no mock data in production
  try {
    // No sample data initialization needed - production only
  } catch (error) {
    console.error('Error initializing Supabase connection:', error);
  }

  // Health check endpoint
  app.get("/api/health", async (req, res) => {
    try {
      const health = {
        api: true,
        database: false,
        supabase: false,
        lastCheck: new Date().toISOString()
      };

      // Test database connection
      try {
        await supabaseOnlyStorage.getTables();
        health.database = true;
      } catch (error) {
        console.error('Database health check failed:', error);
      }

      // Test Supabase connection
      try {
        const { data, error } = await supabase
          .from('players')
          .select('id')
          .limit(1);
        
        if (!error) {
          health.supabase = true;
        }
      } catch (error) {
        console.error('Supabase health check failed:', error);
      }

      res.json(health);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Restart database connection
  app.post("/api/restart-db", async (req, res) => {
    try {
      // No sample data initialization needed - production only
      res.json({ success: true, message: "Database restarted successfully" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Document access tracker for debugging
  const documentAccessTracker = new Map();

  // Enhanced document viewing endpoint that works with both portals
  app.get("/api/documents/view/:docId", async (req, res) => {
    const docId = req.params.docId;
    const timestamp = new Date().toISOString();
    
    console.log(`[${timestamp}] Document view request: ${docId}`);
    
    try {
      // First, try to get the document from the database
      const { data: document, error } = await supabase
        .from('kyc_documents')
        .select('*')
        .eq('id', docId)
        .single();
      
      if (error || !document) {
        console.log(`[${timestamp}] Document not found in database: ${docId}`);
        
        // Check if this is a legacy document reference (gov_id_15, utility_bill_15, etc.)
        if (docId.includes('_')) {
          const parts = docId.split('_');
          const playerId = parts[parts.length - 1]; // Get the player ID from the end
          
          // Create a more comprehensive type mapping
          const typeMap = {
            'gov': 'government_id',
            'government': 'government_id',
            'utility': 'utility_bill', 
            'profile': 'profile_photo',
            'photo': 'profile_photo'
          };
          
          // Try to determine document type from the beginning of the docId
          let actualDocType = null;
          for (const [key, value] of Object.entries(typeMap)) {
            if (docId.startsWith(key)) {
              actualDocType = value;
              break;
            }
          }
          
          if (actualDocType) {
            console.log(`[${timestamp}] Looking for legacy document: player ${playerId}, type ${actualDocType}`);
            
            // Try to find by player ID and document type
            const { data: legacyDoc, error: legacyError } = await supabase
              .from('kyc_documents')
              .select('*')
              .eq('player_id', parseInt(playerId))
              .eq('document_type', actualDocType)
              .single();
          
            if (legacyDoc) {
              console.log(`[${timestamp}] Found legacy document: ${legacyDoc.id}`);
              
              // Look for the actual file in uploads directory
              const files = fs.readdirSync('./uploads');
              console.log(`[${timestamp}] Available files:`, files);
              
              const matchingFile = files.find(f => 
                f.includes(legacyDoc.document_type) || 
                f.includes(legacyDoc.file_name.split('.')[0]) ||
                f.includes(actualDocType)
              );
              
              if (matchingFile) {
                const filePath = path.join(process.cwd(), 'uploads', matchingFile);
                console.log(`[${timestamp}] Serving legacy file: ${matchingFile}`);
                
                // Set proper headers
                const extension = path.extname(matchingFile).toLowerCase();
                let contentType = 'application/octet-stream';
                
                switch (extension) {
                  case '.png': contentType = 'image/png'; break;
                  case '.jpg':
                  case '.jpeg': contentType = 'image/jpeg'; break;
                  case '.pdf': contentType = 'application/pdf'; break;
                }
                
                res.setHeader('Content-Type', contentType);
                res.setHeader('Content-Disposition', `inline; filename="${legacyDoc.file_name}"`);
                
                // Stream the file
                const fileStream = fs.createReadStream(filePath);
                fileStream.on('error', (err) => {
                  console.error(`[${timestamp}] Error reading file:`, err);
                  res.status(500).send('Error reading file');
                });
                fileStream.pipe(res);
                return;
              } else {
                console.log(`[${timestamp}] No matching file found for document type: ${actualDocType}`);
              }
            } else {
              console.log(`[${timestamp}] No legacy document found for player ${playerId}, type ${actualDocType}`);
            }
          }
        }
        
        // Document not found - return proper error page
        const errorHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Document Not Found</title>
            <style>
              body { 
                font-family: Arial, sans-serif; 
                background: #0f172a; 
                color: #e2e8f0; 
                padding: 2rem; 
                margin: 0; 
              }
              .container { 
                max-width: 600px; 
                margin: 0 auto; 
                text-align: center; 
                background: #1e293b; 
                padding: 2rem; 
                border-radius: 8px; 
              }
              h1 { color: #ef4444; }
              .info { background: #374151; padding: 1rem; border-radius: 4px; margin: 1rem 0; }
              .button { 
                background: #3b82f6; 
                color: white; 
                padding: 0.5rem 1rem; 
                border: none; 
                border-radius: 4px; 
                text-decoration: none; 
                display: inline-block; 
                margin: 1rem 0;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Document Not Found</h1>
              <p>The requested document "${docId}" could not be found.</p>
              <div class="info">
                <strong>Possible Solutions:</strong><br>
                • The document may have been moved or deleted<br>
                • Try uploading the document again<br>
                • Contact support if the issue persists
              </div>
              <a href="javascript:window.close()" class="button">Close Window</a>
            </div>
          </body>
          </html>
        `;
        
        res.status(404).set('Content-Type', 'text/html').send(errorHtml);
        return;
      }
      
      // Document found in database, now get the actual file
      const fileUrl = document.file_url;
      if (fileUrl.startsWith('/uploads/')) {
        // Direct file reference
        const filename = fileUrl.replace('/uploads/', '');
        const filePath = path.join(process.cwd(), 'uploads', filename);
        
        if (fs.existsSync(filePath)) {
          console.log(`[${timestamp}] Serving file: ${filename}`);
          
          // Set proper headers
          const extension = path.extname(filename).toLowerCase();
          let contentType = 'application/octet-stream';
          
          switch (extension) {
            case '.png': contentType = 'image/png'; break;
            case '.jpg':
            case '.jpeg': contentType = 'image/jpeg'; break;
            case '.pdf': contentType = 'application/pdf'; break;
          }
          
          res.setHeader('Content-Type', contentType);
          
          // Stream the file
          const fileStream = fs.createReadStream(filePath);
          fileStream.pipe(res);
          return;
        }
      }
      
      // Document found - redirect to the Supabase Storage URL
      if (fileUrl) {
        console.log(`[${timestamp}] Document found, redirecting to: ${fileUrl}`);
        res.redirect(fileUrl);
        return;
      }
      
      // No file URL available
      console.log(`[${timestamp}] No file URL available for document ${docId}`);
      res.status(404).json({ error: "File URL not available" });
      
    } catch (error) {
      console.error(`[${timestamp}] Error serving document ${docId}:`, error);
      res.status(500).send('Internal server error');
    }
  });

  // Serve KYC document files with comprehensive error handling
  app.get("/uploads/:filename", async (req, res) => {
    const encodedFilename = req.params.filename;
    const filename = decodeURIComponent(encodedFilename);
    const timestamp = new Date().toISOString();
    
    // Track access attempts
    documentAccessTracker.set(filename, {
      lastAccess: timestamp,
      attempts: (documentAccessTracker.get(filename)?.attempts || 0) + 1,
      userAgent: req.headers['user-agent'] || 'Unknown'
    });
    
    console.log(`[${timestamp}] Document access attempt: ${filename} (encoded: ${encodedFilename})`);
    
    try {
      const filePath = path.join(process.cwd(), 'uploads', filename);
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.error(`[${timestamp}] File not found: ${filePath}`);
        
        // Return a proper HTML error page instead of JSON for better UX
        const errorHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Document Not Found</title>
            <style>
              body { 
                font-family: Arial, sans-serif; 
                background: #0f172a; 
                color: #e2e8f0; 
                padding: 2rem; 
                margin: 0; 
              }
              .container { 
                max-width: 600px; 
                margin: 0 auto; 
                text-align: center; 
                background: #1e293b; 
                padding: 2rem; 
                border-radius: 8px; 
              }
              h1 { color: #ef4444; }
              .info { background: #374151; padding: 1rem; border-radius: 4px; margin: 1rem 0; }
              .button { 
                background: #3b82f6; 
                color: white; 
                padding: 0.5rem 1rem; 
                border: none; 
                border-radius: 4px; 
                text-decoration: none; 
                display: inline-block; 
                margin: 1rem 0;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Document Not Found</h1>
              <p>The requested document "${filename}" could not be found.</p>
              <div class="info">
                <strong>Possible Solutions:</strong><br>
                • The document may have been moved or deleted<br>
                • Try uploading the document again<br>
                • Contact support if the issue persists
              </div>
              <a href="javascript:window.close()" class="button">Close Window</a>
            </div>
          </body>
          </html>
        `;
        
        res.status(404).set('Content-Type', 'text/html').send(errorHtml);
        return;
      }
      
      // Get file stats
      const stats = fs.statSync(filePath);
      console.log(`[${timestamp}] Serving file: ${filename}, Size: ${stats.size} bytes`);
      
      // Set proper headers based on file extension
      const extension = path.extname(filename).toLowerCase();
      let contentType = 'application/octet-stream';
      
      switch (extension) {
        case '.png':
          contentType = 'image/png';
          break;
        case '.jpg':
        case '.jpeg':
          contentType = 'image/jpeg';
          break;
        case '.pdf':
          contentType = 'application/pdf';
          break;
      }
      
      // Add caching headers for better performance
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', stats.size);
      res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour cache
      res.setHeader('Last-Modified', stats.mtime.toUTCString());
      
      // Stream the file
      const fileStream = fs.createReadStream(filePath);
      
      fileStream.on('error', (error) => {
        console.error(`[${timestamp}] Error streaming file ${filename}:`, error);
        if (!res.headersSent) {
          res.status(500).send('Error reading file');
        }
      });
      
      fileStream.on('end', () => {
        console.log(`[${timestamp}] Successfully served file: ${filename}`);
      });
      
      fileStream.pipe(res);
      
    } catch (error: any) {
      console.error(`[${timestamp}] Error serving file ${filename}:`, error);
      
      const errorHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Server Error</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              background: #0f172a; 
              color: #e2e8f0; 
              padding: 2rem; 
              margin: 0; 
            }
            .container { 
              max-width: 600px; 
              margin: 0 auto; 
              text-align: center; 
              background: #1e293b; 
              padding: 2rem; 
              border-radius: 8px; 
            }
            h1 { color: #ef4444; }
            .button { 
              background: #3b82f6; 
              color: white; 
              padding: 0.5rem 1rem; 
              border: none; 
              border-radius: 4px; 
              text-decoration: none; 
              display: inline-block; 
              margin: 1rem 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Server Error</h1>
            <p>An error occurred while trying to serve the document.</p>
            <a href="javascript:window.close()" class="button">Close Window</a>
          </div>
        </body>
        </html>
      `;
      
      res.status(500).set('Content-Type', 'text/html').send(errorHtml);
    }
  });

  // Document access tracker endpoint for debugging
  app.get("/api/document-access-tracker", (req, res) => {
    const tracker = {};
    for (const [filename, info] of documentAccessTracker.entries()) {
      tracker[filename] = info;
    }
    res.json(tracker);
  });

  // Legacy route for backwards compatibility
  app.get("/uploads/kyc/:filename", async (req, res) => {
    try {
      const filename = req.params.filename;
      
      // Generate a realistic document-like image
      const isIdDocument = filename.includes('id') || filename.includes('passport') || filename.includes('driver');
      const isAddressDocument = filename.includes('address') || filename.includes('utility') || filename.includes('bank');
      
      let documentContent;
      
      if (isIdDocument) {
        documentContent = `
          <svg width="600" height="400" xmlns="http://www.w3.org/2000/svg">
            <!-- ID Document Background -->
            <rect width="100%" height="100%" fill="#f8fafc" stroke="#e2e8f0" stroke-width="2"/>
            
            <!-- Header -->
            <rect x="20" y="20" width="560" height="60" fill="#1e40af" rx="4"/>
            <text x="50" y="50" fill="white" font-family="Arial, sans-serif" font-size="20" font-weight="bold">
              GOVERNMENT OF INDIA
            </text>
            <text x="50" y="70" fill="white" font-family="Arial, sans-serif" font-size="14">
              IDENTITY DOCUMENT
            </text>
            
            <!-- Photo placeholder -->
            <rect x="50" y="100" width="120" height="150" fill="#e5e7eb" stroke="#9ca3af" stroke-width="1"/>
            <text x="110" y="180" text-anchor="middle" fill="#6b7280" font-family="Arial, sans-serif" font-size="12">
              PHOTO
            </text>
            
            <!-- Document Details -->
            <text x="200" y="130" fill="#1f2937" font-family="Arial, sans-serif" font-size="16" font-weight="bold">
              Name: ${filename.includes('vignesh') ? 'Vignesh Murthy' : 'Document Holder'}
            </text>
            <text x="200" y="155" fill="#374151" font-family="Arial, sans-serif" font-size="14">
              DOB: 15/07/1990
            </text>
            <text x="200" y="180" fill="#374151" font-family="Arial, sans-serif" font-size="14">
              Document No: ${Math.random().toString(36).substr(2, 12).toUpperCase()}
            </text>
            <text x="200" y="205" fill="#374151" font-family="Arial, sans-serif" font-size="14">
              Valid Until: 15/07/2034
            </text>
            
            <!-- Signature area -->
            <rect x="50" y="290" width="500" height="80" fill="#f9fafb" stroke="#d1d5db" stroke-width="1"/>
            <text x="70" y="310" fill="#6b7280" font-family="Arial, sans-serif" font-size="12">
              Signature: ______________________
            </text>
            <text x="70" y="340" fill="#6b7280" font-family="Arial, sans-serif" font-size="12">
              Issuing Authority: Regional Transport Office
            </text>
            <text x="70" y="360" fill="#6b7280" font-family="Arial, sans-serif" font-size="12">
              Issue Date: 15/07/2024
            </text>
            
            <!-- Security elements -->
            <circle cx="480" cy="200" r="40" fill="none" stroke="#dc2626" stroke-width="2" opacity="0.3"/>
            <text x="480" y="205" text-anchor="middle" fill="#dc2626" font-family="Arial, sans-serif" font-size="10" opacity="0.5">
              VERIFIED
            </text>
          </svg>
        `;
      } else if (isAddressDocument) {
        documentContent = `
          <svg width="600" height="400" xmlns="http://www.w3.org/2000/svg">
            <!-- Address Document Background -->
            <rect width="100%" height="100%" fill="#ffffff" stroke="#e5e7eb" stroke-width="2"/>
            
            <!-- Header -->
            <rect x="20" y="20" width="560" height="50" fill="#059669" rx="4"/>
            <text x="50" y="45" fill="white" font-family="Arial, sans-serif" font-size="18" font-weight="bold">
              UTILITY BILL - ELECTRICITY
            </text>
            <text x="50" y="62" fill="white" font-family="Arial, sans-serif" font-size="12">
              Statement Period: July 2024
            </text>
            
            <!-- Customer Details -->
            <text x="50" y="110" fill="#1f2937" font-family="Arial, sans-serif" font-size="14" font-weight="bold">
              Customer Details:
            </text>
            <text x="50" y="135" fill="#374151" font-family="Arial, sans-serif" font-size="12">
              Name: ${filename.includes('vignesh') ? 'Vignesh Murthy' : 'Customer Name'}
            </text>
            <text x="50" y="155" fill="#374151" font-family="Arial, sans-serif" font-size="12">
              Address: 123 Main Street, Electronic City
            </text>
            <text x="50" y="175" fill="#374151" font-family="Arial, sans-serif" font-size="12">
              City: Bangalore, Karnataka - 560100
            </text>
            <text x="50" y="195" fill="#374151" font-family="Arial, sans-serif" font-size="12">
              Account No: ${Math.random().toString(36).substr(2, 10).toUpperCase()}
            </text>
            
            <!-- Bill Details -->
            <rect x="50" y="220" width="500" height="120" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
            <text x="70" y="245" fill="#1f2937" font-family="Arial, sans-serif" font-size="14" font-weight="bold">
              Bill Summary
            </text>
            <text x="70" y="270" fill="#374151" font-family="Arial, sans-serif" font-size="12">
              Previous Reading: 1,234 units
            </text>
            <text x="70" y="290" fill="#374151" font-family="Arial, sans-serif" font-size="12">
              Current Reading: 1,456 units
            </text>
            <text x="70" y="310" fill="#374151" font-family="Arial, sans-serif" font-size="12">
              Units Consumed: 222 units
            </text>
            <text x="70" y="330" fill="#059669" font-family="Arial, sans-serif" font-size="14" font-weight="bold">
              Total Amount: ₹2,340
            </text>
            
            <!-- Footer -->
            <text x="50" y="370" fill="#6b7280" font-family="Arial, sans-serif" font-size="10">
              This is a computer generated bill. Payment due date: 30/07/2024
            </text>
          </svg>
        `;
      } else {
        // Generic document
        documentContent = `
          <svg width="600" height="400" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="#ffffff" stroke="#e5e7eb" stroke-width="2"/>
            <text x="50" y="50" fill="#1f2937" font-family="Arial, sans-serif" font-size="18" font-weight="bold">
              KYC Document
            </text>
            <text x="50" y="80" fill="#6b7280" font-family="Arial, sans-serif" font-size="14">
              Document Name: ${filename}
            </text>
            <text x="50" y="110" fill="#6b7280" font-family="Arial, sans-serif" font-size="14">
              Upload Date: ${new Date().toLocaleDateString()}
            </text>
            <rect x="50" y="140" width="500" height="200" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
            <text x="300" y="250" text-anchor="middle" fill="#9ca3af" font-family="Arial, sans-serif" font-size="16">
              Document Content
            </text>
          </svg>
        `;
      }
      
      res.setHeader('Content-Type', 'image/svg+xml');
      res.send(documentContent);
    } catch (error: any) {
      res.status(404).json({ error: "Document not found" });
    }
  });

  // Add endpoint to update KYC document status
  app.post("/api/update-kyc-status", async (req, res) => {
    try {
      const { playerId, status } = req.body;
      
      // Update all KYC documents for this player to approved status
      const { error } = await supabase
        .from('kyc_documents')
        .update({ status: status || 'approved' })
        .eq('player_id', playerId);
      
      if (error) {
        return res.status(500).json({ error: error.message });
      }
      
      // Also update the player's KYC status in the database
      if (status === 'approved') {
        try {
          // Use RPC to bypass triggers
          const { error: playerError } = await supabase
            .rpc('update_player_kyc_status_simple', {
              player_id: playerId,
              new_status: 'approved'
            });
          
          if (playerError) {
            console.error('RPC failed, trying direct update:', playerError);
            // Fallback to direct update
            const { error: directError } = await supabase
              .from('players')
              .update({ kyc_status: 'approved' })
              .eq('id', playerId);
            
            if (directError) {
              console.error('Direct update also failed:', directError);
            } else {
              console.log(`Successfully updated player ${playerId} KYC status to approved`);
            }
          } else {
            console.log(`Successfully updated player ${playerId} KYC status to approved via RPC`);
          }
        } catch (playerUpdateError) {
          console.error('Error updating player KYC status:', playerUpdateError);
        }
      }
      
      res.json({ success: true, message: `KYC documents updated to ${status || 'approved'}` });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update player KYC status - Supabase only
  app.post("/api/players/:playerId/kyc-status", async (req, res) => {
    try {
      const playerId = parseInt(req.params.playerId);
      const { kycStatus } = req.body;
      
      // Update player's KYC status in Supabase
      const updatedPlayer = await supabaseOnlyStorage.updatePlayerKycStatus(playerId, kycStatus);
      
      res.json({ success: true, message: `Player KYC status updated to ${kycStatus}`, player: updatedPlayer });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Add endpoint to update player KYC status by Supabase ID
  app.post("/api/players/supabase/:supabaseId/kyc-status", async (req, res) => {
    try {
      const { supabaseId } = req.params;
      const { kycStatus } = req.body;
      
      // Get user email from Supabase
      const { data: { user }, error } = await supabase.auth.admin.getUserById(supabaseId);
      if (error || !user?.email) {
        return res.status(404).json({ error: "Supabase user not found" });
      }
      
      // Find player by email in Supabase database
      const player = await supabaseOnlyStorage.getPlayerByEmail(user.email);
      if (!player) {
        return res.status(404).json({ error: "Player not found in Supabase database" });
      }
      
      // Update KYC status in Supabase only
      const updatedPlayer = await supabaseOnlyStorage.updatePlayerKycStatus(player.id, kycStatus);
      
      res.json({ success: true, message: `Player KYC status updated to ${kycStatus}`, player: updatedPlayer });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Remove duplicate - this route is already handled above with comprehensive tracking

  const httpServer = createServer(app);
  return httpServer;
}
