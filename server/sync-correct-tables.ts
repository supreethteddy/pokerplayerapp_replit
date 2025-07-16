import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function syncCorrectTables() {
  console.log('Syncing correct table data to match staff portal...');
  
  try {
    // First, clear all existing table data
    const { error: deleteError } = await supabase
      .from('tables')
      .delete()
      .neq('id', 0); // Delete all records

    if (deleteError) {
      console.error('Error clearing existing tables:', deleteError);
    }

    // Insert the correct table data that should match the staff portal
    const correctTables = [
      {
        id: 1,
        name: 'High Stakes Table',
        game_type: 'No Limit Hold\'em',
        stakes: '₹1000/₹2000',
        max_players: 6,
        current_players: 4,
        pot: 25000,
        avg_stack: 50000,
        is_active: true
      },
      {
        id: 2,
        name: 'VIP Elite Table',
        game_type: 'No Limit Hold\'em',
        stakes: '₹500/₹1000',
        max_players: 8,
        current_players: 6,
        pot: 18000,
        avg_stack: 30000,
        is_active: true
      },
      {
        id: 3,
        name: 'Premium Cash Game',
        game_type: 'No Limit Hold\'em',
        stakes: '₹100/₹200',
        max_players: 9,
        current_players: 7,
        pot: 12000,
        avg_stack: 15000,
        is_active: true
      },
      {
        id: 4,
        name: 'Regular Tournament',
        game_type: 'No Limit Hold\'em',
        stakes: '₹50/₹100',
        max_players: 10,
        current_players: 8,
        pot: 6500,
        avg_stack: 8000,
        is_active: true
      },
      {
        id: 5,
        name: 'Beginner Practice',
        game_type: 'No Limit Hold\'em',
        stakes: '₹10/₹20',
        max_players: 6,
        current_players: 3,
        pot: 800,
        avg_stack: 1500,
        is_active: true
      },
      {
        id: 6,
        name: 'Weekend Special',
        game_type: 'No Limit Hold\'em',
        stakes: '₹25/₹50',
        max_players: 8,
        current_players: 5,
        pot: 2200,
        avg_stack: 3500,
        is_active: true
      }
    ];

    // Insert correct table data
    const { data: insertData, error: insertError } = await supabase
      .from('tables')
      .insert(correctTables)
      .select();

    if (insertError) {
      console.error('Error inserting correct tables:', insertError);
      return false;
    }

    console.log('Correct tables synced successfully:', insertData);
    return true;
    
  } catch (error) {
    console.error('Sync failed:', error);
    return false;
  }
}

// Run the sync
syncCorrectTables().catch(console.error);