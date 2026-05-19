from pathlib import Path

main_path = Path("main.py")
chat_path = Path("routers/chat.py")

main = main_path.read_text(encoding="utf-8")
chat = chat_path.read_text(encoding="utf-8")

main_start_marker = "# --- CHAT BOT: фіксована база товарів для посилань"
main_end_marker = '@app.post("/upload_csv")'

start = main.find(main_start_marker)
end = main.find(main_end_marker)

if start == -1:
    raise SystemExit("CHAT block start not found in main.py")
if end == -1:
    raise SystemExit("upload_csv marker not found in main.py")
if end <= start:
    raise SystemExit("Invalid CHAT block range in main.py")

chat_block = main[start:end].rstrip() + "\n\n"

chat_base_start = chat.find("# --- CHAT BOT: fallback product base and ID helpers ---")
chat_search_marker = "# --- CHAT SEARCH HELPERS ---"
chat_base_end = chat.find(chat_search_marker)

if chat_base_start == -1:
    raise SystemExit("CHAT fallback block start not found in routers/chat.py")
if chat_base_end == -1:
    raise SystemExit("CHAT SEARCH HELPERS marker not found in routers/chat.py")
if chat_base_end <= chat_base_start:
    raise SystemExit("Invalid CHAT block range in routers/chat.py")

# Переносим полную базу и ID helpers из main.py в routers/chat.py
new_chat = chat[:chat_base_start] + chat_block + chat[chat_base_end:]

# Удаляем legacy CHAT block из main.py, оставляя upload_csv
new_main = main[:start].rstrip() + "\n\n" + main[end:]

main_path.write_text(new_main, encoding="utf-8")
chat_path.write_text(new_chat, encoding="utf-8")

print("OK: moved CHAT_PRODUCTS_BASE and ID helpers from main.py to routers/chat.py")
