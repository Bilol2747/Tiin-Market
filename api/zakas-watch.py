"""
Vercel Serverless Funksiya: Proaktiv "Zakas kuzatuvchi" Telegram boti uchun
holat (Turso'da uchta jadval) - sozlamalar, navbatdagi (pending) suhbat
holati va takroriy ogohlantirmaslik uchun oxirgi xabar holati.
─────────────────────────────────────────────────────────────────────────
Bu endpoint `zakas_draft.py`/`stock_overrides.py` bilan BIR XIL naqshda
ishlaydi (Turso, libsql_client, CORS+JSON javob), lekin ikkita ALOHIDA
chaqiruvchiga xizmat qiladi:
  - `zakas/watch_agent.js` (GitHub Actions cron, Node) - settings_list bilan
    barcha yoqilgan chatlarni aylanadi, alert_state bilan takroriy xabarni
    oldini oladi.
  - `api/telegram-webhook.js` (Vercel, Node) - pending/`settings` bilan
    tugma bosilgach "necha kunlik zakas" savoli va `/sozlamalar` oqimini
    boshqaradi.
Ikkalasi ham Node - lekin Turso'ga TO'G'RIDAN-TO'G'RI (masalan @libsql/client
orqali) emas, shu Python endpoint orqali ulanadi: shunda Turso HTTP protokoli
FAQAT bitta, allaqachon ishlab turgan (zakas-draft.py/stock-override.py)
kutubxona (`libsql_client`) orqali ishlatiladi - Node tarafida yangi npm
bog'liqlik yoki xom Hrana protokolini qo'lda yozish shart emas.

So'rovlar `action` maydoni (GET uchun query-param, POST uchun JSON body)
bilan farqlanadi - pastdagi handler ichida ro'yxat.

Kerakli Environment Variables - zakas-draft.py bilan bir xil:
  TURSO_DATABASE_URL, TURSO_AUTH_TOKEN
─────────────────────────────────────────────────────────────────────────
"""
import json
import os
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

import libsql_client

_DEFAULT_THRESHOLD = 5


def _get_client():
    url = os.environ.get("TURSO_DATABASE_URL", "").strip()
    token = os.environ.get("TURSO_AUTH_TOKEN", "").strip()
    if not url or not token:
        raise RuntimeError("TURSO_DATABASE_URL / TURSO_AUTH_TOKEN o'rnatilmagan")
    http_url = url.replace("libsql://", "https://")
    return libsql_client.create_client_sync(url=http_url, auth_token=token)


def _ensure_schema(client):
    client.execute(
        "CREATE TABLE IF NOT EXISTS zakas_watch_settings ("
        "chat_id TEXT PRIMARY KEY, threshold_days INTEGER NOT NULL DEFAULT 5, "
        "watched_categories TEXT NOT NULL DEFAULT '[]', "
        "enabled INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL DEFAULT '')"
    )
    client.execute(
        "CREATE TABLE IF NOT EXISTS zakas_watch_alert_state ("
        "chat_id TEXT NOT NULL, supplier TEXT NOT NULL, "
        "last_alert_date TEXT NOT NULL DEFAULT '', last_sku_set TEXT NOT NULL DEFAULT '[]', "
        "updated_at TEXT NOT NULL DEFAULT '', PRIMARY KEY (chat_id, supplier))"
    )
    client.execute(
        "CREATE TABLE IF NOT EXISTS zakas_watch_pending ("
        "chat_id TEXT PRIMARY KEY, kind TEXT NOT NULL, supplier TEXT NOT NULL DEFAULT '', "
        "token_map TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT '')"
    )


