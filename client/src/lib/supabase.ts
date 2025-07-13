import { createClient } from '@supabase/supabase-js';

// Debug: Check if environment variables are loaded
console.log('Environment variables:', {
  url: import.meta.env.VITE_SUPABASE_URL,
  key: import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Present' : 'Missing'
});

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(`Missing Supabase environment variables: URL=${supabaseUrl ? 'Present' : 'Missing'}, Key=${supabaseAnonKey ? 'Present' : 'Missing'}`);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
