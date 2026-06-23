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
      '<div class="sbox" style="grid-column:1/-1;background:#F8FAFC;border:1px solid #E2E8F0;"><div class="slbl">Oylik savdo</div><div class="sval">'+fmt(m.revenue||0)+' UZS · '+fmtQty(m.totalSold)+' '+u+'</div></div>'+
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
