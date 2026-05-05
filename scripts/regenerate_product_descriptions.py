import argparse
import html
import os
import re
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional, Tuple

import psycopg2
from psycopg2.extras import RealDictCursor


_TAG_RE = re.compile(r"<[^>]+>")


def _clean_text(v: Any) -> str:
    if v is None:
        return ""
    s = str(v)
    s = html.unescape(s)
    s = _TAG_RE.sub(" ", s)
    s = s.replace("\u00a0", " ")
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _env(name: str, default: Optional[str] = None) -> str:
    v = os.environ.get(name)
    if v is None:
        return default or ""
    v = v.strip()
    return v if v else (default or "")


def connect_postgres():
    database_url = _env("DATABASE_URL") or "postgresql://postgres:postgres@db:5432/app_db"
    return psycopg2.connect(database_url, cursor_factory=RealDictCursor)


def _has_certish(desc: str) -> bool:
    d = desc.lower()
    return (
        "ту у" in d
        or "сертиф" in d
        or "якість підтвердж" in d
        or d.startswith("виготовлено")
        or d.startswith("продукт виготовлено")
    )


def _is_sensitive(name: str, category: str) -> bool:
    n = (name or "").lower()
    c = (category or "").lower()
    # Avoid giving consumption/dosage guidance for these.
    sensitive_tokens = [
        "мікродоз",
        "microdo",
        "мухомор",
        "amanita",
        "pantherina",
        "пантерн",
    ]
    blob = f"{n} {c}"
    return any(t in blob for t in sensitive_tokens)


def _infer_kind(name: str, category: str) -> str:
    n = name.lower()
    c = (category or "").lower()
    if "мікродоз" in c:
        return "capsules"
    if "капсул" in c:
        return "capsules"
    if "настоян" in c:
        return "tincture"
    if "маз" in c or "крем" in c or "бальзам" in c:
        return "topical"
    if "cbd" in n or c == "cbd":
        return "cbd"
    if "настоян" in n or "tinct" in n:
        return "tincture"
    if "ваги" in n or "scale" in n:
        return "device"
    if "мазь" in n or "крем" in n or "бальзам" in n:
        return "topical"
    if "сіль" in n or "соль" in n:
        return "salt"
    if "шоколад" in n:
        return "chocolate"
    if "цукерк" in n or "конфет" in n:
        return "candy"
    if "каша" in n:
        return "porridge"
    if "коктейл" in n or "смузі" in n or "смуси" in n:
        return "cocktail"
    if "пюре" in n:
        return "puree"
    if "набір" in n or "асорт" in n:
        return "set"
    if "капсул" in n or "капсула" in n:
        return "capsules"
    if "порош" in n:
        return "powder"
    if "варення" in n or "джем" in n or "конфіт" in n:
        return "jam"
    if "мед" in n and "мед" in c:
        return "honey"
    if "марин" in n:
        return "pickled"
    if "сушен" in n and ("гриб" in n or "гриби" in c or "гриб" in c):
        return "dried_mushroom"
    if "сушен" in n and ("трав" in c or "ягод" in c or "трав" in n or "лист" in n):
        return "dried_herb"
    if "чай" in n:
        return "tea"
    if "олія" in n or "олив" in n:
        return "oil"
    return "general"


def _fmt_lines(lines: List[str], max_len: int = 1400) -> str:
    out: List[str] = []
    total = 0
    for line in lines:
        if not line:
            out.append("")
            total += 1
            continue
        if total + len(line) + 1 > max_len:
            break
        out.append(line)
        total += len(line) + 1
    s = "\n".join(out).strip()
    return s


def _section(title: str) -> List[str]:
    return [title]


def _bullets(items: List[str]) -> List[str]:
    out: List[str] = []
    for it in items:
        it = _clean_text(it)
        if not it:
            continue
        if it.startswith("-"):
            out.append(it)
        else:
            out.append(f"- {it}")
    return out


