# -*- coding: utf-8 -*-
import httpx, os, asyncio, json
from dotenv import load_dotenv

load_dotenv()

async def dump():
    url = os.getenv("ONEBOX_URL", "").rstrip("/")
    auth = {"login": os.getenv("ONEBOX_LOGIN"), "restapipassword": os.getenv("ONEBOX_API_PASSWORD")}
    
    async with httpx.AsyncClient() as client:
        # 1. Получаем токен
        r = await client.post(f"{url}/api/v2/token/get/", json=auth)
        token = r.json().get("token") or r.json().get("dataArray", {}).get("token")
        
        # 2. Берем ID "хорошего" заказа
        order_id = 79233 
        print(f"--- DUMPING ORDER {order_id} ---")
        
        # 3. Запрашиваем заказ
        r2 = await client.post(
            f"{url}/api/v2/order/get/", 
            headers={"Token": token}, 
            json={"id": order_id}
        )
        
        print(f"Status: {r2.status_code}")
        # Печатаем ВЕСЬ ответ
        print(json.dumps(r2.json(), indent=2, ensure_ascii=False))

asyncio.run(dump())
