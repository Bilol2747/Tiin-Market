#!/usr/bin/env python3
"""
sync_worker.py — Invan API'dan bazaga INKREMENTAL sinxronizatsiya.

BU — SAYTNI "JONLI" QILADIGAN QISM.

Hozirgi arxitekturada har 30 daqiqada BUTUN ma'lumot noldan qayta hisoblanadi,
243 MB fayl git'ga yoziladi va Vercel qayta deploy qiladi. Bu yerda esa faqat
OXIRGI SINXRONIZATSIYADAN KEYIN paydo bo'lgan cheklar olinadi (odatda bir necha
o'nta) va faqat o'sha kunlarning jamlanmasi yangilanadi — bir necha yuz
millisekund. Shuning uchun uni har 30 daqiqada emas, har DAQIQADA ishlatish
mumkin.

Git ham, deploy ham, GitHub Actions ham bu jarayonda umuman qatnashmaydi.

Ishlatish:
    python backend/sync_worker.py              # doimiy ishlaydi (server uchun)
    python backend/sync_worker.py --once       # bir marta ishlab chiqadi (cron uchun)
    python backend/sync_worker.py --catalog    # faqat mahsulot katalogi/qoldiq
    python backend/sync_worker.py --once --verbose
"""
import argparse
import json
import os
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(HERE))

import requests                                          # noqa: E402
from backend_shared_utils import norm                    # noqa: E402
import db                                                # noqa: E402
from etl_from_turso import parse_order                   # noqa: E402

BASE_URL = "https://api.7i.uz/integration/v1"
ORDER_PAGE_SIZE = 500
PRODUCT_PAGE_SIZE = 2000
SESSION = requests.Session()

SALES_INTERVAL = 60          # sekund — sotuvlarni qanchalik tez-tez tekshirish
CATALOG_INTERVAL = 300       # sekund — qoldiq/katalogni yangilash oralig'i
OVERLAP_MINUTES = 30         # tahrirlangan/kechikkan cheklarni ushlash uchun orqaga qadam


def log(*a):
    print(datetime.now().strftime("%H:%M:%S"), *a, flush=True)


def load_token():
    t = os.environ.get("INVAN_API_TOKEN", "").strip()
    if t:
        return t
    p = ROOT / "api_token.txt"
    if p.exists():
        t = p.read_text(encoding="utf-8").strip()
    if not t:
        sys.exit("Invan token topilmadi (INVAN_API_TOKEN yoki api_token.txt).")
    return t


def request_with_retry(method, url, **kw):
    """fetch_api_data.py:31 bilan bir xil qayta urinish siyosati."""
    last = None
    for attempt in range(1, 6):
        try:
            resp = method(url, **kw)
            resp.raise_for_status()
            return resp
        except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as exc:
            last = exc
        except requests.exceptions.HTTPError as exc:
            status = exc.response.status_code if exc.response is not None else 0
            if status < 500:
                raise
            last = exc
        wait = attempt * 5
        log(f"  ! Tarmoq/server xatosi, {wait}s kutib qayta urinish ({attempt}/5)...")
        time.sleep(wait)
    raise last


# ─── Holat (watermark) ──────────────────────────────────────────────────────

def state_get(con, key, default=None):
    r = con.execute("SELECT value FROM sync_state WHERE key=?", (key,)).fetchone()
    return r[0] if r else default


