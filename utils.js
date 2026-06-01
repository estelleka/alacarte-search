// ── Pure utility functions — extracted for testability ────────────────────────

var _IMG = 'src/images/fallbacks/';
export var CUISINE_FALLBACKS = {
  'Italian':               _IMG + 'italian.jpg',
  'Sushi':                 _IMG + 'sushi.jpg',
  'Japanese':              _IMG + 'japanese.jpg',
  'American':              _IMG + 'american.jpg',
  'French':                _IMG + 'french.jpg',
  'Mexican':               _IMG + 'mexican.jpg',
  'Seafood':               _IMG + 'seafood.jpg',
  'Steakhouse':            _IMG + 'steakhouse.jpg',
  'Contemporary American': _IMG + 'contemporary-american.jpg',
  'Chinese':               _IMG + 'chinese.jpg',
  'Indian':                _IMG + 'indian.jpg',
  'Thai':                  _IMG + 'thai.jpg',
  'Greek':                 _IMG + 'greek.jpg',
  'Mediterranean':         _IMG + 'mediterranean.jpg',
  'Spanish':               _IMG + 'spanish.jpg',
  'Vietnamese':            _IMG + 'vietnamese.jpg',
  'Korean':                _IMG + 'korean.jpg',
  'Bar / Lounge':          _IMG + 'bar-lounge.jpg',
  'default':               _IMG + 'restaurant.jpg',
};

export const CUISINE_EMOJI = {
  'Italian':              '🍝',
  'Sushi':                '🍣',
  'Japanese':             '🍣',
  'American':             '🍔',
  'French':               '🥐',
  'Mexican':              '🌮',
  'Seafood':              '🦞',
  'Steakhouse':           '🥩',
  'Contemporary American':'✨',
  'Chinese':              '🥡',
  'Indian':               '🍛',
  'Thai':                 '🍜',
  'Greek':                '🫒',
  'Mediterranean':        '🫙',
  'Spanish':              '🥘',
  'Vietnamese':           '🍜',
  'Korean':               '🍱',
};

export function starsHTML(score) {
  const full = Math.round(score || 0);
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}

export function distanceLabel(meters) {
  if (meters == null) return null;
  return meters < 1000 ? meters + 'm' : (meters / 1000).toFixed(1) + 'km';
}

export function priceSymbol(range) {
  if (!range) return '';
  if (range.includes('and under')) return '$';
  if (range.includes('31')) return '$$';
  if (range.includes('50') || range.includes('51')) return '$$$';
  return '$$$$';
}

export function chipKey(facet, value) {
  return facet + '::' + value;
}

export function buildHeroTitle(cuisines, hasGeo) {
  var cuisineEmojis = cuisines.map(function (c) { return CUISINE_EMOJI[c] || '🍽️'; }).join('');
  var label = cuisines.length === 1 ? cuisines[0]
            : cuisines.length > 1  ? cuisineEmojis
            : '';
  if (label && hasGeo) return { title: 'Top Rated ' + label + ' Near You', sub: 'Highest rated' + (cuisines.length === 1 ? ' ' + cuisines[0].toLowerCase() : '') + ' around you' };
  if (label)           return { title: 'Top Rated ' + label,               sub: 'The best' + (cuisines.length === 1 ? ' ' + cuisines[0].toLowerCase() : '') + ' in the city' };
  if (hasGeo)          return { title: 'Top Rated Near You',               sub: 'Highest rated around you' };
                       return { title: 'Top Rated',                        sub: 'The best in the city' };
}
