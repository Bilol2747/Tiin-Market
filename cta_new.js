function calcTozaOrtacha(dd,dr,dw,dl){
const nd=dd.length;
const total=dd.reduce((a,b)=>a+b,0);
const wArr=(dw&&dw.length===nd)?dw:new Array(nd).fill(0);
// F1: receipt-level (pre-computed)
const f1Set=new Set();
for(let i=0;i<nd;i++){if(wArr[i]>0)f1Set.add(i);}
// F2 baseline: non-F1 kunlar (mahsulotning o'z tabiiy taqsimoti)
const base=[];
for(let i=0;i<nd;i++){if(!f1Set.has(i)&&dd[i]>0)base.push(dd[i]);}
let med=0,madS=0;
if(base.length>=3){
const s=[...base].sort((a,b)=>a-b);
med=_med(s);
const ad=s.map(x=>Math.abs(x-med)).sort((a,b)=>a-b);
madS=_med(ad)*1.4826;
}
// OR mantiqi: F1 YOKI F2 → ulgurji
const wqMap={};
for(let i=0;i<nd;i++){
if(wArr[i]>0){wqMap[i]={q:wArr[i],src:'F1'};}
else if(madS>0&&med>0&&dd[i]>0){
const z=(dd[i]-med)/madS;
if(z>2.0){wqMap[i]={q:Math.round(Math.max(0,dd[i]-med)),src:'F2'};}
}}
const wholesale=Object.entries(wqMap).map(([d,o])=>({
day:+d,val:dd[+d],wq:o.q,r:(dr&&dr[+d])?dr[+d]:0,src:o.src
})).sort((a,b)=>a.day-b.day);
const wSet=new Set(Object.keys(wqMap).map(Number));
const wSum=wholesale.reduce((a,w)=>a+w.wq,0);
const retailMonth=Math.max(0,total-wSum);
let retailDays=0;
for(let i=0;i<nd;i++){const r=dd[i]-(wqMap[i]?wqMap[i].q:0);if(r>0.001)retailDays++;}
const clean_avg=retailMonth/nd;
const clean_active_avg=retailDays>0?retailMonth/retailDays:0;
return{wholesale,wSum:Math.round(wSum),retailMonth,clean_avg,clean_active_avg,retailDays,wSet,total,method:'F1+F2',ndays:nd,median:med,mad:madS};
}