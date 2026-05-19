from pathlib import Path

p = Path("routers/products.py")
s = p.read_text(encoding="utf-8")

start = s.find('@router.post("/products")')
end = s.find('\n\n@router.put("/products/{id}")', start)

if start == -1:
    raise SystemExit("create_product start not found")
if end == -1:
    raise SystemExit("update_product marker not found")

new_block = '''@router.post("/products")
async def create_product(request: Request):
    conn = get_db_connection()
    try:
        content_type = request.headers.get("content-type", "")
        image_path = None

        if "application/json" in content_type:
            body = await request.json()
            item = ProductCreate(**body)
            image_path = item.image
            name, price, category = item.name, item.price, item.category
            images = item.images
            description, usage, composition = item.description, item.usage, item.composition
            old_price, unit = item.old_price, item.unit
            discount = int(getattr(item, "discount", 0) or 0)
            variants_json = json.dumps(item.variants) if item.variants else None
            option_names = item.option_names
            delivery_info, return_info = item.delivery_info, item.return_info
            is_bestseller = getattr(item, "is_bestseller", False) or False
            is_promotion = getattr(item, "is_promotion", False) or False
            is_new = getattr(item, "is_new", False) or False
        else:
            form = await request.form()
            image_file = form.get("image_file") or form.get("image")
            if image_file and hasattr(image_file, "read"):
                image_path = await save_uploaded_image(image_file)
            else:
                image_path = (image_file or "").strip() or None
                if isinstance(image_path, str) and not image_path:
                    image_path = None

            name, price, category, images, description, usage, composition, old_price, discount, unit, variants_json, option_names, delivery_info, return_info, is_bestseller, is_promotion, is_new = _parse_product_form(form)
            discount = int(form.get("discount", 0) or 0)

        conn.execute("""
            INSERT INTO products (name, price, category, image, images, description, usage, composition, old_price, discount, unit, variants, option_names, delivery_info, return_info, is_bestseller, is_promotion, is_new)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (name, price, category, image_path, images, description, usage, composition, old_price, discount, unit, variants_json, option_names, delivery_info, return_info, is_bestseller, is_promotion, is_new))
        conn.commit()
        return {"status": "ok"}
    finally:
        conn.close()
'''

s = s[:start] + new_block + s[end:]
p.write_text(s, encoding="utf-8")

print("OK: create_product now closes DB connection with finally")
