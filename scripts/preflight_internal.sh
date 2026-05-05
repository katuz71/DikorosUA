#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "== Frontend: install + lint + typecheck =="
npm install
npm run lint
npx tsc --noEmit

echo "== Backend: compile + smoke tests (docker) =="
docker compose exec -T app python3 -m py_compile main.py

docker compose exec -T app python3 scripts/test_order_variant_info.py

docker compose exec -T app python3 scripts/test_apix_payload_smoke.py

docker compose exec -T app python3 scripts/test_chat_sales_smoke.py

docker compose exec -T app python3 scripts/test_chat_budget_form_smoke.py

echo "== OK: preflight passed =="