"""
Vercel Serverless Funksiya: "Oxirgi kirim" avtomatik zakas uchun ta'minotchi
tanlovi (nazorat ro'yxati).
─────────────────────────────────────────────────────────────────────────
Foydalanuvchi Zakas sahifasidagi yangi tugma orqali qaysi ta'minotchilarga
avtomatik buyurtma (kelajakda: Invan orqali SMS + "Open" holatda) yuborilishi
kerakligini belgilaydi. Bu ro'yxat FAQAT "yoqilgan" (tanlangan) ta'minotchilarni
saqlaydi - Turso'dagi `zakas_auto_suppliers` jadvaliga, `api/stock-override.py`
bilan AYNAN bir xil naqsh (bitta kichik jadval, GET/POST, CORS).

MUHIM: bu fayl FAQAT tanlovni saqlaydi/o'qiydi - hali hech qanday buyurtma
yuborilmaydi (bu keyingi, alohida bosqich).

Kerakli Environment Variables (Vercel → Settings → Environment Variables):
  TURSO_DATABASE_URL, TURSO_AUTH_TOKEN  - boshqa turso_sync.py bilan bir xil
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
        "CREATE TABLE IF NOT EXISTS zakas_auto_suppliers ("
        "supplier TEXT PRIMARY KEY, updated_by TEXT, updated_at TEXT NOT NULL)"
    )


class handler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

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
            rs = client.execute("SELECT supplier FROM zakas_auto_suppliers")
            suppliers = [r["supplier"] for r in rs.rows]
            client.close()
            self._json(200, {"ok": True, "suppliers": suppliers})
        except Exception as e:
            self._json(500, {"ok": False, "error": str(e)})

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length") or 0)
            raw = self.rfile.read(length) if length else b"{}"
            body = json.loads(raw or b"{}")
            # {"changes": {"Ta'minotchi A": true, "Ta'minotchi B": false, ...}, "updated_by": "..."}
            # true = yoqiladi (jadvalga qo'shiladi), false = o'chiriladi (jadvaldan olinadi).
            # Bitta so'rovda bir nechtasini (masalan "hammasini tanlash") birga yuborish mumkin.
            changes = body.get("changes")
            if not isinstance(changes, dict) or not changes:
                self._json(400, {"ok": False, "error": "changes (obyekt) kerak"})
                return
            updated_by = str(body.get("updated_by") or "").strip()[:120]
            now = datetime.now(timezone.utc).isoformat()

            client = _get_client()
            _ensure_schema(client)
            for supplier, enabled in changes.items():
                supplier = str(supplier).strip()
                if not supplier:
                    continue
                if enabled:
                    client.execute(
                        "INSERT INTO zakas_auto_suppliers (supplier, updated_by, updated_at) "
                        "VALUES (?, ?, ?) ON CONFLICT(supplier) DO UPDATE SET "
                        "updated_by=excluded.updated_by, updated_at=excluded.updated_at",
                        [supplier, updated_by, now],
                    )
                else:
                    client.execute("DELETE FROM zakas_auto_suppliers WHERE supplier = ?", [supplier])
            client.close()
            self._json(200, {"ok": True, "count": len(changes)})
        except Exception as e:
            self._json(500, {"ok": False, "error": str(e)})
