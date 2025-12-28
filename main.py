from fastapi import FastAPI, UploadFile, File, Request
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from dotenv import load_dotenv
import sqlite3
import os
import xml.etree.ElementTree as ET
import requests
import json
from datetime import datetime

# Загружаем переменные окружения из .env файла
load_dotenv()

# Получаем токены из переменных окружения
TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN")
MY_CHAT_ID = os.getenv("MY_CHAT_ID")
MONO_TOKEN = os.getenv("MONO_TOKEN")

app = FastAPI()

# Добавляем CORS middleware для работы с React Native
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # В продакшене лучше указать конкретные домены
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
DB_NAME = 'shop.db'

def fix_db():
    import sqlite3
    conn = sqlite3.connect('shop.db')
    cursor = conn.cursor()
    
    # Добавляем колонку payment_method
    try:
        cursor.execute("ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT 'cash'")
        conn.commit()
        print("✅ База обновлена: колонка payment_method добавлена.")
    except Exception:
        pass
    
    # Добавляем колонку invoice_id для связи с Monobank
    try:
        cursor.execute("ALTER TABLE orders ADD COLUMN invoice_id TEXT")
        conn.commit()
        print("✅ База обновлена: колонка invoice_id добавлена.")
    except Exception:
        pass
    
    # Добавляем колонку status для отслеживания статуса оплаты
    try:
        cursor.execute("ALTER TABLE orders ADD COLUMN status TEXT DEFAULT 'Pending'")
        conn.commit()
        print("✅ База обновлена: колонка status добавлена.")
    except Exception:
        pass
    
    conn.close()
    print("ℹ️ Проверка структуры базы завершена.")

fix_db()

NP_API_KEY = "02971cadca463a19240b2a8798ee7817"
TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN")
MY_CHAT_ID = os.getenv("MY_CHAT_ID")

def get_db_connection():
    db_path = os.path.join(os.path.dirname(__file__), DB_NAME)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

@app.get("/", response_class=HTMLResponse)
def read_root():
    conn = get_db_connection()
    
    # Получаем товары
    items = conn.execute('SELECT * FROM products').fetchall()
    
    # Получаем заказы, отсортированные по дате создания (DESC)
    try:
        orders = conn.execute('''
            SELECT id, name, phone, city, warehouse, total_price, created_at 
            FROM orders 
            ORDER BY created_at DESC
        ''').fetchall()
    except sqlite3.OperationalError:
        # Таблица orders может не существовать
        orders = []
    
    conn.close()
    
    html_content = """
    <html>
        <head>
            <meta charset="utf-8">
            <style>
                body { font-family: sans-serif; margin: 40px; background: #f4f4f9; }
                .container { max-width: 1200px; margin: auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; margin-bottom: 40px; }
                th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                th { background-color: #222; color: white; }
                .upload-section { background: #eee; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
                img { width: 50px; height: 50px; object-fit: cover; border-radius: 5px; }
                h2 { margin-top: 40px; margin-bottom: 20px; color: #333; }
                .status { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
                .status-new { background-color: #4CAF50; color: white; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Управление товарами</h1>
                
                <div class="upload-section">
                    <h3>Массовый импорт XML</h3>
                    <form action="/upload_xml" method="post" enctype="multipart/form-data">
                        <input type="file" name="file" accept=".xml">
                        <button type="submit">Загрузить товары</button>
                    </form>
                </div>

                <h2>Товары</h2>
                <table>
                    <tr><th>ID</th><th>Фото</th><th>Название</th><th>Цена</th></tr>
    """
    for p in items:
        html_content += f"<tr><td>{p['id']}</td><td><img src='{p['image']}'></td><td>{p['name']}</td><td>{p['price']} ₴</td></tr>"
    
    html_content += """
                </table>
                
                <h2>Recent Orders</h2>
                <table>
                    <tr>
                        <th>ID</th>
                        <th>Customer</th>
                        <th>Phone</th>
                        <th>City</th>
                        <th>Warehouse</th>
                        <th>Total</th>
                        <th>Status</th>
                        <th>Date</th>
                    </tr>
    """
    
    if orders:
        for order in orders:
            # Форматируем дату
            try:
                date_obj = datetime.fromisoformat(order['created_at'])
                formatted_date = date_obj.strftime('%Y-%m-%d %H:%M')
            except:
                formatted_date = order['created_at']
            
            html_content += f"""
                    <tr>
                        <td>{order['id']}</td>
                        <td>{order['name']}</td>
                        <td>{order['phone']}</td>
                        <td>{order['city']}</td>
                        <td>{order['warehouse']}</td>
                        <td>{order['total_price']} ₴</td>
                        <td><span class="status status-new">New</span></td>
                        <td>{formatted_date}</td>
                    </tr>
            """
    else:
        html_content += "<tr><td colspan='8' style='text-align: center; color: #999;'>Нет заказов</td></tr>"
    
    html_content += """
                </table>
            </div>
        </body>
    </html>
    """
    return html_content

