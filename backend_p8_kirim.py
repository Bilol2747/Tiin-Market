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
            "item_id": item.get("id", ""),
            "name": item.get("product_name", ""),
            "barcode": item.get("barcode", ""),
        }))
    return out


def _dedupe_arrivals(arrivals):
    """Bir xil (order_id, item_id) juftligidan kelgan qatorlarni bittaga
    qisqartiradi (2026-08-07 da topilgan bug: to'liq tarixni jonli API'dan
    sahifalab yuklaganda, jonli buyurtmalar davomida sahifalar siljib ketib,
    BIR XIL item ikki marta o'qilib qolgan - ba'zan hatto ikki xil miqdor
    bilan, chunki buyurtma hali qabul qilinayotgan jarayonda ikki xil onda
    tutilgan). "item_id" - buyurtma ICHIDAGI qatorning o'z ID'si - shuning
    uchun HAQIQIY ikki-qatorli buyurtma (bir SKU, ikki alohida yetkazib
    berish qatori - item_id har xil) bunda YO'QOLMAYDI, faqat aynan bitta
    qatorning takroriy o'qilishi yig'ishtiriladi (eng katta qty saqlanadi -
    bosqichma-bosqich qabul qilingan buyurtmada eng to'liq holat)."""
    best = {}
    order_only = []
    for a in arrivals:
        key = (a.get("order_id"), a.get("item_id"))
        if not key[1]:
            order_only.append(a)
            continue
        cur = best.get(key)
        if cur is None or (a.get("qty") or 0) > (cur.get("qty") or 0):
            best[key] = a
    return list(best.values()) + order_only


def _finalize_sku(arrivals):
    """Arrival yozuvlarini (har birida o'zining name/barcode'i bilan - eski/yangi
    aralashganda ham xavfsiz) saralaydi va SKU darajasidagi xulosani hisoblaydi."""
    arrivals = _dedupe_arrivals(arrivals)
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
    dublikat hosil bo'lmaydi.

    MUHIM (2026-08-07 da tuzatilgan bug): bitta buyurtmada bir xil SKU BIR
    NECHA QATOR sifatida kelishi mumkin (masalan bitta PO ichida ikkita
    alohida yetkazib berish qatori - jonli tekshiruvda 5,000 buyurtmaning
    8.5%ida uchraydi). Eski kod har QATORNI alohida ishlar edi: order_id
    bo'yicha eski yozuvni o'chirib, o'sha zahoti bittagina yangi qatorni
    qo'shardi - shu SKU ning shu buyurtmadagi OLDINGI qatori (hozirgina shu
    tsiklda qo'shilgan bo'lsa ham) navbatdagi qatorni ishlashda o'chirilib
    ketardi. Natijada bir buyurtmadan faqat OXIRGI qator saqlanib, oldingi
    qator(lar)dagi dona butunlay yo'qolardi (masalan SKU 30067: PO#19046'da
    +600 va +2,400 alohida qator edi, faqat 600 saqlanib qolgan edi).

    Tuzatish: avval HAR buyurtma uchun barcha qatorlar SKU bo'yicha
    guruhlanadi, keyin har (buyurtma, SKU) juftligi uchun eski yozuv BIR
    MARTA o'chirilib, o'sha buyurtmaning HAMMA qatori birdan qo'shiladi."""
    skus_raw = {sku: entry["arrivals"] for sku, entry in (existing or {}).get("skus", {}).items()}
    touched = set()

    for order in new_orders:
        order_id = order.get("id", "")
        by_sku_this_order = {}
        for sku, arrival in _extract_item_arrivals(order):
            by_sku_this_order.setdefault(sku, []).append(arrival)
        for sku, new_arrivals in by_sku_this_order.items():
            arrivals = skus_raw.setdefault(sku, [])
            arrivals[:] = [a for a in arrivals if a.get("order_id") != order_id]
            arrivals.extend(new_arrivals)
            touched.add(sku)

    return {"skus": {sku: _finalize_sku(arrivals) for sku, arrivals in skus_raw.items() if arrivals}}
