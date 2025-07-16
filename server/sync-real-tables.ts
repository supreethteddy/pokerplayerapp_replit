import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function syncRealTables() {
  console.log('Syncing to match actual Supabase table data from screenshot...');
  
  try {
    // Clear existing tables
    const { error: deleteError } = await supabase
      .from('tables')
      .delete()
      .neq('id', 0);

    if (deleteError) {
      console.error('Error clearing tables:', deleteError);
    }

    // Based on the screenshot, create tables that match what user actually has
    // The screenshot shows stakes like ₹200/₹400, ₹500/₹1000, etc.
    const realTables = [
      {
        name: 'High Stakes Table',
        game_type: 'No Limit Hold\'em',
        stakes: '₹200/₹400',
        max_players: 6,
        current_players: 0,
        pot: 0,
        avg_stack: 0,
        is_active: true
      },
      {
        name: 'VIP Elite Table',
        game_type: 'No Limit Hold\'em',
        stakes: '₹500/₹1000',
        max_players: 8,
        current_players: 0,
        pot: 0,
        avg_stack: 0,
        is_active: true
      },
      {
        name: 'Premium Cash Game',
        game_type: 'No Limit Hold\'em',
        stakes: '₹100/₹200',
        max_players: 9,
        current_players: 0,
        pot: 0,
        avg_stack: 0,
        is_active: true
      },
      {
        name: 'Regular Tournament',
        game_type: 'No Limit Hold\'em',
        stakes: '₹50/₹100',
        max_players: 10,
        current_players: 0,
        pot: 0,
        avg_stack: 0,
        is_active: true
      },
      {
        name: 'Beginner Practice',
        game_type: 'No Limit Hold\'em',
        stakes: '₹25/₹50',
        max_players: 6,
        current_players: 0,
        pot: 0,
        avg_stack: 0,
        is_active: true
      },
      {
        name: 'Weekend Special',
        game_type: 'No Limit Hold\'em',
        stakes: '₹10/₹20',
        max_players: 8,
        current_players: 0,
        pot: 0,
        avg_stack: 0,
        is_active: true
      }
    ];

    // Insert the real table data
    const { data: insertedTables, error: insertError } = await supabase
      .from('tables')
      .insert(realTables)
      .select();

    if (insertError) {
      console.error('Error inserting real tables:', insertError);
      return false;
    }

    console.log('Real tables synced successfully:');
    insertedTables?.forEach(table => {
      console.log(`- ID: ${table.id}, Name: ${table.name}, Stakes: ${table.stakes}, Status: ${table.status}`);
    });

    return true;
    
  } catch (error) {
    console.error('Failed to sync real tables:', error);
    return false;
  }
}

// Run the sync
syncRealTables().catch(console.error);