# -*- coding: utf-8 -*-
"""
Mevalar/sabzavotlar kunlik zakasi — "Tiin meva" ichki guruhiga (PDF jadval, Murodjon
yuborgan namunaga o'xshash format, Bilol 2026-10-12).

Formula (boshqa tovarlardagi backend_p_zakas_auto.py'dan FARQLI, mevalar tez
buziladi — uzoq zaxira saqlanmaydi):
  - Ostatka      = Invan'dagi JONLI stok (to'g'ridan-to'g'ri, nazariy hisob emas)
  - Kunlik o'rtacha = oxirgi HISTORY_DAYS (7) kunlik HAQIQIY sotuv (Invan'dan) / 7
  - Bugun sotuv  = bugungi kun (00:00'dan hozirgacha) Invan'dagi haqiqiy sotuv
    (faqat ko'rsatish uchun, PDF'da alohida ustun — hisobga ta'sir qilmaydi,
    2026-10-14 da Bilol so'rovi bilan olib tashlandi)
  - Kunlik talab = kunlik o'rtacha (oxirgi 7 kun)
  - Zaxira kuni  = tovar turiga qarab (namuna PDF schema'siga mos, Bilol 2026-10-13):
      "Зелень" (ko'katlar) kategoriyasi -> 1 kun (tez so'lib qoladi, Bilol 2026-10-16)
      ILDIZMEVALAR ro'yxatidagi nomlar (uzoq saqlanadigan asosiylar) -> 4 kun
      aks holda: tez sotiladigan (kuniga >FAST_KG kg / >FAST_DONA dona) yoki
      "Ягоды" (rezavor) kategoriyasi -> 3 kun
      qolganlari -> DEFAULT_DAYS (2) kun
  - ZAKAZ = max(0, zaxira_kun * kunlik_talab − ostatka), 30dan oshsa 5ga yaxlitlanadi
  - Har tovar o'z guruhiga mos zaxira kuni bilan hisoblanadi — kam sotiladigan
    tovar ro'yxatdan chiqarib tashlanmaydi (2026-10-14, Bilol so'rovi bilan
    MIN_SOLD filtri olib tashlandi)

Ishlatish: python zakas/meva_zakas.py [--send]   (PDF + konsol natija; --send bo'lsa Telegram'ga ham)
"""
import json
import math
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from backend_p_zakas_auto import _invan_token, _sold_since_from_invan  # noqa: E402

# Faqat Invan'dagi "Овощи и фрукты" bo'limi va uning hamma qismlari (Bilol,
# 2026-10-15: muzlatilganlar chiqarildi, ko'katlar/rezavor/qo'ziqorin qo'shildi).
MEVA_CAT = {"Овощи и фрукты", "Овощи", "Фрукты", "Цитрус", "Ягоды", "Зелень", "Грибы"}
SHOP_ID = "aa954511-3801-46f8-a0bd-d41fa7e40369"   # Tiin Optom (invan_stok.js bilan bir xil)
HISTORY_DAYS = 7     # kunlik o'rtacha shu davrdan (Bilol, 2026-10-12)
ROUND_ABOVE = 30     # shu miqdordan oshgan zakaz 5ga yaxlitlanadi
ROUND_STEP = 5

# Zaxira kuni — namuna PDF'dagi uchta pog'ona (kategoriyadan emas, nomdan aniqlanadi, Bilol 2026-10-13):
ILDIZMEVALAR = ["piyoz", "sabzi", "karam", "gulkaram", "qovoq", "chesnok", "lavlagi"]
REZAVOR_CAT = {"Ягоды"}
KOKAT_CAT = {"Зелень"}   # tez so'lib qoladi — har doim 1 kunlik zaxira (Bilol, 2026-10-16)
FAST_KG = 10          # kg tovar kuniga shundan ko'p sotilsa — "tez sotiladigan"
FAST_DONA = 30         # dona tovar kuniga shundan ko'p sotilsa — "tez sotiladigan"
ILDIZMEVA_DAYS = 4
TEZ_REZAVOR_DAYS = 3
DEFAULT_DAYS = 2
KOKAT_DAYS = 1