@app.post("/upload_xml")
async def upload_xml(file: UploadFile = File(...)):
    try:
        content = await file.read()
        # Пробуем декодировать содержимое (важно для кириллицы)
        xml_text = content.decode('utf-8')
        tree = ET.fromstring(xml_text)
        
        conn = get_db_connection()
        count = 0
        
        for item in tree.findall('.//product'):
            # Используем .get() чтобы сервер не падал, если тега нет
            name = item.findtext('name', default='Без названия')
            price_text = item.findtext('price', default='0')
            price = int(''.join(filter(str.isdigit, price_text))) # Оставляем только цифры
            image = item.findtext('image', default='')
            desc = item.findtext('description', default='')
            
            conn.execute("INSERT INTO products (name, price, image, description) VALUES (?, ?, ?, ?)",
                         (name, price, image, desc))
            count += 1
        
        conn.commit()
        conn.close()
        print(f"Успешно загружено товаров: {count}")
        return RedirectResponse(url="/", status_code=303)
        
    except Exception as e:
        return HTMLResponse(content=f"<h1>Ошибка при чтении XML:</h1><p>{str(e)}</p><a href='/'>Назад</a>", status_code=500)

@app.get("/health")
def health_check():
    """Проверка доступности сервера"""
    return JSONResponse(content={"status": "ok", "message": "Server is running"})

@app.get("/payment-success")
async def payment_success():
    return HTMLResponse(content="""
        <html>
            <body style="text-align: center; font-family: sans-serif; padding-top: 50px;">
                <h1 style="color: #4CAF50;">Оплата успішна! 🎉</h1>
                <p>Дякуємо за замовлення. Ми вже готуємо його до відправки.</p>
                <p>Можете повернутися в додаток.</p>
            </body>
        </html>
    """)

@app.post("/monobank-webhook")
async def monobank_webhook(request: Request):
    """Обработка webhook от Monobank о статусе оплаты"""
    try:
        # Получаем JSON данные из тела запроса
        request_data = await request.json()
        
        # Извлекаем invoiceId и status из JSON ответа банка
        invoice_id = request_data.get('invoiceId')
        status = request_data.get('status')
        
        if not invoice_id:
            print("⚠️ Webhook: invoiceId отсутствует в запросе")
            return JSONResponse(content={"status": "error", "message": "invoiceId is required"}, status_code=400)
        
        print(f"📥 Webhook от Monobank: invoiceId={invoice_id}, status={status}")
        
        # Если статус == 'success', обновляем заказ
        if status == 'success':
            conn = get_db_connection()
            cursor = conn.cursor()
            
            # Находим заказ по invoiceId
            cursor.execute('''
                SELECT id, total_price, name, phone 
                FROM orders 
                WHERE invoice_id = ?
            ''', (invoice_id,))
            
            order = cursor.fetchone()
            
            if order:
                order_id = order['id']
                total_price = order['total_price']
                
                # Обновляем статус заказа на 'Paid'
                cursor.execute('''
                    UPDATE orders 
                    SET status = 'Paid' 
                    WHERE id = ?
                ''', (order_id,))
                
                conn.commit()
                conn.close()
                
                print(f"✅ Заказ {order_id} обновлен: статус изменен на 'Paid'")
                
                # Отправляем уведомление в Telegram
                try:
                    if TELEGRAM_TOKEN and MY_CHAT_ID:
                        message = f"✅ ЗАКАЗ ОПЛАЧЕН!\n💰 Сумма: {total_price} грн\n📋 Заказ №{order_id}\n👤 {order['name']}\n📞 {order['phone']}"
                        
                        url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
                        payload = {
                            "chat_id": MY_CHAT_ID,
                            "text": message
                        }
                        
                        response = requests.post(url, json=payload)
                        response.raise_for_status()
                        print(f"✅ Уведомление об оплате отправлено в Telegram для заказа {order_id}")
                    else:
                        print("⚠️ Telegram токен не настроен, уведомление не отправлено")
                except Exception as e:
                    print(f"⚠️ Ошибка отправки уведомления в Telegram: {str(e)}")
                
                # Возвращаем статус 200, чтобы банк не слал уведомление повторно
                return JSONResponse(content={"status": "ok", "message": "Order updated successfully"})
            else:
                conn.close()
                print(f"⚠️ Заказ с invoiceId={invoice_id} не найден в базе")
                return JSONResponse(content={"status": "error", "message": "Order not found"}, status_code=404)
        else:
            print(f"ℹ️ Webhook: статус оплаты не 'success' (статус: {status})")
            # Возвращаем 200 даже если статус не success, чтобы банк не слал повторные запросы
            return JSONResponse(content={"status": "ok", "message": "Webhook received"})
            
    except Exception as e:
        print(f"🔥 КРИТИЧЕСКАЯ ОШИБКА в webhook: {str(e)}")
        import traceback
        traceback.print_exc()
        # Все равно возвращаем 200, чтобы банк не слал повторные запросы
        return JSONResponse(content={"status": "error", "message": str(e)})

