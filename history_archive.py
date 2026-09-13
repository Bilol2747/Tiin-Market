"""
history_archive.py — data_history.json cheksiz o'sib, GitHub'ning 100MB fayl
chegarasidan oshib ketishining oldini oladi.

MUAMMO (2026-08-21): data_history.json 2026-yil 1-yanvardan boshlab HAR KUN
o'sib boruvchi yagona fayl edi - 100.88 MB'ga yetganda GitHub push'ni butunlay
rad eta boshladi ("pre-receive hook declined"), butun "sekin qatlam" (p1/p3/
p6/p9/p10/p11) yangilanishi to'xtab qoldi.

YECHIM: "issiq/sovuq" (hot/cold) bo'linish. Faol `data_history.json` endi
FAQAT oxirgi HOT_WINDOW_DAYS kunni saqlaydi (doim kichik, chegaraga hech
qachon yetmaydi). Undan eski, TO'LIQ o'tgan kalendar oylar HAR build'da
avtomatik ravishda alohida, o'zgarmas arxiv fayllarga (`data_history_archive_
YYYY-MM.json`) ko'chirib chiqariladi va faol fayldan olib tashlanadi -
shuning uchun bu tizim o'z-o'zini abadiy cheklab turadi, qayta qo'lda
"bo'lish" operatsiyasi hech qachon kerak bo'lmaydi.

Hisob formulalarining BIRORTASI ham bu yerda o'zgarmaydi/takrorlanmaydi -
faqat ma'lumot QAYERDA saqlanishi bo'linadi (invan_orders.py'dagi bilan bir
xil tamoyil: "vositachi" qo'shilmaydi, faqat joylashuv o'zgaradi).
"""
import calendar
import json
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).parent
HOT_WINDOW_DAYS = 150  # ~5 oy - joriy o'sish sur'atida (~0.36MB/kun) ~54MB, GitHub'ning
                        # 100MB chegarasidan xavfsiz masofada (foydalanuvchi so'rovi, 2026-08-21)
ARCHIVE_INDEX_PATH = ROOT / "data_history_archive_index.json"
FIELDS = ["d", "r", "rc", "wi", "we", "rt", "rr", "wri", "wre", "qf", "rf"]
MONTHS_UZ = {1: "Yanvar", 2: "Fevral", 3: "Mart", 4: "Aprel", 5: "May", 6: "Iyun",
             7: "Iyul", 8: "Avgust", 9: "Sentabr", 10: "Oktabr", 11: "Noyabr", 12: "Dekabr"}


def _month_key(d):
    return f"{d.year:04d}-{d.month:02d}"


def _month_bounds(month_key):
    y, m = (int(x) for x in month_key.split("-"))
    start = date(y, m, 1)
    days_in_month = calendar.monthrange(y, m)[1]
    end = date(y, m, days_in_month)  # oyning oxirgi kuni (inklyuziv)
    return start, end


