#!/usr/bin/env python3
"""
pipeline_adapter.py — bazadagi qatorlarni Invan API formatiga qaytaradi.

MAQSAD: mavjud hisob kodlarining BIRORTASINI ham o'zgartirmaslik.

Butun pipeline (`api_read_sales`, `build_dailydata_improved`, `build_p2data`,
`build_p3data`, `build_p1data`, `build_supplierdata`, `build_invdata` ...)
kiruvchi ma'lumot sifatida Invan API'dan kelgan `orders` ro'yxatini kutadi.
Bu fayl aynan o'sha shakldagi ro'yxatni SQLite bazasidan yasaydi.

Ya'ni o'zgaradigan yagona narsa — ma'lumot QAYERDAN olinishi:

    ilgari:  Turso / api_raw_orders.json  ->  orders  ->  pipeline
    endi:    SQLite (tiin.db)             ->  orders  ->  pipeline   (AYNAN O'SHA)

Hisob formulalari, ulgurji ajratish, ABC, zakas mantig'i — hech biri bu yerda
takrorlanmaydi va o'zgartirilmaydi.
"""
import sys
from datetime import date, timedelta
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(HERE))

TASHKENT_OFFSET_HOURS = 5


def _split_name(full):
    """Bazada ism bitta satr bo'lib saqlanadi. Pipeline `first_name`+`last_name`
    ni qayta birlashtiradi, shuning uchun hammasini `first_name` ga qo'yish
    natijani o'zgartirmaydi."""
    return {"first_name": full or "", "last_name": ""}


_CHUNK_DAYS = 14   # Turso HTTP javobi juda katta (502) bo'lmasligi uchun oynani bo'lish


def _date_chunks(dfrom, dto):
    """[dfrom, dto] oralig'ini ~_CHUNK_DAYS kunlik bo'laklarga ajratadi."""
    import datetime as _dt
    d0 = _dt.date.fromisoformat(dfrom) if dfrom else None
    d1 = _dt.date.fromisoformat(dto) if dto else _dt.date.today()
    if d0 is None:
        yield None, dto
        return
    cur = d0
    step = _dt.timedelta(days=_CHUNK_DAYS)
    while cur <= d1:
        nxt = min(cur + step - _dt.timedelta(days=1), d1)
        yield cur.isoformat(), nxt.isoformat()
        cur = nxt + _dt.timedelta(days=1)


def orders_from_db(con, dfrom=None, dto=None, only_sku=None):
    """SQLite -> Invan `orders` ro'yxati (pipeline kutgan shakl).

    Qaytariladigan har bir element `api_read_sales()` / `api_records()` /
    `compute_monthly_sku_stats()` ishlatadigan maydonlarni o'z ichiga oladi:
      id, create_time, type, total_price, client{}, created_by{},
      items[{sku, product_name, value, price, supply_price, total_price, barcode}]

    DIQQAT: sana oralig'i ~2 haftalik bo'laklarga bo'lib so'raladi — bitta
    so'rovda butun tarixni (yuz minglab qator) olish Turso'da HTTP 502
    bilan tugadi (javob juda katta). Bo'laklar orasida chek bo'linib
    qolmaydi (har bo'lak o'z ichida `ORDER BY r.id` bilan yakunlanadi),
    shuning uchun natija bitta so'rov bilan bir xil."""
    orders = []
    for cd_from, cd_to in _date_chunks(dfrom, dto):
        where, params = [], []
        if cd_from:
            where.append("r.d >= ?"); params.append(cd_from)
        if cd_to:
            where.append("r.d <= ?"); params.append(cd_to)
        w = ("WHERE " + " AND ".join(where)) if where else ""

        cur = None
        sql = (f"SELECT r.id, r.created_at, r.sign, r.total_price, r.customer, r.tin,"
               f" r.employee, i.sku, i.product_name, i.qty, i.price, i.supply_price,"
               f" i.revenue, i.barcode "
               f"FROM receipts r JOIN receipt_items i ON i.receipt_id = r.id "
               f"{w} ORDER BY r.id")
        for row in con.execute(sql, params):
            if cur is None or cur["id"] != row["id"]:
                cur = {
                    "id": row["id"],
                    "create_time": row["created_at"],
                    # sign = -1 bo'lsa qaytarish; pipeline `type != "sale"` deb tekshiradi
                    "type": "sale" if row["sign"] > 0 else "refund",
                    "total_price": row["total_price"],
                    "client": _split_name(row["customer"]),
                    "created_by": _split_name(row["employee"]),
                    "items": [],
                }
                orders.append(cur)
            if only_sku and row["sku"] != only_sku:
                continue
            cur["items"].append({
                "sku": row["sku"],
                "product_name": row["product_name"],
                "value": row["qty"],
                "price": row["price"],
                "supply_price": row["supply_price"],
                "total_price": row["revenue"],
                "barcode": row["barcode"],
            })
    return orders


