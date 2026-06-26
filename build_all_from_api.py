#!/usr/bin/env python3
"""
build_all_from_api.py — Invan API'dan olingan xom ma'lumot (api_raw_orders.json,
api_raw_products.json) asosida butun sales.html'ni qayta quradi.

build_all.py bilan bir xil vazifani bajaradi (p1/p2/p3/inv/dailydata + HTML
embed), faqat manba Excel emas, API. Kunlik talab/ulgurji hisobi
build_sales_demand.py'ning yaxshilangan mantig'idan ("doimiy/bir martalik"
ajratish) foydalanadi - shu orqali butun sayt bitta izchil mantiqqa tayanadi.

Foydalanish:
    python build_all_from_api.py --orders api_raw_orders.json --products api_raw_products.json
"""
import argparse
import json
import re
import shutil
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from pathlib import Path

from build_all import (
    rq, build_invdata, build_p2data, build_p3data, build_p1data, build_supplierdata, embed_html,
)
from build_sales_demand import api_records, safe_item_revenue, build as build_dailydata_improved

ROOT = Path(__file__).parent
TASHKENT_OFFSET = timedelta(hours=5)
ACTIVE_WINDOW_DAYS = 60  # Stock: aktiv/noaktiv ajratish uchun chegara


def norm(value):
    return re.sub(r"\s+", " ", str(value or "")).strip().lower()


