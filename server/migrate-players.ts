import { createClient } from '@supabase/supabase-js'
import postgres from 'postgres'

// Get the 6 players from Neon database
const neonConnectionString = "postgresql://neondb_owner:npg_07BPCjspVlnF@ep-orange-credit-aek9fbul.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";
const neonClient = postgres(neonConnectionString);

// Supabase client
const supabaseUrl = 'https://oyhnpnymlezjusnwpjeu.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95aG5wbnltbGV6anVzbndwamV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0MTM1NDIsImV4cCI6MjA2Nzk4OTU0Mn0.aCvrnoSd5pCoz_6zDqwozYF_04XKfm3WuhIc1_lX0FA'

const supabase = createClient(supabaseUrl, supabaseKey)

async function migratePlayersToSupabase() {
  try {
    console.log('Getting players from Neon database...')
    
    const players = await neonClient`
      SELECT id, email, password, first_name, last_name, phone, kyc_status, 
             created_at, balance, total_deposits, total_withdrawals, 
             total_winnings, total_losses, games_played, hours_played 
      FROM players 
      ORDER BY id
    `
    
    console.log(`Found ${players.length} players to migrate:`)
    players.forEach(player => {
      console.log(`- ${player.email} (${player.first_name} ${player.last_name})`)
    })
    
    // Try to insert via Supabase API
    for (const player of players) {
      try {
        const { data, error } = await supabase
          .from('players')
          .insert({
            email: player.email,
            password: player.password,
            first_name: player.first_name,
            last_name: player.last_name,
            phone: player.phone,
            kyc_status: player.kyc_status,
            balance: player.balance,
            total_deposits: player.total_deposits,
            total_withdrawals: player.total_withdrawals,
            total_winnings: player.total_winnings,
            total_losses: player.total_losses,
            games_played: player.games_played,
            hours_played: player.hours_played
          })
          .select()
        
        if (error) {
          console.error(`Error inserting ${player.email}:`, error)
        } else {
          console.log(`Successfully inserted ${player.email}`)
        }
      } catch (err) {
        console.error(`Failed to insert ${player.email}:`, err)
      }
    }
    
    // Check final result
    const { data: finalPlayers, error: finalError } = await supabase
      .from('players')
      .select('*')
      .limit(20)
    
    if (finalError) {
      console.error('Error getting final players:', finalError)
    } else {
      console.log(`Final result: ${finalPlayers.length} players in Supabase`)
    }
    
  } catch (error) {
    console.error('Migration error:', error)
  } finally {
    await neonClient.end()
  }
}

migratePlayersToSupabase()