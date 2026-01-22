from fastapi import FastAPI, HTTPException, Request, UploadFile, File, Form
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict
from typing import List, Optional, Union, Any
import sqlite3
import json
import os
import httpx
from datetime import datetime
import requests
import uuid
from openai import OpenAI

# SQLAdmin
from sqladmin import Admin, ModelView
from sqlalchemy import create_engine, Column, Integer, String, Float, Text, DateTime
from sqlalchemy.orm import declarative_base
from dotenv import load_dotenv
import logging
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

# --- SETTINGS ---
REGISTRATION_BONUS = 150
REFERRAL_BONUS = 50
INVITER_BONUS = 50

# 🔥 НАСТРОЙКА УРОВНЕЙ ЛОЯЛЬНОСТИ
CASHBACK_TIERS = [
    {"max": 1999,    "percent": 0},
    {"max": 4999,    "percent": 5},
    {"max": 9999,    "percent": 10},
    {"max": 24999,   "percent": 15},
    {"max": 9999999, "percent": 20},
]

# Умная функция расчета следующего уровня
def get_loyalty_status(total_spent: float):
    current_percent = 0
    next_threshold = 2000
    next_percent = 5
    
    # Определяем текущий уровень
    for tier in CASHBACK_TIERS:
        if total_spent <= tier["max"]:
            current_percent = tier["percent"]
            break # Нашли текущий
        current_percent = tier["percent"] # Если больше всех, то берем максимальный

    # Определяем следующий уровень
    # (Ищем первый порог, который больше текущей суммы)
    for tier in CASHBACK_TIERS:
        if tier["max"] > total_spent:
            # Нашли следующий уровень!
            # Но нам нужен percent СЛЕДУЮЩЕГО уровня, а не этого предела
            # Логика: если я потратил 2250 (это уровень 5% до 4999), 
            # то следующая цель 5000, и там дадут 10%
            
            # Простой перебор для нахождения цели
            if total_spent < 2000:
                return 0, 2000, 5
            elif total_spent < 5000:
                return 5, 5000, 10
            elif total_spent < 10000:
                return 10, 10000, 15
            elif total_spent < 25000:
                return 15, 25000, 20
            else:
                return 20, None, None # Максимальный уровень

    return 20, None, None

Base = declarative_base()

# --- MODELS ---
class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    price = Column(Integer, nullable=False)
    discount = Column(Integer, default=0)
    image = Column(Text)
    images = Column(Text)
    description = Column(Text)
    weight = Column(Text)
    ingredients = Column(Text)
    category = Column(Text)
    composition = Column(Text)
    usage = Column(Text)
    pack_sizes = Column(Text)
    old_price = Column(Float)
    unit = Column(String, default="шт")
    variants = Column(Text)
    option_names = Column(Text)
    delivery_info = Column(Text)
    payment_info = Column(Text)
    return_info = Column(Text)
    contacts = Column(Text)

class Category(Base):
    __tablename__ = "categories"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)

class User(Base):
    __tablename__ = "users"
    phone = Column(String, primary_key=True, index=True)
    bonus_balance = Column(Integer, default=0)
    total_spent = Column(Float, default=0.0)
    referrer = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True, index=True)
    user_email = Column(Text)
    name = Column(Text)
    phone = Column(Text)
    city = Column(Text)
    cityRef = Column(Text)
    warehouse = Column(Text)
    warehouseRef = Column(Text)
    totalPrice = Column(Float)
    date = Column(Text)
    payment_method = Column(Text, default="cash")
    invoice_id = Column(Text)
    status = Column(Text, default="Pending")
    bonus_used = Column(Integer, default=0)

class Banner(Base):
    __tablename__ = "banners"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(Text)
    image_url = Column(Text)
    link_url = Column(Text)
    is_active = Column(Integer, default=1)
    created_at = Column(Text)

# --- PYDANTIC ---
class DeleteBatchRequest(BaseModel):
    ids: List[int]

class ProductResponse(BaseModel):
    id: int
    name: str
    price: int
    discount: int = 0
    image: Optional[str] = None
    images: Optional[str] = None
    description: Optional[str] = None
    weight: Optional[str] = None
    ingredients: Optional[str] = None
    category: Optional[str] = None
    composition: Optional[str] = None
    usage: Optional[str] = None
    pack_sizes: Optional[Any] = None
    old_price: Optional[float] = None
    unit: Optional[str] = "шт"
    variants: Optional[Any] = None
    option_names: Optional[str] = None
    delivery_info: Optional[str] = None
    payment_info: Optional[str] = None
    return_info: Optional[str] = None
    contacts: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class UserResponse(BaseModel):
    phone: str
    bonus_balance: int
    total_spent: float
    cashback_percent: int
    next_level_threshold: Optional[int] = None # 🔥 НОВОЕ ПОЛЕ
    next_level_percent: Optional[int] = None   # 🔥 НОВОЕ ПОЛЕ

