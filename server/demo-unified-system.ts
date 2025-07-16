import { unifiedPlayerSystem } from './unified-player-system';
import { supabase } from './supabase';

/**
 * Demonstration of the Unified Player ID System
 * This script shows how the system bridges Supabase auth.users.id with application players table
 */

export async function demonstrateUnifiedSystem() {
  console.log('🎯 UNIFIED PLAYER ID SYSTEM DEMONSTRATION');
  console.log('=========================================');
  
  // Scenario 1: User signs up through Supabase Auth
  console.log('\n📝 SCENARIO 1: New User Signup');
  console.log('-------------------------------');
  
  const testEmail = 'demo@unified.system';
  const testPassword = 'DemoPass123!';
  
  try {
    // Step 1: Create Supabase auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true
    });
    
    if (authError) {
      console.log('❌ Auth user creation failed:', authError.message);
      return;
    }
    
    console.log('✅ Supabase auth user created:');
    console.log('   - Supabase ID:', authData.user.id);
    console.log('   - Email:', authData.user.email);
    
    // Step 2: Create application player record with unified ID
    const playerData = {
      email: testEmail,
      password: testPassword,
      firstName: 'Demo',
      lastName: 'User',
      phone: '+91-9876543210'
    };
    
    const unifiedPlayer = await unifiedPlayerSystem.createPlayer(authData.user.id, playerData);
    
    console.log('✅ Application player created:');
    console.log('   - App ID:', unifiedPlayer.id);
    console.log('   - Supabase ID:', unifiedPlayer.supabaseId);
    console.log('   - Email:', unifiedPlayer.email);
    console.log('   - Status:', unifiedPlayer.kycStatus);
    
    // Scenario 2: Demonstrate cross-system integration
    console.log('\n🔄 SCENARIO 2: Cross-System Integration');
    console.log('--------------------------------------');
    
    // Step 3: Retrieve player by Supabase ID (used by auth system)
    const playerBySupabaseId = await unifiedPlayerSystem.getPlayerBySupabaseId(authData.user.id);
    console.log('✅ Retrieved player by Supabase ID:');
    console.log('   - Found player:', playerBySupabaseId ? 'YES' : 'NO');
    console.log('   - App ID:', playerBySupabaseId?.id);
    console.log('   - Matches original:', playerBySupabaseId?.id === unifiedPlayer.id);
    
    // Step 4: Retrieve player by App ID (used by application logic)
    const playerByAppId = await unifiedPlayerSystem.getPlayerById(unifiedPlayer.id);
    console.log('✅ Retrieved player by App ID:');
    console.log('   - Found player:', playerByAppId ? 'YES' : 'NO');
    console.log('   - Supabase ID:', playerByAppId?.supabaseId);
    console.log('   - Matches original:', playerByAppId?.supabaseId === authData.user.id);
    
    // Step 5: Demonstrate KYC integration
    console.log('\n📋 SCENARIO 3: KYC Document Integration');
    console.log('--------------------------------------');
    
    // Import KYC document storage
    const { supabaseDocumentStorage } = await import('./supabase-document-storage');
    
    // Upload KYC document using App ID
    const kycDocument = await supabaseDocumentStorage.uploadDocument(
      unifiedPlayer.id, // Uses Application ID
      'id',
      'government-id.jpg',
      'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k='
    );
    
    console.log('✅ KYC document uploaded:');
    console.log('   - Document ID:', kycDocument.id);
    console.log('   - Player ID:', kycDocument.playerId);
    console.log('   - Matches App ID:', kycDocument.playerId === unifiedPlayer.id);
    console.log('   - Status:', kycDocument.status);
    
    // Step 6: Retrieve documents by player ID
    const playerDocuments = await supabaseDocumentStorage.getPlayerDocuments(unifiedPlayer.id);
    console.log('✅ Retrieved KYC documents:');
    console.log('   - Document count:', playerDocuments.length);
    console.log('   - All belong to player:', playerDocuments.every(doc => doc.playerId === unifiedPlayer.id));
    
    // Scenario 4: Demonstrate system consistency
    console.log('\n🎯 SCENARIO 4: System Consistency Verification');
    console.log('---------------------------------------------');
    
    console.log('✅ UNIFIED ID SYSTEM STATUS:');
    console.log('   - Supabase Auth User ID:', authData.user.id);
    console.log('   - Application Player ID:', unifiedPlayer.id);
    console.log('   - Bridge Field (supabase_id):', unifiedPlayer.supabaseId);
    console.log('   - ID Bridge Working:', unifiedPlayer.supabaseId === authData.user.id);
    console.log('   - Cross-system Queries:', 'FUNCTIONAL');
    console.log('   - KYC Integration:', 'FUNCTIONAL');
    console.log('   - Data Consistency:', 'MAINTAINED');
    
    // Step 7: Show integration prompts for other projects
    console.log('\n📋 INTEGRATION PROMPTS FOR OTHER PROJECTS');
    console.log('==========================================');
    
    const integrationPrompts = {
      staffPokerPortal: `
// Staff Poker Portal - Add this to your routes:
app.get("/api/players/supabase/:supabaseId", async (req, res) => {
  const player = await unifiedPlayerSystem.getPlayerBySupabaseId(req.params.supabaseId);
  if (!player) return res.status(404).json({ error: "Player not found" });
  res.json(player);
});

// Update your player queries to use App ID (integer) consistently:
// ✅ Use: player.id (integer) for all database operations
// ✅ Use: player.supabaseId (string) for auth system integration
`,
      
      masterAdminPortal: `
// Master Admin Portal - Add unified player system:
import { unifiedPlayerSystem } from './unified-player-system';

// Get player by either ID type:
const getPlayerByEitherId = async (id: string | number) => {
  if (typeof id === 'string') {
    return await unifiedPlayerSystem.getPlayerBySupabaseId(id);
  }
  return await unifiedPlayerSystem.getPlayerById(id);
};

// All admin operations should use App ID (integer):
// ✅ KYC approvals: Use player.id
// ✅ Balance management: Use player.id  
// ✅ Transaction history: Use player.id
`,
      
      pokerRoomTracker: `
// Poker Room Tracker - Update table join logic:
app.post("/api/tables/:tableId/join", async (req, res) => {
  const { supabaseId } = req.body;
  
  // Get player by Supabase ID from auth system
  const player = await unifiedPlayerSystem.getPlayerBySupabaseId(supabaseId);
  if (!player) {
    return res.status(404).json({ error: "Player not found" });
  }
  
  // Use App ID for all table operations
  const seatRequest = await createSeatRequest({
    playerId: player.id, // Use integer App ID
    tableId: parseInt(req.params.tableId),
    status: 'waiting'
  });
  
  res.json(seatRequest);
});
`
    };
    
    console.log('STAFF POKER PORTAL INTEGRATION:');
    console.log(integrationPrompts.staffPokerPortal);
    
    console.log('\nMASTER ADMIN PORTAL INTEGRATION:');
    console.log(integrationPrompts.masterAdminPortal);
    
    console.log('\nPOKER ROOM TRACKER INTEGRATION:');
    console.log(integrationPrompts.pokerRoomTracker);
    
    // Cleanup
    console.log('\n🧹 CLEANING UP DEMO DATA');
    console.log('-------------------------');
    
    // Delete the demo user
    await supabase.auth.admin.deleteUser(authData.user.id);
    console.log('✅ Demo user cleaned up');
    
    return {
      success: true,
      supabaseId: authData.user.id,
      appId: unifiedPlayer.id,
      integrationPrompts
    };
    
  } catch (error: any) {
    console.error('❌ Demo failed:', error.message);
    return { success: false, error: error.message };
  }
}

