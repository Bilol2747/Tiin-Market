"""
Invan API'dan kelgan buyurtmalarni Turso (libSQL) bazasiga incremental tarzda
sinxronlaydi: faqat oxirgi sinxronizatsiyadan beri kelgan yangi buyurtmalarni
so'raydi va bazaga yozadi. Barcha sotuvlar cheklovsiz saqlanadi.

Natijada build_all_from_api.py kabi skriptlar bazadan istalgan davr (masalan
60 kun) uchun buyurtmalar ro'yxatini olib, qurishni davom ettira oladi - har
safar Invan API'dan butun davrni qaytadan yuklamasdan.
"""
import argparse
import json
import os
import sys
import time
from datetime import date, datetime, timedelta
from pathlib import Path

import libsql_client

from fetch_api_data import BASE_URL, ORDER_PAGE_SIZE, SESSION, load_token, request_with_retry

ROOT = Path(__file__).parent
# RETENTION_DAYS olib tashlandi — barcha sotuvlar Turso'da doim saqlanadi


def load_turso_creds():
    url = os.environ.get("TURSO_DATABASE_URL", "").strip()
    token = os.environ.get("TURSO_AUTH_TOKEN", "").strip()
    if not url:
        p = ROOT / "turso_url.txt"
        if p.exists():
            url = p.read_text(encoding="utf-8").strip()
    if not token:
        p = ROOT / "turso_token.txt"
        if p.exists():
            token = p.read_text(encoding="utf-8").strip()
    if not url or not token:
        sys.exit("Turso URL/token topilmadi: TURSO_DATABASE_URL / TURSO_AUTH_TOKEN "
                  "(yoki turso_url.txt / turso_token.txt) kerak.")
    http_url = url.replace("libsql://", "https://")
    return http_url, token


def get_client():
    url, token = load_turso_creds()
    return libsql_client.create_client_sync(url=url, auth_token=token)


def ensure_schema(client):
    client.execute(
        "CREATE TABLE IF NOT EXISTS orders ("
        "id TEXT PRIMARY KEY, create_time TEXT NOT NULL, data TEXT NOT NULL)"
    )
    client.execute("CREATE INDEX IF NOT EXISTS idx_orders_create_time ON orders(create_time)")


def latest_create_time(client):
    rs = client.execute("SELECT MAX(create_time) AS m FROM orders")
    row = rs.rows[0] if rs.rows else None
    return row["m"] if row and row["m"] else None


