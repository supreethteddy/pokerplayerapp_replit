import { createClient } from '@supabase/supabase-js'

async function testSupabase() {
  const supabaseUrl = 'https://oyhnpnymlezjusnwpjeu.supabase.co'
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95aG5wbnltbGV6anVzbndwamV1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjQxMzU0MiwiZXhwIjoyMDY3OTg5NTQyfQ.Vb6zPUdDtPLvTgwfkYSzqQdZQnGIHnABNiNJo6ZW4JY'
  
  console.log('Testing Supabase direct connection...')
  
  try {
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // Test basic connection
    const { data, error } = await supabase.from('players').select('count').limit(1)
    
    if (error) {
      console.error('Supabase connection error:', error)
    } else {
      console.log('Supabase connection successful!')
      console.log('Query result:', data)
    }
    
    // Try to create a player directly
    const { data: newPlayer, error: insertError } = await supabase
      .from('players')
      .insert({
        email: 'direct.supabase.test@example.com',
        password: 'password123',
        first_name: 'Direct',
        last_name: 'Test',
        phone: '9999999999',
        kyc_status: 'pending'
      })
      .select()
    
    if (insertError) {
      console.error('Insert error:', insertError)
    } else {
      console.log('Player created successfully via Supabase:', newPlayer)
    }
    
  } catch (error) {
    console.error('Supabase test failed:', error)
  }
}

testSupabase()