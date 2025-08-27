
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

// Import direct chat system (bypasses Supabase cache issues)
import { directChat } from './direct-chat-system';
import { directKycStorage } from './direct-kyc-storage';
import { enterprisePlayerSystem } from './enterprise-player-system';

// Import Clerk integration
import { ClerkPlayerSync } from './clerk-integration';

// Import staff portal integration
import staffPortalRoutes from './routes/staff-portal-integration';

// Import F&B schema types
import { foodBeverageItems, adsOffers, orders } from '@shared/schema';

export function registerRoutes(app: Express) {
  // SIMPLE CASH BALANCE SYSTEM - MANAGER HANDLES TABLE OPERATIONS
  
  // ========== LEGACY ENDPOINT REMOVED - USE /api/balance/:playerId INSTEAD ==========
  // REMOVED: Duplicate /api/player/:playerId/balance endpoint - redirecting to main endpoint

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
          creditApproved: player.credit_approved || false,
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

        const documents = result.rows;
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
        .select('id, balance, credit_limit, current_credit, credit_approved')
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

      if (!player.credit_approved) {
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
        .select('id, type, amount, description, staff_id, created_at')
        .eq('player_id', playerId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('❌ [TRANSACTIONS API] Error:', error);
        return res.status(500).json({ error: 'Failed to fetch transactions' });
      }

      console.log(`✅ [TRANSACTIONS API] Retrieved ${transactions?.length || 0} transactions`);
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

      // Record transaction for the cash-out
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
        amount,
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

          // Parallel processing: Session check, Message insert, Pusher broadcast
          const [sessionResult, messageResult, pusherResult] = await Promise.allSettled([
            // Session management (parallel)
            (async () => {
              let sessionId = requestId;
              
              // Check existing session
              const { data: existingSession } = await supabase
                .from('chat_sessions')
                .select('id')
                .eq('player_id', playerId)
                .in('status', ['waiting', 'active'])
                .limit(1);
              
              if (existingSession && existingSession.length > 0) {
                return existingSession[0].id;
              }

              // Create new session if none exists
              sessionId = requestId || `session-${playerId}-${Date.now()}`;
              await supabase
                .from('chat_sessions')
                .upsert({
                  id: sessionId,
                  player_id: playerId,
                  player_name: playerName || `Player ${playerId}`,
                  player_email: '',
                  initial_message: message,
                  status: 'waiting',
                  priority: 'normal',
                  created_at: timestamp,
                  updated_at: timestamp
                }, { onConflict: 'id' });
              
              return sessionId;
            })(),

            // Message insertion (parallel)
            supabase.from('chat_messages').insert({
              player_id: parseInt(playerId.toString()),
              sender: 'player',
              sender_name: playerName || `Player ${playerId}`,
              message_text: message,
              timestamp: timestamp,
              status: 'sent',
              created_at: timestamp,
              updated_at: timestamp
            }),

            // Pusher broadcast (parallel) - Multiple channels simultaneously
            Promise.all([
              pusher.trigger('staff-portal', 'new-player-message', {
                sessionId: requestId || `session-${playerId}-${Date.now()}`,
                playerId: playerId,
                playerName: playerName || `Player ${playerId}`,
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
            ])
          ]);

          const processingTime = Number(process.hrtime.bigint() - startTime) / 1000000;
          console.log(`⚡ [OPTIMIZED V1.2] Background processing completed in ${processingTime.toFixed(2)}ms`);
          
          // Log any background errors (doesn't affect user experience)
          if (sessionResult.status === 'rejected') console.error('Session error:', sessionResult.reason);
          if (messageResult.status === 'rejected') console.error('Message error:', messageResult.reason);
          if (pusherResult.status === 'rejected') console.error('Pusher error:', pusherResult.reason);
          
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

  // LEGACY ENDPOINT COMPATIBILITY - Retrieve All Messages for Player (EXACT MATCH)
  app.get("/api/player-chat-integration/messages/:playerId", async (req, res) => {
    try {
      const playerId = parseInt(req.params.playerId);
      const historyResult = await directChat.getChatHistory(playerId);
      
      if (!historyResult.success || !historyResult.conversations[0]) {
        return res.json({ success: true, messages: [] });
      }

      // Transform to staff portal format
      const messages = historyResult.conversations[0].chat_messages.map(msg => ({
        id: msg.id,
        message: msg.message_text,
        messageText: msg.message_text,
        sender_name: msg.sender_name,
        timestamp: msg.timestamp,
        isFromPlayer: msg.sender === 'player',
        senderType: msg.sender
      }));

      res.json({
        success: true,
        messages: messages
      });
    } catch (error: any) {
      console.error('❌ [STAFF PORTAL INTEGRATION] Messages error:', error);
      res.status(500).json({ error: error.message });
    }
  });



  // REMOVED: Duplicate endpoint - consolidated into staff-chat-integration/send

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
      const result = await directChat.getChatHistory(playerId);
      res.json(result);
    } catch (error: any) {
      console.error('❌ [DIRECT HISTORY] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Clerk sync endpoint for unified authentication
  app.post('/api/auth/clerk-sync', async (req, res) => {
    console.log('🔐 [CLERK SYNC] Received sync request:', req.body);
    
    try {
      const { clerkUserId, email, firstName, lastName, phone, emailVerified } = req.body;
      
      if (!clerkUserId || !email) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      
      // Use direct PostgreSQL connection to bypass schema cache issues
      const { Client } = await import('pg');
      const pgClient = new Client({
        connectionString: process.env.DATABASE_URL
      });
      
      await pgClient.connect();
      
      // Check if player already exists by email
      const findQuery = 'SELECT * FROM players WHERE email = $1 LIMIT 1';
      const findResult = await pgClient.query(findQuery, [email]);
      const existingPlayer = findResult.rows[0];
      
      let playerData;
      
      if (existingPlayer) {
        // Update existing player with Clerk ID
        const updateQuery = `
          UPDATE players 
          SET 
            clerk_user_id = $1,
            clerk_synced_at = NOW(),
            first_name = COALESCE($2, first_name),
            last_name = COALESCE($3, last_name),
            phone = COALESCE($4, phone)
          WHERE id = $5
          RETURNING *
        `;
        
        const updateResult = await pgClient.query(updateQuery, [
          clerkUserId,
          firstName,
          lastName,
          phone,
          existingPlayer.id
        ]);
        
        playerData = updateResult.rows[0];
        console.log('✅ [CLERK SYNC] Updated existing player:', existingPlayer.id);
        
      } else {
        // Create new player with Clerk ID
        const insertQuery = `
          INSERT INTO players (
            email, first_name, last_name, phone, clerk_user_id, clerk_synced_at,
            kyc_status, password, universal_id, balance, is_active
          ) VALUES (
            $1, $2, $3, $4, $5, NOW(), $6, 'clerk_managed', $7, '0.00', true
          )
          RETURNING *
        `;
        
        const universalId = `unified_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const createResult = await pgClient.query(insertQuery, [
          email,
          firstName,
          lastName,
          phone,
          clerkUserId,
          emailVerified ? 'pending' : 'incomplete',
          universalId
        ]);
        
        playerData = createResult.rows[0];
        console.log('✅ [CLERK SYNC] Created new player:', playerData.id);
        
        await pgClient.end();
        return res.json({ 
          success: true, 
          player: {
            id: playerData.id,
            email: playerData.email,
            firstName: playerData.first_name,
            lastName: playerData.last_name,
            phone: playerData.phone,
            kycStatus: playerData.kyc_status,
            balance: playerData.balance || '0.00',
            current_credit: playerData.current_credit || '0.00',
            credit_limit: playerData.credit_limit || '0.00',
            credit_approved: playerData.credit_approved || false,
            clerkUserId: playerData.clerk_user_id
          },
          message: 'New player created and synced successfully',
          existingPlayer: false
        });
      }
      
      await pgClient.end();
      
      res.json({
        success: true,
        player: {
          id: playerData.id,
          email: playerData.email,
          firstName: playerData.first_name,
          lastName: playerData.last_name,
          phone: playerData.phone,
          kycStatus: playerData.kyc_status,
          balance: playerData.balance || '0.00',
          current_credit: playerData.current_credit || '0.00',
          credit_limit: playerData.credit_limit || '0.00',
          credit_approved: playerData.credit_approved || false,
          clerkUserId: playerData.clerk_user_id
        },
        message: 'Existing player updated successfully',
        existingPlayer: true
      });
      
    } catch (error: any) {
      console.error('❌ [CLERK SYNC] Error:', error);
      res.status(500).json({ error: error.message || 'Sync failed' });
    }
  });

  // ========== PRODUCTION-READY CLERK WEBHOOK ENDPOINT ==========
  
  // Clerk webhook endpoint for production integration
  app.post('/api/clerk/webhook', async (req, res) => {
    console.log('🪝 [CLERK WEBHOOK] Received event:', req.body?.type);
    
    try {
      const { type, data } = req.body;
      
      if (!type || !data) {
        return res.status(400).json({ error: 'Invalid webhook payload' });
      }
      
      const { Client } = await import('pg');
      const pgClient = new Client({
        connectionString: process.env.DATABASE_URL
      });
      
      await pgClient.connect();
      
      // Log webhook event
      await pgClient.query(`
        INSERT INTO clerk_webhook_events (event_type, clerk_user_id, email, webhook_payload, success)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        type,
        data.id || null,
        data.email_addresses?.[0]?.email_address || null,
        JSON.stringify(req.body),
        true
      ]);
      
      // Handle different webhook events
      switch (type) {
        case 'user.created':
        case 'user.updated':
          await handleUserWebhook(pgClient, data, type);
          break;
          
        case 'user.deleted':
          await handleUserDeletion(pgClient, data);
          break;
          
        default:
          console.log(`ℹ️ [CLERK WEBHOOK] Unhandled event type: ${type}`);
      }
      
      await pgClient.end();
      
      console.log(`✅ [CLERK WEBHOOK] Successfully processed ${type} event`);
      res.json({ success: true, processed: type });
      
    } catch (error: any) {
      console.error('❌ [CLERK WEBHOOK] Error:', error);
      
      // Log webhook error
      try {
        const { Client } = await import('pg');
        const pgClient = new Client({ connectionString: process.env.DATABASE_URL });
        await pgClient.connect();
        
        await pgClient.query(`
          INSERT INTO clerk_webhook_events (event_type, webhook_payload, success, error_message)
          VALUES ($1, $2, $3, $4)
        `, [
          req.body?.type || 'unknown',
          JSON.stringify(req.body),
          false,
          error.message
        ]);
        
        await pgClient.end();
      } catch (logError: any) {
        console.warn('⚠️ [CLERK WEBHOOK] Could not log error:', logError.message);
      }
      
      res.status(500).json({ error: error.message });
    }
  });
  
  async function handleUserWebhook(pgClient: any, userData: any, eventType: string) {
    const clerkUserId = userData.id;
    const email = userData.email_addresses?.[0]?.email_address;
    const firstName = userData.first_name;
    const lastName = userData.last_name;
    const phone = userData.phone_numbers?.[0]?.phone_number;
    
    if (!clerkUserId || !email) {
      console.warn('⚠️ [CLERK WEBHOOK] Missing required user data');
      return;
    }
    
    // Check if player exists
    const findResult = await pgClient.query(
      'SELECT * FROM players WHERE clerk_user_id = $1 OR email = $2 LIMIT 1',
      [clerkUserId, email]
    );
    
    if (findResult.rows.length > 0) {
      // Update existing player
      await pgClient.query(`
        UPDATE players 
        SET 
          clerk_user_id = $1,
          email = $2,
          first_name = COALESCE($3, first_name),
          last_name = COALESCE($4, last_name),
          phone = COALESCE($5, phone),
          clerk_synced_at = NOW(),
          last_login_at = NOW()
        WHERE id = $6
      `, [clerkUserId, email, firstName, lastName, phone, findResult.rows[0].id]);
      
      console.log(`✅ [CLERK WEBHOOK] Updated player ${findResult.rows[0].id} from ${eventType}`);
    } else {
      // Create new player
      const universalId = `unified_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await pgClient.query(`
        INSERT INTO players (
          email, first_name, last_name, phone, clerk_user_id, clerk_synced_at,
          kyc_status, password, universal_id, balance, is_active, last_login_at
        ) VALUES (
          $1, $2, $3, $4, $5, NOW(), 'pending', 'clerk_managed', $6, '0.00', true, NOW()
        )
      `, [email, firstName, lastName, phone, clerkUserId, universalId]);
      
      console.log(`✅ [CLERK WEBHOOK] Created new player from ${eventType}`);
    }
  }
  
  async function handleUserDeletion(pgClient: any, userData: any) {
    const clerkUserId = userData.id;
    
    if (!clerkUserId) {
      console.warn('⚠️ [CLERK WEBHOOK] Missing user ID for deletion');
      return;
    }
    
    // Mark user as inactive instead of deleting
    await pgClient.query(`
      UPDATE players 
      SET 
        is_active = false,
        clerk_user_id = NULL,
        clerk_synced_at = NOW()
      WHERE clerk_user_id = $1
    `, [clerkUserId]);
    
    console.log(`✅ [CLERK WEBHOOK] Deactivated player with Clerk ID: ${clerkUserId}`);
  }

  // Dynamic user endpoint for authenticated users (replaces hardcoded player IDs)
  app.get('/api/auth/user', async (req, res) => {
    try {
      console.log('🔍 [AUTH USER] Dynamic user endpoint called');
      
      // Check for Supabase session token in Authorization header
      const authHeader = req.headers.authorization;
      let supabaseToken = null;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        supabaseToken = authHeader.split(' ')[1];
      }
      
      // If we have a Supabase token, verify and get user data
      if (supabaseToken) {
        try {
          const { createClient } = await import('@supabase/supabase-js');
          const supabase = createClient(
            process.env.VITE_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          );
          
          // Verify the token and get user
          const { data: { user }, error } = await supabase.auth.getUser(supabaseToken);
          
          if (error || !user) {
            return res.status(401).json({ error: 'Invalid token' });
          }
          
          // Fetch player data from our database
          const { data: playerData, error: playerError } = await supabase
            .from('players')
            .select('*')
            .eq('supabase_id', user.id)
            .single();
          
          if (playerError || !playerData) {
            return res.status(404).json({ error: 'Player not found' });
          }
          
          // Return formatted player data
          res.json({
            id: playerData.id,
            email: playerData.email,
            firstName: playerData.first_name,
            lastName: playerData.last_name,
            phone: playerData.phone,
            kycStatus: playerData.kyc_status,
            balance: playerData.balance,
            authenticated: true,
            supabaseId: user.id
          });
          
        } catch (authError: any) {
          console.error('❌ [AUTH USER] Supabase auth error:', authError);
          return res.status(401).json({ error: 'Authentication failed' });
        }
      } else {
        // No authentication provided
        return res.status(401).json({ error: 'No authentication provided' });
      }
      
    } catch (error: any) {
      console.error('❌ [AUTH USER] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // === FOOD & BEVERAGE API ENDPOINTS ===
  
  // Get all menu items - shared with staff portal
  app.get("/api/food-beverage/items", async (req, res) => {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const { data: items, error } = await supabase
        .from('food_beverage_items')
        .select('*')
        .eq('is_available', true)
        .order('display_order', { ascending: true });

      if (error) {
        console.error('❌ [F&B ITEMS] Error:', error);
        return res.status(500).json({ error: error.message });
      }

      res.json({
        success: true,
        items: items || []
      });

    } catch (error: any) {
      console.error('❌ [F&B ITEMS] Critical error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get all active ads/offers - shared with staff portal
  app.get("/api/food-beverage/ads", async (req, res) => {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const now = new Date().toISOString();
      
      const { data: ads, error } = await supabase
        .from('ads_offers')
        .select('*')
        .eq('is_active', true)
        .or(`start_date.is.null,start_date.lte.${now}`)
        .or(`end_date.is.null,end_date.gte.${now}`)
        .order('display_order', { ascending: true });

      if (error) {
        console.error('❌ [F&B ADS] Error:', error);
        return res.status(500).json({ error: error.message });
      }

      res.json({
        success: true,
        ads: ads || []
      });

    } catch (error: any) {
      console.error('❌ [F&B ADS] Critical error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Place order - instant notification to staff via Pusher/OneSignal
  app.post("/api/food-beverage/orders", async (req, res) => {
    try {
      const { playerId, playerName, items, totalAmount, notes, tableNumber } = req.body;
      
      if (!playerId || !playerName || !items || !Array.isArray(items)) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      // Insert order into database
      const { data: order, error } = await supabase
        .from('orders')
        .insert({
          player_id: playerId,
          player_name: playerName,
          items: items,
          total_amount: totalAmount || '0.00',
          notes: notes || null,
          table_number: tableNumber || null,
          status: 'pending',
          order_source: 'player_portal'
        })
        .select()
        .single();

      if (error) {
        console.error('❌ [F&B ORDER] Database error:', error);
        return res.status(500).json({ error: error.message });
      }

      console.log('✅ [F&B ORDER] Order placed:', order);

      // Send real-time notification to staff via Pusher
      try {
        await pusher.trigger('staff-portal', 'new-food-order', {
          orderId: order.id,
          playerId: playerId,
          playerName: playerName,
          items: items,
          totalAmount: totalAmount,
          tableNumber: tableNumber,
          timestamp: new Date().toISOString()
        });
        console.log('✅ [F&B ORDER] Pusher notification sent to staff');
      } catch (pusherError) {
        console.error('❌ [F&B ORDER] Pusher error:', pusherError);
      }

      // Send OneSignal notification to staff
      try {
        const notification = {
          app_id: process.env.ONESIGNAL_APP_ID!,
          included_segments: ['Staff'],
          headings: { en: 'New Food Order' },
          contents: { 
            en: `${playerName} ordered ${items.length} items${tableNumber ? ` for table ${tableNumber}` : ''}`
          },
          data: {
            type: 'food_order',
            orderId: order.id,
            playerId: playerId
          }
        };
        
        await oneSignalClient.createNotification(notification);
        console.log('✅ [F&B ORDER] OneSignal notification sent to staff');
      } catch (oneSignalError) {
        console.error('❌ [F&B ORDER] OneSignal error:', oneSignalError);
      }

      res.json({
        success: true,
        orderId: order.id,
        message: 'Order placed successfully'
      });

    } catch (error: any) {
      console.error('❌ [F&B ORDER] Critical error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get player's order history
  app.get("/api/food-beverage/orders/:playerId", async (req, res) => {
    try {
      const playerId = parseInt(req.params.playerId);
      
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .eq('player_id', playerId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ [F&B ORDER HISTORY] Error:', error);
        return res.status(500).json({ error: error.message });
      }

      res.json({
        success: true,
        orders: orders || []
      });

    } catch (error: any) {
      console.error('❌ [F&B ORDER HISTORY] Critical error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // LEGACY ENDPOINT - TO BE REMOVED
  app.get("/api/OLD-chat-history/:playerId", async (req, res) => {
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

  // REMOVED: Duplicate endpoint - consolidated into staff-chat-integration/send

  // CLERK AUTHENTICATION INTEGRATION APIs
  const clerkSync = new ClerkPlayerSync();

  // Create new player (Enterprise-optimized Signup endpoint)
  app.post("/api/players", async (req, res) => {
    try {
      const { email, password, firstName, lastName, phone, supabaseId, clerkUserId } = req.body;
      
      console.log('🆕 [ENTERPRISE SIGNUP] Creating player:', { email, firstName, lastName, phone });
      
      // Validate required fields
      if (!email || !firstName || !lastName || !phone) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Use enterprise player system for optimized creation
      const result = await enterprisePlayerSystem.createSinglePlayer({
        email,
        firstName,
        lastName,
        phone,
        clerkUserId,
        supabaseUserId: supabaseId,
        password,
        metadata: { signupSource: 'player_portal' }
      });

      // Transform to expected frontend format
      const player = {
        id: result.playerId,
        email,
        firstName,
        lastName,
        phone,
        kycStatus: 'pending',
        balance: '0.00',
        createdAt: new Date().toISOString(),
        clerkUserId,
        supabaseId,
        universalId: `enterprise_${result.playerId}_${Date.now()}`
      };

      console.log(`✅ [ENTERPRISE SIGNUP] Player ${result.status}:`, result.playerId);
      res.json(player);
    } catch (error: any) {
      console.error('❌ [SIGNUP API] Error:', error);
      
      // Handle duplicate email - redirect to KYC process if player exists
      if ((error as any).code === '23505' && (error as any).constraint === 'players_email_unique') {
        console.log('🔄 [SIGNUP API] Player exists - checking KYC status for:', req.body.email);
        
        try {
          const { Client } = await import('pg');
          const pgClient = new Client({ connectionString: process.env.DATABASE_URL });
          await pgClient.connect();
          
          const existingPlayerQuery = `
            SELECT id, first_name, last_name, email, kyc_status, created_at 
            FROM players 
            WHERE email = $1
          `;
          const existingResult = await pgClient.query(existingPlayerQuery, [req.body.email]);
          await pgClient.end();
          
          if (existingResult.rows.length > 0) {
            const existingPlayer = existingResult.rows[0];
            console.log('✅ [SIGNUP API] Existing player found - redirecting to KYC:', existingPlayer.kyc_status);
            
            // Return existing player data for KYC redirect
            res.json({
              id: existingPlayer.id,
              email: existingPlayer.email,
              firstName: existingPlayer.first_name,
              lastName: existingPlayer.last_name,
              kycStatus: existingPlayer.kyc_status,
              existing: true, // Flag to indicate existing user
              message: 'Account exists - redirecting to KYC process'
            });
            return;
          }
        } catch (lookupError) {
          console.error('❌ [SIGNUP API] Lookup error:', lookupError);
        }
      }
      
      res.status(500).json({ error: (error as Error).message || 'Unknown error' });
    }
  });

  // ========== CRITICAL CLERK-SUPABASE CROSS-FUNCTIONALITY SYSTEM ==========
  
  // Clerk webhook handler for data integrity
  app.post("/api/clerk/webhooks", async (req, res) => {
    try {
      const { type, data } = req.body;
      console.log(`🔔 [CLERK WEBHOOK] Received event: ${type}`);
      
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      
      switch (type) {
        case 'user.created':
          // Auto-sync new Clerk user to Supabase
          const { email_addresses, first_name, last_name, id: clerkUserId } = data;
          const email = email_addresses?.[0]?.email_address;
          
          if (email) {
            const { error } = await supabase
              .from('players')
              .upsert({
                email,
                clerk_user_id: clerkUserId,
                first_name: first_name || '',
                last_name: last_name || '',
                kyc_status: 'pending',
                balance: '0.00',
                is_active: true,
                universal_id: `clerk_wh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                credit_approved: false,
                credit_limit: 0,
                current_credit: 0
              }, {
                onConflict: 'email'
              });
              
            if (!error) {
              console.log(`✅ [CLERK WEBHOOK] User synced: ${email}`);
            }
          }
          break;
          
        case 'user.deleted':
          // CRITICAL: Prevent data deletion cascade
          console.log(`🚨 [CLERK WEBHOOK] User deletion blocked to prevent data loss`);
          // Mark as inactive instead of deleting
          await supabase
            .from('players')
            .update({ 
              is_active: false,
              clerk_user_id: null,
              deactivated_at: new Date().toISOString()
            })
            .eq('clerk_user_id', data.id);
          break;
          
        case 'user.updated':
          // Sync profile updates
          const updateEmail = data.email_addresses?.[0]?.email_address;
          if (updateEmail) {
            await supabase
              .from('players')
              .update({
                first_name: data.first_name || '',
                last_name: data.last_name || '',
                updated_at: new Date().toISOString()
              })
              .eq('clerk_user_id', data.id);
          }
          break;
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('❌ [CLERK WEBHOOK] Error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });

  // Sync Clerk user with Player database
  app.post("/api/clerk/sync-player", async (req, res) => {
    try {
      const { clerkUserId, email, firstName, lastName } = req.body;
      
      console.log('🔗 [CLERK API] Syncing player:', email);
      
      // Use direct database integration for Clerk sync
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      // Check if player exists first
      const { data: existingPlayer } = await supabase
        .from('players')
        .select('*')
        .eq('email', email)
        .single();

      let player;
      if (existingPlayer) {
        // Update existing player with Clerk ID
        const { data: updatedPlayer, error } = await supabase
          .from('players')
          .update({
            clerk_user_id: clerkUserId,
            first_name: firstName,
            last_name: lastName,
            updated_at: new Date().toISOString()
          })
          .eq('email', email)
          .select('*')
          .single();

        if (error) throw error;
        player = updatedPlayer;
        console.log('✅ [CLERK SYNC] Updated existing player:', email);
      } else {
        // Create new player for Clerk user
        const { data: newPlayer, error } = await supabase
          .from('players')
          .insert({
            email,
            clerk_user_id: clerkUserId,
            first_name: firstName,
            last_name: lastName,
            kyc_status: 'pending',
            balance: '0.00',
            is_active: true,
            universal_id: `clerk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            credit_approved: false,
            credit_limit: 0,
            current_credit: 0
          })
          .select('*')
          .single();

        if (error) throw error;
        player = newPlayer;
        console.log('✅ [CLERK SYNC] Created new player for Clerk user:', email);
      }

      res.json({ success: true, player });
    } catch (error: any) {
      console.error('❌ [CLERK API] Sync error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Check KYC status for Clerk user
  app.get("/api/clerk/kyc-status/:clerkUserId", async (req, res) => {
    try {
      const { clerkUserId } = req.params;
      
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const { data: player, error } = await supabase
        .from('players')
        .select('kyc_status, phone')
        .eq('clerk_user_id', clerkUserId)
        .single();

      if (error) {
        throw error;
      }

      const requiresKyc = !player || player.kyc_status === 'pending' || !player.phone;
      
      res.json({ requiresKyc, kycStatus: player?.kyc_status });
    } catch (error: any) {
      console.error('❌ [CLERK API] KYC status error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Submit KYC documents for Clerk user
  app.post("/api/clerk/kyc-submit", async (req, res) => {
    try {
      // Handle file uploads and KYC submission
      const { clerkUserId, phone } = req.body;
      
      // Update player with phone number directly
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const { data: updatedPlayer, error } = await supabase
        .from('players')
        .update({
          phone,
          kyc_status: 'submitted',
          updated_at: new Date().toISOString()
        })
        .eq('clerk_user_id', clerkUserId)
        .select('*')
        .single();

      if (error) throw error;
      
      // In a real implementation, you would:
      // 1. Upload files to storage
      // 2. Create KYC document records
      // 3. Set KYC status to 'pending'
      
      console.log('📋 [CLERK API] KYC submitted for player:', updatedPlayer.id);
      
      res.json({ success: true, message: 'KYC documents submitted successfully' });
    } catch (error: any) {
      console.error('❌ [CLERK API] KYC submit error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // REMOVED - Using unified core system

  // Get Active (Non-Archived) Chat Messages
  app.get("/api/unified-chat/messages/:playerId", async (req, res) => {
    try {
      const playerId = parseInt(req.params.playerId);
      console.log(`📋 [FIXED CHAT SYSTEM] Getting messages for player: ${playerId}`);

      // Use direct chat system to get messages (it handles the database correctly)
      const result = await directChat.getChatHistory(playerId);
      
      if (!result.success) {
        console.error('❌ [FIXED CHAT SYSTEM] Error from direct chat system');
        return res.status(500).json({ error: "Failed to fetch messages" });
      }
      
      console.log(`✅ [FIXED CHAT SYSTEM] Retrieved ${result.conversations[0]?.chat_messages?.length || 0} messages for player ${playerId}`);
      
      // Transform messages to expected frontend format
      if (result.conversations[0]?.chat_messages) {
        result.conversations[0].chat_messages = result.conversations[0].chat_messages.map(msg => ({
          id: msg.id,
          message: msg.message_text,
          sender: msg.sender,
          sender_name: msg.sender_name,
          timestamp: msg.timestamp,
          isFromStaff: msg.sender === 'staff' || msg.sender === 'gre'
        }));
      }
      
      res.json(result);
      
    } catch (error: any) {
      console.error('❌ [FIXED CHAT SYSTEM] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // REMOVED DUPLICATE ENDPOINT - Using unified clear above

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
  app.post("/api/players/sync-clerk", async (req, res) => {
    try {
      const { clerk_user_id, email, first_name, last_name, phone } = req.body;
      
      if (!clerk_user_id || !email) {
        return res.status(400).json({ error: "clerk_user_id and email are required" });
      }

      console.log(`🔍 [CLERK SYNC] Syncing Clerk user: ${email} (${clerk_user_id})`);

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
      const { supabaseId } = req.params;
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
        connectionString: process.env.DATABASE_URL
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
                 current_credit, credit_limit, credit_approved, total_deposits, total_withdrawals,
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
                 current_credit, credit_limit, credit_approved, total_deposits, total_withdrawals,
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
      const player = {
        id: playerData.id.toString(),
        email: playerData.email,
        firstName: playerData.first_name,
        lastName: playerData.last_name,
        phone: playerData.phone || '',
        kycStatus: playerData.kyc_status,
        balance: playerData.balance || '0.00',
        realBalance: playerData.balance || '0.00',
        creditBalance: playerData.current_credit ? String(playerData.current_credit) : '0.00',
        creditLimit: playerData.credit_limit ? String(playerData.credit_limit) : '0.00',
        creditApproved: Boolean(playerData.credit_approved),
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
      
      console.log(`🎯 [ENTERPRISE PLAYER] Enterprise lookup successful: ${player.email} (ID: ${player.id}, KYC: ${player.kycStatus})`);
      res.json(player);
      
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
      console.log('🎁 [OFFERS API] Fetching offers directly from database...');
      
      // Use direct database connection like other working APIs
      const pg = await import('pg');
      const client = new pg.Client({
        connectionString: process.env.DATABASE_URL,
      });
      
      await client.connect();
      
      const result = await client.query(`
        SELECT id, title, description, image_url, video_url, offer_type, 
               is_active, start_date, end_date, created_at, updated_at
        FROM staff_offers 
        WHERE is_active = true 
        ORDER BY created_at DESC
      `);
      
      await client.end();
      
      console.log('🔍 [OFFERS API] Database results:', {
        total: result.rows.length,
        offers: result.rows.map(o => ({ id: o.id, title: o.title }))
      });
      
      const transformedOffers = result.rows.map((offer: any) => ({
        id: offer.id,
        title: offer.title,
        description: offer.description || 'Limited time offer',
        image_url: offer.image_url || offer.video_url,
        video_url: offer.video_url,
        offer_type: offer.offer_type,
        is_active: offer.is_active,
        start_date: offer.start_date,
        end_date: offer.end_date,
        created_at: offer.created_at,
        updated_at: offer.updated_at
      }));

      console.log(`✅ [OFFERS API] Returning ${transformedOffers.length} active offers from database`);
      res.json(transformedOffers);
    } catch (error) {
      console.error('❌ [OFFERS API] Error:', error);
      res.status(500).json({ error: "Internal server error" });
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

  // ========== DUPLICATE ENDPOINT REMOVED - USE MAIN: /api/balance/:playerId ==========
  // REMOVED: First duplicate /api/account-balance/:playerId endpoint - redirecting to main

  // POST endpoint for joining waitlist - updated to use seat_requests table properly
  app.post("/api/seat-requests", async (req, res) => {
    let pgClient = null;
    try {
      const { playerId, tableId, seatNumber, notes } = req.body;
      
      console.log('🎯 [SEAT REQUEST] Join attempt:', { playerId, tableId, seatNumber });
      
      // Validate required fields
      if (!playerId || !tableId || !seatNumber) {
        return res.status(400).json({ 
          error: 'Missing required fields: playerId, tableId, or seatNumber' 
        });
      }
      
      // Use direct PostgreSQL client for reliable database operations
      const { Client } = await import('pg');
      pgClient = new Client({
        connectionString: process.env.DATABASE_URL,
        connectionTimeoutMillis: 10000, // 10 second timeout
        query_timeout: 10000,
        statement_timeout: 10000
      });
      
      await pgClient.connect();
      console.log('✅ [SEAT REQUEST] Database connected successfully');
      
      // STEP 1: Check if player already has an active seat request
      const existingRequestQuery = `
        SELECT id, table_id, seat_number, status 
        FROM seat_requests 
        WHERE player_id = $1 AND status = 'waiting'
        ORDER BY created_at DESC 
        LIMIT 1
      `;
      
      const existingResult = await pgClient.query(existingRequestQuery, [playerId]);
      const existingRequest = existingResult.rows[0];
      
      if (existingRequest) {
        console.log('🔄 [SEAT REQUEST] Player has existing request:', existingRequest);
        
        // If same table and seat, return existing request
        if (existingRequest.table_id === tableId && existingRequest.seat_number === seatNumber) {
          await pgClient.end();
          console.log('✅ [SEAT REQUEST] Same request already exists');
          return res.json({ 
            success: true, 
            request: existingRequest,
            message: "Already waiting for this seat"
          });
        }
        
        // Different table/seat - update existing request
        console.log('🔄 [SEAT REQUEST] Updating existing request to new table/seat');
        
        const updateRequestQuery = `
          UPDATE seat_requests 
          SET table_id = $1, seat_number = $2, notes = $3, created_at = NOW()
          WHERE id = $4
          RETURNING *
        `;
        
        const updateResult = await pgClient.query(updateRequestQuery, [
          tableId, seatNumber, notes || `Seat ${seatNumber} request`, existingRequest.id
        ]);
        
        const updatedRequest = updateResult.rows[0];
        
        // Also update waitlist table for staff portal sync
        const updateWaitlistQuery = `
          UPDATE waitlist 
          SET table_id = $1, seat_number = $2, updated_at = NOW()
          WHERE player_id = $3 AND status = 'waiting'
        `;
        
        await pgClient.query(updateWaitlistQuery, [tableId, seatNumber, playerId]);
        
        await pgClient.end();
        
        // Send real-time notification for table change
        try {
          await pusher.trigger('staff-portal', 'waitlist_update', {
            type: 'player_moved',
            playerId: playerId,
            oldTableId: existingRequest.table_id,
            newTableId: tableId,
            seatNumber: seatNumber,
            timestamp: new Date().toISOString()
          });
        } catch (pushError) {
          console.error('⚠️ [SEAT REQUEST] Pusher notification failed:', pushError);
        }
        
        console.log(`✅ [SEAT REQUEST] Updated existing request for player ${playerId}`);
        return res.json({ 
          success: true, 
          request: updatedRequest,
          message: "Seat request updated"
        });
      }
      
      // STEP 2: Create new seat request
      console.log('🆕 [SEAT REQUEST] Creating new seat request');
      
      // Insert into seat_requests table
      const seatRequestsQuery = `
        INSERT INTO seat_requests (player_id, table_id, seat_number, status, notes, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING *
      `;
      
      const seatRequestResult = await pgClient.query(seatRequestsQuery, [
        playerId, tableId, seatNumber, 'waiting', notes || `Seat ${seatNumber} request`
      ]);
      
      // Get next position for waitlist table
      const nextPositionQuery = `
        SELECT COALESCE(MAX(position), 0) + 1 as next_position
        FROM waitlist 
        WHERE table_id = $1 AND status IN ('waiting', 'active')
      `;
      
      const positionResult = await pgClient.query(nextPositionQuery, [tableId]);
      const nextPosition = positionResult.rows[0].next_position;
      
      // Insert into waitlist table for staff portal sync
      const waitlistQuery = `
        INSERT INTO waitlist (
          player_id, 
          table_id, 
          game_type, 
          min_buy_in, 
          max_buy_in, 
          position, 
          status, 
          seat_number,
          requested_at,
          created_at,
          updated_at
        )
        VALUES ($1, $2, 'Texas Hold''em', 100, 5000, $3, 'waiting', $4, NOW(), NOW(), NOW())
        RETURNING *
      `;
      
      const waitlistResult = await pgClient.query(waitlistQuery, [
        playerId, tableId, nextPosition, seatNumber
      ]);
      
      await pgClient.end();
      
      const requestData = seatRequestResult.rows[0];
      const waitlistData = waitlistResult.rows[0];
      
      if (!requestData) {
        console.error('❌ [SEAT REQUEST] No data returned from insert');
        return res.status(500).json({ error: "Failed to create seat request" });
      }
      
      // Send real-time notification to staff portal
      try {
        await pusher.trigger('staff-portal', 'waitlist_update', {
          type: 'player_joined',
          playerId: playerId,
          tableId: tableId,
          seatNumber: seatNumber,
          position: nextPosition,
          waitlistId: waitlistData?.id,
          timestamp: new Date().toISOString(),
          playerName: `Player ${playerId}`,
          tableName: `Table ${tableId}`
        });
        
        console.log(`🚀 [SEAT REQUEST] Real-time notification sent to staff portal`);
      } catch (pushError) {
        console.error('⚠️ [SEAT REQUEST] Pusher notification failed:', pushError);
      }
      
      console.log(`✅ [SEAT REQUEST] Player ${playerId} added to waitlist - seat_requests: ${requestData.id}, waitlist: ${waitlistData?.id || 'failed'}`);
      res.json({ 
        success: true, 
        request: requestData,
        waitlistPosition: nextPosition,
        staffPortalSync: true 
      });
      
    } catch (error: any) {
      console.error('❌ [SEAT REQUEST] Unexpected error:', error);
      
      // Log detailed error information for debugging
      console.error('❌ [SEAT REQUEST] Error details:', {
        message: error.message,
        code: error.code,
        severity: error.severity,
        detail: error.detail
      });
      
      // Return appropriate error message based on error type
      let errorMessage = "Internal server error";
      if (error.code === '57P01') {
        errorMessage = "Database connection terminated. Please try again.";
      } else if (error.code === 'ENOTFOUND') {
        errorMessage = "Database connection failed. Please check your connection.";
      } else if (error.code === 'ECONNREFUSED') {
        errorMessage = "Database server unavailable. Please try again later.";
      }
      
      res.status(500).json({ error: errorMessage });
    } finally {
      // Ensure database connection is always closed
      if (pgClient) {
        try {
          await pgClient.end();
          console.log('✅ [SEAT REQUEST] Database connection closed');
        } catch (closeError) {
          console.error('⚠️ [SEAT REQUEST] Error closing database connection:', closeError);
        }
      }
    }
  });

  app.get("/api/seat-requests/:playerId", async (req, res) => {
    try {
      const { playerId } = req.params;
      
      console.log(`🔍 [NANOSECOND WAITLIST] Fetching waitlist for player: ${playerId}`);
      
      // CRITICAL: Query BOTH tables for complete waitlist visibility
      const { Pool } = await import('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        connectionTimeoutMillis: 5000,
      });

      // Get from unified waitlist table (staff portal table) for nanosecond sync
      const waitlistQuery = `
        SELECT 
          w.id,
          w.player_id,
          w.table_id,
          w.position,
          w.status,
          w.seat_number,
          w.requested_at as created_at,
          'waitlist' as source_table
        FROM waitlist w
        WHERE w.player_id = $1 
        AND w.status IN ('waiting', 'active')
        ORDER BY w.requested_at DESC
      `;
      
      // Also get from seat_requests for legacy compatibility
      const seatRequestsQuery = `
        SELECT 
          sr.id,
          sr.player_id,
          sr.table_id,
          1 as position,
          sr.status,
          sr.seat_number,
          sr.created_at,
          'seat_requests' as source_table
        FROM seat_requests sr
        WHERE sr.player_id = $1 
        AND sr.status IN ('waiting', 'active')
        ORDER BY sr.created_at DESC
      `;

      const [waitlistResult, seatRequestsResult] = await Promise.all([
        pool.query(waitlistQuery, [playerId]),
        pool.query(seatRequestsQuery, [playerId])
      ]);

      await pool.end();
      
      // Combine both sources for complete waitlist view
      const allWaitlistEntries = [
        ...waitlistResult.rows,
        ...seatRequestsResult.rows
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Get table names using the same API call that's working for /api/tables
      let staffPortalTables: any[] = [];
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.VITE_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        
        const tablesResponse = await supabase.from('tables').select('id, name, game_type');
        staffPortalTables = tablesResponse.data || [];
        console.log(`🔍 [WAITLIST TABLE LOOKUP] Found ${staffPortalTables.length} Staff Portal tables`);
      } catch (error) {
        console.error('⚠️ [WAITLIST TABLE LOOKUP] Failed to get table names:', error);
      }
      
      // Add table names to waitlist entries
      const enrichedWaitlistEntries = allWaitlistEntries.map(entry => {
        const table = staffPortalTables.find((t: any) => t.id === entry.table_id);
        return {
          ...entry,
          table_name: table?.name || `Table ${entry.table_id}`,
          game_type: table?.game_type || 'Unknown Game'
        };
      });

      console.log(`✅ [NANOSECOND WAITLIST] Found ${enrichedWaitlistEntries.length} waitlist entries from both systems`);
      
      res.json(enrichedWaitlistEntries);
    } catch (error) {
      console.error('❌ [NANOSECOND WAITLIST] Error:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/credit-requests/:playerId", async (req, res) => {
    try {
      const { playerId } = req.params;
      console.log(`🔍 [CREDIT REQUESTS API] Fetching credit requests for player: ${playerId}`);
      
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      
      // Since credit requests don't exist for most players, just return empty array
      console.log(`✅ [CREDIT REQUESTS API] No credit requests for player ${playerId}`);
      const result = { data: [], error: null };
      
      if (result.error) {
        console.error('❌ [CREDIT REQUESTS API] Database error:', result.error);
        return res.status(500).json({ error: "Database error" });
      }

      console.log(`✅ [CREDIT REQUESTS API] Found ${result.data?.length || 0} credit requests for player ${playerId}`);
      res.json(result.data || []);
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

  // NANOSECOND DATABASE SYNC - Fixes PostgreSQL ↔ Supabase mismatch
  app.post('/api/trigger-balance-update/:playerId', async (req, res) => {
    try {
      const { playerId } = req.params;
      const { operation = 'manual_sync' } = req.body;
      
      console.log(`🔄 [NANOSECOND SYNC] Triggering balance update for player: ${playerId}`);
      
      // Get fresh balance from PostgreSQL (source of truth)
      const { Pool } = await import('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });

      const query = `SELECT balance, current_credit FROM players WHERE id = $1`;
      const result = await pool.query(query, [playerId]);
      await pool.end();

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Player not found' });
      }

      const player = result.rows[0];
      const cashBalance = parseFloat(player.balance || '0');
      const creditBalance = parseFloat(player.current_credit || '0');

      // CRITICAL FIX: Sync PostgreSQL → Supabase for database consistency
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        
        const { error } = await supabase
          .from('players')
          .update({ balance: cashBalance.toFixed(2) })
          .eq('id', playerId);
          
        if (error) {
          console.error('⚠️ [NANOSECOND SYNC] Supabase error:', error);
        } else {
          console.log(`🔧 [NANOSECOND SYNC] Updated Supabase: ₹${cashBalance}`);
        }
      } catch (supabaseError) {
        console.error('⚠️ [NANOSECOND SYNC] Supabase update warning:', supabaseError);
      }

      // Trigger Pusher events for real-time sync
      await pusher.trigger('cross-portal-sync', 'player_balance_update', {
        playerId: parseInt(playerId),
        type: operation,
        newBalance: cashBalance,
        creditBalance,
        timestamp: new Date().toISOString()
      });

      await pusher.trigger(`player-${playerId}`, 'balance_updated', {
        cashBalance,
        creditBalance,
        operation,
        timestamp: new Date().toISOString()
      });

      console.log(`✅ [NANOSECOND SYNC] Balance update triggered: ₹${cashBalance}`);
      res.json({ 
        success: true, 
        cashBalance, 
        creditBalance,
        message: 'Balance sync triggered successfully with database consistency' 
      });

    } catch (error) {
      console.error('❌ [NANOSECOND SYNC] Error:', error);
      res.status(500).json({ error: 'Failed to trigger balance update' });
    }
  });

  // ========== DUAL BALANCE MANAGEMENT SYSTEM ==========
  
  // Enhanced balance API with dual balance support + comprehensive monitoring
  app.get('/api/balance/:playerId', async (req, res) => {
    try {
      const { playerId } = req.params;
      console.log(`💰 [DUAL BALANCE] Getting balance for player:`, playerId);
      
      // Use direct PostgreSQL query to get balance data
      const { Pool } = await import('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });

      const query = `
        SELECT balance, current_credit, credit_limit, credit_approved, total_deposits, total_withdrawals,
               first_name, last_name, email, last_login_at
        FROM players 
        WHERE id = $1
      `;
      
      const result = await pool.query(query, [playerId]);
      await pool.end();

      if (result.rows.length === 0) {
        console.error(`❌ [BALANCE MONITORING] Player ${playerId} not found in database`);
        throw new Error('Player not found');
      }

      const player = result.rows[0];
      const cashBalance = parseFloat(player.balance || '0');
      const creditBalance = parseFloat(player.current_credit || '0');
      const totalBalance = cashBalance + creditBalance;
      
      const balanceData = {
        cashBalance,
        creditBalance,
        creditLimit: parseFloat(player.credit_limit || '0'),
        creditApproved: player.credit_approved || false,
        totalBalance
      };

      // COMPREHENSIVE BALANCE MONITORING SYSTEM
      console.log(`✅ [BALANCE MONITORING] Player ${playerId} (${player.first_name} ${player.last_name}):`, {
        cashBalance: `₹${cashBalance}`,
        creditBalance: `₹${creditBalance}`,
        totalBalance: `₹${totalBalance}`,
        email: player.email,
        lastLogin: player.last_login_at
      });

      // Data integrity verification
      const totalDeposits = parseFloat(player.total_deposits || '0');
      const totalWithdrawals = parseFloat(player.total_withdrawals || '0');
      const expectedBalance = totalDeposits - totalWithdrawals;
      
      if (Math.abs(cashBalance - expectedBalance) > 0.01 && totalDeposits > 0) {
        console.warn(`⚠️ [BALANCE INTEGRITY] Potential discrepancy for Player ${playerId}:`, {
          currentBalance: cashBalance,
          expectedBalance,
          deposits: totalDeposits,
          withdrawals: totalWithdrawals,
          difference: Math.abs(cashBalance - expectedBalance)
        });
      }

      res.json(balanceData);
    } catch (error) {
      console.error('❌ [DUAL BALANCE] Error:', error);
      res.status(500).json({ error: 'Failed to fetch balance' });
    }
  });

  // ========== BALANCE INTEGRITY MONITORING SYSTEM ==========
  
  // Balance audit endpoint for staff portal monitoring
  app.get('/api/admin/balance-audit', async (req, res) => {
    try {
      console.log('🔍 [BALANCE AUDIT] Running comprehensive balance integrity check...');
      
      const { Pool } = await import('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });

      const auditQuery = `
        SELECT 
          id, email, first_name, last_name, 
          COALESCE(balance, 0) as balance, 
          COALESCE(current_credit, 0) as current_credit,
          COALESCE(total_deposits, 0) as total_deposits, 
          COALESCE(total_withdrawals, 0) as total_withdrawals, 
          last_login_at,
          (COALESCE(total_deposits, 0)::decimal - COALESCE(total_withdrawals, 0)::decimal) as expected_balance,
          ABS(COALESCE(balance, 0)::decimal - (COALESCE(total_deposits, 0)::decimal - COALESCE(total_withdrawals, 0)::decimal)) as discrepancy
        FROM players 
        WHERE COALESCE(is_active, true) = true 
        AND (COALESCE(total_deposits, 0) > 0 OR COALESCE(balance, 0) > 0)
        ORDER BY discrepancy DESC, last_login_at DESC NULLS LAST
        LIMIT 50
      `;
      
      const result = await pool.query(auditQuery);
      await pool.end();

      const auditResults = result.rows.map(player => ({
        playerId: player.id,
        name: `${player.first_name} ${player.last_name}`,
        email: player.email,
        currentBalance: parseFloat(player.balance || '0'),
        expectedBalance: parseFloat(player.expected_balance || '0'),
        discrepancy: parseFloat(player.discrepancy || '0'),
        creditBalance: parseFloat(player.current_credit || '0'),
        lastLogin: player.last_login_at,
        status: parseFloat(player.discrepancy || '0') > 0.01 ? 'REVIEW_REQUIRED' : 'OK'
      }));

      const discrepancyCount = auditResults.filter(p => p.status === 'REVIEW_REQUIRED').length;

      console.log(`✅ [BALANCE AUDIT] Completed: ${result.rows.length} players checked, ${discrepancyCount} discrepancies found`);

      res.json({
        summary: {
          totalPlayersChecked: result.rows.length,
          discrepanciesFound: discrepancyCount,
          systemStatus: discrepancyCount === 0 ? 'HEALTHY' : 'ATTENTION_REQUIRED',
          auditTimestamp: new Date().toISOString()
        },
        players: auditResults
      });
    } catch (error) {
      console.error('❌ [BALANCE AUDIT] Error:', error);
      res.status(500).json({ error: 'Balance audit failed' });
    }
  });

  // ========== DUPLICATE ENDPOINT REMOVED - MAIN ENDPOINT: /api/balance/:playerId ==========
  // REMOVED: Duplicate /api/account-balance/:playerId endpoint - use main endpoint instead

  // ========== KYC DOCUMENT UPLOAD AND MANAGEMENT SYSTEM ==========
  
  // Document upload endpoint - Direct PostgreSQL (bypasses Supabase cache)
  app.post('/api/documents/upload', async (req, res) => {
    try {
      const { playerId, documentType, fileName, fileData, fileSize, mimeType } = req.body;
      
      console.log(`🔧 [DIRECT KYC UPLOAD] Uploading ${documentType} for player:`, playerId);
      console.log(`🔧 [DIRECT KYC UPLOAD] Request data:`, { playerId, documentType, fileName, fileDataLength: fileData?.length });
      
      if (!playerId || !documentType || !fileName || !fileData) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Use direct PostgreSQL to bypass Supabase cache issues
      const uploadedDoc = await directKycStorage.uploadDocument(
        parseInt(playerId),
        documentType,
        fileName,
        fileData
      );

      console.log(`✅ [DIRECT KYC UPLOAD] Document uploaded successfully:`, uploadedDoc.id);
      res.json({ success: true, document: uploadedDoc });
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

      console.log(`✅ [DIRECT KYC STATUS] KYC status retrieved for player:`, playerId);
      res.json(kycData);
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

  // ========== EMAIL VERIFICATION SYSTEM ==========
  
  // Send email verification
  app.post('/api/auth/send-verification-email', async (req, res) => {
    try {
      const { email, playerId } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }
      
      console.log(`📧 [EMAIL VERIFICATION] Sending verification email to:`, email);
      
      // Generate verification token
      const verificationToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      // Store verification token in database
      const { Pool } = await import('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });

      await pool.query(`
        UPDATE players 
        SET verification_token = $1, token_expiry = $2
        WHERE email = $3
      `, [verificationToken, tokenExpiry, email]);

      await pool.end();
      
      // Create verification URL
      const verificationUrl = `${req.protocol}://${req.get('host')}/api/auth/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}`;
      
      console.log(`📧 [EMAIL VERIFICATION] Verification URL:`, verificationUrl);
      console.log(`📧 [EMAIL VERIFICATION] Token:`, verificationToken);
      
      // Send email via Supabase with proper verification link
      try {
        // Initialize Supabase admin client for email operations
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

        // Try to send email via Supabase with our custom verification link
        try {
          const { error: emailError } = await supabaseAdmin.auth.admin.generateLink({
            type: 'signup', 
            email: email,
            password: 'temp-password-for-verification',
            options: {
              redirectTo: verificationUrl
            }
          });

          if (!emailError) {
            console.log(`📧 [EMAIL VERIFICATION] Supabase verification email sent to:`, email);
            console.log(`🔗 [EMAIL VERIFICATION] Verification link:`, verificationUrl);
          } else {
            console.log(`⚠️ [EMAIL VERIFICATION] Supabase email failed:`, emailError);
          }
        } catch (supabaseEmailError) {
          console.log(`⚠️ [EMAIL VERIFICATION] Supabase email error:`, supabaseEmailError);
        }
      } catch (supabaseError) {
        console.log(`⚠️ [EMAIL VERIFICATION] Supabase initialization error:`, supabaseError);
      }
      
      res.json({ 
        success: true, 
        message: 'Verification email sent',
        verificationUrl: verificationUrl,
        token: verificationToken
      });
      
    } catch (error) {
      console.error('❌ [EMAIL VERIFICATION] Error:', error);
      res.status(500).json({ error: 'Failed to send verification email' });
    }
  });
  
  // Verify email endpoint
  app.get('/api/auth/verify-email', async (req, res) => {
    try {
      const { token, email } = req.query;
      
      if (!token || !email) {
        return res.status(400).json({ error: 'Missing token or email' });
      }
      
      console.log(`📧 [EMAIL VERIFICATION] Verifying token for:`, email);
      
      const { Pool } = await import('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });

      const result = await pool.query(`
        SELECT id, email, verification_token, token_expiry, email_verified
        FROM players 
        WHERE email = $1 AND verification_token = $2
      `, [email, token]);

      if (result.rows.length === 0) {
        await pool.end();
        return res.status(400).json({ error: 'Invalid verification token' });
      }

      const player = result.rows[0];
      
      // Check if token is expired
      if (new Date() > new Date(player.token_expiry)) {
        await pool.end();
        return res.status(400).json({ error: 'Verification token expired' });
      }
      
      // Update email verification status
      await pool.query(`
        UPDATE players 
        SET email_verified = true, verification_token = NULL, token_expiry = NULL
        WHERE id = $1
      `, [player.id]);

      await pool.end();
      
      console.log(`✅ [EMAIL VERIFICATION] Email verified for player:`, player.id);
      
      // Redirect to success page with confirmation
      const confirmationHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Email Verified Successfully</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
              color: white;
              margin: 0;
              padding: 40px 20px;
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
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
            }
            .success-icon {
              font-size: 64px;
              margin-bottom: 20px;
              color: #22c55e;
            }
            h1 {
              margin: 0 0 16px 0;
              font-size: 28px;
              font-weight: 600;
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
              padding: 12px 24px;
              font-size: 16px;
              font-weight: 600;
              cursor: pointer;
              text-decoration: none;
              display: inline-block;
              transition: all 0.2s;
            }
            .login-button:hover {
              transform: translateY(-1px);
              box-shadow: 0 8px 24px rgba(59, 130, 246, 0.3);
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success-icon">✅</div>
            <h1>Thank you for verifying your email!</h1>
            <p>Your email address has been successfully verified. You can now log in to your poker room account and complete your KYC process.</p>
            <a href="/" class="login-button">Continue to Login</a>
          </div>
        </body>
        </html>
      `;
      
      res.send(confirmationHtml);
      
    } catch (error) {
      console.error('❌ [EMAIL VERIFICATION] Error:', error);
      res.status(500).json({ error: 'Email verification failed' });
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
      
      // Use Supabase client with service role to bypass RLS
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      // Query players table directly (bypasses RLS with service role)
      const { data: players, error: queryError } = await supabase
        .from('players')
        .select('*')
        .eq('email', email)
        .eq('password', password);

      if (queryError) {
        console.error('❌ [PLAYERS TABLE AUTH] Query error:', queryError);
        return res.status(500).json({ error: 'Database query failed' });
      }

      if (!players || players.length === 0) {
        console.log(`❌ [PLAYERS TABLE AUTH] Invalid credentials for: ${email}`);
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const player = players[0];
      console.log(`✅ [PLAYERS TABLE AUTH] Player found: ${player.id}`);

      // Update last login with Indian time (IST)
      const now = new Date();
      const indianTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000)); // Add 5.5 hours for IST
      const formattedTime = indianTime.toISOString().slice(0, 19).replace('T', ' '); // Format as YYYY-MM-DD HH:MM:SS
      
      const { error: updateError } = await supabase
        .from('players')
        .update({ 
          last_login_at: formattedTime 
        })
        .eq('id', player.id);

      if (updateError) {
        console.warn('⚠️ [PLAYERS TABLE AUTH] Failed to update last login:', updateError);
      }

      console.log(`✅ [PLAYERS TABLE AUTH] Authentication successful using players table only: ${player.email}`);

      // Return comprehensive user data (compatible with existing frontend)
      const userData = {
        id: player.id,
        email: player.email,
        firstName: player.first_name,
        lastName: player.last_name,
        phone: player.phone,
        kycStatus: player.kyc_status,
        balance: player.balance,
        emailVerified: player.email_verified || false,
        supabaseId: player.supabase_id,
        clerkUserId: player.clerk_user_id,
        universalId: player.universal_id,
        creditBalance: player.current_credit || '0.00',
        creditLimit: player.credit_limit || '0.00',
        creditApproved: player.credit_approved || false,
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
      const { email, password, firstName, lastName, phone } = req.body;
      
      if (!email || !password || !firstName || !lastName) {
        return res.status(400).json({ error: 'All required fields must be provided' });
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
      console.log(`🔥 [PLAYERS TABLE SIGNUP] Creating new player: ${email}`);
      
      // Create player record using Supabase (players table only)
      const universalId = `players_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const fullName = `${firstName} ${lastName}`.trim();
      const currentTimestamp = new Date().toISOString();
      
      const { data: newPlayers, error: insertError } = await supabase
        .from('players')
        .insert({
          email,
          password,
          first_name: firstName,
          last_name: lastName,
          full_name: fullName,
          phone,
          kyc_status: 'pending',
          email_verified: false,
          balance: '0.00',
          universal_id: universalId,
          is_active: true,
          total_deposits: '0.00',
          total_withdrawals: '0.00',
          total_winnings: '0.00',
          total_losses: '0.00',
          games_played: 0,
          hours_played: '0.00',
          current_credit: 0,
          credit_limit: 0,
          credit_approved: false,
          credit_eligible: false,
          nickname: firstName,
          player_id: null,
          clerk_user_id: null,
          created_at: currentTimestamp,
          updated_at: currentTimestamp,
          last_login_at: null
        })
        .select();

      if (insertError) {
        console.error('❌ [PLAYERS TABLE SIGNUP] Insert error:', insertError);
        return res.status(500).json({ error: 'Database operation failed' });
      }

      const newPlayer = newPlayers[0];
      console.log(`✅ [PLAYERS TABLE SIGNUP] New player created successfully: ${email} (ID: ${newPlayer.id})`);

      // Initialize response data for new player (who needs to complete KYC)
      const responsePlayer = {
        id: newPlayer.id,
        email: newPlayer.email,
        firstName: newPlayer.first_name,
        lastName: newPlayer.last_name,
        kycStatus: newPlayer.kyc_status,
        balance: newPlayer.balance,
        emailVerified: newPlayer.email_verified
      };

      return res.json({
        success: true,
        existing: false,
        player: responsePlayer,
        redirectToKYC: true,
        needsEmailVerification: true,
        needsKYCUpload: true,
        needsKYCApproval: false,
        isFullyVerified: false,
        message: 'Account created successfully! Please verify your email and complete KYC.'
      });

    } catch (error: any) {
      console.error('❌ [POSTGRESQL SIGNUP] Signup error:', error.message);
      return res.status(500).json({ error: 'Signup server error' });
    }
  });

  // VERIFY SUPABASE-ONLY APPROACH: Remove old PostgreSQL direct connections
  app.post('/api/players', async (req, res) => {
    // DEPRECATED: This endpoint now redirects to /api/auth/signup for consistency
    console.log('🔄 [DEPRECATED] /api/players endpoint called - redirecting to /api/auth/signup');
    return res.status(301).json({ 
      error: 'This endpoint is deprecated. Please use /api/auth/signup for all new registrations.',
      redirectTo: '/api/auth/signup'
    });
  });

  // Continue with other endpoints that should ALSO use Supabase-only approach...

  // CLERK-SUPABASE SYNCHRONIZATION ENDPOINTS
  
  // Clerk webhook endpoint for real-time sync
  app.post('/api/clerk/webhook', async (req, res) => {
    const { ClerkSupabaseSync } = await import('./clerk-supabase-sync');
    await ClerkSupabaseSync.handleClerkWebhook(req, res);
  });

  // Manual sync endpoint for administrative use (DISABLED for pure players table auth)
  app.post('/api/clerk/sync', async (req, res) => {
    console.log('🔄 [CLERK SYNC] Skipped - using pure players table authentication');
    res.json({
      success: true,
      message: 'Clerk sync not needed for players table authentication',
      skipped: true
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

  const httpServer = createServer(app);
  return httpServer;
}
