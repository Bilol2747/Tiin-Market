#!/usr/bin/env python3
"""
pipeline_runner.py — mavjud hisob kodlarini bazadan ishga tushiradi va keshlaydi.

PRINSIP: bironta formula bu yerda yozilmagan. Faqat `build_all_from_api.py`
dagi bilan BIR XIL tartibda, BIR XIL funksiyalar chaqiriladi — yagona farq,
kiruvchi ma'lumot Turso/JSON o'rniga SQLite'dan keladi (pipeline_adapter.py).

Nega keshlanadi: to'liq hisob 11-42 sekund oladi (oynaga qarab). Buni har
so'rovda qilib bo'lmaydi, lekin har 2-5 daqiqada fonda qayta hisoblash mumkin —
eski tizimdagi 30 daqiqa + git commit + Vercel deploy o'rniga.

Natija diskka ham yoziladi (`pipeline_cache.pkl`), shuning uchun server qayta
ishga tushganda darhol tayyor ma'lumot bilan javob beradi va yangisini fonda
hisoblaydi.

Ishlatish:
    python backend/pipeline_runner.py            # bir marta hisoblab keshga yozadi
    python backend/pipeline_runner.py --watch    # doimiy (har REFRESH_SECONDS)
"""
import argparse
import pickle
import sys
import threading
import time
from datetime import date, datetime, timedelta
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(HERE))

import db                                                        # noqa: E402
from pipeline_adapter import (orders_from_db, products_from_db,  # noqa: E402
                              supplier_orders_from_db)

# ↓ MAVJUD hisob kodlari — o'zgartirilmagan, faqat chaqiriladi
from build_all_from_api import api_read_sales, SITE_WINDOW_DAYS   # noqa: E402
from build_sales_demand import api_records, build as build_dailydata_improved  # noqa: E402
from backend_p5_stock import build_invdata                        # noqa: E402
from backend_p2_mahsulotlar import build_p2data                   # noqa: E402
from backend_p3_abc import build_p3data                           # noqa: E402
from backend_p1_boshsahifa import build_p1data                    # noqa: E402
from backend_p6_suppliers import build_supplierdata               # noqa: E402
from backend_p8_kirim import build_kirimdata                      # noqa: E402
from build_prev_avg import (_compute_avg30_stock_aware,           # noqa: E402
                            _compute_pav_from_item)

CACHE_PATH = HERE / "pipeline_cache.pkl"
REFRESH_SECONDS = 180        # fonda qayta hisoblash oralig'i
PAV_HISTORY_BASE = date(2026, 1, 1)   # build_prev_avg.py:46 HISTORY_BASE_DATE bilan bir xil


def log(*a):
    print(datetime.now().strftime("%H:%M:%S"), "[pipeline]", *a, flush=True)


def _arrivals_map(con):
    """build_invdata() kutgan shakl: {sku: {"date": oxirgi kirim sanasi}}"""
    return {r["sku"]: {"date": r["md"]} for r in con.execute(
        "SELECT sku, MAX(d) AS md FROM arrivals WHERE sku <> '' GROUP BY sku")}


def _kirim_received_by_day(con):
    """{sku: {date: miqdor}} — FAQAT `Received` statusdagi kirimlar.

    Shu filtr build_prev_avg.py:358 dan olingan: hali kelmagan (Open/New)
    buyurtma stokni oshirmagan, shuning uchun stok rekonstruksiyasida
    hisobga olinmasligi kerak.
    """
    out = {}
    for r in con.execute(
            "SELECT sku, d, SUM(received_qty) AS q FROM arrivals "
            "WHERE status = 'Received' AND sku <> '' AND received_qty > 0 "
            "GROUP BY sku, d"):
        try:
            out.setdefault(r["sku"], {})[date.fromisoformat(r["d"])] = r["q"]
        except (ValueError, TypeError):
            continue
    return out


def _apply_avg30_and_pav(invdata, dailydata, dailydata_long, products, kirim_by_day,
                         hist_base_short, verbose=True):
    """`avg30sa` va `pav`/`pavm` ni invdata ga qo'shadi.

    HISOB QILINMAYDI — `build_prev_avg.py` ning O'Z funksiyalari chaqiriladi:
      * `_compute_avg30_stock_aware()` — muntazam zakas kunlik o'rtachasi
      * `_compute_pav_from_item()`     — chuqur zakas (avvalgi faol davr)

    avg30sa qisqa (30 kunlik) oynadan, pav esa UZUN tarixdan hisoblanadi —
    chunki oylab sotilmagan tovarning oxirgi faol davri 30 kun ichida bo'lmaydi.
    """
    by_sku = {}
    for entry in invdata.values():
        sku = str(entry.get("sku") or "")
        if sku:
            by_sku[sku] = entry

    items_short = dailydata.get("items", {})
    labels_short = dailydata.get("__meta__", {}).get("labels", [])
    n_short = len(labels_short)

    n_avg = n_pav = 0
    for pk, it in items_short.items():
        sku = str(it.get("sku") or "")
        entry = by_sku.get(sku)
        if not entry:
            continue
        cur = products.get(sku, {}).get("a")
        if cur is None:
            continue
        res = _compute_avg30_stock_aware(
            it.get("q") or [], it.get("rt") or [], it.get("wi") or [],
            float(cur), kirim_by_day.get(sku, {}), hist_base_short, n_short)
        if res and res[0] > 0:
            entry["avg30sa"] = res[0]
            n_avg += 1

    if dailydata_long:
        base_long = dailydata_long.get("__meta__", {}).get("labels", [])
        base_long = date.fromisoformat(base_long[0]) if base_long else hist_base_short
        for pk, it in dailydata_long.get("items", {}).items():
            entry = by_sku.get(str(it.get("sku") or ""))
            if not entry:
                continue
            r = _compute_pav_from_item(it, base_long)
            if r:
                entry["pav"] = r["pav"]
                entry["pavm"] = r["pavm"]
                n_pav += 1

    if verbose:
        log(f"avg30sa: {n_avg:,} mahsulot  |  pav: {n_pav:,} mahsulot")
    return n_avg, n_pav


