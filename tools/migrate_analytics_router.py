"""Apply analytics router migration.

This script updates main.py by:
1. importing `routers.analytics`;
2. including `analytics.router` after `uploads.router`;
3. removing legacy analytics helpers and `POST /api/track` from main.py.

It is intentionally narrow and idempotent.
"""

from __future__ import annotations

import re
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
MAIN_FILE = PROJECT_ROOT / "main.py"

IMPORT_OLD = "from routers import health, public_pages, delivery, uploads\n"
IMPORT_NEW = "from routers import health, public_pages, delivery, uploads, analytics\n"
UPLOADS_INCLUDE = "app.include_router(uploads.router)\n"
ANALYTICS_INCLUDE = "app.include_router(analytics.router)\n"

ANALYTICS_HELPERS_RE = re.compile(
    r'''\nasync def send_to_facebook_capi\(event_name: str, data: dict, user_data: dict\):.*?'''
    r'''async def track_analytics_event\(event_name: str, data: dict, user_data: dict\):\n'''
    r'''    await send_to_facebook_capi\(event_name, data, user_data\)\n'''
    r'''    await send_to_google_analytics\(event_name, data, user_data\)\n''',
    re.DOTALL,
)

TRACK_ENDPOINT_RE = re.compile(
    r'''\nclass AnalyticsEventReq\(BaseModel\):\n'''
    r'''    event_name: str\n'''
    r'''    properties: dict = \{\}\n'''
    r'''    user_data: dict = \{\}\n'''
    r'''\n@app\.post\("/api/track"\)\n'''
    r'''async def track_event_endpoint\(evt: AnalyticsEventReq, background_tasks: BackgroundTasks\):\n'''
    r'''    """.*?"""\n'''
    r'''    background_tasks\.add_task\(track_analytics_event, evt\.event_name, evt\.properties, evt\.user_data\)\n'''
    r'''    return \{"status": "ok"\}\n''',
    re.DOTALL,
)


def main() -> int:
    content = MAIN_FILE.read_text(encoding="utf-8")
    changed = False

    if IMPORT_NEW not in content:
        if IMPORT_OLD not in content:
            raise RuntimeError("Could not find uploads router import in main.py")
        content = content.replace(IMPORT_OLD, IMPORT_NEW, 1)
        changed = True

    if ANALYTICS_INCLUDE not in content:
        if UPLOADS_INCLUDE not in content:
            raise RuntimeError("Could not find uploads router include in main.py")
        content = content.replace(UPLOADS_INCLUDE, UPLOADS_INCLUDE + ANALYTICS_INCLUDE, 1)
        changed = True

    content, helpers_count = ANALYTICS_HELPERS_RE.subn("\n", content, count=1)
    changed = changed or helpers_count > 0

    content, endpoint_count = TRACK_ENDPOINT_RE.subn("\n", content, count=1)
    changed = changed or endpoint_count > 0

    if not changed:
        print("No changes needed. Analytics router migration is already applied.")
        return 0

    MAIN_FILE.write_text(content, encoding="utf-8")
    print("Updated main.py: analytics router connected and legacy analytics endpoint removed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
