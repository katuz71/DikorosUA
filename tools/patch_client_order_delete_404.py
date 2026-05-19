from pathlib import Path

p = Path("routers/orders.py")
s = p.read_text(encoding="utf-8")

old = '''@router.delete("/api/client/orders/{order_id}")
def delete_client_order(order_id: int):
    conn = get_db_connection()
    conn.execute("DELETE FROM orders WHERE id=?", (order_id,))
    conn.commit()
    conn.close()
    return {"status": "deleted"}

@router.delete("/api/client/orders/clear/{phone}")
def clear_client_orders(phone: str):
    clean_phone = normalize_phone(phone)
    conn = get_db_connection()
    conn.execute("DELETE FROM orders WHERE user_phone=? OR phone=?", (clean_phone, clean_phone))
    conn.commit()
    conn.close()
    return {"status": "cleared"}
'''

new = '''@router.delete("/api/client/orders/{order_id}")
def delete_client_order(order_id: int):
    conn = get_db_connection()
    try:
        cur = conn.execute("DELETE FROM orders WHERE id=?", (order_id,))
        conn.commit()
        deleted_count = getattr(cur, "rowcount", 0)

        if deleted_count == 0:
            raise HTTPException(status_code=404, detail="Order not found")

        return {"status": "deleted"}
    finally:
        conn.close()


@router.delete("/api/client/orders/clear/{phone}")
def clear_client_orders(phone: str):
    clean_phone = normalize_phone(phone)
    conn = get_db_connection()
    try:
        cur = conn.execute("DELETE FROM orders WHERE user_phone=? OR phone=?", (clean_phone, clean_phone))
        conn.commit()
        deleted_count = getattr(cur, "rowcount", 0)

        if deleted_count == 0:
            raise HTTPException(status_code=404, detail="Orders not found")

        return {"status": "cleared"}
    finally:
        conn.close()
'''

if old not in s:
    raise SystemExit("client order delete block not found")

s = s.replace(old, new)
p.write_text(s, encoding="utf-8")

print("OK: client order deletes now return 404 when nothing was deleted")
