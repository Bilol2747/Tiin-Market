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