class UserUpdate(BaseModel):
    bonus_balance: int
    total_spent: float 

class ProductCreate(BaseModel):
    name: str
    price: int
    discount: int = 0
    description: Optional[str] = ""
    category: Optional[str] = None
    image: Optional[str] = ""
    images: Optional[str] = None
    composition: Optional[str] = None
    usage: Optional[str] = None
    weight: Optional[str] = None
    pack_sizes: Optional[Union[str, List[str]]] = None
    old_price: Optional[float] = None
    unit: Optional[str] = "шт"
    variants: Optional[Any] = None
    option_names: Optional[str] = None
    delivery_info: Optional[str] = None
    payment_info: Optional[str] = None
    return_info: Optional[str] = None
    contacts: Optional[str] = None

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    price: Optional[int] = None
    discount: Optional[int] = None
    description: Optional[str] = None
    category: Optional[str] = None
    image: Optional[str] = None
    images: Optional[str] = None
    composition: Optional[str] = None
    usage: Optional[str] = None
    weight: Optional[str] = None
    pack_sizes: Optional[Union[str, List[str]]] = None
    old_price: Optional[float] = None
    unit: Optional[str] = None
    variants: Optional[Any] = None
    option_names: Optional[str] = None
    delivery_info: Optional[str] = None
    payment_info: Optional[str] = None
    return_info: Optional[str] = None
    contacts: Optional[str] = None

class CategoryCreate(BaseModel):
    name: str
class CategoryUpdate(BaseModel):
    name: str
class BannerCreate(BaseModel):
    image_url: str
    title: Optional[str] = None
    link_url: Optional[str] = None
    is_active: int = 1

class OrderItem(BaseModel):
    id: int
    name: str
    price: int
    quantity: int
    packSize: Optional[Any] = None
    unit: Optional[str] = None
    variant_info: Optional[str] = None

class OrderRequest(BaseModel):
    name: str
    user_phone: Optional[str] = None
    phone: str
    city: str
    cityRef: str
    warehouse: str
    warehouseRef: str
    items: List[OrderItem]
    totalPrice: int
    payment_method: str = "card"
    bonus_used: int = 0
    use_bonuses: bool = False

class ChatRequest(BaseModel):
    messages: List[dict]

# --- ADMIN ---
class ProductAdmin(ModelView, model=Product): column_list = [Product.id, Product.name, Product.price]
class CategoryAdmin(ModelView, model=Category): column_list = [Category.id, Category.name]
class OrderAdmin(ModelView, model=Order): column_list = [Order.id, Order.totalPrice, Order.status]
class UserAdmin(ModelView, model=User): column_list = [User.phone, User.bonus_balance]
class BannerAdmin(ModelView, model=Banner): column_list = [Banner.id, Banner.image_url]

app = FastAPI()
engine = create_engine("sqlite:///shop.db", echo=False)
admin = Admin(app, engine, base_url="/db-admin") 
admin.add_view(ProductAdmin)
admin.add_view(CategoryAdmin)
admin.add_view(OrderAdmin)
admin.add_view(UserAdmin)
admin.add_view(BannerAdmin)

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

def get_db_connection():
    conn = sqlite3.connect('shop.db')
    conn.row_factory = sqlite3.Row
    return conn

@app.get("/admin", response_class=HTMLResponse)
async def read_admin():
    if os.path.exists('admin.html'): return FileResponse('admin.html')
    return "<h1>Error: admin.html not found!</h1>"

# --- API ---
@app.get("/health")
def health_check(): return {"status": "ok"}

@app.get("/api/orders")
async def get_orders():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM orders ORDER BY id DESC")
    res = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return res