def compute(con, window_days=SITE_WINDOW_DAYS, long_history=True, verbose=True):
    """build_all_from_api.py:555-681 bilan BIR XIL ketma-ketlik."""
    t0 = time.time()
    last = con.execute("SELECT MAX(d) FROM receipts").fetchone()[0]
    if not last:
        raise RuntimeError("Bazada chek yo'q — avval ETL/backfill ishlatilsin.")
    dfrom = (date.fromisoformat(last) - timedelta(days=window_days)).isoformat()

    if verbose:
        log(f"Oyna {dfrom} .. {last} — hisob boshlandi")

    orders = orders_from_db(con, dfrom=dfrom)
    products = products_from_db(con)

    receipts, pnames, pskus, pcats, refund_total, refund_by_day, min_d, max_d = \
        api_read_sales(orders)
    dailydata = build_dailydata_improved(api_records(orders))
    invdata = build_invdata(products, _arrivals_map(con))
    p2data = build_p2data(receipts, pnames, pskus, dailydata, products, min_d, max_d)
    p3data = build_p3data(p2data, dailydata, max_d)
    p1data = build_p1data(receipts, pnames, pskus, pcats, refund_total, refund_by_day,
                          p2data, products, min_d, max_d)
    p1data["builtAt"] = datetime.now().strftime("%H:%M, %d/%m/%Y")
    supplierdata = build_supplierdata(p2data, products)

    # ── Zakas uchun avg30sa (qisqa oyna) va pav (UZUN tarix) ──
    # pav oylab sotilmagan tovarning oxirgi faol davrini qidiradi, shuning
    # uchun 30 kunlik oyna yetmaydi — alohida, kengroq oyna kerak.
    dailydata_long = None
    if long_history:
        t_l = time.time()
        orders_long = orders_from_db(con, dfrom=PAV_HISTORY_BASE.isoformat())
        dailydata_long = build_dailydata_improved(api_records(orders_long))
        if verbose:
            log(f"Uzun tarix (pav uchun): {len(orders_long):,} order, {time.time()-t_l:.1f}s")
    _apply_avg30_and_pav(invdata, dailydata, dailydata_long, products,
                         _kirim_received_by_day(con),
                         date.fromisoformat(dfrom), verbose=verbose)
    kirimdata = build_kirimdata(supplier_orders_from_db(con))

    # Zakas uchun zarur MINIMUM: har SKU bo'yicha oxirgi kirim holati.
    # Frontend `krPendingQty()`/`krLastDate()` faqat shu maydonlarni ishlatadi,
    # butun kirim tarixi (~60 MB) yuborilishi shart emas. Maydonlar
    # `build_kirimdata()` ning O'Z chiqishidan olinadi — hisob qilinmaydi.
    kirim_summary = {}
    for sku, e in (kirimdata.get("skus") or {}).items():
        arrs = e.get("arrivals") or []
        latest = max(arrs, key=lambda a: a.get("date") or "") if arrs else {}
        kirim_summary[sku] = {
            "last_date": e.get("last_date", ""),
            "last_status": e.get("last_status", ""),
            "last_cost": e.get("last_cost", 0),
            "total_received": e.get("total_received", 0),
            "pending_status": latest.get("status", ""),
            "pending_expected": latest.get("expected", 0),
        }

    took = time.time() - t0
    if verbose:
        log(f"Tayyor: {len(p2data):,} mahsulot, {len(receipts):,} chek, {took:.1f}s")

    return {
        "p1data": p1data, "p2data": p2data, "p3data": p3data,
        "invdata": invdata, "supplierdata": supplierdata,
        "dailydata": dailydata, "kirimdata": kirimdata,
        "kirim_summary": {"skus": kirim_summary},
        "products": products,
        "meta": {"from": min_d.isoformat() if min_d else dfrom,
                 "to": max_d.isoformat() if max_d else last,
                 "window_days": window_days,
                 "receipts": len(receipts),
                 "built_at": datetime.now().isoformat(timespec="seconds"),
                 "took_seconds": round(took, 1)},
    }


