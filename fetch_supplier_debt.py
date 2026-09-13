#!/usr/bin/env python3
"""
fetch_supplier_debt.py — Biz qarzdor bo'lgan ta'minotchilar ro'yxati.

Manba: Invan'ning ICHKI API'si (`https://api.7i.uz/api/v1`) — [fetch_clients.py]
bilan bir xil oila (`api/v1/clients` mijozlar uchun, `api/v1/suppliers` esa
ta'minotchilar uchun). Token bir xil (INVAN_API_TOKEN).

  POST /api/v1/suppliers   -> 1600+ ta ta'minotchi: nom, STIR, telefon,
                               shartnoma raqami(lari), **balance** (joriy holat)

  Belgi konvensiyasi (haqiqiy raqamlar bilan tasdiqlangan, 2026-08-11):
  balance<0 -> BIZ shu ta'minotchiga qarzdormiz
  balance>0 -> ular bizga qarzdor / biz ortiqcha to'lagan

⚠️ DIQQAT — Invan'ning bu endpointi PAGINATSIYADA TAKRORLANGAN yozuvlar
qaytaradi (2026-08-11 aniqlandi: 1643 qatordan atigi ~1451 tasi unikal `id`,
~192 ta yozuv ikki marta chiqadi). Shuning uchun natija albatta `id` bo'yicha
DEDUP qilinadi — aks holda umumiy qarz summasi shishib ketadi.

Tranzaksiya/invoys darajasidagi ma'lumot (aging — "necha kunlik qarz") uchun
API endpoint TOPILMADI (bir nechta ehtimoliy yo'l sinaldi, hammasi 404) —
Invan haqiqiy to'lov holatini bermaydi. Shuning uchun 0-15/16-30/31-45/45+
guruhlash TAXMINIY hisoblanadi (2026-08-11, Bilol so'rovi bilan):
`data_kirim.json`dagi shu ta'minotchining haqiqiy qabul qilingan
(`qty>0`) kirim qatorlari `supplier_id` bo'yicha topiladi (bu ID
`api/v1/suppliers`dagi `id` bilan BIR XIL namespace — tekshirilgan), eng
so'nggi sanadan boshlab orqaga qarab, umumiy qarz summasiga yetguncha
yig'iladi — ya'ni "eski kirimlar to'langan, qarz eng so'nggi xaridlarga
tegishli" degan taxmin bilan. Bu HAQIQIY emas (qaysi aniq kirim to'langani
noma'lum), shuning uchun frontendda "taxminiy" deb alohida belgilanadi.

Natija:
  data_ta_qarz.json         — sayt (p11 "Firmalar" > "Ta'minotchilar" tab) o'qiydigan fayl
  Turso `suppliers_debt`    — ta'minotchi qarz reyestri, FAQAT o'zgargan qatorlar
                               yoziladi (`clients_business` bilan bir xil mulohaza)

Ishga tushirish:
  python fetch_supplier_debt.py              # to'liq
  python fetch_supplier_debt.py --no-turso   # faqat JSON (bazaga yozmasdan)
"""
import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests

from fetch_api_data import load_token, request_with_retry

ROOT = Path(__file__).parent
OUT_JSON = ROOT / "data_ta_qarz.json"

API_BASE = "https://api.7i.uz/api/v1"
PAGE_LIMIT = 500
SESSION = requests.Session()


def headers(token):
    # "timezone" sarlavhasi ichki API uchun majburiy (fetch_clients.py'da ham shunday)
    return {"Authorization": f"Bearer {token}", "timezone": "300",
            "Content-Type": "application/json"}


def fetch_suppliers(token):
    """Barcha ta'minotchilarni qaytaradi, `id` bo'yicha DEDUP qilingan holda
    (pagination'da takrorlangan yozuvlar bor — yuqoridagi izohga qarang)."""
    by_id, page = {}, 1
    while True:
        resp = request_with_retry(
            SESSION.post, f"{API_BASE}/suppliers", headers=headers(token),
            params={"page": page, "limit": PAGE_LIMIT}, json={"filters": []},
            timeout=120)
        body = resp.json()
        batch = body.get("data") or []
        for s in batch:
            by_id[s["id"]] = s
        total = body.get("total") or 0
        print(f"  {page}-sahifa: {len(batch)} ta'minotchi (unikal jami {len(by_id)}/{total})")
        if len(batch) < PAGE_LIMIT:
            break
        page += 1
    return list(by_id.values())


