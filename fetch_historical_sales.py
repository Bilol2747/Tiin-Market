"""
Tarixiy (eski) sotuv ma'lumotini Invan API'dan FAQAT HISOBLASH uchun yuklaydi —
xom buyurtmalar SAQLANMAYDI, faqat active tovarlar bo'yicha kunlik SKU
yig'indisi natija faylga yoziladi. Turso'ga/saytga hech narsa yozilmaydi
(READ-ONLY, faqat GET so'rovlar).

Nega kerak: backend_p_calc_stock.py'dagi gibrid model ba'zi tovarlar uchun
1-yanvardan OLDINGI (masalan 2025-yil ikkinchi yarmi) sotuv-kirim oqimiga
muhtoj — bu ma'lumot Turso'da yo'q (u faqat oxirgi oylarni saqlaydi), shuning
uchun Invan API'dan to'g'ridan-to'g'ri olinadi. Bu QIMMAT operatsiya (yuz
minglab buyurtma, ~10-60 daqiqa) — shuning uchun PIPELINE'NING QISMI EMAS,
faqat QO'LDA, kamdan-kam (masalan chegarani yana orqaga surish kerak
bo'lganda) ishga tushiriladi.

Ishlatilishi (bitta oy/oraliq):
    python fetch_historical_sales.py 2025-07-01 2025-08-01 chunk_2025-07.json

Tezlashtirish uchun: bir nechta oyni PARALLEL (alohida terminal/background
jarayon sifatida) ishga tushiring, keyin natijalarni merge_sales_chunks.py
bilan birlashtiring.
"""
import json, sys, time
from datetime import datetime, timedelta
from pathlib import Path
import requests

ROOT = Path(__file__).parent
BASE_URL = "https://api.7i.uz/integration/v1"
TASHKENT_OFFSET = timedelta(hours=5)
PAGE_SIZE = 500


def fetch_range_daily(start_iso, end_iso, token, active_skus, verbose=True):
    """[start_iso, end_iso) oralig'idagi sotuvlarni o'qib, {sku: {"YYYY-MM-DD": qty}}
    qaytaradi. Faqat active_skus to'plamidagi SKU'lar saqlanadi (boshqalari
    o'tkazib yuboriladi - natija faylini kichik ushlab turish uchun)."""
    S = requests.Session()
    H = {"Authorization": f"Bearer {token}"}
    daily = {}
    page, total, got = 1, None, 0
    t0 = time.time()
    while True:
        params = {"page": page, "limit": PAGE_SIZE, "start_date": start_iso, "end_date": end_iso}
        body = None
        for attempt in range(5):
            try:
                r = S.get(f"{BASE_URL}/order", headers=H, params=params, timeout=120)
                r.raise_for_status()
                body = r.json()
                break
            except Exception:
                if attempt == 4:
                    raise
                time.sleep(2 * (attempt + 1))
        batch = body.get("data", [])
        if total is None:
            total = body.get("total", 0)
        for o in batch:
            ct = o.get("create_time")
            if not ct:
                continue
            try:
                utc_dt = datetime.fromisoformat(ct.replace("Z", "+00:00"))
            except ValueError:
                continue
            d_local = (utc_dt.replace(tzinfo=None) + TASHKENT_OFFSET).date().isoformat()
            sign = -1 if o.get("type") != "sale" else 1
            for it in (o.get("items") or []):
                q = float(it.get("value") or 0)
                if q <= 0:
                    continue
                sku = str(it.get("sku") or "").strip()
                if not sku or sku not in active_skus:
                    continue
                m = daily.setdefault(sku, {})
                m[d_local] = m.get(d_local, 0) + sign * q
        got += len(batch)
        if len(batch) < PAGE_SIZE or (total and got >= total):
            break
        page += 1
    if verbose:
        print(f"  {start_iso}..{end_iso}: {got:,}/{total:,} buyurtma, {len(daily):,} SKU, {time.time()-t0:.0f}s", flush=True)
    return daily


def main():
    if len(sys.argv) != 4:
        print("Ishlatilishi: python fetch_historical_sales.py START_DATE END_DATE OUT_FILE.json")
        print("  Masalan: python fetch_historical_sales.py 2025-07-01 2025-08-01 chunk_07.json")
        sys.exit(1)
    start_iso, end_iso, out_path = sys.argv[1], sys.argv[2], Path(sys.argv[3])

    token = (ROOT / "api_token.txt").read_text(encoding="utf-8").strip()

    active = set()
    inv = json.loads((ROOT / "data_inv_new.json").read_text(encoding="utf-8"))
    for v in inv.values():
        if isinstance(v, dict):
            sk = str(v.get("sku") or "").strip()
            if sk:
                active.add(sk)
    print(f"Active tovar (filtr): {len(active):,}")

    daily = fetch_range_daily(start_iso, end_iso, token, active)
    out_path.write_text(json.dumps(daily, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Saqlandi: {out_path} ({out_path.stat().st_size/1e6:.1f} MB, {len(daily):,} SKU)")


if __name__ == "__main__":
    main()
