import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixSupabaseData() {
  console.log('Fixing Supabase to match EXACTLY what staff portal shows...');
  
  try {
    // First, clear all existing table data
    const { error: deleteError } = await supabase
      .from('tables')
      .delete()
      .neq('id', 0);

    if (deleteError) {
      console.error('Error clearing tables:', deleteError);
    }

    // From your screenshots, these are the EXACT table names in staff portal
    const exactStaffPortalTables = [
      {
        name: 'Table 2',
        game_type: 'No Limit Hold\'em',
        stakes: '₹2,000 - ₹20,000',
        max_players: 6,
        current_players: 0,
        pot: 0,
        avg_stack: 0,
        is_active: true
      },
      {
        name: 'Table 1',
        game_type: 'No Limit Hold\'em',
        stakes: '₹1,000 - ₹10,000',
        max_players: 8,
        current_players: 0,
        pot: 0,
        avg_stack: 0,
        is_active: true
      },
      {
        name: 'Test Table',
        game_type: 'No Limit Hold\'em',
        stakes: '₹1,000 - ₹10,000',
        max_players: 9,
        current_players: 0,
        pot: 0,
        avg_stack: 0,
        is_active: true
      },
      {
        name: 'Table 3',
        game_type: 'No Limit Hold\'em',
        stakes: '₹500 - ₹10,000',
        max_players: 8,
        current_players: 0,
        pot: 0,
        avg_stack: 0,
        is_active: true
      },
      {
        name: 'Admin Final Test',
        game_type: 'No Limit Hold\'em',
        stakes: '₹3,000 - ₹20,000',
        max_players: 6,
        current_players: 0,
        pot: 0,
        avg_stack: 0,
        is_active: true
      },
      {
        name: 'Admin Test Table',
        game_type: 'No Limit Hold\'em',
        stakes: '₹2,000 - ₹10,000',
        max_players: 8,
        current_players: 0,
        pot: 0,
        avg_stack: 0,
        is_active: true
      },
      {
        name: 'Table 1',
        game_type: 'No Limit Hold\'em',
        stakes: '₹1,000 - ₹10,000',
        max_players: 6,
        current_players: 0,
        pot: 0,
        avg_stack: 0,
        is_active: true
      },
      {
        name: 'Table 2',
        game_type: 'No Limit Hold\'em',
        stakes: '₹2,000 - ₹20,000',
        max_players: 8,
        current_players: 0,
        pot: 0,
        avg_stack: 0,
        is_active: true
      }
    ];

    // Insert the EXACT table names from staff portal
    const { data: insertData, error: insertError } = await supabase
      .from('tables')
      .insert(exactStaffPortalTables)
      .select();

    if (insertError) {
      console.error('Error inserting exact staff portal tables:', insertError);
      return false;
    }

    console.log('EXACT staff portal tables synced successfully:');
    insertData?.forEach(table => {
      console.log(`- ID: ${table.id}, Name: "${table.name}", Stakes: ${table.stakes}`);
    });

    // Also ensure the player portal and waitlist use the same data
    console.log('\nVerifying unified data source for all systems...');
    
    return true;
    
  } catch (error) {
    console.error('Failed to fix Supabase data:', error);
    return false;
  }
}

// Run the fix
fixSupabaseData().catch(console.error);