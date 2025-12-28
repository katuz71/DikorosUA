import os
from typing import List, Dict
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from openai import AsyncOpenAI
import pathlib
from products import catalog_list

print("=========================================")
print("DEBUG: CHECKING CATALOG CONTENT:")
print(catalog_list) 
print("=========================================")

# Debug: verify catalog import
print(f"DEBUG: Catalog loaded successfully. Content length: {len(catalog_list)}")

# 1. Загрузка переменных окружения
env_path = pathlib.Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path)

api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    print("ERROR: API Key not found!")
    exit(1)

# 2. Настройка клиента OpenAI
client = AsyncOpenAI(api_key=api_key)

# 3. Настройка FastAPI
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 4. Модель данных (теперь ждем СПИСОК сообщений)
class ChatRequest(BaseModel):
    messages: List[Dict[str, str]]

# 5. Системные настройки
SYSTEM_INSTRUCTION = f"""
Ты — эксперт-консультант магазина биодобавок.
Твоя задача: помогать клиентам подбирать витамины и добавки.

Каталог товаров:
{catalog_list}

Правила:
1. Всегда отвечай на языке пользователя (если пишут на русском — отвечай на русском, if English - English).
2. Строго рекомендуй только продукты из этого списка. Если пользователь спрашивает что-то другое, предлагай ближайший аналог из списка.
3. Ответы должны быть четкими и полезными.
"""

async def get_gpt_response(history: List[Dict[str, str]]) -> str:
    try:
        # Собираем полный контекст: Инструкция + История переписки
        full_conversation = [{"role": "system", "content": SYSTEM_INSTRUCTION}] + history
        
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=full_conversation
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"OpenAI Error: {e}")
        return "Извините, мой мозг сейчас занят. Попробуйте позже."

@app.post("/chat")
async def chat_endpoint(request: ChatRequest):
    try:
        print(f"Received request with {len(request.messages)} messages") # Лог для отладки
        gpt_text = await get_gpt_response(request.messages)
        return {"response": gpt_text}
    except Exception as e:
        print(f"Server Error: {e}") # Лог ошибки в терминал
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    # Запуск на всех интерфейсах
    uvicorn.run(app, host="0.0.0.0", port=8000)