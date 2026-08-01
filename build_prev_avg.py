"""
CHUQUR ZAKAS uchun `pav` (previous active average) va MUNTAZAM ZAKAS uchun
stok-asosli `avg30sa` hisoblaydi.

--- pav (chuqur zakas) ---
Har bir tovar uchun Jan 1 dan to'liq sotuv tarixidan AVVALGI FAOL SOTUV
DAVRINI topib, o'sha davrdagi RETAIL + DOIMIY ULGURJI kunlik o'rtachasini
hisoblaydi (katta/bir martalik ulgurji chiqariladi). Natija data_inv_new.json
ga `pav` sifatida yoziladi (va HTML embed'ga).

Oxirgi 30 kunda sotuv bo'lmagani uchun muntazam zakasga (30-kunlik qulflangan
hisob) tushmagan tovarlar shu `pav` orqali "Chuqur zakas" bo'limida miqdor oladi.

Og'ir hisob (Jan 1 dan barcha orderlar) BIR MARTA bajariladi va .pav_cache.json
ga saqlanadi. Har build'da pav shu keshdan data_inv_new.json ga ARZON qo'llanadi
(Turso'dan qayta o'qimasdan). O'tgan savdolar o'zgarmaydi — shuning uchun qayta
hisob SHART EMAS. Yangi tovarlar uchun qo'lda `--force` bilan yangilanadi.

Mantiq: tovar yangi sotilsa 30-kunlik oynaga kiradi va avtomatik "Muntazam"
zakasga o'tadi (pav kerak emas). Sotilmasa oxirgi faol davri o'zgarmaydi (pav
o'zgarmaydi). Demak pav barqaror qiymat — bir marta yozilsa yetadi.

--- avg30sa (muntazam zakas, stok-asosli) ---
Frontend'dagi _get30Avg() oxirgi 30 kunda sotilmagan kunlarni "faol kun emas"
deb hisobdan chiqaradi — lekin sababi ikki xil bo'lishi mumkin: (a) tovar
tugab qolgan (to'g'ri chiqarish) yoki (b) tovar bor edi, lekin sotilmadi
(chiqarish XATO — sun'iy shishiradi). Bu yerda shuni ajratamiz: joriy stokdan
(data_inv_new.json "a") orqaga qarab, kirim (data_kirim.json) va sotuv
(data_history.json) orqali har kunning taxminiy stokini tiklaymiz (xuddi
ombor_aylanmasi.js'dagi _oaStockAt kabi — taxminiy, lekin real 14-kunlik
snapshotga solishtirib 99.3% aniqligi tasdiqlangan, 2026-07-20). Agar stok
AVG30_STOCK_THRESHOLD'dan katta bo'lsa — "mavjud edi, sotilmadi" deb shu
kun ham hisoblanadi (bo'luvchiga qo'shiladi, pasaytiradi). Natija
data_inv_new.json ga `avg30sa` sifatida yoziladi; frontend _get30Avg() shu
tayyor qiymatni topsa ISHLATADI, topmasa eski (live) hisobga tushadi.

Bu hisob HAR build'da qayta ishlaydi (keshlanmaydi) — chunki 30 kunlik oyna
har kuni bir kun siljiydi, pav'dagi kabi "barqaror" emas. Hisoblash arzon
(~20,000 tovar uchun ~0.5-1 soniya), shuning uchun muammo emas.
"""
import sys, os, json, time
from datetime import date, timedelta, datetime
from pathlib import Path

ROOT = Path(__file__).parent
HISTORY_BASE_DATE = date(2026, 1, 1)
TASHKENT_OFFSET = timedelta(hours=5)
PAV_WINDOW = 30          # avvalgi faol davr oynasi (kun)
PAV_MIN_ACTIVE = 20      # shu qadar faol kun bo'lsa faol kunlarga bo'linadi, aks holda 30 ga
                         # 20 ga ko'tarildi (avval 15, undan oldin 8): chuqur zakas uchun
                         # konservativ hisob — ortiqcha zakas oldini olish. Stok-asosli aniq
                         # hisoblashning bu yerga (eski, uzoq davrlar uchun tekshirib bo'lmaydi)
                         # foydasi kam ekani real ma'lumotda o'lchandi (2026-07-20, foydalanuvchi
                         # bilan suhbatda tasdiqlangan) — shuning uchun oddiy chegara ko'tarish
                         # tanlandi, avg30sa kabi murakkab stok-rekonstruksiya EMAS.
