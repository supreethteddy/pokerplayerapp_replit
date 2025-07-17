import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function createSeatRequestTable() {
  console.log('🔧 [CREATE SEAT REQUEST TABLE] Starting table creation...');
  
  try {
    // Drop and recreate the table with proper UUID support
    const dropResult = await supabase.rpc('sql', {
      query: `DROP TABLE IF EXISTS seat_requests;`
    });
    
    if (dropResult.error) {
      console.log('⚠️ [CREATE SEAT REQUEST TABLE] Drop table error (might not exist):', dropResult.error);
    }
    
    // Create new table with proper UUID table_id column
    const createResult = await supabase.rpc('sql', {
      query: `
        CREATE TABLE seat_requests (
          id SERIAL PRIMARY KEY,
          universal_id TEXT UNIQUE,
          player_id INTEGER NOT NULL,
          table_id TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'waiting',
          position INTEGER DEFAULT 0,
          estimated_wait INTEGER DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });
    
    if (createResult.error) {
      console.error('❌ [CREATE SEAT REQUEST TABLE] Create table error:', createResult.error);
      return false;
    }
    
    console.log('✅ [CREATE SEAT REQUEST TABLE] Successfully created table');
    return true;
    
  } catch (error) {
    console.error('❌ [CREATE SEAT REQUEST TABLE] Unexpected error:', error);
    return false;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createSeatRequestTable()
    .then(success => {
      if (success) {
        console.log('🎉 [CREATE SEAT REQUEST TABLE] Table creation completed successfully!');
        process.exit(0);
      } else {
        console.log('💥 [CREATE SEAT REQUEST TABLE] Table creation failed!');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('💥 [CREATE SEAT REQUEST TABLE] Script error:', error);
      process.exit(1);
    });
}