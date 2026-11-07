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

2026-10-03: Blob'dan GitHub `auto-data` branch'iga ko'chirildi (pastda izoh).
Kerakli Environment Variable:
  GITHUB_PAT
Ixtiyoriy:
  STOCK_OVERRIDE_SECRET  - o'rnatilsa POST uchun x-bridge-secret header talab qilinadi
─────────────────────────────────────────────────────────────────────────
"""
import base64
import json
import os
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler

import requests

# 2026-10-03: Vercel Blob'dan GitHub'ga KO'CHIRILDI (Bilol). Blob 2026-09-23 dan beri 403 beradi
# (Hobby "Blob Advanced Operations" kvotasi) - 16.09 dan keyin birorta tuzatish saqlanmagan edi.
# Endi repo'ning `auto-data` branch'idagi bitta JSON fayl (zakas nazorati fayllari bilan bir joyda,
# api/zakas-auto-firms.js bilan bir xil naqsh). vercel.json: auto-data push'i deploy qilmaydi.
# Har POST = bitta commit (kim, qachon, qaysi SKU - tarix GitHub'da qoladi).
# Kerakli env: GITHUB_PAT (Vercel'da allaqachon bor - zakas-auto-firms.js ishlatadi).
GITHUB_API = "https://api.github.com"
GITHUB_REPO = "Bilol2747/Tiin-Market"
DATA_BRANCH = "auto-data"
DATA_FILE = "stock_overrides.json"


def _token():
    t = os.environ.get("GITHUB_PAT", "").strip()
    if not t:
        raise RuntimeError("GITHUB_PAT o'rnatilmagan")
    return t


def _gh(method, path, token, **kw):
    return requests.request(
        method, GITHUB_API + path, timeout=15,
        headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"}, **kw)


def _get_overrides_sha(token):
    """(tuzatishlar dict, fayl sha). Fayl hali yo'q bo'lsa - ({}, None)."""
    r = _gh("GET", f"/repos/{GITHUB_REPO}/contents/{DATA_FILE}", token, params={"ref": DATA_BRANCH})
    if r.status_code == 404:
        return {}, None
    r.raise_for_status()
    f = r.json()
    try:
        data = json.loads(base64.b64decode(f.get("content") or "").decode("utf-8") or "{}")
    except ValueError:
        data = {}
    return (data if isinstance(data, dict) else {}), f.get("sha")


def _get_overrides(token):
    return _get_overrides_sha(token)[0]


def _put_overrides(overrides, sha, token, message):
    """Butun ro'yxatni qayta yozadi. sha mos kelmasa (parallel yozuv) GitHub 409/422 qaytaradi -
    chaqiruvchi qayta o'qib, o'zgarishni qayta qo'llaydi."""
    body = {
        "message": message,
        "content": base64.b64encode(
            (json.dumps(overrides, ensure_ascii=False, indent=1, sort_keys=True) + "\n").encode("utf-8")).decode("ascii"),
        "branch": DATA_BRANCH,
    }
    if sha:
        body["sha"] = sha
    r = _gh("PUT", f"/repos/{GITHUB_REPO}/contents/{DATA_FILE}", token, json=body)
    if not r.ok:
        err = RuntimeError(f"GitHub PUT {r.status_code}: {r.text[:200]}")
        err.status = r.status_code
        raise err


def _apply_change(token, sku, change, message):
    """change(overrides) ro'yxatni o'zgartiradi; parallel yozuvda 3 martagacha qayta urinadi."""
    for attempt in range(3):
        overrides, sha = _get_overrides_sha(token)
        change(overrides)
        try:
            _put_overrides(overrides, sha, token, message)
            return
        except RuntimeError as e:
            if getattr(e, "status", None) not in (409, 422) or attempt == 2:
                raise
            time.sleep(0.5 * (attempt + 1))


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
            who = updated_by or "?"

            # value=null (yoki delete:true) - tuzatishni OLIB TASHLAYDI, avtomatik
            # modelga (calcStock) qaytaradi.
            if body.get("delete") or body.get("value") is None:
                _apply_change(token, sku, lambda ov: ov.pop(sku, None),
                              f"Stok tuzatish olib tashlandi: SKU {sku} ({who})")
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

            entry = {"value": value, "note": note, "updated_by": updated_by, "updated_at": now}
            _apply_change(token, sku, lambda ov: ov.__setitem__(sku, entry),
                          f"Stok tuzatish: SKU {sku} = {value:g} ({who})")
            self._json(200, {"ok": True, "sku": sku, "value": value, "updated_by": updated_by, "updated_at": now})
        except Exception as e:
            self._json(500, {"ok": False, "error": str(e)})
