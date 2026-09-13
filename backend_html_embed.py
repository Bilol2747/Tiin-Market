#!/usr/bin/env python3
"""
backend_html_embed.py — barcha bo'limlar (p1/p2/p3/p5/p6) uchun tayyorlangan
ma'lumotni index.html/sales.html ichidagi <script id="...data"> bloklariga
joylashtiradi. Bo'limga xos emas — HTML generatsiyasining umumiy bosqichi.
"""
import json
import re


def embed_html(html_path, invdata, p2data, p3data, dailydata, p1data=None, supplierdata=None, template_path=None):
    # Shablon doim asosiy sales.html dan o'qiladi (formulalar o'zgarmaydi)
    src = template_path if template_path else html_path
    html = src.read_text(encoding="utf-8")

    def replace_block(sid, value):
        nonlocal html
        payload = json.dumps(value, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
        pat = re.compile(r'(<script[^>]+id="' + sid + r'"[^>]*>)[\s\S]*?(</script>)', re.I)
        html, n = pat.subn(lambda m: m.group(1) + payload + m.group(2), html, count=1)
        if n != 1:
            raise RuntimeError(f"Script blok topilmadi: {sid}")

    # invdata/p2data/dailydata/supplierdata (o'nlab MB) endi p3data/kirimdata kabi
    # HTML ichiga joylashtirilmaydi - har biri allaqachon mustaqil data_*.json
    # faylga yozilgan (build_all_from_api.py), frontend ularni alohida fetch()
    # orqali, faqat tegishli sahifa (p2/p5/p6/p7) birinchi ochilganda yuklaydi
    # (_ensureInvData/_ensureP2Data/_ensureDailyDemand/_ensureSupplierData,
    # sales_runtime.js). Bu index.html/sales.html hajmini ~52MB'dan ~1MB'ga
    # tushiradi - batafsil: ARXITEKTURA_QAYTA_QURISH.md.
    replace_block("invdata",   {})
    replace_block("p2data",    [])
    replace_block("p3data",    [])
    replace_block("dailydata", {})
    replace_block("kirimdata", {})
    if p1data is not None:
        replace_block("p1data", p1data)
    replace_block("supplierdata", {})

    html_path.write_text(html, encoding="utf-8")