def load_archive_index():
    if ARCHIVE_INDEX_PATH.exists():
        try:
            return json.loads(ARCHIVE_INDEX_PATH.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {"months": []}


def save_archive_index(idx):
    ARCHIVE_INDEX_PATH.write_text(
        json.dumps(idx, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def _slice_maps(maps, fields, day_from, day_to_excl):
    """maps[f][key] massivlarining [day_from:day_to_excl] qismini ajratib oladi.
    Faqat shu oralikda kamida bitta nolmas qiymati bor kalitlar saqlanadi -
    arxiv faylini keraksiz bo'sh qatorlardan tozalash uchun."""
    out = {f: {} for f in fields}
    keys = set()
    for f in fields:
        keys |= set(maps.get(f, {}).keys())
    for key in keys:
        any_nonzero = False
        sliced = {}
        for f in fields:
            arr = maps.get(f, {}).get(key, [])
            piece = arr[day_from:day_to_excl] if len(arr) > day_from else []
            if len(piece) < (day_to_excl - day_from):
                piece = piece + [0] * ((day_to_excl - day_from) - len(piece))
            if any(piece):
                any_nonzero = True
            sliced[f] = piece
        if any_nonzero:
            for f in fields:
                out[f][key] = sliced[f]
    return out


def _monthly_revenue_for_range(rev_map, history_base, day_from, day_to_excl):
    """[day_from:day_to_excl] oralig'idagi kunlik tushumni oy bo'yicha jamlaydi
    (build_all_from_api.py'dagi _compute_monthly_revenue_rollup bilan bir xil
    mantiq, faqat cheklangan oraliq uchun)."""
    months = {}
    for i in range(day_from, day_to_excl):
        d = history_base + timedelta(days=i)
        key = (d.year, d.month)
        months.setdefault(key, 0.0)
    for arr in rev_map.values():
        for i in range(day_from, min(day_to_excl, len(arr))):
            d = history_base + timedelta(days=i)
            key = (d.year, d.month)
            months[key] = months.get(key, 0.0) + (arr[i] or 0)
    out = []
    for (y, m) in sorted(months.keys()):
        out.append({"label": MONTHS_UZ[m], "rev": round(months[(y, m)]), "monthKey": f"{y:04d}-{m:02d}"})
    return out


def archive_old_months(maps, total_days, history_base):
    """Faol oynadan (HOT_WINDOW_DAYS) eski, TO'LIQ o'tgan kalendar oylarni
    alohida arxiv fayllariga chiqarib tashlaydi.

    Qaytaradi: (yangi_maps, yangi_base, yangi_total_days, arxivlangan_oylar_royxati,
    arxivlangan_oylarning_tushum_royxati_monthly_rev_uchun)
    """
    today = history_base + timedelta(days=total_days - 1)
    hot_start_raw = today - timedelta(days=HOT_WINDOW_DAYS - 1)
    # Oy chegarasiga tekislaymiz (oyning 1-kuniga) - aks holda oy o'rtasidan
    # kesilib, arxiv (to'liq oylar) bilan faol oyna orasida "yetim" kunlar
    # (hech qayerga tegishli bo'lmagan) paydo bo'lardi.
    hot_start = date(hot_start_raw.year, hot_start_raw.month, 1)

    idx = load_archive_index()
    already_archived = set(idx.get("months", []))
    newly_archived = []
    archived_monthly_rev = []

    # Faqat "hot_start"dan OLDIN TUGAYDIGAN (to'liq o'tgan) oylarni arxivlaymiz -
    # hozirgi/qisman oyni hech qachon arxivlamaymiz (u hali o'zgarib turadi).
    cursor = history_base
    while True:
        mk = _month_key(cursor)
        m_start, m_end = _month_bounds(mk)
        if m_end >= hot_start:
            break  # bu oy hali "issiq" oynaga tegib turibdi yoki kelajakda
        day_from = (m_start - history_base).days
        day_to_excl = (m_end - history_base).days + 1
        day_from = max(0, day_from)
        day_to_excl = min(total_days, day_to_excl)
        if day_from >= day_to_excl:
            cursor = m_end + timedelta(days=1)
            continue
        if mk not in already_archived:
            archived = _slice_maps(maps, FIELDS, day_from, day_to_excl)
            out = {"base": m_start.isoformat(), "days": day_to_excl - day_from}
            out.update(archived)
            archive_path = ROOT / f"data_history_archive_{mk}.json"
            archive_path.write_text(
                json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
            rev_map = maps.get("r", {})
            archived_monthly_rev.extend(
                _monthly_revenue_for_range(rev_map, history_base, day_from, day_to_excl))
            newly_archived.append(mk)
        cursor = m_end + timedelta(days=1)

    if newly_archived:
        idx["months"] = sorted(set(idx.get("months", [])) | set(newly_archived))
        save_archive_index(idx)

    # Faol oynani hot_start'dan boshlab qayta kesib olamiz (avval arxivlangan
    # oylar, HATTO shu run'da YANGI arxivlanmagan bo'lsa ham - masalan avvalgi
    # run'da allaqachon arxivlangan bo'lsa - baribir faol fayldan olib
    # tashlanishi kerak).
    trim_from = max(0, (hot_start - history_base).days)
    new_base = history_base + timedelta(days=trim_from)
    new_total_days = total_days - trim_from
    new_maps = {}
    for f in FIELDS:
        new_maps[f] = {}
        for key, arr in maps.get(f, {}).items():
            piece = arr[trim_from:total_days] if len(arr) > trim_from else []
            if any(piece):
                new_maps[f][key] = piece

    return new_maps, new_base, new_total_days, newly_archived, archived_monthly_rev


def expand_hist_with_archives(hist, root=ROOT, verbose=True):
    """`data_history.json`ni O'QIYDIGAN har qanday tomon (calcStock, zakas ABC,
    pav, lsd va h.k.) uchun umumiy yordamchi - arxivga chiqarilgan oylarni
    QAYTA BIRLASHTIRIB, avvalgidek TO'LIQ, uzluksiz vaqt qatorini beradi.

    MUHIM: hisob formulalarining o'zi (chaqiruvchi tomonda) bir harf ham
    o'zgarmaydi - bu funksiya faqat KIRISH ma'lumotini to'liqlantiradi.
    Arxivsiz (yoki arxiv yo'q/bo'sh) holatda hech narsa qilmay, `hist`ni
    o'zgarishsiz qaytaradi - xavfsiz, hamma joyda chaqirish mumkin."""
    idx_path = root / "data_history_archive_index.json"
    if not idx_path.exists():
        return hist
    try:
        months = sorted(json.loads(idx_path.read_text(encoding="utf-8")).get("months", []))
    except Exception:
        return hist
    if not months:
        return hist

    hist_base = date.fromisoformat(hist["base"])
    hist_days = hist.get("days", 0)
    maps = {f: dict(hist.get(f, {})) for f in FIELDS if f in hist}
    n_merged = 0
    for mk in reversed(months):  # eng yaqinidan (hist_base'ga tutash oy) uzoqqa qarab
        p = root / f"data_history_archive_{mk}.json"
        if not p.exists():
            break
        try:
            arc = json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            break
        arc_base = date.fromisoformat(arc["base"])
        arc_days = arc.get("days", 0)
        if arc_base + timedelta(days=arc_days) != hist_base:
            # Bu arxiv hozirgi bo'lakning boshiga TO'G'RIDAN-TO'G'RI tutashmaydi
            # (masalan bir oy yo'qolgan) - xato joyga ulab qo'yishdan ko'ra shu
            # yerda to'xtaymiz.
            if verbose:
                print(f"  ! OGOHLANTIRISH: arxiv {mk} hist_base={hist_base}ga tutashmaydi - "
                      f"undan nariga birlashtirilmadi")
            break
        for f in list(maps.keys()):
            arc_f = arc.get(f, {})
            cur_f = maps[f]
            merged = {}
            for key in set(cur_f.keys()) | set(arc_f.keys()):
                merged[key] = list(arc_f.get(key, [0] * arc_days)) + list(cur_f.get(key, [0] * hist_days))
            maps[f] = merged
        hist_base = arc_base
        hist_days += arc_days
        n_merged += 1
    if n_merged and verbose:
        print(f"  i {n_merged} ta arxivlangan oy qayta birlashtirildi (endi {hist_base} dan boshlanadi)")
    return {**hist, "base": hist_base.isoformat(), "days": hist_days, **maps}


def load_all_archived_monthly_rev():
    """Barcha arxivlangan oylarning tushum ro'yxatini qaytaradi (data_monthly_rev.json
    uchun - faol oynaning "yangi" hisobiga qo'shib yuboriladi, eski oylar
    yo'qolib qolmasligi uchun)."""
    idx = load_archive_index()
    out = []
    for mk in sorted(idx.get("months", [])):
        p = ROOT / f"data_history_archive_{mk}.json"
        if not p.exists():
            continue
        try:
            d = json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            continue
        base = date.fromisoformat(d["base"])
        out.extend(_monthly_revenue_for_range(d.get("r", {}), base, 0, d["days"]))
    return out
