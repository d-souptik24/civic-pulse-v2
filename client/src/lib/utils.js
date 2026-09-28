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
