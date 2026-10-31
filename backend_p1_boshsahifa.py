#!/usr/bin/env python3
"""
backend_p1_boshsahifa.py — "Bosh sahifa" (p1) bo'limi uchun KPI kartochkalar,
kunlik/haftalik daromad, top kategoriya/mahsulot/xodim va ABC yig'masini
shakllantiradi. Frontend: sales_runtime.js renderP1(), P1FULL.
"""
from collections import defaultdict

from backend_shared_utils import WEEKDAYS_UZ, MONTHS_UZ


def build_p1data(receipts, pnames, pskus, pcats, refund_total, refund_by_day, p2data, products, min_d, max_d):
    days = (max_d - min_d).days + 1

    daily     = [0.0] * days
    daily_cost = [0.0] * days  # kunlik kelish narxi (tannarx)
    daily_rec = [0] * days
    weekly    = [0.0] * 7
    emp_rev   = defaultdict(float)
    emp_rec   = defaultdict(int)
    cat_rev   = defaultdict(float)
    emp_daily = defaultdict(lambda: [0.0] * days)   # xodim → kunlik tushum
    emp_rec_daily = defaultdict(lambda: [0] * days) # xodim → kunlik chek soni
    cat_daily = defaultdict(lambda: [0.0] * days)   # kategoriya → kunlik tushum
    gross     = 0.0
    gross_cost = 0.0

    sp_by_pk = {pk: products.get(sku, {}).get("sp", 0) or 0 for pk, sku in pskus.items()}

    for rc in receipts.values():
        di   = (rc["date"] - min_d).days
        rrev = sum(rc["item_rev"].values())
        rcost = sum(qty * sp_by_pk.get(pk, 0) for pk, qty in rc.get("items", {}).items())
        is_refund = rc.get("is_refund", False)
        gross += rrev
        gross_cost += rcost
        in_range = 0 <= di < days
        if in_range:
            daily[di]     += rrev
            daily_cost[di] += rcost
            if not is_refund:
                daily_rec[di] += 1
        weekly[rc["date"].weekday()] += rrev
        emp = rc["employee"] or "Noma'lum"
        emp_rev[emp] += rrev
        if not is_refund:
            emp_rec[emp] += 1
        if in_range:
            emp_daily[emp][di] += rrev
            if not is_refund:
                emp_rec_daily[emp][di] += 1
        for pk, rev in rc["item_rev"].items():
            if pcats.get(pk):
                cat = pcats[pk].most_common(1)[0][0]
            else:
                cat = products.get(pskus.get(pk, ""), {}).get("cat", "")
            if cat:
                cat_rev[cat] += rev
                if in_range:
                    cat_daily[cat][di] += rev

    gross_profit = gross - gross_cost

    nrec      = sum(1 for rc in receipts.values() if not rc.get("is_refund"))
    avg_check = gross / nrec if nrec else 0
    refund_pct = refund_total / gross * 100 if gross else 0
    sku_count = len(p2data)
    staff     = len([e for e in emp_rev if e and e != "Noma'lum"]) or len(emp_rev)

    # kun raqamlari (oy ichidagi sana)
    day_labels = [str((min_d.fromordinal(min_d.toordinal() + k)).day) for k in range(days)]

    weekly_out = [{"day": WEEKDAYS_UZ[i], "val": round(weekly[i])} for i in range(7)]
    top_cats   = [{"name": n, "val": round(v)} for n, v in sorted(cat_rev.items(), key=lambda x: -x[1])[:8]]

    def _item_cost_profit(it):
        sp = products.get(it.get("sku", ""), {}).get("sp", 0) or 0
        cost = sp * (it.get("qty", 0) or 0)
        rev = it.get("rev", 0) or 0
        return round(cost), round(rev - cost)

    top_items = []
    for it in p2data[:8]:
        cost, profit = _item_cost_profit(it)
        top_items.append({"name": it["name"], "val": it["rev"], "cost": cost, "profit": profit})

    # faqat kelish narxi Invan'da kiritilgan mahsulotlar - aks holda noma'lum
    # tannarx 0 deb olinib, sun'iy ravishda "100% foyda" bo'lib chiqib qoladi
    has_cost = [it for it in p2data if (products.get(it.get("sku", ""), {}).get("sp", 0) or 0) > 0]
    top_items_profit = []
    for it in sorted(has_cost, key=lambda it: _item_cost_profit(it)[1], reverse=True)[:8]:
        cost, profit = _item_cost_profit(it)
        top_items_profit.append({"name": it["name"], "val": profit, "rev": it.get("rev", 0), "cost": cost})

    top_emp    = [{"name": n, "val": round(emp_rev[n]), "rec": emp_rec[n]}
                  for n in sorted(emp_rev, key=lambda x: -emp_rev[x])[:8]]

    a_count = sum(1 for it in p2data if it["abc"] == "A")
    b_count = sum(1 for it in p2data if it["abc"] == "B")
    c_count = sum(1 for it in p2data if it["abc"] == "C")
    a_rev   = sum(it["rev"] for it in p2data if it["abc"] == "A")
    b_rev   = sum(it["rev"] for it in p2data if it["abc"] == "B")
    c_rev   = sum(it["rev"] for it in p2data if it["abc"] == "C")
    total_count = len(p2data) or 1

    best_i  = max(range(days), key=lambda i: daily[i]) if days else 0
    worst_i = min(range(days), key=lambda i: daily[i]) if days else 0

    # ── oraliq (date-range) filtri uchun kunlik massivlar ──
    iso_dates    = [(min_d.fromordinal(min_d.toordinal() + k)).isoformat() for k in range(days)]
    daily_refund = [round(refund_by_day.get(min_d.fromordinal(min_d.toordinal() + k), 0)) for k in range(days)]
    # barcha xodimlar (kichik ro'yxat) — kunlik tushum va chek soni
    emp_daily_out = {e: [round(x) for x in arr] for e, arr in emp_daily.items()}
    emp_rec_daily_out = {e: list(arr) for e, arr in emp_rec_daily.items()}
    # barcha kategoriyalar — kunlik tushum
    cat_daily_out = {c: [round(x) for x in arr] for c, arr in cat_daily.items()}
    # top 120 mahsulot — kunlik tushum va kelish narxi (rev/cost * kunlik_miqdor/jami_miqdor)
    items_daily = []
    for it in p2data[:120]:
        q = it.get("qty", 0) or 0
        rev = it.get("rev", 0) or 0
        sp = products.get(it.get("sku", ""), {}).get("sp", 0) or 0
        dq = it.get("d", [])
        if q > 0 and dq:
            items_daily.append({
                "name": it["name"],
                "d": [round(rev * (x / q)) for x in dq],
                "c": [round(sp * x) for x in dq],
                "hc": sp > 0,  # kelish narxi Invan'da kiritilganmi (foyda reytingi uchun)
            })

    mname = MONTHS_UZ.get(min_d.month, str(min_d.month))
    title = f"{mname} {min_d.year}"
    if min_d.month == max_d.month and min_d.year == max_d.year:
        period_text = (f"{min_d.year}-yil {mname.lower()} oyi · {min_d.day}-{max_d.day} {mname.lower()} · "
                       f"{days} kunlik ma'lumot")
    else:
        period_text = f"{min_d.isoformat()} — {max_d.isoformat()} · {days} kunlik ma'lumot"

    return {
        "title":       title,
        "periodText":  period_text,
        "days":        days,
        "start":       min_d.isoformat(),
        "end":         max_d.isoformat(),
        "gross":       round(gross),
        "cost":        round(gross_cost),
        "profit":      round(gross_profit),
        "refund":      round(refund_total),
        "refund_pct":  round(refund_pct, 2),
        "receipts":    nrec,
        "avg_check":   round(avg_check),
        "sku":         sku_count,
        "staff":       staff,
        "daily":       [round(v) for v in daily],
        "dailyCost":   [round(v) for v in daily_cost],
        "dayLabels":   day_labels,
        "weekly":      weekly_out,
        "top_cats":    top_cats,
        "top_items":   top_items,
        "top_items_profit": top_items_profit,
        "top_emp":     top_emp,
        "dates":       iso_dates,
        "dailyRec":    daily_rec,
        "dailyRefund": daily_refund,
        "empDaily":    emp_daily_out,
        "empRecDaily": emp_rec_daily_out,
        "catDaily":    cat_daily_out,
        "itemsDaily":  items_daily,
        "abc": {
            "a_count": a_count, "b_count": b_count, "c_count": c_count,
            "a_rev": round(a_rev), "b_rev": round(b_rev), "c_rev": round(c_rev),
        },
        "c_assort_pct": round(c_count / total_count * 100),
        "best_day":  {"idx": best_i,  "label": day_labels[best_i]  if days else "",
                      "val": round(daily[best_i])  if days else 0},
        "worst_day": {"idx": worst_i, "label": day_labels[worst_i] if days else "",
                      "val": round(daily[worst_i]) if days else 0},
    }
