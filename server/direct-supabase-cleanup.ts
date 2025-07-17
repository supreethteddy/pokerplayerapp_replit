import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function directCleanup() {
  console.log('🧹 [DIRECT CLEANUP] Starting direct Supabase cleanup...');
  
  try {
    // Delete ALL tables from Supabase
    console.log('🗑️ [DIRECT CLEANUP] Deleting all tables...');
    const { error: deleteError } = await supabase
      .from('tables')
      .delete()
      .neq('id', 0);

    if (deleteError) {
      console.error('❌ [DIRECT CLEANUP] Error deleting tables:', deleteError);
      return;
    }

    console.log('✅ [DIRECT CLEANUP] All tables deleted successfully');

    // Add only authentic Indian poker room tables
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

    console.log('🏗️ [DIRECT CLEANUP] Adding authentic Indian poker tables...');
    
    for (const table of authenticTables) {
      const { data, error } = await supabase
        .from('tables')
        .insert([table])
        .select();

      if (error) {
        console.error(`❌ [DIRECT CLEANUP] Error adding ${table.name}:`, error);
      } else {
        console.log(`✅ [DIRECT CLEANUP] Added authentic table: ${table.name} (ID: ${data[0]?.id})`);
      }
    }

    // Final count
    const { count, error: countError } = await supabase
      .from('tables')
      .select('*', { count: 'exact', head: true });

    if (!countError) {
      console.log(`📊 [DIRECT CLEANUP] Final authentic table count: ${count}`);
    }

    return { success: true, count };

  } catch (error) {
    console.error('❌ [DIRECT CLEANUP] Error:', error);
    return { success: false, error };
  }
}

// Run the cleanup
directCleanup().then(result => {
  console.log('🎯 [DIRECT CLEANUP] Result:', result);
  process.exit(0);
}).catch(error => {
  console.error('💥 [DIRECT CLEANUP] Fatal error:', error);
  process.exit(1);
});