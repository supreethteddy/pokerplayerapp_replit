import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// Source: Neon database (where players currently exist)
const neonConnectionString = "postgresql://neondb_owner:npg_07BPCjspVlnF@ep-orange-credit-aek9fbul.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

// Target: Supabase database (where we want to move players)
const supabaseConnectionString = "postgresql://postgres:Shetty1234%21%40%23-@db.oyhnpnymlezjusnwpjeu.supabase.co:5432/postgres";

const neonClient = postgres(neonConnectionString);
const supabaseClient = postgres(supabaseConnectionString);

async function migratePlayersToSupabase() {
  try {
    console.log('Starting migration from Neon to Supabase...');
    
    // Get all players from Neon database
    const players = await neonClient`
      SELECT id, email, password, first_name, last_name, phone, kyc_status, 
             created_at, balance, total_deposits, total_withdrawals, 
             total_winnings, total_losses, games_played, hours_played 
      FROM players 
      ORDER BY id
    `;
    
    console.log(`Found ${players.length} players to migrate`);
    
    // First, ensure the players table exists in Supabase
    await supabaseClient`
      CREATE TABLE IF NOT EXISTS players (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        kyc_status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        balance TEXT NOT NULL DEFAULT '0.00',
        total_deposits TEXT NOT NULL DEFAULT '0.00',
        total_withdrawals TEXT NOT NULL DEFAULT '0.00',
        total_winnings TEXT NOT NULL DEFAULT '0.00',
        total_losses TEXT NOT NULL DEFAULT '0.00',
        games_played INTEGER NOT NULL DEFAULT 0,
        hours_played TEXT NOT NULL DEFAULT '0.00'
      )
    `;
    
    // Clear existing data in Supabase
    await supabaseClient`DELETE FROM players`;
    
    // Insert each player into Supabase
    for (const player of players) {
      await supabaseClient`
        INSERT INTO players (
          email, password, first_name, last_name, phone, kyc_status,
          created_at, balance, total_deposits, total_withdrawals,
          total_winnings, total_losses, games_played, hours_played
        ) VALUES (
          ${player.email}, ${player.password}, ${player.first_name}, 
          ${player.last_name}, ${player.phone}, ${player.kyc_status},
          ${player.created_at}, ${player.balance}, ${player.total_deposits},
          ${player.total_withdrawals}, ${player.total_winnings}, 
          ${player.total_losses}, ${player.games_played}, ${player.hours_played}
        )
      `;
      console.log(`Migrated: ${player.email}`);
    }
    
    // Verify migration
    const supabasePlayers = await supabaseClient`
      SELECT COUNT(*) as count FROM players
    `;
    
    console.log(`Migration completed! ${supabasePlayers[0].count} players in Supabase`);
    
    // Show migrated players
    const allPlayers = await supabaseClient`
      SELECT id, email, first_name, last_name, created_at FROM players ORDER BY id
    `;
    
    console.log('Migrated players:');
    allPlayers.forEach(player => {
      console.log(`- ID ${player.id}: ${player.email} (${player.first_name} ${player.last_name})`);
    });
    
  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    await neonClient.end();
    await supabaseClient.end();
  }
}

migratePlayersToSupabase();