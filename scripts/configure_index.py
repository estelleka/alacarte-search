#!/usr/bin/env python3
"""
Configure the Algolia index settings for the alacarte restaurant search demo.

Run this script once before importing data to ensure the index is correctly
configured for the search experience (searchable attributes, ranking, facets).

Usage:
    export ALGOLIA_APP_ID=<your_app_id>
    export ALGOLIA_ADMIN_KEY=<your_admin_key>
    export ALGOLIA_INDEX=restaurants               # optional
    python scripts/configure_index.py
"""

import os
import sys
from algoliasearch.search.client import SearchClientSync

# ── Config ────────────────────────────────────────────────────────────────────
APP_ID     = os.environ.get("ALGOLIA_APP_ID",   "13QP82NDZ9")
API_KEY    = os.environ.get("ALGOLIA_ADMIN_KEY")
INDEX_NAME = os.environ.get("ALGOLIA_INDEX",    "restaurants")

if not API_KEY:
    sys.exit("Error: ALGOLIA_ADMIN_KEY environment variable is not set.")

client = SearchClientSync(APP_ID, API_KEY)

# ── Index settings ────────────────────────────────────────────────────────────
settings = {
    # Attributes searched in order of importance.
    # Unordered within a tier means position in the text doesn't affect ranking.
    "searchableAttributes": [
        "name",
        "unordered(food_type)",
        "unordered(neighborhood, city)",
        "unordered(dining_style)",
    ],

    # Secondary ranking applied after Algolia's relevance formula.
    # Sorts by best-rated restaurants, then most reviewed.
    "customRanking": [
        "desc(stars_count)",
        "desc(reviews_count)",
    ],

    # Attributes available for filtering and faceted navigation.
    # searchable() enables prefix search within the facet values.
    "attributesForFaceting": [
        "searchable(food_type)",
        "dining_style",
        "price_range",
        "payment_options",
        "stars_count",      # used for numeric filtering (>= 4 stars)
    ],

    # Attributes returned with each hit. Limiting this improves response time.
    "attributesToRetrieve": [
        "name",
        "food_type",
        "stars_count",
        "reviews_count",
        "price_range",
        "payment_options",
        "neighborhood",
        "image_url",
        "_geoloc",
        "address",
        "city",
        "state",
        "phone_number",
        "reserve_url",
        "mobile_reserve_url",
        "dining_style",
    ],

    # Highlight only the name field to show matching terms in the UI.
    "attributesToHighlight": ["name"],

    # Typo tolerance: allow 1 typo for words of 5+ characters.
    # Defaults are sensible; keeping explicit for documentation purposes.
    "minWordSizefor1Typo": 4,
    "minWordSizefor2Typos": 8,

    # Geo-search: _geoloc is the built-in field Algolia uses for coordinates.
    # No extra configuration needed; the field name is the convention.
}

print(f"Applying settings to index '{INDEX_NAME}' …")
client.set_settings(INDEX_NAME, settings)
print("Done ✓")
print()
print("Settings applied:")
for key, val in settings.items():
    print(f"  {key}: {val}")
print()
print(f"View in dashboard: https://dashboard.algolia.com/apps/{APP_ID}/explorer/configuration/{INDEX_NAME}")
