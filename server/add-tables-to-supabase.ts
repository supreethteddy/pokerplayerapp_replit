import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function addTablesToSupabase() {
  console.log('🔄 [ADD TABLES] Adding missing tables to Supabase database...');
  
  const newTables = [
    { name: 'Manager Action Table', game_type: 'No Limit Hold\'em', stakes: '₹5,000 - ₹50,000', max_players: 9, current_players: 0, pot: 0, avg_stack: 0, is_active: true },
    { name: 'Supabase-Staff-002', game_type: 'No Limit Hold\'em', stakes: '₹10,000 - ₹100,000', max_players: 8, current_players: 0, pot: 0, avg_stack: 0, is_active: true },
    { name: 'Portal Management Table', game_type: 'No Limit Hold\'em', stakes: '₹2,500 - ₹25,000', max_players: 10, current_players: 0, pot: 0, avg_stack: 0, is_active: true },
    { name: 'Master Admin Control', game_type: 'No Limit Hold\'em', stakes: '₹15,000 - ₹150,000', max_players: 6, current_players: 0, pot: 0, avg_stack: 0, is_active: true },
    { name: 'Cashier Operations', game_type: 'No Limit Hold\'em', stakes: '₹1,000 - ₹10,000', max_players: 8, current_players: 0, pot: 0, avg_stack: 0, is_active: true },
    { name: 'Staff Portal Table', game_type: 'No Limit Hold\'em', stakes: '₹3,000 - ₹30,000', max_players: 9, current_players: 0, pot: 0, avg_stack: 0, is_active: true },
    { name: 'High Roller VIP', game_type: 'No Limit Hold\'em', stakes: '₹50,000 - ₹500,000', max_players: 6, current_players: 0, pot: 0, avg_stack: 0, is_active: true },
    { name: 'Tournament Table 1', game_type: 'No Limit Hold\'em', stakes: '₹5,000 - ₹50,000', max_players: 10, current_players: 0, pot: 0, avg_stack: 0, is_active: true },
    { name: 'Tournament Table 2', game_type: 'No Limit Hold\'em', stakes: '₹5,000 - ₹50,000', max_players: 10, current_players: 0, pot: 0, avg_stack: 0, is_active: true },
    { name: 'Private Game Room', game_type: 'No Limit Hold\'em', stakes: '₹25,000 - ₹250,000', max_players: 8, current_players: 0, pot: 0, avg_stack: 0, is_active: true },
    { name: 'Beginner Training', game_type: 'No Limit Hold\'em', stakes: '₹100 - ₹1,000', max_players: 8, current_players: 0, pot: 0, avg_stack: 0, is_active: true },
    { name: 'Intermediate Practice', game_type: 'No Limit Hold\'em', stakes: '₹1,000 - ₹10,000', max_players: 8, current_players: 0, pot: 0, avg_stack: 0, is_active: true },
    { name: 'Advanced Strategy', game_type: 'No Limit Hold\'em', stakes: '₹10,000 - ₹100,000', max_players: 8, current_players: 0, pot: 0, avg_stack: 0, is_active: true },
    { name: 'Weekend Special', game_type: 'No Limit Hold\'em', stakes: '₹5,000 - ₹50,000', max_players: 9, current_players: 0, pot: 0, avg_stack: 0, is_active: true },
    { name: 'Daily Grind', game_type: 'No Limit Hold\'em', stakes: '₹2,000 - ₹20,000', max_players: 8, current_players: 0, pot: 0, avg_stack: 0, is_active: true },
    { name: 'Premium Rush', game_type: 'No Limit Hold\'em', stakes: '₹20,000 - ₹200,000', max_players: 6, current_players: 0, pot: 0, avg_stack: 0, is_active: true },
    { name: 'Lightning Fast', game_type: 'No Limit Hold\'em', stakes: '₹1,500 - ₹15,000', max_players: 8, current_players: 0, pot: 0, avg_stack: 0, is_active: true },
    { name: 'Slow and Steady', game_type: 'No Limit Hold\'em', stakes: '₹3,000 - ₹30,000', max_players: 8, current_players: 0, pot: 0, avg_stack: 0, is_active: true },
    { name: 'Mid Stakes Action', game_type: 'No Limit Hold\'em', stakes: '₹7,500 - ₹75,000', max_players: 9, current_players: 0, pot: 0, avg_stack: 0, is_active: true },
    { name: 'Elite Players Only', game_type: 'No Limit Hold\'em', stakes: '₹100,000 - ₹1,000,000', max_players: 6, current_players: 0, pot: 0, avg_stack: 0, is_active: true }
  ];

  try {
    // Add tables in batches
    for (const table of newTables) {
      console.log(`📋 [ADD TABLES] Adding table: ${table.name}`);
      
      const { data, error } = await supabase
        .from('tables')
        .insert([table])
        .select();

      if (error) {
        console.error(`❌ [ADD TABLES] Error adding ${table.name}:`, error);
      } else {
        console.log(`✅ [ADD TABLES] Successfully added ${table.name} with ID: ${data[0]?.id}`);
      }
    }

    // Check total count after adding
    const { count, error: countError } = await supabase
      .from('tables')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ [ADD TABLES] Error getting table count:', countError);
    } else {
      console.log(`📊 [ADD TABLES] Total tables in Supabase after adding: ${count}`);
    }

  } catch (error) {
    console.error('❌ [ADD TABLES] Error during table addition:', error);
  }
}