// ─── P9 "Ombor aylanmasi" (Inventory turnover) — Invan'dagi shu nomdagi hisobotning
// o'xshashi. Mustaqil modul: index.html/sales.html'dagi invdata/kirimdata/data_history.json/
// data_stock_snapshot.json manbalaridan foydalanadi, boshqa sahifalarga bog'liq emas.
// Sinov bosqichida - dashboard navigatsiyasiga qo'shish/o'chirish keyinroq hal qilinadi.

let OA_SNAP=null,OA_BY_SKU=null,OA_ROWS=[],OA_PAGE_ITEMS=[];
let oaQ="",oaPage=1,OAPS=50,oaSortKey="name",oaSortDir=1,oaStart=null,oaEnd=null,oaLoaded=false;
let oaImportMethod=null,oaImportSet=null,oaImportMatched=0,oaImportTotal=0;

async function oaInit(){
  await oaEnsureData();
  if(!OA_BY_SKU)return;
  oaCompute();
}

async function oaEnsureData(){
  // DIQQAT: bu funksiya sahifa ochilishida FON rejimida ham chaqiriladi
  // (sales_runtime.js `_prefetchHeavyTabs`), shuning uchun qaysi bo'limga
  // kirilishidan qat'i nazar ishlaydi. Avval bu yerda 60 MB data_kirim.json
  // va 10 MB HTML-ichidagi invdata o'qilardi — endi (yangi backend bo'lsa)
  // API'dan siqilgan holda ~5 MB keladi. API bo'lmasa eski yo'l saqlanadi.
  if(!INVDATA||!Object.keys(INVDATA).length){
    // Avval HTML ichiga joylashtirilgan blok (build paytida to'ldirilgan bo'lishi
    // mumkin), keyin API/fayl. DIQQAT: INVDATA ni bo'sh {} ga qo'yib yubormaslik
    // kerak — `_ensureInvData()` uni "yuklangan" deb hisoblab, qayta o'qimay qoladi.
    let _em=null;
    try{_em=JSON.parse(document.getElementById("invdata").textContent);}catch(e){}
    if(_em&&Object.keys(_em).length){
      INVDATA=_em;
    }else{
      INVDATA=null;
      try{INVDATA=(typeof _ensureInvData==="function")?await _ensureInvData(null):{};}
      catch(e){INVDATA={};}
    }
  }
  if(!P8){
    // p9 kirim TARIXINI to'liq talab qiladi (har yozuv bo'yicha hisoblaydi),
    // shuning uchun bu yerda qisqa xulosa emas, to'liq tuzilma kerak.
    try{
      P8=(typeof _apiOrFile==="function")
        ? await _apiOrFile("kirimdata","data_kirim.json")
        : await (await fetch("data_kirim.json",{cache:"no-store"})).json();
      if(typeof _P8_SUMMARY!=="undefined")_P8_SUMMARY=false;
    }catch(e){P8={skus:{}};}
  }
  if(histLoadState==="idle"){await loadHistory();}
  else{
    while(histLoadState==="loading")await new Promise(r=>setTimeout(r,50));
  }
  if(!OA_SNAP){
    try{
      OA_SNAP=(typeof _apiOrFile==="function")
        ? await _apiOrFile("stockSnapshot","data_stock_snapshot.json")
        : await (await fetch("data_stock_snapshot.json",{cache:"no-store"})).json();
    }catch(e){OA_SNAP={base:new Date().toISOString().slice(0,10),days:1,s:{},c:{}};}
    if(!OA_SNAP.c)OA_SNAP.c={};
  }
  if(!OA_BY_SKU){
    OA_BY_SKU={};
    Object.keys(INVDATA).forEach(name=>{
      const iv=INVDATA[name];
      if(!iv||iv.sku==null||iv.sku==="")return;
      const cost=(iv.sp&&iv.sp>0)?iv.sp:(iv.p||0);
      OA_BY_SKU[String(iv.sku)]={name,cat:iv.cat||"",unit:iv.t||"",cost,barcode:iv.bc||[]};
    });
  }
  if(!oaLoaded){
    oaLoaded=true;
    const today=new Date(new Date(OA_SNAP.base).getTime()+ (OA_SNAP.days-1)*86400000).toISOString().slice(0,10);
    const minDate=(HISTMETA&&HISTMETA.base)?HISTMETA.base:OA_SNAP.base;
    const startDefault=new Date(new Date(today).getTime()-6*86400000);
    const startClamped=startDefault<new Date(minDate)?minDate:startDefault.toISOString().slice(0,10);
    oaStart=startClamped;oaEnd=today;
    const si=document.getElementById("oa-start"),ei=document.getElementById("oa-end");
    if(si){si.value=oaStart;si.min=minDate;si.max=today;}
    if(ei){ei.value=oaEnd;ei.min=minDate;ei.max=today;}
  }
}