@app.get("/get_cities")
def get_cities(search: str = ""):
    try:
        payload = {
            "apiKey": NP_API_KEY,
            "modelName": "Address",
            "calledMethod": "getCities",
            "methodProperties": {
                "FindByString": search,
                "Limit": "10"
            }
        }
        response = requests.post("https://api.novaposhta.ua/v2.0/json/", json=payload, timeout=25)
        response.raise_for_status()
        data = response.json()
        return data
    except requests.exceptions.Timeout as e:
        print(f"Timeout error fetching cities from Nova Poshta API: {str(e)}")
        return JSONResponse(
            status_code=504,
            content={"success": False, "error": "API Nova Poshta не відповідає. Спробуйте пізніше."}
        )
    except requests.exceptions.RequestException as e:
        print(f"Error fetching cities from Nova Poshta API: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": f"Помилка API Nova Poshta: {str(e)}"}
        )
    except Exception as e:
        print(f"Unexpected error in get_cities: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": f"Помилка сервера: {str(e)}"}
        )

@app.get("/get_warehouses")
def get_warehouses(city_ref: str):
    try:
        print(f"Fetching warehouses for city_ref: {city_ref}")
        payload = {
            "apiKey": NP_API_KEY,
            "modelName": "Address",
            "calledMethod": "getWarehouses",
            "methodProperties": {
                "CityRef": city_ref
            }
        }
        print(f"Sending request to Nova Poshta API...")
        response = requests.post("https://api.novaposhta.ua/v2.0/json/", json=payload, timeout=25)
        response.raise_for_status()
        data = response.json()
        print(f"Received response from Nova Poshta API: success={data.get('success')}, data length={len(data.get('data', [])) if data.get('data') else 0}")
        
        # Проверяем, что API вернул успешный ответ
        if data.get('success') is False:
            errors = data.get('errors', [])
            error_msg = errors[0] if errors else 'Невідома помилка від API Nova Poshta'
            print(f"Nova Poshta API returned error: {error_msg}")
            return JSONResponse(
                status_code=400,
                content={"success": False, "error": error_msg, "errors": errors}
            )
        
        return data
    except requests.exceptions.Timeout as e:
        print(f"Timeout error fetching warehouses from Nova Poshta API: {str(e)}")
        return JSONResponse(
            status_code=504,
            content={"success": False, "error": "API Nova Poshta не відповідає. Спробуйте пізніше."}
        )
    except requests.exceptions.RequestException as e:
        print(f"Error fetching warehouses from Nova Poshta API: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": f"Помилка API Nova Poshta: {str(e)}"}
        )
    except Exception as e:
        print(f"Unexpected error in get_warehouses: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": f"Помилка сервера: {str(e)}"}
        )

