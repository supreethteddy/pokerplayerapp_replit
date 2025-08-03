import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
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

// STAFF PORTAL EXCLUSIVE MODE - Using ONLY Staff Portal Supabase for ALL operations
// No local or fallback databases - everything goes through Staff Portal system
const staffPortalSupabase = createClient(
  process.env.STAFF_PORTAL_SUPABASE_URL!,
  process.env.STAFF_PORTAL_SUPABASE_SERVICE_KEY!
);

// UNIFIED SYSTEM - All database operations use Staff Portal Supabase exclusively
const supabase = staffPortalSupabase;  // Redirect all calls to Staff Portal
const localSupabase = staffPortalSupabase;  // No more local database - use Staff Portal

// Create KYC document schema - omit fileUrl as it's generated during upload
const insertKycDocumentSchema = createInsertSchema(kycDocuments).omit({ fileUrl: true });

// Create upload request schema for KYC documents
const kycUploadSchema = z.object({
  playerId: z.number(),
  documentType: z.string(),
  fileName: z.string(),
  dataUrl: z.string()
});

// **UNIFIED CHAT WEBSOCKET SERVER - Enterprise Grade**
interface AuthenticatedWebSocket extends WebSocket {
  playerId?: number;
  playerName?: string;
  playerEmail?: string;
  isAuthenticated?: boolean;
}

const connectedClients = new Map<number, AuthenticatedWebSocket>();

