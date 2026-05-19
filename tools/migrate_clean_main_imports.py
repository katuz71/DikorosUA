from pathlib import Path

main_path = Path("main.py")
main = main_path.read_text(encoding="utf-8")

start = 0
end_marker = "Base = declarative_base()"
end = main.find(end_marker)

if end == -1:
    raise SystemExit("Base marker not found")

end = end + len(end_marker)

new_import_block = '''import logging
import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy import Boolean, Column, Float, Integer, String, Text
from sqlalchemy.ext.declarative import declarative_base

from db import get_db_connection
from routers import (
    admin_page,
    admin_tools,
    analytics,
    auth,
    banners,
    categories,
    chat,
    delivery,
    health,
    orders,
    posts,
    products,
    promo_codes,
    public_pages,
    reviews,
    sync,
    uploads,
    users,
)
from services.images import UPLOADS_DIR

load_dotenv()

Base = declarative_base()'''

new_main = new_import_block + main[end:]
main_path.write_text(new_main, encoding="utf-8")

print("OK: cleaned main.py imports")
