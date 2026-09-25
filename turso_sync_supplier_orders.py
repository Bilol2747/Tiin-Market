"""
turso_sync_supplier_orders.py — Invan API'dan ta'minotchi buyurtmalarini (supplier_order,
har birida items[] - qaysi mahsulot qancha kelgani) Turso bazasiga sinxronlaydi.

turso_sync.py (sotuvlar) bilan bir xil naqsh: id bo'yicha upsert, barcha tarix cheklovsiz
saqlanadi. Farqi: bu API sana bo'yicha filtrlashni qo'llab-quvvatlamaydi (faqat page/limit),
natijalar yangi-birinchi tartibda keladi - shu sababli incremental yangilash sahifalab,
bazada allaqachon bor bo'lgan eng eski created_at'ga yetguncha davom etadi (bir oz overlap
bilan - hali "Received" bo'lmagan eski buyurtmalarning holati o'zgargan bo'lishi mumkin).
"""
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import libsql_client

sys.path.insert(0, str(Path(__file__).parent))
from fetch_api_data import BASE_URL, SESSION, load_token, request_with_retry
from turso_sync import get_client

PAGE_SIZE = 200
# Ikki qatlamli skanerlash: Invan API status/ID bo'yicha filtrlashni qo'llab-quvvatlamaydi
# (jonli tekshirilgan - "filters" parametri e'tiborga olinmaydi, GET-by-ID 404 beradi),
# shuning uchun "faqat hali Received bo'lmagan buyurtmalarni so'rash" imkonsiz - yagona yo'l
# sahifalab (yangi-birinchi tartibda) qayta o'qish. Avval har 30 daqiqada sobit 5 sahifa
# (~1 oylik tarix) qayta yozilardi - endi:
FAST_PAGE_SIZE = 40       # tezkor (har 30 daqiqalik) yo'l uchun kichik sahifa - jonli
                          # tekshirilgan haqiqiy kunlik o'rtacha buyurtma soniga mos
                          # (oxirgi 7/30/90 kunda barqaror ~40/kun), shunda 1 sahifa ≈ 1 kun
OVERLAP_PAGES = 1         # tezkor yo'lda minimal floor - 1 FAST_PAGE_SIZE sahifa (~1 kunlik),
                          # sun'iy ortiqcha takrorlanish yo'q; har safar oxirgi ma'lumotdan
                          # boshlab davom etadi ("bir-birini yopib ketadi"), pipeline uzilib
                          # qolsa estimate_overlap_pages() buni avtomatik kengaytiradi (pastda)
DEEP_OVERLAP_PAGES = 5    # kuniga 1 marta - PAGE_SIZE (200) bilan, ~25 kunlik chuqur qayta
                          # tekshiruv - status o'zgarishlarini (Open -> Received) ushlab qolish uchun


def ensure_schema(client):
    client.execute(
        "CREATE TABLE IF NOT EXISTS supplier_orders ("
        "id TEXT PRIMARY KEY, created_at TEXT NOT NULL, data TEXT NOT NULL)"
    )
    client.execute("CREATE INDEX IF NOT EXISTS idx_supplier_orders_created_at ON supplier_orders(created_at)")


