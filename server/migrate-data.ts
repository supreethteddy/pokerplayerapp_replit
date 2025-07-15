import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { players } from '@shared/schema';

// Source database (Neon)
const neonClient = postgres(process.env.DATABASE_URL!);
const neonDb = drizzle(neonClient);

// Target database (Supabase) with URL-encoded password - using pooler URL
const supabaseClient = postgres("postgresql://postgres:Shetty1234%21%40%23-@aws-0-ap-south-1.pooler.supabase.com:6543/postgres");
const supabaseDb = drizzle(supabaseClient);

async function migrateData() {
  console.log('Starting data migration from Neon to Supabase...');
  
  try {
    // Get all players from Neon database
    const neonPlayers = await neonDb.select().from(players);
    console.log(`Found ${neonPlayers.length} players in Neon database`);
    
    // Clear existing data from Supabase first
    await supabaseDb.delete(players);
    console.log('Cleared existing data from Supabase');
    
    // Insert all players into Supabase
    if (neonPlayers.length > 0) {
      await supabaseDb.insert(players).values(neonPlayers);
      console.log(`Successfully migrated ${neonPlayers.length} players to Supabase`);
    }
    
    // Verify migration
    const supabasePlayers = await supabaseDb.select().from(players);
    console.log(`Verification: ${supabasePlayers.length} players now in Supabase`);
    
    // Show specific player
    const testPlayer = supabasePlayers.find(p => p.email === 'vigneshthc@gmail.com');
    if (testPlayer) {
      console.log('Test player migrated successfully:', testPlayer);
    } else {
      console.log('Test player not found in Supabase');
    }
    
  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    await neonClient.end();
    await supabaseClient.end();
  }
}

migrateData();