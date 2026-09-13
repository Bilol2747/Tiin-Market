#!/usr/bin/env python3
"""
Qo'lda tuzatilgan stok (Zakas) — JONLI TUZATISH zanjirining REGRESSIYA TEKSHIRUVI.

Nega kerak: bu zanjir (backend/app.py::_live_invdata() ichidagi `ovEffective`
hisobi) 2026-08-20'da qurilgan, lekin xatosi HECH QANDAY exception/log
BERMAYDI — agar kimdir kelajakda shu qatorlarni (refaktoring, squash-conflict
qayta qo'llash va h.k. paytida) tashlab ketsa, natija shunchaki `ovEffective`
maydonining yo'qligi bo'ladi va frontend jimgina xom `ov.value`ga qaytadi -
foydalanuvchi buni faqat "raqam qotib qoldi" deb HAFTALAR o'tib payqashi
mumkin (aynan shunday bo'lgan edi, 2026-08-19).

Ishlatish:
    python backend/verify_override_adjustment.py
    python backend/verify_override_adjustment.py --base-url https://tiin-market.vercel.app

Chiqish kodi: 0 - hammasi to'g'ri, 1 - kamida bitta override uchun
`ovEffective` yo'q yoki noto'g'ri turdagi qiymat (REGRESSIYA TOPILDI).
"""
import argparse
import sys

import requests

try:
    sys.stdout.reconfigure(encoding="utf-8")
except AttributeError:
    pass  # Python < 3.7 yoki stdout allaqachon boshqa maqsadga bog'langan

DEFAULT_BASE_URL = "https://tiin-market.vercel.app"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base-url", default=DEFAULT_BASE_URL)
    ap.add_argument("--timeout", type=int, default=120, help="invdata so'rovi uchun (soniya)")
    args = ap.parse_args()

    ov_resp = requests.get(f"{args.base_url}/api/stock-override", timeout=30)
    ov_resp.raise_for_status()
    ov_data = ov_resp.json()
    if not ov_data.get("ok"):
        print(f"XATO: /api/stock-override javob bermadi: {ov_data}")
        return 1
    overrides = ov_data.get("overrides") or {}

    if not overrides:
        print("Hozircha faol qo'lda tuzatish yo'q — tekshirish uchun kamida bitta "
              "override kerak (Zakas > Sozlamalar > tovarni tanlab, son kiriting).")
        return 0

    print(f"{len(overrides)} ta faol qo'lda tuzatish topildi, /api/v1/invdata bilan tekshirilmoqda "
          f"(sovuq holatda bir necha o'nlab soniya davom etishi mumkin)...")
    inv_resp = requests.get(f"{args.base_url}/api/v1/invdata", timeout=args.timeout)
    inv_resp.raise_for_status()
    inv = inv_resp.json()

    by_sku = {}
    for name, entry in inv.items():
        sku = str(entry.get("sku") or "")
        if sku:
            by_sku[sku] = {"name": name, **entry}

    failures = []
    for sku, ov in overrides.items():
        entry = by_sku.get(sku)
        if entry is None:
            failures.append(f"  SKU {sku}: invdata'da UMUMAN topilmadi (tovar o'chirilgan/noaktivmi?)")
            continue
        eff = entry.get("ovEffective")
        if eff is None:
            failures.append(
                f"  SKU {sku} ({entry.get('name')}): ovEffective YO'Q — "
                f"REGRESSIYA! Qo'lda kiritilgan qiymat ({ov.get('value')}) "
                f"endi jonli yangilanmaydi.")
            continue
        if not isinstance(eff, (int, float)) or eff < 0:
            failures.append(
                f"  SKU {sku} ({entry.get('name')}): ovEffective noto'g'ri qiymat: {eff!r}")
            continue
        print(f"  OK  SKU {sku:>8} ({entry.get('name')[:40]:<40}) "
              f"kiritilgan={ov.get('value')!s:>8}  jonli={eff!s:>8}")

    print()
    if failures:
        print(f"MUAMMO TOPILDI ({len(failures)}/{len(overrides)}):")
        for f in failures:
            print(f)
        print("\nTekshiring: backend/app.py::_live_invdata() ichidagi "
              "\"KRITIK\" deb belgilangan blok (ovEffective hisoblanadigan joy) "
              "hali ham mavjudmi.")
        return 1

    print(f"Hammasi to'g'ri — {len(overrides)}/{len(overrides)} qo'lda tuzatish jonli yangilanmoqda.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
