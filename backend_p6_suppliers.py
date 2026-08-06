#!/usr/bin/env python3
"""
backend_p6_suppliers.py — "Suppliers" (Ta'minotchilar, p6) bo'limi uchun
ta'minotchi kesimida daromad/miqdor/chek/ABC taqsimotini (jami va oylik)
shakllantiradi. Frontend: sales_runtime.js initP6().
"""
from collections import defaultdict
from datetime import datetime, timedelta

from backend_shared_utils import rq

TASHKENT_OFFSET = timedelta(hours=5)

# Bitta SKU+oy uchun tannarx tushumdan shu marta oshsa "shubhali" deb
# hisoblanadi (Invan'da ba'zi kirim yozuvlari dona o'rniga quti/karton bo'yicha
# kiritilgan bo'lishi mumkin) va shu chegarada cheklab qo'yiladi - real
# biznesda tannarx tushumdan bir necha barobar oshib ketishi deyarli mumkin emas.
SUSPICIOUS_COST_MULTIPLIER = 3


def parse_kirim_date(iso_str):
    """Invan kirim yozuvidagi UTC ISO sanani Toshkent (+5soat) mahalliy
    sanaga o'giradi - sotuv tranzaksiyalari bilan bir xil kun chegarasida
    solishtirish uchun (backend_p9_ombor_aylanmasi.py'dagi TASHKENT_OFFSET
    bilan bir xil mantiq)."""
    try:
        utc_dt = datetime.fromisoformat(str(iso_str).replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None
    return (utc_dt.replace(tzinfo=None) + TASHKENT_OFFSET).date()


def kirim_cost_breakpoints(kirim_skus):
    """data_kirim.json'ning "skus" xaritasidan har SKU uchun saralangan
    [(sana, dona_narx), ...] ro'yxatini quradi - "Returned"/"Custom Return"
    holatlari (haqiqiy yetkazib berish emas) chiqarib tashlanadi, ketma-ket
    bir xil narx takrorlanmaydi."""
    breakpoints = {}
    for sku, entry in (kirim_skus or {}).items():
        events = []
        for a in entry.get("arrivals", []) or []:
            if a.get("status") in ("Returned", "Custom Return"):
                continue
            d = parse_kirim_date(a.get("date"))
            if not d:
                continue
            events.append((d, a.get("cost") or 0))
        events.sort(key=lambda e: e[0])
        deduped = []
        for d, c in events:
            if not deduped or deduped[-1][1] != c:
                deduped.append((d, c))
        if deduped:
            breakpoints[sku] = deduped
    return breakpoints


def cost_at(breakpoints, d):
    """Berilgan SANAGACHA (undan keyin emas) haqiqiy bo'lgan eng so'nggi kirim
    narxini qaytaradi - kelajakdagi kirim narxini o'tmishga qo'llamaydi.
    Topilmasa None (chaqiruvchi o'zi fallback qarorini qabul qiladi)."""
    result = None
    for bd, bc in breakpoints or []:
        if bd <= d:
            result = bc
        else:
            break
    return result


def kirim_supplier_breakpoints(kirim_skus):
    """kirim_cost_breakpoints() bilan bir xil mantiq, lekin narx o'rniga har
    kirim yozuvining ta'minotchi nomini kuzatib boradi: [(sana, ta'minotchi), ...].
    Bitta tovar vaqt o'tishi bilan turli ta'minotchidan kelishi mumkin (masalan
    iyunda A, iyulda B) - Invan katalogidagi BITTA "joriy" ta'minotchi maydoni
    bunday holatda barcha oylarni notoʻgʻri (hozirgi) ta'minotchiga yozib
    qo'yardi. Shu ro'yxat orqali har sotuv KUNI uchun O'SHA KUNGACHA haqiqiy
    bo'lgan ta'minotchi topiladi (compute_monthly_sku_stats'da supplier_at()
    bilan)."""
    breakpoints = {}
    for sku, entry in (kirim_skus or {}).items():
        events = []
        for a in entry.get("arrivals", []) or []:
            if a.get("status") in ("Returned", "Custom Return"):
                continue
            d = parse_kirim_date(a.get("date"))
            sup = a.get("supplier")
            if not d or not sup:
                continue
            events.append((d, sup))
        events.sort(key=lambda e: e[0])
        deduped = []
        for d, s in events:
            if not deduped or deduped[-1][1] != s:
                deduped.append((d, s))
        if deduped:
            breakpoints[sku] = deduped
    return breakpoints


def supplier_at(breakpoints, d):
    """Berilgan SANAGACHA (undan keyin emas) haqiqiy bo'lgan eng so'nggi kirim
    ta'minotchisini qaytaradi - cost_at() bilan bir xil mantiq, narx o'rniga
    ta'minotchi nomi uchun. Topilmasa None (chaqiruvchi katalogdagi joriy "su"
    maydoniga fallback qiladi)."""
    result = None
    for bd, bs in breakpoints or []:
        if bd <= d:
            result = bs
        else:
            break
    return result


def build_supplier_months(month_rev, month_rec, month_name, products, month_qty=None,
                           month_cost=None, month_cost_approx=None):
    """Har bir oy uchun ALOHIDA: o'sha oyning SKU+ta'minotchi bo'yicha daromadini
    (yengil, to'g'ridan-to'g'ri buyurtmalardan hisoblangan - og'ir kunlik/ulgurji
    pipeline'ga bog'liq emas) supplierga yig'ib, supplierlarni o'sha oyning
    daromadi bo'yicha qayta saralab ABC (80/15/5) belgilaydi. Bu orqali asosiy
    sahifalar (P1/P2/P3/kunlik/Zakas) qisqaroq oynada qolib, faqat Suppliers
    bo'limi butun tarixni (masalan 180 kun) ko'rib chiqishi mumkin.

    `month_rev`/`month_qty`/`month_cost`/`month_cost_approx` kalitlari endi oddiy
    SKU emas, balki compute_monthly_sku_stats()'da tuzilgan "SKU\\x1fTa'minotchi"
    composite kalit - chunki ta'minotchi ATTRIBUTSIYASI endi shu funksiyada emas,
    balki HAR SOTUV KUNI uchun alohida (supplier_at() orqali, kun-aniq) yuqori
    darajada hal qilingan. Shu tufayli bitta tovar oy ichida ta'minotchi
    almashtirsa (mas. 1-15 kun A, 16-30 kun B), oy ikkiga bo'linib, har biri
    o'z ta'minotchisi ostida to'g'ri ko'rinadi - Invan katalogidagi bitta
    "joriy" ta'minotchi maydoniga (products[sku]["su"]) endi bog'liq emas (u
    faqat compute_monthly_sku_stats()'da kirim tarixi topilmagan holatlar uchun
    fallback sifatida ishlatiladi).

    `month_qty` (ixtiyoriy) - {"YYYY-MM": {key: sotilgan_miqdor}} - frontendda
    tannarx/foyda hisoblash uchun har bir "top" itemga "qty" sifatida qo'shiladi.
    `month_cost`/`month_cost_approx` (ixtiyoriy) - {"YYYY-MM": {key: tannarx}} /
    {"YYYY-MM": {key: True}} - berilsa har supplier+oy uchun cost/profit/marja
    va FOYDA bo'yicha alohida abc_profit (80/15/5) ham hisoblanadi.
    Natija: {supplier_nomi: {"YYYY-MM": {rev, rp, abc, cnt, rec, abc_cnt, top,
    cost, profit, marja, abc_profit, cost_approx}}}."""
    month_qty = month_qty or {}
    month_cost = month_cost or {}
    month_cost_approx = month_cost_approx or {}
    result = defaultdict(dict)
    for month_key, key_rev in month_rev.items():
        month_total = sum(key_rev.values()) or 1
        sorted_keys = sorted(key_rev, key=lambda k: -key_rev[k])
        cum = 0.0
        key_abc = {}
        for key in sorted_keys:
            cum += key_rev[key]
            pct = cum / month_total
            key_abc[key] = "A" if pct <= 0.80 else ("B" if pct <= 0.95 else "C")

        # Har SKU+ta'minotchi kombinatsiyasi uchun ham (butun do'kon miqyosida,
        # shu oy ichida) FOYDA bo'yicha alohida ABC va marja% - supplier detail
        # sahifasidagi mahsulot jadvali Foyda/Marja rejimida shuni ko'rsatadi
        # (yuqoridagi key_abc - tushum bo'yicha, bu bilan bir xil naqsh, faqat
        # foyda asosida).
        key_cost_month = month_cost.get(month_key, {})
        key_profit_map = {key: key_rev[key] - key_cost_month.get(key, 0) for key in key_rev}
        key_total_profit = sum(p for p in key_profit_map.values() if p > 0) or 1
        sorted_keys_by_profit = sorted(key_rev, key=lambda k: -key_profit_map[k])
        cum_sp = 0.0
        key_abc_profit = {}
        for key in sorted_keys_by_profit:
            sp = key_profit_map[key]
            if sp <= 0:
                key_abc_profit[key] = "C"
                continue
            cum_sp += sp
            pct_sp = cum_sp / key_total_profit
            key_abc_profit[key] = "A" if pct_sp <= 0.80 else ("B" if pct_sp <= 0.95 else "C")
        key_marja_map = {key: (round(key_profit_map[key] / key_rev[key] * 100, 1) if key_rev[key] else 0)
                          for key in key_rev}

        rec_for_month = month_rec.get(month_key, {})
        qty_for_month = month_qty.get(month_key, {})
        cost_for_month = month_cost.get(month_key, {})
        cost_approx_for_month = month_cost_approx.get(month_key, {})
        sup_rev = defaultdict(float)
        sup_cost = defaultdict(float)
        sup_cost_approx = defaultdict(bool)
        sup_rec = defaultdict(int)
        sup_cnt = defaultdict(int)
        sup_abc_cnt = defaultdict(lambda: {"A": 0, "B": 0, "C": 0})
        sup_items = defaultdict(list)
        for key, rev in key_rev.items():
            sku, supplier = key.split("\x1f", 1)
            sup_rev[supplier] += rev
            sup_cost[supplier] += cost_for_month.get(key, 0)
            if cost_approx_for_month.get(key):
                sup_cost_approx[supplier] = True
            sup_rec[supplier] += rec_for_month.get(key, 0)
            sup_cnt[supplier] += 1
            sup_abc_cnt[supplier][key_abc[key]] += 1
            sup_items[supplier].append((key, sku, rev))

        total_rev = sum(sup_rev.values()) or 1
        sorted_sups = sorted(sup_rev, key=lambda n: -sup_rev[n])
        cum2 = 0.0

        sup_profit = {s: sup_rev[s] - sup_cost[s] for s in sup_rev}
        total_profit = sum(p for p in sup_profit.values() if p > 0) or 1
        sorted_by_profit = sorted(sup_rev, key=lambda n: -sup_profit[n])
        cum_profit = 0.0
        abc_profit_map = {}
        for supplier in sorted_by_profit:
            profit = sup_profit[supplier]
            if profit <= 0:
                abc_profit_map[supplier] = "C"
                continue
            cum_profit += profit
            pct_profit = cum_profit / total_profit
            abc_profit_map[supplier] = "A" if pct_profit <= 0.80 else ("B" if pct_profit <= 0.95 else "C")

        for supplier in sorted_sups:
            cum2 += sup_rev[supplier]
            pct2 = cum2 / total_rev
            abc = "A" if pct2 <= 0.80 else ("B" if pct2 <= 0.95 else "C")
            all_items = sorted(sup_items[supplier], key=lambda e: -e[2])
            rev = sup_rev[supplier]
            cost = sup_cost[supplier]
            profit = sup_profit[supplier]
            result[supplier][month_key] = {
                "rev": round(rev),
                "rp": round(rev / total_rev * 100, 2),
                "abc": abc,
                "cnt": sup_cnt[supplier],
                "rec": sup_rec[supplier],
                "abc_cnt": sup_abc_cnt[supplier],
                "cost": round(cost),
                "profit": round(profit),
                "marja": round(profit / rev * 100, 1) if rev else 0,
                "abc_profit": abc_profit_map[supplier],
                "cost_approx": sup_cost_approx[supplier],
                "top": [
                    {"name": month_name.get(key, sku), "rev": round(rev),
                     "rec": rec_for_month.get(key, 0), "abc": key_abc[key], "sku": sku,
                     "qty": rq(qty_for_month.get(key, 0)),
                     "abc_profit": key_abc_profit.get(key, "C"), "marja": key_marja_map.get(key, 0)}
                    for key, sku, rev in all_items
                ],
            }
    return result


def build_supplierdata(p2data, products, monthly=None, month_keys=None):
    """Har bir mahsulotni o'z ta'minotchisiga (supplier) bog'lab, supplier kesimida
    daromad/miqdor/chek/ABC taqsimotini hisoblaydi."""
    groups = defaultdict(lambda: {"rev": 0.0, "qty": 0.0, "rec": 0, "cnt": 0,
                                   "abc_cnt": {"A": 0, "B": 0, "C": 0}, "items": []})
    for item in p2data:
        supplier = products.get(item.get("sku", ""), {}).get("su") or "Noma'lum"
        group = groups[supplier]
        group["rev"] += item.get("rev", 0) or 0
        group["qty"] += item.get("qty", 0) or 0
        group["rec"] += item.get("rec", 0) or 0
        group["cnt"] += 1
        abc = item.get("abc", "C")
        if abc in group["abc_cnt"]:
            group["abc_cnt"][abc] += 1
        group["items"].append(item)

    total_rev = sum(g["rev"] for g in groups.values()) or 1
    sorted_names = sorted(groups, key=lambda n: -groups[n]["rev"])

    cumulative = 0.0
    suppliers = []
    abc_count = {"A": 0, "B": 0, "C": 0}
    for rank, name in enumerate(sorted_names, 1):
        group = groups[name]
        cumulative += group["rev"]
        pct = cumulative / total_rev
        abc = "A" if pct <= 0.80 else ("B" if pct <= 0.95 else "C")
        abc_count[abc] += 1
        top_items = sorted(group["items"], key=lambda it: -(it.get("rev", 0) or 0))[:5]
        entry = {
            "name": name,
            "rev": round(group["rev"]),
            "qty": rq(group["qty"]),
            "rec": group["rec"],
            "cnt": group["cnt"],
            "abc_cnt": group["abc_cnt"],
            "top": [
                {"name": it["name"], "rev": it.get("rev", 0), "abc": it.get("abc", "C"), "sku": it.get("sku", "")}
                for it in top_items
            ],
            "abc": abc,
            "r": rank,
            "rp": round(group["rev"] / total_rev * 100, 2),
        }
        if monthly is not None and month_keys is not None:
            sup_months = monthly.get(name, {})
            entry["months"] = [sup_months.get(mk) for mk in month_keys]
        suppliers.append(entry)

    return {
        "total_rev": round(total_rev),
        "sup_count": len(suppliers),
        "abc_cnt": abc_count,
        "suppliers": suppliers,
    }
