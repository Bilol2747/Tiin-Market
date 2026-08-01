import argparse
import json
import os
import sys
import time
from datetime import date, timedelta
from pathlib import Path

import requests

ROOT = Path(__file__).parent
BASE_URL = "https://api.7i.uz/integration/v1"
TOKEN_PATH = ROOT / "api_token.txt"
ORDER_PAGE_SIZE = 500  # 1000 ba'zi kunlar uchun server 500 xatosi beradi
PRODUCT_PAGE_SIZE = 2000
SESSION = requests.Session()


def load_token():
    env_token = os.environ.get("INVAN_API_TOKEN", "").strip()
    if env_token:
        return env_token
    if not TOKEN_PATH.exists():
        sys.exit(f"Token topilmadi: INVAN_API_TOKEN o'zgaruvchisi yoki {TOKEN_PATH} fayli kerak.")
    token = TOKEN_PATH.read_text(encoding="utf-8").strip()
    if not token:
        sys.exit("api_token.txt bo'sh.")
    return token


def request_with_retry(method, url, **kwargs):
    last_error = None
    for attempt in range(1, 6):
        try:
            resp = method(url, **kwargs)
            resp.raise_for_status()
            return resp
        except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as exc:
            last_error = exc
            wait = attempt * 5
            print(f"  ! Tarmoq xatosi ({exc.__class__.__name__}), {wait}s kutib qayta urinish ({attempt}/5)...")
            time.sleep(wait)
        except requests.exceptions.HTTPError as exc:
            status = exc.response.status_code if exc.response is not None else 0
            if status < 500:
                raise
            last_error = exc
            wait = attempt * 5
            print(f"  ! Server xatosi ({status}), {wait}s kutib qayta urinish ({attempt}/5)...")
            time.sleep(wait)
    raise last_error


def fetch_orders(token, start_date, end_date):
    headers = {"Authorization": f"Bearer {token}"}
    checkpoint_path = ROOT / "api_raw_orders.partial.json"
    orders = []
    if checkpoint_path.exists():
        orders = json.loads(checkpoint_path.read_text(encoding="utf-8"))
        print(f"  Avvalgi to'xtagan joydan davom etamiz: {len(orders)} ta yozuv allaqachon bor")
    page = len(orders) // ORDER_PAGE_SIZE + 1
    total = None
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
        orders.extend(batch)
        checkpoint_path.write_text(json.dumps(orders, ensure_ascii=False), encoding="utf-8")
        print(f"  {page}-sahifa: {len(batch)} ta yozuv (jami yig'ilgan: {len(orders)})")
        if len(batch) < ORDER_PAGE_SIZE or len(orders) >= total:
            break
        page += 1
        time.sleep(0.05)
    checkpoint_path.unlink(missing_ok=True)
    return orders


def fetch_products(token):
    """Faqat faol (is_active) mahsulotlarni yuklaydi. Faol emas (sotuvdan chiqarilgan)
    tovarlar zakas/stok hisob-kitobiga kerak emas - API'ga active_for_sale filtri
    yuboriladi (so'rovlar sonini kamaytirish uchun), va har holda Python tomonda
    is_active bo'yicha qayta filtrlanadi (server filtri e'tiborga olinmasa ham
    natija to'g'ri bo'lishi uchun)."""
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    checkpoint_path = ROOT / "api_raw_products.partial.json"
    products = []
    page = 1
    if checkpoint_path.exists():
        ckpt = json.loads(checkpoint_path.read_text(encoding="utf-8"))
        products = ckpt.get("products", [])
        page = ckpt.get("next_page", 1)
        print(f"  Avvalgi to'xtagan joydan davom etamiz: {len(products)} ta mahsulot allaqachon bor ({page}-sahifadan)")
    while True:
        params = {"page": page, "limit": PRODUCT_PAGE_SIZE, "active_for_sale": "active"}
        resp = request_with_retry(
            SESSION.post, f"{BASE_URL}/products", headers=headers, params=params, json={"filters": []}, timeout=60
        )
        body = resp.json()
        batch = body.get("data", [])
        active_batch = [p for p in batch if p.get("is_active", True)]
        products.extend(active_batch)
        checkpoint_path.write_text(
            json.dumps({"products": products, "next_page": page + 1}, ensure_ascii=False), encoding="utf-8"
        )
        print(f"  {page}-sahifa: {len(batch)} ta mahsulot ({len(active_batch)} faol, jami yig'ilgan: {len(products)})")
        if len(batch) < PRODUCT_PAGE_SIZE:
            break
        page += 1
        time.sleep(0.05)
    checkpoint_path.unlink(missing_ok=True)
    return products


def get_last_date_in_orders(orders):
    """Buyurtmalar ro'yxatidagi oxirgi sanani qaytaradi."""
    last = None
    for o in orders:
        ct = o.get("createdAt") or o.get("create_time") or o.get("date") or ""
        d = str(ct)[:10]
        if len(d) == 10:
            try:
                parsed = date.fromisoformat(d)
                if last is None or parsed > last:
                    last = parsed
            except ValueError:
                pass
    return last