INVAN_BASE_URL = "https://api.7i.uz/integration/v1"

_invan_session = None


def _session():
    """Ulanishlar HAVZASI (connection pool) bilan bo'lishilgan sessiya —
    har so'rov uchun yangi TCP/TLS ulanish ochish (`requests.post` to'g'ridan-
    to'g'ri chaqirilganda bo'lgani kabi) parallel ~12 so'rovni sinovda ~2x
    sekinlashtirgan edi (32s), `curl`dagi ~17s'ga yetish uchun kerak edi."""
    global _invan_session
    if _invan_session is None:
        import requests
        s = requests.Session()
        adapter = requests.adapters.HTTPAdapter(pool_connections=20, pool_maxsize=20)
        s.mount("https://", adapter)
        _invan_session = s
    return _invan_session


def invan_token():
    """INVAN_API_TOKEN muhit o'zgaruvchisi (Vercel), lokal sinov uchun
    api_token.txt zaxira sifatida — sync_worker.load_token() bilan bir xil."""
    import os
    t = os.environ.get("INVAN_API_TOKEN", "").strip()
    if t:
        return t
    p = ROOT / "api_token.txt"
    if p.exists():
        return p.read_text(encoding="utf-8").strip()
    return ""


def products_from_invan(token=None):
    """Invan `/products`'dan TO'G'RIDAN-TO'G'RI (Turso'siz) `{sku: {...}}`
    quradi — `products_from_db()` bilan AYNAN bir xil shakl (`api_read_products()`
    orqali, build_all_from_api.py'dan o'zgarishsiz import qilingan).

    2026-08-14: Turso yozish kvotasi uch marta tugagani va shu sabab
    stok/narx ma'lumoti soatlab eskirib qolgani sababli qo'shildi (Zakas
    va Mahsulotlar bo'limlari orasidagi son farqi shundan kelib chiqqan
    edi). Sahifalar PARALLEL olinadi (~12 sahifa, sinovda ketma-ket ~65s,
    parallel ~17s) — Vercel funksiyaning 60s chegarasiga ketma-ket sig'mas
    edi."""
    from concurrent.futures import ThreadPoolExecutor
    from build_all_from_api import api_read_products

    token = token or invan_token()
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    limit = 2000
    sess = _session()

    def fetch_page(page):
        resp = sess.post(
            f"{INVAN_BASE_URL}/products", headers=headers, timeout=55,
            params={"page": page, "limit": limit, "active_for_sale": "active"},
            json={"filters": []})
        resp.raise_for_status()
        body = resp.json()
        return body.get("data", []), int(body.get("total") or 0)

    first_batch, total = fetch_page(1)
    all_raw = list(first_batch)
    n_pages = max(1, (total + limit - 1) // limit)
    if n_pages > 1:
        with ThreadPoolExecutor(max_workers=n_pages - 1) as ex:
            for batch, _ in ex.map(fetch_page, range(2, n_pages + 1)):
                all_raw.extend(batch)

    return api_read_products(all_raw)


def supplier_orders_from_invan(token=None, max_days=120):
    """Invan `/supplier_order`'dan TO'G'RIDAN-TO'G'RI (Turso'siz) so'nggi
    `max_days` kunlik buyurtmalar ro'yxatini oladi.

    DIQQAT: raw Invan javobi (`id, external_id, created_at, status{name},
    supplier{name,id}, total_amount, items[{sku,product_name,expected_amount,
    received,cost,received_date,barcode,id}]`) `backend_p8_kirim.build_kirimdata()`
    kutgan maydonlarning AYNAN o'zi (tekshirildi) — `supplier_orders_from_db()`
    kabi qayta shakllantirish shart emas, to'g'ridan-to'g'ri uzatiladi.

    `max_days`ga cheklangan: ochiq (hali kelmagan) buyurtmalar va oxirgi kirim
    narxi/sanasi uchun amalda yetarli (>120 kun ochiq turgan PO — deyarli
    tashlab yuborilgan hisoblanadi), va butun ~18k+ buyurtma tarixini har
    so'rovda olish ikkalasi ham vaqt (Vercel 60s) ham xotira jihatidan
    imkonsiz edi."""
    from datetime import datetime, timedelta, timezone
    from concurrent.futures import ThreadPoolExecutor

    token = token or invan_token()
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    limit = 1000
    cutoff = datetime.now(timezone.utc) - timedelta(days=max_days)
    sess = _session()

    def fetch_page(page):
        resp = sess.post(
            f"{INVAN_BASE_URL}/supplier_order", headers=headers, timeout=55,
            params={"page": page, "limit": limit}, json={"filters": []})
        resp.raise_for_status()
        return resp.json().get("data", [])

    def order_dt(o):
        try:
            return datetime.fromisoformat(str(o.get("created_at", "")).replace("Z", "+00:00"))
        except (ValueError, TypeError):
            return datetime.now(timezone.utc)

    all_orders = []
    page = 1
    BATCH = 6  # ~6 sahifa parallel ~90-120 kunni qamrab oladi (sinovda tasdiqlangan)
    while True:
        pages = list(range(page, page + BATCH))
        with ThreadPoolExecutor(max_workers=BATCH) as ex:
            results = list(ex.map(fetch_page, pages))
        got_any = False
        stop = False
        for batch in results:
            if not batch:
                continue
            got_any = True
            all_orders.extend(batch)
            if order_dt(batch[-1]) < cutoff:
                stop = True
        if not got_any or stop or any(len(b) < limit for b in results):
            break
        page += BATCH
        if page > 60:  # xavfsizlik chegarasi — cheksiz aylanishning oldini olish
            break

    return all_orders


def products_from_db(con):
    """SQLite -> `api_read_products()` chiqishi bilan bir xil shakl:
    {sku: {name, cat, catTop, sub, tp, su, p, sp, a, bc}}"""
    out = {}
    for r in con.execute(
            "SELECT sku, name, cat, cat_top, unit, supplier, price, supply_price, stock "
            "FROM products"):
        out[r["sku"]] = {
            "name": r["name"], "cat": r["cat"], "catTop": r["cat_top"], "sub": "",
            "tp": r["unit"], "su": r["supplier"], "p": r["price"],
            "sp": r["supply_price"], "a": r["stock"], "bc": [],
        }
    for r in con.execute("SELECT sku, barcode FROM product_barcodes"):
        if r["sku"] in out:
            out[r["sku"]]["bc"].append(r["barcode"])
    return out


def supplier_orders_from_db(con):
    """SQLite -> Invan `supplier_order` ro'yxati (backend_p8_kirim kutgan shakl).

    DIQQAT (2026-08-03 tuzatildi): `received_date` uchun `a.raw_ts` (TO'LIQ
    soat:daqiqa bilan) ishlatiladi, `a.d` (kun aniqligida) EMAS. Avval `a.d`
    ishlatilganda, bitta SKU bir kunda ikki marta kirim qilingan hollarda
    (masalan ertalab Open, tushdan keyin Received) ikkala yozuv bir xil
    sanaga ega bo'lib qolib, `backend_p8_kirim._finalize_sku()` "eng so'nggi
    holat"ni NOTO'G'RI tanlab qolishi mumkin edi (real ma'lumotda 145 ta
    zakas farqidan bir qismi shundan kelib chiqqani aniqlangan)."""
    orders, cur = [], None
    for r in con.execute(
            "SELECT o.id, o.external_id, o.created_at, o.status, o.supplier, o.supplier_id,"
            " o.total_price, a.sku, a.product_name, a.qty, a.received_qty, a.cost, a.raw_ts "
            "FROM sup_orders o LEFT JOIN arrivals a ON a.order_id = o.id "
            "ORDER BY o.id"):
        if cur is None or cur["id"] != r["id"]:
            cur = {
                "id": r["id"], "external_id": r["external_id"],
                "created_at": r["created_at"],
                "status": {"name": r["status"]},
                "supplier": {"name": r["supplier"], "id": r["supplier_id"]},
                "total_amount": r["total_price"],
                "items": [],
            }
            orders.append(cur)
        if r["sku"]:
            cur["items"].append({
                "sku": r["sku"], "product_name": r["product_name"],
                "expected_amount": r["qty"], "received": r["received_qty"],
                "cost": r["cost"], "received_date": r["raw_ts"], "barcode": "",
            })
    return orders
