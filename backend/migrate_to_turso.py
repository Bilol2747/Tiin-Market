#!/usr/bin/env python3
"""
migrate_to_turso.py — LOKAL SQLite (backend/tiin.db) dagi ma'lumotni Turso'ga
ko'chiradi (bir martalik, bulk).

XAVFSIZLIK: faqat YANGI jadvallarga yozadi (`sup_orders`, `biz_clients` —
Turso'dagi ESKI `supplier_orders`/`clients_business` bilan ATAYLAB boshqa
nomda, hech qanday to'qnashuv yo'q). Eski uchta jadval (`orders`,
`supplier_orders`, `clients_business`) BU SKRIPT TOMONIDAN HECH QACHON
o'qilmaydi HAM, yozilmaydi HAM — jonli sayt ular bilan davom etaveradi.

Ishlatish:
    python backend/migrate_to_turso.py              # hammasi
    python backend/migrate_to_turso.py --only products,receipts
"""
import argparse
import sys
import time
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(HERE))

import libsql_client                       # noqa: E402
import db as localdb                        # noqa: E402
from etl_from_turso import turso_client     # noqa: E402

BATCH = 400  # bitta so'rovda nechta qator (Turso HTTP javob hajmini nazorat qilish uchun)


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)


# Har jadval uchun: (ustunlar ro'yxati, qaysi tartibda ko'chirilishi kerak).
# Tartib MUHIM — chet kalitlar (FK) tufayli: receipts -> receipt_items,
# sup_orders -> arrivals, products -> product_barcodes.
TABLES = [
    ("products", ["sku", "product_id", "name", "name_raw", "cat", "cat_top",
                  "supplier", "supplier_id", "unit", "price", "supply_price",
                  "stock", "is_active", "updated_at"]),
    ("product_barcodes", ["sku", "barcode"]),
    ("receipts", ["id", "created_at", "d", "sign", "total_price", "discount",
                  "customer", "tin", "client_id", "employee", "shop", "cashbox",
                  "external_id", "is_wholesale"]),
    ("receipt_items", ["receipt_id", "d", "sign", "sku", "product_id",
                       "product_name", "barcode", "qty", "price", "supply_price",
                       "revenue", "discount", "unit"]),
    ("sup_orders", ["id", "external_id", "created_at", "d", "expected_date",
                    "received_at", "status", "supplier", "supplier_id", "total_price"]),
    ("arrivals", ["order_id", "d", "raw_ts", "status", "sku", "product_name",
                  "qty", "received_qty", "cost", "supplier"]),
    ("biz_clients", ["id", "tin", "nom", "tel", "external_id", "xarid", "balans",
                     "guruh", "shartnoma", "shartnoma_sana", "qarzga_ruxsat", "synced_at"]),
    ("daily_sku", ["d", "sku", "qty", "revenue", "cost", "receipts"]),
    ("daily_totals", ["d", "revenue", "cost", "receipts", "items_qty",
                      "refund_total", "wholesale_rev"]),
    ("daily_employee", ["d", "employee", "revenue", "receipts"]),
]


def migrate_table(lcon, tclient, name, cols):
    total = lcon.execute(f"SELECT COUNT(*) FROM {name}").fetchone()[0]
    if total == 0:
        log(f"{name}: bo'sh, o'tkazib yuborildi")
        return 0
    log(f"{name}: {total:,} qator ko'chirilmoqda...")

    placeholders = ",".join("?" * len(cols))
    col_list = ",".join(cols)
    sql = f"INSERT OR REPLACE INTO {name} ({col_list}) VALUES ({placeholders})"

    done = 0
    t0 = time.time()
    cur = lcon.execute(f"SELECT {col_list} FROM {name}")
    while True:
        rows = cur.fetchmany(BATCH)
        if not rows:
            break
        stmts = [libsql_client.Statement(sql, list(r)) for r in rows]
        for attempt in range(1, 6):
            try:
                tclient.batch(stmts)
                break
            except Exception as exc:
                if attempt == 5:
                    raise
                wait = attempt * 3
                log(f"  ! xato ({exc.__class__.__name__}), {wait}s kutib qayta ({attempt}/5)")
                time.sleep(wait)
        done += len(rows)
        if done % (BATCH * 10) == 0 or done == total:
            rate = done / (time.time() - t0)
            log(f"  {done:,}/{total:,} ({rate:.0f} qator/s)")
    log(f"{name}: TAYYOR, {done:,} qator, {time.time()-t0:.1f}s")
    return done


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="", help="vergul bilan: masalan 'products,receipts'")
    args = ap.parse_args()
    only = set(x.strip() for x in args.only.split(",") if x.strip())

    lcon = localdb.ro()
    tclient = turso_client()
    try:
        for name, cols in TABLES:
            if only and name not in only:
                continue
            migrate_table(lcon, tclient, name, cols)
    finally:
        tclient.close()
    log("Hammasi tugadi.")


if __name__ == "__main__":
    main()
