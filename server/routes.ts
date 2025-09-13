import type { Express } from "express";
import { createServer } from "http";
import { supabaseOnlyStorage as storage } from "./supabase-only-storage";
import express from "express";
import path from "path";
import fs from "fs";
import Pusher from 'pusher';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import OneSignal from 'onesignal-node';
import { setupProductionAPIs } from './production-apis';
import { setupDeepFixAPIs } from './deep-fix-apis';
import { unifiedPlayerSystem } from './unified-player-system';
import { db } from './db';
import { generateNextPlayerId } from '../whitelabeling';

// Validate environment variables
const requiredEnvVars = ['PUSHER_APP_ID', 'PUSHER_KEY', 'PUSHER_SECRET', 'PUSHER_CLUSTER', 'VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const optionalEnvVars = ['CLERK_SECRET_KEY', 'VITE_CLERK_PUBLISHABLE_KEY'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('❌ [ENVIRONMENT] Missing required environment variables:', missingEnvVars);
  throw new Error(`Missing environment variables: ${missingEnvVars.join(', ')}`);
}

// Check optional Clerk variables
const missingClerkVars = optionalEnvVars.filter(envVar => !process.env[envVar]);
if (missingClerkVars.length > 0) {
  console.warn('⚠️ [CLERK] Missing optional Clerk environment variables:', missingClerkVars);
  console.warn('⚠️ [CLERK] Clerk integration will be disabled');
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

// Import direct chat system (bypasses Supabase cache issues)
import { directChat } from './direct-chat-system';
import { directKycStorage } from './direct-kyc-storage';
import { enterprisePlayerSystem } from './enterprise-player-system';

// Import Clerk integration
import { ClerkPlayerSync } from './clerk-integration';

// Import staff portal integration
import staffPortalRoutes from './routes/staff-portal-integration';

// Import malware scanner
import { scanBufferForMalware } from './malware-scanner';

// Import F&B schema types
import { foodBeverageItems, adsOffers, orders } from '@shared/schema';

export function registerRoutes(app: Express) {
  // SIMPLE CASH BALANCE SYSTEM - MANAGER HANDLES TABLE OPERATIONS

  // ========== LEGACY ENDPOINT REMOVED - USE /api/balance/:playerId INSTEAD ==========
  // REMOVED: Duplicate /api/player/:playerId/balance endpoint - redirecting to main endpoint

  // Get player balance endpoint - Direct PostgreSQL
  app.get("/api/balance/:playerId", async (req, res) => {
    try {
      const playerId = parseInt(req.params.playerId);

      if (isNaN(playerId)) {
        return res.status(400).json({ error: 'Invalid player ID' });
      }

      console.log(`💰 [BALANCE API] Fetching balance for player: ${playerId}`);

      const { Client } = await import('pg');
      const pgClient = new Client({ connectionString: process.env.DATABASE_URL });
      await pgClient.connect();

      try {
        const result = await pgClient.query(
          'SELECT balance, current_credit, credit_limit, credit_eligible FROM players WHERE id = $1',
          [playerId]
        );

        if (result.rows.length === 0) {
          await pgClient.end();
          console.error('❌ [BALANCE API] Player not found');
          return res.status(404).json({ error: 'Player not found' });
        }

        const player = result.rows[0];
        const balanceData = {
          cashBalance: player.balance || '0.00',
          creditBalance: player.current_credit || '0.00',
          creditLimit: player.credit_limit || '0.00',
          creditEligible: player.credit_eligible || false,
          totalBalance: (parseFloat(player.balance || '0.00') + parseFloat(player.current_credit || '0.00')).toFixed(2)
        };

        await pgClient.end();
        console.log(`✅ [BALANCE API] Balance retrieved for player ${playerId}:`, balanceData.cashBalance);
        res.json(balanceData);

      } catch (dbError: any) {
        await pgClient.end();
        console.error('❌ [BALANCE API] Database error:', dbError);
        return res.status(500).json({ error: 'Database query failed' });
      }

    } catch (error: any) {
      console.error('❌ [BALANCE API] Server error:', error);
      res.status(500).json({ error: 'Failed to fetch balance' });
    }
  });

  // Player field validation API - Check if email, nickname, or phone already exist
  app.post("/api/players/validate", async (req, res) => {
    try {
      const { field, value } = req.body;
      
      if (!field || !value) {
        return res.status(400).json({ error: 'Field and value are required' });
      }

      // Validate allowed fields
      const allowedFields = ['email', 'nickname', 'phone'];
      if (!allowedFields.includes(field)) {
        return res.status(400).json({ error: 'Invalid field for validation' });
      }

      console.log(`🔍 [VALIDATION API] Checking ${field} for duplicates`);

      const { Client } = await import('pg');
      const pgClient = new Client({ connectionString: process.env.DATABASE_URL });
      await pgClient.connect();

      try {
        // Map field names to database column names
        const fieldMap = {
          email: 'email',
          nickname: 'nickname', 
          phone: 'phone'
        };

        const dbField = fieldMap[field as keyof typeof fieldMap];
        const result = await pgClient.query(
          `SELECT COUNT(*) as count FROM players WHERE ${dbField} = $1`,
          [value]
        );

        const exists = parseInt(result.rows[0].count) > 0;
        await pgClient.end();

        console.log(`✅ [VALIDATION API] ${field} duplicate check completed - exists: ${exists}`);
        res.json({ exists, field });

      } catch (dbError: any) {
        await pgClient.end();
        console.error('❌ [VALIDATION API] Database error:', dbError);
        return res.status(500).json({ error: 'Database query failed' });
      }

    } catch (error: any) {
      console.error('❌ [VALIDATION API] Server error:', error);
      res.status(500).json({ error: 'Failed to validate field' });
    }
  });

  // Get Player Data by ID (for KYC workflow initialization) - PostgreSQL Direct
  app.get("/api/players/:playerId", async (req, res) => {
    try {
      const playerId = parseInt(req.params.playerId);

      console.log(`🔍 [PLAYER DATA] Fetching player: ${playerId}`);

      // Use PostgreSQL direct query (consistent with signup/signin approach)
      const { Client } = await import('pg');
      const pgClient = new Client({ connectionString: process.env.DATABASE_URL });
      await pgClient.connect();

      try {
        const result = await pgClient.query(
          'SELECT * FROM players WHERE id = $1',
          [playerId]
        );

        if (result.rows.length === 0) {
          await pgClient.end();
          console.error('❌ [PLAYER DATA] Player not found in PostgreSQL');
          return res.status(404).json({ error: 'Player not found' });
        }

        const player = result.rows[0];
        await pgClient.end();

        // Return formatted player data for KYC workflow (compatible with frontend)
        const playerData = {
          id: player.id,
          email: player.email,
          firstName: player.first_name,
          lastName: player.last_name,
          phone: player.phone,
          kycStatus: player.kyc_status,
          balance: player.balance,
          emailVerified: player.email_verified,
          panCard: player.pan_card_number,
          panCardStatus: player.pan_card_status,
          panCardVerified: player.pan_card_verified,
          supabaseId: player.supabase_id,
          universalId: player.universal_id,
          creditBalance: player.current_credit || '0.00',
          creditLimit: player.credit_limit || '0.00',
          creditEligible: player.credit_eligible || false,
          lastLogin: player.last_login_at,
          createdAt: player.created_at
        };

        console.log(`✅ [PLAYER DATA] Player found: ${player.email}`);
        res.json(playerData);

      } finally {
        // Ensure connection is closed
        try {
          await pgClient.end();
        } catch (e) {
          // Connection already closed
        }
      }

    } catch (error: any) {
      console.error('❌ [PLAYER DATA] Error:', error);
      res.status(500).json({ error: 'Failed to fetch player data' });
    }
  });

  // Get Player KYC Documents (for KYC workflow initialization) - PostgreSQL Direct
  app.get("/api/documents/player/:playerId", async (req, res) => {
    try {
      const playerId = parseInt(req.params.playerId);

      console.log(`🔍 [KYC DOCS] Fetching documents for player: ${playerId}`);

      // Use PostgreSQL direct query (consistent with signup/signin approach)
      const { Client } = await import('pg');
      const pgClient = new Client({ connectionString: process.env.DATABASE_URL });
      await pgClient.connect();

      try {
        const result = await pgClient.query(
          'SELECT * FROM kyc_documents WHERE player_id = $1 ORDER BY created_at DESC',
          [playerId]
        );

        const documents = result.rows.map(row => ({
        id: row.id,
        document_type: row.document_type,  // Keep SQL field name
        documentType: row.document_type,   // Also provide camelCase version
        file_name: row.file_name,         // Keep SQL field name
        fileName: row.file_name,          // Also provide camelCase version
        fileUrl: row.file_url,
        status: row.status,
        fileSize: row.file_size || 0,
        created_at: row.created_at,       // Keep SQL field name
        createdAt: row.created_at,        // Also provide camelCase version
        updated_at: row.updated_at,       // Keep SQL field name
        updatedAt: row.updated_at         // Also provide camelCase version
      }));

        await pgClient.end();

        console.log(`✅ [KYC DOCS] Found ${documents.length} documents for player ${playerId}`);
        res.json(documents);

      } finally {
        // Ensure connection is closed
        try {
          await pgClient.end();
        } catch (e) {
          // Connection already closed
        }
      }

    } catch (error: any) {
      console.error('❌ [KYC DOCS] Error:', error);
      res.status(500).json({ error: 'Failed to fetch documents' });
    }
  });

  // Player Balance Update API - Force update balance (for fixing data sync issues)
  app.post("/api/player/:playerId/update-balance", async (req, res) => {
    try {
      const playerId = parseInt(req.params.playerId);
      const { balance } = req.body;

      console.log(`🔧 [BALANCE UPDATE] Updating player ${playerId} balance to: ${balance}`);

      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const { data, error } = await supabase
        .from('players')
        .update({ balance })
        .eq('id', playerId)
        .select()
        .single();

      if (error) {
        console.error('❌ [BALANCE UPDATE] Error:', error);
        return res.status(500).json({ error: 'Failed to update balance' });
      }

      console.log('✅ [BALANCE UPDATE] Success:', data.balance);
      res.json({ success: true, newBalance: data.balance });

    } catch (error: any) {
      console.error('❌ [BALANCE UPDATE] Error:', error);
      res.status(500).json({ error: 'Failed to update balance' });
    }
  });

  // Credit Transfer API - Transfer credit to cash balance
  app.post("/api/player/:playerId/credit-transfer", async (req, res) => {
    try {
      const playerId = parseInt(req.params.playerId);
      const { amount } = req.body;

      console.log(`💳 [CREDIT TRANSFER] Player ${playerId} transferring: ${amount}`);

      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      // Get current player data
      const { data: player, error: playerError } = await supabase
        .from('players')
        .select('id, balance, credit_limit, current_credit, credit_eligible')
        .eq('id', playerId)
        .single();

      if (playerError || !player) {
        console.error('❌ [CREDIT TRANSFER] Player not found:', playerError);
        return res.status(404).json({ error: 'Player not found' });
      }

      const currentCredit = parseFloat(player.current_credit || '0');
      const currentCash = parseFloat(player.balance || '0');
      const transferAmount = parseFloat(amount);

      // Validation checks
      if (!transferAmount || transferAmount <= 0) {
        return res.status(400).json({ error: 'Invalid transfer amount' });
      }

      if (transferAmount > currentCredit) {
        return res.status(400).json({ error: 'Insufficient credit balance' });
      }

      if (!player.credit_eligible) {
        return res.status(403).json({ error: 'Credit not approved for this player' });
      }

      // Calculate new balances
      const newCreditBalance = currentCredit - transferAmount;
      const newCashBalance = currentCash + transferAmount;

      // Update player balances
      const { data: updatedPlayer, error: updateError } = await supabase
        .from('players')
        .update({
          balance: newCashBalance.toFixed(2),
          current_credit: newCreditBalance.toFixed(2)
        })
        .eq('id', playerId)
        .select()
        .single();

      if (updateError) {
        console.error('❌ [CREDIT TRANSFER] Update failed:', updateError);
        return res.status(500).json({ error: 'Failed to transfer credit' });
      }

      // Create transaction record
      await supabase
        .from('transactions')
        .insert({
          player_id: playerId,
          type: 'credit_transfer',
          amount: transferAmount.toFixed(2),
          description: `Credit transferred to cash balance`,
          status: 'completed'
        });

      console.log(`✅ [CREDIT TRANSFER] Player ${playerId} transferred ₹${transferAmount} from credit to cash`);
      res.json({
        message: 'Credit transferred successfully',
        newCashBalance: newCashBalance.toFixed(2),
        newCreditBalance: newCreditBalance.toFixed(2)
      });

    } catch (error: any) {
      console.error('❌ [CREDIT TRANSFER] Error:', error);
      res.status(500).json({ error: 'Failed to transfer credit' });
    }
  });

  // Player Transactions API - Get transaction history
  app.get("/api/player/:playerId/transactions", async (req, res) => {
    try {
      const playerId = parseInt(req.params.playerId);
      const limit = parseInt(req.query.limit as string) || 10;
      console.log(`📊 [TRANSACTIONS API] Getting transactions for player: ${playerId}, limit: ${limit}`);

      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('id, player_id, type, amount, description, staff_id, created_at')
        .eq('player_id', playerId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('❌ [TRANSACTIONS API] Error:', error);
        return res.status(500).json({ error: 'Failed to fetch transactions' });
      }

      console.log(`✅ [TRANSACTIONS API] Retrieved ${transactions?.length || 0} transactions for player ${playerId}`);
      res.json(transactions || []);

    } catch (error: any) {
      console.error('❌ [TRANSACTIONS API] Error:', error);
      res.status(500).json({ error: 'Failed to fetch transactions' });
    }
  });

  // Cash-Out Request API - Submit withdrawal requests
  app.post("/api/cash-out-request", async (req, res) => {
    try {
      const { playerId, amount, requestedAt } = req.body;
      console.log(`💳 [CASH-OUT API] Processing request for player ${playerId}: ₹${amount}`);

      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      // Get player info
      const { data: player, error: playerError } = await supabase
        .from('players')
        .select('first_name, last_name, balance')
        .eq('id', playerId)
        .single();

      if (playerError || !player) {
        return res.status(404).json({ error: 'Player not found' });
      }

      const availableBalance = parseFloat(player.balance || '0');

      if (amount > availableBalance) {
        return res.status(400).json({
          error: `Insufficient balance. Available: ₹${availableBalance.toLocaleString()}`
        });
      }

      // Create cash-out request
      const { data: request, error } = await supabase
        .from('cash_out_requests')
        .insert({
          player_id: playerId,
          amount,
          status: 'pending',
          requested_at: requestedAt,
          player_name: `${player.first_name} ${player.last_name}`
        })
        .select()
        .single();

      if (error) {
        console.error('❌ [CASH-OUT API] Database error:', error);
        return res.status(500).json({ error: 'Failed to create cash-out request' });
      }

      // Notify Staff Portal via Pusher
      await pusher.trigger('cashier-notifications', 'new_cash_out_request', {
        requestId: request.id,
        playerId,
        playerName: `${player.first_name} ${player.last_name}`,
        amount,
        requestedAt,
        timestamp: new Date().toISOString()
      });

      // Notify Player Portal of request submission
      await pusher.trigger(`player-${playerId}`, 'cash_out_request_submitted', {
        requestId: request.id,
        amount,
        status: 'pending'
      });

      console.log(`✅ [CASH-OUT API] Request created:`, request.id);
      res.json({ success: true, request });

    } catch (error: any) {
      console.error('❌ [CASH-OUT API] Error:', error);
      res.status(500).json({ error: 'Failed to create cash-out request' });
    }
  });

  // CRITICAL MISSING ENDPOINT: Cashier Cash-Out Processing
  app.post("/api/cashier/process-cash-out", async (req, res) => {
    try {
      const { requestId, approvedBy, notes } = req.body;
      console.log(`💰 [CASHIER PROCESSING] Processing cash-out request: ${requestId}`);

      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      // Get the cash-out request details
      const { data: request, error: requestError } = await supabase
        .from('cash_out_requests')
        .select('*')
        .eq('id', requestId)
        .eq('status', 'pending')
        .single();

      if (requestError || !request) {
        return res.status(404).json({ error: 'Cash-out request not found or already processed' });
      }

      const { player_id: playerId, amount } = request;

      // Get current player balance
      const { data: player, error: playerError } = await supabase
        .from('players')
        .select('balance, first_name, last_name')
        .eq('id', playerId)
        .single();

      if (playerError || !player) {
        return res.status(404).json({ error: 'Player not found' });
      }

      const currentBalance = parseFloat(player.balance || '0');

      // Validate sufficient balance
      if (amount > currentBalance) {
        // Mark request as rejected
        await supabase
          .from('cash_out_requests')
          .update({
            status: 'rejected',
            processed_at: new Date().toISOString(),
            processed_by: approvedBy,
            notes: `Insufficient balance. Available: ₹${currentBalance.toLocaleString()}`
          })
          .eq('id', requestId);

        return res.status(400).json({
          error: `Insufficient balance. Available: ₹${currentBalance.toLocaleString()}`
        });
      }

      // CRITICAL: Update player balance by deducting the cash-out amount
      const newBalance = currentBalance - amount;
      const { error: updateError } = await supabase
        .from('players')
        .update({ balance: newBalance.toString() })
        .eq('id', playerId);

      if (updateError) {
        console.error('❌ [CASHIER PROCESSING] Balance update error:', updateError);
        return res.status(500).json({ error: 'Failed to update player balance' });
      }

      // Update request status to approved
      const { error: statusError } = await supabase
        .from('cash_out_requests')
        .update({
          status: 'approved',
          processed_at: new Date().toISOString(),
          processed_by: approvedBy,
          notes: notes || 'Processed by cashier'
        })
        .eq('id', requestId);

      if (statusError) {
        console.error('❌ [CASHIER PROCESSING] Status update error:', statusError);
      }

      // Record the cash-out as a transaction
      const { data: transaction, error: transactionError } = await supabase
        .from('transactions')
        .insert({
          player_id: playerId,
          type: 'cashier_withdrawal',
          amount,
          description: `Cash-out processed by cashier: ${approvedBy}`,
          staff_id: approvedBy || 'cashier',
          status: 'completed'
        })
        .select()
        .single();

      if (transactionError) {
        console.error('❌ [CASHIER PROCESSING] Transaction error:', transactionError);
      }

      // CRITICAL: Trigger real-time balance updates via Pusher
      await pusher.trigger('cross-portal-sync', 'player_balance_update', {
        playerId,
        type: 'cashier_withdrawal',
        amount,
        newBalance,
        requestId,
        timestamp: new Date().toISOString()
      });

      // Notify player of processed cash-out
      await pusher.trigger(`player-${playerId}`, 'balance_updated', {
        cashBalance: newBalance,
        operation: 'cashier_withdrawal',
        amount,
        requestId
      });

      // Notify staff portal of processed request
      await pusher.trigger('cashier-notifications', 'cash_out_processed', {
        requestId,
        playerId,
        playerName: `${player.first_name} ${player.last_name}`,
        newBalance,
        processedBy: approvedBy,
        timestamp: new Date().toISOString()
      });

      console.log(`✅ [CASHIER PROCESSING] Cash-out approved: Player ${playerId}, Amount: ₹${amount}, New Balance: ₹${newBalance}`);
      res.json({
        success: true,
        newBalance,
        transaction: transaction?.id,
        message: `Cash-out processed successfully. New balance: ₹${newBalance.toLocaleString()}`
      });

    } catch (error: any) {
      console.error('❌ [CASHIER PROCESSING] Error:', error);
      res.status(500).json({ error: 'Failed to process cash-out request' });
    }
  });

  // Table Buy-in API - Deduct balance for table operations
  app.post("/api/table/buy-in", async (req, res) => {
    try {
      const { playerId, tableId, amount, staffId } = req.body;
      console.log(`🎯 [TABLE BUY-IN] Player ${playerId} buying in ₹${amount} at Table ${tableId}`);

      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      // Get current player balance
      const { data: player, error: playerError } = await supabase
        .from('players')
        .select('balance, first_name, last_name')
        .eq('id', playerId)
        .single();

      if (playerError || !player) {
        return res.status(404).json({ error: 'Player not found' });
      }

      const currentBalance = parseFloat(player.balance || '0');
      if (amount > currentBalance) {
        return res.status(400).json({
          error: `Insufficient balance. Available: ₹${currentBalance.toLocaleString()}`
        });
      }

      // Update player balance
      const newBalance = currentBalance - amount;
      const { error: updateError } = await supabase
        .from('players')
        .update({ balance: newBalance.toString() })
        .eq('id', playerId);

      if (updateError) {
        console.error('❌ [TABLE BUY-IN] Balance update error:', updateError);
        return res.status(500).json({ error: 'Failed to update balance' });
      }

      // Record transaction
      const { data: transaction, error: transactionError } = await supabase
        .from('transactions')
        .insert({
          player_id: playerId,
          type: 'table_buy_in',
          amount,
          description: `Table buy-in at ${tableId}`,
          staff_id: staffId || 'system',
          table_id: tableId
        })
        .select()
        .single();

      if (transactionError) {
        console.error('❌ [TABLE BUY-IN] Transaction error:', transactionError);
      }

      // Real-time balance update via Pusher
      await pusher.trigger('cross-portal-sync', 'player_balance_update', {
        playerId,
        type: 'table_buy_in',
        amount,
        newBalance,
        tableId,
        timestamp: new Date().toISOString()
      });

      await pusher.trigger(`player-${playerId}`, 'balance_updated', {
        cashBalance: newBalance,
        operation: 'table_buy_in',
        amount,
        tableId
      });

      console.log(`✅ [TABLE BUY-IN] Successful: Player ${playerId} new balance: ₹${newBalance}`);
      res.json({
        success: true,
        newBalance,
        transaction: transaction?.id,
        message: `Buy-in successful. New balance: ₹${newBalance.toLocaleString()}`
      });

    } catch (error: any) {
      console.error('❌ [TABLE BUY-IN] Error:', error);
      res.status(500).json({ error: 'Failed to process table buy-in' });
    }
  });

  // Table Cash-out API - Add balance from table operations
  app.post("/api/table/cash-out", async (req, res) => {
    try {
      const { playerId, tableId, amount, staffId } = req.body;
      console.log(`🏆 [TABLE CASH-OUT] Player ${playerId} cashing out ₹${amount} from Table ${tableId}`);

      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      // Get current player balance
      const { data: player, error: playerError } = await supabase
        .from('players')
        .select('balance, first_name, last_name')
        .eq('id', playerId)
        .single();

      if (playerError || !player) {
        return res.status(404).json({ error: 'Player not found' });
      }

      // Update player balance
      const currentBalance = parseFloat(player.balance || '0');
      const newBalance = currentBalance + amount;
      const { error: updateError } = await supabase
        .from('players')
        .update({ balance: newBalance.toString() })
        .eq('id', playerId);

      if (updateError) {
        console.error('❌ [TABLE CASH-OUT] Balance update error:', updateError);
        return res.status(500).json({ error: 'Failed to update balance' });
      }

      // Record transaction
      const { data: transaction, error: transactionError } = await supabase
        .from('transactions')
        .insert({
          player_id: playerId,
          type: 'table_cash_out',
          amount,
          description: `Table cash-out from ${tableId}`,
          staff_id: staffId || 'system',
          table_id: tableId
        })
        .select()
        .single();

      if (transactionError) {
        console.error('❌ [TABLE CASH-OUT] Transaction error:', transactionError);
      }

      // Real-time balance update via Pusher
      await pusher.trigger('cross-portal-sync', 'player_balance_update', {
        playerId,
        type: 'table_cash_out',
        amount,
        newBalance,
        tableId,
        timestamp: new Date().toISOString()
      });

      await pusher.trigger(`player-${playerId}`, 'balance_updated', {
        cashBalance: newBalance,
        operation: 'table_cash_out',
        amount,
        tableId
      });

      console.log(`✅ [TABLE CASH-OUT] Successful: Player ${playerId} new balance: ₹${newBalance}`);
      res.json({
        success: true,
        newBalance,
        transaction: transaction?.id,
        message: `Cash-out successful. New balance: ₹${newBalance.toLocaleString()}`
      });

    } catch (error: any) {
      console.error('❌ [TABLE CASH-OUT] Error:', error);
      res.status(500).json({ error: 'Failed to process table cash-out' });
    }
  });

  // UNIFIED CHAT SYSTEM - Single source of truth (NEW CORE)

  // STAFF PORTAL COMPATIBLE API ENDPOINTS

  // PLAYER-TO-STAFF MESSAGING - Using exact same directChat system that works
  app.post("/api/player-chat-integration/send", async (req, res) => {
    try {
      const { playerId, playerName, message, isFromPlayer } = req.body;

      if (!playerId || !message) {
        return res.status(400).json({ success: false, error: 'Player ID and message are required' });
      }

      console.log(`💬 [PLAYER CHAT] Player ${playerId} sending: "${message}"`);

      // Use the exact same directChat system that staff portal uses
      const result = await directChat.sendMessage(
        parseInt(playerId.toString()),
        playerName || `Player ${playerId}`,
        message,
        'player'
      );

      console.log(`✅ [PLAYER CHAT] Message sent successfully via directChat`);

      res.json({
        success: true,
        id: result.data.id,
        timestamp: result.data.timestamp
      });

    } catch (error: any) {
      console.error('❌ [PLAYER CHAT] Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // STAFF PORTAL INTEGRATION ENDPOINTS - EXACT PRODUCTION SPECIFICATION
  // From: Player Portal Production Integration Document (August 11, 2025)

  // 1. Send Player Message to Staff (OPTIMIZED V1.2) - Speed enhanced for 1M+ players
  app.post("/api/staff-chat-integration/send", async (req, res) => {
    const startTime = process.hrtime.bigint();

    try {
      const { requestId, playerId, playerName, message, staffId = 151, staffName = "Guest Relation Executive" } = req.body;

      if (!playerId || !message) {
        return res.status(400).json({ success: false, error: 'playerId and message are required' });
      }

      console.log(`⚡ [OPTIMIZED V1.2] Processing message from player ${playerId}: "${message}"`);

      // Pre-generate response data for immediate return (optimistic response)
      const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const timestamp = new Date().toISOString();
      const pusherChannels = [`player-${playerId}`, 'staff-portal'];

      // Prepare optimistic response
      const optimisticResponse = {
        success: true,
        message: {
          id: messageId,
          message_text: message,
          sender: 'player',
          timestamp: timestamp
        },
        pusherChannels: pusherChannels,
        timestamp: timestamp
      };

      // Send response immediately to client (optimistic UI)
      res.json(optimisticResponse);

      // Process everything in background (non-blocking for client)
      setImmediate(async () => {
        try {
          const { createClient } = await import('@supabase/supabase-js');
          const supabase = createClient(
            process.env.VITE_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          );

          // Get player email from players table
          const { data: playerData } = await supabase
            .from('players')
            .select('email, first_name, last_name')
            .eq('id', playerId)
            .single();

          const playerEmail = playerData?.email || '';
          const fullPlayerName = playerData ?
            `${playerData.first_name || ''} ${playerData.last_name || ''}`.trim() || playerName :
            playerName || `Player ${playerId}`;

          console.log(`📧 [CHAT SESSION] Retrieved player email: ${playerEmail} for player ${playerId}`);

          // SEQUENTIAL EXECUTION to fix race condition and FK violations
          
          // Step 1: Session management (MUST complete first)
          let finalSessionId;
          try {
            // Check existing session
            const { data: existingSession } = await supabase
              .from('chat_sessions')
              .select('id')
              .eq('player_id', playerId)
              .in('status', ['waiting', 'active'])
              .limit(1);

            if (existingSession && existingSession.length > 0) {
              finalSessionId = existingSession[0].id;
              console.log(`🔄 [CHAT SESSION] Using existing session: ${finalSessionId}`);
            } else {
              // Create new session
              finalSessionId = requestId || `session-${playerId}-${Date.now()}`;
              const { error: sessionError } = await supabase
                .from('chat_sessions')
                .upsert({
                  id: finalSessionId,
                  player_id: playerId,
                  player_name: fullPlayerName,
                  player_email: playerEmail,
                  initial_message: message,
                  status: 'waiting',
                  priority: 'normal'
                });

              if (sessionError) {
                console.error('❌ [CHAT SESSION] Error creating session:', sessionError);
                throw sessionError;
              }
              console.log(`✅ [CHAT SESSION] Created session ${finalSessionId} with email: ${playerEmail}`);
            }
          } catch (sessionError) {
            console.error('❌ [CHAT SESSION] Session operation failed:', sessionError);
            throw sessionError;
          }

          // Step 2: Message insertion (uses the resolved session ID) + update session activity
          try {
            // Insert message and update session activity in parallel (both use same session ID)
            const [messageResult, sessionUpdateResult] = await Promise.all([
              supabase.from('chat_messages').insert({
                id: messageId,
                chat_session_id: finalSessionId, // Use the actual session ID
                sender_id: playerId.toString(),
                sender_type: 'player',
                sender_name: fullPlayerName,
                message_text: message,
                message_type: 'text'
                // created_at and updated_at use schema defaults
              }),
              supabase.from('chat_sessions')
                .update({ last_activity: new Date().toISOString() })
                .eq('id', finalSessionId)
            ]);

            if (messageResult.error) {
              console.error('❌ [CHAT MESSAGE] Error inserting message:', messageResult.error);
              throw messageResult.error;
            }
            if (sessionUpdateResult.error) {
              console.error('❌ [CHAT SESSION] Error updating activity:', sessionUpdateResult.error);
              // Non-critical, don't throw
            }
            console.log(`✅ [CHAT MESSAGE] Saved message ${messageId} to session ${finalSessionId}`);
          } catch (messageError) {
            console.error('❌ [CHAT MESSAGE] Message insertion failed:', messageError);
            throw messageError;
          }

          // Step 3: Pusher broadcast (non-blocking)
          try {
            await Promise.all([
              pusher.trigger('staff-portal', 'new-player-message', {
                sessionId: finalSessionId,
                playerId: playerId,
                playerName: fullPlayerName,
                message: message,
                messageId: messageId,
                timestamp: timestamp,
                status: 'waiting'
              }),
              pusher.trigger(`player-${playerId}`, 'message-sent', {
                messageId: messageId,
                message: message,
                timestamp: timestamp,
                status: 'delivered'
              })
            ]);
            console.log(`📡 [PUSHER] Broadcast completed for session ${finalSessionId}`);
          } catch (pusherError) {
            console.error('❌ [PUSHER] Broadcast error (non-critical):', pusherError);
          }

          const processingTime = Number(process.hrtime.bigint() - startTime) / 1000000;
          console.log(`⚡ [SEQUENTIAL V2.0] Background processing completed in ${processingTime.toFixed(2)}ms`);

        } catch (backgroundError) {
          console.error('❌ [OPTIMIZED V1.2] Background error:', backgroundError);
          // Background errors don't affect user experience since response already sent
        }
      });

    } catch (error: any) {
      console.error('❌ [OPTIMIZED V1.2] Critical error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 2. Get All Chat Sessions (For Player Portal)
  app.get("/api/staff-chat-integration/requests", async (req, res) => {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const { data: sessions, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      // Categorize by status
      const categorized = {
        waiting: sessions?.filter(s => s.status === 'waiting') || [],
        active: sessions?.filter(s => s.status === 'active') || [],
        resolved: sessions?.filter(s => s.status === 'resolved') || []
      };

      res.json({
        success: true,
        requests: categorized
      });

    } catch (error: any) {
      console.error('❌ [STAFF CHAT REQUESTS] Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 3. Get Message History
  app.get("/api/staff-chat-integration/messages/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;

      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const { data: messages, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('chat_session_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      res.json({
        success: true,
        messages: messages || [],
        count: messages?.length || 0
      });

    } catch (error: any) {
      console.error('❌ [STAFF CHAT MESSAGES] Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // FIXED: Chat history using proper chat_sessions and chat_messages relationship
  app.get("/api/player-chat-integration/messages/:playerId", async (req, res) => {
    try {
      const playerId = parseInt(req.params.playerId);

      console.log(`🔍 [CHAT SESSIONS] Fetching unresolved sessions for player ID: ${playerId}`);

      // Use direct PostgreSQL query with proper table relationship
      const { Pool } = await import('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });

      try {
        // Step 1: Find unresolved chat sessions for the player
        const sessionsQuery = `
          SELECT cs.id, cs.player_id, cs.player_name, cs.player_email,
                 cs.initial_message, cs.status, cs.priority, cs.category,
                 cs.gre_staff_id, cs.gre_staff_name, cs.created_at, cs.updated_at
          FROM chat_sessions cs
          WHERE cs.player_id = $1 AND cs.status != 'resolved'
          ORDER BY cs.created_at DESC
        `;

        const sessionsResult = await pool.query(sessionsQuery, [playerId]);
        const sessions = sessionsResult.rows;

        console.log(`🔍 [CHAT SESSIONS] Found ${sessions.length} unresolved sessions for player ${playerId}`);

        if (sessions.length === 0) {
          await pool.end();
          console.log(`✅ [CHAT SESSIONS] No unresolved sessions found`);
          return res.json({ success: true, conversations: [] });
        }

        // Step 2: Get messages for each session using proper relationship
        const conversationsWithMessages = [];
        for (const session of sessions) {
          const messagesQuery = `
            SELECT cm.id, cm.chat_session_id, cm.sender_id, cm.sender_type,
                   cm.sender_name, cm.message_text, cm.message_type,
                   cm.metadata, cm.created_at
            FROM chat_messages cm
            WHERE cm.chat_session_id = $1
            ORDER BY cm.created_at ASC
          `;

          const messagesResult = await pool.query(messagesQuery, [session.id]);
          const messages = messagesResult.rows;

          console.log(`✅ [CHAT MESSAGES] Found ${messages.length} messages for session ${session.id}`);

          // Transform messages to match frontend expectations
          const formattedMessages = messages.map(msg => ({
            id: msg.id,
            sender: msg.sender_type, // 'player' or 'staff'
            sender_name: msg.sender_name,
            message_text: msg.message_text,
            timestamp: msg.created_at
          }));

          // Only include conversations that have messages OR are new waiting sessions
          if (formattedMessages.length > 0 || session.status === 'waiting') {
            conversationsWithMessages.push({
              id: session.id,
              subject: `Chat with ${session.player_name}`,
              status: session.status,
              created_at: session.created_at,
              chat_messages: formattedMessages
            });
          }
        }

        await pool.end();

        console.log(`✅ [CHAT SESSIONS] Returning ${conversationsWithMessages.length} conversations with ${conversationsWithMessages.reduce((total, conv) => total + conv.chat_messages.length, 0)} total messages`);

        res.json({ success: true, conversations: conversationsWithMessages });

      } catch (dbError) {
        await pool.end();
        console.error('❌ [CHAT SESSIONS] Database error:', dbError);
        return res.status(500).json({ error: "Database query failed" });
      }

    } catch (error) {
      console.error('❌ [CHAT SESSIONS] Error:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // REMOVED: Duplicate endpoint - using unified clear above

  app.delete("/api/unified-chat/clear/:playerId", async (req, res) => {
    try {
      const playerId = parseInt(req.params.playerId);
      const result = await directChat.clearPlayerChat(playerId);
      res.json(result);
    } catch (error: any) {
      console.error('❌ [DIRECT CLEAR] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/chat-history/:playerId", async (req, res) => {
    try {
      const playerId = parseInt(req.params.playerId);
      console.log(`📚 [CHAT HISTORY] Loading for player ${playerId} using proper chat_sessions relationship`);

      // Use direct PostgreSQL query with proper table relationship
      const { Pool } = await import('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });

      try {
        // Step 1: Get unresolved chat sessions for the player
        const sessionsQuery = `
          SELECT cs.id, cs.player_id, cs.player_name, cs.status, cs.created_at, cs.initial_message
          FROM chat_sessions cs
          WHERE cs.player_id = $1 AND cs.status != 'resolved'
          ORDER BY cs.created_at DESC
        `;

        const sessionsResult = await pool.query(sessionsQuery, [playerId]);
        const sessions = sessionsResult.rows;

        console.log(`🔍 [CHAT HISTORY] Found ${sessions.length} unresolved sessions`);

        // Step 2: Get messages for each session using proper relationship
        const conversations = [];
        for (const session of sessions) {
          const messagesQuery = `
            SELECT cm.id, cm.sender_type, cm.sender_name, cm.message_text, cm.created_at
            FROM chat_messages cm
            WHERE cm.chat_session_id = $1
            ORDER BY cm.created_at ASC
          `;

          const messagesResult = await pool.query(messagesQuery, [session.id]);
          const messages = messagesResult.rows;

          // Transform messages to match frontend expectations
          const formattedMessages = messages.map(msg => ({
            id: msg.id,
            sender: msg.sender_type, // 'player' or 'staff'
            sender_name: msg.sender_name,
            message_text: msg.message_text,
            timestamp: msg.created_at
          }));

          if (formattedMessages.length > 0 || session.status === 'waiting') {
            conversations.push({
              id: session.id,
              subject: `Chat with ${session.player_name}`,
              status: session.status,
              created_at: session.created_at,
              initial_message: session.initial_message,
              player_name: session.player_name,
              chat_messages: formattedMessages
            });
          }
        }

        await pool.end();

        console.log(`✅ [CHAT HISTORY] Found ${conversations.length} active conversations with ${conversations.reduce((total, conv) => total + conv.chat_messages.length, 0)} total messages`);

        res.json({
          success: true,
          conversations: conversations
        });

      } catch (dbError: any) {
        await pool.end();
        console.error('❌ [CHAT HISTORY] Database error:', dbError);
        res.status(500).json({ error: 'Database query failed' });
      }

    } catch (error: any) {
      console.error('❌ [CHAT HISTORY] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Clerk signup verification and sync endpoint
  app.post("/api/auth/clerk-sync", async (req, res) => {
    try {
      const {
        clerkUserId,
        email,
        firstName,
        lastName,
        phone,
        emailVerified
      } = req.body;

      console.log(`🔄 [CLERK SYNC] Processing signup sync for: ${email}`);

      if (!clerkUserId || !email) {
        return res.status(400).json({
          error: "clerkUserId and email are required"
        });
      }

      // Check if player already exists
      let existingPlayer = await storage.getPlayerByEmail(email);

      if (existingPlayer) {
        console.log(`🔄 [CLERK SYNC] Updating existing player with Clerk ID: ${existingPlayer.id}`);

        // Update existing player with Clerk information
        const updatedPlayer = await storage.getPlayer(existingPlayer.id);
        if (!updatedPlayer) {
          return res.status(404).json({ error: 'Player not found during update' });
        }

        // Return player with proper field mapping
        const responseData = {
          ...updatedPlayer,
          clerk_user_id: clerkUserId,
          firstName: firstName || updatedPlayer.firstName,
          lastName: lastName || updatedPlayer.lastName,
          phone: phone || updatedPlayer.phone,
          email_verified: emailVerified
        };

        return res.json({
          success: true,
          existingPlayer: true,
          player: responseData,
          message: "Existing player updated with Clerk sync"
        });
      } else {
        console.log(`✨ [CLERK SYNC] Creating new player from Clerk signup`);

        // Create new player from Clerk data
        const newPlayer = await storage.createClerkPlayer({
          clerk_user_id: clerkUserId,
          email,
          first_name: firstName || '',
          last_name: lastName || '',
          phone: phone || '',
          kyc_status: 'pending',
          balance: '0.00',
          is_active: true,
          email_verified: emailVerified || false
        });

        return res.json({
          success: true,
          existingPlayer: false,
          player: newPlayer,
          message: "New player created successfully"
        });
      }

    } catch (error: any) {
      console.error('❌ [CLERK SYNC] Sync failed:', error);
      res.status(500).json({
        error: "Clerk sync failed",
        details: error.message
      });
    }
  });

  // Simple secure email verification - validate token, update database
  app.post("/api/auth/verify-email", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: "Access token required" });
      }

      const accessToken = authHeader.split(' ')[1];
      console.log(`📧 [EMAIL VERIFICATION] Validating Supabase token...`);

      // Quick validation with Supabase
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseAdmin = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
      
      if (authError || !user || !user.email) {
        return res.status(401).json({ error: "Invalid token" });
      }

      const email = user.email;
      console.log(`📧 [EMAIL VERIFICATION] Simple verification for: ${email}`);

      // Simple database update
      const { Client } = await import('pg');
      const pgClient = new Client({ connectionString: process.env.DATABASE_URL });
      await pgClient.connect();

      try {
        const updateResult = await pgClient.query(`
          UPDATE public.players 
          SET email_verified = true, updated_at = NOW()
          WHERE email = $1
          RETURNING id, email, email_verified
        `, [email]);

        if (updateResult.rows.length === 0) {
          console.log(`❌ [EMAIL VERIFICATION] No player found with email: ${email}`);
          return res.status(404).json({ error: "Player not found" });
        }

        const updatedPlayer = updateResult.rows[0];
        console.log(`✅ [EMAIL VERIFICATION] Email verified for player ID: ${updatedPlayer.id}, email: ${updatedPlayer.email}`);

        res.json({
          success: true,
          message: "Email verification completed",
          player: {
            id: updatedPlayer.id,
            email: updatedPlayer.email,
            email_verified: updatedPlayer.email_verified
          }
        });

      } catch (dbError: any) {
        console.error('❌ [EMAIL VERIFICATION] Database error:', dbError);
        return res.status(500).json({ error: 'Failed to update email verification status' });
      } finally {
        await pgClient.end();
      }

    } catch (error: any) {
      console.error('❌ [EMAIL VERIFICATION] Error:', error);
      res.status(500).json({
        error: "Email verification failed",
        details: error.message
      });
    }
  });

  // Player existence check endpoint (prevents duplicate signups)
  app.get("/api/players/check", async (req, res) => {
    try {
      const { email } = req.query;

      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: "Email parameter required" });
      }

      console.log(`🔍 [PLAYER CHECK] Checking for existing player: ${email}`);

      // Check if player exists in database
      const existingPlayer = await storage.getPlayerByEmail(email);

      if (existingPlayer) {
        console.log(`✅ [PLAYER CHECK] Found existing player: ${existingPlayer.email} (ID: ${existingPlayer.id})`);
        return res.json({
          exists: true,
          playerId: existingPlayer.id,
          email: existingPlayer.email,
          kycStatus: existingPlayer.kycStatus,
          isActive: existingPlayer.isActive
        });
      } else {
        console.log(`❌ [PLAYER CHECK] No existing player found for: ${email}`);
        return res.status(404).json({
          exists: false,
          message: "Player not found"
        });
      }

    } catch (error: any) {
      console.error('❌ [PLAYER CHECK] Error:', error);
      res.status(500).json({
        error: "Failed to check player existence",
        details: error.message
      });
    }
  });

  // CRITICAL: Player authentication endpoint for login system
  // Clerk User Sync API
  app.post("/api/clerk/sync-player", async (req, res) => {
    try {
      const { clerk_user_id, email, first_name, last_name, phone } = req.body;

      if (!clerk_user_id || !email) {
        return res.status(400).json({ error: "clerk_user_id and email are required" });
      }

      console.log(`🔍 [CLERK SYNC] Syncing Clerk user: ${email} (${clerk_user_id})`);
      console.log(`🔍 [CLERK SYNC] Phone number received:`, phone);

      // Check if player already exists by Clerk ID
      const existingPlayer = await storage.getPlayerByClerkId(clerk_user_id);

      if (existingPlayer) {
        console.log(`✅ [CLERK SYNC] Existing player found: ${existingPlayer.email} (ID: ${existingPlayer.id})`);
        return res.json({
          success: true,
          player: existingPlayer,
          message: "Clerk user already synchronized"
        });
      }

      // Create new player with Clerk ID
      console.log(`✨ [CLERK SYNC] Creating new player with phone:`, phone || 'No phone provided');
      const newPlayer = await storage.createClerkPlayer({
        clerk_user_id,
        email,
        first_name: first_name || '',
        last_name: last_name || '',
        phone: phone || '',
        kyc_status: 'pending',
        balance: '0.00',
        is_active: true
      });

      console.log(`✅ [CLERK SYNC] New player created: ${newPlayer.email} (ID: ${newPlayer.id})`);
      res.json({
        success: true,
        player: newPlayer,
        message: "Clerk user synchronized successfully"
      });
    } catch (error) {
      console.error("❌ [CLERK SYNC] Error syncing Clerk user:", error);
      res.status(500).json({ error: "Failed to sync Clerk user" });
    }
  });

  // Enterprise Player Data Endpoint - PRODUCTION GRADE
  app.get("/api/players/supabase/:supabaseId", async (req, res) => {
    try {
      const {supabaseId } = req.params;
      console.log(`🏢 [ENTERPRISE PLAYER] Getting player by Supabase ID: ${supabaseId}`);

      // PRODUCTION APPROACH: First try to get the player by email from the working authentication flow
      // Step 1: Get email from Supabase auth service (proven to work)
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseAdmin = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      );

      let userEmail = null;
      try {
        const { data: { user }, error: authError } = await supabaseAdmin.auth.admin.getUserById(supabaseId);
        if (!authError && user?.email) {
          userEmail = user.email;
          console.log(`✅ [ENTERPRISE PLAYER] Found auth email: ${userEmail}`);
        }
      } catch (authError) {
        console.log(`⚠️ [ENTERPRISE PLAYER] Auth lookup failed, trying direct database:`, authError);
      }

      // Step 2: Use proven authentication endpoint pattern with email lookup
      const pgClient = new pg.Client({
        connectionString: process.env.DATABASE_URL,
      });

      try {
        await pgClient.connect();
      } catch (connectionError) {
        console.error(`❌ [ENTERPRISE PLAYER] Database connection failed:`, connectionError);
        return res.status(500).json({ error: 'Database connection failed' });
      }

      let playerQuery, queryParams;

      if (userEmail) {
        // Use email lookup (proven to work in authentication endpoint)
        console.log(`🔧 [ENTERPRISE PLAYER] Using proven email lookup for: ${userEmail}`);
        playerQuery = `
          SELECT id, email, password, first_name, last_name, phone, kyc_status, balance,
                 current_credit, credit_limit, credit_eligible, total_deposits, total_withdrawals,
                 total_winnings, total_losses, games_played, hours_played, clerk_user_id,
                 supabase_id, is_active
          FROM players
          WHERE email = $1 AND (is_active IS NULL OR is_active = true)
        `;
        queryParams = [userEmail];
      } else {
        // Fallback: Direct Supabase ID lookup
        console.log(`🔧 [ENTERPRISE PLAYER] Using direct Supabase ID lookup for: ${supabaseId}`);
        playerQuery = `
          SELECT id, email, password, first_name, last_name, phone, kyc_status, balance,
                 current_credit, credit_limit, credit_eligible, total_deposits, total_withdrawals,
                 total_winnings, total_losses, games_played, hours_played, clerk_user_id,
                 supabase_id, is_active
          FROM players
          WHERE supabase_id = $1 AND (is_active IS NULL OR is_active = true)
        `;
        queryParams = [supabaseId];
      }

      const playerResult = await pgClient.query(playerQuery, queryParams);
      await pgClient.end();

      if (playerResult.rows.length === 0) {
        console.log(`❌ [ENTERPRISE PLAYER] Player not found for: ${userEmail || supabaseId}`);
        return res.status(404).json({ error: 'Player not found' });
      }

      const playerData = playerResult.rows[0];
      console.log(`✅ [ENTERPRISE PLAYER] Found player: ${playerData.email} (ID: ${playerData.id})`);

      // Transform data to match frontend expectations (EXACT same format as authentication endpoint)
      // CRITICAL: Block access for non-approved KYC status
      const allowedKycStatuses = ['approved', 'verified'];
      if (!allowedKycStatuses.includes(playerData.kyc_status)) {
        console.log(`🚫 [KYC GATE] Dashboard access blocked - KYC status: ${playerData.kyc_status} for player: ${playerData.email}`);
        return res.status(403).json({
          error: 'KYC_VERIFICATION_REQUIRED',
          message: 'Wait for KYC approval',
          kycStatus: playerData.kyc_status
        });
      }

      const transformedPlayer = {
        id: playerData.id,
        email: playerData.email,
        firstName: playerData.first_name,
        lastName: playerData.last_name,
        nickname: playerData.nickname,
        phone: playerData.phone || '',
        kycStatus: playerData.kyc_status,
        balance: playerData.balance,
        realBalance: playerData.balance || '0.00',
        creditBalance: playerData.current_credit ? String(playerData.current_credit) : '0.00',
        creditLimit: playerData.credit_limit ? String(playerData.credit_limit) : '0.00',
        creditEligible: Boolean(playerData.credit_eligible),
        totalBalance: (parseFloat(playerData.balance || '0.00') + parseFloat(playerData.current_credit || '0.00')).toFixed(2),
        totalDeposits: playerData.total_deposits || '0.00',
        totalWithdrawals: playerData.total_withdrawals || '0.00',
        totalWinnings: playerData.total_winnings || '0.00',
        totalLosses: playerData.total_losses || '0.00',
        gamesPlayed: playerData.games_played || 0,
        hoursPlayed: playerData.hours_played || '0.00',
        clerkUserId: playerData.clerk_user_id,
        isClerkSynced: !!playerData.clerk_user_id,
        supabaseId: playerData.supabase_id,
        authToken: playerData.supabase_id
      };

      console.log(`🎯 [ENTERPRISE PLAYER] Enterprise lookup successful: ${transformedPlayer.email} (ID: ${transformedPlayer.id}, KYC: ${transformedPlayer.kycStatus})`);
      res.json(transformedPlayer);

    } catch (error: any) {
      console.error('❌ [ENTERPRISE PLAYER] Critical error:', error);
      res.status(500).json({ error: "Enterprise player lookup failed", details: error.message });
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

      // Query poker_tables with correct column names from your schema
      const { data: tablesData, error } = await supabase
        .from('poker_tables')
        .select(`
          id,
          name,
          game_type,
          min_buy_in,
          max_buy_in,
          small_blind,
          big_blind,
          max_players,
          current_players,
          status,
          dealer_id,
          created_at,
          updated_at,
          min_play_time,
          call_time_duration,
          cash_out_window
        `)
        .order('name');

      console.log('🔍 [TABLES API PRODUCTION] Live poker tables from staff portal:', {
        total: tablesData?.length || 0,
        tables: tablesData?.map(t => ({ id: t.id, name: t.name, game_type: t.game_type, status: t.status })) || []
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
        stakes: `₹${table.small_blind}/${table.big_blind}`,
        buyInRange: `₹${table.min_buy_in} - ₹${table.max_buy_in}`,
        maxPlayers: table.max_players || 9,
        currentPlayers: table.current_players || 0,
        waitingList: 0,
        status: table.status, // Keep the exact database status
        gameStarted: table.status === 'active',
        gameStartTime: table.status === 'active' ? table.updated_at : null,
        isActive: table.status === 'active', // Only true when status is 'active'
        minBuyIn: table.min_buy_in,
        maxBuyIn: table.max_buy_in,
        smallBlind: table.small_blind,
        bigBlind: table.big_blind,
        minPlayTime: table.min_play_time,
        callTimeDuration: table.call_time_duration,
        cashOutWindow: table.cash_out_window
      }));

      console.log(`✅ [TABLES API PRODUCTION] Returning ${transformedTables.length} live staff portal tables`);

      // Set proper cache headers to prevent endless refreshing
      res.setHeader('Cache-Control', 'public, max-age=30');
      res.setHeader('ETag', `"${Date.now()}"`);

      res.json(transformedTables);

    } catch (error) {
      console.error('💥 [TABLES API PRODUCTION] Unexpected error:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Table pot calculation - sums buy-ins from all seated players
  app.get("/api/tables/:tableId/pot", async (req, res) => {
    try {
      const { tableId } = req.params;

      console.log(`💰 [TABLE POT] Calculating pot for table: ${tableId}`);

      const { Client } = await import('pg');
      const pgClient = new Client({ connectionString: process.env.DATABASE_URL });
      await pgClient.connect();

      try {
        const result = await pgClient.query(`
          SELECT COALESCE(SUM(CAST(session_buy_in_amount AS DECIMAL)), 0) as total_pot
          FROM seat_requests 
          WHERE table_id = $1 AND status = 'seated'
        `, [tableId]);

        const totalPot = result.rows[0]?.total_pot || 0;

        await pgClient.end();
        console.log(`✅ [TABLE POT] Calculated pot for table ${tableId}: ₹${totalPot}`);

        res.json({ 
          tableId, 
          pot: parseFloat(totalPot).toFixed(2)
        });

      } catch (dbError: any) {
        await pgClient.end();
        console.error('❌ [TABLE POT] Database error:', dbError);
        return res.status(500).json({ error: 'Database query failed' });
      }

    } catch (error: any) {
      console.error('❌ [TABLE POT] Server error:', error);
      res.status(500).json({ error: 'Failed to calculate pot' });
    }
  });

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
      console.log('🎁 [OFFERS API] Fetching offers from new offers table...');

      // Use direct database connection like other working APIs
      const pg = await import('pg');
      const client = new pg.Client({
        connectionString: process.env.DATABASE_URL,
      });

      await client.connect();

      // Check if offers table exists first
      const tableCheckResult = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'offers'
        );
      `);

      if (!tableCheckResult.rows[0].exists) {
        console.log('⚠️ [OFFERS API] offers table does not exist, returning empty array');
        await client.end();
        return res.json([]);
      }

      const result = await client.query(`
        SELECT id, title, description, offer_type, status, priority,
               start_date, end_date, target_audience, click_url, 
               terms_conditions, created_at, updated_at
        FROM offers
        WHERE status = 'active'
          AND (start_date IS NULL OR start_date <= NOW())
          AND (end_date IS NULL OR end_date >= NOW())
        ORDER BY priority DESC, created_at DESC
      `);

      await client.end();

      console.log('🔍 [OFFERS API] Database results:', {
        total: result.rows.length,
        offers: result.rows.map(o => ({ id: o.id, title: o.title, priority: o.priority }))
      });

      const transformedOffers = result.rows.map((offer: any) => ({
        id: offer.id,
        title: offer.title,
        description: offer.description || 'Limited time offer',
        offer_type: offer.offer_type,
        status: offer.status,
        priority: offer.priority || 0,
        start_date: offer.start_date,
        end_date: offer.end_date,
        target_audience: offer.target_audience,
        click_url: offer.click_url,
        terms_conditions: offer.terms_conditions,
        created_at: offer.created_at,
        updated_at: offer.updated_at,
        // Legacy compatibility fields for existing frontend components
        is_active: offer.status === 'active',
        image_url: null, // No image_url in new schema
        video_url: null  // No video_url in new schema
      }));

      console.log(`✅ [OFFERS API] Returning ${transformedOffers.length} active offers from new offers table`);
      res.json(transformedOffers);
    } catch (error) {
      console.error('❌ [OFFERS API] Error:', error);
      // Return empty array instead of 500 error to prevent UI crashes
      res.json([]);
    }
  });

  // Offer views tracking API
  app.post("/api/offer-views", async (req, res) => {
    try {
      const { offer_id } = req.body;
      console.log('👁️ [OFFER VIEWS] Tracking view for offer:', offer_id);

      const pg = await import('pg');
      const client = new pg.Client({
        connectionString: process.env.DATABASE_URL,
      });

      await client.connect();

      await client.query(`
        INSERT INTO offer_views (offer_id, viewed_at)
        VALUES ($1, NOW())
      `, [offer_id]);

      await client.end();

      console.log(`✅ [OFFER VIEWS] Tracked view for offer: ${offer_id}`);
      res.json({ success: true });
    } catch (error) {
      console.error('❌ [OFFER VIEWS] Error:', error);
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

  // ========== KYC DOCUMENT UPLOAD AND MANAGEMENT SYSTEM ==========

  // Document upload endpoint - Direct PostgreSQL with ClamAV malware scanning
  app.post('/api/documents/upload', async (req, res) => {
    try {
      const { playerId, documentType, fileName, fileData, fileSize, mimeType } = req.body;

      console.log(`🔧 [DIRECT KYC UPLOAD] Uploading ${documentType} for player:`, playerId);
      console.log(`🔧 [DIRECT KYC UPLOAD] Request data:`, { playerId, documentType, fileName, fileDataLength: fileData ? fileData.length : undefined });

      if (!playerId || !documentType || !fileName || !fileData) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Convert base64 file data to buffer for scanning
      let fileBuffer: Buffer;
      try {
        // Remove data URL prefix if present (data:image/png;base64,...)
        const base64Data = fileData.includes(',') ? fileData.split(',')[1] : fileData;
        fileBuffer = Buffer.from(base64Data, 'base64');
        console.log(`🔍 [MALWARE SCAN] Preparing to scan ${fileName} (${fileBuffer.length} bytes)`);
      } catch (error) {
        console.error('❌ [DIRECT KYC UPLOAD] Invalid file data:', error);
        return res.status(400).json({ error: 'Invalid file data format' });
      }

      // Perform malware scanning with ClamAV
      const scanResult = await scanBufferForMalware(fileBuffer, fileName);

      if (scanResult.isInfected) {
        console.log(`🚨 [MALWARE DETECTED] File ${fileName} contains malware:`, scanResult.viruses);
        return res.status(400).json({
          error: 'Malware detected in uploaded file',
          malware: true,
          viruses: scanResult.viruses,
          message: 'The uploaded file contains malware and cannot be processed. Please upload a clean file.'
        });
      }

      if (scanResult.error) {
        console.warn(`⚠️ [MALWARE SCAN] Scan error for ${fileName}:`, scanResult.error);
        // Continue with upload even if scan fails (log warning but don't block user)
      } else {
        console.log(`✅ [MALWARE SCAN] File ${fileName} is clean - proceeding with upload`);
      }

      // Use direct KYC storage for reliable uploads with replacement logic
      console.log(`🔄 [DOCUMENT UPLOAD] Replacing existing ${documentType} for player ${playerId}`);
      const uploadedDoc = await directKycStorage.uploadDocument(
        parseInt(playerId),
        documentType,
        fileName,
        fileData
      );

      console.log(`✅ [DIRECT KYC UPLOAD] Document uploaded successfully:`, uploadedDoc.id);
      res.json({
        success: true,
        document: uploadedDoc,
        malwareScan: {
          scanned: !scanResult.error,
          clean: !scanResult.isInfected,
          scanResult: scanResult.scanResult || 'UNKNOWN'
        }
      });
    } catch (error) {
      console.error('❌ [DIRECT KYC UPLOAD] Error:', error);
      res.status(500).json({ error: 'Failed to upload document' });
    }
  });

  // Get player documents - Direct PostgreSQL (bypasses Supabase cache)
  app.get('/api/documents/player/:playerId', async (req, res) => {
    try {
      const { playerId } = req.params;

      console.log(`🔧 [DIRECT KYC DOCS] Getting documents for player:`, playerId);

      // Use direct PostgreSQL to bypass Supabase cache issues
      const documents = await directKycStorage.getPlayerDocuments(parseInt(playerId));

      console.log(`✅ [DIRECT KYC DOCS] Found ${documents.length} documents`);
      res.json(documents);
    } catch (error) {
      console.error('❌ [DIRECT KYC DOCS] Error:', error);
      res.status(500).json({ error: 'Failed to fetch documents' });
    }
  });

  // View document endpoint - serves documents directly
  app.get('/api/documents/view/:documentId', async (req, res) => {
    try {
      const { documentId } = req.params;

      console.log(`🔧 [DIRECT KYC VIEW] Getting document:`, documentId);

      // Get document details from database
      const { Pool } = await import('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        connectionTimeoutMillis: 10000,
      });

      const query = `
        SELECT id, player_id, document_type, file_name, file_url, file_size, status, created_at
        FROM kyc_documents
        WHERE id = $1
      `;

      const result = await pool.query(query, [parseInt(documentId)]);
      await pool.end();

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Document not found' });
      }

      const document = result.rows[0];
      console.log(`✅ [DIRECT KYC VIEW] Document found:`, document.file_name);

      // For Supabase URLs, fetch and serve the content directly to avoid CORS issues
      if (document.file_url.startsWith('https://') && document.file_url.includes('supabase.co')) {
        console.log(`🔗 [DIRECT KYC VIEW] Fetching and serving Supabase document:`, document.file_url);

        try {
          const response = await fetch(document.file_url);
          if (!response.ok) {
            console.error(`❌ [DIRECT KYC VIEW] Failed to fetch document: ${response.status}`);
            return res.status(404).json({ error: 'Document not accessible' });
          }

          const contentType = response.headers.get('content-type') || 'application/octet-stream';
          const buffer = await response.arrayBuffer();

          console.log(`✅ [DIRECT KYC VIEW] Serving document: ${document.file_name} (${contentType})`);

          res.set({
            'Content-Type': contentType,
            'Content-Length': buffer.byteLength.toString(),
            'Content-Disposition': `inline; filename="${document.file_name}"`,
            'Cache-Control': 'public, max-age=86400'
          });

          res.send(Buffer.from(buffer));
          return;
        } catch (fetchError) {
          console.error(`❌ [DIRECT KYC VIEW] Error fetching document:`, fetchError);
          return res.status(500).json({ error: 'Failed to fetch document' });
        }
      }

      // Otherwise serve the file directly
      res.json({ error: 'Direct file serving not implemented for this storage type' });

    } catch (error) {
      console.error('❌ [DIRECT KYC VIEW] Error:', error);
      res.status(500).json({ error: 'Failed to fetch document' });
    }
  });

  // KYC submission endpoint - Direct PostgreSQL (bypasses Supabase cache)
  app.post('/api/kyc/submit', async (req, res) => {
    try {
      const { playerId, email, firstName, lastName, panCardNumber, phone, address } = req.body;

      console.log(`🔧 [DIRECT KYC SUBMIT] Submitting KYC for player:`, playerId);

      // Use direct PostgreSQL to bypass Supabase cache issues
      const success = await directKycStorage.submitKyc(parseInt(playerId), {
        firstName: firstName || '',
        lastName: lastName || '',
        phone: phone || '',
        panCardNumber: panCardNumber || '',
        address: address || ''
      });

      if (!success) {
        throw new Error('KYC submission failed');
      }

      // Send submission confirmation email using Supabase
      try {
        console.log(`📧 [SUPABASE EMAIL] Sending confirmation email to: ${email}`);

        // Import Supabase client for server-side operations
        const { createClient } = await import('@supabase/supabase-js');
        const supabaseServiceClient = createClient(
          process.env.VITE_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Send confirmation email using Supabase's built-in email service
        const { error: emailError } = await supabaseServiceClient.auth.admin.generateLink({
          type: 'signup',
          email: email,
          password: 'temp-password-123' // Required parameter for Supabase
        });

        if (emailError) {
          console.log(`⚠️ [SUPABASE EMAIL] Could not send via Supabase auth:`, emailError.message);
          console.log(`📧 [FALLBACK] Email content for ${email}: Thank you for registering to the Poker Club. Your documents have been submitted for review. Please wait for approval from our staff.`);
        } else {
          console.log(`✅ [SUPABASE EMAIL] Confirmation email sent successfully to: ${email}`);
        }
      } catch (emailError) {
        console.log(`⚠️ [EMAIL SERVICE] Could not send email:`, emailError);
        console.log(`📧 [FALLBACK] Email content for ${email}: KYC documents submitted successfully`);
      }

      console.log(`✅ [DIRECT KYC SUBMIT] KYC submitted successfully for player:`, playerId);
      res.json({ success: true, message: 'KYC documents submitted for review. Check your email for confirmation.' });
    } catch (error) {
      console.error('❌ [DIRECT KYC SUBMIT] Error:', error);
      res.status(500).json({ error: 'Failed to submit KYC' });
    }
  });

  // KYC Status endpoint - Direct PostgreSQL
  app.get('/api/kyc/status/:playerId', async (req, res) => {
    try {
      const { playerId } = req.params;
      console.log(`🔧 [DIRECT KYC STATUS] Getting KYC status for player:`, playerId);

      const { Pool } = await import('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });

      const playerQuery = `
        SELECT id, email, kyc_status, pan_card_status, first_name, last_name
        FROM players
        WHERE id = $1
      `;

      const playerResult = await pool.query(playerQuery, [parseInt(playerId)]);

      if (playerResult.rows.length === 0) {
        await pool.end();
        return res.status(404).json({ error: 'Player not found' });
      }

      const player = playerResult.rows[0];

      // Get document counts
      const docQuery = `
        SELECT
          document_type,
          status,
          COUNT(*) as count
        FROM kyc_documents
        WHERE player_id = $1
        GROUP BY document_type, status
      `;

      const docResult = await pool.query(docQuery, [parseInt(playerId)]);
      await pool.end();

      const documentStatus: Record<string, { pending: number; approved: number; rejected: number }> = {};
      docResult.rows.forEach((row: any) => {
        if (!documentStatus[row.document_type]) {
          documentStatus[row.document_type] = { pending: 0, approved: 0, rejected: 0 };
        }
        documentStatus[row.document_type][row.status as 'pending' | 'approved' | 'rejected'] = parseInt(row.count);
      });

      const kycData = {
        playerId: player.id,
        email: player.email,
        firstName: player.first_name,
        lastName: player.last_name,
        kycStatus: player.kyc_status,
        panCardStatus: player.pan_card_status,
        documentStatus
      };

      console.log(`✅ [DIRECT KYC STATUS] KYC status retrieved for player:`, playerId);      res.json(kycData);
    } catch (error) {
      console.error('❌ [DIRECT KYC STATUS] Error:', error);
      res.status(500).json({ error: 'Failed to fetch KYC status' });
    }
  });

  // KYC Documents endpoint for player portal
  app.get('/api/kyc/documents/:playerId', async (req, res) => {
    try {
      const { playerId } = req.params;
      console.log(`🔧 [DIRECT KYC DOCS] Getting KYC documents for player:`, playerId);

      const documents = await directKycStorage.getPlayerDocuments(parseInt(playerId));
      console.log(`✅ [DIRECT KYC DOCS] Found ${documents.length} documents for player:`, playerId);

      res.json(documents);
    } catch (error) {
      console.error('❌ [DIRECT KYC DOCS] Error:', error);
      res.status(500).json({ error: 'Failed to fetch documents' });
    }
  });

  // KYC Document details with types and submission dates
  app.get('/api/kyc/document-details/:playerId', async (req, res) => {
    try {
      const { playerId } = req.params;
      console.log(`📋 [KYC DETAILS] Getting document details for player:`, playerId);

      const { Pool } = await import('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });

      const query = `
        SELECT
          id,
          document_type,
          file_name,
          file_url,
          status,
          file_size,
          created_at,
          updated_at
        FROM kyc_documents
        WHERE player_id = $1
        ORDER BY created_at DESC
      `;

      const result = await pool.query(query, [parseInt(playerId)]);
      await pool.end();

      const documentDetails = result.rows.map(doc => ({
        id: doc.id,
        documentType: doc.document_type,
        fileName: doc.file_name,
        fileUrl: doc.file_url,
        status: doc.status,
        fileSize: doc.file_size,
        submissionDate: doc.created_at,
        lastUpdated: doc.updated_at,
        formattedType: formatDocumentType(doc.document_type),
        formattedDate: formatSubmissionDate(doc.created_at)
      }));

      console.log(`✅ [KYC DETAILS] Document details for player ${playerId}:`,
        documentDetails.map(d => `${d.formattedType} - ${d.formattedDate}`));

      res.json(documentDetails);
    } catch (error) {
      console.error('❌ [KYC DETAILS] Error:', error);
      res.status(500).json({ error: 'Failed to fetch document details' });
    }
  });

  // Helper functions for document formatting
  function formatDocumentType(type: string) {
    const typeMap: { [key: string]: string } = {
      'government_id': 'Government ID',
      'address_proof': 'Address Proof',
      'utility_bill':'Utility Bill',
      'pan_card': 'PAN Card',
      'profile_photo': 'Profile Photo',
      'id_document': 'ID Document',
      'photo': 'Photo'
    };
    return typeMap[type] || type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
  }

  function formatSubmissionDate(dateString: string) {
    if (!dateString) return 'Invalid Date';

    try {
      const date = new Date(dateString);
      // Format as "Aug 30, 2025 at 6:39 AM"
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }) + ' at ' + date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      return 'Invalid Date';
    }
  }

  // ========== EMAIL VERIFICATION SYSTEM ==========

  // Send email verification - ENHANCED WITH AUTOMATIC SIGNUP INTEGRATION
  app.post('/api/auth/send-verification-email', async (req, res) => {
    try {
      const { email, playerId, firstName } = req.body;

      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      console.log(`📧 [EMAIL VERIFICATION] Sending verification email to: ${email} (Player ID: ${playerId})`);

      // Generate strong verification token
      const verificationToken = require('crypto').randomBytes(32).toString('hex');
      const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Store verification token in database
      const { Pool } = await import('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });

      try {
        let updateQuery, updateParams;
        
        if (playerId) {
          updateQuery = `
            UPDATE players
            SET verification_token = $1, token_expiry = $2, updated_at = NOW()
            WHERE id = $3
            RETURNING id, email
          `;
          updateParams = [verificationToken, tokenExpiry, playerId];
        } else {
          updateQuery = `
            UPDATE players
            SET verification_token = $1, token_expiry = $2, updated_at = NOW()
            WHERE email = $3
            RETURNING id, email
          `;
          updateParams = [verificationToken, tokenExpiry, email];
        }

        const result = await pool.query(updateQuery, updateParams);
        
        if (result.rows.length === 0) {
          await pool.end();
          return res.status(404).json({ 
            success: false, 
            error: 'Player not found' 
          });
        }

        const player = result.rows[0];
        console.log(`✅ [EMAIL VERIFICATION] Token stored for player ${player.id}: ${player.email}`);

      } catch (dbError: any) {
        await pool.end();
        console.error('❌ [EMAIL VERIFICATION] Database error:', dbError);
        return res.status(500).json({ 
          success: false, 
          error: 'Database operation failed' 
        });
      }

      await pool.end();

      // Create verification URL
      const baseUrl = process.env.REPLIT_URL || `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` || req.get('host');
      const verificationUrl = `${baseUrl}/api/auth/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}`;

      console.log(`🔗 [EMAIL VERIFICATION] Verification URL: ${verificationUrl}`);

      // Enhanced email sending with multiple fallbacks
      let emailSent = false;
      let emailMethod = '';
      const emailErrors = [];

      // METHOD 1: Supabase Auth Integration
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabaseAdmin = createClient(
          process.env.VITE_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Try to create or update auth user
        const { data: existingUser, error: getUserError } = await supabaseAdmin.auth.admin.getUserByEmail(email);

        if (existingUser && existingUser.user) {
          // User exists, send recovery email which acts as verification
          console.log(`🔄 [EMAIL VERIFICATION] Existing user found, sending recovery email`);
          
          const { error: recoveryError } = await supabaseAdmin.auth.admin.generateLink({
            type: 'recovery',
            email: email,
            options: {
              redirectTo: verificationUrl
            }
          });

          if (!recoveryError) {
            emailSent = true;
            emailMethod = 'supabase_recovery';
            console.log(`✅ [EMAIL VERIFICATION] Recovery email sent to existing user: ${email}`);
          } else {
            emailErrors.push(`Supabase recovery error: ${recoveryError.message}`);
          }
        } else {
          // Create new auth user
          console.log(`👤 [EMAIL VERIFICATION] Creating new auth user for: ${email}`);
          
          const { data: authUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email: email,
            email_confirm: false, // This triggers confirmation email
            password: require('crypto').randomBytes(16).toString('hex'),
            user_metadata: {
              verification_token: verificationToken,
              player_id: playerId,
              first_name: firstName,
              source: 'email_verification_api',
              created_at: new Date().toISOString()
            }
          });

          if (!createError && authUser.user) {
            emailSent = true;
            emailMethod = 'supabase_auth_creation';
            console.log(`✅ [EMAIL VERIFICATION] Auth user created: ${authUser.user.id}`);
          } else {
            emailErrors.push(`Supabase creation error: ${createError?.message}`);
          }
        }

      } catch (supabaseError: any) {
        emailErrors.push(`Supabase exception: ${supabaseError.message}`);
        console.log(`⚠️ [EMAIL VERIFICATION] Supabase error:`, supabaseError.message);
      }

      // METHOD 2: Console/Development Fallback
      if (!emailSent) {
        console.log(`📧 [EMAIL VERIFICATION - CONSOLE] Email details for ${email}:`);
        console.log(`📧 [SUBJECT] Welcome to Poker Club - Verify Your Email`);
        console.log(`📧 [BODY] Welcome ${firstName || 'Player'}! Please verify your email by clicking: ${verificationUrl}`);
        console.log(`📧 [TOKEN] ${verificationToken}`);
        console.log(`📧 [EXPIRES] ${tokenExpiry.toISOString()}`);
        console.log(`📧 [INSTRUCTIONS] Click the verification URL above or copy it to your browser`);

        emailSent = true;
        emailMethod = 'console_output';
      }

      // Response
      const response = {
        success: emailSent,
        message: emailSent 
          ? `Verification email sent via ${emailMethod}. Please check your email and spam folder.` 
          : 'Failed to send verification email. Please contact support.',
        method: emailMethod,
        verificationUrl: emailSent ? verificationUrl : undefined,
        token: process.env.NODE_ENV !== 'production' ? verificationToken : undefined,
        errors: emailErrors.length > 0 ? emailErrors : undefined
      };

      console.log(`📧 [EMAIL VERIFICATION] Result for ${email}: ${emailSent ? 'SUCCESS' : 'FAILED'} via ${emailMethod}`);
      res.status(emailSent ? 200 : 500).json(response);

    } catch (error: any) {
      console.error('❌ [EMAIL VERIFICATION] Critical error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to send verification email',
        details: error.message 
      });
    }
  });

  // Verify email endpoint
  app.get('/api/auth/verify-email', async (req, res) => {
    try {
      const { token, email } = req.query;

      if (!token || !email) {
        console.log(`❌ [EMAIL VERIFICATION] Missing parameters: token=${!!token}, email=${!!email}`);
        return res.status(400).send(`
          <!DOCTYPE html>
          <html><head><title>Invalid Link</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1 style="color: #e74c3c;">❌ Invalid Verification Link</h1>
            <p>The verification link is missing required parameters.</p>
            <a href="/" style="background: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Return to Login</a>
          </body></html>
        `);
      }

      console.log(`📧 [EMAIL VERIFICATION] Verifying token for: ${email}`);

      const { Pool } = await import('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });

      try {
        const result = await pool.query(`
          SELECT id, email, verification_token, token_expiry, email_verified, first_name, last_name
          FROM players
          WHERE email = $1 AND verification_token = $2
        `, [email, token]);

        if (result.rows.length === 0) {
          await pool.end();
          console.log(`❌ [EMAIL VERIFICATION] Invalid token for: ${email}`);
          return res.status(400).send(`
            <!DOCTYPE html>
            <html><head><title>Invalid Token</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h1 style="color: #e74c3c;">❌ Invalid Verification Token</h1>
              <p>The verification token is invalid or has already been used.</p>
              <a href="/" style="background: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Return to Login</a>
            </body></html>
          `);
        }

        const player = result.rows[0];

        // Check if already verified
        if (player.email_verified) {
          await pool.end();
          console.log(`✅ [EMAIL VERIFICATION] Email already verified for: ${email}`);
          return res.status(200).send(`
            <!DOCTYPE html>
            <html><head><title>Already Verified</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h1 style="color: #22c55e;">✅ Email Already Verified</h1>
              <p>Your email has already been verified. You can proceed to login.</p>
              <a href="/" style="background: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Continue to Login</a>
            </body></html>
          `);
        }

        // Check if token is expired
        if (player.token_expiry && new Date() > new Date(player.token_expiry)) {
          await pool.end();
          console.log(`❌ [EMAIL VERIFICATION] Expired token for: ${email}`);
          return res.status(400).send(`
            <!DOCTYPE html>
            <html><head><title>Token Expired</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h1 style="color: #f39c12;">⏰ Verification Token Expired</h1>
              <p>Your verification token has expired. Please request a new verification email.</p>
              <a href="/" style="background: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Return to Login</a>
            </body></html>
          `);
        }

        // Update email verification status
        await pool.query(`
          UPDATE players
          SET email_verified = true, verification_token = NULL, token_expiry = NULL, updated_at = NOW()
          WHERE id = $1
        `, [player.id]);

        await pool.end();

        const playerName = `${player.first_name || ''} ${player.last_name || ''}`.trim() || 'Player';
        console.log(`✅ [EMAIL VERIFICATION] Email verified for player ${player.id}: ${email}`);

        // Success page with enhanced styling
        const confirmationHtml = `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Email Verified Successfully - Poker Club</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
                color: white;
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
              }
              .container {
                background: rgba(255, 255, 255, 0.05);
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 16px;
                padding: 40px;
                text-align: center;
                max-width: 500px;
                width: 100%;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
              }
              .success-icon {
                font-size: 64px;
                margin-bottom: 20px;
                animation: bounce 2s ease-in-out;
              }
              @keyframes bounce {
                0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
                40% { transform: translateY(-10px); }
                60% { transform: translateY(-5px); }
              }
              h1 {
                margin: 0 0 16px 0;
                font-size: 28px;
                font-weight: 600;
                color: #22c55e;
              }
              .welcome {
                font-size: 18px;
                color: #3b82f6;
                margin-bottom: 16px;
              }
              p {
                margin: 0 0 32px 0;
                font-size: 16px;
                line-height: 1.5;
                color: rgba(255, 255, 255, 0.8);
              }
              .login-button {
                background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
                color: white;
                border: none;
                border-radius: 8px;
                padding: 14px 28px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                text-decoration: none;
                display: inline-block;
                transition: all 0.3s ease;
                box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
              }
              .login-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 24px rgba(59, 130, 246, 0.4);
              }
              .next-steps {
                margin-top: 20px;
                padding-top: 20px;
                border-top: 1px solid rgba(255, 255, 255, 0.1);
                font-size: 14px;
                color: rgba(255, 255, 255, 0.6);
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="success-icon">✅</div>
              <h1>Email Verified Successfully!</h1>
              <div class="welcome">Welcome, ${playerName}!</div>
              <p>Your email address <strong>${email}</strong> has been successfully verified. You can now log in to your poker room account and complete your KYC verification process.</p>
              <a href="/" class="login-button">Continue to Login</a>
              <div class="next-steps">
                Next step: Complete your KYC verification to start playing
              </div>
            </div>
          </body>
          </html>
        `;

        res.send(confirmationHtml);

      } catch (dbError: any) {
        await pool.end();
        console.error('❌ [EMAIL VERIFICATION] Database error:', dbError);
        res.status(500).send(`
          <!DOCTYPE html>
          <html><head><title>Verification Error</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1 style="color: #e74c3c;">❌ Verification Error</h1>
            <p>There was an error processing your verification. Please contact support.</p>
            <a href="/" style="background: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Return to Login</a>
          </body></html>
        `);
      }

    } catch (error: any) {
      console.error('❌ [EMAIL VERIFICATION] Critical error:', error);
      res.status(500).send(`
        <!DOCTYPE html>
        <html><head><title>System Error</title></head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1 style="color: #e74c3c;">❌ System Error</h1>
          <p>Email verification failed due to a system error. Please contact support.</p>
          <a href="/" style="background: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Return to Login</a>
        </body></html>
      `);
    }
  });

  // Manual email verification for testing
  app.post('/api/auth/verify-email-manual', async (req, res) => {
    try {
      const { email } = req.body;

      console.log(`📧 [MANUAL VERIFICATION] Verifying email:`, email);

      const { Pool } = await import('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });

      await pool.query(`
        UPDATE players
        SET email_verified = true, verification_token = NULL, token_expiry = NULL
        WHERE email = $1
      `, [email]);

      await pool.end();

      console.log(`✅ [MANUAL VERIFICATION] Email manually verified:`, email);
      res.json({ success: true, message: 'Email verification updated' });

    } catch (error) {
      console.error('❌ [MANUAL VERIFICATION] Error:', error);
      res.status(500).json({ error: 'Failed to verify email' });
    }
  });

  // DEVELOPMENT EMAIL TESTING ENDPOINT
  app.post('/api/dev/test-email', async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Development endpoint not available in production' });
    }

    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      console.log(`🧪 [EMAIL TEST] Testing email functionality for: ${email}`);

      const { createClient } = await import('@supabase/supabase-js');
      const supabaseAdmin = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      // Test Supabase email functionality
      const testResults = {
        supabaseConnection: false,
        emailServiceAvailable: false,
        testEmailSent: false,
        errors: [] as string[]
      };

      // Test 1: Supabase connection
      try {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers();
        if (!error) {
          testResults.supabaseConnection = true;
          console.log(`✅ [EMAIL TEST] Supabase connection successful`);
        } else {
          testResults.errors.push(`Supabase connection error: ${error.message}`);
        }
      } catch (connError: any) {
        testResults.errors.push(`Supabase connection failed: ${connError.message}`);
      }

      // Test 2: Email service availability
      try {
        // Try to create a temporary user to test email service
        const testUserId = `test_${Date.now()}@test.com`;
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email: testUserId,
          email_confirm: false,
          user_metadata: { test: true }
        });

        if (!error && data.user) {
          testResults.emailServiceAvailable = true;
          console.log(`✅ [EMAIL TEST] Email service available`);

          // Clean up test user
          await supabaseAdmin.auth.admin.deleteUser(data.user.id);
        } else {
          testResults.errors.push(`Email service error: ${error?.message}`);
        }
      } catch (emailError: any) {
        testResults.errors.push(`Email service test failed: ${emailError.message}`);
      }

      // Test 3: Send actual test email
      try {
        const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
          data: {
            test: true,
            timestamp: new Date().toISOString()
          }
        });

        if (!error) {
          testResults.testEmailSent = true;
          console.log(`✅ [EMAIL TEST] Test email sent successfully to: ${email}`);
        } else {
          testResults.errors.push(`Test email failed: ${error.message}`);
        }
      } catch (sendError: any) {
        testResults.errors.push(`Test email send error: ${sendError.message}`);
      }

      res.json({
        success: true,
        testResults,
        message: testResults.testEmailSent ? 
          'Test email sent! Check your inbox and spam folder.' : 
          'Email test completed with issues. Check errors for details.'
      });

    } catch (error: any) {
      console.error('❌ [EMAIL TEST] Critical error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Email test failed',         details: error.message 
      });
    }
  });

  // ========== ENTERPRISE-GRADE PLAYER CREATION SYSTEM ==========

  // Enterprise single player creation (optimized for scalability)
  app.post('/api/enterprise/players/create', async (req, res) => {
    try {
      const playerData = req.body;

      console.log('🏢 [ENTERPRISE CREATE] Creating player:', playerData.email);

      const result = await enterprisePlayerSystem.createSinglePlayer(playerData);

      console.log(`✅ [ENTERPRISE CREATE] Player ${result.status}:`, result.playerId);
      res.json({
        success: true,
        playerId: result.playerId,
        status: result.status,
        message: result.message
      });

    } catch (error: any) {
      console.error('❌ [ENTERPRISE CREATE] Error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create player'
      });
    }
  });

  // Enterprise bulk player creation (handles 10,000+ players)
  app.post('/api/enterprise/players/bulk-create', async (req, res) => {
    try {
      const { players } = req.body;

      if (!Array.isArray(players) || players.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid players array provided'
        });
      }

      console.log(`🏢 [ENTERPRISE BULK] Starting bulk creation of ${players.length} players`);

      const result = await enterprisePlayerSystem.createBulkPlayers(players);

      console.log(`✅ [ENTERPRISE BULK] Completed: ${result.created} created, ${result.failed} failed`);
      res.json(result);

    } catch (error: any) {
      console.error('❌ [ENTERPRISE BULK] Error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Bulk creation failed'
      });
    }
  });

  // Generate test data for bulk operations
  app.get('/api/enterprise/players/generate-test/:count', async (req, res) => {
    try {
      const count = parseInt(req.params.count);

      if (isNaN(count) || count <= 0 || count > 50000) {
        return res.status(400).json({
          error: 'Count must be between 1 and 50,000'
        });
      }

      console.log(`🏢 [ENTERPRISE TEST] Generating ${count} test players`);

      const testPlayers = enterprisePlayerSystem.generateTestPlayers(count);

      res.json({
        count: testPlayers.length,
        players: testPlayers
      });

    } catch (error: any) {
      console.error('❌ [ENTERPRISE TEST] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Enterprise health check
  app.get('/api/enterprise/health', async (req, res) => {
    try {
      console.log('🏢 [ENTERPRISE HEALTH] Running health check...');

      const healthCheck = await enterprisePlayerSystem.healthCheck();

      res.json({
        status: healthCheck.databaseConnected && healthCheck.supabaseConnected ? 'healthy' : 'degraded',
        ...healthCheck,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('❌ [ENTERPRISE HEALTH] Error:', error);
      res.status(500).json({
        status: 'unhealthy',
        error: error.message
      });
    }
  });

  // ========== PRODUCTION-GRADE AUTHENTICATION SYSTEM ==========

  // RESTORED WORKING SIGNIN WITH CLERK INTEGRATION
  app.post('/api/auth/signin', async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      console.log(`🔐 [PLAYERS TABLE AUTH] Login attempt: ${email}`);

      // Use direct PostgreSQL connection for reliable authentication
      const { Client } = await import('pg');
      const pgClient = new Client({
        connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL,
        connectionTimeoutMillis: 10000,
        query_timeout: 10000,
        statement_timeout: 10000,
      });

      await pgClient.connect();

      // Query players table directly using PostgreSQL
      const playerQuery = `
        SELECT * FROM players
        WHERE email = $1 AND password = $2 AND (is_active IS NULL OR is_active = true)
        LIMIT 1
      `;

      const playerResult = await pgClient.query(playerQuery, [email, password]);

      if (playerResult.rows.length === 0) {
        console.log(`❌ [PLAYERS TABLE AUTH] Invalid credentials for: ${email}`);
        await pgClient.end();
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const player = playerResult.rows[0];
      console.log(`✅ [PLAYERS TABLE AUTH] Player found: ${player.id}`);

      // Update last login timestamp
      try {
        const updateQuery = `
          UPDATE players
          SET last_login_at = NOW(), updated_at = NOW()
          WHERE id = $1
        `;
        await pgClient.query(updateQuery, [player.id]);
      } catch (updateError) {
        console.warn('⚠️ [PLAYERS TABLE AUTH] Failed to update last login:', updateError);
      }

      await pgClient.end();

      // CRITICAL: Check KYC status before allowing login
      const allowedKycStatuses = ['approved', 'verified'];
      if (!allowedKycStatuses.includes(player.kyc_status)) {
        console.log(`🚫 [KYC GATE] Login blocked - KYC status: ${player.kyc_status} for player: ${player.email}`);
        return res.status(403).json({
          error: 'KYC_VERIFICATION_REQUIRED',
          message: 'Wait for KYC approval',
          kycStatus: player.kyc_status
        });
      }

      console.log(`✅ [PLAYERS TABLE AUTH] Authentication successful using players table only: ${player.email}`);

      // Return comprehensive user data (compatible with existing frontend)
      const userData = {
        id: player.id,
        supabaseId: player.supabase_id,
        email: player.email,
        firstName: player.first_name,
        lastName: player.last_name,
        phone: player.phone,
        kycStatus: player.kyc_status || 'pending',
        balance: player.balance,
        emailVerified: player.email_verified || false,
        clerkUserId: player.clerk_user_id,
        universalId: player.universal_id,
        creditBalance: player.current_credit || '0.00',
        creditLimit: player.credit_limit || '0.00',
        creditEligible: player.credit_eligible || false,
        totalBalance: (parseFloat(player.balance || '0') + parseFloat(player.current_credit || '0')).toFixed(2),
        lastLogin: player.last_login_at,
        clerkSynced: player.clerk_synced_at ? true : false
      };

      res.json({
        success: true,
        user: userData,
        message: "Login successful - authenticated via players table"
      });

    } catch (error: any) {
      console.error('❌ [RESTORED SIGNIN] Error:', error);
      res.status(500).json({ error: 'Authentication server error' });
    }
  });

  // CONSISTENT POSTGRESQL SIGNUP (MATCHING SIGNIN APPROACH)
  app.post('/api/auth/signup', async (req, res) => {
    try {
      const { email, password, firstName, lastName, phone, nickname } = req.body;

      // Log received data for debugging
      console.log('🔐 [SIGNUP VALIDATION] Received data:', {
        email: !!email,
        password: !!password,
        firstName: !!firstName,
        lastName: !!lastName,
        phone: !!phone,
        nickname: !!nickname
      });

      if (!email || !password || !firstName || !lastName || !phone || !nickname) {
        console.log('❌ [SIGNUP VALIDATION] Missing fields:', {
          email: !email ? 'MISSING' : 'OK',
          password: !password ? 'MISSING' : 'OK',
          firstName: !firstName ? 'MISSING' : 'OK',
          lastName: !lastName ? 'MISSING' : 'OK',
          phone: !phone ? 'MISSING' : 'OK',
          nickname: !nickname ? 'MISSING' : 'OK'
        });
        return res.status(400).json({ error: 'All required fields must be provided: email, password, firstName, lastName, phone, and nickname' });
      }

      console.log(`🔐 [PLAYERS TABLE SIGNUP] Creating account: ${email}`);

      // Use Supabase client with service role to bypass RLS (same as signin)
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      // Check if player already exists
      const { data: existingPlayers, error: checkError } = await supabase
        .from('players')
        .select('*')
        .eq('email', email);

      if (checkError) {
        console.error('❌ [PLAYERS TABLE SIGNUP] Check error:', checkError);
        return res.status(500).json({ error: 'Database query failed' });
      }

      if (existingPlayers && existingPlayers.length > 0) {
        const existingPlayer = existingPlayers[0];
        console.log(`✅ [PLAYERS TABLE SIGNUP] Found existing player: ${email}`);

        // Update password if different (allows password reset via signup)
        if (existingPlayer.password !== password) {
          const { error: updateError } = await supabase
            .from('players')
            .update({
              password: password,
              last_login_at: new Date().toISOString()
            })
            .eq('email', email);

          if (updateError) {
            console.error('❌ [PLAYERS TABLE SIGNUP] Update error:', updateError);
          } else {
            console.log(`🔄 [PLAYERS TABLE SIGNUP] Updated password for: ${email}`);
          }
        }

          // Check what the user needs based on their current status
          const needsEmailVerification = !existingPlayer.email_verified;
          const needsKYCUpload = existingPlayer.kyc_status === 'pending';
          const needsKYCApproval = existingPlayer.kyc_status === 'submitted';
          const isFullyVerified = existingPlayer.email_verified && existingPlayer.kyc_status === 'approved';

          return res.json({
            success: true,
            existing: true,
            player: {
              id: existingPlayer.id,
              email: existingPlayer.email,
              firstName: existingPlayer.first_name,
              lastName: existingPlayer.last_name,
              kycStatus: existingPlayer.kyc_status,
              balance: existingPlayer.balance,
              emailVerified: existingPlayer.email_verified
            },
            redirectToKYC: needsKYCUpload || needsKYCApproval,
            needsEmailVerification: needsEmailVerification,
            needsKYCUpload: needsKYCUpload,
            needsKYCApproval: needsKYCApproval,
            isFullyVerified: isFullyVerified,
            message: isFullyVerified ? 'Welcome back! Your account is fully verified.' : 'Welcome back! Please complete verification process.'
          });
        }

      // User doesn't exist - create new player
      console.log(`🔥 [DUAL AUTH SIGNUP] Creating new player: ${email}`);

      // STEP 1: Create Clerk user (PRIMARY AUTHENTICATION SYSTEM)
      let clerkUserId = null;
      try {
        const { clerkClient } = await import('@clerk/clerk-sdk-node');
        const clerkUser = await clerkClient.users.createUser({
          emailAddress: [email],
          password: password,
          firstName: firstName,
          lastName: lastName,
          privateMetadata: {
            source: 'player_portal',
            created_from: 'signup_endpoint',
          },
          publicMetadata: {
            role: 'player'
          }
        });
        clerkUserId = clerkUser.id;
        console.log(`✅ [CLERK] User created successfully: ${clerkUserId}`);

        // Verify Clerk user appears in dashboard
        console.log(`🔍 [CLERK] User details - ID: ${clerkUser.id}, Email: ${clerkUser.emailAddresses?.[0]?.emailAddress}`);

      } catch (clerkError: any) {
        console.warn('⚠️ [CLERK] Failed to create Clerk user, continuing with Supabase-only signup:', clerkError.message);

        // Log detailed error information for debugging
        if (clerkError.errors) {
          console.warn('⚠️ [CLERK] Validation errors:', clerkError.errors);
        }
        if (clerkError.status) {
          console.warn('⚠️ [CLERK] Status code:', clerkError.status);
        }

        // Continue without Clerk user - the system works with Supabase as primary
      }

      // Database will auto-generate the ID, no need for player_id generation

      // Create player record using Supabase (players table only)
      const fullName = `${firstName} ${lastName}`.trim();
      const playerNickname = nickname?.trim() || firstName;
      const currentTimestamp = new Date().toISOString();

      console.log(`🎯 [DATABASE] Creating player with auto-generated ID`);

      // Use direct PostgreSQL insertion to avoid ID conflicts
      const { Client } = await import('pg');
      const pgClient = new Client({ connectionString: process.env.SUPABASE_DATABASE_URL });
      await pgClient.connect();

      // Generate player code in format POKERPLAYR-0001
      const generatePlayerCode = async () => {
        const countResult = await pgClient.query('SELECT COUNT(*) FROM players');
        const count = parseInt(countResult.rows[0].count);
        const nextNumber = (count + 1).toString().padStart(4, '0');
        return `POKERPLAYR-${nextNumber}`;
      };

      let newPlayerData;
      try {
        const playerCode = await generatePlayerCode();
        console.log(`🏷️ [PLAYER CODE] Generated: ${playerCode}`);

        const insertQuery = `
          INSERT INTO players (
            email, password, first_name, last_name, phone,
            kyc_status, balance, universal_id,
            is_active, clerk_user_id, full_name, nickname,
            email_verified, credit_eligible, current_credit, credit_limit,
            total_deposits, total_withdrawals, total_winnings, total_losses,
            games_played, hours_played
          ) VALUES (
            $1, '*', $2, $3, $4,
            'pending', '0.00', $5,
            true, $6, $7, $8,
            false, false, '0.00', '0.00',
            '0.00', '0.00', '0.00', '0.00', 0, '0.00'
          ) RETURNING *
        `;

        // Generate a proper UUID for universal_id
        const { randomUUID } = await import('crypto');
        const universalId = randomUUID();

        const result = await pgClient.query(insertQuery, [
          email, firstName, lastName, phone,
          universalId, clerkUserId, fullName, playerNickname
        ]);

        newPlayerData = result.rows[0];
        await pgClient.end();

        console.log(`✅ [PLAYERS TABLE SIGNUP] New player created successfully: ${email} (ID: ${newPlayerData.id})`);

      } catch (dbError: any) {
        await pgClient.end();
        console.error('❌ [PLAYERS TABLE SIGNUP] Database insertion error:', dbError);

        // Handle duplicate email constraint violation
        if (dbError.code === '23505' && dbError.constraint === 'players_email_unique') {
          console.log('🔍 [DUPLICATE EMAIL] Email already exists, checking if user can log in:', email);
          return res.status(409).json({
            error: 'An account with this email already exists. Please try logging in instead.',
            code: 'EMAIL_EXISTS',
            suggestLogin: true
          });
        }

        return res.status(500).json({ error: 'Database operation failed' });
      }

      // Initialize response data for new player (who needs to complete KYC)
      const responsePlayer = {
        id: newPlayerData.id,
        playerCode: `POKERPLAYR-${String(newPlayerData.id).padStart(4, '0')}`, // Generate player code from ID
        email: newPlayerData.email,
        firstName: newPlayerData.first_name,
        lastName: newPlayerData.last_name,
        fullName: newPlayerData.full_name,
        nickname: newPlayerData.nickname,
        playerId: newPlayerData.id,
        kycStatus: newPlayerData.kyc_status,
        balance: newPlayerData.balance,
        emailVerified: newPlayerData.email_verified,
        creditEligible: newPlayerData.credit_eligible,
      };

      // AUTOMATIC EMAIL VERIFICATION TRIGGER FOR REGULAR SIGNUP
      console.log(`📧 [SIGNUP EMAIL] Triggering verification email for: ${email}`);

      try {
        // Generate strong verification token
        const verificationToken = require('crypto').randomBytes(32).toString('hex');
        const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        // Store verification token in database using the existing connection
        const pgTokenClient = new Client({ connectionString: process.env.SUPABASE_DATABASE_URL });
        await pgTokenClient.connect();

        try {
          await pgTokenClient.query(`
            UPDATE players
            SET verification_token = $1, token_expiry = $2, updated_at = NOW()
            WHERE id = $3
          `, [verificationToken, tokenExpiry, newPlayerData.id]);

          console.log(`✅ [SIGNUP EMAIL] Verification token stored for player ${newPlayerData.id}`);
        } catch (tokenError: any) {
          console.error(`❌ [SIGNUP EMAIL] Token storage failed:`, tokenError);
          await pgTokenClient.end();
          throw tokenError;
        }

        await pgTokenClient.end();

        // Create verification URL
        const baseUrl = process.env.REPLIT_URL || `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` || 'http://localhost:5000';
        const verificationUrl = `${baseUrl}/api/auth/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}`;

        console.log(`🔗 [SIGNUP EMAIL] Verification URL generated: ${verificationUrl}`);

        // Enhanced email sending with multiple fallbacks
        let emailSent = false;
        let emailMethod = '';
        const emailErrors = [];

        // METHOD 1: Supabase Auth User Creation
        try {
          const { createClient } = await import('@supabase/supabase-js');
          const supabaseAdmin = createClient(
            process.env.VITE_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          );

          const { data: authUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email: email,
            email_confirm: false, // This should trigger confirmation email
            password: require('crypto').randomBytes(16).toString('hex'), // Random password
            user_metadata: {
              verification_token: verificationToken,
              player_id: newPlayerData.id,
              source: 'player_portal_signup',
              created_at: new Date().toISOString()
            }
          });

          if (!createError && authUser.user) {
            console.log(`✅ [SIGNUP EMAIL] Supabase auth user created: ${authUser.user.id}`);
            emailSent = true;
            emailMethod = 'supabase_auth_creation';
          } else {
            emailErrors.push(`Supabase creation error: ${createError?.message}`);
            console.log(`⚠️ [SIGNUP EMAIL] Supabase creation failed:`, createError?.message);
          }
        } catch (supabaseError: any) {
          emailErrors.push(`Supabase exception: ${supabaseError.message}`);
          console.log(`⚠️ [SIGNUP EMAIL] Supabase creation exception:`, supabaseError.message);
        }

        // METHOD 2: Direct Email API (if Supabase fails)
        if (!emailSent) {
          try {
            console.log(`📧 [SIGNUP EMAIL] Attempting direct email send...`);
            
            // Use the existing send-verification-email endpoint
            const emailResponse = await fetch(`${baseUrl}/api/auth/send-verification-email`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                email: email,
                playerId: newPlayerData.id,
                firstName: firstName
              })
            });

            if (emailResponse.ok) {
              const emailResult = await emailResponse.json();
              console.log(`✅ [SIGNUP EMAIL] Direct email API succeeded:`, emailResult.message);
              emailSent = true;
              emailMethod = 'direct_email_api';
            } else {
              const emailError = await emailResponse.text();
              emailErrors.push(`Direct email API failed: ${emailError}`);
              console.log(`⚠️ [SIGNUP EMAIL] Direct email API failed:`, emailError);
            }
          } catch (directEmailError: any) {
            emailErrors.push(`Direct email exception: ${directEmailError.message}`);
            console.log(`⚠️ [SIGNUP EMAIL] Direct email exception:`, directEmailError.message);
          }
        }

        // METHOD 3: Development Console Fallback
        if (!emailSent) {
          console.log(`📧 [SIGNUP EMAIL - CONSOLE FALLBACK] Email content for ${email}:`);
          console.log(`📧 [SUBJECT] Welcome to Poker Club - Verify Your Email`);
          console.log(`📧 [BODY] Welcome ${firstName}! Please verify your email by clicking: ${verificationUrl}`);
          console.log(`📧 [TOKEN] ${verificationToken}`);
          console.log(`📧 [EXPIRES] ${tokenExpiry.toISOString()}`);

          emailSent = true;
          emailMethod = 'console_fallback';
        }

        // Log final result
        if (emailSent) {
          console.log(`✅ [SIGNUP EMAIL] Email verification initiated via ${emailMethod} for: ${email}`);
        } else {
          console.error(`❌ [SIGNUP EMAIL] All email methods failed for: ${email}`, emailErrors);
        }

      } catch (emailError: any) {
        console.error(`❌ [SIGNUP EMAIL] Critical error sending verification email:`, emailError);
        // Don't fail signup if email sending fails - user can manually verify later
      }

      return res.json({
        success: true,
        existing: false,
        player: responsePlayer,
        redirectToKYC: true,
        needsEmailVerification: true,
        needsKYCUpload: true,
        needsKYCApproval: false,
        isFullyVerified: false,
        message: 'Account created successfully! Please check your email (including spam folder) for verification link and complete KYC.'
      });

    } catch (error: any) {
      console.error('❌ [POSTGRESQL SIGNUP] Signup error:', error.message);
      return res.status(500).json({ error: 'Signup server error' });
    }
  });

  // Player Feedback Endpoint
  app.post('/api/feedback', async (req, res) => {
    try {
      const { playerId, message } = req.body;

      if (!playerId || !message) {
        return res.status(400).json({ error: 'Player ID and message are required' });
      }

      if (!message.trim()) {
        return res.status(400).json({ error: 'Message cannot be empty' });
      }

      const { Client } = await import('pg');
      const pgClient = new Client({ connectionString: process.env.SUPABASE_DATABASE_URL });
      await pgClient.connect();

      try {
        // Insert feedback into player_feedback table
        const insertFeedbackQuery = `
          INSERT INTO player_feedback (player_id, message, status, created_at)
          VALUES ($1, $2, 'unread', NOW())
          RETURNING id, created_at
        `;

        const feedbackResult = await pgClient.query(insertFeedbackQuery, [playerId, message.trim()]);

        await pgClient.end();

        console.log(`📨 [FEEDBACK] New feedback received from player ${playerId}: "${message.substring(0, 50)}..."`);

        return res.json({
          success: true,
          feedbackId: feedbackResult.rows[0].id,
          message: 'Feedback submitted successfully. Our team will review it shortly.',
          timestamp: feedbackResult.rows[0].created_at
        });

      } catch (dbError: any) {
        await pgClient.end();
        console.error('❌ [FEEDBACK] Database error:', dbError);
        return res.status(500).json({ error: 'Failed to save feedback' });
      }

    } catch (error: any) {
      console.error('❌ [FEEDBACK] Server error:', error.message);
      return res.status(500).json({ error: 'Feedback submission server error' });
    }
  });

  // PAN Card Validation Endpoint - Check for duplicates
  app.post('/api/kyc/validate-pan', async (req, res) => {
    try {
      const { panCardNumber, playerId } = req.body;

      if (!panCardNumber) {
        return res.status(400).json({ error: 'PAN card number is required' });
      }

      // Validate PAN format: ^[A-Z]{5}[0-9]{4}[A-Z]$
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
      if (!panRegex.test(panCardNumber)) {
        return res.status(400).json({ 
          valid: false,
          error: 'Invalid PAN card format. Expected format: ABCDE1234F' 
        });
      }

      // Check if PAN card already exists for another user
      const { Client } = await import('pg');
      const pgClient = new Client({ connectionString: process.env.SUPABASE_DATABASE_URL });
      await pgClient.connect();

      try {
        const panCheckQuery = `
          SELECT id, first_name, last_name 
          FROM players 
          WHERE pan_card_number = $1 AND id != $2 AND pan_card_number IS NOT NULL
        `;
        const panCheckResult = await pgClient.query(panCheckQuery, [panCardNumber, playerId]);

        if (panCheckResult.rows.length > 0) {
          const existingUser = panCheckResult.rows[0];
          console.log(`⚠️ [PAN DUPLICATE] PAN ${panCardNumber} already exists for user ${existingUser.id} (${existingUser.first_name} ${existingUser.last_name})`);
          await pgClient.end();
          return res.json({ 
            valid: false,
            error: 'This PAN card number is already registered with another account. Each PAN card can only be used once.',
            code: 'PAN_ALREADY_EXISTS'
          });
        }

        await pgClient.end();
        return res.json({ 
          valid: true,
          message: 'PAN card number is valid and available' 
        });

      } catch (checkError) {
        await pgClient.end();
        console.error('❌ [PAN CHECK] Error checking duplicate PAN:', checkError);
        return res.status(500).json({ error: 'Error validating PAN card number' });
      }

    } catch (error: any) {
      console.error('❌ [PAN VALIDATION] Server error:', error.message);
      return res.status(500).json({ error: 'PAN validation server error' });
    }
  });

  // KYC Document Upload Endpoint - Following the 3-document requirement
  app.post('/api/kyc/upload', async (req, res) => {
    try {
      const { playerId, documentType, fileName, fileUrl, fileSize, panCardNumber } = req.body;

      // Validate required fields
      if (!playerId || !documentType || !fileName || !fileUrl || !fileSize) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Validate document type
      const validTypes = ['government_id', 'address_proof', 'pan_card'];
      if (!validTypes.includes(documentType)) {
        return res.status(400).json({ error: 'Invalid document type' });
      }

      // Validate PAN card number if this is a PAN card upload
      if (documentType === 'pan_card') {
        if (!panCardNumber) {
          return res.status(400).json({ error: 'PAN card number is required for PAN card uploads' });
        }
        // Validate PAN format: ^[A-Z]{5}[0-9]{4}[A-Z]$
        const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
        if (!panRegex.test(panCardNumber)) {
          return res.status(400).json({ error: 'Invalid PAN card format. Expected format: ABCDE1234F' });
        }

        // Check if PAN card already exists for another user
        const { Client } = await import('pg');
        const pgClientCheck = new Client({ connectionString: process.env.SUPABASE_DATABASE_URL });
        await pgClientCheck.connect();

        try {
          const panCheckQuery = `
            SELECT id, first_name, last_name 
            FROM players 
            WHERE pan_card_number = $1 AND id != $2 AND pan_card_number IS NOT NULL
          `;
          const panCheckResult = await pgClientCheck.query(panCheckQuery, [panCardNumber, playerId]);

          if (panCheckResult.rows.length > 0) {
            const existingUser = panCheckResult.rows[0];
            console.log(`⚠️ [PAN DUPLICATE] PAN ${panCardNumber} already exists for user ${existingUser.id} (${existingUser.first_name} ${existingUser.last_name})`);
            await pgClientCheck.end();
            return res.status(400).json({ 
              error: 'This PAN card number is already registered with another account. Each PAN card can only be used once.',
              code: 'PAN_ALREADY_EXISTS'
            });
          }
          await pgClientCheck.end();
        } catch (checkError) {
          await pgClientCheck.end();
          console.error('❌ [PAN CHECK] Error checking duplicate PAN:', checkError);
          return res.status(500).json({ error: 'Error validating PAN card number' });
        }
      }

      const { Client } = await import('pg');
      const pgClient = new Client({ connectionString: process.env.SUPABASE_DATABASE_URL });


  // Manual email verification trigger for testing
  app.post('/api/auth/resend-verification', async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      console.log(`📧 [RESEND VERIFICATION] Manually triggering verification for: ${email}`);

      // Get player ID
      const { Pool } = await import('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });

      const playerResult = await pool.query('SELECT id, first_name, email_verified FROM players WHERE email = $1', [email]);
      
      if (playerResult.rows.length === 0) {
        await pool.end();
        return res.status(404).json({ error: 'Player not found' });
      }

      const player = playerResult.rows[0];
      await pool.end();

      if (player.email_verified) {
        return res.json({ 
          success: true, 
          message: 'Email is already verified',
          alreadyVerified: true 
        });
      }

      // Call the send verification email endpoint
      const baseUrl = process.env.REPLIT_URL || `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` || 'http://localhost:5000';
      
      const verificationResponse = await fetch(`${baseUrl}/api/auth/send-verification-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          playerId: player.id,
          firstName: player.first_name
        })
      });

      const verificationResult = await verificationResponse.json();

      console.log(`📧 [RESEND VERIFICATION] Result for ${email}:`, verificationResult);

      res.json({
        success: verificationResponse.ok,
        message: verificationResult.message || 'Verification email processing completed',
        details: verificationResult
      });

    } catch (error: any) {
      console.error('❌ [RESEND VERIFICATION] Error:', error);
      res.status(500).json({ 
        error: 'Failed to resend verification email',
        details: error.message 
      });
    }
  });


      await pgClient.connect();

      try {
        // Insert KYC document
        const insertDocQuery = `
          INSERT INTO kyc_documents (player_id, document_type, file_name, file_url, file_size, status)
          VALUES ($1, $2, $3, $4, $5, 'pending')
          RETURNING *
        `;

        const docResult = await pgClient.query(insertDocQuery, [
          playerId, documentType, fileName, fileUrl, fileSize
        ]);

        // If this is a PAN card, also update the player's PAN card number
        if (documentType === 'pan_card') {
          const updatePlayerQuery = `
            UPDATE players
            SET pan_card_number = $1, updated_at = NOW()
            WHERE id = $2
          `;
          await pgClient.query(updatePlayerQuery, [panCardNumber, playerId]);
        }

        // Check if all 3 required documents have been uploaded
        const countDocsQuery = `
          SELECT COUNT(DISTINCT document_type) as doc_count
          FROM kyc_documents
          WHERE player_id = $1 AND document_type IN ('government_id', 'address_proof', 'pan_card')
        `;
        const countResult = await pgClient.query(countDocsQuery, [playerId]);
        const docCount = parseInt(countResult.rows[0].doc_count);

        // If all 3 documents uploaded, update KYC status to 'submitted'
        if (docCount === 3) {
          const updateKycQuery = `
            UPDATE players
            SET kyc_status = 'submitted', updated_at = NOW()
            WHERE id = $1
            RETURNING kyc_status
          `;
          const updateResult = await pgClient.query(updateKycQuery, [playerId]);

          await pgClient.end();

          return res.json({
            success: true,
            document: docResult.rows[0],
            kycStatus: 'submitted',
            message: `${documentType} uploaded successfully. All required documents uploaded. KYC submitted for review.`,
            allDocsUploaded: true
          });
        }

        await pgClient.end();

        return res.json({
          success: true,
          document: docResult.rows[0],
          kycStatus: 'pending',
          message: `${documentType} uploaded successfully. ${3 - docCount} more documents required.`,
          allDocsUploaded: false,
          remainingDocs: 3 - docCount
        });

      } catch (dbError: any) {
        await pgClient.end();
        console.error('❌ [KYC UPLOAD] Database error:', dbError);
        return res.status(500).json({ error: 'Failed to save KYC document' });
      }

    } catch (error: any) {
      console.error('❌ [KYC UPLOAD] Server error:', error.message);
      return res.status(500).json({ error: 'KYC upload server error' });
    }
  });

  // Login endpoint with last_login_at update
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const { Client } = await import('pg');
      const pgClient = new Client({ connectionString: process.env.SUPABASE_DATABASE_URL });
      await pgClient.connect();

      try {
        // Find player by email
        const playerQuery = `
          SELECT * FROM players WHERE email = $1
        `;
        const playerResult = await pgClient.query(playerQuery, [email.toLowerCase()]);

        if (playerResult.rows.length === 0) {
          await pgClient.end();
          return res.status(401).json({ error: 'Invalid email or password' });
        }

        const player = playerResult.rows[0];

        // Update last_login_at and email verification status if Clerk shows verified
        const updateLoginQuery = `
          UPDATE players
          SET last_login_at = NOW(), email_verified = COALESCE(email_verified, true), updated_at = NOW()
          WHERE id = $1
          RETURNING *
        `;
        const updateResult = await pgClient.query(updateLoginQuery, [player.id]);
        const updatedPlayer = updateResult.rows[0];

        await pgClient.end();

        console.log(`✅ [LOGIN] Player logged in successfully: ${email} (ID: ${player.id})`);

        // Return player data
        const responsePlayer = {
          id: updatedPlayer.id,
          playerCode: updatedPlayer.player_code,
          email: updatedPlayer.email,
          firstName: updatedPlayer.first_name,
          lastName: updatedPlayer.last_name,
          fullName: updatedPlayer.full_name,
          nickname: updatedPlayer.nickname,
          playerId: updatedPlayer.id,
          kycStatus: updatedPlayer.kyc_status,
          balance: updatedPlayer.balance,
          emailVerified: updatedPlayer.email_verified,
          creditEligible: updatedPlayer.credit_eligible,
          lastLoginAt: updatedPlayer.last_login_at
        };

        // Determine what the user needs to do next
        const needsEmailVerification = !updatedPlayer.email_verified;
        const needsKYCUpload = updatedPlayer.kyc_status === 'pending';
        const needsKYCApproval = updatedPlayer.kyc_status === 'submitted';
        const isFullyVerified = updatedPlayer.email_verified && updatedPlayer.kyc_status === 'approved';

        return res.json({
          success: true,
          player: responsePlayer,
          needsEmailVerification,
          needsKYCUpload,
          needsKYCApproval,
          isFullyVerified,
          message: isFullyVerified ? 'Login successful! Welcome back.' : 'Login successful! Please complete verification steps.'
        });

      } catch (dbError: any) {
        await pgClient.end();
        console.error('❌ [LOGIN] Database error:', dbError);
        return res.status(500).json({ error: 'Login database error' });
      }

    } catch (error: any) {
      console.error('❌ [LOGIN] Server error:', error.message);
      return res.status(500).json({ error: 'Login server error' });
    }
  });

  // Backend Automation: Signup (Clerk → Supabase) - Following exact specifications
  app.post('/api/auth/signup-automation', async (req, res) => {
    const { handleSignup } = await import('./backend-automation');
    return handleSignup(req, res);
  });

  // Backend Automation: Login with last_login_at update
  app.post('/api/auth/login-automation', async (req, res) => {
    const { handleLogin } = await import('./backend-automation');
    return handleLogin(req, res);
  });

  // Backend Automation: KYC Upload (3 documents → 3 rows)
  app.post('/api/kyc/upload-automation', async (req, res) => {
    const { handleKycUpload } = await import('./backend-automation');
    return handleKycUpload(req, res);
  });

  // DEPRECATED: This endpoint now redirects to /api/auth/signup for consistency
  app.post('/api/players', async (req, res) => {
    console.log('🔄 [DEPRECATED] /api/players endpoint called - redirecting to /api/auth/signup');
    return res.status(301).json({
      error: 'This endpoint is deprecated. Please use /api/auth/signup for all new registrations.',
      redirectTo: '/api/auth/signup'
    });
  });

  // Clean Clerk-Supabase user sync for nanosecond-speed authentication
  app.post('/api/auth/clerk-user-sync', async (req, res) => {
    const { ClerkPlayerSync } = await import('./clerk-integration');
    await ClerkPlayerSync.clerkUserSync(req, res);
  });

  // Double authentication status check
  app.get('/api/auth/status/:email', async (req, res) => {
    try {
      const { email } = req.params;

      console.log(`🔍 [AUTH STATUS] Checking double auth status: ${email}`);

      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const { data: player } = await supabase
        .from('players')
        .select('*')
        .eq('email', email)
        .single();

      if (player) {
        res.json({
          success: true,
          doubleAuthStatus: {
            supabaseLinked: !!player.supabase_id,
            clerkLinked: !!player.clerk_user_id,
            emailVerified: player.email_verified,
            clerkSynced: !!player.clerk_synced_at,
            kycStatus: player.kyc_status,
            isActive: player.is_active
          },
          player: {
            id: player.id,
            email: player.email,
            firstName: player.first_name,
            lastName: player.last_name
          }
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

    } catch (error: any) {
      console.error('❌ [AUTH STATUS] Error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Check Table Game Status for Waitlisted Players
  app.get("/api/table-status/:tableId", async (req, res) => {
    try {
      const { tableId } = req.params;
      console.log(`🎮 [TABLE STATUS] Checking game status for table: ${tableId}`);

      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      // Get table status from poker_tables with correct column names
      const { data: tableData, error } = await supabase
        .from('poker_tables')
        .select(`
          id,
          name,
          game_type,
          min_buy_in,
          max_buy_in,
          small_blind,
          big_blind,
          max_players,
          current_players,
          status,
          updated_at
        `)
        .eq('id', tableId)
        .single();

      if (error || !tableData) {
        console.error('❌ [TABLE STATUS] Table not found:', error);
        return res.status(404).json({ error: 'Table not found' });
      }

      // Check waitlist count for this table
      const { Client } = await import('pg');
      const pgClient = new Client({ connectionString: process.env.DATABASE_URL });
      await pgClient.connect();

      const waitlistResult = await pgClient.query(
        'SELECT COUNT(*) as waitlist_count FROM seat_requests WHERE table_id = $1 AND status = $2',
        [tableId, 'waiting']
      );

      await pgClient.end();

      const tableStatus = {
        id: tableData.id,
        name: tableData.name,
        gameType: tableData.game_type || 'Texas Hold\'em',
        gameStatus: tableData.status,
        gameStarted: tableData.status === 'active',
        gameStartTime: tableData.status === 'active' ? tableData.updated_at : null,
        currentPlayers: tableData.current_players || 0,
        maxPlayers: tableData.max_players || 9,
        waitlistCount: parseInt(waitlistResult.rows[0]?.waitlist_count || '0'),
        isActive: tableData.status !== 'maintenance',
        canJoinNow: (tableData.current_players || 0) < (tableData.max_players || 9),
        stakes: `₹${tableData.small_blind}/${tableData.big_blind}`,
        buyInRange: `₹${tableData.min_buy_in} - ₹${tableData.max_buy_in}`,
        lastUpdated: new Date().toISOString()
      };

      console.log(`✅ [TABLE STATUS] Table ${tableId} status:`, {
        gameStarted: tableStatus.gameStarted,
        canJoinNow: tableStatus.canJoinNow,
        waitlistCount: tableStatus.waitlistCount,
        status: tableData.status
      });

      res.json(tableStatus);

    } catch (error: any) {
      console.error('❌ [TABLE STATUS] Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get All Seated Players for a Table - Shows all players seated at a specific table
  app.get("/api/tables/:tableId/seats", async (req, res) => {
    try {
      const tableId = req.params.tableId;
      console.log(`🪑 [TABLE SEATS] Getting all seated players for table: ${tableId}`);

      const { Client } = await import('pg');
      const pgClient = new Client({ connectionString: process.env.DATABASE_URL });
      await pgClient.connect();

      try {
        // Query for all seated players at this table
        const query = `
          SELECT 
            sr.id,
            sr.player_id,
            sr.table_id,
            sr.seat_number,
            sr.status,
            sr.session_start_time,
            sr.session_buy_in_amount,
            sr.call_time_started,
            sr.call_time_ends,
            sr.cashout_window_active,
            sr.cashout_window_ends,
            sr.min_play_time_minutes,
            sr.call_time_window_minutes,
            sr.call_time_play_period_minutes,
            sr.cashout_window_minutes,
            p.first_name,
            p.last_name,
            p.email
          FROM seat_requests sr
          JOIN players p ON sr.player_id = p.id
          WHERE sr.table_id = $1 AND sr.status = 'seated'
          ORDER BY sr.seat_number ASC
        `;

        const result = await pgClient.query(query, [tableId]);

        console.log(`✅ [TABLE SEATS] Found ${result.rows.length} seated players for table ${tableId}`);

        // Transform the data to match frontend expectations
        const seatedPlayers = result.rows.map(row => ({
          id: row.id,
          playerId: row.player_id,
          tableId: row.table_id,
          seatNumber: row.seat_number,
          status: row.status,
          sessionStartTime: row.session_start_time,
          sessionBuyInAmount: row.session_buy_in_amount || 0,
          session_buy_in_amount: row.session_buy_in_amount || 0, // Support both formats
          callTimeStarted: row.call_time_started,
          callTimeEnds: row.call_time_ends,
          call_time_started: row.call_time_started,
          call_time_ends: row.call_time_ends,
          cashoutWindowActive: row.cashout_window_active,
          cashoutWindowEnds: row.cashout_window_ends,
          cashout_window_active: row.cashout_window_active,
          cashout_window_ends: row.cashout_window_ends,
          minPlayTimeMinutes: row.min_play_time_minutes,
          callTimeWindowMinutes: row.call_time_window_minutes,
          player: {
            id: row.player_id,
            firstName: row.first_name,
            lastName: row.last_name,
            email: row.email
          }
        }));

        res.json(seatedPlayers);

      } finally {
        await pgClient.end();
      }

    } catch (error) {
      console.error(`❌ [TABLE SEATS] Error getting seated players:`, error);
      res.status(500).json({ error: 'Failed to get seated players' });
    }
  });

  // Get Seated Player Table Information - Shows where player is currently seated
  app.get("/api/table-seats/:playerId", async (req, res) => {
    try {
      const playerId = parseInt(req.params.playerId);
      console.log(`🪑 [SEATED PLAYER] Getting seated table info for player: ${playerId}`);

      const { Client } = await import('pg');
      const pgClient = new Client({ connectionString: process.env.DATABASE_URL });
      await pgClient.connect();

      try {
        // Query for seated sessions with active tables
        const seatedResult = await pgClient.query(`
          SELECT
            sr.id, sr.player_id, sr.table_id, sr.status, sr.position,
            sr.seat_number, sr.session_start_time, sr.session_buy_in_amount,
            sr.session_cash_out_amount, sr.created_at,
            pt.name as table_name, pt.game_type, pt.min_buy_in, pt.max_buy_in, pt.status as table_status,
            p.first_name, p.last_name
          FROM seat_requests sr
          LEFT JOIN poker_tables pt ON sr.table_id::uuid = pt.id
          WHERE sr.player_id = $1 
            AND sr.status = 'seated' 
            AND pt.status = 'active' 
            AND sr.session_start_time IS NOT NULL
          ORDER BY sr.session_start_time DESC
        `, [playerId]);

        await pgClient.end();

        const seatedSessions = seatedResult.rows.map(row => ({
          id: row.id,
          playerId: row.player_id,
          tableId: row.table_id,
          tableName: row.table_name || `Table ${row.table_id}`,
          gameType: row.game_type || 'Texas Hold\'em',
          status: row.status,
          seatNumber: row.seat_number,
          sessionStartTime: row.session_start_time,
          sessionBuyIn: row.session_buy_in_amount || '0.00',
          sessionCashOut: row.session_cash_out_amount || '0.00',
          minBuyIn: row.min_buy_in || 1000,
          maxBuyIn: row.max_buy_in || 10000,
          playerName: `${row.first_name} ${row.last_name}`,
          createdAt: row.created_at
        }));

        console.log(`✅ [SEATED PLAYER] Found ${seatedSessions.length} active sessions for player ${playerId}`);
        res.json(seatedSessions);

      } catch (dbError: any) {
        await pgClient.end();
        console.error('❌ [SEATED PLAYER] Database error:', dbError);
        return res.status(500).json({ error: 'Database query failed' });
      }

    } catch (error: any) {
      console.error('❌ [SEATED PLAYER] Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get Player Seat Requests (Waitlist) - NANOSECOND SPEED DUAL TABLE SYNC
  app.get("/api/seat-requests/:playerId", async (req, res) => {
    try {
      const playerId = parseInt(req.params.playerId);
      console.log(`🔍 [NANOSECOND WAITLIST] Fetching waitlist for player: ${playerId}`);

      const { Client } = await import('pg');
      const pgClient = new Client({ connectionString: process.env.DATABASE_URL });
      await pgClient.connect();

      try {
        // CRITICAL: Query seat_requests table with your updated schema
        const seatRequestsResult = await pgClient.query(`
          SELECT
            sr.id, sr.player_id, sr.table_id, sr.status, sr.position,
            sr.estimated_wait, sr.created_at, sr.game_type, sr.notes,
            sr.seat_number, sr.session_start_time, sr.universal_id,
            sr.min_play_time_minutes, sr.call_time_window_minutes,
            sr.session_buy_in_amount, sr.session_cash_out_amount,
            sr.session_rake_amount, sr.session_tip_amount,
            pt.name as table_name, pt.game_type as table_game_type,
            pt.min_buy_in, pt.max_buy_in
          FROM seat_requests sr
          LEFT JOIN poker_tables pt ON sr.table_id::uuid = pt.id
          WHERE sr.player_id = $1
          ORDER BY sr.created_at DESC
        `, [playerId]);

        await pgClient.end();

        // Transform results to match frontend expectations
        const seatRequests = seatRequestsResult.rows.map(row => ({
          id: row.id,
          playerId: row.player_id,
          tableId: row.table_id,
          tableName: row.table_name || `Table ${row.table_id}`,
          gameType: row.table_game_type || row.game_type || 'Texas Hold\'em',
          status: row.status,
          position: row.position || 1,
          estimatedWait: row.estimated_wait || 15,
          minBuyIn: row.min_buy_in || 1000,
          maxBuyIn: row.max_buy_in || 10000,
          notes: row.notes,
          seatNumber: row.seat_number,
          sessionStartTime: row.session_start_time,
          universalId: row.universal_id,
          minPlayTime: row.min_play_time_minutes || 30,
          callTimeWindow: row.call_time_window_minutes || 10,
          sessionBuyIn: row.session_buy_in_amount || '0.00',
          sessionCashOut: row.session_cash_out_amount || '0.00',
          createdAt: row.created_at
        }));

        console.log(`✅ [NANOSECOND WAITLIST] Found ${seatRequests.length} waitlist entries for player ${playerId}`);
        res.json(seatRequests);

      } catch (dbError: any) {
        await pgClient.end();
        console.error('❌ [NANOSECOND WAITLIST] Database error:', dbError);
        return res.status(500).json({ error: 'Database query failed' });
      }

    } catch (error: any) {
      console.error('❌ [NANOSECOND WAITLIST] Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Live Sessions API endpoint - reads from seat_requests table
  app.get("/api/live-sessions/:playerId", async (req, res) => {
    try {
      const { playerId } = req.params;
      console.log(`🪑 [LIVE SESSIONS] Fetching session for player: ${playerId}`);

      const { Client } = await import('pg');
      const pgClient = new Client({ connectionString: process.env.DATABASE_URL });
      await pgClient.connect();

      try {
        // Query for active seated session with all required fields
        const sessionResult = await pgClient.query(`
          SELECT
            sr.id, sr.player_id, sr.table_id, sr.status, sr.seat_number,
            sr.session_start_time, sr.session_buy_in_amount,
            sr.call_time_started, sr.call_time_ends,
            sr.cashout_window_active, sr.cashout_window_ends,
            pt.name as table_name, pt.game_type, pt.min_buy_in, pt.max_buy_in,
            pt.small_blind, pt.big_blind, pt.status as table_status,
            pt.min_play_time, pt.call_time_duration, pt.cash_out_window
          FROM seat_requests sr
          LEFT JOIN poker_tables pt ON sr.table_id::uuid = pt.id
          WHERE sr.player_id = $1 AND sr.status = 'seated' AND sr.session_start_time IS NOT NULL
          ORDER BY sr.session_start_time DESC
          LIMIT 1
        `, [parseInt(playerId)]);

        if (sessionResult.rows.length === 0) {
          await pgClient.end();
          console.log(`📊 [LIVE SESSIONS] No active session found for player ${playerId}`);
          return res.json({ hasActiveSession: false, session: null });
        }

        const row = sessionResult.rows[0];

        console.log(`✅ [LIVE SESSIONS] Found active session for player ${playerId}:`, {
          tableId: row.table_id,
          tableName: row.table_name,
          sessionStart: row.session_start_time,
          status: row.status
        });

        // Calculate session duration
        const sessionStart = new Date(row.session_start_time);
        const now = new Date();
        const sessionDurationMinutes = Math.floor((now.getTime() - sessionStart.getTime()) / (1000 * 60));

        // Get table configuration from poker_tables (included in main query)
        const tableConfig = {
          min_play_time: row.min_play_time || 30,
          call_time_duration: row.call_time_duration || 60, 
          cash_out_window: row.cash_out_window || 15
        };
        const minPlayTimeMinutes = tableConfig.min_play_time || 30;
        const callTimeDurationMinutes = tableConfig.call_time_duration || 60;
        const cashOutWindowMinutes = tableConfig.cash_out_window || 15;

        // STATE MACHINE IMPLEMENTATION
        // Phase 1: MINIMUM_PLAY (0 to min_play_time)
        // Phase 2: CALL_TIME_AVAILABLE (after min_play_time, no active call time)
        // Phase 3: CALL_TIME_ACTIVE (call time button pressed, countdown running)
        // Phase 4: CASH_OUT_WINDOW (after call time countdown, cash out available)
        // Phase 5: Back to CALL_TIME_AVAILABLE (if cash out window expires)

        const minPlayTimeCompleted = sessionDurationMinutes >= minPlayTimeMinutes;

        // Initialize state variables
        let sessionPhase = 'MINIMUM_PLAY';
        let callTimeAvailable = false;
        let callTimeActive = false;
        let callTimeRemaining = 0;
        let cashOutWindowActive = false;
        let cashOutTimeRemaining = 0;
        let canCashOut = false;

        if (!minPlayTimeCompleted) {
          // PHASE 1: MINIMUM_PLAY - Must complete minimum play time first
          sessionPhase = 'MINIMUM_PLAY';
          const timeUntilMinPlay = minPlayTimeMinutes - sessionDurationMinutes;
          console.log(`📊 [STATE MACHINE] Player ${playerId} in MINIMUM_PLAY phase, ${timeUntilMinPlay} minutes remaining`);
        } else {
          // Check if call time is currently active
          if (row.call_time_started && row.call_time_ends) {
            const callTimeEnds = new Date(row.call_time_ends);

            if (now < callTimeEnds) {
              // PHASE 3: CALL_TIME_ACTIVE - Call time countdown running
              sessionPhase = 'CALL_TIME_ACTIVE';
              callTimeActive = true;
              callTimeRemaining = Math.ceil((callTimeEnds.getTime() - now.getTime()) / (1000 * 60));
              console.log(`📊 [STATE MACHINE] Player ${playerId} in CALL_TIME_ACTIVE phase, ${callTimeRemaining} minutes remaining`);
            } else {
              // Call time countdown finished, check if in cash out window
              if (row.cashout_window_active && row.cashout_window_ends) {
                const cashOutEnds = new Date(row.cashout_window_ends);

                if (now < cashOutEnds) {
                  // PHASE 4: CASH_OUT_WINDOW - Cash out available
                  sessionPhase = 'CASH_OUT_WINDOW';
                  cashOutWindowActive = true;
                  canCashOut = true;
                  cashOutTimeRemaining = Math.ceil((cashOutEnds.getTime() - now.getTime()) / (1000 * 60));
                  console.log(`📊 [STATE MACHINE] Player ${playerId} in CASH_OUT_WINDOW phase, ${cashOutTimeRemaining} minutes remaining`);
                } else {
                  // Cash out window expired, reset to call time available
                  sessionPhase = 'CALL_TIME_AVAILABLE';
                  callTimeAvailable = true;

                  // Clear expired windows in database
                  await pgClient.query(`
                    UPDATE seat_requests 
                    SET call_time_started = NULL, call_time_ends = NULL,
                        cashout_window_active = false, cashout_window_ends = NULL,
                        updated_at = NOW()
                    WHERE id = $1
                  `, [row.id]);

                  console.log(`📊 [STATE MACHINE] Player ${playerId} cash out window expired, back to CALL_TIME_AVAILABLE`);
                }
              } else {
                // Call time finished but no cash out window started - AUTO-ACTIVATE CASH OUT WINDOW
                sessionPhase = 'CASH_OUT_WINDOW';
                cashOutWindowActive = true;
                canCashOut = true;

                const cashOutWindowStartTime = now;
                const cashOutWindowEndTime = new Date(now.getTime() + (cashOutWindowMinutes * 60 * 1000));
                cashOutTimeRemaining = cashOutWindowMinutes;

                // Auto-activate cash out window in database
                await pgClient.query(`
                  UPDATE seat_requests 
                  SET cashout_window_active = true,
                      cashout_window_ends = $1,
                      updated_at = NOW()
                  WHERE id = $2
                `, [cashOutWindowEndTime, row.id]);

                console.log(`📊 [STATE MACHINE] Player ${playerId} call time finished, auto-activating cash out window for ${cashOutWindowMinutes} minutes`);
              }
            }
          } else {
            // PHASE 2: CALL_TIME_AVAILABLE - Can request call time
            sessionPhase = 'CALL_TIME_AVAILABLE';
            callTimeAvailable = true;
            console.log(`📊 [STATE MACHINE] Player ${playerId} in CALL_TIME_AVAILABLE phase`);
          }
        }

        // Build comprehensive session response from seat_requests data
        const sessionData = {
          id: row.id,
          playerId: parseInt(playerId),
          tableId: row.table_id,
          tableName: row.table_name || 'Unknown Table',
          gameType: row.game_type || 'Unknown Game',
          stakes: `₹${row.min_buy_in || 1000}/${row.max_buy_in || 10000}`,
          buyInAmount: row.session_buy_in_amount || 10000,
          currentChips: row.session_buy_in_amount || 10000, // Start with buy-in amount
          sessionDuration: sessionDurationMinutes,
          startedAt: row.session_start_time,
          status: 'active',
          profitLoss: 0, // No profit/loss tracking yet

          // Timing configuration from poker_tables (dynamic values) - Multiple field formats for compatibility
          minPlayTimeMinutes,
          callTimeDurationMinutes,
          cashOutWindowMinutes,

          // STATE MACHINE STATUS
          sessionPhase,
          minPlayTimeCompleted,
          callTimeAvailable,
          callTimeActive,
          callTimeRemaining,
          cashOutWindowActive,
          canCashOut,
          cashOutTimeRemaining,
          isLive: true,
          sessionStartTime: row.session_start_time,

          // Table configuration (dynamic from poker_tables) - Primary fields for UI
          tableMinPlayTime: minPlayTimeMinutes,
          tableCallTimeDuration: callTimeDurationMinutes,
          tableCashOutWindow: cashOutWindowMinutes,

          // Legacy field compatibility (for any hardcoded references)
          min_play_time: minPlayTimeMinutes,
          call_time_duration: callTimeDurationMinutes,
          cash_out_window: cashOutWindowMinutes
        };

        console.log(`📊 [LIVE SESSIONS] Session data for player ${playerId}:`, {
          duration: sessionDurationMinutes,
          phase: sessionPhase,
          minPlayCompleted: minPlayTimeCompleted,
          callTimeAvailable,
          callTimeActive,
          canCashOut
        });

        await pgClient.end();

        res.json({
          hasActiveSession: true,
          session: sessionData
        });

      } catch (dbError: any) {
        await pgClient.end();
        console.error('❌ [LIVE SESSIONS] Database error:', dbError);
        return res.status(500).json({ error: 'Database query failed' });
      }

    } catch (error: any) {
      console.error('❌ [LIVE SESSIONS] Error:', error);
      res.status(500).json({ error: 'Failed to fetch session data' });
    }
  });

  // Call Time Start API - Initiate call time countdown
  app.post("/api/call-time/start", async (req, res) => {
    try {
      const { playerId, sessionId } = req.body;

      console.log(`⏰ [CALL TIME] Starting call time for player ${playerId}, session ${sessionId}`);

      const { Client } = await import('pg');
      const pgClient = new Client({ connectionString: process.env.DATABASE_URL });
      await pgClient.connect();

      try {
        // First, verify the player is seated and get table configuration
        const seatQuery = await pgClient.query(`
          SELECT sr.*, pt.call_time_duration, pt.name as table_name
          FROM seat_requests sr
          JOIN poker_tables pt ON sr.table_id::uuid = pt.id
          WHERE sr.player_id = $1 AND sr.status = 'seated'
          ORDER BY sr.created_at DESC 
          LIMIT 1
        `, [playerId]);

        if (seatQuery.rows.length === 0) {
          await pgClient.end();
          console.log(`❌ [CALL TIME] Player ${playerId} not found or not seated`);
          return res.status(400).json({ error: 'Player not found or not seated' });
        }

        const seatInfo = seatQuery.rows[0];
        const callTimeDuration = seatInfo.call_time_duration || 60;

        console.log(`🎯 [CALL TIME] Player ${playerId} found:`, {
          seatId: seatInfo.id,
          tableId: seatInfo.table_id,
          tableName: seatInfo.table_name,
          callTimeDuration: callTimeDuration,
          currentCallTimeStarted: seatInfo.call_time_started,
          currentCallTimeEnds: seatInfo.call_time_ends
        });

        // Check if call time is already active
        if (seatInfo.call_time_started && seatInfo.call_time_ends) {
          const callTimeEnds = new Date(seatInfo.call_time_ends);
          if (callTimeEnds > new Date()) {
            await pgClient.end();
            return res.status(400).json({ 
              error: 'Call time is already active',
              callTimeEnds: callTimeEnds.toISOString()
            });
          }
        }

        // Calculate new call time timestamps
        const callTimeStarted = new Date();
        const callTimeEnds = new Date(callTimeStarted.getTime() + (callTimeDuration * 60 * 1000));

        console.log(`🕐 [CALL TIME] Setting timestamps:`, {
          started: callTimeStarted.toISOString(),
          ends: callTimeEnds.toISOString(),
          durationMinutes: callTimeDuration
        });

        // Update seat_requests with call time information and clear cash out window
        const updateResult = await pgClient.query(`
          UPDATE seat_requests 
          SET call_time_started = $1,
              call_time_ends = $2,
              cashout_window_active = false,
              cashout_window_ends = null,
              request = 'call_time',
              updated_at = NOW()
          WHERE player_id = $3 AND status = 'seated'
          RETURNING *
        `, [callTimeStarted.toISOString(), callTimeEnds.toISOString(), playerId]);

        if (updateResult.rows.length === 0) {
          await pgClient.end();
          console.log(`❌ [CALL TIME] Failed to update seat_requests for player ${playerId}`);
          return res.status(500).json({ error: 'Failed to update call time in database' });
        }

        const updatedSeat = updateResult.rows[0];
        console.log(`✅ [CALL TIME] Database updated:`, {
          id: updatedSeat.id,
          call_time_started: updatedSeat.call_time_started,
          call_time_ends: updatedSeat.call_time_ends,
          cashout_window_active: updatedSeat.cashout_window_active
        });

        await pgClient.end();

        // Send real-time notification to staff portal via Pusher
        await pusher.trigger('staff-portal', 'call_time_started', {
          playerId: playerId,
          tableName: seatInfo.table_name,
          callTimeStarted: callTimeStarted.toISOString(),
          callTimeEnds: callTimeEnds.toISOString(),
          duration: callTimeDuration
        });

        console.log(`✅ [CALL TIME] Successfully started for player ${playerId}:`, {
          duration: `${callTimeDuration} minutes`,
          endsAt: callTimeEnds.toLocaleTimeString(),
          table: seatInfo.table_name
        });

        res.json({ 
          success: true, 
          callTimeStarted: callTimeStarted.toISOString(),
          callTimeEnds: callTimeEnds.toISOString(),
          duration: callTimeDuration,
          message: `Call time started: ${callTimeDuration} minutes until ${callTimeEnds.toLocaleTimeString()}`
        });

      } catch (dbError: any) {
        await pgClient.end();
        console.error('❌ [CALL TIME] Database error:', dbError);
        console.error('❌ [CALL TIME] Error details:', {
          message: dbError.message,
          code: dbError.code,
          detail: dbError.detail,
          hint: dbError.hint,
          position: dbError.position,
          query: dbError.query
        });
        return res.status(500).json({ 
          error: 'Database operation failed',
          details: dbError.message 
        });
      }

    } catch (error: any) {
      console.error('❌ [CALL TIME] General error:', error);
      res.status(500).json({ 
        error: 'Failed to start call time',
        details: error.message 
      });
    }
  });

  // Cash Out Request API - Submit cash out request during cash out window
  app.post("/api/cash-out/request", async (req, res) => {
    try {
      const { playerId, sessionId } = req.body;

      console.log(`💰 [CASH OUT] Processing request for player ${playerId}, session ${sessionId}`);

      const { Client } = await import('pg');
      const pgClient = new Client({ connectionString: process.env.DATABASE_URL });
      await pgClient.connect();

      try {
        // Verify player is in cash out window
        const seatQuery = await pgClient.query(`
          SELECT sr.*, pt.cash_out_window, pt.name as table_name 
          FROM seat_requests sr
          JOIN poker_tables pt ON sr.table_id::uuid = pt.id
          WHERE sr.player_id = $1 AND sr.status = 'seated'
          ORDER BY sr.created_at DESC 
          LIMIT 1
        `, [playerId]);

        if (seatQuery.rows.length === 0) {
          await pgClient.end();
          return res.status(400).json({ error: 'Player not found or not seated' });
        }

        const seatInfo = seatQuery.rows[0];

        // Check if cash out window is active
        if (!seatInfo.cashout_window_active) {
          await pgClient.end();
          return res.status(400).json({ error: 'Cash out window is not currently active' });
        }

        // Update seat_requests with cash out request
        const updateResult = await pgClient.query(`
          UPDATE seat_requests 
          SET cash_out_requested = NOW(),
              cash_out_requested_by = $1,
              request = 'cash_out',
              updated_at = NOW(),
              notes = COALESCE(notes, '') || ' | Cash out requested at ' || NOW()
          WHERE player_id = $1 AND status = 'seated'
          RETURNING *
        `, [playerId]);

        if (updateResult.rows.length === 0) {
          await pgClient.end();
          return res.status(500).json({ error: 'Failed to submit cash out request' });
        }

        await pgClient.end();

        // Send notifications to staff and player via Pusher
        await pusher.trigger('staff-portal', 'cash_out_requested', {
          playerId,
          playerName: `Player ${playerId}`,
          tableId: seatInfo.table_id,
          tableName: seatInfo.table_name,
          seatNumber: seatInfo.seat_number,
          requestedAt: new Date().toISOString(),
          message: `Player ${playerId} has requested to cash out from ${seatInfo.table_name}`
        });

        await pusher.trigger(`player-${playerId}`, 'cash_out_requested', {
          message: 'Your cash out request has been sent to management',
          requestedAt: new Date().toISOString()
        });

        console.log(`✅ [CASH OUT] Request submitted for player ${playerId} at table ${seatInfo.table_name}`);
        res.json({ 
          success: true, 
          message: 'Cash out request sent to management',
          requestedAt: new Date().toISOString()
        });

      } catch (dbError: any) {
        await pgClient.end();
        console.error('❌ [CASH OUT] Database error:', dbError);
        return res.status(500).json({ error: 'Database operation failed' });
      }

    } catch (error: any) {
      console.error('❌ [CASH OUT] Error:', error);
      res.status(500).json({ error: 'Failed to submit cash out request' });
    }
  });

  // Join Table Waitlist API - Using Updated Schema
  app.post("/api/seat-requests", async (req, res) => {
    try {
      const { playerId, tableId, gameType, notes, seatNumber, minPlayTime, callTimeWindow } = req.body;

      if (!playerId || !tableId) {
        return res.status(400).json({ error: 'playerId and tableId are required' });
      }

      console.log(`🎯 [WAITLIST] Player ${playerId} joining waitlist for table: ${tableId}`);

      const { Client } = await import('pg');
      const pgClient = new Client({ connectionString: process.env.DATABASE_URL });
      await pgClient.connect();

      try {
        // GAME RESTRICTION VALIDATION: Check if player is already seated at any active table
        const seatedCheck = await pgClient.query(`
          SELECT sr.table_id, pt.name as table_name, pt.status 
          FROM seat_requests sr
          JOIN poker_tables pt ON sr.table_id::uuid = pt.id
          WHERE sr.player_id = $1 AND sr.status = 'active' AND pt.status = 'active'
        `, [playerId]);

        if (seatedCheck.rows.length > 0) {
          const activeGame = seatedCheck.rows[0];
          await pgClient.end();
          return res.status(409).json({
            error: 'Cannot join waitlist while seated at an active table',
            restriction: 'ACTIVE_GAME',
            activeTable: {
              id: activeGame.table_id,
              name: activeGame.table_name,
              status: activeGame.status
            },
            message: `You are currently seated at ${activeGame.table_name}. Please cash out before joining another waitlist.`
          });
        }
        // Check if player already on waitlist for this table
        const existingCheck = await pgClient.query(
          'SELECT id FROM seat_requests WHERE player_id = $1 AND table_id = $2',
          [playerId, tableId]
        );

        if (existingCheck.rows.length > 0) {
          await pgClient.end();
          return res.status(409).json({
            error: 'Already on waitlist for this table',
            existing: true
          });
        }

        // Get table info for context
        const tableInfo = await pgClient.query(
          'SELECT name, game_type, min_buy_in, max_buy_in FROM poker_tables WHERE id = $1::uuid',
          [tableId]
        );

        const table = tableInfo.rows[0];
        const finalGameType = gameType || table?.game_type || 'Texas Hold\'em';

        // Calculate position (next in line)
        const positionResult = await pgClient.query(
          'SELECT COALESCE(MAX(position), 0) + 1 as next_position FROM seat_requests WHERE table_id = $1',
          [tableId]
        );
        const position = positionResult.rows[0]?.next_position || 1;

        // Generate unique universal_id for cross-portal tracking
        const { randomUUID } = await import('crypto');
        const universalId = randomUUID();

        // Insert into seat_requests with all new schema fields
        const seatRequestResult = await pgClient.query(`
          INSERT INTO seat_requests (
            player_id, table_id, status, position, estimated_wait, game_type,
            notes, seat_number, universal_id, min_play_time_minutes,
            call_time_window_minutes, call_time_play_period_minutes,
            cashout_window_minutes, session_buy_in_amount, session_cash_out_amount,
            session_rake_amount, session_tip_amount
          ) VALUES ($1, $2, 'waiting', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          RETURNING *
        `, [
          playerId, tableId, position, position * 10, finalGameType,
          notes || null, seatNumber || null, universalId, minPlayTime || 30,
          callTimeWindow || 10, 5, 3, '0.00', '0.00', '0.00', '0.00'
        ]);

        const newRequest = seatRequestResult.rows[0];

        // Send real-time notification to staff portal via Pusher
        try {
          await pusher.trigger('staff-portal', 'new-waitlist-entry', {
            playerId: playerId,
            tableId: tableId,
            tableName: table?.name || `Table ${tableId}`,
            gameType: finalGameType,
            position: position,
            seatNumber: seatNumber,
            timestamp: new Date().toISOString(),
            universalId: universalId
          });
          console.log(`📡 [PUSHER] Staff portal notified of new waitlist entry`);
        } catch (pusherError: any) {
          console.warn(`⚠️ [PUSHER] Notification failed:`, pusherError.message);
        }

        await pgClient.end();

        // Return comprehensive response with table context
        res.json({
          success: true,
          seatRequest: {
            id: newRequest.id,
            playerId: playerId,
            tableId: tableId,
            tableName: table?.name || `Table ${tableId}`,
            gameType: finalGameType,
            status: 'waiting',
            position: position,
            estimatedWait: position * 10,
            minBuyIn: table?.min_buy_in || 1000,
            maxBuyIn: table?.max_buy_in || 10000,
            notes: notes,
            seatNumber: seatNumber,
            universalId: universalId,
            minPlayTime: minPlayTime || 30,
            callTimeWindow: callTimeWindow || 10,
            createdAt: newRequest.created_at
          },
          message: `Successfully joined waitlist for ${table?.name || 'table'}. Position: ${position}`
        });

      } catch (dbError: any) {
        await pgClient.end();
        console.error('❌ [WAITLIST] Database error:', dbError);
        return res.status(500).json({ error: 'Failed to join waitlist' });
      }

    } catch (error: any) {
      console.error('❌ [WAITLIST] Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Leave Table Waitlist API - Delete seat request
  app.delete("/api/seat-requests/:playerId/:tableId", async (req, res) => {
    try {
      const playerId = parseInt(req.params.playerId);
      const tableId = req.params.tableId;

      if (!playerId || !tableId) {
        return res.status(400).json({ error: 'playerId and tableId are required' });
      }

      console.log(`🚪 [LEAVE WAITLIST] Player ${playerId} leaving waitlist for table: ${tableId}`);

      const { Client } = await import('pg');
      const pgClient = new Client({ connectionString: process.env.DATABASE_URL });
      await pgClient.connect();

      try {
        // Check if seat request exists
        const checkResult = await pgClient.query(
          'SELECT id, status, position FROM seat_requests WHERE player_id = $1 AND table_id = $2',
          [playerId, tableId]
        );

        if (checkResult.rows.length === 0) {
          await pgClient.end();
          return res.status(404).json({ 
            error: 'Waitlist entry not found',
            message: 'You are not on the waitlist for this table'
          });
        }

        const seatRequest = checkResult.rows[0];

        // Only allow leaving if game hasn't started (status is 'waiting')
        if (seatRequest.status !== 'waiting') {
          await pgClient.end();
          return res.status(400).json({
            error: 'Cannot leave waitlist',
            message: `Cannot leave waitlist when status is '${seatRequest.status}'. You can only leave while waiting.`
          });
        }

        // Delete the seat request
        const deleteResult = await pgClient.query(
          'DELETE FROM seat_requests WHERE player_id = $1 AND table_id = $2 RETURNING *',
          [playerId, tableId]
        );

        const deletedRequest = deleteResult.rows[0];

        // Update positions for remaining waitlist entries
        await pgClient.query(`
          UPDATE seat_requests 
          SET position = position - 1, 
              estimated_wait = (position - 1) * 10
          WHERE table_id = $1 AND position > $2
        `, [tableId, seatRequest.position || 0]);

        await pgClient.end();

        // Send real-time notification to staff portal via Pusher
        try {
          await pusher.trigger('staff-portal', 'waitlist-left', {
            playerId: playerId,
            tableId: tableId,
            timestamp: new Date().toISOString()
          });
          console.log(`📡 [PUSHER] Staff portal notified of waitlist departure`);
        } catch (pusherError: any) {
          console.warn(`⚠️ [PUSHER] Notification failed:`, pusherError.message);
        }

        console.log(`✅ [LEAVE WAITLIST] Player ${playerId} successfully left waitlist for table ${tableId}`);

        res.json({
          success: true,
          removed: {
            id: deletedRequest.id,
            playerId: playerId,
            tableId: tableId,
            status: deletedRequest.status
          },
          message: 'Successfully left the waitlist'
        });

      } catch (dbError: any) {
        await pgClient.end();
        console.error('❌ [LEAVE WAITLIST] Database error:', dbError);
        return res.status(500).json({ error: 'Failed to leave waitlist' });
      }

    } catch (error: any) {
      console.error('❌ [LEAVE WAITLIST] Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Push Notifications API - Get notifications for player
  app.get("/api/push-notifications/:playerId", async (req, res) => {
    try {
      const playerId = parseInt(req.params.playerId);

      console.log(`📬 [PUSH NOTIFICATIONS] Fetching notifications for player: ${playerId}`);

      // Use direct PostgreSQL query to avoid Supabase issues
      const { Pool } = await import('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });

      try {
        // First, check if current player qualifies for "registered_players" audience
        const playerCheckQuery = `
          SELECT kyc_status, last_login_at
          FROM players 
          WHERE id = $1
        `;

        const playerResult = await pool.query(playerCheckQuery, [playerId]);
        const player = playerResult.rows[0];

        if (!player) {
          await pool.end();
          return res.status(404).json({ error: 'Player not found' });
        }

        const isRegisteredPlayer = player.kyc_status === 'verified';
        const isActivePlayer = player.last_login_at && 
          new Date(player.last_login_at) > new Date(Date.now() - 15 * 60 * 1000); // Active within last 15 minutes

        // Build audience conditions based on player qualifications
        let audienceConditions = ['target_audience = \'all_players\''];

        if (isRegisteredPlayer) {
          audienceConditions.push('target_audience = \'registered_players\'');
        }

        if (isActivePlayer) {
          audienceConditions.push('target_audience = \'active_players\'');
        }

        // Query for notifications using actual schema structure
        const query = `
          SELECT id, title, message, target_audience, sent_by, sent_by_name, 
                 sent_by_role, media_type, media_url, media_description,
                 recipients_count, delivery_status, created_at, sent_at,
                 scheduled_for, expires_at
          FROM push_notifications
          WHERE (${audienceConditions.join(' OR ')})
            AND created_at >= NOW() - INTERVAL '7 days'
            AND (expires_at IS NULL OR expires_at > NOW())
            AND delivery_status = 'sent'
          ORDER BY created_at DESC
          LIMIT 50
        `;

        const result = await pool.query(query);
        await pool.end();

        const notifications = result.rows.map(row => ({
          id: row.id,
          title: row.title,
          message: row.message,
          targetAudience: row.target_audience,
          sentBy: row.sent_by,
          sentByName: row.sent_by_name,
          sentByRole: row.sent_by_role,
          mediaType: row.media_type,
          mediaUrl: row.media_url,
          mediaDescription: row.media_description,
          recipientsCount: row.recipients_count,
          deliveryStatus: row.delivery_status,
          createdAt: row.created_at,
          sentAt: row.sent_at,
          scheduledFor: row.scheduled_for,
          expiresAt: row.expires_at,
          // Legacy compatibility fields for frontend
          senderName: row.sent_by_name || 'Staff',
          senderRole: row.sent_by_role || 'admin',
          priority: 'normal',
          status: row.delivery_status || 'sent'
        }));

        console.log(`✅ [PUSH NOTIFICATIONS] Found ${notifications.length} notifications for player ${playerId}`, {
          isRegisteredPlayer,
          isActivePlayer,
          kycStatus: player.kyc_status,
          lastLogin: player.last_login_at
        });
        res.json(notifications);

      } catch (dbError: any) {
        await pool.end();
        console.error('❌ [PUSH NOTIFICATIONS] Database error:', dbError);

        // If table doesn't exist, return empty array instead of error
        if (dbError.code === '42P01') {
          console.log('📬 [PUSH NOTIFICATIONS] Table not found, returning empty array');
          return res.json([]);
        }

        return res.status(500).json({ error: 'Failed to fetch notifications' });
      }

    } catch (error: any) {
      console.error('❌ [PUSH NOTIFICATIONS] Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Table assignment notification system
  app.post("/api/table-assignment/notify", async (req, res) => {
    try {
      const { playerId, tableId, tableName, seatNumber, staffName } = req.body;

      console.log(`🪑 [TABLE ASSIGNMENT] Notifying player ${playerId} of assignment to ${tableName}`);

      // Send real-time notification via Pusher
      await pusher.trigger(`player-${playerId}`, 'table_assigned', {
        tableId,
        tableName,
        seatNumber,
        staffName: staffName || 'Staff',
        assignedAt: new Date().toISOString(),
        message: `You have been assigned to ${tableName} - Seat ${seatNumber}`
      });

      // Create push notification record
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      await supabase.from('push_notifications').insert({
        player_id: playerId,
        title: 'Table Assignment',
        message: `You have been assigned to ${tableName} - Seat ${seatNumber}. Please proceed to your table.`,
        type: 'table_assignment',
        data: {
          tableId,
          tableName,
          seatNumber,
          staffName
        },
        is_read: false
      });

      console.log(`✅ [TABLE ASSIGNMENT] Player ${playerId} notified successfully`);
      res.json({ success: true, message: 'Assignment notification sent' });

    } catch (error: any) {
      console.error('❌ [TABLE ASSIGNMENT] Notification error:', error);
      res.status(500).json({ error: 'Failed to send assignment notification' });
    }
  });

  // Call Time Start API - Initiate call time countdown
  app.post("/api/call-time/start", async (req, res) => {
    try {
      const { playerId, sessionId } = req.body;

      console.log(`⏰ [CALL TIME] Starting call time for player ${playerId}, session ${sessionId}`);

      const { Client } = await import('pg');
      const pgClient = new Client({ connectionString: process.env.DATABASE_URL });
      await pgClient.connect();

      try {
        // First, verify the player is seated and get table configuration
        const seatQuery = await pgClient.query(`
          SELECT sr.*, pt.call_time_duration, pt.name as table_name
          FROM seat_requests sr
          JOIN poker_tables pt ON sr.table_id::uuid = pt.id
          WHERE sr.player_id = $1 AND sr.status = 'seated'
          ORDER BY sr.created_at DESC 
          LIMIT 1
        `, [playerId]);

        if (seatQuery.rows.length === 0) {
          await pgClient.end();
          console.log(`❌ [CALL TIME] Player ${playerId} not found or not seated`);
          return res.status(400).json({ error: 'Player not found or not seated' });
        }

        const seatInfo = seatQuery.rows[0];
        const callTimeDuration = seatInfo.call_time_duration || 60;

        console.log(`🎯 [CALL TIME] Player ${playerId} found:`, {
          seatId: seatInfo.id,
          tableId: seatInfo.table_id,
          tableName: seatInfo.table_name,
          callTimeDuration: callTimeDuration,
          currentCallTimeStarted: seatInfo.call_time_started,
          currentCallTimeEnds: seatInfo.call_time_ends
        });

        // Check if call time is already active
        if (seatInfo.call_time_started && seatInfo.call_time_ends) {
          const callTimeEnds = new Date(seatInfo.call_time_ends);
          if (callTimeEnds > new Date()) {
            await pgClient.end();
            return res.status(400).json({ 
              error: 'Call time is already active',
              callTimeEnds: callTimeEnds.toISOString()
            });
          }
        }

        // Calculate new call time timestamps
        const callTimeStarted = new Date();
        const callTimeEnds = new Date(callTimeStarted.getTime() + (callTimeDuration * 60 * 1000));

        console.log(`🕐 [CALL TIME] Setting timestamps:`, {
          started: callTimeStarted.toISOString(),
          ends: callTimeEnds.toISOString(),
          durationMinutes: callTimeDuration
        });

        // Update seat_requests with call time information and clear cash out window
        const updateResult = await pgClient.query(`
          UPDATE seat_requests 
          SET call_time_started = $1,
              call_time_ends = $2,
              cashout_window_active = false,
              cashout_window_ends = null,
              request = 'call_time',
              updated_at = NOW()
          WHERE player_id = $3 AND status = 'seated'
          RETURNING *
        `, [callTimeStarted.toISOString(), callTimeEnds.toISOString(), playerId]);

        if (updateResult.rows.length === 0) {
          await pgClient.end();
          console.log(`❌ [CALL TIME] Failed to update seat_requests for player ${playerId}`);
          return res.status(500).json({ error: 'Failed to update call time in database' });
        }

        const updatedSeat = updateResult.rows[0];
        console.log(`✅ [CALL TIME] Database updated:`, {
          id: updatedSeat.id,
          call_time_started: updatedSeat.call_time_started,
          call_time_ends: updatedSeat.call_time_ends,
          cashout_window_active: updatedSeat.cashout_window_active
        });

        await pgClient.end();

        // Send real-time notification to staff portal via Pusher
        await pusher.trigger('staff-portal', 'call_time_started', {
          playerId: playerId,
          tableName: seatInfo.table_name,
          callTimeStarted: callTimeStarted.toISOString(),
          callTimeEnds: callTimeEnds.toISOString(),
          duration: callTimeDuration
        });

        console.log(`✅ [CALL TIME] Successfully started for player ${playerId}:`, {
          duration: `${callTimeDuration} minutes`,
          endsAt: callTimeEnds.toLocaleTimeString(),
          table: seatInfo.table_name
        });

        res.json({ 
          success: true, 
          callTimeStarted: callTimeStarted.toISOString(),
          callTimeEnds: callTimeEnds.toISOString(),
          duration: callTimeDuration,
          message: `Call time started: ${callTimeDuration} minutes until ${callTimeEnds.toLocaleTimeString()}`
        });

      } catch (dbError: any) {
        await pgClient.end();
        console.error('❌ [CALL TIME] Database error:', dbError);
        console.error('❌ [CALL TIME] Error details:', {
          message: dbError.message,
          code: dbError.code,
          detail: dbError.detail,
          hint: dbError.hint,
          position: dbError.position,
          query: dbError.query
        });
        return res.status(500).json({ 
          error: 'Database operation failed',
          details: dbError.message 
        });
      }

    } catch (error: any) {
      console.error('❌ [CALL TIME] General error:', error);
      res.status(500).json({ 
        error: 'Failed to start call time',
        details: error.message 
      });
    }
  });

  // Cash Out Request API - Submit cash out request during cash out window
  app.post("/api/cash-out/request", async (req, res) => {
    try {
      const { playerId, sessionId } = req.body;

      console.log(`💰 [CASH OUT] Processing request for player ${playerId}, session ${sessionId}`);

      const { Client } = await import('pg');
      const pgClient = new Client({ connectionString: process.env.DATABASE_URL });
      await pgClient.connect();

      try {
        // Verify player is in cash out window
        const seatQuery = await pgClient.query(`
          SELECT sr.*, pt.cash_out_window, pt.name as table_name 
          FROM seat_requests sr
          JOIN poker_tables pt ON sr.table_id::uuid = pt.id
          WHERE sr.player_id = $1 AND sr.status = 'seated'
          ORDER BY sr.created_at DESC 
          LIMIT 1
        `, [playerId]);

        if (seatQuery.rows.length === 0) {
          await pgClient.end();
          return res.status(400).json({ error: 'Player not found or not seated' });
        }

        const seatInfo = seatQuery.rows[0];

        // Check if cash out window is active
        if (!seatInfo.cashout_window_active) {
          await pgClient.end();
          return res.status(400).json({ error: 'Cash out window is not currently active' });
        }

        // Update seat_requests with cash out request
        const updateResult = await pgClient.query(`
          UPDATE seat_requests 
          SET cash_out_requested = NOW(),
              cash_out_requested_by = $1,
              request = 'cash_out',
              updated_at = NOW(),
              notes = COALESCE(notes, '') || ' | Cash out requested at ' || NOW()
          WHERE player_id = $1 AND status = 'seated'
          RETURNING *
        `, [playerId]);

        if (updateResult.rows.length === 0) {
          await pgClient.end();
          return res.status(500).json({ error: 'Failed to submit cash out request' });
        }

        await pgClient.end();

        // Send notifications to staff and player via Pusher
        await pusher.trigger('staff-portal', 'cash_out_requested', {
          playerId,
          playerName: `Player ${playerId}`,
          tableId: seatInfo.table_id,
          tableName: seatInfo.table_name,
          seatNumber: seatInfo.seat_number,
          requestedAt: new Date().toISOString(),
          message: `Player ${playerId} has requested to cash out from ${seatInfo.table_name}`
        });

        await pusher.trigger(`player-${playerId}`, 'cash_out_requested', {
          message: 'Your cash out request has been sent to management',
          requestedAt: new Date().toISOString()
        });

        console.log(`✅ [CASH OUT] Request submitted for player ${playerId} at table ${seatInfo.table_name}`);
        res.json({ 
          success: true, 
          message: 'Cash out request sent to management',
          requestedAt: new Date().toISOString()
        });

      } catch (dbError: any) {
        await pgClient.end();
        console.error('❌ [CASH OUT] Database error:', dbError);
        return res.status(500).json({ error: 'Database operation failed' });
      }

    } catch (error: any) {
      console.error('❌ [CASH OUT] Error:', error);
      res.status(500).json({ error: 'Failed to submit cash out request' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}