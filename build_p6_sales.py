import json

with open(r'c:\Tiim Market Base Loyihasi\data_supplier.json', 'r', encoding='utf-8') as f:
    d = json.load(f)
data_str = json.dumps(d, ensure_ascii=False, separators=(',', ':'))

p6_html = (
    '<div class="page" id="p6">\n'
    '<div class="sp-header">\n'
    '<div class="sp-cards">\n'
    '<div class="sp-card sp-card-a" id="sp-card-A" onclick="p6SetFilter(\'A\')"><div class="sp-card-icon">\U0001f3c6</div><div class="sp-card-body"><div class="sp-card-val" id="sp-n-a">—</div><div class="sp-card-lbl">A guruh</div><div class="sp-card-rev" id="sp-rev-a">—</div><div class="sp-card-sub">Daromadning 80%</div></div></div>\n'
    '<div class="sp-card sp-card-b" id="sp-card-B" onclick="p6SetFilter(\'B\')"><div class="sp-card-icon">⚡</div><div class="sp-card-body"><div class="sp-card-val" id="sp-n-b">—</div><div class="sp-card-lbl">B guruh</div><div class="sp-card-rev" id="sp-rev-b">—</div><div class="sp-card-sub">Daromadning 15%</div></div></div>\n'
    '<div class="sp-card sp-card-c" id="sp-card-C" onclick="p6SetFilter(\'C\')"><div class="sp-card-icon">\U0001f4a1</div><div class="sp-card-body"><div class="sp-card-val" id="sp-n-c">—</div><div class="sp-card-lbl">C guruh</div><div class="sp-card-rev" id="sp-rev-c">—</div><div class="sp-card-sub">Daromadning 5%</div></div></div>\n'
    '<div class="sp-card sp-card-t" id="sp-card-all" onclick="p6SetFilter(\'all\')"><div class="sp-card-icon">\U0001f4ca</div><div class="sp-card-body"><div class="sp-card-val" id="sp-n-all">—</div><div class="sp-card-lbl">Jami supplierlar</div><div class="sp-card-rev" id="sp-rev-all">—</div><div class="sp-card-sub">May 2026 daromad</div></div></div>\n'
    '</div>\n'
    '</div>\n'
    '<div class="sp-toolbar">\n'
    '<div class="sp-ftabs">\n'
    '<button class="sp-ftab active" data-f="all" onclick="p6SetFilter(\'all\')">Hammasi</button>\n'
    '<button class="sp-ftab" data-f="A" onclick="p6SetFilter(\'A\')">\U0001f3c6 A guruh</button>\n'
    '<button class="sp-ftab" data-f="B" onclick="p6SetFilter(\'B\')">⚡ B guruh</button>\n'
    '<button class="sp-ftab" data-f="C" onclick="p6SetFilter(\'C\')">\U0001f4a1 C guruh</button>\n'
    '</div>\n'
    '<div class="sp-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);width:15px;height:15px;color:#b5bac4;pointer-events:none"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg><input id="sp-q" type="text" placeholder="Supplier qidirish..." oninput="p6SearchInput()"></div>\n'
    '<span class="sp-cnt" id="sp-cnt"></span>\n'
    '</div>\n'
    '<div class="sp-tbl-wrap">\n'
    '<table class="sp-tbl">\n'
    '<thead><tr><th style="width:36px;text-align:center">#</th><th>Supplier nomi</th><th style="width:54px;text-align:center">ABC</th><th style="width:110px">Daromad</th><th style="min-width:160px">Hissa</th><th style="min-width:200px">Tovarlar</th><th style="width:90px">Cheklar</th></tr></thead>\n'
    '<tbody id="sp-tbody"><tr><td colspan="7" style="text-align:center;padding:40px;color:#bbb">Yuklanmoqda...</td></tr></tbody>\n'
    '</table>\n'
    '</div>\n'
    '<div class="p2-pag sp-pag" id="sp-pag"></div>\n'
    '<style>\n'
    '.sp-header{padding:12px 24px 4px}\n'
    '.sp-cards{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px}\n'
    '.sp-card{background:#fff;border:1.5px solid #eee;border-radius:12px;padding:14px 16px;cursor:pointer;transition:all .2s;position:relative;overflow:hidden;display:flex;align-items:center;gap:12px}\n'
    '.sp-card:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(0,0,0,.09)}\n'
    '.sp-card::before{content:\'\';position:absolute;top:0;left:0;bottom:0;width:4px}\n'
    '.sp-card-a::before{background:#1D9E75}.sp-card-b::before{background:#534AB7}.sp-card-c::before{background:#EF9F27}.sp-card-t::before{background:#64748B}\n'
    '.sp-card-icon{font-size:22px;flex-shrink:0}\n'
    '.sp-card-body{display:flex;flex-direction:column;min-width:0}\n'
    '.sp-card-val{font-size:26px;font-weight:800;line-height:1;color:#1a1a1a}\n'
    '.sp-card-a .sp-card-val{color:#1D9E75}.sp-card-b .sp-card-val{color:#534AB7}.sp-card-c .sp-card-val{color:#EF9F27}.sp-card-t .sp-card-val{color:#64748B}\n'
    '.sp-card-lbl{font-size:12px;font-weight:700;color:#333;margin-top:3px}\n'
    '.sp-card-rev{font-size:13px;font-weight:600;color:#555;margin-top:2px}\n'
    '.sp-card-sub{font-size:10px;color:#aaa;margin-top:1px}\n'
    '.sp-card.sp-selected{box-shadow:0 0 0 2.5px #1D9E75}\n'
    '.sp-toolbar{display:flex;align-items:center;gap:12px;padding:0 24px 12px;flex-wrap:wrap}\n'
    '.sp-ftabs{display:flex;gap:6px;flex-wrap:wrap}\n'
    '.sp-ftab{padding:6px 14px;border:1.5px solid #e0e0e0;border-radius:20px;background:#fff;font-size:12px;cursor:pointer;font-weight:500;color:#666;transition:all .15s}\n'
    '.sp-ftab:hover{background:#f5f5f0}\n'
    '.sp-ftab.active{background:#1D9E75;border-color:#1D9E75;color:#fff}\n'
    '.sp-search{position:relative;display:flex;align-items:center}\n'
    '.sp-search input{padding:8px 14px 8px 36px;border:1.5px solid #e6e8ec;border-radius:20px;font-size:13px;outline:none;min-width:220px;background:#fafbfc;transition:all .15s}\n'
    '.sp-search input:focus{border-color:#1D9E75;background:#fff;box-shadow:0 0 0 3px rgba(29,158,117,.1)}\n'
    '.sp-cnt{font-size:12px;color:#999;white-space:nowrap;margin-left:auto}\n'
    '.sp-tbl-wrap{padding:0 24px;overflow:auto;max-height:calc(100vh - 280px)}\n'
    '.sp-tbl{width:100%;border-collapse:collapse;font-size:13px}\n'
    '.sp-tbl th{padding:10px 10px;text-align:left;font-size:11px;font-weight:600;color:#999;border-bottom:1.5px solid #eee;position:sticky;top:0;z-index:2;background:#fafaf5;white-space:nowrap}\n'
    '.sp-tbl td{padding:10px 10px;border-bottom:1px solid #f5f5f0;vertical-align:middle}\n'
    '.sp-row{cursor:pointer;transition:background .1s}.sp-row:hover td{background:#f7f7f4}\n'
    '.sp-row-sel td{background:#FFFBF0!important}.sp-row-sel td:first-child{box-shadow:inset 3px 0 0 #EF9F27}\n'
    '.sp-name{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:380px;color:#1a1a1a}\n'
    '.sp-abc{padding:3px 10px;border-radius:5px;font-size:12px;font-weight:800;display:inline-block}\n'
    '.sp-abc-a{background:#E1F5EE;color:#085041}.sp-abc-b{background:#EEF2FF;color:#3730A3}.sp-abc-c{background:#FFF4E0;color:#7C4D00}\n'
    '.sp-mc{font-size:10px;font-weight:700;padding:1px 5px;border-radius:4px;display:inline-block}\n'
    '.sp-mc-a{background:#E1F5EE;color:#0D7A55}.sp-mc-b{background:#EEF2FF;color:#4338CA}.sp-mc-c{background:#FFF4E0;color:#92400E}\n'
    '.sp-det-row td{padding:0}.sp-det-row:hover td{background:transparent!important}\n'
    '.sp-det-wrap{background:linear-gradient(135deg,#fafaf5,#f5f3ee);border-left:3px solid #EF9F27;padding:14px 20px}\n'
    '.sp-det-title{font-size:11px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px}\n'
    '.sp-det-list{display:flex;flex-wrap:wrap;gap:8px}\n'
    '.sp-top-item{background:#fff;border:1px solid #eee;border-radius:8px;padding:9px 12px;display:flex;align-items:center;justify-content:space-between;gap:10px;min-width:200px;max-width:300px;flex:1}\n'
    '.sp-top-left{display:flex;align-items:center;gap:8px;min-width:0;flex:1}\n'
    '.sp-top-rank{width:20px;height:20px;border-radius:50%;background:#f0f0ec;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#666;flex-shrink:0}\n'
    '.sp-top-name{font-size:12px;font-weight:600;color:#333;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:170px}\n'
    '.sp-top-rev{font-size:11px;color:#888;margin-top:1px}\n'
    '.sp-pag{position:sticky;left:0;min-width:100%;box-sizing:border-box;border-top:1px solid #f0ede4;background:#fff}\n'
    '</style>\n'
    '<script id="supplierdata" type="application/json">' + data_str + '</script>\n'
    '</div>'
)

with open(r'c:\Tiim Market Base Loyihasi\sales.html', 'r', encoding='utf-8') as f:
    content = f.read()

old = '<script src="sales_api_client.js"></script><script src="sales_runtime.js"></script></body></html>'
new = p6_html + '\n' + old

if old in content:
    with open(r'c:\Tiim Market Base Loyihasi\sales.html', 'w', encoding='utf-8') as f:
        f.write(content.replace(old, new, 1))
    print('sales.html updated!')
else:
    print('ERROR: target not found!')
