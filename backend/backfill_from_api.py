#!/usr/bin/env python3
"""
backfill_from_api.py — Invan API'dan TARIXIY sotuvlarni bazaga yuklaydi.

NEGA KERAK: Turso faqat 2026-05-17 dan boshlanadi (hisob almashtirilganda eski
qismi ko'chirilmagan). Invan API esa 2025-02-26 dan beri saqlaydi. Loyihaning
hisoblari uchun tayanch sana — 2026-01-01 (build_prev_avg.py:46
HISTORY_BASE_DATE), shuning uchun standart oraliq shundan boshlanadi.

FAQAT O'QISH: Invan'ga hech narsa yozilmaydi (faqat GET /order).

Ishlatish:
    python backend/backfill_from_api.py                       # 2026-01-01 dan Turso boshlanishigacha
    python backend/backfill_from_api.py --from 2025-07-01     # boshqa boshlanish
    python backend/backfill_from_api.py --from 2026-03-01 --to 2026-03-31

KUNMA-KUN ishlaydi va har kunni tugatgach belgilab qo'yadi — uzilib qolsa
qayta ishga tushiring, qolgan kunlardan davom etadi (bajarilganini qayta
yuklamaydi).
"""
import argparse
import sys
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(HERE))

import requests                                        # noqa: E402
import db                                              # noqa: E402
from etl_from_turso import parse_order                 # noqa: E402
from sync_worker import (BASE_URL, ORDER_PAGE_SIZE, SESSION, load_token,   # noqa: E402
                         request_with_retry, state_get, state_set,
                         refresh_rollups, REC_SQL, ITEM_SQL)

DEFAULT_FROM = "2026-01-01"      # build_prev_avg.py HISTORY_BASE_DATE bilan bir xil


def log(*a):
    print(datetime.now().strftime("%H:%M:%S"), *a, flush=True)


def fetch_day(token, d):
    """Bitta kunning BARCHA cheklarini oladi (Toshkent mahalliy kuni bo'yicha).

    Mahalliy kun = UTC [d-1 19:00, d 19:00) — chunki Toshkent UTC+5.
    parse_order() baribir har chekni o'z mahalliy sanasiga joylashtiradi,
    lekin oynani to'g'ri olish chegaradagi cheklarni yo'qotmaslik uchun kerak.
    """
    lo = (datetime.combine(d, datetime.min.time()) - timedelta(hours=5)).isoformat() + "Z"
    hi = (datetime.combine(d, datetime.min.time()) + timedelta(hours=19)).isoformat() + "Z"
    headers = {"Authorization": f"Bearer {token}"}
    out, page, total = [], 1, None
    while True:
        resp = request_with_retry(
            SESSION.get, f"{BASE_URL}/order", headers=headers, timeout=120,
            params={"page": page, "limit": ORDER_PAGE_SIZE,
                    "start_date": lo, "end_date": hi})
        body = resp.json()
        batch = body.get("data", [])
        if total is None:
            total = body.get("total", 0)
        out.extend(batch)
        if len(batch) < ORDER_PAGE_SIZE or len(out) >= total:
            break
        page += 1
        time.sleep(0.05)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--from", dest="dfrom", default=DEFAULT_FROM)
    ap.add_argument("--to", dest="dto", default=None,
                    help="standart: bazadagi eng erta chek sanasi (ya'ni bo'shliq to'ldiriladi)")
    ap.add_argument("--force", action="store_true", help="bajarilgan kunlarni ham qayta yuklash")
    ap.add_argument("--reverse", action="store_true",
                    help="eng yangi kundan orqaga qarab yuklaydi (yangi bazani tez ishga tushirish uchun)")
    args = ap.parse_args()

    token = load_token()
    con = db.rw()

    d0 = date.fromisoformat(args.dfrom)
    if args.dto:
        d1 = date.fromisoformat(args.dto)
    else:
        eng_erta = con.execute("SELECT MIN(d) FROM receipts").fetchone()[0]
        d1 = date.fromisoformat(eng_erta) - timedelta(days=1) if eng_erta else date.today()

    if d0 > d1:
        log(f"Bo'shliq yo'q ({d0} > {d1}) — qiladigan ish yo'q.")
        return

    bajarilgan = set((state_get(con, "backfill_done_days") or "").split(","))
    kunlar = [d0 + timedelta(days=i) for i in range((d1 - d0).days + 1)]
    if args.reverse:
        kunlar = list(reversed(kunlar))
    qoldi = [d for d in kunlar if args.force or d.isoformat() not in bajarilgan]

    log(f"Oraliq: {d0} .. {d1}  ({len(kunlar)} kun, {len(qoldi)} tasi yuklanadi)")
    t0 = time.time()
    jami_chek = jami_qator = 0
    tegilgan_kunlar = set()

    for i, d in enumerate(qoldi, 1):
        ds = d.isoformat()
        try:
            orders = fetch_day(token, d)
        except Exception as exc:
            log(f"  ! {ds}: {exc.__class__.__name__} — o'tkazib yuborildi, keyin qayta urinib ko'ring")
            continue

        receipts, items = [], []
        for o in orders:
            rec, its = parse_order(o)
            if rec is None:
                continue
            receipts.append(rec)
            items.extend(its)
            tegilgan_kunlar.add(rec[2])

        if receipts:
            ids = [(r[0],) for r in receipts]
            with con:
                con.executemany(REC_SQL, receipts)
                con.executemany("DELETE FROM receipt_items WHERE receipt_id = ?", ids)
                con.executemany(ITEM_SQL, items)
        jami_chek += len(receipts)
        jami_qator += len(items)

        bajarilgan.add(ds)
        state_set(con, "backfill_done_days", ",".join(sorted(x for x in bajarilgan if x)))
        con.commit()

        el = time.time() - t0
        qolgan = (len(qoldi) - i) * (el / i) / 60
        log(f"  {i}/{len(qoldi)}  {ds}: {len(receipts):>5} chek, {len(items):>6} qator "
            f"| jami {jami_chek:,} | ~{qolgan:.0f} daq qoldi")

    log(f"Yuklandi: {jami_chek:,} chek, {jami_qator:,} qator, {(time.time()-t0)/60:.1f} daqiqada.")

    if tegilgan_kunlar:
        log(f"Kunlik jamlanmalar qayta hisoblanmoqda ({len(tegilgan_kunlar)} kun)...")
        t1 = time.time()
        with con:
            refresh_rollups(con, tegilgan_kunlar)
        log(f"Jamlanma tayyor ({time.time()-t1:.1f}s).")

    con.execute("ANALYZE")
    con.commit()
    con.close()
    log("Tugadi.")


if __name__ == "__main__":
    main()
