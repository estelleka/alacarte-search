import { describe, it, expect } from 'vitest';
import { starsHTML, priceSymbol, distanceLabel, chipKey, buildHeroTitle, CUISINE_EMOJI } from '../../utils.js';

// ── starsHTML ──────────────────────────────────────────────────────────────────
describe('starsHTML', () => {
  it('returns 5 filled stars for score 5', () => {
    expect(starsHTML(5)).toBe('★★★★★');
  });
  it('returns 0 filled stars for score 0', () => {
    expect(starsHTML(0)).toBe('☆☆☆☆☆');
  });
  it('rounds score before rendering', () => {
    expect(starsHTML(3.2)).toBe('★★★☆☆');
    expect(starsHTML(3.7)).toBe('★★★★☆');
  });
  it('treats null/undefined as 0', () => {
    expect(starsHTML(null)).toBe('☆☆☆☆☆');
    expect(starsHTML(undefined)).toBe('☆☆☆☆☆');
  });
  it('always returns exactly 5 characters', () => {
    [0, 1, 2, 3, 4, 5].forEach(n => {
      const html = starsHTML(n);
      expect(html.length).toBe(5);
    });
  });
});

// ── priceSymbol ────────────────────────────────────────────────────────────────
describe('priceSymbol', () => {
  it('returns $ for "under" range', () => {
    expect(priceSymbol('$30 and under')).toBe('$');
  });
  it('returns $$ for mid range', () => {
    expect(priceSymbol('$31 to $50')).toBe('$$');
  });
  it('returns $$$ for high range', () => {
    expect(priceSymbol('$50 and over')).toBe('$$$');
  });
  it('returns empty string for null', () => {
    expect(priceSymbol(null)).toBe('');
    expect(priceSymbol('')).toBe('');
    expect(priceSymbol(undefined)).toBe('');
  });
  it('returns $$$$ for unknown range', () => {
    expect(priceSymbol('Unknown range')).toBe('$$$$');
  });
});

// ── distanceLabel ──────────────────────────────────────────────────────────────
describe('distanceLabel', () => {
  it('returns null for null input', () => {
    expect(distanceLabel(null)).toBeNull();
    expect(distanceLabel(undefined)).toBeNull();
  });
  it('returns meters for distances under 1km', () => {
    expect(distanceLabel(0)).toBe('0m');
    expect(distanceLabel(500)).toBe('500m');
    expect(distanceLabel(999)).toBe('999m');
  });
  it('returns km with 1 decimal for distances >= 1000m', () => {
    expect(distanceLabel(1000)).toBe('1.0km');
    expect(distanceLabel(1500)).toBe('1.5km');
    expect(distanceLabel(10000)).toBe('10.0km');
  });
});

// ── chipKey ────────────────────────────────────────────────────────────────────
describe('chipKey', () => {
  it('concatenates facet and value with ::', () => {
    expect(chipKey('food_type', 'Italian')).toBe('food_type::Italian');
    expect(chipKey('price_range', '$30 and under')).toBe('price_range::$30 and under');
    expect(chipKey('dining_style', 'Casual Dining')).toBe('dining_style::Casual Dining');
  });
});

// ── buildHeroTitle ─────────────────────────────────────────────────────────────
describe('buildHeroTitle', () => {
  it('returns default title with no filters', () => {
    const r = buildHeroTitle([], false);
    expect(r.title).toBe('Top Rated');
    expect(r.sub).toBe('The best in the city');
  });

  it('includes cuisine name when one cuisine selected', () => {
    const r = buildHeroTitle(['Italian'], false);
    expect(r.title).toBe('Top Rated Italian');
    expect(r.sub).toContain('italian');
  });

  it('includes "Near You" when geo is active', () => {
    const r = buildHeroTitle([], true);
    expect(r.title).toBe('Top Rated Near You');
    expect(r.sub).toContain('around you');
  });

  it('combines cuisine and geo', () => {
    const r = buildHeroTitle(['Italian'], true);
    expect(r.title).toBe('Top Rated Italian Near You');
    expect(r.sub).toContain('around you');
  });

  it('uses emoji when multiple cuisines selected', () => {
    const r = buildHeroTitle(['Italian', 'Sushi'], false);
    expect(r.title).toContain('🍝');
    expect(r.title).toContain('🍣');
  });
});

// ── CUISINE_EMOJI ──────────────────────────────────────────────────────────────
describe('CUISINE_EMOJI', () => {
  it('maps known cuisines to emojis', () => {
    expect(CUISINE_EMOJI['Italian']).toBe('🍝');
    expect(CUISINE_EMOJI['Sushi']).toBe('🍣');
    expect(CUISINE_EMOJI['American']).toBe('🍔');
    expect(CUISINE_EMOJI['French']).toBe('🥐');
  });
  it('has at least 10 entries', () => {
    expect(Object.keys(CUISINE_EMOJI).length).toBeGreaterThanOrEqual(10);
  });
});
