import logging
import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy import Boolean, Column, Float, Integer, String, Text
from sqlalchemy.ext.declarative import declarative_base

from services.db_schema import fix_db_schema, init_db
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

Base = declarative_base()



class LegacyUser(Base):
    """Legacy: пользователь по телефону (таблица users)."""
    __tablename__ = "users"
    phone = Column(Text, primary_key=True)
    bonus_balance = Column(Integer, default=0)
    total_spent = Column(Float, default=0)
    cashback_percent = Column(Integer, default=0)
    referrer = Column(Text, nullable=True)
    created_at = Column(Text, nullable=True)
    name = Column(Text, nullable=True)
    city = Column(Text, nullable=True)
    warehouse = Column(Text, nullable=True)
    user_ukrposhta = Column(Text, nullable=True)
    email = Column(Text, nullable=True)
    contact_preference = Column(Text, default="call")
    google_id = Column(String(255), unique=True, index=True, nullable=True)
    facebook_id = Column(String(255), unique=True, index=True, nullable=True)
    telegram_id = Column(String(64), unique=True, index=True, nullable=True)
    is_bonus_claimed = Column(Boolean, default=False)
    push_token = Column(String, nullable=True)


class User(Base):
    """Пользователь приложения: id, telegram_id, phone, name, bonus_balance (таблица app_users)."""
    __tablename__ = "app_users"
    id = Column(Integer, primary_key=True, autoincrement=True)
    telegram_id = Column(String(64), unique=True, nullable=True, index=True)
    phone = Column(String(50), nullable=True, index=True)
    name = Column(String(255), nullable=False, default="")
    bonus_balance = Column(Float, default=150.0)

# --- НАСТРОЙКИ ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

# --- ПАПКИ ---
os.makedirs("uploads", exist_ok=True)

# --- APP ---
app = FastAPI()
app.include_router(health.router)
app.include_router(public_pages.router)
app.include_router(delivery.router)
app.include_router(uploads.router)
app.include_router(analytics.router)
app.include_router(categories.router)
app.include_router(banners.router)
app.include_router(reviews.router)
app.include_router(promo_codes.router)
app.include_router(chat.router)
app.include_router(posts.router)
app.include_router(orders.router)
app.include_router(products.router)
app.include_router(users.router)
app.include_router(auth.router)
app.include_router(admin_tools.router)
app.include_router(sync.router)
app.include_router(admin_page.router)
templates = Jinja2Templates(directory="templates")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)










app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

# --- INITIALIZATION ---
# --- SYNC CONFIG ---
@app.on_event("startup")
def startup_event():
    fix_db_schema()
    print("✅ Server started successfully")

# --- ONEBOX ---


# --- API ENDPOINTS ---