def merge_orders(old_orders, new_orders, from_date):
    """Yangi buyurtmalarni eskisiga qo'shadi: from_date dan oldingi eski yozuvlar saqlanadi,
    from_date dan keyingilari yangilari bilan almashtiriladi."""
    cutoff = from_date.isoformat()
    kept = [o for o in old_orders if str(o.get("createdAt") or o.get("create_time") or o.get("date") or "")[:10] < cutoff]
    return kept + new_orders


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--days", type=int, default=60, help="Necha kunlik sotuv tarixini olish (bugundan orqaga)")
    parser.add_argument("--start", type=str, default=None, help="Boshlanish sanasi (YYYY-MM-DD) - berilsa --days e'tiborga olinmaydi")
    parser.add_argument("--end", type=str, default=None, help="Tugash sanasi (YYYY-MM-DD), standart - bugun")
    parser.add_argument("--skip-products", action="store_true")
    parser.add_argument("--skip-orders", action="store_true", help="Sotuvlarni o'tkazib yuborish")
    parser.add_argument("--force", action="store_true", help="Mavjud faylni e'tiborsiz qoldirip to'liq qayta yuklash")
    parser.add_argument("--update", action="store_true", help="Oxirgi 2 kunni qayta yuklash (to'liqsiz kunlar uchun)")
    args = parser.parse_args()

    token = load_token()
    # API end_date EKSKLYUZIV: start_date=end_date bo'lsa 0 qaytadi. Shu sababli
    # foydalanuvchi "--end 2026-06-30" berganda biz +1 kun qo'shamiz.
    end_date = date.fromisoformat(args.end) + timedelta(days=1) if args.end else date.today() + timedelta(days=1)

    out_orders = ROOT / "api_raw_orders.json"

    if args.skip_orders:
        print("1) Sotuvlar o'tkazib yuborildi (--skip-orders).\n")
    elif args.force:
        # To'liq qayta yuklash
        if args.start:
            start_date = date.fromisoformat(args.start)
        else:
            start_date = end_date - timedelta(days=args.days)
        print(f"1) --force: to'liq qayta yuklash {start_date} dan {end_date} gacha...")
        orders = fetch_orders(token, start_date.isoformat(), end_date.isoformat())
        out_orders.write_text(json.dumps(orders, ensure_ascii=False), encoding="utf-8")
        print(f"   -> Saqlandi: {out_orders.name} ({len(orders)} ta sotuv)\n")
    elif args.update and out_orders.exists():
        # Faqat oxirgi 2 kunni yangilash (to'liqsiz kunlar)
        old_orders = json.loads(out_orders.read_text(encoding="utf-8"))
        last_date = get_last_date_in_orders(old_orders)
        if last_date is None:
            print("  ! Eski fayldagi sanalar aniqlanmadi, to'liq yuklanadi.")
            start_date = end_date - timedelta(days=args.days)
            orders = fetch_orders(token, start_date.isoformat(), end_date.isoformat())
            out_orders.write_text(json.dumps(orders, ensure_ascii=False), encoding="utf-8")
        else:
            # Oxirgi sanadan 1 kun oldin boshlab (o'sha kun to'liq bo'lmasligi mumkin)
            update_from = last_date - timedelta(days=1)
            print(f"1) --update: {update_from} dan {end_date} gacha yangilanmoqda (eski: {len(old_orders)} ta sotuv, oxirgi: {last_date})...")
            new_orders = fetch_orders(token, update_from.isoformat(), end_date.isoformat())
            merged = merge_orders(old_orders, new_orders, update_from)
            out_orders.write_text(json.dumps(merged, ensure_ascii=False), encoding="utf-8")
            print(f"   -> Yangilandi: {out_orders.name} ({len(old_orders)} → {len(merged)} ta sotuv, +{len(new_orders)} yangi)\n")
    elif out_orders.exists() and not args.force:
        # Mavjud fayl — oxirgi sana va bugunni tekshirish
        old_orders = json.loads(out_orders.read_text(encoding="utf-8"))
        last_date = get_last_date_in_orders(old_orders)
        if last_date and (end_date - last_date).days >= 1:
            # 1+ kun eskirgan — avtomatik inkremental yangilash
            update_from = last_date - timedelta(days=1)
            print(f"1) Ma'lumot {last_date} da to'xtaganini aniqladim ({(end_date-last_date).days} kun eskirgan).")
            print(f"   {update_from} dan {end_date} gacha inkremental yangilash...")
            new_orders = fetch_orders(token, update_from.isoformat(), end_date.isoformat())
            merged = merge_orders(old_orders, new_orders, update_from)
            out_orders.write_text(json.dumps(merged, ensure_ascii=False), encoding="utf-8")
            print(f"   -> Yangilandi: {len(old_orders)} → {len(merged)} ta sotuv (+{len(new_orders)} yangi)\n")
        else:
            print(f"1) Sotuvlar yangi ({last_date}), qayta yuklanmaydi. --update yoki --force ishlating.\n")
    else:
        if args.start:
            start_date = date.fromisoformat(args.start)
        else:
            start_date = end_date - timedelta(days=args.days)
        print(f"1) Sotuvlar yuklanmoqda: {start_date} dan {end_date} gacha...")
        orders = fetch_orders(token, start_date.isoformat(), end_date.isoformat())
        out_orders.write_text(json.dumps(orders, ensure_ascii=False), encoding="utf-8")
        print(f"   -> Saqlandi: {out_orders.name} ({len(orders)} ta sotuv)\n")

    out_products = ROOT / "api_raw_products.json"
    if out_products.exists() and not args.force:
        print(f"2) Mahsulotlar allaqachon tayyor ({out_products.name} mavjud) - qayta yuklanmaydi.\n")
    elif not args.skip_products:
        print("2) Mahsulot katalogi yuklanmoqda...")
        products = fetch_products(token)
        out_products.write_text(json.dumps(products, ensure_ascii=False), encoding="utf-8")
        print(f"   -> Saqlandi: {out_products.name} ({len(products)} ta mahsulot)\n")

    print("Tugadi.")


if __name__ == "__main__":
    main()
