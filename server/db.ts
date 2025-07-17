// DISABLED: Using only Supabase as exclusive database
// All database operations now go through Supabase client directly
import { createClient } from '@supabase/supabase-js';
import * as schema from "@shared/schema";

// Supabase-only configuration
if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for Supabase exclusive mode");
}

export const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Legacy export for compatibility - redirect to Supabase
export const pool = null;
export const db = null;