// "Returned"/"Custom Return" holatidagi supplier_order yozuvlarining "qty"
// (received) qiymati haqiqiy ombordagi o'zgarishni aks ettirmaydi (Invan'ning
// supplier_order API'si qaytarilgan buyurtma uchun asl qabul qilingan miqdorni
// qaytarib beradi, haqiqiy tuzatish miqdorini emas - Invan "Inventory
// adjustment" hisobotida tekshirilib tasdiqlangan) - shuning uchun kirim
// yig'indisiga qo'shilmaydi.
function _oaIsRealKirim(a){
  const st=a.status;
  return st!=="Returned"&&st!=="Custom Return";
}
// Invan'dan kelgan kirim sanasi ("received_date"/"created_at") UTC vaqtda keladi -
// sotuv tarixi (data_history.json) esa Toshkent (UTC+5) mahalliy sanasi bo'yicha
// kunlarga bo'lingan. Bu ikkalasini bir xil kalendar-kunga solishtirish uchun kirim
// sanasini ham +5 soat siljitib, shundan keyin kunga bo'lish kerak - aks holda
// kechqurun (~19:00-23:59 UTC = ertalab Toshkentda) kelgan kirim bir kun oldingi
// sanaga noto'g'ri yozilib, ochilish qoldig'ini kun chegarasida chalkashtirib qo'yadi.
function _oaLocalDate(isoUtc){
  if(!isoUtc)return "";
  const t=new Date(isoUtc).getTime();
  if(isNaN(t))return String(isoUtc).slice(0,10);
  return new Date(t+5*3600000).toISOString().slice(0,10);
}
function _oaSkuMovement(sku,fromIso,toIso){
  // fromIso..toIso oralig'ida (ikkalasi ham kiritilgan) shu SKU uchun kirim/chiqim yig'indisi
  let inQ=0;
  const kirimEntry=P8&&P8.skus?P8.skus[sku]:null;
  if(kirimEntry&&kirimEntry.arrivals){
    kirimEntry.arrivals.forEach(a=>{
      if(!_oaIsRealKirim(a))return;
      const d=_oaLocalDate(a.date);
      if(d>=fromIso&&d<=toIso)inQ+=a.qty||0;
    });
  }
  let outQ=0;
  if(HIST&&HISTMETA){
    const dArr=HIST.d["sku:"+sku];
    if(dArr){
      const s=Math.max(0,_oaDayIdx(HISTMETA.base,fromIso));
      const e=Math.min(HISTMETA.days-1,_oaDayIdx(HISTMETA.base,toIso));
      for(let i=s;i<=e;i++){if(dArr[i])outQ+=dArr[i];}
    }
  }
  return {inQ,outQ};
}