CACHE_PATH = ROOT / ".pav_cache.json"
PAV_CACHE_MAX_AGE_DAYS = 20  # shu muddatdan oshsa, avtomatik qayta hisoblanadi (data_history.json'dan,
                             # Turso'siz - arzon). 30 kunlik "chuqur zakas" chegarasidan xavfsiz zaxira
                             # bilan: kesh doim <30 kun, shuning uchun chuqurdagi tovarning oxirgi faol
                             # davri kesh sanasidan keyin bo'lib qolish ehtimoli yo'q (batafsil: foydalanuvchi
                             # bilan suhbatda tasdiqlangan mantiq, 2026-07-18).

AVG30_WINDOW = 30            # muntazam zakas oynasi — _get30Avg() bilan bir xil
AVG30_MIN_ACTIVE = 8         # ESKI chegara — endi ISHLATILMAYDI (pastdagi izohga qarang)
AVG30_STOCK_THRESHOLD = 2    # "javonda haqiqatan bor" deb hisoblanishi uchun stok shundan KATTA
                             # bo'lishi kerak. 1-2 dona qoldiq amalda ko'pincha sotib bo'lmaydigan
                             # holat (shikastlangan, joyida yo'q, hisob xatosi) - foydalanuvchi
                             # do'kon tajribasidan aytdi, 2026-07-21. Kirim-guvohligi bilan BIRGA
                             # ishlaydi (ikkalasi ham "bor" desa - bor). Real ma'lumotda o'lchandi:
                             # guvohlik bilan birga yoki alohida, 1/2/10 - natija deyarli bir xil
                             # (xato 0.637 va 0.638), ya'ni bu chegara endi hal qiluvchi emas.
                             # Avval 10 edi va YAGONA qoida edi - eng katta xato manbai shu edi.
AVG30_CAP_MULT = 3.0         # kunlik o'rtacha kalendar tezligining (jami/30) shuncha barobaridan
                             # oshmaydi — yangi chiqqan/bir martalik portlagan tovarlarda
                             # ("7 kunda 709 dona") ortiqcha zakasning oldini oladi.


def _compute_pav_from_item(it, base_date):
    """pav (kunlik o'rtacha) va pavm (davr summary) qaytaradi.
    pavm: {q,rt,wi,we,rev,r,d,f,t} — davr qiymatlari, chuqur zakas dashboardi uchun."""
    rt = it.get("rt") or []
    wi = it.get("wi") or []
    we = it.get("we") or []
    q = it.get("q") or []
    rev = it.get("rev") or []
    rcp = it.get("r") or []
    n = max(len(rt), len(wi))
    if n == 0:
        return None
    # RETAIL + DOIMIY ULGURJI (katta ulgurji 'we' CHIQARILADI)
    combined = [(rt[i] if i < len(rt) else 0) + (wi[i] if i < len(wi) else 0) for i in range(n)]
    last = -1
    for i in range(n - 1, -1, -1):
        if combined[i] > 0:
            last = i
            break
    if last < 0:
        return None
    s = max(0, last - (PAV_WINDOW - 1))
    win = combined[s:last + 1]
    days = len(win)
    tot = sum(win)
    active = sum(1 for x in win if x > 0)
    if days == 0 or tot <= 0:
        return None
    # Bo'luvchi DOIM PAV_WINDOW (30) — qisqargan oyna EMAS. Aks holda tarix boshiga
    # yaqin, bir-ikki kun sotilib to'xtagan tovar juda katta kunlik o'rtacha olib,
    # ortiqcha zakas beriladi (masalan 2 kunda 11 dona -> 3/kun -> 60 zakas). Endi
    # 8+ faol kun bo'lsagina faol kunlarga bo'linadi, aks holda 30 ga (xuddi _get30Avg).
    avg = (tot / active) if active >= PAV_MIN_ACTIVE else (tot / PAV_WINDOW)
    sl = lambda arr: arr[s:last + 1] if arr else []
    pavm = {
        "q": round(sum(sl(q)), 2),
        "rt": round(sum(sl(rt)), 2),
        "wi": round(sum(sl(wi)), 2),
        "we": round(sum(sl(we)), 2),
        "rev": round(sum(sl(rev))),
        "r": int(sum(sl(rcp))),
        "d": days,
        "f": (base_date + timedelta(days=s)).isoformat(),
        "t": (base_date + timedelta(days=last)).isoformat(),
    }
    return {"pav": round(avg, 3), "pavm": pavm}


