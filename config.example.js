// ─────────────────────────────────────────────────────────────────────────────
// config.js — API credentials and app constants
//
// ⚠️  The Search-Only API Key is intentionally public (read-only by design).
//     Never put an Admin API Key here. For production, inject credentials at
//     build time (Vite/Webpack env vars) or proxy search requests server-side.
//
// Setup : copier .env.example → .env, remplir vos valeurs, puis `npm run setup`
// ─────────────────────────────────────────────────────────────────────────────

const CONFIG = {

  // Algolia — Search-Only key is safe to expose in client-side code.
  ALGOLIA_APP_ID:  'YOUR_APP_ID',
  ALGOLIA_API_KEY: 'YOUR_SEARCH_ONLY_API_KEY',
  ALGOLIA_INDEX:   'restaurants',
  ALGOLIA_SUGGESTIONS_INDEX: 'restaurants_query_suggestions',

  // Map — default centre before geolocation is available
  MAP_DEFAULT_LAT: 40.7128,
  MAP_DEFAULT_LNG: -74.0060,
  MAP_DEFAULT_ZOOM: 12,

};