// Berilgan sanadagi qoldiqni topadi: agar shu sana snapshot boshlangandan keyin
// bo'lsa - to'g'ridan-to'g'ri saqlangan haqiqiy qiymat; undan oldin bo'lsa -
// snapshot boshlangan kundagi (anchor) haqiqiy qiymatdan orqaga qarab, o'sha
// oraliqdagi kirim/chiqimni "bekor qilib" hisoblab chiqariladi (taxminiy -
// spisaniya/ko'chirish kabi kuzatilmagan harakatlar hisobga olinmaydi).
function _oaStockAt(sku,dateIso){
  const snapArr=OA_SNAP.s[sku];
  const idx=_oaDayIdx(OA_SNAP.base,dateIso);
  if(idx>=0)return snapArr?_oaNearest(snapArr,idx):null;
  const anchorVal=snapArr?_oaNearest(snapArr,0):null;
  if(anchorVal==null)return null;
  const nextDay=new Date(new Date(dateIso).getTime()+86400000).toISOString().slice(0,10);
  const {inQ,outQ}=_oaSkuMovement(sku,nextDay,OA_SNAP.base);
  return Math.round((anchorVal-inQ+outQ)*100)/100;
}

// Berilgan sanadagi tannarxni topadi:
//  - Snapshot boshlangan kundan keyin (odatda "bugun"/yaqin kunlar) - kunlik
//    snapshot'dagi haqiqiy joriy narx (Invan "sp" maydoni to'g'ridan-to'g'ri, PRICING
//    kabi kirimsiz narx yangilanishlarini ham qamrab oladi).
//  - Undan oldingi (o'tmish) sanalar uchun - `data_kirim.json`dagi HAQIQIY kirim
//    tarixidan, shu sanadan OLDINGI ENG SO'NGGI real kirimning narxi olinadi (Invan
//    o'zi "last_supply_price" - ya'ni oxirgi xarid narxi - konsepsiyasini ishlatadi,
//    ombordagi eski/yangi partiyalarning vaznli o'rtachasini emas; bu 21k+ SKU
//    bo'yicha Invan eksporti bilan solishtirib tasdiqlangan). Kirim tarixi
//    sanadan oldinroq boshlansa (yoki umuman bo'lmasa) - `fallback` (joriy narx)
//    ishlatiladi, taxminiy natija beradi.
const _oaCostBpCache={};
function _oaKirimCostBreakpoints(sku){
  if(_oaCostBpCache[sku])return _oaCostBpCache[sku];
  const bps=[];
  const kirimEntry=P8&&P8.skus?P8.skus[sku]:null;
  if(kirimEntry&&kirimEntry.arrivals){
    const events=kirimEntry.arrivals
      .filter(_oaIsRealKirim)
      .map(a=>({d:_oaLocalDate(a.date),c:a.cost||0}))
      .filter(e=>e.d)
      .sort((a,b)=>a.d<b.d?-1:a.d>b.d?1:0);
    events.forEach(e=>{
      if(!bps.length||bps[bps.length-1].c!==e.c)bps.push(e);
    });
  }
  _oaCostBpCache[sku]=bps;
  return bps;
}
function _oaLastKirimCostAt(sku,dateIso){
  const bps=_oaKirimCostBreakpoints(sku);
  let result=null;
  for(let i=0;i<bps.length;i++){
    if(bps[i].d<=dateIso)result=bps[i].c;else break;
  }
  return result;
}
function _oaCostAt(sku,dateIso,fallback){
  const idx=_oaDayIdx(OA_SNAP.base,dateIso);
  if(idx>=0){
    const costArr=OA_SNAP.c&&OA_SNAP.c[sku];
    const v=costArr?_oaNearest(costArr,idx):null;
    return v!=null?v:(fallback||0);
  }
  const v=_oaLastKirimCostAt(sku,dateIso);
  return v!=null?v:(fallback||0);
}

function _oaDayIdx(baseIso,dateIso){
  return Math.round((new Date(dateIso+"T00:00:00Z")-new Date(baseIso+"T00:00:00Z"))/86400000);
}
function _oaNearest(arr,idx){
  if(!arr)return null;
  for(let i=Math.min(idx,arr.length-1);i>=0;i--){if(arr[i]!=null)return arr[i];}
  return null;
}