def estimate_overlap_pages(client, page_size=FAST_PAGE_SIZE, floor_pages=OVERLAP_PAGES,
                           cap_orders=DEEP_OVERLAP_PAGES * PAGE_SIZE):
    """Sobit sahifa soni o'rniga, oxirgi sinxronizatsiyadan (bazadagi eng yangi
    created_at'dan) qancha vaqt o'tganini hisoblab, qayta tekshiriladigan
    sahifalar sonini shunga moslab kattalashtiradi. Pipeline uzilib qolgan
    hollarda (masalan Turso/Invan muammosi tufayli bir necha kun ishlamay
    qolsa), keyingi ishga tushishda floor_pages bilan cheklanib qolmasdan,
    o'tgan vaqtga mos kengroq oyna qayta tekshiriladi - xuddi turso_sync.py
    (sotuvlar)dagi aniq-vaqt yondashuvi kabi, faqat bu yerda sahifa sonida.
    `cap_orders` - kunlik chuqur skanerlash (DEEP_OVERLAP_PAGES) allaqachon
    qamrab oladigan hajmdan oshib ketmasligi uchun chegara (buyurtma sonida,
    page_size'dan qat'iy nazar bir xil ma'noni saqlaydi)."""
    last_ct = latest_created_at(client)
    if not last_ct:
        return floor_pages
    last_dt = datetime.fromisoformat(last_ct.replace("Z", "+00:00"))
    elapsed_days = (datetime.now(timezone.utc) - last_dt).total_seconds() / 86400
    extra_pages = int(elapsed_days)  # FAST_PAGE_SIZE ≈ kunlik hajm, shuning uchun 1 kun ≈ 1 sahifa
    cap_pages = max(floor_pages, cap_orders // page_size)
    return min(floor_pages + extra_pages, cap_pages)


def latest_created_at(client):
    rs = client.execute("SELECT MAX(created_at) AS m FROM supplier_orders")
    row = rs.rows[0] if rs.rows else None
    return row["m"] if row and row["m"] else None


def upsert_orders(client, orders):
    stmts = []
    for o in orders:
        oid = str(o.get("id") or "")
        if not oid:
            continue
        stmts.append(libsql_client.Statement(
            "INSERT INTO supplier_orders (id, created_at, data) VALUES (?, ?, ?) "
            "ON CONFLICT(id) DO UPDATE SET created_at=excluded.created_at, data=excluded.data",
            [oid, o.get("created_at", ""), json.dumps(o, ensure_ascii=False)]
        ))
    for i in range(0, len(stmts), 1000):
        chunk = stmts[i:i + 1000]
        last_error = None
        for attempt in range(1, 6):
            try:
                client.batch(chunk)
                last_error = None
                break
            except Exception as exc:
                last_error = exc
                wait = attempt * 3
                print(f"  ! Turso'ga yozishda xato ({exc.__class__.__name__}), {wait}s kutib qayta urinish ({attempt}/5)...", flush=True)
                time.sleep(wait)
        if last_error is not None:
            raise last_error
    return len(stmts)


def fetch_page(token, page, limit=PAGE_SIZE):
    """Bir sahifani so'raydi. 'items' maydoni kutilganidan ancha kam chiqsa
    (avval kuzatilgan beqarorlik), qisqa kutib bir marta qayta so'raydi."""
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    params = {"page": page, "limit": limit}
    resp = request_with_retry(
        SESSION.post, f"{BASE_URL}/supplier_order", headers=headers, params=params, json={"filters": []}, timeout=60
    )
    data = resp.json().get("data", [])
    if data and sum(1 for o in data if o.get("items")) < len(data) * 0.5:
        time.sleep(2)
        resp = request_with_retry(
            SESSION.post, f"{BASE_URL}/supplier_order", headers=headers, params=params, json={"filters": []}, timeout=60
        )
        data = resp.json().get("data", [])
    return data


def sync(overlap_pages=OVERLAP_PAGES, page_size=PAGE_SIZE):
    token = load_token()
    client = get_client()
    ensure_schema(client)
    last_ct = latest_created_at(client)
    if last_ct:
        print(f"Bazada mavjud, eng so'nggi created_at: {last_ct}. Yangilarini + so'nggi {overlap_pages} sahifani qayta tekshiramiz.")
    else:
        print("Baza bo'sh - to'liq tarixni yuklaymiz.")

    page = 1
    total = 0
    while True:
        data = fetch_page(token, page, page_size)
        if not data:
            break
        n = upsert_orders(client, data)
        total += n
        oldest_in_page = min((o.get("created_at") or "" for o in data), default="")
        print(f"  {page}-sahifa: {len(data)} ta (bazaga yozildi: {total})")
        if len(data) < page_size:
            break
        if last_ct and page >= overlap_pages and oldest_in_page and oldest_in_page <= last_ct:
            print(f"  Avvaldan mavjud ma'lumotga yetdik ({oldest_in_page} <= {last_ct}), to'xtatildi.")
            break
        page += 1
        time.sleep(0.1)

    rs = client.execute("SELECT COUNT(*) AS c FROM supplier_orders")
    print(f"Bazada jami: {rs.rows[0]['c']} ta ta'minotchi buyurtmasi")
    client.close()
    return total


def fetch_orders_by_ids(order_ids, chunk_size=500):
    """build_all_from_api.py uchun - berilgan aniq order_id'lar ro'yxatining
    bazadagi ENG SO'NGGI holatini qaytaradi (yaratilgan sanasidan qat'iy nazar).

    Nega kerak: `fetch_supplier_orders(since=...)` faqat created_at oynasiga
    (so'nggi KIRIM_OVERLAP_DAYS kun) tayanadi - agar bir buyurtma "Open"dan
    "Received"ga o'tishi shu oynadan ko'proq vaqt olsa, o'zgarish abadiy
    o'tkazib yuboriladi (created_at o'zgarmaydi, kursor orqaga qaytmaydi).
    Bu funksiya esa hali yakunlanmagan (Received bo'lmagan) buyurtmalarni
    ID bo'yicha nuqtama-nuqta qayta tekshiradi - shu tufayli kech qabul
    qilingan kirim ham ushlanadi. Turso'da topilmagan (o'chirilgan) ID'lar
    shunchaki natijaga kirmaydi - chaqiruvchi tomon ularni eski holatida
    qoldiradi (bu zararsiz: yakunlanmagan/kelmagan buyurtma miqdori 0)."""
    ids = [str(x) for x in order_ids if x]
    if not ids:
        return []
    client = get_client()
    ensure_schema(client)
    orders = []
    for i in range(0, len(ids), chunk_size):
        chunk = ids[i:i + chunk_size]
        placeholders = ",".join("?" * len(chunk))
        rs = client.execute(
            f"SELECT data FROM supplier_orders WHERE id IN ({placeholders})", chunk
        )
        orders.extend(json.loads(row["data"]) for row in rs.rows)
    client.close()
    return orders


def fetch_supplier_orders(since=None, chunk_size=5000):
    """build_all_from_api.py uchun - bazadan ta'minotchi buyurtmalarini o'qiydi.
    `since` berilsa, faqat created_at > since bo'lganlarni qaytaradi (data_kirim.json'ni
    incremental yangilash uchun); berilmasa, BARCHA tarixni o'qiydi (bir martalik bootstrap)."""
    client = get_client()
    ensure_schema(client)
    orders = []
    last_created_at = since
    last_id = None
    while True:
        params = []
        cursor_filter = ""
        if last_created_at is not None:
            cursor_filter = "WHERE (created_at > ? OR (created_at = ? AND id > ?)) "
            params.extend([last_created_at, last_created_at, last_id])
        params.append(chunk_size)
        rs = client.execute(
            "SELECT id, created_at, data FROM supplier_orders " + cursor_filter +
            "ORDER BY created_at, id LIMIT ?",
            params
        )
        batch = [json.loads(row["data"]) for row in rs.rows]
        orders.extend(batch)
        if len(batch) < chunk_size:
            break
        last_created_at = rs.rows[-1]["created_at"]
        last_id = rs.rows[-1]["id"]
    client.close()
    return orders


if __name__ == "__main__":
    now = datetime.now(timezone.utc)
    if now.hour == 3 and now.minute < 15:
        # kuniga bir marta (~03:00 UTC, Toshkentda ertalab tinch vaqt) - chuqur skanerlash
        print(f"Kunlik chuqur skanerlash: so'nggi {DEEP_OVERLAP_PAGES} sahifa ({PAGE_SIZE} tadan) qayta tekshiriladi.")
        sync(overlap_pages=DEEP_OVERLAP_PAGES, page_size=PAGE_SIZE)
    else:
        client = get_client()
        ensure_schema(client)  # 2026-08-13: bo'sh (yangi) bazada estimate_overlap_pages
                                # ichidagi latest_created_at "no such table" bilan qulardi -
                                # sync()'da bor edi, bu yo'lda unutilgan ekan.
        pages = estimate_overlap_pages(client, page_size=FAST_PAGE_SIZE)
        client.close()
        if pages > OVERLAP_PAGES:
            print(f"Oxirgi sinxronizatsiyadan uzoq vaqt o'tgan - odatdagi {OVERLAP_PAGES} o'rniga "
                  f"{pages} sahifa ({FAST_PAGE_SIZE} tadan) qayta tekshiriladi.")
        sync(overlap_pages=pages, page_size=FAST_PAGE_SIZE)
