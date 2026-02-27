from horoshop_xml_parser import parse_horoshop_xml, import_products_to_db
import tempfile
import time
import hashlib
import requests
import json
import os
import httpx
import asyncio
import uuid
import logging
import csv
from io import StringIO, BytesIO
from datetime import datetime
from typing import List, Optional, Any, Dict

from fastapi import FastAPI, HTTPException, Request, UploadFile, File, BackgroundTasks
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict
from dotenv import load_dotenv

from PIL import Image as PILImage, ImageOps

import psycopg2
from psycopg2.extras import RealDictCursor

# Initialize OpenAI Client
openai_client = None
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is required (PostgreSQL only).")


def _pgify_sql(sql: str) -> str:
    # Convert sqlite-style placeholders to psycopg2 placeholders.
    return sql.replace("?", "%s")


class _PGCursorAdapter:
    def __init__(self, cursor):
        self._cursor = cursor

    def execute(self, sql: str, params=None):
        self._cursor.execute(_pgify_sql(sql), params or ())
        return self

    def executemany(self, sql: str, seq_of_params):
        self._cursor.executemany(_pgify_sql(sql), seq_of_params)
        return self

    def fetchone(self):
        return self._cursor.fetchone()

    def fetchall(self):
        return self._cursor.fetchall()

    def close(self):
        return self._cursor.close()

    def __getattr__(self, item):
        return getattr(self._cursor, item)


class _PGConnAdapter:
    """Small adapter to mimic sqlite3.Connection.execute(...) API using psycopg2."""

    def __init__(self, conn):
        self._conn = conn

    def execute(self, sql: str, params=None):
        cur = _PGCursorAdapter(self._conn.cursor(cursor_factory=RealDictCursor))
        return cur.execute(sql, params)

    def cursor(self):
        return _PGCursorAdapter(self._conn.cursor(cursor_factory=RealDictCursor))

    def commit(self):
        self._conn.commit()

    def close(self):
        self._conn.close()
api_key = os.getenv("OPENAI_API_KEY")

if api_key:
    try:
        from openai import AsyncOpenAI
        openai_client = AsyncOpenAI(api_key=api_key)
        print("✅ OpenAI client initialized")
    except ImportError:
        print("⚠️ OpenAI library not installed. Install via: pip install openai")
else:
    print("⚠️ No OPENAI_API_KEY found. Chat will use basic search.")

# Apix-Drive Webhook URL
APIX_DRIVE_WEBHOOK_URL = "https://s7.apix-drive.com/web-hooks/30463/bx226u6b"

# --- HELPER FUNCTIONS ---
def normalize_phone(phone: str) -> str:
    return "".join(filter(str.isdigit, str(phone)))

def calculate_cashback_percent(total_spent: float) -> int:
    """
    Расчет процента кешбэка на основе общей суммы покупок
    """
    if total_spent < 2000:
        return 0
    elif total_spent < 5000:
        return 5
    elif total_spent < 10000:
        return 10
    elif total_spent < 25000:
        return 15
    else:
        return 20

async def send_to_apix_drive(order_data: dict):
    """
    Отправка заказа в Apix-Drive для синхронизации с OneBox
    """
    print(f"📡 [Apix-Drive] Отправка заказа #{order_data.get('id')}...")
    
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                APIX_DRIVE_WEBHOOK_URL,
                json=order_data,
                timeout=10.0
            )
            
            print(f"📡 [Apix-Drive] Статус: {resp.status_code}")
            
            if resp.status_code in [200, 201, 202]:
                print(f"✅ [Apix-Drive] Заказ #{order_data.get('id')} успешно отправлен!")
            else:
                print(f"⚠️ [Apix-Drive] Ошибка: {resp.status_code} - {resp.text}")
                
        except Exception as e:
            print(f"❌ [Apix-Drive] Исключение: {e}")

# --- ANALYTICS TRACKING ---
async def send_to_facebook_capi(event_name: str, data: dict, user_data: dict):
    pixel_id = os.getenv("FB_PIXEL_ID")
    access_token = os.getenv("FB_ACCESS_TOKEN")
    if not pixel_id or not access_token: return

    url = f"https://graph.facebook.com/v19.0/{pixel_id}/events?access_token={access_token}"
    
    def hash_data(val): 
        return hashlib.sha256(str(val).strip().lower().encode('utf-8')).hexdigest() if val else None

    # Map standard events
    fb_event_name = event_name
    if event_name == "purchase": fb_event_name = "Purchase"
    
    payload = {
        "data": [{
            "event_name": fb_event_name,
            "event_time": int(time.time()),
            "action_source": "website",
            "user_data": {
                "ph": [hash_data(user_data.get('phone'))] if user_data.get('phone') else [],
                "em": [hash_data(user_data.get('email'))] if user_data.get('email') else [],
                "client_user_agent": user_data.get('user_agent'),
                "client_ip_address": user_data.get('ip')
            },
            "custom_data": data
        }]
    }
    
    async with httpx.AsyncClient() as client:
        try:
            await client.post(url, json=payload)
        except Exception as e:
            print(f"⚠️ FB CAPI Error: {e}")

async def send_to_google_analytics(event_name: str, data: dict, user_data: dict):
    measurement_id = os.getenv("GA_MEASUREMENT_ID")
    api_secret = os.getenv("GA_API_SECRET")
    if not measurement_id or not api_secret: return

    url = f"https://www.google-analytics.com/mp/collect?measurement_id={measurement_id}&api_secret={api_secret}"
    
    # GA4 params
    ga_params = data.copy()
    if "value" in ga_params: ga_params["value"] = float(ga_params["value"])
    
    payload = {
        "client_id": user_data.get('client_id') or user_data.get('phone') or str(uuid.uuid4()),
        "events": [{
            "name": event_name,
            "params": ga_params
        }]
    }
    
    async with httpx.AsyncClient() as client:
        try:
            await client.post(url, json=payload)
        except Exception as e:
            print(f"⚠️ GA4 Error: {e}")

async def track_analytics_event(event_name: str, data: dict, user_data: dict):
    await send_to_facebook_capi(event_name, data, user_data)
    await send_to_google_analytics(event_name, data, user_data)


