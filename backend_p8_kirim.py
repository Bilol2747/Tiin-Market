from backend_shared_utils import rq

# Yakuniy (boshqa o'zgarmaydigan) holatlar - bu statuslardagi buyurtmalarni
# qayta tekshirish shart emas. Qolgan barcha holatlar ("Open", "New",
# "Partially received" va noma'lum kelajakdagilar) hali "Received"ga o'tishi
# mumkin, shuning uchun ID bo'yicha qayta so'raladi.
TERMINAL_KIRIM_STATUSES = {"Received", "Returned", "Custom Return"}


def pending_order_ids(kirimdata, max_age_days=120, today_iso=None):
    """data_kirim.json tarkibidan hali YAKUNLANMAGAN (Received bo'lmagan)
    buyurtmalarning noyob order_id'larini qaytaradi - bular har build'da
    ID bo'yicha jonli holatini qayta tekshirish uchun (fetch_orders_by_ids).

    max_age_days: shu kundan eski (yaratilganiga shuncha kundan ko'p o'tgan)
    va hali ochiq buyurtmalar "tashlab ketilgan/bekor qilingan" deb hisoblanib,
    ro'yxatdan chiqariladi - Turso'da abadiy behuda qayta so'ralmasligi uchun.
    Bunday buyurtma data_kirim.json'da o'z holicha (odatda "Open, 0 dona")
    qoladi - bu zararsiz, chunki hisobotlarga 0 qo'shadi."""
    from datetime import date, datetime, timedelta
    if today_iso:
        today = date.fromisoformat(today_iso)
    else:
        today = (datetime.utcnow() + timedelta(hours=5)).date()
    cutoff = (today - timedelta(days=max_age_days)).isoformat()

    seen = {}  # order_id -> eng so'nggi (status, date)
    for entry in (kirimdata or {}).get("skus", {}).values():
        for a in entry.get("arrivals", []):
            oid = a.get("order_id")
            if not oid:
                continue
            d = a.get("date") or ""
            cur = seen.get(oid)
            if cur is None or d > cur[1]:
                seen[oid] = (a.get("status"), d)

    out = []
    for oid, (status, d) in seen.items():
        if status in TERMINAL_KIRIM_STATUSES:
            continue
        if d and d[:10] < cutoff:
            continue  # juda eski, ehtimol tashlab ketilgan - kuzatmaymiz
        out.append(oid)
    return out


def _extract_item_arrivals(order):
    """Bitta supplier_order ichidagi items[] ni (sku, arrival-yozuv) juftliklari
    ro'yxatiga aylantiradi. Bo'sh/draft itemlar (na kutilgan, na kelgan miqdor
    bo'lmagan) chiqarib tashlanadi."""
    items = order.get("items") or []
    if not items:
        return []
    status = (order.get("status") or {}).get("name", "")
    supplier = order.get("supplier") or {}
    # "PRICING" - Invan'ning narxlarni ommaviy yangilash uchun ishlatadigan maxsus
    # psevdo-buyurtmasi (haqiqiy yetkazib berish emas, har tovar miqdori=1) - kirim
    # tarixiga ham, Zakas'dagi "Open" signaliga ham qo'shilmasligi kerak.
    if supplier.get("name", "").strip().upper() == "PRICING":
        return []
    order_id = order.get("id", "")
    out = []
    for item in items:
        sku = str(item.get("sku") or "")
        if not sku:
            continue
        expected = item.get("expected_amount") or 0
        received = item.get("received") or 0
        if not expected and not received:
            continue
        out.append((sku, {
            "date": item.get("received_date") or order.get("created_at") or "",
            "supplier": supplier.get("name", ""),
            "supplier_id": supplier.get("id", ""),
            "qty": rq(received),
            "expected": rq(expected),
            "cost": rq(item.get("cost") or 0),
            "status": status,
            "order_no": order.get("external_id", ""),
            "order_id": order_id,
            "name": item.get("product_name", ""),
            "barcode": item.get("barcode", ""),
        }))
    return out


def _finalize_sku(arrivals):
    """Arrival yozuvlarini (har birida o'zining name/barcode'i bilan - eski/yangi
    aralashganda ham xavfsiz) saralaydi va SKU darajasidagi xulosani hisoblaydi."""
    arrivals.sort(key=lambda a: a["date"], reverse=True)
    latest = arrivals[0]
    return {
        "name": latest["name"],
        "barcode": latest["barcode"],
        "total_received": rq(sum(a["qty"] for a in arrivals)),
        "last_qty": latest["qty"],
        "last_status": latest["status"],
        "arrival_count": len(arrivals),
        "last_date": latest["date"],
        "last_cost": latest["cost"],
        "arrivals": arrivals,
    }


def build_kirimdata(supplier_orders):
    """Ta'minotchi buyurtmalarining TO'LIQ ro'yxatidan boshidan qayta quradi
    (bir martalik/bootstrap uchun). Ichida fayl I/O yo'q - toza funksiya."""
    by_sku = {}
    for order in supplier_orders:
        for sku, arrival in _extract_item_arrivals(order):
            by_sku.setdefault(sku, []).append(arrival)
    return {"skus": {sku: _finalize_sku(arrivals) for sku, arrivals in by_sku.items()}}


def merge_kirimdata(existing, new_orders):
    """Mavjud data_kirim.json tarkibiga (existing) faqat YANGI/o'zgargan
    supplier_order yozuvlarini (new_orders - odatda Turso'dan so'nggi oynada
    o'qilgan kichik to'plam) qo'shadi - data_history.json'ning incremental
    naqshiga o'xshab, har safar butun tarixni qayta hisoblamaydi.

    Bir xil order_id qayta kelsa (masalan status Open->Received o'zgargan),
    o'sha SKU ichidagi eski yozuv o'chirilib, yangisi bilan almashtiriladi -
    dublikat hosil bo'lmaydi."""
    skus_raw = {sku: entry["arrivals"] for sku, entry in (existing or {}).get("skus", {}).items()}
    touched = set()

    for order in new_orders:
        order_id = order.get("id", "")
        for sku, arrival in _extract_item_arrivals(order):
            arrivals = skus_raw.setdefault(sku, [])
            arrivals[:] = [a for a in arrivals if a.get("order_id") != order_id]
            arrivals.append(arrival)
            touched.add(sku)

    return {"skus": {sku: _finalize_sku(arrivals) for sku, arrivals in skus_raw.items() if arrivals}}
