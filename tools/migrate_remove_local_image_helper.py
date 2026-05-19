from pathlib import Path

main_path = Path("main.py")
main = main_path.read_text(encoding="utf-8")

start_marker = "async def save_uploaded_image(file: UploadFile) -> str:"
end_marker = "# --- INITIALIZATION ---"

start = main.find(start_marker)
end = main.find(end_marker, start)

if start == -1:
    raise SystemExit("local save_uploaded_image not found")
if end == -1:
    raise SystemExit("initialization marker not found after save_uploaded_image")
if end <= start:
    raise SystemExit("Invalid save_uploaded_image range")

new_main = main[:start].rstrip() + "\n\n" + main[end:]
main_path.write_text(new_main, encoding="utf-8")

print("OK: removed local save_uploaded_image from main.py")