function oaSearchInput(){
  const inp=document.getElementById("oa-q");
  oaQ=inp?inp.value.toLowerCase().trim():"";
  const clr=document.getElementById("oa-clear");
  if(clr)clr.classList.toggle("show",oaQ.length>0);
  oaPage=1;oaCompute();
}
function oaClearSearch(){
  const inp=document.getElementById("oa-q");
  if(inp){inp.value="";inp.focus();}
  const clr=document.getElementById("oa-clear");
  if(clr)clr.classList.remove("show");
  oaQ="";oaPage=1;oaCompute();
}
function oaRangeChange(){
  const si=document.getElementById("oa-start"),ei=document.getElementById("oa-end");
  if(si&&si.value)oaStart=si.value;
  if(ei&&ei.value)oaEnd=ei.value;
  if(oaStart>oaEnd){const t=oaStart;oaStart=oaEnd;oaEnd=t;if(si)si.value=oaStart;if(ei)ei.value=oaEnd;}
  oaPage=1;oaCompute();
}
function oaSortBy(key){
  if(oaSortKey===key){oaSortDir=-oaSortDir;}else{oaSortKey=key;oaSortDir=key==="name"?1:-1;}
  oaPage=1;oaRenderFromRows();
}
function oaGo(page){oaPage=page;oaRenderFromRows();const w=document.querySelector("#p9 .oa-tbl-wrap");if(w)w.scrollTop=0;}

function _oaRowFor(sku,meta){
  const openDate=new Date(new Date(oaStart+"T00:00:00Z").getTime()-86400000).toISOString().slice(0,10);
  const opening=_oaStockAt(sku,openDate);
  const closing=_oaStockAt(sku,oaEnd);

  let iq=0,ia=0;
  const kirimEntry=P8&&P8.skus?P8.skus[sku]:null;
  if(kirimEntry&&kirimEntry.arrivals){
    kirimEntry.arrivals.forEach(a=>{
      if(!_oaIsRealKirim(a))return;
      const d=_oaLocalDate(a.date);
      if(d>=oaStart&&d<=oaEnd){iq+=a.qty||0;ia+=(a.qty||0)*(a.cost||0);}
    });
  }

  let uq=0,ua=0;
  if(HIST&&HISTMETA){
    const key="sku:"+sku;
    const dArr=HIST.d[key],rArr=HIST.r[key];
    if(dArr||rArr){
      const s=Math.max(0,_oaDayIdx(HISTMETA.base,oaStart));
      const e=Math.min(HISTMETA.days-1,_oaDayIdx(HISTMETA.base,oaEnd));
      for(let i=s;i<=e;i++){
        if(dArr&&dArr[i])uq+=dArr[i];
        if(rArr&&rArr[i])ua+=rArr[i];
      }
    }
  }

  const openCost=_oaCostAt(sku,openDate,meta.cost);
  const closeCost=_oaCostAt(sku,oaEnd,meta.cost);
  return {
    sku,name:meta.name,cat:meta.cat,
    oq:opening,oa:opening!=null?Math.round(opening*openCost):null,
    iq:Math.round(iq*100)/100,ia:Math.round(ia),
    uq:Math.round(uq*100)/100,ua:Math.round(ua),
    cq:closing,ca:closing!=null?Math.round(closing*closeCost):null,
  };
}

function oaCompute(){
  if(!OA_SNAP||!OA_BY_SKU)return;
  const rows=[];
  Object.keys(OA_BY_SKU).forEach(sku=>{
    const meta=OA_BY_SKU[sku];
    if(oaImportSet&&!oaImportSet.has(sku))return;
    if(oaQ&&!meta.name.toLowerCase().includes(oaQ)&&!sku.toLowerCase().includes(oaQ))return;
    rows.push(_oaRowFor(sku,meta));
  });
  OA_ROWS=rows;
  const cnt=document.getElementById("oa-cnt");
  if(cnt)cnt.textContent=rows.length.toLocaleString()+" "+t("oa_cnt_suffix");
  oaRenderFromRows();
}