@app.put("/orders/{order_id}/status")
async def update_order_status(order_id: int, request: Request):
    try:
        data = await request.json()
        new_status = data.get('new_status') or data.get('status')
        if not new_status: raise HTTPException(status_code=400, detail="Status required")
        
        conn = sqlite3.connect('shop.db')
        cursor = conn.cursor()
        cursor.execute("SELECT id, status, totalPrice, user_email, phone, bonus_used FROM orders WHERE id = ?", (order_id,))
        order = cursor.fetchone()
        
        if not order:
            conn.close()
            raise HTTPException(status_code=404, detail="Order not found")
            
        old_status = order[1]
        total_price = order[2] or 0
        account_phone = order[3] if order[3] else order[4] 
        
        target_statuses = ['Completed', 'Виконано', 'Done', 'Delivered']
        
        if new_status in target_statuses and old_status not in target_statuses:
            cursor.execute("SELECT bonus_balance, total_spent, referrer FROM users WHERE phone = ?", (account_phone,))
            user_data = cursor.fetchone()
            if user_data:
                current_total_spent = user_data[1] or 0
                referrer_phone = user_data[2]
                
                # Обновляем потраченное
                new_total_spent = current_total_spent + total_price
                
                # Считаем процент на основе ОБНОВЛЕННОЙ суммы
                current_percent, _, _ = get_loyalty_status(new_total_spent)
                cashback_amount = int(total_price * (current_percent / 100))
                
                cursor.execute("UPDATE users SET bonus_balance = bonus_balance + ?, total_spent = ? WHERE phone = ?", (cashback_amount, new_total_spent, account_phone))
                if current_total_spent == 0 and referrer_phone:
                    cursor.execute("SELECT phone FROM users WHERE phone = ?", (referrer_phone,))
                    if cursor.fetchone():
                        cursor.execute("UPDATE users SET bonus_balance = bonus_balance + ? WHERE phone = ?", (INVITER_BONUS, referrer_phone))

        cursor.execute("UPDATE orders SET status = ? WHERE id = ?", (new_status, order_id))
        conn.commit()
        conn.close()
        return {"message": "Status updated", "new_status": new_status}
    except Exception as e:
        logger.error(f"Error updating status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/orders/{order_id}")
async def delete_order(order_id: int):
    conn = get_db_connection()
    conn.execute("DELETE FROM orders WHERE id = ?", (order_id,))
    conn.commit()
    conn.close()
    return {"message": "Deleted"}

@app.post("/orders/delete-batch")
async def delete_orders_batch(request: DeleteBatchRequest):
    if not request.ids: return {"count": 0}
    conn = get_db_connection()
    ph = ','.join('?' * len(request.ids))
    conn.execute(f"DELETE FROM orders WHERE id IN ({ph})", request.ids)
    conn.commit()
    conn.close()
    return {"message": "Deleted batch", "deleted_count": len(request.ids)}

@app.get("/api/users")
async def get_all_users():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users ORDER BY created_at DESC")
    res = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return res

@app.put("/api/users/{phone}")
async def update_user_bonus(phone: str, data: UserUpdate):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET bonus_balance = ?, total_spent = ? WHERE phone = ?", (data.bonus_balance, data.total_spent, phone))
    conn.commit()
    conn.close()
    return {"message": "User updated"}

@app.get("/user/{phone}", response_model=UserResponse)
async def get_user_profile(phone: str, referrer: Optional[str] = None):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT phone, bonus_balance, total_spent FROM users WHERE phone = ?", (phone,))
    user = cursor.fetchone()
    if not user:
        initial_balance = REGISTRATION_BONUS
        if referrer and referrer != phone: initial_balance += REFERRAL_BONUS
        else: referrer = None 
        cursor.execute("INSERT OR IGNORE INTO users (phone, bonus_balance, total_spent, referrer) VALUES (?, ?, 0, ?)", (phone, initial_balance, referrer))
        conn.commit()
        user_data = {"phone": phone, "bonus_balance": initial_balance, "total_spent": 0.0}
    else:
        user_data = {"phone": user[0], "bonus_balance": user[1], "total_spent": user[2] or 0.0}
    
    conn.close()
    
    # 🔥 РАССЧИТЫВАЕМ ЛОЯЛЬНОСТЬ ДЕТАЛЬНО
    cur_pct, next_thresh, next_pct = get_loyalty_status(user_data["total_spent"])
    
    user_data["cashback_percent"] = cur_pct
    user_data["next_level_threshold"] = next_thresh
    user_data["next_level_percent"] = next_pct
    
    return user_data

