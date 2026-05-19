from pathlib import Path

p = Path("routers/orders.py")
s = p.read_text(encoding="utf-8")

old = '''@router.post("/create_order")
async def create_order(order: OrderRequest, background_tasks: BackgroundTasks):
    """
'''

new = '''@router.post("/create_order")
async def create_order(order: OrderRequest, background_tasks: BackgroundTasks):
    conn = None
    """
'''

if old not in s:
    raise SystemExit("create_order header not found")

s = s.replace(old, new, 1)

old_except = '''    except Exception as e:
        logger.exception("Failed to create order")
        raise HTTPException(status_code=500, detail=f"Ошибка создания заказа: {str(e)}")
'''

new_except = '''    except Exception as e:
        logger.exception("Failed to create order")
        if conn is not None:
            try:
                conn.rollback()
            except Exception:
                pass
            try:
                conn.close()
            except Exception:
                pass
        raise HTTPException(status_code=500, detail=f"Ошибка создания заказа: {str(e)}")
'''

if old_except not in s:
    raise SystemExit("create_order except block not found")

s = s.replace(old_except, new_except, 1)

p.write_text(s, encoding="utf-8")
print("OK: create_order closes DB connection on errors")
