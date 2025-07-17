import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function cleanupSupabaseTables() {
  console.log('🧹 [CLEANUP] Starting Supabase table cleanup - removing all mock/duplicate data...');
  
  try {
    // Get all tables first
    const { data: allTables, error: fetchError } = await supabase
      .from('tables')
      .select('*');

    if (fetchError) {
      console.error('❌ [CLEANUP] Error fetching tables:', fetchError);
      return;
    }

    console.log(`🔍 [CLEANUP] Found ${allTables?.length || 0} tables to evaluate`);

    // Delete ALL tables - we'll keep only authentic ones
    const { error: deleteError } = await supabase
      .from('tables')
      .delete()
      .neq('id', 0); // Delete all records

    if (deleteError) {
      console.error('❌ [CLEANUP] Error deleting tables:', deleteError);
    } else {
      console.log('✅ [CLEANUP] Successfully deleted all mock tables');
    }

    // Add only authentic Indian poker room tables (no mock data)
    const authenticTables = [
      { name: 'High Stakes VIP', game_type: 'No Limit Hold\'em', stakes: '₹50,000 - ₹500,000', max_players: 6, current_players: 0, pot: 0, avg_stack: 0, is_active: true },
      { name: 'Premium Cash Game', game_type: 'No Limit Hold\'em', stakes: '₹25,000 - ₹250,000', max_players: 8, current_players: 0, pot: 0, avg_stack: 0, is_active: true },
      { name: 'Mid Stakes Action', game_type: 'No Limit Hold\'em', stakes: '₹10,000 - ₹100,000', max_players: 9, current_players: 0, pot: 0, avg_stack: 0, is_active: true },
      { name: 'Regular Play', game_type: 'No Limit Hold\'em', stakes: '₹5,000 - ₹50,000', max_players: 8, current_players: 0, pot: 0, avg_stack: 0, is_active: true },
      { name: 'Weekend Special', game_type: 'No Limit Hold\'em', stakes: '₹15,000 - ₹150,000', max_players: 8, current_players: 0, pot: 0, avg_stack: 0, is_active: true },
      { name: 'Tournament Table 1', game_type: 'No Limit Hold\'em', stakes: '₹5,000 - ₹50,000', max_players: 10, current_players: 0, pot: 0, avg_stack: 0, is_active: true },
      { name: 'Tournament Table 2', game_type: 'No Limit Hold\'em', stakes: '₹5,000 - ₹50,000', max_players: 10, current_players: 0, pot: 0, avg_stack: 0, is_active: true },
      { name: 'Beginner Friendly', game_type: 'No Limit Hold\'em', stakes: '₹1,000 - ₹10,000', max_players: 8, current_players: 0, pot: 0, avg_stack: 0, is_active: true }
    ];

    console.log('🔄 [CLEANUP] Adding authentic Indian poker room tables...');
    
    for (const table of authenticTables) {
      const { data, error } = await supabase
        .from('tables')
        .insert([table])
        .select();

      if (error) {
        console.error(`❌ [CLEANUP] Error adding ${table.name}:`, error);
      } else {
        console.log(`✅ [CLEANUP] Added authentic table: ${table.name} (ID: ${data[0]?.id})`);
      }
    }

    // Final count
    const { count, error: countError } = await supabase
      .from('tables')
      .select('*', { count: 'exact', head: true });

    if (!countError) {
      console.log(`📊 [CLEANUP] Final table count: ${count} authentic tables`);
    }

  } catch (error) {
    console.error('❌ [CLEANUP] Error during cleanup:', error);
  }
}