def build_description(row: Dict[str, Any]) -> str:
    name = _clean_text(row.get("name"))
    category = _clean_text(row.get("category"))
    unit = _clean_text(row.get("unit"))
    pack_sizes = _clean_text(row.get("pack_sizes"))
    kind = _infer_kind(name, category)
    sensitive = _is_sensitive(name, category)

    # Product name is shown elsewhere in UI; avoid repeating it in description
    # to reduce accidental medical/psychoactive claims being echoed into the text.
    title = "Коротко про товар"

    characteristics: List[str] = []
    if pack_sizes:
        characteristics.append(f"Фасування: {pack_sizes}")
    elif unit:
        characteristics.append(f"Одиниця: {unit}")

    # Per-kind content blocks (neutral, sales-focused, non-medical)
    if kind == "cbd":
        hook = "CBD-продукт у зручному форматі — акуратний вибір для тих, хто цінує сучасні рішення та простоту."
        about = "CBD (канабідіол) — компонент, який отримують з конопель. Деталі складу та рекомендації виробника дивіться на етикетці."
        advantages = _bullets(
            [
                "Зручний формат для щоденного використання",
                "Просто інтегрувати у звичний ритм без зайвих дій",
            ]
        )
        how = _bullets(["Використовуйте згідно інструкції та рекомендацій на етикетці/упаковці"])
        storage = _bullets(["Зберігайте у прохолодному темному місці, щільно закритим"])
        important = _bullets(["Не є лікарським засобом", "Деталі та застереження — дивіться на етикетці/упаковці"])
    elif kind == "tincture":
        hook = "Настоянка у зручному форматі — для тих, хто цінує простоту та акуратне зберігання."
        about = "Опис має довідковий характер: склад та особливості можуть відрізнятися залежно від партії."
        advantages = _bullets(
            [
                "Зручний формат: легко зберігати і використовувати вдома",
                "Підійде як практичний вибір на щодень або у дорогу",
            ]
        )
        how = _bullets(["Використовуйте згідно призначення та рекомендацій на етикетці/упаковці"])
        storage = _bullets(["Зберігайте щільно закритим у прохолодному темному місці"])
        important = _bullets(["Не є лікарським засобом", "Деталі (склад, застереження) — дивіться на етикетці/упаковці"])
    elif kind == "salt":
        hook = "Ароматна сіль — простий спосіб швидко підсилити смак страв."
        about = "Зручно додавати у повсякденні рецепти: м'ясо, овочі, салати, гарніри."
        advantages = _bullets([
            "Підкреслює смак без складних приготувань",
            "Зручно тримати на кухні як універсальну приправу",
        ])
        how = _bullets(["Додавайте у страви за смаком"])
        storage = _bullets(["Зберігайте у сухому місці, щільно закритим"])
        important = _bullets(["Продукт харчовий", "Склад та особливості — дивіться на етикетці/упаковці"])
    elif kind == "chocolate":
        hook = "Шоколад — маленьке задоволення на щодень або як подарунок."
        about = "Зручний формат: можна взяти із собою, пригостити або додати до подарункового набору."
        advantages = _bullets([
            "Ідеально до кави або чаю",
            "Зручний варіант для подарунка",
        ])
        how = _bullets(["Смакуйте як десерт"])
        storage = _bullets(["Зберігайте у прохолодному сухому місці, подалі від сонця"])
        important = _bullets(["Продукт харчовий", "Склад та алергени — дивіться на етикетці/упаковці"])
    elif kind == "candy":
        hook = "Цукерки — смачний перекус і приємна дрібничка до подарунка."
        about = "Зручні для дороги, офісу або домашнього чаювання."
        advantages = _bullets([
            "Порційний формат — зручно брати із собою",
            "Добре підходить як невеликий подарунок",
        ])
        how = _bullets(["Смакуйте як десерт"])
        storage = _bullets(["Зберігайте у сухому прохолодному місці"])
        important = _bullets(["Продукт харчовий", "Склад та алергени — дивіться на етикетці/упаковці"])
    elif kind == "porridge":
        hook = "Каша — швидкий і зручний варіант для сніданку або перекусу."
        about = "Практичний вибір, коли хочеться простої їжі без довгого приготування."
        advantages = _bullets([
            "Економить час: зручно готувати",
            "Підходить для дому, офісу або подорожі",
        ])
        how = _bullets(["Готуйте згідно інструкції на упаковці"])
        storage = _bullets(["Зберігайте у сухому місці, щільно закритим"])
        important = _bullets(["Продукт харчовий", "Склад та спосіб приготування — на етикетці/упаковці"])
    elif kind == "cocktail":
        hook = "Коктейль/суміш — зручний формат, коли потрібен швидкий напій або перекус."
        about = "Легко вписується у ритм дня: вдома, на роботі чи у дорозі."
        advantages = _bullets([
            "Швидко і зручно у приготуванні",
            "Порційний або змішувальний формат (див. упаковку)",
        ])
        how = _bullets(["Готуйте та використовуйте згідно інструкції на упаковці"])
        storage = _bullets(["Зберігайте у сухому місці, подалі від вологи"])
        important = _bullets(["Продукт харчовий", "Склад та спосіб приготування — на етикетці/упаковці"])
    elif kind == "puree":
        hook = "Пюре/суміш — простий варіант для швидкого перекусу."
        about = "Зручний формат для тих, хто любить мінімум зайвих кроків у приготуванні."
        advantages = _bullets([
            "Швидко готується",
            "Підходить для дому та в дорогу",
        ])
        how = _bullets(["Готуйте згідно інструкції на упаковці"])
        storage = _bullets(["Зберігайте у сухому місці"])
        important = _bullets(["Продукт харчовий", "Склад — дивіться на етикетці/упаковці"])
    elif kind == "set":
        hook = "Набір — зручний спосіб спробувати одразу кілька позицій або зібрати подарунок."
        about = "Підійде для знайомства з асортиментом та як готове рішення без довгого вибору."
        advantages = _bullets([
            "Готовий подарунковий варіант",
            "Зручно, якщо хочете різні смаки/позиції",
        ])
        how = _bullets(["Користуйтеся кожною позицією з набору згідно її етикетки/упаковки"])
        storage = _bullets(["Зберігання — дивіться на етикетках окремих позицій"])
        important = _bullets(["Продукт(и) харчові/товари можуть відрізнятися за складом — перевіряйте етикетки"])
    elif kind == "dried_mushroom":
        hook = "Ароматні сушені гриби для домашньої кухні та заготовок."
        about = "Добре підходять для перших страв, соусів та гарнірів — дають насичений грибний аромат."
        advantages = _bullets(
            [
                "Насичений аромат і смак у стравах",
                "Зручно зберігати та використовувати невеликими порціями",
            ]
        )
        how = _bullets(
            [
                "Додавайте у супи, соуси, каші, рагу",
                "За бажанням замочіть перед приготуванням; відвар можна використати у страві",
            ]
        )
        storage = _bullets(["У сухому прохолодному місці, щільно закритим"])
        important = _bullets(["Продукт харчовий"])
    elif kind == "dried_herb":
        hook = "Сушена рослинна сировина для домашніх напоїв та кулінарії."
        about = "Ароматна натуральна добавка: зручно використовувати вдома та брати із собою."
        advantages = _bullets(
            [
                "Універсально: і для напоїв, і для кулінарії",
                "Зручний сухий формат для зберігання",
            ]
        )
        how = _bullets(["Для приготування настою/чаю", "Як добавку до страв за смаком"])
        storage = _bullets(["У сухому темному місці, подалі від вологи"])
        important = _bullets(["Не є лікарським засобом"])
    elif kind == "capsules":
        hook = "Капсульований формат — акуратний вигляд, чистота та зручність без зайвих кроків."
        about = "Підійде тим, хто цінує компактність і простоту: зручно зберігати, зручно брати із собою, не потрібно нічого міряти чи змішувати."
        advantages = _bullets(
            [
                "Компактно та зручно: легко брати із собою",
                "Акуратний формат без підготовки",
            ]
        )
        if sensitive:
            how = _bullets(["Використовуйте згідно інструкції та рекомендацій виробника на етикетці/упаковці"])
        else:
            how = _bullets(
                [
                    "Використовуйте згідно інструкції та рекомендацій на етикетці/упаковці",
                    "Ознайомтесь із застереженнями виробника",
                ]
            )
        storage = _bullets(["У сухому місці при кімнатній температурі"])
        important = _bullets(["Не є лікарським засобом", "Деталі та застереження — дивіться на етикетці/упаковці"])
    elif kind == "powder":
        hook = "Порошок — зручний формат, коли потрібна гнучкість у використанні."
        about = "Зручно додавати у рецепти без складних підготовчих кроків — підходить для тих, хто любить контролювати результат та обирати свій спосіб використання."
        advantages = _bullets(
            [
                "Гнучко під різні задачі та рецепти",
                "Зручно зберігати та використовувати невеликими порціями",
            ]
        )
        how = _bullets(
            [
                "Використовуйте згідно призначення та рекомендацій на етикетці/упаковці (якщо вказані)",
            ]
        )
        storage = _bullets(["У сухому місці, щільно закритим"])
        important = _bullets(["Не є лікарським засобом", "Деталі та застереження — дивіться на етикетці/упаковці"])
    elif kind == "jam":
        hook = "Натуральне варення з приємним смаком та ароматом — для чаювання і десертів."
        about = "Смакує як самостійний десерт або як солодка добавка до щоденних страв."
        advantages = _bullets(
            [
                "Солодкий акцент до напоїв і десертів",
                "Зручно мати під рукою для швидкого перекусу",
            ]
        )
        how = _bullets(["До чаю, каш, йогурту, десертів", "Як начинку або топінг"])
        storage = _bullets(["Після відкриття зберігати у холодильнику"])
        important = _bullets(["Продукт харчовий"])
    elif kind == "honey":
        hook = "Натуральний мед для щоденного раціону, напоїв та випічки."
        about = "Солодкий та ароматний — універсальний продукт для дому."
        advantages = _bullets(
            [
                "Універсально: напої, десерти, випічка",
                "Ароматний смак, який легко поєднати з багатьма стравами",
            ]
        )
        how = _bullets(["Додавайте до напоїв, десертів або випічки за смаком"])
        storage = _bullets(["У темному місці при кімнатній температурі"])
        important = _bullets(["Природне кристалізування можливе — це норма"])
    elif kind == "pickled":
        hook = "Мариновані гриби — готова закуска з насиченим смаком."
        about = "Зручно: відкрив — і можна подавати. Підійде і до буднів, і до святкового столу."
        advantages = _bullets(
            [
                "Готовий продукт: мінімум підготовки",
                "Смачно як закуска або як доповнення до страв",
            ]
        )
        how = _bullets(["Подавайте як закуску", "Додавайте у салати або гарніри"])
        storage = _bullets(["Після відкриття зберігати у холодильнику"])
        important = _bullets(["Продукт харчовий"])
    elif kind == "topical":
        hook = "Засіб для зовнішнього використання — зручний формат для догляду."
        about = "Компактно, практично та зрозуміло у використанні — усе ключове зазвичай зазначено на упаковці."
        advantages = _bullets(
            [
                "Зручний формат для дому та поїздок",
                "Просте застосування за інструкцією",
            ]
        )
        how = _bullets(["Використовуйте лише зовнішньо згідно інструкції на упаковці"])
        storage = _bullets(["Зберігати щільно закритим, подалі від дітей"])
        important = _bullets(["Лише для зовнішнього застосування"])
    elif kind == "device":
        hook = "Компактний інструмент для точних вимірювань у побуті."
        about = "Підійде для кухні, дому та хобі — коли важлива акуратність, повторюваність і зручність."
        advantages = _bullets(
            [
                "Зручно для дрібних задач вдома та у майстерні",
                "Компактний розмір — легко зберігати та перевозити",
            ]
        )
        how = _bullets(["Використовуйте згідно інструкції (якщо додається)"])
        storage = _bullets(["Зберігайте у футлярі та уникайте ударів"])
        important = []
    else:
        hook = "Якісний товар для щоденного використання."
        about = "Лаконічний опис і зрозумілі підказки допоможуть швидко зорієнтуватися перед покупкою."
        advantages = _bullets(
            [
                "Зрозумілий формат і прості підказки",
                "Підійде як практична покупка собі або на подарунок",
            ]
        )
        how = _bullets(["Використовуйте згідно призначення та рекомендацій на етикетці/упаковці"])
        storage = _bullets(["У сухому місці, подалі від прямих сонячних променів"])
        important = []

    lines: List[str] = [title, "", hook]

    lines += ["", *_section("Опис"), about]

    lines += ["", *_section("Переваги"), *advantages]

    if characteristics:
        lines += ["", *_section("Характеристики"), *_bullets(characteristics)]

    lines += ["", *_section("Як використовувати"), *how]
    lines += ["", *_section("Зберігання"), *storage]

    if not important:
        important = _bullets(["Деталі та особливості — дивіться на етикетці/упаковці"])
    lines += ["", *_section("Важливо"), *important]

    return _fmt_lines(lines)


