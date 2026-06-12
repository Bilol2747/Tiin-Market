import argparse
import json
import math
import re
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

import openpyxl


DUMMY_TINS = {"", "999999999", "888888888", "555555555"}
BUSINESS_WORDS = (
    "mchj", "ooo", "ооо", "xk", "hotel", "kafe", "cafe", "oshxona",
    "restaurant", "restoran", "supply", "development", "market", "магазин",
    "school", "maktab", "bank", "aj ",
)
NON_BUSINESS_CUSTOMERS = {"", "xodimlar", "nujda", "farrux"}


def normalize(value):
    return re.sub(r"\s+", " ", str(value or "")).strip().lower()


def percentile(values, p):
    if not values:
        return 0.0
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, math.floor(p * (len(ordered) - 1))))
    return float(ordered[index])


def median(values):
    return percentile(values, 0.5)


def round_quantity(value):
    if abs(value - round(value)) < 0.001:
        return int(round(value))
    return round(value, 3)


def is_explicit_wholesale(customer, tin):
    customer_norm = normalize(customer)
    tin_norm = str(tin or "").strip()
    if tin_norm not in DUMMY_TINS and re.fullmatch(r"\d{9}", tin_norm):
        return True
    if customer_norm in NON_BUSINESS_CUSTOMERS:
        return False
    return any(word in customer_norm for word in BUSINESS_WORDS)


