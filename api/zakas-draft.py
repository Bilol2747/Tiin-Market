"""
Vercel Serverless Funksiya: Zakas bo'limidagi qo'lda tahrirlar (miqdor, qo'shimcha
kun, narx, stok rejimi, ta'minotchi maqsadli kuni) - hammasi UMUMIY.
─────────────────────────────────────────────────────────────────────────
Bu vaqtgacha (2026-09-02 gacha) bu tahrirlar FAQAT localStorage'da (o'sha
brauzerning o'zida) saqlanardi - boshqa xodim yoki boshqa qurilmada
ko'rinmasdi (foydalanuvchi topilmasi: "shu tovarlar tahrirlanganmi -
nega saytda ko'rinmayapdi"). Endi stock-override.py bilan bir xil
naqshda Turso'dagi `zakas_draft` jadvaliga yoziladi - BARCHA
qurilmalarda/foydalanuvchilarda ko'rinadi.

Jadval "ns" (namespace) + "k" (kalit) juftligi bo'yicha umumiy saqlaydi -
frontenddagi 5 ta alohida xarita (zkRowQty/zkRowAdj/zkRowCost/
zkRowStockMode/zkSupTargets) bittasi bilan bir xil sxemada ishlaydi:
  ns="qty"       k=r.key (masalan "normal:s:12345")   v=son
  ns="adj"       k=r.key                               v=son
  ns="cost"      k=r.key                               v={"val":..,"base":..}
  ns="stockmode" k=r.key                               v="invan"
  ns="suptarget" k=ta'minotchi nomi                    v=son

POST ikki shaklda keladi:
  - {"ops":[{"ns":..,"k":..,"v":..} yoki {"ns":..,"k":..,"delete":true}, ...],
     "updated_by":".."}  - bir nechta o'zgarishni bitta so'rovda birlashtiradi
     (masalan "maqsadli kun" o'zgarganda o'sha ta'minotchining barcha
     qo'lda kiritilgan miqdorlari ham tozalanadi - bittada yuboriladi).
  - {"clear_ns":["qty","adj",...]}  - "Tozalash" (hammasini bekor qilish)
    tugmasi uchun - berilgan namespace'lardagi BARCHA yozuvlarni o'chiradi.

Kerakli Environment Variables - stock-override.py bilan bir xil:
  TURSO_DATABASE_URL, TURSO_AUTH_TOKEN
─────────────────────────────────────────────────────────────────────────
"""
import json
import os
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler

import libsql_client

_NS_ALLOWED = {"qty", "adj", "cost", "stockmode", "suptarget"}


def _get_client():
    url = os.environ.get("TURSO_DATABASE_URL", "").strip()
    token = os.environ.get("TURSO_AUTH_TOKEN", "").strip()
    if not url or not token:
        raise RuntimeError("TURSO_DATABASE_URL / TURSO_AUTH_TOKEN o'rnatilmagan")
    http_url = url.replace("libsql://", "https://")
    return libsql_client.create_client_sync(url=http_url, auth_token=token)


def _ensure_schema(client):
    client.execute(
        "CREATE TABLE IF NOT EXISTS zakas_draft ("
        "ns TEXT NOT NULL, k TEXT NOT NULL, v TEXT NOT NULL, "
        "updated_by TEXT, updated_at TEXT NOT NULL, PRIMARY KEY (ns, k))"
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
            rs = client.execute("SELECT ns, k, v FROM zakas_draft")
            data = {ns: {} for ns in _NS_ALLOWED}
            for r in rs.rows:
                ns = r["ns"]
                if ns not in data:
                    continue
                try:
                    data[ns][r["k"]] = json.loads(r["v"])
                except (TypeError, ValueError):
                    continue
            client.close()
            self._json(200, {"ok": True, "data": data})
        except Exception as e:
            self._json(500, {"ok": False, "error": str(e)})

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length") or 0)
            raw = self.rfile.read(length) if length else b"{}"
            body = json.loads(raw or b"{}")
            updated_by = str(body.get("updated_by") or "").strip()[:120]
            now = datetime.now(timezone.utc).isoformat()

            client = _get_client()
            _ensure_schema(client)

            clear_ns = body.get("clear_ns")
            if clear_ns:
                for ns in clear_ns:
                    ns = str(ns)
                    if ns not in _NS_ALLOWED:
                        continue
                    client.execute("DELETE FROM zakas_draft WHERE ns = ?", [ns])

            ops = body.get("ops") or []
            for op in ops:
                ns = str(op.get("ns") or "")
                k = str(op.get("k") or "")
                if ns not in _NS_ALLOWED or not k:
                    continue
                if op.get("delete"):
                    client.execute("DELETE FROM zakas_draft WHERE ns = ? AND k = ?", [ns, k])
                    continue
                if "v" not in op:
                    continue
                v_json = json.dumps(op.get("v"), ensure_ascii=False)
                client.execute(
                    "INSERT INTO zakas_draft (ns, k, v, updated_by, updated_at) "
                    "VALUES (?, ?, ?, ?, ?) ON CONFLICT(ns, k) DO UPDATE SET "
                    "v=excluded.v, updated_by=excluded.updated_by, updated_at=excluded.updated_at",
                    [ns, k, v_json, updated_by, now],
                )

            client.close()
            self._json(200, {"ok": True, "updated_at": now})
        except Exception as e:
            self._json(500, {"ok": False, "error": str(e)})
