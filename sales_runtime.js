// ─── Login (statik) ───
const LG_PHONE="910758080",LG_PASS="tiin_market";
function _tgNotify(){
  const ua=navigator.userAgent;
  const br=ua.includes("Edg")?"Edge":ua.includes("Chrome")?"Chrome":ua.includes("Firefox")?"Firefox":ua.includes("Safari")?"Safari":"Boshqa";
  const os=ua.includes("Windows")?"Windows":ua.includes("Android")?"Android":ua.includes("iPhone")||ua.includes("iPad")?"iOS":ua.includes("Mac")?"Mac":"Boshqa";
  const now=new Date();
  const dt=now.toLocaleDateString("uz-UZ")+", "+now.toLocaleTimeString("uz-UZ",{hour:"2-digit",minute:"2-digit"});
  const msg="🔐 *Tiin Market — yangi kirish*\n📱 "+br+" · "+os+"\n🕐 "+dt;
  fetch("https://api.telegram.org/bot8626844104:AAHsDzuxGzJqsvnaS42jSHTLriF7A0tUtXg/sendMessage",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chat_id:"7034777747",text:msg,parse_mode:"Markdown"})}).catch(()=>{});
}
function lgEye(){const i=document.getElementById("lg-pass");i.type=i.type==="password"?"text":"password";}
function lgSubmit(e){
  e.preventDefault();
  const ph=(document.getElementById("lg-phone").value||"").replace(/\D/g,"");
  const pw=document.getElementById("lg-pass").value||"";
  const err=document.getElementById("lg-err");
  if(ph===LG_PHONE&&pw===LG_PASS){
    try{localStorage.setItem("tiin_auth","1");}catch(_){}
    _tgNotify();
    lgUnlock();
  }else{
    err.classList.add("show");
    document.getElementById("lg-err-txt").textContent=!ph?"Telefon raqamni kiriting":(!pw?"Parolni kiriting":"Telefon raqam yoki parol noto'g'ri");
    setTimeout(()=>err.classList.remove("show"),2600);
  }
  return false;
}
function lgUnlock(){
  const s=document.getElementById("login-screen");
  if(s){s.style.transition="opacity .35s";s.style.opacity="0";setTimeout(()=>s.remove(),350);}
  document.body.classList.remove("locked");
}
(function(){try{if(localStorage.getItem("tiin_auth")==="1"){const s=document.getElementById("login-screen");if(s)s.remove();document.body.classList.remove("locked");}else{const p=document.getElementById("lg-phone");if(p)p.focus();}}catch(_){}})();