def demand_metrics(retail, explicit_wholesale, inferred_wholesale, retail_cap, threshold):
    days = len(retail)
    total = sum(retail)
    active_days = sum(value > 0.001 for value in retail)
    full_avg = total / days if days else 0

    def window_avg(size):
        data = retail[-min(size, days):]
        return sum(data) / len(data) if data else 0

    avg7 = window_avg(7)
    avg14 = window_avg(14)
    if days >= 21:
        daily = avg7 * 0.50 + avg14 * 0.30 + full_avg * 0.20
    elif days >= 14:
        daily = avg7 * 0.60 + full_avg * 0.40
    else:
        daily = full_avg

    first = sum(retail[: max(1, days // 3)]) / max(1, days // 3)
    last = sum(retail[-max(1, days // 3):]) / max(1, days // 3)
    if first <= 0 and last > 0:
        trend = "new"
    elif first > 0 and last / first >= 1.25:
        trend = "up"
    elif first > 0 and last / first <= 0.75:
        trend = "down"
    else:
        trend = "stable"

    observed = sum(retail) + sum(explicit_wholesale) + sum(inferred_wholesale)
    wholesale = sum(explicit_wholesale) + sum(inferred_wholesale)
    coverage = min(1.0, days / 56)
    activity = active_days / days if days else 0
    sample_strength = min(1.0, math.log10(total + 1) / 2)
    confidence = round(100 * (0.35 * coverage + 0.35 * activity + 0.30 * sample_strength))

    return {
        "daily": round(daily, 2),
        "baselineDaily": round(total / days, 2) if days else 0,
        "week": round(daily * 7, 2),
        "month": round(daily * 30, 2),
        "calendarAvg": round(full_avg, 2),
        "activeAvg": round(total / active_days, 2) if active_days else 0,
        "activeDays": active_days,
        "confidence": max(0, min(100, confidence)),
        "trend": trend,
        "wholesalePct": round(wholesale / observed * 100, 1) if observed else 0,
        "explicitWholesale": round_quantity(sum(explicit_wholesale)),
        "inferredWholesale": round_quantity(sum(inferred_wholesale)),
        "retailCap": round_quantity(retail_cap),
        "bulkThreshold": round_quantity(threshold),
    }


def build(input_path):
    workbook = openpyxl.load_workbook(input_path, read_only=True, data_only=True)
    sheet = workbook.active
    sheet.reset_dimensions()
    rows = sheet.iter_rows(values_only=True)
    headers = next(rows)
    index = {str(value): position for position, value in enumerate(headers)}
    required = {"Date", "Sale Type", "Receipt#", "Sku", "Item", "Qty", "Total Price", "Customer", "TIN"}
    missing = required - set(index)
    if missing:
        raise ValueError(f"Missing columns: {', '.join(sorted(missing))}")

    receipts = {}
    product_names = defaultdict(Counter)
    product_skus = {}
    min_date = None
    max_date = None
    for row in rows:
        if normalize(row[index["Sale Type"]]) != "sale":
            continue
        qty = float(row[index["Qty"]] or 0)
        if qty <= 0:
            continue
        date_value = row[index["Date"]]
        if isinstance(date_value, datetime):
            sale_date = date_value.date()
        else:
            sale_date = datetime.fromisoformat(str(date_value)[:10]).date()
        min_date = sale_date if min_date is None or sale_date < min_date else min_date
        max_date = sale_date if max_date is None or sale_date > max_date else max_date

        receipt_id = str(row[index["Receipt#"]] or "").strip()
        if not receipt_id:
            continue
        receipt = receipts.setdefault(receipt_id, {
            "date": sale_date,
            "customer": "",
            "tin": "",
            "total_qty": 0.0,
            "total_price": 0.0,
            "items": defaultdict(float),
            "item_revenue": defaultdict(float),
            "skus": {},
        })
        customer = str(row[index["Customer"]] or "").strip()
        tin = str(row[index["TIN"]] or "").strip()
        if customer:
            receipt["customer"] = customer
        if tin:
            receipt["tin"] = tin
        receipt["total_qty"] += qty
        receipt["total_price"] += float(row[index["Total Price"]] or 0)
        name = normalize(row[index["Item"]])
        sku = str(row[index["Sku"]] or "").strip()
        product_key = "sku:" + sku if sku else "name:" + name
        product_names[product_key][name] += 1
        product_skus[product_key] = sku
        receipt["items"][product_key] += qty
        receipt["item_revenue"][product_key] += float(row[index["Total Price"]] or 0)

    days = (max_date - min_date).days + 1
    labels = [(min_date.fromordinal(min_date.toordinal() + offset)).isoformat() for offset in range(days)]

    anonymous_quantities = defaultdict(list)
    for receipt in receipts.values():
        if is_explicit_wholesale(receipt["customer"], receipt["tin"]):
            continue
        for product_key, qty in receipt["items"].items():
            anonymous_quantities[product_key].append(qty)

    rules = {}
    for product_key, quantities in anonymous_quantities.items():
        med = median(quantities)
        deviations = [abs(value - med) for value in quantities]
        robust_sigma = median(deviations) * 1.4826
        unit_floor = 3 if any(abs(value - round(value)) > 0.001 for value in quantities) else 5
        preliminary_limit = max(unit_floor, med * 3, med + 6 * robust_sigma)
        retail_sample = [value for value in quantities if value <= preliminary_limit]
        if len(retail_sample) < min(5, len(quantities)):
            retail_sample = quantities
        retail_med = median(retail_sample)
        retail_deviations = [abs(value - retail_med) for value in retail_sample]
        retail_sigma = median(retail_deviations) * 1.4826
        retail_p90 = percentile(retail_sample, 0.90)
        retail_p95 = percentile(retail_sample, 0.95)
        cap = max(unit_floor, retail_p95, retail_med + 4 * retail_sigma)
        threshold = max(
            cap + unit_floor,
            cap * 2,
            retail_p90 * 3,
            retail_med + 8 * retail_sigma,
        )
        rules[product_key] = {
            "cap": cap,
            "threshold": threshold,
            "median": retail_med,
            "p90": retail_p90,
            "sample": len(retail_sample),
        }

    item_data = {}
    for receipt in receipts.values():
        day_index = (receipt["date"] - min_date).days
        explicit = is_explicit_wholesale(receipt["customer"], receipt["tin"])
        for product_key, qty in receipt["items"].items():
            item = item_data.setdefault(product_key, {
                "sku": product_skus.get(product_key, ""),
                "q": [0.0] * days,
                "r": [0] * days,
                "x": [0.0] * days,
                "i": [0.0] * days,
                "rr": [0] * days,
                "wr": [0] * days,
                "revenue": 0.0,
                "explicit_receipts": 0,
                "inferred_receipts": 0,
                "wholesale_customers": defaultdict(float),
            })
            item["q"][day_index] += qty
            item["r"][day_index] += 1
            item["revenue"] += receipt["item_revenue"].get(product_key, 0)
            if explicit:
                item["x"][day_index] += qty
                item["wr"][day_index] += 1
                item["explicit_receipts"] += 1
                customer_label = receipt["customer"] or receipt["tin"] or "Korporativ xaridor"
                item["wholesale_customers"][customer_label] += qty
                continue
            rule = rules.get(product_key, {
                "cap": qty,
                "threshold": float("inf"),
                "median": qty,
                "p90": qty,
                "sample": 0,
            })
            cap = rule["cap"]
            threshold = rule["threshold"]
            if qty >= threshold:
                item["i"][day_index] += max(0, qty - cap)
                item["wr"][day_index] += 1
                if cap > 0:
                    item["rr"][day_index] += 1
                item["inferred_receipts"] += 1
            else:
                item["rr"][day_index] += 1

    output_items = {}
    sku_aliases = {}
    name_aliases = {}
    for product_key, item in item_data.items():
        rule = rules.get(product_key, {
            "cap": 0,
            "threshold": 0,
            "median": 0,
            "p90": 0,
            "sample": 0,
        })
        cap = rule["cap"]
        threshold = rule["threshold"]
        retail = [
            max(0, item["q"][day] - item["x"][day] - item["i"][day])
            for day in range(days)
        ]
        wholesale = [item["x"][day] + item["i"][day] for day in range(days)]
        canonical_name = product_names[product_key].most_common(1)[0][0]
        output_items[product_key] = {
            "name": canonical_name,
            "sku": item["sku"],
            "q": [round_quantity(value) for value in item["q"]],
            "r": item["r"],
            "rr": item["rr"],
            "wr": item["wr"],
            "w": [round_quantity(value) for value in wholesale],
            "x": [round_quantity(value) for value in item["x"]],
            "i": [round_quantity(value) for value in item["i"]],
            "rt": [round_quantity(value) for value in retail],
            "m": demand_metrics(retail, item["x"], item["i"], cap, threshold),
        }
        output_items[product_key]["m"]["receiptMedian"] = round_quantity(rule["median"])
        output_items[product_key]["m"]["receiptP90"] = round_quantity(rule["p90"])
        output_items[product_key]["m"]["receiptSample"] = rule["sample"]
        output_items[product_key]["m"]["revenue"] = round(item["revenue"])
        output_items[product_key]["m"]["totalSold"] = round_quantity(sum(item["q"]))
        output_items[product_key]["m"]["totalReceipts"] = sum(item["r"])
        output_items[product_key]["m"]["explicitReceipts"] = item["explicit_receipts"]
        output_items[product_key]["m"]["inferredReceipts"] = item["inferred_receipts"]
        output_items[product_key]["m"]["wholesaleCustomers"] = [
            customer for customer, _ in sorted(
                item["wholesale_customers"].items(),
                key=lambda pair: pair[1],
                reverse=True,
            )[:3]
        ]
        if item["sku"]:
            sku_aliases["sku:" + item["sku"]] = product_key
        for observed_name in product_names[product_key]:
            name_aliases[observed_name] = product_key

    return {
        "__meta__": {
            "days": days,
            "start": min_date.isoformat(),
            "end": max_date.isoformat(),
            "title": min_date.strftime("%B %Y"),
            "labels": labels,
            "method": "sku-customer-tin-dynamic-receipt-v3",
        },
        "items": output_items,
        "skuAliases": sku_aliases,
        "nameAliases": name_aliases,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="sotuv_excel.xlsx")
    parser.add_argument("--output", default="data_daily.json")
    args = parser.parse_args()
    result = build(Path(args.input))
    Path(args.output).write_text(
        json.dumps(result, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"Built {args.output}: {len(result['items']):,} products, {result['__meta__']['days']} days")


if __name__ == "__main__":
    main()