def upsert_orders(client, orders):
    stmts = []
    for o in orders:
        oid = str(o.get("id") or "")
        if not oid:
            continue
        ct = o.get("create_time") or ""
        stmts.append(libsql_client.Statement(
            "INSERT INTO orders (id, create_time, data) VALUES (?, ?, ?) "
            "ON CONFLICT(id) DO UPDATE SET create_time=excluded.create_time, data=excluded.data",
            [oid, ct, json.dumps(o, ensure_ascii=False)]
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


def prune_old(client, cutoff_iso):
    client.execute("DELETE FROM orders WHERE create_time < ?", [cutoff_iso])


def fetch_and_sync_orders(client, token, start_date, end_date):
    """Invan API'dan sahifalab o'qiydi va har sahifani darhol Turso'ga yozadi -
    shunda jarayon istalgan joyda to'xtasa ham, hech narsa yo'qolmaydi."""
    headers = {"Authorization": f"Bearer {token}"}
    page = 1
    total = None
    total_written = 0
    while True:
        params = {
            "page": page,
            "limit": ORDER_PAGE_SIZE,
            "start_date": start_date,
            "end_date": end_date,
        }
        resp = request_with_retry(SESSION.get, f"{BASE_URL}/order", headers=headers, params=params, timeout=60)
        body = resp.json()
        batch = body.get("data", [])
        if total is None:
            total = body.get("total", 0)
            print(f"  Jami topilgan sotuvlar: {total}")
        n = upsert_orders(client, batch)
        total_written += n
        print(f"  {page}-sahifa: {len(batch)} ta olindi, bazaga yozildi (jami yozilgan: {total_written})")
        if len(batch) < ORDER_PAGE_SIZE or total_written >= total:
            break
        page += 1
        time.sleep(0.05)
    return total_written


def fetch_range(start_date_iso, end_date_iso, chunk_size=5000):
    """Bazadan [start_date_iso, end_date_iso) oralig'idagi buyurtmalarni o'qiydi
    (aniq sana oralig'i bilan - bo'lib-bo'lib kichik so'rovlar uchun, masalan
    bitta oy). Katta hajmni bir so'rovda emas, kichik bo'laklarda o'qiydi -
    bitta katta HTTP javobda tarmoq uzilib qolish xavfini kamaytirish uchun.
    Har bo'lak tarmoq xatosida bir necha marta qayta uriniladi."""
    client = get_client()
    print(f"  Turso range: {start_date_iso}..{end_date_iso} o'qilmoqda", flush=True)
    ensure_schema(client)
    print("  Turso schema tayyor, orderlar bo'laklab olinmoqda", flush=True)
    orders = []
    last_create_time = None
    last_id = None
    while True:
        last_error = None
        rs = None
        for attempt in range(1, 6):
            try:
                params = [start_date_iso, end_date_iso]
                cursor_filter = ""
                if last_create_time is not None and last_id is not None:
                    cursor_filter = "AND (create_time > ? OR (create_time = ? AND id > ?)) "
                    params.extend([last_create_time, last_create_time, last_id])
                params.append(chunk_size)
                rs = client.execute(
                    "SELECT data FROM orders WHERE create_time >= ? AND create_time < ? "
                    + cursor_filter +
                    "ORDER BY create_time, id LIMIT ?",
                    params
                )
                break
            except Exception as exc:
                last_error = exc
                wait = attempt * 3
                print(f"  ! Turso'dan o'qishda tarmoq xatosi ({exc.__class__.__name__}), {wait}s kutib qayta urinish ({attempt}/5)...")
                time.sleep(wait)
        if rs is None:
            raise last_error
        batch = [json.loads(row["data"]) for row in rs.rows]
        orders.extend(batch)
        print(f"    {len(orders):,} ta order o'qildi", flush=True)
        if len(batch) < chunk_size:
            break
        last = batch[-1]
        last_create_time = last.get("create_time") or last_create_time
        last_id = str(last.get("id") or last_id or "")
    client.close()
    return orders


def fetch_window(days, chunk_size=5000):
    """Bazadan so'nggi N kunlik buyurtmalarni o'qiydi (build skriptlari uchun)."""
    end_date = date.today() + timedelta(days=1)
    start_date = date.today() - timedelta(days=days)
    return fetch_range(start_date.isoformat(), end_date.isoformat(), chunk_size)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--bootstrap-days", type=int, default=60,
                         help="Baza bo'sh bo'lsa, necha kunlik tarixni boshlang'ich yuklash")
    parser.add_argument("--overlap-hours", type=int, default=2,
                         help="Oxirgi sinxronizatsiyadan necha soat oldin qaytadan tekshirish "
                              "(Invan API kechikib ko'rsatishi mumkin bo'lgan buyurtmalar uchun xavfsizlik zахirasi)")
    args = parser.parse_args()

    token = load_token()
    client = get_client()
    ensure_schema(client)

    now = datetime.utcnow()
    last_ct = latest_create_time(client)
    if last_ct:
        # Incremental holat: aniq VAQT (soat:daqiqa:soniya) asosida, kunlik
        # yaxlitlashsiz - Turso yozish kvotasini behuda sarflamaslik uchun
        # (avval har safar butun kalendar kun(lar) qayta yozilar edi, garchi
        # allaqachon 30 daqiqa oldin xuddi shunday yozilgan bo'lsa ham -
        # bitta buyurtma o'rtacha ~37 marta ortiqcha qayta yozilib, oylik 10M
        # yozish kvotasini to'ldirib qo'ygan edi). Invan API bu darajada aniq
        # filtrlashni qo'llab-quvvatlashi jonli so'rov bilan tasdiqlangan.
        last_dt = datetime.fromisoformat(last_ct.replace("Z", "+00:00")).replace(tzinfo=None)
        start_dt = last_dt - timedelta(hours=args.overlap_hours)
        print(f"Bazada mavjud, oxirgi yozuv: {last_ct}. {start_dt.isoformat()} dan boshlab tekshiramiz "
              f"(oxirgi {args.overlap_hours} soat qayta tekshiriladi).")
    else:
        # Bootstrap holat (baza bo'sh) - bir martalik, kamdan-kam ishlaydigan
        # yo'l, o'zgartirilmadi (kunlik aniqlik bu yerda muammo emas).
        start_dt = now - timedelta(days=args.bootstrap_days)
        print(f"Baza bo'sh, boshlang'ich yuklash: {start_dt.isoformat()} dan hozirgacha.")

    end_dt = now + timedelta(minutes=5)  # "hozir" chegarasidagi buyurtmalarni ham qamrab olish uchun kichik bufer
    start_iso = start_dt.strftime("%Y-%m-%dT%H:%M:%S")
    end_iso = end_dt.strftime("%Y-%m-%dT%H:%M:%S")
    print(f"Invan API'dan yuklanmoqda: {start_iso} -- {end_iso}")

    total_synced = 0
    last_error = None
    for attempt in range(1, 4):
        try:
            total_synced = fetch_and_sync_orders(client, token, start_iso, end_iso)
            last_error = None
            break
        except Exception as exc:
            last_error = exc
            print(f"  ! Invan API xatosi ({exc.__class__.__name__}): {exc}")
            if attempt < 3:
                wait = attempt * 60
                print(f"  {wait}s kutib qayta uramiz ({attempt}/3)...")
                time.sleep(wait)

    if last_error is not None:
        raise RuntimeError(f"Sinxronizatsiya 3 urinishdan keyin ham muvaffaqiyatsiz: {last_error}")
    print(f"  Jami {total_synced} ta yozuv bazaga yozildi/yangilandi")

    rs = client.execute("SELECT COUNT(*) AS c FROM orders")
    print(f"Bazada jami: {rs.rows[0]['c']} ta buyurtma")

    client.close()


if __name__ == "__main__":
    main()
