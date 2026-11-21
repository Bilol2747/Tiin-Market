"""
db.py — ma'lumot bazasi ulanish qatlami.

Ikki rejim, BIR XIL interfeys (`ro/rw/rows/one/scalar`) — app.py va boshqa
chaqiruvchilar qaysi rejim ishlatilayotganini bilishi shart emas:

- LOKAL (odatiy): SQLite fayli (`backend/tiin.db`). API faqat-o'qish
  ulanishda, sync worker alohida yozuvchi ulanishda ishlaydi — WAL rejimi
  tufayli bir-birini bloklamaydi.
- VERCEL (serverless): muhitda `TURSO_DATABASE_URL` bo'lsa, o'qish Turso'ga
  (libsql, HTTP orqali) yo'naltiriladi — funksiya diskda saqlanadigan
  fayl bazaga ega emas. Yozuv Vercel funksiyasida bo'lmaydi (`rw()` xato
  qaytaradi) — sinxronizatsiya alohida `sync_worker.py` orqali (cron-job.org
  triggeri bilan) davom etadi.
"""
import os
import sqlite3
import threading
from pathlib import Path

DB_PATH = Path(__file__).parent / "tiin.db"

_local = threading.local()

USE_TURSO = bool(os.environ.get("TURSO_DATABASE_URL", "").strip())


def _configure(con):
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA busy_timeout = 5000")
    con.execute("PRAGMA cache_size = -64000")   # ~64 MB sahifa keshi
    con.execute("PRAGMA temp_store = MEMORY")
    return con


def _sqlite_ro():
    con = getattr(_local, "ro_con", None)
    if con is None:
        uri = f"file:{DB_PATH.as_posix()}?mode=ro"
        con = _configure(sqlite3.connect(uri, uri=True, check_same_thread=False))
        _local.ro_con = con
    return con


def _turso_client():
    """Bitta oqim/funksiya chaqiruvi ichida qayta ishlatiladigan Turso ulanish.

    `libsql://` (websocket, hrana2) o'rniga ATAYLAB `https://` (oddiy HTTP)
    ishlatiladi: sinovda `libsql://` ulanish osilib qoldi/xato berdi (ehtimol
    bir vaqtning o'zida faqat bitta websocket ulanishga ruxsat beradi — sync
    worker allaqachon o'ziniki bilan band edi), `https://` esa har so'rovni
    mustaqil HTTP chaqiruv sifatida yuboradi — bir nechta Vercel funksiya
    chaqiruvi PARALEL ishlaganda ham to'qnashmaydi, va sinovda 0.1-1s ichida
    javob berdi."""
    c = getattr(_local, "turso_client", None)
    if c is None:
        import libsql_client
        url = os.environ["TURSO_DATABASE_URL"].strip()
        if url.startswith("libsql://"):
            url = "https://" + url[len("libsql://"):]
        token = os.environ.get("TURSO_AUTH_TOKEN", "").strip()
        c = libsql_client.create_client_sync(url=url, auth_token=token)
        _local.turso_client = c
    return c


def ro():
    """Faqat-o'qish ulanish (har oqim uchun bittadan, qayta ishlatiladi)."""
    return _turso_client() if USE_TURSO else _sqlite_ro()


class _TursoCursor:
    """`sqlite3.Cursor`ning ishlatiladigan qismini (fetchone/fetchall/
    `for row in cursor:` iteratsiyasi) taqlid qiladi. libsql Row allaqachon
    `r[0]`/`r["col"]` ikkalasini ham qo'llab-quvvatlaydi — sqlite3.Row bilan
    bir xil."""
    __slots__ = ("_rs",)

    def __init__(self, rs):
        self._rs = rs

    def __iter__(self):
        return iter(self._rs.rows)

    def fetchone(self):
        return self._rs.rows[0] if self._rs.rows else None

    def fetchall(self):
        return list(self._rs.rows)


class _TursoWriteConn:
    """`db.rw()`ning Turso muqobili — sync_worker.py BIR HARF O'ZGARISHSIZ
    ishlashi uchun sqlite3.Connection APIsining kerakli qismini
    (execute/executemany/context-manager) taqlid qiladi.

    DIQQAT: `with con:` bloki HAQIQIY tranzaksiya EMAS — har `execute`/
    `executemany` darhol Turso'ga qo'llanadi. Bu xavfsiz, chunki bu yerdagi
    barcha yozuvlar IDEMPOTENT (`ON CONFLICT DO UPDATE`, yoki avval DELETE
    keyin INSERT — watermark asosida) — jarayon o'rtada uzilsa, keyingi
    sinxronizatsiya (`OVERLAP_MINUTES`/`KIRIM_OVERLAP_PAGES` tufayli) ustidan
    qayta yozib, o'zi tiklaydi."""

    _BATCH = 500

    def __init__(self, client):
        self._client = client

    def execute(self, sql, params=()):
        return _TursoCursor(self._retry(lambda: self._client.execute(sql, list(params))))

    def executemany(self, sql, seq_of_params):
        import libsql_client
        stmts = [libsql_client.Statement(sql, list(p)) for p in seq_of_params]
        for i in range(0, len(stmts), self._BATCH):
            chunk = stmts[i:i + self._BATCH]
            self._retry(lambda chunk=chunk: self._client.batch(chunk))

    @staticmethod
    def _retry(fn):
        """Bir nechta jarayon bir vaqtda katta hajmda yozganda (masalan
        parallel backfill) Turso vaqti-vaqti bilan SQLITE_BUSY yoki tarmoq
        vaqti tugashi (TimeoutError/ConnectionError) qaytaradi -
        2026-08-11'da 5 ta parallel backfill ishchisi shundan qulab tushgan
        edi (avval faqat BUSY/LOCKED matni tutilardi, boshqa xatolar
        qayta urinishsiz butun jarayonni o'ldirardi). Bu yerdagi BARCHA
        yozuvlar idempotent (klass docstringiga qarang), shuning uchun
        istalgan xatoda qayta urinish xavfsiz."""
        import time
        last = None
        for attempt in range(1, 6):
            try:
                return fn()
            except Exception as exc:
                last = exc
                time.sleep(attempt * 2)
        raise last

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def commit(self):
        pass

    def close(self):
        pass


def rw():
    """Yozuvchi ulanish (sync worker uchun)."""
    if USE_TURSO:
        return _TursoWriteConn(_turso_client())
    con = _configure(sqlite3.connect(DB_PATH, check_same_thread=False))
    con.execute("PRAGMA journal_mode = WAL")
    con.execute("PRAGMA synchronous = NORMAL")
    con.execute("PRAGMA foreign_keys = ON")
    return con


def rows(sql, params=()):
    if USE_TURSO:
        rs = _turso_client().execute(sql, list(params))
        cols = rs.columns
        return [dict(zip(cols, r)) for r in rs.rows]
    return [dict(r) for r in _sqlite_ro().execute(sql, params).fetchall()]


def one(sql, params=()):
    if USE_TURSO:
        rs = _turso_client().execute(sql, list(params))
        return dict(zip(rs.columns, rs.rows[0])) if rs.rows else None
    r = _sqlite_ro().execute(sql, params).fetchone()
    return dict(r) if r else None


def scalar(sql, params=(), default=None):
    if USE_TURSO:
        rs = _turso_client().execute(sql, list(params))
        if not rs.rows:
            return default
        v = rs.rows[0][0]
        return v if v is not None else default
    r = _sqlite_ro().execute(sql, params).fetchone()
    return r[0] if r and r[0] is not None else default