def recompute_pav_by_sku(verbose=True):
    """Turso'dan barcha orderlarni olib, to'liq tarix breakdown quradi.
    sku->pav va sku->pavm (davr summary) qaytaradi."""
    from turso_sync import fetch_range
    from build_sales_demand import api_records, build as build_daily
    today = date.today()
    date_from = HISTORY_BASE_DATE.isoformat()
    date_to = (today + timedelta(days=1)).isoformat()
    if verbose:
        print(f"  Turso'dan {date_from}..{today} orderlar (chuqur zakas)...")
    orders = fetch_range(date_from, date_to)
    if verbose:
        print(f"  {len(orders):,} order; to'liq breakdown qurilmoqda...")
    daily_full = build_daily(api_records(orders))
    items = daily_full.get("items", {})
    meta = daily_full.get("__meta__", {})
    base_date = date.fromisoformat(meta.get("start", HISTORY_BASE_DATE.isoformat()))
    pav_by_sku = {}
    pavm_by_sku = {}
    for it in items.values():
        sku = str(it.get("sku") or "").strip()
        if not sku:
            continue
        res = _compute_pav_from_item(it, base_date)
        if res and res["pav"] > 0:
            pav_by_sku[sku] = res["pav"]
            pavm_by_sku[sku] = res["pavm"]
    if verbose:
        print(f"  {len(pav_by_sku):,} mahsulotga pav hisoblandi")
    return pav_by_sku, pavm_by_sku


def recompute_pav_from_history(root=ROOT, verbose=True):
    """data_history.json'dan (Turso'ga MUROJAAT QILMASDAN) pav hisoblaydi -
    recompute_pav_by_sku() bilan AYNAN bir xil hisoblash mantig'i (_compute_pav_from_item),
    faqat manba Turso emas - allaqachon har build'da bepul yangilanib turadigan tarix fayli.
    data_history.json'ning "d"/"r"/"rc" maydonlari mos ravishda daily_full'ning "q"/"rev"/"r"
    maydonlariga teng (build_history_incremental()dagi src_fields xaritasi bilan bir xil)."""
    hist_path = root / "data_history.json"
    if not hist_path.exists():
        if verbose:
            print("  ! data_history.json topilmadi - tarixdan pav hisoblab bo'lmadi")
        return {}, {}
    hist = json.loads(hist_path.read_text(encoding="utf-8"))
    base_date = date.fromisoformat(hist["base"])
    d_map = hist.get("d", {})
    r_map = hist.get("r", {})
    rc_map = hist.get("rc", {})
    wi_map = hist.get("wi", {})
    we_map = hist.get("we", {})
    rt_map = hist.get("rt", {})
    pav_by_sku = {}
    pavm_by_sku = {}
    for key in d_map:
        if not key.startswith("sku:"):
            continue
        sku = key[4:].strip()
        if not sku:
            continue
        it = {
            "rt": rt_map.get(key) or [],
            "wi": wi_map.get(key) or [],
            "we": we_map.get(key) or [],
            "q": d_map.get(key) or [],
            "rev": r_map.get(key) or [],
            "r": rc_map.get(key) or [],
        }
        res = _compute_pav_from_item(it, base_date)
        if res and res["pav"] > 0:
            pav_by_sku[sku] = res["pav"]
            pavm_by_sku[sku] = res["pavm"]
    if verbose:
        print(f"  {len(pav_by_sku):,} mahsulotga pav hisoblandi (tarixdan, Turso'siz)")
    return pav_by_sku, pavm_by_sku


