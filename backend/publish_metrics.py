#!/usr/bin/env python3
"""
publish_metrics.py — OG'IR HISOB natijalarini Turso'ga e'lon qiladi (SEKIN QATLAM).

MUAMMO: zakas tizimi uchun kerak bo'lgan ko'rsatkichlarning bir qismi
(`avg30sa`, `pav`, `zabc`, `rcost`, `calcStock` ...) butun sotuv tarixini
qayta ishlashni talab qiladi. Vercel serverless funksiyasi bunchalik uzoq
ishlay olmaydi (chegara 30-60 s).

YECHIM (SODDA): bu hisob ALLAQACHON eski GitHub Actions pipeline'i
(`build_all_from_api.py`) tomonidan HAR SOATDA bajarilib, natija
`data_inv_new.json`ga yozilyapti — QAYTA HISOBLASH SHART EMAS. Shu skript
faqat O'SHA tayyor faylni o'qiydi va undagi og'ir maydonlarni `sku_metrics`
jadvaliga (Turso) ko'chiradi — bir necha soniyada tugaydi.

API esa (backend/app.py: `_live_invdata()`) arzon, JONLI ma'lumotni
(stok/narx/ta'minotchi — `products` jadvalidan) shu jadval bilan
birlashtiradi. Shu tufayli zakas hisobida stok/kirim/sotuv HAR DOIM jonli,
tasnif/o'rtachalar esa pipeline necha marta ishlasa shuncha yangilanadi.

Ishlatish (sync.yml'da `build_all_from_api.py`dan KEYIN, xuddi shu ishchi
katalogda — `data_inv_new.json` hozirgina yozilgan bo'lishi kerak):
    TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... python backend/publish_metrics.py
"""
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(HERE))

import libsql_client              # noqa: E402
from etl_from_turso import turso_client   # noqa: E402

# `invdata` (= data_inv_new.json) ichidan SHU maydonlar ko'chiriladi — ular
# OG'IR hisob natijasi. Qolganlari (stok `a`, narx `p`/`sp`, ta'minotchi
# `su`, kategoriya, shtrix-kod) ATAYLAB bu yerga kirmaydi: ular API'da jonli
# o'qiladi, aks holda kunda bir necha marta yangilanadigan "muzlagan"
# qiymatga aylanib qolardi.
HEAVY_FIELDS = (
    "avg30sa", "pav", "pavm",           # o'rtacha kunlik talab (stok-hisobli)
    "zabc",                             # kategoriya-ichi ABC tasnifi
    "rcost", "rcost_approx",            # ishonchli joriy tannarx
    "calcStock", "calcConf", "calcEvidence", "calcAnchor", "calcRule",
    "lkQty", "lkSold", "lkDate",        # oxirgi kirim tafsilotlari
    "ld60", "lsd",                      # oxirgi sotuv ko'rsatkichlari
)

BATCH = 400


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)


def _existing(client):
    """Turso'dagi joriy holat: {sku: data_json_matni}. Faqat O'ZGARGAN
    qatorlarni yozish uchun — Turso yozish kvotasi cheklangan (2026-07-16'da
    aynan shu sabab bilan bir hisob bloklangan edi)."""
    out, offset, page = {}, 0, 2000
    while True:
        rs = client.execute(
            "SELECT sku, data FROM sku_metrics ORDER BY sku LIMIT ? OFFSET ?",
            [page, offset])
        if not rs.rows:
            break
        for r in rs.rows:
            out[r["sku"]] = r["data"]
        if len(rs.rows) < page:
            break
        offset += page
    return out


def publish(invdata, client):
    now = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    sql = ("INSERT INTO sku_metrics (sku, name, data, updated_at) VALUES (?,?,?,?) "
           "ON CONFLICT(sku) DO UPDATE SET name=excluded.name, data=excluded.data, "
           "updated_at=excluded.updated_at")

    existing = _existing(client)
    log(f"Turso'da joriy: {len(existing):,} SKU (solishtirish uchun o'qildi)")

    rows, skipped, unchanged = [], 0, 0
    for name, entry in invdata.items():
        sku = str(entry.get("sku") or "").strip()
        if not sku:
            skipped += 1          # SKU'siz yozuv — birlashtirib bo'lmaydi
            continue
        payload = {k: entry[k] for k in HEAVY_FIELDS if k in entry}
        if not payload:
            continue
        data_json = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        if existing.get(sku) == data_json:   # HEAVY_FIELDS tartibi doim bir xil -> matn solishtirish yetarli
            unchanged += 1
            continue
        rows.append((sku, name, data_json, now))

    log(f"E'lon qilinadi: {len(rows):,} SKU o'zgargan "
        f"(o'zgarmagan: {unchanged:,}, SKU'siz o'tkazib yuborildi: {skipped:,})")
    done = 0
    for i in range(0, len(rows), BATCH):
        chunk = rows[i:i + BATCH]
        stmts = [libsql_client.Statement(sql, list(r)) for r in chunk]
        for attempt in range(1, 6):
            try:
                client.batch(stmts)
                break
            except Exception as exc:
                if attempt == 5:
                    raise
                wait = attempt * 3
                log(f"  ! xato ({exc.__class__.__name__}), {wait}s kutib qayta ({attempt}/5)")
                time.sleep(wait)
        done += len(chunk)
        if done % (BATCH * 10) == 0 or done == len(rows):
            log(f"  {done:,}/{len(rows):,}")
    return done


def main():
    t0 = time.time()
    p = ROOT / "data_inv_new.json"
    if not p.exists():
        sys.exit(f"XATO: {p} topilmadi — avval build_all_from_api.py ishlashi kerak.")

    invdata = json.loads(p.read_text(encoding="utf-8"))
    log(f"O'qildi: {len(invdata):,} tovar ({p.name}, {p.stat().st_size/1048576:.1f} MB)")

    client = turso_client()
    try:
        n = publish(invdata, client)
    finally:
        client.close()

    log(f"TAYYOR: {n:,} SKU e'lon qilindi, {time.time()-t0:.1f}s")


if __name__ == "__main__":
    main()
