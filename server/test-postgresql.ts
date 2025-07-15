import postgres from 'postgres'

async function testPostgreSQL() {
  const connectionString = process.env.DATABASE_URL || "postgresql://postgres.oyhnpnymlezjusnwpjeu:Shetty1234%21%40%23-@aws-0-ap-south-1.pooler.supabase.com:5432/postgres";
  
  console.log('Testing PostgreSQL connection...')
  console.log('Connection string:', connectionString.replace(/:([^@]+)@/, ':***@'))
  
  try {
    const client = postgres(connectionString)
    
    // Test connection
    const result = await client`SELECT current_database(), current_user`
    console.log('✅ Connection successful!')
    console.log('Database:', result[0].current_database)
    console.log('User:', result[0].current_user)
    
    // Count players
    const count = await client`SELECT COUNT(*) as total FROM players`
    console.log('Players in database:', count[0].total)
    
    // Show first few players
    const players = await client`SELECT id, email, first_name, last_name FROM players ORDER BY id LIMIT 5`
    console.log('Sample players:')
    players.forEach(player => {
      console.log(`  ${player.id}: ${player.email} (${player.first_name} ${player.last_name})`)
    })
    
    await client.end()
    console.log('✅ Database connection test completed!')
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message)
  }
}

testPostgreSQL()