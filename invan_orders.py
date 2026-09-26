#!/usr/bin/env python3
"""
invan_orders.py — sotuv buyurtmalarini Invan API'dan TO'G'RIDAN-TO'G'RI oladi.

`turso_sync.fetch_window()` / `turso_sync.fetch_range()` ning DROP-IN o'rnini
bosadi — qaytaradigan ma'lumot AYNAN bir xil: Invan API'ning xom `order`
obyektlari ro'yxati. (Turso'dagi `orders.data` ustuni ham aynan shu xom
obyektning JSON matni edi — ya'ni o'rtadagi baza hech narsa qo'shmagan,
faqat vositachi bo'lgan.)

NEGA (2026-08-15): Turso yozish kvotasi uch marta tugadi. Oxirgisida
pipeline'ning "Sotuvlarni Turso bazasiga sinxronlash" qadami 90 daqiqa
osilib, GitHub Actions uni bekor qila boshladi — natijada 13-avgustdan
beri BUTUN sayt (calcStock, avg30sa, ABC, bosh sahifa) yangilanmay qoldi.
Sotuvlar Turso'ga faqat shuning uchun yozilardi: keyin o'sha yerdan qayta
o'qish uchun. Vositachini olib tashlaymiz — Invan API o'zi manba.

Hisob formulalarining BIRORTASI ham bu yerda takrorlanmaydi/o'zgartirilmaydi —
faqat ma'lumot qayerdan olinishi o'zgaradi (backend/pipeline_adapter.py
dagi bilan bir xil tamoyil).
"""
import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, timedelta
from pathlib import Path

import requests

ROOT = Path(__file__).parent
BASE_URL = "https://api.7i.uz/integration/v1"
PAGE_SIZE = 500          # Invan `/order` uchun amalda ishlaydigan eng katta sahifa
PARALLEL = 8             # bir vaqtda nechta sahifa (sinov: 6 ta ~24s, 80 sahifa ~5-6 daqiqa)
MAX_PAGES = 4000         # xavfsizlik chegarasi (cheksiz aylanishga qarshi)

_SESSION = None


def _session():
    """Ulanishlar havzasi bilan bo'lishilgan sessiya — parallel so'rovlarda
    har safar yangi TLS ulanish ochilmasligi uchun."""
    global _SESSION
    if _SESSION is None:
        s = requests.Session()
        s.mount("https://", requests.adapters.HTTPAdapter(
            pool_connections=PARALLEL * 2, pool_maxsize=PARALLEL * 2))
        _SESSION = s
    return _SESSION


def load_token():
    """fetch_api_data.py / backend/sync_worker.py bilan bir xil tartib."""
    t = os.environ.get("INVAN_API_TOKEN", "").strip()
    if t:
        return t
    p = ROOT / "api_token.txt"
    if p.exists():
        t = p.read_text(encoding="utf-8").strip()
    if not t:
        sys.exit("Invan token topilmadi (INVAN_API_TOKEN yoki api_token.txt).")
    return t


def _get_page(token, start_iso, end_iso, page):
    """Bitta sahifa. Tarmoq/5xx xatosida qayta uriniladi (fetch_api_data.py:31
    bilan bir xil siyosat) — 80+ sahifalik yugurishda bitta vaqtinchalik xato
    butun buildni yiqitmasligi kerak."""
    headers = {"Authorization": f"Bearer {token}"}
    params = {"page": page, "limit": PAGE_SIZE,
              "start_date": start_iso, "end_date": end_iso}
    last = None
    for attempt in range(1, 6):
        try:
            resp = _session().get(f"{BASE_URL}/order", headers=headers,
                                  params=params, timeout=120)
            resp.raise_for_status()
            body = resp.json()
            return body.get("data", []), int(body.get("total") or 0)
        except (requests.exceptions.ConnectionError,
                requests.exceptions.Timeout) as exc:
            last = exc
        except requests.exceptions.HTTPError as exc:
            status = exc.response.status_code if exc.response is not None else 0
            if status < 500:
                raise
            last = exc
        wait = attempt * 5
        print(f"    ! {page}-sahifada tarmoq/server xatosi, {wait}s kutib qayta urinish ({attempt}/5)...", flush=True)
        time.sleep(wait)
    raise last


