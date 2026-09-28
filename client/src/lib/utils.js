/**
 * client/src/lib/utils.js
 *
 * Shared pure utility functions used across multiple pages.
 * No React imports — these are plain JS helpers.
 */

/**
 * Returns a human-readable relative time string from an ISO timestamp.
 * e.g. "5m ago", "3h ago", "2d ago"
 */
export function timeAgo(timestamp) {
  if (!timestamp) return 'just now';
  const ms = Date.now() - new Date(timestamp).getTime();
  const h = Math.floor(ms / 3600000);
  if (h < 1) return `${Math.floor(ms / 60000)}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/**
 * Safely parses coordinates from PostGIS EWKB hex string, WKT POINT, or {lat, lng} object.
 * Returns { lat, lng } or null.
 */
export function parseLocation(loc) {
  if (!loc) return null;
  if (typeof loc === 'object') {
    if (loc.lat != null && loc.lng != null) return { lat: Number(loc.lat), lng: Number(loc.lng) };
    if (Array.isArray(loc.coordinates) && loc.coordinates.length >= 2) {
      return { lat: Number(loc.coordinates[1]), lng: Number(loc.coordinates[0]) };
    }
  }
  if (typeof loc === 'string') {
    // 1. WKT string format: "POINT(lng lat)"
    const pointMatch = loc.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
    if (pointMatch) {
      return { lat: parseFloat(pointMatch[2]), lng: parseFloat(pointMatch[1]) };
    }
    // 2. PostGIS EWKB hex string: "0101000020E6100000..." (50 hex characters)
    if (/^[0-9a-fA-F]{42,50}$/.test(loc)) {
      try {
        const hexToDouble = (hexStr) => {
          const bytes = new Uint8Array(8);
          for (let i = 0; i < 8; i++) {
            bytes[i] = parseInt(hexStr.substr(i * 2, 2), 16);
          }
          return new DataView(bytes.buffer).getFloat64(0, true);
        };
        const lng = hexToDouble(loc.substring(18, 34));
        const lat = hexToDouble(loc.substring(34, 50));
        if (!isNaN(lat) && !isNaN(lng)) {
          return { lat, lng };
        }
      } catch (err) {
        console.warn('Failed to parse EWKB geometry:', err);
      }
    }
  }
  return null;
}

