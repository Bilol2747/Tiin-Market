import json
import re
from pathlib import Path


ROOT = Path(__file__).parent
HTML_PATH = ROOT / "sales.html"
RUNTIME_PATH = ROOT / "sales_runtime.js"


def replace_embedded_json(html, element_id, value):
    payload = json.dumps(value, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    pattern = rf'(<script id="{element_id}" type="application/json">).*?(</script>)'
    updated, count = re.subn(
        pattern,
        lambda match: match.group(1) + payload + match.group(2),
        html,
        count=1,
        flags=re.S,
    )
    if count != 1:
        raise RuntimeError(f"Could not replace {element_id}")
    return updated


def main():
    html = HTML_PATH.read_text(encoding="utf-8")
    daily = json.loads((ROOT / "data_daily.json").read_text(encoding="utf-8-sig"))
    html = replace_embedded_json(html, "dailydata", daily)

    scripts = list(re.finditer(r"<script\b([^>]*)>([\s\S]*?)</script>", html, flags=re.I))
    final_script = scripts[-1]
    if 'src="sales_runtime.js"' in final_script.group(1):
        source = RUNTIME_PATH.read_text(encoding="utf-8")
    else:
        source = final_script.group(2)

    start = source.index("function calcTozaOrtacha")
    end = source.index("function renderTable3", start)
    replacement = (ROOT / "sales_demand_runtime.js").read_text(encoding="utf-8").strip() + "\n"
    source = source[:start] + replacement + source[end:]

    render_start = source.index("function renderP2(idx)")
    render_end = source.index("function toggleF()", render_start)
    render = (ROOT / "sales_product_runtime.js").read_text(encoding="utf-8").strip() + "\n"
    source = source[:render_start] + render + source[render_end:]

    init_new = (
        'function initP2(apiData){try{const _dp=apiData&&apiData.demand?apiData.demand:JSON.parse(document.getElementById("dailydata").textContent);'
        'DAILY=_dp.items;DSKU=_dp.skuAliases||{};DNAME=_dp.nameAliases||{};DMETA=_dp.__meta__;const ph=document.getElementById("p2-period");'
        'if(ph)ph.textContent=(DMETA.title||"")+" · "+DMETA.days+" kun";}'
        'catch(e){DAILY=null;DSKU={};DNAME={};DMETA=null;}'
        'const INV=apiData&&apiData.inventory?apiData.inventory:JSON.parse(document.getElementById("invdata").textContent);'
    )
    source, init_count = re.subn(
        r'function initP2\([^)]*\)\{.*?\}const INV=(?:apiData&&apiData\.inventory\?apiData\.inventory:)?',
        init_new,
        source,
        count=1,
        flags=re.S,
    )
    if init_count != 1 and init_new not in source:
        raise RuntimeError("initP2 signature not found")
    source = re.sub(
        r"let P2=null,P3=null,P4=null,DAILY=null,(?:DSKU=\{\},)?(?:DNAME=\{\},)?DMETA=null,",
        "let P2=null,P3=null,P4=null,DAILY=null,DSKU={},DNAME={},DMETA=null,",
        source,
        count=1,
    )
    nn2 = 'function nn2(s){return String(s||"").replace(/\\s+/g," ").trim().toLowerCase();}'
    daily_for = (
        'function dailyFor(v){if(!DAILY||!v)return null;'
        'const skuKey=v.sku&&DSKU?DSKU["sku:"+String(v.sku)]:null;'
        'const nameKey=DNAME?DNAME[nn2(v.name)]:null;'
        'return DAILY[skuKey]||DAILY[nameKey]||DAILY[nn2(v.name)]||null;}'
    )
    if "function dailyFor(" not in source:
        source = source.replace(nn2, nn2 + daily_for, 1)
    source = source.replace("const dl=DAILY[nn2(v.name)];", "const dl=dailyFor(v);")
    show_new = (
        'async function showPage(btn){document.querySelectorAll(".ntab").forEach(b=>b.classList.remove("active"));'
        'btn.classList.add("active");document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));'
        'const pid=btn.dataset.page;document.getElementById(pid).classList.add("active");window.scrollTo(0,0);'
        'if(pid==="p2"&&!P2){let apiData=null;'
        'if(window.TiinDataAPI){try{apiData=await window.TiinDataAPI.bootstrap();}catch(e){apiData=null;}}'
        'P2=apiData&&apiData.products?apiData.products:JSON.parse(document.getElementById("p2data").textContent);'
        'initP2(apiData);}'
        'if(pid==="p3"&&!P3){P3=JSON.parse(document.getElementById("p3data").textContent);initP3();}'
        'if(pid==="p4"&&!P4){P4=JSON.parse(document.getElementById("p4data").textContent);initP4();}};'
    )
    source, show_count = re.subn(
        r"function showPage\(btn\)\{.*?\};",
        show_new,
        source,
        count=1,
    )
    if show_count != 1 and show_new not in source:
        raise RuntimeError("showPage signature not found")

    RUNTIME_PATH.write_text(source.strip() + "\n", encoding="utf-8")
    (ROOT / "check_syntax.js").write_text(source.strip() + "\n", encoding="utf-8")
    if 'src="sales_runtime.js"' not in final_script.group(1):
        html = html[:final_script.start()] + '<script src="sales_runtime.js"></script>' + html[final_script.end():]
    if 'src="sales_api_client.js"' not in html:
        html = html.replace(
            '<script src="sales_runtime.js"></script>',
            '<script src="sales_api_client.js"></script><script src="sales_runtime.js"></script>',
            1,
        )
    HTML_PATH.write_text(html, encoding="utf-8")
    print("Updated sales.html and sales_runtime.js")


if __name__ == "__main__":
    main()