# Har qayta hisoblashdan keyin BIR MARTA JSON'ga o'giriladigan tuzilmalar.
# Sabab: 11 ming qatorli `p2data` ni har so'rovda seriyalash 6.6 s olardi —
# holbuki ma'lumot 3 daqiqada bir marta o'zgaradi. Bir marta o'girib,
# tayyor baytlarni uzatamiz (o'lchandi: 6600 ms -> ~20 ms).
PRESERIALIZE = ("p1data", "p2data", "p3data", "invdata", "supplierdata", "kirim_summary")


class Cache:
    """Ip-xavfsiz kesh: o'qish bloklanmaydi, yangisi tayyor bo'lgach almashtiriladi."""

    def __init__(self):
        self._data = None
        self._json = {}
        self._lock = threading.Lock()
        self._building = False

    def _build_json(self, data):
        """Har tuzilmani BIR MARTA JSON'ga o'giradi VA gzip qiladi.

        Nega gzip ham oldindan: o'lchandi — 9.3 MB `p2data` ni siqish 504 ms
        oladi. Ma'lumot 3 daqiqada bir marta o'zgargani uchun uni har so'rovda
        qayta siqish bekor sarf. Oldindan siqilgan baytlar ~11 ms da uzatiladi
        va tarmoqqa 9.3 MB emas, 2.1 MB ketadi.
        """
        import gzip as _gzip
        import json as _json
        out = {}
        for k in PRESERIALIZE:
            if k not in data:
                continue
            try:
                raw = _json.dumps(data[k], ensure_ascii=False,
                                  separators=(",", ":")).encode("utf-8")
                out[k] = {"raw": raw, "gz": _gzip.compress(raw, compresslevel=6)}
            except (TypeError, ValueError) as exc:
                log(f"! {k} JSON'ga o'girilmadi: {exc.__class__.__name__}")
        if out:
            r = sum(len(v["raw"]) for v in out.values()) / 1048576
            g = sum(len(v["gz"]) for v in out.values()) / 1048576
            log(f"JSON tayyorlandi: {r:.1f} MB -> {g:.1f} MB (siqilgan)")
        return out

    def json_bytes(self, key, gzipped=False):
        """Tayyor JSON baytlari (yoki topilmasa None)."""
        with self._lock:
            e = self._json.get(key)
        return None if e is None else (e["gz"] if gzipped else e["raw"])

    def load_from_disk(self):
        if CACHE_PATH.exists():
            try:
                with CACHE_PATH.open("rb") as f:
                    d = pickle.load(f)
                j = self._build_json(d)
                with self._lock:
                    self._data, self._json = d, j
                log(f"Diskdagi keshdan yuklandi ({d['meta']['built_at']})")
                return True
            except Exception as exc:
                log(f"Diskdagi kesh o'qilmadi ({exc.__class__.__name__}) — qayta hisoblanadi")
        return False

    def rebuild(self, verbose=True):
        if self._building:
            return False
        self._building = True
        try:
            con = db.rw()          # o'qish uchun ham bo'ladi; WAL bloklamaydi
            import sqlite3
            con.row_factory = sqlite3.Row
            con.execute("PRAGMA cache_size = -200000")
            try:
                fresh = compute(con, verbose=verbose)
            finally:
                con.close()
            fresh_json = self._build_json(fresh)
            with self._lock:
                self._data, self._json = fresh, fresh_json
            try:
                tmp = CACHE_PATH.with_suffix(".tmp")
                with tmp.open("wb") as f:
                    pickle.dump(fresh, f, protocol=pickle.HIGHEST_PROTOCOL)
                tmp.replace(CACHE_PATH)
            except Exception as exc:
                log(f"Keshni diskka yozib bo'lmadi: {exc.__class__.__name__}")
            return True
        finally:
            self._building = False

    def get(self, key=None):
        with self._lock:
            d = self._data
        if d is None:
            return None
        return d if key is None else d.get(key)

    @property
    def ready(self):
        return self._data is not None

    def start_background(self, interval=REFRESH_SECONDS):
        def loop():
            while True:
                time.sleep(interval)
                try:
                    self.rebuild(verbose=True)
                except Exception as exc:
                    log(f"! Qayta hisoblashda xato: {exc.__class__.__name__}: {exc}")
        t = threading.Thread(target=loop, daemon=True, name="pipeline-refresh")
        t.start()
        log(f"Fon yangilash yoqildi (har {interval}s)")
        return t


CACHE = Cache()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--watch", action="store_true", help="doimiy qayta hisoblash")
    ap.add_argument("--interval", type=int, default=REFRESH_SECONDS)
    args = ap.parse_args()

    CACHE.rebuild()
    m = CACHE.get("meta")
    log(f"Kesh yozildi: {CACHE_PATH.name} "
        f"({CACHE_PATH.stat().st_size/1048576:.1f} MB, {m['took_seconds']}s)")
    if args.watch:
        CACHE.start_background(args.interval)
        try:
            while True:
                time.sleep(3600)
        except KeyboardInterrupt:
            log("To'xtatildi.")


if __name__ == "__main__":
    main()
