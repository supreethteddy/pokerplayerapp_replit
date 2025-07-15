import postgres from 'postgres'
import { createClient } from '@supabase/supabase-js'

// Get the 6 players from the current working database (Neon)
const currentConnectionString = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_07BPCjspVlnF@ep-orange-credit-aek9fbul.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function migrateData() {
  console.log('🚀 Starting data migration...')
  
  try {
    // Connect to current database (Neon)
    const currentClient = postgres(currentConnectionString);
    
    // Get all existing players
    const players = await currentClient`
      SELECT id, email, password, first_name, last_name, phone, kyc_status, 
             created_at, balance, total_deposits, total_withdrawals, 
             total_winnings, total_losses, games_played, hours_played 
      FROM players 
      ORDER BY id
    `
    
    console.log(`📊 Found ${players.length} players to migrate:`)
    players.forEach((player, index) => {
      console.log(`   ${index + 1}. ${player.email} (${player.first_name} ${player.last_name})`)
    })
    
    // Display the players that need to be migrated
    console.log('\\n📋 Players that need to be in your Supabase dashboard:')
    
    const playerData = players.map(player => ({
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
    }))
    
    // Show the data that should be in Supabase
    console.log('\\n🔍 Data Summary:')
    console.log(JSON.stringify(playerData, null, 2))
    
    console.log('\\n📌 SOLUTION: Please provide the correct Supabase database connection details.')
    console.log('The current DATABASE_URL is pointing to Neon database, not Supabase.')
    console.log('\\nOnce you provide the correct Supabase credentials, I can:')
    console.log('1. ✅ Connect to your Supabase database')
    console.log('2. ✅ Create the proper table structure')
    console.log('3. ✅ Migrate all 6 players')
    console.log('4. ✅ Update the application to use Supabase permanently')
    console.log('5. ✅ Verify players appear in your Supabase dashboard')
    
    await currentClient.end()
    
  } catch (error) {
    console.error('❌ Migration error:', error)
  }
}

migrateData()