def _reserve_days(name, cat, is_kg, avg_day):
    if cat in KOKAT_CAT:
        return KOKAT_DAYS
    low = name.lower()
    if any(low.startswith(r) for r in ILDIZMEVALAR):
        return ILDIZMEVA_DAYS
    fast = avg_day > (FAST_KG if is_kg else FAST_DONA)
    if fast or cat in REZAVOR_CAT:
        return TEZ_REZAVOR_DAYS
    return DEFAULT_DAYS


def _fetch_live_meva(token):
    """Mevalar/sabzavot tovarlarini BUTUNLAY jonli Invan katalogidan oladi — nom,
    kategoriya, birlik (kg/dona), tannarx VA stok bitta to'liq sahifalab o'qishdan.
    Eski yondashuv (nom/kategoriya data_inv_new.json'dan, stok alohida so'rovdan)
    xato berardi: lokal kesh eskirganda (masalan tovar o'chirilib, SHU SKU boshqa
    yangi tovarga qayta berilganda) eski nom jonli stokka yopishtirilib, butunlay
    noto'g'ri tovar ko'rsatilardi (masalan SKU 1296 — eski keshda "Silliq bodring
    kg", aslida Invan'da hozir "Anor Chegirma Kg"). Bilol so'rovi bilan 2026-10-14
    da butunlay jonli manbaga o'tkazildi — bunday xato endi imkonsiz.

    Qaytaradi: {sku: {name, cat, kg, rcost, stock}}"""
    import requests

    if not token:
        return {}
    base_url = "https://api.7i.uz/integration/v1"
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    sess = requests.Session()

    out = {}
    page = 1
    while True:
        resp = sess.post(f"{base_url}/products", headers=headers,
                          params={"page": page, "limit": 2000, "active_for_sale": "active"},
                          json={"filters": []}, timeout=60)
        resp.raise_for_status()
        batch = resp.json().get("data", [])
        for p in batch:
            cats = [c.get("name", "") for c in (p.get("categories") or [])]
            cat = next((c for c in cats if c in MEVA_CAT), None)
            if cat is None:
                continue
            sku = str(p.get("sku", "")).strip()
            if not sku:
                continue
            mu = p.get("measurement_unit") or {}
            mv = (p.get("measurement_values") or {}).get(SHOP_ID) or {}
            sp = (p.get("shop_prices") or {}).get(SHOP_ID) or {}
            out[sku] = {
                "name": p.get("name", ""), "cat": cat,
                "kg": mu.get("short_name") == "кг",
                "rcost": float(sp.get("supply_price") or 0),
                "stock": float(mv.get("amount") or 0),
            }
        if len(batch) < 2000:
            break
        page += 1
    return out


def _round_kg(qty):
    """Kg tovar uchun yarim kilogacha yaxlitlash (Bilol, 2026-10-14): kasr qism
    0.6'dan oshsa keyingi butun songa, 0.2-0.6 oralig'ida bo'lsa .5'ga, 0.2'dan
    kam bo'lsa pastki butun songa (shu 0 chiqsa — zakas kerak emas degani)."""
    whole = math.floor(qty)
    frac = qty - whole
    if frac > 0.6:
        return whole + 1
    if frac >= 0.2:
        return whole + 0.5
    return whole


def _round_order(qty, is_kg):
    qty = _round_kg(qty) if is_kg else math.ceil(qty)
    if qty > ROUND_ABOVE:
        qty = math.ceil(qty / ROUND_STEP) * ROUND_STEP
    return qty


