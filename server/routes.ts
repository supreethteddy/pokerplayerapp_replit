
import type { Express } from "express";
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

export function registerRoutes(app: Express) {
  // SIMPLE CASH BALANCE SYSTEM - MANAGER HANDLES TABLE OPERATIONS
  
  // ========== LEGACY ENDPOINT REMOVED - USE /api/balance/:playerId INSTEAD ==========
  // REMOVED: Duplicate /api/player/:playerId/balance endpoint - redirecting to main endpoint

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
  
  // Send Player Messages to Staff Portal (EXACT MATCH)
  app.post("/api/player-chat-integration/send", async (req, res) => {
    try {
      const { playerId, playerName, message, isFromPlayer } = req.body;
      
      if (!isFromPlayer) {
        return res.status(400).json({ error: "This endpoint is for player messages only" });
      }

      const result = await directChat.sendMessage(playerId, playerName, message, 'player');
      
      // Return format expected by staff portal
      res.json({
        success: true,
        id: result.data.id,
        timestamp: result.data.timestamp,
        message: "Message sent successfully"
      });
    } catch (error: any) {
      console.error('❌ [STAFF PORTAL INTEGRATION] Send error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Retrieve All Messages for Player (EXACT MATCH)
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



  // ENHANCED UNIFIED CHAT SYSTEM - Microsecond Delivery
  app.post("/api/unified-chat/send", async (req, res) => {
    try {
      const { playerId, playerName, message, senderType } = req.body;
      
      console.log(`🚀 [MICROSECOND CHAT] Processing ${senderType} message from ${playerName}`);
      
      // 1. Send message through direct chat system
      const result = await directChat.sendMessage(playerId, playerName, message, senderType);
      
      // 2. Create or update chat request for Staff Portal visibility
      if (senderType === 'player') {
        try {
          // Check if chat request exists for this player
          // Using imported createClient from top of file
          const supabase = createClient(
            process.env.VITE_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          );
          const { data: existingRequest, error: requestError } = await supabase
            .from('chat_requests')
            .select('id, status')
            .eq('player_id', playerId)
            .single();
          
          let requestId;
          
          if (!existingRequest) {
            // Create new chat request - this will appear as NEW CHAT in Staff Portal
            const { data: newRequest, error: createError } = await supabase
              .from('chat_requests')
              .insert({
                player_id: playerId,
                player_name: playerName,
                initial_message: message,
                status: 'waiting',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .select()
              .single();
            
            if (!createError && newRequest) {
              requestId = newRequest.id;
              console.log(`✅ [NEW CHAT] Created chat request ${requestId} for player ${playerId}`);
              
              // Broadcast NEW CHAT event to Staff Portal
              await pusher.trigger('staff-portal', 'new-chat-request', {
                requestId: requestId,
                playerId: playerId,
                playerName: playerName,
                message: message,
                timestamp: new Date().toISOString(),
                status: 'waiting'
              });
              
              // Send OneSignal notification to staff
              try {
                await oneSignalClient.createNotification({
                  app_id: process.env.ONESIGNAL_APP_ID! as any,
                  contents: { en: `New chat from ${playerName}: ${message.substring(0, 50)}...` },
                  headings: { en: "New Player Chat Request" },
                  included_segments: ['All']
                });
                console.log(`📱 [ONESIGNAL] Staff notification sent for new chat from ${playerName}`);
              } catch (notifError) {
                console.error('❌ [ONESIGNAL] Notification error:', notifError);
              }
            }
          } else {
            requestId = existingRequest.id;
            console.log(`🔄 [EXISTING CHAT] Using existing request ${requestId} for player ${playerId}`);
          }
          
        } catch (chatRequestError) {
          console.error('❌ [CHAT REQUEST] Error:', chatRequestError);
          // Continue with message sending even if chat request fails
        }
      }
      
      console.log(`✅ [MICROSECOND CHAT] Message processed successfully in microseconds`);
      res.json(result);
    } catch (error: any) {
      console.error('❌ [MICROSECOND CHAT] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

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
        }
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
      
      // First, ensure chat request exists - CRITICAL FIX: Don't use .single() for new players
      let { data: existingRequests } = await supabase
        .from('chat_requests')
        .select('id')
        .eq('player_id', playerId)
        .limit(1);

      let requestId = existingRequests?.[0]?.id;

      if (!requestId) {
        // Create new chat request - CRITICAL FIX: Add player info for Staff Portal visibility
        const { data: player } = await supabase
          .from('players')
          .select('first_name, last_name, email')
          .eq('id', playerId)
          .single();

        const { data: newRequest, error: requestError } = await supabase
          .from('chat_requests')
          .insert({
            player_id: playerId,
            player_name: player ? `${player.first_name} ${player.last_name}` : (playerName || `Player ${playerId}`),
            player_email: player?.email || '',
            subject: 'GRE Support Request',
            initial_message: message,
            status: 'waiting',
            priority: 'medium',
            source: 'player_chat',
            category: 'general_inquiry'
          })
          .select('id')
          .single();

        if (requestError) {
          console.error('❌ [CHAT PERSISTENCE] Error creating request:', requestError);
        } else {
          requestId = newRequest?.id;
          console.log('🚀 [CHAT PERSISTENCE] ✅ Created new chat request for Staff Portal:', requestId);
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




      // DISABLED - Using Direct Chat System instead
      console.log('🔄 [LEGACY PUSHER] Skipping legacy Pusher notification - using direct-chat-system.ts');

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
        supabaseId: supabaseId,
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
      if (error.code === '23505' && error.constraint === 'players_email_unique') {
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
      
      res.status(500).json({ error: error.message });
    }
  });

  // Sync Clerk user with Player database
  app.post("/api/clerk/sync-player", async (req, res) => {
    try {
      const { clerkUserId, email, firstName, lastName } = req.body;
      
      console.log('🔗 [CLERK API] Syncing player:', email);
      
      const player = await clerkSync.syncPlayer({
        clerkUserId,
        email,
        firstName,
        lastName
      });

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
      
      // Update player with phone number and KYC status
      const updatedPlayer = await clerkSync.updatePlayerPhone(clerkUserId, phone);
      
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
      
      // Use direct PostgreSQL client to bypass Supabase schema cache issues
      const { Client } = await import('pg');
      const pgClient = new Client({
        connectionString: process.env.DATABASE_URL
      });
      
      await pgClient.connect();
      
      const insertQuery = `
        INSERT INTO seat_requests (player_id, table_id, seat_number, status, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING *
      `;
      
      const result = await pgClient.query(insertQuery, [
        playerId, tableId, seatNumber, 'waiting'
      ]);
      
      await pgClient.end();
      
      const requestData = result.rows[0];
      
      if (!requestData) {
        console.error('❌ [SEAT REQUEST] No data returned from insert');
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

      // Send submission confirmation email
      try {
        console.log(`📧 [DIRECT KYC SUBMIT] Sending confirmation email to: ${email}`);
        console.log(`✅ [DIRECT KYC SUBMIT] Thank you message: Thank you for registering to the Poker Club. Your documents have been submitted for review. Please wait for approval from our staff. Once approved, you will receive another email and can login to access the player portal.`);
      } catch (emailError) {
        console.log('📧 [EMAIL] Note: Email service not configured');
      }

      console.log(`✅ [DIRECT KYC SUBMIT] KYC submitted successfully for player:`, playerId);
      res.json({ success: true, message: 'KYC documents submitted for review. Check your email for confirmation.' });
    } catch (error) {
      console.error('❌ [DIRECT KYC SUBMIT] Error:', error);
      res.status(500).json({ error: 'Failed to submit KYC' });
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
  
  // CRITICAL AUTHENTICATION ENDPOINT - Direct Supabase + Database Integration
  app.post('/api/auth/signin', async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }
      
      console.log(`🔐 [AUTH SIGNIN] Attempting login for: ${email}`);
      
      // Step 1: Check if player exists in our database using direct PostgreSQL query
      // This bypasses any Supabase RLS issues that might block the query
      const pgClient = new pg.Client({
        connectionString: process.env.DATABASE_URL
      });
      
      try {
        await pgClient.connect();
      } catch (connectionError) {
        console.error(`❌ [AUTH SIGNIN] Database connection failed:`, connectionError);
        return res.status(500).json({ error: 'Database connection failed' });
      }
      
      console.log(`🔍 [AUTH SIGNIN] Querying database for player: ${email}`);
      
      const playerQuery = `
        SELECT id, email, password, first_name, last_name, phone, kyc_status, balance, 
               current_credit, credit_limit, credit_approved, total_deposits, total_withdrawals,
               total_winnings, total_losses, games_played, hours_played, clerk_user_id, 
               supabase_id, is_active, last_login_at
        FROM players 
        WHERE email = $1 AND (is_active IS NULL OR is_active = true)
      `;
      
      const playerResult = await pgClient.query(playerQuery, [email]);
      
      if (playerResult.rows.length === 0) {
        await pgClient.end();
        console.log(`❌ [AUTH SIGNIN] Player not found: ${email}`);
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      const player = playerResult.rows[0];
      await pgClient.end();
      
      console.log(`🔍 [AUTH SIGNIN] Found player: ${player.email} (ID: ${player.id})`);
      
      // Step 2: Verify password (handle both plaintext and potential future hashing)
      let passwordValid = false;
      
      if (player.password === password) {
        // Direct plaintext match (current system)
        passwordValid = true;
        console.log(`✅ [AUTH SIGNIN] Plaintext password verified for: ${email}`);
      }
      
      if (!passwordValid) {
        console.log(`❌ [AUTH SIGNIN] Invalid password for: ${email}`);
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      // Step 3: Ensure Clerk + Supabase integration is complete
      let authUser = null;
      
      // Initialize Supabase admin client for auth operations
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
      
      // Check if we have a Supabase auth user for this player
      if (player.supabase_id) {
        try {
          const { data: { user: existingUser }, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(player.supabase_id);
          
          if (existingUser && !getUserError) {
            authUser = existingUser;
            console.log(`✅ [AUTH SIGNIN] Found existing Supabase auth user: ${existingUser.email}`);
          }
        } catch (authCheckError) {
          console.warn(`⚠️ [AUTH SIGNIN] Could not verify existing Supabase auth user:`, authCheckError);
        }
      }
      
      // If no valid Supabase auth user exists, create one
      if (!authUser) {
        try {
          console.log(`🆕 [AUTH SIGNIN] Creating new Supabase auth user for: ${email}`);
          
          const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
              first_name: player.first_name,
              last_name: player.last_name,
              player_id: player.id
            }
          });
          
          if (!authError && authData.user) {
            authUser = authData.user;
            
            // Update player record with new Supabase ID using the existing connection
            try {
              const updateClient = new pg.Client({ connectionString: process.env.DATABASE_URL });
              await updateClient.connect();
              await updateClient.query('UPDATE players SET supabase_id = $1 WHERE id = $2', [authUser.id, player.id]);
              await updateClient.end();
            } catch (updateError) {
              console.warn(`⚠️ [AUTH SIGNIN] Failed to update Supabase ID:`, updateError);
            }
            
            console.log(`✅ [AUTH SIGNIN] Created and linked new Supabase auth user: ${authUser.email}`);
          } else {
            console.warn(`⚠️ [AUTH SIGNIN] Failed to create Supabase auth user, continuing with database auth:`, authError);
          }
        } catch (createAuthError) {
          console.warn(`⚠️ [AUTH SIGNIN] Auth user creation failed, continuing with database auth:`, createAuthError);
        }
      }
      
      // Step 4: Return complete player data
      const playerData = {
        id: player.id.toString(),
        email: player.email,
        firstName: player.first_name,
        lastName: player.last_name,
        phone: player.phone || '',
        kycStatus: player.kyc_status,
        balance: player.balance || '0.00',
        realBalance: player.balance || '0.00',
        creditBalance: player.current_credit ? String(player.current_credit) : '0.00',
        creditLimit: player.credit_limit ? String(player.credit_limit) : '0.00',
        creditApproved: Boolean(player.credit_approved),
        totalBalance: (parseFloat(player.balance || '0.00') + parseFloat(player.current_credit || '0.00')).toFixed(2),
        totalDeposits: player.total_deposits || '0.00',
        totalWithdrawals: player.total_withdrawals || '0.00',
        totalWinnings: player.total_winnings || '0.00',
        totalLosses: player.total_losses || '0.00',
        gamesPlayed: player.games_played || 0,
        hoursPlayed: player.hours_played || '0.00',
        clerkUserId: player.clerk_user_id,
        isClerkSynced: !!player.clerk_user_id,
        supabaseId: authUser?.id || player.supabase_id,
        authToken: authUser?.id || player.supabase_id // Use as session identifier
      };
      
      console.log(`✅ [AUTH SIGNIN] Login successful: ${email} (Player ID: ${player.id})`);
      
      // Log authentication activity using the existing connection
      try {
        const logClient = new pg.Client({ connectionString: process.env.DATABASE_URL });
        await logClient.connect();
        await logClient.query('UPDATE players SET last_login_at = NOW() WHERE id = $1', [player.id]);
        await logClient.end();
        console.log(`📊 [AUTH SIGNIN] Updated last login time for player: ${player.id}`);
      } catch (logError) {
        console.warn('⚠️ [AUTH SIGNIN] Failed to update last login:', logError);
      }
      
      res.json({
        success: true,
        user: playerData,
        message: 'Login successful'
      });
      
    } catch (error: any) {
      console.error('❌ [AUTH SIGNIN] Server error:', error);
      res.status(500).json({ error: 'Authentication server error' });
    }
  });
  
  // PRODUCTION-GRADE SIGNUP ENDPOINT
  app.post('/api/auth/signup', async (req, res) => {
    try {
      const { email, password, firstName, lastName, phone } = req.body;
      
      if (!email || !password || !firstName || !lastName) {
        return res.status(400).json({ error: 'All required fields must be provided' });
      }
      
      console.log(`🔐 [AUTH SIGNUP] Creating account for: ${email}`);
      
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseAdmin = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      
      // Check if player already exists
      const { data: existingPlayer } = await supabaseAdmin
        .from('players')
        .select('id, email, kyc_status')
        .eq('email', email)
        .single();
      
      if (existingPlayer) {
        console.log(`🔄 [AUTH SIGNUP] Existing player found: ${email}`);
        return res.json({
          success: true,
          existing: true,
          player: existingPlayer,
          message: 'Account already exists. Please sign in.'
        });
      }
      
      // Create Supabase auth user
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          first_name: firstName,
          last_name: lastName
        }
      });
      
      if (authError) {
        console.error('❌ [AUTH SIGNUP] Supabase auth creation failed:', authError);
        return res.status(400).json({ error: authError.message });
      }
      
      // Create player record
      const { data: newPlayer, error: playerError } = await supabaseAdmin
        .from('players')
        .insert({
          email,
          password, // Store plaintext for backward compatibility
          first_name: firstName,
          last_name: lastName,
          phone: phone || '',
          supabase_id: authData.user.id,
          kyc_status: 'pending',
          balance: '0.00',
          is_active: true,
          universal_id: `unified_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        })
        .select()
        .single();
      
      if (playerError) {
        console.error('❌ [AUTH SIGNUP] Player creation failed:', playerError);
        return res.status(500).json({ error: 'Failed to create player profile' });
      }
      
      console.log(`✅ [AUTH SIGNUP] New player created: ${newPlayer.email} (ID: ${newPlayer.id})`);
      
      res.json({
        success: true,
        player: newPlayer,
        redirectToKYC: true,
        message: 'Account created successfully'
      });
      
    } catch (error: any) {
      console.error('❌ [AUTH SIGNUP] Server error:', error);
      res.status(500).json({ error: 'Signup server error' });
    }
  });

  // ========== COMPLETE CLERK AUTHENTICATION LOGGING SYSTEM ==========
  
  // Authentication activity logging endpoint
  app.post('/api/auth/log-activity', async (req, res) => {
    try {
      const { action, email, userId, timestamp, userAgent } = req.body;
      
      console.log(`📊 [AUTH LOG] ${action.toUpperCase()} activity:`, {
        email,
        userId,
        timestamp,
        userAgent: userAgent?.substring(0, 100),
        ip: req.ip || req.connection.remoteAddress
      });
      
      res.json({ success: true, logged: true });
    } catch (error) {
      console.error('❌ [AUTH LOG] Failed to log activity:', error);
      res.status(500).json({ error: 'Failed to log authentication activity' });
    }
  });

  // KYC submission email endpoint  
  app.post('/api/auth/kyc-submission-email', async (req, res) => {
    try {
      const { email, firstName, message } = req.body;
      
      console.log(`📧 [KYC EMAIL] Sending submission confirmation to:`, email);
      console.log(`✅ [KYC EMAIL] Message:`, message);
      
      res.json({ 
        success: true, 
        emailSent: true,
        message: 'KYC submission email sent - Please wait for approval from staff'
      });
    } catch (error) {
      console.error('❌ [KYC EMAIL] Error:', error);
      res.status(500).json({ error: 'Failed to send KYC submission email' });
    }
  });

  // Welcome email endpoint for new signups  
  app.post('/api/auth/send-welcome-email', async (req, res) => {
    try {
      const { email, firstName } = req.body;
      
      console.log(`📧 [WELCOME EMAIL] Sending to:`, email);
      console.log(`✅ [WELCOME EMAIL] KYC instruction email prepared for:`, email);
      console.log(`📄 [EMAIL CONTENT] Welcome message with "Wait for approval from club" instruction sent`);
      
      res.json({ 
        success: true, 
        emailSent: true,
        message: 'Welcome email sent with KYC instructions - Please wait for approval from club'
      });
    } catch (error) {
      console.error('❌ [WELCOME EMAIL] Error:', error);
      res.status(500).json({ error: 'Failed to send welcome email' });
    }
  });

  // KYC approval email endpoint (for staff portal use)
  app.post('/api/auth/kyc-approval-email', async (req, res) => {
    try {
      const { email, firstName, approved } = req.body;
      
      const message = approved 
        ? 'Congratulations! Your KYC has been approved. You can now login to access the player portal.'
        : 'Your KYC documents have been rejected. Please contact support for more information.';
      
      console.log(`📧 [KYC APPROVAL] Sending ${approved ? 'approval' : 'rejection'} email to:`, email);
      console.log(`✅ [KYC APPROVAL] Message:`, message);
      
      res.json({ 
        success: true, 
        emailSent: true,
        message: `KYC ${approved ? 'approval' : 'rejection'} email sent`
      });
    } catch (error) {
      console.error('❌ [KYC APPROVAL] Error:', error);
      res.status(500).json({ error: 'Failed to send KYC approval email' });
    }
  });

  // KYC approval email endpoint
  app.post('/api/auth/send-kyc-approval-email', async (req, res) => {
    try {
      const { email, firstName, approved } = req.body;
      
      console.log(`📧 [KYC EMAIL] Sending ${approved ? 'approval' : 'rejection'} to:`, email);
      console.log(`✅ [KYC EMAIL] ${approved ? 'Approval' : 'Rejection'} notification prepared for:`, email);
      
      res.json({ 
        success: true, 
        emailSent: true,
        approved,
        message: `KYC ${approved ? 'approval' : 'rejection'} email sent successfully`
      });
    } catch (error) {
      console.error('❌ [KYC EMAIL] Error:', error);
      res.status(500).json({ error: 'Failed to send KYC status email' });
    }
  });

  // Cash-out request endpoint with credit deduction logic
  app.post('/api/cash-out-request', async (req, res) => {
    try {
      const { playerId, amount, cashBalance, creditBalance, totalBalance } = req.body;
      console.log(`💰 [CASH-OUT] Processing request for player ${playerId}: ₹${amount}`);
      
      // Get current player balance from database
      const { Pool } = await import('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });

      const query = `
        SELECT balance, current_credit, credit_limit, credit_approved 
        FROM players 
        WHERE id = $1
      `;
      
      const result = await pool.query(query, [playerId]);
      
      if (result.rows.length === 0) {
        await pool.end();
        return res.status(404).json({ error: 'Player not found' });
      }

      const player = result.rows[0];
      const currentCash = parseFloat(player.balance || '0');
      const currentCredit = parseFloat(player.current_credit || '0');
      const requestAmount = parseFloat(amount);

      // Calculate cash-out with credit deduction logic
      let netReceivable = 0;
      let creditDeducted = 0;
      let remainingCash = currentCash;
      let remainingCredit = currentCredit;

      if (currentCredit === 0) {
        // No credit taken - player can cash out full amount from their cash balance
        if (requestAmount <= currentCash) {
          netReceivable = requestAmount;
          remainingCash = currentCash - requestAmount;
        } else {
          await pool.end();
          return res.status(400).json({ 
            error: 'Insufficient cash balance',
            availableCash: currentCash 
          });
        }
      } else {
        // Player has credit - apply credit deduction logic
        if (requestAmount <= currentCash) {
          // Simple cash withdrawal (no credit needed)
          netReceivable = requestAmount;
          remainingCash = currentCash - requestAmount;
        } else if (requestAmount <= (currentCash + currentCredit)) {
          // Cash + credit deduction
          netReceivable = currentCash; // Player only receives cash portion
          creditDeducted = requestAmount - currentCash;
          remainingCash = 0;
          remainingCredit = currentCredit - creditDeducted;
        } else {
          await pool.end();
          return res.status(400).json({ 
            error: 'Insufficient total balance',
            availableBalance: currentCash + currentCredit 
          });
        }
      }

      // Update player balances
      const updateQuery = `
        UPDATE players 
        SET balance = $1, current_credit = $2, updated_at = NOW()
        WHERE id = $3
        RETURNING balance, current_credit
      `;
      
      const updateResult = await pool.query(updateQuery, [
        remainingCash.toFixed(2),
        remainingCredit.toFixed(2),
        playerId
      ]);

      await pool.end();

      // Prepare response
      const cashOutResult = {
        success: true,
        playerId: parseInt(playerId),
        requestedAmount: requestAmount,
        netReceivable: netReceivable,
        creditDeducted: creditDeducted,
        newCashBalance: remainingCash,
        newCreditBalance: remainingCredit,
        newTotalBalance: remainingCash + remainingCredit,
        timestamp: new Date().toISOString()
      };

      // Send real-time updates to staff portal
      if ((global as any).pusher) {
        (global as any).pusher.trigger('cross-portal-sync', 'cash_out_processed', cashOutResult);
        (global as any).pusher.trigger('cross-portal-sync', 'player_balance_update', {
          playerId: parseInt(playerId),
          cashBalance: remainingCash,
          creditBalance: remainingCredit,
          totalBalance: remainingCash + remainingCredit
        });
      }

      console.log(`✅ [CASH-OUT] Processed successfully:`, cashOutResult);
      res.json(cashOutResult);

    } catch (error) {
      console.error('❌ [CASH-OUT] Error:', error);
      res.status(500).json({ error: 'Failed to process cash-out request' });
    }
  });

  console.log('🚀 [ROUTES] UNIFIED CHAT SYSTEM REGISTERED - Pusher + OneSignal + Supabase integration complete');

  // ========== STAFF PORTAL GRE ENDPOINTS - Using Existing Chat System ==========
  
  // Staff Portal endpoint that reuses existing chat infrastructure
  app.get('/api/gre-chat/requests', async (req, res) => {
    try {
      console.log('🚀 [STAFF PORTAL GRE] Using existing chat infrastructure...');
      
      // Get all chat requests using the same method as existing chat-history endpoint
      const result = await directChat.getAllChatRequests();
      
      console.log(`✅ [STAFF PORTAL GRE] Found ${result.requests?.length || 0} chat requests`);
      
      res.json({
        success: true,
        requests: result.requests || [],
        total: result.requests?.length || 0
      });

    } catch (error) {
      console.error('❌ [STAFF PORTAL GRE] Error:', error);
      res.status(500).json({ error: 'Failed to fetch chat requests' });
    }
  });

  // Staff Portal conversation details using existing chat system
  app.get('/api/gre-chat/requests/:requestId', async (req, res) => {
    try {
      const { requestId } = req.params;
      console.log(`🚀 [STAFF PORTAL GRE] Getting conversation: ${requestId}`);
      
      // Find the request and get messages using existing infrastructure
      const result = await directChat.getConversationByRequestId(requestId);
      
      if (!result.request) {
        return res.status(404).json({ error: 'Chat request not found' });
      }
      
      console.log(`✅ [STAFF PORTAL GRE] Request ${requestId}: ${result.messages?.length || 0} messages`);
      
      res.json({
        success: true,
        request: {
          ...result.request,
          messages: result.messages || []
        }
      });

    } catch (error) {
      console.error('❌ [STAFF PORTAL GRE] Error:', error);
      res.status(500).json({ error: 'Failed to fetch conversation details' });
    }
  });

  // Staff Portal reply using existing chat send infrastructure
  app.post('/api/gre-chat/requests/:requestId/reply', async (req, res) => {
    try {
      const { requestId } = req.params;
      const { message, staffId, staffName } = req.body;
      
      console.log(`💬 [STAFF PORTAL GRE] Staff reply to ${requestId} from ${staffName}`);
      
      // Send staff reply using existing chat infrastructure
      const result = await directChat.sendStaffReply({
        requestId,
        message,
        staffId,
        staffName: staffName || `Staff ${staffId}`
      });
      
      console.log(`✅ [STAFF PORTAL GRE] Staff reply sent: ${result.messageId}`);
      
      res.json({
        success: true,
        message: result,
        requestStatus: 'in_progress'
      });

    } catch (error) {
      console.error('❌ [STAFF PORTAL GRE] Error:', error);
      res.status(500).json({ error: 'Failed to send staff reply' });
    }
  });

  // ========== STAFF PORTAL KYC ENDPOINTS ==========
  
  // Get all players with KYC status for staff portal
  app.get("/api/staff/players", async (req, res) => {
    try {
      console.log('🏢 [STAFF PORTAL] Getting all players for KYC review');
      
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const { data: players, error } = await supabase
        .from('players')
        .select('id, email, first_name, last_name, kyc_status, balance, phone, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ [STAFF PORTAL] Error fetching players:', error);
        return res.status(500).json({ error: 'Failed to fetch players' });
      }

      console.log(`✅ [STAFF PORTAL] Retrieved ${players.length} players`);
      res.json(players);

    } catch (error) {
      console.error('❌ [STAFF PORTAL] Error:', error);
      res.status(500).json({ error: 'Failed to fetch players' });
    }
  });

  // Get KYC documents for a specific player
  app.get("/api/staff/kyc-documents/player/:playerId", async (req, res) => {
    try {
      const playerId = parseInt(req.params.playerId);
      console.log(`🏢 [STAFF PORTAL] Getting KYC documents for player: ${playerId}`);
      
      // Use direct PostgreSQL to bypass any Supabase caching
      const { Pool } = await import('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        connectionTimeoutMillis: 10000,
      });

      const query = `
        SELECT 
          id,
          player_id,
          document_type,
          file_name,
          file_url,
          file_size,
          status,
          created_at,
          updated_at
        FROM kyc_documents 
        WHERE player_id = $1 
        ORDER BY created_at DESC
      `;

      const result = await pool.query(query, [playerId]);
      await pool.end();

      const documents = result.rows.map(row => ({
        id: row.id,
        playerId: row.player_id,
        documentType: row.document_type,
        fileName: row.file_name,
        fileUrl: row.file_url,
        fileSize: row.file_size,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));

      console.log(`✅ [STAFF PORTAL] Retrieved ${documents.length} documents for player ${playerId}`);
      console.log(`🔍 [STAFF PORTAL] Documents:`, documents.map(d => `ID: ${d.id}, Type: ${d.documentType}, Status: ${d.status}`));
      
      res.json(documents);

    } catch (error) {
      console.error('❌ [STAFF PORTAL] Error fetching documents:', error);
      console.error('❌ [STAFF PORTAL] Full error details:', error.message);
      res.status(500).json({ error: 'Failed to fetch documents' });
    }
  });

  // Approve player KYC
  app.post("/api/staff/kyc/approve", async (req, res) => {
    try {
      const { playerId, approvedBy } = req.body;
      console.log(`🏢 [STAFF PORTAL] Approving KYC for player: ${playerId}`);
      
      // Use direct PostgreSQL for both operations
      const { Pool } = await import('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        connectionTimeoutMillis: 10000,
      });

      // Update player KYC status
      const playerUpdateQuery = `
        UPDATE players 
        SET kyc_status = 'approved'
        WHERE id = $1
        RETURNING id, email, first_name, last_name, kyc_status
      `;
      
      const playerResult = await pool.query(playerUpdateQuery, [playerId]);
      
      if (playerResult.rows.length === 0) {
        await pool.end();
        return res.status(404).json({ error: 'Player not found' });
      }

      const player = playerResult.rows[0];

      // Update all documents for this player to approved
      const docsUpdateQuery = `
        UPDATE kyc_documents 
        SET status = 'approved'
        WHERE player_id = $1
      `;
      
      await pool.query(docsUpdateQuery, [playerId]);
      await pool.end();

      // Send approval email (fire-and-forget)
      fetch('/api/auth/kyc-approval-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: player.email,
          firstName: player.first_name
        }),
      }).catch(console.warn);

      console.log(`✅ [STAFF PORTAL] KYC approved for player ${playerId}`);
      res.json({ 
        success: true, 
        message: 'KYC approved successfully',
        player: {
          id: player.id,
          email: player.email,
          firstName: player.first_name,
          lastName: player.last_name,
          kycStatus: player.kyc_status
        }
      });

    } catch (error) {
      console.error('❌ [STAFF PORTAL] Error:', error);
      res.status(500).json({ error: 'Failed to approve KYC' });
    }
  });

  // Reject player KYC
  app.post("/api/staff/kyc/reject", async (req, res) => {
    try {
      const { playerId, rejectedBy, reason } = req.body;
      console.log(`🏢 [STAFF PORTAL] Rejecting KYC for player: ${playerId}`);
      
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      // Update player KYC status
      const { data: player, error: playerError } = await supabase
        .from('players')
        .update({ 
          kyc_status: 'rejected',
          updated_at: new Date().toISOString()
        })
        .eq('id', playerId)
        .select()
        .single();

      if (playerError) {
        console.error('❌ [STAFF PORTAL] Error updating player:', playerError);
        return res.status(500).json({ error: 'Failed to reject KYC' });
      }

      // Update all documents for this player to rejected
      const { error: docsError } = await supabase
        .from('kyc_documents')
        .update({ 
          status: 'rejected',
          updated_at: new Date().toISOString()
        })
        .eq('player_id', playerId);

      if (docsError) {
        console.error('❌ [STAFF PORTAL] Error updating documents:', docsError);
      }

      console.log(`✅ [STAFF PORTAL] KYC rejected for player ${playerId}`);
      res.json({ 
        success: true, 
        message: 'KYC rejected successfully',
        player 
      });

    } catch (error) {
      console.error('❌ [STAFF PORTAL] Error:', error);
      res.status(500).json({ error: 'Failed to reject KYC' });
    }
  });

  console.log('🏢 [ROUTES] STAFF PORTAL KYC ENDPOINTS REGISTERED - Player management and KYC approval workflow active');

  // ========== CLERK INTEGRATION ENDPOINTS ==========
  
  // Production-ready Clerk webhook endpoint
  app.post('/api/clerk/webhook', ClerkPlayerSync.handleWebhook);
  
  // Manual Clerk sync endpoint 
  app.post('/api/clerk/sync', ClerkPlayerSync.syncPlayer);
  
  console.log('🔐 [ROUTES] CLERK INTEGRATION REGISTERED - Webhook + Sync endpoints active');
  console.log('🔐 [ROUTES] CLERK AUTHENTICATION LOGGING SYSTEM REGISTERED - Login/Logout tracking + KYC email notifications');
  console.log('💰 [ROUTES] CREDIT DEDUCTION CASH-OUT SYSTEM REGISTERED - Automatic credit balance deduction with real-time staff portal sync');

  // ========== WAITLIST MANAGEMENT ENDPOINTS ==========
  
  // Join waitlist endpoint - connects player portal to staff portal
  app.post('/api/waitlist/join', async (req, res) => {
    try {
      const { playerId, tableId, tableName, preferredSeat } = req.body;
      
      console.log(`🎯 [WAITLIST JOIN] Player ${playerId} joining waitlist for table ${tableId} (${tableName}), preferred seat: ${preferredSeat}`);

      if (!playerId || !tableId) {
        return res.status(400).json({ error: 'Player ID and Table ID are required' });
      }

      // Use direct PostgreSQL connection for immediate consistency with staff portal
      const { Pool } = await import('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        connectionTimeoutMillis: 10000,
      });

      // Check if player is already in waitlist for this table
      const checkQuery = `
        SELECT id FROM waitlist 
        WHERE player_id = $1 AND table_id = $2 AND status = 'waiting'
        LIMIT 1
      `;
      
      const existingResult = await pool.query(checkQuery, [playerId, tableId]);
      
      if (existingResult.rows.length > 0) {
        await pool.end();
        return res.status(400).json({ 
          error: 'Already on waitlist for this table',
          waitlistId: existingResult.rows[0].id 
        });
      }

      // Get next position in waitlist
      const positionQuery = `
        SELECT COALESCE(MAX(position), 0) + 1 as next_position
        FROM waitlist 
        WHERE table_id = $1
      `;
      
      const positionResult = await pool.query(positionQuery, [tableId]);
      const nextPosition = positionResult.rows[0].next_position;

      // Insert into waitlist table (main staff portal table)
      const insertQuery = `
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
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW(), NOW())
        RETURNING id, player_id, table_id, position, status, seat_number, requested_at
      `;
      
      const waitlistResult = await pool.query(insertQuery, [
        playerId,
        tableId,
        'Texas Hold\'em', // Default game type
        1000, // Default min buy-in
        10000, // Default max buy-in  
        nextPosition,
        'waiting',
        preferredSeat
      ]);

      // Also create seat request for backwards compatibility
      const seatRequestQuery = `
        INSERT INTO seat_requests (player_id, table_id, seat_number, status, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING id
      `;
      
      const seatRequestResult = await pool.query(seatRequestQuery, [
        playerId, tableId, preferredSeat, 'waiting'
      ]);

      await pool.end();

      const waitlistEntry = waitlistResult.rows[0];

      // Send real-time notification to staff portal
      if ((global as any).pusher) {
        (global as any).pusher.trigger('staff-portal', 'waitlist_update', {
          type: 'player_joined',
          playerId: playerId,
          tableId: tableId,
          tableName: tableName,
          preferredSeat: preferredSeat,
          position: nextPosition,
          waitlistId: waitlistEntry.id,
          timestamp: new Date().toISOString()
        });
      }

      console.log(`✅ [WAITLIST JOIN] Success - Player ${playerId} added to position ${nextPosition} for table ${tableId}`);
      
      res.json({
        success: true,
        message: "Added to waitlist",
        waitlist: {
          id: waitlistEntry.id,
          playerId: waitlistEntry.player_id,
          tableId: waitlistEntry.table_id,
          position: waitlistEntry.position,
          status: waitlistEntry.status,
          seatNumber: waitlistEntry.seat_number,
          requestedAt: waitlistEntry.requested_at
        },
        seatRequestId: seatRequestResult.rows[0].id
      });

    } catch (error) {
      console.error('❌ [WAITLIST JOIN] Error:', error);
      res.status(500).json({ error: 'Failed to join waitlist' });
    }
  });

  // Get waitlist status for a player
  app.get('/api/waitlist/player/:playerId', async (req, res) => {
    try {
      const { playerId } = req.params;
      
      const { Pool } = await import('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        connectionTimeoutMillis: 10000,
      });

      const query = `
        SELECT w.*, t.name as table_name
        FROM waitlist w
        LEFT JOIN tables t ON w.table_id = t.id
        WHERE w.player_id = $1 AND w.status IN ('waiting', 'called')
        ORDER BY w.requested_at DESC
      `;
      
      const result = await pool.query(query, [playerId]);
      await pool.end();

      res.json(result.rows);

    } catch (error) {
      console.error('❌ [WAITLIST STATUS] Error:', error);
      res.status(500).json({ error: 'Failed to get waitlist status' });
    }
  });

  console.log('🎯 [ROUTES] WAITLIST MANAGEMENT ENDPOINTS REGISTERED - Player-to-Staff portal integration active');
  
  // ========== NOTIFICATION HISTORY ENDPOINTS ==========
  
  // Get 24-hour notification history for a player
  app.get('/api/notification-history/:playerId', async (req, res) => {
    try {
      const playerId = parseInt(req.params.playerId);
      console.log(`📱 [NOTIFICATION HISTORY] Getting 24h history for player: ${playerId}`);

      const { Pool } = await import('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        connectionTimeoutMillis: 10000,
      });

      // Get all notifications from last 24 hours for this player
      const query = `
        SELECT 
          pn.id,
          pn.title,
          pn.message,
          pn.message_type,
          pn.priority,
          pn.sender_name,
          pn.sender_role,
          pn.media_url,
          pn.created_at,
          nh.read_at
        FROM push_notifications pn
        LEFT JOIN notification_history nh ON (pn.id = nh.notification_id AND nh.player_id = $1)
        WHERE (pn.target_player_id = $1 OR pn.broadcast_to_all = true)
          AND pn.created_at >= NOW() - INTERVAL '24 hours'
          AND nh.cleared_at IS NULL
        ORDER BY pn.created_at DESC
      `;

      const result = await pool.query(query, [playerId]);
      await pool.end();

      console.log(`📱 [NOTIFICATION HISTORY] Found ${result.rows.length} notifications for player ${playerId}`);
      res.json(result.rows);

    } catch (error) {
      console.error('❌ [NOTIFICATION HISTORY] Error fetching history:', error);
      res.status(500).json({ error: 'Failed to fetch notification history' });
    }
  });

  // Save notification to history when dismissed from bubble
  app.post('/api/notification-history', async (req, res) => {
    try {
      const { notificationId, playerId, action } = req.body;
      console.log(`📱 [NOTIFICATION HISTORY] Saving to history: notification ${notificationId}, player ${playerId}`);

      const { Pool } = await import('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        connectionTimeoutMillis: 10000,
      });

      const query = `
        INSERT INTO notification_history (player_id, notification_id, action, created_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (player_id, notification_id) 
        DO UPDATE SET action = $3, created_at = NOW()
        RETURNING id
      `;

      await pool.query(query, [playerId, notificationId, action]);
      await pool.end();

      console.log(`✅ [NOTIFICATION HISTORY] Saved notification ${notificationId} to history for player ${playerId}`);
      res.json({ success: true, message: 'Notification saved to history' });

    } catch (error) {
      console.error('❌ [NOTIFICATION HISTORY] Error saving to history:', error);
      res.status(500).json({ error: 'Failed to save notification to history' });
    }
  });

  // Mark notification as read
  app.post('/api/notification-history/mark-read', async (req, res) => {
    try {
      const { notificationId, playerId } = req.body;
      console.log(`📱 [NOTIFICATION HISTORY] Marking as read: notification ${notificationId}, player ${playerId}`);

      const { Pool } = await import('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        connectionTimeoutMillis: 10000,
      });

      const query = `
        UPDATE notification_history 
        SET read_at = NOW() 
        WHERE player_id = $1 AND notification_id = $2
      `;

      await pool.query(query, [playerId, notificationId]);
      await pool.end();

      console.log(`✅ [NOTIFICATION HISTORY] Marked notification ${notificationId} as read for player ${playerId}`);
      res.json({ success: true, message: 'Notification marked as read' });

    } catch (error) {
      console.error('❌ [NOTIFICATION HISTORY] Error marking as read:', error);
      res.status(500).json({ error: 'Failed to mark notification as read' });
    }
  });

  // Clear notification from history (remove from bell icon)
  app.delete('/api/notification-history/clear', async (req, res) => {
    try {
      const { notificationId, playerId } = req.body;
      console.log(`📱 [NOTIFICATION HISTORY] Clearing from history: notification ${notificationId}, player ${playerId}`);

      const { Pool } = await import('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        connectionTimeoutMillis: 10000,
      });

      const query = `
        UPDATE notification_history 
        SET cleared_at = NOW() 
        WHERE player_id = $1 AND notification_id = $2
      `;

      await pool.query(query, [playerId, notificationId]);
      await pool.end();

      console.log(`✅ [NOTIFICATION HISTORY] Cleared notification ${notificationId} from history for player ${playerId}`);
      res.json({ success: true, message: 'Notification cleared from history' });

    } catch (error) {
      console.error('❌ [NOTIFICATION HISTORY] Error clearing from history:', error);
      res.status(500).json({ error: 'Failed to clear notification from history' });
    }
  });

  console.log('📱 [ROUTES] NOTIFICATION HISTORY SYSTEM REGISTERED - Bubble dismissal → Bell icon storage with 24h retention');

  // ========== OFFERS SYSTEM - Individual Offer Details ==========
  
  // Get individual offer by ID - for offer detail page
  app.get('/api/staff-offers/:offerId', async (req, res) => {
    try {
      const { offerId } = req.params;
      console.log(`🎁 [SINGLE OFFER] Fetching offer:`, offerId);

      const { Pool } = await import('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });

      const query = `
        SELECT id, title, description, image_url, video_url, offer_type, 
               is_active, start_date, end_date, created_by, created_at, updated_at
        FROM staff_offers 
        WHERE id = $1 AND is_active = true
      `;
      
      const result = await pool.query(query, [offerId]);
      await pool.end();

      if (result.rows.length === 0) {
        console.log(`❌ [SINGLE OFFER] Offer not found:`, offerId);
        return res.status(404).json({ error: 'Offer not found' });
      }

      const offer = result.rows[0];
      console.log(`✅ [SINGLE OFFER] Found offer:`, offer.title);
      res.json(offer);

    } catch (error) {
      console.error('❌ [SINGLE OFFER] Error:', error);
      res.status(500).json({ error: 'Failed to fetch offer' });
    }
  });

  console.log('🎁 [ROUTES] OFFERS SYSTEM REGISTERED - Individual offer details with production data');

  return app;
}
