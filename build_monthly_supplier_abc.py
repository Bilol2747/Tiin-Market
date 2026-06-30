"""Har bir TO'LIQ qoplangan oy uchun (Turso'dagi tarix shu oy boshidan
boshlanган bo'lsa) supplierlarning oylik tushumi va ABC guruhini hisoblaydi.

Faqat to'liq oylarni chiqaradi - masalan agar bazada eng erta yozuv
2026-03-10 bo'lsa, mart hisobga olinmaydi (1-10 mart yo'q), faqat aprel-iyun
chiqariladi. Backfill davom etgani sayin qayta ishga tushirilsa, ko'proq oy
qo'shilib boradi.

Natija sales.html va index.html ichidagi <script id="supplierMonthlyData">
blokiga yoziladi - alohida, butun saytni qayta qurmasdan."""
import json
import re
import time
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

from build_all_from_api import api_read_products, parse_local_date
from build_sales_demand import safe_item_revenue
from turso_sync import get_client, ensure_schema

ROOT = Path(__file__).parent
PRODUCTS_PATH = ROOT / "api_raw_products.json"


def month_range(d):
    start = d.replace(day=1)
    if start.month == 12:
        nxt = start.replace(year=start.year + 1, month=1)
    else:
        nxt = start.replace(month=start.month + 1)
    return start, nxt


def fetch_orders_between(client, start_date, end_date, chunk_size=5000):
    """[start_date, end_date) oralig'idagi orderlarni Turso'dan UTC chegara
    bilan o'qiydi (mahalliy oy chegarasidan ancha keng - aniqlik uchun keyin
    parse_local_date bilan tor filtrlanadi)."""
    orders = []
    offset = 0
    start_iso = (start_date - timedelta(days=1)).isoformat()
    end_iso = (end_date + timedelta(days=1)).isoformat()
    while True:
        rs = None
        last_error = None
        for attempt in range(1, 6):
            try:
                rs = client.execute(
                    "SELECT data FROM orders WHERE create_time >= ? AND create_time < ? "
                    "ORDER BY create_time, id LIMIT ? OFFSET ?",
                    [start_iso, end_iso, chunk_size, offset]
                )
                break
            except Exception as exc:
                last_error = exc
                wait = attempt * 3
                print(f"  ! Turso o'qishda xato ({exc.__class__.__name__}), {wait}s kutib qayta ({attempt}/5)...")
                time.sleep(wait)
        if rs is None:
            raise last_error
        batch = [json.loads(row["data"]) for row in rs.rows]
        orders.extend(batch)
        if len(batch) < chunk_size:
            break
        offset += chunk_size
    return orders


def compute_month_supplier_abc(orders, month_start, month_end, products):
    rev_by_sup = defaultdict(float)
    for order in orders:
        if order.get("type") != "sale":
            continue
        sale_date = parse_local_date(order.get("create_time"))
        if sale_date is None or not (month_start <= sale_date < month_end):
            continue
        for it in order.get("items") or []:
            qty = float(it.get("value") or 0)
            if qty <= 0:
                continue
            sku = str(it.get("sku") or "").strip()
            supplier = products.get(sku, {}).get("su") or "Noma'lum"
            rev_by_sup[supplier] += safe_item_revenue(it, qty)

    total_rev = sum(rev_by_sup.values()) or 1
    sorted_names = sorted(rev_by_sup, key=lambda n: -rev_by_sup[n])
    cumulative = 0.0
    abc_cnt = {"A": 0, "B": 0, "C": 0}
    suppliers = []
    for rank, name in enumerate(sorted_names, 1):
        rev = rev_by_sup[name]
        cumulative += rev
        pct = cumulative / total_rev
        abc = "A" if pct <= 0.80 else ("B" if pct <= 0.95 else "C")
        abc_cnt[abc] += 1
        suppliers.append({"name": name, "rev": round(rev), "abc": abc, "r": rank})
    return {
        "suppliers": suppliers,
        "abc_cnt": abc_cnt,
        "total_rev": round(total_rev),
        "sup_count": len(suppliers),
    }


def main():
    print("Mahsulot-supplier xaritasi yuklanmoqda...")
    with open(PRODUCTS_PATH, encoding="utf-8") as f:
        products_raw = json.load(f)
    products = api_read_products(products_raw)
    print(f"  {len(products)} ta mahsulot")

    client = get_client()
    ensure_schema(client)
    rs = client.execute("SELECT MIN(create_time) AS mn, MAX(create_time) AS mx FROM orders")
    row = rs.rows[0]
    overall_min = date.fromisoformat(row["mn"][:10])
    overall_max = date.fromisoformat(row["mx"][:10])
    print(f"Bazadagi tarix: {overall_min} -- {overall_max}")

    result = {}
    cursor = date(2026, 1, 1)
    while cursor <= overall_max:
        m_start, m_end = month_range(cursor)
        if m_start >= overall_min and m_end <= overall_max + timedelta(days=1):
            key = m_start.strftime("%Y-%m")
            print(f"{key} hisoblanmoqda ({m_start} -- {m_end})...")
            orders = fetch_orders_between(client, m_start, m_end)
            month_data = compute_month_supplier_abc(orders, m_start, m_end, products)
            result[key] = month_data
            print(f"  {month_data['sup_count']} ta supplier, jami {month_data['total_rev']:,} so'm")
        else:
            print(f"{m_start.strftime('%Y-%m')} o'tkazib yuborildi - to'liq qoplanmagan")
        cursor = m_end

    client.close()

    payload = json.dumps(result, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    pat = re.compile(r'(<script[^>]+id="supplierMonthlyData"[^>]*>)[\s\S]*?(</script>)', re.I)
    for fname in ["sales.html", "index.html"]:
        path = ROOT / fname
        html = path.read_text(encoding="utf-8")
        new_html, n = pat.subn(lambda m: m.group(1) + payload + m.group(2), html, count=1)
        if n != 1:
            print(f"  ! OGOHLANTIRISH: {fname} ichida supplierMonthlyData bloki topilmadi")
            continue
        path.write_text(new_html, encoding="utf-8")
        print(f"  {fname} yangilandi ({len(payload):,} bayt)")

    print(f"Tayyor - {len(result)} ta oy: {', '.join(result.keys())}")


if __name__ == "__main__":
    main()
