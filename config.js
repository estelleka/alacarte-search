// ─────────────────────────────────────────────────────────────────────────────
// config.js — API credentials and app constants
//
// ⚠️  The Search-Only API Key is intentionally public (read-only by design).
//     Never put an Admin API Key here. For production, inject credentials at
//     build time (Vite/Webpack env vars) or proxy search requests server-side.
// ─────────────────────────────────────────────────────────────────────────────

const CONFIG = {

  // Algolia — Search-Only key is safe to expose in client-side code.
  ALGOLIA_APP_ID:  '13QP82NDZ9',
  ALGOLIA_API_KEY: 'fac71122377a3b9a4024f335f759153b',
  ALGOLIA_INDEX:   'restaurants',
  ALGOLIA_SUGGESTIONS_INDEX: 'restaurants_query_suggestions',

  // Map — default centre before geolocation is available
  MAP_DEFAULT_LAT: 40.7128,
  MAP_DEFAULT_LNG: -74.0060,
  MAP_DEFAULT_ZOOM: 12,

};
