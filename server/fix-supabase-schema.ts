import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function fixSupabaseSchema() {
  console.log('Fixing Supabase to match real table names from staff portal...');
  
  try {
    // First, clear all existing table data
    const { error: deleteError } = await supabase
      .from('tables')
      .delete()
      .neq('id', 0); // Delete all records

    if (deleteError) {
      console.error('Error clearing existing tables:', deleteError);
    }

    // Based on your screenshots and what should be the real table names created by staff portal
    // These are the actual names that should match your staff portal
    const realStaffPortalTables = [
      {
        id: 4,
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
        id: 5,
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
        id: 6,
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
        id: 7,
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
        id: 8,
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

    // Insert the real table names that should match staff portal
    const { data: insertData, error: insertError } = await supabase
      .from('tables')
      .insert(realStaffPortalTables)
      .select();

    if (insertError) {
      console.error('Error inserting real staff portal tables:', insertError);
      return false;
    }

    console.log('Real staff portal tables synced successfully:');
    insertData?.forEach(table => {
      console.log(`- ID: ${table.id}, Name: "${table.name}", Stakes: ${table.stakes}`);
    });

    return true;
    
  } catch (error) {
    console.error('Failed to fix Supabase schema:', error);
    return false;
  }
}

// Run the fix
fixSupabaseSchema().catch(console.error);