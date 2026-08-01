#!/usr/bin/env python3
"""
build_all_from_api.py — Invan API'dan olingan xom ma'lumot (api_raw_orders.json,
api_raw_products.json) asosida butun sales.html'ni qayta quradi.

build_legacy_excel_pipeline.py bilan bir xil vazifani bajaradi (p1/p2/p3/inv/dailydata + HTML
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
from datetime import date, datetime, timedelta
from pathlib import Path

from backend_shared_utils import rq, MONTHS_UZ
from backend_p5_stock import build_invdata
from backend_p2_mahsulotlar import build_p2data
from backend_p3_abc import build_p3data
from backend_p1_boshsahifa import build_p1data
from backend_p6_suppliers import build_supplierdata, build_supplier_months, kirim_cost_breakpoints, cost_at, kirim_supplier_breakpoints, supplier_at, SUSPICIOUS_COST_MULTIPLIER
from backend_p8_kirim import merge_kirimdata, pending_order_ids
from backend_p9_ombor_aylanmasi import build_stock_snapshot
from backend_html_embed import embed_html
from turso_sync_supplier_orders import fetch_supplier_orders, fetch_orders_by_ids
from build_sales_demand import api_records, safe_item_revenue, build as build_dailydata_improved

ROOT = Path(__file__).parent
TASHKENT_OFFSET = timedelta(hours=5)
SITE_WINDOW_DAYS = 30  # P1/P2/P3/kunlik talab/Zakas/Stock uchun (30 kunga qisqartirildi: tarix data_history.json da)
HISTORY_BASE_DATE = date(2026, 1, 1)   # data_history.json uchun bosh sana
HISTORY_UPDATE_DAYS = 30               # SITE_WINDOW_DAYS bilan bir xil — oxirgi N kunni qayta yozadi
SUPPLIER_CACHE_PATH = ROOT / "supplier_months_cache.json"
SUPPLIER_CACHE_VERSION = 6  # v6: ta'minotchi endi kun-aniq (supplier_at) hisoblanadi, katalogdagi
                             # bitta "joriy" maydon emas - eski kesh noto'g'ri (statik) attributsiya
                             # bilan hisoblangan, shuning uchun versiya oshirilib to'liq qayta hisoblanadi.
KIRIM_PATH = ROOT / "data_kirim.json"
KIRIM_OVERLAP_DAYS = 5  # status Open/New -> Received o'zgarishini ushlash uchun, so'nggi N kunni qayta tekshiradi
STOCK_SNAPSHOT_PATH = ROOT / "data_stock_snapshot.json"


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
            if price <= 0:
                tiers = first_shop.get("shop_price_tiers") or []
                unit_tiers = [
                    tier for tier in tiers
                    if float(tier.get("retail_price") or 0) > 0
                ]
                if unit_tiers:
                    tier = sorted(unit_tiers, key=lambda x: float(x.get("min_quantity") or 1))[0]
                    price = float(tier.get("retail_price") or 0)
            supply_price = float(first_shop.get("supply_price") or first_shop.get("last_supply_price") or 0)
        measurement_values = p.get("measurement_values") or {}
        amount = 0.0
        if measurement_values:
            amount = float(next(iter(measurement_values.values())).get("amount") or 0)
        unit = (p.get("measurement_unit") or {}).get("short_name") or ""
        supplier = (p.get("supplier") or {}).get("name") or ""
        barcodes = [str(b).strip() for b in (p.get("barcode") or []) if str(b).strip()]
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
            "bc": barcodes,
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

        is_refund = order.get("type") != "sale"
        if is_refund:
            amount = abs(float(order.get("total_price") or 0))
            refund_total += amount
            refund_by_day[sale_date] += amount
        else:
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
            "is_refund": is_refund,
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
            sign = -1 if is_refund else 1
            rc["items"][product_key] += sign * qty
            rc["item_rev"][product_key] += sign * safe_item_revenue(it, qty)

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


def compute_monthly_sku_stats(orders, products=None, kirim_breakpoints=None, supplier_breakpoints=None):
    """Faqat Suppliers oylik ABC uchun YENGIL hisoblash: har bir buyurtma
    itemini SKU+ta'minotchi + oy bo'yicha yig'adi (daromad + nechta chekda
    uchragani). Og'ir kunlik/ulgurji pipeline (build_dailydata_improved) dan
    farqli - hech qanday kunlik massiv saqlamaydi, shuning uchun butun
    ACTIVE_WINDOW_DAYS (180 kun/6 oy) tarixini arzon tahlil qilish mumkin.
    `products`/`kirim_breakpoints` berilsa - har item uchun HAQIQIY tarixiy
    kirim narxi (aynan shu tranzaksiya sanasiga) qidirilib, tannarx ham
    (month_cost/month_cost_approx) hisoblanadi - kirim tarixi bo'lmasa
    products[sku]["sp"]/["p"] (joriy narx) ga fallback qilinadi.
    `supplier_breakpoints` berilsa - har item uchun O'SHA SOTUV KUNIGA aynan
    haqiqiy bo'lgan ta'minotchi (supplier_at()) topiladi - kirim tarixi
    bo'lmasa products[sku]["su"] (Invan katalogidagi joriy ta'minotchi) ga
    fallback qilinadi. Natijadagi xaritalar endi oddiy SKU emas, balki
    "SKU\\x1fTa'minotchi" composite kalit bilan indekslanadi - shu orqali
    bitta tovar oy ichida ta'minotchi almashtirsa (mas. yarim oy A, yarim
    oy B) ham har bir qism o'z ta'minotchisiga to'g'ri yozilishi mumkin
    (build_supplier_months() shu kalitni parslab guruhlaydi)."""
    month_rev = defaultdict(lambda: defaultdict(float))
    month_rec = defaultdict(lambda: defaultdict(set))
    month_qty = defaultdict(lambda: defaultdict(float))
    month_cost = defaultdict(lambda: defaultdict(float))
    month_cost_approx = defaultdict(lambda: defaultdict(bool))
    month_name = {}
    products = products or {}
    kirim_breakpoints = kirim_breakpoints or {}
    supplier_breakpoints = supplier_breakpoints or {}
    for order in orders:
        sign = -1 if order.get("type") != "sale" else 1
        sale_date = parse_local_date(order.get("create_time"))
        if sale_date is None:
            continue
        month_key = f"{sale_date.year:04d}-{sale_date.month:02d}"
        receipt_id = order.get("id") or ""
        for it in order.get("items") or []:
            qty = float(it.get("value") or 0)
            if qty <= 0:
                continue
            sku = str(it.get("sku") or "").strip()
            if not sku:
                continue
            rev = safe_item_revenue(it, qty)

            supplier = supplier_at(supplier_breakpoints.get(sku), sale_date)
            if not supplier:
                supplier = products.get(sku, {}).get("su") or "Noma'lum"
            key = sku + "\x1f" + supplier

            month_rev[month_key][key] += sign * rev
            month_qty[month_key][key] += sign * qty
            if receipt_id and sign > 0:
                month_rec[month_key][key].add(receipt_id)
            if key not in month_name:
                month_name[key] = norm(it.get("product_name"))

            unit_cost = cost_at(kirim_breakpoints.get(sku), sale_date)
            approx = unit_cost is None
            if approx:
                p = products.get(sku, {})
                unit_cost = p.get("sp") or p.get("p") or 0
            item_cost = sign * qty * unit_cost
            cap = rev * SUSPICIOUS_COST_MULTIPLIER
            if rev > 0 and item_cost > cap:
                item_cost = cap
                approx = True
            month_cost[month_key][key] += item_cost
            if approx:
                month_cost_approx[month_key][key] = True
    month_rec_count = {mk: {key: len(ids) for key, ids in d.items()} for mk, d in month_rec.items()}
    return month_rev, month_rec_count, month_name, month_qty, month_cost, month_cost_approx


def compute_monthly_sku_stats_from_history(hist, products=None, kirim_breakpoints=None,
                                            supplier_breakpoints=None, wanted_months=None):
    """compute_monthly_sku_stats() bilan bir xil natija shaklini beradi, lekin
    xom Turso buyurtmalari o'rniga ALLAQACHON hisoblangan data_history.json
    (kunlik, SKU bo'yicha tushum/miqdor/chek massivlari) dan foydalanadi.

    Nega kerak: Turso hisobi ko'chirilganda (yoki har qanday sababdan eski
    kunlar bazadan o'chib ketsa) o'sha davr uchun buyurtmalarni Turso'dan
    qayta so'rab bo'lmaydi - lekin data_history.json HAR BUILD'da faqat
    OXIRGI N kunni yangilaydi, eski kunlarni HECH QACHON o'chirmaydi
    (build_history_incremental()), shuning uchun Turso'da yo'qolgan davr
    uchun ham tushum/miqdor/chek ma'lumoti shu faylda saqlanib qoladi.
    Ta'minotchi/tannarx attributsiyasi compute_monthly_sku_stats() bilan
    AYNAN bir xil mantiq (supplier_at()/cost_at(), kun-aniq)."""
    month_rev = defaultdict(lambda: defaultdict(float))
    month_rec = defaultdict(lambda: defaultdict(int))
    month_qty = defaultdict(lambda: defaultdict(float))
    month_cost = defaultdict(lambda: defaultdict(float))
    month_cost_approx = defaultdict(lambda: defaultdict(bool))
    month_name = {}
    products = products or {}
    kirim_breakpoints = kirim_breakpoints or {}
    supplier_breakpoints = supplier_breakpoints or {}
    wanted_months = set(wanted_months) if wanted_months else None
    base = date.fromisoformat(hist["base"])
    days = hist.get("days", 0)
    d_map = hist.get("d", {})
    r_map = hist.get("r", {})
    rc_map = hist.get("rc", {})
    # d_map (miqdor) VA r_map (tushum) kalitlari birlashtiriladi (faqat d_map emas) -
    # kamdan-kam holatlarda bitta kunda NET miqdor 0 ga tushib qolishi mumkin (mas.
    # sotuv+qaytarish bir kunda bekor bo'lgan), lekin qoldiq tushum (rev) hali ham
    # nolga teng bo'lmasligi mumkin - faqat qty asosida filtrlasak shu tushum
    # jimgina yo'qolib qolardi (tekshirilgan: butun tarixda 5 ta shunday holat bor).
    all_keys = set(d_map) | set(r_map)
    for key in all_keys:
        if not key.startswith("sku:"):
            continue
        sku = key[4:]
        d_arr = d_map.get(key) or []
        r_arr = r_map.get(key) or []
        rc_arr = rc_map.get(key) or []
        n = max(len(d_arr), len(r_arr), len(rc_arr))
        for i in range(min(days, n)):
            qty = (d_arr[i] if i < len(d_arr) else 0) or 0
            rev = (r_arr[i] if i < len(r_arr) else 0) or 0
            if not qty and not rev:
                continue
            sale_date = base + timedelta(days=i)
            month_key = f"{sale_date.year:04d}-{sale_date.month:02d}"
            if wanted_months is not None and month_key not in wanted_months:
                continue
            rec = rc_arr[i] if i < len(rc_arr) else 0

            supplier = supplier_at(supplier_breakpoints.get(sku), sale_date)
            if not supplier:
                supplier = products.get(sku, {}).get("su") or "Noma'lum"
            comp_key = sku + "\x1f" + supplier

            month_rev[month_key][comp_key] += rev
            month_qty[month_key][comp_key] += qty
            month_rec[month_key][comp_key] += rec
            if comp_key not in month_name:
                month_name[comp_key] = products.get(sku, {}).get("name") or sku

            unit_cost = cost_at(kirim_breakpoints.get(sku), sale_date)
            approx = unit_cost is None
            if approx:
                p = products.get(sku, {})
                unit_cost = p.get("sp") or p.get("p") or 0
            item_cost = qty * unit_cost
            cap = rev * SUSPICIOUS_COST_MULTIPLIER
            if rev > 0 and item_cost > cap:
                item_cost = cap
                approx = True
            month_cost[month_key][comp_key] += item_cost
            if approx:
                month_cost_approx[month_key][comp_key] = True
    return month_rev, dict(month_rec), month_name, month_qty, month_cost, month_cost_approx


def compute_month_supplier_entries_from_history(month_key, hist, products, kirim_breakpoints=None,
                                                 supplier_breakpoints=None):
    """compute_month_supplier_entries() bilan bir xil, lekin manba
    data_history.json (Turso'da endi topilmaydigan eski oylar uchun)."""
    month_rev, month_rec, month_name, month_qty, month_cost, month_cost_approx = \
        compute_monthly_sku_stats_from_history(hist, products, kirim_breakpoints,
                                                supplier_breakpoints, wanted_months=[month_key])
    monthly = build_supplier_months(month_rev, month_rec, month_name, products, month_qty,
                                     month_cost, month_cost_approx)
    return {sup: months[month_key] for sup, months in monthly.items() if month_key in months}


def month_bounds(month_key):
    """'YYYY-MM' -> (boshlanish_sana, tugash_sana_exclusive) - date obyektlari."""
    y, m = (int(x) for x in month_key.split("-"))
    start = date(y, m, 1)
    end = date(y + 1, 1, 1) if m == 12 else date(y, m + 1, 1)
    return start, end


def month_orders_complete(month_orders, mstart, mend):
    """`month_orders` [mstart, mend) oyini TO'LIQ qamrab olganini tekshiradi
    (birinchi VA oxirgi kun mavjudmi). Bo'sh ro'yxat - False. Bu tekshiruv
    muhim: agar Turso migratsiya chegarasi (yoki boshqa sabab bilan ma'lumot
    uzilishi) OY ICHIDA bo'lsa, fetch_range/orders_for_month faqat oyning bir
    qismini (mas. 17-31) qaytarishi mumkin - shuni "to'liq" deb hisoblasak,
    oyning boshi sezilmasdan yo'qolib qoladi. Qisman natija ham False
    qaytaradi - chaqiruvchi to'liq tarixga (data_history.json) o'tishi kerak."""
    if not month_orders:
        return False
    dates = [d for o in month_orders if (d := parse_local_date(o.get("create_time"))) is not None]
    if not dates:
        return False
    last_day = mend - timedelta(days=1)
    return min(dates) <= mstart and max(dates) >= last_day


def compute_month_supplier_entries(month_key, orders, products, kirim_breakpoints=None, supplier_breakpoints=None):
    """Berilgan oy uchun supplier -> entry xaritasini hisoblaydi. `orders`
    boshqa oylarni ham o'z ichiga olishi mumkin - faqat `month_key`ga mos
    natija qaytariladi."""
    month_rev, month_rec, month_name, month_qty, month_cost, month_cost_approx = \
        compute_monthly_sku_stats(orders, products, kirim_breakpoints, supplier_breakpoints)
    monthly = build_supplier_months(month_rev, month_rec, month_name, products, month_qty,
                                     month_cost, month_cost_approx)
    return {sup: months[month_key] for sup, months in monthly.items() if month_key in months}


def load_supplier_cache():
    """Yopiq (tugagan) oylar uchun bir martalik hisoblangan supplier ABC
    natijalarini diskdan o'qiydi. Bo'sh bo'lsa (birinchi marta ishga
    tushirilganda) bo'sh kesh qaytaradi - bootstrap main()da amalga oshadi."""
    if SUPPLIER_CACHE_PATH.exists():
        try:
            cache = json.loads(SUPPLIER_CACHE_PATH.read_text(encoding="utf-8"))
            if cache.get("version") == SUPPLIER_CACHE_VERSION:
                return cache
        except (json.JSONDecodeError, OSError):
            pass
    return {"version": SUPPLIER_CACHE_VERSION, "open_month": None, "months": {}}


def save_supplier_cache(cache):
    cache["version"] = SUPPLIER_CACHE_VERSION
    SUPPLIER_CACHE_PATH.write_text(
        json.dumps(cache, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )


def orders_for_month(orders, month_key):
    return [order for order in orders if parse_local_date(order.get("create_time")) and
            f"{parse_local_date(order.get('create_time')).year:04d}-{parse_local_date(order.get('create_time')).month:02d}" == month_key]


def build_history_incremental(orders, daily_full=None):
    """Jan 1 dan bugunga qadar kunlik sotuv tarixini incremental yangilaydi.
    daily_full berilsa: build_sales_demand.build() natijasidan wi/we/rt/rc/rr/wri/wre ham yoziladi.
    Berilmasa: faqat d (qty) va r (revenue) raw orderlardan hisoblanadi (eski holat, birinchi marta uchun).
    """
    today = date.today()
    total_days = (today - HISTORY_BASE_DATE).days + 1
    hist_path = ROOT / "data_history.json"
    FIELDS = ["d", "r", "rc", "wi", "we", "rt", "rr", "wri", "wre"]

    # Mavjud faylni o'qi yoki yangi boshlang'ich yaratamiz
    if hist_path.exists():
        try:
            hist = json.loads(hist_path.read_text(encoding="utf-8"))
            maps = {f: hist.get(f, {}) for f in FIELDS}
            print(f"      Mavjud tarix o'qildi: {len(maps['d']):,} mahsulot")
        except Exception:
            maps = {f: {} for f in FIELDS}
    else:
        maps = {f: {} for f in FIELDS}
        print("      data_history.json yo'q — to'liq yaratilmoqda")

    # Barcha mavjud massivlarni total_days ga uzaytir, oxirgi N kunni 0 ga reset
    reset_from = max(0, total_days - HISTORY_UPDATE_DAYS)
    for key in list(maps["d"].keys()):
        for f in FIELDS:
            arr = maps[f].get(key, [])
            if len(arr) < total_days:
                arr += [0] * (total_days - len(arr))
            for i in range(reset_from, total_days):
                arr[i] = 0
            maps[f][key] = arr

    if daily_full:
        # Yangi format: build_sales_demand.build() dan wi/we/rt/rc/rr/wri/wre olish
        meta = daily_full.get("__meta__", {})
        daily_start = date.fromisoformat(meta.get("start", today.isoformat()))
        daily_days = meta.get("days", 0)
        src_fields = {"d": "q", "r": "rev", "rc": "r", "wi": "wi", "we": "we",
                      "rt": "rt", "rr": "rr", "wri": "wri", "wre": "wre"}
        for prod_key, item in daily_full.get("items", {}).items():
            if not prod_key.startswith("sku:"):
                continue
            for f in FIELDS:
                if prod_key not in maps[f]:
                    maps[f][prod_key] = [0] * total_days
            for di in range(daily_days):
                day_idx = (daily_start + timedelta(days=di) - HISTORY_BASE_DATE).days
                if not (reset_from <= day_idx < total_days):
                    continue
                for f, src in src_fields.items():
                    src_arr = item.get(src, [])
                    maps[f][prod_key][day_idx] = src_arr[di] if di < len(src_arr) else 0
    else:
        # Eski usul: raw orderlardan faqat d va r (birinchi marta uchun fallback)
        for order in orders:
            sign = -1 if order.get("type") != "sale" else 1
            sale_date = parse_local_date(order.get("create_time"))
            if sale_date is None or sale_date < HISTORY_BASE_DATE:
                continue
            day_idx = (sale_date - HISTORY_BASE_DATE).days
            if day_idx >= total_days:
                continue
            for it in (order.get("items") or []):
                qty = float(it.get("value") or 0)
                if qty <= 0:
                    continue
                sku = str(it.get("sku") or "").strip()
                if not sku:
                    continue
                key = "sku:" + sku
                for f in FIELDS:
                    if key not in maps[f]:
                        maps[f][key] = [0] * total_days
                maps["d"][key][day_idx] = round(maps["d"][key][day_idx] + sign * qty, 4)
                maps["r"][key][day_idx] = round(maps["r"][key][day_idx] + sign * safe_item_revenue(it, qty), 0)

    hist = {"base": HISTORY_BASE_DATE.isoformat(), "days": total_days}
    hist.update(maps)
    hist_path.write_text(
        json.dumps(hist, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    size_mb = hist_path.stat().st_size / 1024 / 1024
    print(f"      data_history.json saqlandi: {len(maps['d']):,} mahsulot, {total_days} kun, {size_mb:.1f} MB")

    # ABC tahlili "Oylik hisobot" grafigi uchun - butun data_history.json (o'nlab MB) o'rniga
    # faqat kichik oylik jami tushum ro'yxati (frontend endi shu faylni o'qiydi, tez ochiladi).
    monthly_rev = _compute_monthly_revenue_rollup(maps["r"], total_days, HISTORY_BASE_DATE)
    (ROOT / "data_monthly_rev.json").write_text(
        json.dumps({"months": monthly_rev}, ensure_ascii=False),
        encoding="utf-8",
    )

    return len(maps["d"])


def _compute_monthly_revenue_rollup(rev_by_sku, total_days, base_date):
    """Har bir SKU'ning kunlik tushumini (data_history.json'dagi "r" massivi)
    kalendar oy bo'yicha jamlaydi - butun tarixni frontendga yubormasdan,
    faqat bir nechta oylik yakuniy son (kichik, tez yuklanadigan natija)."""
    daily_total = [0.0] * total_days
    for arr in rev_by_sku.values():
        for i in range(min(len(arr), total_days)):
            daily_total[i] += arr[i] or 0
    months = []
    cur_key = None
    for i in range(total_days):
        d = base_date + timedelta(days=i)
        key = (d.year, d.month)
        if key != cur_key:
            cur_key = key
            months.append({"label": MONTHS_UZ[d.month], "rev": 0.0})
        months[-1]["rev"] += daily_total[i]
    return [{"label": m["label"], "rev": round(m["rev"])} for m in months]


def build(orders, products_path, html_path=None, last_sale_60=None, monthly=None, month_keys=None, products=None):
    if html_path is None:
        html_path = ROOT / "sales.html"

    if products is None:
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
        print(f"      {len(arrivals):,} ta SKU uchun qo'lda import qilingan kirim sanasi qo'llanildi (arrival_data.json, faqat API kirim ma'lumoti yo'q SKU'lar uchun zaxira)")

    print("      Kirim (ta'minotchidan kelgan tovar) ma'lumoti yangilanmoqda...")
    existing_kirim = json.loads(KIRIM_PATH.read_text(encoding="utf-8")) if KIRIM_PATH.exists() else None
    synced_until = existing_kirim.get("_synced_until") if existing_kirim else None
    since = None
    if synced_until:
        since = (datetime.fromisoformat(synced_until.replace("Z", "+00:00")) - timedelta(days=KIRIM_OVERLAP_DAYS)).isoformat()
    new_supplier_orders = fetch_supplier_orders(since=since)
    # 2-so'rov: created_at oynasi (so'nggi KIRIM_OVERLAP_DAYS kun) sekin qabul
    # qilingan buyurtmalarni o'tkazib yuboradi (Open->Received o'zgarishi 5 kundan
    # ko'proq vaqt olsa, kursor orqaga qaytmaydi). Shuning uchun hali yakunlanmagan
    # (Received bo'lmagan) buyurtmalarni ID bo'yicha alohida qayta so'raymiz -
    # kech kelgan kirim ham ushlanadi. Turso'da topilmaganlar (o'chirilgan) e'tiborsiz.
    pending_ids = pending_order_ids(existing_kirim)
    pending_orders = fetch_orders_by_ids(pending_ids) if pending_ids else []
    # Ikkala manbani birlashtiramiz; bir order_id ikkalasida ham bo'lsa, merge_kirimdata
    # order_id bo'yicha eskisini almashtiradi (dublikat bo'lmaydi), tartib muhim emas.
    combined_orders = new_supplier_orders + pending_orders
    kirimdata = merge_kirimdata(existing_kirim, combined_orders)
    max_created = max((o.get("created_at", "") for o in new_supplier_orders), default=synced_until or "")
    kirimdata["_synced_until"] = max_created or synced_until or datetime.utcnow().isoformat() + "Z"
    print(f"      {len(new_supplier_orders):,} ta yangi/yangilangan buyurtma (oyna) + "
          f"{len(pending_orders):,}/{len(pending_ids):,} ta yakunlanmagan qayta tekshirildi, "
          f"{len(kirimdata['skus']):,} ta SKU'da kirim tarixi")
    # API'dan olingan aniq kirim sanasi arrival_data.json'dan ustun turadi (avtomatik, doim yangilanadi)
    for sku, entry in kirimdata["skus"].items():
        if entry.get("last_date"):
            arrivals[sku] = {"date": entry["last_date"], "qty": entry.get("last_qty", 0)}
        # hozirgi stock - tarixiy emas, har build'da joriy katalogdan yangilanadi
        entry["current_stock"] = rq(products.get(sku, {}).get("a", 0))

    # TA'MINOTCHI = ENG ISHONCHLI MANBA. Invan mahsulot kartochkasidagi "supplier"
    # maydoni (API'dagi product.supplier) qo'lda belgilanadi va haqiqiy xariddan
    # (kirimdan) yangilanmaydi - shuning uchun ~19% tovarda eskirgan/noto'g'ri
    # (2/3 qismi hatto bir marta ham o'sha supplierdan kirim bo'lmagan "fantom").
    # Yagona ishonchli haqiqat - KIRIM tarixi. Shuning uchun kirim tarixi mavjud
    # bo'lsa "su" DOIM shu tovarni oxirgi marta haqiqatda yetkazgan ta'minotchiga
    # (supplier_at, p6 oylik hisobi bilan bir xil kun-aniq funksiya) o'rnatiladi -
    # katalog qiymati faqat kirim tarixi UMUMAN yo'q tovarlar uchun zaxira bo'lib
    # qoladi. Bu barcha bo'limlarga (Zakas p7, Stock p5, Suppliers p6,
    # Kategoriyalar p10) bir manbadan tarqaladi.
    _sup_bp = kirim_supplier_breakpoints(kirimdata.get("skus", {}))
    _hist_today = (datetime.utcnow() + TASHKENT_OFFSET).date()
    _su_filled = 0      # katalogda bo'sh edi, kirim tarixidan to'ldirildi
    _su_overridden = 0  # katalogda eskirgan/noto'g'ri edi, haqiqiy kirim bilan almashtirildi
    for _sku, _prod in products.items():
        _recovered = supplier_at(_sup_bp.get(_sku), _hist_today)
        if not (_recovered and _recovered.strip()):
            continue  # kirim tarixi yo'q -> katalog "su" (bo'sh bo'lsa ham) o'z holicha qoladi
        _recovered = _recovered.strip()
        _old = (_prod.get("su") or "").strip()
        if _old == _recovered:
            continue  # allaqachon to'g'ri
        if _old:
            _su_overridden += 1
        else:
            _su_filled += 1
        _prod["su"] = _recovered
    if _su_filled or _su_overridden:
        print(f"      Ta'minotchi kirim tarixidan (eng ishonchli): "
              f"{_su_filled:,} bo'sh to'ldirildi, {_su_overridden:,} eskirgan almashtirildi")

    invdata = build_invdata(products, arrivals)
    if last_sale_60:
        matched = 0
        for name, iv in invdata.items():
            ld60 = last_sale_60.get(name)
            if ld60:
                iv["ld60"] = ld60.isoformat()
                matched += 1
        print(f"      {matched:,} mahsulotga {SITE_WINDOW_DAYS} kunlik oxirgi sotuv sanasi qo'shildi")
    p2data = build_p2data(receipts, pnames, pskus, dailydata, products, min_d, max_d)

    # Faqat aktiv katalogdagi tovarlarni qoldiramiz (deaktivlashtirilganlarni chiqaramiz)
    active_skus = set(products.keys())
    before = len(p2data)
    p2data = [item for item in p2data if str(item.get("sku", "")) in active_skus]
    removed = before - len(p2data)
    if removed:
        print(f"      {removed} ta deaktivlashtirilgan tovar p2data dan chiqarildi")

    # Katalogdan sotilmagan aktiv tovarlarni p2data ga qo'shamiz
    sold_skus = {str(item["sku"]) for item in p2data if item.get("sku")}
    catalog_only = []
    for sku, prod in products.items():
        if str(sku) in sold_skus:
            continue
        is_kg = any(kw in prod.get("tp", "").lower() for kw in ("кг", "kg", "кило"))
        catalog_only.append({
            "r": 0,
            "rev": 0, "rp": 0.0, "qty": 0, "rec": 0,
            "p": rq(prod.get("p", 0)),
            "kg": is_kg,
            "ld": "", "di": 9999,
            "cat": prod.get("cat", ""),
            "catTop": prod.get("catTop", ""),
            "abc": "",
            "b": [], "d": [], "da": 0,
            "name": prod.get("name", ""),
            "sku": str(sku),
        })
    if catalog_only:
        print(f"      Katalogdan {len(catalog_only):,} ta sotilmagan aktiv tovar qo'shildi")
        p2data = p2data + catalog_only

    p3data = build_p3data(p2data, dailydata, max_d)
    p1data = build_p1data(receipts, pnames, pskus, pcats, refund_total, refund_by_day, p2data, products, min_d, max_d)
    p1data["builtAt"] = (datetime.utcnow() + TASHKENT_OFFSET).strftime("%H:%M, %d/%m/%Y")
    supplierdata = build_supplierdata(p2data, products, monthly=monthly, month_keys=month_keys)

    a_count = sum(1 for i in p2data if i["abc"] == "A")
    b_count = sum(1 for i in p2data if i["abc"] == "B")
    c_count = sum(1 for i in p2data if i["abc"] == "C")
    print(f"      ABC: A={a_count}, B={b_count}, C={c_count}")
    print(f"      Jami mahsulotlar (sotilgan + katalog): {len(p2data):,}")

    print("[5/6] JSON fayllar yozilmoqda...")
    def _write_json(name, data):
        (ROOT / name).write_text(
            json.dumps(data, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )
    _write_json("data_daily.json", dailydata)
    _write_json("data_mahsulotlar.json", p2data)
    _write_json("data_abc.json", p3data)
    _write_json("data_inv_new.json", invdata)
    _write_json("data_supplier.json", supplierdata)
    _write_json("data_kirim.json", kirimdata)

    print("      Ombor aylanmasi (p9) uchun kunlik qoldiq snapshot yozilmoqda...")
    existing_snapshot = json.loads(STOCK_SNAPSHOT_PATH.read_text(encoding="utf-8")) if STOCK_SNAPSHOT_PATH.exists() else None
    stock_snapshot = build_stock_snapshot(products, existing_snapshot)
    _write_json("data_stock_snapshot.json", stock_snapshot)
    print(f"      {len(stock_snapshot['s']):,} ta SKU, {stock_snapshot['days']} kunlik snapshot ({stock_snapshot['base']}dan)")

    # index.html asosiy fayl (Vercel), sales.html zaxira — index.html dan template sifatida foydalanamiz
    index_path = ROOT / "index.html"
    print(f"[6/6] index.html yangilanmoqda (asosiy fayl)")
    embed_html(index_path, invdata, p2data, p3data, dailydata, p1data, supplierdata,
               template_path=None)
    try:
        shutil.copyfile(index_path, html_path)
        print(f"      {html_path.name} yangilandi (zaxira nusxa)")
    except OSError as e:
        print(f"      ! {html_path.name} nusxalashda xato: {e}")

    title = min_d.strftime("%B %Y")
    return {
        "status": "ok",
        "period": title,
        "products": len(p2data),
        "receipts": len(receipts),
        "abc": {"A": a_count, "B": b_count, "C": c_count},
        "dailydata": dailydata,
    }


def main():
    parser = argparse.ArgumentParser(description="Invan API ma'lumoti bilan sales.html ni yangilash")
    parser.add_argument("--products", default="api_raw_products.json")
    parser.add_argument("--output", default="sales.html")
    args = parser.parse_args()

    from turso_sync import fetch_window, fetch_range

    products_raw = json.loads((ROOT / args.products).read_text(encoding="utf-8"))
    products = api_read_products(products_raw)

    # Suppliers oylik Foyda/Marja uchun haqiqiy tarixiy kirim narxi - diskdagi
    # OLDINGI sikldan qolgan data_kirim.json'dan o'qiladi (bu siklning yangi
    # kirimlari pastda, build() ichida qo'shiladi - shu payt hali eskirmagan,
    # oylik agregat uchun ~30 daqiqalik kechikish ahamiyatsiz).
    existing_kirim_for_cost = json.loads(KIRIM_PATH.read_text(encoding="utf-8")) if KIRIM_PATH.exists() else None
    kirim_breakpoints = kirim_cost_breakpoints((existing_kirim_for_cost or {}).get("skus", {}))
    supplier_breakpoints = kirim_supplier_breakpoints((existing_kirim_for_cost or {}).get("skus", {}))
    # Turso hisobi ko'chirilsa/eski kunlar bazadan o'chsa, o'sha oy uchun Turso'dan
    # buyurtma qayta olib bo'lmaydi - lekin data_history.json (oldingi sikldan
    # qolgan, hali shu build'da yangilanmagan) o'sha davr uchun kunlik tushum/
    # miqdor/chekni saqlab turadi (hech qachon eski kunlarni o'chirmaydi) -
    # shuning uchun pastda "Turso bo'sh qaytardi" holatida shu faylga
    # tushib qolinadi (kirim_supplier_breakpoints bilan bir xil mantiqda).
    _hist_path = ROOT / "data_history.json"
    existing_hist_for_supplier = json.loads(_hist_path.read_text(encoding="utf-8")) if _hist_path.exists() else None

    today = date.today()
    current_month_key = f"{today.year:04d}-{today.month:02d}"

    print(f"[0/6] Turso bazasidan so'nggi {SITE_WINDOW_DAYS} kunlik buyurtmalar o'qilmoqda...")
    orders = fetch_window(SITE_WINDOW_DAYS)
    print(f"      {len(orders):,} ta buyurtma olindi")

    last_sale_60 = compute_last_sale_dates(orders)
    print(f"      {len(last_sale_60):,} mahsulot uchun {SITE_WINDOW_DAYS} kunlik oxirgi sotuv sanasi hisoblandi")

    # Suppliers oylik ABC: yopiq oylar bir martalik hisoblanib keshda saqlanadi,
    # har safar Turso'dan qayta yuklanmaydi - faqat joriy ochiq oy va (oy
    # almashganda) yangi yopilgan oy uchun alohida, kichik so'rov yuboriladi.
    cache = load_supplier_cache()
    closed_months = [f"{today.year:04d}-{m:02d}" for m in range(1, today.month)]
    # "mk not in cache" bilan bir qatorda BO'SH keshlangan oylarni ham qayta
    # urinishga kiritamiz - masalan Turso hisobi ko'chirilgan payt oralig'ida
    # muvaffaqiyatsiz (0 natija) hisoblab, xato ravishda "tayyor" deb keshlab
    # qo'yilgan bo'lishi mumkin (versiya oshirilganda va h.k.) - bo'sh natija
    # "hali hisoblanmagan" bilan bir xil, qayta urinilishi kerak.
    missing_closed_months = [mk for mk in closed_months if not cache.get("months", {}).get(mk)]
    if missing_closed_months:
        print("[0.5/6] Suppliers tarixiy keshida yetishmagan yopiq oylar yuklanmoqda (bir martalik)...", flush=True)
        for mk in missing_closed_months:
            mstart, mend = month_bounds(mk)
            month_orders = orders_for_month(orders, mk)
            if month_orders_complete(month_orders, mstart, mend):
                print(f"      {mk}: joriy 60 kunlik oynadan {len(month_orders):,} ta buyurtma olindi (oy to'liq qamrab olindi)", flush=True)
            else:
                print(f"      {mk}: Turso'dan {mstart.isoformat()}..{mend.isoformat()} oralig'i o'qilmoqda...", flush=True)
                month_orders = fetch_range(mstart.isoformat(), mend.isoformat())
            if month_orders_complete(month_orders, mstart, mend):
                cache["months"][mk] = compute_month_supplier_entries(mk, month_orders, products, kirim_breakpoints, supplier_breakpoints)
                print(f"      {mk}: {len(month_orders):,} ta buyurtma -> {len(cache['months'][mk])} ta supplier muzlatildi", flush=True)
            elif existing_hist_for_supplier:
                print(f"      {mk}: Turso bu oyni to'liq qamrab ololmadi (bo'sh/qisman - hisob ko'chirilgan/eski davr) - data_history.json'dan tiklanmoqda...", flush=True)
                cache["months"][mk] = compute_month_supplier_entries_from_history(mk, existing_hist_for_supplier, products, kirim_breakpoints, supplier_breakpoints)
                print(f"      {mk}: tarixdan {len(cache['months'][mk])} ta supplier tiklandi", flush=True)
            else:
                print(f"      {mk}: na Turso, na data_history.json'da ma'lumot topilmadi - keyingi build'da qayta urinib ko'riladi", flush=True)
                continue
            save_supplier_cache(cache)
        cache["open_month"] = current_month_key
        save_supplier_cache(cache)
    elif cache.get("open_month") and cache["open_month"] != current_month_key:
        old_mk = cache["open_month"]
        print(f"[0.5/6] Oy almashdi - {old_mk} yakuniy hisoblanib keshga muzlatilmoqda...", flush=True)
        mstart, mend = month_bounds(old_mk)
        month_orders = fetch_range(mstart.isoformat(), mend.isoformat())
        if month_orders_complete(month_orders, mstart, mend):
            cache["months"][old_mk] = compute_month_supplier_entries(old_mk, month_orders, products, kirim_breakpoints, supplier_breakpoints)
        elif existing_hist_for_supplier:
            print(f"      {old_mk}: Turso bu oyni to'liq qamrab ololmadi (bo'sh/qisman) - data_history.json'dan tiklanmoqda...", flush=True)
            cache["months"][old_mk] = compute_month_supplier_entries_from_history(old_mk, existing_hist_for_supplier, products, kirim_breakpoints, supplier_breakpoints)
        cache["open_month"] = current_month_key
        save_supplier_cache(cache)

    current_entries = compute_month_supplier_entries(current_month_key, orders, products, kirim_breakpoints, supplier_breakpoints)
    monthly = defaultdict(dict)
    for mk, entries in cache.get("months", {}).items():
        for supplier, entry in entries.items():
            monthly[supplier][mk] = entry
    for supplier, entry in current_entries.items():
        monthly[supplier][current_month_key] = entry
    month_keys = [f"{today.year:04d}-{m:02d}" for m in range(1, today.month + 1)]  # Joriy oygacha (frontend P6_MONTH_KEYS bilan mos)

    result = build(orders, ROOT / args.products, ROOT / args.output, last_sale_60=last_sale_60,
                    monthly=monthly, month_keys=month_keys, products=products)

    # data_history.json — incremental kunlik tarix (Jan 1 dan bugunga)
    hist_path = ROOT / "data_history.json"
    if not hist_path.exists():
        print(f"\n[7/6] data_history.json yo'q — Jan 1 dan to'liq tarix qurilmoqda...")
        print(f"      Turso'dan {HISTORY_BASE_DATE} .. {today} oralig'i o'qilmoqda (bir martalik, uzoq bo'lishi mumkin)...")
        all_orders = fetch_range(HISTORY_BASE_DATE.isoformat(), (today + timedelta(days=1)).isoformat())
        print(f"      {len(all_orders):,} ta buyurtma olindi")
        build_history_incremental(all_orders)
    else:
        print(f"\n[7/6] data_history.json yangilanmoqda (oxirgi {HISTORY_UPDATE_DAYS} kun, wi/we/rt bilan)...")
        build_history_incremental(orders, daily_full=result.get("dailydata"))

    # data_inv_new.json ga Jan 1 dan oxirgi sotuv sanasini (lsd) qo'shamiz —
    # Stock bo'limi "Eskirgan" va "Sotuv yo'q" tovarlarni shu orqali ajratadi
    print(f"\n[8/6] Jan 1 dan oxirgi sotuv sanasi (lsd) data_inv_new.json ga qo'shilmoqda...")
    try:
        from inject_last_sale import inject_last_sale_from_history
        inject_last_sale_from_history(ROOT)
    except Exception as e:
        print(f"      ! lsd qo'shishda xato: {e}")

    # Chuqur zakas uchun pav — og'ir hisob keshlanadi (kuniga bir marta), har build'da qo'llanadi
    print(f"\n[9/6] Chuqur zakas 'pav' data_inv_new.json ga qo'llanmoqda (kesh: 20 soat)...")
    try:
        from build_prev_avg import build_prev_avg
        build_prev_avg(ROOT)
    except Exception as e:
        print(f"      ! pav qo'shishda xato: {e}")

    # Muntazam zakas uchun stok-asosli avg30sa — har build'da qayta hisoblanadi (arzon,
    # keshlanmaydi). pav'dan mustaqil - bittasi xato bersa ikkinchisiga ta'sir qilmaydi.
    print(f"\n[10/6] Muntazam zakas stok-asosli 'avg30sa' data_inv_new.json ga qo'llanmoqda...")
    try:
        from build_prev_avg import build_avg30sa
        build_avg30sa(ROOT)
    except Exception as e:
        print(f"      ! avg30sa qo'shishda xato: {e}")

    # Zakas "Narx" ustuni uchun eng ishonchli joriy tannarx (haqiqiy kirim tarixi,
    # topilmasa katalog sp/p'ga fallback) - p6/p9 tannarx modeli bilan bir xil manba
    # (kirim_cost_breakpoints/cost_at). avg30sa/pav'dan mustaqil.
    print(f"\n[10/7] Zakas 'Narx' ustuni uchun eng ishonchli tannarx (rcost) qo'llanmoqda...")
    try:
        from build_prev_avg import build_current_cost
        build_current_cost(ROOT)
    except Exception as e:
        print(f"      ! rcost qo'shishda xato: {e}")

    # Zakas "Hisoblangan stok" ustuni - Invan qoldig'idan MUSTAQIL, kirim+sotuv
    # oqimidan qayta tiklangan haqiqiy qoldiq (foydalanuvchi so'rovi, 2026-07-27:
    # Invan bilan real tekshiruvda katta farqlar topilgandan keyin). avg30sa/pav/
    # rcost'dan mustaqil, zakas formulasiga tegmaydi - faqat qo'shimcha ma'lumot.
    print(f"\n[10/8] Zakas 'Hisoblangan stok' (kirim+sotuv asosida) qo'llanmoqda...")
    try:
        from backend_p_calc_stock import build_calc_stock
        build_calc_stock(ROOT)
    except Exception as e:
        print(f"      ! calcStock qo'shishda xato: {e}")

    print(f"\n{'='*40}")
    print(f"  TAYYOR! {result['period']}")
    print(f"  Mahsulotlar:  {result['products']:,}")
    print(f"  Cheklar:      {result['receipts']:,}")
    print(f"  ABC: A={result['abc']['A']}, B={result['abc']['B']}, C={result['abc']['C']}")
    print(f"{'='*40}")


if __name__ == "__main__":
    main()