def needs_rewrite(desc: str) -> bool:
    d = _clean_text(desc)
    if not d:
        return True
    if len(d) < 200:
        return True
    if _has_certish(d):
        return True
    if 1490 <= len(d) <= 1510:
        # Likely truncated by old importer; regenerate.
        return True
    return False


def iter_products(conn) -> Iterable[Dict[str, Any]]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, external_id, name, category, unit, pack_sizes, description
            FROM products
            ORDER BY id
            """
        )
        for row in cur.fetchall():
            yield dict(row)


def main() -> int:
    ap = argparse.ArgumentParser(description="Regenerate product descriptions in Postgres (safe templates).")
    ap.add_argument("--apply", action="store_true", help="Write updates to DB")
    ap.add_argument(
        "--scope",
        choices=["rewrite-needed", "all"],
        default="rewrite-needed",
        help="rewrite-needed: only update empty/short/boilerplate/truncated; all: overwrite all descriptions",
    )
    ap.add_argument("--limit", type=int, default=0, help="Limit number of updated rows (0 = no limit)")
    args = ap.parse_args()

    conn = connect_postgres()

    total = 0
    planned = 0
    updates: List[Tuple[str, int]] = []

    for row in iter_products(conn):
        total += 1
        current = _clean_text(row.get("description"))
        do = args.scope == "all" or needs_rewrite(current)
        if not do:
            continue
        new_desc = build_description(row)
        if not new_desc:
            continue
        if _clean_text(new_desc) == current:
            continue
        updates.append((new_desc, int(row["id"])))
        planned += 1
        if args.limit and planned >= args.limit:
            break

    print(f"Products total: {total}")
    print(f"Planned updates: {planned}")
    print(f"Scope: {args.scope} apply={args.apply}")

    if not updates:
        return 0

    # Show a couple examples
    print("\nExamples (first 3):")
    for desc, pid in updates[:3]:
        preview = desc[:90].replace("\n", " \\n ")
        print(f"- id={pid} new_len={len(desc)} preview={preview}")

    if not args.apply:
        print("\nDRY RUN: no changes applied")
        return 0

    with conn:
        with conn.cursor() as cur:
            cur.executemany("UPDATE products SET description=%s WHERE id=%s", updates)

    print("OK: updates applied")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
