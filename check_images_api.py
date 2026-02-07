#!/usr/bin/env python3
"""Проверка товаров с отсутствующими изображениями через API"""

import requests
import json

API_URL = "http://localhost:8000"  # Локальный сервер

try:
    print("🔍 Проверка товаров через API...\n")
    response = requests.get(f"{API_URL}/products", timeout=5)
    response.raise_for_status()
    products = response.json()
    
    print(f"📊 Всего товаров: {len(products)}\n")
    
    # Фильтруем товары без изображений
    without_images = []
    for p in products:
        has_images = p.get('images') and p['images'] not in ['', '[]', None]
        has_image = p.get('image') and p['image'] not in ['', None]
        has_image_url = p.get('image_url') and p['image_url'] not in ['', None]
        
        if not (has_images or has_image or has_image_url):
            without_images.append(p)
    
    print(f"❌ Товаров БЕЗ изображений: {len(without_images)}\n")
    
    if without_images:
        print("⚠️ Товары без изображений:\n")
        for p in without_images[:10]:
            print(f"   ID: {p.get('id')} | {p.get('name', 'Без названия')}")
            print(f"      images: {p.get('images')}")
            print(f"      image: {p.get('image')}")
            print(f"      image_url: {p.get('image_url')}")
            print()
        
        if len(without_images) > 10:
            print(f"   ... и ещё {len(without_images) - 10} товаров\n")
    
    # Статистика
    stats = {
        'has_images': sum(1 for p in products if p.get('images') and p['images'] not in ['', '[]']),
        'has_image': sum(1 for p in products if p.get('image')),
        'has_image_url': sum(1 for p in products if p.get('image_url')),
    }
    
    print("\n📈 Статистика по полям:")
    print(f"   images (заполнено): {stats['has_images']} ({stats['has_images']/len(products)*100:.1f}%)")
    print(f"   image (заполнено): {stats['has_image']} ({stats['has_image']/len(products)*100:.1f}%)")
    print(f"   image_url (заполнено): {stats['has_image_url']} ({stats['has_image_url']/len(products)*100:.1f}%)")
    
except requests.exceptions.ConnectionError:
    print("❌ Ошибка: Локальный сервер недоступен.")
    print("   Убедитесь, что API запущен на http://localhost:8000")
    print("\n💡 Альтернатива: проверьте код напрямую в приложении")
    
except Exception as e:
    print(f"❌ Ошибка: {e}")