@app.get("/orders/user/{phone}")
async def get_user_orders(phone: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM orders WHERE user_email = ? OR phone = ? ORDER BY id DESC", (phone, phone))
    rows = cursor.fetchall()
    orders = []
    for row in rows:
        o = dict(row)
        try: o["items"] = json.loads(o["items"]) if o.get("items") else []
        except: o["items"] = []
        orders.append(o)
    conn.close()
    return orders

@app.get("/products", response_model=List[ProductResponse])
async def get_products():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM products")
    rows = cursor.fetchall()
    results = []
    for row in rows:
        item = dict(row)
        if item.get("variants") and isinstance(item["variants"], str):
            try: item["variants"] = json.loads(item["variants"])
            except: item["variants"] = None
        if item.get("pack_sizes") and isinstance(item["pack_sizes"], str):
            item["pack_sizes"] = [x.strip() for x in item["pack_sizes"].split(",") if x.strip()]
        else: item["pack_sizes"] = []
        results.append(item)
    conn.close()
    return results

@app.post("/products")
async def create_product(product: ProductCreate):
    conn = get_db_connection()
    cursor = conn.cursor()
    pack_sizes_str = ", ".join(str(x) for x in product.pack_sizes) if isinstance(product.pack_sizes, list) else (product.pack_sizes or "")
    variants_str = json.dumps(product.variants, ensure_ascii=False) if product.variants else None
    cursor.execute('''INSERT INTO products (name, price, discount, description, category, image, images, composition, usage, weight, pack_sizes, old_price, unit, variants, option_names, delivery_info, payment_info, return_info, contacts) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''', (product.name, product.price, product.discount, product.description, product.category, product.image, product.images, product.composition, product.usage, product.weight, pack_sizes_str, product.old_price, product.unit, variants_str, product.option_names, product.delivery_info, product.payment_info, product.return_info, product.contacts))
    conn.commit()
    pid = cursor.lastrowid
    conn.close()
    return {"id": pid, "message": "Created"}

@app.put("/products/{product_id}")
async def update_product(product_id: int, product: ProductUpdate):
    conn = get_db_connection()
    cursor = conn.cursor()
    pack_sizes = ", ".join(str(x) for x in product.pack_sizes) if isinstance(product.pack_sizes, list) else str(product.pack_sizes or "")
    variants = json.dumps(product.variants, ensure_ascii=False) if product.variants else None
    discount = product.discount if product.discount is not None else 0
    unit = product.unit or "шт"
    sql = """UPDATE products SET name=?, price=?, discount=?, description=?, category=?, image=?, images=?, composition=?, usage=?, weight=?, pack_sizes=?, old_price=?, unit=?, variants=?, option_names=?, delivery_info=?, payment_info=?, return_info=?, contacts=? WHERE id=?"""
    params = (product.name, product.price, discount, product.description, product.category, product.image, product.images, product.composition, product.usage, product.weight, pack_sizes, product.old_price, unit, variants, product.option_names, product.delivery_info, product.payment_info, product.return_info, product.contacts, product_id)
    cursor.execute(sql, params)
    conn.commit()
    conn.close()
    return {"message": "Updated"}

@app.delete("/products/{product_id}")
async def delete_product(product_id: int):
    conn = get_db_connection()
    conn.execute("DELETE FROM products WHERE id=?", (product_id,))
    conn.commit()
    conn.close()
    return {"message": "Deleted"}

@app.get("/all-categories")
def get_categories():
    conn = get_db_connection()
    conn.execute('CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE)')
    rows = conn.execute('SELECT * FROM categories').fetchall()
    conn.close()
    return [dict(row) for row in rows]

@app.post("/categories")
def create_category(category: CategoryCreate):
    try:
        conn = get_db_connection()
        c = conn.cursor()
        c.execute('INSERT INTO categories (name) VALUES (?)', (category.name,))
        conn.commit()
        cid = c.lastrowid
        conn.close()
        return {"id": cid, "name": category.name}
    except: raise HTTPException(status_code=400, detail="Category already exists")

@app.delete("/categories/{category_id}")
def delete_category(category_id: int):
    conn = get_db_connection()
    conn.execute('DELETE FROM categories WHERE id = ?', (category_id,))
    conn.commit()
    conn.close()
    return {"message": "Deleted"}

@app.put("/categories/{category_id}")
def update_category(category_id: int, category: CategoryUpdate):
    conn = get_db_connection()
    conn.execute("UPDATE categories SET name=? WHERE id=?", (category.name, category_id))
    conn.commit()
    conn.close()
    return {"message": "Updated"}

@app.get("/banners")
def get_banners():
    conn = get_db_connection()
    return [dict(row) for row in conn.execute("SELECT * FROM banners").fetchall()]

@app.post("/banners")
def create_banner(banner: BannerCreate):
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("INSERT INTO banners (image_url, title, link_url, is_active) VALUES (?, ?, ?, ?)", (banner.image_url, banner.title, banner.link_url, banner.is_active))
    conn.commit()
    bid = c.lastrowid
    conn.close()
    return {"id": bid}

@app.delete("/banners/{banner_id}")
def delete_banner(banner_id: int):
    conn = get_db_connection()
    conn.execute("DELETE FROM banners WHERE id=?", (banner_id,))
    conn.commit()
    conn.close()
    return {"message": "Deleted"}

@app.post("/create_order")
async def create_order(order_data: OrderRequest):
    logger.info(f"📥 New Order: {order_data.dict()}")
    try:
        conn = sqlite3.connect('shop.db')
        cursor = conn.cursor()
        owner_phone = order_data.user_phone if order_data.user_phone else order_data.phone
        cursor.execute("INSERT OR IGNORE INTO users (phone, bonus_balance, total_spent) VALUES (?, 0, 0)", (owner_phone,))
        if order_data.bonus_used > 0:
            cursor.execute("UPDATE users SET bonus_balance = bonus_balance - ? WHERE phone = ?", (order_data.bonus_used, owner_phone))
        items_json = json.dumps([item.dict() for item in order_data.items])
        cursor.execute("""
            INSERT INTO orders (user_email, name, phone, city, cityRef, warehouse, warehouseRef, items, total, totalPrice, status, payment_method, date, bonus_used) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (owner_phone, order_data.name, order_data.phone, order_data.city, order_data.cityRef, order_data.warehouse, order_data.warehouseRef, items_json, order_data.totalPrice, order_data.totalPrice, "New", order_data.payment_method, datetime.now().strftime('%Y-%m-%d %H:%M:%S'), order_data.bonus_used))
        order_id = cursor.lastrowid
        conn.commit()
        if TELEGRAM_TOKEN and MY_CHAT_ID:
            items_list = []
            for item in order_data.items:
                info = f" ({item.packSize or item.unit or ''})"
                items_list.append(f"▪️ {item.name} x {item.quantity}{info}")
            msg = f"""🚀 ЗАКАЗ #{order_id}\n👤 {order_data.name}\n📞 {order_data.phone}\n📍 {order_data.city} ({order_data.warehouse})\n{chr(10).join(items_list)}\n💰 Итого: {order_data.totalPrice} грн\n💳 Оплата: {order_data.payment_method}\n🎁 Бонусов списано: {order_data.bonus_used}"""
            try: requests.post(f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage", json={"chat_id": MY_CHAT_ID, "text": msg})
            except: pass
        payment_url = None
        if order_data.payment_method == "card" and MONOBANK_API_TOKEN:
            try:
                WEBHOOK_URL = "https://dikoros.store/monobank-webhook" 
                payload = {"amount": order_data.totalPrice * 100, "ccy": 980, "merchantPaymInfo": {"reference": str(order_id), "destination": "Dikoros Order"}, "redirectUrl": "https://dikoros.store/payment-success", "webHookUrl": WEBHOOK_URL}
                async with httpx.AsyncClient() as client:
                    resp = await client.post("https://api.monobank.ua/api/merchant/invoice/create", headers={'X-Token': MONOBANK_API_TOKEN}, json=payload)
                    if resp.status_code == 200:
                        res = resp.json()
                        cursor.execute("UPDATE orders SET invoiceId = ? WHERE id = ?", (res['invoiceId'], order_id))
                        conn.commit()
                        payment_url = res['pageUrl']
            except Exception as e: logger.error(f"Mono Error: {e}")
        conn.close()
        return {"message": "Created", "order_id": order_id, "payment_url": payment_url}
    except Exception as e:
        logger.error(f"Order Error: {e}")
        return {"error": str(e)}

@app.post("/monobank-webhook")
async def monobank_webhook(request: Request):
    try:
        data = await request.json()
        if data.get('status') == 'success':
            inv_id = data.get('invoiceId')
            conn = get_db_connection()
            conn.execute("UPDATE orders SET status = 'Paid' WHERE invoiceId = ?", (inv_id,))
            conn.commit()
            conn.close()
        return {"status": "ok"}
    except: return {"status": "error"}

@app.post("/upload")
async def upload_image(file: UploadFile = File(...)):
    ext = os.path.splitext(file.filename)[1]
    name = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join("uploads", name)
    with open(path, "wb") as f: f.write(await file.read())
    return {"url": f"/uploads/{name}"}

@app.get("/image/{filename:path}")
async def get_image(filename: str):
    path = os.path.join("uploads", filename)
    return FileResponse(path) if os.path.exists(path) else {"error": "Not found"}

@app.post("/chat")
async def chat_with_gpt(chat_data: ChatRequest):
    key = os.getenv("OPENAI_API_KEY")
    if not key: return {"error": "No API Key"}
    try:
        client = OpenAI(api_key=key)
        response = client.chat.completions.create(model="gpt-4o-mini", messages=chat_data.messages, max_tokens=300)
        return {"text": response.choices[0].message.content, "products": []}
    except Exception as e: return {"error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)