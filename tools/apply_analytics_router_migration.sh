#!/usr/bin/env bash
set -euo pipefail

python tools/migrate_analytics_router.py
python tools/check_duplicate_routes.py

echo "Analytics router migration applied and duplicate route check passed."
