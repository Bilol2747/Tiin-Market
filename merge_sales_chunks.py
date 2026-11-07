"""
fetch_historical_sales.py bilan (bir necha parallel oraliqda) yig'ilgan
chunk_*.json fayllarni bitta data_sales_*.json ga birlashtiradi.

Ishlatilishi:
    python merge_sales_chunks.py 2025-07-01 2026-01-01 data_sales_2025h2.json chunk_1.json chunk_2.json ...
"""
import json, sys
from pathlib import Path

if len(sys.argv) < 5:
    print("Ishlatilishi: python merge_sales_chunks.py START END OUT.json chunk1.json [chunk2.json ...]")
    sys.exit(1)

start_iso, end_iso, out_path = sys.argv[1], sys.argv[2], Path(sys.argv[3])
chunk_paths = sys.argv[4:]

daily = {}
for cp in chunk_paths:
    d = json.loads(Path(cp).read_text(encoding="utf-8"))
    for sku, days in d.items():
        m = daily.setdefault(sku, {})
        for day, qty in days.items():
            m[day] = m.get(day, 0) + qty

out_path.write_text(
    json.dumps({"start": start_iso, "end": end_iso, "daily": daily}, ensure_ascii=False, separators=(",", ":")),
    encoding="utf-8",
)
print(f"Birlashtirildi: {len(daily):,} SKU -> {out_path} ({out_path.stat().st_size/1e6:.1f} MB)")
