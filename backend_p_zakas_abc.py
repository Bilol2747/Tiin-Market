"""
backend_p_zakas_abc.py — Zakas (Buyurtma) bo'limi uchun KATEGORIYA-asosli ABC.

--- Nega kerak (2026-08-06, foydalanuvchi bilan uzoq muhokamadan keyin) ---
Butun saytda ishlatiladigan ABC (backend_p2_mahsulotlar.py:abc_map) BUTUN
DO'KON bo'yicha, jami tushumga qarab hisoblanadi - bitta global 80/95 Pareto.
Bu Zakas uchun noto'g'ri savolga javob beradi: kanselyariyaning eng zo'r
ruchkasi global ro'yxatda C bo'ladi (butun do'kon aylanmasiga nisbatan
arzimas), zakas unga eng kam zaxira beradi va javondagi eng yaxshi ruchka
doim tugab turadi.

Bu modul har ICHKI KATEGORIYA (`cat`, ~146 ta qiymat) o'z ichida mustaqil
ABC hisoblaydi - shunda "qaysi firmaning tovari o'z turkumida yaxshiroq"
degan savolga to'g'ri javob beriladi. Natija `zabc` maydoni sifatida
data_inv_new.json'ga yoziladi va FAQAT Zakas bo'limida ko'rsatiladi (boshqa
sahifalar - Stock, Mahsulotlar, ABC tahlili - eski global `abc` bilan
davom etadi, foydalanuvchi qarori bilan doira hozircha shu bilan cheklangan).

--- Formula (real ma'lumotda sinab, foydalanuvchi bilan kelishilgan) ---
    kuch = jami tushum / sotuv bo'lgan oylar soni        (so'm/oy)

- Davr: data_history.json boshidan (2026-01-01) oxirgi kungacha.
- TUGALLANMAGAN JORIY OY chiqarib tashlanadi - aks holda maxrajni shishirib,
  o'rtachani sun'iy pasaytiradi (sinovda -13% xato topilgan).
- Manfiy oy (qaytarish sotuvdan ko'p) 0 ga qisiladi.
- ULGURJI AJRATILMAYDI - barcha sotuv (chakana + ulgurji) hisobga kiradi
  (foydalanuvchi qarori: winsorizatsiya sinaldi va aniq teskari natija
  berib rad etildi - "щедрое лето margarin 200gr" barqaror 3 oy kuchli
  sotilib to'xtagan edi, winsor buni 12 barobar pasaytirib yuborgan edi).
- STOK MA'LUMOTI ISHLATILMAYDI - u ishonchsiz (shu loyihaning calcStock
  qismida uzoq isbotlangan); faqat sotuv yozuvi va sotish narxi (`p`).

--- Klass (har `cat` ichida mustaqil, uch qatlamli) ---
1) YUQORI ISTISNO - kuch >= MONEY_AUTO_A va dona >= QTY_MIN_A -> so'zsiz A.
   Bu qatlam "hamma tovari zo'r sotiladigan kategoriyada ham kimdir
   majburan C bo'lib qolishi"ning oldini oladi.
2) KATEGORIYA ICHIDAGI O'RIN - kumulyativ ulush MENDAN OLDINGI holat
   bo'yicha hisoblanadi (o'zining ulushi qo'shilmaydi) - shunda kategoriyani
   yakka egallagan tovar HAR DOIM A bo'ladi (avval kumulyativga o'zi ham
   qo'shilib, masalan kategoriyasining 99.5%-ini bergan tovar C bo'lib
   qolgan holat topilgan edi).
3) PASTKI DARVOZA (pul + dalil) - kuchsiz/dalili kam tovar kichik
   kategoriyada A/B bo'lib ketmasin. Darvoza PUL bo'yicha (dona emas) -
   saralash ham pul bo'yicha ketgani uchun ikki xil o'lchov ziddiyat
   berardi (masalan 16 dona, 3.46 mln so'm/oy tovar "kam dona" deb pastga
   tushib, 274 dona, bor-yo'g'i 52 ming so'm/oy tovar yuqoriga chiqib
   ketgan edi - zakas uchun muhimi tugab qolsa QANCHA YO'QOTAMIZ).

Chegaralar QAT'IY RAQAM (foydalanuvchi qarori, 2026-08-06) - har build'da
qayta hisoblanmaydi, shunda klasslar sababsiz siljimaydi. Narxlar sezilarli
o'zgarsa (masalan inflyatsiya), bu fayldagi konstantalarni qo'lda yangilash
kerak bo'ladi.

Natija: `data_inv_new.json`dagi har yozuvga `zabc` ("A"/"B"/"C") qo'shiladi.
HTML EMBED QILINMAYDI - bu modul build_calc_stock()dan OLDIN chaqiriladi,
shunda `zabc` maydoni calcStock bosqichidagi <script id="invdata"> splice
bilan o'zi HTML'ga tushadi (backend_p_calc_stock.py:_apply_calc_stock).
"""
import json
from pathlib import Path
from datetime import date, timedelta
from collections import Counter, defaultdict

