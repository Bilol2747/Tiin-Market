#!/usr/bin/env python3
"""
etl_from_turso.py — BIR MARTALIK ko'chirish: Turso'dagi JSON-blob `orders`
jadvalini yangi normallashtirilgan SQLite bazasiga o'giradi.

Nega kerak: eski `orders(id, create_time, data TEXT)` sxemasida har chek ~10 KB
JSON blob (104k chek = 1.4 GB). Undan "SKU X ning 30 kunlik sotuvi"ni so'rash
uchun butun bazani skan qilish shart. Normallashtirilgandan keyin xuddi shu
savol indeks bo'yicha ~1 ms da javob oladi.

Bu skript FAQAT O'QIYDI (Turso'ga hech narsa yozmaydi) va jonli saytga
umuman tegmaydi — natija alohida `backend/tiin.db` fayliga tushadi.

Ishlatish:
    python backend/etl_from_turso.py                # to'liq ko'chirish (davom ettiriladi)
    python backend/etl_from_turso.py --reset        # noldan boshlash
    python backend/etl_from_turso.py --limit 5000   # sinov uchun qisman

To'xtab qolsa qayta ishga tushiring — qayerda to'xtaganidan davom etadi
(`sync_state` jadvalidagi kursor orqali).
"""
import argparse
import json
import os
import sqlite3
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parent
sys.path.insert(0, str(ROOT))

import libsql_client                                    # noqa: E402
from backend_shared_utils import norm, is_wholesale     # noqa: E402

DB_PATH = HERE / "tiin.db"
SCHEMA_PATH = HERE / "schema.sql"
TASHKENT_OFFSET = timedelta(hours=5)   # build_all_from_api.py:35 bilan bir xil
READ_CHUNK = 400                       # bitta Turso so'rovida nechta chek (~4 MB javob)


# ─── Turso (manba) ──────────────────────────────────────────────────────────

def load_turso_creds():
    """turso_sync.py:26 bilan aynan bir xil mantiq."""
    url = os.environ.get("TURSO_DATABASE_URL", "").strip()
    token = os.environ.get("TURSO_AUTH_TOKEN", "").strip()
    if not url:
        p = ROOT / "turso_url.txt"
        if p.exists():
            url = p.read_text(encoding="utf-8").strip()
    if not token:
        p = ROOT / "turso_token.txt"
        if p.exists():
            token = p.read_text(encoding="utf-8").strip()
    if not url or not token:
        sys.exit("Turso URL/token topilmadi (turso_url.txt / turso_token.txt yoki muhit o'zgaruvchilari).")
    return url.replace("libsql://", "https://"), token


def turso_client():
    url, token = load_turso_creds()
    return libsql_client.create_client_sync(url=url, auth_token=token)


def turso_query(client, sql, params, retries=5):
    """Tarmoq xatosida qayta urinadi (turso_sync.py:143 naqshi)."""
    last = None
    for attempt in range(1, retries + 1):
        try:
            return client.execute(sql, params)
        except Exception as exc:
            last = exc
            wait = attempt * 3
            print(f"  ! Turso xatosi ({exc.__class__.__name__}), {wait}s kutib qayta urinish ({attempt}/{retries})...",
                  flush=True)
            time.sleep(wait)
    raise last


# ─── Mahalliy baza (maqsad) ─────────────────────────────────────────────────

def open_db(reset=False):
    if reset and DB_PATH.exists():
        DB_PATH.unlink()
        print(f"Eski baza o'chirildi: {DB_PATH}")
    con = sqlite3.connect(DB_PATH)
    con.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))
    # Ommaviy yozish uchun tezlashtirish (ETL davomida xavfsiz — qayta ishga
    # tushirilsa kursordan davom etadi, ya'ni yarim yozilgan holat tuzatiladi).
    con.execute("PRAGMA cache_size = -200000")   # ~200 MB
    con.execute("PRAGMA temp_store = MEMORY")
    return con


def state_get(con, key, default=None):
    row = con.execute("SELECT value FROM sync_state WHERE key=?", (key,)).fetchone()
    return row[0] if row else default


