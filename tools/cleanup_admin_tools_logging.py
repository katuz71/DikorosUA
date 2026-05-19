from pathlib import Path

p = Path("routers/admin_tools.py")
s = p.read_text(encoding="utf-8")

s = s.replace("import traceback\n\n", "import logging\n\n")
s = s.replace("router = APIRouter()\n", "router = APIRouter()\nlogger = logging.getLogger(__name__)\n")

s = s.replace('    from fastapi import HTTPException\n    import traceback\n', "")

s = s.replace(
'        print(f"Ошибка очистки БД: {traceback.format_exc()}")\n        raise HTTPException(status_code=500, detail=f"Ошибка при очистке базы: {str(e)}")',
'        logger.exception("Failed to clear products database")\n        raise HTTPException(status_code=500, detail="Ошибка при очистке базы")',
)

p.write_text(s, encoding="utf-8")

print("OK: cleaned admin_tools logging")
