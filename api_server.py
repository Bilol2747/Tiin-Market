import argparse
import io
import json
import mimetypes
import re
import subprocess
import sys
import warnings
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse


ROOT = Path(__file__).resolve().parent


def load_json(name):
    return json.loads((ROOT / name).read_text(encoding="utf-8-sig"))


class AnalyticsData:
    def __init__(self):
        self.reload()

    def reload(self):
        raw_products = load_json("data_mahsulotlar.json")
        if isinstance(raw_products, dict):
            self.products = []
            for name, value in raw_products.items():
                item = dict(value)
                item.setdefault("name", name)
                self.products.append(item)
        else:
            self.products = raw_products

        self.demand = load_json("data_daily.json")
        self.inventory = load_json("data_inv_new.json")
        self.products_by_sku = {
            str(item.get("sku")): item
            for item in self.products
            if item.get("sku") not in (None, "")
        }
        self.inventory_by_sku = {
            str(value.get("sku")): {"name": name, **value}
            for name, value in self.inventory.items()
            if value.get("sku") not in (None, "")
        }

    def stock_rows(self):
        return [
            {
                "sku": sku,
                "name": item["name"],
                "available_qty": item.get("a", 0),
                "reserved_qty": 0,
                "damaged_qty": 0,
                "retail_price": item.get("p", 0),
                "supplier": item.get("su", ""),
                "unit": item.get("t", ""),
                "source": "local_inventory_snapshot",
            }
            for sku, item in self.inventory_by_sku.items()
        ]


DATA = AnalyticsData()


class ApiHandler(SimpleHTTPRequestHandler):
    server_version = "TiinAnalytics/1.0"

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(HTTPStatus.NO_CONTENT)
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/v1/"):
            self.handle_api(parsed.path, parse_qs(parsed.query))
            return
        if parsed.path in ("/", ""):
            self.path = "/sales.html"
        if parsed.path == "/upload":
            self.path = "/upload.html"
        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/v1/upload":
            self.handle_upload()
            return
        self.send_response(HTTPStatus.METHOD_NOT_ALLOWED)
        self.end_headers()

    def handle_upload(self):
        ctype = self.headers.get("Content-Type", "")
        if "multipart/form-data" not in ctype:
            self.send_json({"error": "multipart/form-data kerak"}, 400)
            return

        length = int(self.headers.get("Content-Length", 0))

        # cgi.FieldStorage — binar fayllar uchun ishonchli parser
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", DeprecationWarning)
            import cgi
            form = cgi.FieldStorage(
                fp=self.rfile,
                headers=self.headers,
                environ={
                    "REQUEST_METHOD": "POST",
                    "CONTENT_TYPE": ctype,
                    "CONTENT_LENGTH": str(length),
                },
            )

        files = {}
        for field in ("sales", "products"):
            if field in form:
                item = form[field]
                files[field] = item.file.read() if item.file else item.value

        if "sales" not in files or "products" not in files:
            self.send_json({"error": "sales va products fayllari kerak"}, 400)
            return

        # vaqtinchalik faylga saqlash
        sales_path    = ROOT / "_upload_sotuv.xlsx"
        products_path = ROOT / "_upload_tovarlar.xlsx"
        try:
            sales_path.write_bytes(files["sales"])
            products_path.write_bytes(files["products"])

            result = subprocess.run(
                [sys.executable, str(ROOT / "build_all.py"),
                 "--sales",    str(sales_path),
                 "--products", str(products_path)],
                capture_output=True, text=True, cwd=str(ROOT), timeout=300
            )

            if result.returncode != 0:
                err = (result.stderr or result.stdout or "Noma'lum xato")[-3000:]
                self.send_json({"error": err}, 500)
                return

            DATA.reload()
            output = result.stdout.strip()
            self.send_json({"status": "ok", "output": output})
        except subprocess.TimeoutExpired:
            self.send_json({"error": "Vaqt tugadi (5 daqiqa). Excel fayli juda katta bo'lishi mumkin."}, 500)
        except Exception as ex:
            self.send_json({"error": str(ex)}, 500)
        finally:
            for p in (sales_path, products_path):
                try: p.unlink()
                except: pass

    def handle_api(self, path, query):
        if path == "/api/v1/health":
            self.send_json({
                "status": "ok",
                "mode": "local-fallback",
                "demand_period": DATA.demand.get("__meta__", {}),
            })
            return

        if path == "/api/v1/bootstrap":
            self.send_json({
                "source": "local-fallback",
                "products": DATA.products,
                "demand": DATA.demand,
                "inventory": DATA.inventory,
            })
            return

        if path == "/api/v1/products":
            sku = first(query, "sku")
            if sku:
                item = DATA.products_by_sku.get(sku)
                self.send_json(item or {"error": "product_not_found"}, 200 if item else 404)
            else:
                self.send_json({"items": DATA.products, "count": len(DATA.products)})
            return

        if path == "/api/v1/demand":
            sku = first(query, "sku")
            if sku:
                key = DATA.demand.get("skuAliases", {}).get("sku:" + sku, "sku:" + sku)
                item = DATA.demand.get("items", {}).get(key)
                self.send_json(item or {"error": "demand_not_found"}, 200 if item else 404)
            else:
                self.send_json(DATA.demand)
            return

        if path == "/api/v1/stocks":
            sku = first(query, "sku")
            if sku:
                item = DATA.inventory_by_sku.get(sku)
                if not item:
                    self.send_json({"error": "stock_not_found"}, 404)
                    return
                self.send_json({
                    "sku": sku,
                    "name": item["name"],
                    "available_qty": item.get("a", 0),
                    "reserved_qty": 0,
                    "damaged_qty": 0,
                    "retail_price": item.get("p", 0),
                    "supplier": item.get("su", ""),
                    "source": "local_inventory_snapshot",
                })
            else:
                rows = DATA.stock_rows()
                self.send_json({"items": rows, "count": len(rows)})
            return

        if path == "/api/v1/orders":
            self.send_json({"items": [], "count": 0, "source": "not_connected"})
            return

        if path == "/api/v1/suppliers":
            suppliers = sorted({
                item.get("su", "").strip()
                for item in DATA.inventory.values()
                if item.get("su", "").strip()
            })
            self.send_json({
                "items": [{"supplier_id": index + 1, "name": name} for index, name in enumerate(suppliers)],
                "count": len(suppliers),
                "source": "local_inventory_snapshot",
            })
            return

        if path == "/api/v1/reload":
            DATA.reload()
            self.send_json({"status": "reloaded"})
            return

        self.send_json({"error": "endpoint_not_found"}, 404)

    def send_json(self, value, status=200):
        payload = json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def translate_path(self, path):
        parsed = urlparse(path)
        relative = parsed.path.lstrip("/")
        target = (ROOT / relative).resolve()
        if ROOT not in target.parents and target != ROOT:
            return str(ROOT / "__blocked__")
        return str(target)

    def guess_type(self, path):
        return mimetypes.guess_type(path)[0] or "application/octet-stream"

    def log_message(self, fmt, *args):
        print(f"[api] {self.address_string()} - {fmt % args}")


