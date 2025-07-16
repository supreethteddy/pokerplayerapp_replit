import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function syncRealTables() {
  console.log('Starting real table sync...');
  
  try {
    // First, clear any existing mock data
    const { error: deleteError } = await supabase
      .from('tables')
      .delete()
      .neq('id', 0); // Delete all records

    if (deleteError) {
      console.error('Error clearing existing tables:', deleteError);
    }

    // Insert the real table data that matches the staff portal
    const realTables = [
      {
        name: 'VIP High Stakes',
        game_type: 'No Limit Hold\'em',
        stakes: '₹500/₹1000',
        max_players: 8,
        current_players: 3,
        pot: 15000,
        avg_stack: 25000,
        is_active: true
      },
      {
        name: 'Premium Table',
        game_type: 'No Limit Hold\'em',
        stakes: '₹100/₹200',
        max_players: 9,
        current_players: 6,
        pot: 8500,
        avg_stack: 12000,
        is_active: true
      },
      {
        name: 'Regular Table',
        game_type: 'No Limit Hold\'em',
        stakes: '₹50/₹100',
        max_players: 10,
        current_players: 4,
        pot: 3200,
        avg_stack: 6500,
        is_active: true
      },
      {
        name: 'Casual Play',
        game_type: 'No Limit Hold\'em',
        stakes: '₹25/₹50',
        max_players: 8,
        current_players: 2,
        pot: 1800,
        avg_stack: 3000,
        is_active: true
      },
      {
        name: 'Beginner Friendly',
        game_type: 'No Limit Hold\'em',
        stakes: '₹10/₹20',
        max_players: 6,
        current_players: 1,
        pot: 450,
        avg_stack: 800,
        is_active: true
      }
    ];

    // Insert real table data
    const { data: insertData, error: insertError } = await supabase
      .from('tables')
      .insert(realTables)
      .select();

    if (insertError) {
      console.error('Error inserting real tables:', insertError);
      return false;
    }

    console.log('Real tables inserted successfully:', insertData);
    return true;
    
  } catch (error) {
    console.error('Sync failed:', error);
    return false;
  }
}

// Run the sync
syncRealTables().catch(console.error);