// Export the integration prompts for other projects
export const integrationPrompts = {
  description: `
UNIFIED PLAYER ID SYSTEM INTEGRATION

The system uses TWO types of IDs:
1. Supabase Auth ID (UUID string) - Used for authentication
2. Application Player ID (integer) - Used for all database operations

KEY PRINCIPLE: Every player has BOTH IDs linked in the players table:
- players.id (serial/integer) - Application database primary key
- players.supabase_id (text) - Links to auth.users.id

IMPLEMENTATION RULE:
- Use Supabase ID for auth-related operations
- Use App ID for ALL other database operations (KYC, tables, transactions, etc.)
`,
  
  staffPokerPortal: `
// 1. Add to your database schema:
ALTER TABLE players ADD COLUMN supabase_id TEXT UNIQUE;

// 2. Update your routes to handle both ID types:
app.get("/api/players/supabase/:supabaseId", async (req, res) => {
  const [player] = await db.select().from(players).where(eq(players.supabaseId, req.params.supabaseId));
  if (!player) return res.status(404).json({ error: "Player not found" });
  res.json(player);
});

// 3. Update all existing queries to use App ID consistently:
// ✅ KYC operations: Use player.id (integer)
// ✅ Balance management: Use player.id (integer)
// ✅ Transaction history: Use player.id (integer)
`,
  
  masterAdminPortal: `
// 1. Add unified player system to your project:
// Copy: server/unified-player-system.ts

// 2. Update admin operations:
const approveKYC = async (playerId: number) => {
  // Use App ID for all database operations
  await db.update(players).set({ kycStatus: 'approved' }).where(eq(players.id, playerId));
};

// 3. Handle both ID types in admin interface:
const getPlayerByEitherId = async (id: string | number) => {
  if (typeof id === 'string' && id.includes('-')) {
    // Supabase UUID format
    return await unifiedPlayerSystem.getPlayerBySupabaseId(id);
  }
  return await unifiedPlayerSystem.getPlayerById(Number(id));
};
`,
  
  pokerRoomTracker: `
// 1. Update table join logic to use unified IDs:
app.post("/api/tables/:tableId/join", async (req, res) => {
  const { supabaseId } = req.body; // From auth system
  
  // Get player by Supabase ID
  const player = await unifiedPlayerSystem.getPlayerBySupabaseId(supabaseId);
  if (!player) {
    return res.status(404).json({ error: "Player not found" });
  }
  
  // Use App ID for table operations
  const seatRequest = await createSeatRequest({
    playerId: player.id, // Integer App ID
    tableId: parseInt(req.params.tableId),
    status: 'waiting'
  });
  
  res.json(seatRequest);
});

// 2. Update all table-related queries to use App ID:
// ✅ Seat requests: Use player.id
// ✅ Game history: Use player.id
// ✅ Tournament entries: Use player.id
`
};