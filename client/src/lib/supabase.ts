import { createClient } from '@supabase/supabase-js';

// Use your Supabase credentials for authentication
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://oyhnpnymlezjusnwpjeu.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95aG5wbnltbGV6anVzbndwamV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0MTM1NDIsImV4cCI6MjA2Nzk4OTU0Mn0.aCvrnoSd5pCoz_6zDqwozYF_04XKfm3WuhIc1_lX0FA';

console.log('Supabase client configured with URL:', supabaseUrl.substring(0, 30) + '...');

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
