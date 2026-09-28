import { supabase } from '../lib/supabase.js';

/**
 * Express middleware: verifies a Supabase JWT from the Authorization header.
 *
 * Usage (inline on individual routes):
 *   router.post('/', authMiddleware, async (req, res) => { ... });
 *
 * On success: sets req.user = { uid, email, admin } and calls next().
 * On failure: returns 401 Unauthorized.
 *
 * Admin status is read from the `profiles` table (is_admin column) rather
 * than from token claims — this means admin privileges take effect immediately
 * on the next request after the DB row is updated, with no token re-issue needed.
 */
export default async function authMiddleware(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  const token = header.split('Bearer ')[1];

  // Supabase verifies the JWT signature and expiry cryptographically
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    console.error('Auth middleware — token verification failed:', error?.message);
    return res.status(401).json({ error: 'Invalid or expired authentication token' });
  }

  // Fetch admin status from the profiles table.
  // Using .maybeSingle() so a missing profile row returns null (not an error).
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle();

  req.user = {
    uid: user.id,
    email: user.email || null,
    admin: profile?.is_admin === true,
  };

  next();
}

/**
 * Express middleware: requires is_admin = true in the profiles table.
 * Use this for sensitive routes (e.g., /api/escalate, /api/verify-resolution).
 */
export async function requireAdmin(req, res, next) {
  await authMiddleware(req, res, () => {
    if (req.user?.admin === true) {
      next();
    } else {
      res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
  });
}
