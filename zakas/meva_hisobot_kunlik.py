# -*- coding: utf-8 -*-
"""
Mevalar/sabzavotlar/poliz/quruq mevalar bo'limi — BIR KUNLIK sotuv hisoboti.
(Telegramga "zakas yozamiz" deb aytilgan kategoriyalar: Fructy/Ovoshi/Zelen/Yagoda/
Gribi/Suxofrukty-Orexi. Bilol, 2026-10-13.)

Manba: Invan Order API, to'g'ridan-to'g'ri (sayt/Turso'ga bog'liq emas).
Har bir tovar uchun: SKU, shtrix kod, nomi, sotilgan miqdor, tannarx summasi
(supply_price x miqdor), tushum (sof, chegirmadan keyin), marja (tushum-tannarx).

Ishlatish: python zakas/meva_hisobot_kunlik.py [YYYY-MM-DD]   (sana berilmasa — kecha)
"""
import json
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Faqat Invan'dagi "Овощи и фрукты" bo'limi (Bilol, 2026-10-15: quruq meva,
# konserva va muzlatilganlar olib tashlandi — ular boshqa bo'limlarda).
HISOBOT_CAT = {"Овощи и фрукты", "Овощи", "Фрукты", "Цитрус", "Ягоды", "Зелень", "Грибы"}
TASHKENT_OFFSET_H = 5


def _invan_token(root):
    import os
    t = os.environ.get("INVAN_API_TOKEN", "").strip()
    if t:
        return t
    p = root / "api_token.txt"
    return p.read_text(encoding="utf-8").strip() if p.exists() else ""


def _load_categories(root):
    """SKU -> (kategoriya, barcode-zaxira)."""
    inv = json.loads((root / "data_inv_new.json").read_text(encoding="utf-8"))
    out = {}
    for name, iv in inv.items():
        if isinstance(iv, dict) and iv.get("sku"):
            out[str(iv["sku"]).strip()] = {"cat": iv.get("cat", ""), "name": name}
    return out


def _fetch_orders(start_iso, end_iso, token):
    """Berilgan UTC oraliqdagi barcha order'lar (sahifalab, parallel)."""
    import requests
    from concurrent.futures import ThreadPoolExecutor

    base_url = "https://api.7i.uz/integration/v1"
    headers = {"Authorization": f"Bearer {token}"}
    limit = 500
    sess = requests.Session()

    def fetch_page(page):
        resp = sess.get(f"{base_url}/order", headers=headers, timeout=60,
                         params={"page": page, "limit": limit, "start_date": start_iso, "end_date": end_iso})
        resp.raise_for_status()
        body = resp.json()
        return body.get("data", []), int(body.get("total") or 0)

    first_batch, total = fetch_page(1)
    all_orders = list(first_batch)
    n_pages = max(1, (total + limit - 1) // limit)
    if n_pages > 1:
        with ThreadPoolExecutor(max_workers=min(10, n_pages - 1)) as ex:
            for batch, _ in ex.map(fetch_page, range(2, n_pages + 1)):
                all_orders.extend(batch)
    return all_orders


def compute_daily_report(target_date, root=ROOT, verbose=True):
    """target_date: date obyekti (Toshkent kuni). Qaytaradi: [{sku,barcode,name,qty,tannarx,tushum,marja}]."""
    token = _invan_token(root)
    if not token:
        raise RuntimeError("Invan token topilmadi (INVAN_API_TOKEN yoki api_token.txt)")
    cats = _load_categories(root)

    start_utc = datetime(target_date.year, target_date.month, target_date.day) - timedelta(hours=TASHKENT_OFFSET_H)
    end_utc = start_utc + timedelta(days=1)
    start_iso = start_utc.strftime("%Y-%m-%dT%H:%M:%SZ")
    end_iso = end_utc.strftime("%Y-%m-%dT%H:%M:%SZ")

    orders = _fetch_orders(start_iso, end_iso, token)
    if verbose:
        print(f"  {target_date.isoformat()} kuni uchun {len(orders)} ta order olindi")

    agg = {}   # sku -> {barcode,name,qty,tannarx,tushum}
    for o in orders:
        is_refund = o.get("type") != "sale"
        sign = -1 if is_refund else 1
        for it in (o.get("items") or []):
            sku = str(it.get("sku") or "").strip()
            if not sku or sku not in cats or cats[sku]["cat"] not in HISOBOT_CAT:
                continue
            qty = float(it.get("value") or 0)
            if qty == 0:
                continue
            price_total = float(it.get("total_price") or 0)
            supply = float(it.get("supply_price") or 0)
            a = agg.setdefault(sku, {
                "barcode": it.get("barcode") or "", "name": it.get("product_name") or cats[sku]["name"],
                "cat": cats[sku]["cat"], "qty": 0.0, "tannarx": 0.0, "tushum": 0.0,
            })
            a["qty"] += sign * qty
            a["tushum"] += sign * price_total
            a["tannarx"] += sign * supply * qty

    result = []
    for sku, a in agg.items():
        if a["qty"] == 0:
            continue
        marja = a["tushum"] - a["tannarx"]
        result.append({
            "sku": sku, "barcode": a["barcode"], "name": a["name"], "cat": a["cat"],
            "qty": round(a["qty"], 2), "tannarx": round(a["tannarx"]),
            "tushum": round(a["tushum"]), "marja": round(marja),
            "marja_pct": round(100 * marja / a["tushum"], 1) if a["tushum"] else 0,
        })
    result.sort(key=lambda x: -x["tushum"])
    return result


def write_xlsx(items, target_date, out_path):
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment
    from openpyxl.utils import get_column_letter

    wb = Workbook()
    ws = wb.active
    ws.title = "Kunlik hisobot"
    ws.sheet_view.zoomScale = 100

    ws.merge_cells("A1:H1")
    ws["A1"] = f"Meva/sabzavot/poliz/quruq meva — {target_date.isoformat()} kunlik sotuv hisoboti"
    ws["A1"].font = Font(bold=True, size=13)

    headers = ["Shtrix kod", "Tovar nomi", "Invan sub-kategoriyasi", "Sotilgan miqdor", "Tannarx", "Tushum", "Foyda", "Marja %"]
    ws.append([])
    ws.append(headers)
    header_row = ws.max_row
    for c in range(1, len(headers) + 1):
        cell = ws.cell(row=header_row, column=c)
        cell.font = Font(bold=True)
        cell.fill = PatternFill("solid", fgColor="DCE6F1")
        cell.alignment = Alignment(horizontal="center")

    MONEY_FMT = '#,##0 "so\'m"'
    GREEN = Font(color="1D9E75")
    GREEN_BOLD = Font(color="1D9E75", bold=True)

    CENTER = Alignment(horizontal="center")
    LEFT = Alignment(horizontal="left")

    total_tannarx = total_tushum = total_marja = 0
    for it in items:
        ws.append([it["barcode"], it["name"], it["cat"], it["qty"], it["tannarx"], it["tushum"], it["marja"], it["marja_pct"]])
        row = ws.max_row
        for c in range(1, len(headers) + 1):
            ws.cell(row=row, column=c).alignment = LEFT if c == 2 else CENTER
        ws.cell(row=row, column=5).number_format = MONEY_FMT
        ws.cell(row=row, column=6).number_format = MONEY_FMT
        ws.cell(row=row, column=7).number_format = MONEY_FMT
        ws.cell(row=row, column=7).font = GREEN
        ws.cell(row=row, column=8).number_format = '0.0"%"'
        total_tannarx += it["tannarx"]
        total_tushum += it["tushum"]
        total_marja += it["marja"]

    ws.append(["", "JAMI", "", "", total_tannarx, total_tushum, total_marja,
                round(100 * total_marja / total_tushum, 1) if total_tushum else 0])
    total_r = ws.max_row
    ws.row_dimensions[total_r].height = 22
    for c in range(1, len(headers) + 1):
        cell = ws.cell(row=total_r, column=c)
        cell.font = Font(bold=True, size=12)
        cell.fill = PatternFill("solid", fgColor="F2F2F2")
        cell.alignment = LEFT if c == 2 else CENTER
    ws.cell(row=total_r, column=5).number_format = MONEY_FMT
    ws.cell(row=total_r, column=6).number_format = MONEY_FMT
    ws.cell(row=total_r, column=7).number_format = MONEY_FMT
    ws.cell(row=total_r, column=7).font = Font(bold=True, size=12, color="1D9E75")
    ws.cell(row=total_r, column=8).number_format = '0.0"%"'

    widths = [16, 40, 30, 14, 16, 16, 16, 10]
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = w

    wb.save(out_path)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    send = "--send" in sys.argv
    args = [a for a in sys.argv[1:] if a != "--send"]
    if args:
        target = date.fromisoformat(args[0])
    else:
        target = date.today() - timedelta(days=1)

    result = compute_daily_report(target)
    print(f"\n{len(result)} ta tovar sotilgan {target.isoformat()} kunida:\n")
    total_tushum = sum(x["tushum"] for x in result)
    total_marja = sum(x["marja"] for x in result)
    for it in result[:15]:
        print(f"  {it['name'][:40]:40s} {it['qty']:>8g}  tushum {it['tushum']:>10,} so'm  marja {it['marja']:>9,} so'm ({it['marja_pct']}%)".replace(",", " "))
    if len(result) > 15:
        print(f"  ... yana {len(result) - 15} ta tovar")
    print(f"\nJAMI tushum: {total_tushum:,.0f} so'm | JAMI marja: {total_marja:,.0f} so'm ({100*total_marja/total_tushum:.1f}%)".replace(",", " "))

    out = ROOT / "zakas" / f"Meva_sabzavot_hisobot_{target.isoformat()}.xlsx"
    write_xlsx(result, target, out)
    print(f"\nExcel: {out}")

    if send:
        import os
        import urllib.request
        import uuid

        token = os.environ.get("MEVA_BOT_TOKEN", "")
        chat_ids = [c.strip() for c in os.environ.get("HISOBOT_CHAT_ID", "").split(",") if c.strip()]
        if not token or not chat_ids:
            sys.exit("[XATO] MEVA_BOT_TOKEN yoki HISOBOT_CHAT_ID yo'q — yuborilmadi.")
        caption = (f"Meva/sabzavot — {target.strftime('%d.%m.%Y')} kunlik sotuv hisoboti\n"
                   f"Tushum: {total_tushum:,.0f} so'm | Foyda: {total_marja:,.0f} so'm "
                   f"({100*total_marja/total_tushum:.1f}%)").replace(",", " ")
        for chat_id in chat_ids:
            boundary = uuid.uuid4().hex
            parts = [
                f"--{boundary}\r\nContent-Disposition: form-data; name=\"chat_id\"\r\n\r\n{chat_id}\r\n".encode(),
                f"--{boundary}\r\nContent-Disposition: form-data; name=\"caption\"\r\n\r\n{caption}\r\n".encode(),
                (f"--{boundary}\r\nContent-Disposition: form-data; name=\"document\"; filename=\"{out.name}\"\r\n"
                 f"Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n").encode()
                + out.read_bytes() + b"\r\n",
                f"--{boundary}--\r\n".encode(),
            ]
            req = urllib.request.Request(
                f"https://api.telegram.org/bot{token}/sendDocument", data=b"".join(parts),
                headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
            )
            with urllib.request.urlopen(req, timeout=30) as r:
                print(f"Yuborildi -> {chat_id}:", r.status)
