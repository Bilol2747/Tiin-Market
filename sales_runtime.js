// ─── Login (statik) ───
const LG_PHONE="910758080",LG_PASS="12345678";
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

// ─── Til almashtirish (i18n) — hozircha to'liq Bosh sahifa, qolgan sahifalar keyingi bosqichda ───
const I18N={
  nav_p1:{uz:"Bosh sahifa",en:"Home",ru:"Главная"},
  nav_p2:{uz:"Mahsulotlar",en:"Products",ru:"Товары"},
  nav_p3:{uz:"ABC tahlili",en:"ABC analysis",ru:"ABC-анализ"},
  nav_p5:{uz:"Stock",en:"Stock",ru:"Склад"},
  nav_p6:{uz:"Suppliers",en:"Suppliers",ru:"Поставщики"},
  nav_upload:{uz:"Yangi oy yuklash",en:"Upload new month",ru:"Загрузить новый месяц"},
  dt_all:{uz:"Butun davr",en:"Whole period",ru:"Весь период"},
  dt_7:{uz:"So'nggi 7 kun",en:"Last 7 days",ru:"Последние 7 дней"},
  dt_14:{uz:"So'nggi 14 kun",en:"Last 14 days",ru:"Последние 14 дней"},
  dt_30:{uz:"So'nggi 30 kun",en:"Last 30 days",ru:"Последние 30 дней"},
  dt_60:{uz:"So'nggi 60 kun",en:"Last 60 days",ru:"Последние 60 дней"},
  dt_start:{uz:"Boshlanish",en:"Start",ru:"Начало"},
  dt_end:{uz:"Tugash",en:"End",ru:"Конец"},
  dt_apply:{uz:"Qo'llash",en:"Apply",ru:"Применить"},
  dt_note_full:{uz:"Butun davr ko'rsatilmoqda.",en:"Showing the whole period.",ru:"Показан весь период."},
  dt_note_range:{uz:"Barcha sahifalar tanlangan oraliq bo'yicha aniq hisoblandi.",en:"All pages are recalculated for the selected range.",ru:"Все страницы пересчитаны для выбранного периода."},
  p1_title:{uz:"Umumiy ko'rsatkichlar",en:"Overview",ru:"Общие показатели"},
  kpi_gross_l:{uz:"Jami tushum",en:"Gross sale",ru:"Общая выручка"},
  kpi_gross_s:{uz:"UZS (brutto savdo)",en:"UZS (gross sale)",ru:"UZS (общая выручка)"},
  kpi_cost_l:{uz:"Kelish narxi",en:"Cost",ru:"Себестоимость"},
  kpi_cost_s:{uz:"UZS jami tannarx",en:"UZS total cost",ru:"UZS общая себестоимость"},
  kpi_profit_l:{uz:"Foyda",en:"Gross profit",ru:"Прибыль"},
  kpi_profit_s:{uz:"UZS jami foyda",en:"UZS total profit",ru:"UZS общая прибыль"},
  kpi_refund_l:{uz:"Qaytarilgan",en:"Refund",ru:"Возврат"},
  kpi_refund_s_suffix:{uz:"UZS refund",en:"UZS refunded",ru:"UZS возврат"},
  kpi_sku_l:{uz:"Mahsulot turi",en:"Product types",ru:"Виды товара"},
  kpi_sku_s:{uz:"xil tovar sotilgan",en:"items sold",ru:"видов товара продано"},
  kpi_rec_l:{uz:"Jami cheklar",en:"Total receipts",ru:"Всего чеков"},
  kpi_rec_s:{uz:"ta xarid amalga oshgan",en:"purchases made",ru:"покупок совершено"},
  card_daily:{uz:"Kunlik tushum dinamikasi",en:"Daily sales trend",ru:"Динамика дневной выручки"},
  card_cats:{uz:"Top kategoriyalar",en:"Top categories",ru:"Топ категории"},
  card_cats_hint:{uz:"tushum bo'yicha",en:"by revenue",ru:"по выручке"},
  card_top_items:{uz:"Top 8 mahsulot",en:"Top 8 products",ru:"Топ 8 товаров"},
  card_top_items_hint:{uz:"eng ko'p tushum",en:"highest revenue",ru:"по выручке"},
  card_top_profit:{uz:"Top 8 mahsulot",en:"Top 8 products",ru:"Топ 8 товаров"},
  card_top_profit_hint:{uz:"eng ko'p foyda",en:"highest profit",ru:"по прибыли"},
  card_week:{uz:"Hafta kunlari bo'yicha",en:"By day of week",ru:"По дням недели"},
  card_week_hint:{uz:"eng kuchli/zaif kun",en:"strongest/weakest day",ru:"лучший/худший день"},
  card_abc:{uz:"ABC tahlil ulushi",en:"ABC analysis share",ru:"Доля ABC-анализа"},
  card_abc_hint:{uz:"tushum taqsimoti",en:"revenue distribution",ru:"распределение выручки"},
  last_updated:{uz:"Oxirgi yangilangan",en:"Last updated",ru:"Последнее обновление"},
  in_kun:{uz:"kun",en:"d",ru:"дн"},
  eng_yuqori:{uz:"Eng yuqori savdo",en:"Highest sale",ru:"Макс. продажа"},
  eng_past:{uz:"Eng past",en:"Lowest",ru:"Мин."},
  eng_kuchli:{uz:"Eng kuchli",en:"Strongest",ru:"Лучший"},
  eng_zaif:{uz:"Eng zaif",en:"Weakest",ru:"Худший"},
  guruh:{uz:"guruh",en:"group",ru:"группа"},
  ta_mahsulot:{uz:"ta mahsulot",en:"items",ru:"товаров"},
  faqat:{uz:"faqat",en:"only",ru:"только"},
  tushum_lc:{uz:"tushum",en:"revenue",ru:"выручка"},
  lekin:{uz:"lekin",en:"but",ru:"но"},
  assortiment:{uz:"assortiment",en:"of the assortment",ru:"ассортимента"},
  kunlik_malumot:{uz:"kunlik ma'lumot",en:"days of data",ru:"дней данных"},
};
let LANG=(()=>{try{return localStorage.getItem("tiin_lang")||"uz";}catch(_){return "uz";}})();
function t(key){const e=I18N[key];return e?(e[LANG]||e.uz):key;}
const WEEKDAYS_FULL={
  uz:["Dushanba","Seshanba","Chorshanba","Payshanba","Juma","Shanba","Yakshanba"],
  en:["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],
  ru:["Понедельник","Вторник","Среда","Четверг","Пятница","Суббота","Воскресенье"]
};
function setLang(lang){
  LANG=lang;
  try{localStorage.setItem("tiin_lang",lang);}catch(_){}
  document.querySelectorAll(".lang-btn").forEach(b=>b.classList.toggle("active",b.dataset.lang===lang));
  applyI18n();
  if(typeof renderP1==="function"&&P1)renderP1();
}
function applyI18n(){
  document.querySelectorAll("[data-i18n]").forEach(el=>{el.textContent=t(el.dataset.i18n);});
}

let P1=JSON.parse(document.getElementById("p1data").textContent);let P1FULL=P1;
let GRA=null,GRB=null,DAILYFULL=null,DMETAFULL=null;
let curPageId="p1";const PAGE_DEFAULT_DAYS={p1:7,p2:30,p3:30,p5:30,p6:30};let pageRanges={};
let P2=null,P3=null,P4=null,DAILY=null,DSKU={},DNAME={},DMETA=null,p2chart=null,p4sk="v",p4sa=false,curTab3="A",curRows3=[];
let p2LastI=null;
let ZITEMS=null,INVDATA=null,zCurFilter="all",zQuery="",zF={cat:"",sub:"",sup:"",type:"",abc:""},zFilled=false,zLastZi=null,zPage=1,zSuperTabCur="aktiv";
const ZPS=50;
let zDays=30,zKFilter="all",zKSup="",zKQuery="",zKCat="";
let P6=null,p6CurF="all",p6Q="",p6Page=1,p6SelI=null;
const P6PS=50;
function openZakas(){
  if(!ZITEMS)return;
  zKQuery="";zKCat="";zKSup="";zKFilter="all";const si=document.getElementById("zk-search");if(si)si.value="";const cs=document.getElementById("zk-cat-sel");if(cs)cs.value="";const ss=document.getElementById("zk-sup-sel");if(ss)ss.value="";document.querySelectorAll(".zk-ftab").forEach(b=>b.classList.toggle("active",b.dataset.zf==="all"));_zkUpdateFltBadge();
  document.getElementById("zk-modal").style.display="flex";
  _zkFillSelects("","");
  buildZakas();
}
function setZKQuery(v){zKQuery=v.toLowerCase().trim();buildZakas();}
function setZKCat(v){zKCat=v;_zkFillSelects(zKSup,v);_zkUpdateFltBadge();buildZakas();}
function closeZakas(){document.getElementById("zk-modal").style.display="none";zkFltClose();}
function zkFltToggle(e){if(e)e.stopPropagation();const p=document.getElementById("zk-flt-pop");if(!p)return;const open=p.style.display!=="none";if(!open){_zkFillSelects("","");p.style.display="block";const b=document.getElementById("zk-flt-btn");if(b){b.style.borderColor="#534AB7";b.style.color="#534AB7";}}else{zkFltClose();}}
function zkFltClose(){const p=document.getElementById("zk-flt-pop");if(p)p.style.display="none";const b=document.getElementById("zk-flt-btn");if(b){b.style.borderColor="";b.style.color="";}}
function _zkUpdateFltBadge(){const n=(zKFilter!=="all"?1:0)+(zKSup?1:0)+(zKCat?1:0);const el=document.getElementById("zk-flt-cnt");if(!el)return;if(n>0){el.style.display="inline";el.textContent=n;}else{el.style.display="none";}}
function setZakasDays(d){zDays=d;const inp=document.getElementById("zk-days-inp");if(inp)inp.value=d;document.querySelectorAll(".zk-preset").forEach(b=>b.classList.toggle("active",b.textContent.trim()===d+" kun"));buildZakas();}
function zkDaysInput(){const v=parseInt(document.getElementById("zk-days-inp").value)||30;zDays=Math.max(1,Math.min(365,v));document.querySelectorAll(".zk-preset").forEach(b=>b.classList.toggle("active",b.textContent.trim()===zDays+" kun"));buildZakas();}
function setZKFilter(f){zKFilter=f;zKSup="";zKCat="";document.querySelectorAll(".zk-ftab").forEach(b=>b.classList.toggle("active",b.dataset.zf===f));const ss=document.getElementById("zk-sup-sel");const cs=document.getElementById("zk-cat-sel");if(ss)ss.value="";if(cs)cs.value="";_zkFillSelects("","");_zkUpdateFltBadge();buildZakas();}
function setZKSup(v){zKSup=v;_zkFillSelects(v,zKCat);_zkUpdateFltBadge();buildZakas();}
function _zkFillSelects(fixSup,fixCat){
  if(!ZITEMS)return;
  const base=zKFilter==="all"?["kritik","urgent"]:[zKFilter];
  const all=ZITEMS.filter(v=>base.includes(v.signal));
  const ssel=document.getElementById("zk-sup-sel");
  const csel=document.getElementById("zk-cat-sel");
  if(ssel){
    const pool=fixCat?all.filter(v=>v.cat===fixCat):all;
    const sups=[...new Set(pool.map(v=>v.sup||"Noma'lum").filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ru"));
    const cur=ssel.value;
    ssel.innerHTML='<option value="">Suppliers</option>';
    sups.forEach(s=>{const o=document.createElement("option");o.value=s;o.textContent=s;ssel.appendChild(o);});
    if(sups.includes(cur))ssel.value=cur;
  }
  if(csel){
    const pool=fixSup?all.filter(v=>(v.sup||"Noma'lum")===fixSup):all;
    const cats=[...new Set(pool.map(v=>v.cat).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ru"));
    const cur=csel.value;
    csel.innerHTML='<option value="">Category</option>';
    cats.forEach(c=>{const o=document.createElement("option");o.value=c;o.textContent=c;csel.appendChild(o);});
    if(cats.includes(cur))csel.value=cur;
  }
}
function _zkFillSupSel(){_zkFillSelects("","");}
function _zkCalc(){
  if(!ZITEMS)return[];
  const base=zKFilter==="all"?["kritik","urgent"]:[zKFilter];
  return ZITEMS.filter(v=>base.includes(v.signal)&&(!zKSup||(v.sup||"Noma'lum")===zKSup)&&(!zKCat||v.cat===zKCat)&&(!zKQuery||(v.name||"").toLowerCase().includes(zKQuery)||(v.sku||"").toLowerCase().includes(zKQuery))).map(v=>{
    const stock=Math.max(0,v.stock||0);
    const daily=v.dailyAvg||0;
    // Tokcha minimal: oy oxirida kamida SHELF_MIN dona turishi kerak (ko'rinish + talab o'zgarishi uchun bufer)
    const SHELF_MIN=3;
    const orderQty=daily>0?Math.max(1,Math.ceil(daily*zDays+SHELF_MIN-stock)):Math.max(1,SHELF_MIN-stock);
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
    const totDona=prods.filter(p=>!p.kg).reduce((s,p)=>s+p.orderQty,0);
    const totKg=prods.filter(p=>p.kg).reduce((s,p)=>s+p.orderQty,0);
    const totTxt=(totDona>0?totDona.toLocaleString()+" sht":"")+(totDona>0&&totKg>0?" · ":"")+(totKg>0?Math.ceil(totKg)+" kg":"");
    h+=`<div class="zk-sup-block"><div class="zk-sup-name"><span>🏪 ${esc(sup)}</span><span style="color:#534AB7">${prods.length} ta mahsulot &nbsp;·&nbsp; Jami: <b>${totTxt}</b></span></div><table class="zk-ktbl"><thead><tr><th>#</th><th>Mahsulot</th><th>Kategoriya</th><th style="text-align:center">ABC</th><th style="text-align:right">Joriy stok</th><th style="text-align:right">Kunlik sotuv</th><th style="text-align:right">${zDays} kunlik zakas</th><th>Holat</th></tr></thead><tbody>`;
    prods.forEach((p,i)=>{
      const u=p.kg?"кг":"шт";
      const uStyle=p.kg?"color:#EF9F27;font-weight:700":"color:#534AB7;font-weight:700";
      const stTxt=p._stock<=0?`<span style="color:#E24B4A;font-weight:700">0</span>`:(p.kg?parseFloat(p._stock).toFixed(2):p._stock.toLocaleString());
      const dTxt=p.dailyAvg>0?(p.kg?p.dailyAvg.toFixed(2):Math.round(p.dailyAvg*10)/10)+" "+u:"—";
      const oqTxt=p.orderQty.toLocaleString()+"<span style='font-size:10px;"+uStyle+";margin-left:2px'>"+u+"</span>";
      const kgBadge=p.kg?`<span style="font-size:9px;font-weight:700;padding:1px 5px;border-radius:4px;background:#FEF3C7;color:#92400E;margin-left:5px;vertical-align:middle">KG</span>`:"";
      h+=`<tr><td style="color:#bbb;font-size:11px">${i+1}</td><td><div style="font-weight:600;white-space:normal;word-break:break-word">${esc(p.name)}${kgBadge}</div>${p.sku?`<div style="font-size:10px;color:#bbb">${esc(p.sku)}</div>`:""}</td><td style="font-size:11px;color:#888">${esc(p.cat||"—")}</td><td style="text-align:center"><span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:4px;background:${p.abc==="A"?"#e8f8f3":p.abc==="B"?"#eeebfb":"#fef3e2"};color:${p.abc==="A"?"#1D9E75":p.abc==="B"?"#534AB7":"#EF9F27"}">${p.abc||"—"}</span></td><td style="text-align:right">${stTxt}</td><td style="text-align:right;color:#777">${dTxt}</td><td style="text-align:right"><span class="zk-oq">${oqTxt}</span></td><td>${sigBadge[p.signal]||""}</td></tr>`;
    });
    h+=`</tbody></table></div>`;
  });
  document.getElementById("zk-body").innerHTML=h;
}
function exportZakasCSV(){
  const items=_zkCalc();
  const bySupp={};items.forEach(v=>{const s=v.sup||"Noma'lum";if(!bySupp[s])bySupp[s]=[];bySupp[s].push(v);});
  const q=v=>'"'+String(v==null?"":v).replace(/"/g,'""')+'"';
  let csv="﻿";
  csv+="Yetkazib beruvchi,SKU,Mahsulot,Kategoriya,ABC,O'lchov,Joriy stok,"+zDays+" kunlik zakas,Holat\r\n";
  Object.keys(bySupp).sort().forEach(sup=>{
    bySupp[sup].forEach(p=>{
      const sig=p.signal==="kritik"?"Shoshilinch zakas":"Tugashga yaqin";
      const stk=p.kg?parseFloat(p._stock||0).toFixed(2):Math.max(0,p._stock||0);
      const oq=p.orderQty||0;
      const unit=p.kg?"кг":"шт";
      csv+=`${q(sup)},${q(p.sku||"")},${q(p.name)},${q(p.cat||"")},${q(p.abc||"")},${q(unit)},${stk},${oq},${q(sig)}\r\n`;
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
async function showPage(btn){const _zb=document.getElementById("z-back");if(_zb)_zb.style.display="none";const _pb=document.getElementById("p5-back");if(_pb)_pb.style.display="none";document.querySelectorAll(".sb-item").forEach(b=>b.classList.remove("active"));btn.classList.add("active");document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));const pid=btn.dataset.page;curPageId=pid;document.getElementById(pid).classList.add("active");const _cr=document.getElementById("tb-crumb");if(_cr)_cr.textContent=btn.textContent.trim();window.scrollTo(0,0);if(pid==="p2"&&!P2){let apiData=null;if(window.TiinDataAPI){try{apiData=await window.TiinDataAPI.bootstrap();}catch(e){apiData=null;}}P2=apiData&&apiData.products?apiData.products:JSON.parse(document.getElementById("p2data").textContent);initP2(apiData);}if(pid==="p3"&&!P3){P3=JSON.parse(document.getElementById("p3data").textContent);initP3();}if(pid==="p4"&&!P4){P4=JSON.parse(document.getElementById("p4data").textContent);initP4();}
if(pid==="p5"){if(!P2){P2=JSON.parse(document.getElementById("p2data").textContent);initP2(null);}if(!ZITEMS)_buildZItems();else renderZaxira();}
if(pid==="p6"){if(!P2){P2=JSON.parse(document.getElementById("p2data").textContent);initP2(null);}if(!ZITEMS&&P2){_buildZItems();}if(!P6){P6=JSON.parse(document.getElementById("supplierdata").textContent);initP6();}}_applyPageRange(pid);};
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
  if(idx<0){const pq0=document.getElementById("pf-q");if(pq0){pq0.value=z.name;if(typeof pfQToggle==="function")pfQToggle();if(typeof p2Filter==="function")p2Filter();}const bb=document.getElementById("z-back");if(bb)bb.style.display="inline-flex";return;}
  const pq=document.getElementById("pf-q");if(pq){pq.value=P2[idx].name;if(typeof pfQToggle==="function")pfQToggle();if(typeof p2Filter==="function")p2Filter();}
  if(typeof p2Open==="function")p2Open(P2[idx]._i!=null?P2[idx]._i:idx);
  const bb=document.getElementById("z-back");if(bb)bb.style.display="inline-flex";
}
function zBack(){
  const bb=document.getElementById("z-back");if(bb)bb.style.display="none";
  const zbtn=document.querySelector('.sb-item[data-page="p5"]');
  if(zbtn)showPage(zbtn);
}
function p5Back(){
  const bb=document.getElementById("p5-back");if(bb)bb.style.display="none";
  const p2btn=document.querySelector('.sb-item[data-page="p2"]');
  if(p2btn)showPage(p2btn);
  if(p2LastI!=null){
    setTimeout(()=>{
      document.querySelectorAll('#pf-tbody tr.p2-row-sel').forEach(r=>r.classList.remove('p2-row-sel'));
      const sr=document.querySelector('#pf-tbody tr[data-pi="'+p2LastI+'"]');
      if(sr){sr.classList.add('p2-row-sel');sr.scrollIntoView({block:'center',behavior:'smooth'});}
    },80);
  }
}
async function p2ToZaxira(i){
  const v=P2&&P2[i];if(!v)return;
  const zbtn=document.querySelector('.sb-item[data-page="p5"]');
  if(zbtn)await showPage(zbtn);
  const pb=document.getElementById("p5-back");if(pb)pb.style.display="inline-flex";
  if(!ZITEMS)return;
  // Filtrlarni tozalash
  zCurFilter="all";zQuery="";zF={cat:"",sub:"",sup:"",type:"",abc:""};
  document.querySelectorAll(".z-ftab").forEach(b=>b.classList.toggle("active",b.dataset.filter==="all"));
  const zinp=document.getElementById("z-q");if(zinp)zinp.value="";
  // Mahsulotni ZITEMS dan topish
  let zi=-1;
  if(v.sku)zi=ZITEMS.findIndex(z=>String(z.sku)===String(v.sku));
  if(zi<0)zi=ZITEMS.findIndex(z=>z.name===v.name);
  if(zi<0){
    // ZITEMS da yo'q — stok ma'lumoti yo'q yoki klassifikatsiya qilinmagan
    zLastZi=null;zPage=1;renderZaxira();
    const tb=document.getElementById("z-tbody");
    if(tb)tb.innerHTML='<tr><td colspan="8" style="text-align:center;padding:30px;color:#bbb">'+esc(v.name||"")+' — Zaxira malumoti topilmadi (stok kiritilmagan bolishi mumkin)</td></tr>';
    return;
  }
  zLastZi=zi;
  // To'g'ri sahifani hisoblash
  const ord={kritik:0,urgent:1,tekshir:2,excess:3,normal:4};
  const sorted=[...ZITEMS].sort((a,b)=>{
    if(ord[a.signal]!==ord[b.signal])return ord[a.signal]-ord[b.signal];
    if(a.daysLeft!=null&&b.daysLeft!=null)return a.signal==="excess"?b.daysLeft-a.daysLeft:a.daysLeft-b.daysLeft;
    return (b.di||0)-(a.di||0);
  });
  const selIdx=sorted.findIndex(s=>s._zi===zi);
  zPage=selIdx>=0?Math.ceil((selIdx+1)/ZPS):1;
  renderZaxira();
}
// Sotuv tarixini tahlil qilib, tovarning "yaxshi sotuvchi"ligini aniqlash
const STOCK_ACTIVE_DAYS=60;  // Stock: aktiv/noaktiv ajratish chegarasi (kun)
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
  // VELOCITY: zakas miqdori har doim aqlli (ulgurjisiz) tezlikdan olinadi - max(aqlli recency,
  // retail oylik o'rtacha) - sana oralig'i tanlangan-tanlanmaganidan qat'i nazar. Aks holda
  // bitta yirik ulgurji xaridi xom o'rtachani shishirib, noto'g'ri katta zakasga olib kelardi.
  const dailyAvg=Math.max(smartDaily||0,calAvg||0);
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
    // tanlangan sana oralig'iga (30/60 kun) qarab qayta hisoblanadi - prognozni solishtirish uchun
    let smartDaily=null, calAvg=null;
    if(typeof dailyFor==="function"){const _di=dailyFor(v);if(_di&&_di.m){if(_di.m.daily!=null)smartDaily=_di.m.daily;if(_di.m.calendarAvg!=null)calAvg=_di.m.calendarAvg;}}
    if(smartDaily==null&&v.da!=null)smartDaily=v.da;
    const c=_zClassify(d,stock,smartDaily,calAvg);
    if(!c)return;
    ZITEMS.push({_zi:ZITEMS.length,name:v.name,sku:v.sku||"",abc:v.abc||"",cat:v.cat||"",sup:v.sup||"",itype:v.itype||"",sub:v.sub||"",rev:v.rev||0,kg:v.kg||false,...c});
  });
  if(INVDATA){
    const p2skus=new Set(P2.filter(v=>v.sku).map(v=>String(v.sku)));
    const p2norms=new Set(P2.map(v=>nn2(v.name)));
    let mzCap=0;
    const _endRef=(DMETAFULL&&DMETAFULL.end)?new Date(DMETAFULL.end):new Date();
    Object.entries(INVDATA).forEach(([key,iv])=>{
      if(iv.sku&&p2skus.has(String(iv.sku)))return;
      if(p2norms.has(key))return;
      const stock=parseFloat(iv.a||0);if(stock<=0)return;
      const price=parseFloat(iv.sp||iv.p||0);const frozenVal=Math.round(stock*price);
      if(iv.ld60){
        // So'nggi 30 kunda emas, lekin 60 kunlik oynada sotilgan — "aktiv" tarafda, sekinlashgan
        const di60=Math.max(0,Math.round((_endRef-new Date(iv.ld60))/86400000));
        ZITEMS.push({_zi:ZITEMS.length,name:key,sku:iv.sku||"",abc:"",cat:"",sup:iv.su||"",itype:iv.t||"",sub:iv.sb||"",rev:0,signal:"sekin",reason:"So'nggi 30 kunda sotilmagan, "+di60+" kun oldin sotilgan — sekinlashgan, kuzating",di:di60,dailyAvg:0,daysLeft:null,stock,wasGoodSeller:false,histRatio:0,frozenVal,price});
        return;
      }
      ZITEMS.push({_zi:ZITEMS.length,name:key,sku:iv.sku||"",abc:"",cat:"",sup:iv.su||"",itype:iv.t||"",sub:iv.sb||"",rev:0,signal:"muzlagan",reason:STOCK_ACTIVE_DAYS+" kun ichida sotuv yo'q",di:999,dailyAvg:0,daysLeft:null,stock,wasGoodSeller:false,histRatio:0,frozenVal,price});
      mzCap+=frozenVal;
    });
    const fvEl=document.getElementById("z-frozen-val");
    if(fvEl){fvEl.textContent=Math.round(mzCap).toLocaleString();}
    const fvBnr=document.getElementById("z-mz-total");if(fvBnr){fvBnr.textContent=Math.round(mzCap).toLocaleString()+" so'm";}
    const fvBnr2=document.getElementById("z-mz-total2");if(fvBnr2){fvBnr2.textContent=Math.round(mzCap).toLocaleString()+" so'm";}
    // Supplier va kategoriya bo'yicha muzlagan kapital
    const mzItems=ZITEMS.filter(v=>v.signal==="muzlagan"&&v.frozenVal>0);
    const supMap={},catMap={};
    mzItems.forEach(v=>{
      const s=v.sup||"Noma'lum";supMap[s]=(supMap[s]||0)+v.frozenVal;
      const c=v.sub||"Noma'lum";catMap[c]=(catMap[c]||0)+v.frozenVal;
    });
    const top5=(obj)=>Object.entries(obj).sort((a,b)=>b[1]-a[1]).slice(0,5);
    const barHtml=(entries,total)=>entries.map(([nm,val])=>{
      const pct=Math.round(val/total*100);
      const vStr=val>=1e9?(val/1e9).toFixed(2)+" mlrd":Math.round(val/1e6)+" mln";
      const shortNm=nm.length>28?nm.slice(0,26)+"…":nm;
      return `<div style="margin-bottom:6px"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px"><span style="color:#374151;font-weight:500">${shortNm}</span><span style="color:#7C3AED;font-weight:700">${vStr}</span></div><div style="height:5px;background:#ede9fe;border-radius:3px"><div style="height:100%;width:${pct}%;background:#7C3AED;border-radius:3px"></div></div></div>`;
    }).join("");
    const catEl=document.getElementById("z-mz-cat-list");
    if(catEl)catEl.innerHTML=barHtml(top5(catMap),mzCap);
  }
  const cnt={kritik:0,tekshir:0,urgent:0,excess:0,normal:0,sekin:0,muzlagan:0};
  ZITEMS.forEach(v=>{if(cnt[v.signal]!==undefined)cnt[v.signal]++;});
  const s=(id,n)=>{const el=document.getElementById(id);if(el)el.textContent=n.toLocaleString();};
  s("z-n-kritik",cnt.kritik);s("z-n-tekshir",cnt.tekshir);s("z-n-urgent",cnt.urgent);s("z-n-excess",cnt.excess);s("z-n-normal",cnt.normal);s("z-n-sekin",cnt.sekin);s("z-n-muzlagan",cnt.muzlagan);
  const bnr=document.getElementById("z-mz-cnt");if(bnr)bnr.textContent=cnt.muzlagan.toLocaleString();
  const ntab=document.getElementById("z-noaktiv-cnt");if(ntab)ntab.textContent="("+cnt.muzlagan.toLocaleString()+")";
  zFilled=false;zFillSelects();
}
function zSuperTab(tab){
  zFilter(tab==="noaktiv"?"muzlagan":"all");
}
function zFilter(f){
  zCurFilter=f;
  zPage=1;
  const wantTab=f==="muzlagan"?"noaktiv":"aktiv";
  if(wantTab!==zSuperTabCur){
    zSuperTabCur=wantTab;
    document.querySelectorAll(".z-stab").forEach(b=>b.classList.toggle("active",b.dataset.stab===wantTab));
    const aSec=document.getElementById("z-aktiv-section");if(aSec)aSec.style.display=wantTab==="aktiv"?"":"none";
    const nSec=document.getElementById("z-noaktiv-section");if(nSec)nSec.style.display=wantTab==="noaktiv"?"":"none";
    const ft=document.getElementById("z-filter-tabs-aktiv");if(ft)ft.style.display=wantTab==="aktiv"?"":"none";
  }
  document.querySelectorAll(".z-ftab").forEach(b=>b.classList.toggle("active",b.dataset.filter===f));
  document.querySelectorAll(".z-card").forEach(c=>c.classList.remove("z-selected"));
  if(f!=="all"){const el=document.getElementById("zc-"+f);if(el)el.classList.add("z-selected");}
  const bnr=document.getElementById("z-mz-banner");if(bnr)bnr.style.display=f==="muzlagan"?"flex":"none";
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
function zCatChanged(){
  const cat=document.getElementById("zf-cat").value;
  const sel=document.getElementById("zf-sub");
  if(!sel)return;
  while(sel.options.length>1)sel.remove(1);
  sel.value="";
  if(ZITEMS){
    const items=cat?ZITEMS.filter(v=>v.cat===cat):ZITEMS;
    const subs=[...new Set(items.map(v=>v.sub).filter(x=>x))].sort((a,b)=>String(a).localeCompare(String(b),"ru"));
    subs.forEach(v=>{const o=document.createElement("option");o.value=v;o.textContent=v;sel.appendChild(o);});
  }
  zFApply();
}
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
  let items=zCurFilter==="all"?ZITEMS.filter(v=>v.signal!=="muzlagan"):ZITEMS.filter(v=>v.signal===zCurFilter);
  if(zQuery){items=items.filter(v=>(v.name&&v.name.toLowerCase().includes(zQuery))||(v.sku&&String(v.sku).toLowerCase().includes(zQuery)));}
  if(zF.cat) items=items.filter(v=>v.cat===zF.cat);
  if(zF.sub) items=items.filter(v=>v.sub===zF.sub);
  if(zF.sup) items=items.filter(v=>v.sup===zF.sup);
  if(zF.type)items=items.filter(v=>v.itype===zF.type);
  if(zF.abc) items=items.filter(v=>v.abc===zF.abc);
  const ord={kritik:0,urgent:1,tekshir:2,excess:3,normal:4,sekin:5,muzlagan:6};
  items.sort((a,b)=>{
    if(ord[a.signal]!==ord[b.signal])return ord[a.signal]-ord[b.signal];
    if(a.signal==="muzlagan"||a.signal==="sekin")return (b.frozenVal||0)-(a.frozenVal||0)||(b.di||0)-(a.di||0);
    // Ortiqcha: eng uzun muddatli (eng ko'p stok) birinchi; qolganlar: eng qisqa muddatli birinchi
    if(a.daysLeft!=null&&b.daysLeft!=null)return a.signal==="excess"?b.daysLeft-a.daysLeft:a.daysLeft-b.daysLeft;
    return (b.di||0)-(a.di||0);
  });
  const el=document.getElementById("z-cnt");if(el)el.textContent=items.length.toLocaleString()+" ta mahsulot";
  const _frozenView=zCurFilter==="muzlagan"||zCurFilter==="sekin";
  const thDays=document.querySelector(".z-tbl thead th:nth-child(6)");if(thDays)thDays.textContent=_frozenView?"Stok qiymati":"Kunga yetadi";
  const thAvg=document.querySelector(".z-tbl thead th:nth-child(5)");if(thAvg)thAvg.textContent=_frozenView?"Narx (1 dona)":"Kunlik o'rtacha";
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
    if(v.signal==="muzlagan"||v.signal==="sekin"){
      const fv=v.frozenVal||0;const m=fv/1e6;
      const fStr=m>=1000?(+(m/1000).toFixed(2)).toLocaleString()+" mlrd so'm":m>=1?(+m.toFixed(1)).toLocaleString()+" mln so'm":fv.toLocaleString()+" so'm";
      const fc=v.signal==="sekin"?"#0E7490":"#7C3AED";
      barHtml=`<div style="color:${fc};font-weight:700;font-size:13px">${fStr}</div>`;
    }else if(v.stock===0||v.daysLeft===0){
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
    const diTxt=v.signal==="muzlagan"?(STOCK_ACTIVE_DAYS+" kunda sotilmagan"):v.signal==="sekin"?(v.di+" kun oldin sotilgan"):v.di>=900?"Sotilmagan":v.di===0?"Bugun":v.di+" kun oldin";
    const diColor=v.signal==="muzlagan"?"#7C3AED":v.signal==="sekin"?"#0E7490":v.di>=30?"#E24B4A":v.di>=14?"#EF9F27":"#555";
    const sigMap={kritik:["z-sig-kritik","Shoshilinch zakas"],tekshir:["z-sig-tekshir","Tekshirish"],urgent:["z-sig-urgent","Tugashga yaqin"],excess:["z-sig-excess","Ortiqcha"],normal:["z-sig-normal","Normal"],sekin:["z-sig-sekin","🐢 Sekin"],muzlagan:["z-sig-muzlagan","💤 Muzlagan"]};
    const[sigCls,sigTxt]=sigMap[v.signal]||["",""];
    const dailyTxt=(v.signal==="muzlagan"||v.signal==="sekin")?(v.price?(v.price.toLocaleString()+" so'm"):"—"):v.dailyAvg>0?(v.dailyAvg>=1?(Math.round(v.dailyAvg*10)/10):v.dailyAvg)+" ta/kun":"—";
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
const P1WD_BY_LANG={uz:["Dush","Sesh","Chor","Pay","Jum","Shan","Yak"],en:["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],ru:["Пн","Вт","Ср","Чт","Пт","Сб","Вс"]};
let _p1c={};
function renderP1(){
if(!P1||!P1.daily||!P1.daily.length){return;}
applyI18n();
const setT=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
const setH=(id,v)=>{const e=document.getElementById(id);if(e)e.innerHTML=v;};
const kpiV=n=>Math.round(n).toLocaleString();
const _fd=s=>{if(!s)return"";const p=s.split("-");return p.length===3?p[2]+"."+p[1]+"."+p[0]:s;};
setT("p1-period",_fd(P1.start)+" — "+_fd(P1.end)+" · "+(P1.days||0)+" "+t("kunlik_malumot"));
setT("nav-period-r",_fd(P1.start)+" – "+_fd(P1.end));
setT("p1-daily-hint",(P1.days||0)+" "+t("kunlik_malumot")+", mln UZS");
setH("kpi-gross",kpiV(P1.gross||0));
setT("kpi-rec",(P1.receipts||0).toLocaleString());
setT("kpi-avg",(P1.cost||0).toLocaleString());
setT("kpi-sku",(P1.sku||0).toLocaleString());
setH("kpi-refund",(P1.refund_pct||0)+'<span class="kpi-u">%</span>');
setT("kpi-refund-s",Math.round(P1.refund||0).toLocaleString()+" "+t("kpi_refund_s_suffix"));
setT("kpi-staff",(P1.profit||0).toLocaleString());
setT("last-updated-val",(P1FULL&&P1FULL.builtAt)||"—");
const bd=P1.best_day||{},wd=P1.worst_day||{};
setT("p1-daily-insight",t("eng_yuqori")+": "+(bd.label||"-")+"-"+t("in_kun")+" — "+fmt(bd.val||0)+" UZS · "+t("eng_past")+": "+(wd.label||"-")+"-"+t("in_kun")+" — "+fmt(wd.val||0)+" UZS");
const wk=P1.weekly||[];
const WDF=WEEKDAYS_FULL[LANG]||WEEKDAYS_FULL.uz;
if(wk.length){let mxi=0,mni=0;wk.forEach((w,i)=>{if(w.val>wk[mxi].val)mxi=i;if(w.val<wk[mni].val)mni=i;});setT("p1-week-insight",t("eng_kuchli")+": "+(WDF[mxi]||wk[mxi].day)+" ("+fmt(wk[mxi].val)+") · "+t("eng_zaif")+": "+(WDF[mni]||wk[mni].day)+" ("+fmt(wk[mni].val)+")");}
const ab=P1.abc||{};const tot=(ab.a_rev||0)+(ab.b_rev||0)+(ab.c_rev||0);const cpct=tot?Math.round((ab.c_rev||0)/tot*100):0;
setT("p1-abc-insight","C "+t("guruh")+": "+(ab.c_count||0).toLocaleString()+" "+t("ta_mahsulot")+" — "+t("faqat")+" "+cpct+"% "+t("tushum_lc")+", "+t("lekin")+" "+(P1.c_assort_pct||0)+"% "+t("assortiment"));
const ti=P1.top_items||[];
const _kelish=LANG==="en"?"cost":LANG==="ru"?"себестоимость":"kelish";
const _foyda=LANG==="en"?"profit":LANG==="ru"?"прибыль":"foyda";
const _tushum=LANG==="en"?"revenue":LANG==="ru"?"выручка":"tushum";
setH("p1-top-items",ti.map((it,i)=>'<div class="rank-row"><div class="rank-n'+(i===0?" top":"")+'">'+(i+1)+'</div><div class="rank-name">'+esc(it.name)+'<span class="rank-sub"> · '+_kelish+': '+fmt(it.cost||0)+' · '+_foyda+': '+fmt(it.profit||0)+'</span></div><div class="rank-val">'+fmt(it.val)+'</div></div>').join(""));
const tp=P1.top_items_profit||[];
setH("p1-top-emp",tp.map((it,i)=>'<div class="rank-row"><div class="rank-n'+(i===0?" top":"")+'">'+(i+1)+'</div><div class="rank-name">'+esc(it.name)+'<span class="rank-sub"> · '+_tushum+': '+fmt(it.rev||0)+' · '+_kelish+': '+fmt(it.cost||0)+'</span></div><div class="rank-val">'+fmt(it.val)+'</div></div>').join(""));
Object.values(_p1c).forEach(c=>{try{c.destroy();}catch(e){}});
const dv=P1.daily.map(v=>v/1e6);
const _dcv=document.getElementById("dailyChart");const _dctx=_dcv.getContext("2d");const _grad=_dctx.createLinearGradient(0,0,0,250);_grad.addColorStop(0,"rgba(59,130,246,0.32)");_grad.addColorStop(1,"rgba(59,130,246,0.01)");
_p1c.daily=new Chart(_dcv,{type:"line",data:{labels:P1.dayLabels||P1.daily.map((_,i)=>i+1),datasets:[{data:dv,borderColor:"#2563EB",borderWidth:2.5,backgroundColor:_grad,fill:true,tension:0.4,pointRadius:0,pointHoverRadius:5,pointHoverBackgroundColor:"#2563EB",pointHoverBorderColor:"#fff",pointHoverBorderWidth:2}]},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:"index",intersect:false},hover:{mode:"index",intersect:false},plugins:{legend:{display:false},tooltip:{mode:"index",intersect:false,callbacks:{title:items=>(items[0].label)+"-"+t("in_kun"),label:c=>c.parsed.y.toFixed(1)+" mln UZS"}}},scales:{x:{grid:{display:false},ticks:{font:{size:9},maxTicksLimit:16}},y:{grid:{color:"rgba(0,0,0,0.05)"},ticks:{font:{size:9},callback:v=>v+" mln"}}}}});
const cats=P1.top_cats||[];const cv=cats.map(c=>c.val/1e6);
_p1c.cat=new Chart(document.getElementById("catChart"),{type:"bar",data:{labels:cats.map(c=>c.name),datasets:[{data:cv,backgroundColor:"rgba(37,99,235,0.78)",borderRadius:4,borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,indexAxis:"y",plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>c.parsed.x.toFixed(0)+" mln UZS"}}},scales:{x:{grid:{color:"rgba(0,0,0,0.05)"},ticks:{font:{size:8},callback:v=>v+" mln"}},y:{grid:{display:false},ticks:{font:{size:9}}}}}});
const wv=(P1.weekly||[]).map(w=>w.val/1e6);const wmax=Math.max(...wv),wmin=Math.min(...wv);
_p1c.week=new Chart(document.getElementById("weekChart"),{type:"bar",data:{labels:P1WD_BY_LANG[LANG]||P1WD_BY_LANG.uz,datasets:[{data:wv,backgroundColor:wv.map(v=>v===wmax?"#2563EB":v===wmin?"#F87171":"rgba(37,99,235,0.4)"),borderRadius:4,borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>c.parsed.y.toFixed(0)+" mln UZS"}}},scales:{x:{grid:{display:false},ticks:{font:{size:9}}},y:{grid:{color:"rgba(0,0,0,0.05)"},ticks:{font:{size:9},callback:v=>v+" mln"}}}}});
const ab2=P1.abc||{};const at=(ab2.a_rev||0)+(ab2.b_rev||0)+(ab2.c_rev||0)||1;
const ABC_LABELS={uz:["A - Lider","B - Potentsial","C - Aylanmada"],en:["A - Leader","B - Potential","C - Slow-moving"],ru:["A - Лидер","B - Потенциал","C - Медленный"]};
_p1c.abc=new Chart(document.getElementById("abcChart"),{type:"doughnut",data:{labels:ABC_LABELS[LANG]||ABC_LABELS.uz,datasets:[{data:[(ab2.a_rev||0)/at*100,(ab2.b_rev||0)/at*100,(ab2.c_rev||0)/at*100],backgroundColor:["#1D9E75","#EF9F27","#E24B4A"],borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,cutout:"58%",plugins:{legend:{position:"right",labels:{font:{size:10},boxWidth:10,padding:8}},tooltip:{callbacks:{label:c=>c.label+": "+c.parsed.toFixed(1)+"%"}}}}});
}
document.querySelectorAll(".lang-btn").forEach(b=>b.classList.toggle("active",b.dataset.lang===LANG));
applyI18n();
renderP1();
curPageId="p1";if(P1FULL&&P1FULL.days>1)_applyPageRange("p1");  // har bo'lim o'z standart oralig'i: Bosh sahifa 7 kun, qolganlari 30 kun
// ── Sana oralig'i (date-range) ──
function dtToggle(e){if(e)e.stopPropagation();const p=document.getElementById("dt-pop");if(p)p.classList.toggle("open");}
document.addEventListener("click",function(e){const w=document.querySelector(".tb-dt");const p=document.getElementById("dt-pop");if(w&&p&&!w.contains(e.target))p.classList.remove("open");});
function _dtIdx(iso){return (P1FULL.dates||[]).indexOf(iso);}
function dtPreset(kind){const n=P1FULL.days;let a,b=n-1;if(kind==="all"){a=0;}else{a=Math.max(0,n-(+kind));}_dtApplyRange(a,b);const p=document.getElementById("dt-pop");if(p)p.classList.remove("open");}
function dtApply(){const s=document.getElementById("dt-start").value,e=document.getElementById("dt-end").value;let a=s?_dtIdx(s):0,b=e?_dtIdx(e):P1FULL.days-1;if(a<0)a=0;if(b<0)b=P1FULL.days-1;if(a>b){const t=a;a=b;b=t;}_dtApplyRange(a,b);const p=document.getElementById("dt-pop");if(p)p.classList.remove("open");}
function _pageDefaultRange(pid){const n=P1FULL?P1FULL.days:0;const days=PAGE_DEFAULT_DAYS[pid]||30;return [Math.max(0,n-days),n-1];}
function _applyPageRange(pid){if(!P1FULL)return;const r=pageRanges[pid]||_pageDefaultRange(pid);if(r[0]!==GRA||r[1]!==GRB)_dtApplyRange(r[0],r[1]);}
function _dtApplyRange(a,b){
const full=(a===0&&b===P1FULL.days-1);
GRA=a;GRB=b;
if(curPageId)pageRanges[curPageId]=[a,b];
P1=full?P1FULL:buildRangedP1(P1FULL,a,b);
_winDaily();
renderP1();
if(P2){_winArr(P2);if(typeof p2Filter==='function')p2Filter();if(Number.isInteger(window.p2ActiveIndex))renderP2(window.p2ActiveIndex);}
if(P3&&typeof initP3==='function'){initP3();}
if(ZITEMS!==null){_buildZItems();renderZaxira();}
const st=document.getElementById("dt-start"),en=document.getElementById("dt-end");if(st&&P1FULL.dates){st.value=P1FULL.dates[a];en.value=P1FULL.dates[b];}
const nt=document.getElementById("dt-note");if(nt)nt.textContent=full?t("dt_note_full"):t("dt_note_range");
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
const cost=rsum(F.dailyCost);
const profit=gross-cost;
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
const itemsRanged=(F.itemsDaily||[]).map(it=>{
  const rev=it.d.slice(a,b+1).reduce((x,y)=>x+(y||0),0);
  const c=(it.c||[]).slice(a,b+1).reduce((x,y)=>x+(y||0),0);
  return{name:it.name,rev:Math.round(rev),cost:Math.round(c),profit:Math.round(rev-c),hc:!!it.hc};
});
const top_items=itemsRanged.filter(it=>it.rev>0).sort((x,y)=>y.rev-x.rev).slice(0,8).map(it=>({name:it.name,val:it.rev,cost:it.cost,profit:it.profit}));
// faqat kelish narxi ma'lum bo'lgan mahsulotlar - aks holda noma'lum tannarx 0
// deb olinib, sun'iy "100% foyda" bo'lib chiqib qoladi
const top_items_profit=itemsRanged.filter(it=>it.hc).sort((x,y)=>y.profit-x.profit).slice(0,8).map(it=>({name:it.name,val:it.profit,rev:it.rev,cost:it.cost}));
const staff=Object.entries(F.empDaily||{}).filter(([n,arr])=>arr.slice(a,b+1).reduce((x,y)=>x+(y||0),0)>0&&n!=="Noma'lum").length;
const _f=s=>{if(!s)return"";const p=s.split("-");return p.length===3?p[2]+"."+p[1]:s;};
return{title:_f(dates[0])+" – "+_f(dates[days-1]),periodText:_f(dates[0])+" – "+_f(dates[days-1])+" · "+days+" kunlik oraliq",days:days,start:dates[0],end:dates[days-1],gross:Math.round(gross),cost:Math.round(cost),profit:Math.round(profit),refund:Math.round(refund),refund_pct:gross?Math.round(refund/gross*10000)/100:0,receipts:recs,avg_check:recs?Math.round(gross/recs):0,sku:F.sku,staff:staff||F.staff,daily:daily,dayLabels:dayLabels,weekly:weekly_out,top_cats:top_cats,top_emp:top_emp,top_items:top_items,top_items_profit:top_items_profit,abc:F.abc,c_assort_pct:F.c_assort_pct,best_day:{idx:bi,label:dayLabels[bi],val:Math.round(daily[bi])},worst_day:{idx:wi,label:dayLabels[wi],val:Math.round(daily[wi])}};
}
(function dtInit(){const st=document.getElementById("dt-start"),en=document.getElementById("dt-end");if(st&&en&&P1FULL.dates&&P1FULL.dates.length){const f=P1FULL.dates[0],l=P1FULL.dates[P1FULL.dates.length-1];st.min=f;st.max=l;st.value=f;en.min=f;en.max=l;en.value=l;}})();
const ADESC={"A":"A guruh - tushumning 80 foizini taminlaydi. Eng muhim mahsulot, stokdan chiqmasin!","B":"B guruh - tushumning 15 foizini taminlaydi. Orta muhimlik, promo bilan kuchaytiring.","C":"C guruh - tushumning 5 foizini taminlaydi. Kam sotiladi, assortimentni korib chiqing."};
const AS={"A":["#E1F5EE","#085041","A guruh","abc-A-d"],"B":["#FAEEDA","#633806","B guruh","abc-B-d"],"C":["#FCEBEB","#501313","C guruh","abc-C-d"]};
const DATES=["01","02","03","04","05","06","07","08","09","10","11","12","13","14","15","16","17","18","19","20","21","22","23","24","25","26","27","28","29","30","31"];
let p2page=1,P2PS=50,p2rows=[];
function nn2(s){return String(s||"").replace(/\s+/g," ").trim().toLowerCase();}function dailyFor(v){if(!DAILY||!v)return null;const skuKey=v.sku&&DSKU?DSKU["sku:"+String(v.sku)]:null;const nameKey=DNAME?DNAME[nn2(v.name)]:null;return DAILY[skuKey]||DAILY[nameKey]||DAILY[nn2(v.name)]||null;}
function initP2(apiData){try{const _dp=apiData&&apiData.demand?apiData.demand:JSON.parse(document.getElementById("dailydata").textContent);DAILYFULL=_dp.items;DSKU=_dp.skuAliases||{};DNAME=_dp.nameAliases||{};DMETAFULL=_dp.__meta__;_winDaily();const ph=document.getElementById("p2-period");if(ph)ph.textContent=(DMETA.title||"")+" · "+DMETA.days+" kun";}catch(e){DAILY=null;DSKU={};DNAME={};DMETA=null;}const INV=apiData&&apiData.inventory?apiData.inventory:JSON.parse(document.getElementById("invdata").textContent);INVDATA=INV;JSON.parse(document.getElementById("invdata").textContent);const invKeys=Object.keys(INV);P2.forEach((v,i)=>{v._i=i;const norm=nn2(v.name);let iv=INV[norm];if(!iv){const pk=invKeys.find(k=>k.startsWith(norm));if(pk)iv=INV[pk];}if(iv){v.sku=iv.sku;v.iprice=iv.p;v.suprice=iv.sp;v.amt=iv.a;v.itype=iv.t;v.sub=iv.sb;v.sup=iv.su;}});if(_rangeActive())_winArr(P2);p2FillCat();p2Filter();}
const P2FF=[{id:"pf-sub",k:v=>v.sub},{id:"pf-type",k:v=>v.itype},{id:"pf-sup",k:v=>v.sup}];
function p2FillCat(){const opts=[...new Set(P2.map(v=>v.cat).filter(x=>x))].sort((a,b)=>String(a).localeCompare(String(b),"ru"));const sel=document.getElementById("pf-cat");opts.forEach(v=>{const o=document.createElement("option");o.value=v;o.textContent=v;sel.appendChild(o);});}
function p2Match(v,skip){const fc=p2gv("pf-cat"),fs=p2gv("pf-sub"),ft=p2gv("pf-type"),fp=p2gv("pf-sup"),fa=p2gv("pf-amt"),fb=p2gv("pf-abc");if(skip!=="pf-cat"&&fc&&v.cat!==fc)return false;if(skip!=="pf-sub"&&fs&&v.sub!==fs)return false;if(skip!=="pf-type"&&ft&&v.itype!==ft)return false;if(skip!=="pf-sup"&&fp&&v.sup!==fp)return false;if(skip!=="pf-abc"&&fb&&v.abc!==fb)return false;if(skip!=="pf-amt"&&fa){const a=v.amt;if(a===undefined)return false;if(fa==="pos"&&!(a>0))return false;if(fa==="zero"&&a!==0)return false;if(fa==="neg"&&!(a<0))return false;}return true;}
function p2UniqWhere(kf,skip){const s=new Set();P2.forEach(v=>{if(p2Match(v,skip)){const x=kf(v);if(x)s.add(x);}});return [...s].sort((a,b)=>String(a).localeCompare(String(b),"ru"));}
function p2RebuildSel(id,opts,cur){const sel=document.getElementById(id);sel.innerHTML="";const o0=document.createElement("option");o0.value="";o0.textContent="Barchasi";sel.appendChild(o0);opts.forEach(v=>{const o=document.createElement("option");o.value=v;o.textContent=v;sel.appendChild(o);});sel.value=(cur&&opts.includes(cur))?cur:"";sel.className=sel.value?"on":"";}
function p2gv(id){return document.getElementById(id).value;}
function p2Filter(){P2FF.forEach(f=>{const cur=p2gv(f.id);const opts=p2UniqWhere(f.k,f.id);p2RebuildSel(f.id,opts,cur);});["pf-cat","pf-amt","pf-abc"].forEach(id=>{const e=document.getElementById(id);e.className=e.value?"on":"";});const q=document.getElementById("pf-q").value.trim().toLowerCase();p2rows=P2.filter(v=>{if(!v.sku)return false;if(_rangeActive()&&(v.qty||0)<=0)return false;if(!p2Match(v,null))return false;if(q&&!v.name.toLowerCase().includes(q)&&!String(v.sku||"").includes(q))return false;return true;});p2page=1;document.getElementById("pf-cnt").textContent=p2rows.length.toLocaleString()+" ta mahsulot";renderP2Table();}
function renderP2Table(){const tb=document.getElementById("pf-tbody");const ro=(p2page-1)*P2PS;const pg=p2rows.slice(ro,ro+P2PS);if(!pg.length){tb.innerHTML='<tr><td colspan="9" style="text-align:center;padding:34px;color:#bbb">Mahsulot topilmadi &mdash; filtrlarni o\'zgartiring</td></tr>';document.getElementById("pf-pag").innerHTML="";return;}const END=new Date((DMETA&&DMETA.end)?DMETA.end:'2026-05-31');let h="";pg.forEach((v,i)=>{const abc=v.abc||"";let di=v.di;if(di===undefined||di===null){if(v.ld){const d=new Date(v.ld);di=Math.max(0,Math.round((END-d)/86400000));}else{di=999;}}const[sc,stTxt]=sotuv(di);const price=v.iprice||0;const suprice=v.suprice||0;const priceCell=price?price.toLocaleString()+" so'm"+(suprice?'<div style="font-size:10px;color:#999;margin-top:1px">kelish: '+suprice.toLocaleString()+" so'm</div>":""):"—";h+=`<tr data-pi="${v._i}" onclick="p2RowClick(${v._i})" title="Ikki marta bosing — Zaxirada koʻrish"><td style="color:#bbb">${ro+i+1}</td><td style="max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600" title="${esc(v.name)}">${esc(v.name)}${v.kg&&!v.name.toLowerCase().includes('kg')?' <span class="sug-kg">KG</span>':''}</td><td style="color:#999">${v.sku||"—"}</td><td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#777" title="${esc(v.cat||"")}">${esc(v.cat||"—")}</td><td style="color:#888;white-space:nowrap">${esc(v.itype||"—")}</td><td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#888" title="${esc(v.sup||"")}">${esc(v.sup||"—")}</td><td style="white-space:nowrap">${priceCell}</td><td><span class="badge ${sc}">${stTxt}</span></td><td>${abc?'<span class="p2-abc p2-abc-'+abc+'">'+abc+'</span>':'—'}</td></tr>`;});tb.innerHTML=h;renderP2Pag();}
function renderP2Pag(){const tot=Math.ceil(p2rows.length/P2PS);const pag=document.getElementById("pf-pag");if(tot<=1){pag.innerHTML="";return;}let h="";const mk=(l,p,d,a)=>`<button ${d?"disabled":""} ${a?'class="active"':""} onclick="p2Go(${p})">${l}</button>`;h+=mk("‹",p2page-1,p2page<=1,false);let s=Math.max(1,p2page-2),e=Math.min(tot,p2page+2);if(s>1){h+=mk("1",1,false,p2page===1);if(s>2)h+='<button disabled>…</button>';}for(let p=s;p<=e;p++)h+=mk(p,p,false,p===p2page);if(e<tot){if(e<tot-1)h+='<button disabled>…</button>';h+=mk(tot,tot,false,p2page===tot);}h+=mk("›",p2page+1,p2page>=tot,false);pag.innerHTML=h;}
function p2Go(p){p2page=p;renderP2Table();const sc=document.querySelector(".p2-tbl-scroll");if(sc)sc.scrollTop=0;}
let p2ClickTimer=null;
function p2RowClick(i){
  if(p2ClickTimer){clearTimeout(p2ClickTimer);p2ClickTimer=null;p2ToZaxira(i);return;}
  p2ClickTimer=setTimeout(()=>{p2ClickTimer=null;p2Open(i);},260);
}
function p2Open(i){
  p2LastI=i;
  renderP2(i);
  document.getElementById("p2graphs").style.display="";
  window.scrollTo({top:0,behavior:"smooth"});
  document.querySelectorAll('#pf-tbody tr.p2-row-sel').forEach(r=>r.classList.remove('p2-row-sel'));
  const sr=document.querySelector('#pf-tbody tr[data-pi="'+i+'"]');
  if(sr){sr.classList.add('p2-row-sel');setTimeout(()=>sr.scrollIntoView({block:'nearest',behavior:'smooth'}),50);}
}
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
  // Prognoz/grafik tanlangan sana-oralig'iga (window) moslashadi - kunlik o'rtacha
  // o'sha oraliqdan olinadi (dailyFor). Shu bilan grafik, prognoz va zakas hisobi
  // hammasi bir xil tanlangan davrga tayanadi.
  const dl=dailyFor(v);
  const dd=dl?dl.q:(v.d||[]);
  const dr=dl?dl.r:null;
  const drr=dl?dl.rr:null;
  const dwr=dl?dl.wr:null;
  const dw=dl?dl.w:null;
  const dwi=dl?dl.wi:null;
  const dwe=dl?dl.we:null;
  const dwri=dl?dl.wri:null;
  const dwre=dl?dl.wre:null;
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
    wholesalePct:tz.total?tz.weSum/tz.total*100:0,
    recurringWholesale:tz.wiSum,
    oneoffWholesale:tz.weSum,
    trend:"stable"
  };
  const pureRetailSum=tz.pureRetail?tz.pureRetail.reduce((a,b)=>a+b,0):tz.retailMonth;
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
  const recurringNote=m.recurringWholesale>0
    ?(fmtQty(m.recurringWholesale)+" "+u+" "+(m.recurringReceipts||0)+" ta chekda takrorlanuvchi ulgurji aniqlandi"
      +(customerText?" ("+esc(customerText)+")":"")+" — bular doimiy mijoz hisoblanib, zakas hisobiga qo'shildi.")
    :"";
  const oneoffNote=m.oneoffWholesale>0
    ?(fmtQty(m.oneoffWholesale)+" "+u+" "+(m.oneoffReceipts||0)+" ta chekda mahsulotning odatiy savdosidan favqulodda katta (yoki faqat bir marta uchragan) xarid — zakas hisobidan chiqarib tashlandi (overstock oldini olish uchun).")
    :"";
  const separationReason=(recurringNote||oneoffNote)
    ?[recurringNote,oneoffNote].filter(Boolean).join(" ")
    :("Jami "+m.totalReceipts+" chek, o'rtacha "+fmtQty(receiptAvg)+" "+u+
      "/chek. Bu mahsulotning odatiy P90 ko'rsatkichi "+fmtQty(m.receiptP90)+" "+u+
      "/chek bo'lgani uchun savdo retailda qoldirildi.");
  let lastSaleIndex=-1;
  for(let day=dd.length-1;day>=0;day--){
    if(dd[day]>0){lastSaleIndex=day;break;}
  }
  const lastSaleDate=lastSaleIndex>=0&&DMETA&&DMETA.labels
    ?DMETA.labels[lastSaleIndex]
    :(v.ld||"-");
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

  const basket=v.b||[];
  document.getElementById("bcnt").textContent=basket.length+" ta";
  document.getElementById("blist").innerHTML=basket.length
    ?basket.map((x,i)=>'<div class="prod-row"><div class="pn">'+(i+1)+'</div><div class="pname">'+esc(x.n)+'</div><div class="pbar-w"><div class="pbar" style="width:'+Math.min(100,x.c)+'%;background:#1D9E75"></div></div><div class="ppct">'+x.c+'%</div></div>').join("")
    :'<div class="empty"><div class="empty-txt">Birga sotilgan mahsulot topilmadi</div></div>';

  document.getElementById("dstats").innerHTML=
    '<div class="stat-grid">'+
      '<div class="sbox tz-sbox"><div class="slbl">'+primaryLabel+'</div><div class="sval">'+primaryDisplay+' '+u+'</div></div>'+
      '<div class="sbox"><div class="slbl">'+horizon+' kunlik ehtiyoj</div><div class="sval">'+demandDisplay+' '+u+'</div></div>'+
      '<div class="sbox"><div class="slbl">Sof retail</div><div class="sval">'+fmtQty(pureRetailSum)+' '+u+'</div></div>'+
      '<div class="sbox" style="border-left:3px solid #EF9F27"><div class="slbl">Doimiy ulgurji (zakasga qo\'shildi)</div><div class="sval">'+fmtQty(tz.wiSum)+' '+u+'</div></div>'+
      '<div class="sbox" style="border-left:3px solid #E24B4A"><div class="slbl">Bir martalik ulgurji (chiqarildi)</div><div class="sval">'+fmtQty(tz.weSum)+' '+u+'</div></div>'+
      '<div class="sbox" style="grid-column:1/-1;background:#F8FAFC;border:1px solid #E2E8F0;"><div class="slbl">'+dd.length+' kunlik savdo</div><div class="sval">'+fmt(m.revenue||0)+' UZS · '+fmtQty(m.totalSold)+' '+u+'</div></div>'+
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
      {label:"Retail — odatiy savdo",data:tz.pureRetail||new Array(dd.length).fill(0),backgroundColor:"rgba(29,158,117,.72)",borderRadius:3,stack:"sales"},
      {label:"Doimiy ulgurji — takrorlanuvchi, zakasga qo'shilgan",data:dwi||new Array(dd.length).fill(0),backgroundColor:"#EF9F27",borderRadius:3,stack:"sales"},
      {label:"Bir martalik ulgurji — favqulodda, zakasdan chiqarilgan",data:dwe||new Array(dd.length).fill(0),backgroundColor:"#E24B4A",borderRadius:3,stack:"sales"},
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
                "Retail: "+fmtQty((tz.pureRetail&&tz.pureRetail[day])||0)+" "+u+" / retail qismi bor "+((drr&&drr[day])||0)+" chek",
                "Doimiy ulgurji: "+fmtQty((dwi&&dwi[day])||0)+" "+u+" / "+((dwri&&dwri[day])||0)+" chekda",
                "Bir martalik ulgurji: "+fmtQty((dwe&&dwe[day])||0)+" "+u+" / "+((dwre&&dwre[day])||0)+" chekda",
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
      '<div class="sbox"><div class="slbl">Sotuv narxi</div><div class="sval">'+(v.p||0).toLocaleString()+' UZS</div></div>'+
      '<div class="sbox"><div class="slbl">Kelish narxi</div><div class="sval">'+(v.suprice?v.suprice.toLocaleString()+' UZS':'—')+'</div></div>'+
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
  const recurring=(dl&&dl.wi&&dl.wi.length===nd)?dl.wi:new Array(nd).fill(0);
  const oneoff=(dl&&dl.we&&dl.we.length===nd)?dl.we:new Array(nd).fill(0);
  const pureRetail=(dl&&dl.rt&&dl.rt.length===nd)
    ?dl.rt
    :dd.map((value,index)=>Math.max(0,value-(wholesale[index]||0)));
  // Zakas hisobi: sof retail + DOIMIY (takrorlanuvchi) ulgurji. Bir martalik ulgurji kiritilmaydi.
  const orderBasis=pureRetail.map((value,index)=>value+(recurring[index]||0));
  const retailMonth=orderBasis.reduce((a,b)=>a+b,0);
  const retailDays=orderBasis.filter(value=>value>0.001).length;
  const wholesaleRows=[];
  for(let day=0;day<nd;day++){
    const rec=recurring[day]||0;
    const one=oneoff[day]||0;
    if(rec>0)wholesaleRows.push({day,val:dd[day],wq:rec,r:dr?dr[day]||0:0,src:"DOIMIY"});
    if(one>0)wholesaleRows.push({day,val:dd[day],wq:one,r:dr?dr[day]||0:0,src:"BIR_MARTALIK"});
  }
  return{
    wholesale:wholesaleRows,
    wSum:wholesale.reduce((a,b)=>a+b,0),
    wiSum:recurring.reduce((a,b)=>a+b,0),
    weSum:oneoff.reduce((a,b)=>a+b,0),
    retailMonth,
    clean_avg:nd?retailMonth/nd:0,
    clean_active_avg:retailDays?retailMonth/retailDays:0,
    retailDays,
    retail:orderBasis,
    pureRetail,
    recurring,
    oneoff,
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
  if(wholesalePct>0)return{type:"wholesale",label:"Bir martalik ulgurji ajratildi",color:"#E24B4A",confidence,msg:"Jami savdoning "+wholesalePct.toFixed(1)+"% favqulodda (bir martalik) ulgurji sifatida ajratildi.",rec:"Doimiy ulgurji zakas hisobiga qo'shildi, bir martalik ulgurji chiqarib tashlandi."};
  return{type:"stable",label:"Barqaror retail talab",color:"#1D9E75",confidence,msg:active+" / "+days+" kun retail savdo bo'lgan.",rec:"Kunlik, haftalik va 30 kunlik talab sof retail + doimiy ulgurji asosida hisoblandi."};
}
function renderTable3(rows){const q=document.getElementById("srch3").value.toLowerCase().trim();let filtered=rows;if(q){filtered=P3.filter(v=>!v._off&&v.name.toLowerCase().includes(q));if(filtered.length>0){const fv=filtered[0];const tt=fv.sub==="C1"?"C1":fv.abc;if(tt!==curTab3){curTab3=tt;document.querySelectorAll(".atab").forEach(b=>b.className="atab");document.querySelectorAll(".atab").forEach(b=>{if(b.dataset.tab===tt)b.className="atab sel-"+tt;});curRows3=getRows3(tt);}}}document.getElementById("tcnt").textContent=filtered.length.toLocaleString()+" ta mahsulot";const max=Math.min(filtered.length,500);const rows2=[];for(let i=0;i<max;i++){const v=filtered[i];const idx=P3.indexOf(v);const[sc,st]=sotuv(v.di);const sub=v.sub?'<span class="badge '+(v.sub==="C1"?"b-c1":v.sub==="C2"?"b-c2":"b-c3")+'">'+v.sub+"</span>":"";rows2.push('<tr data-idx="'+idx+'" onclick="showDetail3('+idx+')"><td style="color:#bbb;">'+v.r+'</td><td style="font-weight:500;">'+esc(v.name)+'</td><td style="color:#888;">'+esc(v.cat.substring(0,20))+'</td><td style="font-weight:700;color:#1D9E75;">'+fmt(v.rev)+'</td><td>'+v.rec.toLocaleString()+'</td><td style="color:'+(v.di>7?"#E24B4A":"#1D9E75")+';">'+v.ld+'</td><td><span class="badge '+sc+'">'+st+'</span></td><td><span class="badge b-'+v.abc+'">'+v.abc+'</span></td></tr>');}if(!rows2.length)rows2.push('<tr><td colspan="8" style="text-align:center;padding:20px;color:#bbb;">Topilmadi</td></tr>');document.getElementById("tbody3").innerHTML=rows2.join("");document.getElementById("detail3").style.display="none";}
function setTab(btn){const tab=btn.dataset.tab;curTab3=tab;document.querySelectorAll(".atab").forEach(b=>b.className="atab");btn.className="atab sel-"+tab;document.getElementById("srch3").value="";curRows3=getRows3(tab);renderTable3(curRows3);}
function filterTable(){renderTable3(curRows3);}
function showDetail3(idx){const v=P3[idx];if(!v)return;const u=v.kg?"kg":"dona";const[sc,st]=sotuv(v.di);document.querySelectorAll("tr.sel").forEach(r=>r.classList.remove("sel"));const row=document.querySelector('tr[data-idx="'+idx+'"]');if(row){row.classList.add("sel");row.scrollIntoView({block:"nearest"});}document.getElementById("d3-name").textContent=v.name;document.getElementById("detail3").className="detail d"+v.abc;let bdg='<span class="badge b-'+v.abc+'" style="font-size:11px;padding:3px 9px;">'+v.abc+' guruh</span>';if(v.sub){const sc2=v.sub==="C1"?"b-c1":v.sub==="C2"?"b-c2":"b-c3";bdg+=' <span class="badge '+sc2+'" style="font-size:11px;padding:3px 9px;">'+v.sub+'</span>';}if(v.kg)bdg+=' <span class="badge" style="background:#EAF3DE;color:#27500A;font-size:11px;padding:3px 9px;">KG tovar</span>';document.getElementById("d3-badges").innerHTML=bdg;document.getElementById("d3-stats").innerHTML='<div class="ds"><div class="ds-l">Jami tushum</div><div class="ds-v" style="color:#1D9E75;">'+fmt(v.rev)+' UZS</div></div><div class="ds"><div class="ds-l">Narxi (1 '+u+')</div><div class="ds-v">'+v.p.toLocaleString()+' UZS</div></div><div class="ds"><div class="ds-l">Cheklar soni</div><div class="ds-v">'+v.rec.toLocaleString()+'</div></div><div class="ds"><div class="ds-l">Tushum ulushi</div><div class="ds-v">'+v.rp.toFixed(3)+'%</div></div><div class="ds"><div class="ds-l">Oxirgi sotilgan</div><div class="ds-v" style="color:'+(v.di>7?"#E24B4A":"#1D9E75")+';">'+v.ld+'</div></div><div class="ds"><div class="ds-l">Sotuv holati</div><div class="ds-v"><span class="badge '+sc+'">'+st+'</span></div></div><div class="ds"><div class="ds-l">Kunlik ortacha</div><div class="ds-v">'+(v.qty/((DMETA&&DMETA.days)||31)).toFixed(v.kg?2:1)+' '+u+'</div></div><div class="ds"><div class="ds-l">Jami sotilgan</div><div class="ds-v">'+v.qty.toFixed(v.kg?2:0)+' '+u+'</div></div>';const why=(v.why||[]).map(w=>'<div class="bx-item"><div class="bx-dot"></div><div class="bx-txt">'+esc(w)+'</div></div>').join("");const how=(v.how||[]).map((h,i)=>'<div class="bx-item"><div class="bx-num">'+(i+1)+'.</div><div class="bx-txt">'+esc(h)+'</div></div>').join("");document.getElementById("d3-ra").innerHTML='<div class="box bx-why"><div class="bx-t">Nega '+v.abc+' guruhda?</div>'+why+'</div><div class="box bx-'+v.abc+'"><div class="bx-t">Nima qilish kerak?</div>'+how+'</div>';const dw=document.getElementById("detail3");dw.style.display="block";setTimeout(()=>dw.scrollIntoView({behavior:"smooth",block:"nearest"}),50);}
function openUpload(){if(confirm("Yangi oy ma'lumotini yuklashga o'tasizmi?")){window.location.href="/upload";}}
function p2FCount(){const ids=["pf-cat","pf-sub","pf-type","pf-sup","pf-amt","pf-abc"];let n=0;ids.forEach(id=>{const e=document.getElementById(id);if(e&&e.value)n++;});const b=document.getElementById("p2-fcount");if(b)b.textContent=n?"("+n+")":"";const btn=document.getElementById("p2-fbtn");if(btn)btn.classList.toggle("has",n>0);}
function p2FToggle(e){if(e)e.stopPropagation();const p=document.getElementById("p2-fpop");if(p)p.classList.toggle("open");p2FCount();}
document.addEventListener("click",function(e){const w=document.querySelector(".p2-fwrap");const p=document.getElementById("p2-fpop");if(w&&p&&!w.contains(e.target))p.classList.remove("open");});
document.addEventListener("click",function(e){const b=document.getElementById("z-fbtn");const p=document.getElementById("z-fpop");if(b&&p&&!b.contains(e.target)&&!p.contains(e.target))p.classList.remove("open")   ;});

// ─── P6 Supplier Tahlili ───
function initP6(){
  if(!P6)return;
  const d=P6;
  const fmt=(n)=>n>=1e9?(n/1e9).toFixed(2)+" mlrd":n>=1e6?Math.round(n/1e6)+" mln":n.toLocaleString();
  const s=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  s("sp-n-a",d.abc_cnt.A.toLocaleString());
  s("sp-n-b",d.abc_cnt.B.toLocaleString());
  s("sp-n-c",d.abc_cnt.C.toLocaleString());
  s("sp-n-all",d.sup_count.toLocaleString());
  const revA=d.suppliers.filter(x=>x.abc==="A").reduce((a,x)=>a+x.rev,0);
  const revB=d.suppliers.filter(x=>x.abc==="B").reduce((a,x)=>a+x.rev,0);
  const revC=d.suppliers.filter(x=>x.abc==="C").reduce((a,x)=>a+x.rev,0);
  s("sp-rev-a",fmt(revA));s("sp-rev-b",fmt(revB));s("sp-rev-c",fmt(revC));s("sp-rev-all",fmt(d.total_rev));
  const totR=d.total_rev||1;
  const pA=Math.round(revA/totR*100);
  const pB=Math.round(revB/totR*100);
  const pC=100-pA-pB;
  s("sp-sub-a","Tushimning "+pA+"%");
  s("sp-sub-b","Tushimning "+pB+"%");
  s("sp-sub-c","Tushimning "+pC+"%");
  s("sp-sub-all","Jami tushum");
  renderP6();
}
function p6SetFilter(f){
  p6CurF=f;p6Page=1;p6SelI=null;
  document.querySelectorAll(".sp-ftab").forEach(b=>b.classList.toggle("active",b.dataset.f===f));
  document.querySelectorAll(".sp-card").forEach(c=>c.classList.remove("sp-selected"));
  if(f!=="all"){const el=document.getElementById("sp-card-"+f);if(el)el.classList.add("sp-selected");}
  renderP6();
}
function p6SearchInput(){
  const inp=document.getElementById("sp-q");
  p6Q=inp?inp.value.toLowerCase().trim():"";
  const clr=document.getElementById("sp-clear");
  if(clr)clr.style.display=p6Q?"inline-block":"none";
  p6Page=1;renderP6();
}
function p6ClearSearch(){
  const inp=document.getElementById("sp-q");
  if(inp){inp.value="";inp.focus();}
  const clr=document.getElementById("sp-clear");
  if(clr)clr.style.display="none";
  p6Q="";p6Page=1;renderP6();
}
function p6Select(r){p6SelI=(p6SelI===r)?null:r;renderP6();}
function p6Go(page){p6Page=page;renderP6();const w=document.querySelector(".sp-tbl-wrap");if(w)w.scrollTop=0;}
function exportSuppliersCSV(){
  if(!P6)return;
  let items=[...P6.suppliers];
  if(p6CurF!=="all")items=items.filter(s=>s.abc===p6CurF);
  if(p6Q)items=items.filter(s=>s.name.toLowerCase().includes(p6Q));
  const mzMap={};
  if(ZITEMS){ZITEMS.filter(v=>v.signal==="muzlagan").forEach(v=>{if(v.sup)mzMap[v.sup]=(mzMap[v.sup]||0)+1;});}
  const q=v=>'"'+String(v==null?"":v).replace(/"/g,'""')+'"';
  let csv="﻿";
  csv+="#,Firma nomi,ABC guruhi,Tushum (so'm),Tushum %,Jami tovar,A guruh,B guruh,C guruh,Sotilmay qolgan,Cheklar\r\n";
  items.forEach((s,i)=>{
    csv+=`${i+1},${q(s.name)},${q(s.abc)},${s.rev||0},${s.rp||0},${s.cnt||0},${s.abc_cnt&&s.abc_cnt.A!=null?s.abc_cnt.A:0},${s.abc_cnt&&s.abc_cnt.B!=null?s.abc_cnt.B:0},${s.abc_cnt&&s.abc_cnt.C!=null?s.abc_cnt.C:0},${mzMap[s.name]||0},${s.rec||0}\r\n`;
  });
  const d=new Date();
  const ds=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
  const a=document.createElement("a");
  a.href="data:text/csv;charset=utf-8,"+encodeURIComponent(csv);
  a.download="suppliers_export_"+ds+".csv";
  a.click();
}
function renderP6(){
  if(!P6)return;
  let items=[...P6.suppliers];
  if(p6CurF!=="all")items=items.filter(s=>s.abc===p6CurF);
  if(p6Q)items=items.filter(s=>s.name.toLowerCase().includes(p6Q));
  const cnt=document.getElementById("sp-cnt");if(cnt)cnt.textContent=items.length.toLocaleString()+" ta supplier";
  const totalP=Math.max(1,Math.ceil(items.length/P6PS));
  if(p6Page>totalP)p6Page=totalP;
  const off=(p6Page-1)*P6PS;
  const shown=items.slice(off,off+P6PS);
  const maxRev=P6.suppliers[0].rev;
  const mzMap={};
  if(ZITEMS){ZITEMS.filter(v=>v.signal==="muzlagan").forEach(v=>{if(v.sup)mzMap[v.sup]=(mzMap[v.sup]||0)+1;});}
  let h="";
  shown.forEach((s,i)=>{
    const abc=s.abc;
    const barC=abc==="A"?"#1D9E75":abc==="B"?"#534AB7":"#EF9F27";
    const pct=Math.min(100,Math.round(s.rev/maxRev*100));
    const revStr=s.rev>=1e9?(s.rev/1e9).toFixed(2)+" mlrd":s.rev>=1e6?Math.round(s.rev/1e6)+" mln":s.rev.toLocaleString();
    const isSel=p6SelI===s.r;
    const selStyle=isSel?" sp-row-sel":"";
    h+=`<tr class="sp-row${selStyle}" onclick="p6Select(${s.r})">`;
    h+=`<td style="color:#bbb;font-size:11px;text-align:center">${off+i+1}</td>`;
    h+=`<td><div class="sp-name" title="${esc(s.name)}">${esc(s.name)}</div></td>`;
    h+=`<td><span class="sp-abc sp-abc-${abc.toLowerCase()}">${abc}</span></td>`;
    h+=`<td style="font-weight:700;white-space:nowrap;color:#1a1a1a">${revStr}</td>`;
    h+=`<td><div style="display:flex;align-items:center;gap:6px"><div style="width:80px;height:7px;background:#f0f0ec;border-radius:4px;overflow:hidden;flex-shrink:0"><div style="height:100%;width:${pct}%;background:${barC};border-radius:4px"></div></div><span style="font-size:11px;font-weight:600;color:#888">${s.rp}%</span></div></td>`;
    const aB=`<span class="sp-mc sp-mc-a" style="min-width:28px;text-align:center">${s.abc_cnt.A||0}A</span>`;
    const bB=`<span class="sp-mc sp-mc-b" style="min-width:28px;text-align:center">${s.abc_cnt.B||0}B</span>`;
    const cB=`<span class="sp-mc sp-mc-c" style="min-width:28px;text-align:center">${s.abc_cnt.C||0}C</span>`;
    h+=`<td><div style="display:flex;flex-direction:column;gap:3px"><div><span style="font-weight:600;color:#333">${s.cnt}</span> <span style="font-size:11px;color:#aaa">ta</span></div><div style="height:1px;background:#e8e8e3;margin:0"></div><div style="display:flex;gap:3px">${aB}${bB}${cB}</div>${(mzMap[s.name]||0)>0?'<div style="height:1px;background:#e8e8e3;margin:0"></div><div style="font-size:11px;color:#9CA3AF">&#x1F4A4; '+(mzMap[s.name])+' ta</div>':''}</div></td>`;
    h+=`<td style="color:#888;font-size:13px">${(s.rec||0).toLocaleString()}</td>`;
    h+=`</tr>`;
    if(isSel&&s.top&&s.top.length){
      const topH=s.top.map((t,ti)=>`<div class="sp-top-item"><div class="sp-top-left"><span class="sp-top-rank">${ti+1}</span><div><div class="sp-top-name" title="${esc(t.name)}">${esc(t.name)}</div><div class="sp-top-rev">${t.rev>=1e6?Math.round(t.rev/1e6)+" mln so'm":t.rev.toLocaleString()+" so'm"}</div></div></div><span class="p2-abc p2-abc-${t.abc}">${t.abc}</span></div>`).join("");
      h+=`<tr class="sp-det-row"><td colspan="7"><div class="sp-det-wrap"><div class="sp-det-title">📦 Top mahsulotlar</div><div class="sp-det-list">${topH}</div></div></td></tr>`;
    }
  });
  if(!h)h=`<tr><td colspan="7" style="text-align:center;padding:40px;color:#bbb">Supplier topilmadi</td></tr>`;
  document.getElementById("sp-tbody").innerHTML=h;
  renderP6Pag(totalP);
}
function renderP6Pag(totalP){
  const pag=document.getElementById("sp-pag");if(!pag)return;
  if(totalP<=1){pag.innerHTML="";return;}
  const mk=(l,p,d,a)=>`<button ${d?"disabled":""} ${a?'class="active"':""} onclick="p6Go(${p})">${l}</button>`;
  let h=mk("‹",p6Page-1,p6Page<=1,false);
  let s=Math.max(1,p6Page-2),e=Math.min(totalP,p6Page+2);
  if(s>1){h+=mk("1",1,false,p6Page===1);if(s>2)h+='<button disabled>…</button>';}
  for(let p=s;p<=e;p++)h+=mk(p,p,false,p===p6Page);
  if(e<totalP){if(e<totalP-1)h+='<button disabled>…</button>';h+=mk(totalP,totalP,false,p6Page===totalP);}
  h+=mk("›",p6Page+1,p6Page>=totalP,false);
  pag.innerHTML=h;
}
