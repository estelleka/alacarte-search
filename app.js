// ─────────────────────────────────────────────────────────────────────────────
// app.js — alacarte
// Dépend de : config.js (chargé avant dans le HTML)
// ─────────────────────────────────────────────────────────────────────────────
import { CUISINE_EMOJI, CUISINE_FALLBACKS, starsHTML, distanceLabel, priceSymbol, chipKey, buildHeroTitle } from './utils.js';

document.addEventListener("DOMContentLoaded", function () {

  // ── Image fallback (global, accessible depuis les attributs onerror inline) ──
  window._cuisineFallback = function(img, cuisine) {
    var specific = CUISINE_FALLBACKS[cuisine] || CUISINE_FALLBACKS['default'];
    var generic  = CUISINE_FALLBACKS['default'];
    if (img.src === specific || img.src === generic) {
      // Déjà sur un fallback — stoppe la chaîne
      img.onerror = null;
    } else {
      img.onerror = function() { img.onerror = null; img.src = generic; };
      img.src = specific;
    }
  };

  // ── Algolia — init ─────────────────────────────────────────────────────────
  const client = algoliasearch(CONFIG.ALGOLIA_APP_ID, CONFIG.ALGOLIA_API_KEY);

  const ATTRS_WITH_ID = ['name', 'food_type', 'stars_count', 'reviews_count',
                         'price_range', 'payment_options', 'neighborhood',
                         'image_url', '_geoloc', 'address', 'city', 'state',
                         'phone_number', 'reserve_url', 'mobile_reserve_url',
                         'dining_style', 'objectID'];
  const DISJUNCTIVE_FACETS = ['food_type', 'payment_options', 'dining_style', 'price_range'];

  const helper = algoliasearchHelper(client, CONFIG.ALGOLIA_INDEX, {
    attributesToHighlight: ['name'],
    highlightPreTag: '<em>',
    highlightPostTag: '</em>',
    attributesToRetrieve: ['name', 'food_type', 'stars_count', 'reviews_count',
                           'price_range', 'payment_options', 'neighborhood',
                           'image_url', '_geoloc', 'address', 'city', 'state',
                           'phone_number', 'reserve_url', 'mobile_reserve_url',
                           'dining_style'],
    disjunctiveFacets: DISJUNCTIVE_FACETS,
    hitsPerPage: 20,
    getRankingInfo: true,
    clickAnalytics: true,
  });

  const suggestionsIndex = client.initIndex(CONFIG.ALGOLIA_SUGGESTIONS_INDEX);

  // ── Algolia Insights ─────────────────────────────────────────────────────────
  var _lastQueryID = null;
  if (window.aa) {
    aa('init', { appId: CONFIG.ALGOLIA_APP_ID, apiKey: CONFIG.ALGOLIA_API_KEY, useCookie: true });
  }

  function trackInsights(method, payload) {
    if (!window.aa) return;
    aa(method, Object.assign({ index: CONFIG.ALGOLIA_INDEX }, payload));
  }

  const mapHelper = algoliasearchHelper(client, CONFIG.ALGOLIA_INDEX, {
    attributesToRetrieve: ATTRS_WITH_ID,
    disjunctiveFacets: DISJUNCTIVE_FACETS,
    hitsPerPage: 1000,
    getRankingInfo: false,
  });

  // ── Carte Leaflet ───────────────────────────────────────────────────────────
  const map = L.map('map', { zoomControl: true, attributionControl: false });
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map);
  map.setView([CONFIG.MAP_DEFAULT_LAT, CONFIG.MAP_DEFAULT_LNG], CONFIG.MAP_DEFAULT_ZOOM);

  const pinSVG = () => `<svg width="26" height="34" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.27 21.73 0 14 0z" fill="#C07A5A"/>
    <circle cx="14" cy="14" r="5" fill="#FDF5EE"/></svg>`;

  let markers = [];

  function updateMapMarkers(hits) {
    markers.forEach(m => map.removeLayer(m));
    markers = [];
    hits.forEach(function (hit) {
      if (!hit._geoloc) return;
      const { lat, lng } = hit._geoloc;
      const icon = L.divIcon({ html: pinSVG(), className: '', iconSize: [26, 34], iconAnchor: [13, 34], popupAnchor: [0, -36] });
      const marker = L.marker([lat, lng], { icon }).addTo(map).on('click', function () { openModal(hit); });
      markers.push(marker);
    });
  }

  // mapHelper.on('result') : utilisé uniquement en search mode (query active ou geo radius)
  mapHelper.on('result', function ({ results }) {
    var useCache = _mapCacheReady && !(helper.state.query || '').trim() && geoMode === null;
    if (!useCache) {
      updateMapMarkers(results.hits);
      updateViewportCount(results.hits.filter(function (h) { return h._geoloc; }).length);
    }
  });

  // Refresh pins sur pan/zoom (cache mode uniquement)
  map.on('moveend zoomend', function () {
    if (document.getElementById('map-overlay').classList.contains('open')) {
      renderMapPins();
    }
  });

  function renderMapPins() {
    var useCache = _mapCacheReady && !(helper.state.query || '').trim() && geoMode === null;
    if (!useCache) return;
    var filtered = filterCacheForMap(map.getBounds());
    updateMapMarkers(filtered);
    updateViewportCount(filtered.length);
  }

  function filterCacheForMap(bounds) {
    var sw = bounds.getSouthWest();
    var ne = bounds.getNorthEast();
    var activeFoodTypes = Object.keys(activeChips).filter(function (k) { return k.startsWith('food_type::'); }).map(function (k) { return k.split('::')[1]; });
    var activePrices    = Object.keys(activeChips).filter(function (k) { return k.startsWith('price_range::'); }).map(function (k) { return k.split('::')[1]; });
    var activeDining    = Object.keys(activeChips).filter(function (k) { return k.startsWith('dining_style::'); }).map(function (k) { return k.split('::')[1]; });
    var activePayments  = Object.keys(activeChips).filter(function (k) { return k.startsWith('payment_options::'); }).map(function (k) { return k.split('::')[1]; });
    return _mapCache.filter(function (hit) {
      if (!hit._geoloc) return false;
      var lat = hit._geoloc.lat, lng = hit._geoloc.lng;
      if (lat < sw.lat || lat > ne.lat || lng < sw.lng || lng > ne.lng) return false;
      if (activeFoodTypes.length && activeFoodTypes.indexOf(hit.food_type) === -1) return false;
      if (activePrices.length && activePrices.indexOf(hit.price_range) === -1) return false;
      if (activeDining.length && activeDining.indexOf(hit.dining_style) === -1) return false;
      if (activePayments.length && !(hit.payment_options || []).some(function (p) { return activePayments.indexOf(p) !== -1; })) return false;
      if (activeRating !== null && (hit.stars_count || 0) < activeRating) return false;
      return true;
    });
  }

  function updateViewportCount(count) {
    var el = document.getElementById('map-viewport-count');
    if (!el) return;
    el.textContent = count.toLocaleString() + ' restaurant' + (count !== 1 ? 's' : '') + ' in this area';
    el.style.display = count > 0 ? 'block' : 'none';
  }

  function loadMapCache() {
    var loadingEl = document.getElementById('map-cache-loading');
    if (loadingEl) loadingEl.style.display = 'block';
    _mapCache = [];
    client.initIndex(CONFIG.ALGOLIA_INDEX).browseObjects({
      query: '',
      attributesToRetrieve: ATTRS_WITH_ID,
      batch: function (batch) { _mapCache = _mapCache.concat(batch); }
    }).then(function () {
      _mapCacheReady = true;
      if (loadingEl) loadingEl.style.display = 'none';
      if (document.getElementById('map-overlay').classList.contains('open')) {
        renderMapPins();
      }
    });
  }

  // ── Map overlay ─────────────────────────────────────────────────────────────
  const mapOverlay  = document.getElementById('map-overlay');
  const mapOpenBtn  = document.getElementById('map-open-btn');

  mapOpenBtn.addEventListener('click', function () {
    const isOpen = mapOverlay.classList.toggle('open');
    mapOpenBtn.classList.toggle('active', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
    if (isOpen) setTimeout(function () { map.invalidateSize(); renderMapPins(); }, 50);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && mapOverlay.classList.contains('open')) {
      mapOverlay.classList.remove('open');
      mapOpenBtn.classList.remove('active');
      document.body.style.overflow = '';
    }
  });

  // ── Map cache state ──────────────────────────────────────────────────────────
  var _mapCache      = [];
  var _mapCacheReady = false;

  // ── Géo state ───────────────────────────────────────────────────────────────
  // geoMode: null | 'device' | 'place'
  let geoMode    = null;
  let geoRadius  = 5; // km
  let geoPlaceLabel = '';

  function applyGeoFilter() {
    if (geoMode === 'device' && window._userLat != null) {
      helper.setQueryParameter('aroundLatLng', window._userLat + ',' + window._userLng);
      helper.setQueryParameter('aroundRadius', geoRadius * 1000);
    } else if (geoMode === 'place' && window._placeLat != null) {
      helper.setQueryParameter('aroundLatLng', window._placeLat + ',' + window._placeLng);
      helper.setQueryParameter('aroundRadius', geoRadius * 1000);
    } else {
      helper.setQueryParameter('aroundLatLng', undefined);
      helper.setQueryParameter('aroundRadius', undefined);
    }
    currentPage = 0; allHits = [];
    helper.setPage(0).search();
    updateGeoFilterLabel();
  }

  function clearGeoFilter() {
    geoMode = null;
    window._userLat = null; window._userLng = null;
    window._placeLat = null; window._placeLng = null;
    helper.setQueryParameter('aroundLatLng', undefined);
    helper.setQueryParameter('aroundRadius', undefined);
    document.getElementById('stat-geo').textContent = '—';
    document.getElementById('fbar-nearme-btn').classList.remove('active');
    updateGeoFilterLabel();
  }

  function updateGeoFilterLabel() {
    const btn   = document.getElementById('geo-filter-btn');
    const label = document.getElementById('geo-filter-label');
    if (geoMode === 'device') {
      label.textContent = 'Near me · ' + geoRadius + 'km';
      btn.classList.add('active');
    } else if (geoMode === 'place' && geoPlaceLabel) {
      label.textContent = geoPlaceLabel + ' · ' + geoRadius + 'km';
      btn.classList.add('active');
    } else {
      label.textContent = 'Location';
      btn.classList.remove('active');
    }
  }

  // ── "Use my location" ───────────────────────────────────────────────────────
  var _geoRetries = 0;
  var MAX_GEO_RETRIES = 3;

  function initGeoDevice() {
    if (!navigator.geolocation) {
      document.getElementById('stat-geo').textContent = 'unavailable';
      return;
    }
    _geoRetries = 0;
    _tryGetPosition();
  }

  function _tryGetPosition() {
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        _geoRetries = 0;
        window._userLat = pos.coords.latitude;
        window._userLng = pos.coords.longitude;
        if (geoMode === 'device') applyGeoFilter();

        // Reverse geocoding to show the city name in the stats bar
        fetchWithTimeout('https://nominatim.openstreetmap.org/reverse?lat=' + window._userLat + '&lon=' + window._userLng + '&format=json', {
          headers: { 'Accept-Language': 'en' }
        }, 5000)
          .then(function (r) { return r.json(); })
          .then(function (data) {
            var city = (data.address && (data.address.city || data.address.town || data.address.village)) || 'detected';
            document.getElementById('stat-geo').textContent = city;
          })
          .catch(function () {
            document.getElementById('stat-geo').textContent = 'detected';
          });

      },
      function (err) {
        if (err.code === err.POSITION_UNAVAILABLE && _geoRetries < MAX_GEO_RETRIES) {
          _geoRetries++;
          setTimeout(_tryGetPosition, 1500 * _geoRetries);
        } else {
          // Permission denied, timed out, or too many retries — reset geo state
          geoMode = null;
          document.getElementById('fbar-nearme-btn').classList.remove('active');
          document.getElementById('stat-geo').textContent =
            err.code === err.PERMISSION_DENIED ? 'denied' : 'off';
          _geoRetries = 0;
        }
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  }

  document.getElementById('fbar-nearme-btn').addEventListener('click', function () {
    if (geoMode === 'device') {
      clearGeoFilter();
      applyGeoFilter();
    } else {
      geoMode = 'device';
      document.getElementById('fbar-nearme-btn').classList.add('active');
      if (window._userLat != null) {
        applyGeoFilter();
      } else {
        initGeoDevice();
      }
    }
  });

  // ── Geocoding — recherche par lieu (Nominatim, gratuit) ─────────────────────
  function fetchWithTimeout(url, opts, ms) {
    var ctrl  = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, ms);
    return fetch(url, Object.assign({}, opts, { signal: ctrl.signal }))
      .finally(function () { clearTimeout(timer); });
  }

  let geoSearchTimeout = null;

  document.getElementById('geo-search-input').addEventListener('input', function () {
    const q = this.value.trim();
    clearTimeout(geoSearchTimeout);
    const suggestionsEl = document.getElementById('geo-suggestions');
    if (q.length < 2) { suggestionsEl.innerHTML = ''; return; }
    geoSearchTimeout = setTimeout(function () {
      fetchWithTimeout('https://nominatim.openstreetmap.org/search?q=' + encodeURIComponent(q) + '&format=json&limit=5&addressdetails=1', {
        headers: { 'Accept-Language': 'en' }
      }, 5000)
        .then(function (r) { return r.json(); })
        .then(function (results) {
          suggestionsEl.innerHTML = results.map(function (r) {
            const name = r.address.city || r.address.town || r.address.village || r.address.county || r.display_name.split(',')[0];
            const sub  = r.display_name.split(',').slice(1, 3).join(',').trim();
            return '<div class="geo-suggestion-item" data-lat="' + r.lat + '" data-lng="' + r.lon + '" data-name="' + name + '">' +
              '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>' +
              '<div><div class="geo-suggestion-name">' + name + '</div><div class="geo-suggestion-sub">' + sub + '</div></div>' +
              '</div>';
          }).join('');

          suggestionsEl.querySelectorAll('.geo-suggestion-item').forEach(function (item) {
            item.addEventListener('click', function () {
              window._placeLat = parseFloat(item.dataset.lat);
              window._placeLng = parseFloat(item.dataset.lng);
              geoPlaceLabel    = item.dataset.name;
              geoMode = 'place';
              document.getElementById('geo-search-input').value = item.dataset.name;
              suggestionsEl.innerHTML = '';
              document.getElementById('stat-geo').textContent = item.dataset.name;
              document.getElementById('fbar-nearme-btn').classList.remove('active');
              map.setView([window._placeLat, window._placeLng], 13);
              applyGeoFilter();
              closeAllDropdowns();
            });
          });
        })
        .catch(function () {});
    }, 300);
  });

  // ── Slider rayon ────────────────────────────────────────────────────────────
  document.getElementById('fbar-radius-slider').addEventListener('input', function () {
    geoRadius = parseInt(this.value);
    document.getElementById('fbar-radius-val').textContent = geoRadius + ' km';
    if (geoMode) applyGeoFilter();
    updateGeoFilterLabel();
  });

  // ── Filter bar — dropdowns ──────────────────────────────────────────────────
  const fbarItems = document.querySelectorAll('.filter-bar-item');

  // Porter tous les dropdowns dans <body> pour échapper au stacking context du header
  const fbarPairs = [];
  fbarItems.forEach(function (item) {
    const btn = item.querySelector('.fbar-btn');
    const dd  = item.querySelector('.fbar-dropdown');
    if (!btn || !dd) return;
    document.body.appendChild(dd); // sort du header -> root stacking context
    fbarPairs.push({ item: item, btn: btn, dd: dd });
  });

  function closeAllDropdowns(except) {
    fbarPairs.forEach(function (pair) {
      if (pair.item === except) return;
      pair.btn.classList.remove('open');
      pair.dd.classList.remove('open');
      pair.dd.style.top = '';
      pair.dd.style.left = '';
    });
  }

  fbarPairs.forEach(function (pair) {
    pair.btn.addEventListener('click', function (e) {
      e.stopPropagation();
      const isOpen = pair.dd.classList.contains('open');
      closeAllDropdowns();
      if (!isOpen) {
        const rect = pair.btn.getBoundingClientRect();
        pair.dd.style.top  = (rect.bottom + 8) + 'px';
        pair.dd.style.left = rect.left + 'px';
        pair.dd.classList.add('open');
        pair.btn.classList.add('open');
      }
    });
  });

  document.addEventListener('click', function (e) {
    const inFilterBar = e.target.closest('.filter-bar-item');
    const inDropdown  = e.target.closest('.fbar-dropdown');
    if (!inFilterBar && !inDropdown) closeAllDropdowns();
    if (!e.target.closest('.search-wrap')) hideAutocomplete();
  });

  // ── Chips filtres (price, dining, payment) ──────────────────────────────────
  // Source de vérité JS — évite le bug des chips dupliquées dans <body>
  // après appendChild (les dropdowns sont déplacés hors du header)
  let activeRating = null;
  var activeChips = {}; // { "price_range::$30 and under": true, ... }

  // chipKey importé depuis utils.js

  function syncChipDOM() {
    // Remet toutes les chips à l'état correct selon activeChips
    document.querySelectorAll('.fbar-chip[data-facet]').forEach(function (chip) {
      var key = chipKey(chip.dataset.facet, chip.dataset.value);
      chip.classList.toggle('active', !!activeChips[key]);
    });
    document.querySelectorAll('.fbar-chip[data-rating]').forEach(function (chip) {
      chip.classList.toggle('active', parseFloat(chip.dataset.rating) === activeRating);
    });
  }

  document.querySelectorAll('.fbar-chip[data-facet]').forEach(function (chip) {
    chip.addEventListener('click', function () {
      var key = chipKey(chip.dataset.facet, chip.dataset.value);
      var isAdding = !activeChips[key];
      if (isAdding) { activeChips[key] = true; } else { delete activeChips[key]; }
      syncChipDOM();
      applyAllChipFilters();
      updateChipLabels();
      if (isAdding) {
        trackInsights('clickedFilters', {
          eventName: 'Filter Applied',
          filters: [chip.dataset.facet + ':' + chip.dataset.value],
        });
      }
    });
  });

  document.querySelectorAll('.fbar-chip[data-rating]').forEach(function (chip) {
    chip.addEventListener('click', function () {
      const val = parseFloat(chip.dataset.rating);
      activeRating = (activeRating === val) ? null : val;
      syncChipDOM();
      applyAllChipFilters();
      updateChipLabels();
    });
  });

  function applyAllChipFilters() {
    helper.clearRefinements('price_range');
    helper.clearRefinements('dining_style');
    helper.clearRefinements('payment_options');
    helper.clearRefinements('food_type');
    helper.removeNumericRefinement('stars_count');

    Object.keys(activeChips).forEach(function (key) {
      var parts = key.split('::');
      helper.addDisjunctiveFacetRefinement(parts[0], parts[1]);
    });
    if (activeRating !== null) {
      helper.addNumericRefinement('stars_count', '>=', activeRating);
    }
    currentPage = 0; allHits = [];
    helper.setPage(0).search();
    // Refresh hero banner — les titres changent selon les filtres cuisine/geo actifs
    updateHeroBanner();
  }

  function getActiveChipLabels(facet) {
    return Object.keys(activeChips)
      .filter(function (k) { return k.startsWith(facet + '::'); })
      .map(function (k) {
        var val = k.split('::')[1];
        // Cherche le textContent du chip correspondant
        var chip = document.querySelector('.fbar-chip[data-facet="' + facet + '"][data-value="' + val + '"]');
        return chip ? chip.textContent.trim() : val;
      });
  }

  function updateChipLabels() {
    // Prix
    var priceLabels = getActiveChipLabels('price_range');
    document.getElementById('price-filter-label').textContent = priceLabels.length ? priceLabels.join(', ') : 'Price';
    document.getElementById('price-filter-btn').classList.toggle('active', priceLabels.length > 0);

    // Rating
    document.getElementById('rating-filter-label').textContent = activeRating !== null ? activeRating + '★+' : 'Rating';
    document.getElementById('rating-filter-btn').classList.toggle('active', activeRating !== null);

    // Dining
    var diningLabels = getActiveChipLabels('dining_style');
    document.getElementById('dining-filter-label').textContent = diningLabels.length ? diningLabels.join(', ') : 'Dining style';
    document.getElementById('dining-filter-btn').classList.toggle('active', diningLabels.length > 0);

    // Payment
    var paymentLabels = getActiveChipLabels('payment_options');
    document.getElementById('payment-filter-label').textContent = paymentLabels.length ? paymentLabels.join(', ') : 'Payment';
    document.getElementById('payment-filter-btn').classList.toggle('active', paymentLabels.length > 0);

    // Cuisine
    const cuisineActive = document.querySelectorAll('.fbar-chip[data-facet="food_type"].active');
    document.getElementById('cuisine-filter-label').textContent =
      cuisineActive.length ? Array.from(cuisineActive).map(c => c.textContent).join(', ') : 'Cuisine';
    document.getElementById('cuisine-filter-btn').classList.toggle('active', cuisineActive.length > 0);
  }

  document.getElementById('fbar-reset').addEventListener('click', function () {
    activeChips = {};
    activeRating = null;
    syncChipDOM();
    clearGeoFilter();
    helper.clearRefinements('price_range');
    helper.clearRefinements('dining_style');
    helper.clearRefinements('payment_options');
    helper.clearRefinements('food_type');
    helper.removeNumericRefinement('stars_count');
    helper.setQueryParameter('aroundLatLng', undefined);
    helper.setQueryParameter('aroundRadius', undefined);
    currentPage = 0; allHits = [];
    helper.setPage(0).search();
    updateChipLabels();
  });

  // ── Helpers UI ── (CUISINE_EMOJI, starsHTML, distanceLabel, priceSymbol importés depuis utils.js)

  // ── Card HTML helper ──────────────────────────────────────────────────────────────────
  function cardHTML(hit, i, dataAttr) {
    var dist    = hit._rankingInfo ? distanceLabel(hit._rankingInfo.geoDistance) : null;
    var price   = priceSymbol(hit.price_range);
    var name    = (hit._highlightResult && hit._highlightResult.name && hit._highlightResult.name.value) || hit.name;
    var imgSrc  = (hit.image_url && hit.image_url.indexOf('opentable.com') === -1)
                  ? hit.image_url : getCuisineImage(hit.food_type);
    var cuisine = (hit.food_type || '').replace(/'/g, "\\'");
    return '<div class="restaurant-card" data-id="' + hit.objectID + '" ' + dataAttr + '="' + i + '" data-cuisine="' + (hit.food_type || '') + '" style="animation-delay:' + (i * 30) + 'ms">' +
      '<div class="card-image">' +
      '<img class="cuisine-img" src="' + imgSrc + '" alt="' + hit.name + '" loading="lazy" onerror="window._cuisineFallback(this,\'' + cuisine + '\')" style="width:100%;height:100%;object-fit:cover;">' +
      (dist ? '<div class="card-distance">' + dist + '</div>' : '') +
      '</div>' +
      '<div class="card-body">' +
      '<div class="card-cuisine">' + (hit.food_type || '') + '</div>' +
      '<div class="card-name">' + name + '</div>' +
      '<div class="card-meta"><span class="stars">' + starsHTML(hit.stars_count) + '</span><span class="card-rating">' + (hit.stars_count || 0).toFixed(1) + '</span><span class="card-reviews">(' + (hit.reviews_count || 0) + ')</span>' + (price ? '<span class="card-price">' + price + '</span>' : '') + '</div>' +
      '<div class="card-tags">' + (hit.neighborhood ? '<span class="card-tag warm">' + hit.neighborhood + '</span>' : '') + (hit.payment_options || []).map(function (p) { return '<span class="card-tag cool">' + p + '</span>'; }).join('') + '</div>' +
      '</div></div>';
  }

  // ── Render results ──────────────────────────────────────────────────────────────────
  function renderResults(hits, append) {
    var container  = document.getElementById('results');
    var fallbackEl = document.getElementById('fallback-container');
    document.getElementById('results-label').textContent =
      hits.length + ' restaurant' + (hits.length !== 1 ? 's' : '');

    if (fallbackEl) fallbackEl.innerHTML = '';

    if (!hits.length) {
      container.innerHTML = emptyStateHTML();
      launchFallbackSearch();
      return;
    }
    currentHits = hits;
    if (!append) container.innerHTML = '';
    const pageSize  = 50;
    const sliceFrom = append ? Math.max(0, hits.length - pageSize) : 0;
    const newCards  = hits.slice(sliceFrom).map(function (hit, i) {
      return cardHTML(hit, i, 'data-index');
    }).join('');
    container.insertAdjacentHTML('beforeend', newCards);
  }
  // ── Render cuisine pills (dynamiques) ──────────────────────────────────────────────────────────
  var MAX_VISIBLE_PILLS = 6;

  function renderCuisinePills(facetValues) {
    var container = document.getElementById('filters-container');
    var active    = (helper.state.disjunctiveFacetsRefinements &&
                     helper.state.disjunctiveFacetsRefinements.food_type &&
                     helper.state.disjunctiveFacetsRefinements.food_type[0]) || '';
    var cuisines  = facetValues.slice(0, 14);
    var overflow  = cuisines.length > MAX_VISIBLE_PILLS;

    var allBtn = '<button class="filter-pill ' + (active === '' ? 'active' : '') + '" data-filter="">All</button>';
    var pills   = cuisines.map(function (entry, i) {
      var cuisine = entry.name; var count = entry.count;
      var emoji   = CUISINE_EMOJI[cuisine] || '🍽️';
      var hidden  = i >= MAX_VISIBLE_PILLS ? ' pill-hidden' : '';
      return '<button class="filter-pill' + (active === cuisine ? ' active' : '') + hidden + '" data-filter="' + cuisine + '">' +
        emoji + ' ' + cuisine + ' <span style="opacity:0.6;font-size:11px">('+count+')</span></button>';
    }).join('');
    var moreBtn = overflow
      ? '<button class="filter-pill filter-pill-more" id="pills-more-btn">+' + (cuisines.length - MAX_VISIBLE_PILLS) + ' more</button>'
      : '';

    container.innerHTML = allBtn + pills + moreBtn;
    container.classList.remove('expanded');

    var moreEl = document.getElementById('pills-more-btn');
    if (moreEl) {
      var hiddenCount = cuisines.length - MAX_VISIBLE_PILLS;
      moreEl.addEventListener('click', function () {
        var expanded = container.classList.toggle('expanded');
        moreEl.textContent = expanded ? 'Show less' : '+' + hiddenCount + ' more';
      });
    }

    var chipsEl = document.getElementById('fbar-cuisine-chips');
    chipsEl.innerHTML = cuisines.map(function (entry) {
      var cuisine  = entry.name;
      var count    = entry.count;
      var emoji    = CUISINE_EMOJI[cuisine] || '🍽️';
      var isActive = !!activeChips[chipKey('food_type', cuisine)];
      return '<button class="fbar-chip' + (isActive ? ' active' : '') + '" data-facet="food_type" data-value="' + cuisine + '">' + emoji + ' ' + cuisine + ' (' + count + ')</button>';
    }).join('');

    chipsEl.querySelectorAll('.fbar-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        var key = chipKey(chip.dataset.facet, chip.dataset.value);
        var isAdding = !activeChips[key];
        if (isAdding) { activeChips[key] = true; } else { delete activeChips[key]; }
        syncChipDOM();
        applyAllChipFilters();
        updateChipLabels();
        if (isAdding) {
          trackInsights('clickedFilters', {
            eventName: 'Filter Applied',
            filters: ['food_type:' + chip.dataset.value],
          });
        }
      });
    });

    container.querySelectorAll('.filter-pill[data-filter]').forEach(function (pill) {
      pill.addEventListener('click', function () {
        var filter = pill.dataset.filter;
        // Nettoie tous les activeChips food_type et en remet un si filtre non vide
        Object.keys(activeChips).forEach(function (k) {
          if (k.startsWith('food_type::')) delete activeChips[k];
        });
        if (filter !== '') activeChips[chipKey('food_type', filter)] = true;
        syncChipDOM();
        applyAllChipFilters();
        updateChipLabels();
      });
    });
  }


  // ── Empty state & Fallback ──────────────────────────────────────────────────────────────────
  var EMPTY_MSGS = [
    'We turned every table — nothing checks all the boxes.',
    "The kitchen's there, but not this combo.",
    'No restaurant survived all these filters.'
  ];

  function getActiveFilters() {
    var state    = helper.state;
    var numRefs  = state.numericRefinements || {};
    var disjRefs = state.disjunctiveFacetsRefinements || {};
    var filters  = [];
    if (numRefs.stars_count && numRefs.stars_count['>='] && numRefs.stars_count['>='].length) {
      filters.push({ type: 'rating', label: numRefs.stars_count['>='][0] + '★+' });
    }
    if (disjRefs.dining_style && disjRefs.dining_style.length) {
      filters.push({ type: 'dining_style', label: disjRefs.dining_style.join(', ') });
    }
    if (disjRefs.price_range && disjRefs.price_range.length) {
      filters.push({ type: 'price_range', label: disjRefs.price_range.map(priceSymbol).join(' ') });
    }
    if (disjRefs.food_type && disjRefs.food_type.length) {
      filters.push({ type: 'food_type', label: disjRefs.food_type.join(', ') });
    }
    if (disjRefs.payment_options && disjRefs.payment_options.length) {
      filters.push({ type: 'payment_options', label: disjRefs.payment_options.join(', ') });
    }
    if (helper.state.aroundLatLng) {
      var geoLbl = (geoMode === 'device' ? 'Near me' : (geoPlaceLabel || 'Location')) + ' · ' + geoRadius + 'km';
      filters.push({ type: 'geo', label: geoLbl });
    }
    return filters;
  }

  function emptyStateHTML() {
    var msg     = EMPTY_MSGS[Math.floor(Math.random() * EMPTY_MSGS.length)];
    var filters = getActiveFilters();
    var pills   = filters.map(function (f) {
      return '<span class="empty-filter-pill">' + f.label + '</span>';
    }).join('');
    return '<div class="empty-state">' +
      '<div class="empty-emoji">🍽️</div>' +
      '<div class="empty-msg">' + msg + '</div>' +
      (pills ? '<div class="empty-pills">' + pills + '</div>' : '') +
      '</div>';
  }

  function ensureFallbackContainer() {
    var el = document.getElementById('fallback-container');
    if (!el) {
      el = document.createElement('div');
      el.id = 'fallback-container';
      document.getElementById('results').insertAdjacentElement('afterend', el);
    }
    return el;
  }

  var _fallbackToken = 0;

  function launchFallbackSearch() {
    var token   = ++_fallbackToken;
    var fc      = ensureFallbackContainer();
    var filters = getActiveFilters();
    var state   = helper.state;

    // No active filters but a text query that matched nothing →
    // show top-rated restaurants as a fallback (broad search, no query).
    if (filters.length === 0) {
      if (!(state.query || '').trim()) { fc.innerHTML = ''; return; }
      fc.innerHTML = '<div class="fallback-loading">Looking for alternatives…</div>';
      var fhTop = algoliasearchHelper(client, CONFIG.ALGOLIA_INDEX, {
        attributesToRetrieve: ATTRS_WITH_ID, hitsPerPage: 6,
      });
      fhTop.addNumericRefinement('stars_count', '>=', 4);
      fhTop.on('result', function (e) {
        if (token !== _fallbackToken) return;
        renderFallback([], { type: 'query', label: state.query }, e.results.hits);
      });
      fhTop.on('error', function () { if (token !== _fallbackToken) return; fc.innerHTML = ''; });
      fhTop.search();
      return;
    }

    fc.innerHTML = '<div class="fallback-loading">Looking for alternatives…</div>';

    var toRemove = filters[0];

    var pending = { relaxed: null, broad: null };

    function tryRender() {
      if (token !== _fallbackToken) return;
      if (pending.relaxed === null || pending.broad === null) return;
      var relaxedIds = pending.relaxed.reduce(function (a, h) { a[h.objectID] = true; return a; }, {});
      var broadOnly  = pending.broad.filter(function (h) { return !relaxedIds[h.objectID]; });
      renderFallback(pending.relaxed, toRemove, broadOnly);
    }

    var fh1 = algoliasearchHelper(client, CONFIG.ALGOLIA_INDEX, {
      attributesToRetrieve: ATTRS_WITH_ID, hitsPerPage: 6, getRankingInfo: true,
      disjunctiveFacets: DISJUNCTIVE_FACETS,
    });
    fh1.on('result', function (e) { pending.relaxed = e.results.hits; tryRender(); });
    fh1.on('error',  function ()  { pending.relaxed = []; tryRender(); });

    var fh2 = algoliasearchHelper(client, CONFIG.ALGOLIA_INDEX, {
      attributesToRetrieve: ATTRS_WITH_ID, hitsPerPage: 6,
    });
    fh2.on('result', function (e) { pending.broad = e.results.hits; tryRender(); });
    fh2.on('error',  function ()  { pending.broad = []; tryRender(); });

    fh1.setQuery(state.query || '');
    if (state.aroundLatLng && toRemove.type !== 'geo') {
      fh1.setQueryParameter('aroundLatLng', state.aroundLatLng);
      fh1.setQueryParameter('aroundRadius', state.aroundRadius);
    }
    ['food_type', 'payment_options', 'dining_style', 'price_range'].forEach(function (facet) {
      if (toRemove.type === facet) return;
      var vals = (state.disjunctiveFacetsRefinements && state.disjunctiveFacetsRefinements[facet]) || [];
      vals.forEach(function (v) { fh1.addDisjunctiveFacetRefinement(facet, v); });
    });
    if (toRemove.type !== 'rating') {
      var nr = state.numericRefinements || {};
      if (nr.stars_count && nr.stars_count['>='] && nr.stars_count['>='].length) {
        fh1.addNumericRefinement('stars_count', '>=', nr.stars_count['>='][0]);
      }
    }

    // fh2 is the broad fallback — intentionally no text query so it always
    // returns real restaurants regardless of what the user typed.
    if (state.aroundLatLng && toRemove.type !== 'geo') {
      fh2.setQueryParameter('aroundLatLng', state.aroundLatLng);
      fh2.setQueryParameter('aroundRadius', state.aroundRadius);
    }

    fh1.search();
    fh2.search();
  }

  function renderFallback(relaxedHits, removedFilter, broadHits) {
    var fc   = ensureFallbackContainer();
    fallbackHits = relaxedHits.concat(broadHits);
    var html = '';

    if (relaxedHits.length) {
      var sectionTitle = removedFilter.type === 'geo'
        ? 'Expanding your search area'
        : 'Without <span class="fallback-pill">' + removedFilter.label + '</span>';
      html += '<div class="fallback-section">' +
        '<div class="fallback-header">' +
        '<span class="fallback-title">' + sectionTitle + '</span>' +
        '<span class="fallback-subtitle">Relaxing this filter finds options</span>' +
        '</div>' +
        '<div class="fallback-grid">' +
        relaxedHits.map(function (h, i) { return cardHTML(h, i, 'data-fallback-index'); }).join('') +
        '</div></div>';
    }

    if (broadHits.length) {
      var broadTitle = removedFilter.type === 'query' ? 'Top restaurants'
                     : removedFilter.type === 'geo'   ? 'Popular spots worldwide'
                     : 'Other options nearby';
      html += '<div class="fallback-section">' +
        '<div class="fallback-header">' +
        '<span class="fallback-title">' + broadTitle + '</span>' +
        '<span class="fallback-subtitle">No filters applied</span>' +
        '</div>' +
        '<div class="fallback-grid">' +
        broadHits.map(function (h, i) { return cardHTML(h, relaxedHits.length + i, 'data-fallback-index'); }).join('') +
        '</div></div>';
    }

    fc.innerHTML = html || '';
  }

  // ── Hero Banner ──────────────────────────────────────────────────────────────────
  var heroBanner  = null;
  var heroHits    = { topRated: [], fallback: [] };
  var _heroToken  = 0;
  var _heroLastKey   = null;

  function initHeroBanner() {
    heroBanner = document.createElement('div');
    heroBanner.id = 'hero-banner';
    var rs = document.querySelector('.results-section');
    rs.parentNode.insertBefore(heroBanner, rs);
  }

  function shouldShowBanner() {
    return !(helper.state.query || '').trim();
  }

  function getActiveCuisines() {
    return Object.keys(activeChips)
      .filter(function (k) { return k.startsWith('food_type::'); })
      .map(function (k) { return k.split('::')[1]; });
  }

  // buildHeroTitle importé depuis utils.js

  function updateHeroBanner() {
    if (!heroBanner) return;
    if (!shouldShowBanner()) { heroBanner.classList.add('hidden'); return; }
    heroBanner.classList.remove('hidden');
    var currentKey = (helper.state.aroundLatLng || 'nogeo') + '|' + getActiveCuisines().sort().join(',');
    if (currentKey !== _heroLastKey) {
      _heroLastKey = currentKey;
      fetchHeroData();
    } else {
      renderHeroBanner();
    }
  }

  function fetchHeroData() {
    var token      = ++_heroToken;
    heroHits.fallback = [];
    // Snapshot des filtres au moment du fetch — évite les race conditions
    // si l'utilisateur change les filtres pendant que la requête tourne
    var cuisinesSnap = getActiveCuisines().slice();
    var hasGeoSnap   = geoMode !== null;
    var latLng       = helper.state.aroundLatLng || null;

    var fh = algoliasearchHelper(client, CONFIG.ALGOLIA_INDEX, {
      attributesToRetrieve: ATTRS_WITH_ID, hitsPerPage: 3,
      disjunctiveFacets: ['food_type'],
    });
    fh.addNumericRefinement('stars_count', '>=', 4);
    cuisinesSnap.forEach(function (c) { fh.addDisjunctiveFacetRefinement('food_type', c); });
    if (latLng) {
      fh.setQueryParameter('aroundLatLng', latLng);
      fh.setQueryParameter('aroundRadius', helper.state.aroundRadius || 'all');
    }

    fh.on('result', function (e) {
      if (token !== _heroToken) return;
      var hits = e.results.hits;
      if (hits.length > 0) {
        heroHits.topRated   = hits;
        heroHits.fallback   = [];
        heroHits._cuisines  = cuisinesSnap;
        heroHits._hasGeo    = hasGeoSnap;
        renderHeroBanner();
      } else if (cuisinesSnap.length > 0 || hasGeoSnap) {
        fetchHeroFallback(token);
      } else {
        heroHits.topRated   = [];
        heroHits._cuisines  = [];
        heroHits._hasGeo    = false;
        renderHeroBanner();
      }
    });
    fh.on('error', function () {
      if (token !== _heroToken) return;
      fetchHeroFallback(token);
    });
    fh.search();
  }

  function fetchHeroFallback(token) {
    var fhFb = algoliasearchHelper(client, CONFIG.ALGOLIA_INDEX, {
      attributesToRetrieve: ATTRS_WITH_ID, hitsPerPage: 3,
    });
    fhFb.addNumericRefinement('stars_count', '>=', 4);
    fhFb.on('result', function (e) {
      if (token !== _heroToken) return;
      heroHits.topRated  = e.results.hits;
      heroHits.fallback  = e.results.hits;
      heroHits._cuisines = [];
      heroHits._hasGeo   = false;
      renderHeroBanner();
    });
    fhFb.on('error', function () { if (token !== _heroToken) return; renderHeroBanner(); });
    fhFb.search();
  }

  function renderHeroBanner() {
    if (!heroBanner) return;
    if (!heroHits.topRated.length) { heroBanner.innerHTML = ''; return; }

    // On utilise le snapshot pris au moment du fetch — pas l'état courant des filtres
    var cuisines    = heroHits._cuisines  || [];
    var hasGeo      = heroHits._hasGeo    || false;
    var isFallback  = heroHits.fallback.length > 0;
    // En fallback, on ignore les filtres pour le titre
    var titleData   = buildHeroTitle(isFallback ? [] : cuisines, isFallback ? false : hasGeo);

    var cards = heroHits.topRated.map(function (hit) {
      return cardHTML(hit, 0, 'data-hero-id');
    }).join('');

    // Couleur fixe selon contexte :
    // terracotta = Top Rated défaut/fallback
    // bleu       = Near You (geo actif)
    // vert       = cuisine sélectionnée
    var bgColor = isFallback          ? '#C07A5A'
                : (hasGeo && !cuisines.length) ? '#5A7F9C'
                : cuisines.length     ? '#5E8C76'
                : hasGeo              ? '#5A7F9C'
                : '#C07A5A';

    heroBanner.innerHTML =
      '<div class="hero-strip">' +
        '<div class="hero-strip-bg" style="background-color:' + bgColor + '"></div>' +
        '<div class="hero-strip-inner">' +
          '<div class="hero-strip-header">' +
            '<span class="hero-strip-emoji">🏆</span>' +
            '<div>' +
              '<div class="hero-strip-title">' + titleData.title + '</div>' +
              '<div class="hero-strip-sub">' + titleData.sub + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="hero-cards">' + cards + '</div>' +
        '</div>' +
      '</div>';

    heroBanner.querySelectorAll('.restaurant-card').forEach(function (card) {
      card.addEventListener('click', function () {
        var hit = heroHits.topRated.find(function (h) { return h.objectID === card.dataset.id; });
        if (!hit) return;
        openModal(hit);
        trackInsights('clickedObjectIDs', {
          eventName: 'Top Restaurant Clicked',
          objectIDs: [hit.objectID],
        });
      });
    });
    renderSearchPanelCards();
  }

  // ── Algolia — résultat ──────────────────────────────────────────────────────
  let currentPage = 0, totalPages = 1, allHits = [], currentHits = [], fallbackHits = [];

  helper.on('result', function ({ results }) {
    _lastQueryID = results.queryID || null;
    document.getElementById('stat-time').textContent  = results.processingTimeMS + 'ms';
    document.getElementById('stat-count').textContent = results.nbHits.toLocaleString();

    const typoEl = document.getElementById('stat-typo');
    if (results.queryAfterRemoval && results.queryAfterRemoval !== results.query) {
      document.getElementById('stat-typo-text').textContent = 'Typo corrected: "' + results.queryAfterRemoval + '"';
      typoEl.classList.add('visible');
    } else {
      typoEl.classList.remove('visible');
    }

    if (results.page === 0) { allHits = results.hits; currentPage = 0; }
    else { allHits = allHits.concat(results.hits); }
    totalPages = results.nbPages;
    renderResults(allHits, results.page > 0);

    const loadMoreWrap = document.getElementById('load-more-wrap');
    const loadMoreBtn  = document.getElementById('load-more-btn');
    if (currentPage < totalPages - 1) {
      loadMoreWrap.style.display = 'block';
      loadMoreBtn.textContent = 'Show ' + Math.min(50, results.nbHits - allHits.length) + ' more restaurants';
    } else {
      loadMoreWrap.style.display = 'none';
    }

    var foodFacetValues = results.getFacetValues('food_type');
    if (foodFacetValues && foodFacetValues.length) {
      renderCuisinePills(foodFacetValues);
      renderSearchPanelChips(foodFacetValues);
    }

    updateHeroBanner();
    syncAndSearchMap();
  });

  function syncAndSearchMap() {
    const s = helper.state;
    mapHelper.setQuery(s.query || '');
    if (s.aroundLatLng) {
      mapHelper.setQueryParameter('aroundLatLng', s.aroundLatLng);
      mapHelper.setQueryParameter('aroundRadius', s.aroundRadius || 'all');
    } else {
      mapHelper.setQueryParameter('aroundLatLng', undefined);
      mapHelper.setQueryParameter('aroundRadius', undefined);
    }
    mapHelper.state = mapHelper.state.clearRefinements();
    ['food_type', 'payment_options', 'dining_style', 'price_range'].forEach(function (facet) {
      const vals = (s.disjunctiveFacetsRefinements && s.disjunctiveFacetsRefinements[facet]) || [];
      vals.forEach(function (v) { mapHelper.addDisjunctiveFacetRefinement(facet, v); });
    });
    const numRefs = s.numericRefinements || {};
    Object.keys(numRefs).forEach(function (attr) {
      Object.keys(numRefs[attr] || {}).forEach(function (op) {
        (numRefs[attr][op] || []).forEach(function (val) { mapHelper.addNumericRefinement(attr, op, val); });
      });
    });
    mapHelper.search();
    // En cache mode, refresh les pins immédiatement sans attendre mapHelper
    if (document.getElementById('map-overlay').classList.contains('open')) {
      renderMapPins();
    }
  }

  helper.on('error', function (err) {
    console.error('Algolia error:', err);
    document.getElementById('results').innerHTML = '<div class="empty-state"><p>Search error. Check your API credentials.</p></div>';
  });

  // ── Search panel ─────────────────────────────────────────────────────────────
  var _spHideTimer = null;
  var POPULAR_SEARCHES = ['Italian', 'Sushi', 'Steakhouse', 'French', 'Seafood'];

  function showSearchPanel() {
    var dd = document.getElementById('search-panel');
    if (window.innerWidth > 600) {
      var rect = document.getElementById('search-input').getBoundingClientRect();
      var w = Math.min(700, window.innerWidth - 24);
      dd.style.top   = (rect.bottom + 8) + 'px';
      dd.style.left  = Math.max(12, rect.left + rect.width / 2 - w / 2) + 'px';
      dd.style.width = w + 'px';
    } else {
      dd.style.top = '';
      dd.style.left = '';
      dd.style.width = '';
    }
    dd.classList.add('open');
  }

  function hideSearchPanel() {
    document.getElementById('search-panel').classList.remove('open');
  }

  // ── Autocomplete (query suggestions) ──────────────────────────────────────
  var _acTimer = null;
  var _acItems = [];
  var _acActive = -1;

  function showAutocomplete(queries) {
    _acItems = queries;
    _acActive = -1;
    var dd = document.getElementById('autocomplete-dropdown');
    dd.innerHTML = queries.map(function (q, i) {
      return '<li class="ac-item" role="option" aria-selected="false" data-ac-index="' + i + '">' + q + '</li>';
    }).join('');
    dd.querySelectorAll('.ac-item').forEach(function (li) {
      li.addEventListener('mousedown', function (e) {
        e.preventDefault();
        selectSuggestion(_acItems[parseInt(li.dataset.acIndex, 10)]);
      });
    });
    var rect = document.getElementById('search-input').getBoundingClientRect();
    dd.style.top   = (rect.bottom + 8) + 'px';
    dd.style.left  = rect.left + 'px';
    dd.style.width = rect.width + 'px';
    dd.classList.add('open');
  }

  function hideAutocomplete() {
    document.getElementById('autocomplete-dropdown').classList.remove('open');
    _acItems = [];
    _acActive = -1;
  }

  function updateAcActive() {
    document.querySelectorAll('#autocomplete-dropdown .ac-item').forEach(function (li, i) {
      li.setAttribute('aria-selected', i === _acActive ? 'true' : 'false');
    });
  }

  function selectSuggestion(query) {
    document.getElementById('search-input').value = query;
    hideAutocomplete();
    currentPage = 0; allHits = [];
    helper.setPage(0).setQuery(query).search();
  }

  function renderSearchPanelChips(facetValues) {
    var container = document.getElementById('sp-cuisine-chips');
    if (!container) return;
    var cuisines = facetValues.slice(0, 8);
    container.innerHTML = cuisines.map(function (entry) {
      var c = entry.name; var count = entry.count;
      var isActive = !!activeChips['food_type::' + c];
      return '<button class="sp-chip' + (isActive ? ' active' : '') + '" data-cuisine="' + c + '">' + (CUISINE_EMOJI[c] || '🍽️') + ' ' + c + ' (' + count + ')</button>';
    }).join('');
    container.querySelectorAll('.sp-chip').forEach(function (chip) {
      chip.addEventListener('mousedown', function (e) {
        e.preventDefault();
        var key = 'food_type::' + chip.dataset.cuisine;
        Object.keys(activeChips).forEach(function (k) {
          if (k.startsWith('food_type::')) delete activeChips[k];
        });
        activeChips[key] = true;
        applyAllChipFilters();
        syncChipDOM();
        updateChipLabels();
        helper.setPage(0).search();
        hideSearchPanel();
        trackInsights('clickedFilters', {
          eventName: 'Filter Applied',
          filters: ['food_type:' + chip.dataset.cuisine],
        });
      });
    });
  }

  function renderSearchPanelCards() {
    var container = document.getElementById('sp-cards');
    if (!container || !heroHits.topRated.length) return;
    container.innerHTML = heroHits.topRated.slice(0, 3).map(function (hit, i) {
      return cardHTML(hit, i, 'data-sp-index');
    }).join('');
    container.querySelectorAll('.restaurant-card').forEach(function (card) {
      card.addEventListener('mousedown', function (e) {
        e.preventDefault();
        var hit = heroHits.topRated[parseInt(card.dataset.spIndex, 10)];
        if (!hit) return;
        hideSearchPanel();
        openModal(hit);
        trackInsights('clickedObjectIDs', {
          eventName: 'Top Restaurant Clicked',
          objectIDs: [hit.objectID],
        });
      });
    });
  }

  function initSearchPanelQueries() {
    var list = document.getElementById('sp-queries');
    if (!list) return;
    list.innerHTML = POPULAR_SEARCHES.map(function (q) {
      return '<li class="sp-query-item" data-query="' + q + '">' +
        '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>' +
        q + '</li>';
    }).join('');
    list.querySelectorAll('.sp-query-item').forEach(function (item) {
      item.addEventListener('mousedown', function (e) {
        e.preventDefault();
        var q = item.dataset.query;
        document.getElementById('search-input').value = q;
        helper.setPage(0).setQuery(q).search();
        hideSearchPanel();
      });
    });
  }

  // ── Recherche as-you-type (debounce 200ms) ─────────────────────────────────
  var _searchTimer = null;
  document.getElementById('search-input').addEventListener('input', function (e) {
    var val = e.target.value;
    if (!val.trim()) {
      hideAutocomplete();
      showSearchPanel();
    } else {
      hideSearchPanel();
      clearTimeout(_acTimer);
      _acTimer = setTimeout(function () {
        suggestionsIndex.search(val, { hitsPerPage: 5 }).then(function (res) {
          var queries = res.hits.map(function (h) { return h.query; });
          if (queries.length) showAutocomplete(queries); else hideAutocomplete();
        });
      }, 200);
    }
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(function () {
      currentPage = 0; allHits = [];
      helper.setPage(0).setQuery(val).search();
    }, 200);
  });

  document.getElementById('search-input').addEventListener('focus', function () {
    if (!(this.value || '').trim()) showSearchPanel();
  });
  document.getElementById('search-input').addEventListener('blur', function () {
    clearTimeout(_spHideTimer);
    _spHideTimer = setTimeout(function () { hideSearchPanel(); hideAutocomplete(); }, 150);
  });
  document.getElementById('search-input').addEventListener('keydown', function (e) {
    if (_acItems.length) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        _acActive = Math.min(_acActive + 1, _acItems.length - 1);
        updateAcActive();
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        _acActive = Math.max(_acActive - 1, -1);
        updateAcActive();
        return;
      }
      if (e.key === 'Enter' && _acActive >= 0) {
        e.preventDefault();
        selectSuggestion(_acItems[_acActive]);
        return;
      }
    }
    if (e.key === 'Escape') { hideAutocomplete(); hideSearchPanel(); this.blur(); }
  });

  // ── Load more ───────────────────────────────────────────────────────────────
  document.getElementById('load-more-btn').addEventListener('click', function () {
    currentPage++;
    helper.setPage(currentPage).search();
  });

  // ── Init ────────────────────────────────────────────────────────────────────
  helper.search();
  initHeroBanner();
  initSearchPanelQueries();
  loadMapCache();

  // ── Cuisine image cache — local files from src/images/fallbacks/ ─────────────
  var cuisineImageCache = {};
  Object.keys(CUISINE_FALLBACKS).forEach(function(cuisine) {
    cuisineImageCache[cuisine === 'default' ? 'default' : cuisine] = CUISINE_FALLBACKS[cuisine];
  });

  function getCuisineImage(foodType) {
    return cuisineImageCache[foodType] || cuisineImageCache['default'];
  }

  // ── Modal ───────────────────────────────────────────────────────────────────
  const modalBackdrop = document.getElementById('modal-backdrop');
  var modalMapInstance = null, modalMapMarker = null;

  document.getElementById('results').addEventListener('click', function (e) {
    var card = e.target.closest('.restaurant-card');
    if (!card) return;
    var idx = parseInt(card.dataset.index, 10);
    if (!isNaN(idx) && currentHits[idx]) {
      var hit = currentHits[idx];
      openModal(hit);
      if (_lastQueryID) {
        trackInsights('clickedObjectIDsAfterSearch', {
          eventName: 'Restaurant Clicked',
          queryID:   _lastQueryID,
          objectIDs: [hit.objectID],
          positions: [idx + 1],
        });
      } else {
        trackInsights('clickedObjectIDs', {
          eventName: 'Restaurant Clicked',
          objectIDs: [hit.objectID],
        });
      }
    }
  });

  document.addEventListener('click', function (e) {
    var card = e.target.closest('#fallback-container .restaurant-card');
    if (!card) return;
    var idx = parseInt(card.dataset.fallbackIndex, 10);
    if (!isNaN(idx) && fallbackHits[idx]) openModal(fallbackHits[idx]);
  });

  function openModal(hit) {
    trackInsights('viewedObjectIDs', {
      eventName: 'Restaurant Viewed',
      objectIDs: [hit.objectID],
    });

    const imgEl   = document.getElementById('modal-image');
    const cuisine = (hit.food_type || '').replace(/'/g, "\\'");

    function setModalImg(src) {
      imgEl.innerHTML = '<img src="' + src + '" alt="' + hit.name + '" onerror="window._cuisineFallback(this,\'' + cuisine + '\')" style="width:100%;height:100%;object-fit:cover;">';
    }
    setModalImg((hit.image_url && hit.image_url.indexOf('opentable.com') === -1)
      ? hit.image_url : getCuisineImage(hit.food_type));

    document.getElementById('modal-cuisine').textContent = hit.food_type || '';
    document.getElementById('modal-name').textContent    = hit.name;
    document.getElementById('modal-stars').textContent   = starsHTML(hit.stars_count);
    document.getElementById('modal-rating').textContent  = (hit.stars_count || 0).toFixed(1);
    document.getElementById('modal-reviews').textContent = '(' + (hit.reviews_count || 0) + ' reviews)';
    document.getElementById('modal-price').textContent   = priceSymbol(hit.price_range);
    document.getElementById('modal-dining').textContent  = hit.dining_style || '—';

    const addr = [hit.address, hit.city, hit.state].filter(Boolean).join(', ');
    document.getElementById('modal-address').textContent = addr || '—';

    const phoneRow = document.getElementById('modal-phone-row');
    if (hit.phone_number) { document.getElementById('modal-phone').textContent = hit.phone_number; phoneRow.style.display = 'flex'; }
    else { phoneRow.style.display = 'none'; }

    document.getElementById('modal-payments').innerHTML = (hit.payment_options || []).map(function (p) { return '<span class="modal-tag cool">' + p + '</span>'; }).join('');
    document.getElementById('modal-reserve').href = hit.reserve_url || hit.mobile_reserve_url || '#';
    document.getElementById('modal-reserve').onclick = function () {
      if (_lastQueryID) {
        trackInsights('convertedObjectIDsAfterSearch', {
          eventName: 'Reservation Clicked',
          queryID:   _lastQueryID,
          objectIDs: [hit.objectID],
        });
      } else {
        // Browsed without searching first — fire a non-search conversion
        trackInsights('convertedObjectIDs', {
          eventName: 'Reservation Clicked',
          objectIDs: [hit.objectID],
        });
      }
    };
    document.getElementById('modal-directions').onclick = function () {
      if (hit._geoloc) window.open('https://www.google.com/maps/dir/?api=1&destination=' + hit._geoloc.lat + ',' + hit._geoloc.lng, '_blank');
    };

    const mapWrap = document.getElementById('modal-map-wrap');
    if (hit._geoloc && hit._geoloc.lat && hit._geoloc.lng) {
      mapWrap.style.display = 'block';
      document.getElementById('modal-map-label').textContent = '📍 ' + (hit.city || 'Location');
      requestAnimationFrame(function () {
        if (!modalMapInstance) {
          modalMapInstance = L.map('modal-map', { zoomControl: false, attributionControl: false, dragging: true, scrollWheelZoom: false });
          L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(modalMapInstance);
        }
        modalMapInstance.setView([hit._geoloc.lat, hit._geoloc.lng], 15);
        modalMapInstance.invalidateSize();
        if (modalMapMarker) modalMapInstance.removeLayer(modalMapMarker);
        const pinIcon = L.divIcon({ html: '<svg width="26" height="34" viewBox="0 0 28 36" fill="none"><path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.27 21.73 0 14 0z" fill="#C07A5A"/><circle cx="14" cy="14" r="5" fill="#FDF5EE"/></svg>', className: '', iconSize: [26, 34], iconAnchor: [13, 34] });
        modalMapMarker = L.marker([hit._geoloc.lat, hit._geoloc.lng], { icon: pinIcon }).addTo(modalMapInstance)
          .bindPopup('<strong>' + hit.name + '</strong><br>' + (addr || ''), { offset: [0, -30] }).openPopup();
      });
    } else {
      mapWrap.style.display = 'none';
    }

    modalBackdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() { modalBackdrop.classList.remove('open'); document.body.style.overflow = ''; }
  document.getElementById('modal-close').addEventListener('click', closeModal);
  modalBackdrop.addEventListener('click', function (e) { if (e.target === modalBackdrop) closeModal(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

  // ── Algolia Story Panel ─────────────────────────────────────────────────────
  var storyBtn   = document.getElementById('algolia-story-btn');
  var storyPanel = document.getElementById('algolia-story-panel');
  storyBtn.addEventListener('click', function () { storyPanel.classList.toggle('open'); });
  document.getElementById('story-close').addEventListener('click', function () { storyPanel.classList.remove('open'); });

  var _msHistory = [], MAX_SPARK = 8;

  function flashCard(card) { card.classList.remove('triggered'); void card.offsetWidth; card.classList.add('triggered'); }
  function speedClass(ms) { return ms < 10 ? 'fast' : ms < 30 ? 'medium' : 'slow'; }

  function updateSparkline(history) {
    var bars  = document.querySelectorAll('#sparkline .spark-bar');
    var maxMs = Math.max.apply(null, history.concat([20]));
    bars.forEach(function (bar, i) {
      var idx = i - (MAX_SPARK - history.length);
      if (idx < 0 || idx >= history.length) { bar.style.height = '3px'; bar.className = 'spark-bar empty'; }
      else { var pct = Math.max(8, Math.min(100, (history[idx] / maxMs) * 100)); bar.style.height = pct + '%'; bar.className = 'spark-bar ' + speedClass(history[idx]); }
    });
  }

  helper.on('result', function (e) {
    var results = e.results;
    var ms = results.processingTimeMS;
    _msHistory.push(ms); if (_msHistory.length > MAX_SPARK) _msHistory.shift();

    var cls = speedClass(ms);
    var speedBig = document.getElementById('story-ms');
    speedBig.textContent = ms; speedBig.className = 'speed-big ' + cls;
    var bar = document.getElementById('speed-bar');
    bar.style.width = Math.max(4, Math.min(100, (ms / 50) * 100)) + '%'; bar.className = 'speed-bar-fill ' + cls;
    updateSparkline(_msHistory);
    document.getElementById('story-speed-badge').textContent = ms + 'ms';
    document.getElementById('story-speed-badge').className = 'story-badge on-speed';
    var ctx = document.getElementById('story-speed-context');
    if (ms < 5) ctx.innerHTML = '🟢 Sub-5ms — instant.';
    else if (ms < 15) ctx.innerHTML = '🟢 <strong>' + ms + 'ms</strong> — ~20× faster than a typical DB query.';
    else if (ms < 30) ctx.innerHTML = '🟡 <strong>' + ms + 'ms</strong> — still faster than most backend search.';
    else ctx.innerHTML = '🔴 <strong>' + ms + 'ms</strong> — includes network latency.';
    var speedCard = document.getElementById('story-speed-card');
    speedCard.className = 'story-card active-speed'; flashCard(speedCard);

    // Typo card
    var typoCard = document.getElementById('story-typo-card');
    var typoBadge = document.getElementById('story-typo-badge');
    var demoRow = document.getElementById('typo-demo-row');
    var hint = document.getElementById('typo-hint');
    var query = results.query || '';
    var typoDetected = false, typoCorrectedWord = '', typoOriginalWord = '';

    if (query.trim().length > 2 && results.hits && results.hits.length > 0) {
      var queryWords = query.trim().toLowerCase().split(/\s+/);
      var hlName = results.hits[0]._highlightResult && results.hits[0]._highlightResult.name;
      var matchedWords = (hlName && hlName.matchedWords) ? hlName.matchedWords : [];
      queryWords.forEach(function (qw) {
        if (qw.length < 3) return;
        var exactMatch = matchedWords.some(function (mw) { return mw.toLowerCase() === qw; });
        if (!exactMatch && matchedWords.length > 0) {
          var candidate = matchedWords.find(function (mw) { return Math.abs(mw.length - qw.length) <= 2; }) || matchedWords[0];
          if (candidate && candidate.toLowerCase() !== qw) { typoDetected = true; typoOriginalWord = qw; typoCorrectedWord = candidate; }
        }
      });
    }

    if (typoDetected) {
      document.getElementById('typo-before').textContent = '"' + typoOriginalWord + '"';
      document.getElementById('typo-after').textContent  = '"' + typoCorrectedWord + '"';
      demoRow.classList.remove('show'); void demoRow.offsetWidth; demoRow.classList.add('show');
      hint.style.display = 'none'; typoBadge.textContent = 'CORRECTED'; typoBadge.className = 'story-badge on-typo';
      typoCard.className = 'story-card active-typo'; flashCard(typoCard);
    } else if (query.length > 0) {
      demoRow.classList.remove('show'); hint.style.display = 'block';
      typoBadge.textContent = query.length > 2 ? 'OK' : 'IDLE';
      typoBadge.className = query.length > 2 ? 'story-badge on-typo' : 'story-badge off';
      typoCard.className = 'story-card';
    } else {
      demoRow.classList.remove('show'); hint.style.display = 'block';
      typoBadge.textContent = 'IDLE'; typoBadge.className = 'story-badge off'; typoCard.className = 'story-card';
    }

    // Geo card
    if (window._userLat != null && results.hits && results.hits.length) {
      var nearest = results.hits.filter(function (h) { return h._rankingInfo && h._rankingInfo.geoDistance != null; }).slice(0, 3);
      if (nearest.length) {
        var geoNearest = document.getElementById('geo-nearest');
        geoNearest.style.display = 'block';
        document.getElementById('geo-hint').style.display = 'none';
        geoNearest.innerHTML = nearest.map(function (h, i) {
          var dist = h._rankingInfo.geoDistance;
          var label = dist < 1000 ? dist + 'm' : (dist / 1000).toFixed(1) + 'km';
          return '<div class="geo-restaurant-row"><span class="geo-rank">' + (i + 1) + '</span><span class="geo-name">' + (h.name || '—') + '</span><span class="geo-dist">' + label + '</span></div>';
        }).join('');
      }
    }
  });

  var _geoObserver = new MutationObserver(function () {
    var geoText = document.getElementById('stat-geo').textContent;
    var geoBadge = document.getElementById('story-geo-badge');
    var geoCard  = document.getElementById('story-geo-card');
    if (geoText && geoText !== '—' && geoText !== 'off' && geoText !== 'unavailable' && geoText !== 'denied') {
      geoBadge.textContent = 'ACTIVE'; geoBadge.className = 'story-badge on-geo';
      geoCard.className = 'story-card active-geo'; flashCard(geoCard);
    } else if (geoText === 'off' || geoText === 'unavailable' || geoText === 'denied') {
      geoBadge.textContent = 'OFF'; geoBadge.className = 'story-badge off';
    }
  });
  _geoObserver.observe(document.getElementById('stat-geo'), { childList: true, characterData: true, subtree: true });

  // ── Fake geo (dev tool dans Algolia Story) ─────────────────────────────────
  function applyFakeGeo(lat, lng, label) {
    window._userLat = lat;
    window._userLng = lng;
    // Affiche dans la stats bar (bandeau vert) — le bouton "Location" reste intact
    document.getElementById('stat-geo').textContent = label;
    // Badge geo-card
    var geoBadge = document.getElementById('story-geo-badge');
    geoBadge.textContent = 'FAKE'; geoBadge.className = 'story-badge on-geo';
    // Indicateur actif dans le widget
    var activeEl = document.getElementById('fake-geo-active');
    activeEl.textContent = '📍 ' + lat.toFixed(4) + ', ' + lng.toFixed(4);
    activeEl.style.display = 'block';
    // Refresh hero banner pour le bandeau Near you
    updateHeroBanner();
  }

  // Fake geo : saisie directe lat,lng (ex: 48.8566,2.3522) ou nom de ville pour le label
  function parseFakeGeoInput(raw) {
    var parts = raw.split(',').map(function (s) { return s.trim(); });
    if (parts.length === 2) {
      var lat = parseFloat(parts[0]);
      var lng = parseFloat(parts[1]);
      if (!isNaN(lat) && !isNaN(lng)) return { lat: lat, lng: lng, label: raw };
    }
    return null;
  }

  function submitFakeGeo() {
    var raw = document.getElementById('fake-geo-input').value.trim();
    if (!raw) return;
    var parsed = parseFakeGeoInput(raw);
    if (parsed) {
      applyFakeGeo(parsed.lat, parsed.lng, parsed.label);
    } else {
      // Texte libre → on l'utilise comme label avec coords nulles (affichage seul)
      document.getElementById('fake-geo-active').textContent = '⚠️ Format: lat,lng (ex: 48.8566,2.3522)';
      document.getElementById('fake-geo-active').style.display = 'block';
    }
  }

  document.getElementById('fake-geo-btn').addEventListener('click', submitFakeGeo);
  document.getElementById('fake-geo-input').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') submitFakeGeo();
  });

  // ── Auto-declenchement geoloc au chargement ────────────────────────────────
  // Si la permission est deja accordee (session precedente), on demarre silencieusement.
  // Sinon 'prompt' ou 'denied' -> l'utilisateur clique "Near me".
  if (navigator.geolocation && navigator.permissions) {
    navigator.permissions.query({ name: 'geolocation' }).then(function (result) {
      if (result.state === 'granted') {
        initGeoDevice();
      }
    });
  }

}); // DOMContentLoaded