def _apply_pav(pav_by_sku, pavm_by_sku, root=ROOT, verbose=True):
    inv_path = root / "data_inv_new.json"
    if not inv_path.exists():
        return 0
    inv = json.loads(inv_path.read_text(encoding="utf-8"))
    matched = 0
    for iv in inv.values():
        if not isinstance(iv, dict):
            continue
        sku = iv.get("sku")
        if sku is None or sku == "":
            iv.pop("pav", None); iv.pop("pavm", None)
            continue
        pav = pav_by_sku.get(str(sku))
        if pav:
            iv["pav"] = pav
            pm = pavm_by_sku.get(str(sku))
            if pm:
                iv["pavm"] = pm
            else:
                iv.pop("pavm", None)
            matched += 1
        else:
            iv.pop("pav", None); iv.pop("pavm", None)
    inv_json = json.dumps(inv, ensure_ascii=False, separators=(",", ":"))
    inv_path.write_text(inv_json, encoding="utf-8")
    # HTML embed
    TAG = '<script id="invdata" type="application/json">'
    for fn in ("index.html", "sales.html"):
        f = root / fn
        if not f.exists():
            continue
        txt = f.read_text(encoding="utf-8")
        i = txt.find(TAG)
        if i < 0:
            continue
        start = i + len(TAG)
        end = txt.find("</script>", start)
        if end < 0:
            continue
        f.write_text(txt[:start] + inv_json + txt[end:], encoding="utf-8")
    if verbose:
        print(f"  {matched:,} mahsulotga pav qo'llandi (inv + embed)")
    return matched


def _kirim_local_date(iso_str):
    """Kirim arrival ISO vaqtini (UTC) Toshkent mahalliy sanasiga o'giradi."""
    try:
        utc_dt = datetime.fromisoformat(str(iso_str).replace("Z", "+00:00"))
    except Exception:
        return None
    return (utc_dt.replace(tzinfo=None) + TASHKENT_OFFSET).date()


