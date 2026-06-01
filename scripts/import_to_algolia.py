#!/usr/bin/env python3
"""
Merge restaurants_list.json + restaurants_info.csv and push to Algolia.

This script is the data pipeline for the alacarte demo:
  1. restaurants_list.json — base records (name, address, geo, image, payment)
  2. restaurants_info.csv  — enrichment (food_type, stars, reviews, price, dining style)

The two datasets share a common `objectID` key and are joined on it.

Usage:
    pip install algoliasearch pandas
    export ALGOLIA_APP_ID=<your_app_id>
    export ALGOLIA_ADMIN_KEY=<your_admin_key>      # never commit this
    export ALGOLIA_INDEX=restaurants               # optional, defaults to 'restaurants'

    python scripts/import_to_algolia.py            # full import
    python scripts/import_to_algolia.py --dry-run  # preview without pushing
"""

import json
import os
import sys
import pandas as pd
from pathlib import Path
from algoliasearch.search.client import SearchClientSync

# ── Config ────────────────────────────────────────────────────────────────────
# Keys come from environment variables — never hardcode admin credentials.
APP_ID     = os.environ.get("ALGOLIA_APP_ID",   "13QP82NDZ9")
API_KEY    = os.environ.get("ALGOLIA_ADMIN_KEY")           # required
INDEX_NAME = os.environ.get("ALGOLIA_INDEX",    "restaurants")

if not API_KEY:
    sys.exit("Error: ALGOLIA_ADMIN_KEY environment variable is not set.\n"
             "Run: export ALGOLIA_ADMIN_KEY=<your_admin_key>")

DRY_RUN = "--dry-run" in sys.argv

# Paths are resolved relative to this script's location so the script can be
# run from any working directory.
SCRIPTS_DIR = Path(__file__).parent
DATA_DIR    = SCRIPTS_DIR.parent / "data"
JSON_FILE   = DATA_DIR / "restaurants_list.json"
CSV_FILE    = DATA_DIR / "restaurants_info.csv"

# ── Payment option normalisation ──────────────────────────────────────────────
# The dataset contains legacy card names; we normalise to 4 canonical values.
PAYMENT_MAP = {
    "AMEX":          "AMEX",
    "Visa":          "Visa",
    "MasterCard":    "MasterCard",
    "Discover":      "Discover",
    "Diners Club":   "Discover",   # legacy alias
    "Carte Blanche": "Discover",   # legacy alias
}

# ── Load ──────────────────────────────────────────────────────────────────────
print(f"Loading {JSON_FILE.name} …")
with open(JSON_FILE, encoding="utf-8") as f:
    restaurants = json.load(f)

print(f"Loading {CSV_FILE.name} …")
csv = pd.read_csv(CSV_FILE, sep=";")
csv["objectID"] = csv["objectID"].astype(str)
# Index by objectID for O(1) lookup during the merge loop.
csv_index = csv.set_index("objectID").to_dict(orient="index")

# ── Merge ─────────────────────────────────────────────────────────────────────
print("Merging datasets …")
merged = []
for r in restaurants:
    oid  = str(r["objectID"])
    info = csv_index.get(oid, {})

    # Enrich base record with CSV fields (food_type, stars, reviews, etc.)
    r["food_type"]     = info.get("food_type",     "")
    r["stars_count"]   = info.get("stars_count",   0)
    r["reviews_count"] = info.get("reviews_count", 0)
    r["neighborhood"]  = info.get("neighborhood",  "")
    r["phone_number"]  = info.get("phone_number",  "")
    r["price_range"]   = info.get("price_range",   "")
    r["dining_style"]  = info.get("dining_style",  "")

    # Normalise payment options and deduplicate
    raw = r.get("payment_options", [])
    r["payment_options"] = list({PAYMENT_MAP[p] for p in raw if p in PAYMENT_MAP})

    merged.append(r)

print(f"  {len(merged)} records ready")

if DRY_RUN:
    print("\n[dry-run] No data pushed. Sample record:")
    print(json.dumps(merged[0], indent=2, ensure_ascii=False))
    sys.exit(0)

# ── Push to Algolia ───────────────────────────────────────────────────────────
print(f"Pushing to index '{INDEX_NAME}' …")
client = SearchClientSync(APP_ID, API_KEY)

BATCH_SIZE = 1000
for i in range(0, len(merged), BATCH_SIZE):
    batch = merged[i : i + BATCH_SIZE]
    client.save_objects(INDEX_NAME, batch)
    print(f"  Batch {i // BATCH_SIZE + 1} pushed ({len(batch)} records)")

print(f"\nDone ✓  {len(merged)} restaurants imported into '{INDEX_NAME}'")
print(f"View your index: https://dashboard.algolia.com/apps/{APP_ID}/explorer/browse/{INDEX_NAME}")
