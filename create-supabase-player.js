import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://oyhnpnymlezjusnwpjeu.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95aG5wbnltbGV6anVzbndwamV1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjQxMzU0MiwiZXhwIjoyMDY3OTg5NTQyfQ.Vb6zPUdDtPLvTgwfkYSzqQdZQnGIHnABNiNJo6ZW4JY'

const supabase = createClient(supabaseUrl, supabaseKey)

async function createPlayer() {
  try {
    // Create a test player directly in Supabase
    const { data, error } = await supabase
      .from('players')
      .insert({
        email: 'direct.supabase@test.com',
        password: 'password123',
        first_name: 'Direct',
        last_name: 'Supabase',
        phone: '2222222222',
        kyc_status: 'pending'
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating player:', error)
      return
    }

    console.log('Player created successfully:', data)
    
    // Now check if we can retrieve it
    const { data: retrieved, error: getError } = await supabase
      .from('players')
      .select('*')
      .eq('email', 'direct.supabase@test.com')
      .single()

    if (getError) {
      console.error('Error retrieving player:', getError)
      return
    }

    console.log('Player retrieved successfully:', retrieved)
    
    // Get all players to verify
    const { data: allPlayers, error: allError } = await supabase
      .from('players')
      .select('*')
      .limit(10)

    if (allError) {
      console.error('Error getting all players:', allError)
      return
    }

    console.log('All players in Supabase:', allPlayers)
    
  } catch (error) {
    console.error('Unexpected error:', error)
  }
}

createPlayer()