# --- ВАШ HTML КОД АДМИНКИ (ВСТАВЛЯЕТСЯ АВТОМАТИЧЕСКИ) ---
ADMIN_HTML_CONTENT = r"""
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Super Admin Dashboard</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        .fade-in { animation: fadeIn 0.3s ease-in-out; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .modal-backdrop { background-color: rgba(0, 0, 0, 0.75); }
        /* Скроллбар */
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: #1f2937; }
        ::-webkit-scrollbar-thumb { background: #4b5563; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #6b7280; }
    </style>
</head>
<body class="bg-gray-900 text-gray-100 font-sans min-h-screen p-6">

    <div class="max-w-7xl mx-auto">
        <div class="flex justify-between items-center mb-6 border-b border-gray-700 pb-4">
            <h1 class="text-3xl font-bold text-blue-400">🍕 Super Admin</h1>
            <div class="space-x-4">
                <button onclick="switchTab('orders')" id="tab-orders" class="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold transition hover:bg-blue-500">
                    📦 Заказы
                </button>
                <button onclick="switchTab('products')" id="tab-products" class="px-4 py-2 rounded-lg bg-gray-700 text-gray-300 font-semibold transition hover:bg-gray-600">
                    🍔 Товары
                </button>
                <button onclick="switchTab('users')" id="tab-users" class="px-4 py-2 rounded-lg bg-gray-700 text-gray-300 font-semibold transition hover:bg-gray-600">
                    👥 Клиенты
                </button>
                <button onclick="switchTab('promocodes')" id="tab-promocodes" class="px-4 py-2 rounded-lg bg-gray-700 text-gray-300 font-semibold transition hover:bg-gray-600">
                    🎁 Промокоды
                </button>
            </div>
        </div>

        <div id="view-orders" class="fade-in">
            <div class="bg-gray-800 rounded-lg p-4 mb-4 border border-gray-700">
                <div style="display: flex; gap: 10px; align-items: center; justify-content: space-between; flex-wrap: wrap;">
                    <h2 class="text-xl font-bold text-blue-400">📦 Управление заказами</h2>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <button id="delete-selected-orders-btn" onclick="deleteSelectedOrders()" 
                                class="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-500 transition whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled>
                            🗑️ Удалить выбранные
                        </button>
                        <button onclick="exportOrders()" 
                                class="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-500 transition whitespace-nowrap">
                            📥 Экспорт в Excel
                        </button>
                    </div>
                </div>
            </div>
            
            <div class="bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-700">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="bg-gray-700 text-gray-300 uppercase text-xs tracking-wider">
                            <th class="p-4">
                                <input type="checkbox" id="select-all-orders" onchange="toggleSelectAllOrders(this.checked)" 
                                     class="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500">
                            </th>
                            <th class="p-4">ID</th>
                            <th class="p-4">Дата</th>
                            <th class="p-4">Клиент</th>
                            <th class="p-4">Email</th>
                            <th class="p-4">Связь</th>
                            <th class="p-4">Доставка</th>
                            <th class="p-4 w-1/3">Состав Заказа</th>
                            <th class="p-4">Сумма</th>
                            <th class="p-4">Статус</th>
                            <th class="p-4">Действия</th>
                        </tr>
                    </thead>
                    <tbody id="orders-table" class="divide-y divide-gray-700 text-sm">
                    </tbody>
                </table>
            </div>
        </div>

        <div id="view-products" class="hidden fade-in">
            <div class="bg-gray-800 rounded-lg p-4 mb-4 border border-gray-700">
                <div style="display: flex; gap: 20px; align-items: center; flex-wrap: wrap;">
                    <div style="display: flex; gap: 10px; align-items: center; flex: 1; min-width: 300px;">
                        <input type="text" id="xml-url-input" placeholder="XML URL..." 
                               class="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500">
                        <button onclick="importXML()" 
                                class="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-500 transition whitespace-nowrap">
                            Import XML
                        </button>
                    </div>
                    
                    <div style="display: flex; gap: 10px; align-items: center; flex: 1; min-width: 300px;">
                        <input type="file" id="csvFile" accept=".csv" 
                               class="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-green-600 file:text-white hover:file:bg-green-500"
                               onchange="uploadCSV()">
                    </div>
                    
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <button onclick="openAddProductModal()" 
                                class="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-500 transition">
                            ➕ Добавить товар
                        </button>
                        <button onclick="handleDeleteSelected()" 
                                class="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-500 transition">
                            🗑️ Удалить выбранные
                        </button>
                    </div>
                </div>
            </div>

            <div class="bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-700">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="bg-gray-700 text-gray-300 uppercase text-xs tracking-wider">
                            <th class="p-3">
                                <input type="checkbox" id="select-all-checkbox" onchange="toggleSelectAll(this.checked)" 
                                     class="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500">
                            </th>
                            <th class="p-3">Фото</th>
                            <th class="p-3">Название</th>
                            <th class="p-3">Категория</th>
                            <th class="p-3">Цена</th>
                            <th class="p-3">Старая цена</th>
                            <th class="p-3">Единица</th>
                            <th class="p-3">Фасування</th>
                            <th class="p-3">Действия</th>
                        </tr>
                    </thead>
                    <tbody id="products-table" class="divide-y divide-gray-700 text-sm">
                    </tbody>
                </table>
            </div>

            <div class="bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-700 mt-6 p-6">
                <h2 class="text-2xl font-bold text-blue-400 mb-4">🎨 Управление баннерами</h2>
                
                <div class="mb-6">
                    <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                        <input type="file" id="bannerFile" accept="image/*" 
                               class="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-green-600 file:text-white hover:file:bg-green-500">
                        <input type="text" id="bannerUrl" placeholder="Или введите Image URL" 
                               class="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 min-w-300">
                        <button onclick="createBanner()" 
                                class="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-500 transition whitespace-nowrap">
                            ➕ Добавить баннер
                        </button>
                    </div>
                </div>
                
                <div id="bannersList" class="grid-container" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 20px;">
                    </div>
            </div>
        </div>

        <div id="view-users" class="hidden fade-in">
            <div class="bg-gray-800 rounded-lg p-4 mb-4 border border-gray-700 shadow-md flex justify-between items-center">
                <h2 class="text-xl font-bold text-blue-400">👥 Клиенты и Бонусы</h2>
                <button onclick="loadUsers()" class="text-gray-400 hover:text-white"><span class="text-xl">🔄</span></button>
            </div>
            <div class="bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-700 overflow-x-auto">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="bg-gray-700 text-gray-300 uppercase text-xs tracking-wider">
                            <th class="p-4">Телефон</th>
                            <th class="p-4">Баланс Бонусов</th>
                            <th class="p-4">Всего потрачено</th>
                            <th class="p-4">Кешбэк уровень</th>
                            <th class="p-4">Действия</th>
                        </tr>
                    </thead>
                    <tbody id="users-table" class="divide-y divide-gray-700 text-sm"></tbody>
                </table>
            </div>
        </div>

        <div id="view-promocodes" class="hidden fade-in">
            <div class="bg-gray-800 rounded-lg p-4 mb-4 border border-gray-700">
                <div class="flex justify-between items-center">
                    <h2 class="text-xl font-bold text-blue-400">🎁 Промокоды</h2>
                    <button onclick="openAddPromoCodeModal()" 
                            class="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-500 transition">
                        ➕ Добавить промокод
                    </button>
                </div>
            </div>
            
            <div class="bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-700">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="bg-gray-700 text-gray-300 uppercase text-xs tracking-wider">
                            <th class="p-4">Код</th>
                            <th class="p-4">Скидка</th>
                            <th class="p-4">Лимит</th>
                            <th class="p-4">Использовано</th>
                            <th class="p-4">Срок действия</th>
                            <th class="p-4">Активен</th>
                            <th class="p-4">Действия</th>
                        </tr>
                    </thead>
                    <tbody id="promocodes-table" class="divide-y divide-gray-700 text-sm">
                    </tbody>
                </table>
            </div>
        </div>

    </div>

    <div id="user-modal" class="hidden fixed inset-0 z-50 modal-backdrop flex items-center justify-center">
        <div class="bg-gray-800 rounded-xl shadow-2xl w-full max-w-sm mx-4 border border-gray-700 fade-in p-6">
            <h2 class="text-xl font-bold text-white mb-4">Редактировать клиента</h2>
            <p class="text-gray-400 text-sm mb-4" id="modal-user-phone"></p>
            
            <label class="block text-sm text-gray-300 mb-1">Баланс Бонусов (₴)</label>
            <input type="number" id="modal-user-bonus" class="w-full bg-gray-700 text-white rounded p-2 border border-gray-600 mb-4 font-bold text-green-400 text-xl">
            
            <label class="block text-sm text-gray-300 mb-1">Всего потрачено (₴)</label>
            <input type="number" id="modal-user-spent" class="w-full bg-gray-700 text-white rounded p-2 border border-gray-600 mb-6 font-bold text-yellow-400 text-xl">
            
            <div class="flex justify-end gap-3">
                <button onclick="document.getElementById('user-modal').classList.add('hidden')" class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500">Отмена</button>
                <button onclick="saveUserBonus()" class="px-6 py-2 bg-blue-600 text-white font-bold rounded hover:bg-blue-500">Сохранить</button>
            </div>
        </div>
    </div>

    <div id="order-status-modal" class="hidden fixed inset-0 z-50 modal-backdrop flex items-center justify-center">
        <div class="bg-gray-800 rounded-xl shadow-2xl w-full max-w-md mx-4 border border-gray-700 fade-in">
            <div class="p-6">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-2xl font-bold text-blue-400">Изменить статус заказа</h2>
                    <button onclick="closeOrderStatusModal()" class="text-gray-400 hover:text-white text-2xl">&times;</button>
                </div>
                
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Статус заказа</label>
                        <select id="order-status-select" 
                                class="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500">
                            <option value="Новый">Новый</option>
                            <option value="В обработке">В обработке</option>
                            <option value="Отправлен">Отправлен</option>
                            <option value="Доставлен">Доставлен</option>
                            <option value="Отменен">Отменен</option>
                            <option value="Completed">Выполнен (Кешбэк)</option>
                        </select>
                    </div>
                    
                    <div class="flex justify-end gap-3 pt-4">
                        <button onclick="closeOrderStatusModal()" 
                                class="px-6 py-2 bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-600 transition">
                            Отмена
                        </button>
                        <button onclick="saveOrderStatus()" 
                                class="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-500 transition">
                            Сохранить
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div id="product-modal" class="hidden fixed inset-0 z-50 modal-backdrop flex items-center justify-center">
        <div class="bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl mx-4 border border-gray-700 fade-in max-h-[85vh] overflow-y-auto">
            <div class="p-6">
                <div class="flex justify-between items-center mb-6">
                    <h2 id="modal-title" class="text-2xl font-bold text-blue-400">Добавить товар</h2>
                    <button onclick="closeProductModal()" class="text-gray-400 hover:text-white text-2xl">&times;</button>
                </div>
                
                <form id="product-form" onsubmit="saveProduct(event)" class="space-y-4">
                    <input type="hidden" id="product-id" value="">
                    
                    <div class="grid grid-cols-3 gap-4" style="overflow: visible;">
                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-2">Название *</label>
                            <input type="text" id="product-name" required
                                   class="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-2">Базовая цена (₴)</label>
                            <input type="number" id="product-price" min="0"
                                   class="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
                                   placeholder="От ... грн (или оставьте пустым, если есть варианты)">
                        </div>
                        <div style="position: relative; overflow: visible;">
                            <label for="productCategory" class="block text-sm font-medium text-gray-300 mb-2">Категория</label>
                            <div style="display: flex; gap: 10px; align-items: center; width: 100%; position: relative; overflow: visible;">
                                <select id="productCategory" required 
                                        class="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
                                        style="min-width: 0;">
                                    <option value="">Загрузка...</option>
                                </select>
                                <button type="button" onclick="openCategoryModal()" 
                                        class="px-4 py-2 text-white font-semibold rounded-lg hover:opacity-90 transition"
                                        style="background: #e67e22 !important; border: 2px solid #d35400 !important; cursor: pointer; font-size: 18px; white-space: nowrap; flex-shrink: 0; min-width: 50px; height: 42px; display: flex !important; align-items: center; justify-content: center; z-index: 10; box-shadow: 0 2px 4px rgba(0,0,0,0.3); visibility: visible !important; opacity: 1 !important;"
                                        title="Управление категориями">
                                    <span style="display: inline-block; font-size: 18px; line-height: 1; font-weight: bold;">⚙</span>
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-3 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-2">Старая цена (₴)</label>
                            <input type="number" id="product-old-price" min="0" step="0.01"
                                   class="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-2">Скидка (%)</label>
                            <input type="number" id="product-discount" placeholder="Скидка %" min="0" max="100" step="0.01"
                                   class="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-2">Единица измерения</label>
                            <input type="text" id="product-unit" placeholder="шт" value="шт"
                                   class="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500">
                        </div>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Изображения товара</label>
                        
                        <div class="mb-4">
                            <div class="flex items-center gap-4 mb-2">
                                <input type="file" id="product-images-file" accept="image/*" multiple
                                     class="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-green-600 file:text-white hover:file:bg-green-500">
                                <button type="button" onclick="uploadMultipleImages()" 
                                        class="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-500 transition">
                                    Загрузить
                                </button>
                            </div>
                            <p class="text-xs text-gray-400">Выберите несколько изображений или перетащите их. Первое изображение будет основным.</p>
                        </div>
                        
                        <div id="images-upload-status" class="hidden mb-2">
                            <div class="flex items-center gap-2">
                                <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-green-500"></div>
                                <span class="text-sm text-gray-300">Загрузка изображений...</span>
                            </div>
                        </div>
                        
                        <div id="uploaded-images-preview" class="grid grid-cols-4 gap-2 mb-3"></div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-1">URL изображений (через запятую)</label>
                            <textarea id="product-images" placeholder="https://example.com/image1.jpg, https://example.com/image2.jpg"
                                      class="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
                                      rows="2"></textarea>
                            <p class="text-xs text-gray-400 mt-1">Можно ввести URL вручную или они добавятся автоматически после загрузки.</p>
                        </div>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Названия характеристик (через |)</label>
                        <input type="text" id="productOptionNames" 
                               placeholder="Например: Врожай | Вага | Дозування"
                               class="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500">
                    </div>
                    
                    <div>
                        <div class="flex justify-between items-center mb-2">
                            <label class="block text-sm font-medium text-gray-300">Варианты фасовки</label>
                            <button type="button" onclick="addVariant()" 
                                    class="px-3 py-1 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-500 transition">
                                + Добавить вариант
                            </button>
                        </div>
                        <div id="variants-container" class="space-y-2">
                            </div>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Опис</label>
                        <textarea id="product-description" rows="2"
                                  class="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"></textarea>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Інструкція та протипоказання</label>
                        <textarea id="product-usage" rows="4"
                                  class="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"></textarea>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Склад</label>
                        <textarea id="product-composition" rows="3"
                                  class="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"></textarea>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Доставка та оплата</label>
                        <textarea id="product-delivery-info" rows="3"
                                  class="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"></textarea>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Повернення</label>
                        <textarea id="product-return-info" rows="3"
                                  class="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"></textarea>
                    </div>
                    
                    <div class="flex justify-end gap-3 pt-4">
                        <button type="button" onclick="closeProductModal()" 
                                class="px-6 py-2 bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-600 transition">
                            Отмена
                        </button>
                        <button type="submit" 
                                class="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-500 transition">
                            Сохранить
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <div id="categoryModal" class="hidden fixed inset-0 z-50 modal-backdrop flex items-center justify-center">
        <div class="bg-gray-800 rounded-xl shadow-2xl w-full max-w-md mx-4 border border-gray-700 fade-in">
            <div class="p-6">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-2xl font-bold text-blue-400">Управление категориями</h2>
                    <button onclick="closeCategoryModal()" class="text-gray-400 hover:text-white text-2xl">&times;</button>
                </div>
                
                <div style="display: flex; gap: 10px; margin-bottom: 20px;">
                    <input type="text" id="newCategoryName" placeholder="Новая категория" 
                           class="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500">
                    <button onclick="addCategory()" 
                            class="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-500 transition">
                        +
                    </button>
                </div>
                
                <ul id="categoryList" style="list-style: none; padding: 0; max-height: 300px; overflow-y: auto; margin-bottom: 20px;">
                </ul>
                
                <div class="flex justify-end gap-3 pt-4">
                    <button onclick="closeCategoryModal()" 
                            class="px-6 py-2 bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-600 transition">
                        Закрыть
                    </button>
                </div>
            </div>
        </div>
    </div>

    <div id="promoCodeModal" class="hidden fixed inset-0 z-50 modal-backdrop flex items-center justify-center">
        <div class="bg-gray-800 rounded-xl shadow-2xl w-full max-w-md mx-4 border border-gray-700 fade-in">
            <div class="p-6">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-2xl font-bold text-blue-400">Новый промокод</h2>
                    <button onclick="closePromoCodeModal()" class="text-gray-400 hover:text-white text-2xl">&times;</button>
                </div>
                
                <form onsubmit="createPromoCode(event)" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Код *</label>
                        <input type="text" id="promo-code" required placeholder="SUMMER2024"
                               class="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 uppercase">
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-2">Скидка %</label>
                            <input type="number" id="promo-percent" min="0" max="100" value="0"
                                   class="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-2">Скидка ₴</label>
                            <input type="number" id="promo-amount" min="0" value="0"
                                   class="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500">
                        </div>
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Лимит использований (0 = безлимит)</label>
                        <input type="number" id="promo-max-uses" min="0" value="0"
                               class="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500">
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Действует до (необязательно)</label>
                        <input type="date" id="promo-expires"
                               class="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500">
                    </div>
                    
                    <div class="flex justify-end gap-3 pt-4">
                        <button type="button" onclick="closePromoCodeModal()" 
                                class="px-6 py-2 bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-600 transition">
                            Отмена
                        </button>
                        <button type="submit" 
                                class="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-500 transition">
                            Создать
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <script>
        console.log('🚀 Admin script loading...');
        
        // Global variables
        let currentEditingId = null;
        let currentOrderId = null;
        let currentUserPhone = null; // 🔥 NEW VARIABLE
        
        // API Configuration
        const API_BASE_URL = ''; // Относительные пути работают при открытии через FastAPI server

        console.log('📝 Defining switchTab function...');

        // --- TABS LOGIC ---
        function switchTab(tab) {
            // Скрываем все
            ['orders', 'products', 'users', 'promocodes'].forEach(t => {
                const view = document.getElementById(`view-${t}`);
                if (view) view.classList.add('hidden');
                
                const btn = document.getElementById(`tab-${t}`);
                if (btn) {
                    btn.classList.replace('bg-blue-600', 'bg-gray-700');
                    btn.classList.replace('text-white', 'text-gray-300');
                }
            });

            // Показываем активное
            const activeView = document.getElementById(`view-${tab}`);
            if (activeView) activeView.classList.remove('hidden');
            
            const activeBtn = document.getElementById(`tab-${tab}`);
            if (activeBtn) {
                activeBtn.classList.replace('bg-gray-700', 'bg-blue-600');
                activeBtn.classList.replace('text-gray-300', 'text-white');
            }

            if(tab === 'orders') loadOrders();
            if(tab === 'promocodes') loadPromoCodes();
            if(tab === 'products') loadProducts();
            if(tab === 'users') loadUsers(); // 🔥 NEW CALL
        }
        
        // --- USERS LOGIC (NEW) ---
        async function loadUsers() {
            try {
                const res = await fetch(`${API_BASE_URL}/api/users`);
                const users = await res.json();
                const tbody = document.getElementById('users-table');
                tbody.innerHTML = users.map(u => {
                    const level = u.total_spent > 25000 ? 20 : u.total_spent > 10000 ? 15 : u.total_spent > 5000 ? 10 : u.total_spent > 2000 ? 5 : 0;
                    return `
                    <tr class="hover:bg-gray-750 border-b border-gray-700">
                        <td class="p-4 font-mono text-blue-300">${u.phone}</td>
                        <td class="p-4 font-bold text-green-400 text-lg">${u.bonus_balance} ₴</td>
                        <td class="p-4 text-gray-300">${u.total_spent || 0} ₴</td>
                        <td class="p-4 text-yellow-500 text-xs">${level}%</td>
                        <td class="p-4">
                            <button onclick="openUserModal('${u.phone}', ${u.bonus_balance}, ${u.total_spent})" class="bg-blue-600 p-2 rounded hover:bg-blue-500 text-white">✏️</button>
                        </td>
                    </tr>
                `}).join('');
            } catch(e) { console.error(e); }
        }

        function openUserModal(phone, balance, spent) {
            currentUserPhone = phone;
            document.getElementById('modal-user-phone').innerText = phone;
            document.getElementById('modal-user-bonus').value = balance;
            document.getElementById('modal-user-spent').value = spent || 0;
            document.getElementById('user-modal').classList.remove('hidden');
        }

        async function saveUserBonus() {
            const bonus = document.getElementById('modal-user-bonus').value;
            const spent = document.getElementById('modal-user-spent').value;
            await fetch(`${API_BASE_URL}/api/users/${currentUserPhone}`, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ 
                    bonus_balance: parseInt(bonus),
                    total_spent: parseFloat(spent)
                })
            });
            document.getElementById('user-modal').classList.add('hidden');
            loadUsers();
        }

        console.log('✅ switchTab function defined successfully');

        // --- FETCH ORDERS ---
        async function loadOrders() {
            try {
                const response = await fetch('/api/orders');
                const orders = await response.json();
                const tbody = document.getElementById('orders-table');
                tbody.innerHTML = '';

                orders.forEach(order => {
                    let itemsDisplay = '<span class="text-gray-500">-</span>';
                    try {
                        if (order.items) {
                            const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
                            if (Array.isArray(items) && items.length > 0) {
                                itemsDisplay = items.map(item => {
                                    const name = item.name || 'Товар';
                                    const unit = item.unit || item.packSize || 'шт';
                                    const qty = item.quantity || 1;
                                    const variant = item.variant_info || '';
                                    // If variant_info exists, show it in bold; otherwise show unit
                                    const sizeDisplay = variant ? `<strong>${variant}</strong>` : unit;
                                    return `${name} (${sizeDisplay}) x ${qty}`;
                                }).join(', ');
                            }
                        }
                    } catch (e) {
                        console.error('Error parsing items:', e);
                        itemsDisplay = '<span class="text-gray-500">-</span>';
                    }
                    
                    // Get status with fallback
                    const orderStatus = order.status || 'Новый';
                    const statusColors = {
                        'Новый': 'bg-green-900 text-green-300',
                        'В обработке': 'bg-yellow-900 text-yellow-300',
                        'Отправлен': 'bg-blue-900 text-blue-300',
                        'Доставлен': 'bg-purple-900 text-purple-300',
                        'Отменен': 'bg-red-900 text-red-300'
                    };
                    const statusClass = statusColors[orderStatus] || 'bg-gray-900 text-gray-300';
                    
                    // Escape single quotes in status for JavaScript
                    const escapedStatus = (orderStatus || 'Новый').replace(/'/g, "\\'");
                    // Get user data for email and contact preference
                    const userEmail = order.email || '-';
                    const contactPref = order.contact_preference || 'call';
                    const contactIcons = {
                        'call': '📞',
                        'telegram': '✈️',
                        'viber': '💬'
                    };
                    const contactIcon = contactIcons[contactPref] || '📞';
                    
                    const row = `
                        <tr class="hover:bg-gray-750 transition">
                            <td class="p-4" onclick="event.stopPropagation();">
                                <input type="checkbox" class="order-checkbox w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500" 
                                       value="${order.id}" data-order-id="${order.id}" onchange="updateDeleteButtonState()">
                            </td>
                            <td class="p-4 font-mono text-blue-300 cursor-pointer" onclick="openOrderStatusModal(${order.id}, '${escapedStatus}')">#${order.id}</td>
                            <td class="p-4 text-gray-400 cursor-pointer" onclick="openOrderStatusModal(${order.id}, '${escapedStatus}')">${order.date || ''}</td>
                            <td class="p-4 cursor-pointer" onclick="openOrderStatusModal(${order.id}, '${escapedStatus}')">
                                <div class="font-bold text-white">${order.user_name || order.name || ''}</div>
                                <div class="text-xs text-gray-400">${order.phone || ''}</div>
                            </td>
                            <td class="p-4 text-xs text-gray-400 cursor-pointer" onclick="openOrderStatusModal(${order.id}, '${escapedStatus}')">${userEmail}</td>
                            <td class="p-4 text-center cursor-pointer" onclick="openOrderStatusModal(${order.id}, '${escapedStatus}')" title="${contactPref}">${contactIcon}</td>
                            <td class="p-4 text-gray-300 text-xs cursor-pointer" onclick="openOrderStatusModal(${order.id}, '${escapedStatus}')">
                                ${order.city || ''}<br>${order.warehouse || ''}
                            </td>
                            <td class="p-4 text-gray-300 text-xs italic border-l border-gray-700 cursor-pointer" onclick="openOrderStatusModal(${order.id}, '${escapedStatus}')">
                                ${itemsDisplay}
                            </td>
                            <td class="p-4 font-bold text-green-400 text-lg cursor-pointer" onclick="openOrderStatusModal(${order.id}, '${escapedStatus}')">
                                ${order.total_price || order.total || 0} ₴
                            </td>
                            <td class="p-4 cursor-pointer" onclick="openOrderStatusModal(${order.id}, '${escapedStatus}')">
                                <span class="px-2 py-1 ${statusClass} rounded text-xs">${orderStatus}</span>
                            </td>
                            <td class="p-4" onclick="event.stopPropagation();">
                                <button onclick="confirmDeleteOrder(${order.id})" 
                                        class="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-500 transition">
                                    🗑️
                                </button>
                            </td>
                        </tr>
                    `;
                    tbody.innerHTML += row;
                });
            } catch (e) { 
                console.error("Err orders", e);
                document.getElementById('orders-table').innerHTML = 
                    '<tr><td colspan="11" class="p-4 text-center text-red-400">Ошибка загрузки заказов</td></tr>';
            }
        }

        // --- FETCH PRODUCTS ---
        async function loadProducts() {
            try {
                console.log('🔄 Loading products...');
                const response = await fetch('/products');
                console.log('📡 Response status:', response.status);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const products = await response.json();
                console.log('📦 Products loaded:', products.length);
                console.log('📦 Sample product:', products[0]);
                
                const tbody = document.getElementById('products-table');
                if (!tbody) {
                    console.error('❌ Products table tbody not found');
                    return;
                }
                
                tbody.innerHTML = '';

                if (products.length === 0) {
                    console.log('📦 No products found');
                    tbody.innerHTML = '<tr><td colspan="9" class="p-4 text-center text-gray-400">Нет товаров</td></tr>';
                    return;
                }

                console.log('🔄 Rendering products table...');
                products.forEach((p, index) => {
                    const row = `
                        <tr class="hover:bg-gray-750 transition">
                            <td class="p-3">
                                <input type="checkbox" class="product-checkbox w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500" 
                                       value="${p.id}" data-product-id="${p.id}">
                            </td>
                            <td class="p-3">
                                <img src="${p.image || 'https://via.placeholder.com/50'}" 
                                     alt="${p.name}" 
                                     class="w-12 h-12 object-cover rounded">
                            </td>
                            <td class="p-3 font-semibold text-white">${p.name || '-'}</td>
                            <td class="p-3 text-gray-300">${p.category || '-'}</td>
                            <td class="p-3 text-green-400 font-bold">${p.price || 0} ₴</td>
                            <td class="p-3 text-gray-400 line-through">${p.old_price ? p.old_price + ' ₴' : '-'}</td>
                            <td class="p-3 text-gray-300">${p.unit || 'шт'}</td>
                            <td class="p-3 text-gray-300">${p.pack_sizes || '-'}</td>
                            <td class="p-3">
                                <div class="flex gap-2">
                                    <button onclick="openEditProductModal(${p.id})" 
                                            class="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-500 transition">
                                        ✏️
                                    </button>
                                    <button onclick="deleteProduct(${p.id})" 
                                            class="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-500 transition">
                                        🗑️
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `;
                    tbody.innerHTML += row;
                });
                console.log('✅ Products table rendered successfully');
                loadBanners(); // Load banners also
            } catch (e) { 
                console.error("❌ Error loading products:", e);
                const tbody = document.getElementById('products-table');
                if (tbody) {
                    tbody.innerHTML = 
                        '<tr><td colspan="9" class="p-4 text-center text-red-400">Ошибка загрузки товаров: ' + e.message + '</td></tr>';
                }
            }
        }

        // --- PRODUCT MODAL ---
        // Image upload handler
        document.getElementById('product-images-file').addEventListener('change', async function(e) { /* Placeholder logic moved to uploadMultipleImages */ });
        
        // Multiple images upload handler
        async function uploadMultipleImages() {
            const fileInput = document.getElementById('product-images-file');
            const files = fileInput.files;
            
            if (!files || files.length === 0) {
                alert('Пожалуйста, выберите изображения для загрузки');
                return;
            }
            
            const statusDiv = document.getElementById('images-upload-status');
            const previewContainer = document.getElementById('uploaded-images-preview');
            const urlInput = document.getElementById('product-images');
            
            // Show loading
            statusDiv.classList.remove('hidden');
            previewContainer.innerHTML = '';
            
            try {
                const uploadedUrls = [];
                
                // Upload each file
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    const formData = new FormData();
                    formData.append('file', file);
                    
                    const response = await fetch('/upload', {
                        method: 'POST',
                        body: formData
                    });
                    
                    if (!response.ok) {
                        throw new Error(`Ошибка загрузки файла ${file.name}`);
                    }
                    
                    const data = await response.json();
                    uploadedUrls.push(data.url);
                    
                    // Add preview
                    const previewUrl = data.url.startsWith('http') ? data.url : window.location.origin + data.url;
                    const previewDiv = document.createElement('div');
                    previewDiv.className = 'relative group';
                    previewDiv.innerHTML = `
                        <img src="${previewUrl}" class="w-full h-20 object-cover rounded border border-gray-600">
                        <button type="button" onclick="removeUploadedImage('${data.url}')" 
                                class="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs opacity-0 group-hover:opacity-100 transition">
                            ×
                        </button>
                    `;
                    previewContainer.appendChild(previewDiv);
                }
                
                // Update URLs input
                const existingUrls = urlInput.value.trim();
                const allUrls = existingUrls ? [...existingUrls.split(',').map(u => u.trim()), ...uploadedUrls] : uploadedUrls;
                urlInput.value = allUrls.join(', ');
                
                console.log('✅ Изображения загружены:', uploadedUrls);
                
                // Clear file input
                fileInput.value = '';
                
            } catch (error) {
                console.error('❌ Ошибка загрузки изображений:', error);
                alert('Ошибка загрузки изображений: ' + error.message);
            } finally {
                statusDiv.classList.add('hidden');
            }
        }
        
        // Remove uploaded image
        function removeUploadedImage(urlToRemove) {
            const urlInput = document.getElementById('product-images');
            const previewContainer = document.getElementById('uploaded-images-preview');
            
            // Remove from URLs input
            const urls = urlInput.value.split(',').map(u => u.trim()).filter(u => u !== urlToRemove);
            urlInput.value = urls.join(', ');
            
            // Remove from preview
            const previews = previewContainer.querySelectorAll('img');
            previews.forEach(img => {
                const imgSrc = img.src;
                const url = imgSrc.includes(urlToRemove) ? urlToRemove : imgSrc;
                if (url === urlToRemove || imgSrc.endsWith(urlToRemove)) {
                    img.parentElement.remove();
                }
            });
            
            console.log('🗑️ Изображение удалено:', urlToRemove);
        }
        
        function openAddProductModal() {
            currentEditingId = null;
            document.getElementById('modal-title').textContent = 'Добавить товар';
            document.getElementById('product-id').value = '';
            document.getElementById('product-form').reset();
            document.getElementById('variants-container').innerHTML = ''; // Clear variants
            // Reset images field
            document.getElementById('product-images').value = '';
            document.getElementById('uploaded-images-preview').innerHTML = '';
            // Clear option names field
            document.getElementById('productOptionNames').value = '';
            loadCategories(); // Загружаем категории при открытии модального окна
            setupDiscountCalculator();
            document.getElementById('product-modal').classList.remove('hidden');
        }
        
        // --- VARIANTS MANAGEMENT ---
        function addVariant(size = '', price = '') {
            console.log('🔄 Adding variant with size:', size, 'price:', price);
            const container = document.getElementById('variants-container');
            const variantId = Date.now() + Math.random();
            
            const variantDiv = document.createElement('div');
            variantDiv.className = 'flex gap-2 items-center bg-gray-700 p-3 rounded-lg';
            variantDiv.id = `variant-${variantId}`;
            
            variantDiv.innerHTML = `
                <input type="text" 
                       class="flex-1 px-3 py-2 bg-gray-600 text-white rounded border border-gray-500 focus:outline-none focus:border-blue-500" 
                       placeholder="Размер/вес" 
                       value="${size}"
                       data-variant-size>
                <input type="number" 
                       class="w-32 px-3 py-2 bg-gray-600 text-white rounded border border-gray-500 focus:outline-none focus:border-blue-500" 
                       placeholder="Цена" 
                       value="${price}"
                       data-variant-price>
                <button type="button" 
                        onclick="removeVariant('${variantId}')" 
                        class="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-500 transition">
                    🗑️
                </button>
            `;
            container.appendChild(variantDiv);
        }
        
        function removeVariant(variantId) {
            const variantDiv = document.getElementById(`variant-${variantId}`);
            if (variantDiv) {
                variantDiv.remove();
            } else {
                // Try alternative search method
                const allVariants = document.querySelectorAll('[id^="variant-"]');
                allVariants.forEach(element => {
                    if (element.id.includes(variantId)) {
                        element.remove();
                    }
                });
            }
        }
        
        function getVariants() {
            const container = document.getElementById('variants-container');
            const variants = [];
            const variantDivs = container.querySelectorAll('[id^="variant-"]');
            
            variantDivs.forEach(div => {
                const sizeInput = div.querySelector('[data-variant-size]');
                const priceInput = div.querySelector('[data-variant-price]');
                const size = sizeInput ? sizeInput.value.trim() : '';
                const price = priceInput ? parseFloat(priceInput.value) : 0;
                
                if (size && price > 0) {
                    variants.push({ size: size, price: price });
                }
            });
            
            return variants;
        }

        async function openEditProductModal(id) {
            try {
                const response = await fetch('/products');
                const products = await response.json();
                const product = products.find(p => p.id === id);
                
                if (!product) {
                    console.log('Товар не найден');
                    return;
                }
                
                currentEditingId = id;
                document.getElementById('modal-title').textContent = 'Редактировать товар';
                document.getElementById('product-id').value = id;
                document.getElementById('product-name').value = product.name || '';
                document.getElementById('product-price').value = product.price || '';
                
                // Загружаем категории и затем устанавливаем значение
                await loadCategories();
                const categorySelect = document.getElementById('productCategory');
                if (categorySelect) {
                    categorySelect.value = product.category || '';
                }
                
                document.getElementById('product-images').value = product.images || '';
                
                // Show preview of existing images
                const previewContainer = document.getElementById('uploaded-images-preview');
                previewContainer.innerHTML = '';
                if (product.images) {
                    const imageUrls = product.images.split(',').map(u => u.trim()).filter(u => u);
                    imageUrls.forEach(url => {
                        const previewUrl = url.startsWith('http') ? url : window.location.origin + url;
                        const previewDiv = document.createElement('div');
                        previewDiv.className = 'relative group';
                        previewDiv.innerHTML = `
                            <img src="${previewUrl}" class="w-full h-20 object-cover rounded border border-gray-600">
                            <button type="button" onclick="removeUploadedImage('${url}')" 
                                    class="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs opacity-0 group-hover:opacity-100 transition">
                                ×
                            </button>
                        `;
                        previewContainer.appendChild(previewDiv);
                    });
                }
                
                document.getElementById('product-description').value = product.description || '';
                document.getElementById('product-usage').value = product.usage || '';
                
                // Load new fields
                document.getElementById('product-delivery-info').value = product.delivery_info || '';
                document.getElementById('product-return-info').value = product.return_info || '';
                
                // Load variants
                const variantsContainer = document.getElementById('variants-container');
                variantsContainer.innerHTML = '';
                if (product.variants && Array.isArray(product.variants) && product.variants.length > 0) {
                    product.variants.forEach(variant => {
                        addVariant(variant.size || '', variant.price || '');
                    });
                }
                document.getElementById('product-usage').value = product.usage || '';
                document.getElementById('product-composition').value = product.composition || '';
                document.getElementById('product-old-price').value = product.old_price || '';
                document.getElementById('product-unit').value = product.unit || 'шт';
                document.getElementById('productOptionNames').value = product.option_names || '';
                
                // Setup discount calculator after loading product data
                setupDiscountCalculator();
                
                document.getElementById('product-modal').classList.remove('hidden');
            } catch (e) {
                console.error("Error loading product:", e);
            }
        }

        function closeProductModal() {
            document.getElementById('product-modal').classList.add('hidden');
            currentEditingId = null;
            // Clear variants container
            document.getElementById('variants-container').innerHTML = '';
        }

        // --- DISCOUNT CALCULATOR ---
        function calculateOldPriceFromDiscount() {
            console.log('🔄 Calculating old price from discount...');
            const priceInput = document.getElementById('product-price');
            const discountInput = document.getElementById('product-discount');
            const oldPriceInput = document.getElementById('product-old-price');
            
            const price = parseFloat(priceInput.value);
            const discount = parseFloat(discountInput.value);
            
            // Only calculate if both price and discount are valid numbers
            if (!isNaN(price) && price > 0 && !isNaN(discount) && discount > 0 && discount < 100) {
                // Formula: old_price = price / (1 - (discount / 100))
                const oldPrice = price / (1 - (discount / 100));
                oldPriceInput.value = oldPrice.toFixed(2);
            }
        }

        // Setup event listeners for discount calculation
        function setupDiscountCalculator() {
            const priceInput = document.getElementById('product-price');
            const discountInput = document.getElementById('product-discount');
            
            if (priceInput && discountInput) {
                priceInput.addEventListener('input', calculateOldPriceFromDiscount);
                priceInput.addEventListener('change', calculateOldPriceFromDiscount);
                discountInput.addEventListener('input', calculateOldPriceFromDiscount);
                discountInput.addEventListener('change', calculateOldPriceFromDiscount);
            }
        }

        // --- SAVE PRODUCT ---
        async function saveProduct(event) {
            event.preventDefault();
            
            // Build payload object with all fields
            const variants = getVariants();
            const usageValue = document.getElementById('product-usage').value.trim();
            
            // Smart Price Logic
            const priceInput = document.getElementById('product-price').value.trim();
            let finalPrice = null;
            
            if (priceInput === '') {
                // Цена пустая - проверяем варианты
                if (variants.length > 0) {
                    // Находим минимальную цену среди вариантов
                    finalPrice = Math.min(...variants.map(v => v.price));
                } else {
                    // Нет цены и нет вариантов - ошибка
                    alert('Вкажіть ціну або додайте варіанти');
                    return;
                }
            } else {
                // Цена указана - используем её
                finalPrice = parseFloat(priceInput);
            }
            
            const payload = {
                name: document.getElementById('product-name').value,
                price: finalPrice,
                category: document.getElementById('productCategory').value || null,
                image: document.getElementById('product-images').value ? document.getElementById('product-images').value.split(',')[0].trim() : '',
                images: document.getElementById('product-images').value.trim() || null,
                description: document.getElementById('product-description').value.trim() || null,
                usage: usageValue || null,
                composition: document.getElementById('product-composition').value.trim() || null,
                old_price: document.getElementById('product-old-price').value ? parseFloat(document.getElementById('product-old-price').value) : null,
                unit: document.getElementById('product-unit').value || "шт",
                pack_sizes: [], // Keep for compatibility but empty
                variants: variants.length > 0 ? variants : null,
                option_names: document.getElementById('productOptionNames').value.trim() || null,
                delivery_info: document.getElementById('product-delivery-info').value.trim() || null,
                return_info: document.getElementById('product-return-info').value.trim() || null
            };
            
            try {
                let response;
                if (currentEditingId) {
                    // Update
                    response = await fetch(`/products/${currentEditingId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                } else {
                    // Create
                    response = await fetch('/products', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                }

                if (response.ok) {
                    closeProductModal();
                    loadProducts();
                    console.log('Товар успешно сохранен');
                } else {
                    const error = await response.json();
                    console.error('Ошибка: ' + (error.detail || 'Неизвестная ошибка'));
                }
            } catch (e) {
                console.error("Error saving product:", e);
            }
        }

        // --- TOGGLE SELECT ALL ---
        function toggleSelectAll(checked) {
            const checkboxes = document.querySelectorAll('.product-checkbox');
            checkboxes.forEach(checkbox => {
                checkbox.checked = checked;
            });
        }

        // --- DELETE PRODUCT ---
        async function deleteProduct(id) {
            try {
                const response = await fetch(`/products/${id}`, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    loadProducts();
                } else {
                    const error = await response.json();
                    alert('❌ Ошибка удаления: ' + (error.detail || 'Неизвестная ошибка'));
                }
            } catch (e) {
                alert('❌ Ошибка сети при удалении товара');
            }
        }

        // --- DELETE SELECTED PRODUCTS ---
        function getSelectedProductIds() {
            const checkboxes = document.querySelectorAll('.product-checkbox:checked');
            return Array.from(checkboxes).map(cb => parseInt(cb.dataset.productId));
        }

        function handleDeleteSelected() {
            const selectedIds = getSelectedProductIds();
            if (selectedIds.length === 0) {
                alert('Выберите товары для удаления');
                return;
            }
            
            deleteSelectedProducts(selectedIds);
        }

        async function deleteSelectedProducts(ids) {
            try {
                // Delete products sequentially
                let successCount = 0;
                let errorCount = 0;

                for (const id of ids) {
                    try {
                        const response = await fetch(`/products/${id}`, {
                            method: 'DELETE'
                        });
                        if (response.ok) {
                            successCount++;
                        } else {
                            errorCount++;
                        }
                    } catch (e) {
                        errorCount++;
                    }
                }

                // Reset select all checkbox
                document.getElementById('select-all-checkbox').checked = false;
                
                // Reload products
                loadProducts();
                
                if (errorCount > 0) {
                    alert(`⚠️ Удалено: ${successCount}, Ошибок: ${errorCount}`);
                } else {
                    console.log(`✅ Успешно удалено товаров: ${successCount}`);
                }
            } catch (e) {
                alert('❌ Критическая ошибка при удалении товаров');
            }
        }

        // --- ORDER STATUS MODAL ---
        function openOrderStatusModal(orderId, currentStatus) {
            currentOrderId = orderId;
            const select = document.getElementById('order-status-select');
            select.value = currentStatus || 'Новый';
            document.getElementById('order-status-modal').classList.remove('hidden');
        }

        function closeOrderStatusModal() {
            document.getElementById('order-status-modal').classList.add('hidden');
            currentOrderId = null;
        }

        async function saveOrderStatus() {
            if (!currentOrderId) return;

            const select = document.getElementById('order-status-select');
            const newStatus = select.value;

            try {
                const response = await fetch(`/orders/${currentOrderId}/status`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ new_status: newStatus })
                });

                if (response.ok) {
                    closeOrderStatusModal();
                    loadOrders(); // Refresh the table
                } else {
                    const error = await response.json();
                    console.error('Ошибка: ' + (error.detail || 'Неизвестная ошибка'));
                }
            } catch (e) {
                console.error("Error updating order status:", e);
            }
        }

        // --- EXPORT ORDERS TO EXCEL ---
        async function exportOrders() {
            try {
                const response = await fetch('/orders/export');
                if (!response.ok) {
                    alert('Ошибка экспорта');
                    return;
                }
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'orders.csv';
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            } catch (e) {
                console.error("Error exporting orders:", e);
            }
        }

        // --- DELETE ORDER ---
        function confirmDeleteOrder(orderId) {
            if(confirm('Вы уверены, что хотите удалить этот заказ?')) {
                deleteOrder(orderId);
            }
        }

        async function deleteOrder(orderId) {
            try {
                const response = await fetch(`/orders/${orderId}`, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    loadOrders();
                } else {
                    alert('Ошибка удаления заказа');
                }
            } catch (e) {
                alert('Ошибка при удалении заказа');
            }
        }

        // --- BATCH DELETE ORDERS ---
        function toggleSelectAllOrders(checked) {
            const checkboxes = document.querySelectorAll('.order-checkbox');
            checkboxes.forEach(checkbox => {
                checkbox.checked = checked;
            });
            updateDeleteButtonState();
        }

        function updateDeleteButtonState() {
            const deleteBtn = document.getElementById('delete-selected-orders-btn');
            const selectedIds = getSelectedOrderIds();
            if (selectedIds.length > 0) {
                deleteBtn.disabled = false;
            } else {
                deleteBtn.disabled = true;
            }
        }

        function getSelectedOrderIds() {
            const checkboxes = document.querySelectorAll('.order-checkbox:checked');
            return Array.from(checkboxes).map(cb => parseInt(cb.dataset.orderId));
        }

        async function deleteSelectedOrders() {
            const selectedIds = getSelectedOrderIds();
            if (selectedIds.length === 0) return;
            if (!confirm(`Вы уверены, что хотите удалить ${selectedIds.length} заказ(ов)?`)) return;
            
            try {
                const response = await fetch('/orders/delete-batch', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ids: selectedIds })
                });

                if (response.ok) {
                    loadOrders();
                    updateDeleteButtonState();
                } else {
                    alert('Ошибка удаления заказов');
                }
            } catch (e) {
                alert('Ошибка при удалении заказов');
            }
        }

        // --- IMPORT XML (URL) ---
        async function importXML() {
            const url = document.getElementById('xml-url-input').value.trim();
            if (!url) {
                console.log('Введите URL XML файла');
                return;
            }

            try {
                const response = await fetch('/api/import_xml', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: url })
                });

                const result = await response.json();
                
                if (response.ok) {
                    console.log(`Успешно импортировано товаров: ${result.count || 0}`);
                    document.getElementById('xml-url-input').value = '';
                    loadProducts();
                } else {
                    console.error('Ошибка импорта: ' + (result.detail || 'Неизвестная ошибка'));
                }
            } catch (e) {
                console.error("Error importing XML:", e);
            }
        }

        // --- UPLOAD CSV ---
        async function uploadCSV() {
            const fileInput = document.getElementById('csvFile');
            if (!fileInput.files[0]) {
                console.log("Пожалуйста, выберите CSV файл!");
                return;
            }

            const formData = new FormData();
            formData.append('file', fileInput.files[0]);

            try {
                const response = await fetch('/upload_csv', { method: 'POST', body: formData });
                const result = await response.json();
                
                if (response.ok) {
                    console.log(result.count ? `Успешно импортировано: ${result.count}` : "Импорт успешен!");
                    fileInput.value = '';
                    loadProducts();
                } else {
                    console.error("Ошибка импорта: " + (result.detail || "Неизвестная ошибка"));
                }
            } catch (e) {
                console.error("Error uploading CSV:", e);
            }
        }

        // --- CATEGORY MANAGEMENT ---
        async function loadCategories() {
            try {
                const response = await fetch('/all-categories');
                const categories = await response.json();
                const select = document.getElementById('productCategory');
                
                if (!select) return;
                const currentValue = select.value;
                select.innerHTML = '<option value="">Выберите категорию...</option>';
                
                categories.forEach(cat => {
                    const option = document.createElement('option');
                    option.value = cat.name;
                    option.textContent = cat.name;
                    select.appendChild(option);
                });
                
                if (currentValue) select.value = currentValue;
                
                // Update list in modal
                const list = document.getElementById('categoryList');
                if(list) {
                    list.innerHTML = '';
                    categories.forEach(cat => {
                        const li = document.createElement('li');
                        li.className = 'flex justify-between items-center p-3 bg-gray-700 rounded-lg mb-2';
                        li.innerHTML = `
                            <span class="text-white">${cat.name}</span>
                            <button onclick="deleteCategory(${cat.id})" class="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-500 transition">🗑️</button>
                        `;
                        list.appendChild(li);
                    });
                }
            } catch (e) {
                console.error("Error loading categories:", e);
            }
        }

        function openCategoryModal() {
            document.getElementById('categoryModal').classList.remove('hidden');
            loadCategories();
        }

        function closeCategoryModal() {
            document.getElementById('categoryModal').classList.add('hidden');
            document.getElementById('newCategoryName').value = '';
            loadCategories();
        }

        async function addCategory() {
            const input = document.getElementById('newCategoryName');
            const name = input.value.trim();
            if (!name) return;
            
            try {
                const response = await fetch('/categories', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: name })
                });
                if (response.ok) {
                    input.value = '';
                    loadCategories();
                }
            } catch (e) {}
        }

        async function deleteCategory(id) {
            if (!id) return;
            try {
                const response = await fetch(`/categories/${id}`, { method: 'DELETE' });
                if (response.ok) loadCategories();
            } catch (e) {}
        }

        // --- BANNER MANAGEMENT ---
        async function loadBanners() {
            try {
                const response = await fetch('/banners');
                const banners = await response.json();
                const container = document.getElementById('bannersList');
                
                if (!container) return;
                
                container.innerHTML = '';
                if (banners.length === 0) {
                    container.innerHTML = '<p class="text-gray-400 col-span-full">Баннеры не найдены</p>';
                    return;
                }
                
                banners.forEach(banner => {
                    const bannerDiv = document.createElement('div');
                    bannerDiv.className = 'bg-gray-700 rounded-lg p-4 border border-gray-600';
                    bannerDiv.innerHTML = `
                        <img src="${banner.image_url}" alt="Banner ${banner.id}" 
                             style="width: 200px; height: auto; border-radius: 8px; margin-bottom: 10px; object-fit: cover; max-height: 150px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span class="text-gray-300 text-sm">ID: ${banner.id}</span>
                            <button onclick="deleteBanner(${banner.id})" 
                                    class="px-3 py-1 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-500 transition">
                                🗑️ Удалить
                            </button>
                        </div>
                    `;
                    container.appendChild(bannerDiv);
                });
            } catch (e) { console.error(e); }
        }

        async function createBanner() {
            const fileInput = document.getElementById('bannerFile');
            const urlInput = document.getElementById('bannerUrl');
            let imageUrl = '';
            
            if (fileInput.files && fileInput.files.length > 0) {
                const file = fileInput.files[0];
                const reader = new FileReader();
                reader.onload = async function(e) {
                    imageUrl = e.target.result;
                    await sendBanner(imageUrl);
                };
                reader.readAsDataURL(file);
                return;
            } else if (urlInput.value.trim()) {
                imageUrl = urlInput.value.trim();
            } else {
                return;
            }
            
            await sendBanner(imageUrl);
        }
        
        async function sendBanner(imageUrl) {
            const fileInput = document.getElementById('bannerFile');
            const urlInput = document.getElementById('bannerUrl');
            try {
                const response = await fetch('/banners', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ image_url: imageUrl })
                });
                if (response.ok) {
                    fileInput.value = '';
                    urlInput.value = '';
                    await loadBanners();
                }
            } catch (e) {}
        }

        async function deleteBanner(id) {
            try {
                const response = await fetch(`/banners/${id}`, { method: 'DELETE' });
                if (response.ok) await loadBanners();
            } catch (e) {}
        }

        // --- PROMO CODES ---
        async function loadPromoCodes() {
            try {
                const response = await fetch('/api/promo-codes');
                const promos = await response.json();
                const tbody = document.getElementById('promocodes-table');
                tbody.innerHTML = '';
                
                promos.forEach(p => {
                    const tr = document.createElement('tr');
                    tr.className = 'hover:bg-gray-700/50 transition';
                    const activeClass = p.active ? 'text-green-400' : 'text-red-400';
                    const activeText = p.active ? 'Активен' : 'Отключен';
                    
                    tr.innerHTML = `
                        <td class="p-4 font-bold text-white">${p.code}</td>
                        <td class="p-4 text-green-400 font-bold">${p.discount_percent ? p.discount_percent + '%' : p.discount_amount + ' ₴'}</td>
                        <td class="p-4 text-gray-300">${p.max_uses || '∞'}</td>
                        <td class="p-4 text-gray-300">${p.current_uses}</td>
                        <td class="p-4 text-gray-300">${p.expires_at ? new Date(p.expires_at).toLocaleDateString() : '-'}</td>
                        <td class="p-4 ${activeClass}">${activeText}</td>
                        <td class="p-4">
                            <button onclick="togglePromo(${p.id})" class="text-blue-400 hover:text-blue-300 mr-2" title="Вкл/Выкл">🔄</button>
                            <button onclick="deletePromo(${p.id})" class="text-red-400 hover:text-red-300" title="Удалить">🗑️</button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            } catch (e) { console.error(e); }
        }

        function openAddPromoCodeModal() {
            document.getElementById('promoCodeModal').classList.remove('hidden');
        }

        function closePromoCodeModal() {
            document.getElementById('promoCodeModal').classList.add('hidden');
            document.getElementById('promo-code').value = '';
            document.getElementById('promo-percent').value = '0';
            document.getElementById('promo-amount').value = '0';
            document.getElementById('promo-max-uses').value = '0';
            document.getElementById('promo-expires').value = '';
        }

        async function createPromoCode(e) {
            e.preventDefault();
            const code = document.getElementById('promo-code').value.trim();
            const percent = parseInt(document.getElementById('promo-percent').value) || 0;
            const amount = parseFloat(document.getElementById('promo-amount').value) || 0;
            const maxUses = parseInt(document.getElementById('promo-max-uses').value) || 0;
            const expires = document.getElementById('promo-expires').value;
            
            if (!code) return;

            try {
                const response = await fetch('/api/promo-codes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        code,
                        discount_percent: percent,
                        discount_amount: amount,
                        max_uses: maxUses,
                        expires_at: expires ? new Date(expires).toISOString() : null
                    })
                });
                
                if (response.ok) {
                    closePromoCodeModal();
                    loadPromoCodes();
                } else {
                    const err = await response.json();
                    alert('Ошибка: ' + err.detail);
                }
            } catch (e) { console.error(e); }
        }

        async function deletePromo(id) {
            if(!confirm('Удалить промокод?')) return;
            try {
                await fetch('/api/promo-codes/' + id, { method: 'DELETE' });
                loadPromoCodes();
            } catch (e) { console.error(e); }
        }

        async function togglePromo(id) {
            try {
                await fetch('/api/promo-codes/' + id + '/toggle', { method: 'PUT' });
                loadPromoCodes();
            } catch (e) { console.error(e); }
        }

        // Init
        console.log('🚀 Initializing admin panel...');
        loadOrders();
        loadCategories();
        loadBanners();
        loadBanners();
        setInterval(() => {
            loadOrders();
        }, 10000);
        console.log('✅ Admin script loaded successfully');
    </script>
</body>
</html>
"""

