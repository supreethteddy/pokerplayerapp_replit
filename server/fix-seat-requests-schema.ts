import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function fixSeatRequestsSchema() {
  console.log('🔧 [SEAT REQUESTS] Fixing seat_requests table schema...');
  
  try {
    // First, check if the table exists
    const { data: existingTable, error: checkError } = await supabase
      .from('seat_requests')
      .select('*')
      .limit(1);
    
    if (checkError) {
      console.log('📋 [SEAT REQUESTS] Table might not exist, creating new table...');
      
      // Create the seat_requests table with proper UUID table_id column
      const { error: createError } = await supabase.rpc('exec_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS seat_requests (
            id SERIAL PRIMARY KEY,
            universal_id TEXT UNIQUE,
            player_id INTEGER REFERENCES players(id),
            table_id TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'waiting',
            position INTEGER DEFAULT 0,
            estimated_wait INTEGER DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `
      });
      
      if (createError) {
        console.error('❌ [SEAT REQUESTS] Error creating table:', createError);
        return false;
      }
      
      console.log('✅ [SEAT REQUESTS] Table created successfully');
      return true;
    }
    
    // If table exists, check current schema
    const { data: tableInfo, error: schemaError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'seat_requests' AND column_name = 'table_id';
      `
    });
    
    if (schemaError) {
      console.error('❌ [SEAT REQUESTS] Error checking schema:', schemaError);
      return false;
    }
    
    console.log('📋 [SEAT REQUESTS] Current table_id column type:', tableInfo);
    
    // Check if table_id is currently integer and needs to be changed to text
    if (tableInfo && tableInfo.length > 0 && tableInfo[0].data_type === 'integer') {
      console.log('🔄 [SEAT REQUESTS] Converting table_id from integer to text...');
      
      // Drop existing data and change column type
      const { error: alterError } = await supabase.rpc('exec_sql', {
        sql: `
          -- Clear existing data to avoid type conflicts
          DELETE FROM seat_requests;
          
          -- Change column type from integer to text
          ALTER TABLE seat_requests 
          ALTER COLUMN table_id TYPE TEXT USING table_id::TEXT;
        `
      });
      
      if (alterError) {
        console.error('❌ [SEAT REQUESTS] Error altering table:', alterError);
        return false;
      }
      
      console.log('✅ [SEAT REQUESTS] Successfully converted table_id to text/UUID compatible');
    } else {
      console.log('✅ [SEAT REQUESTS] Table_id is already text type');
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ [SEAT REQUESTS] Unexpected error:', error);
    return false;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  fixSeatRequestsSchema()
    .then(success => {
      if (success) {
        console.log('🎉 [SEAT REQUESTS] Schema fix completed successfully!');
        process.exit(0);
      } else {
        console.log('💥 [SEAT REQUESTS] Schema fix failed!');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('💥 [SEAT REQUESTS] Script error:', error);
      process.exit(1);
    });
}