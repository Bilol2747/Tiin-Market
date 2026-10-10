#!/usr/bin/env python3
"""
backend_shared_utils.py — barcha backend build skriptlari (backend_p1_boshsahifa.py,
backend_p2_mahsulotlar.py, backend_p3_abc.py, backend_p5_stock.py,
backend_p6_suppliers.py, build_legacy_excel_pipeline.py, build_all_from_api.py)
uchun umumiy konstanta va yordamchi funksiyalar.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).parent

# ─── ulgurji aniqlash konstantalari ───
DUMMY_TINS = {"", "999999999", "888888888", "555555555"}
BUSINESS_WORDS = (
    "mchj", "ooo", "ооо", "xk", "hotel", "kafe", "cafe", "oshxona",
    "restaurant", "restoran", "supply", "development", "market", "магазин",
    "school", "maktab", "bank", "aj ",
)
NON_BUSINESS = {"", "xodimlar", "nujda", "farrux"}

WEEKDAYS_UZ = ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba", "Yakshanba"]
MONTHS_UZ   = {1: "Yanvar", 2: "Fevral", 3: "Mart", 4: "Aprel", 5: "May", 6: "Iyun",
               7: "Iyul", 8: "Avgust", 9: "Sentabr", 10: "Oktabr", 11: "Noyabr", 12: "Dekabr"}


def norm(v):
    return re.sub(r"\s+", " ", str(v or "")).strip().lower()

def rq(v):
    v = float(v)
    return int(round(v)) if abs(v - round(v)) < 0.001 else round(v, 3)

def pctl(vals, p):
    if not vals: return 0.0
    s = sorted(vals)
    return float(s[min(len(s) - 1, int(p * (len(s) - 1)))])

def median(vals): return pctl(vals, 0.5)

def is_wholesale(customer, tin):
    cn = norm(customer)
    tn = str(tin or "").strip()
    if tn not in DUMMY_TINS and re.fullmatch(r"\d{9}", tn):
        return True
    if cn in NON_BUSINESS:
        return False
    return any(w in cn for w in BUSINESS_WORDS)
