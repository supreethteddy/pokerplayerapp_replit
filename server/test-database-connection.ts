import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { players } from '@shared/schema';

const connectionString = "postgresql://postgres.oyhnpnymlezjusnwpjeu:Shetty1234%21%40%23-@aws-0-ap-south-1.pooler.supabase.com:5432/postgres";

console.log('Testing database connection...');
console.log('Connection string:', connectionString);

const client = postgres(connectionString);
const db = drizzle(client);

async function testConnection() {
  try {
    console.log('Testing direct SQL query...');
    const result = await client`SELECT * FROM players WHERE email = 'test@example.com'`;
    console.log('Direct SQL result:', result);
    
    console.log('Testing Drizzle ORM query...');
    const ormResult = await db.select().from(players).where(eq(players.email, 'test@example.com'));
    console.log('ORM result:', ormResult);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

testConnection();