function oaRenderFromRows(){
  const gv=it=>{
    switch(oaSortKey){
      case "name":return (it.name||"").toLowerCase();
      case "oq":case "oa":case "iq":case "ia":case "uq":case "ua":case "cq":case "ca":
        return it[oaSortKey]==null?-Infinity:it[oaSortKey];
      default:return (it.name||"").toLowerCase();
    }
  };
  const rows=OA_ROWS.slice().sort((a,b)=>{
    const av=gv(a),bv=gv(b);
    if(typeof av==="string")return oaSortDir*av.localeCompare(bv,"ru");
    return oaSortDir*(av-bv);
  });
  document.querySelectorAll("#p9 .oa-tbl thead th").forEach(th=>{
    th.classList.remove("z-sort-asc","z-sort-desc");
    if(th.dataset.sortkey===oaSortKey)th.classList.add(oaSortDir>0?"z-sort-asc":"z-sort-desc");
  });
  const totalP=Math.max(1,Math.ceil(rows.length/OAPS));
  if(oaPage>totalP)oaPage=totalP;
  const off=(oaPage-1)*OAPS;
  OA_PAGE_ITEMS=rows.slice(off,off+OAPS);
  const tbody=document.getElementById("oa-tbody");
  const fmt=v=>v==null?'<span style="color:#c8c8ce">—</span>':v.toLocaleString();
  if(tbody){
    if(!OA_PAGE_ITEMS.length){
      tbody.innerHTML='<tr><td colspan="9" style="text-align:center;padding:40px;color:#bbb">'+esc(t("oa_not_found"))+'</td></tr>';
    }else{
      tbody.innerHTML=OA_PAGE_ITEMS.map(it=>`<tr>
<td><div class="z-name" title="${esc(it.name)}">${esc(it.name)}</div></td>
<td class="oa-num">${fmt(it.oq)}</td><td class="oa-num">${fmt(it.oa)}</td>
<td class="oa-num">${fmt(it.iq)}</td><td class="oa-num">${fmt(it.ia)}</td>
<td class="oa-num">${fmt(it.uq)}</td><td class="oa-num">${fmt(it.ua)}</td>
<td class="oa-num">${fmt(it.cq)}</td><td class="oa-num">${fmt(it.ca)}</td>
</tr>`).join("");
    }
  }
  oaRenderPag(totalP);
}

function oaRenderPag(totalP){
  const pag=document.getElementById("oa-pag");if(!pag)return;
  if(totalP<=1){pag.innerHTML="";return;}
  const mk=(l,p,d,a)=>`<button ${d?"disabled":""} ${a?'class="active"':""} onclick="oaGo(${p})">${l}</button>`;
  let h=mk("‹",oaPage-1,oaPage<=1,false);
  let s=Math.max(1,oaPage-2),e=Math.min(totalP,oaPage+2);
  if(s>1){h+=mk("1",1,false,oaPage===1);if(s>2)h+='<button disabled>…</button>';}
  for(let p=s;p<=e;p++)h+=mk(p,p,false,p===oaPage);
  if(e<totalP){if(e<totalP-1)h+='<button disabled>…</button>';h+=mk(totalP,totalP,false,oaPage===totalP);}
  h+=mk("›",oaPage+1,oaPage>=totalP,false);
  pag.innerHTML=h;
}

// ─── Import (SKU/Shtrix kod/Nom bo'yicha ro'yxatdan filtrlash) ───
function _oaNorm(s){return String(s||"").replace(/\s+/g," ").trim().toLowerCase();}

