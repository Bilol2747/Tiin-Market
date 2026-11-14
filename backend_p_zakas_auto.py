"""
Avtomatik Zakas (kirim-oqim asosida qayta to'ldirish) — ZAKAS_AVTOMATLASHTIRISH.md'da
2026-09-22/23'da qadam-baqadam kelishilgan formulaning kod ko'rinishi.

G'OYA: Invan qoldig'iga (ishonchsiz "arvoh qoldiq", calcStock ham shunga bog'liq)
umuman tayanmaymiz. Har SKU uchun "qolgan_miqdor" — oxirgi bilingan kirimdan (lkQty,
backend_p_calc_stock.py) beri necha dona sotilgani (lkSold). Tezlik uchun mavjud
`avg30sa` (build_prev_avg.py, stok-asosli, ulgurji ajratilgan) qayta ishlatiladi.

MUHIM (2026-09-23): bu fayl saytning "Oxirgi kirim" tugmasi (sales_runtime.js,
`_zkaCompute()`/`_zkaBuildSupplierResetDays()`) bilan AYNAN bir xil formula -
ATAYLAB HOLATSIZ (state yo'q): lkQty/lkSold har buildда (backend_p_calc_stock.py)
qaytadan "toza" hisoblanadi, shuning uchun bu skript ham har chaqiriqda to'g'ridan-
to'g'ri o'shalardan boshlaydi (JS'dagi "bootstrap-only" bilan bir xil). Bu ikkalasi
(sayt va avtomatlashtirish) DOIM bir xil raqam berishini kafolatlaydi - agar alohida
holat-fayl bilan "avans" qilinsa, ikkalasi orasida chetlanish paydo bo'lishi mumkin
edi (aynan shu sabab avvalgi state-based versiya bekor qilindi, u yerda 3 marta
jiddiy bug topilgan edi - qarang: eski git tarixi/xotira).

Qamrov: FAQAT "Muntazam zakas" tovarlari (avg30sa bor tovarlar). "Chuqur zakas"ga
(faqat pav bor, avg30sa yo'q) TEGILMAYDI.

Bu modul HALI Invan'ga hech narsa YUBORMAYDI — faqat qaysi ta'minotchidan qancha
buyurtma kerakligini HISOBLAYDI va qaytaradi (keyingi qadam: buni api/invan-order.js
bilan bog'lash + faqat "avtomatik zakas" ro'yxatiga (Turso zakas_auto_suppliers
jadvali) qo'shilgan ta'minotchilar bilan cheklash).
"""
import json
import math
from datetime import date, datetime, timedelta
from pathlib import Path

from backend_shared_utils import rq

ROOT = Path(__file__).parent
TASHKENT_OFFSET = timedelta(hours=5)

# ─── Sozlanadigan chegaralar (ZAKAS_AVTOMATLASHTIRISH.md'da kelishilgan) ───────
MUST_ORDER_DAYS = 7          # shundan kam qolsa - ta'minotchi albatta tekshiriladi
CAN_ORDER_DAYS = 14          # shundan kam qolgan boshqa tovarlar ham shu buyurtmaga qo'shiladi
REFERENCE_MIN_DAYS = 15      # reference shu qadar kam kunga yetsa - buyurtma HAJMI qayta hisoblanadi
REFERENCE_MAX_DAYS = 60      # reference shu qadar ko'p kunga yetsa - qayta hisoblanadi
RESET_SHORT_DAYS = 25        # ta'minotchi tez-tez (mediana <27.5 kun) kelsa - shu maqsad
RESET_LONG_DAYS = 30         # aks holda shu maqsad
RESET_SWITCH_DAYS = 27.5     # ikkalasi orasidagi chegara (ikkalasining o'rtasi)
# Zakas oxirgi kirim miqdorining MAX_ORDER_MULT baravaridan ORTIQ bo'lmasin (istisnosiz) -
# sales_runtime.js ZKA_MAX_ORDER_MULT bilan bir xil (2026-09-24, Bilol: 6 dona kelgan
# tovarga 36 dona zakas berilardi).
MAX_ORDER_MULT = 3
# "Oxirgi kirim yetadimi" tekshiruvida kirimdan beri sotuv tezligi ishlatilishi uchun kamida
# shuncha kun o'tgan bo'lishi kerak (sales_runtime.js ZKA_LAST_KIRIM_MIN_DAYS bilan bir xil).
LAST_KIRIM_MIN_DAYS = 5
# ...va ko'pi bilan shuncha kun (eski kirim - ma'lumot ishonchsiz) hamda kirim hali tugamagan
# (lkSold < lkQty) bo'lishi kerak: kirimdan ko'p sotilgan bo'lsa, oralig'ida yozilmagan kirim bor.
LAST_KIRIM_MAX_DAYS = 30


