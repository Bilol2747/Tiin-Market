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

ROOT = Path(__file__).parent


def inject_last_sale_from_history(root=ROOT, verbose=True):
    hist_path = root / "data_history.json"
    inv_path = root / "data_inv_new.json"
    if not hist_path.exists() or not inv_path.exists():
        if verbose:
            print("  ! data_history.json yoki data_inv_new.json topilmadi — lsd o'tkazib yuborildi")
        return 0

    hist = json.loads(hist_path.read_text(encoding="utf-8"))
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

    # index.html va sales.html ichidagi embedded invdata'ni ham yangilaymiz —
    # Vercel statik saytda frontend embedded nusxadan o'qiydi (API server yo'q)
    _reembed_invdata(root, inv_json, verbose)

    if verbose:
        print(f"      {matched:,} mahsulotga Jan 1 dan oxirgi sotuv sanasi (lsd) qo'shildi")
    return matched


def _reembed_invdata(root, inv_json, verbose=True):
    TAG_OPEN = '<script id="invdata" type="application/json">'
    for name in ("index.html", "sales.html"):
        f = root / name
        if not f.exists():
            continue
        txt = f.read_text(encoding="utf-8")
        i = txt.find(TAG_OPEN)
        if i < 0:
            continue
        start = i + len(TAG_OPEN)
        end = txt.find("</script>", start)
        if end < 0:
            continue
        f.write_text(txt[:start] + inv_json + txt[end:], encoding="utf-8")
        if verbose:
            print(f"      embedded invdata yangilandi -> {name}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    n = inject_last_sale_from_history()
    print(f"TAYYOR — {n:,} tovarga lsd qo'shildi.")