function oaImportToggle(){
  const m=document.getElementById("oa-import-menu");
  if(m)m.style.display=(m.style.display==="none"||!m.style.display)?"flex":"none";
}
function oaImportPick(method){
  oaImportMethod=method;
  const m=document.getElementById("oa-import-menu");
  if(m)m.style.display="none";
  const titles={sku:t("oa_import_sku"),barcode:t("oa_import_barcode"),name:t("oa_import_name")};
  const tt=document.getElementById("oa-import-modal-title");
  if(tt)tt.textContent=titles[method]||"";
  const bg=document.getElementById("oa-import-modal-bg");
  if(bg)bg.style.display="flex";
}
function oaImportCloseModal(ev){
  if(ev&&ev.target&&ev.target.id!=="oa-import-modal-bg"&&ev.type==="click")return;
  const bg=document.getElementById("oa-import-modal-bg");
  if(bg)bg.style.display="none";
}
async function oaImportFileChange(ev){
  const file=ev.target.files&&ev.target.files[0];
  ev.target.value="";
  if(!file)return;
  await _ensureExcelJS();
  if(typeof ExcelJS==="undefined")return;
  const buf=await file.arrayBuffer();
  const wb=new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws=wb.worksheets[0];
  if(!ws)return;
  const values=[];
  ws.eachRow(row=>{
    // Ma'lumot doim A ustunida bo'lavermaydi (foydalanuvchi boshqa ustunga
    // joylashtirishi/sarlavha qo'yishi mumkin) - shu qatordagi BIRINCHI
    // bo'sh bo'lmagan katakni olamiz, ustun raqamidan qat'iy nazar.
    let v=null;
    row.eachCell({includeEmpty:false},cell=>{
      if(v===null)v=cell.value;
    });
    if(v==null||v==="")return;
    if(typeof v==="object"&&v.text!=null)v=v.text;
    if(typeof v==="object"&&v.result!=null)v=v.result;
    values.push(String(v).trim());
  });
  oaApplyImport(values,oaImportMethod);
  oaImportCloseModal();
}
function oaApplyImport(values,method){
  const wanted=new Set(values.map(v=>method==="name"?_oaNorm(v):String(v).trim()).filter(v=>v));
  const matched=new Set();
  Object.keys(OA_BY_SKU).forEach(sku=>{
    const meta=OA_BY_SKU[sku];
    let hit=false;
    if(method==="sku")hit=wanted.has(sku);
    else if(method==="barcode")hit=(meta.barcode||[]).some(b=>wanted.has(String(b).trim()));
    else if(method==="name")hit=wanted.has(_oaNorm(meta.name));
    if(hit)matched.add(sku);
  });
  oaImportSet=matched;
  oaImportTotal=wanted.size;
  oaImportMatched=matched.size;
  oaQ="";
  const qi=document.getElementById("oa-q");if(qi)qi.value="";
  oaPage=1;
  oaCompute();
  oaRenderImportBadge();
}
function oaClearImport(){
  oaImportSet=null;oaImportTotal=0;oaImportMatched=0;
  oaPage=1;oaCompute();
  oaRenderImportBadge();
}
function oaRenderImportBadge(){
  const el=document.getElementById("oa-import-badge");
  if(!el)return;
  if(!oaImportSet){el.style.display="none";el.innerHTML="";return;}
  el.style.display="inline-flex";
  el.innerHTML=`${oaImportMatched}/${oaImportTotal} ${esc(t("oa_import_found"))} <span onclick="oaClearImport()" style="cursor:pointer;margin-left:6px;font-weight:700">✕</span>`;
}

