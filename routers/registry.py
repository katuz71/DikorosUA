"""Central router registration.

Routers are added here as the legacy main.py monolith is split. Keeping router
registration in one place prevents main.py from becoming a long list of imports
and include_router calls.
"""

from __future__ import annotations

from fastapi import FastAPI

from routers import analytics, delivery, health, public_pages, uploads


PREPARED_ROUTERS = (
    health.router,
    public_pages.router,
    delivery.router,
    uploads.router,
    analytics.router,
)


def include_prepared_routers(app: FastAPI) -> None:
    """Include routers that have been extracted from the legacy monolith."""
    for router in PREPARED_ROUTERS:
        app.include_router(router)