def state_set(con, key, value):
    con.execute(
        "INSERT INTO sync_state(key, value, updated_at) VALUES(?,?,?) "
        "ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at",
        (key, str(value), datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")),
    )


# ─── Parsing (mavjud Python semantikasi bilan bir xil) ──────────────────────

def parse_local_date(create_time):
    """build_all_from_api.py:52 — UTC → Toshkent mahalliy sanasi."""
    try:
        utc_dt = datetime.fromisoformat(str(create_time).replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None
    return (utc_dt.replace(tzinfo=None) + TASHKENT_OFFSET).date()


def safe_item_revenue(item, qty):
    """build_sales_demand.py:157 — total_price manfiy bo'lsa narx×miqdordan tiklaydi."""
    total = float(item.get("total_price") or 0)
    if total < 0 and qty > 0:
        return float(item.get("price") or 0) * qty
    return total


def _full_name(obj):
    if not isinstance(obj, dict):
        return ""
    return " ".join(p for p in [obj.get("first_name") or "", obj.get("last_name") or ""] if p).strip()


def parse_order(order):
    """Bitta Invan chekini (receipt_row, [item_row, ...]) ga o'giradi."""
    sale_date = parse_local_date(order.get("create_time"))
    receipt_id = str(order.get("id") or "")
    if sale_date is None or not receipt_id:
        return None, []

    sign = 1 if order.get("type") == "sale" else -1
    client = order.get("client") or {}
    customer = _full_name(client)
    # API javobida alohida STIR maydoni yo'q (build_sales_demand.py:170 izohi).
    tin = str(client.get("tin") or client.get("inn") or "").strip()
    discount = order.get("discount") or {}

    receipt = (
        receipt_id,
        str(order.get("create_time") or ""),
        sale_date.isoformat(),
        sign,
        float(order.get("total_price") or 0),
        float(discount.get("price") or 0) if isinstance(discount, dict) else 0.0,
        customer,
        tin,
        str(client.get("id") or ""),
        _full_name(order.get("created_by")),
        str((order.get("shop") or {}).get("title") or ""),
        str((order.get("cashbox") or {}).get("title") or ""),
        str(order.get("external_id") or ""),
        1 if is_wholesale(customer, tin) else 0,
    )

    d_iso = sale_date.isoformat()
    items = []
    for it in order.get("items") or []:
        qty = float(it.get("value") or 0)
        if qty <= 0:
            continue
        it_disc = it.get("discount") or {}
        items.append((
            receipt_id,
            d_iso,
            sign,
            str(it.get("sku") or "").strip(),
            str(it.get("product_id") or ""),
            norm(it.get("product_name")),
            str(it.get("barcode") or "").strip(),
            qty,
            float(it.get("price") or 0),
            float(it.get("supply_price") or 0),
            safe_item_revenue(it, qty),
            float(it_disc.get("price") or 0) if isinstance(it_disc, dict) else 0.0,
            str(it.get("measurement_unit") or ""),
        ))
    return receipt, items


# ─── Bosqich 1: cheklarni ko'chirish ────────────────────────────────────────

REC_SQL = """INSERT INTO receipts
 (id, created_at, d, sign, total_price, discount, customer, tin, client_id,
  employee, shop, cashbox, external_id, is_wholesale)
 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
 ON CONFLICT(id) DO NOTHING"""

ITEM_SQL = """INSERT INTO receipt_items
 (receipt_id, d, sign, sku, product_id, product_name, barcode,
  qty, price, supply_price, revenue, discount, unit)
 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)"""


def migrate_orders(con, client, limit=None):
    total_src = turso_query(client, "SELECT COUNT(*) AS c FROM orders", []).rows[0]["c"]
    print(f"Manbada {total_src:,} ta chek bor.")

    cur_ct = state_get(con, "etl_cursor_create_time")
    cur_id = state_get(con, "etl_cursor_id")
    done = int(state_get(con, "etl_done_count", "0"))
    if done:
        print(f"Davom ettirilmoqda: {done:,} ta chek allaqachon ko'chirilgan.")

    t0 = time.time()
    while True:
        params, where = [], ""
        if cur_ct is not None and cur_id is not None:
            where = "WHERE (create_time > ? OR (create_time = ? AND id > ?)) "
            params = [cur_ct, cur_ct, cur_id]
        params.append(READ_CHUNK)
        rs = turso_query(
            client,
            "SELECT id, create_time, data FROM orders " + where + "ORDER BY create_time, id LIMIT ?",
            params,
        )
        rows = rs.rows
        if not rows:
            break

        receipts, items = [], []
        for row in rows:
            try:
                order = json.loads(row["data"])
            except (ValueError, TypeError):
                continue
            rec, its = parse_order(order)
            if rec is None:
                continue
            receipts.append(rec)
            items.extend(its)

        con.executemany(REC_SQL, receipts)
        con.executemany(ITEM_SQL, items)

        cur_ct = rows[-1]["create_time"]
        cur_id = rows[-1]["id"]
        done += len(rows)
        state_set(con, "etl_cursor_create_time", cur_ct)
        state_set(con, "etl_cursor_id", cur_id)
        state_set(con, "etl_done_count", done)
        con.commit()

        el = time.time() - t0
        rate = done / el if el > 0 else 0
        pct = 100.0 * done / total_src if total_src else 0
        eta = (total_src - done) / rate / 60 if rate > 0 else 0
        print(f"  {done:,}/{total_src:,} ({pct:.1f}%)  {rate:.0f} chek/s  taxminan {eta:.1f} daqiqa qoldi",
              flush=True)

        if len(rows) < READ_CHUNK:
            break
        if limit and done >= limit:
            print(f"  --limit {limit} ga yetildi, to'xtatildi.")
            break

    print(f"Cheklar ko'chirildi: {done:,} ta, {(time.time()-t0)/60:.1f} daqiqada.")


# ─── Bosqich 2: mahsulot katalogi (lokal api_raw_products.json dan) ─────────

def migrate_products(con):
    src = ROOT / "api_raw_products.json"
    if not src.exists():
        print("! api_raw_products.json topilmadi — katalog bosqichi o'tkazib yuborildi.")
        return
    print("Mahsulot katalogi o'qilmoqda...")
    raw = json.loads(src.read_text(encoding="utf-8"))
    products_raw = raw.get("data") if isinstance(raw, dict) else raw
    if not isinstance(products_raw, list):
        print("! api_raw_products.json kutilgan formatda emas — o'tkazib yuborildi.")
        return

    # Kategoriya daraxti: id → nom (build_all_from_api.py:66 bilan bir xil)
    id_to_name = {}
    for p in products_raw:
        for c in (p.get("categories") or []):
            if c.get("id"):
                id_to_name[c["id"]] = c.get("name", "")

    rows, bcs = [], []
    for p in products_raw:
        sku = str(p.get("sku") or "").strip()
        if not sku:
            continue
        cats = p.get("categories") or []
        cat = cats[0].get("name", "") if cats else ""
        cat_top = id_to_name.get(cats[0].get("parent_id", "") if cats else "", "") or cat

        shop_prices = p.get("shop_prices") or {}
        price = supply = 0.0
        if shop_prices:
            first = next(iter(shop_prices.values()))
            price = float(first.get("retail_price") or 0)
            if price <= 0:
                tiers = [t for t in (first.get("shop_price_tiers") or [])
                         if float(t.get("retail_price") or 0) > 0]
                if tiers:
                    price = float(sorted(tiers, key=lambda x: float(x.get("min_quantity") or 1))[0]
                                  .get("retail_price") or 0)
            supply = float(first.get("supply_price") or first.get("last_supply_price") or 0)

        mv = p.get("measurement_values") or {}
        stock = float(next(iter(mv.values())).get("amount") or 0) if mv else 0.0
        supplier = p.get("supplier") or {}

        rows.append((
            sku, str(p.get("id") or ""), norm(p.get("name")), str(p.get("name") or ""),
            cat, cat_top, str(supplier.get("name") or ""), str(supplier.get("id") or ""),
            str((p.get("measurement_unit") or {}).get("short_name") or ""),
            price, supply, stock,
            1 if p.get("is_active", True) else 0,
            datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        ))
        for b in (p.get("barcode") or []):
            b = str(b).strip()
            if b:
                bcs.append((sku, b))

    con.executemany(
        "INSERT INTO products (sku, product_id, name, name_raw, cat, cat_top, supplier, supplier_id,"
        " unit, price, supply_price, stock, is_active, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
        " ON CONFLICT(sku) DO UPDATE SET name=excluded.name, name_raw=excluded.name_raw,"
        " cat=excluded.cat, cat_top=excluded.cat_top, supplier=excluded.supplier,"
        " supplier_id=excluded.supplier_id, unit=excluded.unit, price=excluded.price,"
        " supply_price=excluded.supply_price, stock=excluded.stock, is_active=excluded.is_active,"
        " updated_at=excluded.updated_at",
        rows)
    con.executemany("INSERT INTO product_barcodes (sku, barcode) VALUES (?,?) ON CONFLICT DO NOTHING", bcs)
    con.commit()
    print(f"Katalog: {len(rows):,} ta mahsulot, {len(bcs):,} ta shtrix-kod.")


# ─── Bosqich 2b: kirim (ta'minotchi buyurtmalari) ──────────────────────────

def _clean_barcode(v):
    """Invan barcode'ni '{4780088360116}' ko'rinishida ham qaytaradi."""
    s = str(v or "").strip().strip("{}")
    return s.split(",")[0].strip().strip('"') if s else ""


def parse_supplier_order(o):
    """Bitta Invan supplier_order'ini (order_row, [arrival_row, ...]) ga o'giradi.

    Bu funksiya `etl_from_turso.py` (bir martalik ko'chirish) VA
    `sync_worker.py` (jonli inkremental sinxronizatsiya) tomonidan BAHAM
    ko'riladi — ikkalasi ham bir xil natija berishi uchun.

    Ajratish qoidalari backend_p8_kirim.py:48 (`_extract_item_arrivals`) dan
    AYNAN ko'chirilgan — aks holda p8/p9/p10 raqamlari mavjud saytdan farq qiladi:
      * supplier.name == "PRICING" -> butun buyurtma tashlanadi (bu Invan'ning
        narx yangilash psevdo-buyurtmasi, haqiqiy yetkazib berish emas)
      * expected_amount ham, received ham 0 bo'lgan item tashlanadi (draft qator)
      * sana: item.received_date, bo'lmasa order.created_at

    MUHIM (2026-08-03 tuzatildi): har arrival uchun ham `d` (kun aniqligida,
    oraliq so'rovlar uchun) HAM `raw_ts` (to'liq soat:daqiqa bilan) saqlanadi.
    Sabab: bitta SKU bir kunda ikki marta kirim qilinishi mumkin (masalan
    ertalab buyurtma ochilib, tushdan keyin qabul qilinishi) — shunda `d`
    ikkalasida ham bir xil bo'lib qoladi va "eng so'nggi holat qanday"
    (Open/Received) savoliga TO'G'RI javob berib bo'lmaydi. `raw_ts` shu
    muammoni hal qiladi (pipeline_adapter.py:supplier_orders_from_db() shu
    ustunni ishlatadi).
    """
    supplier = o.get("supplier") or {}
    if str(supplier.get("name") or "").strip().upper() == "PRICING":
        return None, []
    oid = str(o.get("id") or "")
    if not oid:
        return None, []
    status = str((o.get("status") or {}).get("name") or "")
    created = str(o.get("created_at") or "")
    d0 = parse_local_date(created)
    recv_dates = [str(it.get("received_date") or "") for it in (o.get("items") or [])]
    order_row = (
        oid, str(o.get("external_id") or ""), created,
        d0.isoformat() if d0 else "",
        str(o.get("expected_date") or ""),
        max([r for r in recv_dates if r], default=""),
        status, str(supplier.get("name") or ""), str(supplier.get("id") or ""),
        float(o.get("total_amount") or 0),
    )
    arrivals = []
    for it in (o.get("items") or []):
        sku = str(it.get("sku") or "").strip()
        if not sku:
            continue
        expected = float(it.get("expected_amount") or 0)
        received = float(it.get("received") or 0)
        if not expected and not received:
            continue
        raw_ts = str(it.get("received_date") or created)
        dt = parse_local_date(raw_ts)
        arrivals.append((
            oid, dt.isoformat() if dt else "", raw_ts, status, sku,
            str(it.get("product_name") or ""), expected, received,
            float(it.get("cost") or 0), str(supplier.get("name") or ""),
        ))
    return order_row, arrivals


ORDER_UPSERT_SQL = (
    "INSERT INTO supplier_orders (id, external_id, created_at, d, expected_date,"
    " received_at, status, supplier, supplier_id, total_price)"
    " VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET"
    " external_id=excluded.external_id, expected_date=excluded.expected_date,"
    " received_at=excluded.received_at, status=excluded.status,"
    " supplier=excluded.supplier, total_price=excluded.total_price")
ARRIVAL_INSERT_SQL = (
    "INSERT INTO arrivals (order_id, d, raw_ts, status, sku, product_name, qty,"
    " received_qty, cost, supplier) VALUES (?,?,?,?,?,?,?,?,?,?)")


def migrate_supplier_orders(con, client):
    """Turso `supplier_orders` (JSON blob) -> supplier_orders + arrivals (bir martalik)."""
    total = turso_query(client, "SELECT COUNT(*) AS c FROM supplier_orders", []).rows[0]["c"]
    print(f"Kirim: manbada {total:,} ta ta'minotchi buyurtmasi.")

    # `arrivals` da (order_id, sku) yagona emas — bitta buyurtmada bir xil SKU
    # bir necha qatorda kelishi MUMKIN va bu haqiqiy holat (Invan'ning
    # total_amount raqami bilan tasdiqlangan). Shuning uchun qayta ishga
    # tushirishda dublikat paydo bo'lmasligi uchun jadval to'liq tozalanadi.
    con.execute("DELETE FROM arrivals")
    con.commit()

    cur_ct = cur_id = None
    done = n_arr = 0
    t0 = time.time()
    while True:
        params, where = [], ""
        if cur_ct is not None:
            where = "WHERE (created_at > ? OR (created_at = ? AND id > ?)) "
            params = [cur_ct, cur_ct, cur_id]
        params.append(500)
        rs = turso_query(client,
                         "SELECT id, created_at, data FROM supplier_orders " + where +
                         "ORDER BY created_at, id LIMIT ?", params)
        if not rs.rows:
            break

        orders, arrivals = [], []
        for row in rs.rows:
            try:
                o = json.loads(row["data"])
            except (ValueError, TypeError):
                continue
            order_row, arr_rows = parse_supplier_order(o)
            if order_row is None:
                continue
            orders.append(order_row)
            arrivals.extend(arr_rows)

        con.executemany(ORDER_UPSERT_SQL, orders)
        con.executemany(ARRIVAL_INSERT_SQL, arrivals)
        con.commit()

        n_arr += len(arrivals)
        done += len(rs.rows)
        cur_ct, cur_id = rs.rows[-1]["created_at"], rs.rows[-1]["id"]
        print(f"  {done:,}/{total:,} buyurtma, {n_arr:,} kirim qatori", flush=True)
        if len(rs.rows) < 500:
            break

    print(f"Kirim ko'chirildi: {n_arr:,} qator, {(time.time()-t0)/60:.1f} daqiqada.")


def migrate_clients(con, client):
    """Turso `clients_business` — allaqachon normal jadval, to'g'ridan-to'g'ri ko'chadi."""
    rs = turso_query(client,
                     "SELECT id, tin, nom, tel, external_id, xarid, balans, guruh, shartnoma,"
                     " shartnoma_sana, qarzga_ruxsat, synced_at FROM clients_business", [])
    rows = [tuple(r[i] if r[i] is not None else ("" if i not in (5, 6, 10) else 0)
                  for i in range(12)) for r in rs.rows]
    con.executemany(
        "INSERT INTO clients_business (id, tin, nom, tel, external_id, xarid, balans, guruh,"
        " shartnoma, shartnoma_sana, qarzga_ruxsat, synced_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)"
        " ON CONFLICT(id) DO UPDATE SET tin=excluded.tin, nom=excluded.nom, tel=excluded.tel,"
        " xarid=excluded.xarid, balans=excluded.balans, guruh=excluded.guruh,"
        " shartnoma=excluded.shartnoma, shartnoma_sana=excluded.shartnoma_sana,"
        " qarzga_ruxsat=excluded.qarzga_ruxsat, synced_at=excluded.synced_at", rows)
    con.commit()
    print(f"Firmalar: {len(rows):,} ta ko'chirildi.")


def rebuild_fts(con):
    """Qidiruv indeksini noldan quradi (server tomonda qidiruv uchun)."""
    print("Qidiruv indeksi (FTS5) qurilmoqda...")
    # Kontentsiz FTS5 (content='') jadvalidan oddiy DELETE ishlamaydi —
    # tozalash uchun maxsus 'delete-all' buyrug'i ishlatiladi.
    con.execute("INSERT INTO products_fts(products_fts) VALUES('delete-all')")
    con.execute(
        "INSERT INTO products_fts(rowid, name, sku, barcode) "
        "SELECT p.rowid, p.name_raw, p.sku, COALESCE("
        "  (SELECT group_concat(b.barcode,' ') FROM product_barcodes b WHERE b.sku=p.sku), '') "
        "FROM products p"
    )
    con.commit()


# ─── Bosqich 3: kunlik jamlanmalar ("iliq" qatlam) ──────────────────────────

def rebuild_rollups(con):
    print("Kunlik jamlanmalar hisoblanmoqda...")
    con.execute("DELETE FROM daily_sku")
    con.execute("""
        INSERT INTO daily_sku (d, sku, qty, revenue, cost, receipts)
        SELECT d, sku,
               SUM(qty * sign),
               SUM(revenue * sign),
               SUM(supply_price * qty * sign),
               COUNT(DISTINCT receipt_id)
        FROM receipt_items
        WHERE sku <> ''
        GROUP BY d, sku
    """)
    con.execute("DELETE FROM daily_totals")
    con.execute("""
        INSERT INTO daily_totals (d, revenue, cost, receipts, items_qty, refund_total, wholesale_rev)
        SELECT i.d,
               SUM(i.revenue * i.sign),
               SUM(i.supply_price * i.qty * i.sign),
               COUNT(DISTINCT i.receipt_id),
               SUM(i.qty * i.sign),
               SUM(CASE WHEN i.sign < 0 THEN i.revenue ELSE 0 END),
               SUM(CASE WHEN r.is_wholesale = 1 THEN i.revenue * i.sign ELSE 0 END)
        FROM receipt_items i
        JOIN receipts r ON r.id = i.receipt_id
        GROUP BY i.d
    """)
    con.execute("DELETE FROM daily_employee")
    con.execute("""
        INSERT INTO daily_employee (d, employee, revenue, receipts)
        SELECT r.d, r.employee, SUM(i.revenue * i.sign), COUNT(DISTINCT r.id)
        FROM receipts r JOIN receipt_items i ON i.receipt_id = r.id
        WHERE r.employee <> ''
        GROUP BY r.d, r.employee
    """)
    con.commit()
    n1 = con.execute("SELECT COUNT(*) FROM daily_sku").fetchone()[0]
    n2 = con.execute("SELECT COUNT(*) FROM daily_totals").fetchone()[0]
    n3 = con.execute("SELECT COUNT(*) FROM daily_employee").fetchone()[0]
    print(f"Jamlanma: {n1:,} ta (kun×SKU), {n2:,} ta kun, {n3:,} ta (kun×xodim) qator.")


# ─── Asosiy ─────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--reset", action="store_true", help="bazani noldan qayta qurish")
    ap.add_argument("--limit", type=int, default=0, help="sinov uchun: shuncha chekdan keyin to'xtash")
    ap.add_argument("--skip-orders", action="store_true", help="sotuvlarni ko'chirmaslik")
    ap.add_argument("--skip-kirim", action="store_true", help="kirim/firmalarni ko'chirmaslik")
    ap.add_argument("--skip-catalog", action="store_true",
                    help="katalogni lokal fayldan qayta yozmaslik (chopar yangiroq olgan bo'lsa)")
    args = ap.parse_args()

    con = open_db(reset=args.reset)
    print(f"Maqsad baza: {DB_PATH}")

    need_turso = not (args.skip_orders and args.skip_kirim)
    if need_turso:
        client = turso_client()
        try:
            if not args.skip_orders:
                migrate_orders(con, client, limit=args.limit or None)
            if not args.skip_kirim:
                migrate_supplier_orders(con, client)
                migrate_clients(con, client)
        finally:
            client.close()

    # DIQQAT: katalog lokal `api_raw_products.json` dan o'qiladi va u ESKIRGAN
    # bo'lishi mumkin. sync_worker jonli API'dan yangiroq katalog olib bo'lgan
    # bo'lsa, bu qadamni --skip-catalog bilan o'tkazib yuborish kerak.
    if not args.skip_catalog:
        migrate_products(con)
    rebuild_fts(con)
    rebuild_rollups(con)

    print("\nOptimallashtirilmoqda (ANALYZE + VACUUM)...")
    con.execute("ANALYZE")
    con.commit()
    con.execute("VACUUM")
    con.close()

    size_mb = DB_PATH.stat().st_size / 1048576
    print(f"\nTayyor. Baza hajmi: {size_mb:.1f} MB  (eski Turso: ~1434 MB)")


if __name__ == "__main__":
    main()
