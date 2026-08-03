"""
db.py — SQLite ulanish qatlami.

API faqat-o'qish rejimida ulanadi, sync worker esa alohida yozuvchi ulanish
ishlatadi. WAL rejimi tufayli ular bir-birini bloklamaydi: sinxronizatsiya
ketayotganda ham sayt normal javob beraveradi.
"""
import sqlite3
import threading
from pathlib import Path

DB_PATH = Path(__file__).parent / "tiin.db"

_local = threading.local()


def _configure(con):
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA busy_timeout = 5000")
    con.execute("PRAGMA cache_size = -64000")   # ~64 MB sahifa keshi
    con.execute("PRAGMA temp_store = MEMORY")
    return con


def ro():
    """Faqat-o'qish ulanish (har oqim uchun bittadan, qayta ishlatiladi)."""
    con = getattr(_local, "ro_con", None)
    if con is None:
        uri = f"file:{DB_PATH.as_posix()}?mode=ro"
        con = _configure(sqlite3.connect(uri, uri=True, check_same_thread=False))
        _local.ro_con = con
    return con


def rw():
    """Yozuvchi ulanish (sync worker uchun)."""
    con = _configure(sqlite3.connect(DB_PATH, check_same_thread=False))
    con.execute("PRAGMA journal_mode = WAL")
    con.execute("PRAGMA synchronous = NORMAL")
    con.execute("PRAGMA foreign_keys = ON")
    return con


def rows(sql, params=()):
    return [dict(r) for r in ro().execute(sql, params).fetchall()]


def one(sql, params=()):
    r = ro().execute(sql, params).fetchone()
    return dict(r) if r else None


def scalar(sql, params=(), default=None):
    r = ro().execute(sql, params).fetchone()
    return r[0] if r and r[0] is not None else default