def first(query, key, default=""):
    values = query.get(key)
    return values[0].strip() if values else default


def parse_multipart(body, boundary):
    """Binar-xavfsiz multipart/form-data parser. {field_name: bytes} qaytaradi."""
    files = {}
    delimiter = b"--" + boundary
    # har bir qismni boundary bo'yicha ajratish
    for part in body.split(delimiter):
        if not part or part in (b"--\r\n", b"--", b"\r\n"):
            continue
        # header va body ni \r\n\r\n bo'yicha ajratish
        idx = part.find(b"\r\n\r\n")
        if idx == -1:
            continue
        raw_headers = part[:idx].decode("utf-8", "replace")
        content = part[idx + 4:]
        # oxiridagi \r\n ni olib tashlash
        if content.endswith(b"\r\n"):
            content = content[:-2]
        m = re.search(r'name="([^"]+)"', raw_headers)
        if not m:
            continue
        field = m.group(1)
        if field in ("sales", "products"):
            files[field] = content
    return files


def main():
    parser = argparse.ArgumentParser(description="Tiin Market local analytics API")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    server = ThreadingHTTPServer((args.host, args.port), ApiHandler)
    print("=" * 50, flush=True)
    print("  TIIN MARKET SERVER ISHGA TUSHDI", flush=True)
    print("=" * 50, flush=True)
    print(f"  Dashboard:  http://{args.host}:{args.port}/sales.html", flush=True)
    print(f"  Yuklash:    http://{args.host}:{args.port}/upload", flush=True)
    print("=" * 50, flush=True)
    print("  Bu oynani YOPMANG. To'xtatish uchun: Ctrl+C", flush=True)
    print(flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