def send_telegram_notification(order_data):
    """Отправляет уведомление о новом заказе в Telegram"""
    if not TELEGRAM_TOKEN or not MY_CHAT_ID:
        print("Telegram bot token or chat ID not configured. Skipping notification.")
        return
    
    payment_method_text = "💳 Онлайн оплата" if order_data.get('payment_method') == 'card' else "💵 Накладений платіж"
    
    message = f"""🚀 НОВЫЙ ЗАКАЗ!
👤 Клиент: {order_data['name']}
📞 Телефон: {order_data['phone']}
📍 Город: {order_data['city']}
📦 Склад: {order_data['warehouse']}
💰 Сумма: {order_data['total']} грн
{payment_method_text}"""
    
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    payload = {
        "chat_id": MY_CHAT_ID,
        "text": message,
        "parse_mode": "HTML"
    }
    
    try:
        response = requests.post(url, json=payload)
        response.raise_for_status()
        print(f"Telegram notification sent successfully for order {order_data.get('order_id', 'N/A')}")
    except Exception as e:
        print(f"Failed to send Telegram notification: {str(e)}")

class OrderItem(BaseModel):
    id: int
    name: str
    price: int
    quantity: int
    packSize: int

class OrderRequest(BaseModel):
    name: str
    phone: str
    city: str
    cityRef: str
    warehouse: str
    warehouseRef: str
    items: List[OrderItem]
    totalPrice: int
    payment_method: str  # 'card' или 'cash'

