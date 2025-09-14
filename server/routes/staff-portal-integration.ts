import { Router } from "express";
import type { Request, Response } from "express";
import { supabaseOnlyStorage as storage } from "../supabase-only-storage";

const router = Router();

// Staff Portal Integration Routes for Cashier Operations
// These endpoints allow staff portal to manage player balances and credit

// 1. Cash In Operation (Add to real balance)
router.post('/api/staff/cash-in', async (req: Request, res: Response) => {
  try {
    const { playerId, amount, staffId, note } = req.body;
    
    if (!playerId || !amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid player ID or amount' });
    }

    // Get current player data
    const player = await storage.getPlayer(playerId);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Update balance
    const newBalance = (parseFloat(player.balance) + parseFloat(amount)).toFixed(2);
    const updatedPlayer = await storage.updatePlayerBalance(playerId, {
      balance: newBalance,
      totalDeposits: (parseFloat(player.totalDeposits) + parseFloat(amount)).toFixed(2)
    });

    // Log transaction
    console.log(`💰 [STAFF CASH-IN] Player ${playerId}: +₹${amount} | New Balance: ₹${newBalance} | Staff: ${staffId}`);

    res.json({
      success: true,
      player: updatedPlayer,
      transaction: {
        type: 'cash_in',
        amount: parseFloat(amount),
        newBalance: parseFloat(newBalance),
        staffId,
        note,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('❌ [STAFF CASH-IN] Error:', error);
    res.status(500).json({ error: 'Cash in operation failed', details: error.message });
  }
});

// 2. Cash Out Operation (Deduct from real balance)
router.post('/api/staff/cash-out', async (req: Request, res: Response) => {
  try {
    const { playerId, amount, staffId, note } = req.body;
    
    if (!playerId || !amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid player ID or amount' });
    }

    const player = await storage.getPlayer(playerId);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Check sufficient balance
    const currentBalance = parseFloat(player.balance);
    if (currentBalance < parseFloat(amount)) {
      return res.status(400).json({ error: 'Insufficient balance for cash out' });
    }

    // Update balance
    const newBalance = (currentBalance - parseFloat(amount)).toFixed(2);
    const updatedPlayer = await storage.updatePlayerBalance(playerId, {
      balance: newBalance,
      totalWithdrawals: (parseFloat(player.totalWithdrawals) + parseFloat(amount)).toFixed(2)
    });

    console.log(`💸 [STAFF CASH-OUT] Player ${playerId}: -₹${amount} | New Balance: ₹${newBalance} | Staff: ${staffId}`);

    res.json({
      success: true,
      player: updatedPlayer,
      transaction: {
        type: 'cash_out',
        amount: parseFloat(amount),
        newBalance: parseFloat(newBalance),
        staffId,
        note,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('❌ [STAFF CASH-OUT] Error:', error);
    res.status(500).json({ error: 'Cash out operation failed', details: error.message });
  }
});

// 3. Credit Limit Management
router.post('/api/staff/credit-limit', async (req: Request, res: Response) => {
  try {
    const { playerId, creditLimit, staffId, note } = req.body;
    
    if (!playerId || creditLimit < 0) {
      return res.status(400).json({ error: 'Invalid player ID or credit limit' });
    }

    const updatedPlayer = await storage.updatePlayerCredit(playerId, {
      creditLimit: parseFloat(creditLimit).toFixed(2),
      creditApproved: creditLimit > 0
    });

    console.log(`🏦 [STAFF CREDIT] Player ${playerId}: Credit Limit ₹${creditLimit} | Staff: ${staffId}`);

    res.json({
      success: true,
      player: updatedPlayer,
      transaction: {
        type: 'credit_limit_update',
        creditLimit: parseFloat(creditLimit),
        staffId,
        note,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('❌ [STAFF CREDIT] Error:', error);
    res.status(500).json({ error: 'Credit limit update failed', details: error.message });
  }
});

// 4. Credit Clear Operation
router.post('/api/staff/credit-clear', async (req: Request, res: Response) => {
  try {
    const { playerId, staffId, note } = req.body;
    
    if (!playerId) {
      return res.status(400).json({ error: 'Invalid player ID' });
    }

    const updatedPlayer = await storage.updatePlayerCredit(playerId, {
      currentCredit: '0.00',
      creditApproved: false
    });

    console.log(`🧹 [STAFF CREDIT-CLEAR] Player ${playerId}: Credit Cleared | Staff: ${staffId}`);

    res.json({
      success: true,
      player: updatedPlayer,
      transaction: {
        type: 'credit_clear',
        staffId,
        note,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('❌ [STAFF CREDIT-CLEAR] Error:', error);
    res.status(500).json({ error: 'Credit clear operation failed', details: error.message });
  }
});

// 5. Get Player Balance Summary for Staff Portal
router.get('/api/staff/player-balance/:playerId', async (req: Request, res: Response) => {
  try {
    const { playerId } = req.params;
    
    const player = await storage.getPlayer(playerId);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const balanceSummary = {
      playerId: player.id,
      playerName: `${player.firstName} ${player.lastName}`,
      email: player.email,
      realBalance: parseFloat(player.balance),
      currentCredit: parseFloat(player.currentCredit || '0.00'),
      creditLimit: parseFloat(player.creditLimit || '0.00'),
      creditApproved: player.creditApproved || false,
      totalAvailable: parseFloat(player.balance) + parseFloat(player.currentCredit || '0.00'),
      totalDeposits: parseFloat(player.totalDeposits),
      totalWithdrawals: parseFloat(player.totalWithdrawals),
      kycStatus: player.kycStatus
    };

    res.json({ success: true, balance: balanceSummary });
  } catch (error: any) {
    console.error('❌ [STAFF BALANCE] Error:', error);
    res.status(500).json({ error: 'Failed to get balance summary', details: error.message });
  }
});

// 6. Assign Player to Seat
router.post('/api/staff/assign-player', async (req: Request, res: Response) => {
  try {
    const { playerId, tableId, seatNumber, assignedBy, note } = req.body;
    
    if (!playerId || !tableId || !seatNumber || !assignedBy) {
      return res.status(400).json({ error: 'Missing required fields: playerId, tableId, seatNumber, assignedBy' });
    }

    // Validate seat number (1-9 based on table schema)
    if (seatNumber < 1 || seatNumber > 9) {
      return res.status(400).json({ error: 'Invalid seat number. Must be between 1 and 9' });
    }

    console.log(`🪑 [STAFF ASSIGN] Assigning player ${playerId} to seat ${seatNumber} at table ${tableId} by ${assignedBy}`);

    // Use PostgreSQL direct connection for seat assignment
    const { Client } = await import('pg');
    const pgClient = new Client({ connectionString: process.env.DATABASE_URL });
    await pgClient.connect();

    try {
      // Start transaction
      await pgClient.query('BEGIN');

      // 1. Check if seat is already occupied
      const seatCheck = await pgClient.query(
        'SELECT id, player_id FROM seat_requests WHERE table_id = $1 AND seat_number = $2 AND status = $3',
        [tableId, seatNumber, 'seated']
      );

      if (seatCheck.rows.length > 0) {
        await pgClient.query('ROLLBACK');
        await pgClient.end();
        return res.status(409).json({ error: `Seat ${seatNumber} is already occupied` });
      }

      // 2. Find the player's waitlist entry
      const waitlistQuery = await pgClient.query(
        'SELECT id, player_id, table_id, seat_number, status FROM seat_requests WHERE player_id = $1 AND table_id = $2 AND status = $3',
        [playerId, tableId, 'waiting']
      );

      if (waitlistQuery.rows.length === 0) {
        await pgClient.query('ROLLBACK');
        await pgClient.end();
        return res.status(404).json({ error: 'Player not found in waitlist for this table' });
      }

      const waitlistEntry = waitlistQuery.rows[0];

      // 3. Update the seat_requests entry to 'seated' status with session data
      const updateResult = await pgClient.query(`
        UPDATE seat_requests 
        SET status = $1, seat_number = $2, updated_at = NOW(), 
            session_start_time = NOW(), 
            session_buy_in_amount = 10000,
            min_play_time_minutes = 30,
            call_time_window_minutes = 60,
            call_time_play_period_minutes = 15,
            cashout_window_minutes = 10,
            cashout_window_active = false,
            notes = $3
        WHERE id = $4 
        RETURNING *
      `, ['seated', seatNumber, note || `Assigned to seat ${seatNumber} by ${assignedBy}`, waitlistEntry.id]);

      if (updateResult.rows.length === 0) {
        await pgClient.query('ROLLBACK');
        await pgClient.end();
        return res.status(500).json({ error: 'Failed to update seat assignment' });
      }

      // 4. Get player information for response
      const playerResult = await pgClient.query(
        'SELECT id, first_name, last_name, email, phone FROM players WHERE id = $1',
        [playerId]
      );

      // Commit transaction
      await pgClient.query('COMMIT');
      await pgClient.end();

      const assignedSeat = updateResult.rows[0];
      const player = playerResult.rows[0];

      console.log(`✅ [STAFF ASSIGN] Player ${playerId} (${player.first_name} ${player.last_name}) assigned to seat ${seatNumber}`);

      // 5. Send real-time notifications via Pusher
      const Pusher = await import('pusher');
      const pusher = new Pusher.default({
        appId: process.env.PUSHER_APP_ID!,
        key: process.env.PUSHER_KEY!,
        secret: process.env.PUSHER_SECRET!,
        cluster: process.env.PUSHER_CLUSTER!,
        useTLS: true,
      });

      // Notify player about seat assignment
      await pusher.trigger(`player-${playerId}`, 'seat-assigned', {
        tableId,
        seatNumber,
        assignedBy,
        assignedAt: new Date().toISOString(),
        message: `You have been assigned to seat ${seatNumber}`
      });

      // Notify staff portal about the assignment
      await pusher.trigger('staff-portal', 'player-seated', {
        playerId,
        playerName: `${player.first_name} ${player.last_name}`,
        tableId,
        seatNumber,
        assignedBy,
        assignedAt: new Date().toISOString()
      });

      console.log(`📡 [STAFF ASSIGN] Real-time notifications sent for player ${playerId} seat assignment`);

      res.json({
        success: true,
        assignment: {
          id: assignedSeat.id,
          playerId: player.id,
          tableId,
          seatNumber,
          status: 'seated',
          assignedBy,
          assignedAt: assignedSeat.updated_at,
          player: {
            firstName: player.first_name,
            lastName: player.last_name,
            email: player.email,
            phone: player.phone
          }
        }
      });

    } catch (dbError: any) {
      await pgClient.query('ROLLBACK');
      await pgClient.end();
      console.error('❌ [STAFF ASSIGN] Database error:', dbError);
      throw dbError;
    }

  } catch (error: any) {
    console.error('❌ [STAFF ASSIGN] Error:', error);
    res.status(500).json({ error: 'Seat assignment failed', details: error.message });
  }
});

export default router;