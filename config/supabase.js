// server/config/supabase.js
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // recommended for server
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL) {
  throw new Error('Missing SUPABASE_URL in environment');
}

// Prefer service role key on server to bypass RLS and ensure access to all tables.
// If you do not have a service role key in env, fallback to anon (but check RLS policies!)
const SUPABASE_KEY = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
if (!SUPABASE_KEY) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY in environment');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    // don't auto-refresh tokens on server
    persistSession: false,
  },
  // useful for more verbose debugging in dev
  global: {
    headers: { 'x-my-server': 'true' },
  },
});

export default supabase;
