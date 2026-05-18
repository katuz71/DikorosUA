#!/usr/bin/env bash
set -euo pipefail

python tools/migrate_uploads_router.py
python tools/check_duplicate_routes.py

echo "Image/upload router migration applied and duplicate route check passed."
