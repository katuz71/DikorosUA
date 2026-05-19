from pathlib import Path

main_path = Path("main.py")
main = main_path.read_text(encoding="utf-8")

start_marker = "class AnalyticsEventReq(BaseModel):"
end_marker = '@app.post("/api/sync/catalog")'

start = main.find(start_marker)
end = main.find(end_marker)

if start == -1:
    raise SystemExit("AnalyticsEventReq block start not found")
if end == -1:
    raise SystemExit("sync catalog marker not found")
if end <= start:
    raise SystemExit("Invalid analytics legacy block range")

new_main = main[:start].rstrip() + "\n\n" + main[end:]
main_path.write_text(new_main, encoding="utf-8")

print("OK: removed legacy analytics track endpoint from main.py")