def _compute_avg30_stock_aware(d_arr, rt_arr, wi_arr, cur_stock, kirim_by_date, hist_base, n):
    """Oxirgi AVG30_WINDOW kunlik kunlik o'rtacha — stok-asosli.

    Har kun uchta turdan biriga ajratiladi:
      SOTILGAN               -> mavjud kun
      BOR EDI, sotilmagan    -> mavjud kun  (o'rtachani pasaytiradi - ortiqcha zakas oldini oladi)
      TUGAGAN                -> hisobdan CHIQADI (talab yashiringan, bilib bo'lmaydi)

    "Bor edi"mi yoki "tugagan"mi: har kunning stoki joriy stokdan orqaga qarab tiklanadi
    (kirim/sotuv bilan) va AVG30_STOCK_THRESHOLD dan katta bo'lsa "bor edi" deb olinadi.
    Tiklash real kunlik snapshot bilan tekshirilgan: 77% aniq mos, 91.5% ±2 ichida.

    Natija kalendar tezligining AVG30_CAP_MULT barobari bilan cheklanadi. Batafsil asoslash
    va real ma'lumotdagi o'lchovlar: ISHLAR_JURNALI.md.

    ESLATMA (2026-07-21): bu yerda "kirim-guvohligi" qoidasi ham sinab ko'rilgan edi (kun
    sotilmagan bo'lsa, keyingi sotuv YANGI KIRIMdan keyin bo'lgan bo'lsa - o'sha kun tugagan
    deb olish, stok raqamiga qaramasdan). U biroz aniqroq edi (xato 0.638 va 0.652), lekin
    foydalanuvchi soddaligi uchun FAQAT stok qoidasini qoldirishni tanladi - tizim tushunarli
    bo'lishi muhimroq. Qaytarish kerak bo'lsa: git tarixida, shu commit'dan oldingi versiyada.

    ESLATMA (2026-07-22): avvalgi versiyada natija tayanch tezlik (pav) bilan K=5 og'irlikda
    yumshatilardi (avg=(tot+K*pav)/(effective+K)) - kam faol kunli tovarlarda tasodifiy
    tebranishni bostirish uchun. Lekin real ma'lumotda tekshirilganda (2026-07-22, foydalanuvchi
    bilan): tez-tez tugab qoladigan tovarlarda bu ko'pincha zakasni past ko'rsatib yuborar edi
    (2,000 ta shunday tovarning 43.6%ida kamroq, atigi 2%ida ko'proq chiqarardi) - aynan qayta
    to'ldirish paytida yetarli zakas berilmasligi xavfi yuqori bo'lgan holat. Butun katalogda
    olib tashlash natijasi neytral-ijobiy (jami hajm +3.1%). Shuning uchun olib tashlandi -
    endi faqat xom nisbat (tot/effective) ishlatiladi, AVG30_CAP_MULT bilan cheklab (bitta
    tasodifiy katta sotuvdan portlab ketishdan himoya sifatida qoladi).

    Qaytaradi: (avg, active, effective) yoki None (yetarli ma'lumot/tarix bo'lmasa)."""
    if n < AVG30_WINDOW or cur_stock is None:
        return None
    s = n - AVG30_WINDOW
    combo = []
    for i in range(s, n):
        rt_v = rt_arr[i] if i < len(rt_arr) else 0
        wi_v = wi_arr[i] if i < len(wi_arr) else 0
        combo.append((rt_v or 0) + (wi_v or 0))
    tot = sum(combo)
    active = sum(1 for x in combo if x > 0)
    if tot <= 0:
        return None
    # Joriy (bugungi) stokdan orqaga qarab, har kunning taxminiy stokini tiklaymiz.
    # (Endi faqat ZAXIRA qoida uchun - guvohlik topilmagan kunlarda ishlatiladi.)
    running = cur_stock
    stock_by_idx = {}
    for i in range(n - 1, s - 1, -1):
        d = hist_base + timedelta(days=i)
        stock_by_idx[i] = running
        sold_i = d_arr[i] if i < len(d_arr) else 0
        kirim_i = kirim_by_date.get(d, 0)
        running = running - kirim_i + (sold_i or 0)
    effective = 0
    for i in range(s, n):
        if combo[i - s] > 0:
            effective += 1                       # SOTILGAN - savolsiz mavjud kun
            continue
        # Sotilmagan kun: javonda bor edimi? Faqat tiklangan stokka qaraladi.
        stk = stock_by_idx.get(i)
        if stk is not None and stk > AVG30_STOCK_THRESHOLD:
            effective += 1                       # BOR EDI, sotilmagan
    calendar = tot / AVG30_WINDOW
    avg = tot / effective  # effective >= 1 doim (tot>0 bo'lsa hech bo'lmasa 1 kun combo>0)
    avg = min(avg, AVG30_CAP_MULT * calendar)
    return round(avg, 3), active, effective


