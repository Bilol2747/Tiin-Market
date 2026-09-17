#!/usr/bin/env python3
"""
fetch_clients.py — Xaridor firmalar (B2B mijozlar) ma'lumotini Invan'dan oladi.

Manba: Invan'ning ICHKI API'si (`https://api.7i.uz/api/v1`) — bu bizning
odatdagi `integration/v1`dan BOSHQA API, mijoz reyestri faqat o'sha yerda bor
(batafsil: invan_tahlili.md §7). Token bir xil (INVAN_API_TOKEN).

  POST /api/v1/clients   filters=[{key:client_type, relation:0, value:<Business>}]
                         -> 328 ta firma: nom, STIR, telefon, balans, xarid summasi
  GET  /api/v1/client/{id}  -> shartnoma raqami/sanasi (sekin o'zgaradi, INKREMENTAL:
                            faqat avvalgi faylda yo'q firmalar uchun so'raladi)

⚠️ TEGMASLIK: `POST /api/v1/client` (BIRLIKDA) yangi mijoz YARATADI. Ro'yxat
olish uchun faqat KO'PLIK shakli — `POST /api/v1/clients` — ishlatiladi.

Qarz cheklari Turso `orders` jadvalidan o'qiladi (DEBT to'lov turi + client.id) —
sotuvlar allaqachon har 30 daqiqada sinxronlanadi, qo'shimcha API so'rovi kerak emas.

Natija:
  data_firmalar.json          — sayt (p11 "Firmalar" bo'limi) o'qiydigan fayl
  Turso `clients_business`    — firma reyestri, FAQAT o'zgargan qatorlar yoziladi
                                (yozish kvotasini tejash uchun — turso_sync.py'dagi
                                bir xil mulohaza, qarang: shu fayldagi izoh)

Ishga tushirish:
  python fetch_clients.py              # to'liq
  python fetch_clients.py --no-turso   # faqat JSON (bazaga yozmasdan)
"""
import argparse
import hashlib
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests

from fetch_api_data import load_token, request_with_retry

ROOT = Path(__file__).parent
OUT_JSON = ROOT / "data_firmalar.json"

API_BASE = "https://api.7i.uz/api/v1"
CLIENT_TYPE_BUSINESS = "bbd7fd0e-14b6-474e-81a6-a846d17585e1"
PAGE_LIMIT = 500          # 328 firma bitta sahifaga sig'adi, zaxira bilan
SESSION = requests.Session()


def headers(token):
    # "timezone" sarlavhasi ichki API uchun majburiy (api/invan-order.js'da ham shunday)
    return {"Authorization": f"Bearer {token}", "timezone": "300",
            "Content-Type": "application/json"}


def fetch_firms(token):
    """Barcha client_type=Business mijozlarni qaytaradi (bitta so'rov)."""
    firms, page = [], 1
    while True:
        resp = request_with_retry(
            SESSION.post, f"{API_BASE}/clients", headers=headers(token),
            params={"page": page, "limit": PAGE_LIMIT},
            json={"filters": [{"key": "client_type", "relation": 0,
                               "value": CLIENT_TYPE_BUSINESS}]},
            timeout=120)
        body = resp.json()
        batch = body.get("data") or []
        firms.extend(batch)
        total = body.get("total") or 0
        print(f"  {page}-sahifa: {len(batch)} firma (jami {len(firms)}/{total})")
        if len(batch) < PAGE_LIMIT or len(firms) >= total:
            break
        page += 1
    return firms


