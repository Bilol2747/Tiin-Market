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


def orders_from_db(con, dfrom=None, dto=None, only_sku=None):
    """SQLite -> Invan `orders` ro'yxati (pipeline kutgan shakl).

    Qaytariladigan har bir element `api_read_sales()` / `api_records()` /
    `compute_monthly_sku_stats()` ishlatadigan maydonlarni o'z ichiga oladi:
      id, create_time, type, total_price, client{}, created_by{},
      items[{sku, product_name, value, price, supply_price, total_price, barcode}]
    """
    where, params = [], []
    if dfrom:
        where.append("r.d >= ?"); params.append(dfrom)
    if dto:
        where.append("r.d <= ?"); params.append(dto)
    w = ("WHERE " + " AND ".join(where)) if where else ""

    orders, cur = [], None
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
    """SQLite -> Invan `supplier_order` ro'yxati (backend_p8_kirim kutgan shakl)."""
    orders, cur = [], None
    for r in con.execute(
            "SELECT o.id, o.external_id, o.created_at, o.status, o.supplier, o.supplier_id,"
            " o.total_price, a.sku, a.product_name, a.qty, a.received_qty, a.cost, a.d "
            "FROM supplier_orders o LEFT JOIN arrivals a ON a.order_id = o.id "
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
                "cost": r["cost"], "received_date": r["d"], "barcode": "",
            })
    return orders
