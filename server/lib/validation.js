/**
 * server/lib/validation.js
 *
 * Security validation utilities for server-side inputs and URLs.
 * Prevents Server-Side Request Forgery (SSRF) and unhandled PostGIS exceptions.
 */

/**
 * Validates that an image URL belongs strictly to authorized Supabase Storage.
 * Allowlist check inherently blocks localhost, private subnets, and cloud metadata.
 *
 * @param {string} urlString
 * @returns {boolean}
 */
export function isValidStorageUrl(urlString) {
  if (!urlString || typeof urlString !== 'string') return false;
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== 'https:') return false;

    const hostname = parsed.hostname.toLowerCase();
    const supabaseHost = process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).hostname.toLowerCase() : null;

    return (supabaseHost && hostname === supabaseHost) || hostname.endsWith('.supabase.co');
  } catch {
    return false;
  }
}

/**
 * Validates geographic coordinates to prevent PostGIS exceptions.
 *
 * @param {number|string} lat
 * @param {number|string} lng
 * @returns {boolean}
 */
export function isValidCoordinate(lat, lng) {
  const nLat = +lat;
  const nLng = +lng;
  return (
    typeof lat !== 'boolean' &&
    typeof lng !== 'boolean' &&
    Number.isFinite(nLat) &&
    Number.isFinite(nLng) &&
    nLat >= -90 &&
    nLat <= 90 &&
    nLng >= -180 &&
    nLng <= 180
  );
}
