from pathlib import Path

p = Path("routers/orders.py")
s = p.read_text(encoding="utf-8")

old = '''@router.delete("/orders/{id}")
async def delete_order(id: int):
    conn = get_db_connection()
    conn.execute("DELETE FROM orders WHERE id=?", (id,))
    conn.commit()
    conn.close()
    return {"status": "ok"}
'''

new = '''@router.delete("/orders/{id}")
async def delete_order(id: int):
    conn = get_db_connection()
    try:
        cur = conn.execute("DELETE FROM orders WHERE id=?", (id,))
        conn.commit()
        deleted_count = getattr(cur, "rowcount", 0)

        if deleted_count == 0:
            raise HTTPException(status_code=404, detail="Order not found")

        return {"status": "ok"}
    finally:
        conn.close()
'''

if old not in s:
    raise SystemExit("delete_order block not found")

s = s.replace(old, new)
p.write_text(s, encoding="utf-8")

print("OK: delete_order now returns 404 for missing order")