def _local_date(iso_str):
    try:
        utc_dt = datetime.fromisoformat(str(iso_str).replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None
    return (utc_dt.replace(tzinfo=None) + TASHKENT_OFFSET).date()


def _load_scope(root):
    """data_inv_new.json'dan: avg30sa (tezlik) bor tovarlar = Muntazam qamrov.
    ESLATMA: bu faylning TASHQI kaliti - tovar NOMI (normallashtirilgan), "name"
    degan alohida maydon yo'q. lkQty/lkSold/lkDate ham shu yerda, mavjud bo'lsa.
    Qaytaradi: {sku: {"velocity","name","su","lkQty","lkSold","lkDate"}}"""
    inv_path = root / "data_inv_new.json"
    inv = json.loads(inv_path.read_text(encoding="utf-8"))
    kg_skus = set()
    p2_path = root / "data_mahsulotlar.json"
    if p2_path.exists():
        for prod in json.loads(p2_path.read_text(encoding="utf-8")):
            if prod.get("kg") and prod.get("sku"):
                kg_skus.add(str(prod["sku"]).strip())
    out = {}
    for name, iv in inv.items():
        if not isinstance(iv, dict):
            continue
        sku = str(iv.get("sku") or "").strip()
        avg = iv.get("avg30sa")
        if not sku or not avg:
            continue  # avg30sa yo'q -> Chuqur zakas doirasida, bu yerga tegishli emas
        out[sku] = {
            "velocity": float(avg),
            "name": name,
            "su": iv.get("su", ""),
            "lkQty": iv.get("lkQty"),
            "lkSold": iv.get("lkSold"),
            "lkDate": iv.get("lkDate"),
            "zabc": iv.get("zabc"),
            "rcost": iv.get("rcost"),
            "ck": iv.get("ck"),
            "kg": sku in kg_skus,
        }
    return out


def _invan_token(root):
    """INVAN_API_TOKEN muhit o'zgaruvchisi, lokal sinov uchun api_token.txt zaxira
    sifatida - backend/pipeline_adapter.py `invan_token()` bilan bir xil naqsh."""
    import os
    t = os.environ.get("INVAN_API_TOKEN", "").strip()
    if t:
        return t
    p = root / "api_token.txt"
    if p.exists():
        return p.read_text(encoding="utf-8").strip()
    return ""


def _load_calc_baseline(root):
    """data_calc_baseline.json'dan bazaviy vaqtni o'qiydi (build_all_from_api.py
    yozadi, orderlar so'ralishidan OLDIN qayd etilgan payt). Topilmasa - jonli
    tuzatish o'tkazib yuboriladi (lkSold bazaviy holicha qoladi)."""
    p = root / "data_calc_baseline.json"
    if not p.exists():
        return None
    try:
        return (json.loads(p.read_text(encoding="utf-8")) or {}).get("at") or None
    except Exception:
        return None


def _sold_since_from_invan(since_iso, token):
    """`since_iso`dan HOZIRGACHA Invan'dan SOF sotilgan miqdorni {sku: qty}
    qaytaradi (refund manfiy) - backend/pipeline_adapter.py
    `sold_since_from_invan()` bilan AYNAN bir xil (saytning 15-daqiqalik jonli
    yangilanishi shu funksiyaga tayanadi)."""
    import requests
    from datetime import timezone
    from concurrent.futures import ThreadPoolExecutor

    if not token or not since_iso:
        return {}
    base_url = "https://api.7i.uz/integration/v1"
    headers = {"Authorization": f"Bearer {token}"}
    limit = 500
    now_iso = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    sess = requests.Session()
    seen_ids = set()
    qty_by_sku = {}

    def apply_order(o):
        oid = str(o.get("id") or "")
        if not oid or oid in seen_ids:
            return
        seen_ids.add(oid)
        is_refund = o.get("type") != "sale"
        sign = -1 if is_refund else 1
        for it in (o.get("items") or []):
            qty = float(it.get("value") or 0)
            if qty <= 0:
                continue
            sku = str(it.get("sku") or "").strip()
            if not sku:
                continue
            qty_by_sku[sku] = qty_by_sku.get(sku, 0.0) + sign * qty

    def fetch_page(page):
        resp = sess.get(
            f"{base_url}/order", headers=headers, timeout=55,
            params={"page": page, "limit": limit, "start_date": since_iso, "end_date": now_iso})
        resp.raise_for_status()
        body = resp.json()
        return body.get("data", []), int(body.get("total") or 0)

    try:
        first_batch, total = fetch_page(1)
    except Exception:
        return {}  # tarmoq xatosi - jonli tuzatish o'tkazib yuboriladi, bazaviy qiymat qolaveradi
    for o in first_batch:
        apply_order(o)

    n_pages = max(1, (total + limit - 1) // limit)
    if n_pages > 1:
        with ThreadPoolExecutor(max_workers=min(10, n_pages - 1)) as ex:
            for batch, _ in ex.map(fetch_page, range(2, n_pages + 1)):
                for o in batch:
                    apply_order(o)

    return qty_by_sku


def _apply_live_lk_delta(scope, kirim_by_sku, root):
    """LKSOLD JONLI YANGILANISHI (2026-09-23, Bilol so'rovi: "sayt 15 daqiqada
    yangilanadi, biz ham shunday ishlashimiz kk") - backend/app.py
    `_apply_live_delta()` bilan AYNAN bir xil mantiq, lekin Vercel'ga UMUMAN
    bog'liq emas (to'g'ridan-to'g'ri Invan API'dan, Vercel bloklanган kunlarda
    ham ishlaydi): lkQty (voqea - qachon/qancha kirim kelgani) o'zgarmaydi,
    lkSold esa bazaviy hisoblangan vaqtdan (`data_calc_baseline.json`) buyon
    haqiqiy Invan sotuvi (+) va yangi kirim (-) bilan tuzatiladi. Joyida
    o'zgartiradi (mutates `scope`)."""
    baseline_at = _load_calc_baseline(root)
    if not baseline_at:
        return 0
    token = _invan_token(root)
    if not token:
        return 0
    sold_since = _sold_since_from_invan(baseline_at, token)
    if not sold_since:
        return 0
    received_since = {}
    for sku, arrivals in kirim_by_sku.items():
        for a in arrivals:
            d = a["date"].isoformat()
            if d <= baseline_at[:10]:
                continue
            received_since[sku] = received_since.get(sku, 0.0) + a["qty"]

    n_adjusted = 0
    for sku, meta in scope.items():
        if meta.get("lkQty") is None or meta.get("lkSold") is None:
            continue
        delta_sold = sold_since.get(sku, 0.0)
        delta_recv = received_since.get(sku, 0.0)
        if delta_sold == 0 and delta_recv == 0:
            continue
        meta["lkSold"] = max(0.0, round(float(meta["lkSold"]) + delta_sold - delta_recv, 3))
        n_adjusted += 1
    return n_adjusted


def _load_kirim_by_sku(root):
    """data_kirim.json'dan har SKU uchun arrivals ro'yxati (sana bo'yicha o'sish
    tartibida) - ochiq-buyurtma tekshiruvi va ta'minotchi reset-maqsadini
    (RESET_SHORT/LONG) aniqlash uchun."""
    kirim_path = root / "data_kirim.json"
    kirim = json.loads(kirim_path.read_text(encoding="utf-8"))
    out = {}
    for sku, entry in kirim.get("skus", {}).items():
        arrivals = []
        for a in entry.get("arrivals", []):
            d = _local_date(a.get("date"))
            if d is None:
                continue
            arrivals.append({
                "date": d,
                "qty": float(a.get("qty") or 0),
                "status": a.get("status", ""),
                "supplier": a.get("supplier") or "",
                "order_id": a.get("order_id") or "",
            })
        arrivals.sort(key=lambda a: a["date"])
        out[sku] = arrivals
    return out


def _receipt_orders(kirim_by_sku):
    """Qabul BOSHLANGAN buyurtmalar (kamida bitta qatori qty>0) - 2026-09-24,
    Bilol qoidasi: buyurtmadan bir qism tovar kelgan bo'lsa, kelmaganlari
    QAYTA KELMAYDI, ya'ni "Open" hisoblanmaydi (keyingi zakasga qaytib tushadi)."""
    return {a["order_id"] for arrs in kirim_by_sku.values() for a in arrs
            if a.get("order_id") and a["qty"] > 0}


def _has_open_arrival(arrivals, receipt_orders=frozenset()):
    """Hali qabul qilinmagan (Open/New) buyurtma bormi - bo'lsa qayta buyurtma
    berilmaydi. FAQAT ENG SO'NGGI (sana bo'yicha) buyurtma(lar) holatiga qaraladi -
    butun tarixga EMAS (2026-09-22 bug). Statuslar sales_runtime.js krPendingQty()
    bilan bir xil: faqat Open/New ("Partially received" ochiq EMAS), va qabul
    boshlangan buyurtma (receipt_orders) umuman ochiq hisoblanmaydi."""
    if not arrivals:
        return False
    last_date = max(a["date"] for a in arrivals)
    for a in arrivals:
        if a["date"] == last_date and a["status"] in ("Open", "New") \
                and a.get("order_id") not in receipt_orders:
            return True
    return False


def _build_supplier_reset_days(kirim_by_sku):
    """TA'MINOTCHIGA MOSLASHUVCHI RESET-MAQSAD (2026-09-23) - sales_runtime.js
    `_zkaBuildSupplierResetDays()` bilan AYNAN bir xil: shu ta'minotchining BARCHA
    tovarlari bo'yicha haqiqiy "Received" kirim sanalaridan mediana oraliq topiladi,
    25 yoki 30 kunlik maqsadga aylantiriladi. Natijada bitta ta'minotchining barcha
    tovarlari bir xil maqsadga moslashadi (bir vaqtda "tugaydi", ta'minotchi
    kelganda hammasi birga to'ldiriladi) - aks holda har tovar alohida oraliqqa
    moslansa, bitta ta'minotchining tovarlari bir-biridan uzoqlashib ketardi."""
    by_sup_dates = {}
    for arrivals in kirim_by_sku.values():
        for a in arrivals:
            if a["status"] != "Received" or not a["supplier"]:
                continue
            by_sup_dates.setdefault(a["supplier"], set()).add(a["date"])
    out = {}
    for sup, dates in by_sup_dates.items():
        dates = sorted(dates)
        if len(dates) < 2:
            out[sup] = RESET_LONG_DAYS
            continue
        gaps = [(dates[i] - dates[i - 1]).days for i in range(1, len(dates))]
        gaps = [g for g in gaps if g > 0]
        if not gaps:
            out[sup] = RESET_LONG_DAYS
            continue
        gaps.sort()
        mid = len(gaps) // 2
        median = gaps[mid] if len(gaps) % 2 else (gaps[mid - 1] + gaps[mid]) / 2
        out[sup] = RESET_SHORT_DAYS if median < RESET_SWITCH_DAYS else RESET_LONG_DAYS
    return out


def _box_size(arrivals):
    """Karobka/blok o'lchami - sales_runtime.js `_zkaBoxSize()` bilan AYNAN bir xil:
    so'nggi 6 marta haqiqiy Received kirimning eng katta umumiy bo'luvchisi (GCD).
    BUTUN tarix emas (eski/bir martalik qiymatlar signalni buzadi - real misolda
    topilgan, brынза сыр fitaki: butun tarix GCD=2 foydasiz, so'nggi 6 tasi GCD=12
    to'g'ri). 2+ xil son topilmasa - 0 (yaxlitlanmaydi)."""
    recent = [a for a in arrivals if a["status"] == "Received" and a["qty"] > 0]
    recent = sorted(recent, key=lambda a: a["date"], reverse=True)[:6]
    qtys = sorted(set(round(a["qty"]) for a in recent))
    if len(qtys) < 2:
        return 0
    from math import gcd
    from functools import reduce
    g = reduce(gcd, qtys)
    return g if g > 1 else 0


def _compute_sku(meta, velocity, reset_days, arrivals):
    """Bitta SKU uchun "Oxirgi kirim" formulasi - sales_runtime.js `_zkaCompute()`
    bilan AYNAN bir xil (bootstrap-only, holatsiz):
      1) reference (oxirgi kirim miqdori) 15-60 kunlik "sanity" filtrdan o'tadimi -
         o'tmasa, ta'minotchining reset-maqsadiga (25/30 kun) qayta hisoblanadi.
      2) qolgan_miqdor HAR DOIM xom lkQty-lkSold'dan olinadi (2026-09-23 tuzatishi -
         avval "katta" holatida bu reference'ga tenglashtirilib, "to'liq bor" deb
         noto'g'ri faraz qilinardi - haqiqiy misolda (bri сыр, SKU 2877005) 56
         kelib 56 sotilgan, ya'ni 0 qolgan bo'lsa ham "to'liq zaxira bor" deb
         ZAKAS=0 berardi, aslida zudlik bilan zakas kerak edi).
      3) karobka/blok o'lchamiga ENG YAQIN karraliga yaxlitlanadi (pastga ham,
         yuqoriga ham) - shoshilinch (qolgan kun < MUST_ORDER_DAYS) bo'lsa va
         pastga yaxlitlash 0gacha tushirib yuborsa, o'rniga 1 karobkaga yuqoriga
         yaxlitlanadi (buyurtamasiz qolib ketmasin).
    Qaytaradi: (buyurtma, qolgan_kunlar) yoki (None, None) agar lk ko'rsatkichi yo'q/
    velocity<=0 bo'lsa."""
    lk_qty = meta.get("lkQty")
    lk_date = meta.get("lkDate")
    if lk_qty is None or not lk_date or velocity <= 0:
        return None, None
    lk_qty = float(lk_qty)
    lk_sold = float(meta.get("lkSold") or 0)

    # "Oxirgi kirim necha kunga yetadi" tekshiruvi OXIRGI KIRIMDAN BERI HAQIQIY sotuv
    # tezligi bilan (lkSold / o'tgan kun) - 30 kunlik o'rtacha emas (2026-09-24, Bilol:
    # 60 dona kirim 12 kunda 37 sotilgan = 3.1/kun -> ~19 kunga yetadi, 30 kunlik 4.46 bilan
    # 13.5 kun chiqib "kichik" deb 111 zakas berilardi). Kirimga LAST_KIRIM_MIN_DAYS dan kam
    # kun bo'lsa yoki hech narsa sotilmagan bo'lsa - tezlik ishonchsiz, 30 kunlik qoladi.
    # Buyurtma HAJMI (reset_days * velocity) va qolgan-kunlar esa 30 kunlik tezlikda qoladi.
    reference = lk_qty
    v_check = velocity
    lk_d = _local_date(lk_date)
    days_since = (date.today() - lk_d).days if lk_d else 0
    if LAST_KIRIM_MIN_DAYS <= days_since <= LAST_KIRIM_MAX_DAYS and 0 < lk_sold < lk_qty:
        v_check = lk_sold / days_since
    days = reference / v_check
    if not (REFERENCE_MIN_DAYS <= days <= REFERENCE_MAX_DAYS):
        reference = reset_days * velocity

    qolgan = lk_qty - lk_sold
    # "Qolgan kun" ham SHU tezlikda (kirimdan beri, yoki ishonchsiz bo'lsa 30 kunlik) -
    # yuqoridagi "kirim yetadimi" bilan zid bo'lmasligi uchun (2026-09-24, Bilol).
    qolgan_kunlar = qolgan / v_check

    if qolgan_kunlar < MUST_ORDER_DAYS:
        buyurtma = reference
    elif qolgan_kunlar < CAN_ORDER_DAYS:
        buyurtma = reference - qolgan
    else:
        return 0.0, round(qolgan_kunlar, 1)

    buyurtma = max(0.0, buyurtma)
    jami = qolgan + buyurtma
    if (jami / velocity) > REFERENCE_MAX_DAYS:
        buyurtma = max(0.0, reset_days * velocity - qolgan)
    # sales_runtime.js _zkaCompute() bilan bir xil: kg emas -> butunga YUQORIGA
    # (4.3 emas 5), kg -> 2 xona (2026-09-24: Invan'ga 4.3 ketib, saytda 5 ko'ringan)
    if lk_qty > 0:
        cap = MAX_ORDER_MULT * lk_qty if meta.get("kg") else math.floor(MAX_ORDER_MULT * lk_qty)
        buyurtma = min(buyurtma, cap)
    buyurtma = round(buyurtma, 2) if meta.get("kg") else math.ceil(buyurtma)
    buyurtma = rq(buyurtma)

    if buyurtma > 0:
        box = _box_size(arrivals)
        if box > 1:
            rem = buyurtma % box
            if rem != 0:
                box_add = -rem if rem <= box / 2 else (box - rem)
                if buyurtma + box_add <= 0 and qolgan_kunlar < MUST_ORDER_DAYS:
                    box_add = box - rem
                buyurtma = rq(buyurtma + box_add)
            cap_q = math.floor(MAX_ORDER_MULT * lk_qty) if lk_qty > 0 else 0
            if cap_q > 0 and buyurtma > cap_q:
                fl = (cap_q // box) * box
                buyurtma = rq(fl if fl > 0 else cap_q)

    return buyurtma, round(qolgan_kunlar, 1)


def compute_zakas_auto(root=ROOT, verbose=True):
    """Asosiy kirish nuqtasi. Qaytaradi: {ta'minotchi_nomi: [{sku,name,qty,qolgan_kunlar,...}]}.
    Invan'ga HECH NARSA yubormaydi - faqat hisoblaydi. Holatsiz - har chaqiriqda
    to'g'ridan-to'g'ri joriy lkQty/lkSold'dan qayta hisoblaydi (saytdagi "Oxirgi
    kirim" tugmasi bilan bir xil natija berishi uchun)."""
    scope = _load_scope(root)
    kirim_by_sku = _load_kirim_by_sku(root)
    supplier_reset_days = _build_supplier_reset_days(kirim_by_sku)
    receipt_orders = _receipt_orders(kirim_by_sku)
    n_live = _apply_live_lk_delta(scope, kirim_by_sku, root)

    if verbose:
        print(f"  Muntazam zakas qamrovi (avg30sa bor): {len(scope):,} tovar")
        print(f"  Ta'minotchi reset-maqsadi: {len(supplier_reset_days):,} ta'minotchi")
        print(f"  Jonli yangilanish (Invan'dan): {n_live:,} tovar tuzatildi")

    by_supplier = {}
    skipped_no_lk = 0
    skipped_open_po = 0
    skipped_c = 0

    for sku, meta in scope.items():
        arrivals = kirim_by_sku.get(sku, [])
        if _has_open_arrival(arrivals, receipt_orders):
            skipped_open_po += 1
            continue
        # C tovar filtri (sales_runtime.js bilan bir xil): zabc="C" va `ck`=0 (kam sotiladi) -
        # zakas berilmaydi. `ck` har build'da qayta hisoblanadi (build_prev_avg.build_c_keep),
        # shuning uchun tovar sotuvi o'zgarsa o'zi qaytadi/chiqadi. `ck` yo'q bo'lsa - filtr yo'q.
        if meta.get("zabc") == "C" and meta.get("ck") == 0:
            skipped_c += 1
            continue

        supplier = meta["su"] or "(noma'lum)"
        reset_days = supplier_reset_days.get(supplier, RESET_LONG_DAYS)
        buyurtma, qolgan_kunlar = _compute_sku(meta, meta["velocity"], reset_days, arrivals)
        if buyurtma is None:
            skipped_no_lk += 1
            continue
        if buyurtma <= 0:
            continue

        by_supplier.setdefault(supplier, []).append({
            "sku": sku,
            "name": meta["name"],
            "qty": buyurtma,
            "qolgan_kunlar": qolgan_kunlar,
            "reset_days": reset_days,
            "velocity": round(meta["velocity"], 3),
            "cost": float(meta.get("rcost") or 0),   # kelish narxi - Invan'da SUMMA yozilishi uchun
        })

    if verbose:
        n_items = sum(len(v) for v in by_supplier.values())
        print(f"  {len(by_supplier):,} ta'minotchi, {n_items:,} tovar buyurtmaga tavsiya etildi")
        print(f"  O'tkazib yuborildi: {skipped_no_lk:,} (lk ko'rsatkichi yo'q), "
              f"{skipped_open_po:,} (ochiq buyurtma bor), {skipped_c:,} (kam sotiladigan C)")

    return by_supplier


if __name__ == "__main__":
    import sys
    sys.stdout.reconfigure(encoding="utf-8")
    result = compute_zakas_auto()
    for supplier, items in sorted(result.items(), key=lambda kv: -sum(i["qty"] for i in kv[1])):
        print(f"\n=== {supplier} ({len(items)} tovar, reset={items[0]['reset_days']} kun) ===")
        for it in sorted(items, key=lambda i: i["qolgan_kunlar"] if i["qolgan_kunlar"] is not None else 999):
            print(f"  {it['sku']:>8}  {it['name'][:40]:<40}  buyurtma={it['qty']:>8.1f}  "
                  f"qolgan_kunlar={it['qolgan_kunlar']}")