async function oaExport(){
  if(!OA_ROWS.length)return;
  await _ensureExcelJS();
  if(typeof ExcelJS==="undefined")return;
  const useBarcode=!!(oaImportSet&&oaImportMethod==="barcode");
  const idHeader=useBarcode?t("oa_import_barcode"):t("oa_import_sku");

  const wb=new ExcelJS.Workbook();
  const ws=wb.addWorksheet(t("nav_p9"),{views:[{state:"frozen",ySplit:3}]});

  ws.getRow(1).height=24;
  ws.getRow(2).height=20;
  ws.getRow(3).height=18;

  ws.mergeCells("A1:J1");
  ws.getCell("A1").value=t("nav_p9")+" — "+oaStart+" — "+oaEnd;
  ws.getCell("A1").font={bold:true,color:{argb:"FFFFFF"},size:12};
  ws.getCell("A1").alignment={horizontal:"center",vertical:"middle"};
  ws.getCell("A1").fill={type:"pattern",pattern:"solid",fgColor:{argb:"534AB7"}};

  ws.mergeCells("A2:A3");ws.getCell("A2").value=t("oa_th_mahsulot");
  ws.mergeCells("B2:B3");ws.getCell("B2").value=idHeader;
  ["A2","B2"].forEach(c=>{ws.getCell(c).font={bold:true,size:10,color:{argb:"555555"}};ws.getCell(c).alignment={horizontal:"left",vertical:"middle"};});
  ws.mergeCells("C2:D2");ws.getCell("C2").value=t("oa_grp_open");
  ws.mergeCells("E2:F2");ws.getCell("E2").value=t("oa_grp_in");
  ws.mergeCells("G2:H2");ws.getCell("G2").value=t("oa_grp_out");
  ws.mergeCells("I2:J2");ws.getCell("I2").value=t("oa_grp_close");
  ["C2","E2","G2","I2"].forEach(c=>{ws.getCell(c).font={bold:true,color:{argb:"FFFFFF"}};ws.getCell(c).alignment={horizontal:"center",vertical:"middle"};});
  ws.getCell("C2").fill={type:"pattern",pattern:"solid",fgColor:{argb:"EF9F27"}};
  ws.getCell("E2").fill={type:"pattern",pattern:"solid",fgColor:{argb:"1D9E75"}};
  ws.getCell("G2").fill={type:"pattern",pattern:"solid",fgColor:{argb:"E24B4A"}};
  ws.getCell("I2").fill={type:"pattern",pattern:"solid",fgColor:{argb:"534AB7"}};

  const miqdorS=t("oa_th_miqdor"),summaS=t("oa_th_summa");
  const row3=[miqdorS,summaS,miqdorS,summaS,miqdorS,summaS,miqdorS,summaS];
  row3.forEach((h,i)=>{const c=ws.getRow(3).getCell(i+3);c.value=h;c.font={bold:true,size:10,color:{argb:"555555"}};c.alignment={horizontal:"right",vertical:"middle"};});

  const AMT_FMT="#,##0";
  const qtyFmt=v=>(v==null||Number.isInteger(v))?"#,##0":"#,##0.00";
  OA_ROWS.forEach(it=>{
    const meta=OA_BY_SKU[it.sku];
    const idVal=useBarcode?((meta&&meta.barcode&&meta.barcode[0])||""):it.sku;
    const r=ws.addRow([it.name,idVal,it.oq,it.oa,it.iq,it.ia,it.uq,it.ua,it.cq,it.ca]);
    [[3,it.oq],[5,it.iq],[7,it.uq],[9,it.cq]].forEach(([c,v])=>{r.getCell(c).numFmt=qtyFmt(v);});
    [4,6,8,10].forEach(c=>{r.getCell(c).numFmt=AMT_FMT;});
  });
  ws.columns=[{width:44},{width:16},{width:12},{width:14},{width:12},{width:14},{width:12},{width:14},{width:12},{width:14}];
  for(let c=3;c<=10;c++)ws.getColumn(c).alignment={horizontal:"right"};
  const buf=await wb.xlsx.writeBuffer();
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([buf],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));
  a.download=`ombor_aylanmasi_${oaStart}_${oaEnd}.xlsx`;
  a.click();
  URL.revokeObjectURL(a.href);
}