def fetch_range(start_date_iso, end_date_iso, chunk_size=None):
    """[start_date_iso, end_date_iso) oralig'idagi buyurtmalar.

    `chunk_size` ATAYLAB e'tiborsiz qoldiriladi — `turso_sync.fetch_range()`
    imzosiga mos bo'lishi uchun saqlangan (u yerda Turso javob hajmini
    cheklash uchun kerak edi; bu yerda sahifalash Invan tomonida).

    Sahifalar PARALLEL olinadi. Buyurtmalar `id` bo'yicha takrorlanmaydi:
    yugurish davomida yangi sotuv qo'shilsa sahifa chegaralari surilib,
    bitta buyurtma ikki sahifada chiqishi mumkin."""
    token = load_token()
    first, total = _get_page(token, start_date_iso, end_date_iso, 1)
    n_pages = max(1, min(MAX_PAGES, (total + PAGE_SIZE - 1) // PAGE_SIZE))
    print(f"  Invan: {start_date_iso}..{end_date_iso} — {total:,} ta buyurtma, "
          f"{n_pages} sahifa ({PARALLEL} tadan parallel)", flush=True)

    by_id = {}
    for o in first:
        oid = str(o.get("id") or "")
        if oid:
            by_id[oid] = o

    if n_pages > 1:
        pages = list(range(2, n_pages + 1))
        with ThreadPoolExecutor(max_workers=PARALLEL) as ex:
            futures = [ex.submit(_get_page, token, start_date_iso, end_date_iso, p)
                       for p in pages]
            done = 0
            for fut in as_completed(futures):
                batch, _ = fut.result()
                for o in batch:
                    oid = str(o.get("id") or "")
                    if oid:
                        by_id[oid] = o
                done += 1
                if done % 10 == 0 or done == len(pages):
                    print(f"    {done}/{len(pages)} sahifa, {len(by_id):,} ta buyurtma", flush=True)

    orders = list(by_id.values())
    orders.sort(key=lambda o: (str(o.get("create_time") or ""), str(o.get("id") or "")))
    return orders


def fetch_window(days, chunk_size=None):
    """So'nggi N kunlik buyurtmalar — `turso_sync.fetch_window()` bilan
    AYNAN bir xil sana chegaralari (natija farq qilmasligi uchun)."""
    end_date = date.today() + timedelta(days=1)
    start_date = date.today() - timedelta(days=days)
    return fetch_range(start_date.isoformat(), end_date.isoformat())


# ─── Ta'minotchi buyurtmalari (kirim) ───────────────────────────────────────
#
# `turso_sync_supplier_orders.fetch_supplier_orders()` / `fetch_orders_by_ids()`
# ning o'rnini bosadi. Ular ham Turso'dan o'qir edi, Turso'ga esa AYNAN shu
# xom Invan obyektlari yozilardi — ya'ni yana o'sha vositachi.

SUP_PAGE_SIZE = 200
SUP_MAX_PAGES = 200


def _sup_page(token, page, limit=SUP_PAGE_SIZE):
    """Bir sahifa ta'minotchi buyurtmasi.

    `turso_sync_supplier_orders.fetch_page()` dagi bilan BIR XIL: Invan ba'zan
    `items`siz (to'liqsiz) javob qaytaradi — yarmidan ko'pi bo'sh chiqsa,
    2 sekund kutib bir marta qayta so'raladi."""
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    params = {"page": page, "limit": limit}
    for _ in range(2):
        resp = _session().post(f"{BASE_URL}/supplier_order", headers=headers,
                               params=params, json={"filters": []}, timeout=120)
        resp.raise_for_status()
        data = resp.json().get("data", [])
        if not data or sum(1 for o in data if o.get("items")) >= len(data) * 0.5:
            return data
        time.sleep(2)
    return data


def _sup_scan(token, stop_before=None, max_pages=SUP_MAX_PAGES):
    """Sahifalarni yangidan eskiga qarab skanerlaydi. `stop_before` (ISO sana)
    berilsa, undan eski buyurtmaga yetganda to'xtaydi."""
    out, page = [], 1
    while page <= max_pages:
        batch = _sup_page(token, page)
        if not batch:
            break
        out.extend(batch)
        if len(batch) < SUP_PAGE_SIZE:
            break
        if stop_before and str(batch[-1].get("created_at") or "") < stop_before:
            break
        page += 1
    return out


def fetch_supplier_orders(since=None, chunk_size=None):
    """`since` (ISO) dan keyin YARATILGAN ta'minotchi buyurtmalari; `since`
    berilmasa — butun tarix (bir martalik bootstrap)."""
    token = load_token()
    orders = _sup_scan(token, stop_before=since)
    if since:
        orders = [o for o in orders if str(o.get("created_at") or "") > since]
    print(f"  Invan: {len(orders):,} ta ta'minotchi buyurtmasi"
          + (f" ({since} dan keyin)" if since else " (to'liq tarix)"), flush=True)
    return orders


def fetch_orders_by_ids(order_ids, chunk_size=None):
    """Berilgan ID'larning ENG SO'NGGI holati (hali yakunlanmagan kirimlarni
    qayta tekshirish uchun — status Open->Received kech o'zgarishi mumkin).

    Invan ID bo'yicha so'rashni qo'llab-quvvatlamaydi (GET-by-ID 404, `filters`
    e'tiborga olinmaydi — turso_sync_supplier_orders.py:24 da qayd etilgan),
    shuning uchun tarix skanerlanib ID bo'yicha filtrlanadi. Topilmaganlar
    natijaga kirmaydi — chaqiruvchi ularni eski holatida qoldiradi (zararsiz)."""
    ids = {str(x) for x in (order_ids or []) if x}
    if not ids:
        return []
    token = load_token()
    found = [o for o in _sup_scan(token) if str(o.get("id") or "") in ids]
    print(f"  Invan: {len(ids):,} ta kutilayotgan ID dan {len(found):,} tasi topildi", flush=True)
    return found


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser(description="Invan'dan buyurtmalarni sinov uchun olish")
    ap.add_argument("--days", type=int, default=1)
    ap.add_argument("--start")
    ap.add_argument("--end")
    a = ap.parse_args()
    t0 = time.time()
    if a.start:
        res = fetch_range(a.start, a.end or (date.today() + timedelta(days=1)).isoformat())
    else:
        res = fetch_window(a.days)
    print(f"{len(res):,} ta buyurtma, {time.time()-t0:.1f}s")
    if res:
        print("birinchi:", res[0].get("create_time"), "| oxirgi:", res[-1].get("create_time"))