def recompute_avg30_from_history(root=ROOT, verbose=True):
    """Muntazam zakas uchun stok-asosli 30-kunlik o'rtachani data_history.json +
    data_kirim.json + data_inv_new.json (joriy stok)dan hisoblaydi. Har build'da
    qayta ishlaydi (keshlanmaydi — oyna har kuni siljiydi, hisob arzon)."""
    hist_path = root / "data_history.json"
    kirim_path = root / "data_kirim.json"
    inv_path = root / "data_inv_new.json"
    if not (hist_path.exists() and kirim_path.exists() and inv_path.exists()):
        if verbose:
            print("  ! avg30sa uchun kerakli fayllardan biri topilmadi - o'tkazib yuborildi")
        return {}
    hist = json.loads(hist_path.read_text(encoding="utf-8"))
    kirim = json.loads(kirim_path.read_text(encoding="utf-8"))
    inv = json.loads(inv_path.read_text(encoding="utf-8"))

    hist_base = date.fromisoformat(hist["base"])
    n_days = hist.get("days", 0)
    d_map = hist.get("d", {})
    rt_map = hist.get("rt", {})
    wi_map = hist.get("wi", {})

    cur_stock_by_sku = {}
    for iv in inv.values():
        if isinstance(iv, dict) and iv.get("sku") not in (None, ""):
            try:
                cur_stock_by_sku[str(iv["sku"])] = float(iv.get("a") or 0)
            except (TypeError, ValueError):
                pass

    kirim_by_sku_day = {}
    for sku, entry in kirim.get("skus", {}).items():
        for a in (entry.get("arrivals") or []):
            if a.get("status") != "Received":
                continue
            d = _kirim_local_date(a.get("date"))
            qty = a.get("qty") or 0
            if d and qty:
                m = kirim_by_sku_day.setdefault(sku, {})
                m[d] = m.get(d, 0) + qty

    avg30_by_sku = {}
    for key, d_arr in d_map.items():
        if not key.startswith("sku:"):
            continue
        sku = key[4:].strip()
        if not sku:
            continue
        cur = cur_stock_by_sku.get(sku)
        if cur is None:
            continue
        rt_arr = rt_map.get(key) or []
        wi_arr = wi_map.get(key) or []
        res = _compute_avg30_stock_aware(d_arr or [], rt_arr, wi_arr, cur,
                                          kirim_by_sku_day.get(sku, {}), hist_base, n_days)
        if res and res[0] > 0:
            avg30_by_sku[sku] = res[0]
    if verbose:
        print(f"  {len(avg30_by_sku):,} mahsulotga stok-asosli avg30sa hisoblandi")
    return avg30_by_sku


def _apply_avg30(avg30_by_sku, root=ROOT, verbose=True):
    """avg30_by_sku'ni data_inv_new.json ga `avg30sa` sifatida qo'llaydi (+ HTML embed).
    _apply_pav'dan MUSTAQIL, alohida o'qish/yozish - pav mexanizmiga tegmaydi."""
    inv_path = root / "data_inv_new.json"
    if not inv_path.exists():
        return 0
    inv = json.loads(inv_path.read_text(encoding="utf-8"))
    matched = 0
    for iv in inv.values():
        if not isinstance(iv, dict):
            continue
        sku = iv.get("sku")
        if sku is None or sku == "":
            iv.pop("avg30sa", None)
            continue
        avg = avg30_by_sku.get(str(sku))
        if avg:
            iv["avg30sa"] = avg
            matched += 1
        else:
            iv.pop("avg30sa", None)
    inv_json = json.dumps(inv, ensure_ascii=False, separators=(",", ":"))
    inv_path.write_text(inv_json, encoding="utf-8")
    TAG = '<script id="invdata" type="application/json">'
    for fn in ("index.html", "sales.html"):
        f = root / fn
        if not f.exists():
            continue
        txt = f.read_text(encoding="utf-8")
        i = txt.find(TAG)
        if i < 0:
            continue
        start = i + len(TAG)
        end = txt.find("</script>", start)
        if end < 0:
            continue
        f.write_text(txt[:start] + inv_json + txt[end:], encoding="utf-8")
    if verbose:
        print(f"  {matched:,} mahsulotga avg30sa qo'llandi (inv + embed)")
    return matched


def build_avg30sa(root=ROOT, verbose=True):
    """Muntazam zakas uchun stok-asosli avg30sa'ni qayta hisoblab qo'llaydi.
    build_prev_avg()dan MUSTAQIL chaqiriladi (pav bilan bog'liq emas)."""
    try:
        avg30_by_sku = recompute_avg30_from_history(root=root, verbose=verbose)
    except Exception as e:
        if verbose:
            print(f"  ! avg30sa hisoblashda xato: {e}")
        return 0
    if not avg30_by_sku:
        return 0
    return _apply_avg30(avg30_by_sku, root=root, verbose=verbose)