def state_set(con, key, value):
    con.execute(
        "INSERT INTO sync_state(key, value, updated_at) VALUES(?,?,?) "
        "ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at",
        (key, str(value), datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")))


# ─── Sotuvlarni sinxronlash ─────────────────────────────────────────────────

REC_SQL = """INSERT INTO receipts
 (id, created_at, d, sign, total_price, discount, customer, tin, client_id,
  employee, shop, cashbox, external_id, is_wholesale)
 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
 ON CONFLICT(id) DO UPDATE SET
   created_at=excluded.created_at, d=excluded.d, sign=excluded.sign,
   total_price=excluded.total_price, discount=excluded.discount,
   customer=excluded.customer, tin=excluded.tin, client_id=excluded.client_id,
   employee=excluded.employee, shop=excluded.shop, cashbox=excluded.cashbox,
   external_id=excluded.external_id, is_wholesale=excluded.is_wholesale"""

ITEM_SQL = """INSERT INTO receipt_items
 (receipt_id, d, sign, sku, product_id, product_name, barcode,
  qty, price, supply_price, revenue, discount, unit)
 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)"""


def fetch_orders(token, start_iso, end_iso, verbose=False):
    headers = {"Authorization": f"Bearer {token}"}
    orders, page, total = [], 1, None
    while True:
        resp = request_with_retry(
            SESSION.get, f"{BASE_URL}/order", headers=headers, timeout=60,
            params={"page": page, "limit": ORDER_PAGE_SIZE,
                    "start_date": start_iso, "end_date": end_iso})
        body = resp.json()
        batch = body.get("data", [])
        if total is None:
            total = body.get("total", 0)
        orders.extend(batch)
        if verbose:
            log(f"  {page}-sahifa: {len(batch)} ta (jami {len(orders)}/{total})")
        if len(batch) < ORDER_PAGE_SIZE or len(orders) >= total:
            break
        page += 1
        time.sleep(0.05)
    return orders


def sync_sales(con, token, verbose=False):
    """Oxirgi watermark'dan keyingi cheklarni oladi va bazani yangilaydi.
    Qaytaradi: (yangi/yangilangan chek soni, ta'sirlangan kunlar to'plami)."""
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    last = state_get(con, "last_order_time")
    if not last:
        last = con.execute("SELECT MAX(created_at) FROM receipts").fetchone()[0]
    if last:
        start_dt = datetime.fromisoformat(str(last).replace("Z", "+00:00")).replace(tzinfo=None) \
                   - timedelta(minutes=OVERLAP_MINUTES)
    else:
        start_dt = now - timedelta(days=1)
        log("Baza bo'sh — so'nggi 1 kun olinadi.")

    start_iso = start_dt.isoformat() + "Z"
    end_iso = (now + timedelta(minutes=5)).isoformat() + "Z"
    orders = fetch_orders(token, start_iso, end_iso, verbose=verbose)
    if not orders:
        return 0, set()

    receipts, items, days, max_ct = [], [], set(), last or ""
    for o in orders:
        rec, its = parse_order(o)
        if rec is None:
            continue
        receipts.append(rec)
        items.extend(its)
        days.add(rec[2])
        if rec[1] > max_ct:
            max_ct = rec[1]

    if not receipts:
        return 0, set()

    ids = [r[0] for r in receipts]
    with con:
        con.executemany(REC_SQL, receipts)
        # Chek tahrirlangan bo'lishi mumkin → eski qatorlarini o'chirib qayta yozamiz.
        con.executemany("DELETE FROM receipt_items WHERE receipt_id = ?", [(i,) for i in ids])
        con.executemany(ITEM_SQL, items)
        refresh_rollups(con, days)
        state_set(con, "last_order_time", max_ct)
        state_set(con, "last_sync_at",
                  datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"))
    return len(receipts), days


def refresh_rollups(con, days):
    """Faqat ta'sirlangan kunlarning jamlanmasini qayta hisoblaydi.
    Butun bazani emas — shuning uchun bu operatsiya millisekundlarda tugaydi."""
    if not days:
        return
    marks = ",".join("?" * len(days))
    p = tuple(days)

    con.execute(f"DELETE FROM daily_sku WHERE d IN ({marks})", p)
    con.execute(f"""
        INSERT INTO daily_sku (d, sku, qty, revenue, cost, receipts)
        SELECT d, sku, SUM(qty*sign), SUM(revenue*sign),
               SUM(supply_price*qty*sign), COUNT(DISTINCT receipt_id)
        FROM receipt_items WHERE d IN ({marks}) AND sku <> '' GROUP BY d, sku""", p)

    con.execute(f"DELETE FROM daily_totals WHERE d IN ({marks})", p)
    con.execute(f"""
        INSERT INTO daily_totals (d, revenue, cost, receipts, items_qty, refund_total, wholesale_rev)
        SELECT i.d, SUM(i.revenue*i.sign), SUM(i.supply_price*i.qty*i.sign),
               COUNT(DISTINCT i.receipt_id), SUM(i.qty*i.sign),
               SUM(CASE WHEN i.sign < 0 THEN i.revenue ELSE 0 END),
               SUM(CASE WHEN r.is_wholesale = 1 THEN i.revenue*i.sign ELSE 0 END)
        FROM receipt_items i JOIN receipts r ON r.id = i.receipt_id
        WHERE i.d IN ({marks}) GROUP BY i.d""", p)

    con.execute(f"DELETE FROM daily_employee WHERE d IN ({marks})", p)
    con.execute(f"""
        INSERT INTO daily_employee (d, employee, revenue, receipts)
        SELECT r.d, r.employee, SUM(i.revenue*i.sign), COUNT(DISTINCT r.id)
        FROM receipts r JOIN receipt_items i ON i.receipt_id = r.id
        WHERE r.d IN ({marks}) AND r.employee <> ''
        GROUP BY r.d, r.employee""", p)


# ─── Katalog / qoldiqni sinxronlash ─────────────────────────────────────────

def fetch_products(token, verbose=False):
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    out, page = [], 1
    while True:
        resp = request_with_retry(
            SESSION.post, f"{BASE_URL}/products", headers=headers, timeout=60,
            params={"page": page, "limit": PRODUCT_PAGE_SIZE, "active_for_sale": "active"},
            json={"filters": []})
        batch = resp.json().get("data", [])
        out.extend(batch)
        if verbose:
            log(f"  katalog {page}-sahifa: {len(batch)} ta (jami {len(out)})")
        if len(batch) < PRODUCT_PAGE_SIZE:
            break
        page += 1
        time.sleep(0.05)
    return out


def sync_catalog(con, token, verbose=False):
    """Mahsulot katalogi + JORIY QOLDIQ. Qoldiq doim o'zgarib turadi, shuning
    uchun sotuvlardan ko'ra kamroq, lekin muntazam yangilanadi."""
    raw = fetch_products(token, verbose=verbose)
    if not raw:
        return 0

    id_to_name = {}
    for p in raw:
        for c in (p.get("categories") or []):
            if c.get("id"):
                id_to_name[c["id"]] = c.get("name", "")

    rows, bcs = [], []
    now_iso = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    for p in raw:
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
        sup = p.get("supplier") or {}
        rows.append((sku, str(p.get("id") or ""), norm(p.get("name")), str(p.get("name") or ""),
                     cat, cat_top, str(sup.get("name") or ""), str(sup.get("id") or ""),
                     str((p.get("measurement_unit") or {}).get("short_name") or ""),
                     price, supply, stock, 1 if p.get("is_active", True) else 0, now_iso))
        for b in (p.get("barcode") or []):
            b = str(b).strip()
            if b:
                bcs.append((sku, b))

    with con:
        con.executemany(
            "INSERT INTO products (sku, product_id, name, name_raw, cat, cat_top, supplier,"
            " supplier_id, unit, price, supply_price, stock, is_active, updated_at)"
            " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
            " ON CONFLICT(sku) DO UPDATE SET name=excluded.name, name_raw=excluded.name_raw,"
            " cat=excluded.cat, cat_top=excluded.cat_top, supplier=excluded.supplier,"
            " supplier_id=excluded.supplier_id, unit=excluded.unit, price=excluded.price,"
            " supply_price=excluded.supply_price, stock=excluded.stock,"
            " is_active=excluded.is_active, updated_at=excluded.updated_at", rows)
        con.executemany("INSERT INTO product_barcodes (sku, barcode) VALUES (?,?) "
                        "ON CONFLICT DO NOTHING", bcs)
        # Qidiruv indeksini qayta qurish (21k qator — bir necha yuz ms).
        # Kontentsiz FTS5 jadvali DELETE ni qo'llab-quvvatlamaydi — 'delete-all' kerak.
        con.execute("INSERT INTO products_fts(products_fts) VALUES('delete-all')")
        con.execute(
            "INSERT INTO products_fts(rowid, name, sku, barcode) "
            "SELECT p.rowid, p.name_raw, p.sku, COALESCE("
            "  (SELECT group_concat(b.barcode,' ') FROM product_barcodes b WHERE b.sku=p.sku),'') "
            "FROM products p")
        state_set(con, "last_catalog_sync_at", now_iso)
    return len(rows)


# ─── Asosiy sikl ────────────────────────────────────────────────────────────

def run_once(con, token, with_catalog=True, verbose=False):
    t0 = time.time()
    n, days = sync_sales(con, token, verbose=verbose)
    dt = time.time() - t0
    if n:
        log(f"Sotuv: {n} ta chek yangilandi, {len(days)} kun qayta hisoblandi ({dt:.2f}s)")
    else:
        log(f"Sotuv: yangi chek yo'q ({dt:.2f}s)")
    if with_catalog:
        t1 = time.time()
        c = sync_catalog(con, token, verbose=verbose)
        log(f"Katalog: {c} ta mahsulot/qoldiq yangilandi ({time.time()-t1:.2f}s)")
    return n


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--once", action="store_true", help="bir marta ishlab chiqib to'xtaydi")
    ap.add_argument("--catalog", action="store_true", help="faqat katalog/qoldiqni yangilash")
    ap.add_argument("--interval", type=int, default=SALES_INTERVAL, help="sotuv sinxronizatsiyasi oralig'i (s)")
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()

    token = load_token()
    con = db.rw()

    if args.catalog:
        log(f"Katalog: {sync_catalog(con, token, verbose=args.verbose)} ta mahsulot yangilandi.")
        return
    if args.once:
        run_once(con, token, with_catalog=True, verbose=args.verbose)
        return

    log(f"Doimiy rejim: sotuv har {args.interval}s, katalog har {CATALOG_INTERVAL}s. "
        f"To'xtatish uchun Ctrl+C.")
    last_catalog = 0.0
    while True:
        try:
            do_catalog = (time.time() - last_catalog) >= CATALOG_INTERVAL
            run_once(con, token, with_catalog=do_catalog, verbose=args.verbose)
            if do_catalog:
                last_catalog = time.time()
        except KeyboardInterrupt:
            log("To'xtatildi.")
            break
        except Exception as exc:
            log(f"! XATO ({exc.__class__.__name__}): {exc} — {args.interval}s dan keyin qayta urinamiz.")
        time.sleep(args.interval)


if __name__ == "__main__":
    main()
