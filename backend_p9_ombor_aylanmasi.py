#!/usr/bin/env python3
"""
backend_p9_ombor_aylanmasi.py — "Ombor aylanmasi" (Inventory turnover, p9) bo'limi
uchun kunlik qoldiq va tannarx snapshot'ini incremental yig'adi.

Nega kerak: opening/closing stock'ni ixtiyoriy sana oralig'i uchun to'g'ri
ko'rsatish uchun har kunning YOPILISH qoldig'ini (Invan'dan kelgan haqiqiy "a"
qiymatini) saqlab borish kerak - orqaga qarab hisoblab chiqarish (kirim/sotuvdan)
o'rniga. Eski sanalar uchun ma'lumot yo'q (kerak ham emas) - shu fayl birinchi
marta ishga tushgan kundan boshlab yig'iladi, data_history.json naqshiga o'xshab.

Tannarx ("c") ham xuddi shu sababdan kunlik saqlanadi: Invan'ning "sp" (supply_price)
maydoni vaqt o'tishi bilan o'zgaradi (tovar narxi ko'tarilishi/tushishi mumkin) - agar
opening/closing summasini hisoblashda faqat BUGUNGI "sp" ishlatilsa, o'tmishdagi
qoldiq noto'g'ri (joriy narxda) baholanib qoladi. Invan'ning "Inventory turnover"
hisobotida solishtirilganda aynan shu sabab tasdiqlangan (21k+ SKU bo'yicha tekshiruv:
narxi o'zgarmagan tovarlarda mos, o'zgargan tovarlarda farq chiqadi).
"""
from datetime import date, datetime, timedelta

from backend_shared_utils import rq

TASHKENT_OFFSET = timedelta(hours=5)


def _extend(arr, total_days):
    if len(arr) < total_days:
        arr.extend([None] * (total_days - len(arr)))


def build_stock_snapshot(products, existing=None):
    """products: {sku: {..., "a": joriy_qoldiq, "sp": joriy_tannarx}} - fetch_api_data
    orqali kelgan katalog.
    existing: avvalgi data_stock_snapshot.json tarkibi (yo'q bo'lsa bugundan boshlanadi).

    Sana Toshkent vaqti bo'yicha aniqlanadi (UTC+5) - GitHub Actions runner UTC'da
    ishlagani uchun date.today() ishlatilsa, Toshkent yarim tunidan keyingi ~5 soatlik
    oynada (19:00-23:59 UTC) kunlik qoldiq noto'g'ri (bir kun oldingi) sanaga yozilib
    qolar edi - build_all_from_api.py'dagi parse_local_date bilan bir xil mantiq."""
    today = (datetime.utcnow() + TASHKENT_OFFSET).date()
    base = date.fromisoformat(existing["base"]) if existing and existing.get("base") else today
    total_days = (today - base).days + 1
    today_idx = total_days - 1

    skus = {sku: list(arr) for sku, arr in (existing or {}).get("s", {}).items()}
    costs = {sku: list(arr) for sku, arr in (existing or {}).get("c", {}).items()}
    for arr in skus.values():
        _extend(arr, total_days)
    for arr in costs.values():
        _extend(arr, total_days)

    for sku, p in products.items():
        arr = skus.setdefault(sku, [None] * total_days)
        _extend(arr, total_days)
        arr[today_idx] = rq(p.get("a", 0))

        carr = costs.setdefault(sku, [None] * total_days)
        _extend(carr, total_days)
        cost = p.get("sp") or p.get("p") or 0
        carr[today_idx] = rq(cost) if cost else None

    return {"base": base.isoformat(), "days": total_days, "s": skus, "c": costs}
