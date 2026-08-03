#!/usr/bin/env python3
"""
app.py — Tiin Market API serveri (FastAPI).

MAQSAD: hozirgi arxitekturada frontend butun ma'lumot faylini yuklab oladi
(p2 uchun 11.7 MB, p9 uchun 74.8 MB) va hammasini brauzerda hisoblaydi.
Bu yerda buning o'rniga baza indeks bo'yicha faqat EKRANGA KERAK bo'lgan
qatorlarni qaytaradi — odatda 20-80 KB.

Ishga tushirish (lokal):
    python -m uvicorn backend.app:app --reload --port 8000
    http://127.0.0.1:8000/docs  — avtomatik hujjat/sinov sahifasi

Barcha endpoint'lar `/api/v1` ostida — `sales_api_client.js` allaqachon shu
manzilni kutadi (DEFAULT_BASE = "/api/v1").
"""
import sys
from datetime import date, timedelta
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent.parent))

from . import db
from .pipeline_runner import CACHE as PIPE      # mavjud hisob kodlari natijasi

app = FastAPI(title="Tiin Market API", version="1.0", docs_url="/docs")


@app.on_event("startup")
def _start():
    """Diskdagi keshni darhol yuklaydi (server tez javob bera boshlaydi),
    keyin fonda yangilab turadi. Kesh bo'lmasa — birinchi hisob fonda."""
    import threading
    if not PIPE.load_from_disk():
        threading.Thread(target=PIPE.rebuild, daemon=True).start()
    PIPE.start_background()

# Frontend hozircha boshqa manzildan (Vercel / file://) ochilishi mumkin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)
# JSON javoblarni siqish — 80 KB javob simda ~12 KB bo'ladi.
app.add_middleware(GZipMiddleware, minimum_size=1024)


# ─── Yordamchilar ───────────────────────────────────────────────────────────

def _range(dfrom: str | None, dto: str | None, default_days: int = 30):
    """Sana oralig'ini normallashtiradi. Berilmasa — bazadagi eng so'nggi
    kundan orqaga `default_days` kun."""
    last = db.scalar("SELECT MAX(d) FROM daily_totals") or date.today().isoformat()
    dto = dto or last
    if not dfrom:
        dfrom = (date.fromisoformat(dto) - timedelta(days=default_days - 1)).isoformat()
    try:
        if date.fromisoformat(dfrom) > date.fromisoformat(dto):
            raise ValueError
    except ValueError:
        raise HTTPException(400, "Sana oralig'i noto'g'ri (kutilgan format: YYYY-MM-DD, from <= to)")
    return dfrom, dto


# ─── Xizmat holati ──────────────────────────────────────────────────────────

@app.get("/api/v1/health")
def health():
    return {
        "ok": True,
        "receipts": db.scalar("SELECT COUNT(*) FROM receipts", default=0),
        "items": db.scalar("SELECT COUNT(*) FROM receipt_items", default=0),
        "products": db.scalar("SELECT COUNT(*) FROM products", default=0),
        "first_day": db.scalar("SELECT MIN(d) FROM daily_totals"),
        "last_day": db.scalar("SELECT MAX(d) FROM daily_totals"),
        "last_sync": db.scalar("SELECT value FROM sync_state WHERE key='last_sync_at'"),
    }


@app.get("/api/v1/bootstrap")
def bootstrap():
    """Sahifa ochilganda birinchi bo'lib chaqiriladigan KICHIK javob:
    mavjud sana oralig'i, ta'minotchi/kategoriya ro'yxatlari (filtr menyulari
    uchun). Butun ma'lumot emas — bir necha KB."""
    return {
        "first_day": db.scalar("SELECT MIN(d) FROM daily_totals"),
        "last_day": db.scalar("SELECT MAX(d) FROM daily_totals"),
        "last_sync": db.scalar("SELECT value FROM sync_state WHERE key='last_sync_at'"),
        "product_count": db.scalar("SELECT COUNT(*) FROM products WHERE is_active=1", default=0),
        "suppliers": [r["supplier"] for r in db.rows(
            "SELECT DISTINCT supplier FROM products WHERE supplier<>'' ORDER BY supplier")],
        "categories": db.rows(
            "SELECT cat_top, COUNT(*) AS n FROM products WHERE cat_top<>'' "
            "GROUP BY cat_top ORDER BY cat_top"),
    }


