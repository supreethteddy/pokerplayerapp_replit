import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { players, playerPrefs } from '../shared/schema'

// The working Supabase connection from the application
const supabaseConnectionString = "postgresql://postgres:Shetty1234%21%40%23-@db.oyhnpnymlezjusnwpjeu.supabase.co:5432/postgres"

// Neon database (where players currently exist)
const neonConnectionString = "postgresql://neondb_owner:npg_07BPCjspVlnF@ep-orange-credit-aek9fbul.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"

async function fixSupabaseData() {
  const neonClient = postgres(neonConnectionString)
  const supabaseClient = postgres(supabaseConnectionString)
  const supabaseDb = drizzle(supabaseClient)

  try {
    console.log('Getting players from Neon database...')
    
    // Get all players from Neon
    const neonPlayers = await neonClient`
      SELECT email, password, first_name, last_name, phone, kyc_status, 
             created_at, balance, total_deposits, total_withdrawals, 
             total_winnings, total_losses, games_played, hours_played 
      FROM players 
      ORDER BY id
    `
    
    console.log(`Found ${neonPlayers.length} players in Neon database`)
    
    // Create proper table structure in Supabase
    console.log('Creating table structure in Supabase...')
    
    await supabaseClient`
      DROP TABLE IF EXISTS transactions, kyc_documents, seat_requests, player_prefs, players, tables CASCADE
    `
    
    await supabaseClient`
      CREATE TABLE players (
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
    `
    
    await supabaseClient`
      CREATE TABLE player_prefs (
        id SERIAL PRIMARY KEY,
        player_id INTEGER REFERENCES players(id),
        seat_available BOOLEAN DEFAULT TRUE,
        call_time_warning BOOLEAN DEFAULT TRUE,
        game_updates BOOLEAN DEFAULT FALSE
      )
    `
    
    await supabaseClient`
      CREATE TABLE tables (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        game_type TEXT NOT NULL,
        stakes TEXT NOT NULL,
        max_players INTEGER NOT NULL,
        current_players INTEGER DEFAULT 0,
        pot INTEGER DEFAULT 0,
        avg_stack INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE
      )
    `
    
    await supabaseClient`
      CREATE TABLE seat_requests (
        id SERIAL PRIMARY KEY,
        player_id INTEGER REFERENCES players(id),
        table_id INTEGER REFERENCES tables(id),
        status TEXT NOT NULL DEFAULT 'waiting',
        position INTEGER DEFAULT 0,
        estimated_wait INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `
    
    await supabaseClient`
      CREATE TABLE kyc_documents (
        id SERIAL PRIMARY KEY,
        player_id INTEGER REFERENCES players(id),
        document_type TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_url TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `
    
    await supabaseClient`
      CREATE TABLE transactions (
        id SERIAL PRIMARY KEY,
        player_id INTEGER REFERENCES players(id),
        type TEXT NOT NULL,
        amount TEXT NOT NULL,
        description TEXT,
        staff_id TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `
    
    console.log('Tables created successfully in Supabase!')
    
    // Insert players directly via SQL
    console.log('Inserting players into Supabase...')
    
    let insertedCount = 0
    for (const player of neonPlayers) {
      try {
        const result = await supabaseClient`
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
          ) RETURNING id, email
        `
        
        console.log(`✅ Inserted: ${result[0].email} (ID: ${result[0].id})`)
        insertedCount++
        
        // Create default preferences
        await supabaseClient`
          INSERT INTO player_prefs (player_id, seat_available, call_time_warning, game_updates)
          VALUES (${result[0].id}, true, true, false)
        `
        
      } catch (error) {
        console.error(`❌ Failed to insert ${player.email}:`, error.message)
      }
    }
    
    // Verify the migration
    const finalCount = await supabaseClient`
      SELECT COUNT(*) as count FROM players
    `
    
    console.log(`\\n🎉 Migration completed!`)
    console.log(`Players successfully migrated: ${insertedCount}`)
    console.log(`Total players in Supabase: ${finalCount[0].count}`)
    
    // Show all players in Supabase
    const allPlayers = await supabaseClient`
      SELECT id, email, first_name, last_name, created_at FROM players ORDER BY id
    `
    
    console.log('\\nPlayers now in your Supabase database:')
    allPlayers.forEach((player, index) => {
      console.log(`${index + 1}. ID ${player.id}: ${player.email} (${player.first_name} ${player.last_name})`)
    })
    
    console.log('\\n✅ Check your Supabase dashboard now - players should be visible!')
    
  } catch (error) {
    console.error('Error during migration:', error)
  } finally {
    await neonClient.end()
    await supabaseClient.end()
  }
}

fixSupabaseData()