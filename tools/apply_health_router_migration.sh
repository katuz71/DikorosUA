#!/usr/bin/env bash
set -euo pipefail

python tools/migrate_health_router.py
python tools/check_duplicate_routes.py

echo "Health router migration applied and duplicate route check passed."