let P1=JSON.parse(document.getElementById("p1data").textContent);let P1FULL=P1;
let GRA=null,GRB=null,DAILYFULL=null,DMETAFULL=null;
let P2=null,P3=null,P4=null,DAILY=null,DSKU={},DNAME={},DMETA=null,p2chart=null,p4sk="v",p4sa=false,curTab3="A",curRows3=[];
let ZITEMS=null,zCurFilter="all",zQuery="",zF={cat:"",sub:"",sup:"",type:"",abc:""},zFilled=false,zLastZi=null,zPage=1;
const ZPS=50;
let zDays=30,zKFilter="all",zKSup="";
function openZakas(){
  if(!ZITEMS)return;
  document.getElementById("zk-modal").style.display="flex";
  _zkFillSupSel();
  buildZakas();
}
function closeZakas(){document.getElementById("zk-modal").style.display="none";}
function setZakasDays(d){zDays=d;const inp=document.getElementById("zk-days-inp");if(inp)inp.value=d;document.querySelectorAll(".zk-preset").forEach(b=>b.classList.toggle("active",b.textContent.trim()===d+" kun"));buildZakas();}
function zkDaysInput(){const v=parseInt(document.getElementById("zk-days-inp").value)||30;zDays=Math.max(1,Math.min(365,v));document.querySelectorAll(".zk-preset").forEach(b=>b.classList.toggle("active",b.textContent.trim()===zDays+" kun"));buildZakas();}
function setZKFilter(f){zKFilter=f;document.querySelectorAll(".zk-ftab").forEach(b=>b.classList.toggle("active",b.dataset.zf===f));buildZakas();}
function setZKSup(v){zKSup=v;buildZakas();}
function _zkFillSupSel(){
  const sel=document.getElementById("zk-sup-sel");if(!sel||!ZITEMS)return;
  const sups=[...new Set(ZITEMS.filter(v=>v.signal==="kritik"||v.signal==="urgent").map(v=>v.sup||"Noma'lum").filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ru"));
  const cur=sel.value;
  sel.innerHTML='<option value="">Barcha yetkazib beruvchilar</option>';
  sups.forEach(s=>{const o=document.createElement("option");o.value=s;o.textContent=s;sel.appendChild(o);});
  if(sups.includes(cur))sel.value=cur;
}
function _zkCalc(){
  if(!ZITEMS)return[];
  const base=zKFilter==="all"?["kritik","urgent"]:[zKFilter];
  return ZITEMS.filter(v=>base.includes(v.signal)&&(!zKSup||(v.sup||"Noma'lum")===zKSup)).map(v=>{
    const stock=Math.max(0,v.stock||0);
    const daily=v.dailyAvg||0;
    const orderQty=Math.max(1,Math.ceil(daily*zDays)-stock);
    return {...v,orderQty,_stock:v.stock};
  }).filter(v=>v.orderQty>0||v._stock<=0);
}
function buildZakas(){
  if(!ZITEMS)return;
  const items=_zkCalc();
  const bySupp={};
  items.forEach(v=>{const s=v.sup||"Noma'lum yetkazib beruvchi";if(!bySupp[s])bySupp[s]=[];bySupp[s].push(v);});
  const suppList=Object.keys(bySupp).sort();
  const sm=document.getElementById("zk-summary");
  if(!suppList.length){document.getElementById("zk-body").innerHTML='<div class="zk-empty">Shoshilinch yoki tugashga yaqin mahsulot yo\'q</div>';if(sm)sm.textContent="";return;}
  if(sm)sm.textContent=suppList.length+" ta yetkazib beruvchi · "+items.length+" ta mahsulot";
  const sigBadge={kritik:'<span class="z-sig-kritik">Shoshilinch</span>',urgent:'<span class="z-sig-urgent">Tugashga yaqin</span>'};
  let h="";
  suppList.forEach(sup=>{
    const prods=bySupp[sup];
    const tot=prods.reduce((s,p)=>s+p.orderQty,0);
    h+=`<div class="zk-sup-block"><div class="zk-sup-name"><span>🏪 ${esc(sup)}</span><span style="color:#534AB7">${prods.length} ta mahsulot &nbsp;·&nbsp; Jami: <b>${tot.toLocaleString()} dona</b></span></div><table class="zk-ktbl"><thead><tr><th>#</th><th>Mahsulot</th><th>Kategoriya</th><th style="text-align:right">Joriy stok</th><th style="text-align:right">Kunlik sotuv</th><th style="text-align:right">${zDays} kunlik zakas</th><th>Holat</th></tr></thead><tbody>`;
    prods.forEach((p,i)=>{
      const stTxt=p._stock<=0?`<span style="color:#E24B4A;font-weight:700">0</span>`:p._stock.toLocaleString();
      const dTxt=p.dailyAvg>0?(p.dailyAvg>=1?Math.round(p.dailyAvg*10)/10:p.dailyAvg)+" ta/kun":"—";
      h+=`<tr><td style="color:#bbb;font-size:11px">${i+1}</td><td><div style="font-weight:600;white-space:normal;word-break:break-word">${esc(p.name)}</div>${p.sku?`<div style="font-size:10px;color:#bbb">${esc(p.sku)}</div>`:""}</td><td style="font-size:11px;color:#888">${esc(p.cat||"—")}</td><td style="text-align:right">${stTxt}</td><td style="text-align:right;color:#777">${dTxt}</td><td style="text-align:right"><span class="zk-oq">${p.orderQty.toLocaleString()} dona</span></td><td>${sigBadge[p.signal]||""}</td></tr>`;
    });
    h+=`</tbody></table></div>`;
  });
  document.getElementById("zk-body").innerHTML=h;
}
function exportZakasCSV(){
  const items=_zkCalc();
  const bySupp={};items.forEach(v=>{const s=v.sup||"Noma'lum";if(!bySupp[s])bySupp[s]=[];bySupp[s].push(v);});
  let csv="﻿";
  csv+="Yetkazib beruvchi,SKU,Mahsulot,Kategoriya,Joriy stok,Kunlik sotuv,"+zDays+" kunlik zakas,Holat\r\n";
  Object.keys(bySupp).sort().forEach(sup=>{
    bySupp[sup].forEach(p=>{
      const sig=p.signal==="kritik"?"Shoshilinch zakas":"Tugashga yaqin";
      csv+=`"${sup}","${p.sku||""}","${p.name}","${p.cat||""}",${Math.max(0,p._stock)},${p.dailyAvg||0},${p.orderQty},"${sig}"\r\n`;
    });
  });
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));a.download=`zakas_${zDays}kun.csv`;a.click();URL.revokeObjectURL(a.href);
}
function copyZakas(){
  const items=_zkCalc();
  const bySupp={};items.forEach(v=>{const s=v.sup||"Noma'lum";if(!bySupp[s])bySupp[s]=[];bySupp[s].push(v);});
  let txt=`ZAKAS RO'YXATI (${zDays} kunlik) — Tiin Market\n`;
  txt+=`Sana: ${new Date().toLocaleDateString("uz-UZ")}\n${"=".repeat(40)}\n\n`;
  Object.keys(bySupp).sort().forEach(sup=>{
    const prods=bySupp[sup];const tot=prods.reduce((s,p)=>s+p.orderQty,0);
    txt+=`YETKAZIB BERUVCHI: ${sup}\n${"-".repeat(36)}\n`;
    prods.forEach((p,i)=>txt+=`${i+1}. ${p.name}\n   Stok: ${Math.max(0,p._stock)} | Zakas: ${p.orderQty} dona\n`);
    txt+=`Jami: ${tot} dona\n\n`;
  });
  navigator.clipboard.writeText(txt).then(()=>{const b=document.querySelector(".zk-btn-copy");if(b){const o=b.innerHTML;b.innerHTML="✓ Nusxalandi!";setTimeout(()=>b.innerHTML=o,2000);}});
}
async function showPage(btn){const _zb=document.getElementById("z-back");if(_zb)_zb.style.display="none";document.querySelectorAll(".sb-item").forEach(b=>b.classList.remove("active"));btn.classList.add("active");document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));const pid=btn.dataset.page;document.getElementById(pid).classList.add("active");const _cr=document.getElementById("tb-crumb");if(_cr)_cr.textContent=btn.textContent.trim();window.scrollTo(0,0);if(pid==="p2"&&!P2){let apiData=null;if(window.TiinDataAPI){try{apiData=await window.TiinDataAPI.bootstrap();}catch(e){apiData=null;}}P2=apiData&&apiData.products?apiData.products:JSON.parse(document.getElementById("p2data").textContent);initP2(apiData);}if(pid==="p3"&&!P3){P3=JSON.parse(document.getElementById("p3data").textContent);initP3();}if(pid==="p4"&&!P4){P4=JSON.parse(document.getElementById("p4data").textContent);initP4();}
if(pid==="p5"){if(!P2){P2=JSON.parse(document.getElementById("p2data").textContent);initP2(null);}if(!ZITEMS)_buildZItems();else renderZaxira();}};
function initP4(){if(!P4)return;renderP4Table(P4);renderP4Heatmap(P4);}
function initP5(){if(!P2)return;_buildZItems();renderZaxira();}
// Zaxira qatoriga bosilganda → Mahsulotlar bo'limida o'sha mahsulotni ochish
async function zToProduct(zi){
  const z=ZITEMS&&ZITEMS[zi];if(!z)return;
  zLastZi=zi;
  const p2btn=document.querySelector('.sb-item[data-page="p2"]');
  if(p2btn)await showPage(p2btn);
  if(!P2)return;
  let idx=-1;
  if(z.sku)idx=P2.findIndex(v=>String(v.sku||"")===String(z.sku));
  if(idx<0)idx=P2.findIndex(v=>v.name===z.name);
  if(idx<0){const pq0=document.getElementById("pf-q");if(pq0){pq0.value=z.name;if(typeof pfQToggle==="function")pfQToggle();if(typeof p2Filter==="function")p2Filter();}return;}
  const pq=document.getElementById("pf-q");if(pq){pq.value=P2[idx].name;if(typeof pfQToggle==="function")pfQToggle();if(typeof p2Filter==="function")p2Filter();}
  if(typeof p2Open==="function")p2Open(P2[idx]._i!=null?P2[idx]._i:idx);
  const bb=document.getElementById("z-back");if(bb)bb.style.display="inline-flex";
}
function zBack(){
  const bb=document.getElementById("z-back");if(bb)bb.style.display="none";
  const zbtn=document.querySelector('.sb-item[data-page="p5"]');
  if(zbtn)showPage(zbtn);
}
// Sotuv tarixini tahlil qilib, tovarning "yaxshi sotuvchi"ligini aniqlash
function _zClassify(d,stock,smartDaily,calAvg){
  // d: kunlik miqdor massivi (range aktiv bo'lsa kesilgan)
  // smartDaily: aqlli velocity (retail + recency) — "daily"; calAvg: retail oylik o'rtacha — "calendarAvg"
  const rangeActive=(GRA!=null&&DMETAFULL&&!(GRA===0&&GRB===DMETAFULL.days-1));
  let arr=d;
  if(rangeActive){arr=d.slice(GRA,GRB+1);}
  const n=arr.length;
  if(n===0)return null;
  // oxirgi sotuv kuni
  let last=-1;for(let i=n-1;i>=0;i--){if(arr[i]>0){last=i;break;}}
  const di=last<0?999:(n-1-last);                // sotuvsiz kunlar (oxiridan)
  const totalQty=arr.reduce((a,b)=>a+b,0);
  const activeDays=arr.filter(x=>x>0).length;
  const plainAvg=n>0?totalQty/n:0;
  // VELOCITY: butun davr bo'lsa — max(aqlli recency, retail oylik o'rtacha) → sekin tovar 0 ga tushmaydi,
  //           ulgurji ham aralashmaydi; oraliq bo'lsa — o'sha oraliq o'rtachasi
  const dailyAvg=rangeActive?plainAvg:Math.max(smartDaily||0,calAvg||0);
  // tarix oynasi: sotuv to'xtaganga qadar bo'lgan davr (0..last)
  let histActive=0;const histLen=last>=0?last+1:0;
  for(let i=0;i<=last;i++){if(arr[i]>0)histActive++;}
  const histRatio=histLen>0?histActive/histLen:0;
  // "Yaxshi/barqaror sotuvchi"mi? — faol kunlarining 35%+ ida sotilgan VA yetarli nuqta bor
  // YOKI kuniga o'rtacha 2+ dona, 6+ faol kun
  const wasGoodSeller=(histRatio>=0.35&&histActive>=4)||(plainAvg>=2&&activeDays>=6);
  // qancha kunga yetadi (aqlli velocity bo'yicha)
  const daysLeft=(stock>0&&dailyAvg>0)?Math.round(stock/dailyAvg):(stock===0?0:null);
  const LOW_BUFFER=5;       // shu va undan kam stok = xavfli (keyingi oy ko'proq ketsa tugaydi)
  const EXCESS_FLOOR=10;    // shu miqdorgacha stok ortiqcha emas (sekin tovar uchun zarar yo'q)
  const excessMin=Math.max(EXCESS_FLOOR,totalQty*2);  // ortiqcha bo'lishi uchun minimal stok
  let signal=null,reason="";
  if(stock<0){
    signal="tekshir";reason="Manfiy stok — haqiqiy qoldiq noma'lum, kirim va hisobni tekshiring";
  }else if(stock===0&&totalQty>0){
    signal="kritik";reason="Stok tugagan, mahsulot sotilgan — darhol zakas";
  }else if(stock>0&&daysLeft===0){
    signal="kritik";reason="Stok amalda tugash darajasida — darhol zakas";
  }else if(di>=7&&wasGoodSeller){
    // Yaxshi sotilardi, keyin sotuv to'xtadi — stokka qarab ajratamiz
    if(stock>0&&stock<=LOW_BUFFER){signal="kritik";reason="Stok amalda tugash darajasida — darhol zakas";}
    else if(stock>0){signal="tekshir";reason="Sotilishi kerak, lekin stok turibdi — yo'qolgan/qolib ketgan bo'lishi mumkin";}
  }else if(stock>0&&totalQty>0&&stock<=LOW_BUFFER){
    signal="urgent";reason="Stok juda kam — keyingi oy ko'proq ketsa tugab qoladi";
  }else if(stock>0&&dailyAvg>0&&daysLeft!=null&&daysLeft<=10&&di<7){
    signal="urgent";reason="Faol sotilyapti, stok "+daysLeft+" kunda tugaydi";
  }else if(stock>0&&dailyAvg>0&&daysLeft!=null&&daysLeft>90&&stock>excessMin){
    signal="excess";reason="Joriy tezlikda "+daysLeft+" kunlik zaxira — ortiqcha";
  }else if(stock>0&&dailyAvg<=0&&(plainAvg>0||histActive>0)&&stock>EXCESS_FLOOR){
    signal="excess";reason="Retail talab deyarli yo'q, ko'p stok turibdi — ortiqcha/o'lik zaxira";
  }else if(stock>0&&totalQty>0){
    if(daysLeft!=null&&daysLeft>90){signal="excess";reason="Joriy tezlikda "+daysLeft+" kunlik (3 oydan ortiq) zaxira — ortiqcha";}
    else{signal="normal";reason="Sotuv barqaror, stok yetarli — harakat kerak emas";}
  }else{
    return null;  // sotilmagan / ma'lumot yo'q — baholab bo'lmaydi
  }
  return {signal,reason,di,dailyAvg:Math.round(dailyAvg*100)/100,daysLeft,stock,wasGoodSeller,histRatio:Math.round(histRatio*100)};
}
function _buildZItems(){
  ZITEMS=[];
  P2.forEach(v=>{
    const stock=(v.amt!=null)?parseFloat(v.amt):null;
    if(stock===null||isNaN(stock))return;
    const d=Array.isArray(v.d)?v.d:null;
    if(!d)return;
    // aqlli velocity (m.daily) + retail oylik o'rtacha (m.calendarAvg) — dailydata'dan
    let smartDaily=(v.da!=null)?v.da:null, calAvg=null;
    if(typeof dailyForFull==="function"){const _di=dailyForFull(v);if(_di&&_di.m){if(smartDaily==null&&_di.m.daily!=null)smartDaily=_di.m.daily;if(_di.m.calendarAvg!=null)calAvg=_di.m.calendarAvg;}}
    const c=_zClassify(d,stock,smartDaily,calAvg);
    if(!c)return;
    ZITEMS.push({_zi:ZITEMS.length,name:v.name,sku:v.sku||"",abc:v.abc||"",cat:v.cat||"",sup:v.sup||"",itype:v.itype||"",sub:v.sub||"",rev:v.rev||0,...c});
  });
  const cnt={kritik:0,tekshir:0,urgent:0,excess:0,normal:0};
  ZITEMS.forEach(v=>{if(cnt[v.signal]!==undefined)cnt[v.signal]++;});
  const s=(id,n)=>{const el=document.getElementById(id);if(el)el.textContent=n.toLocaleString();};
  s("z-n-kritik",cnt.kritik);s("z-n-tekshir",cnt.tekshir);s("z-n-urgent",cnt.urgent);s("z-n-excess",cnt.excess);s("z-n-normal",cnt.normal);
  zFilled=false;zFillSelects();
}
function zFilter(f){
  zCurFilter=f;
  zPage=1;
  document.querySelectorAll(".z-ftab").forEach(b=>b.classList.toggle("active",b.dataset.filter===f));
  document.querySelectorAll(".z-card").forEach(c=>c.classList.remove("z-selected"));
  if(f!=="all"){const el=document.getElementById("zc-"+f);if(el)el.classList.add("z-selected");}
  renderZaxira();
}
function pfQToggle(){const i=document.getElementById("pf-q"),c=document.getElementById("pf-q-clear");if(c)c.classList.toggle("show",!!(i&&i.value));}
function pfQClear(){const i=document.getElementById("pf-q");if(i)i.value="";const c=document.getElementById("pf-q-clear");if(c)c.classList.remove("show");if(typeof p2Filter==='function')p2Filter();}
function zSearchInput(){
  const inp=document.getElementById("z-q");
  zQuery=(inp?inp.value:"").toLowerCase().trim();
  zPage=1;
  const cl=document.getElementById("z-clear");if(cl)cl.classList.toggle("show",zQuery.length>0);
  renderZaxira();
}
function zFillSelects(){
  if(zFilled||!ZITEMS)return;
  const fill=(id,key)=>{
    const sel=document.getElementById(id);if(!sel)return;
    const opts=[...new Set(ZITEMS.map(v=>v[key]).filter(x=>x))].sort((a,b)=>String(a).localeCompare(String(b),"ru"));
    opts.forEach(v=>{const o=document.createElement("option");o.value=v;o.textContent=v;sel.appendChild(o);});
  };
  fill("zf-cat","cat");fill("zf-sub","sub");fill("zf-sup","sup");fill("zf-type","itype");
  zFilled=true;
}
function zFToggle(e){if(e)e.stopPropagation();const p=document.getElementById("z-fpop");if(p)p.classList.toggle("open");}
function zFApply(){
  zF.cat=document.getElementById("zf-cat").value;
  zF.sub=document.getElementById("zf-sub").value;
  zF.sup=document.getElementById("zf-sup").value;
  zF.type=document.getElementById("zf-type").value;
  zF.abc=document.getElementById("zf-abc").value;
  zPage=1;
  let n=0;["zf-cat","zf-sub","zf-sup","zf-type","zf-abc"].forEach(id=>{const e=document.getElementById(id);if(e){if(e.value)n++;e.classList.toggle("on",!!e.value);}});
  const b=document.getElementById("z-fcount");if(b)b.textContent=n?"("+n+")":"";
  const btn=document.getElementById("z-fbtn");if(btn)btn.classList.toggle("has",n>0);
  renderZaxira();
}
function zFClearAll(){
  ["zf-cat","zf-sub","zf-sup","zf-type","zf-abc"].forEach(id=>{const e=document.getElementById(id);if(e){e.value="";e.classList.remove("on");}});
  zF={cat:"",sub:"",sup:"",type:"",abc:""};
  zPage=1;
  const b=document.getElementById("z-fcount");if(b)b.textContent="";
  const btn=document.getElementById("z-fbtn");if(btn)btn.classList.remove("has");
  renderZaxira();
}
function zClear(){
  const inp=document.getElementById("z-q");if(inp)inp.value="";
  zQuery="";
  zPage=1;
  const cl=document.getElementById("z-clear");if(cl)cl.classList.remove("show");
  renderZaxira();
}
function renderZaxira(){
  if(!ZITEMS)return;
  let items=zCurFilter==="all"?[...ZITEMS]:ZITEMS.filter(v=>v.signal===zCurFilter);
  if(zQuery){items=items.filter(v=>(v.name&&v.name.toLowerCase().includes(zQuery))||(v.sku&&String(v.sku).toLowerCase().includes(zQuery)));}
  if(zF.cat) items=items.filter(v=>v.cat===zF.cat);
  if(zF.sub) items=items.filter(v=>v.sub===zF.sub);
  if(zF.sup) items=items.filter(v=>v.sup===zF.sup);
  if(zF.type)items=items.filter(v=>v.itype===zF.type);
  if(zF.abc) items=items.filter(v=>v.abc===zF.abc);
  const ord={kritik:0,urgent:1,tekshir:2,excess:3,normal:4};
  items.sort((a,b)=>{
    if(ord[a.signal]!==ord[b.signal])return ord[a.signal]-ord[b.signal];
    // Ortiqcha: eng uzun muddatli (eng ko'p stok) birinchi; qolganlar: eng qisqa muddatli birinchi
    if(a.daysLeft!=null&&b.daysLeft!=null)return a.signal==="excess"?b.daysLeft-a.daysLeft:a.daysLeft-b.daysLeft;
    return (b.di||0)-(a.di||0);
  });
  const el=document.getElementById("z-cnt");if(el)el.textContent=items.length.toLocaleString()+" ta mahsulot";
  const MAX_DAYS=90;
  const total=items.length;
  const totalPages=Math.max(1,Math.ceil(total/ZPS));
  if(zPage>totalPages)zPage=totalPages;
  const rowOffset=(zPage-1)*ZPS;
  const shown=items.slice(rowOffset,rowOffset+ZPS);
  let h="";
  shown.forEach((v,i)=>{
    const abcBadge=v.abc?`<span class="p2-abc p2-abc-${v.abc}">${v.abc}</span>`:"—";
    const stockTxt=v.stock===0?`<span style="color:#E24B4A;font-weight:700">0</span>`:v.stock<0?`<span style="color:#E24B4A">-${Math.abs(v.stock).toLocaleString()}</span>`:v.stock.toLocaleString();
    let barHtml;
    if(v.stock===0||v.daysLeft===0){
      barHtml=`<div class="z-bar-wrap"><div class="z-bar z-bar-red"><div class="z-bar-fill" style="width:100%"></div></div><span class="z-bar-days" style="color:#E24B4A">Tugagan</span></div>`;
    }else if(v.stock<0){
      barHtml=`<div class="z-bar-wrap"><div class="z-bar" style="background:#ece9f8"><div class="z-bar-fill" style="width:100%;background:#8B7FD1"></div></div><span class="z-bar-days" style="color:#534AB7">Noma'lum</span></div>`;
    }else if(v.daysLeft!==null){
      const pct=Math.min(100,Math.round(v.daysLeft/MAX_DAYS*100));
      const cls=v.daysLeft<=7?"z-bar-red":v.daysLeft<=14?"z-bar-orange":v.daysLeft<=30?"z-bar-yellow":"z-bar-green";
      const dc=v.daysLeft<=7?"#E24B4A":v.daysLeft<=14?"#EF9F27":v.daysLeft<=30?"#d4a017":"#1D9E75";
      const _df=d=>d>=365?+(d/365).toFixed(1)+" yil":d>=30?+(d/30).toFixed(1)+" oy":d+" kun";
      barHtml=`<div class="z-bar-wrap"><div class="z-bar ${cls}"><div class="z-bar-fill" style="width:${pct}%"></div></div><span class="z-bar-days" style="color:${dc}">${_df(v.daysLeft)}</span></div>`;
    }else{
      barHtml=`<span style="color:#bbb">—</span>`;
    }
    const diTxt=v.di>=900?"Sotilmagan":v.di===0?"Bugun":v.di+" kun oldin";
    const diColor=v.di>=30?"#E24B4A":v.di>=14?"#EF9F27":"#555";
    const sigMap={kritik:["z-sig-kritik","Shoshilinch zakas"],tekshir:["z-sig-tekshir","Tekshirish"],urgent:["z-sig-urgent","Tugashga yaqin"],excess:["z-sig-excess","Ortiqcha"],normal:["z-sig-normal","Normal"]};
    const[sigCls,sigTxt]=sigMap[v.signal]||["",""];
    const dailyTxt=v.dailyAvg>0?(v.dailyAvg>=1?(Math.round(v.dailyAvg*10)/10):v.dailyAvg)+" ta/kun":"—";
    const _sel=v._zi===zLastZi;
    h+=`<tr class="z-row${_sel?" z-row-sel":""}"${_sel?' id="z-sel-row"':""} ondblclick="zToProduct(${v._zi})" title="Ikki marta bosing — mahsulot tahliliga o'tish"><td style="color:#bbb;font-size:11px">${rowOffset+i+1}</td><td><div class="z-name" title="${esc(v.name)}">${esc(v.name)}</div><div class="z-reason">${v.sku?`<span class="z-sku">${esc(v.sku)}</span>`:""}${esc(v.reason)}</div></td><td>${abcBadge}</td><td style="font-weight:600">${stockTxt}</td><td style="color:#888">${dailyTxt}</td><td>${barHtml}</td><td style="color:${diColor};font-size:12px">${diTxt}</td><td><span class="${sigCls}">${sigTxt}</span></td></tr>`;
  });
  if(!h)h=`<tr><td colspan="8" style="text-align:center;padding:40px;color:#bbb">${zQuery?'"'+esc(zQuery)+'" bo\'yicha mahsulot topilmadi':"Bu filtrda ma'lumot yo'q"}</td></tr>`;
  document.getElementById("z-tbody").innerHTML=h;
  renderZPag(totalPages);
  if(zLastZi!=null){const sr=document.getElementById("z-sel-row");if(sr)setTimeout(()=>sr.scrollIntoView({block:"center",behavior:"smooth"}),60);}
}
function renderZPag(totalPages){
  const pag=document.getElementById("z-pag");if(!pag)return;
  if(totalPages<=1){pag.innerHTML="";return;}
  const mk=(label,page,disabled,active)=>`<button ${disabled?"disabled":""} ${active?'class="active"':""} onclick="zGo(${page})">${label}</button>`;
  let h=mk("‹",zPage-1,zPage<=1,false);
  let start=Math.max(1,zPage-2),end=Math.min(totalPages,zPage+2);
  if(start>1){h+=mk("1",1,false,zPage===1);if(start>2)h+='<button disabled>…</button>';}
  for(let page=start;page<=end;page++)h+=mk(page,page,false,page===zPage);
  if(end<totalPages){if(end<totalPages-1)h+='<button disabled>…</button>';h+=mk(totalPages,totalPages,false,zPage===totalPages);}
  h+=mk("›",zPage+1,zPage>=totalPages,false);
  pag.innerHTML=h;
}
function zGo(page){
  zPage=page;
  renderZaxira();
  const table=document.querySelector(".z-table-wrap");if(table)table.scrollIntoView({behavior:"smooth",block:"start"});
}
function sortP4(k){if(p4sk===k)p4sa=!p4sa;else{p4sk=k;p4sa=false;}const s=[...P4].sort((a,b)=>{if(k==="n")return p4sa?a.n.localeCompare(b.n):b.n.localeCompare(a.n);const va=k==="a"?Math.round(a.v/a.r):k==="mx"?a.mx:a[k];const vb=k==="a"?Math.round(b.v/b.r):k==="mx"?b.mx:b[k];return p4sa?va-vb:vb-va;});renderP4Table(s);document.getElementById("p4hint").textContent={v:"tushum",r:"cheklar soni",a:"o'rtacha chek",mx:"max chek",n:"ism"}[k]+" bo'yicha";}
function renderP4Table(d){const tot=P4.reduce((s,e)=>s+e.v,0);const mxV=Math.max(...P4.map(e=>e.v));const sl={lider:"LIDER",aktiv:"AKTIV",ortacha:"O'RTACHA",past:"PAST",sust:"SUST",vip:"VIP"};const sc={lider:"emp-lider",aktiv:"emp-aktiv",ortacha:"emp-ortacha",past:"emp-past",sust:"emp-sust",vip:"emp-vip"};let h="";d.forEach((e,i)=>{const avg=Math.round(e.v/e.r);const pct=(e.v/tot*100).toFixed(1);const bw=Math.round(e.v/mxV*55);h+=`<tr style="${i%2?"background:#fafaf5":""}"><td style="padding:6px 8px;color:#bbb;font-size:10px;min-width:22px">${i+1}</td><td style="padding:6px 8px;font-weight:600;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(e.n)}">${esc(e.n)}</td><td style="padding:6px 8px;text-align:right"><div style="display:flex;align-items:center;justify-content:flex-end;gap:5px"><div style="width:${bw}px;height:4px;background:#534AB7;border-radius:2px;opacity:.6;flex-shrink:0"></div><b style="color:#1D9E75;white-space:nowrap">${fmt(e.v)}</b></div></td><td style="padding:6px 8px;text-align:right;font-weight:700;color:#534AB7">${pct}%</td><td style="padding:6px 8px;text-align:right;color:#555">${e.r.toLocaleString()}</td><td style="padding:6px 8px;text-align:right;color:#555">${avg.toLocaleString()}</td><td style="padding:6px 8px;text-align:right;color:#555">${e.mx>0?fmt(e.mx):"—"}</td><td style="padding:6px 8px;text-align:center"><span class="badge ${sc[e.st]||"emp-sust"}">${sl[e.st]||e.st.toUpperCase()}</span></td></tr>`;});document.getElementById("p4tbody").innerHTML=h;}
function renderP4Heatmap(d){const wrap=document.getElementById("p4heatmap");if(!wrap)return;const s=[...d].sort((a,b)=>b.v-a.v);const days=Array.from({length:31},(_,i)=>i+1);let tbl='<table class="heat-tbl"><thead><tr><td class="heat-emp"></td>';days.forEach(dy=>tbl+=`<td class="heat-hdr">${dy}</td>`);tbl+='</tr></thead><tbody>';s.forEach(e=>{const mxD=Math.max(...e.d,1);tbl+=`<tr><td class="heat-emp" title="${esc(e.n)}">${esc(e.n.length>12?e.n.slice(0,12)+"…":e.n)}</td>`;e.d.forEach((v,i)=>{if(v>0){const op=Math.round((0.2+0.8*(v/mxD))*100)/100;const bg=`rgba(29,158,117,${op})`;tbl+=`<td style="background:${bg}" title="${e.n} — ${i+1}-may: ${fmt(v)} so'm"></td>`;}else{tbl+=`<td style="background:#f5f5f0"></td>`;}});tbl+='</tr>';});tbl+='</tbody></table>';wrap.innerHTML=tbl;}
function fmt(n){if(n>=1e9)return(n/1e9).toFixed(2)+" mlrd";if(n>=1e6)return(n/1e6).toFixed(1)+" mln";if(n>=1e3)return Math.round(n/1e3)+" ming";return Math.round(n)+"";}
function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
const P1WD=["Dush","Sesh","Chor","Pay","Jum","Shan","Yak"];
let _p1c={};
function renderP1(){
if(!P1||!P1.daily||!P1.daily.length){return;}
const setT=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
const setH=(id,v)=>{const e=document.getElementById(id);if(e)e.innerHTML=v;};
const kpiV=n=>{if(n>=1e9)return (n/1e9).toFixed(2)+'<span class="kpi-u"> mlrd</span>';if(n>=1e6)return (n/1e6).toFixed(1)+'<span class="kpi-u"> mln</span>';if(n>=1e3)return Math.round(n/1e3)+'<span class="kpi-u"> ming</span>';return Math.round(n)+'';};
setT("p1-period",P1.periodText||"");
const _fd=s=>{if(!s)return"";const p=s.split("-");return p.length===3?p[2]+"."+p[1]+"."+p[0]:s;};
setT("nav-period-r",_fd(P1.start)+" – "+_fd(P1.end));
setT("p1-daily-hint",(P1.title||"")+", mln UZS");
setH("kpi-gross",kpiV(P1.gross||0));
setT("kpi-rec",(P1.receipts||0).toLocaleString());
setT("kpi-avg",(P1.avg_check||0).toLocaleString());
setT("kpi-sku",(P1.sku||0).toLocaleString());
setH("kpi-refund",(P1.refund_pct||0)+'<span class="kpi-u">%</span>');
setT("kpi-refund-s",fmt(P1.refund||0)+" UZS refund");
setT("kpi-staff",(P1.staff||0).toLocaleString());
const bd=P1.best_day||{},wd=P1.worst_day||{};
setT("p1-daily-insight","Eng yuqori: "+(bd.label||"-")+"-kun — "+fmt(bd.val||0)+" UZS · Eng past: "+(wd.label||"-")+"-kun — "+fmt(wd.val||0)+" UZS");
const wk=P1.weekly||[];
if(wk.length){let mx=wk[0],mn=wk[0];wk.forEach(w=>{if(w.val>mx.val)mx=w;if(w.val<mn.val)mn=w;});setT("p1-week-insight","Eng kuchli: "+mx.day+" ("+fmt(mx.val)+") · Eng zaif: "+mn.day+" ("+fmt(mn.val)+")");}
const ab=P1.abc||{};const tot=(ab.a_rev||0)+(ab.b_rev||0)+(ab.c_rev||0);const cpct=tot?Math.round((ab.c_rev||0)/tot*100):0;
setT("p1-abc-insight","C guruh: "+(ab.c_count||0).toLocaleString()+" ta mahsulot — faqat "+cpct+"% tushum, lekin "+(P1.c_assort_pct||0)+"% assortiment");
const ti=P1.top_items||[];
setH("p1-top-items",ti.map((it,i)=>'<div class="rank-row"><div class="rank-n'+(i===0?" top":"")+'">'+(i+1)+'</div><div class="rank-name">'+esc(it.name)+'</div><div class="rank-val">'+fmt(it.val)+'</div></div>').join(""));
const te=P1.top_emp||[];
setH("p1-top-emp",te.map((e,i)=>'<div class="rank-row"><div class="rank-n'+(i===0?" top":"")+'">'+(i+1)+'</div><div class="rank-name">'+esc(e.name)+'<span class="rank-sub"> · '+(e.rec||0).toLocaleString()+' chek</span></div><div class="rank-val">'+fmt(e.val)+'</div></div>').join(""));
Object.values(_p1c).forEach(c=>{try{c.destroy();}catch(e){}});
const dv=P1.daily.map(v=>v/1e6);
const _dcv=document.getElementById("dailyChart");const _dctx=_dcv.getContext("2d");const _grad=_dctx.createLinearGradient(0,0,0,250);_grad.addColorStop(0,"rgba(59,130,246,0.32)");_grad.addColorStop(1,"rgba(59,130,246,0.01)");
_p1c.daily=new Chart(_dcv,{type:"line",data:{labels:P1.dayLabels||P1.daily.map((_,i)=>i+1),datasets:[{data:dv,borderColor:"#2563EB",borderWidth:2.5,backgroundColor:_grad,fill:true,tension:0.4,pointRadius:0,pointHoverRadius:5,pointHoverBackgroundColor:"#2563EB",pointHoverBorderColor:"#fff",pointHoverBorderWidth:2}]},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:"index",intersect:false},hover:{mode:"index",intersect:false},plugins:{legend:{display:false},tooltip:{mode:"index",intersect:false,callbacks:{title:items=>(items[0].label)+"-kun",label:c=>c.parsed.y.toFixed(1)+" mln UZS"}}},scales:{x:{grid:{display:false},ticks:{font:{size:9},maxTicksLimit:16}},y:{grid:{color:"rgba(0,0,0,0.05)"},ticks:{font:{size:9},callback:v=>v+" mln"}}}}});
const cats=P1.top_cats||[];const cv=cats.map(c=>c.val/1e6);
_p1c.cat=new Chart(document.getElementById("catChart"),{type:"bar",data:{labels:cats.map(c=>c.name),datasets:[{data:cv,backgroundColor:"rgba(37,99,235,0.78)",borderRadius:4,borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,indexAxis:"y",plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>c.parsed.x.toFixed(0)+" mln UZS"}}},scales:{x:{grid:{color:"rgba(0,0,0,0.05)"},ticks:{font:{size:8},callback:v=>v+" mln"}},y:{grid:{display:false},ticks:{font:{size:9}}}}}});
const wv=(P1.weekly||[]).map(w=>w.val/1e6);const wmax=Math.max(...wv),wmin=Math.min(...wv);
_p1c.week=new Chart(document.getElementById("weekChart"),{type:"bar",data:{labels:P1WD,datasets:[{data:wv,backgroundColor:wv.map(v=>v===wmax?"#2563EB":v===wmin?"#F87171":"rgba(37,99,235,0.4)"),borderRadius:4,borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>c.parsed.y.toFixed(0)+" mln UZS"}}},scales:{x:{grid:{display:false},ticks:{font:{size:9}}},y:{grid:{color:"rgba(0,0,0,0.05)"},ticks:{font:{size:9},callback:v=>v+" mln"}}}}});
const ab2=P1.abc||{};const at=(ab2.a_rev||0)+(ab2.b_rev||0)+(ab2.c_rev||0)||1;
_p1c.abc=new Chart(document.getElementById("abcChart"),{type:"doughnut",data:{labels:["A - Lider","B - Potentsial","C - Aylanmada"],datasets:[{data:[(ab2.a_rev||0)/at*100,(ab2.b_rev||0)/at*100,(ab2.c_rev||0)/at*100],backgroundColor:["#1D9E75","#EF9F27","#E24B4A"],borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,cutout:"58%",plugins:{legend:{position:"right",labels:{font:{size:10},boxWidth:10,padding:8}},tooltip:{callbacks:{label:c=>c.label+": "+c.parsed.toFixed(1)+"%"}}}}});
}
renderP1();
// ── Sana oralig'i (date-range) ──
function dtToggle(e){if(e)e.stopPropagation();const p=document.getElementById("dt-pop");if(p)p.classList.toggle("open");}
document.addEventListener("click",function(e){const w=document.querySelector(".tb-dt");const p=document.getElementById("dt-pop");if(w&&p&&!w.contains(e.target))p.classList.remove("open");});
function _dtIdx(iso){return (P1FULL.dates||[]).indexOf(iso);}
function dtPreset(kind){const n=P1FULL.days;let a,b=n-1;if(kind==="all"){a=0;}else{a=Math.max(0,n-(+kind));}_dtApplyRange(a,b);const p=document.getElementById("dt-pop");if(p)p.classList.remove("open");}
function dtApply(){const s=document.getElementById("dt-start").value,e=document.getElementById("dt-end").value;let a=s?_dtIdx(s):0,b=e?_dtIdx(e):P1FULL.days-1;if(a<0)a=0;if(b<0)b=P1FULL.days-1;if(a>b){const t=a;a=b;b=t;}_dtApplyRange(a,b);const p=document.getElementById("dt-pop");if(p)p.classList.remove("open");}
function _dtApplyRange(a,b){
const full=(a===0&&b===P1FULL.days-1);
GRA=a;GRB=b;
P1=full?P1FULL:buildRangedP1(P1FULL,a,b);
_winDaily();
renderP1();
if(P2){_winArr(P2);if(typeof p2CloseG==='function')p2CloseG();if(typeof p2Filter==='function')p2Filter();}
if(P3&&typeof initP3==='function'){initP3();}
if(ZITEMS!==null){_buildZItems();renderZaxira();}
const st=document.getElementById("dt-start"),en=document.getElementById("dt-end");if(st&&P1FULL.dates){st.value=P1FULL.dates[a];en.value=P1FULL.dates[b];}
const nt=document.getElementById("dt-note");if(nt)nt.textContent=full?"Butun davr ko'rsatilmoqda.":"Barcha sahifalar tanlangan oraliq bo'yicha aniq hisoblandi.";
}
function dailyForFull(v){if(!DAILYFULL||!v)return null;const sk=v.sku&&DSKU?DSKU["sku:"+String(v.sku)]:null;const nk=DNAME?DNAME[nn2(v.name)]:null;return DAILYFULL[sk]||DAILYFULL[nk]||DAILYFULL[nn2(v.name)]||null;}
function _rangeActive(){return GRA!=null&&DMETAFULL&&!(GRA===0&&GRB===DMETAFULL.days-1);}
function _winDaily(){
if(!DAILYFULL){return;}
if(!_rangeActive()){DAILY=DAILYFULL;DMETA=DMETAFULL;return;}
const a=GRA,b=GRB,nd=b-a+1;
const sl=arr=>Array.isArray(arr)?arr.slice(a,b+1):arr;
const win={};
for(const k in DAILYFULL){const it=DAILYFULL[k];const o={};
for(const f in it){o[f]=(f==="m")?it[f]:sl(it[f]);}
const rt=o.rt||[],q=o.q||[],x=o.x||[],i=o.i||[],rev=o.rev||[];
const tot=rt.reduce((s,y)=>s+(y||0),0);const active=rt.filter(y=>y>0.001).length;const fa=nd?tot/nd:0;
const xs=x.reduce((s,y)=>s+(y||0),0),is=i.reduce((s,y)=>s+(y||0),0);const obs=q.reduce((s,y)=>s+(y||0),0);
o.m=Object.assign({},it.m||{},{daily:Math.round(fa*100)/100,baselineDaily:Math.round(fa*100)/100,week:Math.round(fa*7*100)/100,month:Math.round(fa*30*100)/100,calendarAvg:Math.round(fa*100)/100,activeAvg:active?Math.round(tot/active*100)/100:0,activeDays:active,wholesalePct:obs?Math.round((xs+is)/obs*1000)/10:0,explicitWholesale:Math.round(xs),inferredWholesale:Math.round(is),revenue:Math.round(rev.reduce((s,y)=>s+(y||0),0)),totalSold:Math.round(obs),totalReceipts:(o.r||[]).reduce((s,y)=>s+(y||0),0)});
win[k]=o;}
DAILY=win;
const L=DMETAFULL.labels||[];
DMETA=Object.assign({},DMETAFULL,{days:nd,labels:L.slice(a,b+1),start:L[a]||DMETAFULL.start,end:L[b]||DMETAFULL.end});
}
function _winArr(arr){
if(!DAILYFULL||GRA==null||!arr)return;
const a=GRA,b=(GRB==null?DMETAFULL.days-1:GRB);
arr.forEach(v=>{const dl=dailyForFull(v);if(!dl){v.rev=0;v.qty=0;v.rec=0;v.di=999;return;}
const q=dl.q||[],r=dl.r||[],rev=dl.rev||[];let sq=0,sr=0,srev=0,last=-1;
for(let d=a;d<=b;d++){const qd=q[d]||0;sq+=qd;sr+=r[d]||0;srev+=rev[d]||0;if(qd>0)last=d;}
v.qty=Math.round(sq);v.rec=sr;v.rev=Math.round(srev);v.di=last>=0?(b-last):999;if(last>=0&&DMETAFULL&&DMETAFULL.labels)v.ld=DMETAFULL.labels[last]||v.ld;});
const sorted=arr.filter(v=>v.rev>0).sort((x,y)=>y.rev-x.rev);
const tot=sorted.reduce((s,v)=>s+v.rev,0)||1;let cum=0;
arr.forEach(v=>{v.abc="C";});
sorted.forEach(v=>{cum+=v.rev;const p=cum/tot;v.abc=p<=0.8?"A":(p<=0.95?"B":"C");v.rp=Math.round(v.rev/tot*1000)/10;});
}
function buildRangedP1(F,a,b){
const rng=arr=>(arr||[]).slice(a,b+1);
const rsum=arr=>(arr||[]).slice(a,b+1).reduce((x,y)=>x+(y||0),0);
const days=b-a+1;
const daily=rng(F.daily);
const gross=daily.reduce((x,y)=>x+y,0);
const recs=rsum(F.dailyRec);
const refund=rsum(F.dailyRefund);
const dates=rng(F.dates);
const dayLabels=rng(F.dayLabels);
const WK=["Dushanba","Seshanba","Chorshanba","Payshanba","Juma","Shanba","Yakshanba"];
const weekly=[0,0,0,0,0,0,0];
for(let i=a;i<=b;i++){const d=new Date(F.dates[i]);const wd=(d.getDay()+6)%7;weekly[wd]+=F.daily[i]||0;}
const weekly_out=weekly.map((v,i)=>({day:WK[i],val:Math.round(v)}));
let bi=0,wi=0;for(let i=0;i<daily.length;i++){if(daily[i]>daily[bi])bi=i;if(daily[i]<daily[wi])wi=i;}
const top_cats=Object.entries(F.catDaily||{}).map(([n,arr])=>({name:n,val:Math.round(arr.slice(a,b+1).reduce((x,y)=>x+(y||0),0))})).filter(c=>c.val>0).sort((x,y)=>y.val-x.val).slice(0,8);
const erd=F.empRecDaily||{};
const top_emp=Object.entries(F.empDaily||{}).map(([n,arr])=>({name:n,val:Math.round(arr.slice(a,b+1).reduce((x,y)=>x+(y||0),0)),rec:(erd[n]||[]).slice(a,b+1).reduce((x,y)=>x+(y||0),0)})).filter(e=>e.val>0).sort((x,y)=>y.val-x.val).slice(0,8);
const top_items=(F.itemsDaily||[]).map(it=>({name:it.name,val:it.d.slice(a,b+1).reduce((x,y)=>x+(y||0),0)})).filter(it=>it.val>0).sort((x,y)=>y.val-x.val).slice(0,8);
const staff=Object.entries(F.empDaily||{}).filter(([n,arr])=>arr.slice(a,b+1).reduce((x,y)=>x+(y||0),0)>0&&n!=="Noma'lum").length;
const _f=s=>{if(!s)return"";const p=s.split("-");return p.length===3?p[2]+"."+p[1]:s;};
return{title:_f(dates[0])+" – "+_f(dates[days-1]),periodText:_f(dates[0])+" – "+_f(dates[days-1])+" · "+days+" kunlik oraliq",days:days,start:dates[0],end:dates[days-1],gross:Math.round(gross),refund:Math.round(refund),refund_pct:gross?Math.round(refund/gross*10000)/100:0,receipts:recs,avg_check:recs?Math.round(gross/recs):0,sku:F.sku,staff:staff||F.staff,daily:daily,dayLabels:dayLabels,weekly:weekly_out,top_cats:top_cats,top_emp:top_emp,top_items:top_items,abc:F.abc,c_assort_pct:F.c_assort_pct,best_day:{idx:bi,label:dayLabels[bi],val:Math.round(daily[bi])},worst_day:{idx:wi,label:dayLabels[wi],val:Math.round(daily[wi])}};
}
(function dtInit(){const st=document.getElementById("dt-start"),en=document.getElementById("dt-end");if(st&&en&&P1FULL.dates&&P1FULL.dates.length){const f=P1FULL.dates[0],l=P1FULL.dates[P1FULL.dates.length-1];st.min=f;st.max=l;st.value=f;en.min=f;en.max=l;en.value=l;}})();
const ADESC={"A":"A guruh - tushumning 80 foizini taminlaydi. Eng muhim mahsulot, stokdan chiqmasin!","B":"B guruh - tushumning 15 foizini taminlaydi. Orta muhimlik, promo bilan kuchaytiring.","C":"C guruh - tushumning 5 foizini taminlaydi. Kam sotiladi, assortimentni korib chiqing."};
const AS={"A":["#E1F5EE","#085041","A guruh","abc-A-d"],"B":["#FAEEDA","#633806","B guruh","abc-B-d"],"C":["#FCEBEB","#501313","C guruh","abc-C-d"]};
const DATES=["01","02","03","04","05","06","07","08","09","10","11","12","13","14","15","16","17","18","19","20","21","22","23","24","25","26","27","28","29","30","31"];
let p2page=1,P2PS=50,p2rows=[];
function nn2(s){return String(s||"").replace(/\s+/g," ").trim().toLowerCase();}function dailyFor(v){if(!DAILY||!v)return null;const skuKey=v.sku&&DSKU?DSKU["sku:"+String(v.sku)]:null;const nameKey=DNAME?DNAME[nn2(v.name)]:null;return DAILY[skuKey]||DAILY[nameKey]||DAILY[nn2(v.name)]||null;}
function initP2(apiData){try{const _dp=apiData&&apiData.demand?apiData.demand:JSON.parse(document.getElementById("dailydata").textContent);DAILYFULL=_dp.items;DSKU=_dp.skuAliases||{};DNAME=_dp.nameAliases||{};DMETAFULL=_dp.__meta__;_winDaily();const ph=document.getElementById("p2-period");if(ph)ph.textContent=(DMETA.title||"")+" · "+DMETA.days+" kun";}catch(e){DAILY=null;DSKU={};DNAME={};DMETA=null;}const INV=apiData&&apiData.inventory?apiData.inventory:JSON.parse(document.getElementById("invdata").textContent);JSON.parse(document.getElementById("invdata").textContent);const invKeys=Object.keys(INV);P2.forEach((v,i)=>{v._i=i;const norm=nn2(v.name);let iv=INV[norm];if(!iv){const pk=invKeys.find(k=>k.startsWith(norm));if(pk)iv=INV[pk];}if(iv){v.sku=iv.sku;v.iprice=iv.p;v.amt=iv.a;v.itype=iv.t;v.sub=iv.sb;v.sup=iv.su;}});if(_rangeActive())_winArr(P2);p2FillCat();p2Filter();}
const P2FF=[{id:"pf-sub",k:v=>v.sub},{id:"pf-type",k:v=>v.itype},{id:"pf-sup",k:v=>v.sup}];
function p2FillCat(){const opts=[...new Set(P2.map(v=>v.cat).filter(x=>x))].sort((a,b)=>String(a).localeCompare(String(b),"ru"));const sel=document.getElementById("pf-cat");opts.forEach(v=>{const o=document.createElement("option");o.value=v;o.textContent=v;sel.appendChild(o);});}
function p2Match(v,skip){const fc=p2gv("pf-cat"),fs=p2gv("pf-sub"),ft=p2gv("pf-type"),fp=p2gv("pf-sup"),fa=p2gv("pf-amt"),fb=p2gv("pf-abc");if(skip!=="pf-cat"&&fc&&v.cat!==fc)return false;if(skip!=="pf-sub"&&fs&&v.sub!==fs)return false;if(skip!=="pf-type"&&ft&&v.itype!==ft)return false;if(skip!=="pf-sup"&&fp&&v.sup!==fp)return false;if(skip!=="pf-abc"&&fb&&v.abc!==fb)return false;if(skip!=="pf-amt"&&fa){const a=v.amt;if(a===undefined)return false;if(fa==="pos"&&!(a>0))return false;if(fa==="zero"&&a!==0)return false;if(fa==="neg"&&!(a<0))return false;}return true;}
function p2UniqWhere(kf,skip){const s=new Set();P2.forEach(v=>{if(p2Match(v,skip)){const x=kf(v);if(x)s.add(x);}});return [...s].sort((a,b)=>String(a).localeCompare(String(b),"ru"));}
function p2RebuildSel(id,opts,cur){const sel=document.getElementById(id);sel.innerHTML="";const o0=document.createElement("option");o0.value="";o0.textContent="Barchasi";sel.appendChild(o0);opts.forEach(v=>{const o=document.createElement("option");o.value=v;o.textContent=v;sel.appendChild(o);});sel.value=(cur&&opts.includes(cur))?cur:"";sel.className=sel.value?"on":"";}
function p2gv(id){return document.getElementById(id).value;}
function p2Filter(){P2FF.forEach(f=>{const cur=p2gv(f.id);const opts=p2UniqWhere(f.k,f.id);p2RebuildSel(f.id,opts,cur);});["pf-cat","pf-amt","pf-abc"].forEach(id=>{const e=document.getElementById(id);e.className=e.value?"on":"";});const q=document.getElementById("pf-q").value.trim().toLowerCase();p2rows=P2.filter(v=>{if(!v.sku)return false;if(_rangeActive()&&(v.qty||0)<=0)return false;if(!p2Match(v,null))return false;if(q&&!v.name.toLowerCase().includes(q)&&!String(v.sku||"").includes(q))return false;return true;});p2page=1;document.getElementById("pf-cnt").textContent=p2rows.length.toLocaleString()+" ta mahsulot";renderP2Table();}
function renderP2Table(){const tb=document.getElementById("pf-tbody");const ro=(p2page-1)*P2PS;const pg=p2rows.slice(ro,ro+P2PS);if(!pg.length){tb.innerHTML='<tr><td colspan="9" style="text-align:center;padding:34px;color:#bbb">Mahsulot topilmadi &mdash; filtrlarni o\'zgartiring</td></tr>';document.getElementById("pf-pag").innerHTML="";return;}const END=new Date((DMETA&&DMETA.end)?DMETA.end:'2026-05-31');let h="";pg.forEach((v,i)=>{const abc=v.abc||"";let di=v.di;if(di===undefined||di===null){if(v.ld){const d=new Date(v.ld);di=Math.max(0,Math.round((END-d)/86400000));}else{di=999;}}const[sc,stTxt]=sotuv(di);const price=v.iprice||0;h+=`<tr onclick="p2Open(${v._i})"><td style="color:#bbb">${ro+i+1}</td><td style="max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600" title="${esc(v.name)}">${esc(v.name)}${v.kg&&!v.name.toLowerCase().includes('kg')?' <span class="sug-kg">KG</span>':''}</td><td style="color:#999">${v.sku||"—"}</td><td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#777" title="${esc(v.cat||"")}">${esc(v.cat||"—")}</td><td style="color:#888;white-space:nowrap">${esc(v.itype||"—")}</td><td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#888" title="${esc(v.sup||"")}">${esc(v.sup||"—")}</td><td style="white-space:nowrap">${price?price.toLocaleString()+" so'm":"—"}</td><td><span class="badge ${sc}">${stTxt}</span></td><td>${abc?'<span class="p2-abc p2-abc-'+abc+'">'+abc+'</span>':'—'}</td></tr>`;});tb.innerHTML=h;renderP2Pag();}
function renderP2Pag(){const tot=Math.ceil(p2rows.length/P2PS);const pag=document.getElementById("pf-pag");if(tot<=1){pag.innerHTML="";return;}let h="";const mk=(l,p,d,a)=>`<button ${d?"disabled":""} ${a?'class="active"':""} onclick="p2Go(${p})">${l}</button>`;h+=mk("‹",p2page-1,p2page<=1,false);let s=Math.max(1,p2page-2),e=Math.min(tot,p2page+2);if(s>1){h+=mk("1",1,false,p2page===1);if(s>2)h+='<button disabled>…</button>';}for(let p=s;p<=e;p++)h+=mk(p,p,false,p===p2page);if(e<tot){if(e<tot-1)h+='<button disabled>…</button>';h+=mk(tot,tot,false,p2page===tot);}h+=mk("›",p2page+1,p2page>=tot,false);pag.innerHTML=h;}
function p2Go(p){p2page=p;renderP2Table();const sc=document.querySelector(".p2-tbl-scroll");if(sc)sc.scrollTop=0;}
function p2Open(i){renderP2(i);document.getElementById("p2graphs").style.display="";window.scrollTo({top:0,behavior:"smooth"});}
function p2CloseG(){document.getElementById("p2graphs").style.display="none";}
function p2Clear(){["pf-cat","pf-sub","pf-type","pf-sup","pf-amt","pf-abc"].forEach(id=>document.getElementById(id).value="");document.getElementById("pf-q").value="";p2Filter();}
function onIn(){if(!P2)return;const q=document.getElementById("si").value.toLowerCase().trim();const sb=document.getElementById("sug");if(q.length<2){sb.style.display="none";return;}const h=P2.filter(v=>v.name.toLowerCase().includes(q)).slice(0,10);if(!h.length){sb.style.display="none";return;}sb.innerHTML=h.map(v=>'<div class="sug-item" onclick="selItem('+P2.indexOf(v)+')" style="display:flex;align-items:center;justify-content:space-between;gap:8px;"><div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;">'+esc(v.name)+(v.kg&&!v.name.toLowerCase().includes('kg')?'<span class="sug-kg">KG</span>':'')+'</div><span class="sug-abc abc-'+v.abc+'-p">'+v.abc+'</span></div>').join("");sb.style.display="block";}
function onKey(e){if(e.key==="Enter")goSearch();}
function selItem(idx){document.getElementById("si").value=P2[idx].name;document.getElementById("sug").style.display="none";renderP2(idx);}
function goSearch(){if(!P2)return;const q=document.getElementById("si").value.toLowerCase().trim();document.getElementById("sug").style.display="none";if(!q)return;const idx=P2.findIndex(v=>v.name.toLowerCase().includes(q));if(idx<0){document.getElementById("hint").textContent="Topilmadi - boshqa nom sinab koring";return;}renderP2(idx);}
function renderP2(idx){
  window.p2ActiveIndex=idx;
  const v=P2[idx];
  const u=v.kg?"kg":"dona";
  const dl=dailyFor(v);
  const dd=dl?dl.q:(v.d||[]);
  const dr=dl?dl.r:null;
  const drr=dl?dl.rr:null;
  const dwr=dl?dl.wr:null;
  const dw=dl?dl.w:null;
  const labels=(DMETA&&DMETA.labels&&DMETA.labels.length===dd.length)
    ?DMETA.labels.map(value=>value.slice(5))
    :dd.map((_,i)=>String(i+1).padStart(2,"0"));
  const tz=calcTozaOrtacha(dd,dr,dw,dl);
  const m=tz.metrics||{
    daily:tz.clean_avg,
    week:tz.clean_avg*7,
    month:tz.clean_avg*30,
    activeAvg:tz.clean_active_avg,
    activeDays:tz.retailDays,
    confidence:0,
    wholesalePct:tz.total?tz.wSum/tz.total*100:0,
    explicitWholesale:0,
    inferredWholesale:tz.wSum,
    trend:"stable"
  };
  const pat=analyzePattern(dd,tz,u);
  const fmtQty=value=>v.kg?Number(value||0).toFixed(2):Math.round(value||0).toLocaleString();
  const fmtNeed=value=>{
    const amount=Number(value)||0;
    if(v.kg)return amount.toFixed(2);
    return (amount>0?Math.ceil(amount):0).toLocaleString();
  };
  const fmtRate=value=>{
    const amount=Number(value)||0;
    if(v.kg)return amount.toFixed(2)+" "+u+"/kun";
    if(amount>0&&amount<1)return "<1 "+u+"/kun";
    return Math.round(amount).toLocaleString()+" "+u+"/kun";
  };
  const horizonInput=document.getElementById("demand-days");
  const horizon=Math.max(1,Math.min(365,Number(horizonInput&&horizonInput.value)||7));
  const lowVelocity=m.daily>0&&m.daily<1;
  const baselineDaily=m.baselineDaily!=null?m.baselineDaily:(tz.retailMonth/(dd.length||1));
  const horizonForecast=m.daily*horizon;
  const horizonBaseline=baselineDaily*horizon;
  const hasLowerForecast=horizonForecast+0.001<horizonBaseline;
  const demandDisplay=hasLowerForecast
    ?fmtNeed(horizonForecast)+"–"+fmtNeed(horizonBaseline)
    :fmtNeed(horizonForecast);
  const primaryLabel=lowVelocity?"30 kunlik retail prognozi":"1 kunlik retail prognozi";
  const primaryForecast=lowVelocity?m.month:m.daily;
  const primaryBaseline=lowVelocity?baselineDaily*30:baselineDaily;
  const primaryDisplay=primaryForecast+0.001<primaryBaseline
    ?fmtNeed(primaryForecast)+"–"+fmtNeed(primaryBaseline)
    :fmtNeed(primaryForecast);
  const customerText=(m.wholesaleCustomers||[]).join(", ");
  const receiptAvg=m.totalReceipts?m.totalSold/m.totalReceipts:0;
  const separationReason=m.explicitWholesale>0
    ?(fmtQty(m.explicitWholesale)+" "+u+" "+m.explicitReceipts+" ta korporativ chekdan ajratildi"
      +(customerText?": "+esc(customerText):"")+".")
    :m.inferredWholesale>0
      ?(m.inferredReceipts+" ta kam-chekli katta xaridda miqdor "+fmtQty(m.bulkThreshold)+" "+u+
        "/chek chegarasidan oshgan. Normal "+fmtQty(m.retailCap)+" "+u+"/chek retailda qoldirildi.")
      :("Jami "+m.totalReceipts+" chek, o'rtacha "+fmtQty(receiptAvg)+" "+u+
        "/chek. Bu mahsulotning odatiy P90 ko'rsatkichi "+fmtQty(m.receiptP90)+" "+u+
        "/chek bo'lgani uchun savdo retailda qoldirildi.");
  let lastSaleIndex=-1;
  for(let day=dd.length-1;day>=0;day--){
    if(dd[day]>0){lastSaleIndex=day;break;}
  }
  const lastSaleDate=lastSaleIndex>=0&&DMETA&&DMETA.labels
    ?DMETA.labels[lastSaleIndex]
    :"Bu davrda sotuv yo'q";
  const daysSinceSale=lastSaleIndex>=0?dd.length-1-lastSaleIndex:null;
  const lastSaleText=daysSinceSale===null
    ?"Savdo kuzatilmadi"
    :daysSinceSale===0
      ?"Davrning oxirgi kunida sotilgan"
      :daysSinceSale+" kun oldin sotilgan";
  const lastSaleColor=daysSinceSale===null||daysSinceSale>20
    ?"#E24B4A"
    :daysSinceSale===0
      ?"#1D9E75"
      :daysSinceSale<=10
        ?"#D99A16"
        :"#E66A3A";
  const lastSaleBg=daysSinceSale===null||daysSinceSale>20
    ?"#FCEBEB"
    :daysSinceSale===0
      ?"#E1F5EE"
      :daysSinceSale<=10
        ?"#FFF4D6"
        :"#FDE9DF";
  const rt=document.getElementById("rtag");
  rt.style.display="inline-block";
  rt.textContent="Natija: "+v.name+(v.kg?" [KG]":"");
  document.getElementById("hint").textContent="";
  document.getElementById("qunit").textContent=u;

  const basket=(v.b||[]).filter(x=>!/^paket tiin\b/i.test(x.n));
  document.getElementById("bcnt").textContent=basket.length+" ta";
  document.getElementById("blist").innerHTML=basket.length
    ?basket.map((x,i)=>'<div class="prod-row"><div class="pn">'+(i+1)+'</div><div class="pname">'+esc(x.n)+'</div><div class="pbar-w"><div class="pbar" style="width:'+Math.min(100,x.c)+'%;background:#1D9E75"></div></div><div class="ppct">'+x.c+'%</div></div>').join("")
    :'<div class="empty"><div class="empty-txt">Birga sotilgan mahsulot topilmadi</div></div>';

  document.getElementById("dstats").innerHTML=
    '<div class="stat-grid">'+
      '<div class="sbox tz-sbox"><div class="slbl">'+primaryLabel+'</div><div class="sval">'+primaryDisplay+' '+u+'</div></div>'+
      '<div class="sbox"><div class="slbl">'+horizon+' kunlik ehtiyoj</div><div class="sval">'+demandDisplay+' '+u+'</div></div>'+
      '<div class="sbox"><div class="slbl">Sof retail</div><div class="sval">'+fmtQty(tz.retailMonth)+' '+u+'</div></div>'+
      '<div class="sbox"><div class="slbl">Ulgurji</div><div class="sval">'+fmtQty(tz.wSum)+' '+u+'</div></div>'+
      '<div class="sbox" style="grid-column:1/-1;background:#F8FAFC;border:1px solid #E2E8F0;"><div class="slbl">'+(DMETA&&DMETA.days?DMETA.days+" kunlik savdo":"Jami savdo")+'</div><div class="sval">'+fmt(m.revenue||0)+' UZS · '+fmtQty(m.totalSold)+' '+u+'</div></div>'+
    '</div>'+
    '<div style="margin-top:8px;padding:7px 10px;border-left:3px solid '+pat.color+';background:#F8FAFC;border-radius:0 7px 7px 0;font-size:10px;color:#4B5563;">'+
      '<b style="color:'+pat.color+'">Ajratish sababi:</b> '+separationReason+
    '</div>';

  const canvasWrap=document.getElementById("cwrap");
  canvasWrap.style.display="block";
  if(p2chart)p2chart.destroy();
  p2chart=new Chart(document.getElementById("dc"),{
    type:"bar",
    data:{labels,datasets:[
      {label:"Retail — ko'p chek yoki normal miqdor",data:tz.retail,backgroundColor:"rgba(29,158,117,.72)",borderRadius:3,stack:"sales"},
      {label:"Ulgurji — korporativ yoki kam chekda katta miqdor",data:dw||new Array(dd.length).fill(0),backgroundColor:"#EF9F27",borderRadius:3,stack:"sales"},
      {type:"line",label:"Kunlik talab: "+fmtRate(m.daily),data:new Array(dd.length).fill(m.daily),borderColor:"#534AB7",borderWidth:2,pointRadius:0,borderDash:[5,4]}
    ]},
    options:{
      responsive:true,
      maintainAspectRatio:false,
      interaction:{mode:"index",intersect:false},
      plugins:{
        legend:{display:true,labels:{boxWidth:10,font:{size:9}}},
        tooltip:{
          mode:"index",
          intersect:false,
          callbacks:{
            title:items=>(DMETA&&DMETA.labels?DMETA.labels[items[0].dataIndex]:labels[items[0].dataIndex]),
            label:()=>null,
            afterBody:items=>{
              const day=items[0].dataIndex;
              return[
                "Retail: "+fmtQty(tz.retail[day])+" "+u+" / retail qismi bor "+((drr&&drr[day])||0)+" chek",
                "Ulgurji: "+fmtQty((dw&&dw[day])||0)+" "+u+" / shundan "+((dwr&&dwr[day])||0)+" chekda ulgurji qism",
                "Jami sotilgan: "+fmtQty(dd[day])+" "+u,
                "Jami noyob cheklar: "+((dr&&dr[day])||0)+" ta"
              ];
            }
          }
        }
      },
      scales:{
        x:{stacked:true,grid:{display:false},ticks:{font:{size:9},maxTicksLimit:12}},
        y:{stacked:true,grid:{color:"rgba(0,0,0,.05)"},ticks:{font:{size:9}}}
      }
    }
  });

  document.getElementById("kgalert").style.display=v.kg?"flex":"none";
  const abc=v.abc||"A";
  const [bg,col,txt,dcls]=AS[abc]||AS.A;
  const badge=document.getElementById("abcb");
  badge.style.display="inline-block";
  badge.style.background=bg;
  badge.style.color=col;
  badge.textContent=txt;
  document.getElementById("pinfo").innerHTML=
    '<div class="abc-desc '+dcls+'">'+ADESC[abc]+'</div>'+
    '<div class="stat-grid">'+
      '<div class="sbox"><div class="slbl">Jami tushum</div><div class="sval">'+fmt(v.rev)+' UZS</div></div>'+
      '<div class="sbox"><div class="slbl">Narxi</div><div class="sval">'+(v.p||0).toLocaleString()+' UZS</div></div>'+
      '<div class="sbox"><div class="slbl">Cheklar</div><div class="sval">'+(v.rec||0).toLocaleString()+'</div></div>'+
      '<div class="sbox"><div class="slbl">Davr</div><div class="sval">'+(DMETA?DMETA.start+" — "+DMETA.end:"-")+'</div></div>'+
      '<div class="sbox" style="grid-column:1/-1;background:'+lastSaleBg+';border-left:4px solid '+lastSaleColor+'"><div class="slbl" style="color:'+lastSaleColor+'">Oxirgi savdo</div><div class="sval" style="color:'+lastSaleColor+'">'+lastSaleDate+' · '+lastSaleText+'</div></div>'+
    '</div>';
}

function p2SetHorizon(commit){
  const input=document.getElementById("demand-days");
  if(!input)return;
  if(input.value===""){
    if(commit)input.value="1";
    else return;
  }
  const value=Math.max(1,Math.min(365,Number(input.value)||1));
  if(commit||String(value)!==input.value)input.value=value;
  if(Number.isInteger(window.p2ActiveIndex))renderP2(window.p2ActiveIndex);
}
function toggleF(){const fd=document.getElementById("fd"),fa=document.getElementById("farrow");if(fd.style.display==="block"){fd.style.display="none";fa.style.transform="";}else{fd.style.display="block";fa.style.transform="rotate(180deg)";}}
document.addEventListener("click",e=>{const sg=document.getElementById("sug");if(sg&&!e.target.closest(".sug-wrap"))sg.style.display="none";});
function recomputeABC(){if(!P3)return;const ra=_rangeActive();P3.forEach(v=>{v._off=ra&&(v.qty||0)<=0;let ratio=1;if(DAILY){const dl=dailyFor(v);if(dl){const t=dl.q.reduce((a,b)=>a+b,0);const w=dl.w.reduce((a,b)=>a+b,0);ratio=t>0?Math.max(0,(t-w)/t):1;}}v.retRev=(v.rev||0)*ratio;v.retRatio=ratio;});const act=P3.filter(v=>!v._off);const sorted=[...act].sort((a,b)=>b.retRev-a.retRev);const totRev=sorted.reduce((a,v)=>a+v.retRev,0)||1;let cum=0;sorted.forEach((v,i)=>{cum+=v.retRev;const p=cum/totRev;v.abc=p<=0.8?"A":p<=0.95?"B":"C";v.r=i+1;if(v.abc==="C"){v.sub=(v.di>20)?"C1":(v.tr==="down"?"C2":"C3");}else{v.sub=v.abc;}});P3.forEach(v=>{if(v._off){v.abc="";v.sub="";}});}
function initP3(){if(_rangeActive())_winArr(P3);recomputeABC();let A3=0,B3=0,C3=0,aV=0,bV=0,cV=0;P3.forEach(v=>{if(v._off)return;if(v.abc==="A"){A3++;aV+=v.retRev;}else if(v.abc==="B"){B3++;bV+=v.retRev;}else{C3++;cV+=v.retRev;}});const tV3=(aV+bV+cV)||1;const pA=aV/tV3*100,pB=bV/tV3*100,pC=cV/tV3*100;const setT=(id,t)=>{const el=document.getElementById(id);if(el)el.textContent=t;};setT("k3a-n",A3.toLocaleString());setT("k3b-n",B3.toLocaleString());setT("k3c-n",C3.toLocaleString());setT("k3a-s",Math.round(pA)+"% retail tushum · "+fmt(aV)+" UZS");setT("k3b-s",Math.round(pB)+"% retail tushum · "+fmt(bV)+" UZS");setT("k3c-s",Math.round(pC)+"% retail tushum · "+fmt(cV)+" UZS");setT("lg-a",Math.round(pA)+"%");setT("lg-b",Math.round(pB)+"%");setT("lg-c",Math.round(pC)+"%");const c1n=P3.filter(v=>v.sub==="C1").length;setT("tab-A-n",A3.toLocaleString());setT("tab-B-n",B3.toLocaleString());setT("tab-C-n",C3.toLocaleString());setT("tab-C1-n",c1n.toLocaleString());
new Chart(document.getElementById("donut3"),{type:"doughnut",data:{labels:["A guruh","B guruh","C guruh"],datasets:[{data:[pA,pB,pC],backgroundColor:["#1D9E75","#EF9F27","#E24B4A"],borderWidth:0,hoverOffset:6}]},options:{responsive:true,maintainAspectRatio:false,cutout:"60%",plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>c.label+": "+c.parsed.toFixed(1)+"%"}}}}});
const top15=[...P3].filter(v=>!v._off&&(v.retRev||0)>0).sort((a,b)=>b.retRev-a.retRev).slice(0,15);new Chart(document.getElementById("bar15"),{type:"bar",data:{labels:top15.map(v=>v.name.slice(0,28)),datasets:[{data:top15.map(v=>+(v.retRev/1e6).toFixed(1)),backgroundColor:"rgba(83,74,183,0.7)",borderRadius:3,borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,indexAxis:"y",plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>c.parsed.x.toFixed(1)+" mln UZS (retail)"}}},scales:{x:{grid:{color:"rgba(0,0,0,0.07)"},ticks:{font:{size:9},callback:v=>v+" mln"}},y:{grid:{display:false},ticks:{font:{size:9}}}}}});
curRows3=getRows3("A");renderTable3(curRows3);}
function getRows3(tab){if(tab==="A")return P3.filter(v=>v.abc==="A");if(tab==="B")return P3.filter(v=>v.abc==="B");if(tab==="C")return P3.filter(v=>v.abc==="C");return P3.filter(v=>v.sub==="C1");}
function sotuv(di){if(di>=900)return["b-bad","Bu davrda sotuv yo'q"];if(di===0)return["b-ok","Oxirgi kuni sotildi"];if(di<=14)return["b-w",di+" kun oldin"];return["b-bad",di+" kun oldin"];}
function _med(a){if(!a.length)return 0;const s=[...a].sort((x,y)=>x-y);const m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2;}
function calcTozaOrtacha(dd,dr,dw,dl){
  const nd=dd.length;
  const total=dd.reduce((a,b)=>a+b,0);
  const wholesale=(dw&&dw.length===nd)?dw:new Array(nd).fill(0);
  const retail=(dl&&dl.rt&&dl.rt.length===nd)
    ?dl.rt
    :dd.map((value,index)=>Math.max(0,value-(wholesale[index]||0)));
  const retailMonth=retail.reduce((a,b)=>a+b,0);
  const retailDays=retail.filter(value=>value>0.001).length;
  const wholesaleRows=[];
  for(let day=0;day<nd;day++){
    const explicit=dl&&dl.x?dl.x[day]||0:0;
    const inferred=dl&&dl.i?dl.i[day]||0:0;
    if(explicit>0)wholesaleRows.push({day,val:dd[day],wq:explicit,r:dr?dr[day]||0:0,src:"ANIQ"});
    if(inferred>0)wholesaleRows.push({day,val:dd[day],wq:inferred,r:dr?dr[day]||0:0,src:"EHTIMOL"});
  }
  return{
    wholesale:wholesaleRows,
    wSum:wholesale.reduce((a,b)=>a+b,0),
    retailMonth,
    clean_avg:nd?retailMonth/nd:0,
    clean_active_avg:retailDays?retailMonth/retailDays:0,
    retailDays,
    retail,
    total,
    metrics:dl&&dl.m?dl.m:null
  };
}