import history_archive

ROOT = Path(__file__).parent

# ── Klassifikatsiya sozlamalari (2026-08-06, real ma'lumotda tanlangan) ──
A_CUT, B_CUT = 0.80, 0.95
MONEY_MIN_A = 250_000       # A uchun eng kam so'm/oy (do'kon medianasi atrofi)
MONEY_MIN_B = 100_000       # B uchun eng kam so'm/oy
MONEY_AUTO_A = 1_400_000    # shundan ko'p bo'lsa - o'rnidan qat'i nazar A (yuqori ~10%)
QTY_MIN_A = 10              # A uchun jami kamida shuncha dona (dalil chegarasi)
QTY_MIN_B = 3               # B uchun jami kamida shuncha dona


def recompute_zakas_abc(root=ROOT, verbose=True):
    """Har SKU uchun kategoriya-ichi ABC klassini hisoblaydi. Qaytaradi:
    {sku_str: "A"|"B"|"C"}. Faqat sku'si va (bevosita yoki catTop orqali)
    kategoriyasi bor yozuvlar hisoblanadi."""
    hist_path = root / "data_history.json"
    inv_path = root / "data_inv_new.json"
    if not (hist_path.exists() and inv_path.exists()):
        if verbose:
            print("  ! zakas ABC uchun kerakli fayllardan biri topilmadi - o'tkazib yuborildi")
        return {}

    hist = json.loads(hist_path.read_text(encoding="utf-8"))
    hist = history_archive.expand_hist_with_archives(hist, root, verbose)
    inv = json.loads(inv_path.read_text(encoding="utf-8"))

    hist_base = date.fromisoformat(hist["base"])
    hist_days = hist.get("days", 0)
    if hist_days <= 0:
        if verbose:
            print("  ! data_history.json bo'sh - zakas ABC hisoblanmadi")
        return {}
    d_map = hist.get("d", {})

    # Tugallanmagan joriy oy - maxrajga qo'shilmaydi (izoh yuqorida).
    last_day = hist_base + timedelta(days=hist_days - 1)
    skip_month = last_day.isoformat()[:7]

    rows = []
    for name, v in inv.items():
        if not isinstance(v, dict) or not v.get("sku"):
            continue
        sku = str(v["sku"])
        price = v.get("p") or 0
        cat_top = (v.get("catTop") or "").strip() or "(kategoriyasiz)"
        cat_sub = (v.get("cat") or "").strip() or "(ichki kategoriyasiz)"

        mq = Counter()
        for i, q in enumerate(d_map.get("sku:" + sku) or []):
            if q and i < hist_days:
                ym = (hist_base + timedelta(days=i)).isoformat()[:7]
                if ym == skip_month:
                    continue
                mq[ym] += q
        # Manfiy oy (qaytarish sotuvdan ko'p) -> 0.
        qty_by_month = [max(0.0, q) for q in mq.values()]
        n_mon = len([q for q in mq.values() if q])
        total_qty = sum(qty_by_month)
        strength = (total_qty * price / n_mon) if n_mon else 0.0

        rows.append({"sku": sku, "catTop": cat_top, "catSub": cat_sub,
                     "qty": total_qty, "strength": strength})

    by_sub = defaultdict(list)
    for r in rows:
        by_sub[(r["catTop"], r["catSub"])].append(r)

    result = {}
    for _key, g in by_sub.items():
        tot = sum(x["strength"] for x in g)
        cum_before = 0.0
        # Kattadan kichikka; teng bo'lsa SKU bo'yicha - natija barqaror bo'lsin.
        for x in sorted(g, key=lambda z: (-z["strength"], z["sku"])):
            cum_before_pct = (cum_before / tot) if tot > 0 else 1.0
            cum_before += x["strength"]

            if x["strength"] <= 0:
                result[x["sku"]] = "C"
                continue

            # 3-qatlam: yuqori istisno - dalil yetarli bo'lsa so'zsiz A.
            if x["strength"] >= MONEY_AUTO_A and x["qty"] >= QTY_MIN_A:
                result[x["sku"]] = "A"
                continue

            # 2-qatlam: kategoriya ichidagi o'rin (MENDAN OLDINGI kumulyativ).
            if cum_before_pct < A_CUT:
                cls = "A"
            elif cum_before_pct < B_CUT:
                cls = "B"
            else:
                cls = "C"

            # 1-qatlam: pastki darvoza - pul VA dalil.
            if cls == "A":
                if x["strength"] < MONEY_MIN_A:
                    cls = "B" if x["strength"] >= MONEY_MIN_B else "C"
                elif x["qty"] < QTY_MIN_A:
                    cls = "B" if x["qty"] >= QTY_MIN_B else "C"
            if cls == "B":
                if x["strength"] < MONEY_MIN_B:
                    cls = "C"
                elif x["qty"] < QTY_MIN_B:
                    cls = "C"
            result[x["sku"]] = cls

    if verbose:
        c = Counter(result.values())
        print(f"  {len(result):,} mahsulotga kategoriya-ABC hisoblandi "
              f"(A={c['A']:,} B={c['B']:,} C={c['C']:,})")
    return result


