import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

async function testConnection() {
  const supabaseConnectionString = "postgresql://postgres:Shetty1234%21%40%23-@db.oyhnpnymlezjusnwpjeu.supabase.co:5432/postgres";
  
  console.log('Testing connection to Supabase...');
  console.log('Connection string:', supabaseConnectionString);
  
  try {
    const client = postgres(supabaseConnectionString);
    const db = drizzle(client);
    
    // Test basic connection
    const result = await client`SELECT current_database(), current_user, version()`;
    console.log('Connection successful!');
    console.log('Database:', result[0].current_database);
    console.log('User:', result[0].current_user);
    console.log('Version:', result[0].version);
    
    // Test if players table exists
    const tables = await client`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    `;
    
    console.log('Tables in database:', tables.map(t => t.table_name));
    
    // Test if we can create a player
    const testPlayer = await client`
      INSERT INTO players (email, password, first_name, last_name, phone, kyc_status)
      VALUES ('database.test@supabase.com', 'password123', 'Database', 'Test', '8888888888', 'pending')
      RETURNING id, email, first_name, last_name
    `;
    
    console.log('Test player created:', testPlayer[0]);
    
    // Count total players
    const count = await client`SELECT COUNT(*) as total FROM players`;
    console.log('Total players in database:', count[0].total);
    
    await client.end();
    
  } catch (error) {
    console.error('Connection failed:', error);
  }
}

testConnection();