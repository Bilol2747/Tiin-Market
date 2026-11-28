"""
data_history.json (Jan 1 dan to'liq tarix) asosida har bir tovarning
JAN 1 DAN OXIRGI SOTUV sanasini hisoblab, data_inv_new.json ga `lsd` qo'shadi.
Stock bo'limi shu orqali "Eskirgan" (avval sotilgan) va "Sotuv yo'q" (umuman
sotilmagan) tovarlarni ajratadi.

build_all_from_api.py history yangilangandan keyin shu funksiyani chaqiradi.
Alohida ishga tushirish: python inject_last_sale.py
"""
import sys, os, json
from datetime import date, timedelta
from pathlib import Path

import history_archive

ROOT = Path(__file__).parent


def inject_last_sale_from_history(root=ROOT, verbose=True):
    hist_path = root / "data_history.json"
    inv_path = root / "data_inv_new.json"
    if not hist_path.exists() or not inv_path.exists():
        if verbose:
            print("  ! data_history.json yoki data_inv_new.json topilmadi — lsd o'tkazib yuborildi")
        return 0

    hist = json.loads(hist_path.read_text(encoding="utf-8"))
    # 2026-08-21: data_history.json endi faqat so'nggi ~5 oyni saqlaydi
    # (history_archive.py) - shundan oldin ARXIVLANGAN oyda oxirgi marta
    # sotilib, o'shandan buyon umuman sotilmagan tovarlar arxiv qo'shilmasa
    # noto'g'ri "Sotuv yo'q" (umuman sotilmagan) deb belgilanardi, aslida
    # ular "Eskirgan" (eski sanada sotilgan) edi - shu farqni saqlash uchun.
    hist = history_archive.expand_hist_with_archives(hist, root, verbose)
    base = date.fromisoformat(hist["base"])
    d_map = hist.get("d", {})

    # Har bir sku uchun oxirgi sotuv kuni (qty>0 bo'lgan eng oxirgi indeks)
    last_sale = {}  # "sku:XXX" -> ISO date
    for key, arr in d_map.items():
        last_idx = -1
        for i in range(len(arr) - 1, -1, -1):
            if arr[i] and arr[i] > 0:
                last_idx = i
                break
        if last_idx >= 0:
            last_sale[key] = (base + timedelta(days=last_idx)).isoformat()

    inv = json.loads(inv_path.read_text(encoding="utf-8"))
    matched = 0
    for name, iv in inv.items():
        if not isinstance(iv, dict):
            continue
        sku = iv.get("sku")
        if not sku:
            continue
        lsd = last_sale.get("sku:" + str(sku))
        if lsd:
            iv["lsd"] = lsd
            matched += 1
        else:
            # Jan 1 dan hech qachon sotilmagan — lsd yo'q (frontend "Sotuv yo'q" deb biladi)
            iv.pop("lsd", None)

    inv_json = json.dumps(inv, ensure_ascii=False, separators=(",", ":"))
    inv_path.write_text(inv_json, encoding="utf-8")

    # 2026-11-20: index.html/sales.html'ga qayta embed qilish (eski
    # _reembed_invdata()) OLIB TASHLANDI. Eski izoh ("Vercel statik saytda
    # frontend embedded nusxadan o'qiydi, API server yo'q") ENDI TO'G'RI EMAS -
    # backend_html_embed.py "invdata"ni 2026-07-15'dan beri ATAYLAB bo'sh
    # qoldiradi (HTML hajmini ~52MB'dan ~1MB'ga tushirish uchun), frontend esa
    # _ensureInvData() orqali bo'sh bo'lsa data_inv_new.json'ni ALOHIDA fetch
    # qiladi. Bu funksiya o'sha optimallashtirishni har build'da bekor qilib,
    # HAR sahifa ochilishida (Stock/Zakas kerak bo'lmasa ham) ~10+ MB ortiqcha
    # yuklatib kelgan edi. data_inv_new.json (yuqorida yozilgan) baribir
    # to'liq va yangi - hech narsa yo'qolmaydi.

    if verbose:
        print(f"      {matched:,} mahsulotga Jan 1 dan oxirgi sotuv sanasi (lsd) qo'shildi")
    return matched


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    n = inject_last_sale_from_history()
    print(f"TAYYOR — {n:,} tovarga lsd qo'shildi.")