def recompute_current_cost(root=ROOT, verbose=True):
    """Zakas "Narx" ustuni va Summa hisobi uchun har SKU'ning ENG ISHONCHLI
    joriy tannarxini aniqlaydi (foydalanuvchi so'rovi, 2026-07-22: "cost
    narxini eng ishonchli joydan olishimiz kk").

    Manba ustuvorligi (backend_p6_suppliers.py'dagi p6/p9 tannarx modeli
    bilan AYNAN bir xil - butun saytda bitta izchil "haqiqiy tannarx"
    tushunchasi):
      1) data_kirim.json'dagi HAQIQIY kirim tarixi - eng so'nggi qabul
         qilingan narx (kirim_cost_breakpoints/cost_at, Returned/Custom
         Return holatlari chiqarib tashlangan).
      2) Kirim tarixi topilmasa (masalan hali birorta marta kelmagan yangi
         tovar - foydalanuvchi ayni shu holatni alohida ta'kidladi) -
         katalogdagi sp (keyin p) ga fallback, natija "taxminiy" (approx)
         deb belgilanadi - frontend buni "≈" bilan ko'rsatib, aniq
         emasligini bildiradi.

    Qaytaradi: {sku: (cost, approx)}."""
    from backend_p6_suppliers import kirim_cost_breakpoints, cost_at
    kirim_path = root / "data_kirim.json"
    inv_path = root / "data_inv_new.json"
    if not (kirim_path.exists() and inv_path.exists()):
        if verbose:
            print("  ! rcost uchun kerakli fayllardan biri topilmadi - o'tkazib yuborildi")
        return {}
    kirim = json.loads(kirim_path.read_text(encoding="utf-8"))
    inv = json.loads(inv_path.read_text(encoding="utf-8"))
    breakpoints = kirim_cost_breakpoints(kirim.get("skus") or {})
    today = date.today()
    cost_by_sku = {}
    for iv in inv.values():
        if not isinstance(iv, dict):
            continue
        sku = str(iv.get("sku") or "").strip()
        if not sku:
            continue
        c = cost_at(breakpoints.get(sku), today)
        approx = c is None
        if approx:
            c = iv.get("sp") or iv.get("p") or 0
        if c:
            cost_by_sku[sku] = (round(float(c), 2), approx)
    if verbose:
        n_approx = sum(1 for _, a in cost_by_sku.values() if a)
        print(f"  {len(cost_by_sku):,} mahsulotga rcost hisoblandi (shundan {n_approx:,} taxminiy - kirim tarixi yo'q)")
    return cost_by_sku


def _apply_current_cost(cost_by_sku, root=ROOT, verbose=True):
    """cost_by_sku'ni data_inv_new.json ga rcost/rcost_approx sifatida
    qo'llaydi (+ HTML embed). pav/avg30sa'dan MUSTAQIL, alohida o'qish/yozish."""
    inv_path = root / "data_inv_new.json"
    if not inv_path.exists():
        return 0
    inv = json.loads(inv_path.read_text(encoding="utf-8"))
    matched = 0
    for iv in inv.values():
        if not isinstance(iv, dict):
            continue
        sku = iv.get("sku")
        if sku is None or sku == "":
            iv.pop("rcost", None); iv.pop("rcost_approx", None)
            continue
        res = cost_by_sku.get(str(sku))
        if res:
            iv["rcost"], approx = res
            if approx:
                iv["rcost_approx"] = True
            else:
                iv.pop("rcost_approx", None)
            matched += 1
        else:
            iv.pop("rcost", None); iv.pop("rcost_approx", None)
    inv_json = json.dumps(inv, ensure_ascii=False, separators=(",", ":"))
    inv_path.write_text(inv_json, encoding="utf-8")
    TAG = '<script id="invdata" type="application/json">'
    for fn in ("index.html", "sales.html"):
        f = root / fn
        if not f.exists():
            continue
        txt = f.read_text(encoding="utf-8")
        i = txt.find(TAG)
        if i < 0:
            continue
        start = i + len(TAG)
        end = txt.find("</script>", start)
        if end < 0:
            continue
        f.write_text(txt[:start] + inv_json + txt[end:], encoding="utf-8")
    if verbose:
        print(f"  {matched:,} mahsulotga rcost qo'llandi (inv + embed)")
    return matched