def compute_meva_zakas(root=ROOT, verbose=True):
    """Qaytaradi: [{"sku","name","cat","unit","today_sold","avg_day","stock","zakaz","cost"}],
    ZAKAZ kamayish tartibida, keyin zakazsiz tovarlar (ko'rinish uchun, PDF'da alohida bo'lim)."""
    token = _invan_token(root)
    items = _fetch_live_meva(token)

    since_hist = (date.today() - timedelta(days=HISTORY_DAYS)).isoformat() + "T00:00:00Z"
    since_today = datetime.now().strftime("%Y-%m-%d") + "T00:00:00Z"
    sold_hist = _sold_since_from_invan(since_hist, token) if token else {}
    sold_today = _sold_since_from_invan(since_today, token) if token else {}

    if verbose:
        print(f"  Mevalar/sabzavot (jonli Invan'dan): {len(items)} tovar | "
              f"{HISTORY_DAYS} kunlik sotuv ma'lumoti: {len(sold_hist)}")

    result = []
    for sku, meta in items.items():
        stock = meta["stock"]
        sold_h = sold_hist.get(sku, 0.0)
        if sold_h <= 0:
            # oxirgi HISTORY_DAYS kunda umuman sotilmagan — zakas berilmaydi
            # (Bilol, 2026-10-14: eski/o'lik SKU'lar, ko'pincha manfiy stok bilan,
            # hech qanday sotuv faolligisiz noto'g'ri zakaz olib kelardi)
            continue
        avg_day = sold_h / HISTORY_DAYS
        today = sold_today.get(sku, 0.0)
        demand = avg_day
        reserve_days = _reserve_days(meta["name"], meta["cat"], meta["kg"], avg_day)
        # Manfiy ostatka ko'pincha hisobot xatosi (kirim o'z vaqtida yozilmagan),
        # haqiqiy jismoniy kamomad emas — formulada "qarz" sifatida to'liq qo'shib
        # yuborish zakasni sun'iy shishiradi. Shuning uchun 0 deb olinadi: kam
        # hisoblanmaydi, lekin ortiqcha ham qo'shilmaydi (Bilol, 2026-10-14).
        zakaz = max(0.0, reserve_days * demand - max(0.0, stock))
        # Arzimas (yarim kunlik sotuvdan kam) zakas berilmaydi — stok shu tovar
        # bo'yicha hali sotilib turaveradi, ertaga qayta hisoblanadi. Agar yarim
        # kundan ko'p, lekin bir kunlikdan kam bo'lsa — kamida bir kunlik
        # o'rtacha sotuvgacha ko'tariladi (Bilol, 2026-10-14: tez sotiladigan
        # tovarga "arzimas" miqdorda zakaz berish mantiqsiz edi).
        if 0 < zakaz < avg_day / 2:
            zakaz = 0.0
        elif avg_day / 2 <= zakaz < avg_day:
            zakaz = avg_day
        zakaz = _round_order(zakaz, meta["kg"])
        result.append({
            "sku": sku, "name": meta["name"], "cat": meta["cat"],
            "unit": "kg" if meta["kg"] else "dona",
            "today_sold": round(today, 1), "avg_day": round(avg_day, 1),
            "stock": round(stock, 1), "reserve_days": reserve_days,
            "zakaz": zakaz, "cost": meta["rcost"],
        })
    result.sort(key=lambda x: (-x["zakaz"], x["name"]))
    return result


def _pretty_name(name):
    _UNIT = {"kg", "dona", "sht", "1d", "gr", "g"}
    words = [w for w in name.strip().split() if w.lower() not in _UNIT]
    if not words:
        words = name.strip().split()
    if len(words) > 1:
        return f"{words[0].capitalize()} ({' '.join(words[1:])})"
    return words[0].capitalize() if words else name


