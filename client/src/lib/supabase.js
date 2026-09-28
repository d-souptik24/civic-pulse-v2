/**
 * client/src/lib/supabase.js
 * Client-side Supabase SDK — uses the public anon key (safe to expose in the browser).
 * RLS policies on the database enforce what each user can read/write.
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnon) {
  throw new Error('[supabase.js] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing from client .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnon);
