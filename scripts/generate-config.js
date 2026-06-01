// Lit .env et génère config.js — aucune dépendance externe requise.
// Usage : node scripts/generate-config.js

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const env = Object.fromEntries(
  readFileSync(resolve(root, '.env'), 'utf8')
    .split('\n')
    .filter(line => line && !line.startsWith('#'))
    .map(line => line.split('=').map(s => s.trim()))
);

const required = ['ALGOLIA_APP_ID', 'ALGOLIA_API_KEY', 'ALGOLIA_INDEX', 'ALGOLIA_SUGGESTIONS_INDEX'];
const missing = required.filter(k => !env[k]);
if (missing.length) {
  console.error(`Clefs manquantes dans .env : ${missing.join(', ')}`);
  process.exit(1);
}

const output = `const CONFIG = {
  ALGOLIA_APP_ID:  '${env.ALGOLIA_APP_ID}',
  ALGOLIA_API_KEY: '${env.ALGOLIA_API_KEY}',
  ALGOLIA_INDEX:   '${env.ALGOLIA_INDEX}',
  ALGOLIA_SUGGESTIONS_INDEX: '${env.ALGOLIA_SUGGESTIONS_INDEX}',

  MAP_DEFAULT_LAT: 40.7128,
  MAP_DEFAULT_LNG: -74.0060,
  MAP_DEFAULT_ZOOM: 12,
};
`;

writeFileSync(resolve(root, 'config.js'), output);
console.log('config.js généré avec succès.');