# ─── p1 — Bosh sahifa ───────────────────────────────────────────────────────

@app.get("/api/v1/dashboard")
def dashboard(
    dfrom: str | None = Query(None, alias="from"),
    dto: str | None = Query(None, alias="to"),
    top: int = Query(10, ge=1, le=100),
):
    """Bosh sahifa KPI'lari + kunlik grafik + top ro'yxatlar.
    Hammasi oldindan hisoblangan `daily_totals`/`daily_sku` dan — millisekundlar."""
    dfrom, dto = _range(dfrom, dto)

    tot = db.one(
        "SELECT COALESCE(SUM(revenue),0) AS revenue, COALESCE(SUM(cost),0) AS cost, "
        "COALESCE(SUM(receipts),0) AS receipts, COALESCE(SUM(items_qty),0) AS qty, "
        "COALESCE(SUM(refund_total),0) AS refund, COALESCE(SUM(wholesale_rev),0) AS wholesale "
        "FROM daily_totals WHERE d BETWEEN ? AND ?", (dfrom, dto)) or {}

    rev = tot.get("revenue") or 0.0
    cost = tot.get("cost") or 0.0
    rec = tot.get("receipts") or 0

    return {
        "from": dfrom, "to": dto,
        "kpi": {
            "revenue": rev,
            "cost": cost,
            "profit": rev - cost,
            "margin": (rev - cost) / rev * 100 if rev else 0.0,
            "receipts": rec,
            "avg_check": rev / rec if rec else 0.0,
            "qty": tot.get("qty") or 0.0,
            "refund": tot.get("refund") or 0.0,
            "wholesale_revenue": tot.get("wholesale") or 0.0,
        },
        "daily": db.rows(
            "SELECT d, revenue, cost, receipts, items_qty AS qty, refund_total AS refund "
            "FROM daily_totals WHERE d BETWEEN ? AND ? ORDER BY d", (dfrom, dto)),
        # Avval jamlab, KEYIN nom uchun katalogga murojaat qilinadi. Teskarisi
        # (avval birikma, keyin guruhlash) 30 kunlik oynada ~97 ming qatorni
        # birlashtirishga majbur qilardi — o'lchandi: 86 ms -> 31 ms.
        "top_products": db.rows(
            "SELECT t.sku, COALESCE(p.name_raw, t.sku) AS name, p.cat_top, "
            "       t.revenue, t.qty FROM "
            "  (SELECT sku, SUM(revenue) AS revenue, SUM(qty) AS qty FROM daily_sku "
            "   WHERE d BETWEEN ? AND ? GROUP BY sku ORDER BY revenue DESC LIMIT ?) t "
            "LEFT JOIN products p ON p.sku = t.sku ORDER BY t.revenue DESC",
            (dfrom, dto, top)),
        # DIQQAT: GROUP BY da HAR DOIM to'liq ifoda yoziladi, alias emas.
        # SQLite alias'dan oldin JADVAL USTUNINI tanlaydi — `GROUP BY cat`
        # `products.cat` (subkategoriya) ni anglatib, natijani buzadi.
        "top_categories": db.rows(
            "SELECT COALESCE(NULLIF(p.cat_top,''),'(kategoriyasiz)') AS cat, "
            "       SUM(t.revenue) AS revenue, SUM(t.qty) AS qty FROM "
            "  (SELECT sku, SUM(revenue) AS revenue, SUM(qty) AS qty FROM daily_sku "
            "   WHERE d BETWEEN ? AND ? GROUP BY sku) t "
            "LEFT JOIN products p ON p.sku = t.sku "
            "GROUP BY COALESCE(NULLIF(p.cat_top,''),'(kategoriyasiz)') "
            "ORDER BY revenue DESC LIMIT ?", (dfrom, dto, top)),
        # Oldindan hisoblangan `daily_employee` dan. Avval bu so'rov
        # receipts×receipt_items birikmasi edi va 230 ms olardi — butun bosh
        # sahifaning eng sekin qismi.
        "top_employees": db.rows(
            "SELECT employee, SUM(receipts) AS receipts, SUM(revenue) AS revenue "
            "FROM daily_employee WHERE d BETWEEN ? AND ? "
            "GROUP BY employee ORDER BY revenue DESC LIMIT ?", (dfrom, dto, top)),
    }


