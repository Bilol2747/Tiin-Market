"""
Vercel Serverless Funksiya: Zakas/Stock qo'lda stok tuzatishi (stock_overrides).
─────────────────────────────────────────────────────────────────────────
Backend (backend_p_calc_stock.py) hisoblagan "calcStock" ba'zan xato bo'lishi
mumkin (kirim hujjatlari to'liq emas, Invan chalkashgan va h.k.). Bu yerda
menejer jismonan sanab, to'g'ri qiymatni to'g'ridan-to'g'ri saytdan kirita
oladi - Turso'dagi `stock_overrides` jadvaliga yoziladi va BARCHA
qurilmalarda/foydalanuvchilarda darhol ko'rinadi (frontend har Zakas/Stock
ochilganda shu funksiyani GET qiladi).

MUHIM: bu backend_p_calc_stock.py'ning o'zini o'zgartirmaydi - calcStock
modeli avvalgidek har build'da qayta hisoblanaveradi. Bu qo'lda tuzatish
FAQAT frontendda, calcStock USTIGA (yuqori ustuvorlik bilan) qo'llaniladi -
mustaqil, kichik, backend/ papkadagi (hali tugallanmagan) Turso qayta
qurishga bog'liq emas (foydalanuvchi qarori, 2026-08-09).

Kerakli Environment Variables (Vercel → Settings → Environment Variables):
  TURSO_DATABASE_URL, TURSO_AUTH_TOKEN  - boshqa turso_sync.py bilan bir xil
  STOCK_OVERRIDE_SECRET                 - ixtiyoriy, o'rnatilsa POST uchun
                                           x-bridge-secret header talab qilinadi
─────────────────────────────────────────────────────────────────────────
"""
import json
import os
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler

import libsql_client


def _get_client():
    url = os.environ.get("TURSO_DATABASE_URL", "").strip()
    token = os.environ.get("TURSO_AUTH_TOKEN", "").strip()
    if not url or not token:
        raise RuntimeError("TURSO_DATABASE_URL / TURSO_AUTH_TOKEN o'rnatilmagan")
    http_url = url.replace("libsql://", "https://")
    return libsql_client.create_client_sync(url=http_url, auth_token=token)


def _ensure_schema(client):
    client.execute(
        "CREATE TABLE IF NOT EXISTS stock_overrides ("
        "sku TEXT PRIMARY KEY, value REAL NOT NULL, note TEXT, "
        "updated_by TEXT, updated_at TEXT NOT NULL)"
    )


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
            client = _get_client()
            _ensure_schema(client)
            rs = client.execute("SELECT sku, value, note, updated_by, updated_at FROM stock_overrides")
            overrides = {
                r["sku"]: {
                    "value": r["value"], "note": r["note"] or "",
                    "updated_by": r["updated_by"] or "", "updated_at": r["updated_at"],
                }
                for r in rs.rows
            }
            client.close()
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

            client = _get_client()
            _ensure_schema(client)
            # value=null (yoki delete:true) - tuzatishni OLIB TASHLAYDI, avtomatik
            # modelga (calcStock) qaytaradi.
            if body.get("delete") or body.get("value") is None:
                client.execute("DELETE FROM stock_overrides WHERE sku = ?", [sku])
                client.close()
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
            client.execute(
                "INSERT INTO stock_overrides (sku, value, note, updated_by, updated_at) "
                "VALUES (?, ?, ?, ?, ?) ON CONFLICT(sku) DO UPDATE SET "
                "value=excluded.value, note=excluded.note, updated_by=excluded.updated_by, "
                "updated_at=excluded.updated_at",
                [sku, value, note, updated_by, now],
            )
            client.close()
            self._json(200, {"ok": True, "sku": sku, "value": value, "updated_by": updated_by, "updated_at": now})
        except Exception as e:
            self._json(500, {"ok": False, "error": str(e)})
