from pathlib import Path

p = Path("routers/orders.py")
s = p.read_text(encoding="utf-8")

old_start = '''@router.post("/create_order")
async def create_order(order: OrderRequest, background_tasks: BackgroundTasks):
    """
'''

new_start = '''@router.post("/create_order")
async def create_order(order: OrderRequest, background_tasks: BackgroundTasks):
    conn = None
    """
'''

if old_start not in s:
    raise SystemExit("create_order start block not found")

s = s.replace(old_start, new_start, 1)

old_except = '''    except Exception as e:
        logger.exception("Failed to create order")
        raise HTTPException(status_code=500, detail=f"РћС€РёР±РєР° СЃРѕР·РґР°РЅРёСЏ Р·Р°РєР°Р·Р°: {str(e)}")
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
        raise HTTPException(status_code=500, detail=f"РћС€РёР±РєР° СЃРѕР·РґР°РЅРёСЏ Р·Р°РєР°Р·Р°: {str(e)}")
'''

if old_except not in s:
    raise SystemExit("create_order except block not found")

s = s.replace(old_except, new_except, 1)
p.write_text(s, encoding="utf-8")

print("OK: create_order now closes DB connection on errors")