# --- НАСТРОЙКИ ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

# --- ПАПКИ ---
os.makedirs("uploads", exist_ok=True)

# --- БАЗА ДАННЫХ ---
def get_db_connection():
    raw = psycopg2.connect(DATABASE_URL)
    return _PGConnAdapter(raw)

def fix_db_schema():
    conn = get_db_connection()
    c = conn.cursor()

    # Tables (PostgreSQL)
    c.execute('''
        CREATE TABLE IF NOT EXISTS products (
            id BIGSERIAL PRIMARY KEY,
            name TEXT,
            price DOUBLE PRECISION,
            discount INTEGER DEFAULT 0,
            image TEXT,
            images TEXT,
            category TEXT,
            pack_sizes TEXT,
            old_price DOUBLE PRECISION,
            unit TEXT DEFAULT 'шт',
            description TEXT,
            usage TEXT,
            composition TEXT,
            delivery_info TEXT,
            return_info TEXT,
            variants TEXT,
            option_names TEXT,
            external_id TEXT UNIQUE
        )
    ''')

    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            phone TEXT PRIMARY KEY,
            bonus_balance INTEGER DEFAULT 0,
            total_spent DOUBLE PRECISION DEFAULT 0,
            cashback_percent INTEGER DEFAULT 0,
            referrer TEXT,
            created_at TEXT,
            name TEXT,
            city TEXT,
            warehouse TEXT,
            email TEXT,
            contact_preference TEXT DEFAULT 'call'
        )
    ''')

    c.execute('''
        CREATE TABLE IF NOT EXISTS orders (
            id BIGSERIAL PRIMARY KEY,
            name TEXT,
            phone TEXT,
            user_phone TEXT,
            email TEXT,
            contact_preference TEXT DEFAULT 'call',
            city TEXT,
            city_ref TEXT,
            warehouse TEXT,
            warehouse_ref TEXT,
            items TEXT,
            total_price DOUBLE PRECISION,
            payment_method TEXT DEFAULT 'card',
            bonus_used INTEGER DEFAULT 0,
            status TEXT DEFAULT 'New',
            date TEXT
        )
    ''')

    c.execute('''
        CREATE TABLE IF NOT EXISTS categories (
            id BIGSERIAL PRIMARY KEY,
            name TEXT UNIQUE
        )
    ''')

    c.execute('''
        CREATE TABLE IF NOT EXISTS banners (
            id BIGSERIAL PRIMARY KEY,
            image_url TEXT
        )
    ''')

    c.execute('''
        CREATE TABLE IF NOT EXISTS promo_codes (
            id BIGSERIAL PRIMARY KEY,
            code TEXT UNIQUE NOT NULL,
            discount_percent INTEGER DEFAULT 0,
            discount_amount DOUBLE PRECISION DEFAULT 0,
            max_uses INTEGER DEFAULT 0,
            current_uses INTEGER DEFAULT 0,
            active INTEGER DEFAULT 1,
            expires_at TEXT,
            created_at TEXT
        )
    ''')

    c.execute('''
        CREATE TABLE IF NOT EXISTS reviews (
            id BIGSERIAL PRIMARY KEY,
            product_id BIGINT NOT NULL,
            user_name TEXT,
            user_phone TEXT,
            rating INTEGER NOT NULL,
            comment TEXT,
            created_at TEXT
        )
    ''')

    # Column migrations (idempotent in Postgres)
    c.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS composition TEXT")
    c.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS images TEXT")
    c.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS variants TEXT")
    c.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS option_names TEXT")
    c.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS delivery_info TEXT")
    c.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS return_info TEXT")
    c.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS external_id TEXT")
    try:
        c.execute("CREATE UNIQUE INDEX IF NOT EXISTS products_external_id_uq ON products (external_id)")
    except Exception:
        # If duplicates already exist, index creation may fail; keep server running.
        pass

    conn.commit()
    conn.close()


class ProductCreate(BaseModel):
    name: str
    price: float
    category: Optional[str] = None
    image: Optional[str] = None
    images: Optional[str] = None
    description: Optional[str] = None
    usage: Optional[str] = None
    composition: Optional[str] = None
    old_price: Optional[float] = None
    unit: str = "шт"
    variants: Optional[List[Dict[str, Any]]] = None # JSON list
    option_names: Optional[str] = None
    delivery_info: Optional[str] = None
    return_info: Optional[str] = None
    pack_sizes: Optional[Any] = None # Legacy

class OrderStatusUpdate(BaseModel):
    new_status: str

class BatchDelete(BaseModel):
    ids: List[int]

class CategoryCreate(BaseModel):
    name: str

class BannerCreate(BaseModel):
    image_url: str

class PromoCodeCreate(BaseModel):
    code: str
    discount_percent: int = 0
    discount_amount: float = 0
    max_uses: int = 0
    expires_at: Optional[str] = None

class PromoCodeValidate(BaseModel):
    code: str


# --- CHAT MODELS ---
class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]


# --- CHAT SEARCH HELPERS ---
_CHAT_STOPWORDS = {
    # UA
    "і", "й", "та", "або", "але", "не", "ні", "так", "це", "ця", "цей", "ці",
    "я", "ти", "він", "вона", "воно", "вони", "ми", "ви", "мені", "тобі", "йому", "їй",
    "у", "в", "на", "до", "від", "з", "із", "зі", "за", "для", "про", "по", "над", "під",
    "що", "як", "де", "коли", "чи", "щоб", "аби", "бо", "тому", "томущо",
    "будь", "ласка", "будьласка", "порадь", "поради", "підкажи", "підкажіть",
    "хочу", "потрібно", "треба", "можна", "можете", "можеш", "допоможи", "допоможіть",
    "мені", "нам", "вам", "його", "її", "їх",
    # RU
    "и", "й", "или", "но", "а", "не", "ни", "да", "нет", "это", "эта", "этот", "эти",
    "я", "ты", "он", "она", "оно", "они", "мы", "вы", "мне", "тебе", "ему", "ей",
    "в", "во", "на", "до", "от", "из", "за", "для", "про", "по", "над", "под",
    "что", "как", "где", "когда", "ли", "чтобы", "потому", "почему",
    "пожалуйста", "посоветуйте", "посоветуй", "подскажи", "подскажите",
    "хочу", "нужно", "надо", "можно", "можете", "можешь", "помоги", "помогите",
}


def _chat_normalize_text(text: str) -> str:
    if not text:
        return ""
    t = str(text).lower().strip()
    # Normalize some UA/RU chars to improve cross-language matching
    t = (
        t.replace("ё", "е")
        .replace("’", "'")
        .replace("ʼ", "'")
        .replace("`", "'")
        .replace("ґ", "г")
        .replace("є", "е")
        .replace("і", "и")
        .replace("ї", "и")
    )
    return t


def _chat_tokenize(text: str) -> List[str]:
    import re

    t = _chat_normalize_text(text)
    raw = re.findall(r"[a-zа-я0-9']{2,}", t, flags=re.IGNORECASE)
    tokens: List[str] = []
    for tok in raw:
        tok = tok.strip("'")
        if len(tok) < 2:
            continue
        if tok in _CHAT_STOPWORDS:
            continue
        tokens.append(tok)
    return tokens


def _chat_stem_token(token: str) -> str:
    # Very light stemming for UA/RU declensions; avoids heavy NLP deps.
    t = token
    if len(t) < 5:
        return t

    suffixes = [
        # common plural/case endings
        "ями", "ами", "ими", "ого", "ому", "ему", "ого", "ого", "ами", "ями",
        "ах", "ях", "ам", "ям", "ом", "ем", "ою", "ею",
        "ів", "ев", "ов", "ей", "ий", "ый", "ая", "яя", "ое", "ее",
        "у", "ю", "а", "я", "і", "и", "е", "о",
    ]
    for suf in suffixes:
        if len(t) - len(suf) >= 4 and t.endswith(suf):
            return t[: -len(suf)]
    return t


_CHAT_INTENTS = {
    "sleep": ["сон", "сну", "sleep", "insomnia", "безсон", "бессон", "засин", "пробуджен"],
    "immunity": ["иммун", "имун", "застуд", "простуд", "грип", "вирус", "вірус"],
    "stress": ["стрес", "тривог", "тревог", "нерв", "паник", "депрес", "вигоран", "выгоран"],
    "energy": ["енерг", "энерг", "втом", "устал", "витрив", "спорт", "либид", "лібід"],
    "focus": ["памят", "пам'", "памятт", "фокус", "уваг", "вниман", "мозок", "мозг"],
    "digest": ["шлунк", "желуд", "киш", "травлен", "печен", "печін", "детокс", "detox"],
}


_CHAT_FAMILY_BOOSTS = {
    # Intent -> [(keywords_in_product_name, boost)]
    "sleep": [(["рейш", "reishi"], 14)],
    "stress": [(["рейш", "reishi"], 12), (["ашваганд"], 12)],
    "immunity": [(["чаг", "chaga"], 14), (["рейш", "reishi"], 10)],
    "energy": [(["кордицеп", "cordyceps"], 14), (["женьшен", "женьш", "ginseng"], 10)],
    "focus": [(["ижовик", "ежовик", "lion", "mane"], 14)],
}


def _chat_detect_intents(normalized_text: str) -> List[str]:
    intents: List[str] = []
    for intent, needles in _CHAT_INTENTS.items():
        if any(n in normalized_text for n in needles):
            intents.append(intent)
    return intents


def _chat_score_product(product: dict, token_patterns: List[tuple], intents: List[str]) -> float:
    # token_patterns: List[(token, compiled_regex)]
    import re

    name = _chat_normalize_text(product.get("name") or "")
    category = _chat_normalize_text(product.get("category") or "")
    desc = _chat_normalize_text(product.get("description") or "")
    usage = _chat_normalize_text(product.get("usage") or "")
    comp = _chat_normalize_text(product.get("composition") or "")
    full = " ".join([name, category, desc, usage, comp])

    score = 0.0
    for token, pattern in token_patterns:
        # Prefer exact-ish word matches, but allow substring for Latin part of names.
        if pattern.search(name):
            score += 9
        elif token in name:
            score += 7

        if pattern.search(category):
            score += 4
        if pattern.search(usage):
            score += 3
        if pattern.search(desc):
            score += 2
        if pattern.search(comp):
            score += 1.5

    # Light bigram/phrase bonus
    tokens_only = [t for t, _ in token_patterns]
    if len(tokens_only) >= 2:
        for a, b in zip(tokens_only, tokens_only[1:]):
            phrase = f"{a} {b}"
            if phrase in name:
                score += 8
            elif phrase in desc or phrase in usage:
                score += 4

    # Intent boosts (only when product name contains strong family keywords)
    for intent in intents:
        for keywords, boost in _CHAT_FAMILY_BOOSTS.get(intent, []):
            if any(k in name for k in keywords):
                score += float(boost)

    # Small penalty for ultra-generic matches (helps reduce irrelevant results)
    if score > 0 and len(full) > 0:
        generic_hits = 0
        for token, pattern in token_patterns:
            if token in {"здоров", "организм", "організм", "тонус", "сила"} and pattern.search(full):
                generic_hits += 1
        if generic_hits >= 2:
            score -= 4

    return score

class ReviewCreate(BaseModel):
    product_id: int
    user_name: str
    user_phone: Optional[str] = None
    rating: int  # 1-5
    comment: Optional[str] = None

class OrderItem(BaseModel):
    id: int
    name: str
    price: float
    quantity: int
    packSize: Optional[str] = None
    unit: Optional[str] = None
    variant_info: Optional[str] = None

class OrderRequest(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    contact_preference: Optional[str] = "call"
    city: str
    cityRef: Optional[str] = None
    warehouse: str
    warehouseRef: Optional[str] = None
    items: List[OrderItem]
    totalPrice: float
    payment_method: str = "card"
    bonus_used: int = 0
    use_bonuses: bool = False
    user_phone: Optional[str] = None

class UserUpdate(BaseModel):
    bonus_balance: int
    total_spent: float

class UserInfoUpdate(BaseModel):
    name: Optional[str] = None
    city: Optional[str] = None
    warehouse: Optional[str] = None
    email: Optional[str] = None
    contact_preference: Optional[str] = None

class UserAuth(BaseModel):
    phone: str

class XmlImport(BaseModel):
    url: str

class UserResponse(BaseModel):
    phone: str
    bonus_balance: int = 0
    total_spent: float = 0.0
    cashback_percent: int = 0
    name: Optional[str] = None
    city: Optional[str] = None
    warehouse: Optional[str] = None
    email: Optional[str] = None
    contact_preference: Optional[str] = None
    referrer: Optional[str] = None
    created_at: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

# --- APP ---
app = FastAPI()
@app.get("/health")
def health_check():
    return {"status": "ok", "message": "Server is running"}
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)
UPLOADS_DIR = os.path.abspath(os.getenv("UPLOADS_DIR", "uploads"))
os.makedirs(UPLOADS_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")


@app.get("/api/image")
def get_resized_image(
    request: Request,
    src: str,
    w: int = 0,
    h: int = 0,
    q: int = 80,
    format: str = "jpg",
):
    """Serve a resized/cached version of an uploaded image.

    Motivation: avoid Android Fresco OOM (Pool hard cap violation) by preventing
    decoding of multi-megapixel originals for UI-sized images (banners/cards).

    Security: only allows local files under ./uploads.
    """
    fmt = (format or "jpg").lower().strip(".")
    if fmt == "jpeg":
        fmt = "jpg"
    if fmt not in {"jpg", "png", "webp"}:
        raise HTTPException(status_code=400, detail="Unsupported format")

    try:
        quality = int(q)
    except Exception:
        quality = 80
    quality = max(30, min(95, quality))

    try:
        max_w = int(w)
        max_h = int(h)
    except Exception:
        max_w, max_h = 0, 0

    # Reasonable defaults if not provided.
    if max_w <= 0 and max_h <= 0:
        max_w = 1200
    if max_w <= 0:
        max_w = 99999
    if max_h <= 0:
        max_h = 99999

    # Normalize src: accept full URL, /uploads/..., uploads/...
    safe_src = (src or "").strip()
    if not safe_src:
        raise HTTPException(status_code=400, detail="src is required")

    if safe_src.startswith("http://") or safe_src.startswith("https://"):
        # Extract path part only
        try:
            from urllib.parse import urlparse

            safe_src = urlparse(safe_src).path
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid src URL")

    if safe_src.startswith("/uploads/"):
        rel_path = safe_src[len("/uploads/") :]
    elif safe_src.startswith("uploads/"):
        rel_path = safe_src[len("uploads/") :]
    else:
        # Only support uploads
        raise HTTPException(status_code=400, detail="src must point to /uploads")

    # Prevent path traversal
    rel_path = rel_path.lstrip("/\\")
    norm_rel = os.path.normpath(rel_path)
    if norm_rel.startswith("..") or os.path.isabs(norm_rel):
        raise HTTPException(status_code=400, detail="Invalid src path")

    uploads_dir = UPLOADS_DIR
    src_path = os.path.abspath(os.path.join(uploads_dir, norm_rel))
    if os.path.commonpath([uploads_dir, src_path]) != uploads_dir:
        raise HTTPException(status_code=400, detail="Invalid src path")

    src_bytes: Optional[bytes] = None
    src_mtime = 0
    if os.path.exists(src_path) and os.path.isfile(src_path):
        try:
            src_mtime = int(os.path.getmtime(src_path))
        except Exception:
            src_mtime = 0
    else:
        # Production can serve /uploads via nginx or a different volume.
        # If file is not present locally, fetch it over HTTP from the same host.
        base = os.getenv("PUBLIC_BASE_URL")
        if base:
            base = base.rstrip("/")
        else:
            # Try to reconstruct external base from request
            proto = request.headers.get("x-forwarded-proto") or request.url.scheme
            host = request.headers.get("x-forwarded-host") or request.headers.get("host")
            if not host:
                raise HTTPException(status_code=404, detail="Image not found")
            base = f"{proto}://{host}".rstrip("/")

        remote_url = f"{base}{safe_src if safe_src.startswith('/uploads/') else '/uploads/' + norm_rel}"
        try:
            r = httpx.get(remote_url, timeout=15.0, follow_redirects=True)
            if r.status_code != 200:
                raise HTTPException(status_code=404, detail="Image not found")
            ctype = r.headers.get("content-type", "")
            if not ctype.startswith("image/"):
                raise HTTPException(status_code=404, detail="Image not found")
            src_bytes = r.content
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=404, detail="Image not found")

    cache_dir = os.path.join(uploads_dir, ".cache")
    os.makedirs(cache_dir, exist_ok=True)

    # If we have local file mtime, include it to invalidate cache on file change.
    # If this is a remotely fetched image, filenames are typically immutable.
    key = f"{norm_rel}|{max_w}|{max_h}|{quality}|{fmt}|{src_mtime}"
    digest = hashlib.md5(key.encode("utf-8")).hexdigest()
    cached_path = os.path.join(cache_dir, f"img_{digest}.{fmt}")

    if not os.path.exists(cached_path):
        try:
            if src_bytes is not None:
                im_src = BytesIO(src_bytes)
                im_ctx = PILImage.open(im_src)
            else:
                im_ctx = PILImage.open(src_path)

            with im_ctx as im:
                im = ImageOps.exif_transpose(im)

                # Convert to a compatible mode for JPEG/WebP
                if fmt in {"jpg", "webp"} and im.mode not in {"RGB", "RGBA"}:
                    im = im.convert("RGB")

                im.thumbnail((max_w, max_h), resample=PILImage.Resampling.LANCZOS)

                save_kwargs = {}
                if fmt == "jpg":
                    save_kwargs = {
                        "format": "JPEG",
                        "quality": quality,
                        "optimize": True,
                        "progressive": True,
                    }
                elif fmt == "png":
                    save_kwargs = {"format": "PNG", "optimize": True}
                elif fmt == "webp":
                    save_kwargs = {"format": "WEBP", "quality": quality, "method": 6}

                im.save(cached_path, **save_kwargs)
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Resize failed: {e}")

    media_type = {
        "jpg": "image/jpeg",
        "png": "image/png",
        "webp": "image/webp",
    }[fmt]

    headers = {
        "Cache-Control": "public, max-age=86400",
    }
    return FileResponse(cached_path, media_type=media_type, headers=headers)

# --- INITIALIZATION ---
@app.on_event("startup")
def startup_event():
    fix_db_schema()
    # Создаем admin.html из строки только если его нет
    # Это позволяет вручную обновлять admin.html без перезаписи
    # if not os.path.exists("admin.html"):
    #     with open("admin.html", "w", encoding="utf-8") as f:
    #         f.write(ADMIN_HTML_CONTENT)
    print("✅ Server started successfully")

# --- ONEBOX ---


# --- API ENDPOINTS ---

# 1. ТОВАРЫ
@app.get("/products")
def get_products():
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM products ORDER BY id DESC").fetchall()
    res = []
    for r in rows:
        d = dict(r)
        # Handle variants JSON
        if d.get("variants"):
            try:
                d["variants"] = json.loads(d["variants"])
            except:
                d["variants"] = []
        res.append(d)
    conn.close()
    return res

@app.get("/products/by-external-id")
def get_product_by_external_id_query(external_id: str):
    # Normalize incoming external_id
    normalized = external_id.strip().lower()
    normalized = normalized.replace('https://', '').replace('http://', '')
    normalized = normalized.replace('www.', '')
    normalized = normalized.rstrip('/')
    
    conn = get_db_connection()
    try:
        row = conn.execute("""
            SELECT id, name, price, discount, image, images, category, pack_sizes,
                   old_price, unit, description, usage, delivery_info, return_info,
                   variants, option_names, external_id
            FROM products 
            WHERE LOWER(
                RTRIM(
                    REPLACE(
                        REPLACE(
                            REPLACE(
                                REPLACE(external_id, 'https://', ''),
                                'http://', ''
                            ),
                            'www.', ''
                        ),
                        '/'
                    )
                )
            ) = ?
        """, (normalized,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Product not found")
        d = dict(row)
        variants_value = d.get("variants")
        if isinstance(variants_value, str):
            try:
                d["variants"] = json.loads(variants_value)
            except (json.JSONDecodeError, TypeError):
                d["variants"] = []
        elif isinstance(variants_value, list):
            d["variants"] = variants_value
        else:
            d["variants"] = []
        d["composition"] = None
        return d
    finally:
        conn.close()

@app.get("/products/external/{external_id:path}")
def get_product_by_external_id(external_id: str):
    conn = get_db_connection()
    try:
        row = conn.execute("""
            SELECT id, name, price, discount, image, images, category, pack_sizes,
                   old_price, unit, description, usage, delivery_info, return_info,
                   variants, option_names, external_id
            FROM products WHERE external_id=?
        """, (external_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Product not found")
        d = dict(row)
        variants_value = d.get("variants")
        if isinstance(variants_value, str):
            try:
                d["variants"] = json.loads(variants_value)
            except (json.JSONDecodeError, TypeError):
                d["variants"] = []
        elif isinstance(variants_value, list):
            d["variants"] = variants_value
        else:
            d["variants"] = []
        d["composition"] = None
        return d
    finally:
        conn.close()

@app.get("/products/external")
def get_product_by_external_query(external_id: str):
    return get_product_by_external_id_query(external_id)

@app.get("/products/{id}")
def get_product(id: int):
    conn = get_db_connection()
    row = conn.execute("SELECT * FROM products WHERE id=?", (id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Product not found")
    d = dict(row)
    if d.get("variants"):
        try:
            d["variants"] = json.loads(d["variants"])
        except:
            d["variants"] = []
    conn.close()
    return d

@app.post("/products")
async def create_product(item: ProductCreate):
    conn = get_db_connection()
    # Serialize variants
    variants_json = json.dumps(item.variants) if item.variants else None
    
    conn.execute("""
        INSERT INTO products (name, price, category, image, images, description, usage, composition, old_price, unit, variants, option_names, delivery_info, return_info) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (item.name, item.price, item.category, item.image, item.images, item.description, item.usage, item.composition, item.old_price, item.unit, variants_json, item.option_names, item.delivery_info, item.return_info))
    conn.commit()
    conn.close()
    return {"status": "ok"}

@app.put("/products/{id}")
async def update_product(id: int, item: ProductCreate):
    conn = get_db_connection()
    variants_json = json.dumps(item.variants) if item.variants else None
    
    conn.execute("""
        UPDATE products SET name=?, price=?, category=?, image=?, images=?, description=?, usage=?, composition=?, old_price=?, unit=?, variants=?, option_names=?, delivery_info=?, return_info=?
        WHERE id=?
    """, (item.name, item.price, item.category, item.image, item.images, item.description, item.usage, item.composition, item.old_price, item.unit, variants_json, item.option_names, item.delivery_info, item.return_info, id))
    conn.commit()
    conn.close()
    return {"status": "ok"}

@app.delete("/products/{id}")
async def delete_product(id: int):
    conn = get_db_connection()
    conn.execute("DELETE FROM products WHERE id=?", (id,))
    conn.commit()
    conn.close()
    return {"status": "ok"}

@app.get("/user/{phone}", response_model=UserResponse)
def get_user_profile(phone: str):
    # Очищаем номер
    clean_phone = "".join(filter(str.isdigit, str(phone)))
    conn = get_db_connection()
    user = conn.execute("SELECT * FROM users WHERE phone = ?", (clean_phone,)).fetchone()
    conn.close()
    if user:
        user_dict = dict(user)
        # Убеждаемся, что все поля присутствуют
        return UserResponse(
            phone=user_dict.get('phone', clean_phone),
            bonus_balance=user_dict.get('bonus_balance', 0),
            total_spent=user_dict.get('total_spent', 0.0),
            cashback_percent=user_dict.get('cashback_percent', 0),
            name=user_dict.get('name'),
            city=user_dict.get('city'),
            warehouse=user_dict.get('warehouse'),
            email=user_dict.get('email'),
            contact_preference=user_dict.get('contact_preference'),
            referrer=user_dict.get('referrer'),
            created_at=user_dict.get('created_at')
        )
    raise HTTPException(status_code=404, detail="User not found")

@app.post("/api/recalculate-cashback")
def recalculate_all_cashback():
    """
    Пересчитывает процент кешбэка для всех пользователей на основе их total_spent
    """
    conn = get_db_connection()
    cur = conn.cursor()
    
    users = cur.execute("SELECT phone, total_spent FROM users").fetchall()
    updated_count = 0
    
    for user in users:
        phone = user.get("phone")
        total_spent = user.get("total_spent") or 0
        cashback_percent = calculate_cashback_percent(total_spent)
        cur.execute("UPDATE users SET cashback_percent=? WHERE phone=?", (cashback_percent, phone))
        updated_count += 1
        print(f"📊 Updated {phone}: total_spent={total_spent} → cashback={cashback_percent}%")
    
    conn.commit()
    conn.close()
    
    return {
        "status": "ok", 
        "message": f"Updated cashback_percent for {updated_count} users"
    }

# 2. ЗАКАЗЫ
@app.get("/api/orders")
def get_orders_api():
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM orders ORDER BY id DESC").fetchall()
    res = []
    for r in rows:
        d = dict(r)
        d["total_price"] = d.get("total_price") or d.get("total") or d.get("totalprice") or 0
        try: d["items"] = json.loads(d["items"])
        except: d["items"] = []
        res.append(d)
    conn.close()
    return res

@app.post("/create_order")
async def create_order(order: OrderRequest, background_tasks: BackgroundTasks):
    """
    Создание нового заказа:
    1. Сохранение в БД
    2. Создание/обновление пользователя
    3. Отправка в Apix-Drive для синхронизации с OneBox
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Очищаем номер телефона
        clean_phone = normalize_phone(order.phone)
        user_phone = normalize_phone(order.user_phone) if order.user_phone else clean_phone
        
        # Проверяем/создаем пользователя
        user = cur.execute("SELECT * FROM users WHERE phone=?", (user_phone,)).fetchone()
        
        if not user:
            # Создаем нового пользователя
            cur.execute("""
                INSERT INTO users (phone, name, bonus_balance, total_spent, cashback_percent)
                VALUES (?, ?, 0, 0, 0)
            """, (user_phone, order.name))
            print(f"✅ Создан новый пользователь: {user_phone}")
        
        # Если использовались бонусы - списываем их
        if order.use_bonuses and order.bonus_used > 0:
            cur.execute("""
                UPDATE users 
                SET bonus_balance = bonus_balance - ? 
                WHERE phone = ?
            """, (order.bonus_used, user_phone))
            print(f"💳 Списано бонусов: {order.bonus_used} ₴ для {user_phone}")
        
        # Обновляем профиль пользователя (name, city, warehouse, email, contact_preference)
        update_fields = []
        update_values = []
        
        if order.name:
            update_fields.append("name = ?")
            update_values.append(order.name)
        
        if order.city:
            update_fields.append("city = ?")
            update_values.append(order.city)
        
        if order.warehouse:
            update_fields.append("warehouse = ?")
            update_values.append(order.warehouse)
        
        if order.email:
            update_fields.append("email = ?")
            update_values.append(order.email)
        
        if order.contact_preference:
            update_fields.append("contact_preference = ?")
            update_values.append(order.contact_preference)
        
        if update_fields:
            update_values.append(user_phone)
            cur.execute(f"""
                UPDATE users 
                SET {', '.join(update_fields)}
                WHERE phone = ?
            """, tuple(update_values))
            print(f"📧 Обновлен профиль пользователя: name={order.name}, city={order.city}, warehouse={order.warehouse}, email={order.email}, contact={order.contact_preference}")
        
        # Сериализуем items в JSON
        items_json = json.dumps([{
            "id": item.id,
            "name": item.name,
            "price": item.price,
            "quantity": item.quantity,
            "packSize": item.packSize,
            "unit": item.unit,
            "variant_info": item.variant_info
        } for item in order.items])
        
        # Создаем заказ
        row = cur.execute("""
            INSERT INTO orders (
                name, phone, user_phone, email, contact_preference, city, city_ref, warehouse, warehouse_ref,
                items, total_price, payment_method, bonus_used, status, date
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING id
        """, (
            order.name,
            clean_phone,
            user_phone,
            order.email or '',
            order.contact_preference or 'call',
            order.city,
            getattr(order, 'cityRef', ''),
            order.warehouse,
            getattr(order, 'warehouseRef', ''),
            items_json,
            order.totalPrice,
            order.payment_method,
            order.bonus_used,
            "Pending",
            datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        )).fetchone()
        order_id = (row or {}).get("id")
        conn.commit()
        conn.close()
        
        print(f"✅ Заказ #{order_id} создан успешно")
        
        # Подготавливаем данные для Apix-Drive
        order_data = {
            "id": order_id,
            "name": order.name,
            "phone": clean_phone,
            "user_phone": user_phone,
            "city": order.city,
            "warehouse": order.warehouse,
            "items": [{
                "id": item.id,
                "name": item.name,
                "price": item.price,
                "quantity": item.quantity,
                "packSize": item.packSize,
                "unit": item.unit
            } for item in order.items],
            "totalPrice": order.totalPrice,
            "payment_method": order.payment_method,
            "bonus_used": order.bonus_used,
            "status": "Pending",
            "date": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        
        # Отправляем в Apix-Drive асинхронно
        background_tasks.add_task(send_to_apix_drive, order_data)
        
        return {
            "status": "ok",
            "order_id": order_id,
            "message": "Заказ успешно создан"
        }
        
    except Exception as e:
        print(f"❌ Ошибка создания заказа: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка создания заказа: {str(e)}")

@app.put("/orders/{id}/status")
async def update_order_status(id: int, status: OrderStatusUpdate):
    conn = get_db_connection()
    cur = conn.cursor()
    
    # Получаем информацию о заказе
    order = cur.execute("SELECT * FROM orders WHERE id=?", (id,)).fetchone()
    if not order:
        conn.close()
        raise HTTPException(status_code=404, detail="Order not found")
    
    order_dict = dict(order)
    old_status = order_dict.get('status')
    new_status = status.new_status
    
    # Обновляем статус заказа
    cur.execute("UPDATE orders SET status=? WHERE id=?", (new_status, id))
    
    # 🎁 НАЧИСЛЕНИЕ КЕШБЭКА при завершении заказа
    # В админке статусы частично локализованы, поэтому учитываем варианты.
    final_statuses = {
        'Completed',   # used by admin as "Выполнен (Кешбэк)"
        'Delivered',
        'Доставлен',   # admin option
        'Виконано',
        'Выполнен',
    }

    if new_status in final_statuses and old_status not in final_statuses:
        user_phone = order_dict.get('user_phone') or order_dict.get('phone')
        try:
            order_total = float(order_dict.get('totalPrice') or order_dict.get('total') or 0)
            if not order_total:
                order_total = float(order_dict.get('total_price') or order_dict.get('totalprice') or 0)
        except Exception:
            order_total = 0.0
        bonus_used = order_dict.get('bonus_used') or 0
        
        if user_phone and order_total > 0:
            # Получаем данные пользователя
            user = cur.execute("SELECT * FROM users WHERE phone=?", (user_phone,)).fetchone()
            
            if user:
                user_dict = dict(user)
                try:
                    current_total_spent = float(user_dict.get('total_spent') or 0)
                except Exception:
                    current_total_spent = 0.0
                try:
                    current_bonus = int(user_dict.get('bonus_balance') or 0)
                except Exception:
                    current_bonus = 0
                
                # Кешбэк начисляется по текущему уровню ДО этого заказа,
                # а уровень (cashback_percent) обновляется ПОСЛЕ добавления суммы заказа.
                cashback_percent_for_order = calculate_cashback_percent(current_total_spent)
                new_total_spent = current_total_spent + order_total
                new_cashback_percent = calculate_cashback_percent(new_total_spent)
                
                cashback_amount = int((order_total * cashback_percent_for_order) / 100)
                new_bonus_balance = current_bonus + cashback_amount
                
                # Обновляем данные пользователя
                cur.execute("""
                    UPDATE users 
                    SET bonus_balance=?, total_spent=?, cashback_percent=? 
                    WHERE phone=?
                """, (new_bonus_balance, new_total_spent, new_cashback_percent, user_phone))
                
                print(f"💰 [Cashback] Заказ #{id} завершен:")
                print(f"   Пользователь: {user_phone}")
                print(f"   Сумма заказа: {order_total} ₴")
                print(f"   Общая сумма покупок: {current_total_spent} → {new_total_spent} ₴")
                print(f"   Процент кешбэка за заказ: {cashback_percent_for_order}%")
                print(f"   Новый уровень кешбэка: {new_cashback_percent}%")
                print(f"   Начислено бонусов: {cashback_amount} ₴")
                print(f"   Баланс бонусов: {current_bonus} → {new_bonus_balance} ₴")
    
    conn.commit()
    conn.close()
    return {"status": "ok", "message": "Order status updated"}


# --- API aliases (some deployments allow only /api/*) ---
@app.put("/api/orders/{id}/status")
async def update_order_status_api(id: int, status: OrderStatusUpdate):
    return await update_order_status(id, status)

@app.delete("/orders/{id}")
async def delete_order(id: int):
    conn = get_db_connection()
    conn.execute("DELETE FROM orders WHERE id=?", (id,))
    conn.commit()
    conn.close()
    return {"status": "ok"}


@app.delete("/api/orders/{id}")
async def delete_order_api(id: int):
    return await delete_order(id)

@app.post("/orders/delete-batch")
async def delete_orders_batch(batch: BatchDelete):
    conn = get_db_connection()
    placeholders = ','.join('?' for _ in batch.ids)
    conn.execute(f"DELETE FROM orders WHERE id IN ({placeholders})", batch.ids)
    conn.commit()
    conn.close()
    return {"status": "ok"}


@app.post("/api/orders/delete-batch")
async def delete_orders_batch_api(batch: BatchDelete):
    return await delete_orders_batch(batch)

@app.get("/orders/export")
def export_orders():
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM orders ORDER BY id DESC").fetchall()
    conn.close()
    
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(['ID', 'Date', 'Name', 'Phone', 'Total', 'Status', 'Items'])
    
    for r in rows:
        writer.writerow([
            r.get('id'),
            r.get('date'),
            r.get('name'),
            r.get('phone'),
            r.get('total_price') or r.get('totalPrice') or r.get('totalprice') or r.get('total'),
            r.get('status'),
            r.get('items'),
        ])
    
    output.seek(0)
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=orders.csv"})

@app.get("/api/client/orders/{phone}")
def get_client_orders(phone: str):
    clean_phone = normalize_phone(phone)
    print(f"🔍 Searching orders for phone: {phone} -> {clean_phone}")
    conn = get_db_connection()
    # Search by user_phone OR phone column
    rows = conn.execute("SELECT * FROM orders WHERE user_phone=? OR phone=? ORDER BY id DESC", (clean_phone, clean_phone)).fetchall()
    conn.close()
    print(f"✅ Found {len(rows)} orders for {clean_phone}")
    res = []
    for r in rows:
        d = dict(r)
        try: d["items"] = json.loads(d["items"])
        except: d["items"] = []
        res.append(d)
    return res


@app.delete("/api/client/orders/{order_id}")
def delete_client_order(order_id: int):
    conn = get_db_connection()
    conn.execute("DELETE FROM orders WHERE id=?", (order_id,))
    conn.commit()
    conn.close()
    return {"status": "deleted"}

@app.delete("/api/client/orders/clear/{phone}")
def clear_client_orders(phone: str):
    clean_phone = normalize_phone(phone)
    conn = get_db_connection()
    conn.execute("DELETE FROM orders WHERE user_phone=? OR phone=?", (clean_phone, clean_phone))
    conn.commit()
    conn.close()
    return {"status": "cleared"}

# 3. КАТЕГОРИИ
@app.get("/all-categories")
def get_categories():
    conn = get_db_connection()
    rows = conn.execute('SELECT * FROM categories').fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/categories")
async def add_category(cat: CategoryCreate):
    conn = get_db_connection()
    conn.execute("INSERT INTO categories (name) VALUES (?) ON CONFLICT (name) DO NOTHING", (cat.name,))
    conn.commit()
    conn.close()
    return {"status": "ok"}

@app.delete("/categories/{id}")
async def delete_category(id: int):
    conn = get_db_connection()
    conn.execute("DELETE FROM categories WHERE id=?", (id,))
    conn.commit()
    conn.close()
    return {"status": "ok"}

# 4. БАННЕРЫ
@app.get("/banners")
def get_banners():
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM banners").fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/banners")
async def create_banner(b: BannerCreate):
    conn = get_db_connection()
    conn.execute("INSERT INTO banners (image_url) VALUES (?)", (b.image_url,))
    conn.commit()
    conn.close()
    return {"status": "ok"}

@app.delete("/banners/{id}")
async def delete_banner(id: int):
    conn = get_db_connection()
    conn.execute("DELETE FROM banners WHERE id=?", (id,))
    conn.commit()
    conn.close()
    return {"status": "ok"}

# 5. ПОЛЬЗОВАТЕЛИ
@app.get("/api/users")
def get_users():
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM users").fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.put("/api/users/{phone}")
def update_user(phone: str, u: UserUpdate):
    conn = get_db_connection()
    conn.execute("UPDATE users SET bonus_balance=?, total_spent=? WHERE phone=?", (u.bonus_balance, u.total_spent, phone))
    conn.commit()
    conn.close()
    return {"status": "ok"}

@app.put("/api/user/info/{phone}")
def update_user_info(phone: str, info: UserInfoUpdate):
    """ """
    clean_phone = "".join(filter(str.isdigit, str(phone)))
    conn = get_db_connection()
    cur = conn.cursor()
    
    # 
    update_fields = []
    update_values = []
    
    if info.name is not None:
        update_fields.append("name = ?")
        update_values.append(info.name)
    
    if info.city is not None:
        update_fields.append("city = ?")
        update_values.append(info.city)
    
    if info.warehouse is not None:
        update_fields.append("warehouse = ?")
        update_values.append(info.warehouse)
    
    if info.email is not None:
        update_fields.append("email = ?")
        update_values.append(info.email)
    
    if info.contact_preference is not None:
        update_fields.append("contact_preference = ?")
        update_values.append(info.contact_preference)
    
    if update_fields:
        update_values.append(clean_phone)
        cur.execute(f"""
            UPDATE users 
            SET {', '.join(update_fields)}
            WHERE phone = ?
        """, tuple(update_values))
        conn.commit()
        print(f" Updated user info for {clean_phone}: email={info.email}, contact={info.contact_preference}")
    
    conn.close()
    return {"status": "ok"}

# 6. 
@app.get("/api/reviews/{product_id}")
def get_product_reviews(product_id: int):
    """ """
    """Получить все отзывы для товара"""
    conn = get_db_connection()
    rows = conn.execute("""
        SELECT * FROM reviews 
        WHERE product_id=? 
        ORDER BY created_at DESC
    """, (product_id,)).fetchall()
    conn.close()
    
    reviews = [dict(r) for r in rows]
    
    # Вычисляем средний рейтинг
    if reviews:
        avg_rating = sum(r['rating'] for r in reviews) / len(reviews)
        return {
            "reviews": reviews,
            "average_rating": round(avg_rating, 1),
            "total_count": len(reviews)
        }
    
    return {
        "reviews": [],
        "average_rating": 0,
        "total_count": 0
    }

@app.post("/api/reviews")
async def create_review(review: ReviewCreate):
    """Создать новый отзыв"""
    conn = get_db_connection()
    cur = conn.cursor()
    
    # Проверяем, покупал ли пользователь этот товар (ВРЕМЕННО ОТКЛЮЧЕНО)
    if review.user_phone:
        clean_phone = normalize_phone(review.user_phone)
        
        # # Ищем заказы пользователя с этим товаром
        # orders = cur.execute("""
        #     SELECT items FROM orders 
        #     WHERE (user_phone=? OR phone=?) 
        #     AND status IN ('Completed', 'Delivered', 'New', 'Pending')
        # """, (clean_phone, clean_phone)).fetchall()
        
        # has_purchased = False
        # for order in orders:
        #     try:
        #         items = json.loads(order[0])
        #         if any(item.get('id') == review.product_id for item in items):
        #             has_purchased = True
        #             break
        #     except:
        #         pass
        
        # if not has_purchased:
        #     conn.close()
        #     raise HTTPException(status_code=403, detail="Ви можете залишити відгук тільки після покупки товару")
        
        # Проверяем, не оставлял ли уже отзыв
        existing = cur.execute("""
            SELECT id FROM reviews 
            WHERE product_id=? AND user_phone=?
        """, (review.product_id, clean_phone)).fetchone()
        
        if existing:
            conn.close()
            raise HTTPException(status_code=400, detail="Ви вже залишили відгук на цей товар")
    
    # Создаем отзыв
    row = cur.execute("""
        INSERT INTO reviews (product_id, user_name, user_phone, rating, comment, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        RETURNING id
    """, (
        review.product_id,
        review.user_name,
        normalize_phone(review.user_phone) if review.user_phone else None,
        review.rating,
        review.comment,
        datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    )).fetchone()
    review_id = (row or {}).get("id")
    conn.commit()
    conn.close()
    
    print(f"✅ Отзыв #{review_id} создан для товара #{review.product_id}")
    
    return {
        "status": "ok",
        "review_id": review_id,
        "message": "Дякуємо за ваш відгук!"
    }

@app.delete("/api/reviews/{id}")
async def delete_review(id: int):
    """Удалить отзыв"""
    conn = get_db_connection()
    conn.execute("DELETE FROM reviews WHERE id=?", (id,))
    conn.commit()
    conn.close()
    return {"status": "ok"}

@app.get("/api/user/reviews/{phone}")
def get_user_reviews(phone: str):
    """Получить все отзывы пользователя"""
    clean_phone = normalize_phone(phone)
    conn = get_db_connection()
    rows = conn.execute("""
        SELECT r.*, p.name as product_name, p.image as product_image
        FROM reviews r
        LEFT JOIN products p ON r.product_id = p.id
        WHERE r.user_phone=? 
        ORDER BY r.created_at DESC
    """, (clean_phone,)).fetchall()
    conn.close()
    
    return [dict(r) for r in rows]

class AnalyticsEventReq(BaseModel):
    event_name: str
    properties: dict = {}
    user_data: dict = {}

@app.post("/api/track")
async def track_event_endpoint(evt: AnalyticsEventReq, background_tasks: BackgroundTasks):
    """Прокси для отправки событий аналитики с фронта"""
    background_tasks.add_task(track_analytics_event, evt.event_name, evt.properties, evt.user_data)
    return {"status": "ok"}

@app.post("/api/auth")
def auth_user(ua: UserAuth):
    """
    Вход или Регистрация по номеру телефона.
    Если юзера нет - создаем и даем 150 грн бонусов.
    """
    clean_phone = "".join(filter(str.isdigit, str(ua.phone)))
    if not clean_phone:
        raise HTTPException(status_code=400, detail="Invalid phone")

    conn = get_db_connection()
    user = conn.execute("SELECT * FROM users WHERE phone=?", (clean_phone,)).fetchone()
    
    if not user:
        # Pегистрация с бонусом 150 грн
        print(f"🆕 New user registration: {clean_phone}. Granting 150 bonus.")
        conn.execute("INSERT INTO users (phone, bonus_balance, total_spent, cashback_percent, created_at) VALUES (?, 150, 0, 0, ?)", (clean_phone, datetime.now().isoformat()))
        conn.commit()
        user = conn.execute("SELECT * FROM users WHERE phone=?", (clean_phone,)).fetchone()
    
    conn.close()
    return dict(user)

# 5. ПРОМОКОДЫ
@app.get("/api/promo-codes")
def get_promo_codes():
    """Получить все промокоды (для админки)"""
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM promo_codes ORDER BY id DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/promo-codes")
def create_promo_code(promo: PromoCodeCreate):
    """Создать новый промокод"""
    conn = get_db_connection()
    try:
        conn.execute("""
            INSERT INTO promo_codes (code, discount_percent, discount_amount, max_uses, expires_at, created_at, current_uses, active)
            VALUES (?, ?, ?, ?, ?, ?, 0, 1)
        """, (
            promo.code.upper(),
            promo.discount_percent,
            promo.discount_amount,
            promo.max_uses,
            promo.expires_at,
            datetime.now().isoformat()
        ))
        conn.commit()
        conn.close()
        return {"status": "ok", "message": "Promo code created"}
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=400, detail=f"Error creating promo code: {str(e)}")

@app.post("/api/promo-codes/validate")
def validate_promo_code(promo: PromoCodeValidate):
    """Проверить промокод и вернуть скидку"""
    conn = get_db_connection()
    code = promo.code.upper()
    
    row = conn.execute("SELECT * FROM promo_codes WHERE code=?", (code,)).fetchone()
    conn.close()
    
    if not row:
        raise HTTPException(status_code=404, detail="Промокод не знайдено")
    
    promo_dict = dict(row)
    
    # Проверка активности
    if not promo_dict.get('active'):
        raise HTTPException(status_code=400, detail="Промокод неактивний")
    
    # Проверка срока действия
    if promo_dict.get('expires_at'):
        from datetime import datetime
        expires = datetime.fromisoformat(promo_dict['expires_at'])
        if datetime.now() > expires:
            raise HTTPException(status_code=400, detail="Термін дії промокоду закінчився")
    
    # Проверка лимита использований
    max_uses = promo_dict.get('max_uses', 0)
    current_uses = promo_dict.get('current_uses', 0)
    if max_uses > 0 and current_uses >= max_uses:
        raise HTTPException(status_code=400, detail="Промокод вичерпано")
    
    return {
        "valid": True,
        "code": code,
        "discount_percent": promo_dict.get('discount_percent', 0),
        "discount_amount": promo_dict.get('discount_amount', 0)
    }

@app.delete("/api/promo-codes/{id}")
def delete_promo_code(id: int):
    """Удалить промокод"""
    conn = get_db_connection()
    conn.execute("DELETE FROM promo_codes WHERE id=?", (id,))
    conn.commit()
    conn.close()
    return {"status": "ok"}

@app.put("/api/promo-codes/{id}/toggle")
def toggle_promo_code(id: int):
    """Переключить активность промокода"""
    conn = get_db_connection()
    row = conn.execute("SELECT active FROM promo_codes WHERE id=?", (id,)).fetchone()
    if row:
        new_active = 0 if row.get("active") else 1
        conn.execute("UPDATE promo_codes SET active=? WHERE id=?", (new_active, id))
        conn.commit()
    conn.close()
    return {"status": "ok"}

# 5.5 ОТЗЫВЫ
@app.get("/api/reviews/{product_id}")
def get_product_reviews(product_id: int):
    """Получить все отзывы для товара"""
    conn = get_db_connection()
    rows = conn.execute("""
        SELECT id, product_id, user_name, user_phone, rating, comment, created_at 
        FROM reviews 
        WHERE product_id=? 
        ORDER BY created_at DESC
    """, (product_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/reviews")
def create_review(review: ReviewCreate):
    """Создать новый отзыв"""
    if review.rating < 1 or review.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
    
    conn = get_db_connection()
    try:
        cur = conn.execute("""
            INSERT INTO reviews (product_id, user_name, user_phone, rating, comment, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            RETURNING id
        """, (
            review.product_id,
            review.user_name,
            review.user_phone,
            review.rating,
            review.comment,
            datetime.now().isoformat()
        ))
        row = cur.fetchone()
        conn.commit()
        conn.close()
        return {"status": "ok", "review_id": (row or {}).get("id")}
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=400, detail=f"Error creating review: {str(e)}")


@app.post("/chat")
async def chat_endpoint(request: ChatRequest):
    """Умный эндпоинт чата с поддержкой GPT и поиска товаров"""
    try:
        user_message = request.messages[-1].content
        user_message_lower = user_message.lower()
        normalized_message = _chat_normalize_text(user_message)
        intents = _chat_detect_intents(normalized_message)
        
        # 1. Поиск товаров (Улучшенный: Python-фильтрация для поддержки кириллицы и поиска в описании)
        conn = get_db_connection()
        
        # Загружаем только нужные поля (быстрее и меньше памяти)
        all_products_rows = conn.execute(
            """
            SELECT id, name, category, price, old_price, image, images,
                   description, usage, composition
            FROM products
            """
        ).fetchall()
        all_products = [dict(r) for r in all_products_rows]
        conn.close()

        # Токены запроса (со стоп-словами и нормализацией)
        words = _chat_tokenize(user_message_lower)
        words = [_chat_stem_token(w) for w in words]
        # Убираем повторы, сохраняя порядок
        seen = set()
        words = [w for w in words if not (w in seen or seen.add(w))]

        found_products = []
        
        if words:
            import re

            token_patterns: List[tuple] = []
            for w in words:
                # \b works fine for unicode letters in python regex.
                token_patterns.append((w, re.compile(rf"\\b{re.escape(w)}\\b", flags=re.IGNORECASE)))

            scored_products: List[tuple] = []
            for p in all_products:
                score = _chat_score_product(p, token_patterns, intents)
                if score > 0:
                    scored_products.append((score, p))

            scored_products.sort(key=lambda x: x[0], reverse=True)

            # Жёсткий отбор релевантности: оставляем только то, что реально подходит
            if scored_products:
                top_score = float(scored_products[0][0])
                min_abs = 10.0
                min_rel = top_score * 0.45
                threshold = max(min_abs, min_rel)
                filtered = [(s, p) for s, p in scored_products if float(s) >= threshold]

                # Если фильтр слишком строгий (например, короткий запрос), слегка смягчаем
                if len(filtered) < 2:
                    threshold = max(8.0, top_score * 0.30)
                    filtered = [(s, p) for s, p in scored_products if float(s) >= threshold]

                # Итог: до 6 карточек, но только из прошедших порог
                found_products = [p for _, p in filtered[:6]]
        
        # 2. GPT Генерация ответа
        if openai_client:
            # Формируем расширенный контекст товаров для бота
            products_context = ""
            if found_products:
                products_list = []
                for p in found_products:
                    product_info = (
                        f"ID: {p.get('id')} | {p.get('name')} | {p.get('price')} грн\n"
                        f"Коротко: {(p.get('description') or '')[:160]}"
                    )
                    products_list.append(product_info)
                
                products_context = (
                    "ДОСТУПНІ ТОВАРИ (рекомендуй ТІЛЬКИ їх, не вигадуй інших):\n"
                    + "\n\n".join(products_list)
                )
            else:
                products_context = (
                    "Товарів за цим запитом не знайдено або впевненість низька. "
                    "Не вигадуй конкретні товари. Запитай 1 уточнення (ціль/симптом/для кого/форма) "
                    "і запропонуй категорії: лікарські гриби, трави, CBD, мікродозинг."
                )

            # Улучшенный системный промпт
            system_prompt = f"""
Ти — професійний консультант-продавець магазину DikorosUA (лікарські гриби, трави, натуральні добавки).
Мета: дати максимально корисну пораду і продати, але рекомендувати ТІЛЬКИ релевантні товари.

ЗНАЙДЕНІ ТОВАРИ (це єдині товари, які можна згадувати конкретно):
{products_context}

КЛЮЧОВІ ПРАВИЛА:
1) Якщо є список товарів: рекомендуй 2–3 найкращі, коротко поясни «чому саме вони» під запит, і м'яко запропонуй 1 альтернативу (якщо доречно).
2) НІКОЛИ не вигадуй назви товарів поза списком і не підміняй їх іншими.
3) Якщо товарів немає/впевненість низька: задай 1 уточнююче питання і запропонуй категорії без конкретних назв товарів.
4) Формулюй обережно: «підтримує», «може допомогти», без обіцянок лікування.

СТИЛЬ:
- Відповідай мовою запиту (UA/RU/EN).
- 4–7 речень.
- Без Markdown.
- 0–2 емодзі.
"""
            
            history = [{"role": "system", "content": system_prompt}]
            # Добавляем последние 3 сообщения для контекста разговора
            for msg in request.messages[-3:]:
                role = "user" if msg.role == "user" else "assistant"
                history.append({"role": role, "content": msg.content})
                
            completion = await openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=history,
                temperature=0.8,
                max_tokens=500
            )
            response_text = completion.choices[0].message.content
        else:
            # Fallback (если нет ключа API)
            if found_products:
                response_text = "Ось що я знайшов за вашим запитом. Перегляньте ці товари:"
            else:
                response_text = "Вибачте, я не знайшов товарів за вашим запитом. Спробуйте змінити пошук (наприклад 'Їжовик' або 'Кордицепс')."

        def _as_chat_product(p: dict) -> dict:
            image = p.get("image")
            if not image:
                try:
                    images = json.loads(p.get("images") or "[]")
                    if isinstance(images, list) and images:
                        image = images[0]
                except Exception:
                    image = None

            return {
                "id": p.get("id"),
                "name": p.get("name"),
                "price": p.get("price") or 0,
                "old_price": p.get("old_price") or 0,
                "image": image,
                "description": (p.get("description") or "")[:280],
            }

        # 3. Возвращаем ответ и карточки (тонкий payload)
        return {
            "text": response_text,
            "products": [_as_chat_product(p) for p in (found_products or [])]
        }
            
    except Exception as e:
        print(f"Error in chat endpoint: {e}")
        return {
            "text": "Вибачте, сталася помилка сервера. Спробуйте пізніше.",
            "products": []
        }


@app.post("/api/chat")
async def chat_endpoint_api(request: ChatRequest):
    return await chat_endpoint(request)


@app.post("/api/v1/chat")
async def chat_endpoint_api_v1(request: ChatRequest):
    return await chat_endpoint(request)

@app.post("/upload")
async def upload_image(file: UploadFile = File(...)):
    ext = os.path.splitext(file.filename)[1]
    name = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join("uploads", name)
    with open(path, "wb") as f: f.write(await file.read())
    return {"url": f"/uploads/{name}"}

@app.post("/api/import_xml")
async def import_xml(data: XmlImport):
    """
    Импорт товаров из XML с автоматической группировкой по вариантам
    """
    try:
        temp_file_path = None
        
        if not data.url:
            raise HTTPException(status_code=400, detail="XML URL не указан")
        
        print(f"📥 Starting XML import from: {data.url}")
        
        # Скачиваем XML если это URL
        if data.url.startswith('http'):
            response = requests.get(data.url, timeout=30)
            response.raise_for_status()
            
            with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', suffix='.xml', delete=False) as f:
                f.write(response.text)
                temp_file_path = f.name
            
            xml_path = temp_file_path
        else:
            xml_path = data.url
        
        # Парсим XML
        products = parse_horoshop_xml(xml_path)
        
        # Cleanup
        if temp_file_path:
            os.unlink(temp_file_path)
        
        if not products:
            return {"status": "warning", "count": 0, "message": "Товары не найдены"}
        
        # Импортируем в БД
        result = import_products_to_db(products)
        
        return {
            "status": "ok",
            "count": result['total'],
            "imported": result['imported'],
            "updated": result['updated'],
            "message": f"Импортировано: {result['imported']}, обновлено: {result['updated']}"
        }
        
    except Exception as e:
        print(f"❌ Import error: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка импорта: {str(e)}")
    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
            except:
                pass

@app.post("/upload_csv")
async def upload_csv(file: UploadFile = File(...)):
    # Заглушка для импорта CSV
    return {"count": 0, "message": "CSV Import not implemented yet"}

@app.get("/admin", response_class=HTMLResponse)
async def read_admin():
    """Admin panel with proper security headers"""
    base_dir = os.path.dirname(os.path.abspath(__file__))
    admin_path = os.path.join(base_dir, "admin.html")
    if os.path.exists(admin_path):
        with open(admin_path, "r", encoding="utf-8") as f:
            content = f.read()
    else:
        content = ADMIN_HTML_CONTENT
    
    return HTMLResponse(
        content=content,
        headers={
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )

class AnalyticsEventReq(BaseModel):
    event_name: str
    properties: dict = {}
    user_data: dict = {}

@app.post("/api/track")
async def track_event_endpoint(evt: AnalyticsEventReq, background_tasks: BackgroundTasks):
    """Прокси для отправки событий аналитики с фронта"""
    background_tasks.add_task(track_analytics_event, evt.event_name, evt.properties, evt.user_data)
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)