function analyzePattern(dd,tz,u){
  const m=tz.metrics||{};
  const trend=m.trend||"stable";
  const confidence=m.confidence||0;
  const active=m.activeDays!=null?m.activeDays:tz.retailDays;
  const days=dd.length||1;
  const wholesalePct=m.wholesalePct||0;
  if(tz.retailMonth<=0)return{type:"no_sales",label:"Retail savdo yo'q",color:"#888",confidence,msg:"Tanlangan davrda sof retail savdo aniqlanmadi.",rec:"Ulgurji savdo va retail savdoni alohida tekshiring."};
  if(active/days<0.25)return{type:"slow",label:"Sust retail talab",color:"#94A3B8",confidence,msg:active+" / "+days+" kun retail savdo bo'lgan.",rec:"Talab tezligini kalendar kun bo'yicha baholang."};
  if(trend==="up")return{type:"grow",label:"Retail talab o'smoqda",color:"#1D9E75",confidence,msg:"So'nggi davr avvalgi davrdan yuqori.",rec:"7 va 30 kunlik prognozda so'nggi kunlarga ko'proq vazn berildi."};
  if(trend==="down")return{type:"decline",label:"Retail talab pasaymoqda",color:"#E24B4A",confidence,msg:"So'nggi davr avvalgi davrdan past.",rec:"Prognoz pasaygan talabni hisobga oladi."};
  if(wholesalePct>0)return{type:"wholesale",label:"Retail va ulgurji ajratildi",color:"#EF9F27",confidence,msg:"Jami savdoning "+wholesalePct.toFixed(1)+"% ulgurji sifatida ajratildi.",rec:"Talab prognoziga faqat sof retail savdo kiritildi."};
  return{type:"stable",label:"Barqaror retail talab",color:"#1D9E75",confidence,msg:active+" / "+days+" kun retail savdo bo'lgan.",rec:"Kunlik, haftalik va 30 kunlik talab sof retail asosida hisoblandi."};
}
function renderTable3(rows){const q=document.getElementById("srch3").value.toLowerCase().trim();let filtered=rows;if(q){filtered=P3.filter(v=>!v._off&&v.name.toLowerCase().includes(q));if(filtered.length>0){const fv=filtered[0];const tt=fv.sub==="C1"?"C1":fv.abc;if(tt!==curTab3){curTab3=tt;document.querySelectorAll(".atab").forEach(b=>b.className="atab");document.querySelectorAll(".atab").forEach(b=>{if(b.dataset.tab===tt)b.className="atab sel-"+tt;});curRows3=getRows3(tt);}}}document.getElementById("tcnt").textContent=filtered.length.toLocaleString()+" ta mahsulot";const max=Math.min(filtered.length,500);const rows2=[];for(let i=0;i<max;i++){const v=filtered[i];const idx=P3.indexOf(v);const[sc,st]=sotuv(v.di);const sub=v.sub?'<span class="badge '+(v.sub==="C1"?"b-c1":v.sub==="C2"?"b-c2":"b-c3")+'">'+v.sub+"</span>":"";rows2.push('<tr data-idx="'+idx+'" onclick="showDetail3('+idx+')"><td style="color:#bbb;">'+v.r+'</td><td style="font-weight:500;">'+esc(v.name)+'</td><td style="color:#888;">'+esc(v.cat.substring(0,20))+'</td><td style="font-weight:700;color:#1D9E75;">'+fmt(v.retRev!=null?v.retRev:v.rev)+'</td><td>'+v.rec.toLocaleString()+'</td><td style="color:'+(v.di>7?"#E24B4A":"#1D9E75")+';">'+v.ld+'</td><td><span class="badge '+sc+'">'+st+'</span></td><td><span class="badge b-'+v.abc+'">'+v.abc+'</span></td><td>'+sub+'</td></tr>');}if(!rows2.length)rows2.push('<tr><td colspan="9" style="text-align:center;padding:20px;color:#bbb;">Topilmadi</td></tr>');document.getElementById("tbody3").innerHTML=rows2.join("");document.getElementById("detail3").style.display="none";}
function setTab(btn){const tab=btn.dataset.tab;curTab3=tab;document.querySelectorAll(".atab").forEach(b=>b.className="atab");btn.className="atab sel-"+tab;document.getElementById("srch3").value="";curRows3=getRows3(tab);renderTable3(curRows3);}
function filterTable(){renderTable3(curRows3);}
function showDetail3(idx){const v=P3[idx];if(!v)return;const u=v.kg?"kg":"dona";const[sc,st]=sotuv(v.di);document.querySelectorAll("tr.sel").forEach(r=>r.classList.remove("sel"));const row=document.querySelector('tr[data-idx="'+idx+'"]');if(row){row.classList.add("sel");row.scrollIntoView({block:"nearest"});}document.getElementById("d3-name").textContent=v.name;document.getElementById("detail3").className="detail d"+v.abc;let bdg='<span class="badge b-'+v.abc+'" style="font-size:11px;padding:3px 9px;">'+v.abc+' guruh</span>';if(v.sub){const sc2=v.sub==="C1"?"b-c1":v.sub==="C2"?"b-c2":"b-c3";bdg+=' <span class="badge '+sc2+'" style="font-size:11px;padding:3px 9px;">'+v.sub+'</span>';}if(v.kg)bdg+=' <span class="badge" style="background:#EAF3DE;color:#27500A;font-size:11px;padding:3px 9px;">KG tovar</span>';document.getElementById("d3-badges").innerHTML=bdg;document.getElementById("d3-stats").innerHTML='<div class="ds"><div class="ds-l">Jami tushum</div><div class="ds-v" style="color:#1D9E75;">'+fmt(v.rev)+' UZS</div></div><div class="ds"><div class="ds-l">Narxi (1 '+u+')</div><div class="ds-v">'+v.p.toLocaleString()+' UZS</div></div><div class="ds"><div class="ds-l">Cheklar soni</div><div class="ds-v">'+v.rec.toLocaleString()+'</div></div><div class="ds"><div class="ds-l">Tushum ulushi</div><div class="ds-v">'+v.rp.toFixed(3)+'%</div></div><div class="ds"><div class="ds-l">Oxirgi sotilgan</div><div class="ds-v" style="color:'+(v.di>7?"#E24B4A":"#1D9E75")+';">'+v.ld+'</div></div><div class="ds"><div class="ds-l">Sotuv holati</div><div class="ds-v"><span class="badge '+sc+'">'+st+'</span></div></div><div class="ds"><div class="ds-l">Kunlik ortacha</div><div class="ds-v">'+(v.qty/31).toFixed(v.kg?2:1)+' '+u+'</div></div><div class="ds"><div class="ds-l">Jami sotilgan</div><div class="ds-v">'+v.qty.toFixed(v.kg?2:0)+' '+u+'</div></div>';const why=(v.why||[]).map(w=>'<div class="bx-item"><div class="bx-dot"></div><div class="bx-txt">'+esc(w)+'</div></div>').join("");const how=(v.how||[]).map((h,i)=>'<div class="bx-item"><div class="bx-num">'+(i+1)+'.</div><div class="bx-txt">'+esc(h)+'</div></div>').join("");document.getElementById("d3-ra").innerHTML='<div class="box bx-why"><div class="bx-t">Nega '+v.abc+' guruhda?</div>'+why+'</div><div class="box bx-'+v.abc+'"><div class="bx-t">Nima qilish kerak?</div>'+how+'</div>';const dw=document.getElementById("detail3");dw.style.display="block";setTimeout(()=>dw.scrollIntoView({behavior:"smooth",block:"nearest"}),50);}
function openUpload(){if(confirm("Yangi oy ma'lumotini yuklashga o'tasizmi?")){window.location.href="/upload";}}
function p2FCount(){const ids=["pf-cat","pf-sub","pf-type","pf-sup","pf-amt","pf-abc"];let n=0;ids.forEach(id=>{const e=document.getElementById(id);if(e&&e.value)n++;});const b=document.getElementById("p2-fcount");if(b)b.textContent=n?"("+n+")":"";const btn=document.getElementById("p2-fbtn");if(btn)btn.classList.toggle("has",n>0);}
function p2FToggle(e){if(e)e.stopPropagation();const p=document.getElementById("p2-fpop");if(p)p.classList.toggle("open");p2FCount();}
document.addEventListener("click",function(e){const w=document.querySelector(".p2-fwrap");const p=document.getElementById("p2-fpop");if(w&&p&&!w.contains(e.target))p.classList.remove("open");});
document.addEventListener("click",function(e){const b=document.getElementById("z-fbtn");const p=document.getElementById("z-fpop");if(b&&p&&!b.contains(e.target)&&!p.contains(e.target))p.classList.remove("open");});
