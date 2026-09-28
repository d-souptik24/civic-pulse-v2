/**
 * server/lib/supabase.js
 *
 * Server-side Supabase client — initialized with the Service Role Key so it
 * bypasses Row Level Security (RLS) for all backend operations.
 *
 * SECURITY NOTE: Never expose SUPABASE_SERVICE_ROLE_KEY to the client.
 * The client SDK uses the public SUPABASE_ANON_KEY instead.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    '[supabase.js] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set. Check your .env file.'
  );
}

export const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    // Disable auto-refresh and session persistence — this is a server-side client,
    // not a browser client. Sessions are managed per-request via JWT verification.
    autoRefreshToken: false,
    persistSession: false,
  },
});