def fetch_agreements(token, ids):
    """Shartnoma raqami/sanasini oladi (har firma uchun bitta GET).
    Sekin o'zgaradigan ma'lumot — chaqiruvchi faqat YANGI firmalar uchun so'raydi."""
    out = {}
    for i, cid in enumerate(ids, 1):
        try:
            resp = request_with_retry(SESSION.get, f"{API_BASE}/client/{cid}",
                                      headers=headers(token), timeout=60)
            d = resp.json()
            d = d.get("data", d) if isinstance(d, dict) else {}
            out[cid] = {
                "shartnoma": (d.get("agreement") or "").strip(),
                # DIQQAT: Invan firmalarda `birthday` maydonini shartnoma sanasi
                # sifatida qayta ishlatadi — biz `agreement_date`ni olamiz
                "shartnoma_sana": (d.get("agreement_date") or "")[:10],
            }
        except Exception as exc:
            print(f"  ! {cid[:8]} shartnomasi olinmadi ({exc.__class__.__name__})")
        if i % 25 == 0:
            print(f"  shartnoma: {i}/{len(ids)}")
    return out


DEBT_SQL = """
SELECT json_extract(data,'$.client.id')                 AS cid,
       json_extract(data,'$.external_id')               AS chek,
       substr(create_time,1,10)                         AS sana,
       json_extract(data,'$.total_price')               AS summa,
       json_array_length(json_extract(data,'$.items'))  AS tovar,
       json_extract(data,'$.created_by.first_name')     AS kassir
FROM orders
WHERE json_extract(data,'$.pays[0].payment_type.name') = 'DEBT'
  AND json_extract(data,'$.client.id') IS NOT NULL
  AND json_extract(data,'$.client.id') != ''
"""


def fetch_debt_receipts():
    """Turso `orders` jadvalidan qarzga sotilgan cheklarni o'qiydi.
    Qarz cheklarida `pays` doim BITTA yozuvli (1,316 chekda tekshirilgan —
    Invan qarzni chek darajasida yopmaydi), shu sabab `$.pays[0]` ishonchli."""
    from turso_sync import get_client
    cl = get_client()
    try:
        rs = cl.execute(DEBT_SQL)
        rows = [dict(zip(rs.columns, r)) for r in rs.rows]
    finally:
        cl.close()
    return rows


REFUND_SQL = """
SELECT json_extract(data,'$.client.id')                 AS cid,
       json_extract(data,'$.external_id')               AS chek,
       substr(create_time,1,10)                         AS sana,
       json_extract(data,'$.total_price')               AS summa,
       json_array_length(json_extract(data,'$.items'))  AS tovar,
       json_extract(data,'$.created_by.first_name')     AS kassir
FROM orders
WHERE json_extract(data,'$.type') != 'sale'
  AND json_extract(data,'$.client.id') IS NOT NULL
  AND json_extract(data,'$.client.id') != ''
"""


def fetch_refund_receipts():
    """Turso `orders`dan qaytarilgan tovar (refund) yozuvlarini oladi.
    2026-07-31 aniqlandi: Invan o'zining "Jami savdo"sida bularni avtomatik
    ayiradi (jonli API bilan tekshirildi - BUYUK ISTANBUL MCHJ misolida farq
    bitta tiyingacha mos keldi), lekin bizning oldingi hisobimiz (faqat DEBT
    cheklar) buni hisobga olmagani uchun ba'zi firmalar (masalan NEW RETAIL)
    "qarzdor" bo'lib qolib ketardi, holbuki qaytargan pulini hisobga olsak
    qarzi yo'q edi. `main()` bu yozuvlarni manfiy summa bilan `cheklar`ga
    qo'shadi - buket yig'indisidan o'zi ayiriladi (frontendda o'zgarish
    kerak emas, `_fmCalc` allaqachon `+=` bilan yig'adi)."""
    from turso_sync import get_client
    cl = get_client()
    try:
        rs = cl.execute(REFUND_SQL)
        rows = [dict(zip(rs.columns, r)) for r in rs.rows]
    finally:
        cl.close()
    return rows


def ensure_schema(cl):
    cl.execute(
        "CREATE TABLE IF NOT EXISTS clients_business ("
        "id TEXT PRIMARY KEY, tin TEXT, nom TEXT, tel TEXT, external_id TEXT,"
        "xarid REAL, balans REAL, guruh TEXT, shartnoma TEXT, shartnoma_sana TEXT,"
        "qarzga_ruxsat INTEGER, row_hash TEXT, synced_at TEXT)")
    cl.execute("CREATE INDEX IF NOT EXISTS idx_clients_business_tin "
               "ON clients_business(tin)")


