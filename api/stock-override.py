"""
Vercel Serverless Funksiya: Zakas/Stock qo'lda stok tuzatishi (stock_overrides).
─────────────────────────────────────────────────────────────────────────
Backend (backend_p_calc_stock.py) hisoblagan "calcStock" ba'zan xato bo'lishi
mumkin (kirim hujjatlari to'liq emas, Invan chalkashgan va h.k.). Bu yerda
menejer jismonan sanab, to'g'ri qiymatni to'g'ridan-to'g'ri saytdan kirita
oladi - BARCHA qurilmalarda/foydalanuvchilarda darhol ko'rinadi (frontend
har Zakas/Stock ochilganda shu funksiyani GET qiladi).

MUHIM: bu backend_p_calc_stock.py'ning o'zini o'zgartirmaydi - calcStock
modeli avvalgidek har build'da qayta hisoblanaveradi. Bu qo'lda tuzatish
FAQAT frontendda, calcStock USTIGA (yuqori ustuvorlik bilan) qo'llaniladi.

2026-08-17: Turso'dan Vercel Blob'ga KO'CHIRILDI (Bilol so'rovi - "Turso
aralashuvisiz"). Sabab: bu funksiya alohida Turso hisobiga bog'liq edi
(bugungi asosiy Turso olib tashlash ishiga kirmagan edi), va o'sha hisob
ham yozish kvotasidan chiqib ketgan edi ("BLOCKED: SQL write operations
are forbidden") - qo'lda tuzatish HATTO O'QISH ham ishlamay qolgan edi.
Ma'lumot juda kichik (bir necha o'nlab SKU, kamdan-kam yangilanadi) -
bitta JSON fayl (`stock-overrides.json`) sifatida Vercel Blob'da
saqlanadi, har POST'da butunlay qayta yoziladi (o'qib-o'zgartirib-yozish).

Kerakli Environment Variable (Vercel → Storage → Blob → Connect to Project
bilan avtomatik qo'shiladi):
  BLOB_READ_WRITE_TOKEN
Ixtiyoriy:
  STOCK_OVERRIDE_SECRET  - o'rnatilsa POST uchun x-bridge-secret header talab qilinadi
─────────────────────────────────────────────────────────────────────────
"""
import json
import os
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler
from urllib.parse import quote

import requests

BLOB_API = "https://blob.vercel-storage.com"
PATHNAME = "stock-overrides.json"


def _token():
    t = os.environ.get("BLOB_READ_WRITE_TOKEN", "").strip()
    if not t:
        raise RuntimeError("BLOB_READ_WRITE_TOKEN o'rnatilmagan")
    return t


def _find_blob_url(token):
    """LIST API orqali `PATHNAME` bilan mos blobni topadi (topilmasa None -
    hali birorta tuzatish saqlanmagan degani, xatolik emas)."""
    resp = requests.get(
        BLOB_API, headers={"Authorization": f"Bearer {token}", "x-api-version": "7"},
        params={"prefix": PATHNAME, "limit": 10}, timeout=15)
    resp.raise_for_status()
    for b in resp.json().get("blobs", []):
        if b.get("pathname") == PATHNAME:
            return b.get("url")
    return None


def _get_overrides(token):
    """Joriy tuzatishlar ro'yxati. Blob hali mavjud bo'lmasa - bo'sh dict
    (birinchi marta ishlatilganda tabiiy holat, xatolik emas).

    cache=0: Vercel CDN private blob'ni qayta yozilgandan keyin ~60 soniyagacha
    eski nusxani qaytarishi mumkin (rasmiy hujjatlashtirilgan xulq-atvor).
    Ma'lumot juda kichik va kamdan-kam o'qiladi, shuning uchun har doim
    to'g'ridan-to'g'ri (kesh chetlab) o'qiymiz - qo'lda tuzatish darhol
    ko'rinishi kerak."""
    url = _find_blob_url(token)
    if not url:
        return {}
    resp = requests.get(
        url, headers={"Authorization": f"Bearer {token}"},
        params={"cache": "0"}, timeout=15)
    resp.raise_for_status()
    return resp.json()


def _put_overrides(overrides, token):
    """Butun ro'yxatni bitta JSON sifatida qayta yozadi (kichik hajm - bir
    necha o'nlab yozuv, qisman yangilash shart emas)."""
    body = json.dumps(overrides, ensure_ascii=False).encode("utf-8")
    resp = requests.put(
        f"{BLOB_API}/{quote(PATHNAME)}", data=body, timeout=15,
        headers={
            "Authorization": f"Bearer {token}",
            "x-api-version": "7",
            "content-type": "application/json",
            "x-add-random-suffix": "0",
            "x-allow-overwrite": "1",
            "x-vercel-blob-access": "private",  # to'g'ri sarlavha nomi shu -
                                     # "x-access" emas (2026-08-17: @vercel/blob
                                     # SDK manbasidan tasdiqlandi, putOptionHeaderMap
                                     # access -> 'x-vercel-blob-access')
        })
    if not resp.ok:
        # 2026-08-17: Vercel Blob'ning aniq REST sarlavha talablari to'liq
        # hujjatlashtirilmagan (rasmiy Python SDK yo'q) - shu sabab birinchi
        # urinishda 400 chiqqan edi. Xato JAVOB MATNINI ko'rsatib, tuzatishni
        # tez topish uchun.
        raise RuntimeError(f"Blob PUT {resp.status_code}: {resp.text[:300]}")


class handler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, x-bridge-secret")

    def _json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self._cors()
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        try:
            overrides = _get_overrides(_token())
            self._json(200, {"ok": True, "overrides": overrides})
        except Exception as e:
            self._json(500, {"ok": False, "error": str(e)})

    def do_POST(self):
        try:
            secret = os.environ.get("STOCK_OVERRIDE_SECRET", "").strip()
            if secret and self.headers.get("x-bridge-secret") != secret:
                self._json(401, {"ok": False, "error": "Ruxsat yo'q (secret mos emas)"})
                return
            length = int(self.headers.get("Content-Length") or 0)
            raw = self.rfile.read(length) if length else b"{}"
            body = json.loads(raw or b"{}")
            sku = str(body.get("sku") or "").strip()
            if not sku:
                self._json(400, {"ok": False, "error": "sku kerak"})
                return
            updated_by = str(body.get("updated_by") or "").strip()[:120]
            note = str(body.get("note") or "").strip()[:500]
            now = datetime.now(timezone.utc).isoformat()

            token = _token()
            overrides = _get_overrides(token)

            # value=null (yoki delete:true) - tuzatishni OLIB TASHLAYDI, avtomatik
            # modelga (calcStock) qaytaradi.
            if body.get("delete") or body.get("value") is None:
                overrides.pop(sku, None)
                _put_overrides(overrides, token)
                self._json(200, {"ok": True, "sku": sku, "deleted": True})
                return
            try:
                value = float(body.get("value"))
            except (TypeError, ValueError):
                self._json(400, {"ok": False, "error": "value raqam bo'lishi kerak"})
                return
            if value < 0:
                self._json(400, {"ok": False, "error": "value manfiy bo'lishi mumkin emas"})
                return

            overrides[sku] = {
                "value": value, "note": note,
                "updated_by": updated_by, "updated_at": now,
            }
            _put_overrides(overrides, token)
            self._json(200, {"ok": True, "sku": sku, "value": value, "updated_by": updated_by, "updated_at": now})
        except Exception as e:
            self._json(500, {"ok": False, "error": str(e)})