# ─── p2 — Mahsulotlar (server tomonda qidiruv + sahifalash) ─────────────────

@app.get("/api/v1/products")
def products(
    q: str | None = Query(None, description="nom / SKU / shtrix-kod bo'yicha qidiruv"),
    supplier: str | None = None,
    cat: str | None = None,
    active: bool | None = None,
    dfrom: str | None = Query(None, alias="from"),
    dto: str | None = Query(None, alias="to"),
    sort: str = Query("revenue", pattern="^(revenue|qty|name|stock|sku)$"),
    order: str = Query("desc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
):
    """p2 jadvali. HOZIR: brauzer 11.7 MB `data_mahsulotlar.json` yuklaydi va
    hammasini o'zi filtrlaydi. BU YERDA: baza faqat so'ralgan sahifani
    qaytaradi (~20-40 KB)."""
    dfrom, dto = _range(dfrom, dto)
    where, params = ["1=1"], []

    if q:
        needle = q.strip()
        if needle:
            where.append(
                "(p.name LIKE ? OR p.sku = ? OR EXISTS "
                "(SELECT 1 FROM product_barcodes b WHERE b.sku = p.sku AND b.barcode = ?))")
            params += [f"%{needle.lower()}%", needle, needle]
    if supplier:
        where.append("p.supplier = ?"); params.append(supplier)
    if cat:
        where.append("(p.cat_top = ? OR p.cat = ?)"); params += [cat, cat]
    if active is not None:
        where.append("p.is_active = ?"); params.append(1 if active else 0)

    w = " AND ".join(where)
    total = db.scalar(f"SELECT COUNT(*) FROM products p WHERE {w}", tuple(params), 0)

    sort_col = {"revenue": "revenue", "qty": "qty", "name": "p.name",
                "stock": "p.stock", "sku": "p.sku"}[sort]
    direction = "DESC" if order == "desc" else "ASC"

    items = db.rows(
        f"""SELECT p.sku, p.name_raw AS name, p.cat, p.cat_top, p.supplier, p.unit,
                   p.price, p.supply_price, p.stock, p.is_active,
                   COALESCE(s.revenue, 0) AS revenue,
                   COALESCE(s.qty, 0)     AS qty,
                   COALESCE(s.receipts,0) AS receipts,
                   s.last_sale
            FROM products p
            LEFT JOIN (
                SELECT sku, SUM(revenue) AS revenue, SUM(qty) AS qty,
                       SUM(receipts) AS receipts, MAX(d) AS last_sale
                FROM daily_sku WHERE d BETWEEN ? AND ? GROUP BY sku
            ) s ON s.sku = p.sku
            WHERE {w}
            ORDER BY {sort_col} {direction} NULLS LAST
            LIMIT ? OFFSET ?""",
        tuple([dfrom, dto] + params + [limit, (page - 1) * limit]),
    )
    return {"from": dfrom, "to": dto, "total": total, "page": page,
            "limit": limit, "pages": (total + limit - 1) // limit, "items": items}


@app.get("/api/v1/products/{sku}")
def product_detail(
    sku: str,
    dfrom: str | None = Query(None, alias="from"),
    dto: str | None = Query(None, alias="to"),
):
    """Mahsulot kartochkasi: katalog ma'lumoti + davr yig'indisi + kunlik qator
    (grafik uchun) + oxirgi kirimlar."""
    dfrom, dto = _range(dfrom, dto, default_days=90)
    p = db.one("SELECT * FROM products WHERE sku = ?", (sku,))
    if not p:
        raise HTTPException(404, f"SKU topilmadi: {sku}")
    p["barcodes"] = [r["barcode"] for r in db.rows(
        "SELECT barcode FROM product_barcodes WHERE sku = ?", (sku,))]
    return {
        "product": p,
        "from": dfrom, "to": dto,
        "summary": db.one(
            "SELECT COALESCE(SUM(revenue),0) AS revenue, COALESCE(SUM(qty),0) AS qty, "
            "COALESCE(SUM(cost),0) AS cost, COALESCE(SUM(receipts),0) AS receipts, "
            "MAX(d) AS last_sale FROM daily_sku WHERE sku = ? AND d BETWEEN ? AND ?",
            (sku, dfrom, dto)),
        "daily": db.rows(
            "SELECT d, qty, revenue, receipts FROM daily_sku "
            "WHERE sku = ? AND d BETWEEN ? AND ? ORDER BY d", (sku, dfrom, dto)),
        "arrivals": db.rows(
            "SELECT d, qty, received_qty, cost, supplier, status FROM arrivals "
            "WHERE sku = ? ORDER BY d DESC LIMIT 20", (sku,)),
    }


@app.get("/api/v1/search")
def search(q: str = Query(..., min_length=1), limit: int = Query(20, ge=1, le=100)):
    """Tez avtoto'ldirish (qidiruv maydonida yozayotganda). Faqat nom+SKU."""
    needle = q.strip().lower()
    return {"items": db.rows(
        "SELECT sku, name_raw AS name, stock, price FROM products "
        "WHERE name LIKE ? OR sku = ? OR EXISTS "
        "(SELECT 1 FROM product_barcodes b WHERE b.sku=products.sku AND b.barcode=?) "
        "ORDER BY is_active DESC, name LIMIT ?",
        (f"%{needle}%", q.strip(), q.strip(), limit))}


# ─── p6 — Ta'minotchilar ────────────────────────────────────────────────────

@app.get("/api/v1/suppliers")
def suppliers(
    dfrom: str | None = Query(None, alias="from"),
    dto: str | None = Query(None, alias="to"),
    limit: int = Query(200, ge=1, le=2000),
):
    dfrom, dto = _range(dfrom, dto)
    return {"from": dfrom, "to": dto, "items": db.rows(
        "SELECT COALESCE(NULLIF(p.supplier,''),'(ta''minotchisiz)') AS supplier, "
        "       COUNT(DISTINCT s.sku) AS skus, SUM(s.revenue) AS revenue, "
        "       SUM(s.cost) AS cost, SUM(s.qty) AS qty "
        "FROM daily_sku s JOIN products p ON p.sku = s.sku "
        "WHERE s.d BETWEEN ? AND ? GROUP BY p.supplier "
        "ORDER BY revenue DESC LIMIT ?", (dfrom, dto, limit))}


# ─── p10 — Kategoriyalar ────────────────────────────────────────────────────

@app.get("/api/v1/categories")
def categories(
    dfrom: str | None = Query(None, alias="from"),
    dto: str | None = Query(None, alias="to"),
    parent: str | None = Query(None, description="berilsa — shu kategoriyaning ichki bo'limlari"),
):
    dfrom, dto = _range(dfrom, dto)
    # DIQQAT: GROUP BY da alias ("name") ISHLATILMAYDI — SQLite uni
    # `products.name` (mahsulot nomi) deb tushunadi va kategoriya o'rniga
    # har bir mahsulotni alohida guruh qilib yuboradi.
    if parent:
        sql = ("SELECT COALESCE(NULLIF(p.cat,''),'(boshqa)') AS name, "
               "COUNT(DISTINCT s.sku) AS skus, SUM(s.revenue) AS revenue, "
               "SUM(s.cost) AS cost, SUM(s.qty) AS qty "
               "FROM daily_sku s JOIN products p ON p.sku = s.sku "
               "WHERE s.d BETWEEN ? AND ? AND p.cat_top = ? "
               "GROUP BY COALESCE(NULLIF(p.cat,''),'(boshqa)') ORDER BY revenue DESC")
        params = (dfrom, dto, parent)
    else:
        sql = ("SELECT COALESCE(NULLIF(p.cat_top,''),'(kategoriyasiz)') AS name, "
               "COUNT(DISTINCT s.sku) AS skus, SUM(s.revenue) AS revenue, "
               "SUM(s.cost) AS cost, SUM(s.qty) AS qty "
               "FROM daily_sku s JOIN products p ON p.sku = s.sku "
               "WHERE s.d BETWEEN ? AND ? "
               "GROUP BY COALESCE(NULLIF(p.cat_top,''),'(kategoriyasiz)') ORDER BY revenue DESC")
        params = (dfrom, dto)
    return {"from": dfrom, "to": dto, "parent": parent, "items": db.rows(sql, params)}


# ─── Pipeline natijalari (MAVJUD hisob kodlari chiqishi) ───────────────────
#
# QOIDA: bu bo'limda bironta biznes formula YO'Q. Barcha hisob
# `backend_p*.py` / `build_sales_demand.py` fayllarida qoladi va
# `pipeline_runner.py` orqali o'zgarishsiz chaqiriladi. Bu yerda faqat
# tayyor natijani uzatish (va kerak bo'lsa sahifalash) bor.
#
# ZAKAS ATAYLAB BU YERDA HISOBLANMAYDI: uning formulasi `sales_runtime.js`
# ichida (JavaScript) va u yillar davomida sozlangan. Uni Python'ga
# ko'chirish = qayta yozish = xato xavfi. Frontend o'z formulasini saqlab
# qoladi, API unga aynan hozirgidek `invdata` + `kirimdata` beradi.

def _pipe(key):
    d = PIPE.get(key)
    if d is None:
        raise HTTPException(503, "Hisob hali tayyor emas — bir necha soniyadan keyin urinib ko'ring")
    return d


def _pipe_raw(key, request: Request):
    """Oldindan seriyalangan (va oldindan siqilgan) JSON baytlarini uzatadi.

    Katta tuzilmalarni har so'rovda qayta o'girish va qayta siqish bekor
    sarf edi — o'lchandi: JSON 11 ms, gzip esa 504 ms. Ikkalasi ham endi
    pipeline qayta hisoblanganda bir marta bajariladi.
    """
    accepts_gzip = "gzip" in request.headers.get("accept-encoding", "").lower()
    b = PIPE.json_bytes(key, gzipped=accepts_gzip)
    if b is None:
        return JSONResponse(_pipe(key))
    headers = {"Content-Encoding": "gzip"} if accepts_gzip else {}
    return Response(content=b, media_type="application/json", headers=headers)


@app.get("/api/v1/pipeline/status")
def pipeline_status():
    m = PIPE.get("meta")
    return {"ready": PIPE.ready, "meta": m}


@app.get("/api/v1/p1data")
def p1data(request: Request):
    """Bosh sahifa — `build_p1data()` chiqishi, o'zgarishsiz."""
    return _pipe_raw("p1data", request)


@app.get("/api/v1/p3data")
def p3data(request: Request, page: int = Query(1, ge=1),
           limit: int = Query(0, ge=0, le=5000)):
    """ABC tahlili — `build_p3data()` chiqishi, o'zgarishsiz."""
    if not limit:
        return _pipe_raw("p3data", request)
    d = _pipe("p3data")
    if not isinstance(d, list):
        return d
    return {"total": len(d), "page": page, "limit": limit,
            "pages": (len(d) + limit - 1) // limit,
            "items": d[(page - 1) * limit: page * limit]}


@app.get("/api/v1/p2data")
def p2data(
    request: Request,
    q: str | None = None,
    abc_class: str | None = Query(None, pattern="^[ABC]$", alias="abc"),
    page: int = Query(1, ge=1),
    limit: int = Query(0, ge=0, le=5000, description="0 = hammasi (mos rejim)"),
):
    """Mahsulotlar — `build_p2data()` chiqishi. limit=0 bo'lsa butun ro'yxat
    (frontend hozir shuni kutadi), aks holda sahifalangan qism."""
    if not limit and not q and not abc_class:
        return _pipe_raw("p2data", request)  # o'zgarishsiz to'liq ro'yxat — tayyor baytlar
    rows = _pipe("p2data")
    if q:
        needle = q.strip().lower()
        rows = [x for x in rows if needle in str(x.get("name", "")).lower()
                or needle == str(x.get("sku", ""))]
    if abc_class:
        rows = [x for x in rows if x.get("abc") == abc_class]
    if not limit:
        return rows
    return {"total": len(rows), "page": page, "limit": limit,
            "pages": (len(rows) + limit - 1) // limit,
            "items": rows[(page - 1) * limit: page * limit]}


@app.get("/api/v1/invdata")
def invdata(request: Request):
    """Zaxira/Zakas uchun asosiy tuzilma — `build_invdata()` chiqishi.
    Frontend shundan `ZITEMS` quradi va zakasni O'ZI hisoblaydi."""
    return _pipe_raw("invdata", request)


@app.get("/api/v1/supplierdata")
def supplierdata(request: Request):
    """Ta'minotchilar — `build_supplierdata()` chiqishi, o'zgarishsiz."""
    return _pipe_raw("supplierdata", request)


@app.get("/api/v1/kirimdata")
def kirimdata(sku: str | None = None):
    """Kirim — `build_kirimdata()` chiqishi.

    To'liq tuzilma juda katta (data_kirim.json ~60 MB), shuning uchun
    `?sku=` bilan bitta mahsulot so'ralishi mumkin. Zakas uchun yetarli
    bo'lgan qisqa variant: /api/v1/kirimdata/summary
    """
    d = _pipe("kirimdata")
    if sku:
        return {"skus": {sku: d.get("skus", {}).get(str(sku), {})}}
    return d


@app.get("/api/v1/kirimdata/summary")
def kirimdata_summary(request: Request):
    """Zakas uchun zarur MINIMUM: har SKU bo'yicha oxirgi kirim holati.

    Frontend `krPendingQty()` va `krLastDate()` faqat shu maydonlarni
    ishlatadi — butun kirim tarixini (~60 MB) yuborish shart emas.
    Pipeline'da oldindan tayyorlanadi (pipeline_runner.py).
    """
    return _pipe_raw("kirim_summary", request)


# ─── p8 — Kirim (baza kesimida, tez ro'yxat/qidiruv uchun) ─────────────────

@app.get("/api/v1/kirim")
def kirim(
    q: str | None = None,
    supplier: str | None = None,
    status: str | None = None,
    dfrom: str | None = Query(None, alias="from"),
    dto: str | None = Query(None, alias="to"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
):
    """Kirim yozuvlari SKU kesimida.

    DIQQAT: bitta buyurtmada bir xil SKU bir necha qatorda kelishi mumkin
    (turli partiya). Bu yerda ular QO'SHILADI — Invan'ning o'z `total_amount`
    raqami ham shunday hisoblaydi (tekshirilgan). Eski `merge_kirimdata`
    ularning faqat bittasini saqlardi va miqdorni kam ko'rsatardi.
    """
    dfrom, dto = _range(dfrom, dto, default_days=90)
    where, params = ["a.d BETWEEN ? AND ?"], [dfrom, dto]
    if q:
        where.append("(a.product_name LIKE ? OR a.sku = ?)")
        params += [f"%{q.strip()}%", q.strip()]
    if supplier:
        where.append("a.supplier = ?"); params.append(supplier)
    if status:
        where.append("a.status = ?"); params.append(status)
    w = " AND ".join(where)

    total = db.scalar(
        f"SELECT COUNT(*) FROM (SELECT 1 FROM arrivals a WHERE {w} GROUP BY a.sku)",
        tuple(params), 0)
    items = db.rows(
        f"""SELECT a.sku, MAX(a.product_name) AS name,
                   SUM(a.received_qty) AS received, SUM(a.qty) AS expected,
                   SUM(a.received_qty * a.cost) AS amount,
                   COUNT(*) AS lines, MAX(a.d) AS last_date,
                   p.stock, p.supplier
            FROM arrivals a LEFT JOIN products p ON p.sku = a.sku
            WHERE {w} GROUP BY a.sku
            ORDER BY amount DESC LIMIT ? OFFSET ?""",
        tuple(params + [limit, (page - 1) * limit]))
    return {"from": dfrom, "to": dto, "total": total, "page": page,
            "limit": limit, "pages": (total + limit - 1) // limit, "items": items}


@app.get("/api/v1/kirim/{sku}")
def kirim_detail(sku: str, limit: int = Query(100, ge=1, le=1000)):
    """Bitta mahsulotning butun kirim tarixi (tarixiy tannarx manbai)."""
    return {"sku": sku, "arrivals": db.rows(
        "SELECT a.d, a.status, a.qty AS expected, a.received_qty AS received, "
        "       a.cost, a.supplier, o.external_id AS order_no, a.order_id "
        "FROM arrivals a LEFT JOIN supplier_orders o ON o.id = a.order_id "
        "WHERE a.sku = ? ORDER BY a.d DESC LIMIT ?", (sku, limit))}


@app.get("/api/v1/kirim/open/orders")
def kirim_open():
    """Ochiq (hali to'liq kelmagan) buyurtmalar — zakas hisobida kerak."""
    return {"items": db.rows(
        "SELECT o.id, o.external_id AS order_no, o.d, o.status, o.supplier, "
        "       o.total_price, COUNT(a.id) AS lines, "
        "       SUM(a.qty - a.received_qty) AS pending_qty "
        "FROM supplier_orders o JOIN arrivals a ON a.order_id = o.id "
        "WHERE o.status NOT LIKE 'Received%' AND o.status <> 'Cancelled' "
        "GROUP BY o.id ORDER BY o.d DESC LIMIT 500")}


# ─── p11 — Firmalar (xaridor firmalar) ──────────────────────────────────────

@app.get("/api/v1/firmalar")
def firmalar(q: str | None = None, only_debt: bool = False):
    where, params = ["1=1"], []
    if q:
        where.append("(nom LIKE ? OR tin = ? OR tel LIKE ?)")
        params += [f"%{q.strip()}%", q.strip(), f"%{q.strip()}%"]
    if only_debt:
        where.append("balans < 0")
    return {"items": db.rows(
        "SELECT id, nom, tin, tel, xarid, balans, guruh, shartnoma, shartnoma_sana "
        f"FROM clients_business WHERE {' AND '.join(where)} "
        "ORDER BY ABS(balans) DESC LIMIT 1000", tuple(params))}


# ─── p5 — Zaxira / Stock ────────────────────────────────────────────────────

@app.get("/api/v1/stock")
def stock(
    q: str | None = None,
    supplier: str | None = None,
    only_zero: bool = False,
    days: int = Query(30, ge=1, le=365, description="talab hisoblash oynasi"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
):
    """Joriy qoldiq + so'nggi `days` kunlik talab → necha kunga yetadi."""
    last = db.scalar("SELECT MAX(d) FROM daily_sku") or date.today().isoformat()
    dfrom = (date.fromisoformat(last) - timedelta(days=days - 1)).isoformat()

    where, params = ["p.is_active = 1"], []
    if q:
        where.append("(p.name LIKE ? OR p.sku = ?)"); params += [f"%{q.strip().lower()}%", q.strip()]
    if supplier:
        where.append("p.supplier = ?"); params.append(supplier)
    if only_zero:
        where.append("p.stock <= 0")
    w = " AND ".join(where)

    total = db.scalar(f"SELECT COUNT(*) FROM products p WHERE {w}", tuple(params), 0)
    items = db.rows(
        f"""SELECT p.sku, p.name_raw AS name, p.supplier, p.unit, p.stock,
                   p.price, p.supply_price,
                   COALESCE(s.qty, 0) AS sold,
                   COALESCE(s.qty, 0) / ? AS avg_day,
                   CASE WHEN COALESCE(s.qty,0) > 0
                        THEN p.stock / (s.qty / ?) ELSE NULL END AS days_left,
                   s.last_sale
            FROM products p
            LEFT JOIN (SELECT sku, SUM(qty) AS qty, MAX(d) AS last_sale
                       FROM daily_sku WHERE d BETWEEN ? AND ? GROUP BY sku) s
                   ON s.sku = p.sku
            WHERE {w}
            ORDER BY days_left ASC NULLS LAST
            LIMIT ? OFFSET ?""",
        tuple([days, days, dfrom, last] + params + [limit, (page - 1) * limit]),
    )
    return {"window_from": dfrom, "window_to": last, "total": total, "page": page,
            "limit": limit, "pages": (total + limit - 1) // limit, "items": items}
