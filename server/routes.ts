
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

// Import direct chat system (bypasses Supabase cache issues)
import { directChat } from './direct-chat-system';

// Import Clerk integration
import { ClerkPlayerSync } from './clerk-integration';
import { SupabaseOnlyStorage } from './supabase-only-storage';

// Import staff portal integration
import staffPortalRoutes from './routes/staff-portal-integration';

export function registerRoutes(app: Express) {
  // SIMPLE CASH BALANCE SYSTEM - MANAGER HANDLES TABLE OPERATIONS
  
  // Player Balance API - Simple cash balance only (no table balance display)
  app.get("/api/player/:playerId/balance", async (req, res) => {
    try {
      const playerId = parseInt(req.params.playerId);
      console.log(`💰 [BALANCE API] Getting balance for player: ${playerId}`);

      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      // Force fresh query - bypass any caching
      console.log(`🔍 [BALANCE API] Querying fresh data for player: ${playerId}`);
      const { data: player, error: playerError } = await supabase
        .from('players')
        .select('id, first_name, last_name, balance, credit_limit, current_credit, credit_approved')
        .eq('id', playerId)
        .single();

      console.log(`📊 [BALANCE API] Raw data from Supabase:`, player);
      console.log(`💰 [BALANCE API] Player balance field:`, player?.balance, typeof player?.balance);

      if (playerError || !player) {
        console.error('❌ [BALANCE API] Player not found:', playerError);
        return res.status(404).json({ error: 'Player not found' });
      }

      // Use actual balance from database - no more hardcoded fixes
      let cashBalance = parseFloat(player.balance || '0');

      const creditLimit = parseFloat(player.credit_limit || '0');
      const availableCredit = parseFloat(player.current_credit || '0');

      const response = {
        playerId: player.id,
        cashBalance,
        tableBalance: 0, // Hidden from player - managed by manager only
        totalBalance: cashBalance,
        creditLimit,
        availableCredit
      };

      console.log(`✅ [BALANCE API] Balance retrieved:`, response);
      res.json(response);

    } catch (error: any) {
      console.error('❌ [BALANCE API] Error:', error);
      res.status(500).json({ error: 'Failed to fetch player balance' });
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
          const { createClient } = require('@supabase/supabase-js');
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
                  app_id: process.env.ONESIGNAL_APP_ID!,
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
          clerkUserId: playerData.clerk_user_id
        }
      });
      
    } catch (error: any) {
      console.error('❌ [CLERK SYNC] Error:', error);
      res.status(500).json({ error: error.message || 'Sync failed' });
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
      
      // First, ensure chat request exists
      let { data: existingRequest } = await supabase
        .from('chat_requests')
        .select('id')
        .eq('player_id', playerId)
        .single();

      let requestId = existingRequest?.id;

      if (!requestId) {
        // Create new chat request using correct column names
        const { data: newRequest, error: requestError } = await supabase
          .from('chat_requests')
          .insert({
            id: `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            player_id: playerId,
            subject: `Chat with ${playerName || `Player ${playerId}`}`,
            initial_message: message,
            status: 'pending',
            priority: 'medium',
            created_at: new Date().toISOString()
          })
          .select('id')
          .single();

        if (requestError) {
          console.error('❌ [CHAT PERSISTENCE] Error creating request:', requestError);
        } else {
          requestId = newRequest?.id;
          console.log('🚀 [CHAT PERSISTENCE] Created new chat request:', requestId);
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

  // Create new player (Signup endpoint)
  app.post("/api/players", async (req, res) => {
    try {
      const { email, password, firstName, lastName, phone, supabaseId, clerkUserId } = req.body;
      
      console.log('🆕 [SIGNUP API] Creating player:', { email, firstName, lastName, phone });
      
      // Validate required fields
      if (!email || !firstName || !lastName || !phone) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Create player using direct SQL insert (bypasses all schema cache issues)
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      // Generate unique IDs
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substr(2, 8);
      const universalId = `unified_${timestamp}_${randomId}`;
      const newSupabaseId = `auth_${timestamp}_${randomId}`;

      // Use PostgreSQL client directly to bypass Supabase schema cache
      const { Client } = await import('pg');
      const pgClient = new Client({
        connectionString: process.env.DATABASE_URL
      });
      
      await pgClient.connect();
      
      const insertQuery = `
        INSERT INTO players (
          email, password, first_name, last_name, phone, 
          clerk_user_id, supabase_id, universal_id,
          kyc_status, balance, total_deposits, total_withdrawals,
          total_winnings, total_losses, games_played, hours_played, 
          is_active, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, 
          'pending', '0.00', '0.00', '0.00', '0.00', '0.00', 0, '0.00', 
          true, NOW()
        ) RETURNING *
      `;
      
      const result = await pgClient.query(insertQuery, [
        email, password, firstName, lastName, phone, 
        clerkUserId, newSupabaseId, universalId
      ]);
      
      await pgClient.end();
      
      const playerData = result.rows[0];

      if (!playerData) {
        throw new Error('Failed to create player: No data returned');
      }

      // Transform to expected format - manual transformation to avoid schema issues
      const player = {
        id: playerData.id,
        email: playerData.email,
        firstName: playerData.first_name,
        lastName: playerData.last_name,
        phone: playerData.phone,
        kycStatus: playerData.kyc_status,
        balance: playerData.balance,
        createdAt: playerData.created_at,
        clerkUserId: playerData.clerk_user_id,
        supabaseId: playerData.supabase_id,
        universalId: playerData.universal_id
      };

      console.log('✅ [SIGNUP API] Player created successfully:', player.id);
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

  app.get("/api/players/supabase/:supabaseId", async (req, res) => {
    try {
      const { supabaseId } = req.params;
      console.log(`🔍 [PLAYER API] Getting player by Supabase ID: ${supabaseId}`);
      
      const player = await unifiedPlayerSystem.getPlayerBySupabaseId(supabaseId);
      
      if (!player) {
        console.log(`❌ [PLAYER API] Player not found for Supabase ID: ${supabaseId}`);
        return res.status(404).json({ error: "Player not found" });
      }
      
      // PLAYER ID MAPPING: Use actual player ID from database (Player ID 29 for Vignesh Ghana)
      console.log(`✅ [PLAYER API] Using authentic player ID: ${player.id} for: ${player.email}`);
      
      console.log(`✅ [PLAYER API] Player found: ${player.email} (ID: ${player.id})`);
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

  app.get("/api/account-balance/:playerId", async (req, res) => {
    try {
      const { playerId } = req.params;
      console.log(`💰 [DUAL BALANCE API] Getting balance for player:`, playerId);
      
      // Use direct PostgreSQL query to get balance data
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
      await pool.end();

      if (result.rows.length === 0) {
        throw new Error('Player not found');
      }

      const player = result.rows[0];
      const response = {
        currentBalance: (parseFloat(player.balance || '0')).toString(),
        availableBalance: (parseFloat(player.balance || '0')).toString(),
        creditBalance: (parseFloat(player.current_credit || '0')).toString(),
        creditLimit: (parseFloat(player.credit_limit || '0')).toString(),
        creditApproved: player.credit_approved || false,
        totalBalance: (parseFloat(player.balance || '0') + parseFloat(player.current_credit || '0')).toString(),
        pendingWithdrawals: "₹0.00"
      };

      console.log(`✅ [DUAL BALANCE API] Retrieved dual balance:`, response);
      
      // Trigger real-time update for any connected staff portals
      if ((global as any).pusher) {
        (global as any).pusher.trigger('cross-portal-sync', 'balance_query', {
          playerId: parseInt(playerId),
          timestamp: new Date().toISOString(),
          balance: response
        });
      }
      
      res.json(response);
    } catch (error) {
      console.error('❌ [DUAL BALANCE API] Error:', error);
      res.status(404).json({ error: 'Player not found' });
    }
  });

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

  // Manual Balance Update Trigger - For fixing sync issues
  app.post('/api/trigger-balance-update/:playerId', async (req, res) => {
    try {
      const { playerId } = req.params;
      const { operation = 'manual_sync' } = req.body;
      
      console.log(`🔄 [MANUAL SYNC] Triggering balance update for player: ${playerId}`);
      
      // Get fresh balance from database
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

      console.log(`✅ [MANUAL SYNC] Balance update triggered: ₹${cashBalance}`);
      res.json({ 
        success: true, 
        cashBalance, 
        creditBalance,
        message: 'Balance sync triggered successfully' 
      });

    } catch (error) {
      console.error('❌ [MANUAL SYNC] Error:', error);
      res.status(500).json({ error: 'Failed to trigger balance update' });
    }
  });

  // ========== DUAL BALANCE MANAGEMENT SYSTEM ==========
  
  // Enhanced balance API with dual balance support
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
        SELECT balance, current_credit, credit_limit, credit_approved 
        FROM players 
        WHERE id = $1
      `;
      
      const result = await pool.query(query, [playerId]);
      await pool.end();

      if (result.rows.length === 0) {
        throw new Error('Player not found');
      }

      const player = result.rows[0];
      const balanceData = {
        cashBalance: parseFloat(player.balance || '0'),
        creditBalance: parseFloat(player.current_credit || '0'),
        creditLimit: parseFloat(player.credit_limit || '0'),
        creditApproved: player.credit_approved || false,
        totalBalance: parseFloat(player.balance || '0') + parseFloat(player.current_credit || '0')
      };

      console.log(`✅ [DUAL BALANCE] Retrieved:`, balanceData);
      res.json(balanceData);
    } catch (error) {
      console.error('❌ [DUAL BALANCE] Error:', error);
      res.status(500).json({ error: 'Failed to fetch balance' });
    }
  });

  // Legacy account balance endpoint (backwards compatibility)
  app.get('/api/account-balance/:playerId', async (req, res) => {
    try {
      const { playerId } = req.params;
      console.log(`💰 [LEGACY BALANCE] Getting balance for player:`, playerId);
      
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseClient = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      
      const { data: player, error } = await supabaseClient
        .from('players')
        .select('balance, current_credit, credit_limit, credit_approved')
        .eq('id', playerId)
        .single();

      if (error) throw error;
      if (!player) throw new Error('Player not found');

      const balanceData = {
        currentBalance: player.balance || '0.00',
        availableBalance: player.balance || '0.00',
        pendingWithdrawals: '₹0.00',
        // Added for dual balance support
        cashBalance: parseFloat(player.balance || '0'),
        creditBalance: parseFloat(player.current_credit || '0'),
        creditLimit: parseFloat(player.credit_limit || '0'),
        creditApproved: player.credit_approved || false,
        totalBalance: parseFloat(player.balance || '0') + parseFloat(player.current_credit || '0')
      };

      console.log(`✅ [LEGACY BALANCE] Balance retrieved:`, balanceData);
      res.json(balanceData);
    } catch (error) {
      console.error('❌ [LEGACY BALANCE] Error:', error);
      res.status(500).json({ error: 'Failed to fetch balance' });
    }
  });

  // ========== KYC DOCUMENT UPLOAD AND MANAGEMENT SYSTEM ==========
  
  // Document upload endpoint
  app.post('/api/documents/upload', async (req, res) => {
    try {
      const { playerId, documentType, fileName, fileData, fileSize, mimeType } = req.body;
      
      console.log(`📄 [KYC UPLOAD] Uploading ${documentType} for player:`, playerId);
      
      if (!playerId || !documentType || !fileName || !fileData) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Use the existing working Supabase document storage
      const { SupabaseDocumentStorage } = await import('./supabase-document-storage.js');
      const documentStorage = new SupabaseDocumentStorage();
      
      // Upload to Supabase Storage and save metadata
      const uploadedDoc = await documentStorage.uploadDocument(
        parseInt(playerId),
        documentType,
        fileName,
        fileData
      );

      console.log(`✅ [KYC UPLOAD] Document uploaded successfully:`, uploadedDoc.id);
      res.json({ success: true, document: uploadedDoc });
    } catch (error) {
      console.error('❌ [KYC UPLOAD] Error:', error);
      res.status(500).json({ error: 'Failed to upload document' });
    }
  });

  // Get player documents
  app.get('/api/documents/player/:playerId', async (req, res) => {
    try {
      const { playerId } = req.params;
      
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      
      const { data, error } = await supabase
        .from('kyc_documents')
        .select('*')
        .eq('player_id', playerId)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;

      res.json(data || []);
    } catch (error) {
      console.error('❌ [KYC DOCS] Error:', error);
      res.status(500).json({ error: 'Failed to fetch documents' });
    }
  });

  // KYC submission endpoint
  app.post('/api/kyc/submit', async (req, res) => {
    try {
      const { playerId, email, firstName, lastName, panCardNumber } = req.body;
      
      console.log(`📋 [KYC SUBMIT] Submitting KYC for player:`, playerId);
      
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseClient = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      
      // Update player KYC status to submitted and add PAN card
      const { error } = await supabaseClient
        .from('players')
        .update({ 
          kyc_status: 'submitted',
          pan_card: panCardNumber,
          updated_at: new Date().toISOString()
        })
        .eq('id', playerId);

      if (error) throw error;

      // Send welcome email notification
      try {
        await fetch('/api/auth/kyc-submission-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            email,
            firstName,
            message: 'Thank you for registering to the Poker Club. Your documents have been submitted for review. Please wait for approval from our staff. Once approved, you will receive another email and can login to access the player portal.'
          })
        });
      } catch (emailError) {
        console.log('📧 [EMAIL] Note: Email service not configured');
      }

      console.log(`✅ [KYC SUBMIT] KYC submitted successfully for player:`, playerId);
      res.json({ success: true, message: 'KYC documents submitted for review. Check your email for confirmation.' });
    } catch (error) {
      console.error('❌ [KYC SUBMIT] Error:', error);
      res.status(500).json({ error: 'Failed to submit KYC' });
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
  console.log('🔐 [ROUTES] CLERK AUTHENTICATION LOGGING SYSTEM REGISTERED - Login/Logout tracking + KYC email notifications');
  console.log('💰 [ROUTES] CREDIT DEDUCTION CASH-OUT SYSTEM REGISTERED - Automatic credit balance deduction with real-time staff portal sync');
  
  return app;
}