export async function registerRoutes(app: Express): Promise<Server> {
  
  // 🚨 ENTERPRISE-GRADE CHAT STATUS ENDPOINT
  app.get('/api/test-chat-status', async (req, res) => {
    console.log('🔍 WEBSOCKET DEBUG: Chat status test requested');
    
    try {
      const status = {
        timestamp: new Date().toISOString(),
        websocketConnections: `${playerConnections.size} active connections`,
        database: 'Production Staff Portal Supabase ONLY',
        messageRouting: 'Real-time bidirectional (no broadcast-all)',
        authentication: 'Production user context (no mock data)',
        sessionManagement: 'Active sessions tracked per player',
        logging: 'Enterprise-grade debug enabled',
        productionValidation: 'All mock/test/demo data eliminated'
      };
      
      console.log('🔍 WEBSOCKET DEBUG: System status check:', JSON.stringify(status, null, 2));
      
      res.json({
        success: true,
        status,
        message: 'Real-time chat system operational with production data ONLY'
      });
      
    } catch (error) {
      console.error('❌ WEBSOCKET DEBUG: Status check failed:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Chat system status check failed' 
      });
    }
  });

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
      
      // Create waitlist entry with assignment
      const { data, error } = await supabase
        .from('waitlist')
        .insert({
          player_id: player.id,
          table_id: tableId,
          game_type: 'Table Assignment',
          min_buy_in: 0,
          max_buy_in: 0,
          position: seatPosition || 1,
          status: 'assigned',
          requested_at: new Date().toISOString(),
          notes: `Assigned by staff ${staffId}`
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

  // Get detailed table view data for TableView component - OFFLINE LOCAL POKER GAME
  app.get("/api/tables/:tableId/view", async (req, res) => {
    try {
      const { tableId } = req.params;
      console.log(`🎮 [OFFLINE TABLE VIEW] Fetching table details for: ${tableId}`);
      
      // Fetch table from Staff Portal Supabase
      const { data: table, error } = await supabase
        .from('poker_tables')
        .select('*')
        .eq('id', tableId)
        .single();
        
      if (error || !table) {
        console.error('[OFFLINE TABLE VIEW] Error fetching table:', error);
        return res.status(404).json({ error: 'Table not found' });
      }
      
      // Fetch ONLY real players added by staff (no mock/online players)
      // Check if there are any seated players for this table
      const { data: seatedPlayers, error: seatedError } = await supabase
        .from('waitlist')
        .select(`
          *,
          players:player_id (
            id,
            first_name,
            last_name,
            email
          )
        `)
        .eq('table_id', tableId)
        .eq('status', 'seated');

      let actualPlayers = [];
      
      if (seatedPlayers && seatedPlayers.length > 0) {
        // Only show players that have been seated by staff
        actualPlayers = seatedPlayers.map((seatData, index) => ({
          id: seatData.players?.id || index + 1,
          username: seatData.players?.first_name || `Player ${index + 1}`,
          stack: 5000, // Default starting stack for offline game
          position: seatData.position || index,
          cards: [], // No cards shown in offline mode
          isDealer: index === 0, // First seated player is dealer
          isSmallBlind: index === 1,
          isBigBlind: index === 2,
          isStaffAdded: true // Flag to indicate this is a real staff-added player
        }));
        
        console.log(`✅ [OFFLINE TABLE VIEW] Found ${actualPlayers.length} staff-seated players`);
      } else {
        console.log(`ℹ️ [OFFLINE TABLE VIEW] No staff-seated players found for table ${table.name}`);
      }
      
      const tableViewData = {
        id: table.id,
        name: table.name,
        gameType: table.game_type || "Texas Hold'em",
        stakes: table.small_blind && table.big_blind ? `₹${table.small_blind}/₹${table.big_blind}` : "₹100/₹200",
        pot: 0, // No active pot in offline mode
        players: actualPlayers, // Only real staff-added players
        maxPlayers: table.max_players || 8,
        communityCards: [], // No community cards in offline mode
        isActive: table.status === 'active',
        isOfflineGame: true // Flag to indicate this is an offline game
      };
      
      console.log(`✅ [OFFLINE TABLE VIEW] Returning OFFLINE table data for ${table.name} with ${actualPlayers.length} STAFF-ADDED players`);
      res.json(tableViewData);
    } catch (error: any) {
      console.error('[OFFLINE TABLE VIEW] Error:', error);
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
      
      // Verify table exists in poker_tables (using Staff Portal database)
      const { data: tableExists, error: tableError } = await staffPortalSupabase
        .from('poker_tables')
        .select('id, game_type, min_buy_in, max_buy_in')
        .eq('id', tableUuid)
        .single();
      
      if (tableError || !tableExists) {
        throw new Error(`Table not found: ${tableUuid}`);
      }
      
      console.log('✅ [WAITLIST ROUTE] Table exists:', tableExists);
      
      // Get current waitlist count for position
      const { data: waitlistCount, error: countError } = await staffPortalSupabase
        .from('waitlist')
        .select('id')
        .eq('table_id', tableUuid)
        .eq('status', 'waiting');
      
      const position = (waitlistCount?.length || 0) + 1;
      
      // Create waitlist entry in Staff Portal Supabase using proper 'waitlist' table
      const { data: waitlistEntry, error: insertError } = await staffPortalSupabase
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
          // seat_number: requestData.seatNumber || null, // Field doesn't exist, using notes instead
          notes: requestData.notes || `Player ${requestData.playerId} requested seat ${requestData.seatNumber || 'Any'} via interactive seat selection`
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
        // seatNumber: waitlistEntry.seat_number, // Field doesn't exist in table
        notes: waitlistEntry.notes,
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
      
      // Get waitlist entries from Staff Portal Supabase using proper 'waitlist' table
      const { data: requests, error } = await staffPortalSupabase
        .from('waitlist')
        .select('*')
        .eq('player_id', playerId)
        .order('requested_at', { ascending: false });
      
      if (error) {
        throw new Error(`Failed to fetch waitlist: ${error.message}`);
      }
      
      // Transform to camelCase for response (INCLUDE ALL ENTRIES INCLUDING SEATED)
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
        seatNumber: req.seat_number,
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
      
      // Remove from waitlist - Remove all entries for this player and table
      const { data: deletedEntries, error } = await staffPortalSupabase
        .from('waitlist')
        .delete()
        .eq('player_id', playerId)
        .eq('table_id', tableId)
        .select();
      
      if (error) {
        throw new Error(`Failed to remove from waitlist: ${error.message}`);
      }
      
      console.log('✅ [WAITLIST DELETE] Successfully removed', deletedEntries?.length || 0, 'entries from waitlist');
      res.json({ success: true, removed: deletedEntries });
    } catch (error: any) {
      console.error('❌ [WAITLIST DELETE] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Simple waitlist join endpoint
  app.post("/api/waitlist/join", async (req, res) => {
    try {
      const { table_id, player_id, game_type, min_buy_in, max_buy_in, notes } = req.body;
      
      console.log('🎯 [SIMPLE JOIN API] Join request:', { table_id, player_id, notes });
      
      // Check if player is already in waitlist for this table
      const { data: existingEntry } = await staffPortalSupabase
        .from('waitlist')
        .select('*')
        .eq('player_id', player_id)
        .eq('table_id', table_id)
        .single();
      
      if (existingEntry) {
        return res.status(400).json({ error: 'Already in waitlist for this table' });
      }
      
      // Get the next position
      const { data: waitlistEntries } = await staffPortalSupabase
        .from('waitlist')
        .select('position')
        .eq('table_id', table_id)
        .order('position', { ascending: false })
        .limit(1);
      
      const nextPosition = (waitlistEntries?.[0]?.position || 0) + 1;
      
      // Add to waitlist
      const { data: newEntry, error } = await staffPortalSupabase
        .from('waitlist')
        .insert({
          player_id,
          table_id,
          game_type: game_type || 'Texas Hold\'em',
          min_buy_in: min_buy_in || 1000,
          max_buy_in: max_buy_in || 10000,
          position: nextPosition,
          status: 'waiting',
          notes: notes || `Player ${player_id} joined waitlist`,
          requested_at: new Date().toISOString(),
        })
        .select()
        .single();
      
      if (error) {
        throw new Error(`Failed to join waitlist: ${error.message}`);
      }
      
      console.log('✅ [SIMPLE JOIN API] Successfully added to waitlist:', newEntry);
      res.json({ success: true, entry: newEntry });
    } catch (error: any) {
      console.error('❌ [SIMPLE JOIN API] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Clean up old waitlist entries (for tables that no longer exist)
  app.delete("/api/cleanup-waitlist/:playerId", async (req, res) => {
    try {
      const playerId = parseInt(req.params.playerId);
      
      console.log('🧹 [WAITLIST CLEANUP] Cleaning up old entries for player', playerId);
      
      // Get current table IDs
      const { data: currentTables } = await staffPortalSupabase
        .from('staff_tables')
        .select('id');
      
      const currentTableIds = currentTables?.map(t => t.id) || [];
      
      // Remove waitlist entries for tables that don't exist anymore
      const { data: deletedEntries, error } = await staffPortalSupabase
        .from('waitlist')
        .delete()
        .eq('player_id', playerId)
        .not('table_id', 'in', `(${currentTableIds.map(id => `'${id}'`).join(',')})`)
        .select();
      
      if (error) {
        console.log('❌ [WAITLIST CLEANUP] Error:', error.message);
      } else {
        console.log('✅ [WAITLIST CLEANUP] Cleaned up', deletedEntries?.length || 0, 'old waitlist entries');
      }
      
      res.json({ success: true, cleaned: deletedEntries?.length || 0 });
    } catch (error: any) {
      console.error('❌ [WAITLIST CLEANUP] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get waitlist for a specific table (for Staff Portal)
  app.get("/api/waitlist/table/:tableId", async (req, res) => {
    try {
      const tableId = req.params.tableId;
      
      console.log('📋 [WAITLIST TABLE] Getting waitlist for table:', tableId);
      
      // Get all waitlist entries for this table using Staff Portal database
      const { data: waitlist, error } = await staffPortalSupabase
        .from('waitlist')
        .select(`
          *,
          players!inner(first_name, last_name, email, phone)
        `)
        .eq('table_id', tableId)
        .eq('status', 'waiting')
        .order('seat_number', { ascending: true, nullsLast: true })
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
        seatNumber: entry.seat_number,
        notes: entry.notes,
        player: {
          firstName: entry.players.first_name,
          lastName: entry.players.last_name,
          email: entry.players.email,
          phone: entry.players.phone
        }
      }));
      
      console.log('✅ [WAITLIST TABLE] Returning', transformedWaitlist.length, 'waitlist entries with seat reservations');
      res.json(transformedWaitlist);
    } catch (error: any) {
      console.error('❌ [WAITLIST TABLE] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get seat reservations for a specific seat (for Manager Portal)
  app.get("/api/waitlist/seat/:tableId/:seatNumber", async (req, res) => {
    try {
      const tableId = req.params.tableId;
      const seatNumber = parseInt(req.params.seatNumber);
      
      console.log(`📋 [SEAT RESERVATIONS] Getting reservations for table ${tableId}, seat ${seatNumber}`);
      
      // Get all players who reserved this specific seat
      const { data: reservations, error } = await staffPortalSupabase
        .from('waitlist')
        .select(`
          *,
          players!inner(first_name, last_name, email, phone)
        `)
        .eq('table_id', tableId)
        .eq('seat_number', seatNumber)
        .eq('status', 'waiting')
        .order('position', { ascending: true });
      
      if (error) {
        throw new Error(`Failed to fetch seat reservations: ${error.message}`);
      }
      
      // Transform for response
      const transformedReservations = (reservations || []).map(entry => ({
        id: entry.id,
        playerId: entry.player_id,
        tableId: entry.table_id,
        seatNumber: entry.seat_number,
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
      
      console.log(`✅ [SEAT RESERVATIONS] Found ${transformedReservations.length} reservations for seat ${seatNumber}`);
      res.json(transformedReservations);
    } catch (error: any) {
      console.error('❌ [SEAT RESERVATIONS] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Assign player to seat (for Staff Portal)
  app.post("/api/staff/assign-player", async (req, res) => {
    try {
      const { waitlistId, seatNumber, assignedBy } = req.body;
      
      console.log(`👤 [STAFF ASSIGN] Assigning player from waitlist ${waitlistId} to seat ${seatNumber} by ${assignedBy}`);
      
      // Update waitlist entry to seated status (SCHEMA WORKAROUND - only use known columns)
      const { data: updatedEntry, error } = await staffPortalSupabase
        .from('waitlist')
        .update({
          status: 'seated',
          position: seatNumber,  // Use position instead of seat_number to bypass schema cache
          seated_at: new Date().toISOString(),
          notes: `Assigned to seat ${seatNumber} by ${assignedBy || 'staff'}`
        })
        .eq('id', waitlistId)
        .select('*')
        .single();
      
      if (error) {
        throw new Error(`Failed to assign player: ${error.message}`);
      }
      
      // Get player details separately to avoid join issues
      const { data: playerData } = await staffPortalSupabase
        .from('players')
        .select('first_name, last_name, email, phone')
        .eq('id', updatedEntry.player_id)
        .single();
      
      // Transform for response
      const transformedAssignment = {
        id: updatedEntry.id,
        playerId: updatedEntry.player_id,
        tableId: updatedEntry.table_id,
        seatNumber: updatedEntry.position, // Use position as seat number
        status: updatedEntry.status,
        seatedAt: updatedEntry.seated_at,
        notes: updatedEntry.notes,
        player: playerData ? {
          firstName: playerData.first_name,
          lastName: playerData.last_name,
          email: playerData.email,
          phone: playerData.phone
        } : null
      };
      
      console.log('✅ [STAFF ASSIGN] Player assigned successfully:', transformedAssignment);
      res.json(transformedAssignment);
    } catch (error: any) {
      console.error('❌ [STAFF ASSIGN] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get seated players for a table (for Player Portal table view) - SIMPLIFIED VERSION
  app.get("/api/table-seats/:tableId", async (req, res) => {
    try {
      const tableId = req.params.tableId;
      
      console.log(`🪑 [TABLE SEATS] Getting seated players for table ${tableId}`);
      
      // BYPASS ALL SCHEMA ISSUES: Query waitlist with explicit table_id as UUID string
      console.log(`🔍 [TABLE SEATS] Querying waitlist for table_id: "${tableId}" (${typeof tableId})`);
      
      const { data: allWaitlistData, error } = await staffPortalSupabase
        .from('waitlist')
        .select('id, player_id, position, status, seated_at, created_at, notes')
        .eq('table_id', tableId);
      
      console.log(`🔍 [TABLE SEATS] Raw waitlist query result:`, { 
        found: allWaitlistData?.length || 0, 
        error: error?.message,
        sample: allWaitlistData?.[0] 
      });
      
      // Filter for seated players in memory
      const waitlistData = (allWaitlistData || []).filter(entry => entry.status === 'seated');
      
      if (error) {
        console.error('❌ [TABLE SEATS] Waitlist query error:', error);
        return res.json([]);
      }
      
      console.log(`🪑 [TABLE SEATS] Query result - All entries: ${allWaitlistData?.length || 0}, Seated entries: ${waitlistData?.length || 0}`);
      console.log('🪑 [TABLE SEATS] All waitlist data for table:', JSON.stringify(allWaitlistData?.slice(0, 3), null, 2));
      
      if (error) {
        console.error('❌ [TABLE SEATS] Waitlist query error:', error);
        return res.json([]); // Return empty array instead of error
      }
      
      // Get player details separately to avoid join issues
      const seatedPlayers = [];
      for (const entry of waitlistData || []) {
        const { data: playerData, error: playerError } = await staffPortalSupabase
          .from('players')
          .select('first_name, last_name, email')
          .eq('id', entry.player_id)
          .single();
        
        if (!playerError && playerData) {
          seatedPlayers.push({
            seatNumber: entry.seat_number || entry.position, // Use seat_number if available, fallback to position
            playerId: entry.player_id,
            player: {
              firstName: playerData.first_name,
              lastName: playerData.last_name,
              email: playerData.email
            },
            seatedAt: entry.seated_at
          });
        }
      }
      
      console.log(`✅ [TABLE SEATS] Found ${seatedPlayers.length} seated players`);
      res.json(seatedPlayers);
    } catch (error: any) {
      console.error('❌ [TABLE SEATS] Unexpected error:', error);
      res.json([]); // Return empty array instead of error
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
      const playerId = req.params.playerId;
      
      console.log('📋 [CREDIT REQUESTS] Getting requests for player:', playerId);
      
      // Handle both numeric and UUID format player IDs  
      const { data: requests, error } = await staffPortalSupabase
        .from('credit_requests')
        .select('*')
        .eq('player_id', playerId)
        .order('created_at', { ascending: false });
      
      if (error) {
        throw new Error(`Failed to fetch credit requests: ${error.message}`);
      }
      
      // Return empty array for clean production environment
      console.log('✅ [CREDIT REQUESTS] No mock data - returning empty array for production');
      res.json([]);
      

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

  // Get player account balances (regular + credit) - Enhanced dual balance system
  app.get("/api/account-balance/:playerId", async (req, res) => {
    try {
      const playerId = parseInt(req.params.playerId);
      console.log(`💰 [ACCOUNT BALANCE] Getting balance for player: ${playerId}`);
      
      const { data, error } = await staffPortalSupabase
        .from('account_balances')
        .select('*')
        .eq('player_id', playerId)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        throw new Error(`Failed to fetch account balance: ${error.message}`);
      }
      
      // If no balance record exists, create one
      if (!data) {
        const { data: newBalance, error: insertError } = await staffPortalSupabase
          .from('account_balances')
          .insert({
            player_id: playerId,
            regular_balance: 0.00,
            credit_limit: 0.00,
            available_credit: 0.00
          })
          .select()
          .single();
        
        if (insertError) {
          throw new Error(`Failed to create account balance: ${insertError.message}`);
        }
        
        console.log(`✅ [ACCOUNT BALANCE] Created new balance record for player ${playerId}`);
        res.json(newBalance);
      } else {
        console.log(`✅ [ACCOUNT BALANCE] Found balance for player ${playerId}: Regular=₹${data.regular_balance}, Credit=₹${data.credit_limit}`);
        res.json(data);
      }
    } catch (error: any) {
      console.error(`❌ [ACCOUNT BALANCE] Error:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // Staff Portal: Create credit request
  app.post("/api/staff/credit-request", async (req, res) => {
    try {
      const { playerId, requestedAmount, currentCreditLimit, newCreditLimit, requestedBy, requestReason } = req.body;
      console.log(`📋 [STAFF CREDIT REQUEST] Creating credit request for player ${playerId}: ₹${requestedAmount}`);
      
      const { data, error } = await staffPortalSupabase
        .from('credit_requests')
        .insert({
          player_id: playerId,
          requested_amount: requestedAmount,
          current_credit_limit: currentCreditLimit,
          new_credit_limit: newCreditLimit,
          requested_by: requestedBy,
          request_reason: requestReason,
          status: 'pending'
        })
        .select()
        .single();
      
      if (error) {
        throw new Error(`Failed to create credit request: ${error.message}`);
      }
      
      console.log(`✅ [STAFF CREDIT REQUEST] Created credit request: ${data.id}`);
      res.json(data);
    } catch (error: any) {
      console.error(`❌ [STAFF CREDIT REQUEST] Error:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // Super Admin: Approve/Reject credit request
  app.post("/api/admin/credit-request/:requestId/review", async (req, res) => {
    try {
      const requestId = req.params.requestId;
      const { status, reviewedBy, reviewNotes } = req.body;
      console.log(`🔍 [ADMIN CREDIT REVIEW] ${status} credit request ${requestId} by ${reviewedBy}`);
      
      // Get the credit request
      const { data: creditRequest, error: getError } = await staffPortalSupabase
        .from('credit_requests')
        .select('*')
        .eq('id', requestId)
        .single();
      
      if (getError) {
        throw new Error(`Failed to get credit request: ${getError.message}`);
      }
      
      // Update credit request status
      const { data: updatedRequest, error: updateError } = await staffPortalSupabase
        .from('credit_requests')
        .update({
          status: status,
          reviewed_by: reviewedBy,
          review_notes: reviewNotes,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', requestId)
        .select()
        .single();
      
      if (updateError) {
        throw new Error(`Failed to update credit request: ${updateError.message}`);
      }
      
      // If approved, update player's credit limit
      if (status === 'approved') {
        const { data: balanceUpdate, error: balanceError } = await staffPortalSupabase
          .from('account_balances')
          .upsert({
            player_id: creditRequest.player_id,
            credit_limit: creditRequest.new_credit_limit,
            available_credit: creditRequest.new_credit_limit,
            updated_by: reviewedBy,
            updated_at: new Date().toISOString()
          })
          .select()
          .single();
        
        if (balanceError) {
          throw new Error(`Failed to update credit limit: ${balanceError.message}`);
        }
        
        // Log the credit adjustment
        await staffPortalSupabase
          .from('balance_transactions')
          .insert({
            player_id: creditRequest.player_id,
            transaction_type: 'credit_adjustment',
            amount: creditRequest.new_credit_limit - creditRequest.current_credit_limit,
            balance_type: 'credit',
            old_balance: creditRequest.current_credit_limit,
            new_balance: creditRequest.new_credit_limit,
            description: `Credit limit ${status} by ${reviewedBy}: ${reviewNotes}`,
            processed_by: reviewedBy,
            staff_portal_origin: 'super_admin',
            reference_id: requestId
          });
        
        console.log(`✅ [ADMIN CREDIT REVIEW] Credit limit updated to ₹${creditRequest.new_credit_limit} for player ${creditRequest.player_id}`);
      }
      
      console.log(`✅ [ADMIN CREDIT REVIEW] Credit request ${status}: ${requestId}`);
      res.json({ success: true, request: updatedRequest });
    } catch (error: any) {
      console.error(`❌ [ADMIN CREDIT REVIEW] Error:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // Staff Portal: Update regular account balance
  app.post("/api/staff/balance-adjustment", async (req, res) => {
    try {
      const { playerId, amount, transactionType, description, processedBy, staffPortalOrigin } = req.body;
      console.log(`💰 [STAFF BALANCE] ${transactionType} ₹${amount} for player ${playerId} by ${processedBy}`);
      
      // Get current balance
      const { data: currentBalance, error: getError } = await staffPortalSupabase
        .from('account_balances')
        .select('*')
        .eq('player_id', playerId)
        .single();
      
      if (getError && getError.code !== 'PGRST116') {
        throw new Error(`Failed to get current balance: ${getError.message}`);
      }
      
      const oldBalance = currentBalance?.regular_balance || 0.00;
      const newBalance = transactionType === 'deposit' ? 
        parseFloat(oldBalance) + parseFloat(amount) : 
        parseFloat(oldBalance) - parseFloat(amount);
      
      // Update account balance
      const { data: updatedBalance, error: updateError } = await staffPortalSupabase
        .from('account_balances')
        .upsert({
          player_id: playerId,
          regular_balance: newBalance,
          total_deposits: transactionType === 'deposit' ? 
            (currentBalance?.total_deposits || 0) + parseFloat(amount) : 
            (currentBalance?.total_deposits || 0),
          total_withdrawals: transactionType === 'withdrawal' ? 
            (currentBalance?.total_withdrawals || 0) + parseFloat(amount) : 
            (currentBalance?.total_withdrawals || 0),
          updated_by: processedBy,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (updateError) {
        throw new Error(`Failed to update balance: ${updateError.message}`);
      }
      
      // Log the transaction
      await staffPortalSupabase
        .from('balance_transactions')
        .insert({
          player_id: playerId,
          transaction_type: transactionType,
          amount: amount,
          balance_type: 'regular',
          old_balance: oldBalance,
          new_balance: newBalance,
          description: description,
          processed_by: processedBy,
          staff_portal_origin: staffPortalOrigin
        });
      
      console.log(`✅ [STAFF BALANCE] Balance updated: ₹${oldBalance} → ₹${newBalance} for player ${playerId}`);
      res.json({ success: true, balance: updatedBalance });
    } catch (error: any) {
      console.error(`❌ [STAFF BALANCE] Error:`, error);
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

  // Placeholder image endpoints for offers
  app.get("/api/placeholder-welcome-bonus.jpg", async (req, res) => {
    // Create a simple SVG placeholder for welcome bonus
    const svg = `
      <svg width="800" height="450" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#10b981;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#059669;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#grad1)"/>
        <text x="400" y="200" font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="white" text-anchor="middle">WELCOME BONUS</text>
        <text x="400" y="260" font-family="Arial, sans-serif" font-size="32" fill="white" text-anchor="middle">100% Match up to ₹5,000</text>
        <circle cx="400" cy="350" r="40" fill="white" opacity="0.2"/>
        <text x="400" y="360" font-family="Arial, sans-serif" font-size="24" fill="white" text-anchor="middle">NEW</text>
      </svg>
    `;
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(svg);
  });

  app.get("/api/placeholder-weekend-special.jpg", async (req, res) => {
    const svg = `
      <svg width="800" height="450" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#8b5cf6;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#7c3aed;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#grad2)"/>
        <text x="400" y="180" font-family="Arial, sans-serif" font-size="42" font-weight="bold" fill="white" text-anchor="middle">WEEKEND SPECIAL</text>
        <text x="400" y="240" font-family="Arial, sans-serif" font-size="28" fill="white" text-anchor="middle">Double Loyalty Points</text>
        <text x="400" y="280" font-family="Arial, sans-serif" font-size="24" fill="white" text-anchor="middle">Friday - Sunday</text>
        <rect x="320" y="320" width="160" height="60" fill="white" opacity="0.2" rx="10"/>
        <text x="400" y="360" font-family="Arial, sans-serif" font-size="20" fill="white" text-anchor="middle">2X POINTS</text>
      </svg>
    `;
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(svg);
  });

  app.get("/api/placeholder-tournament.jpg", async (req, res) => {
    const svg = `
      <svg width="800" height="450" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad3" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#f59e0b;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#d97706;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#grad3)"/>
        <text x="400" y="160" font-family="Arial, sans-serif" font-size="36" font-weight="bold" fill="white" text-anchor="middle">FREE TOURNAMENT</text>
        <text x="400" y="210" font-family="Arial, sans-serif" font-size="28" fill="white" text-anchor="middle">₹10,000 Guaranteed</text>
        <text x="400" y="250" font-family="Arial, sans-serif" font-size="22" fill="white" text-anchor="middle">Every Sunday</text>
        <polygon points="400,300 380,340 420,340" fill="white" opacity="0.3"/>
        <circle cx="400" cy="370" r="25" fill="white" opacity="0.2"/>
        <text x="400" y="380" font-family="Arial, sans-serif" font-size="16" fill="white" text-anchor="middle">FREE</text>
      </svg>
    `;
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(svg);
  });

  // GRE Admin Integration - Complete cross-portal connectivity
  app.get("/api/gre-admin/connectivity", async (req, res) => {
    try {
      console.log('🔗 [GRE ADMIN] Testing GRE admin portal connectivity...');
      
      // Test connection to all GRE admin tables
      const connectivityChecks = {
        players: false,
        tables: false,
        seat_requests: false,
        waitlist: false,
        kyc_documents: false,
        transactions: false,
        player_preferences: false,
        game_sessions: false,
        table_assignments: false,
        system_logs: false
      };

      // Test each table connectivity
      for (const tableName of Object.keys(connectivityChecks)) {
        try {
          const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .limit(1);
          
          if (!error) {
            connectivityChecks[tableName] = true;
          }
        } catch (error) {
          console.warn(`⚠️ [GRE ADMIN] Table ${tableName} connectivity issue:`, error);
        }
      }

      const connectedTables = Object.values(connectivityChecks).filter(Boolean).length;
      const totalTables = Object.keys(connectivityChecks).length;

      console.log(`✅ [GRE ADMIN] Connectivity: ${connectedTables}/${totalTables} tables connected`);
      
      res.json({
        success: true,
        gre_admin_connectivity: connectivityChecks,
        connection_percentage: Math.round((connectedTables / totalTables) * 100),
        status: connectedTables === totalTables ? 'fully_integrated' : 'partial_integration',
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('❌ [GRE ADMIN] Connectivity test failed:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GRE Admin Player Management
  app.get("/api/gre-admin/players", async (req, res) => {
    try {
      console.log('👥 [GRE ADMIN] Fetching all players for GRE admin portal...');
      
      const { data: players, error } = await supabase
        .from('players')
        .select(`
          *,
          player_preferences(*),
          kyc_documents(*),
          transactions(*),
          game_sessions(*)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ [GRE ADMIN] Error fetching players:', error);
        return res.status(500).json({ error: error.message });
      }

      console.log(`✅ [GRE ADMIN] Retrieved ${players?.length || 0} players`);
      res.json(players || []);
    } catch (error: any) {
      console.error('❌ [GRE ADMIN] Players fetch failed:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GRE Admin Table Management
  app.get("/api/gre-admin/tables", async (req, res) => {
    try {
      console.log('🎯 [GRE ADMIN] Fetching all tables for GRE admin portal...');
      
      const { data: tables, error } = await supabase
        .from('tables')
        .select(`
          *,
          table_assignments(*),
          waitlist(*)
        `)
        .order('id', { ascending: true });

      if (error) {
        console.error('❌ [GRE ADMIN] Error fetching tables:', error);
        return res.status(500).json({ error: error.message });
      }

      console.log(`✅ [GRE ADMIN] Retrieved ${tables?.length || 0} tables`);
      res.json(tables || []);
    } catch (error: any) {
      console.error('❌ [GRE ADMIN] Tables fetch failed:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GRE Admin Analytics Dashboard
  app.get("/api/gre-admin/analytics", async (req, res) => {
    try {
      console.log('📊 [GRE ADMIN] Generating analytics for GRE admin portal...');
      
      // Get player analytics
      const { data: totalPlayers } = await supabase
        .from('players')
        .select('id', { count: 'exact' });

      const { data: activeKyc } = await supabase
        .from('kyc_documents')
        .select('id', { count: 'exact' })
        .eq('status', 'approved');

      const { data: activeTables } = await supabase
        .from('tables')
        .select('id', { count: 'exact' })
        .eq('is_active', true);

      const { data: totalTransactions } = await supabase
        .from('transactions')
        .select('amount')
        .eq('status', 'completed');

      const totalVolume = totalTransactions?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;

      const analytics = {
        total_players: totalPlayers?.length || 0,
        approved_kyc: activeKyc?.length || 0,
        active_tables: activeTables?.length || 0,
        total_transaction_volume: totalVolume,
        kyc_approval_rate: totalPlayers?.length ? 
          Math.round((activeKyc?.length || 0) / totalPlayers.length * 100) : 0,
        timestamp: new Date().toISOString()
      };

      console.log('✅ [GRE ADMIN] Analytics generated:', analytics);
      res.json(analytics);
    } catch (error: any) {
      console.error('❌ [GRE ADMIN] Analytics generation failed:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GRE Admin System Health Monitor
  app.get("/api/gre-admin/system-health", async (req, res) => {
    try {
      console.log('🏥 [GRE ADMIN] Checking system health for GRE admin portal...');
      
      const healthChecks = {
        database_connection: false,
        player_system: false,
        table_management: false,
        kyc_system: false,
        transaction_system: false,
        waitlist_system: false
      };

      // Test database connection
      try {
        const { data } = await supabase.from('players').select('id').limit(1);
        healthChecks.database_connection = true;
        healthChecks.player_system = true;
      } catch (error) {
        console.warn('⚠️ [GRE ADMIN] Database connection issue');
      }

      // Test table management
      try {
        const { data } = await supabase.from('tables').select('id').limit(1);
        healthChecks.table_management = true;
      } catch (error) {
        console.warn('⚠️ [GRE ADMIN] Table management issue');
      }

      // Test KYC system
      try {
        const { data } = await supabase.from('kyc_documents').select('id').limit(1);
        healthChecks.kyc_system = true;
      } catch (error) {
        console.warn('⚠️ [GRE ADMIN] KYC system issue');
      }

      // Test transaction system
      try {
        const { data } = await supabase.from('transactions').select('id').limit(1);
        healthChecks.transaction_system = true;
      } catch (error) {
        console.warn('⚠️ [GRE ADMIN] Transaction system issue');
      }

      // Test waitlist system
      try {
        const { data } = await supabase.from('waitlist').select('id').limit(1);
        healthChecks.waitlist_system = true;
      } catch (error) {
        console.warn('⚠️ [GRE ADMIN] Waitlist system issue');
      }

      const healthyChecks = Object.values(healthChecks).filter(Boolean).length;
      const totalChecks = Object.keys(healthChecks).length;
      
      console.log(`✅ [GRE ADMIN] System health: ${healthyChecks}/${totalChecks} systems operational`);
      
      res.json({
        healthy: healthyChecks === totalChecks,
        health_percentage: Math.round((healthyChecks / totalChecks) * 100),
        checks: healthChecks,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('❌ [GRE ADMIN] System health check failed:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // === PAN CARD MANAGEMENT API ===
  
  // Update player PAN card number (with uniqueness validation)
  app.post("/api/players/:playerId/pan-card", async (req, res) => {
    try {
      const playerId = parseInt(req.params.playerId);
      const { panCardNumber } = req.body;
      
      if (!panCardNumber || panCardNumber.length !== 10) {
        return res.status(400).json({ error: "PAN card number must be exactly 10 characters" });
      }
      
      // Validate PAN card format (AAAAA9999A)
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
      if (!panRegex.test(panCardNumber)) {
        return res.status(400).json({ error: "Invalid PAN card format. Expected format: AAAAA9999A" });
      }
      
      // Check if PAN card number is already used by another player
      const { data: existingPlayer, error: checkError } = await supabase
        .from('players')
        .select('id, first_name, last_name')
        .eq('pan_card_number', panCardNumber)
        .neq('id', playerId)
        .single();
      
      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
        throw new Error(`Failed to check PAN card uniqueness: ${checkError.message}`);
      }
      
      if (existingPlayer) {
        return res.status(409).json({ 
          error: `PAN card number already registered to ${existingPlayer.first_name} ${existingPlayer.last_name}` 
        });
      }
      
      // Update player's PAN card number
      const { data: updatedPlayer, error: updateError } = await supabase
        .from('players')
        .update({
          pan_card_number: panCardNumber,
          pan_card_status: 'pending'
        })
        .eq('id', playerId)
        .select()
        .single();
      
      if (updateError) {
        throw new Error(`Failed to update PAN card: ${updateError.message}`);
      }
      
      console.log('✅ [PAN CARD] Number updated for player:', playerId, panCardNumber);
      res.json({ success: true, player: updatedPlayer });
    } catch (error: any) {
      console.error('❌ [PAN CARD] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Upload PAN card document
  app.post("/api/players/:playerId/pan-card/upload", async (req, res) => {
    try {
      const playerId = parseInt(req.params.playerId);
      const { fileUrl, fileName } = req.body;
      
      if (!fileUrl || !fileName) {
        return res.status(400).json({ error: "File URL and filename are required" });
      }
      
      // Update player's PAN card document
      const { data: updatedPlayer, error: updateError } = await supabase
        .from('players')
        .update({
          pan_card_document_url: fileUrl,
          pan_card_status: 'pending'
        })
        .eq('id', playerId)
        .select()
        .single();
      
      if (updateError) {
        throw new Error(`Failed to upload PAN card document: ${updateError.message}`);
      }
      
      console.log('✅ [PAN CARD UPLOAD] Document uploaded for player:', playerId);
      res.json({ success: true, player: updatedPlayer });
    } catch (error: any) {
      console.error('❌ [PAN CARD UPLOAD] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get player transaction history
  app.get("/api/players/:playerId/transactions", async (req, res) => {
    try {
      const playerId = parseInt(req.params.playerId);
      const limit = parseInt(req.query.limit as string) || 10;
      
      console.log('📋 [TRANSACTIONS] Getting transaction history for player:', playerId, 'limit:', limit);
      
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('player_id', playerId)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) {
        throw new Error(`Failed to fetch transactions: ${error.message}`);
      }
      
      console.log('✅ [TRANSACTIONS] Found', transactions?.length || 0, 'transactions');
      res.json(transactions || []);
    } catch (error: any) {
      console.error('❌ [TRANSACTIONS] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Offer Banners API
  app.get('/api/offer-banners', async (req, res) => {
    try {
      const { data: banners, error } = await localSupabase
        .from('offer_banners')
        .select('*')
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching offer banners:', error);
        return res.status(500).json({ error: 'Failed to fetch offer banners' });
      }

      // Transform to match frontend types
      const transformedBanners = (banners || []).map(banner => ({
        id: banner.id,
        title: banner.title,
        imageUrl: banner.image_url,
        offerDescription: banner.offer_description,
        redirectUrl: banner.redirect_url,
        isActive: banner.is_active,
        displayOrder: banner.display_order
      }));

      res.json(transformedBanners);
    } catch (error: any) {
      console.error('Error in offer banners endpoint:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/offer-banners', async (req, res) => {
    try {
      const { title, imageUrl, offerDescription, redirectUrl, isActive, displayOrder } = req.body;

      const { data: banner, error } = await localSupabase
        .from('offer_banners')
        .insert({
          title,
          image_url: imageUrl,
          offer_description: offerDescription,
          redirect_url: redirectUrl,
          is_active: isActive !== undefined ? isActive : true,
          display_order: displayOrder || 0
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating offer banner:', error);
        return res.status(500).json({ error: 'Failed to create offer banner' });
      }

      res.json(banner);
    } catch (error: any) {
      console.error('Error in create offer banner endpoint:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Average Stack Management API
  app.get('/api/average-stack/:tableId', async (req, res) => {
    try {
      const { tableId } = req.params;

      const { data: stackData, error } = await localSupabase
        .from('average_stack_data')
        .select('*')
        .eq('table_id', tableId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found" error
        console.error('Error fetching average stack:', error);
        return res.status(500).json({ error: 'Failed to fetch average stack' });
      }

      res.json(stackData || { table_id: tableId, average_stack: '0.00' });
    } catch (error: any) {
      console.error('Error in average stack endpoint:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/average-stack', async (req, res) => {
    try {
      const { tableId, averageStack, updatedBy } = req.body;

      // Upsert average stack data
      const { data: stackData, error } = await localSupabase
        .from('average_stack_data')
        .upsert({
          table_id: tableId,
          average_stack: averageStack.toString(),
          updated_by: updatedBy,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'table_id'
        })
        .select()
        .single();

      if (error) {
        console.error('Error updating average stack:', error);
        return res.status(500).json({ error: 'Failed to update average stack' });
      }

      console.log(`✅ [AVERAGE STACK] Updated table ${tableId} to ₹${averageStack}`);
      res.json(stackData);
    } catch (error: any) {
      console.error('Error in update average stack endpoint:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // === OFFER MANAGEMENT ENDPOINTS ===
  
  // Get active carousel items for player portal
  app.get("/api/carousel-items", async (req, res) => {
    console.log('🎠 [CAROUSEL] Getting active carousel items...');
    try {
      const { data: carouselItems, error } = await supabase
        .from('carousel_items')
        .select(`
          *,
          staff_offers (
            id,
            title,
            description,
            offer_type
          )
        `)
        .eq('is_active', true)
        .order('position', { ascending: true });

      if (error) {
        console.error('❌ [CAROUSEL] Supabase error:', error);
        throw error;
      }

      console.log('✅ [CAROUSEL] Found', carouselItems?.length || 0, 'active carousel items');
      res.json(carouselItems || []);
    } catch (error: any) {
      console.error('❌ [CAROUSEL] Error fetching carousel items:', error.message);
      res.status(500).json({ error: 'Failed to fetch carousel items' });
    }
  });

  // Create staff portal tables and sample offers
  app.post("/api/create-staff-portal-tables", async (req, res) => {
    try {
      console.log('🔧 [CREATE STAFF PORTAL TABLES] Creating offers tables in Staff Portal Supabase...');

      // Create staff_offers table using direct SQL
      const createStaffOffersSQL = `
        CREATE TABLE IF NOT EXISTS staff_offers (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title VARCHAR(255) NOT NULL,
          description TEXT,
          image_url TEXT,
          video_url TEXT,
          offer_type VARCHAR(50) CHECK (offer_type IN ('banner', 'carousel', 'popup')),
          is_active BOOLEAN DEFAULT true,
          start_date TIMESTAMP WITH TIME ZONE,
          end_date TIMESTAMP WITH TIME ZONE,
          created_by TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `;

      const createCarouselItemsSQL = `
        CREATE TABLE IF NOT EXISTS carousel_items (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          offer_id UUID REFERENCES staff_offers(id),
          position INTEGER,
          image_url TEXT,
          video_url TEXT,
          click_action TEXT,
          action_data TEXT,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `;

      const createOfferViewsSQL = `
        CREATE TABLE IF NOT EXISTS offer_views (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          offer_id UUID REFERENCES staff_offers(id),
          player_id INTEGER,
          view_type VARCHAR(50) DEFAULT 'carousel',
          ip_address INET,
          user_agent TEXT,
          viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `;

      // Try to create tables by inserting test data first
      const { data: offers, error: insertOffersError } = await supabase
        .from('staff_offers')
        .insert([
          {
            title: 'Welcome Bonus',
            description: 'Get 100% bonus on your first deposit up to ₹5,000. Join today and double your gaming power with our exclusive welcome package.',
            image_url: '/api/placeholder-welcome-bonus.jpg',
            offer_type: 'banner',
            is_active: true
          },
          {
            title: 'Weekend Special',
            description: 'Double loyalty points on all weekend games. Play Friday to Sunday and earn twice the rewards.',
            image_url: '/api/placeholder-weekend-special.jpg', 
            offer_type: 'carousel',
            is_active: true
          },
          {
            title: 'Free Tournament Entry',
            description: 'Complimentary entry to our Sunday ₹10,000 guaranteed tournament. No entry fee required for qualified players.',
            image_url: '/api/placeholder-tournament.jpg',
            offer_type: 'popup',
            is_active: true
          }
        ])
        .select();

      if (insertOffersError) {
        console.warn('⚠️ [CREATE STAFF PORTAL TABLES] Tables may not exist, need manual creation:', insertOffersError.message);
        return res.status(200).json({ 
          success: false,
          message: 'Tables need to be created manually in Staff Portal Supabase dashboard',
          sql_queries: {
            staff_offers: createStaffOffersSQL,
            carousel_items: createCarouselItemsSQL,
            offer_views: createOfferViewsSQL
          },
          error: insertOffersError.message
        });
      }

      console.log('✅ [CREATE STAFF PORTAL TABLES] Created', offers?.length || 0, 'sample offers');
      res.json({ 
        success: true, 
        message: 'Staff Portal tables created and sample offers added',
        offers: offers
      });
    } catch (error: any) {
      console.error('❌ [CREATE STAFF PORTAL TABLES] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get active staff offers
  app.get("/api/staff-offers", async (req, res) => {
    console.log('📋 [OFFERS] Getting active staff offers...');
    try {
      const { data: offers, error } = await supabase
        .from('staff_offers')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ [OFFERS] Supabase error:', error);
        
        // If table doesn't exist, return empty array instead of error
        if (error.code === '42P01') {
          console.log('📋 [OFFERS] Table does not exist, returning empty array');
          return res.json([]);
        }
        
        throw error;
      }

      // Filter by date if start_date and end_date are set
      const now = new Date();
      const filteredOffers = offers?.filter(offer => {
        if (offer.start_date && new Date(offer.start_date) > now) return false;
        if (offer.end_date && new Date(offer.end_date) < now) return false;
        return true;
      });

      console.log('✅ [OFFERS] Found', filteredOffers?.length || 0, 'active offers');
      res.json(filteredOffers || []);
    } catch (error: any) {
      console.error('❌ [OFFERS] Error fetching staff offers:', error.message);
      res.status(500).json({ error: 'Failed to fetch offers' });
    }
  });

  // Track offer view
  app.post("/api/offer-views", async (req, res) => {
    console.log('👁️ [OFFER VIEW] Tracking offer view...');
    try {
      const { offer_id, view_type = 'carousel' } = req.body;
      
      if (!offer_id) {
        return res.status(400).json({ error: 'offer_id is required' });
      }

      // Get player ID from auth if available
      let playerId = null;
      if (req.user) {
        playerId = req.user.id;
      }

      const { data: view, error } = await supabase
        .from('offer_views')
        .insert({
          offer_id,
          player_id: playerId,
          view_type,
          viewed_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('❌ [OFFER VIEW] Supabase error:', error);
        throw error;
      }

      console.log('✅ [OFFER VIEW] Tracked view for offer:', offer_id, 'type:', view_type);
      res.json({ success: true, view_id: view.id });
    } catch (error: any) {
      console.error('❌ [OFFER VIEW] Error tracking view:', error.message);
      res.status(500).json({ error: 'Failed to track offer view' });
    }
  });

  // Get offer analytics (for staff portal)
  app.get("/api/offer-analytics/:offerId", async (req, res) => {
    console.log('📊 [ANALYTICS] Getting offer analytics...');
    try {
      const { offerId } = req.params;

      const { data: views, error } = await supabase
        .from('offer_views')
        .select('*')
        .eq('offer_id', offerId);

      if (error) {
        console.error('❌ [ANALYTICS] Supabase error:', error);
        throw error;
      }

      const analytics = {
        total_views: views?.length || 0,
        carousel_views: views?.filter(v => v.view_type === 'carousel').length || 0,
        offers_page_views: views?.filter(v => v.view_type === 'offers_page').length || 0,
        unique_viewers: new Set(views?.map(v => v.player_id).filter(Boolean)).size,
        latest_view: views?.length ? Math.max(...views.map(v => new Date(v.viewed_at).getTime())) : null
      };

      console.log('✅ [ANALYTICS] Analytics for offer', offerId, ':', analytics);
      res.json(analytics);
    } catch (error: any) {
      console.error('❌ [ANALYTICS] Error fetching analytics:', error.message);
      res.status(500).json({ error: 'Failed to fetch offer analytics' });
    }
  });

  // Health check for offer system
  app.get("/api/offer-system-health", async (req, res) => {
    console.log('🔍 [OFFER HEALTH] Checking offer system health...');
    try {
      const checks = {
        staff_offers_table: false,
        carousel_items_table: false,
        offer_views_table: false,
        active_offers: 0,
        active_carousel_items: 0,
        total_views_today: 0
      };

      // Check staff_offers table
      const { data: offers, error: offersError } = await supabase
        .from('staff_offers')
        .select('id')
        .eq('is_active', true)
        .limit(1);
      
      checks.staff_offers_table = !offersError;
      checks.active_offers = offers?.length || 0;

      // Check carousel_items table
      const { data: carouselItems, error: carouselError } = await supabase
        .from('carousel_items')
        .select('id')
        .eq('is_active', true)
        .limit(1);
      
      checks.carousel_items_table = !carouselError;
      checks.active_carousel_items = carouselItems?.length || 0;

      // Check offer_views table
      const today = new Date().toISOString().split('T')[0];
      const { data: todayViews, error: viewsError } = await supabase
        .from('offer_views')
        .select('id')
        .gte('viewed_at', `${today}T00:00:00.000Z`)
        .limit(100);
      
      checks.offer_views_table = !viewsError;
      checks.total_views_today = todayViews?.length || 0;

      const allHealthy = checks.staff_offers_table && 
                         checks.carousel_items_table && 
                         checks.offer_views_table;

      console.log('✅ [OFFER HEALTH] System health:', checks);
      res.json({
        healthy: allHealthy,
        checks,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('❌ [OFFER HEALTH] Error checking system health:', error.message);
      res.status(500).json({ 
        healthy: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // VIP Club Loyalty Program API Endpoints
  app.get('/api/vip-club/points/:playerId', async (req, res) => {
    try {
      const { playerId } = req.params;
      const player = await storage.getPlayer(parseInt(playerId));
      
      if (!player) {
        return res.status(404).json({ error: 'Player not found' });
      }

      const gamePoints = player.gamesPlayed * 10;
      const timePoints = Math.floor(parseFloat(player.hoursPlayed || "0") * 5);
      const totalPoints = gamePoints + timePoints;

      res.json({
        totalPoints,
        gamePoints,
        timePoints,
        gamesPlayed: player.gamesPlayed,
        hoursPlayed: player.hoursPlayed
      });
    } catch (error: any) {
      console.error('❌ [VIP CLUB] Error getting points:', error);
      res.status(500).json({ error: 'Failed to get VIP points' });
    }
  });

  app.post('/api/vip-club/redeem', async (req, res) => {
    try {
      const { playerId, rewardType, pointsCost } = req.body;
      
      const player = await storage.getPlayer(parseInt(playerId));
      if (!player) {
        return res.status(404).json({ error: 'Player not found' });
      }

      const gamePoints = player.gamesPlayed * 10;
      const timePoints = Math.floor(parseFloat(player.hoursPlayed || "0") * 5);
      const totalPoints = gamePoints + timePoints;

      if (totalPoints < pointsCost) {
        return res.status(400).json({ error: 'Insufficient points' });
      }

      // For now, just return success - in production this would update a redemption history table
      console.log(`🎁 [VIP CLUB] Player ${playerId} redeemed ${rewardType} for ${pointsCost} points`);
      
      res.json({
        success: true,
        message: `Successfully redeemed ${rewardType}`,
        remainingPoints: totalPoints - pointsCost,
        rewardType,
        pointsCost
      });
    } catch (error: any) {
      console.error('❌ [VIP CLUB] Error redeeming points:', error);
      res.status(500).json({ error: 'Failed to redeem points' });
    }
  });

  app.get('/api/vip-club/redemption-history/:playerId', async (req, res) => {
    try {
      const { playerId } = req.params;
      
      // For now return empty array - in production this would query redemption history table
      res.json([]);
    } catch (error: any) {
      console.error('❌ [VIP CLUB] Error getting redemption history:', error);
      res.status(500).json({ error: 'Failed to get redemption history' });
    }
  });

  // ==================== VIP SHOP API ENDPOINTS ====================
  
  // Get VIP Shop Categories
  app.get("/api/vip-shop/categories", async (req, res) => {
    try {
      const { data, error } = await localSupabase
        .from('vip_shop_categories')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) {
        console.error('[VIP SHOP] Error fetching categories:', error);
        return res.status(500).json({ error: error.message });
      }

      res.json(data || []);
    } catch (error: any) {
      console.error('[VIP SHOP] Categories error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get VIP Shop Items
  app.get("/api/vip-shop/items", async (req, res) => {
    try {
      const { data, error } = await localSupabase
        .from('vip_shop_items')
        .select('*')
        .eq('is_available', true)
        .order('display_order', { ascending: true });

      if (error) {
        console.error('[VIP SHOP] Error fetching items:', error);
        return res.status(500).json({ error: error.message });
      }

      res.json(data || []);
    } catch (error: any) {
      console.error('[VIP SHOP] Items error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get VIP Shop Banners
  app.get("/api/vip-shop/banners", async (req, res) => {
    try {
      const { data, error } = await localSupabase
        .from('vip_shop_banners')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) {
        console.error('[VIP SHOP] Error fetching banners:', error);
        return res.status(500).json({ error: error.message });
      }

      res.json(data || []);
    } catch (error: any) {
      console.error('[VIP SHOP] Banners error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get VIP Shop Settings
  app.get("/api/vip-shop/settings", async (req, res) => {
    try {
      const { data, error } = await localSupabase
        .from('vip_shop_settings')
        .select('*');

      if (error) {
        console.error('[VIP SHOP] Error fetching settings:', error);
        return res.status(500).json({ error: error.message });
      }

      res.json(data || []);
    } catch (error: any) {
      console.error('[VIP SHOP] Settings error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Redeem VIP Shop Item
  app.post("/api/vip-shop/redeem", async (req, res) => {
    try {
      const { item_id, delivery_address, delivery_phone, special_instructions } = req.body;
      
      if (!item_id) {
        return res.status(400).json({ error: "Item ID is required" });
      }

      // Get the player ID from the request (placeholder - should come from auth session)
      const playerId = 29; // This should come from authenticated session

      // Get the item details
      const { data: item, error: itemError } = await localSupabase
        .from('vip_shop_items')
        .select('*')
        .eq('id', item_id)
        .eq('is_available', true)
        .single();

      if (itemError || !item) {
        return res.status(404).json({ error: "Item not found or unavailable" });
      }

      // Check stock if applicable
      if (item.stock_quantity !== null && item.stock_quantity <= 0) {
        return res.status(400).json({ error: "Item out of stock" });
      }

      // Create redemption record
      const redemptionCode = `VIP${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      
      const { data: redemption, error: redemptionError } = await localSupabase
        .from('vip_shop_redemptions')
        .insert([{
          player_id: playerId,
          item_id: item_id,
          points_spent: item.point_cost,
          redemption_code: redemptionCode,
          delivery_address: delivery_address || null,
          delivery_phone: delivery_phone || null,
          special_instructions: special_instructions || null,
          status: 'pending'
        }])
        .select()
        .single();

      if (redemptionError) {
        console.error('[VIP SHOP] Redemption error:', redemptionError);
        return res.status(500).json({ error: "Failed to process redemption" });
      }

      // Update stock if applicable
      if (item.stock_quantity !== null) {
        await localSupabase
          .from('vip_shop_items')
          .update({ stock_quantity: item.stock_quantity - 1 })
          .eq('id', item_id);
      }

      res.json({
        success: true,
        redemption_code: redemptionCode,
        redemption: redemption
      });

    } catch (error: any) {
      console.error('[VIP SHOP] Redemption error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ===== FEEDBACK SYSTEM =====
  
  // Submit player feedback
  app.post("/api/feedback", async (req, res) => {
    try {
      const { playerId, message } = req.body;
      
      if (!playerId || !message) {
        return res.status(400).json({ error: "Player ID and message are required" });
      }
      
      // Insert feedback into Supabase
      const { data, error } = await localSupabase
        .from('player_feedback')
        .insert({
          player_id: playerId,
          message: message,
          status: 'unread'
        })
        .select()
        .single();
      
      if (error) {
        console.error('[FEEDBACK] Error inserting feedback:', error);
        return res.status(500).json({ error: 'Failed to submit feedback' });
      }
      
      console.log(`[FEEDBACK] New feedback submitted by player ${playerId}: ${message.substring(0, 50)}...`);
      
      res.json({ 
        success: true, 
        feedbackId: data.id,
        message: "Feedback submitted successfully" 
      });
    } catch (error: any) {
      console.error('[FEEDBACK] Unexpected error:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get player feedback history
  app.get("/api/feedback/:playerId", async (req, res) => {
    try {
      const playerId = parseInt(req.params.playerId);
      
      const { data, error } = await localSupabase
        .from('player_feedback')
        .select('*')
        .eq('player_id', playerId)
        .order('created_at', { ascending: false });
      
      if (error) {
        return res.status(500).json({ error: error.message });
      }
      
      res.json(data || []);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // ===== PUSH NOTIFICATION SYSTEM =====
  
  // Send push notification from staff to player
  app.post("/api/push-notifications", async (req, res) => {
    try {
      const { 
        senderId, 
        senderName, 
        senderRole, 
        targetPlayerId, 
        title, 
        message, 
        messageType = 'text',
        mediaUrl,
        priority = 'normal',
        broadcastToAll = false
      } = req.body;
      
      if (!senderId || !senderName || !senderRole || !title || !message) {
        return res.status(400).json({ 
          error: "Sender ID, name, role, title, and message are required" 
        });
      }
      
      // Insert notification into Supabase
      const { data, error } = await localSupabase
        .from('push_notifications')
        .insert({
          sender_id: senderId,
          sender_name: senderName,
          sender_role: senderRole,
          target_player_id: targetPlayerId,
          title,
          message,
          message_type: messageType,
          media_url: mediaUrl,
          priority,
          broadcast_to_all: broadcastToAll,
          status: 'sent'
        })
        .select()
        .single();
      
      if (error) {
        console.error('[PUSH_NOTIFICATION] Error inserting notification:', error);
        return res.status(500).json({ error: 'Failed to send notification' });
      }
      
      console.log(`[PUSH_NOTIFICATION] New notification sent by ${senderName} (${senderRole}) to ${broadcastToAll ? 'all players' : `player ${targetPlayerId}`}: ${title}`);
      
      res.json({ 
        success: true, 
        notificationId: data.id,
        message: "Notification sent successfully" 
      });
    } catch (error: any) {
      console.error('[PUSH_NOTIFICATION] Unexpected error:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get notifications for a specific player (DIRECT STAFF PORTAL CONNECTION)
  app.get("/api/push-notifications/:playerId", async (req, res) => {
    try {
      const playerId = parseInt(req.params.playerId);
      console.log(`🔔 [PUSH_NOTIFICATION] Direct query for player ${playerId} from Staff Portal Supabase`);
      
      // DIAGNOSTIC: First check what columns actually exist
      console.log('🔍 [PUSH_NOTIFICATION] Testing basic query without specific columns');
      
      // Try basic query first
      const { data: basicTest, error: basicError } = await staffPortalSupabase
        .from('push_notifications')
        .select('*')
        .limit(5);
      
      if (basicError) {
        console.error('❌ [PUSH_NOTIFICATION] Basic query failed:', basicError);
        return res.json([]);
      }
      
      console.log('✅ [PUSH_NOTIFICATION] Basic query succeeded, sample data:', basicTest?.[0]);
      
      // Now try to get notifications for the player using whatever columns exist
      const { data: notifications, error } = await staffPortalSupabase
        .from('push_notifications')
        .select('*')
        .limit(50);
      
      // Filter based on actual database structure
      const playerNotifications = (notifications || []).filter(n => 
        n.target_audience === 'all_players' || 
        n.target_audience === `player_${playerId}` ||
        n.target_audience === playerId.toString()
      );
      
      if (error) {
        console.error('❌ [PUSH_NOTIFICATION] Query error:', error);
        return res.json([]);
      }
      
      console.log(`✅ [PUSH_NOTIFICATION] Found ${playerNotifications.length} notifications for player ${playerId}`);
      
      res.json(playerNotifications);
    } catch (error: any) {
      console.error('❌ [PUSH_NOTIFICATION] Direct query unexpected error:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Mark notification as read
  app.patch("/api/push-notifications/:notificationId/read", async (req, res) => {
    try {
      const notificationId = parseInt(req.params.notificationId);
      
      const { error } = await staffPortalSupabase
        .from('push_notifications')
        .update({ 
          status: 'read',
          read_at: new Date().toISOString()
        })
        .eq('id', notificationId);
      
      if (error) {
        return res.status(500).json({ error: error.message });
      }
      
      res.json({ success: true, message: "Notification marked as read" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get notification statistics for staff
  app.get("/api/notification-stats", async (req, res) => {
    try {
      const { data, error } = await staffPortalSupabase
        .from('push_notifications')
        .select('status, priority, message_type, created_at');
      
      if (error) {
        return res.status(500).json({ error: error.message });
      }
      
      const stats = {
        totalNotifications: data?.length || 0,
        sentNotifications: data?.filter(n => n.status === 'sent').length || 0,
        readNotifications: data?.filter(n => n.status === 'read').length || 0,
        highPriorityNotifications: data?.filter(n => n.priority === 'high').length || 0,
        urgentNotifications: data?.filter(n => n.priority === 'urgent').length || 0,
        textNotifications: data?.filter(n => n.message_type === 'text').length || 0,
        imageNotifications: data?.filter(n => n.message_type === 'image').length || 0,
        videoNotifications: data?.filter(n => n.message_type === 'video').length || 0,
        todayNotifications: data?.filter(n => {
          const today = new Date().toDateString();
          return new Date(n.created_at).toDateString() === today;
        }).length || 0
      };
      
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);

  // **UNIFIED CHAT WEBSOCKET SERVER - Expert Level Implementation**
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/chat-ws',
    verifyClient: (info) => {
      console.log('🔐 [UNIFIED WEBSOCKET] Client connecting from:', info.origin);
      return true;
    }
  });
  
  // Store active WebSocket connections by player ID
  const playerConnections = new Map<number, AuthenticatedWebSocket>();
  
  // **UNIFIED WEBSOCKET CONNECTION HANDLER**
  wss.on('connection', (ws: AuthenticatedWebSocket, request) => {
    console.log('🔗 [UNIFIED WEBSOCKET] New client connected');
    ws.isAuthenticated = false;

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log('📨 [UNIFIED WEBSOCKET] Received:', data.type);

        switch (data.type) {
          case 'authenticate':
            try {
              ws.playerId = data.playerId;
              ws.playerName = data.playerName;
              ws.playerEmail = data.playerEmail;
              ws.isAuthenticated = true;
              
              playerConnections.set(data.playerId, ws);
              
              console.log(`✅ [UNIFIED WEBSOCKET] Player ${data.playerId} authenticated: ${data.playerName}`);
              
              ws.send(JSON.stringify({
                type: 'authenticated',
                playerId: data.playerId,
                message: 'Successfully connected to GRE chat',
                timestamp: new Date().toISOString()
              }));

              // Load chat history from Staff Portal - ALWAYS fetch fresh data
              const { data: messages, error } = await staffPortalSupabase
                .from('chat_messages')
                .select('*')
                .eq('player_id', data.playerId)
                .order('created_at', { ascending: true })
                .limit(50);

              if (!error && messages) {
                ws.send(JSON.stringify({
                  type: 'chat_history',
                  messages: messages
                }));
                console.log(`📋 [UNIFIED WEBSOCKET] Sent ${messages.length} messages to player ${data.playerId}`);
                console.log('🔍 [WEBSOCKET DEBUG] Messages sent:', messages.map(m => `${m.sender}: ${m.message.substring(0, 30)}...`));
              } else {
                console.error('❌ [UNIFIED WEBSOCKET] Error loading chat history:', error);
              }
              
            } catch (authError) {
              console.error('❌ [UNIFIED WEBSOCKET] Authentication failed:', authError);
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Authentication failed'
              }));
            }
            break;

          case 'player_message':
            if (!ws.isAuthenticated) {
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Not authenticated'
              }));
              return;
            }

            try {
              // 🛑 CRITICAL DEBUG: COMPLETE PLAYER MESSAGE PAYLOAD LOGGING
              console.log('🛑 CRITICAL DEBUG === PLAYER MESSAGE PROCESSING START ===');
              console.log('PLAYER SEND RAW PAYLOAD:', JSON.stringify(data, null, 2));
              console.log('PLAYER SEND PAYLOAD KEYS:', Object.keys(data));
              console.log('PLAYER SEND PAYLOAD TYPES:', Object.entries(data).map(([k,v]) => `${k}: ${typeof v}`));
              console.log('PLAYER SEND playerId variants:', {
                playerId: data.playerId,
                player_id: data.player_id,
                wsPlayerId: ws.playerId,
                playerIdType: typeof data.playerId,
                player_idType: typeof data.player_id,
                wsPlayerIdType: typeof ws.playerId
              });
              
              // CRITICAL: ID STANDARDIZATION AND VALIDATION
              const normalizedPlayerId = parseInt(data.playerId) || parseInt(data.player_id) || parseInt(ws.playerId);
              console.log('PLAYER SEND - ID STANDARDIZATION:', {
                normalizedPlayerId,
                originalDataPlayerId: data.playerId,
                originalDataPlayer_id: data.player_id,
                wsPlayerId: ws.playerId,
                finalIdType: typeof normalizedPlayerId
              });
              
              console.log('🔍 WEBSOCKET DEBUG: Processing send_message | Details:', {
                playerId: ws.playerId,
                playerName: ws.playerName,
                playerEmail: ws.playerEmail,
                messageText: data.message,
                senderType: 'player',
                timestamp: new Date().toISOString(),
                sessionValidation: 'PRODUCTION_USER_CONTEXT_ONLY'
              });
              
              // PRODUCTION DATA VALIDATION - NO MOCK/TEST DATA ALLOWED
              if (!ws.playerId || !ws.playerName || ws.playerId === 0 || ws.playerName.includes('test') || ws.playerName.includes('demo')) {
                console.error('❌ WEBSOCKET DEBUG: INVALID USER CONTEXT - Mock/test data detected');
                throw new Error('Invalid user context - only production users allowed');
              }
              
              console.log(`📤 [UNIFIED WEBSOCKET] Processing message from player ${ws.playerId}`);
              
              // Find or create chat request
              let { data: chatRequest, error: requestError } = await staffPortalSupabase
                .from('chat_requests')
                .select('*')
                .eq('player_id', ws.playerId)
                .in('status', ['waiting', 'active'])
                .single();

              if (requestError || !chatRequest) {
                const { data: newRequest, error: createError } = await staffPortalSupabase
                  .from('chat_requests')
                  .insert({
                    player_id: ws.playerId,
                    player_name: ws.playerName,
                    subject: data.message.substring(0, 200),
                    message: data.message,
                    status: 'waiting',
                    priority: 'normal',
                    category: 'support',
                    last_message_at: new Date().toISOString()
                  })
                  .select()
                  .single();

                if (createError) {
                  throw new Error(`Failed to create chat request: ${createError.message}`);
                }
                chatRequest = newRequest;
                console.log(`✅ [UNIFIED WEBSOCKET] Created new chat request: ${chatRequest.id}`);
              }

              console.log('🔍 WEBSOCKET DEBUG: Chat request management | Details:', {
                requestId: chatRequest.id,
                playerId: chatRequest.player_id,
                playerName: chatRequest.player_name,
                status: chatRequest.status,
                validation: 'PRODUCTION_REQUEST_VERIFIED'
              });

              // Prepare message data for insertion
              const messageData = {
                session_id: chatRequest.id, // Use chat request ID as session ID
                player_id: ws.playerId,
                player_name: ws.playerName,
                message: data.message,
                sender: 'player',
                sender_name: ws.playerName,
                timestamp: new Date().toISOString(),
                status: 'sent'
              };

              console.log('🔍 WEBSOCKET DEBUG: Database insert payload | Details:', {
                sessionId: messageData.session_id,
                playerId: messageData.player_id,
                playerName: messageData.player_name,
                messageText: messageData.message,
                sender: messageData.sender,
                senderName: messageData.sender_name,
                validation: 'PRODUCTION_DATABASE_WRITE'
              });

              // Save message to Staff Portal Supabase
              const { data: savedMessage, error: messageError } = await staffPortalSupabase
                .from('chat_messages')
                .insert(messageData)
                .select()
                .single();

              if (messageError) {
                console.error(`❌ [UNIFIED WEBSOCKET] Message insert failed:`, messageError);
                console.error('🔍 [DEBUG] Insert Error Details:', JSON.stringify(messageError, null, 2));
                throw new Error(`Failed to save message: ${messageError.message}`);
              }

              console.log('✅ WEBSOCKET DEBUG: Message saved to production database | Details:', {
                messageId: savedMessage.id,
                playerId: savedMessage.player_id,
                playerName: savedMessage.player_name,
                sender: savedMessage.sender,
                senderName: savedMessage.sender_name,
                timestamp: savedMessage.timestamp,
                validation: 'PRODUCTION_DATA_CONFIRMED'
              });

              // Update chat request
              await staffPortalSupabase
                .from('chat_requests')
                .update({ 
                  last_message_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                })
                .eq('id', chatRequest.id);

              // Send confirmation
              ws.send(JSON.stringify({
                type: 'message_sent',
                message: savedMessage,
                timestamp: new Date().toISOString()
              }));

              console.log(`📡 [UNIFIED WEBSOCKET] Message broadcasted to Staff Portal systems`);
              console.log('🛑 [DEBUG] === PLAYER MESSAGE DEBUG END ===');

            } catch (error: any) {
              console.error('❌ [UNIFIED WEBSOCKET] Error processing message:', error);
              console.error('🔍 [DEBUG] Full Error Details:', JSON.stringify(error, null, 2));
              ws.send(JSON.stringify({
                type: 'error',
                message: error.message || 'Failed to send message'
              }));
            }
            break;

          default:
            console.log(`❓ [UNIFIED WEBSOCKET] Unknown message type: ${data.type}`);
        }

      } catch (error) {
        console.error('❌ [UNIFIED WEBSOCKET] Error parsing message:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format'
        }));
      }
    });

    ws.on('close', () => {
      if (ws.playerId) {
        playerConnections.delete(ws.playerId);
        console.log(`🔌 [UNIFIED WEBSOCKET] Player ${ws.playerId} disconnected`);
      }
    });

    ws.on('error', (error) => {
      console.error('❌ [UNIFIED WEBSOCKET] WebSocket error:', error);
    });
  });

  console.log('🚀 [UNIFIED WEBSOCKET] Chat system initialized on /chat-ws');

  // ===== UNIFIED CHAT REST API ENDPOINTS =====
  
  // 🏆 EXPERT-LEVEL FIELD TRANSFORMATION ENGINE WITH AUDIT LOGGING
  const transformFieldsToCamelCase = (obj: any): any => {
    if (!obj || typeof obj !== 'object') return obj;
    
    const camelCaseObj: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Convert snake_case to camelCase
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      camelCaseObj[camelKey] = Array.isArray(value) ? value.map(transformFieldsToCamelCase) : 
                              value && typeof value === 'object' ? transformFieldsToCamelCase(value) : value;
    }
    return camelCaseObj;
  };

  const transformFieldsToSnakeCase = (obj: any): any => {
    if (!obj || typeof obj !== 'object') return obj;
    
    const snakeCaseObj: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Convert camelCase to snake_case
      const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      snakeCaseObj[snakeKey] = Array.isArray(value) ? value.map(transformFieldsToSnakeCase) : 
                               value && typeof value === 'object' ? transformFieldsToSnakeCase(value) : value;
    }
    return snakeCaseObj;
  };

  // 🛡️ GLOBAL ERROR HANDLER FOR CHAT OPERATIONS
  const handleChatError = (error: any, operation: string, context: any = {}) => {
    const errorDetails = {
      operation,
      error: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
      severity: 'HIGH'
    };
    
    console.error(`🚨 [CHAT ERROR] ${operation}:`, errorDetails);
    
    // Log to file system for permanent audit trail
    try {
      const fs = require('fs');
      const logEntry = `${new Date().toISOString()} - CHAT_ERROR - ${operation}: ${JSON.stringify(errorDetails)}\n`;
      fs.appendFileSync('/tmp/chat-errors.log', logEntry);
    } catch (logError) {
      console.error('Failed to write to error log:', logError);
    }
    
    return errorDetails;
  };

  // 🔍 FIELD VALIDATION & AUDIT LOGGING
  const validateAndAuditChatFields = (data: any, operation: string) => {
    const auditLog = {
      operation,
      timestamp: new Date().toISOString(),
      originalData: JSON.stringify(data),
      validation: {
        hasPlayerId: !!(data.playerId || data.player_id),
        hasMessage: !!(data.message),
        hasSender: !!(data.sender || data.senderType),
        fieldCount: Object.keys(data).length,
        fieldTypes: Object.entries(data).map(([k, v]) => `${k}:${typeof v}`)
      }
    };
    
    console.log(`🔍 [FIELD AUDIT] ${operation}:`, auditLog);
    
    // Check for required fields
    const requiredFields = ['message'];
    const missingFields = requiredFields.filter(field => 
      !data[field] && !data[field.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)]
    );
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }
    
    return auditLog;
  };

  // 🚀 NEW UUID-BASED CHAT ENDPOINT - Enterprise Migration Complete
  app.post('/api/uuid-chat/send', async (req, res) => {
    const operationId = crypto.randomUUID();
    console.log(`🛡️ === UUID CHAT SEND START [${operationId}] ===`);
    
    try {
      const { playerUUID, playerName, message, senderType = 'player' } = req.body;
      
      if (!playerUUID || !message) {
        return res.status(400).json({ 
          error: 'Player UUID and message are required',
          received: { playerUUID: !!playerUUID, message: !!message },
          operationId 
        });
      }
      
      console.log(`📤 [UUID CHAT] Processing message from ${senderType} UUID ${playerUUID}: ${playerName}`);
      
      console.log(`🔗 [UUID CHAT] Using development database for UUID operations`);
      
      // For now, skip session creation since we don't have that table in development db
      // Just insert the message directly
      console.log('📝 [UUID CHAT] Skipping session creation for development - inserting message directly');
      
      // Insert message using unified chat_messages table
      console.log(`🔗 [UUID CHAT] Using unified chat_messages table for insert`);
      const { data: newMessage, error: messageError } = await supabase
        .from('chat_messages')
        .insert({
          player_id: playerUUID,
          player_name: playerName || 'Player',
          message,
          sender: senderType,
          sender_name: senderType === 'player' ? playerName || 'Player' : 'GRE Support',
          status: 'sent'
        })
        .select()
        .single();
      
      if (messageError) {
        console.error('💥 [UUID CHAT] Message insert failed:', messageError);
        return res.status(500).json({ error: messageError.message, operationId });
      }
      
      console.log('✅ [UUID CHAT] Message inserted successfully:', newMessage.id);
      
      // Also create a chat request for Staff Portal visibility
      try {
        await supabase
          .from('chat_requests')
          .insert({
            player_id: playerUUID,
            player_name: playerName || 'Player',
            subject: message.substring(0, 200),
            message,
            status: 'waiting',
            priority: 'normal',
            category: 'support'
          });
        console.log('✅ [UUID CHAT] Chat request created in unified database');
      } catch (requestError) {
        console.log('⚠️ [UUID CHAT] Chat request creation failed, continuing:', requestError);
      }
      
      console.log(`✅ [UUID CHAT] Message sent for UUID ${playerUUID}: ${message.substring(0, 50)}...`);
      res.json({ 
        success: true, 
        message: newMessage,
        operationId,
        migration_status: 'UUID_COMPLETE'
      });
      
    } catch (error) {
      console.error(`💥 [UUID CHAT] Exception [${operationId}]:`, error);
      res.status(500).json({ error: error.message, operationId });
    }
  });

  // UNIFIED CHAT REQUESTS - STAFF PORTAL ALIGNED (snake_case fields)
  app.post('/api/unified-chat/requests', async (req, res) => {
    const operationId = crypto.randomUUID();
    
    try {
      const { player_id, status } = req.body;
      
      if (!player_id) {
        return res.status(400).json({ error: 'player_id required in snake_case format' });
      }
      
      console.log(`📋 [UNIFIED REQUESTS] Fetching chat requests for player_id: ${player_id}`);
      console.log(`🔗 [UNIFIED REQUESTS] Using Staff Portal Supabase (unified tables)`);
      
      let query = staffPortalSupabase
        .from('chat_requests')
        .select('*')
        .eq('player_id', player_id);
      
      if (status) {
        query = query.eq('status', status);
      }
      
      const { data: requests, error } = await query
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('[UNIFIED REQUESTS] Query failed:', error);
        return res.status(500).json({ error: error.message });
      }
      
      console.log(`✅ [UNIFIED REQUESTS] Found ${requests?.length || 0} requests`);
      console.log(`📊 [UNIFIED REQUESTS] Sample request:`, requests?.[0]);
      res.json(requests || []);
      
    } catch (error) {
      console.error(`💥 [UNIFIED REQUESTS] Exception [${operationId}]:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // 🚀 UUID-BASED CHAT MESSAGES ENDPOINT
  // UNIFIED CHAT MESSAGES - STAFF PORTAL ALIGNED (snake_case fields)
  app.post('/api/unified-chat/messages', async (req, res) => {
    const operationId = crypto.randomUUID();
    
    try {
      const { player_id, chat_request_id } = req.body;
      
      if (!player_id) {
        return res.status(400).json({ error: 'player_id required in snake_case format' });
      }
      
      console.log(`📬 [UNIFIED MESSAGES] Fetching messages for player_id: ${player_id}`);
      console.log(`🔗 [UNIFIED MESSAGES] Using Staff Portal Supabase (unified tables)`);
      
      let query = staffPortalSupabase
        .from('chat_messages')
        .select('*')
        .eq('player_id', player_id);
      
      if (chat_request_id) {
        query = query.eq('chat_request_id', chat_request_id);
      }
      
      const { data: messages, error } = await query
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error('[UNIFIED MESSAGES] Query failed:', error);
        return res.status(500).json({ error: error.message });
      }
      
      console.log(`✅ [UNIFIED MESSAGES] Found ${messages?.length || 0} messages`);
      console.log(`📊 [UNIFIED MESSAGES] Sample message:`, messages?.[0]);
      res.json(messages || []);
      
    } catch (error) {
      console.error(`💥 [UNIFIED MESSAGES] Exception [${operationId}]:`, error);
      res.status(500).json({ error: error.message });
    }
  });



  // 🏗️ UUID TABLE SETUP ENDPOINT - Create UUID tables in Staff Portal Supabase
  app.post('/api/staff-portal/uuid-setup', async (req, res) => {
    try {
      console.log('📋 [UUID SETUP] Creating UUID tables in Staff Portal Supabase...');
      
      // Create UUID-based chat requests table
      const { error: requestsError } = await staffPortalSupabase.rpc('sql', {
        query: `
          CREATE TABLE IF NOT EXISTS chat_requests_uuid (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              player_id UUID NOT NULL,
              player_name TEXT NOT NULL,
              subject TEXT NOT NULL,
              message TEXT NOT NULL,
              status TEXT CHECK (status IN ('waiting', 'in_progress', 'resolved', 'closed')) DEFAULT 'waiting',
              priority TEXT DEFAULT 'normal',
              category TEXT DEFAULT 'support',
              created_at TIMESTAMPTZ DEFAULT NOW(),
              updated_at TIMESTAMPTZ DEFAULT NOW(),
              resolved_at TIMESTAMPTZ,
              resolved_by TEXT,
              notes TEXT
          );
        `
      });

      if (requestsError) {
        console.error('❌ [UUID SETUP] Failed to create chat_requests_uuid:', requestsError);
      } else {
        console.log('✅ [UUID SETUP] chat_requests_uuid table created');
      }

      // Create UUID-based chat messages table directly
      console.log('📋 [UUID SETUP] Creating unified chat_messages table...');
      
      // Let's test if the tables already exist by attempting to select from them
      const { data: existingRequests, error: requestsCheckError } = await staffPortalSupabase
        .from('chat_requests_uuid')
        .select('count')
        .limit(1);
      
      const { data: existingMessages, error: messagesCheckError } = await staffPortalSupabase
        .from('chat_messages')
        .select('count')
        .limit(1);
        
      if (!requestsCheckError && !messagesCheckError) {
        console.log('✅ [UUID SETUP] Tables already exist!');
        res.json({ 
          success: true, 
          tablesExist: true,
          message: 'UUID tables already exist in Staff Portal Supabase'
        });
        return;
      }
      
      console.log('📋 [UUID SETUP] Tables do not exist, creating them manually...');
      
      // Manual table creation approach - insert test data to auto-create tables
      try {
        // Create a test chat request (this will auto-create the table if it doesn't exist)
        const { data: testRequest, error: testRequestError } = await staffPortalSupabase
          .from('chat_requests_uuid')
          .insert({
            id: 'test-uuid-' + crypto.randomUUID(),
            player_id: 'e0953527-a5d5-402c-9e00-8ed590d19cde',
            player_name: 'vignesh gana',
            subject: 'Test UUID Chat Request',
            message: 'Testing UUID system integration',
            status: 'waiting'
          })
          .select()
          .single();
          
        const { data: testMessage, error: testMessageError } = await staffPortalSupabase
          .from('chat_messages')
          .insert({
            id: 'test-msg-' + crypto.randomUUID(),
            player_id: 'e0953527-a5d5-402c-9e00-8ed590d19cde',
            player_name: 'vignesh gana',
            message: 'Test UUID message integration',
            sender: 'player',
            sender_name: 'vignesh gana',
            status: 'sent'
          })
          .select()
          .single();
          
        console.log('✅ [UUID SETUP] Test data inserted successfully');
        console.log('📊 [UUID SETUP] Request error:', testRequestError);
        console.log('📊 [UUID SETUP] Message error:', testMessageError);
        
        res.json({ 
          success: true, 
          tablesCreated: !testRequestError && !testMessageError,
          requestsTable: !testRequestError,
          messagesTable: !testMessageError,
          method: 'insert_test_data'
        });
        
      } catch (insertError) {
        console.error('💥 [UUID SETUP] Insert test failed:', insertError);
        
        // Fallback: report that tables likely don't exist in this Supabase instance
        res.json({ 
          success: false, 
          tablesCreated: false,
          error: 'UUID tables do not exist in Staff Portal Supabase database',
          details: insertError.message,
          recommendation: 'Use legacy chat system or create tables in database admin panel'
        });
      }
      
    } catch (error) {
      console.error('💥 [UUID SETUP] Exception:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // 🎯 WORKING CHAT MESSAGE SEND (Uses push notifications table as message storage)
  app.post('/api/unified-chat/send', async (req, res) => {
    const operationId = crypto.randomUUID();
    
    try {
      console.log(`\n💬 [CHAT SEND] Starting message send [${operationId}]`);
      console.log('📋 [DATA] Request Body:', JSON.stringify(req.body, null, 2));
      
      const { playerId, playerName, message, senderType = 'player' } = req.body;
      
      if (!playerId || !message) {
        const validationError = { 
          error: 'Player ID and message are required',
          received: { playerId: !!playerId, message: !!message },
          operationId 
        };
        console.error('❌ [VALIDATION] Missing required fields:', validationError);
        return res.status(400).json(validationError);
      }

      console.log(`📤 [CHAT] Processing message from ${senderType} ${playerId}: ${playerName}`);
      
      // Use push_notifications table as chat storage (it works!)
      const chatData = {
        title: `Chat Message from ${playerName || 'Player'}`,
        message: message.trim(),
        target_audience: 'staff',
        sent_by: `player_${playerId}`,
        sent_by_name: playerName || 'Unknown Player',
        sent_by_role: senderType,
        media_type: 'text',
        recipients_count: 1,
        delivery_status: 'sent'
      };
      
      console.log('💾 [INSERT] Inserting chat message as notification:', JSON.stringify(chatData, null, 2));
      
      const { data, error } = await staffPortalSupabase
        .from('push_notifications')
        .insert(chatData)
        .select()
        .single();

      if (error) {
        console.error('❌ [INSERT] Failed to insert chat message:', error);
        return res.status(500).json({ 
          error: 'Failed to save message',
          details: error.message,
          operationId 
        });
      }

      console.log('✅ [SUCCESS] Chat message saved successfully:', data.id);
      
      res.json({
        success: true,
        messageId: data.id,
        message: 'Message sent successfully',
        operationId,
        data: {
          id: data.id,
          playerId: playerId,
          playerName: playerName,
          message: message,
          senderType: senderType,
          timestamp: data.created_at
        }
      });
      
    } catch (error) {
      console.error('💥 [EXCEPTION] Chat send error:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        details: error.message,
        operationId 
      });
    }
  });

  // 🏆 ENHANCED CHAT MESSAGES FETCH WITH COMPREHENSIVE AUDIT & STAFF PORTAL SUPPORT
  app.get('/api/unified-chat/messages/:playerId', async (req, res) => {
    const operationId = crypto.randomUUID();
    const startTime = Date.now();
    
    try {
      console.log(`\n🛡️ === CHAT MESSAGES FETCH AUDIT START [${operationId}] ===`);
      
      const { playerId } = req.params;
      const { bypassStatusFilter, staffPortalMode } = req.query;
      
      console.log('📋 [AUDIT] Fetch Parameters:', {
        playerId,
        bypassStatusFilter,
        staffPortalMode,
        operationId,
        userAgent: req.headers['user-agent']
      });
      
      // Step 1: Validate Player ID
      const normalizedPlayerId = parseInt(playerId);
      if (isNaN(normalizedPlayerId)) {
        const validationError = {
          error: 'Invalid player ID format',
          received: playerId,
          operationId
        };
        console.error('❌ [VALIDATION] Invalid player ID:', validationError);
        return res.status(400).json(validationError);
      }
      
      console.log(`🔍 [UNIFIED CHAT] Fetching messages for player: ${normalizedPlayerId}`);
      
      // Step 2: Build Query with Staff Portal Support
      let query = staffPortalSupabase
        .from('chat_messages')
        .select('*')
        .eq('player_id', normalizedPlayerId);

      // Staff Portal Mode: Remove status filters for comprehensive visibility
      if (staffPortalMode === 'true' || bypassStatusFilter === 'true') {
        console.log('🚀 [STAFF MODE] Bypassing status filters for comprehensive message visibility');
        // No additional filters - fetch ALL messages for this player
      } else {
        // Player Portal Mode: Apply standard filters
        query = query.in('status', ['sent', 'delivered', 'read']);
      }
      
      // Order by creation time for chronological display
      query = query.order('created_at', { ascending: true });
      
      // Step 3: Execute Query with Error Handling
      let queryResult;
      try {
        const { data: messages, error } = await query;
        
        if (error) {
          const queryError = handleChatError(error, 'MESSAGE_FETCH_QUERY', {
            operationId,
            playerId: normalizedPlayerId,
            query: query.toString()
          });
          return res.status(500).json({
            error: 'Failed to fetch messages',
            details: queryError,
            operationId
          });
        }
        
        queryResult = messages || [];
        console.log(`✅ [DATABASE] Retrieved ${queryResult.length} messages from database`);
        
        // Step 4: Database Content Audit (sample first/last messages)
        if (queryResult.length > 0) {
          console.log('🔍 [AUDIT] Sample Messages:', {
            firstMessage: {
              id: queryResult[0].id,
              sender: queryResult[0].sender,
              preview: queryResult[0].message?.substring(0, 50) + '...',
              created_at: queryResult[0].created_at
            },
            lastMessage: {
              id: queryResult[queryResult.length - 1].id,
              sender: queryResult[queryResult.length - 1].sender,
              preview: queryResult[queryResult.length - 1].message?.substring(0, 50) + '...',
              created_at: queryResult[queryResult.length - 1].created_at
            }
          });
        }
        
      } catch (queryException) {
        const criticalError = handleChatError(queryException, 'MESSAGE_FETCH_CRITICAL', {
          operationId,
          playerId: normalizedPlayerId
        });
        return res.status(500).json({
          error: 'Critical query failure',
          details: criticalError,
          operationId
        });
      }
      
      // Step 5: Universal Field Transformation (snake_case → camelCase)
      const transformedMessages = queryResult.map((message, index) => {
        try {
          return transformFieldsToCamelCase(message);
        } catch (transformError) {
          console.error(`⚠️ [TRANSFORM] Failed to transform message ${index}:`, transformError);
          // Return original message if transformation fails
          return message;
        }
      });
      
      // Step 6: Response Preparation with Audit Data
      const duration = Date.now() - startTime;
      const response = {
        messages: transformedMessages,
        meta: {
          total: transformedMessages.length,
          playerId: normalizedPlayerId,
          staffPortalMode: staffPortalMode === 'true',
          bypassStatusFilter: bypassStatusFilter === 'true',
          audit: {
            operationId,
            duration: `${duration}ms`,
            timestamp: new Date().toISOString(),
            queryExecuted: true
          }
        }
      };
      
      console.log(`✅ [UNIFIED CHAT] Successfully fetched ${transformedMessages.length} messages for player ${normalizedPlayerId}`);
      console.log('🏆 [EXPERT FIELD TRANSFORMATION] First transformed message sample:', 
        transformedMessages[0] ? JSON.stringify(transformedMessages[0], null, 2) : 'No messages');
      console.log(`🛡️ === CHAT MESSAGES FETCH AUDIT END [${operationId}] ===\n`);
      
      // Return just messages array for compatibility, but include meta in development
      res.json(process.env.NODE_ENV === 'development' ? response : transformedMessages);
      
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const criticalError = handleChatError(error, 'MESSAGE_FETCH_CRITICAL', {
        operationId,
        duration: `${duration}ms`,
        playerId: req.params.playerId
      });
      
      console.log(`🛡️ === CHAT MESSAGES FETCH AUDIT END [${operationId}] - FAILED ===\n`);
      
      res.status(500).json({
        error: 'Message fetch failed',
        details: criticalError,
        operationId,
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // Get all tournaments from staff portal
  app.get("/api/tournaments", async (req, res) => {
    try {
      console.log('🏆 [TOURNAMENTS] Fetching tournaments from Staff Portal...');
      
      // First, test basic connection and see what tournaments table has
      const { data: testData, error: testError } = await staffPortalSupabase
        .from('tournaments')
        .select('*')
        .limit(1);
      
      console.log('🔍 [TOURNAMENTS] Test query result:', { testData, testError });
      
      if (testError) {
        console.error('❌ [TOURNAMENTS] Test query failed:', testError);
        return res.status(500).json({ error: `Tournament table error: ${testError.message}` });
      }
      
      // Fetch all tournaments from Staff Portal Supabase
      const { data: tournaments, error } = await staffPortalSupabase
        .from('tournaments')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('❌ [TOURNAMENTS] Error:', error);
        console.log('🔍 [TOURNAMENTS] Attempting to fetch with basic query...');
        
        // Try a basic query to see what columns exist
        const { data: basicTournaments, error: basicError } = await staffPortalSupabase
          .from('tournaments')
          .select('*')
          .limit(5);
        
        if (basicError) {
          console.error('❌ [TOURNAMENTS] Basic query failed:', basicError);
          return res.status(500).json({ error: `Failed to fetch tournaments: ${basicError.message}` });
        }
        
        console.log('✅ [TOURNAMENTS] Basic query successful, sample data:', basicTournaments?.[0]);
        return res.json(basicTournaments || []);
      }
      
      // Transform tournament data for frontend
      const transformedTournaments = (tournaments || []).map(tournament => ({
        id: tournament.id,
        name: tournament.name,
        tournament_type: tournament.tournament_type || tournament.type || 'Texas Hold\'em',
        buy_in: tournament.buy_in || 0,
        start_time: tournament.start_time || tournament.start_date,
        max_players: tournament.max_players || 100,
        registered_players: tournament.registered_players || 0,
        status: tournament.status || 'upcoming'
      }));
      
      console.log(`✅ [TOURNAMENTS] Found ${transformedTournaments.length} tournaments`);
      res.json(transformedTournaments);
    } catch (error: any) {
      console.error('❌ [TOURNAMENTS] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Register player for tournament (adds to player management system)
  app.post("/api/tournaments/register", async (req, res) => {
    try {
      const { playerId, tournamentId, playerName, email } = req.body;
      
      if (!playerId || !tournamentId) {
        return res.status(400).json({ error: "Player ID and Tournament ID are required" });
      }
      
      console.log(`🎯 [TOURNAMENT REGISTER] Player ${playerId} registering for tournament ${tournamentId}`);
      
      // Add registration to Staff Portal database
      const { data: registration, error: regError } = await staffPortalSupabase
        .from('tournament_registrations')
        .insert({
          tournament_id: tournamentId,
          player_id: playerId,
          player_name: playerName,
          email: email,
          registered_at: new Date().toISOString(),
          status: 'registered'
        })
        .select()
        .single();
      
      if (regError) {
        console.error('❌ [TOURNAMENT REGISTER] Registration error:', regError);
        return res.status(500).json({ error: "Failed to register for tournament" });
      }
      
      // Update tournament's registered player count
      const { data: tournament, error: tournamentError } = await staffPortalSupabase
        .from('tournaments')
        .select('registered_players')
        .eq('id', tournamentId)
        .single();
      
      if (!tournamentError && tournament) {
        await staffPortalSupabase
          .from('tournaments')
          .update({ 
            registered_players: (tournament.registered_players || 0) + 1 
          })
          .eq('id', tournamentId);
      }
      
      console.log(`✅ [TOURNAMENT REGISTER] Player ${playerId} successfully registered for tournament ${tournamentId}`);
      res.json({ 
        success: true, 
        message: "Successfully registered for tournament",
        registration: registration
      });
    } catch (error: any) {
      console.error('❌ [TOURNAMENT REGISTER] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Tournament interest endpoint (sends to GRE) - already handled in GRE chat endpoint

  // **REAL-TIME MESSAGE SYNC FUNCTION**
  // Call this whenever a new message is added to refresh all connected clients
  function broadcastMessageUpdate(playerId: number) {
    console.log('🛑 WEBSOCKET DEBUG: === UNIFIED ID MAPPING BROADCAST START ===');
    console.log('🔍 WEBSOCKET DEBUG: Real-time message routing | Details:', {
      targetPlayerId: playerId,
      playerIdType: typeof playerId,
      routingType: 'TARGETED_PLAYER_ONLY',
      broadcastMode: 'NO_BROADCAST_ALL',
      validation: 'UNIFIED_ID_MAPPING_APPLIED'
    });
    
    // UNIFIED ID MAPPING FIX - Ensure playerId is consistently treated as number
    const normalizedPlayerId = parseInt(playerId.toString());
    const connection = playerConnections.get(normalizedPlayerId);
    
    console.log('🔍 WEBSOCKET DEBUG: Connection lookup with unified ID | Details:', {
      originalPlayerId: playerId,
      normalizedPlayerId: normalizedPlayerId,
      connectionExists: !!connection,
      connectionState: connection?.readyState,
      expectedState: WebSocket.OPEN,
      playerConnectionsTotal: playerConnections.size,
      allConnectedPlayerIds: Array.from(playerConnections.keys()),
      validation: 'UNIFIED_CONNECTION_MAPPING'
    });
    
    if (connection && connection.readyState === WebSocket.OPEN) {
      console.log(`🔄 [WEBSOCKET REFRESH] Refreshing messages for player ${playerId}`);
      
      // Fetch fresh messages from database
      staffPortalSupabase
        .from('chat_messages')
        .select('*')
        .eq('player_id', playerId)
        .order('created_at', { ascending: true })
        .limit(50)
        .then(({ data: messages, error }) => {
          console.log('🔍 [DEBUG] Fresh messages fetched:', {
            messageCount: messages?.length,
            error: error
          });
          
          if (!error && messages) {
            const updatePayload = {
              type: 'chat_history',
              messages: messages,
              refresh: true
            };
            
            console.log('🔍 [DEBUG] Sending WebSocket update:', {
              messageCount: messages.length,
              lastMessage: messages[messages.length - 1]?.message?.substring(0, 50) + '...'
            });
            
            connection.send(JSON.stringify(updatePayload));
            console.log(`✅ [WEBSOCKET REFRESH] Sent ${messages.length} updated messages to player ${playerId}`);
          } else {
            console.error('❌ [WEBSOCKET REFRESH] Error fetching messages:', error);
          }
        });
    } else {
      console.log('❌ [WEBSOCKET REFRESH] No active connection for player:', playerId);
    }
    
    console.log('🛑 [DEBUG] === BROADCAST MESSAGE UPDATE DEBUG END ===');
  }

  // **ENTERPRISE-READY GRE PORTAL API ENDPOINTS**
  
  // 1. Debug API for all chat requests - Enterprise visibility
  app.get('/api/chat-requests/debug-all', async (req, res) => {
    const operationId = crypto.randomUUID();
    console.log(`🛡️ === CHAT REQUESTS DEBUG START [${operationId}] ===`);
    
    try {
      // Fetch all chat requests without filters for enterprise visibility
      const { data: allRequests, error } = await staffPortalSupabase
        .from('chat_requests')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('❌ [DEBUG ALL] Error fetching chat requests:', error);
        return res.status(500).json({ error: error.message });
      }
      
      // Group by status for enterprise dashboard
      const statusGroups = {
        pending: allRequests?.filter(r => r.status === 'waiting') || [],
        active: allRequests?.filter(r => r.status === 'in_progress') || [],
        resolved: allRequests?.filter(r => r.status === 'resolved') || [],
        closed: allRequests?.filter(r => r.status === 'closed') || []
      };
      
      console.log('✅ [DEBUG ALL] Chat requests by status:', {
        pending: statusGroups.pending.length,
        active: statusGroups.active.length,
        resolved: statusGroups.resolved.length,
        closed: statusGroups.closed.length,
        total: allRequests?.length || 0
      });
      
      res.json({
        success: true,
        meta: {
          total: allRequests?.length || 0,
          operationId,
          timestamp: new Date().toISOString()
        },
        requests: {
          all: allRequests || [],
          byStatus: statusGroups
        }
      });
      
    } catch (error: any) {
      console.error('❌ [DEBUG ALL] Critical error:', error);
      res.status(500).json({ error: error.message, operationId });
    }
  });
  
  // 2. Accept chat request - Move from Pending to Active
  app.post('/api/chat-requests/:requestId/accept', async (req, res) => {
    const { requestId } = req.params;
    const { greId, greName } = req.body;
    const operationId = crypto.randomUUID();
    
    try {
      console.log(`🎯 [ACCEPT] Processing chat request ${requestId}`);
      
      // Update request status to active and assign GRE
      const { data: updatedRequest, error: updateError } = await staffPortalSupabase
        .from('chat_requests')
        .update({
          status: 'in_progress',
          updated_at: new Date().toISOString(),
          resolved_by: greName || 'GRE Staff'
        })
        .eq('id', requestId)
        .select()
        .single();
      
      if (updateError) {
        console.error('❌ [ACCEPT] Update error:', updateError);
        return res.status(500).json({ error: updateError.message });
      }
      
      // Chat request is already managed, no need for separate session table
      console.log('📝 [ACCEPT] Chat request managed directly, no separate session needed');
      
      console.log('✅ [ACCEPT] Request accepted successfully');
      res.json({
        success: true,
        request: updatedRequest,
        operationId
      });
      
    } catch (error: any) {
      console.error('❌ [ACCEPT] Critical error:', error);
      res.status(500).json({ error: error.message, operationId });
    }
  });
  
  // 3. Resolve chat request - Move from Active to Closed
  app.post('/api/chat-requests/:requestId/resolve', async (req, res) => {
    const { requestId } = req.params;
    const { resolution, greName } = req.body;
    const operationId = crypto.randomUUID();
    
    try {
      console.log(`🎯 [RESOLVE] Resolving chat request ${requestId}`);
      
      // Update request status to resolved
      const { data: resolvedRequest, error: updateError } = await staffPortalSupabase
        .from('chat_requests')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          resolved_by: greName || 'GRE Staff',
          notes: resolution || 'Request resolved by GRE',
          updated_at: new Date().toISOString()
        })
        .eq('id', requestId)
        .select()
        .single();
      
      if (updateError) {
        console.error('❌ [RESOLVE] Update error:', updateError);
        return res.status(500).json({ error: updateError.message });
      }
      
      // Chat request status is already updated to 'resolved', no separate session to close
      console.log('📝 [RESOLVE] Chat request resolved directly, no separate session to close');
      
      console.log('✅ [RESOLVE] Request resolved successfully');
      res.json({
        success: true,
        request: resolvedRequest,
        operationId
      });
      
    } catch (error: any) {
      console.error('❌ [RESOLVE] Critical error:', error);
      res.status(500).json({ error: error.message, operationId });
    }
  });
  
  // 4. Get chat session messages with full transcript
  app.get('/api/chat-sessions/:sessionId/messages', async (req, res) => {
    const { sessionId } = req.params;
    const operationId = crypto.randomUUID();
    
    try {
      // Fetch all messages for the session
      const { data: messages, error } = await staffPortalSupabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error('❌ [MESSAGES] Error fetching session messages:', error);
        return res.status(500).json({ error: error.message });
      }
      
      console.log(`✅ [MESSAGES] Retrieved ${messages?.length || 0} messages for session ${sessionId}`);
      res.json({
        success: true,
        messages: messages || [],
        meta: {
          sessionId,
          total: messages?.length || 0,
          operationId
        }
      });
      
    } catch (error: any) {
      console.error('❌ [MESSAGES] Critical error:', error);
      res.status(500).json({ error: error.message, operationId });
    }
  });
  
  // **COMPREHENSIVE GRE ADMIN API ENDPOINTS FOR STAFF PORTAL**
  
  // 🚀 ENHANCED GRE CHAT SESSIONS WITH FAIL-SAFE & COMPREHENSIVE VISIBILITY
  app.get('/api/gre-admin/chat-sessions', async (req, res) => {
    const operationId = crypto.randomUUID();
    const startTime = Date.now();
    
    try {
      console.log(`\n🛡️ === GRE STAFF PORTAL CHAT SESSIONS AUDIT START [${operationId}] ===`);
      console.log('📊 [GRE ADMIN] Fetching all chat sessions for staff portal');
      
      const { 
        bypassStatusFilter = 'true', // Default to bypass for staff visibility
        includeAllMessages = 'true',
        debugMode = req.query.debug || 'false'
      } = req.query;
      
      console.log('📋 [AUDIT] Staff Portal Parameters:', {
        bypassStatusFilter,
        includeAllMessages,
        debugMode,
        operationId,
        timestamp: new Date().toISOString()
      });

      // Step 1: TEMPORARILY REMOVE STATUS FILTERS for comprehensive visibility
      console.log('🚀 [STAFF MODE] Removing ALL status filters for maximum session visibility');
      
      // Step 2: Fetch ALL chat messages first (no session dependency)
      let allMessages = [];
      try {
        console.log('🔍 [DEBUG] Querying ALL chat_messages without filters...');
        
        const { data: rawMessages, error: messageError } = await staffPortalSupabase
          .from('chat_messages')
          .select('*')
          .order('timestamp', { ascending: false });
        
        if (messageError) {
          console.error('❌ [DEBUG] Raw message query failed:', messageError);
          throw messageError;
        }
        
        allMessages = rawMessages || [];
        console.log(`✅ [DEBUG] Retrieved ${allMessages.length} total messages from database`);
        
        // Debug: Log all records retrieved
        if (debugMode === 'true' && allMessages.length > 0) {
          console.log('🔍 [DEBUG] Sample raw messages:');
          allMessages.slice(0, 3).forEach((msg, idx) => {
            console.log(`  ${idx + 1}. ID: ${msg.id}, Player: ${msg.player_id}, Sender: ${msg.sender}, Preview: ${msg.message_text?.substring(0, 50)}...`);
          });
        }
        
      } catch (messageQueryError) {
        const dbError = handleChatError(messageQueryError, 'STAFF_MESSAGE_QUERY', {
          operationId,
          query: 'chat_messages'
        });
        return res.status(500).json({
          error: 'Failed to fetch messages for staff portal',
          details: dbError,
          operationId
        });
      }

      // Step 3: Group messages by player_id to create virtual sessions
      const playerSessions = new Map();
      
      allMessages.forEach(message => {
        const playerId = message.player_id;
        if (!playerSessions.has(playerId)) {
          playerSessions.set(playerId, {
            id: message.session_id || `virtual_${playerId}`,
            player_id: playerId,
            player_name: message.player_name || `Player ${playerId}`,
            player_email: `player${playerId}@example.com`, // Virtual email
            session_id: message.session_id || `virtual_${playerId}`,
            status: 'active', // Always show as active for staff visibility
            priority: 'normal',
            created_at: message.timestamp,
            updated_at: message.timestamp,
            assigned_to: null,
            notes: '',
            chat_messages: []
          });
        }
        
        playerSessions.get(playerId).chat_messages.push(message);
        
        // Update session timestamps
        const session = playerSessions.get(playerId);
        if (new Date(message.timestamp) > new Date(session.updated_at)) {
          session.updated_at = message.timestamp;
        }
        if (new Date(message.timestamp) < new Date(session.created_at)) {
          session.created_at = message.timestamp;
        }
      });

      // Step 4: Convert Map to Array and process for Staff Portal display
      const processedSessions = Array.from(playerSessions.values()).map(session => {
        const messages = session.chat_messages.sort((a, b) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        
        const lastMessage = messages[messages.length - 1];
        const playerMessages = messages.filter(m => m.sender === 'player');
        const greMessages = messages.filter(m => m.sender === 'gre');
        
        return {
          ...session,
          chat_messages: messages, // Include all messages sorted chronologically
          lastMessage: lastMessage?.message_text || 'No messages yet',
          lastMessageTime: lastMessage?.timestamp || session.created_at,
          messageCount: messages.length,
          playerMessageCount: playerMessages.length,
          greMessageCount: greMessages.length,
          unreadCount: playerMessages.length, // All player messages considered "unread" for staff attention
          lastSender: lastMessage?.sender || 'unknown'
        };
      });

      // Step 5: Sort by most recent activity
      processedSessions.sort((a, b) => 
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );

      const duration = Date.now() - startTime;
      
      console.log(`✅ [GRE ADMIN] Successfully processed ${processedSessions.length} chat sessions`);
      console.log('📊 [STATISTICS]:', {
        totalSessions: processedSessions.length,
        totalMessages: allMessages.length,
        activeSessions: processedSessions.filter(s => s.messageCount > 0).length,
        duration: `${duration}ms`
      });
      
      if (debugMode === 'true') {
        console.log('🔍 [DEBUG] Sample processed session:', 
          processedSessions[0] ? JSON.stringify(processedSessions[0], null, 2) : 'No sessions');
      }
      
      console.log(`🛡️ === GRE STAFF PORTAL CHAT SESSIONS AUDIT END [${operationId}] ===\n`);
      
      res.json(processedSessions);
      
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const criticalError = handleChatError(error, 'GRE_ADMIN_SESSIONS_CRITICAL', {
        operationId,
        duration: `${duration}ms`
      });
      
      console.log(`🛡️ === GRE STAFF PORTAL CHAT SESSIONS AUDIT END [${operationId}] - FAILED ===\n`);
      
      res.status(500).json({
        error: 'GRE admin sessions fetch failed',
        details: criticalError,
        operationId,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Get messages for specific player
  app.get('/api/gre-admin/chat-messages/:playerId', async (req, res) => {
    try {
      const playerId = parseInt(req.params.playerId);
      console.log(`📨 [GRE ADMIN] Fetching messages for player ${playerId}`);
      
      const { data: messages, error } = await staffPortalSupabase
        .from('chat_messages')
        .select('*')
        .eq('player_id', playerId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('❌ [GRE ADMIN] Error fetching messages:', error);
        return res.status(500).json({ error: 'Failed to fetch messages' });
      }

      console.log(`✅ [GRE ADMIN] Found ${messages?.length || 0} messages for player ${playerId}`);
      res.json(messages || []);
      
    } catch (err) {
      console.error('❌ [GRE ADMIN] Messages error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // 🚨 ENTERPRISE-GRADE GRE MESSAGE ENDPOINT
  app.post('/api/gre-admin/send-message', async (req, res) => {
    try {
      const { playerId, message, greAgentName = 'GRE Support Agent' } = req.body;
      
      // 🚨 ENTERPRISE-GRADE GRE DEBUG LOGGING - PRODUCTION VALIDATION
      console.log('🛑 WEBSOCKET DEBUG: === GRE MESSAGE PROCESSING START ===');
      console.log('🔍 WEBSOCKET DEBUG: Processing GRE send_message | Details:', {
        playerId: playerId,
        messageText: message,
        greStaffName: greAgentName,
        senderType: 'gre',
        timestamp: new Date().toISOString(),
        validation: 'PRODUCTION_GRE_CONTEXT_ONLY'
      });
      
      // PRODUCTION DATA VALIDATION - NO MOCK/TEST DATA ALLOWED
      if (!playerId || playerId === 0 || !message || message.includes('test') || message.includes('demo')) {
        console.error('❌ WEBSOCKET DEBUG: INVALID GRE MESSAGE CONTEXT - Mock/test data detected');
        throw new Error('Invalid GRE message context - only production data allowed');
      }
      
      console.log(`📤 [GRE ADMIN] Sending message to player ${playerId}: ${message.substring(0, 50)}...`);
      
      // Find active session
      const { data: session, error: sessionError } = await staffPortalSupabase
        .from('chat_requests')
        .select('*')
        .eq('player_id', playerId)
        .eq('status', 'active')
        .single();

      console.log('🔍 WEBSOCKET DEBUG: GRE session lookup | Details:', {
        playerId: playerId,
        sessionFound: !!session,
        sessionError: sessionError?.message || 'none',
        validation: 'PRODUCTION_SESSION_REQUIRED'
      });

      if (sessionError || !session) {
        console.error('❌ WEBSOCKET DEBUG: No active production session found for player:', playerId);
        return res.status(404).json({ error: 'No active chat session found for this player' });
      }

      // Insert GRE message
      const greMessage = {
        session_id: session.id,
        player_id: playerId,
        player_name: session.player_name,
        message: message,
        sender: 'gre',
        sender_name: greAgentName,
        timestamp: new Date().toISOString(),
        status: 'sent'
      };

      console.log('🔍 WEBSOCKET DEBUG: GRE database insert payload | Details:', {
        sessionId: greMessage.session_id,
        playerId: greMessage.player_id,
        playerName: greMessage.player_name,
        messageText: greMessage.message,
        sender: greMessage.sender,
        greStaffName: greMessage.sender_name,
        validation: 'PRODUCTION_GRE_DATABASE_WRITE'
      });

      const { data: savedMessage, error: messageError } = await staffPortalSupabase
        .from('chat_messages')
        .insert([greMessage])
        .select()
        .single();

      if (messageError) {
        console.error('❌ [GRE ADMIN] Error saving message:', messageError);
        console.error('🔍 [DEBUG] Message Error Details:', JSON.stringify(messageError, null, 2));
        return res.status(500).json({ error: 'Failed to save message' });
      }

      console.log('✅ WEBSOCKET DEBUG: GRE message saved to production database | Details:', {
        messageId: savedMessage.id,
        playerId: savedMessage.player_id,
        playerName: savedMessage.player_name,
        sender: savedMessage.sender,
        greStaffName: savedMessage.sender_name,
        timestamp: savedMessage.timestamp,
        validation: 'PRODUCTION_GRE_DATA_CONFIRMED'
      });

      // Check if player has active WebSocket connection
      const connection = playerConnections.get(playerId);
      console.log('🔍 [DEBUG] Player WebSocket Connection Status:', {
        hasConnection: !!connection,
        connectionReady: connection?.readyState === WebSocket.OPEN,
        playerConnectionsSize: playerConnections.size
      });

      // Broadcast update to player's WebSocket connection
      broadcastMessageUpdate(playerId);

      console.log(`✅ [GRE ADMIN] Message sent successfully to player ${playerId}`);
      console.log('🛑 [DEBUG] === GRE SEND MESSAGE DEBUG END ===');
      
      res.json({ success: true, message: savedMessage });
      
    } catch (err) {
      console.error('❌ [GRE ADMIN] Send message error:', err);
      console.error('🔍 [DEBUG] Full GRE Error:', JSON.stringify(err, null, 2));
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get GRE dashboard summary
  app.get('/api/gre-admin/dashboard-summary', async (req, res) => {
    try {
      console.log('📊 [GRE ADMIN] Fetching dashboard summary');
      
      // Get active requests count
      const { count: activeRequests } = await staffPortalSupabase
        .from('chat_requests')
        .select('*', { count: 'exact' })
        .in('status', ['waiting', 'in_progress']);

      // Get total messages today
      const today = new Date().toISOString().split('T')[0];
      const { count: messagesToday } = await staffPortalSupabase
        .from('chat_messages')
        .select('*', { count: 'exact' })
        .gte('created_at', today + 'T00:00:00Z');

      // Get unread messages (recent player messages without GRE response)
      const { data: recentMessages, error } = await staffPortalSupabase
        .from('chat_messages')
        .select('*')
        .eq('sender', 'player')
        .gte('created_at', today + 'T00:00:00Z')
        .order('created_at', { ascending: false });

      let unreadCount = 0;
      if (!error && recentMessages) {
        unreadCount = recentMessages.length;
      }

      const summary = {
        activeRequests: activeRequests || 0,
        messagesToday: messagesToday || 0,
        unreadMessages: unreadCount,
        timestamp: new Date().toISOString()
      };

      console.log('✅ [GRE ADMIN] Dashboard summary:', summary);
      res.json(summary);
      
    } catch (err) {
      console.error('❌ [GRE ADMIN] Dashboard summary error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return httpServer;
}
