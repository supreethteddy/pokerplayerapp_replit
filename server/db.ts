// HYBRID CONNECTION: Both PostgreSQL and Supabase
import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';
import * as schema from "@shared/schema";

// Supabase connection for staff portal data
if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
}

export const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Direct PostgreSQL connection for table_sessions and other development tables
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set for direct PostgreSQL connection");
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export const db = {
  query: (text: string, params?: any[]) => pool.query(text, params),
};

console.log('🚀 [DIRECT CHAT] System initialized with direct PostgreSQL connection');
