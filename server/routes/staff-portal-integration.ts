import { Router } from "express";
import type { Request, Response } from "express";
import { storage } from "../supabase-only-storage";

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

export default router;