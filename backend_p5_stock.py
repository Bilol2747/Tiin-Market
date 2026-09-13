#!/usr/bin/env python3
"""
backend_p5_stock.py — "Stock" (Zaxira, p5) bo'limi uchun inventar ma'lumotlarini
qo'lda (invdata) shakllantiradi. Frontend: sales_runtime.js _buildZItems()/renderZaxira().
"""
from backend_shared_utils import rq


def build_invdata(products, arrivals=None):
    arrivals = arrivals or {}
    result = {}
    for sku, p in products.items():
        name = p["name"]
        if not name:
            continue
        entry = {
            "a":  rq(p["a"]),
            "sku": sku,
            "t":  p["tp"],
            "su": p["su"],
            "p":  rq(p["p"]),
            "sp": rq(p.get("sp", 0)),
            "sb": p["sub"],
            "cat": p.get("cat", ""),
            "catTop": p.get("catTop", "") or p.get("cat", ""),
            "bc": p.get("bc", []),
        }
        arr = arrivals.get(str(sku))
        if arr and arr.get("date"):
            entry["la"] = arr["date"]
        result[name] = entry
    return result
