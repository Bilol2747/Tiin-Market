#!/usr/bin/env python3
"""
backend_p2_mahsulotlar.py — "Mahsulotlar" (p2) bo'limi uchun mahsulot kartochkalari
va savat tahlilini (birga sotib olinganlar) shakllantiradi.
Frontend: sales_runtime.js initP2()/loadHistory().
"""
from collections import Counter, defaultdict

from backend_shared_utils import rq


def build_basket(receipts, pk_set):
    prod_rc   = Counter()
    co_count  = defaultdict(Counter)

    for rc in receipts.values():
        if rc.get("is_refund"):
            continue
        pks = [pk for pk in rc["items"] if pk in pk_set]
        for pk in pks:
            prod_rc[pk] += 1
        if len(pks) < 2:
            continue
        for pk in pks:
            for other in pks:
                if other != pk:
                    co_count[pk][other] += 1

    basket = {}
    for pk, others in co_count.items():
        total = prod_rc[pk]
        if not total:
            continue
        basket[pk] = [
            {"pk": opk, "c": round(cnt / total * 100)}
            for opk, cnt in others.most_common(10)
            if round(cnt / total * 100) >= 3
        ]
    return basket


def build_p2data(receipts, pnames, pskus, daily_data, products, min_d, max_d):
    days    = (max_d - min_d).days + 1
    items_d = daily_data["items"]
    labels  = daily_data["__meta__"]["labels"]

    total_rev = sum(it["m"]["revenue"] for it in items_d.values())
    sorted_pks = sorted(items_d, key=lambda k: -items_d[k]["m"]["revenue"])

    # ABC klassifikatsiyasi
    cumrev  = 0
    abc_map = {}
    for pk in sorted_pks:
        cumrev += items_d[pk]["m"]["revenue"]
        pct     = cumrev / total_rev if total_rev else 0
        abc_map[pk] = "A" if pct <= 0.80 else ("B" if pct <= 0.95 else "C")

    basket    = build_basket(receipts, set(items_d.keys()))
    pk_to_name = {pk: pnames[pk].most_common(1)[0][0] for pk in items_d}

    # oxirgi sotuv sanasi + o'shandan o'tgan kunlar (di)
    last_sale = {}
    last_di   = {}
    for pk, it in items_d.items():
        for d in range(days - 1, -1, -1):
            if it["q"][d] > 0:
                last_sale[pk] = labels[d]
                last_di[pk]   = days - 1 - d
                break

    result = []
    for rank, pk in enumerate(sorted_pks, 1):
        it   = items_d[pk]
        sku  = pskus.get(pk, "")
        prod = products.get(sku, {})
        name = pnames[pk].most_common(1)[0][0]
        is_kg = any(kw in prod.get("tp", "").lower() for kw in ("кг", "kg", "кило"))

        b_out = [
            {"n": pk_to_name[e["pk"]], "c": e["c"]}
            for e in basket.get(pk, [])
            if e["pk"] in pk_to_name
        ]

        result.append({
            "r":    rank,
            "rev":  it["m"]["revenue"],
            "rp":   round(it["m"]["revenue"] / total_rev * 100, 2) if total_rev else 0,
            "qty":  it["m"]["totalSold"],
            "rec":  it["m"]["totalReceipts"],
            "p":    rq(prod.get("p", 0)),
            "kg":   is_kg,
            "ld":   last_sale.get(pk, ""),
            "di":   last_di.get(pk, days),
            "cat":  prod.get("cat", ""),
            "catTop": prod.get("catTop", ""),
            "abc":  abc_map.get(pk, "C"),
            "b":    b_out,
            "d":    it["q"],
            "da":   it["m"]["daily"],   # aqlli kunlik velocity (retail + recency)
            "name": name,
            "sku":  sku,
        })

    return result