def _pick_font():
    """Windows'da Arial, Linux CI'da (GitHub Actions) DejaVu Sans — ikkalasi ham
    kirill+lotin harflarni qo'llaydi."""
    candidates = [
        (Path(r"C:\Windows\Fonts\arial.ttf"), Path(r"C:\Windows\Fonts\arialbd.ttf")),
        (Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
         Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")),
    ]
    for regular, bold in candidates:
        if regular.exists():
            return regular, bold if bold.exists() else regular
    raise RuntimeError("Shrift topilmadi (Arial yoki DejaVu Sans kerak)")


def write_pdf(items, out_path):
    from fpdf import FPDF

    font_path, font_bold = _pick_font()
    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=12)
    pdf.add_font("Arial", "", str(font_path))
    pdf.add_font("Arial", "B", str(font_bold))
    pdf.add_page()

    pdf.set_font("Arial", "B", 14)
    pdf.cell(0, 8, "Meva va sabzavotlar bo'limi — avtozakaz", ln=1)
    pdf.set_font("Arial", "", 9)
    today = date.today()
    since = today - timedelta(days=HISTORY_DAYS)
    pdf.multi_cell(0, 5,
        f"Sana: {today.isoformat()} ({datetime.now().strftime('%H:%M')} holati). Do'kon: Tiin Optom. "
        f"Asos: kunlik talab = oxirgi {HISTORY_DAYS} kun ({since.strftime('%d.%m')}-{today.strftime('%d.%m')}) "
        f"o'rtachasi; joriy ostatka. "
        f"Zaxira: ko'katlar (Зелень) {KOKAT_DAYS} kun, ildizmevalar ({', '.join(ILDIZMEVALAR)}) {ILDIZMEVA_DAYS} kun, "
        f"tez sotiladigan (kuniga {FAST_KG} kg / {FAST_DONA} donadan ko'p) va rezavor {TEZ_REZAVOR_DAYS} kun, qolganlari {DEFAULT_DAYS} kun.")
    pdf.ln(2)

    headers = ["#", "Tovar nomi", "Birl.", "Bugun\nsotuv", "Kunlik\no'rtacha", "Ostatka", "Zaxira\n(kun)", "ZAKAZ"]
    widths = [8, 55, 12, 18, 18, 18, 16, 21]

    def table_header():
        from fpdf.enums import XPos, YPos
        pdf.set_font("Arial", "B", 8)
        pdf.set_fill_color(220, 230, 240)
        x0, y0 = pdf.get_x(), pdf.get_y()
        for w, h in zip(widths, headers):
            if "\n" in h:
                pdf.multi_cell(w, 4.5, h, border=1, align="C", fill=True, new_x=XPos.RIGHT, new_y=YPos.TOP)
            else:
                # bitta qatorli sarlavha — ikki qatorli qo'shnilariga balandlik
                # bo'yicha mos tushishi uchun to'liq 9mm balandlikda markazlashtiriladi
                pdf.cell(w, 9, h, border=1, align="C", fill=True,
                         new_x=XPos.RIGHT, new_y=YPos.TOP)
        pdf.set_xy(x0, y0 + 9)

    CAT_LABEL = {
        "Овощи": "SABZAVOTLAR",
        "Зелень": "KO'KATLAR",
        "Ягоды": "REZAVORLAR",
        "Грибы": "QO'ZIQORINLAR",
        "Фрукты": "MEVALAR",
        "Цитрус": "SITRUS MEVALAR",
        "Овощи и фрукты": "MEVA/SABZAVOT (aralash)",
    }
    CAT_ORDER = list(CAT_LABEL.keys())

    def cat_label(cat):
        return CAT_LABEL.get(cat, cat.upper())

    def cat_rank(cat):
        return CAT_ORDER.index(cat) if cat in CAT_ORDER else len(CAT_ORDER)

    # PDF'da avval KATEGORIYA bo'yicha guruhlanadi, har guruh ichida ZAKAZ kamayish tartibida
    # (Telegram xabar uchun `items` ZAKAZ bo'yicha umumiy tartiblangan bo'lib qoladi — bu yerda o'zgarmaydi)
    with_zakaz = sorted((it for it in items if it["zakaz"] > 0), key=lambda x: (cat_rank(x["cat"]), -x["zakaz"]))
    without = sorted((it for it in items if it["zakaz"] == 0), key=lambda x: (cat_rank(x["cat"]), x["name"]))

    n = 1
    last_cat = None
    pdf.set_font("Arial", "", 8)
    for it in with_zakaz:
        if it["cat"] != last_cat:
            last_cat = it["cat"]
            pdf.set_font("Arial", "B", 9)
            pdf.cell(0, 7, cat_label(last_cat), ln=1)
            table_header()
            pdf.set_font("Arial", "", 8)
        row = [str(n), _pretty_name(it["name"]), it["unit"],
               f"{it['today_sold']:g}", f"{it['avg_day']:g}", f"{it['stock']:g}",
               str(it["reserve_days"]), f"{it['zakaz']:g}"]
        aligns = ["C", "L", "C", "C", "C", "C", "C", "C"]
        for w, val, a in zip(widths, row, aligns):
            pdf.cell(w, 7, val, border=1, align=a)
        pdf.ln()
        n += 1

    if without:
        pdf.ln(2)
        pdf.set_font("Arial", "B", 9)
        pdf.cell(0, 7, "ZAKAZ KERAK EMAS (ostatka yetarli)", ln=1)
        table_header()
        pdf.set_font("Arial", "", 8)
        pdf.set_text_color(160, 160, 160)
        for it in without:
            row = [str(n), _pretty_name(it["name"]), it["unit"],
                   f"{it['today_sold']:g}", f"{it['avg_day']:g}", f"{it['stock']:g}",
                   str(it["reserve_days"]), "—"]
            aligns = ["C", "L", "C", "C", "C", "C", "C", "C"]
            for w, val, a in zip(widths, row, aligns):
                pdf.cell(w, 7, val, border=1, align=a)
            pdf.ln()
            n += 1
        pdf.set_text_color(0, 0, 0)

    pdf.ln(2)
    pdf.set_font("Arial", "", 8)
    pdf.multi_cell(0, 4.5,
        f"Zakaz berilishi kerak bo'lgan pozitsiyalar: {len(with_zakaz)} ta. "
        f"Qoldiq Invan'dan jonli olingan; haqiqiy ostatka bilan farq qilishi mumkin — zakazdan oldin javonni tekshiring.")

    pdf.output(str(out_path))