def _apply_zakas_abc(abc_by_sku, root=ROOT, verbose=True):
    """abc_by_sku'ni data_inv_new.json'ga `zabc` sifatida qo'llaydi. HTML
    embed QILMAYDI - build_calc_stock()dan oldin chaqirilgani uchun uning
    o'zi keyinroq butun inv blobini (shu jumladan zabc'ni) HTML'ga yozadi."""
    inv_path = root / "data_inv_new.json"
    if not inv_path.exists():
        return 0
    inv = json.loads(inv_path.read_text(encoding="utf-8"))
    ZABC_KEYS = ("zabc",)
    matched = 0
    for iv in inv.values():
        if not isinstance(iv, dict):
            continue
        sku = iv.get("sku")
        if sku is None or sku == "":
            for k in ZABC_KEYS:
                iv.pop(k, None)
            continue
        cls = abc_by_sku.get(str(sku))
        if cls:
            iv["zabc"] = cls
            matched += 1
        else:
            for k in ZABC_KEYS:
                iv.pop(k, None)
    inv_json = json.dumps(inv, ensure_ascii=False, separators=(",", ":"))
    inv_path.write_text(inv_json, encoding="utf-8")
    if verbose:
        print(f"  {matched:,} mahsulotga zabc qo'llandi (faqat data_inv_new.json - HTML keyingi bosqichda)")
    return matched


def build_zakas_abc(root=ROOT, verbose=True):
    """Zakas bo'limi uchun kategoriya-asosli ABC'ni qayta hisoblab qo'llaydi.
    build_all_from_api.py'da build_calc_stock()dan OLDIN chaqiriladi."""
    try:
        abc_by_sku = recompute_zakas_abc(root=root, verbose=verbose)
    except Exception as e:
        if verbose:
            print(f"  ! zakas ABC hisoblashda xato: {e}")
        return 0
    if not abc_by_sku:
        return 0
    return _apply_zakas_abc(abc_by_sku, root=root, verbose=verbose)


if __name__ == "__main__":
    build_zakas_abc(verbose=True)