def load_kirim_by_supplier():
    """`data_kirim.json`dagi barcha SKU'lar arrivals'ini `supplier_id` bo'yicha
    guruhlab, sana bo'yicha KAMAYISH tartibida qaytaradi. Faqat haqiqatan
    qabul qilingan (`qty>0`) qatorlar — "Open"/hali kelmagan buyurtma hali
    to'lov majburiyati emas."""
    path = ROOT / "data_kirim.json"
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    by_sup = {}
    for sku_row in (data.get("skus") or {}).values():
        for a in sku_row.get("arrivals") or []:
            qty = a.get("qty") or 0
            if qty <= 0:
                continue
            sid = a.get("supplier_id")
            d = (a.get("date") or "")[:10]
            if not sid or not d:
                continue
            amount = qty * (a.get("cost") or 0)
            by_sup.setdefault(sid, []).append((d, amount))
    for sid in by_sup:
        by_sup[sid].sort(key=lambda x: x[0], reverse=True)
    return by_sup


def estimate_aging(target, arrivals_desc, today):
    """TAXMINIY guruhlash — modul docstringiga qarang. `target`: shu
    ta'minotchiga qarzimiz (musbat son). `arrivals_desc`: [(sana, summa), ...]
    eng so'nggidan boshlab."""
    out = {"b15": 0, "b30": 0, "b45": 0, "b60": 0}
    remaining = target
    today_d = datetime.fromisoformat(today).date()
    for d, amount in arrivals_desc:
        if remaining <= 0:
            break
        try:
            age = (today_d - datetime.fromisoformat(d).date()).days
        except ValueError:
            continue
        bucket = "b15" if age <= 15 else "b30" if age <= 30 else "b45" if age <= 45 else "b60"
        take = min(amount, remaining)
        out[bucket] += take
        remaining -= take
    if remaining > 0:
        # Kirim tarixi qarzdan kam (masalan tarix boshlanishidan oldingi
        # eski qarz) — qolgan qism eng eski guruhga, e'tiborsiz qolmasin uchun.
        out["b60"] += remaining
    return {k: round(v) for k, v in out.items()}


def ensure_schema(cl):
    cl.execute(
        "CREATE TABLE IF NOT EXISTS suppliers_debt ("
        "id TEXT PRIMARY KEY, tin TEXT, nom TEXT, tel TEXT, external_id TEXT,"
        "shartnoma TEXT, balans REAL, row_hash TEXT, synced_at TEXT)")
    cl.execute("CREATE INDEX IF NOT EXISTS idx_suppliers_debt_tin "
               "ON suppliers_debt(tin)")


def row_hash(r):
    key = "|".join(str(r.get(k, "")) for k in
                   ("tin", "nom", "tel", "external_id", "shartnoma", "balans"))
    return hashlib.sha1(key.encode("utf-8")).hexdigest()[:16]