def build_current_cost(root=ROOT, verbose=True):
    """Zakas "Narx"/Summa ustunlari uchun eng ishonchli joriy tannarxni qayta
    hisoblab qo'llaydi. build_prev_avg()/build_avg30sa()dan MUSTAQIL
    chaqiriladi - bittasi xato bersa boshqasiga ta'sir qilmaydi."""
    try:
        cost_by_sku = recompute_current_cost(root=root, verbose=verbose)
    except Exception as e:
        if verbose:
            print(f"  ! rcost hisoblashda xato: {e}")
        return 0
    if not cost_by_sku:
        return 0
    return _apply_current_cost(cost_by_sku, root=root, verbose=verbose)


def build_prev_avg(root=ROOT, force=False, verbose=True):
    """Kesh bor va yetarlicha yangi (PAV_CACHE_MAX_AGE_DAYS'dan kichik) bo'lsa - shundan
    qo'llaydi, hech narsani qayta hisoblamaydi (tez). Aks holda (kesh yo'q, eskirgan, yoki
    --force) - data_history.json'dan (Turso'siz, arzon) qayta hisoblaydi. Tarix fayli
    topilmasa (masalan birinchi marta ishga tushirilganda) - Turso'dan to'liq qayta
    hisoblaydigan zaxira yo'lga o'tadi."""
    pav_by_sku = None
    pavm_by_sku = {}
    need_recompute = force
    if not force and CACHE_PATH.exists():
        try:
            cache = json.loads(CACHE_PATH.read_text(encoding="utf-8"))
            if cache.get("pav"):
                pav_by_sku = {str(k): v for k, v in cache["pav"].items()}
                pavm_by_sku = {str(k): v for k, v in (cache.get("pavm") or {}).items()}
                age_days = (time.time() - cache.get("ts", 0)) / 86400
                if age_days > PAV_CACHE_MAX_AGE_DAYS:
                    need_recompute = True
                    if verbose:
                        print(f"  pav keshi {age_days:.1f} kun eski (>{PAV_CACHE_MAX_AGE_DAYS}) - "
                              f"tarixdan (Turso'siz) qayta hisoblanmoqda...")
        except Exception:
            pav_by_sku = None
    # Kesh eski formatda (pavm yo'q) bo'lsa qayta hisoblaymiz
    if pav_by_sku is not None and not pavm_by_sku:
        pav_by_sku = None
    if pav_by_sku is None:
        need_recompute = True

    if need_recompute:
        new_pav, new_pavm = {}, {}
        try:
            new_pav, new_pavm = recompute_pav_from_history(root=root, verbose=verbose)
        except Exception as e:
            if verbose:
                print(f"  ! tarixdan pav hisoblashda xato: {e}")
        if new_pav:
            pav_by_sku, pavm_by_sku = new_pav, new_pavm
        elif pav_by_sku is None:
            # Zaxira yo'l: data_history.json yo'q/bo'sh (masalan birinchi marta ishga
            # tushirilganda) - eski, og'ir, lekin ishonchli Turso usuliga o'tamiz.
            try:
                pav_by_sku, pavm_by_sku = recompute_pav_by_sku(verbose=verbose)
            except Exception as e:
                if verbose:
                    print(f"  ! pav qayta hisobda xato (Turso zaxira yo'li): {e}")
                return 0
        if pav_by_sku:
            try:
                CACHE_PATH.write_text(json.dumps({"ts": time.time(), "pav": pav_by_sku, "pavm": pavm_by_sku},
                                                 ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
            except Exception:
                pass
    elif verbose:
        print(f"  pav keshi yangi ({len(pav_by_sku):,} tovar) — qayta hisoblanmadi")
    return _apply_pav(pav_by_sku, pavm_by_sku, root=root, verbose=verbose)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true", help="keshni e'tiborsiz qoldirib qayta hisoblash")
    args = ap.parse_args()
    n = build_prev_avg(force=args.force)
    print(f"TAYYOR — {n:,} tovarga chuqur zakas pav qo'llandi.")