def row_hash(r):
    key = "|".join(str(r.get(k, "")) for k in
                   ("tin", "nom", "tel", "external_id", "xarid", "balans",
                    "guruh", "shartnoma", "shartnoma_sana", "qarzga_ruxsat"))
    return hashlib.sha1(key.encode("utf-8")).hexdigest()[:16]


def sync_turso(rows):
    """FAQAT o'zgargan qatorlarni yozadi. Sababi: 328 firmani har build'da
    qayta yozish oyda ~472 ming yozuvga olib keladi (butun sotuv oqimidan ham
    ko'p) — turso_sync.py'da hujjatlashtirilgan xuddi shu xato. Hash orqali
    solishtirilganda oyda ~450 yozuv qoladi."""
    import libsql_client
    from turso_sync import get_client
    cl = get_client()
    try:
        ensure_schema(cl)
        rs = cl.execute("SELECT id, row_hash FROM clients_business")
        old = {r["id"]: r["row_hash"] for r in rs.rows}
        now = datetime.now(timezone.utc).isoformat(timespec="seconds")
        stmts = []
        for r in rows:
            h = row_hash(r)
            if old.get(r["id"]) == h:
                continue
            stmts.append(libsql_client.Statement(
                "INSERT INTO clients_business (id,tin,nom,tel,external_id,xarid,"
                "balans,guruh,shartnoma,shartnoma_sana,qarzga_ruxsat,row_hash,synced_at) "
                "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET "
                "tin=excluded.tin,nom=excluded.nom,tel=excluded.tel,"
                "external_id=excluded.external_id,xarid=excluded.xarid,"
                "balans=excluded.balans,guruh=excluded.guruh,"
                "shartnoma=excluded.shartnoma,shartnoma_sana=excluded.shartnoma_sana,"
                "qarzga_ruxsat=excluded.qarzga_ruxsat,row_hash=excluded.row_hash,"
                "synced_at=excluded.synced_at",
                [r["id"], r["tin"], r["nom"], r["tel"], r["external_id"],
                 r["xarid"], r["balans"], r["guruh"], r["shartnoma"],
                 r["shartnoma_sana"], 1 if r["qarzga_ruxsat"] else 0, h, now]))
        for i in range(0, len(stmts), 500):
            cl.batch(stmts[i:i + 500])
        print(f"  Turso: {len(stmts)} qator yozildi "
              f"({len(rows) - len(stmts)} o'zgarmagan, yozilmadi)")
    finally:
        cl.close()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-turso", action="store_true",
                    help="Bazaga yozmaslik (faqat data_firmalar.json)")
    ap.add_argument("--all-agreements", action="store_true",
                    help="Shartnomalarni HAMMA firma uchun qayta olish (inkremental emas)")
    args = ap.parse_args()

    token = load_token()

    print("1) Invan'dan xaridor firmalar ro'yxati...")
    try:
        firms = fetch_firms(token)
    except requests.exceptions.HTTPError as exc:
        code = exc.response.status_code if exc.response is not None else 0
        if code in (401, 403):
            # Pipeline har 30 daqiqada ishlaydi — token ichki API'ga ruxsatsiz
            # bo'lsa butun build yiqilmasligi kerak. Eski fayl joyida qoladi.
            print(f"   ! Ichki API ruxsat bermadi (HTTP {code}). "
                  f"INVAN_API_TOKEN `api/v1` uchun yaroqli emas.")
            print("   Bo'lim eski ma'lumot bilan ishlashda davom etadi.")
            return 0
        raise
    if not firms:
        print("   ! Firma topilmadi — eski fayl saqlanadi.")
        return 0

    # ── shartnomalar: inkremental ──
    prev = {}
    if OUT_JSON.exists():
        try:
            prev = {f["id"]: f for f in
                    json.loads(OUT_JSON.read_text(encoding="utf-8")).get("firmalar", [])}
        except Exception:
            prev = {}
    need = [f["id"] for f in firms
            if args.all_agreements or f["id"] not in prev
            or not prev[f["id"]].get("shartnoma")]
    print(f"2) Shartnoma ma'lumoti: {len(need)} firma uchun so'raladi "
          f"({len(firms) - len(need)} tasi keshdan)")
    agr = fetch_agreements(token, need) if need else {}

    print("3) Turso'dan qarz cheklari (DEBT)...")
    debt_rows = fetch_debt_receipts()
    print(f"   {len(debt_rows)} qarz cheki")

    print("3b) Turso'dan qaytarilgan tovarlar (refund)...")
    refund_rows = fetch_refund_receipts()
    print(f"   {len(refund_rows)} qaytarish")

    ids = {f["id"] for f in firms}
    by_firm = {}
    n_refund_ours = 0
    for r in debt_rows:
        if r["cid"] in ids:
            by_firm.setdefault(r["cid"], []).append({**r, "_sign": 1})
    for r in refund_rows:
        if r["cid"] in ids:
            by_firm.setdefault(r["cid"], []).append({**r, "_sign": -1})
            n_refund_ours += 1
    print(f"   {n_refund_ours} qaytarish bizning firmalarga tegishli (qarzdan ayiriladi)")

    out_rows, flat = [], []
    for f in firms:
        cid = f["id"]
        a = agr.get(cid) or {
            "shartnoma": (prev.get(cid) or {}).get("shartnoma", ""),
            "shartnoma_sana": (prev.get(cid) or {}).get("shartnoma_sana", ""),
        }
        cheks = sorted(by_firm.get(cid, []), key=lambda x: x["sana"], reverse=True)
        rec = {
            "id": cid,
            "nom": f"{f.get('first_name') or ''} {f.get('last_name') or ''}".strip(),
            "tin": (f.get("tin") or "").strip(),
            "tel": (f.get("phone_number") or "").strip(),
            "external_id": (f.get("external_id") or "").strip(),
            "xarid": round(float(f.get("total_purchase_amount") or 0)),
            "balans": round(float(f.get("balance") or 0)),
            "guruh": (f.get("group_name") or "").strip(),
            "qarzga_ruxsat": bool(f.get("is_available_for_debt")),
            "shartnoma": a["shartnoma"],
            "shartnoma_sana": a["shartnoma_sana"],
        }
        flat.append(rec)
        # faylga faqat qarzi yoki musbat balansi bor firmalar (bo'lim shularni ko'rsatadi)
        if cheks or rec["balans"] > 0:
            out_rows.append({**rec, "cheklar": [
                {"d": c["sana"], "c": c["chek"] or "",
                 "s": c["_sign"] * round(float(c["summa"] or 0)),
                 "n": int(c["tovar"] or 0), "k": c["kassir"] or ""}
                for c in cheks]})

    sanalar = [c["d"] for f in out_rows for c in f["cheklar"]]
    payload = {
        "gen": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "bugun": datetime.now(timezone.utc).date().isoformat(),
        "firma_soni": len(firms),
        "chek_soni": len(sanalar),
        "sana_boshi": min(sanalar) if sanalar else "",
        "sana_oxiri": max(sanalar) if sanalar else "",
        "firmalar": out_rows,
    }
    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False,
                                   separators=(",", ":")), encoding="utf-8")
    kb = OUT_JSON.stat().st_size / 1024
    print(f"4) {OUT_JSON.name}: {len(out_rows)} firma, {len(sanalar)} chek ({kb:,.0f} KB)")

    if not args.no_turso:
        print("5) Turso `clients_business` sinxronlanmoqda...")
        try:
            sync_turso(flat)
        except SystemExit:
            print("   ! Turso ma'lumotlari yo'q — o'tkazib yuborildi.")
        except Exception as exc:
            print(f"   ! Turso yozishda xato ({exc.__class__.__name__}: {exc}) — "
                  f"JSON fayl tayyor, build davom etadi.")

    print("Tugadi.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