def parse_local_date(create_time):
    try:
        utc_dt = datetime.fromisoformat(str(create_time).replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None
    return (utc_dt.replace(tzinfo=None) + TASHKENT_OFFSET).date()


def api_read_products(products_raw):
    """api_raw_products.json -> {sku: {name, cat, catTop, sub, tp, su, p, a}} (build_all.read_products bilan bir xil shakl)."""
    # Invan kategoriyalari daraxti: categories[0] odatda KICHIK (leaf/sub) kategoriya,
    # parent_id orqali KENG (top-level) kategoriyaga bog'langan. Avval butun katalog
    # bo'yicha id->nom xaritasini quramiz, shu orqali har bir mahsulot uchun eng
    # yuqori (top-level) kategoriya nomini topamiz - Noaktiv guruhlash uchun kerak.
    id_to_name = {}
    for p in products_raw:
        for c in (p.get("categories") or []):
            if c.get("id"):
                id_to_name[c["id"]] = c.get("name", "")

    products = {}
    for p in products_raw:
        sku = str(p.get("sku") or "").strip()
        if not sku:
            continue
        categories = p.get("categories") or []
        cat = categories[0].get("name", "") if categories else ""
        parent_id = categories[0].get("parent_id", "") if categories else ""
        cat_top = id_to_name.get(parent_id, "") or cat
        shop_prices = p.get("shop_prices") or {}
        price = 0.0
        supply_price = 0.0
        if shop_prices:
            first_shop = next(iter(shop_prices.values()))
            price = float(first_shop.get("retail_price") or 0)
            supply_price = float(first_shop.get("supply_price") or 0)
        measurement_values = p.get("measurement_values") or {}
        amount = 0.0
        if measurement_values:
            amount = float(next(iter(measurement_values.values())).get("amount") or 0)
        unit = (p.get("measurement_unit") or {}).get("short_name") or ""
        supplier = (p.get("supplier") or {}).get("name") or ""
        products[sku] = {
            "name": norm(p.get("name")),
            "cat": cat,
            "catTop": cat_top,
            "sub": "",
            "tp": unit,
            "su": supplier,
            "p": price,
            "sp": supply_price,
            "a": amount,
        }
    return products


def api_read_sales(orders):
    """api_raw_orders.json -> receipts, pnames, pskus, pcats, refund_total, refund_by_day, min_d, max_d
    (build_all.read_sales bilan bir xil shakl)."""
    receipts = {}
    pnames = defaultdict(Counter)
    pskus = {}
    pcats = defaultdict(Counter)
    refund_total = 0.0
    refund_by_day = defaultdict(float)
    min_d = max_d = None

    for order in orders:
        sale_date = parse_local_date(order.get("create_time"))
        if sale_date is None:
            continue

        if order.get("type") != "sale":
            amount = abs(float(order.get("total_price") or 0))
            refund_total += amount
            refund_by_day[sale_date] += amount
            continue

        min_d = sale_date if min_d is None or sale_date < min_d else min_d
        max_d = sale_date if max_d is None or sale_date > max_d else max_d

        receipt_id = order.get("id") or ""
        if not receipt_id:
            continue

        client = order.get("client") or {}
        customer = " ".join(
            part for part in [client.get("first_name", ""), client.get("last_name", "")] if part
        ).strip()
        created_by = order.get("created_by") or {}
        employee = " ".join(
            part for part in [created_by.get("first_name", ""), created_by.get("last_name", "")] if part
        ).strip()

        rc = receipts.setdefault(receipt_id, {
            "date": sale_date, "customer": "", "tin": "", "employee": "",
            "items": defaultdict(float), "item_rev": defaultdict(float),
        })
        if customer:
            rc["customer"] = customer
        if employee:
            rc["employee"] = employee

        for it in order.get("items") or []:
            qty = float(it.get("value") or 0)
            if qty <= 0:
                continue
            sku = str(it.get("sku") or "").strip()
            name = norm(it.get("product_name"))
            product_key = "sku:" + sku if sku else "name:" + name
            pnames[product_key][name] += 1
            pskus[product_key] = sku
            rc["items"][product_key] += qty
            rc["item_rev"][product_key] += safe_item_revenue(it, qty)

    return receipts, pnames, pskus, pcats, refund_total, refund_by_day, min_d, max_d


def compute_last_sale_dates(orders):
    """Har bir mahsulot nomi uchun oxirgi sotuv sanasini topadi (kengroq oynada,
    masalan 60 kun) - Stock'da aktiv/noaktiv ajratish uchun. Bu asosiy --days
    oynasidan kengroq bo'lishi mumkin, shu sabab alohida hisoblanadi."""
    last_sale = {}
    for order in orders:
        if order.get("type") != "sale":
            continue
        sale_date = parse_local_date(order.get("create_time"))
        if sale_date is None:
            continue
        for it in order.get("items") or []:
            qty = float(it.get("value") or 0)
            if qty <= 0:
                continue
            name = norm(it.get("product_name"))
            if not name:
                continue
            if name not in last_sale or sale_date > last_sale[name]:
                last_sale[name] = sale_date
    return last_sale


def build(orders, products_path, html_path=None, last_sale_60=None):
    if html_path is None:
        html_path = ROOT / "sales.html"

    print(f"[1/6] Mahsulot katalogi o'qilmoqda: {Path(products_path).name}")
    products_raw = json.loads(Path(products_path).read_text(encoding="utf-8"))
    products = api_read_products(products_raw)
    print(f"      {len(products):,} mahsulot")

    print(f"[2/6] Sotuvlar tahlil qilinmoqda: {len(orders):,} ta buyurtma (Turso'dan)")
    receipts, pnames, pskus, pcats, refund_total, refund_by_day, min_d, max_d = api_read_sales(orders)
    print(f"      {len(receipts):,} chek  |  {min_d} -- {max_d}")

    print("[3/6] Kunlik talab/ulgurji tahlili qurilmoqda (yaxshilangan mantiq)...")
    dailydata = build_dailydata_improved(api_records(orders))
    print(f"      {len(dailydata['items']):,} mahsulot")

    print("[4/6] Mahsulot, inventar va ABC ma'lumotlari qurilmoqda...")
    arrivals_path = ROOT / "arrival_data.json"
    arrivals = json.loads(arrivals_path.read_text(encoding="utf-8")) if arrivals_path.exists() else {}
    if arrivals:
        print(f"      {len(arrivals):,} ta SKU uchun qo'lda import qilingan kirim sanasi qo'llanildi (arrival_data.json)")
    invdata = build_invdata(products, arrivals)
    if last_sale_60:
        matched = 0
        for name, iv in invdata.items():
            ld60 = last_sale_60.get(name)
            if ld60:
                iv["ld60"] = ld60.isoformat()
                matched += 1
        print(f"      {matched:,} mahsulotga {ACTIVE_WINDOW_DAYS} kunlik oxirgi sotuv sanasi qo'shildi")
    p2data = build_p2data(receipts, pnames, pskus, dailydata, products, min_d, max_d)
    p3data = build_p3data(p2data, dailydata, max_d)
    p1data = build_p1data(receipts, pnames, pskus, pcats, refund_total, refund_by_day, p2data, products, min_d, max_d)
    p1data["builtAt"] = (datetime.utcnow() + TASHKENT_OFFSET).strftime("%H:%M, %d/%m/%Y")
    supplierdata = build_supplierdata(p2data, products)
    a_count = sum(1 for i in p2data if i["abc"] == "A")
    b_count = sum(1 for i in p2data if i["abc"] == "B")
    c_count = sum(1 for i in p2data if i["abc"] == "C")
    print(f"      ABC: A={a_count}, B={b_count}, C={c_count}")

    print("[5/6] JSON fayllar yozilmoqda...")
    def _write_json(name, data):
        (ROOT / name).write_text(
            json.dumps(data, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )
    _write_json("data_daily.json", dailydata)
    _write_json("data_mahsulotlar.json", p2data)
    _write_json("data_inv_new.json", invdata)
    _write_json("data_supplier.json", supplierdata)

    print(f"[6/6] sales.html yangilanmoqda: {html_path.name}")
    template = ROOT / "sales.html"
    embed_html(html_path, invdata, p2data, p3data, dailydata, p1data, supplierdata,
               template_path=template if template != html_path else None)

    index_path = ROOT / "index.html"
    try:
        shutil.copyfile(html_path, index_path)
        print("      index.html yangilandi (Vercel uchun)")
    except OSError as e:
        print(f"      ! index.html nusxalashda xato: {e}")

    title = min_d.strftime("%B %Y")
    return {
        "status": "ok",
        "period": title,
        "products": len(p2data),
        "receipts": len(receipts),
        "abc": {"A": a_count, "B": b_count, "C": c_count},
    }


def main():
    parser = argparse.ArgumentParser(description="Invan API ma'lumoti bilan sales.html ni yangilash")
    parser.add_argument("--products", default="api_raw_products.json")
    parser.add_argument("--output", default="sales.html")
    args = parser.parse_args()

    from turso_sync import fetch_window
    print(f"[0/6] Turso bazasidan so'nggi {ACTIVE_WINDOW_DAYS} kunlik buyurtmalar o'qilmoqda...")
    orders = fetch_window(ACTIVE_WINDOW_DAYS)
    print(f"      {len(orders):,} ta buyurtma olindi")

    last_sale_60 = compute_last_sale_dates(orders)
    print(f"      {len(last_sale_60):,} mahsulot uchun {ACTIVE_WINDOW_DAYS} kunlik oxirgi sotuv sanasi hisoblandi")

    result = build(orders, ROOT / args.products, ROOT / args.output, last_sale_60=last_sale_60)

    print(f"\n{'='*40}")
    print(f"  TAYYOR! {result['period']}")
    print(f"  Mahsulotlar:  {result['products']:,}")
    print(f"  Cheklar:      {result['receipts']:,}")
    print(f"  ABC: A={result['abc']['A']}, B={result['abc']['B']}, C={result['abc']['C']}")
    print(f"{'='*40}")


if __name__ == "__main__":
    main()