def sync_turso(rows):
    """FAQAT o'zgargan qatorlarni yozadi (`fetch_clients.py`'dagi
    `sync_turso()` bilan bir xil mulohaza — yozish kvotasini tejash)."""
    import libsql_client
    from turso_sync import get_client
    cl = get_client()
    try:
        ensure_schema(cl)
        rs = cl.execute("SELECT id, row_hash FROM suppliers_debt")
        old = {r["id"]: r["row_hash"] for r in rs.rows}
        now = datetime.now(timezone.utc).isoformat(timespec="seconds")
        stmts = []
        for r in rows:
            h = row_hash(r)
            if old.get(r["id"]) == h:
                continue
            stmts.append(libsql_client.Statement(
                "INSERT INTO suppliers_debt (id,tin,nom,tel,external_id,"
                "shartnoma,balans,row_hash,synced_at) VALUES (?,?,?,?,?,?,?,?,?) "
                "ON CONFLICT(id) DO UPDATE SET "
                "tin=excluded.tin,nom=excluded.nom,tel=excluded.tel,"
                "external_id=excluded.external_id,shartnoma=excluded.shartnoma,"
                "balans=excluded.balans,row_hash=excluded.row_hash,"
                "synced_at=excluded.synced_at",
                [r["id"], r["tin"], r["nom"], r["tel"], r["external_id"],
                 r["shartnoma"], r["balans"], h, now]))
        for i in range(0, len(stmts), 500):
            cl.batch(stmts[i:i + 500])
        print(f"  Turso: {len(stmts)} qator yozildi "
              f"({len(rows) - len(stmts)} o'zgarmagan, yozilmadi)")
    finally:
        cl.close()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-turso", action="store_true",
                    help="Bazaga yozmaslik (faqat data_ta_qarz.json)")
    args = ap.parse_args()

    token = load_token()

    print("1) Invan'dan ta'minotchilar ro'yxati...")
    try:
        suppliers = fetch_suppliers(token)
    except requests.exceptions.HTTPError as exc:
        code = exc.response.status_code if exc.response is not None else 0
        if code in (401, 403):
            # Pipeline muntazam ishlaydi — token ichki API'ga ruxsatsiz bo'lsa
            # butun build yiqilmasligi kerak. Eski fayl joyida qoladi.
            print(f"   ! Ichki API ruxsat bermadi (HTTP {code}). "
                  f"INVAN_API_TOKEN `api/v1` uchun yaroqli emas.")
            print("   Bo'lim eski ma'lumot bilan ishlashda davom etadi.")
            return 0
        raise
    if not suppliers:
        print("   ! Ta'minotchi topilmadi — eski fayl saqlanadi.")
        return 0

    flat = []
    for s in suppliers:
        tel = s.get("phone_number") or []
        agr = s.get("agreement_number") or []
        flat.append({
            "id": s["id"],
            "nom": (s.get("supplier_company_name") or s.get("name") or "").strip(),
            "tin": (s.get("inn") or "").strip(),
            "tel": (tel[0] if tel else "").strip(),
            "external_id": (s.get("external_id") or "").strip(),
            "shartnoma": ", ".join(a for a in agr if a).strip(),
            "balans": round(float(s.get("balance") or 0)),
        })

    # faylga faqat qarz yoki musbat balansi bor ta'minotchilar (bo'lim shularni ko'rsatadi)
    out_rows = [r for r in flat if r["balans"] != 0]
    out_rows.sort(key=lambda r: r["balans"])

    n_debt = sum(1 for r in out_rows if r["balans"] < 0)

    print("2) Kirim tarixidan taxminiy aging hisoblanmoqda...")
    bugun = datetime.now(timezone.utc).date().isoformat()
    kirim_by_sup = load_kirim_by_supplier()
    n_aged = 0
    for r in out_rows:
        if r["balans"] >= 0:
            continue
        arr = kirim_by_sup.get(r["id"]) or []
        r.update(estimate_aging(-r["balans"], arr, bugun))
        if arr:
            n_aged += 1
    print(f"   {n_aged}/{n_debt} qarzdor ta'minotchi uchun kirim tarixi topildi "
          f"({n_debt - n_aged} tasi to'liq b60'ga tushadi — kirim tarixi yo'q)")

    payload = {
        "gen": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "bugun": bugun,
        "ta_soni": len(suppliers),
        "qarzdor_soni": n_debt,
        "aging_taxminiy": True,
        "taminotchilar": out_rows,
    }
    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False,
                                   separators=(",", ":")), encoding="utf-8")
    kb = OUT_JSON.stat().st_size / 1024
    jami_qarz = sum(r["balans"] for r in out_rows if r["balans"] < 0)
    print(f"3) {OUT_JSON.name}: {len(out_rows)} ta'minotchi ({n_debt} qarzdor, "
          f"jami qarz {jami_qarz:,.0f} so'm), {kb:,.0f} KB")

    if not args.no_turso:
        print("4) Turso `suppliers_debt` sinxronlanmoqda...")
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