def write_xlsx(items, out_path):
    """Xuddi PDF'dagi kabi, lekin tahrirlanadigan Excel — xodim ZAKAZ ustunini
    qo'lda o'zgartira oladi (Bilol so'rovi bilan, 2026-10-14, PDF tahrirlanmaydi)."""
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment
    from openpyxl.utils import get_column_letter

    CAT_LABEL = {
        "Овощи": "SABZAVOTLAR",
        "Зелень": "KO'KATLAR",
        "Ягоды": "REZAVORLAR",
        "Грибы": "QO'ZIQORINLAR",
        "Фрукты": "MEVALAR",
        "Цитрус": "SITRUS MEVALAR",
        "Овощи и фрукты": "MEVA/SABZAVOT (aralash)",
    }
    CAT_ORDER = list(CAT_LABEL.keys())

    def cat_label(cat):
        return CAT_LABEL.get(cat, cat.upper())

    def cat_rank(cat):
        return CAT_ORDER.index(cat) if cat in CAT_ORDER else len(CAT_ORDER)

    with_zakaz = sorted((it for it in items if it["zakaz"] > 0), key=lambda x: (cat_rank(x["cat"]), -x["zakaz"]))
    without = sorted((it for it in items if it["zakaz"] == 0), key=lambda x: (cat_rank(x["cat"]), x["name"]))

    wb = Workbook()
    ws = wb.active
    ws.title = "Avtozakaz"
    ws.sheet_view.zoomScale = 100

    headers = ["#", "Tovar nomi", "Birl.", "Bugun sotuv", "Kunlik o'rtacha", "Ostatka", "Zaxira (kun)", "ZAKAZ"]
    n_cols = len(headers)

    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=n_cols)
    ws.cell(1, 1, "Meva va sabzavotlar bo'limi — avtozakaz").font = Font(bold=True, size=14)

    HEADER_FILL = PatternFill("solid", fgColor="DCE6F1")
    CAT_FILL = PatternFill("solid", fgColor="1D9E75")
    ZAKAZ_FILL = PatternFill("solid", fgColor="D6F5E3")
    GRAY = Font(color="A0A0A0")

    def write_table_header(row):
        for c, h in enumerate(headers, 1):
            cell = ws.cell(row, c, h)
            cell.font = Font(bold=True)
            cell.fill = HEADER_FILL
            cell.alignment = Alignment(horizontal="center", wrap_text=True)

    r = 3
    n = 1
    last_cat = None
    for it in with_zakaz:
        if it["cat"] != last_cat:
            last_cat = it["cat"]
            ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=n_cols)
            c = ws.cell(r, 1, cat_label(last_cat))
            c.font = Font(bold=True, color="FFFFFF")
            c.fill = CAT_FILL
            r += 1
            write_table_header(r)
            r += 1
        row = [n, _pretty_name(it["name"]), it["unit"], it["today_sold"], it["avg_day"],
               it["stock"], it["reserve_days"], it["zakaz"]]
        for c, val in enumerate(row, 1):
            cell = ws.cell(r, c, val)
            cell.alignment = Alignment(horizontal="center" if c != 2 else "left")
            if c == n_cols:
                cell.font = Font(bold=True)
                cell.fill = ZAKAZ_FILL
        r += 1
        n += 1

    if without:
        r += 1
        ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=n_cols)
        c = ws.cell(r, 1, "ZAKAZ KERAK EMAS (ostatka yetarli)")
        c.font = Font(bold=True)
        r += 1
        write_table_header(r)
        r += 1
        for it in without:
            row = [n, _pretty_name(it["name"]), it["unit"], it["today_sold"], it["avg_day"],
                   it["stock"], it["reserve_days"], "—"]
            for c, val in enumerate(row, 1):
                cell = ws.cell(r, c, val)
                cell.font = GRAY
                cell.alignment = Alignment(horizontal="center" if c != 2 else "left")
            r += 1
            n += 1

    widths = [5, 38, 8, 13, 14, 10, 12, 10]
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = w

    wb.save(out_path)


