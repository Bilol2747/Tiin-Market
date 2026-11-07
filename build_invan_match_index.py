"""
api_raw_products.json (Invan'dan yuklangan to'liq katalog, ~49MB) dan KICHIK,
tez qidiriladigan indeks quradi: SKU va barcode -> {product_id, product_type_id}.
Bu api/invan-order.js'dagi resolveProduct() uchun ishlatiladi - Invan'ning
JONLI matn-qidiruvi o'rniga (u noaniq, ba'zi tovarlarni "topa olmaydi" - 2026-07-28
aniqlangan xato), MAHALLIY, 100% aniq lug'atdan foydalaniladi.

Bir xil barcode IKKITA XIL SKU'ga tegishli bo'lgan hollar (juda kam, real
ma'lumotda tekshirilgan - 25,005 tadan atigi 4 tasi) byBarcode'ga QO'SHILMAYDI -
bunday holatda SKU orqali (ishonchli) qidirish kerak, noaniq barcode orqali emas.

Ishlatilishi: python build_invan_match_index.py
Natija: api/_product_match_index.json (~3-4MB)

ESLATMA: hozircha QO'LDA ishga tushiriladi (_supplier_id_map.json bilan bir xil
naqsh) - api_raw_products.json yangilanganda qayta ishga tushirish kerak.
"""
import json
from pathlib import Path

ROOT = Path(__file__).parent
SRC = ROOT / "api_raw_products.json"
OUT = ROOT / "api" / "_product_match_index.json"


def main():
    products = json.loads(SRC.read_text(encoding="utf-8"))
    print(f"Manba: {len(products):,} ta mahsulot")

    by_sku = {}
    barcode_owners = {}  # barcode -> set(sku) - kollizyon tekshiruvi uchun
    for p in products:
        sku = str(p.get("sku") or "").strip()
        pid = p.get("id")
        ptype = p.get("product_type_id")
        if not sku or not pid:
            continue
        by_sku[sku] = {"id": pid, "type": ptype}
        for bc in (p.get("barcode") or []):
            b = str(bc).strip()
            if not b:
                continue
            barcode_owners.setdefault(b, set()).add(sku)

    by_barcode = {}
    skipped_collisions = 0
    for b, skus in barcode_owners.items():
        if len(skus) > 1:
            skipped_collisions += 1
            continue  # noaniq - SKU orqali qidirilsin
        sku = next(iter(skus))
        by_barcode[b] = by_sku[sku]

    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(
        json.dumps({"bySku": by_sku, "byBarcode": by_barcode}, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"SKU yozuvi: {len(by_sku):,} | Barcode yozuvi: {len(by_barcode):,} | "
          f"o'tkazib yuborilgan kollizyon: {skipped_collisions}")
    print(f"Saqlandi: {OUT} ({OUT.stat().st_size/1e6:.2f} MB)")


if __name__ == "__main__":
    main()
