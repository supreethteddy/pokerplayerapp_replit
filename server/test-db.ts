import postgres from 'postgres'

async function testConnection() {
  const connectionString = "postgresql://postgres.oyhnpnymlezjusnwpjeu:Shetty1234%21%40%23-@aws-0-ap-south-1.pooler.supabase.com:5432/postgres";
  
  console.log('🚀 Testing SUPABASE connection (Neon permanently disabled)...');
  console.log('Connection string:', connectionString.replace(/:([^@]+)@/, ':***@'));
  
  try {
    const client = postgres(connectionString);
    
    // Test basic connection
    const result = await client`SELECT current_database(), current_user`;
    console.log('✅ Connection successful!');
    console.log('Database:', result[0].current_database);
    console.log('User:', result[0].current_user);
    
    // Test if tables exist
    const tables = await client`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    
    console.log('Available tables:', tables.map(t => t.table_name));
    
    // Test players table
    try {
      const playerCount = await client`SELECT COUNT(*) as total FROM players`;
      console.log('Players in database:', playerCount[0].total);
      
      if (playerCount[0].total > 0) {
        const samplePlayers = await client`
          SELECT id, email, first_name, last_name, kyc_status 
          FROM players 
          ORDER BY id 
          LIMIT 3
        `;
        console.log('Sample players:');
        samplePlayers.forEach(player => {
          console.log(`  ${player.id}: ${player.email} (${player.first_name} ${player.last_name}) - ${player.kyc_status}`);
        });
      }
    } catch (error) {
      console.log('Players table not ready - need to run SQL setup script');
    }
    
    // Test seat requests functionality
    try {
      const seatRequestCount = await client`SELECT COUNT(*) as total FROM seat_requests`;
      console.log('Seat requests in database:', seatRequestCount[0].total);
      
      if (seatRequestCount[0].total > 0) {
        const sampleRequests = await client`
          SELECT sr.id, p.email, t.name as table_name, sr.status, sr.position
          FROM seat_requests sr 
          JOIN players p ON sr.player_id = p.id 
          JOIN tables t ON sr.table_id = t.id 
          ORDER BY sr.id 
          LIMIT 3
        `;
        console.log('Sample seat requests:');
        sampleRequests.forEach(req => {
          console.log(`  ${req.id}: ${req.email} waiting for ${req.table_name} (position: ${req.position})`);
        });
      }
    } catch (error) {
      console.log('Seat requests table not ready - need to run SQL setup script');
    }
    
    await client.end();
    console.log('✅ Supabase connection test completed successfully!');
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
  }
}

testConnection();