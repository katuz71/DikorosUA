#!/usr/bin/env bash
set -euo pipefail

python tools/migrate_public_pages_router.py
python tools/check_duplicate_routes.py

echo "Public pages router migration applied and duplicate route check passed."
