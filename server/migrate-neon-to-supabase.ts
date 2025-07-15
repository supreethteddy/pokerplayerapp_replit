import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { players } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Source database (Neon)
const neonClient = postgres(process.env.DATABASE_URL!);
const neonDb = drizzle(neonClient);

// Target database (Supabase) with updated credentials
const supabaseClient = postgres("postgresql://postgres:Shetty1234!%40%23-@db.oyhnpnymlezjusnwpjeu.supabase.co:5432/postgres");
const supabaseDb = drizzle(supabaseClient);

async function migrateData() {
  console.log('Starting data migration from Neon to Supabase...');
  
  try {
    // Get all players from Neon database
    const neonPlayers = await neonDb.select().from(players);
    console.log(`Found ${neonPlayers.length} players in Neon database`);
    
    for (const player of neonPlayers) {
      console.log(`Migrating player: ${player.email}`);
      
      // Check if player already exists in Supabase
      const existingPlayer = await supabaseDb.select().from(players).where(eq(players.email, player.email));
      
      if (existingPlayer.length > 0) {
        console.log(`Player ${player.email} already exists in Supabase, skipping...`);
        continue;
      }
      
      // Insert player into Supabase database
      await supabaseDb.insert(players).values({
        email: player.email,
        password: player.password,
        firstName: player.firstName,
        lastName: player.lastName,
        phone: player.phone,
        kycStatus: player.kycStatus,
        balance: player.balance,
        totalDeposits: player.totalDeposits,
        totalWithdrawals: player.totalWithdrawals,
        totalWinnings: player.totalWinnings,
        totalLosses: player.totalLosses,
        gamesPlayed: player.gamesPlayed,
        hoursPlayed: player.hoursPlayed,
        createdAt: player.createdAt
      });
      
      console.log(`Successfully migrated player: ${player.email}`);
    }
    
    console.log('Migration completed successfully!');
    
    // Test the migration
    const testPlayer = await supabaseDb.select().from(players).where(eq(players.email, 'vigneshthc@gmail.com'));
    console.log('Test player in Supabase:', testPlayer[0]);
    
  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    await neonClient.end();
    await supabaseClient.end();
  }
}

migrateData();