def format_message(items):
    with_zakaz = [it for it in items if it["zakaz"] > 0]
    if not with_zakaz:
        return "🍎 Bugun mevalar/sabzavotlardan zakas kerak emas — qoldiq yetarli."
    lines = [f"🍎 Bugungi zakas — Tiin meva ({len(with_zakaz)} pozitsiya, Excel biriktirilgan)\n"]
    for it in with_zakaz:
        lines.append(f"• {_pretty_name(it['name'])} — {it['zakaz']:g} {it['unit']}")
    return "\n".join(lines)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    send = "--send" in sys.argv
    result = compute_meva_zakas()
    msg = format_message(result)
    print(f"\n{len([x for x in result if x['zakaz'] > 0])} ta zakaz kerak, "
          f"{len([x for x in result if x['zakaz'] == 0])} ta yetarli:\n")
    print(msg)

    out_pdf = ROOT / "zakas" / f"Meva_sabzavot_zakaz_{date.today().isoformat()}.pdf"
    write_pdf(result, out_pdf)
    print(f"\nPDF: {out_pdf}")

    out_xlsx = ROOT / "zakas" / f"Meva_sabzavot_zakaz_{date.today().isoformat()}.xlsx"
    write_xlsx(result, out_xlsx)
    print(f"Excel (tahrirlanadigan): {out_xlsx}")

    if send:
        import os
        import mimetypes
        import urllib.request
        import uuid

        def send_document(token, chat_id, path):
            boundary = uuid.uuid4().hex
            file_bytes = path.read_bytes()
            parts = [
                f"--{boundary}\r\nContent-Disposition: form-data; name=\"chat_id\"\r\n\r\n{chat_id}\r\n".encode(),
                (f"--{boundary}\r\nContent-Disposition: form-data; name=\"document\"; filename=\"{path.name}\"\r\n"
                 f"Content-Type: {mimetypes.guess_type(path.name)[0] or 'application/octet-stream'}\r\n\r\n").encode()
                + file_bytes + b"\r\n",
                f"--{boundary}--\r\n".encode(),
            ]
            req = urllib.request.Request(
                f"https://api.telegram.org/bot{token}/sendDocument",
                data=b"".join(parts), headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
            )
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.status

        token = os.environ.get("MEVA_BOT_TOKEN", "") or os.environ.get("TELEGRAM_BOT_TOKEN", "")
        chat_id = os.environ.get("TIIN_MEVA_CHAT_ID", "")
        if not token or not chat_id:
            sys.exit("[XATO] MEVA_BOT_TOKEN yoki TIIN_MEVA_CHAT_ID yo'q — yuborilmadi.")
        else:
            data = json.dumps({"chat_id": chat_id, "text": msg}).encode("utf-8")
            req = urllib.request.Request(
                f"https://api.telegram.org/bot{token}/sendMessage",
                data=data, headers={"Content-Type": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=15) as r:
                print("\nXabar yuborildi:", r.status)
            print("Excel yuborildi:", send_document(token, chat_id, out_xlsx))