def _settings_row_to_dict(r):
    try:
        cats = json.loads(r["watched_categories"] or "[]")
    except (TypeError, ValueError):
        cats = []
    return {
        "chat_id": r["chat_id"],
        "threshold_days": r["threshold_days"],
        "watched_categories": cats,
        "enabled": bool(r["enabled"]),
    }


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
            q = parse_qs(urlparse(self.path).query)
            action = (q.get("action") or [""])[0]
            chat_id = (q.get("chat_id") or [""])[0].strip()

            client = _get_client()
            _ensure_schema(client)

            if action == "settings_list":
                rs = client.execute(
                    "SELECT chat_id, threshold_days, watched_categories, enabled "
                    "FROM zakas_watch_settings WHERE enabled = 1"
                )
                rows = [_settings_row_to_dict(r) for r in rs.rows]
                client.close()
                self._json(200, {"ok": True, "rows": rows})
                return

            if action == "settings":
                if not chat_id:
                    client.close()
                    self._json(400, {"ok": False, "error": "chat_id kerak"})
                    return
                rs = client.execute(
                    "SELECT chat_id, threshold_days, watched_categories, enabled "
                    "FROM zakas_watch_settings WHERE chat_id = ?",
                    [chat_id],
                )
                client.close()
                if rs.rows:
                    settings = _settings_row_to_dict(rs.rows[0])
                else:
                    settings = {
                        "chat_id": chat_id, "threshold_days": _DEFAULT_THRESHOLD,
                        "watched_categories": [], "enabled": False,
                    }
                self._json(200, {"ok": True, "settings": settings})
                return

            if action == "pending":
                if not chat_id:
                    client.close()
                    self._json(400, {"ok": False, "error": "chat_id kerak"})
                    return
                rs = client.execute(
                    "SELECT chat_id, kind, supplier, token_map, created_at FROM zakas_watch_pending WHERE chat_id = ?",
                    [chat_id],
                )
                client.close()
                if rs.rows:
                    r = rs.rows[0]
                    try:
                        token_map = json.loads(r["token_map"] or "{}")
                    except (TypeError, ValueError):
                        token_map = {}
                    pending = {
                        "chat_id": r["chat_id"], "kind": r["kind"], "supplier": r["supplier"] or "",
                        "token_map": token_map, "created_at": r["created_at"] or "",
                    }
                else:
                    pending = None
                self._json(200, {"ok": True, "pending": pending})
                return

            if action == "alert_state":
                if not chat_id:
                    client.close()
                    self._json(400, {"ok": False, "error": "chat_id kerak"})
                    return
                rs = client.execute(
                    "SELECT supplier, last_alert_date, last_sku_set FROM zakas_watch_alert_state WHERE chat_id = ?",
                    [chat_id],
                )
                client.close()
                rows = []
                for r in rs.rows:
                    try:
                        sku_set = json.loads(r["last_sku_set"] or "[]")
                    except (TypeError, ValueError):
                        sku_set = []
                    rows.append({"supplier": r["supplier"], "last_alert_date": r["last_alert_date"], "last_sku_set": sku_set})
                self._json(200, {"ok": True, "rows": rows})
                return

            client.close()
            self._json(400, {"ok": False, "error": f"noma'lum action: {action}"})
        except Exception as e:
            self._json(500, {"ok": False, "error": str(e)})

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length") or 0)
            raw = self.rfile.read(length) if length else b"{}"
            body = json.loads(raw or b"{}")
            action = str(body.get("action") or "")
            chat_id = str(body.get("chat_id") or "").strip()
            if not chat_id:
                self._json(400, {"ok": False, "error": "chat_id kerak"})
                return
            now = datetime.now(timezone.utc).isoformat()

            client = _get_client()
            _ensure_schema(client)

            if action == "settings_set":
                rs = client.execute(
                    "SELECT threshold_days, watched_categories, enabled FROM zakas_watch_settings WHERE chat_id = ?",
                    [chat_id],
                )
                cur = rs.rows[0] if rs.rows else None
                threshold_days = body.get("threshold_days")
                if threshold_days is None:
                    threshold_days = cur["threshold_days"] if cur else _DEFAULT_THRESHOLD
                watched_categories = body.get("watched_categories")
                if watched_categories is None:
                    watched_categories = json.loads(cur["watched_categories"]) if cur else []
                enabled = body.get("enabled")
                if enabled is None:
                    enabled = bool(cur["enabled"]) if cur else True
                client.execute(
                    "INSERT INTO zakas_watch_settings (chat_id, threshold_days, watched_categories, enabled, updated_at) "
                    "VALUES (?, ?, ?, ?, ?) ON CONFLICT(chat_id) DO UPDATE SET "
                    "threshold_days=excluded.threshold_days, watched_categories=excluded.watched_categories, "
                    "enabled=excluded.enabled, updated_at=excluded.updated_at",
                    [chat_id, int(threshold_days), json.dumps(watched_categories, ensure_ascii=False), 1 if enabled else 0, now],
                )
                client.close()
                self._json(200, {"ok": True, "updated_at": now})
                return

            if action == "pending_set":
                kind = str(body.get("kind") or "").strip()
                if not kind:
                    client.close()
                    self._json(400, {"ok": False, "error": "kind kerak"})
                    return
                supplier = str(body.get("supplier") or "")
                token_map = json.dumps(body.get("token_map") or {}, ensure_ascii=False)
                client.execute(
                    "INSERT INTO zakas_watch_pending (chat_id, kind, supplier, token_map, created_at) "
                    "VALUES (?, ?, ?, ?, ?) ON CONFLICT(chat_id) DO UPDATE SET "
                    "kind=excluded.kind, supplier=excluded.supplier, token_map=excluded.token_map, "
                    "created_at=excluded.created_at",
                    [chat_id, kind, supplier, token_map, now],
                )
                client.close()
                self._json(200, {"ok": True})
                return

            if action == "pending_clear":
                client.execute("DELETE FROM zakas_watch_pending WHERE chat_id = ?", [chat_id])
                client.close()
                self._json(200, {"ok": True})
                return

            if action == "alert_state_set":
                supplier = str(body.get("supplier") or "").strip()
                if not supplier:
                    client.close()
                    self._json(400, {"ok": False, "error": "supplier kerak"})
                    return
                last_alert_date = str(body.get("last_alert_date") or "")
                last_sku_set = json.dumps(body.get("last_sku_set") or [], ensure_ascii=False)
                client.execute(
                    "INSERT INTO zakas_watch_alert_state (chat_id, supplier, last_alert_date, last_sku_set, updated_at) "
                    "VALUES (?, ?, ?, ?, ?) ON CONFLICT(chat_id, supplier) DO UPDATE SET "
                    "last_alert_date=excluded.last_alert_date, last_sku_set=excluded.last_sku_set, "
                    "updated_at=excluded.updated_at",
                    [chat_id, supplier, last_alert_date, last_sku_set, now],
                )
                client.close()
                self._json(200, {"ok": True})
                return

            client.close()
            self._json(400, {"ok": False, "error": f"noma'lum action: {action}"})
        except Exception as e:
            self._json(500, {"ok": False, "error": str(e)})