@app.post("/create_order")
def create_order(order: OrderRequest):
    try:
        # Валидация данных
        if not order.items or len(order.items) == 0:
            return JSONResponse(
                status_code=400,
                content={"success": False, "error": "Корзина пуста"}
            )
        
        if order.payment_method not in ['card', 'cash']:
            return JSONResponse(
                status_code=400,
                content={"success": False, "error": "Невірний спосіб оплати"}
            )
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Создаем таблицу orders если её нет
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                phone TEXT NOT NULL,
                city TEXT NOT NULL,
                city_ref TEXT NOT NULL,
                warehouse TEXT NOT NULL,
                warehouse_ref TEXT NOT NULL,
                items TEXT NOT NULL,
                total_price INTEGER NOT NULL,
                payment_method TEXT NOT NULL,
                invoice_id TEXT,
                status TEXT DEFAULT 'Pending',
                created_at TEXT NOT NULL
            )
        ''')
        
        # Сохраняем заказ
        items_json = json.dumps([item.dict() for item in order.items])
        created_at = datetime.now().isoformat()
        
        cursor.execute('''
            INSERT INTO orders (name, phone, city, city_ref, warehouse, warehouse_ref, items, total_price, payment_method, invoice_id, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            order.name,
            order.phone,
            order.city,
            order.cityRef,
            order.warehouse,
            order.warehouseRef,
            items_json,
            order.totalPrice,
            order.payment_method,
            None,  # invoice_id будет обновлен после создания инвойса
            'Pending',  # статус по умолчанию
            created_at
        ))
        
        order_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        checkout_url = None
        
        # Если онлайн оплата, создаем инвойс в Monobank
        if order.payment_method == 'card':
            if not MONO_TOKEN:
                print("❌ ERROR: MONO_TOKEN не налаштовано")
                return JSONResponse(
                    status_code=500,
                    content={"status": "error", "error": "MONO_TOKEN не налаштовано"}
                )
            
            try:
                mono_url = "https://api.monobank.ua/api/merchant/invoice/create"
                mono_headers = {
                    "X-Token": MONO_TOKEN,
                    "Content-Type": "application/json"
                }
                # Убеждаемся что сумма в копейках (int)
                amount_in_kopiyok = int(order.totalPrice * 100)
                mono_payload = {
                    "amount": amount_in_kopiyok,
                    "ccy": 980,  # Гривна
                    "merchantPaymInfo": {
                        "destination": "Оплата замовлення"
                    },
                    "redirectUrl": f"http://192.168.1.161:8000/payment-success"
                }
                
                print(f"📤 Creating Monobank invoice for order {order_id}, amount: {amount_in_kopiyok} kopiyok (total: {order.totalPrice} UAH)")
                print(f"📤 Payload: {mono_payload}")
                
                mono_response = requests.post(mono_url, json=mono_payload, headers=mono_headers, timeout=30)
                
                # Проверяем статус код перед парсингом JSON
                if mono_response.status_code != 200:
                    error_text = mono_response.text
                    print(f"❌ ОШИБКА MONOBANK (status {mono_response.status_code}): {error_text}")
                    print(f"❌ Request URL: {mono_url}")
                    print(f"❌ Request Headers: {mono_headers}")
                    print(f"❌ Request Payload: {mono_payload}")
                    return JSONResponse(
                        status_code=500,
                        content={"status": "error", "error": f"Помилка Monobank API: {error_text}"}
                    )
                
                mono_data = mono_response.json()
                print(f"✅ Monobank API response: {mono_data}")
                
                if 'pageUrl' in mono_data:
                    checkout_url = mono_data['pageUrl']
                    # Получаем invoiceId из ответа (может быть invoiceId или invoice_id)
                    invoice_id = mono_data.get('invoiceId') or mono_data.get('invoice_id') or mono_data.get('invoiceId')
                    print(f"✅ Monobank checkout URL created successfully: {checkout_url}")
                    print(f"📝 Invoice ID: {invoice_id}")
                    print(f"📝 Полный ответ Monobank: {mono_data}")
                    
                    # Сохраняем invoiceId в базу данных
                    if invoice_id:
                        try:
                            conn = get_db_connection()
                            cursor = conn.cursor()
                            cursor.execute('''
                                UPDATE orders 
                                SET invoice_id = ? 
                                WHERE id = ?
                            ''', (invoice_id, order_id))
                            conn.commit()
                            conn.close()
                            print(f"✅ Invoice ID сохранен в базу для заказа {order_id}")
                        except Exception as e:
                            print(f"⚠️ Ошибка сохранения invoice_id: {str(e)}")
                    
                    # Отправляем уведомление в Telegram
                    try:
                        order_data = {
                            "order_id": order_id,
                            "name": order.name,
                            "phone": order.phone,
                            "city": order.city,
                            "warehouse": order.warehouse,
                            "total": order.totalPrice,
                            "payment_method": order.payment_method
                        }
                        send_telegram_notification(order_data)
                    except Exception as e:
                        print(f"⚠️ Error sending Telegram notification: {str(e)}")
                    
                    # Возвращаем строго указанный формат
                    return JSONResponse(content={
                        "status": "success",
                        "checkout_url": checkout_url
                    })
                else:
                    error_msg = f"Monobank response missing pageUrl. Response: {mono_data}"
                    print(f"❌ ERROR: {error_msg}")
                    return JSONResponse(
                        status_code=500,
                        content={"status": "error", "error": "Помилка створення інвойсу в Monobank: відсутнє pageUrl"}
                    )
            except requests.exceptions.RequestException as e:
                error_details = f"Error creating Monobank invoice: {str(e)}"
                if hasattr(e, 'response') and e.response is not None:
                    try:
                        error_body = e.response.text
                        error_details += f" Response: {error_body}"
                        print(f"❌ ОШИБКА MONOBANK (RequestException): {error_body}")
                    except:
                        pass
                print(f"❌ ERROR: {error_details}")
                import traceback
                traceback.print_exc()
                return JSONResponse(
                    status_code=500,
                    content={"status": "error", "error": f"Помилка створення інвойсу: {str(e)}"}
                )
            except Exception as e:
                error_details = f"Unexpected error creating Monobank invoice: {str(e)}"
                print(f"🔥 КРИТИЧЕСКАЯ ОШИБКА: {error_details}")
                import traceback
                traceback.print_exc()
                return JSONResponse(
                    status_code=500,
                    content={"status": "error", "error": f"Помилка створення інвойсу: {str(e)}"}
                )
        
        # Отправляем уведомление в Telegram (не блокируем создание заказа при ошибке)
        try:
            order_data = {
                "order_id": order_id,
                "name": order.name,
                "phone": order.phone,
                "city": order.city,
                "warehouse": order.warehouse,
                "total": order.totalPrice,
                "payment_method": order.payment_method
            }
            send_telegram_notification(order_data)
        except Exception as e:
            print(f"Error sending Telegram notification: {str(e)}")
            # Не прерываем выполнение, если Telegram недоступен
        
        # Для наложенного платежа возвращаем стандартный ответ
        response_data = {
            "success": True,
            "status": "success",
            "message": "Замовлення успішно створено",
            "order_id": order_id
        }
        
        return JSONResponse(content=response_data)
    except sqlite3.Error as e:
        print(f"Database error: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": f"Помилка бази даних: {str(e)}"}
        )
    except Exception as e:
        print(f"Unexpected error: {str(e)}")
        import traceback
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": f"Помилка сервера: {str(e)}"}
        )

if __name__ == "__main__":
    import uvicorn
    # Используем 0.0.0.0 чтобы слушать на всех интерфейсах
    # Это позволит подключаться и по localhost, и по IP адресу
    uvicorn.run(app, host="0.0.0.0", port=8000)
