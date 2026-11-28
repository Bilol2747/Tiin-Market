#!/usr/bin/env python3
"""
publish_live_data.py — `invdata`/`kirimdata`ning "jonli" (15 daqiqalik)
nusxasini Vercel'dan TASHQARIDA (GitHub Actions, har 15 daqiqada) hisoblab,
natijani static JSON fayl sifatida yozadi.

SABAB (2026-09-23): frontend (`_bgSilentRefresh`, sales_runtime.js) avval
shu ikki ma'lumotni to'g'ridan-to'g'ri Vercel serverless funksiyadan
(`/api/v1/invdata`, `/api/v1/kirimdata`) olardi - bu Vercel'ning "Fast
Origin Transfer" (CDN<->Compute) kvotasini (Hobby, 10GB/oy) bir necha
kunda tugatib qo'ygan (invdata ~13MB/chaqiruv, ko'p tab/qurilma fonda ham
davom etardi). Bu skript AYNAN BIR XIL hisob funksiyalarini
(`backend.app._live_invdata`/`_live_kirimdata` - o'zgartirilmagan, faqat
import qilinadi) alohida (GitHub Actions, PUBLIC repo - bepul, cheksiz)
ishga tushiradi va natijani static faylga yozadi. Workflow bu faylni
`live-data-latest` tag'iga (Vercel deploy yaratmaydi) push qiladi, frontend
esa endi Vercel funksiyasi o'rniga shu faylni raw.githubusercontent.com orqali o'qiydi -
Vercel Compute UMUMAN ishlamaydi, demak Origin Transfer'ga kirmaydi.

Ishlatish:
    python backend/publish_live_data.py <chiqish_papkasi>
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(HERE))


def _patch_blob_dependencies(kirim_state_path):
    """`BLOB_READ_WRITE_TOKEN` Vercel'da "Sensitive" deb belgilangan - bir
    marta yaratilgandan keyin HECH QACHON (dashboard/API/CLI - hech biri
    bilan) qayta o'qib bo'lmaydi, shuning uchun GitHub Actions'ga berib
    bo'lmaydi. `backend/app.py`ning ikkita Blob-bog'liq funksiyasini shu
    yerda (FAQAT shu skript jarayonida - manba fayl O'ZGARTIRILMAYDI,
    Vercel'dagi asl nusxaga hech qanday ta'sir yo'q) almashtiramiz:
      * qo'lda stok tuzatishlari - Vercel Blob'ga to'g'ridan-to'g'ri emas,
        ALLAQACHON PUBLIC bo'lgan `/api/stock-override` GET orqali (token
        talab qilmaydi, va bu endpoint 2026-09-23'da Blob LIST-keshlash
        bilan allaqachon arzon qilingan).
      * kirim tarixi keshi - Blob o'rniga shu branch'ning o'zida
        (`live/kirim_state.json`, worktree'lar orasida git orqali saqlanadi)."""
    import backend.app as app_mod
    import requests

    def _http_overrides():
        try:
            r = requests.get("https://tiin-market.vercel.app/api/stock-override", timeout=15)
            r.raise_for_status()
            return (r.json() or {}).get("overrides") or {}
        except Exception:
            return {}

    def _git_kirim_get():
        try:
            return json.loads(kirim_state_path.read_text(encoding="utf-8"))
        except Exception:
            return None

    def _git_kirim_put(data):
        try:
            kirim_state_path.parent.mkdir(parents=True, exist_ok=True)
            kirim_state_path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        except Exception:
            pass

    app_mod._fetch_stock_overrides = _http_overrides
    app_mod._kirim_blob_get = _git_kirim_get
    app_mod._kirim_blob_put = _git_kirim_put


def main():
    out_dir = Path(sys.argv[1] if len(sys.argv) > 1 else "live")
    out_dir.mkdir(parents=True, exist_ok=True)

    _patch_blob_dependencies(out_dir / "kirim_state.json")
    from backend.app import _live_invdata, _live_kirimdata

    print("invdata hisoblanmoqda...")
    inv = _live_invdata()
    inv_path = out_dir / "invdata.json"
    inv_path.write_text(json.dumps(inv, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"  -> {inv_path} ({inv_path.stat().st_size / 1048576:.2f} MB, {len(inv)} ta mahsulot)")

    print("kirimdata hisoblanmoqda...")
    kirim = _live_kirimdata()
    kirim_path = out_dir / "kirimdata.json"
    kirim_path.write_text(json.dumps(kirim, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    n_skus = len((kirim or {}).get("skus") or {})
    print(f"  -> {kirim_path} ({kirim_path.stat().st_size / 1048576:.2f} MB, {n_skus} ta SKU)")

    meta = {"published_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat()}
    (out_dir / "meta.json").write_text(json.dumps(meta), encoding="utf-8")
    print("Tayyor.")


if __name__ == "__main__":
    main()
