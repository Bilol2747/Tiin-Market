// ─── Login (server orqali, /api/auth — brauzer endi Firestore'ga hech qachon
// to'g'ridan-to'g'ri murojaat qilmaydi, 2026-08-25 xavfsizlik tuzatishi) ───

// curPageId bu yerda (faylning boshida) e'lon qilinadi, quyidagi login-sessiyani
// tiklovchi IIFE _applyUser()'ni chaqiradi va u ichida curPageId'ga murojaat
// qiladi - "let" TDZ (temporal dead zone) qoidasi bo'yicha o'zgaruvchi keyinroq
// (P1 holat bo'limida) e'lon qilinsa, shu yerdagi erta chaqiruv
// "Cannot access before initialization" xatosini berardi va bu xato butun
// login-tiklash IIFE'sini (catch bilan) jimgina to'xtatib qo'yardi - foydalanuvchi
// localStorage'da sessiyasi bo'lsa ham har safar qayta login qilishga majbur
// bo'lardi (2026-09-01, foydalanuvchi topilmasi).
let curPageId="p1";
function _authToken(){try{return JSON.parse(localStorage.getItem("tiin_user")||"{}").token||"";}catch(_){return "";}}

async function _authCall(action,extra){
  const body=Object.assign({action,token:_authToken()},extra||{});
  let res;
  // networkError=true - so'rov serverga UMUMAN yetib bormadi (internet uzilishi,
  // vaqtinchalik server ishlamay qolishi va h.k.) - bu FARQLANISHI kk sessiya
  // haqiqatan ham bekor qilinganidan (server aniq javob bergan holatdan),
  // aks holda _authCheckOnce() mobil internetdagi oddiy uzilishda ham
  // foydalanuvchini login oynasiga chiqarib tashlardi (2026-09-01, foydalanuvchi
  // topilmasi - "har kirganda qayta login so'raydi" muammosining yana bir sababi).
  try{res=await fetch("/api/auth",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});}
  catch(_){return {ok:false,networkError:true,error:"Serverga ulanib bo'lmadi"};}
  try{return await res.json();}catch(_){return {ok:false,networkError:true,error:"Server javobini o'qib bo'lmadi"};}
}

// Sessiya sayt ochiq turgan paytda ham davriy tekshiriladi (har 20s) - parol
// o'zgartirilsa yoki blok qilinsa, foydalanuvchi "chiqish" bosmasdan ham
// avtomatik login oynasiga chiqarib tashlanadi, sababi bilan.
let _authWatchTimer=null;
function _authStopWatch(){if(_authWatchTimer){clearInterval(_authWatchTimer);_authWatchTimer=null;}}
function _authStartWatch(){_authStopWatch();_authWatchTimer=setInterval(_authCheckOnce,20000);}
function _authKick(reason){
  _authStopWatch();
  try{localStorage.removeItem("tiin_user");}catch(_){}
  try{sessionStorage.setItem("tiin_kick_reason",reason||"");}catch(_){}
  location.reload();
}
async function _authCheckOnce(){
  if(!_authToken())return;
  const data=await _authCall("session_check",{});
  // Faqat SERVER aniq "sessiya bekor" deb javob bersa (blocked/password_changed/
  // deleted/expired) chiqarib yuboriladi - networkError bo'lsa (internet uzilishi
  // yoki server vaqtincha ishlamay qolishi) sessiya HECH NARSA qilinmasdan
  // qoldiriladi, keyingi 20s'da qayta urinilaveradi.
  if(!data.ok){if(!data.networkError)_authKick(data.reason);return;}
  try{
    const merged=Object.assign(JSON.parse(localStorage.getItem("tiin_user")||"{}"),data.user);
    localStorage.setItem("tiin_user",JSON.stringify(merged));
    _applyUser(merged);
  }catch(_){}
}
function _authShowKickReason(){
  let reason=null;
  try{reason=sessionStorage.getItem("tiin_kick_reason");sessionStorage.removeItem("tiin_kick_reason");}catch(_){}
  if(!reason)return;
  const MSG={
    blocked:"Hisobingiz administrator tomonidan bloklandi",
    password_changed:"Parolingiz o'zgartirildi — yangi parol bilan qayta kiring",
    deleted:"Hisobingiz topilmadi — qayta kiring",
    expired:"Sessiya muddati tugadi — qayta kiring",
  };
  _lgErr(MSG[reason]||"Qayta kiring");
}

function lgEye(){const i=document.getElementById("lg-pass");i.type=i.type==="password"?"text":"password";}

function _lgErr(msg){const e=document.getElementById("lg-err");document.getElementById("lg-err-txt").textContent=msg;e.classList.add("show");setTimeout(()=>e.classList.remove("show"),2800);}

function lgUnlock(){const s=document.getElementById("login-screen");if(s){s.style.transition="opacity .35s";s.style.opacity="0";setTimeout(()=>s.remove(),350);}document.body.classList.remove("locked");}

function _applyUser(user){
  const nm=user.name||user.phone;
  const words=nm.trim().split(/\s+/);
  const initials=(words.length>=2?words[0][0]+words[1][0]:words[0].slice(0,2)).toUpperCase();
  const nameEl=document.getElementById("tb-uname"),avaEl=document.getElementById("tb-ava");
  const ddName=document.getElementById("tb-dd-name"),ddRole=document.getElementById("tb-dd-role");
  if(nameEl)nameEl.textContent=nm;
  if(avaEl){avaEl.textContent=initials;avaEl.style.background=user.role==="admin"?"#534AB7":"#1D9E75";avaEl.style.fontSize=initials.length>1?"12px":"14px";}
  if(ddName)ddName.textContent=nm;
  if(ddRole)ddRole.textContent=user.role==="admin"?t("role_admin"):t("role_staff");
  const tabs=user.tabs||["p1"];
  if(user.role==="admin"&&!tabs.includes("p_nazorat"))tabs.push("p_nazorat");
  document.querySelectorAll(".sb-item[data-page]").forEach(btn=>{btn.style.display=tabs.includes(btn.dataset.page)?"":"none";});
  // Tiklangan (yoki eski) bo'lim shu foydalanuvchiga ruxsat etilmagan bo'lsa - ruxsat
  // etilgan bo'limga qaytaramiz (masalan tab huquqi olib tashlangan bo'lsa).
  if(typeof curPageId!=="undefined"&&curPageId&&!tabs.includes(curPageId)){
    const fallbackId=tabs.includes("p1")?"p1":(tabs[0]||"p1");
    const fbtn=document.querySelector(`.sb-item[data-page="${fallbackId}"]`);
    if(fbtn)showPage(fbtn);
  }
}

function tbUserToggle(e){
  e.stopPropagation();
  const u=document.getElementById("tb-user");
  if(!u)return;
  const dd=document.getElementById("tb-dropdown");
  if(u.classList.contains("open")){u.classList.remove("open");return;}
  // position:fixed uchun avatar joylashuvini aniqlash
  if(dd){const r=u.getBoundingClientRect();dd.style.top=(r.bottom+4)+"px";dd.style.right=(window.innerWidth-r.right)+"px";}
  u.classList.add("open");
}
document.addEventListener("click",function(){const u=document.getElementById("tb-user");if(u)u.classList.remove("open");});

function _tgMsg(name){
  const ua=navigator.userAgent;
  const br=ua.includes("Edg")?"Edge":ua.includes("Chrome")?"Chrome":ua.includes("Firefox")?"Firefox":ua.includes("Safari")?"Safari":"Boshqa";
  const os=ua.includes("Windows")?"Windows":ua.includes("Android")?"Android":(ua.includes("iPhone")||ua.includes("iPad"))?"iOS":ua.includes("Mac")?"Mac":"Boshqa";
  const now=new Date();
  const dt=now.toLocaleDateString("uz-UZ")+", "+now.toLocaleTimeString("uz-UZ",{hour:"2-digit",minute:"2-digit"});
  // parse_mode ishlatilmaydi — ism ichida _/*/[ kabi belgilar bo'lsa Telegram
  // 400 qaytarib xabarni jimgina yo'qotmasin.
  return "🔐 Tiin Market — yangi kirish\n👤 "+(name||"")+"\n📱 "+br+" · "+os+"\n🕐 "+dt;
}
function _tgSend(msg){
  fetch("https://api.telegram.org/bot8626844104:AAHsDzuxGzJqsvnaS42jSHTLriF7A0tUtXg/sendMessage",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chat_id:"7034777747",text:msg})}).catch(()=>{});
}
// Kunlik "throttle" kaliti: sana + foydalanuvchi — bir qurilmada bir foydalanuvchi
// kuniga faqat 1 marta xabar bersin (bir kunda bir necha marta kirsa/sahifani
// yangilasa spam bo'lmasin; boshqa foydalanuvchi yoki keyingi kun — yangi xabar).
function _tgKey(user){return new Date().toDateString()+"|"+((user&&(user.phone||user.name))||"");}
// Qo'lda login (login formasi) — DOIM xabar yuboradi va kunlik kalitni belgilaydi.
function _tgNotify(user){
  try{localStorage.setItem("tiin_tg_day",_tgKey(user));}catch(_){}
  _tgSend(_tgMsg((user&&(user.name||user.phone))||""));
}
// Avtomatik sessiya tiklash — faqat shu foydalanuvchi bugun hali xabar bermagan bo'lsa.
function _tgNotifyDaily(user){
  try{
    const k=_tgKey(user);
    if(localStorage.getItem("tiin_tg_day")===k)return;
    localStorage.setItem("tiin_tg_day",k);
  }catch(_){}
  _tgSend(_tgMsg((user&&(user.name||user.phone))||""));
}

async function lgSubmit(e){
  e.preventDefault();
  const ph=(document.getElementById("lg-phone").value||"").replace(/\D/g,"");
  const pw=document.getElementById("lg-pass").value||"";
  if(!ph){_lgErr("Telefon raqamni kiriting");return false;}
  if(!pw){_lgErr("Parolni kiriting");return false;}
  const btn=document.querySelector(".lg-btn");
  btn.disabled=true;btn.textContent="Tekshirilmoqda...";
  try{
    const data=await _authCall("login",{phone:ph,password:pw});
    if(!data.ok){_lgErr(data.error||"Telefon raqam yoki parol noto'g'ri");btn.disabled=false;btn.textContent="Kirish";return false;}
    const session=Object.assign({},data.user,{token:data.token,exp:data.exp});
    try{localStorage.setItem("tiin_user",JSON.stringify(session));}catch(_){}
    _tgNotify(session);
    _applyUser(session);
    lgUnlock();
    _authStartWatch();
  }catch(err){
    console.error(err);
    _lgErr("Xatolik yuz berdi, qayta urinib ko'ring");
    btn.disabled=false;btn.textContent="Kirish";
  }
  return false;
}

function lgLogout(){_authStopWatch();try{localStorage.removeItem("tiin_user");}catch(_){}location.reload();}

// 2026-08-25: sessiya endi Firestore onSnapshot (real vaqtli, lekin
// brauzerdan to'g'ridan-to'g'ri Firestore ulanishi talab qiladigan)
// o'rniga /api/auth "session_check" so'rovi orqali davriy (har 20s)
// tekshiriladi - _authCheckOnce()/_authStartWatch() (fayl boshida).
// Bu biroz sekinroq (onSnapshot kechikishsiz edi), lekin brauzer endi
// Firestore'ga UMUMAN ulanmaydi - ochiq to'plam muammosi shu bilan
// yopiladi. Eski _watchSession() (2026-08-12, xuddi shu maqsadda
// qo'shilgan edi) olib tashlandi - yangi shifrlangan parol format bilan
// (password_hash o'rniga password_enc) baribir ishlamay qolgan bo'lardi.

// ─── I18N LUG'AT (uz/en/ru — barcha sahifalar matnlari shu yerda) ───
const I18N={
  nav_p1:{uz:"Bosh sahifa",en:"Home",ru:"Главная"},
  nav_p2:{uz:"Mahsulotlar",en:"Products",ru:"Товары"},
  nav_p3:{uz:"ABC tahlili",en:"ABC analysis",ru:"ABC-анализ"},
  nav_p5:{uz:"Stock",en:"Stock",ru:"Склад"},
  nav_p6:{uz:"Ta'minotchilar",en:"Suppliers",ru:"Поставщики"},
  nav_p8:{uz:"Kirim",en:"Arrivals",ru:"Приход"},
  nav_p9:{uz:"Ombor aylanmasi",en:"Inventory turnover",ru:"Обороты"},
  oa_grp_open:{uz:"Boshlang'ich zaxira",en:"Opening stock",ru:"Начало периода"},
  oa_grp_in:{uz:"Kirim",en:"Stock in",ru:"Приход"},
  oa_grp_out:{uz:"Chiqim",en:"Stock out",ru:"Расход"},
  oa_grp_close:{uz:"Yakuniy zaxira",en:"Closing stock",ru:"Конец периода"},
  oa_th_mahsulot:{uz:"Mahsulot nomi",en:"Product name",ru:"Наименование товара"},
  oa_th_miqdor:{uz:"Miqdor",en:"Quantity",ru:"Кол-во"},
  oa_th_summa:{uz:"Summa",en:"Amount",ru:"Сумма"},
  oa_search_ph:{uz:"Mahsulot, SKU qidirish...",en:"Search product, SKU...",ru:"Поиск товара, SKU..."},
  oa_not_found:{uz:"Mahsulot topilmadi",en:"No products found",ru:"Товары не найдены"},
  oa_cnt_suffix:{uz:"mahsulot",en:"products",ru:"товаров"},
  oa_import:{uz:"Import",en:"Import",ru:"Импорт"},
  oa_import_sku:{uz:"SKU",en:"SKU",ru:"SKU"},
  oa_import_barcode:{uz:"Barcode",en:"Barcode",ru:"Barcode"},
  oa_import_name:{uz:"Name",en:"Name",ru:"Name"},
  oa_import_sub:{uz:"Excel faylning birinchi ustunida ro'yxat bo'lsin",en:"List should be in the first column of the Excel file",ru:"Список должен быть в первом столбце Excel-файла"},
  oa_import_found:{uz:"ta topildi",en:"found",ru:"найдено"},
  oa_import_cancel:{uz:"Bekor qilish",en:"Cancel",ru:"Отмена"},
  kr_th_mahsulot:{uz:"Mahsulot",en:"Product",ru:"Товар"},
  kr_th_stock:{uz:"Hozirgi stock",en:"Current stock",ru:"Текущий остаток"},
  kr_th_jami:{uz:"Kelgan soni",en:"Qty received",ru:"Кол-во получено"},
  kr_th_narx:{uz:"Kelgan narxi",en:"Arrival price",ru:"Цена прихода"},
  kr_th_marta:{uz:"Necha marta",en:"Times",ru:"Кол-во раз"},
  kr_th_sana:{uz:"Kelgan sana",en:"Arrival date",ru:"Дата прихода"},
  kr_th_holat:{uz:"Holat",en:"Status",ru:"Статус"},
  kr_search_ph:{uz:"Mahsulot, SKU qidirish...",en:"Search product, SKU...",ru:"Поиск товара, SKU..."},
  kr_det_sana:{uz:"Sana",en:"Date",ru:"Дата"},
  kr_det_sup:{uz:"Ta'minotchi",en:"Supplier",ru:"Поставщик"},
  kr_det_expected:{uz:"Kutilgan",en:"Expected",ru:"Ожидалось"},
  kr_det_qty:{uz:"Kelgan",en:"Received",ru:"Получено"},
  kr_det_cost:{uz:"Narx",en:"Cost",ru:"Цена"},
  kr_det_summa:{uz:"Summa",en:"Amount",ru:"Сумма"},
  kr_det_status:{uz:"Holat",en:"Status",ru:"Статус"},
  kr_back:{uz:"Orqaga",en:"Back",ru:"Назад"},
  kr_not_found:{uz:"Mahsulot topilmadi",en:"No products found",ru:"Товары не найдены"},
  nav_p_nazorat:{uz:"Nazorat",en:"Control",ru:"Управление"},
  logout:{uz:"Chiqish",en:"Logout",ru:"Выйти"},
  naz_title:{uz:"Nazorat bo'limi",en:"Control Panel",ru:"Панель управления"},
  naz_sub:{uz:"Foydalanuvchilar va ruxsatlar boshqaruvi",en:"User and permissions management",ru:"Управление пользователями и правами"},
  naz_total:{uz:"Jami foydalanuvchilar",en:"Total users",ru:"Всего пользователей"},
  naz_admins:{uz:"Adminlar",en:"Admins",ru:"Администраторы"},
  naz_active:{uz:"Faol xodimlar",en:"Active users",ru:"Активные сотрудники"},
  naz_add:{uz:"Xodim qo'shish",en:"Add employee",ru:"Добавить сотрудника"},
  naz_th_name:{uz:"Ism",en:"Name",ru:"Имя"},
  naz_th_phone:{uz:"Telefon",en:"Phone",ru:"Телефон"},
  naz_th_role:{uz:"Rol",en:"Role",ru:"Роль"},
  naz_th_tabs:{uz:"Ko'rinadigan bo'limlar",en:"Visible sections",ru:"Видимые разделы"},
  naz_th_status:{uz:"Status",en:"Status",ru:"Статус"},
  naz_th_actions:{uz:"Amallar",en:"Actions",ru:"Действия"},
  naz_edit:{uz:"Tahrir",en:"Edit",ru:"Изменить"},
  naz_block:{uz:"Bloklash",en:"Block",ru:"Блок"},
  naz_activate:{uz:"Yoqish",en:"Activate",ru:"Активация"},
  naz_modal_add:{uz:"Yangi xodim qo'shish",en:"Add new employee",ru:"Добавить нового сотрудника"},
  naz_modal_edit:{uz:"Xodimni tahrirlash",en:"Edit employee",ru:"Редактировать сотрудника"},
  naz_lbl_name:{uz:"Ism familiya",en:"Full name",ru:"Имя и фамилия"},
  naz_lbl_phone:{uz:"Telefon raqam",en:"Phone number",ru:"Номер телефона"},
  naz_lbl_pass:{uz:"Parol",en:"Password",ru:"Пароль"},
  naz_lbl_role:{uz:"Rol",en:"Role",ru:"Роль"},
  naz_lbl_fname:{uz:"Ism",en:"First name",ru:"Имя"},
  naz_lbl_lname:{uz:"Familiya",en:"Last name",ru:"Фамилия"},
  naz_lbl_tabs:{uz:"Ko'rinadigan bo'limlar",en:"Visible sections",ru:"Видимые разделы"},
  naz_role_staff:{uz:"Xodim",en:"Employee",ru:"Сотрудник"},
  naz_role_admin:{uz:"Admin (barcha bo'limlar)",en:"Admin (all sections)",ru:"Админ (все разделы)"},
  naz_save:{uz:"Saqlash",en:"Save",ru:"Сохранить"},
  naz_pass_hint:{uz:"Joriy parol ko'rsatilgan (ko'zcha bilan). O'zgartirish uchun ustiga yozing, aks holda shu parol saqlanib qoladi",en:"Current password shown (toggle with the eye icon). Type over it to change, otherwise it stays the same",ru:"Показан текущий пароль (переключить значком глаза). Впишите новый, чтобы изменить, иначе останется прежним"},
  naz_pass_hint_new:{uz:"Bu xodim hali yangi tizimga o'tmagan — joriy parolini ko'rsatib bo'lmaydi. Kiritsangiz, yangi parol sifatida saqlanadi",en:"This employee hasn't logged in under the new system yet — current password can't be shown. If you type one, it will be saved as the new password",ru:"Этот сотрудник ещё не входил в новую систему — текущий пароль показать нельзя. Если введёте, он сохранится как новый пароль"},
  naz_empty:{uz:"Hali foydalanuvchilar qo'shilmagan",en:"No users added yet",ru:"Пользователи ещё не добавлены"},
  naz_loading:{uz:"Yuklanmoqda...",en:"Loading...",ru:"Загрузка..."},
  naz_confirm_block:{uz:"Bu xodimni bloklashni xohlaysizmi?",en:"Block this employee?",ru:"Заблокировать этого сотрудника?"},
  naz_confirm_activate:{uz:"Bu xodimni faollashtirmoqchimisiz?",en:"Activate this employee?",ru:"Активировать этого сотрудника?"},
  naz_delete:{uz:"O'chirish",en:"Delete",ru:"Удалить"},
  naz_confirm_delete:{uz:"Bu foydalanuvchini butunlay o'chirasizmi?\nBu amalni ortga qaytarib bo'lmaydi!",en:"Permanently delete this user?\nThis cannot be undone!",ru:"Удалить этого пользователя навсегда?\nЭто действие необратимо!"},
  role_admin:{uz:"Admin",en:"Admin",ru:"Админ"},
  role_staff:{uz:"Xodim",en:"Employee",ru:"Сотрудник"},
  status_active:{uz:"Faol",en:"Active",ru:"Активен"},
  status_blocked:{uz:"Noaktiv",en:"Blocked",ru:"Заблокирован"},
  sp_a_guruh:{uz:"A guruh",en:"Group A",ru:"Группа A"},
  sp_b_guruh:{uz:"B guruh",en:"Group B",ru:"Группа B"},
  sp_c_guruh:{uz:"C guruh",en:"Group C",ru:"Группа C"},
  sp_jami_sup:{uz:"Jami supplierlar",en:"Total suppliers",ru:"Всего поставщиков"},
  sp_a_def:{uz:"80%",en:"80%",ru:"80%"},
  sp_b_def:{uz:"15%",en:"15%",ru:"15%"},
  sp_c_def:{uz:"5%",en:"5%",ru:"5%"},
  sp_t_def:{uz:"100%",en:"100%",ru:"100%"},
  sp_hammasi:{uz:"Hammasi",en:"All",ru:"Все"},
  sp_search_ph:{uz:"Supplier qidirish...",en:"Search supplier...",ru:"Поиск поставщика..."},
  sp_col_name:{uz:"Ta'minotchi nomi",en:"Supplier name",ru:"Название поставщика"},
  sp_mon_yan:{uz:"Yan",en:"Jan",ru:"Янв"},
  sp_mon_fev:{uz:"Fev",en:"Feb",ru:"Фев"},
  sp_mon_mar:{uz:"Mar",en:"Mar",ru:"Мар"},
  sp_mon_apr:{uz:"Apr",en:"Apr",ru:"Апр"},
  sp_mon_may:{uz:"May",en:"May",ru:"Май"},
  sp_mon_iyun:{uz:"Iyun",en:"Jun",ru:"Июн"},
  sp_mon_iyul:{uz:"Iyul",en:"Jul",ru:"Июл"},
  sp_mon_avg:{uz:"Avg",en:"Aug",ru:"Авг"},
  sp_mon_sen:{uz:"Sen",en:"Sep",ru:"Сен"},
  sp_mon_okt:{uz:"Okt",en:"Oct",ru:"Окт"},
  sp_mon_noy:{uz:"Noy",en:"Nov",ru:"Ноя"},
  sp_mon_dek:{uz:"Dek",en:"Dec",ru:"Дек"},
  sp_cnt_suffix:{uz:"ta supplier",en:"suppliers",ru:"поставщиков"},
  sp_topilmadi:{uz:"Supplier topilmadi",en:"No suppliers found",ru:"Поставщики не найдены"},
  sp_back_sup:{uz:"Ortga",en:"Back",ru:"Назад"},
  sp_mz_btn:{uz:"Sotilmayotgan tovarlar",en:"Not sold",ru:"Не продаётся"},
  sp_mz_prod:{uz:"TOVAR NOMI",en:"PRODUCT NAME",ru:"НАЗВАНИЕ ТОВАРА"},
  sp_mz_stock:{uz:"STOK",en:"STOCK",ru:"ЗАПАС"},
  sp_mz_buy:{uz:"KELISH NARXI",en:"BUY PRICE",ru:"ЦЕНА ЗАКУПКИ"},
  sp_mz_frozen:{uz:"MUZLAGAN SUMMA",en:"FROZEN VALUE",ru:"ЗАМОРОЖ. СУММА"},
  sp_mz_sell:{uz:"SOTILISH NARXI",en:"SELL PRICE",ru:"ЦЕНА ПРОДАЖИ"},
  sp_mz_days:{uz:"SOTUVSIZ",en:"IDLE DAYS",ru:"БЕЗ ПРОДАЖ"},
  sp_mz_lastkirim:{uz:"OXIRGI KIRIM",en:"LAST ARRIVAL",ru:"ПОСЛЕДНИЙ ПРИХОД"},
  sp_unit_pc:{uz:"dona",en:"pcs",ru:"шт"},
  sp_unit_kg:{uz:"kg",en:"kg",ru:"кг"},
  sp_days_unit:{uz:"kun",en:"days",ru:"дн"},
  sp_stat_tushum:{uz:"Tushum",en:"Revenue",ru:"Выручка"},
  sp_stat_tovarlar:{uz:"Tovarlar",en:"Products",ru:"Товары"},
  sp_stat_tannarx:{uz:"Tannarx",en:"Cost",ru:"Себестоимость"},
  sp_stat_foyda:{uz:"Foyda",en:"Profit",ru:"Прибыль"},
  sp_stat_marja:{uz:"Marja",en:"Margin",ru:"Маржа"},
  sp_group_by:{uz:"Guruhlash",en:"Grouped by",ru:"Группировка"},
  sp_stat_jami:{uz:"Jami",en:"Total",ru:"Всего"},
  sp_stat_approx_hint:{uz:"Kunlik tarix yuklanmoqda, aniqlashtirilmoqda...",en:"Loading daily history, refining...",ru:"Загружается дневная история, уточняется..."},
  sp_month_calc:{uz:"{month} bo'yicha hisob",en:"Calculated for {month}",ru:"Расчет за {month}"},
  sp_month_select:{uz:"Hisob oyi",en:"Calculation month",ru:"Месяц расчета"},
  sp_prod_name:{uz:"Tovar nomi",en:"Product name",ru:"Название товара"},
  sp_ta:{uz:"ta",en:"",ru:"шт"},
  sp6_back_label:{uz:"← Ta'minotchi",en:"← Supplier",ru:"← Поставщик"},
  sp6_no_data:{uz:"Ma'lumot yo'q",en:"No data",ru:"Нет данных"},
  nav_p10:{uz:"Kategoriyalar",en:"Categories",ru:"Категории"},
  nav_p11:{uz:"Firmalar",en:"Firms",ru:"Фирмы"},
  nav_p12:{uz:"Marja nazorati",en:"Margin Watch",ru:"Контроль маржи"},
  mg_search_ph:{uz:"Tovar, SKU qidirish...",en:"Search product, SKU...",ru:"Поиск товара, SKU..."},
  mg_threshold_label:{uz:"Marja chegarasi:",en:"Margin threshold:",ru:"Порог маржи:"},
  mg_cnt_unit:{uz:"ta tovar",en:"products",ru:"товаров"},
  mg_col_cat:{uz:"Kategoriya",en:"Category",ru:"Категория"},
  mg_col_stock:{uz:"Qolgan",en:"Remaining",ru:"Остаток"},
  mg_col_suggested:{uz:"Tavsiya narx",en:"Suggested price",ru:"Рекомендуемая цена"},
  mg_empty:{uz:"Belgilangan chegaradan past marjali tovar yo'q",en:"No products below the threshold",ru:"Нет товаров с маржой ниже порога"},
  fm_title:{uz:"Xaridor firmalar",en:"Buyer firms",ru:"Фирмы-покупатели"},
  fm_title_supplier:{uz:"Ta'minotchilarga qarz",en:"Supplier debt",ru:"Долг поставщикам"},
  fm_tab_buyer:{uz:"Xaridorlar",en:"Buyers",ru:"Покупатели"},
  fm_tab_supplier:{uz:"Ta'minotchilar",en:"Suppliers",ru:"Поставщики"},
  fm_col_ta:{uz:"Ta'minotchi",en:"Supplier",ru:"Поставщик"},
  fm_ta_cnt:{uz:"ta'minotchi",en:"suppliers",ru:"поставщиков"},
  fms_search_ph:{uz:"Ta'minotchi nomi yoki STIR...",en:"Supplier name or TIN...",ru:"Название поставщика или ИНН..."},
  fm_kpi_cnt_b:{uz:"Qarzdor firmalar",en:"Debtor firms",ru:"Фирмы-должники"},
  fm_kpi_cnt_s:{uz:"Qarzdor ta'minotchi",en:"Debtor suppliers",ru:"Поставщики-должники"},
  fm_kpi_top:{uz:"Eng katta qarzdor",en:"Biggest debtor",ru:"Крупнейший должник"},
  fm_currency:{uz:"so'm",en:"UZS",ru:"сум"},
  fm_unit_mlrd:{uz:"mlrd",en:"bn",ru:"млрд"},
  fm_unit_mln:{uz:"mln",en:"mln",ru:"млн"},
  fm_unit_ming:{uz:"ming",en:"K",ru:"тыс"},
  fm_legend_debt:{uz:"qarz",en:"debt",ru:"долг"},
  fm_legend_prepaid:{uz:"oldindan to'lagan",en:"prepaid",ru:"предоплата"},
  fm_aging_note:{uz:"* Kunlik guruhlash taxminiy — Invan aniq to'lov sanasini bermaydi, bizning kirim tarixi asosida hisoblangan",en:"* Day grouping is an estimate — Invan doesn't provide exact payment dates, calculated from our delivery history",ru:"* Разбивка по дням приблизительна — Invan не даёт точных дат оплаты, расчёт по нашей истории поставок"},
  fm_firma_cnt:{uz:"firma",en:"firms",ru:"фирм"},
  fm_chek:{uz:"chek",en:"receipts",ru:"чеков"},
  fm_jami:{uz:"Jami qarz",en:"Total debt",ru:"Итого долг"},
  fm_pb:{uz:"Puli bor",en:"In credit",ru:"Есть деньги"},
  fm_b15:{uz:"0–15 kun",en:"0–15 days",ru:"0–15 дней"},
  fm_b30:{uz:"16–30 kun",en:"16–30 days",ru:"16–30 дней"},
  fm_b45:{uz:"31–45 kun",en:"31–45 days",ru:"31–45 дней"},
  fm_b60:{uz:"45+ kun",en:"45+ days",ru:"45+ дней"},
  fm_f_all:{uz:"Hammasi",en:"All",ru:"Все"},
  fm_q7:{uz:"7 kun",en:"7 days",ru:"7 дней"},
  fms_q90:{uz:"90 kun",en:"90 days",ru:"90 дней"},
  fm_q30:{uz:"30 kun",en:"30 days",ru:"30 дней"},
  fm_search_ph:{uz:"Firma nomi yoki STIR...",en:"Firm name or TIN...",ru:"Название фирмы или ИНН..."},
  fm_qall:{uz:"Butun davr",en:"Full period",ru:"Весь период"},
  fm_fact_shartnoma:{uz:"Shartnoma",en:"Agreement",ru:"Договор"},
  fm_fact_tel:{uz:"Telefon",en:"Phone",ru:"Телефон"},
  fm_fact_chek:{uz:"Cheklar",en:"Receipts",ru:"Чеков"},
  fm_back:{uz:"Orqaga",en:"Back",ru:"Назад"},
  fm_col_firma:{uz:"Firma",en:"Firm",ru:"Фирма"},
  fm_col_stir:{uz:"STIR",en:"TIN",ru:"ИНН"},
  fm_col_sana:{uz:"Sana",en:"Date",ru:"Дата"},
  fm_col_chek:{uz:"Chek",en:"Receipt",ru:"Чек"},
  fm_col_summa:{uz:"Summa",en:"Amount",ru:"Сумма"},
  fm_col_tovar:{uz:"Tovar",en:"Items",ru:"Товаров"},
  fm_col_kun:{uz:"Kun",en:"Days",ru:"Дней"},
  fm_col_guruh:{uz:"Guruh",en:"Group",ru:"Группа"},
  fm_col_kassir:{uz:"Kassir",en:"Cashier",ru:"Кассир"},
  fm_det_title:{uz:"Qarz cheklari",en:"Credit receipts",ru:"Чеки в долг"},
  fm_bosh:{uz:"Bu filtrga mos firma topilmadi",en:"No firms match this filter",ru:"Нет фирм по этому фильтру"},
  fm_xls_title:{uz:"Qarz tahlili",en:"Debt analysis",ru:"Анализ долга"},
  fm_xls_filter:{uz:"Filtr",en:"Filter",ru:"Фильтр"},
  fm_xls_date:{uz:"Hisobot sanasi",en:"Report date",ru:"Дата отчёта"},
  kt_unknown:{uz:"Noma'lum",en:"Unknown",ru:"Неизвестно"},
  kt_col_name:{uz:"Nomi",en:"Name",ru:"Название"},
  kt_col_qty_cnt:{uz:"Mahsulot soni",en:"Product count",ru:"Кол-во товаров"},
  kt_col_qty:{uz:"Miqdor",en:"Qty",ru:"Кол-во"},
  kt_back_cat:{uz:"Kategoriya",en:"Category",ru:"Категория"},
  kt_back_label:{uz:"Kategoriyalar",en:"Categories",ru:"Категории"},
  kt_search_ph:{uz:"Kategoriya qidirish...",en:"Search category...",ru:"Поиск категории..."},
  kt_col_share:{uz:"Ulush",en:"Share",ru:"Доля выручки"},
  kt_unit_top:{uz:"kategoriya",en:"categories",ru:"категорий"},
  kt_unit_sub:{uz:"mahsulot",en:"products",ru:"товаров"},
  kt_unknown_cost_note:{uz:"kirim narxi yo'q",en:"no cost data",ru:"без цены прихода"},
  dt_today:{uz:"Bugun",en:"Today",ru:"Сегодня"},
  dt_yesterday:{uz:"Kecha",en:"Yesterday",ru:"Вчера"},
  dt_thisweek:{uz:"Bu hafta",en:"This week",ru:"Эта неделя"},
  dt_lastweek:{uz:"O'tgan hafta",en:"Last week",ru:"Прошлая неделя"},
  dt_thismonth:{uz:"Bu oy",en:"This month",ru:"Этот месяц"},
  dt_lastmonth:{uz:"O'tgan oy",en:"Last month",ru:"Прошлый месяц"},
  dt_all:{uz:"Butun davr",en:"Whole period",ru:"Весь период"},
  dt_3m_hist:{uz:"3 oy tarixi",en:"3 months history",ru:"3 мес. история"},
  dt_6m_hist:{uz:"6 oy tarixi",en:"6 months history",ru:"6 мес. история"},
  dt_from_jan:{uz:"1-yanvardan",en:"Since Jan 1",ru:"С 1 января"},
  dt_hist_lbl:{uz:"Grafik tarixi",en:"Chart history",ru:"История"},
  dt_from:{uz:"Boshlanish",en:"From",ru:"Начало"},
  dt_to:{uz:"Tugash",en:"To",ru:"Конец"},
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
  // umumiy filtrlar (p2/p3/p5/zakas)
  filt_btn:{uz:"Filtr",en:"Filter",ru:"Фильтр"},
  filt_clear:{uz:"Filtrlarni tozalash",en:"Clear filters",ru:"Очистить фильтры"},
  filt_all:{uz:"Barchasi",en:"All",ru:"Все"},
  filt_cat:{uz:"KATEGORIYA",en:"CATEGORY",ru:"КАТЕГОРИЯ"},
  filt_sub:{uz:"SUB-KATEGORIYA",en:"SUB-CATEGORY",ru:"ПОДКАТЕГОРИЯ"},
  filt_type:{uz:"TUR",en:"TYPE",ru:"ТИП"},
  filt_sup:{uz:"YETKAZIB BERUVCHI",en:"SUPPLIER",ru:"ПОСТАВЩИК"},
  filt_abc:{uz:"ABC",en:"ABC",ru:"ABC"},
  filt_amt:{uz:"QOLDIQ (TIIN OPTOM)",en:"STOCK (TIIN OPTOM)",ru:"ОСТАТОК (TIIN OPTOM)"},
  filt_stock:{uz:"ZAXIRA",en:"STOCK",ru:"ОСТАТОК"},
  filt_kirimkun:{uz:"OXIRGI KIRIMDAN NECHA KUN",en:"DAYS SINCE LAST ARRIVAL",ru:"ДНЕЙ С ПОСЛЕДНЕГО ПРИХОДА"},
  filt_sotuvkun:{uz:"OXIRGI SOTUVDAN NECHA KUN",en:"DAYS SINCE LAST SALE",ru:"ДНЕЙ С ПОСЛЕДНЕЙ ПРОДАЖИ"},
  zf_add:{uz:"Filtr qo'shish",en:"Add filter",ru:"Добавить фильтр"},
  zf_select_field:{uz:"Maydon tanlang",en:"Select field",ru:"Выберите поле"},
  zf_enable:{uz:"Filtrlarni yoqish",en:"Enable filters",ru:"Включить фильтры"},
  zf_op_gt:{uz:"dan ko'p",en:"more than",ru:"больше"},
  zf_op_lt:{uz:"dan kam",en:"less than",ru:"меньше"},
  zf_op_eq:{uz:"teng",en:"equal to",ru:"равно"},
  zf_op_never:{uz:"hech qachon",en:"never",ru:"никогда"},
  zf_unit_kun:{uz:"kun",en:"days",ru:"дн."},
  xls_noaktiv_sheet:{uz:"Noaktiv tovarlar",en:"Inactive items",ru:"Неактивные товары"},
  xls_noaktiv_all:{uz:"Barcha nofaol tovarlar",en:"All inactive items",ru:"Все неактивные товары"},
  xls_frozen_sum_prefix:{uz:"jami muzlagan summa",en:"total frozen amount",ru:"общая замороженная сумма"},
  xls_stock_value_prefix:{uz:"umumiy stok qiymati",en:"total stock value",ru:"общая стоимость остатка"},
  xls_product_count:{uz:"Mahsulot soni",en:"Product count",ru:"Количество товаров"},
  xls_asof:{uz:"holatiga",en:"as of",ru:"по состоянию на"},
  xls_status_muzlagan:{uz:"Holat: Stok bor",en:"Status: In stock",ru:"Статус: На складе"},
  xls_status_muzlagan_sub:{uz:"kun ichida sotuv yo'q",en:"days no sale",ru:"дн. без продаж"},
  xls_status_eskirgan:{uz:"Holat: Avval sotilgan, hozir stok yo'q",en:"Status: Sold before, no stock now",ru:"Статус: Продавался, сейчас нет на складе"},
  xls_status_yoq:{uz:"Holat: Yil boshidan sotuv yo'q, stok yo'q",en:"Status: No sale since Jan 1, no stock",ru:"Статус: Нет продаж с начала года, нет стока"},
  xls_status_all:{uz:"Holat: Muzlagan + Eskirgan + Sotuv yo'q (barchasi)",en:"Status: Frozen + Stale + Never sold (all)",ru:"Статус: Заморожено + Устарело + Не продавалось (всё)"},
  xls_title_muzlagan:{uz:"Muzlagan kapital",en:"Frozen capital",ru:"Замороженный капитал"},
  xls_title_eskirgan:{uz:"Eskirgan",en:"Stale",ru:"Устаревшие"},
  xls_title_yoq:{uz:"Sotuv yo'q",en:"Never sold",ru:"Не продавались"},
  xls_th_sku:{uz:"SKU",en:"SKU",ru:"SKU"},
  xls_th_name:{uz:"Mahsulot nomi",en:"Product name",ru:"Название товара"},
  xls_th_cat:{uz:"Kategoriya",en:"Category",ru:"Категория"},
  xls_th_buy_price:{uz:"Kelish narxi",en:"Buy price",ru:"Цена прихода"},
  xls_th_sell_price:{uz:"Sotilish narxi",en:"Sell price",ru:"Цена продажи"},
  xls_th_stock:{uz:"Stok",en:"Stock",ru:"Сток"},
  xls_th_frozen_sum:{uz:"Jami muzlagan summa",en:"Total frozen amount",ru:"Общая замороженная сумма"},
  xls_th_stock_value:{uz:"Stok qiymati",en:"Stock value",ru:"Стоимость остатка"},
  xls_th_last_sale:{uz:"Oxirgi sotuv",en:"Last sale",ru:"Последняя продажа"},
  xls_th_last_arrival:{uz:"Oxirgi kirim",en:"Last arrival",ru:"Последнее поступление"},
  xls_filters_label:{uz:"Qo'llangan filtrlar",en:"Applied filters",ru:"Применённые фильтры"},
  zf_short_cat:{uz:"Kategoriya",en:"Category",ru:"Категория"},
  zf_short_sup:{uz:"Yetkazib beruvchi",en:"Supplier",ru:"Поставщик"},
  zf_short_itype:{uz:"Tur",en:"Type",ru:"Тип"},
  zf_short_abc:{uz:"ABC",en:"ABC",ru:"ABC"},
  zf_short_stock:{uz:"Zaxira",en:"Stock",ru:"Остаток"},
  zf_short_kirimkun:{uz:"Kirimdan kun",en:"Days since arrival",ru:"Дней с прихода"},
  zf_short_sotuvkun:{uz:"Sotuvdan kun",en:"Days since sale",ru:"Дней с продажи"},
  amt_pos:{uz:"Musbat (>0)",en:"Positive (>0)",ru:"Положительный (>0)"},
  amt_zero:{uz:"Nol (0)",en:"Zero (0)",ru:"Ноль (0)"},
  amt_neg:{uz:"Manfiy (<0)",en:"Negative (<0)",ru:"Отрицательный (<0)"},
  abc_a_opt:{uz:"A — Lider",en:"A — Leader",ru:"A — Лидер"},
  abc_b_opt:{uz:"B — Potentsial",en:"B — Potential",ru:"B — Потенциал"},
  abc_c_opt:{uz:"C — Aylanmada yo'q",en:"C — Out of rotation",ru:"C — Не в обороте"},
  // Mahsulotlar (p2)
  p2_search_ph:{uz:"Nom, SKU yoki barcode...",en:"Name, SKU or barcode...",ru:"Название, SKU или штрихкод..."},
  close_graphs:{uz:"Grafiklarni yopish",en:"Close charts",ru:"Закрыть графики"},
  card_birga:{uz:"Birga KO'P sotilgan",en:"Frequently bought together",ru:"Часто покупают вместе"},
  card_kirim_tarixi:{uz:"Kirim tarixi",en:"Receiving history",ru:"История поступлений"},
  card_retail_ulgurji:{uz:"Retail va ulgurji savdo dinamikasi",en:"Retail vs wholesale sales trend",ru:"Динамика розничных и оптовых продаж"},
  necha_kunlik:{uz:"Necha kunlik:",en:"How many days:",ru:"Сколько дней:"},
  card_mahsulot_malumoti:{uz:"Mahsulot ma'lumoti",en:"Product info",ru:"Информация о товаре"},
  empty_mahsulot_tanlang:{uz:"Mahsulot tanlang",en:"Select a product",ru:"Выберите товар"},
  kg_alert:{uz:"KG mahsulot — narx 1 kg uchun",en:"KG product — price is per 1 kg",ru:"Товар в КГ — цена за 1 кг"},
  th_num:{uz:"#",en:"#",ru:"#"},
  th_name:{uz:"MAHSULOT NOMI",en:"PRODUCT NAME",ru:"НАЗВАНИЕ ТОВАРА"},
  th_sku:{uz:"SKU",en:"SKU",ru:"SKU"},
  th_cat:{uz:"KATEGORIYA",en:"CATEGORY",ru:"КАТЕГОРИЯ"},
  th_olchov:{uz:"O'LCHOV",en:"UNIT",ru:"ЕД. ИЗМ."},
  th_taminotchi:{uz:"TA'MINOTCHI",en:"SUPPLIER",ru:"ПОСТАВЩИК"},
  th_narxi:{uz:"NARXI",en:"PRICE",ru:"ЦЕНА"},
  th_sotuv_holati:{uz:"SOTUV HOLATI",en:"SALE STATUS",ru:"СТАТУС ПРОДАЖ"},
  th_abc:{uz:"ABC",en:"ABC",ru:"ABC"},
  p2_not_found:{uz:"Mahsulot topilmadi — filtrlarni o'zgartiring",en:"No products found — try changing filters",ru:"Товары не найдены — измените фильтры"},
  p2_cnt_suffix:{uz:"ta mahsulot",en:"products",ru:"товаров"},
  kelish_lc:{uz:"kelish",en:"cost",ru:"закуп"},
  sotuv_yoq_davr:{uz:"Bu davrda sotuv yo'q",en:"No sale in this period",ru:"Нет продаж за этот период"},
  oxirgi_kuni_sotildi:{uz:"Oxirgi kuni sotildi",en:"Sold on the last day",ru:"Продано в последний день"},
  kun_oldin:{uz:"kun oldin",en:"days ago",ru:"дн. назад"},
  // ABC tahlili (p3)
  abc3_a_lbl:{uz:"A guruh — Lider tovarlar",en:"Group A — Leader products",ru:"Группа A — Лидеры"},
  abc3_b_lbl:{uz:"B guruh — Potentsial tovarlar",en:"Group B — Potential products",ru:"Группа B — Потенциальные"},
  abc3_c_lbl:{uz:"C guruh — Aylanmada yo'q",en:"Group C — Out of rotation",ru:"Группа C — Не в обороте"},
  abc3_unit:{uz:"ta mahsulot turi",en:"product types",ru:"видов товара"},
  abc3_a_desc:{uz:"Eng muhim mahsulotlar — zaxira hech qachon tugamasin!",en:"The most important products — stock should never run out!",ru:"Самые важные товары — запас никогда не должен закончиться!"},
  abc3_b_desc:{uz:"O'rta muhimlikdagi mahsulotlar — aksiya bilan A guruhga o'tkazish mumkin.",en:"Medium-importance products — can be promoted to group A with a campaign.",ru:"Товары средней важности — акцией можно перевести в группу A."},
  abc3_monthly_h:{uz:"Oylik hisobot — tushum tendensiyasi",en:"Monthly report — revenue trend",ru:"Месячный отчёт — тенденция выручки"},
  abc3_donut_h:{uz:"Tushum ulushi",en:"Revenue share",ru:"Доля выручки"},
  abc3_bar_h:{uz:"Top 15 mahsulot — tushum bo'yicha (mln UZS)",en:"Top 15 products by revenue (mln UZS)",ru:"Топ 15 товаров по выручке (млн UZS)"},
  abc3_tab_a:{uz:"Lider tovarlar — A",en:"Leader products — A",ru:"Лидеры — A"},
  abc3_tab_b:{uz:"Potentsial tovarlar — B",en:"Potential products — B",ru:"Потенциальные — B"},
  abc3_tab_c:{uz:"Aylanmada yo'q — C",en:"Out of rotation — C",ru:"Не в обороте — C"},
  abc3_tab_c1:{uz:"Olib tashlash — C1",en:"To delist — C1",ru:"К удалению — C1"},
  abc3_search_ph:{uz:"Istalgan guruhdan mahsulot qidiring...",en:"Search a product in any group...",ru:"Поиск товара в любой группе..."},
  abc3_th_name:{uz:"Mahsulot nomi",en:"Product name",ru:"Название товара"},
  filt_cat2:{uz:"Kategoriya",en:"Category",ru:"Категория"},
  filt_subcat2:{uz:"Subkategoriya",en:"Subcategory",ru:"Подкатегория"},
  abc3_th_rev:{uz:"Tushum",en:"Revenue",ru:"Выручка"},
  abc3_th_rec:{uz:"Chek",en:"Receipts",ru:"Чеки"},
  abc3_th_last:{uz:"Oxirgi kun",en:"Last day",ru:"Последний день"},
  th_sotuv_holati2:{uz:"Sotuv holati",en:"Sale status",ru:"Статус продаж"},
  oxirgi_kirim:{uz:"Oxirgi kirim",en:"Last arrival",ru:"Последнее поступление"},
  topilmadi:{uz:"Topilmadi",en:"Not found",ru:"Не найдено"},
  kg_tovar:{uz:"KG tovar",en:"KG product",ru:"Товар в КГ"},
  jami_tushum:{uz:"Jami tushum",en:"Total revenue",ru:"Общая выручка"},
  narxi_1:{uz:"Narxi (1",en:"Price (1",ru:"Цена (1"},
  cheklar_soni:{uz:"Cheklar soni",en:"Number of receipts",ru:"Количество чеков"},
  tushum_ulushi:{uz:"Tushum ulushi",en:"Revenue share",ru:"Доля выручки"},
  oxirgi_sotilgan:{uz:"Oxirgi sotilgan",en:"Last sold",ru:"Последняя продажа"},
  kunlik_ortacha:{uz:"Kunlik ortacha",en:"Daily average",ru:"Среднее в день"},
  jami_sotilgan:{uz:"Jami sotilgan",en:"Total sold",ru:"Всего продано"},
  nega_guruhda:{uz:"Nega",en:"Why is it in group",ru:"Почему в группе"},
  guruhda_savol:{uz:"guruhda?",en:"?",ru:"?"},
  nima_qk:{uz:"Nima qilish kerak?",en:"What should be done?",ru:"Что нужно делать?"},
  ulgurji_ulushi:{uz:"Ulgurji ulushi",en:"Wholesale share",ru:"Доля опта"},
  ulgurji_ulushi_hint:{uz:"Ushbu tovar tushumining necha foizi ulgurji (optom) savdodan — faqat ma'lumot uchun, ABC guruhga ta'sir qilmaydi (ABC umumiy tushum asosida hisoblanadi)",en:"Share of this product's revenue from wholesale — informational only, does not affect the ABC group (ABC is based on total revenue)",ru:"Какая доля выручки товара пришлась на опт — только для информации, не влияет на группу ABC (ABC рассчитывается по общей выручке)"},
  abc3_c1_hint:{uz:"C1 — 20 kundan ko'p sotilmagan, olib tashlash tavsiya etiladi",en:"C1 — not sold in over 20 days, recommended to remove",ru:"C1 — не продавался более 20 дней, рекомендуется вывести"},
  abc3_c2_hint:{uz:"C2 — savdosi pasayish tendensiyasida",en:"C2 — sales are in a declining trend",ru:"C2 — продажи в тенденции снижения"},
  abc3_c3_hint:{uz:"C3 — barqaror, lekin kam hajmda sotiladi",en:"C3 — stable but low-volume sales",ru:"C3 — стабильные, но малообъёмные продажи"},
  oylik_prev:{uz:"o'tgan oyga nisbatan",en:"vs previous month",ru:"по сравнению с прошлым месяцем"},
  filt_sup2:{uz:"Ta'minotchi",en:"Supplier",ru:"Поставщик"},
  filt_type2:{uz:"Mahsulot turi",en:"Unit type",ru:"Тип товара"},
  filt_trend:{uz:"Savdo tendensiyasi",en:"Sales trend",ru:"Тенденция продаж"},
  trend_up:{uz:"O'sish",en:"Growing",ru:"Рост"},
  trend_down:{uz:"Pasayish",en:"Declining",ru:"Снижение"},
  trend_stable:{uz:"Barqaror",en:"Stable",ru:"Стабильно"},
  trend_new:{uz:"Yangi paydo bo'lgan",en:"Newly appeared",ru:"Новый"},
  // Stock (p5)
  p5_back:{uz:"Mahsulotlarga qaytish",en:"Back to Products",ru:"Назад к товарам"},
  z_back_zaxira:{uz:"← Zaxiraga qaytish",en:"← Back to Stock",ru:"← К складу"},
  z_back_zakas:{uz:"← Zakasga qaytish",en:"← Back to Order",ru:"← К заказу"},
  p5_aktiv:{uz:"Aktiv",en:"Active",ru:"Активные"},
  p5_noaktiv:{uz:"Noaktiv",en:"Inactive",ru:"Неактивные"},
  sig_kritik:{uz:"Shoshilinch zakas",en:"Urgent reorder",ru:"Срочный заказ"},
  sig_kritik_sub:{uz:"Sotildi → to'xtadi → stok yo'q",en:"Sold → stopped → out of stock",ru:"Продавалось → остановилось → нет на складе"},
  sig_urgent:{uz:"Tugashga yaqin",en:"Running low",ru:"Заканчивается"},
  sig_urgent_sub:{uz:"Stok ≤5 yoki ≤10 kunda tugaydi",en:"Stock ≤5 or runs out in ≤10 days",ru:"Остаток ≤5 или закончится за ≤10 дней"},
  sig_tekshir:{uz:"Tekshirish kerak",en:"Needs check",ru:"Нужна проверка"},
  sig_tekshir_sub:{uz:"Stok bor, sotuv yo'q",en:"In stock, no sales",ru:"Есть на складе, нет продаж"},
  sig_excess:{uz:"Ortiqcha stok",en:"Excess stock",ru:"Избыток на складе"},
  sig_excess_sub:{uz:"90+ kunlik zaxira",en:"90+ days of stock",ru:"Запас на 90+ дней"},
  sig_normal:{uz:"Normal",en:"Normal",ru:"Норма"},
  sig_normal_sub:{uz:"Stok yetarli, harakat kerak emas",en:"Stock sufficient, no action needed",ru:"Запас достаточен, действий не требуется"},
  sig_sekin:{uz:"Sekin sotiladi",en:"Slow seller",ru:"Медленные продажи"},
  sig_sekin_sub:{uz:"30 kunda emas, 31-60 kunda sotilgan",en:"Not in 30 days, sold in days 31-60",ru:"Не за 30 дней, продано за 31-60 дней"},
  sig_muzlagan:{uz:"Muzlagan kapital",en:"Frozen capital",ru:"Замороженный капитал"},
  sig_eskirgan:{uz:"Eskirgan",en:"Stale",ru:"Устаревшие"},
  sig_yoq:{uz:"Sotuv yo'q",en:"Never sold",ru:"Не продавались"},
  sig_noaktiv_all:{uz:"Jami",en:"Total",ru:"Всего"},
  sig_noaktiv_all_sub:{uz:"Barcha nofaol tovarlar",en:"All inactive items",ru:"Все неактивные товары"},
  mz_banner_sub:{uz:"ta mahsulot stokda bor, lekin 60 kunda sotilmagan.",en:"products are in stock but haven't sold in 60 days.",ru:"товаров в наличии, но не продавались 60 дней."},
  stok_qiymati:{uz:"Stok qiymati",en:"Stock value",ru:"Стоимость запаса"},
  export_btn:{uz:"Export",en:"Export",ru:"Экспорт"},
  mz_top_cats:{uz:"Top kategoriyalar (muzlagan kapital)",en:"Top categories (frozen capital)",ru:"Топ категорий (замороженный капитал)"},
  ftab_tekshir:{uz:"Tekshirish",en:"Check",ru:"Проверка"},
  ftab_ortiqcha:{uz:"Ortiqcha",en:"Excess",ru:"Избыток"},
  z_search_ph:{uz:"Mahsulot, SKU qidirish...",en:"Search product, SKU...",ru:"Поиск товара, SKU..."},
  zk_open:{uz:"Zakas ro'yxati",en:"Reorder list",ru:"Список заказа"},
  z_th_mahsulot:{uz:"Mahsulot",en:"Product",ru:"Товар"},
  z_th_stok:{uz:"Stok",en:"Stock",ru:"Остаток"},
  z_th_kunlik:{uz:"Kunlik o'rtacha",en:"Daily average",ru:"Среднее в день"},
  z_th_yetadi:{uz:"Kunga yetadi",en:"Days left",ru:"Хватит на (дней)"},
  z_th_kelish:{uz:"Kelish narxi",en:"Cost price",ru:"Цена прихода"},
  z_th_sotilish:{uz:"Sotilish narxi",en:"Selling price",ru:"Цена продажи"},
  z_th_oxirgi:{uz:"Oxirgi sotuv",en:"Last sale",ru:"Последняя продажа"},
  z_th_kelgan:{uz:"Oxirgi kelgan",en:"Last arrival",ru:"Последнее поступление"},
  z_th_signal:{uz:"Signal",en:"Signal",ru:"Сигнал"},
  z_val_tugagan:{uz:"Tugagan",en:"Out of stock",ru:"Закончился"},
  z_val_nomalum:{uz:"Noma'lum",en:"Unknown",ru:"Неизвестно"},
  z_unit_yil:{uz:"yil",en:"y",ru:"г"},
  z_unit_oy:{uz:"oy",en:"mo",ru:"мес"},
  z_unit_ta_kun:{uz:"ta/kun",en:"/day",ru:"шт/день"},
  z_never_sold:{uz:"Hech sotilmagan",en:"Never sold",ru:"Никогда не продавался"},
  z_not_sold:{uz:"Sotilmagan",en:"Not sold",ru:"Не продан"},
  z_sold_days_ago:{uz:"kun oldin sotilgan",en:"days ago",ru:"дн. назад"},
  z_topilmadi:{uz:"bo'yicha mahsulot topilmadi",en:"no products found",ru:"товары не найдены по запросу"},
  z_malumot_yoq:{uz:"Bu filtrda ma'lumot yo'q",en:"No data for this filter",ru:"Нет данных по этому фильтру"},
  z_sig_kritik:{uz:"Shoshilinch zakas",en:"Urgent reorder",ru:"Срочный заказ"},
  z_sig_tekshir:{uz:"Tekshirish kerak",en:"Needs check",ru:"Нужна проверка"},
  z_sig_urgent:{uz:"Tugashga yaqin",en:"Running low",ru:"Заканчивается"},
  z_sig_excess:{uz:"Ortiqcha stok",en:"Excess stock",ru:"Избыток на складе"},
  z_sig_normal:{uz:"Normal",en:"Normal",ru:"Норма"},
  z_sig_sekin:{uz:"Sekin sotiladi",en:"Slow selling",ru:"Медленные продажи"},
  z_sig_muzlagan:{uz:"Muzlagan kapital",en:"Frozen capital",ru:"Замороженный капитал"},
  z_sig_eskirgan:{uz:"Eskirgan — avval sotilgan, stok yo'q",en:"Stale — sold before, no stock now",ru:"Устаревшие — продавался, сток нулевой"},
  z_sig_yoq:{uz:"Hech sotilmagan, stok yo'q",en:"Never sold, no stock",ru:"Не продавался, стока нет"},
  reason_neg_stock:{uz:"Manfiy stok — haqiqiy qoldiq noma'lum, kirim va hisobni tekshiring",en:"Negative stock — actual balance unknown, check receipts and accounting",ru:"Отрицательный остаток — фактический остаток неизвестен, проверьте приход и учёт"},
  reason_stock_out_sold:{uz:"Stok tugagan, mahsulot sotilgan — darhol zakas",en:"Stock is out, product was selling — reorder immediately",ru:"Сток закончился, товар продавался — срочный заказ"},
  reason_stock_out_effective:{uz:"Stok amalda tugash darajasida — darhol zakas",en:"Stock is effectively depleted — reorder immediately",ru:"Сток фактически на нуле — срочный заказ"},
  reason_check_stock_lost:{uz:"Sotilishi kerak, lekin stok turibdi — yo'qolgan/qolib ketgan bo'lishi mumkin",en:"Should be selling, but stock remains — may be lost or misplaced",ru:"Должен продаваться, но сток есть — возможно, потерян или залежался"},
  reason_sold_before_stopped:{uz:"Avval sotilardi, hozir stok ham yo'q, savdo ham to'xtagan",en:"Used to sell, now no stock and sales have stopped",ru:"Раньше продавался, сейчас нет ни стока, ни продаж"},
  reason_low_stock_risk:{uz:"Stok juda kam — keyingi oy ko'proq ketsa tugab qoladi",en:"Stock is very low — will run out if next month's demand rises",ru:"Сток очень мал — закончится при росте спроса в следующем месяце"},
  reason_active_selling_days_left:{uz:"Faol sotilyapti, stok {n} kunda tugaydi",en:"Selling actively, stock will run out in {n} days",ru:"Активно продаётся, сток закончится через {n} дн."},
  reason_excess_days_stock:{uz:"Joriy tezlikda {n} kunlik zaxira — ortiqcha",en:"At current pace, {n} days of stock — excess",ru:"При текущем темпе запас на {n} дн. — избыток"},
  reason_excess_no_demand:{uz:"Retail talab deyarli yo'q, ko'p stok turibdi — ortiqcha/o'lik zaxira",en:"Almost no retail demand, large stock remains — excess/dead stock",ru:"Розничного спроса почти нет, сток большой — избыток/мёртвый запас"},
  reason_excess_days_stock_3m:{uz:"Joriy tezlikda {n} kunlik (3 oydan ortiq) zaxira — ortiqcha",en:"At current pace, {n} days (over 3 months) of stock — excess",ru:"При текущем темпе запас на {n} дн. (более 3 мес.) — избыток"},
  reason_stable_ok:{uz:"Sotuv barqaror, stok yetarli — harakat kerak emas",en:"Sales are stable, stock is sufficient — no action needed",ru:"Продажи стабильны, стока достаточно — действий не требуется"},
  reason_frozen_zero_sold:{uz:"Stokda bor, lekin hech qanday sotuv qayd etilmagan",en:"In stock, but no sales recorded at all",ru:"Есть в наличии, но продаж совсем не зафиксировано"},
  reason_no_stock_zero_sold:{uz:"Stok yo'q, sotuv ham qayd etilmagan",en:"No stock, and no sales recorded",ru:"Стока нет, продаж тоже не зафиксировано"},
  reason_frozen_no_history:{uz:"Stokda bor, lekin sotuv tarixi yo'q",en:"In stock, but no sales history",ru:"Есть в наличии, но истории продаж нет"},
  reason_no_stock_no_history:{uz:"Stok yo'q, sotuv tarixi ham yo'q",en:"No stock, and no sales history either",ru:"Стока нет, истории продаж тоже нет"},
  reason_last_sold_days_ago_no_stock:{uz:"Oxirgi marta {n} kun oldin sotilgan, hozir stok yo'q",en:"Last sold {n} days ago, no stock now",ru:"Последний раз продан {n} дн. назад, сейчас стока нет"},
  reason_slow_recent:{uz:"So'nggi 30 kunda sotilmagan, {n} kun oldin sotilgan — sekinlashgan, kuzating",en:"Not sold in last 30 days, last sold {n} days ago — slowing down, monitor",ru:"Не продавался последние 30 дней, последний раз {n} дн. назад — замедлился, наблюдайте"},
  reason_last_sold_days_ago:{uz:"Oxirgi marta {n} kun oldin sotilgan",en:"Last sold {n} days ago",ru:"Последний раз продан {n} дн. назад"},
  reason_no_sale_history:{uz:"Sotuv tarixi yo'q",en:"No sales history",ru:"Истории продаж нет"},
  reason_no_stock_jan1:{uz:"Stok yo'q, Jan 1 dan sotuv qayd etilmagan",en:"No stock, no sales recorded since Jan 1",ru:"Стока нет, с 1 января продаж не зафиксировано"},
  yuklanmoqda:{uz:"Yuklanmoqda...",en:"Loading...",ru:"Загрузка..."},
  // Zakas (p7)
  nav_p7:{uz:"Buyurtma",en:"Orders",ru:"Заказ"},
  p7_title:{uz:"Buyurtma",en:"Orders",ru:"Заказ"},
  p7_sub:{uz:"Yetkazib beruvchi bo'yicha tavsiya etilgan buyurtma ro'yxati — Stock signallaridan avtomatik yangilanadi",en:"Recommended order list by supplier — updates automatically from Stock signals",ru:"Рекомендуемый список заказа по поставщикам — обновляется автоматически из сигналов склада"},
  zk_sum_sup:{uz:"yetkazib beruvchi",en:"suppliers",ru:"поставщиков"},
  zk_depth_normal:{uz:"Muntazam zakas",en:"Regular order",ru:"Обычный заказ"},
  zk_depth_chuqur:{uz:"Chuqur zakas",en:"Deep order",ru:"Глубокий заказ"},
  zk_back_list:{uz:"Ortga",en:"Back",ru:"Назад"},
  zk_confirm_btn:{uz:"Zakas berildi",en:"Order sent",ru:"Заказ отправлен"},
  zk_confirm_cancel:{uz:"Bekor qilish",en:"Unmark",ru:"Отменить"},
  zk_unconfirm_warn:{uz:"Haqiqatan ham bu supplierni zakas berildi ro'yxatidan olib tashlaysizmi?",en:"Remove this supplier from confirmed orders?",ru:"Убрать поставщика из подтверждённых заказов?"},
  zk_sl_nom:{uz:"Supplier",en:"Supplier",ru:"Поставщик"},
  zk_sl_zakas:{uz:"Zakas",en:"Orders",ru:"Заказ"},
  zk_sl_chuqur:{uz:"Chuqur",en:"Deep",ru:"Глубокий"},
  zk_sl_jami:{uz:"Jami",en:"Total",ru:"Всего"},
  zk_stat_all:{uz:"jami supplier",en:"total suppliers",ru:"всего поставщиков"},
  zk_stat_need:{uz:"zakasga muhtoj",en:"need orders",ru:"нужен заказ"},
  zk_no_need_sep:{uz:"Zakasga tushmagan supplierlar",en:"No pending orders",ru:"Без заказа"},
  zk_sum_items:{uz:"tovar",en:"products",ru:"товаров"},
  zk_sum_amt:{uz:"jami zakas qiymati",en:"total order value",ru:"общая сумма заказа"},
  zk_search_ph:{uz:"Mahsulot, SKU, barcode yoki supplier...",en:"Product, SKU, barcode or supplier...",ru:"Товар, SKU, штрихкод или поставщик..."},
  zk_detail_search_ph:{uz:"Bu supplierda qidirish: nom, SKU, barcode...",en:"Search this supplier: name, SKU, barcode...",ru:"Поиск у поставщика: название, SKU, штрихкод..."},
  zk_all_sup:{uz:"Barcha yetkazib beruvchilar",en:"All suppliers",ru:"Все поставщики"},
  zk_all_cat:{uz:"Tanlash",en:"Select",ru:"Выбрать"},
  zk_all_subcat:{uz:"Tanlash",en:"Select",ru:"Выбрать"},
  zk_col_product:{uz:"Mahsulot",en:"Product",ru:"Товар"},
  zk_col_stock:{uz:"Stok",en:"Stock",ru:"Остаток"},
  zk_stock_tt_calc:{uz:"Hisoblangan stok",en:"Calculated stock",ru:"Расчётный остаток"},
  zk_stock_tt_invan:{uz:"Invan stok",en:"Invan stock",ru:"Остаток Invan"},
  zk_stock_tt_evidence:{uz:"0'langan marta:",en:"reset-to-zero events:",ru:"раз обнулено:"},
  zk_stock_tt_checked:{uz:"Tugab qolgan davri aniqlanib, qiymat qayta hisoblangan",en:"Stockout period detected, value recomputed",ru:"Обнаружен период отсутствия, значение пересчитано"},
  zk_stock_tt_anchor:{uz:"nol nuqta:",en:"zero point:",ru:"точка отсчёта:"},
  zk_col_lk:{uz:"Oxirgi kirimdan",en:"From last arrival",ru:"С последнего прихода"},
  zk_lk_tt:{uz:"Oxirgi kirimda {q} dona kelgan ({d}), o'shandan buyon {s} dona sotilgan → {r} dona qolgan",en:"Last arrival: {q} units on {d}, {s} sold since → {r} left",ru:"Последний приход: {q} шт ({d}), продано {s} → осталось {r}"},
  zk_stock_tt_conf_hi:{uz:"yuqori ishonch",en:"high confidence",ru:"высокая надёжность"},
  zk_stock_tt_conf_mid:{uz:"o'rta ishonch",en:"medium confidence",ru:"средняя надёжность"},
  zk_stock_tt_conf_stale:{uz:"eskirgan, qayta tekshirish tavsiya etiladi",en:"stale, re-check recommended",ru:"устарело, рекомендуется проверить"},
  zk_stock_th_invan:{uz:"Invan",en:"Invan",ru:"Invan"},
  zk_stock_th_calc:{uz:"Hisob.",en:"Calc.",ru:"Расч."},
  zk_col_daily:{uz:"Kunlik o'rtacha",en:"Daily avg",ru:"Средн. в день"},
  zk_col_days_left:{uz:"Qolgan kun",en:"Days left",ru:"Дней осталось"},
  zk_col_extra_days:{uz:"Qo'shimcha kun",en:"Extra days",ru:"Доп. дни"},
  zk_col_order:{uz:"Zakas",en:"Order",ru:"Заказ"},
  zk_col_status:{uz:"Holat",en:"Status",ru:"Статус"},
  zk_col_cost:{uz:"Narx",en:"Cost",ru:"Цена"},
  zk_col_sum:{uz:"Summa",en:"Amount",ru:"Сумма"},
  zk_cost_approx_tt:{uz:"Taxminiy narx - bu tovar hali birorta marta kirim orqali kelmagan (katalog narxidan olindi)",en:"Approximate price - this product has not yet arrived via any purchase order (taken from catalog price)",ru:"Приблизительная цена - этот товар ещё ни разу не поступал по приходу (взята из цены каталога)"},
  zk_checked_total_label:{uz:"Belgilangan summa",en:"Selected total",ru:"Сумма отмеченных"},
  zk_col_barcode:{uz:"Shtrix-kod",en:"Barcode",ru:"Штрих-код"},
  zk_col_qty:{uz:"Soni",en:"Qty",ru:"Кол-во"},
  zk_file_menu_excel:{uz:"Excel yuklash",en:"Upload Excel",ru:"Загрузить Excel"},
  zk_excel_check_menu:{uz:"Excel tekshiruv (shtrix-kod)",en:"Excel check (barcode)",ru:"Проверка Excel (штрих-код)"},
  zk_file_menu_demo:{uz:"Demo (sinov)",en:"Demo (test)",ru:"Демо (тест)"},
  zk_file_menu_invan:{uz:"Invan'ga yuborish",en:"Send to Invan",ru:"Отправить в Invan"},
  zk_file_pick_supplier_first:{uz:"Avval ta'minotchini tanlang",en:"Please select a supplier first",ru:"Сначала выберите поставщика"},
  zk_file_lib_load_fail:{uz:"Excel kutubxonasi yuklanmadi, qayta urinib ko'ring",en:"Excel library failed to load, please try again",ru:"Библиотека Excel не загрузилась, попробуйте снова"},
  zk_file_empty_file:{uz:"Fayl bo'sh",en:"File is empty",ru:"Файл пуст"},
  zk_file_no_header:{uz:"Ustun sarlavhalari (nomi/soni/narxi) topilmadi",en:"Column headers (name/qty/price) not found",ru:"Заголовки столбцов (наименование/кол-во/цена) не найдены"},
  zk_file_read_error:{uz:"Faylni o'qishda xato",en:"Error reading file",ru:"Ошибка чтения файла"},
  zk_file_no_rows:{uz:"Faylda tovar qatori topilmadi",en:"No product rows found in file",ru:"В файле не найдено строк товаров"},
  zk_file_modal_title:{uz:"Katalogda topilmagan tovarlar",en:"Products not found in catalog",ru:"Товары, не найденные в каталоге"},
  zk_file_modal_export:{uz:"Excel yuklab olish",en:"Download Excel",ru:"Скачать Excel"},
  zk_file_empty_hint:{uz:"Ta'minotchini tanlab, undan kelgan hujjatni (накладная, buyurtma tasdig'i) Excel formatida yuklang — tizim tovarlarni shtrix-kod bo'yicha aniqlab, mavjud/mavjud emasligini ajratadi, soni va narxni fayldagidek oladi.",en:"Select a supplier and upload their document (invoice, order confirmation) in Excel format — the system will identify products by barcode, separate matched/unmatched, and take quantity and price exactly as in the file.",ru:"Выберите поставщика и загрузите пришедший от него документ (накладная, подтверждение заказа) в формате Excel — система определит товары по штрих-коду, разделит найденные/не найденные, возьмёт количество и цену точно как в файле."},
  zk_file_found_label:{uz:"ta topildi (bizda bor)",en:"found (in our catalog)",ru:"найдено (есть у нас)"},
  zk_file_all_found:{uz:"hammasi topildi",en:"all found",ru:"всё найдено"},
  zk_file_unmatched_view:{uz:"ta topilmadi — ko'rish",en:"not found — view",ru:"не найдено — посмотреть"},
  zk_file_load_excel_first:{uz:"Avval Excel yuklang",en:"Please upload Excel first",ru:"Сначала загрузите Excel"},
  zk_file_no_checked:{uz:"Hech qanday tovar belgilanmagan",en:"No products selected",ru:"Ни один товар не отмечен"},
  zk_file_sending:{uz:"Yuborilmoqda...",en:"Sending...",ru:"Отправка..."},
  zk_file_confirm_prod:{uz:"🔴 HAQIQIY INVAN — bu sinov emas!\n\n{n} ta tovar (\"{sup}\") HAQIQIY Tiin Optom Invan akkauntiga, qoralama (Yangi) buyurtma sifatida yuboriladi.\n\nDavom etamizmi?",en:"🔴 REAL INVAN — this is not a test!\n\n{n} products (\"{sup}\") will be sent to the REAL Tiin Optom Invan account as a draft (New) order.\n\nContinue?",ru:"🔴 РЕАЛЬНЫЙ INVAN — это не тест!\n\n{n} товаров (\"{sup}\") будут отправлены в РЕАЛЬНЫЙ аккаунт Tiin Optom Invan как черновик (Новый) заказ.\n\nПродолжить?"},
  zk_file_confirm_demo:{uz:"⚠️ SINOV REJIMI — bu HAQIQIY Invan emas, DEMO (test) akkauntga yuboriladi.\n\n{n} ta tovar (\"{sup}\") demo buyurtmaga qo'shiladi. Haqiqiy ta'minotchiga, haqiqiy Invan'ga hech narsa yuborilmaydi.\n\nDavom etamizmi?",en:"⚠️ TEST MODE — this is NOT the real Invan, it goes to the DEMO (test) account.\n\n{n} products (\"{sup}\") will be added to a demo order. Nothing is sent to the real supplier or real Invan.\n\nContinue?",ru:"⚠️ ТЕСТОВЫЙ РЕЖИМ — это НЕ реальный Invan, отправляется в ДЕМО (тестовый) аккаунт.\n\n{n} товаров (\"{sup}\") будут добавлены в демо-заказ. Реальному поставщику, реальному Invan ничего не отправляется.\n\nПродолжить?"},
  zk_file_success_prod:{uz:"✓ HAQIQIY Invan'ga yuborildi!\n\nBuyurtma № {po}\nQo'shilgan tovar: {n}",en:"✓ Sent to REAL Invan!\n\nOrder No. {po}\nProducts added: {n}",ru:"✓ Отправлено в РЕАЛЬНЫЙ Invan!\n\nЗаказ № {po}\nДобавлено товаров: {n}"},
  zk_file_success_demo:{uz:"✓ DEMO Invan'ga yuborildi (bu SINOV, haqiqiy emas)!\n\nBuyurtma № {po} (demo akkaunt)\nQo'shilgan tovar: {n}",en:"✓ Sent to DEMO Invan (this is a TEST, not real)!\n\nOrder No. {po} (demo account)\nProducts added: {n}",ru:"✓ Отправлено в ДЕМО Invan (это ТЕСТ, не реально)!\n\nЗаказ № {po} (демо аккаунт)\nДобавлено товаров: {n}"},
  zk_file_unmapped_suffix:{uz:"Topilmadi (katalogda yo'q):",en:"Not found (not in catalog):",ru:"Не найдено (нет в каталоге):"},
  zk_file_error_prefix:{uz:"Xatolik:",en:"Error:",ru:"Ошибка:"},
  zk_file_unknown_error:{uz:"noma'lum",en:"unknown",ru:"неизвестно"},
  zk_file_conn_error:{uz:"Ulanish xatosi:",en:"Connection error:",ru:"Ошибка соединения:"},
  zk_sup_open_first:{uz:"Avval ta'minotchini oching",en:"Please open a supplier first",ru:"Сначала откройте поставщика"},
  zk_bc_no_barcode:{uz:"Faylda shtrix-kod topilmadi. Fayl ichida shtrix-kod ustuni (yoki barcode raqamlari) borligini tekshiring.",en:"No barcodes found in the file. Check that the file has a barcode column (or barcode numbers).",ru:"В файле не найдено штрих-кодов. Проверьте, есть ли в файле столбец со штрих-кодами (или сами номера)."},
  zk_send_note_prod:{uz:"Yangi tabda Invan \"Buyurtmalar\" ochildi - ko'rib, Open holatiga o'tkazing.",en:"Invan \"Orders\" opened in a new tab - review it and switch the order to Open status.",ru:"Страница «Заказы» Invan открылась в новой вкладке - проверьте и переведите заказ в статус Open."},
  zk_send_note_demo:{uz:"Bu haqiqiy ta'minotchiga YUBORILMADI - faqat sinov uchun demo Invan akkauntida ko'rinadi. Yangi tabda Invan buyurtmalar ro'yxati ochildi.",en:"This was NOT sent to the real supplier - it only appears in the demo Invan account for testing. Invan orders list opened in a new tab.",ru:"Это НЕ было отправлено реальному поставщику - отображается только в демо-аккаунте Invan для теста. Список заказов Invan открылся в новой вкладке."},
  zk_invan_login_title:{uz:"Invan hisobingizga kiring",en:"Sign in to your Invan account",ru:"Войдите в свой аккаунт Invan"},
  zk_invan_login_desc:{uz:"Buyurtma Invan'da SIZNING nomingizdan yaratilishi uchun, shaxsiy Invan login (telefon+parol) bilan kiring. Parolingiz saqlanmaydi, faqat Invan'ga bir martalik tekshiruv uchun yuboriladi.",en:"To have the order created in Invan under YOUR name, sign in with your personal Invan phone+password. Your password is not stored - it is only forwarded to Invan once, to verify you.",ru:"Чтобы заказ в Invan создавался от ВАШЕГО имени, войдите со своим личным логином Invan (телефон+пароль). Пароль не сохраняется - он лишь однократно передаётся в Invan для проверки."},
  zk_invan_phone_ph:{uz:"Telefon (masalan 998901234567)",en:"Phone (e.g. 998901234567)",ru:"Телефон (напр. 998901234567)"},
  zk_invan_pass_ph:{uz:"Parol",en:"Password",ru:"Пароль"},
  zk_invan_login_btn:{uz:"Kirish",en:"Sign in",ru:"Войти"},
  zk_invan_cancel_btn:{uz:"Bekor qilish",en:"Cancel",ru:"Отмена"},
  zk_invan_login_wait:{uz:"Kirilmoqda...",en:"Signing in...",ru:"Вход..."},
  zk_invan_login_fail:{uz:"Kirish xato:",en:"Sign-in failed:",ru:"Ошибка входа:"},
  zk_invan_fill_both:{uz:"Telefon va parolni kiriting",en:"Enter phone and password",ru:"Введите телефон и пароль"},
  zk_invan_switch_account_menu:{uz:"Invan hisobini almashtirish",en:"Switch Invan account",ru:"Сменить аккаунт Invan"},
  zk_invan_switched:{uz:"✓ Invan hisobi almashtirildi: {name}",en:"✓ Invan account switched: {name}",ru:"✓ Аккаунт Invan изменён: {name}"},
  zk_invan_token_expired:{uz:"Invan sessiyangiz eskirgan - qaytadan kiring va yana urinib ko'ring.",en:"Your Invan session expired - please sign in again and retry.",ru:"Ваша сессия Invan истекла - войдите снова и повторите попытку."},
  zk_invan_sending_as:{uz:"Invan hisobi: {name}",en:"Invan account: {name}",ru:"Аккаунт Invan: {name}"},
  zk_invan_dup_warn:{uz:"⚠️ Diqqat: siz aynan shu buyurtmani yaqinda allaqachon yubordingiz (Buyurtma № {po}). Baribir yana yuborilsinmi?",en:"⚠️ Warning: you already sent this exact same order recently (Order No. {po}). Send it again anyway?",ru:"⚠️ Внимание: вы уже недавно отправляли именно этот заказ (Заказ № {po}). Всё равно отправить снова?"},
  zk_col_supplier:{uz:"Yetkazib beruvchi",en:"Supplier",ru:"Поставщик"},
  zk_col_sku:{uz:"SKU",en:"SKU",ru:"SKU"},
  zk_col_barcode:{uz:"Shtrix-kod",en:"Barcode",ru:"Штрихкод"},
  zk_export_total_label:{uz:"ZAKAS JAMI SUMMASI",en:"TOTAL ORDER AMOUNT",ru:"ИТОГО СУММА ЗАКАЗА"},
  zk_col_category:{uz:"Kategoriya",en:"Category",ru:"Категория"},
  zk_col_unit:{uz:"O'lchov",en:"Unit",ru:"Ед. изм."},
  zk_col_target:{uz:"Maqsadli kun",en:"Target days",ru:"Целевые дни"},
  zk_no_selection:{uz:"Supplier tanlanmagan — yuklab olish uchun kamida bitta tovar galochkasini belgilang",en:"No supplier selected — check at least one item to export",ru:"Поставщик не выбран — отметьте хотя бы один товар для скачивания"},
  zk_items_label:{uz:"ta tovar",en:"items",ru:"товаров"},
  zk_total_label:{uz:"Jami:",en:"Total:",ru:"Итого:"},
  zk_target_label:{uz:"Maqsadli kun:",en:"Target days:",ru:"Целевые дни:"},
  zk_show_more:{uz:"Yana {n} ta ko'rsat (jami {total} tadan {shown} tasi ko'rsatildi)",en:"Show {n} more (showing {shown} of {total})",ru:"Показать ещё {n} (показано {shown} из {total})"},
  zk_empty:{uz:"Hozircha shoshilinch yoki tugashga yaqin tovar yo'q",en:"No urgent or low-stock items right now",ru:"Пока нет срочных или заканчивающихся товаров"},
  zk_need_label:{uz:"zakas kerak",en:"need order",ru:"нужен заказ"},
  zk_quicklist_btn:{uz:"Tezkor ro'yxat",en:"Quick list",ru:"Быстрый список"},
  zk_more_btn:{uz:"Ko'proq",en:"More",ru:"Ещё"},
  zk_reset_btn:{uz:"Tozalash",en:"Reset",ru:"Сбросить"},
  zk_tab_auto:{uz:"Avtomatik buyurtma",en:"Automatic order",ru:"Автоматический заказ"},
  zk_tab_file:{uz:"Hujjatdan buyurtma",en:"Order from document",ru:"Заказ из документа"},
  zk_file_sup_placeholder:{uz:"Ta'minotchini qidiring...",en:"Search supplier...",ru:"Поиск поставщика..."},
  zk_file_sup_clear:{uz:"Tozalash",en:"Clear",ru:"Очистить"},
  zk_reset_confirm:{uz:"Barcha qo'lda kiritilgan o'zgarishlar (qo'shimcha kunlar, miqdorlar, maqsad kunlar) o'chiriladi. Davom etasizmi?",en:"All manual changes (extra days, quantities, target days) will be cleared. Continue?",ru:"Все ручные изменения (доп. дни, количества, целевые дни) будут сброшены. Продолжить?"},
  zk_reset_menu_manual:{uz:"Qo'lda kiritilgan o'zgarishlarni tozalash",en:"Clear manually entered changes",ru:"Очистить ручные изменения"},
  zk_reset_menu_openpo_sup:{uz:"«{sup}»dagi Open buyurtmalarni tozalash",en:"Clear Open orders in \"{sup}\"",ru:"Очистить Open-заказы у «{sup}»"},
  zk_reset_menu_openpo_all:{uz:"Open buyurtmalarni tozalash",en:"Clear Open orders",ru:"Очистить Open-заказы"},
  zk_reset_openpo_sup_confirm:{uz:"«{sup}» ta'minotchisida hozir \"Open\" buyurtma sabab zakas 0 bo'lib turgan tovarlar bor bo'lsa - ular normal zakasga qaytariladi (agar o'sha buyurtma kelmaydigan bo'lsa shu uchun kerak).\n\nQo'lda kiritilgan boshqa o'zgarishlarga (miqdor/narx/kun) tegilmaydi.\n\nDavom etasizmi?",en:"Any products in \"{sup}\" currently locked to 0 order due to an \"Open\" PO will return to the normal order formula (use this if that PO will never arrive).\n\nOther manual changes (quantity/price/days) are left untouched.\n\nContinue?",ru:"Товары у «{sup}», заказ которых сейчас заблокирован на 0 из-за \"Open\" заказа, вернутся к обычной формуле (используйте, если тот заказ не придёт).\n\nДругие ручные изменения (кол-во/цена/дни) не затрагиваются.\n\nПродолжить?"},
  zk_reset_openpo_all_confirm:{uz:"BUTUN ro'yxat bo'yicha hozir \"Open\" buyurtma sabab zakas 0 bo'lib turgan barcha tovarlar normal zakasga qaytariladi (agar o'sha buyurtmalar kelmaydigan bo'lsa shu uchun kerak).\n\nQo'lda kiritilgan boshqa o'zgarishlarga (miqdor/narx/kun) tegilmaydi.\n\nDavom etasizmi?",en:"Across the WHOLE list, any products currently locked to 0 order due to an \"Open\" PO will return to the normal order formula (use this if those POs will never arrive).\n\nOther manual changes (quantity/price/days) are left untouched.\n\nContinue?",ru:"По ВСЕМУ списку товары, заказ которых сейчас заблокирован на 0 из-за \"Open\" заказа, вернутся к обычной формуле (используйте, если те заказы не придут).\n\nДругие ручные изменения (кол-во/цена/дни) не затрагиваются.\n\nПродолжить?"},
  zk_reset_openpo_none:{uz:"Hozir Open buyurtma sabab bloklangan tovar topilmadi.",en:"No products currently blocked by an Open PO were found.",ru:"Товаров, заблокированных из-за Open-заказа, не найдено."},
  zk_sup_reset_done:{uz:"{n} ta tovarning ochiq buyurtma bloki tozalandi - zakas ro'yxatida qayta hisoblanadi.",en:"Cleared the open-PO block on {n} product(s) - they'll be recalculated in the order list.",ru:"Блокировка от открытого заказа снята для {n} тов. - будут пересчитаны в списке заказа."},
  zk_kr_click_tt:{uz:"bosing - kirim tarixini ko'rish",en:"click to see arrival history",ru:"нажмите - история прихода"},
  zk_clear_checked_btn:{uz:"Belgilarni tozalash",en:"Clear checks",ru:"Снять отметки"},
  zk_show_need_only:{uz:"faqat kerak bo'lganlarni ko'rsat",en:"show needed only",ru:"показать только нужные"},
  zk_show_all_n:{uz:"barchasini ko'rsat ({n})",en:"show all ({n})",ru:"показать все ({n})"},
  zk_no_need_rows:{uz:"Bu yetkazib beruvchida hozircha zakas kerak bo'lgan tovar yo'q",en:"No items need ordering from this supplier right now",ru:"У этого поставщика пока нет товаров, требующих заказа"},
  zk_minadd_hint:{uz:"Minimal buyurtma uchun qo'shildi",en:"Added to reach minimum order quantity",ru:"Добавлено для минимального заказа"},
};
let LANG=(()=>{try{return localStorage.getItem("tiin_lang")||"uz";}catch(_){return "uz";}})();
function t(key){const e=I18N[key];return e?(e[LANG]||e.uz):key;}

// ─── Login sessiyasini tiklash — Firebase yuklanishi sekinlashsa yoki xato
// bersa ham foydalanuvchi login ekraniga tushib qolmasligi uchun mustaqil
// ishlaydi (faqat localStorage'ga bog'liq, Firebasega emas) ───
(function(){
  try{
    const us=localStorage.getItem("tiin_user");
    if(us){
      const user=JSON.parse(us);
      // AVVAL tablarni chekla, KEYIN login screeni olib tashlash (flash oldini olish)
      _applyUser(user);
      // Avtomatik sessiya tiklashda ham "kim kirdi" xabari (kuniga 1 marta).
      _tgNotifyDaily(user);
      const s=document.getElementById("login-screen");if(s)s.remove();
      document.body.classList.remove("locked");
      // Fonda darhol + har 20s serverdan tekshiriladi - shu payt ichida
      // hisob bloklangan/o'chirilgan yoki parol o'zgartirilgan bo'lsa,
      // foydalanuvchi "chiqish" bosmasdan ham avtomatik login oynasiga
      // chiqarib tashlanadi (sababi bilan - _authShowKickReason()).
      _authCheckOnce();
      _authStartWatch();
    }else{
      _authShowKickReason();
      const p=document.getElementById("lg-phone");if(p)p.focus();
    }
  }catch(_){const p=document.getElementById("lg-phone");if(p)p.focus();}
})();

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
  const _activeNav=document.querySelector(".sb-item.active");
  const _cr=document.getElementById("tb-crumb");
  if(_activeNav&&_cr)_cr.textContent=_activeNav.textContent.trim();
  if(typeof renderP1==="function"&&P1)renderP1();
  if(curPageId==="p2"&&typeof p2Filter==="function"&&P2)p2Filter();
  if(curPageId==="p3"&&typeof p3FillFilters==="function"&&P3)p3FillFilters();
  if(typeof sselSyncAll==="function")sselSyncAll();
  if(curPageId==="p7"&&typeof renderZakas==="function")renderZakas();
  if(curPageId==="p5"&&typeof renderZaxira==="function"&&ZITEMS)renderZaxira();
  if(curPageId==="p6"&&typeof initP6==="function"&&P6){
    initP6();
    const ov=document.getElementById("sp-fullscreen");
    if(ov&&ov.style.display!=="none"&&p6SelI!=null)p6OpenSupplierDetail(p6SelI);
  }
  if(curPageId==="p_nazorat"&&typeof _nazRender==="function")_nazRender();
  if(curPageId==="p9"&&typeof oaCompute==="function"&&OA_SNAP)oaCompute();
  if(curPageId==="p11"){if(fmTab==="supplier"&&typeof fmsRender==="function"&&FMS)fmsRender();else if(typeof fmRender==="function"&&FM)fmRender();}
}
function applyI18n(){
  document.querySelectorAll("[data-i18n]").forEach(el=>{el.textContent=t(el.dataset.i18n);});
  document.querySelectorAll("[data-i18n-ph]").forEach(el=>{el.placeholder=t(el.dataset.i18nPh);});
}

// ─── P1: ASOSIY HOLAT + BARCHA SAHIFALAR UCHUN UMUMIY O'ZGARUVCHILAR ───
// (P1/P2/P3/P6/ZITEMS/INVDATA va h.k. shu yerdan pastda e'lon qilinadi -
// bo'limlar shu globallar orqali bir-biriga bog'langan, alohida faylga
// bo'lish qiyin bo'lgan sababi shu)
let P1=JSON.parse(document.getElementById("p1data").textContent);let P1FULL=P1;
let GRA=null,GRB=null,DAILYFULL=null,DMETAFULL=null;
let HIST=null,HISTMETA=null,histLoadState="idle",p2HistDays=60,p2HistCustom=null;
// Mahsulotlar (p2) va Stock (p5) bitta umumiy oraliqni baham ko'radi (Zakas ro'yxati ham shu
// orqali yangilanadi) - biridan o'zgartirilsa, ikkinchisi qayta tashrif buyurganda eskisiga
// qaytib ketmaydi. Bosh sahifa va boshqalar mustaqil o'z oralig'ini saqlaydi.
const PAGE_GROUP={p1:"p1",p2:"p2p5",p5:"p2p5",p3:"p3",p6:"p6"};
const PAGE_DEFAULT_DAYS={p1:7,p2p5:30,p3:30,p6:30};
let pageRanges={};
// ─── P5 (STOCK/ZAXIRA) + P7 (ZAKAS) — BU YERDAN ~1920-QATORGACHA CHATISHIB
// KETGAN, alohida ikkita blokka bo'linmagan. Funksiya nomi prefiksiga qarab
// ajratish mumkin: "zk"/"_zk" = Zakas (p7), "z"/"_z" (zk bilan boshlanmagan)
// = Stock (p5). Masalan zSortBy/zFilter/_buildZItems/renderZaxira = Stock,
// zkSetQty/_zkBuildSuppliers/renderZakas = Zakas. ───
let zSort={key:null,dir:1};
function zSortBy(key){
  if(zSort.key===key){zSort.dir=-zSort.dir;}else{zSort.key=key;zSort.dir=1;}
  zPage=1;renderZaxira();
}
let P2=null,P3=null,P4=null,DAILY=null,DSKU={},DNAME={},DBC={},DMETA=null,p2chart=null,p4sk="v",p4sa=false,curTab3="A",curRows3=[];
let p3Sort={key:null,dir:1};
function p3SortBy(key){if(p3Sort.key===key){p3Sort.dir=-p3Sort.dir;}else{p3Sort.key=key;p3Sort.dir=1;}renderTable3(curRows3);}
let donut3Chart=null,monthly3Chart=null,MONTHLY_REV_DATA=null,_monthlyRevLoadPromise=null;
let p2LastI=null;
let ZITEMS=null,INVDATA=null,zCurFilter="all",zQuery="",zFilters=[],zFilled=false,zLastZi=null,zPage=1,zSuperTabCur="aktiv";
const ZPS=50;
let P6=null,p6CurF="all",p6Q="",p6Page=1,p6SelI=null,p6CardMonth=null,p6ValueMode="rev",p6ListSortMi=null,p6ListSortDir=1;
let _p6DetailProds=[],_p6DetailAllProds=[],_p6DetailQ="",_p6DetailR=null;
let _p6DetailSortMi=null,_p6DetailSortDir=1;
let _p6MzAllItems=[],_p6MzQ="",_p6MzViewItems=[];
const P6PS=50;
let P8=null,krQ="",krPage=1,krSortKey="last",krSortDir=-1;
// Qo'lda stok tuzatish (2026-08-09, foydalanuvchi so'rovi): backend calcStock
// modeli ba'zan xato bo'lsa, menejer jismonan sanab, to'g'ri sonni saytdan
// kiritadi - Turso'dagi stock_overrides jadvaliga yoziladi (api/stock-override.py),
// BARCHA qurilma/foydalanuvchida darhol ko'rinadi. backend_p_calc_stock.py'ning
// o'ziga TEGMAYDI - faqat frontendda calcStock USTIGA (eng yuqori ustuvorlik
// bilan) qo'llaniladi, mustaqil va kichik (backend/ papkadagi hali tugallanmagan
// Turso qayta qurishga bog'liq emas).
let STOCK_OV={},_stockOvLoaded=false,zkEditStockKey=null;
function _zkStockOvEndpoint(){return (location.protocol==="file:"?"https://tiin-market.vercel.app":"")+"/api/stock-override";}
async function _ensureStockOverrides(){
  if(_stockOvLoaded)return;
  _stockOvLoaded=true;
  try{
    const r=await fetch(_zkStockOvEndpoint(),{cache:"no-store"});
    const d=await r.json();
    if(d&&d.ok&&d.overrides)STOCK_OV=d.overrides;
  }catch(e){/* jonli bo'lmasa (masalan lokal test) - shunchaki bosh qoladi, calcStock ishlataveradi */}
}
// ─── Zakas qo'lda tahrirlarini UMUMIY qilish (2026-09-02, foydalanuvchi topilmasi:
// "shu tovarlar tahrirlanganmi - nega saytda ko'rinmayapdi") ───
// stock-override.py bilan bir xil naqsh: miqdor/qo'shimcha kun/narx/stok rejimi/
// ta'minotchi maqsadli kuni endi FAQAT shu brauzerda emas, Turso'dagi umumiy
// zakas_draft jadvalida saqlanadi - har kim ko'radi. localStorage hali ham
// zaxira/tezkor kesh sifatida ishlatiladi (internet uzilsa ham qator qiymatlari
// yo'qolmasin).
let _zkDraftLoaded=false,_zkDraftPollTimer=null;
function _zkDraftEndpoint(){return (location.protocol==="file:"?"https://tiin-market.vercel.app":"")+"/api/zakas-draft";}
// Fire-and-forget - internet vaqtincha uzilsa ham foydalanuvchini kutkazib
// qo'ymaydi (localStorage'da qiymat allaqachon saqlangan, keyingi muvaffaqiyatli
// so'rovda avtomatik tenglashadi).
function _zkDraftPush(ops,clearNs){
  try{
    fetch(_zkDraftEndpoint(),{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ops:ops||[],clear_ns:clearNs||null,updated_by:_zkManagerName()})}).catch(()=>{});
  }catch(e){}
}
const _ZK_DRAFT_MAPS=()=>({qty:zkRowQty,adj:zkRowAdj,cost:zkRowCost,stockmode:zkRowStockMode,suptarget:zkSupTargets});
async function _ensureZkDraft(){
  if(_zkDraftLoaded)return;
  _zkDraftLoaded=true;
  try{
    const r=await fetch(_zkDraftEndpoint(),{cache:"no-store"});
    const d=await r.json();
    if(!d||!d.ok||!d.data)return;
    const maps=_ZK_DRAFT_MAPS();
    const migrateOps=[];
    for(const ns in maps){
      const local=maps[ns],remote=d.data[ns]||{};
      // Server allaqachon bilgan kalitlar uchun - server g'olib (boshqa qurilmada
      // yangilangan bo'lishi mumkin).
      for(const k in remote)local[k]=remote[k];
      // Faqat SHU brauzerda bor, serverda hali yo'q bo'lgan eski (migratsiya
      // qilinmagan) tahrirlar - serverga yuklanadi, shunda darhol hammaga
      // ko'rinadigan bo'ladi ("kecha tahrirlanganlarini ham ko'rinadigan qil").
      for(const k in local)if(!(k in remote))migrateOps.push({ns,k,v:local[k]});
    }
    if(migrateOps.length)_zkDraftPush(migrateOps);
    zkSaveManual();
  }catch(e){/* jonli bo'lmasa - lokal holat bilan davom etiladi */}
}
function _zkDraftStopPoll(){if(_zkDraftPollTimer){clearInterval(_zkDraftPollTimer);_zkDraftPollTimer=null;}}
function _zkDraftStartPoll(){_zkDraftStopPoll();_zkDraftPollTimer=setInterval(_zkDraftPollOnce,15000);}
// Boshqa xodim tahrirlagan qiymatlar ~15s ichida ko'rinishi uchun (foydalanuvchi
// so'rovi: "bir kunda ikki marta emas, tezroq ko'rinishi kk"). Foydalanuvchi
// hozir bir katakchaga yozayotgan bo'lsa, uni chalg'itmaslik uchun shu safar
// o'tkazib yuboriladi - keyingi urinishda sinxronlanadi.
async function _zkDraftPollOnce(){
  if(curPageId!=="p7")return;
  const ae=document.activeElement;
  if(ae&&ae.classList&&ae.classList.contains("zk-adj-inp"))return;
  try{
    const r=await fetch(_zkDraftEndpoint(),{cache:"no-store"});
    const d=await r.json();
    if(!d||!d.ok||!d.data)return;
    let changed=false;
    const cmp=(a,b)=>JSON.stringify(a)!==JSON.stringify(b);
    if(cmp(zkRowQty,d.data.qty||{})){zkRowQty=d.data.qty||{};changed=true;}
    if(cmp(zkRowAdj,d.data.adj||{})){zkRowAdj=d.data.adj||{};changed=true;}
    if(cmp(zkRowCost,d.data.cost||{})){zkRowCost=d.data.cost||{};changed=true;}
    if(cmp(zkRowStockMode,d.data.stockmode||{})){zkRowStockMode=d.data.stockmode||{};changed=true;}
    if(cmp(zkSupTargets,d.data.suptarget||{})){zkSupTargets=d.data.suptarget||{};changed=true;}
    if(changed){zkSaveManual();renderZakas();}
  }catch(e){}
}
const KRPS=50;
const ZK_DEFAULT_TARGET=20;
const ZK_MIN_ORDER=3;
// XAVFSIZLIK ZAXIRASI (2026-07-21). Maqsadli kun ustiga ABC bo'yicha qo'shiladi:
// A = har 3 kunga +1 kun, B = har 5 kunga +1, C = har 10 kunga +1.
// NEGA FOIZ, KUN EMAS: maqsadli kun ta'minotchiga qarab 7..30 orasida o'zgaradi -
// qat'iy "+3 kun" 7 kunlik zakasda ortiqcha, 30 kunlikda yetarli emas.
// NEGA A ga ENG KO'P: real ma'lumotda o'lchandi - aynan A tovarlar eng ko'p tugab
// qoladi (20 kunlik maqsadda 5.5%, C esa 2.6%), chunki ular tez va tekis sotiladi.
// Tekis sotiladigan A tovarning kelasi 20 kunlik talabi bashoratdan 33% dan ko'p
// oshishi 9.2% holatda kuzatilgan - shu qoplanadi.
// Kamaytirish/oshirish uchun shu qatorni o'zgartirish kifoya.
// "O'RTA" daraja tanlandi (foydalanuvchi, 2026-07-21): A = har 5 kunga +1 kun,
// B = har 8 kunga +1, C = har 17 kunga +1. Kuchliroq variant (1/3, 0.20, 0.10)
// tugab qolishni 2.7% -> 2.3% ga tushirardi, lekin bog'langan pulni +56% qilardi.
// Bir-ikki hafta ishlatib ko'rilgach oshirish/kamaytirish mumkin — faqat shu qator.
const ZK_BUFFER={A:0.20,B:0.12,C:0.06};
// Muddati tez o'tadigan tovarlar uchun zaxira ZARAR (buzilib qoladi) - shu ro'yxatdagi
// kategoriya (catTop) nomlariga zaxira qo'llanmaydi. Kerak bo'lganda to'ldiriladi.
const ZK_BUFFER_SKIP_CATS=[];
// Ta'minotchisi katalogda ko'rsatilmagan VA kirim tarixidan ham tiklanmagan tovarlar shu
// umumiy nom ostida (p6 Suppliers'dagi "Noma'lum" bilan bir xil konventsiya) Zakas
// ro'yxatiga chiqadi - aks holda ular ro'yxatdan butunlay tushib qolar edi.
const ZK_NO_SUPPLIER="Noma'lum";
let zkSlSort="needCount",zkSlAsc=false;
function zkSlSetSort(k){if(zkSlSort===k)zkSlAsc=!zkSlAsc;else{zkSlSort=k;zkSlAsc=false;}renderZakas();}
let zkQuery="",zkDetailQuery="",zkSupFilter="",zkMode="list",zkLastSup="",zkRowChecked={},zkSupShowAll={},_ZK_SUPPLIERS=[],_ZK_ALLROWS=[],_zkPmap=null,zkPage=1,_zBackPage="p5",zkSortKey="orderQty",zkSortAsc=false,zkRowOrder={};
// QO'LDA KIRITILGANLAR SAQLANADI (2026-07-21). Avval oddiy o'zgaruvchi edi - sahifa
// yangilansa (F5), brauzer yopilsa yoki boshqa bo'limga o'tib qaytilsa hammasi yo'qolardi.
// Manfiy stokli tovarlarga qo'lda kun kiritish ishi (283 ta ta'minotchi bo'ylab) shu
// sababli xavf ostida edi. "Zakas berildi" belgisi (zkConfirmed) bilan bir xil naqsh.
const _zkLoad=k=>{try{return JSON.parse(localStorage.getItem(k)||"{}");}catch(e){return {};}};
let zkSupTargets=_zkLoad("zk_sup_targets");   // ta'minotchi -> maqsadli kun
let zkRowAdj=_zkLoad("zk_row_adj");           // qator -> qo'shimcha kun
let zkRowQty=_zkLoad("zk_row_qty");           // qator -> qo'lda kiritilgan miqdor
let zkRowCost=_zkLoad("zk_row_cost");         // qator -> qo'lda kiritilgan narx (rcost'ga fallback,
                                               // foydalanuvchi so'rovi 2026-07-22: narx yaqinda
                                               // o'zgargan bo'lsa qo'lda tuzatib qo'yish uchun)
// Har qator o'zi Invan yoki Hisoblangan stok bilan ishlashini alohida tanlaydi (foydalanuvchi
// so'rovi, 2026-07-27) - "calc" bo'lsa backend_p_calc_stock.py'dan kelgan v.calcStock ishlatiladi,
// aks holda (kalit yo'q) sukut bo'yicha Invan (v.stock). Boshqa qator-holatlar (adj/qty/cost) bilan
// bir xil naqsh - localStorage'da qator-kalit bo'yicha saqlanadi.
let zkRowStockMode=_zkLoad("zk_row_stockmode");
// SKU -> {po} - menejer "bu Open buyurtma kelmaydi" deb qo'lda belgilagan tovarlar
// (zkResetOpenPo() orqali, ta'minotchi bo'yicha). krPendingQty() shu ro'yxatdagi
// SKU'ni Open bo'lsa ham darhol e'tiborsiz qoldiradi (odatdagi 30-kunlik avtomatik
// muddatni kutmasdan). `po` - BELGILANGAN PAYTDAGI aniq buyurtma raqami (order_no) -
// agar keyinroq HAQIQIY YANGI Open buyurtma kelsa (order_no farq qiladi), eski
// belgi endi O'SHA YANGI buyurtmaga tegishli EMAS deb avtomatik e'tiborsiz qoldiriladi
// (zkRowCost'dagi costManual/base tekshiruvi bilan bir xil "eskirgan qo'lda belgi
// avtomatik bekor bo'lsin" naqshi).
let zkIgnoreOpenPo=_zkLoad("zk_ignore_open_po");
function zkSaveManual(){try{
  localStorage.setItem("zk_sup_targets",JSON.stringify(zkSupTargets));
  localStorage.setItem("zk_row_adj",JSON.stringify(zkRowAdj));
  localStorage.setItem("zk_row_qty",JSON.stringify(zkRowQty));
  localStorage.setItem("zk_row_cost",JSON.stringify(zkRowCost));
  localStorage.setItem("zk_row_checked",JSON.stringify(zkRowChecked));
  localStorage.setItem("zk_row_stockmode",JSON.stringify(zkRowStockMode));
  localStorage.setItem("zk_ignore_open_po",JSON.stringify(zkIgnoreOpenPo));
}catch(e){}}
// Kategoriya/Subkategoriya filtri - bitta supplier ichida ko'rib chiqilayotganda, MUNTAZAM
// va CHUQUR bo'limlari o'rtasida UMUMIY (ikkalasiga ham qo'llanadi), lekin supplier
// almashtirilganda yoki ro'yxatga qaytilganda tozalanadi (foydalanuvchi so'rovi, 2026-07-21).
let zkCatFilter="",zkSubFilter="";
// Ro'yxat (supplierlar) darajasidagi Kategoriya/Subkategoriya filtri (2026-08-10,
// foydalanuvchi so'rovi) - ichki (bitta supplier ichidagi) zkCatFilter/zkSubFilter'dan
// ATAYLAB ALOHIDA: ro'yxatda TOVAR emas, SUPPLIER filtrlanadi (shu kategoriyadagi
// kamida bitta tovari bor suppliergina qoladi), shuning uchun aralashib ketmasligi kk.
let zkListCatFilter="",zkListSubFilter="";
let zkConfirmed=(()=>{try{return JSON.parse(localStorage.getItem("zk_confirmed")||"{}");}catch(e){return {};}})();
// "Zakas berildi" belgilangan paytdagi stok suratlari (SKU/nom -> stok) - shu supplierning
// ISTALGAN tovari stoki oshsa (kirim keldi degani), belgi avtomatik olib tashlanadi.
let zkConfirmedStock=(()=>{try{return JSON.parse(localStorage.getItem("zk_confirmed_stock")||"{}");}catch(e){return {};}})();
let zkDepth="normal";  // "normal" = muntazam zakas (30 kunlik) | "chuqur" = avvalgi davr (pav)
// "Hujjatdan buyurtma" (2026-07-24, foydalanuvchi so'rovi): ta'minotchidan kelgan tayyor
// hujjatni (накладная va h.k.) TO'LIQ katalog bo'yicha moslashtirib, fayldagi soni/narxni
// AYNAN olib Invan'ga yuboradi - avtomatik hisoblangan (avg30) zakasdan farqli. Mavjud
// "Excel tekshiruv" (zkImportBarcodes) esa faqat OCHIQ supplierning hisoblangan qatorlarini
// filtrlaydi va fayl soni/narxini tashlab yuboradi - shu farq sabab alohida tab/oqim kerak.
let zkPageTab="auto";        // "auto" = avtomatik zakas | "file" = hujjatdan buyurtma
let zkFileSupplier="";
let zkFileRows=[];           // {name,bc,bcRaw,qty,price,sku,checked}
let zkFileUnmatched=[];      // {name,bcRaw,qty,price}
let _zkBcMapCache=null;
// HOLAT SAQLASH (2026-07-25, foydalanuvchi so'rovi): sayt har 30 daqiqada avtomatik
// yangilanadi (yoki foydalanuvchi qo'lda F5 bosadi) - shu payt supplier bilan ishlab
// turgan bo'lsa (galochka belgilangan, qo'lda soni/narx kiritilgan, Hujjatdan buyurtmada
// Excel yuklab tahrirlab turgan bo'lsa) hammasi yo'qolib, boshidan boshlashga majbur
// bo'lardi - buni xavfli deb topdi. Endi: (1) qaysi supplier/tab ochiq turgani, (2)
// galochka holati, (3) Hujjatdan buyurtma'ning yuklangan jadvali - barchasi saqlanadi.
// MUHIM: bu FAQAT qo'lda kiritilgan/tanlangan holat - Avtomatik buyurtma'ning HISOBLANGAN
// sonlari (dailyAvg, orderQty) HAR DOIM jonli ma'lumotdan qayta hisoblanadi (_zkBuildSuppliers
// ZITEMS'dan), eski qiymatda "qotib" qolmaydi - faqat foydalanuvchi ustidan qo'shgan
// belgilar/tuzatishlar saqlanadi va yangi hisob ustiga qayta qo'llanadi.
const _zkLoadStr=(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:v;}catch(e){return d;}};
const _zkLoadArr=k=>{try{const v=JSON.parse(localStorage.getItem(k)||"[]");return Array.isArray(v)?v:[];}catch(e){return [];}};
zkRowChecked=_zkLoad("zk_row_checked");
zkSupFilter=_zkLoadStr("zk_sup_filter","");
zkMode=_zkLoadStr("zk_mode","list");
zkDepth=_zkLoadStr("zk_depth","normal");
zkPageTab=_zkLoadStr("zk_page_tab","auto");
zkFileSupplier=_zkLoadStr("zk_file_supplier","");
zkFileRows=_zkLoadArr("zk_file_rows");
zkFileUnmatched=_zkLoadArr("zk_file_unmatched");
function _zkSaveViewState(){try{
  localStorage.setItem("zk_sup_filter",zkSupFilter);
  localStorage.setItem("zk_mode",zkMode);
  localStorage.setItem("zk_depth",zkDepth);
  localStorage.setItem("zk_page_tab",zkPageTab);
}catch(e){}}
function _zkSaveFileState(){try{
  localStorage.setItem("zk_file_supplier",zkFileSupplier);
  localStorage.setItem("zk_file_rows",JSON.stringify(zkFileRows));
  localStorage.setItem("zk_file_unmatched",JSON.stringify(zkFileUnmatched));
}catch(e){}}
function zkSaveConfirmed(){try{localStorage.setItem("zk_confirmed",JSON.stringify(zkConfirmed));}catch(e){}}
function zkSaveConfirmedStock(){try{localStorage.setItem("zk_confirmed_stock",JSON.stringify(zkConfirmedStock));}catch(e){}}
function zkIsConfirmed(sup){return !!zkConfirmed[sup];}
function zkSetConfirmed(sup,val){
  zkConfirmed[sup]=val;
  if(!val){delete zkConfirmed[sup];delete zkConfirmedStock[sup];}
  else{
    const snap={};
    if(ZITEMS)ZITEMS.forEach(v=>{if((v.sup||ZK_NO_SUPPLIER)===sup)snap[_zkRowKey(v)]=v.stock||0;});
    zkConfirmedStock[sup]=snap;
  }
  zkSaveConfirmed();zkSaveConfirmedStock();
}
function zkMarkConfirmedFromDetail(sup){
  if(zkIsConfirmed(sup)){
    if(!confirm(t("zk_unconfirm_warn")))return;
    zkSetConfirmed(sup,false);
  }else{
    zkSetConfirmed(sup,true);
  }
  const sc=document.querySelector("#zk-body .zk-sl");
  const st=sc?sc.scrollTop:0;
  renderZakas();
  requestAnimationFrame(()=>{const s2=document.querySelector("#zk-body .zk-sl");if(s2)s2.scrollTop=st;});
}
// Har render'da chaqiriladi: belgilangan supplierning istalgan tovari stoki (kirim kelib)
// suratdagidan oshgan bo'lsa - "Zakas berildi" belgisi avtomatik olib tashlanadi. Belgi
// eski (surat yo'q) bo'lsa - hozirgi stokni surat sifatida saqlab, shu yerdan kuzata boshlaydi.
function _zkAutoUnconfirmByStock(){
  if(!ZITEMS)return;
  const sups=Object.keys(zkConfirmed);
  if(!sups.length)return;
  let changed=false;
  sups.forEach(sup=>{
    const items=ZITEMS.filter(v=>(v.sup||ZK_NO_SUPPLIER)===sup);
    let snap=zkConfirmedStock[sup];
    if(!snap){
      snap={};items.forEach(v=>{snap[_zkRowKey(v)]=v.stock||0;});
      zkConfirmedStock[sup]=snap;changed=true;
      return;
    }
    const increased=items.some(v=>{
      const before=snap[_zkRowKey(v)];
      return before!=null&&(v.stock||0)>before;
    });
    if(increased){zkSetConfirmed(sup,false);changed=true;}
  });
  if(changed)zkSaveConfirmedStock();
}
function zkToggleSupShowAll(si){const s=_ZK_SUPPLIERS[si];if(!s)return;zkSupShowAll[s.sup]=!zkSupShowAll[s.sup];renderZakas();}
function _zkIsChecked(r){const v=zkRowChecked[r.key];return v!=null?v:false;}
function zkToggleRow(ri){const r=_ZK_ALLROWS[ri];if(!r)return;zkRowChecked[r.key]=!_zkIsChecked(r);zkSaveManual();renderZakas();}
// "Hammasini belgilash" (supplier/tezkor panel checkboxi) faqat HAQIQIY kerakli
// (orderQty>0) qatorlarni avtomatik belgilaydi. Open/pending (allaqachon boshqa
// buyurtmada yo'lda, shu sabab orderQty=0 qilib qo'yilgan - krPendingQty) tovarlar
// bu yerga QO'SHILMAYDI - ularni ikkinchi marta avtomatik eksportga qo'shish
// noto'g'ri (zakas qiymati baribir 0). Foydalanuvchi xohlasa, individual qator
// checkboxi (zkToggleRow) orqali xohlagan Open tovarni qo'lda belgilashi mumkin -
// bu funksiyaga bog'liq emas, har doim ishlaydi.
// MANFIY STOK: "Hammasini belgilash"ga HECH QACHON qo'shilmaydi (foydalanuvchi so'rovi,
// 2026-07-21). Sabab: manfiy stok haqiqiy qoldiq noma'lum degani (jonli bazada 2,944 ta
// tovar shunday) - miqdorni faqat kategoriya menejeri bilan aniqlab, qo'lda kiritish kerak.
// Qator checkboxi orqali qo'lda belgilash har doim ishlaydi (zkToggleRow).
const _zkNoAuto=r=>r.stock<0;
function _zkRelevantRows(s){const rel=s.rows.filter(r=>r.orderQty>0&&!_zkNoAuto(r));if(rel.length)return rel;return s.rows.filter(r=>!_zkNoAuto(r));}
function zkToggleSupplier(si){
  const raw=_ZK_SUPPLIERS[si];if(!raw)return;
  // MUHIM: _ZK_SUPPLIERS[si].rows - HAMMA qator (filtrsiz). "Hammasini belgilash"
  // esa faqat EKRANDA KO'RINAYOTGAN (qidiruv/kategoriya filtridan o'tgan) qatorlarga
  // tegishi kk, aks holda filtr ortidagi boshqa kategoriya tovarlari ham sukut
  // ravishda belgilanib/o'chirilib ketardi (foydalanuvchi so'rovi, 2026-07-21).
  const filteredRows=_zkApplyQueryFilters(raw);
  const s={...raw,rows:filteredRows};
  const rel=_zkRelevantRows(s);
  const allChecked=rel.length>0&&rel.every(r=>_zkIsChecked(r));
  if(allChecked){
    // Bekor qilishda FILTRLANGAN qatorlar (qo'lda belgilangan, orderQty=0 bo'lganlari
    // ham) tozalanadi - aks holda qo'lda belgilangan tovarlar "umumiy o'chirish"da
    // qolib ketib, foydalanuvchi ularni birma-bir o'chirishga majbur bo'lardi (2026-07-20).
    filteredRows.forEach(r=>{zkRowChecked[r.key]=false;});
  }else{
    // Belgilashda faqat kerakli (orderQty>0) qatorlar avtomatik belgilanadi - Open/
    // pending kabi hozircha kerak bo'lmagan tovarlar sukut ravishda belgilanmaydi.
    rel.forEach(r=>{zkRowChecked[r.key]=true;});
  }
  zkSaveManual();
  renderZakas();
}
function _zkRowKey(v){return v.sku?("s:"+v.sku):("n:"+v.name);}
// Zakas qidiruvi: mahsulot nomi, SKU yoki barcode bo'yicha moslik (supplier nomi alohida tekshiriladi)
function _zkRowHit(r,q){return (r.name&&r.name.toLowerCase().includes(q))||(r.sku&&String(r.sku).toLowerCase().includes(q))||(r.bc&&r.bc.some(b=>String(b).toLowerCase().includes(q)));}
// Qidiruv (yuqori va ichki) va Kategoriya/Subkategoriya filtrini BIR XIL tartibda,
// bitta joyda qo'llaydi - renderZakas() va zkToggleSupplier() ORASIDA mos kelishini
// kafolatlaydi (aks holda "hammasini belgilash" ekranda ko'rinmayotgan, filtrlangan
// qatorlarga ham tegishi mumkin edi - foydalanuvchi so'rovi, 2026-07-21).
// Excel shtrix-kod tekshiruvi holati: zkBcFilter = mos kelgan (normalizatsiya qilingan)
// shtrix-kodlar to'plami (aktiv bo'lsa), zkBcShowAll = topilmaganlarni ham ko'rsatish,
// zkBcStats = {total, matched, notFound:[{name,bc,bcRaw,qty,price}]} banner/oyna uchun.
let zkBcFilter=null,zkBcShowAll=false,zkBcStats=null;
function _zkApplyQueryFilters(s){
  let rows=s.rows;
  if(zkBcFilter&&!zkBcShowAll)rows=rows.filter(r=>_zkRowBcHit(r));
  if(zkQuery){const q=zkQuery;rows=rows.filter(r=>_zkRowHit(r,q)||s.sup.toLowerCase().includes(q));}
  if(zkDetailQuery){const q=zkDetailQuery;rows=rows.filter(r=>_zkRowHit(r,q));}
  if(zkCatFilter)rows=rows.filter(r=>r.catTop===zkCatFilter);
  if(zkSubFilter)rows=rows.filter(r=>r.cat===zkSubFilter);
  return rows;
}
// Joriy supplier uchun (Muntazam+Chuqur BIRLASHTIRILGAN, chunki filtr ikkalasiga ham
// umumiy) mavjud Kategoriya/Subkategoriya variantlarini yig'ib, dropdownlarni
// to'ldiradi. Faqat supplier ochilganda chaqiriladi (har renderda emas) - aks holda
// foydalanuvchining joriy tanlovi keraksiz qayta chizishlarda uzilib qolishi mumkin edi.
function _zkRefreshCatFilters(){
  const sel1=document.getElementById("zk-cat-filter");
  const sel2=document.getElementById("zk-sub-filter");
  if(!sel1||!sel2||!zkSupFilter)return;
  const supN=_zkBuildSuppliers("normal").find(s=>s.sup===zkSupFilter);
  const supC=_zkBuildSuppliers("chuqur").find(s=>s.sup===zkSupFilter);
  const allRows=[...(supN?supN.rows:[]),...(supC?supC.rows:[])];
  const cats=[...new Set(allRows.map(r=>r.catTop).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ru"));
  sel1.innerHTML=`<option value="">${t("zk_all_cat")}</option>`+cats.map(c=>`<option value="${esc(c)}"${c===zkCatFilter?" selected":""}>${esc(c)}</option>`).join("");
  const subs=[...new Set(allRows.filter(r=>!zkCatFilter||r.catTop===zkCatFilter).map(r=>r.cat).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ru"));
  sel2.innerHTML=`<option value="">${t("zk_all_subcat")}</option>`+subs.map(c=>`<option value="${esc(c)}"${c===zkSubFilter?" selected":""}>${esc(c)}</option>`).join("");
  // Ko'p bo'lgani uchun (2026-08-10, foydalanuvchi so'rovi) qidiruvli-tanlov
  // (sselAttach - p2/p3 filtrlarida ishlatilgan xuddi shu komponent) - variantlarni
  // scroll qilib qidirishdan ko'ra yozib topish qulayroq.
  sselAttach("zk-cat-filter");sselAttach("zk-sub-filter");sselSyncAll();
  _zkFCount();
}
function zkCatFilterChange(v){
  zkCatFilter=v;zkSubFilter="";zkPage=1;
  _zkRefreshCatFilters();
  renderZakas();
}
function zkSubFilterChange(v){
  zkSubFilter=v;zkPage=1;
  _zkFCount();
  renderZakas();
}
// Kategoriya/Subkategoriya filtri kompakt "Filtr" tugmasi ostiga yig'ildi (p2/p3
// bo'limlaridagi filtr tugmasi naqshi bilan bir xil - foydalanuvchi so'rovi,
// 2026-07-22: eski ikkita keng select qator juda ko'p joy olib, "xunuk" ko'rinar edi.
function _zkFCount(){
  let n=0;if(zkCatFilter)n++;if(zkSubFilter)n++;
  const b=document.getElementById("zk-fcount");if(b)b.textContent=n?"("+n+")":"";
  const btn=document.getElementById("zk-fbtn");if(btn)btn.classList.toggle("has",n>0);
}
function zkFToggle(e){if(e)e.stopPropagation();const p=document.getElementById("zk-fpop");if(p)p.classList.toggle("open");}
function zkClearCatFilters(){
  zkCatFilter="";zkSubFilter="";zkPage=1;
  _zkRefreshCatFilters();
  renderZakas();
  const p=document.getElementById("zk-fpop");if(p)p.classList.remove("open");
}
document.addEventListener("click",function(e){const w=document.getElementById("zk-fwrap");const p=document.getElementById("zk-fpop");if(w&&p&&!w.contains(e.target))p.classList.remove("open");});
// Ro'yxat darajasidagi Kategoriya/Subkategoriya filtri (2026-08-10, foydalanuvchi
// so'rovi: "har bir supplier ichida filtr bor, tashqarida ham shunday kk" - masalan
// suv olib keladigan BARCHA supplierlarni ajratib olish uchun). Variantlar BUTUN
// katalogdan (ikkala depth, barcha supplier) yig'iladi - ichkisidan farqli, bitta
// supplierga bog'lanmagan.
function _zkRefreshListCatFilters(){
  const sel1=document.getElementById("zk-list-cat-filter");
  const sel2=document.getElementById("zk-list-sub-filter");
  if(!sel1||!sel2)return;
  const supN=_zkBuildSuppliers("normal"),supC=_zkBuildSuppliers("chuqur");
  const allRows=[];supN.forEach(s=>allRows.push(...s.rows));supC.forEach(s=>allRows.push(...s.rows));
  const cats=[...new Set(allRows.map(r=>r.catTop).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ru"));
  sel1.innerHTML=`<option value="">${t("zk_all_cat")}</option>`+cats.map(c=>`<option value="${esc(c)}"${c===zkListCatFilter?" selected":""}>${esc(c)}</option>`).join("");
  const subs=[...new Set(allRows.filter(r=>!zkListCatFilter||r.catTop===zkListCatFilter).map(r=>r.cat).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ru"));
  sel2.innerHTML=`<option value="">${t("zk_all_subcat")}</option>`+subs.map(c=>`<option value="${esc(c)}"${c===zkListSubFilter?" selected":""}>${esc(c)}</option>`).join("");
  sselAttach("zk-list-cat-filter");sselAttach("zk-list-sub-filter");sselSyncAll();
  _zkListFCount();
}
function zkListCatFilterChange(v){
  zkListCatFilter=v;zkListSubFilter="";
  _zkRefreshListCatFilters();
  renderZakas();
}
function zkListSubFilterChange(v){
  zkListSubFilter=v;
  _zkListFCount();
  renderZakas();
}
function _zkListFCount(){
  let n=0;if(zkListCatFilter)n++;if(zkListSubFilter)n++;
  const b=document.getElementById("zk-list-fcount");if(b)b.textContent=n?"("+n+")":"";
  const btn=document.getElementById("zk-list-fbtn");if(btn)btn.classList.toggle("has",n>0);
}
function zkListFToggle(e){if(e)e.stopPropagation();const p=document.getElementById("zk-list-fpop");if(p)p.classList.toggle("open");}
function zkListClearCatFilters(){
  zkListCatFilter="";zkListSubFilter="";
  _zkRefreshListCatFilters();
  renderZakas();
  const p=document.getElementById("zk-list-fpop");if(p)p.classList.remove("open");
}
document.addEventListener("click",function(e){const w=document.getElementById("zk-list-fwrap");const p=document.getElementById("zk-list-fpop");if(w&&p&&!w.contains(e.target))p.classList.remove("open");});
// Import menyusini tashqariga bosilganда yopish
document.addEventListener("click",function(e){const w=document.getElementById("zk-invan-wrap");const m=document.getElementById("zk-invan-menu");if(w&&m&&!w.contains(e.target))m.style.display="none";});
function _zkPriceOf(v){
  if(!P2)return 0;
  if(!_zkPmap){_zkPmap={};P2.forEach(x=>{if(x.sku)_zkPmap["s:"+x.sku]=x.p||0;_zkPmap["n:"+x.name]=x.p||0;});}
  const k=_zkRowKey(v);
  return _zkPmap[k]!=null?_zkPmap[k]:0;
}
function _zkTh(lbl,k,align){
  const a=align||"right";const act=zkSortKey===k;
  const ar=act?(zkSortAsc?"↑":"↓"):"↕";
  // white-space:nowrap OLIB TASHLANDI (2026-07-22, foydalanuvchi topdi) - uzun ustun nomlari
  // ("Средн. в день", "Дней осталось") tor ustunda kesilib, bir-biriga qo'shilib
  // ko'rinar edi (th{overflow:hidden} bilan birga). Endi 2 qatorga o'raladi.
  return `<th onclick="zkSort('${k}')" style="cursor:pointer;text-align:${a};user-select:none;line-height:1.3">${lbl}<span style="margin-left:2px;color:${act?"#534AB7":"#ccc"};font-size:9px">${ar}</span></th>`;
}
function zkSort(k){
  if(zkSortKey===k)zkSortAsc=!zkSortAsc;
  else{zkSortKey=k;zkSortAsc=k==="name"||k==="abc";}
  zkRowOrder={};
  renderZakas();
}
function zkResetAll(){
  if(!confirm(t("zk_reset_confirm")))return;
  zkRowQty={};zkRowAdj={};zkSupTargets={};zkRowOrder={};zkRowCost={};zkRowStockMode={};
  zkSaveManual();
  _zkDraftPush([],["qty","adj","cost","stockmode","suptarget"]);
  renderZakas();
}
// Hozir "Open" (kelmaydigan) buyurtma sabab zakas 0'ga qulflangan qatorlarni ANIQLAB,
// ularni zkIgnoreOpenPo'ga qo'shadi - shundan keyin krPendingQty() ularni darhol
// e'tiborsiz qoldiradi, tovar oddiy (maqsadli kun) formulasiga qaytadi (foydalanuvchi
// so'rovi, 2026-08-18: ta'minotchi hech qachon yopmagan Open buyurtma tufayli tovar
// zakasdan abadiy chetlab o'tilib qolmasin, 30-kunlik avtomatik muddatni kutmasdan ham).
// Bitta ta'minotchi ko'rsatilayotgan bo'lsa (Detail + filtr) - FAQAT shu ta'minotchi
// doirasida; aks holda (Ro'yxat ko'rinishi) - butun katalog bo'yicha.
function zkResetOpenPo(){
  const scoped=zkMode==="detail"&&zkSupFilter;
  const msgKey=scoped?"zk_reset_openpo_sup_confirm":"zk_reset_openpo_all_confirm";
  if(!confirm(t(msgKey).replace("{sup}",scoped?zkSupFilter:"")))return;
  const allSups=_zkBuildSuppliers("normal").concat(_zkBuildSuppliers("chuqur"));
  const rows=scoped?(allSups.find(s=>s.sup===zkSupFilter)?.rows||[]):allSups.flatMap(s=>s.rows);
  let ignored=0;
  rows.forEach(r=>{
    if(r.pendingQty>0&&r.sku){
      const entry=P8&&P8.skus?P8.skus[String(r.sku)]:null;
      const latest=entry&&entry.arrivals&&entry.arrivals.length?entry.arrivals.reduce((a,b)=>(b.date||"")>(a.date||"")?b:a):null;
      if(latest){zkIgnoreOpenPo["s:"+r.sku]={po:latest.order_no||latest.order_id||latest.date};ignored++;}
    }
  });
  zkSaveManual();
  renderZakas();
  alert(ignored?t("zk_sup_reset_done").replace("{n}",ignored):t("zk_reset_openpo_none"));
}
// Eksport uchun BELGILANGAN (checked) tovarlarni BARCHA supplierlar bo'yicha bir
// zumda tozalaydi - foydalanuvchi bir supplierda galochka qo'yib, keyin boshqa
// supplierga o'tib yana belgilasa, eskilari "esidan chiqib" eksportga qo'shilib
// ketmasligi uchun (foydalanuvchi so'rovi, 2026-07-20). Tasdiq so'ralmaydi -
// qayta belgilash oson, qaytarib bo'lmaydigan ma'lumot yo'qolmaydi.
function zkClearAllChecked(){
  zkRowChecked={};
  zkSaveManual();
  renderZakas();
  _zkRenderQuickPanel();
}
// "Tozalash" endi ikkita alohida narsani BITTA tugma ostida taklif qiladi (foydalanuvchi
// so'rovi, 2026-08-18: ilgari ta'minotchi header'ida yana bitta alohida "Tozalash" tugmasi
// bor edi - ikkita bir xil nomli tugma chalkashtirardi): (1) qo'lda kiritilgan
// o'zgarishlarni tozalash (zkResetAll, avvalgidek), (2) Open buyurtma bloklarini tozalash
// (zkResetOpenPo, yangi). Импорт tugmasi bilan bir xil kichik menyu naqshi.
function _zkInitResetBtn(){
  let wrap=document.getElementById("zk-reset-wrap");
  if(!wrap){
    const qwrap=document.getElementById("zk-quickbtn-wrap");if(!qwrap)return;
    wrap=document.createElement("span");
    wrap.id="zk-reset-wrap";
    wrap.style.cssText="position:relative;display:inline-flex;margin-right:8px";
    const btn=document.createElement("button");
    btn.id="zk-reset-btn";btn.type="button";
    btn.onclick=e=>{e.stopPropagation();_zkToggleResetMenu();};
    btn.style.cssText="display:flex;align-items:center;gap:5px;padding:7px 12px;border-radius:16px;background:#fff;border:1.5px solid #fde8e8;font-size:12px;font-weight:600;color:#E24B4A;cursor:pointer;flex-shrink:0";
    wrap.appendChild(btn);
    const menu=document.createElement("div");
    menu.id="zk-reset-menu";
    menu.style.cssText="display:none;position:absolute;top:calc(100% + 6px);left:0;z-index:60;background:#fff;border:1px solid #fde8e8;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.14);overflow:hidden;min-width:250px";
    menu.innerHTML=
      `<button type="button" class="zk-reset-mitem" data-t="manual" style="display:flex;align-items:center;gap:9px;width:100%;padding:11px 15px;border:none;background:#fff;cursor:pointer;font-size:13px;font-weight:600;color:#534AB7;text-align:left"><span style="flex-shrink:0">↺</span><span></span></button>`+
      `<button type="button" class="zk-reset-mitem" data-t="openpo" style="display:flex;align-items:center;gap:9px;width:100%;padding:11px 15px;border:none;border-top:1px solid #f7ece2;background:#fff;cursor:pointer;font-size:13px;font-weight:600;color:#B4690E;text-align:left"><span style="flex-shrink:0">📦</span><span></span></button>`;
    wrap.appendChild(menu);
    menu.querySelectorAll(".zk-reset-mitem").forEach(it=>{
      it.onmouseenter=()=>{it.style.background="#f7f6fc";};
      it.onmouseleave=()=>{it.style.background="#fff";};
      it.onclick=e=>{e.stopPropagation();menu.style.display="none";if(it.getAttribute("data-t")==="manual")zkResetAll();else zkResetOpenPo();};
    });
    qwrap.parentNode.insertBefore(wrap,qwrap);
  }
  const btn=document.getElementById("zk-reset-btn");
  if(btn)btn.innerHTML=`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/></svg> ${t("zk_reset_btn")}`;
  const manualLbl=wrap.querySelector('.zk-reset-mitem[data-t="manual"] span:last-child');
  if(manualLbl)manualLbl.textContent=t("zk_reset_menu_manual");
  const openLbl=wrap.querySelector('.zk-reset-mitem[data-t="openpo"] span:last-child');
  if(openLbl)openLbl.textContent=(zkMode==="detail"&&zkSupFilter)?t("zk_reset_menu_openpo_sup").replace("{sup}",zkSupFilter):t("zk_reset_menu_openpo_all");
}
function _zkToggleResetMenu(){const m=document.getElementById("zk-reset-menu");if(m)m.style.display=(m.style.display==="none"||!m.style.display)?"block":"none";}
document.addEventListener("click",function(e){const w=document.getElementById("zk-reset-wrap");const m=document.getElementById("zk-reset-menu");if(w&&m&&!w.contains(e.target))m.style.display="none";});
// ─── Zakas → Invan'ga TO'G'RIDAN-TO'G'RI yuborish (2026-07-23) ───
// IKKITA tugma: DEMO (yashil, sinov uchun - har doim ishlaydi, real akkauntga
// ta'sir qilmaydi) va INVAN/HAQIQIY (qizil, ehtiyot rangida - hozircha backend
// tomonidan REJA ASOSIDA o'chiq: INVAN_TOKEN Vercel'da hali sozlanmagan, shuning
// uchun bosilsa aniq "hali sozlanmagan" xatosi qaytadi, HECH QANDAY noto'g'ri
// yoki yarim-bajarilgan buyurtma yaratilmaydi - real tokenning yozish huquqi va
// SKU/ta'minotchi bog'lanishi nazoratli sinovda tasdiqlangach yoqiladi).
function _zkInvanEndpoint(){return (location.protocol==="file:"?"https://tiin-market.vercel.app":"")+"/api/invan-order";}
// Bitta "Импорт" tugmasi (Экспорт yonida, bir xil ko'rinish) - bosilganda kichik
// menyu ochiladi: Demo (sinov) yoki Invan (haqiqiy). Tanlangач zkSendToInvan()
// avvalgidek ogohlantirish bilan davom etadi. Tartibli ko'rinish (foydalanuvchi
// so'rovi, 2026-07-23) - avval ikkita alohida rangli tugma edi.
function _zkInitInvanBtn(){
  let wrap=document.getElementById("zk-invan-wrap");
  if(!wrap){
    const exp=document.getElementById("zk-export-btn");if(!exp||!exp.parentNode)return;
    wrap=document.createElement("span");
    wrap.id="zk-invan-wrap";
    wrap.style.cssText="position:relative;display:inline-flex;margin-right:8px";
    // Import tugmasi - Export bilan bir xil ko'rinish (xls-export-btn klassi)
    const btn=document.createElement("button");
    btn.id="zk-invan-btn";btn.type="button";btn.className="xls-export-btn";
    btn.onclick=e=>{e.stopPropagation();_zkToggleInvanMenu();};
    btn.innerHTML=`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v13"/><path d="M8 7l4-4 4 4"/><path d="M5 21h14"/></svg><span>Импорт</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="margin-left:2px"><polyline points="6 9 12 15 18 9"/></svg>`;
    wrap.appendChild(btn);
    const menu=document.createElement("div");
    menu.id="zk-invan-menu";
    menu.style.cssText="display:none;position:absolute;top:calc(100% + 6px);right:0;z-index:60;background:#fff;border:1px solid #e6e2f7;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.14);overflow:hidden;min-width:220px";
    menu.innerHTML=
      `<button type="button" class="zk-invan-mitem" data-t="excel" style="display:flex;align-items:center;gap:9px;width:100%;padding:11px 15px;border:none;background:#fff;cursor:pointer;font-size:13px;font-weight:600;color:#534AB7;text-align:left"><span style="flex-shrink:0">📋</span><span></span></button>`+
      `<button type="button" class="zk-invan-mitem" data-t="demo" style="display:flex;align-items:center;gap:9px;width:100%;padding:11px 15px;border:none;border-top:1px solid #f0eef8;background:#fff;cursor:pointer;font-size:13px;font-weight:600;color:#1D9E75;text-align:left"><span style="width:9px;height:9px;border-radius:50%;background:#1D9E75;flex-shrink:0"></span><span></span></button>`+
      `<button type="button" class="zk-invan-mitem" data-t="prod" id="zk-invan-prod-item" style="display:flex;align-items:center;gap:9px;width:100%;padding:11px 15px;border:none;border-top:1px solid #f0eef8;background:#fff;cursor:pointer;font-size:13px;font-weight:600;color:#E24B4A;text-align:left"><span style="width:9px;height:9px;border-radius:50%;background:#E24B4A;flex-shrink:0"></span><span></span></button>`+
      `<button type="button" class="zk-invan-mitem" data-t="account" style="display:flex;align-items:center;gap:9px;width:100%;padding:11px 15px;border:none;border-top:1px solid #f0eef8;background:#fff;cursor:pointer;font-size:12.5px;font-weight:600;color:#888;text-align:left"><span style="flex-shrink:0">👤</span><span></span></button>`;
    wrap.appendChild(menu);
    menu.querySelectorAll(".zk-invan-mitem").forEach(it=>{
      it.onmouseenter=()=>{it.style.background="#f7f6fc";};
      it.onmouseleave=()=>{it.style.background="#fff";};
      it.onclick=e=>{e.stopPropagation();menu.style.display="none";const tv=it.getAttribute("data-t");if(tv==="excel")_zkPickBarcodeFile();else if(tv==="account")zkInvanSwitchAccount();else zkSendToInvan(tv);};
    });
    exp.parentNode.insertBefore(wrap,exp.nextSibling);  // Export'dan KEYIN (Export tepa/oldinda qoladi)
  }
  wrap.style.display=(zkMode==="detail"&&zkSupFilter)?"inline-flex":"none";
  // Har chaqirilganda label'lar yangilanadi - til almashtirilganda yoki shaxsiy
  // hisob ulangan/almashtirilganda darhol aks etishi uchun (bir marta
  // yaratilgandan keyin ham, chunki bu menyu DOM'da qayta ishlatiladi).
  const excelItem=wrap.querySelector('.zk-invan-mitem[data-t="excel"] span:last-child');
  if(excelItem)excelItem.textContent=t("zk_excel_check_menu");
  const demoItem=wrap.querySelector('.zk-invan-mitem[data-t="demo"] span:last-child');
  if(demoItem)demoItem.textContent=t("zk_file_menu_demo");
  const prodItem=document.getElementById("zk-invan-prod-item");
  if(prodItem){
    const nm=_zkInvanMyName("prod");
    prodItem.querySelector("span:last-child").textContent=t("zk_file_menu_invan")+(nm?" ("+nm+")":"");
  }
  const acctItem=wrap.querySelector('.zk-invan-mitem[data-t="account"] span:last-child');
  if(acctItem)acctItem.textContent=t("zk_invan_switch_account_menu");
}
function _zkToggleInvanMenu(){const m=document.getElementById("zk-invan-menu");if(m)m.style.display=(m.style.display==="none"||!m.style.display)?"block":"none";}
// Joriy login menejer ismi (buyurtma izohiga yoziladi - Invan'da "yaratgan" maydoni
// static token egasi (integratsiya akkaunti) bo'lib qoladi, shuning uchun haqiqiy
// menejerни izohда qayd etamiz).
function _zkManagerName(){try{const u=JSON.parse(localStorage.getItem("tiin_user")||"{}");return (u.name||u.phone||"").trim();}catch(e){return "";}}
// ─── Invan SHAXSIY hisob (login) ───
// Muammo (foydalanuvchi topilmasi, 2026-07-25): "Invan'ga yuborish" bosilganda
// buyurtma HAR DOIM bitta umumiy statik token (integratsiya hisobi) nomidan
// ketardi - kim sайтдан yuborishidan qat'iy nazar Invan'da "yaratuvchi" doim
// bitta xodim (masalan Murodjon Tursunov) bo'lib ko'rinardi. Yechim: har bir
// foydalanuvchi BIR MARTA o'z shaxsiy Invan telefon+paroli bilan kiradi, olingan
// token brauzerda (localStorage) saqlanadi va SHU token orqali buyurtma
// yaratiladi - shunda Invan'да buyurtma haqiqatan ham SHU odam nomidan ko'rinadi.
// Faqat "prod" (haqiqiy Invan) uchun kerak - demo umumiy sinov hisobida qoladi.
// Invan token saytdagi JORIY login qilgan xodimga (tiin_user) BOG'LANADI - aks
// holda bitta kompyuterda ikkinchi xodim kirganda ham birinchisining Invan
// hisobi ishlatilib qolaverar edi (foydalanuvchi topilmasi, 2026-07-25: "boshqa
// user o'zinikidan kirib zakas bossa meni akkauntimdan ketib qolmaydimi").
function _zkInvanUserSuffix(){try{const u=JSON.parse(localStorage.getItem("tiin_user")||"{}");return String(u.id||u.phone||"anon");}catch(e){return "anon";}}
function _zkInvanTokenKey(target){return "invan_my_token_"+target+"_"+_zkInvanUserSuffix();}
function _zkInvanNameKey(target){return "invan_my_name_"+target+"_"+_zkInvanUserSuffix();}
function _zkInvanMyToken(target){try{return localStorage.getItem(_zkInvanTokenKey(target))||"";}catch(e){return "";}}
function _zkInvanMyName(target){try{return localStorage.getItem(_zkInvanNameKey(target))||"";}catch(e){return "";}}
function _zkInvanSetMy(target,token,name){try{localStorage.setItem(_zkInvanTokenKey(target),token);localStorage.setItem(_zkInvanNameKey(target),name||"");}catch(e){}}
function _zkInvanClearMy(target){try{localStorage.removeItem(_zkInvanTokenKey(target));localStorage.removeItem(_zkInvanNameKey(target));}catch(e){}}
// Telefon+parol so'raydigan modal - muvaffaqiyatli bo'lsa token'ni saqlab
// Promise<string|null> qaytaradi (bekor qilinsa/xato bo'lsa null).
function _zkInvanLoginPrompt(target){
  return new Promise(resolve=>{
    let ov=document.getElementById("zk-invan-login-modal");if(ov)ov.remove();
    ov=document.createElement("div");ov.id="zk-invan-login-modal";
    ov.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px";
    const close=val=>{ov.remove();resolve(val);};
    ov.onclick=e=>{if(e.target===ov)close(null);};
    document.body.appendChild(ov);
    ov.innerHTML=`<div style="background:#fff;border-radius:16px;max-width:380px;width:100%;padding:22px 22px 18px;box-shadow:0 20px 60px rgba(0,0,0,.3)" onclick="event.stopPropagation()">
      <div style="font-size:16px;font-weight:700;color:#1D9E75;margin-bottom:6px">${esc(t("zk_invan_login_title"))}</div>
      <div style="font-size:12.5px;color:#888;margin-bottom:16px;line-height:1.5">${esc(t("zk_invan_login_desc"))}</div>
      <input id="zk-invan-login-phone" type="text" inputmode="numeric" autocomplete="username" placeholder="${esc(t("zk_invan_phone_ph"))}" style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid #e6e2f7;border-radius:9px;font-size:14px;margin-bottom:10px;font-family:inherit">
      <input id="zk-invan-login-pass" type="password" autocomplete="current-password" placeholder="${esc(t("zk_invan_pass_ph"))}" style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid #e6e2f7;border-radius:9px;font-size:14px;margin-bottom:6px;font-family:inherit">
      <div id="zk-invan-login-err" style="color:#E24B4A;font-size:12.5px;min-height:16px;margin-bottom:8px"></div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button id="zk-invan-login-cancel" type="button" style="padding:9px 16px;border-radius:9px;border:1.5px solid #eee;background:#fff;color:#666;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">${esc(t("zk_invan_cancel_btn"))}</button>
        <button id="zk-invan-login-submit" type="button" style="padding:9px 18px;border-radius:9px;border:none;background:#1D9E75;color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">${esc(t("zk_invan_login_btn"))}</button>
      </div>
    </div>`;
    const phoneInp=document.getElementById("zk-invan-login-phone");
    const passInp=document.getElementById("zk-invan-login-pass");
    const errEl=document.getElementById("zk-invan-login-err");
    const submitBtn=document.getElementById("zk-invan-login-submit");
    document.getElementById("zk-invan-login-cancel").onclick=()=>close(null);
    const doSubmit=async()=>{
      const phone=phoneInp.value.trim(),pass=passInp.value;
      if(!phone||!pass){errEl.textContent=t("zk_invan_fill_both");return;}
      errEl.textContent="";submitBtn.disabled=true;const oldTxt=submitBtn.textContent;submitBtn.textContent=t("zk_invan_login_wait");
      try{
        const r=await fetch(_zkInvanEndpoint(),{method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({action:"login",target,phone,password:pass})});
        const j=await r.json();
        if(j.ok&&j.token){
          _zkInvanSetMy(target,j.token,j.name||phone);
          close(j.token);
        }else{
          errEl.textContent=t("zk_invan_login_fail")+" "+(j.error||t("zk_file_unknown_error"));
          submitBtn.disabled=false;submitBtn.textContent=oldTxt;
        }
      }catch(e){
        errEl.textContent=t("zk_file_conn_error")+" "+(e&&e.message||e);
        submitBtn.disabled=false;submitBtn.textContent=oldTxt;
      }
    };
    submitBtn.onclick=doSubmit;
    passInp.onkeydown=e=>{if(e.key==="Enter")doSubmit();};
    setTimeout(()=>phoneInp.focus(),30);
  });
}
// prod uchun shaxsiy tokenni ta'minlaydi - keshda bo'lsa darhol qaytaradi, bo'lmasa
// login oynasini ochadi (foydalanuvchi bekor qilsa null qaytadi - yuborish to'xtaydi).
async function _zkInvanEnsureToken(target){
  if(target!=="prod")return null;
  const cached=_zkInvanMyToken(target);
  if(cached)return cached;
  return await _zkInvanLoginPrompt(target);
}
async function zkInvanSwitchAccount(){
  _zkInvanClearMy("prod");
  const tok=await _zkInvanLoginPrompt("prod");
  if(tok)alert(t("zk_invan_switched").replace("{name}",_zkInvanMyName("prod")||""));
}
// ─── Ikki marta yuborilishning oldini olish (foydalanuvchi so'rovi, 2026-07-25) ───
// 1) _zkInvanSending - so'rov davom etayotganda IKKALA (Avtomatik+Hujjatdan)
//    yuborish funksiyasi ham bloklanadi (tez ketma-ket bosish/ikkala tugma).
// 2) _zkInvanLastSent - oxirgi MUVAFFAQIYATLI yuborilgan buyurtmaning "imzosi"
//    (ta'minotchi+tovarlar+target) va vaqti eslab qolinadi; xuddi shu buyurtma
//    3 daqiqa ichida yana yuborilmoqchi bo'lsa - qo'shimcha ogohlantirish
//    chiqadi ("nima uchun hech narsa bo'lmadi" deb ikkinchi marta bosilishi -
//    eng ehtimolli haqiqiy xavf shu edi).
let _zkInvanSending=false;
let _zkInvanLastSent=null;
function _zkInvanSig(sup,target,items){return target+"|"+sup+"|"+items.map(it=>it.sku+":"+it.qty).sort().join(",");}
function _zkInvanCheckDup(sig){
  if(_zkInvanLastSent&&_zkInvanLastSent.sig===sig&&(Date.now()-_zkInvanLastSent.at)<180000){
    return confirm(t("zk_invan_dup_warn").replace("{po}",_zkInvanLastSent.po||"—"));
  }
  return true;
}
async function zkSendToInvan(target){
  if(_zkInvanSending)return;
  const sup=zkSupFilter;if(!sup){alert(t("zk_sup_open_first"));return;}
  const supN=_zkBuildSuppliers("normal"),supC=_zkBuildSuppliers("chuqur");
  const sN=supN.find(s=>s.sup===sup),sC=supC.find(s=>s.sup===sup);
  const rows=[...(sN?sN.rows:[]),...(sC?sC.rows:[])].filter(r=>_zkIsChecked(r)&&r.orderQty>0&&r.sku);
  if(!rows.length){alert(t("zk_no_selection"));return;}
  const items=rows.map(r=>({sku:String(r.sku),qty:r.orderQty,cost:r.rcost||0,name:r.name,bc:r.bc||[]}));
  const isProd=target==="prod";
  const sig=_zkInvanSig(sup,target,items);
  if(!_zkInvanCheckDup(sig))return;
  // Prod uchun AVVAL shaxsiy Invan hisobi ta'minlanadi (kesh yoki login oynasi) -
  // shunda buyurtma HAQIQATDA shu odam nomidan ketadi, umumiy integratsiya hisobi
  // emas (foydalanuvchi so'rovi, 2026-07-25). Bekor qilinsa - hech narsa yuborilmaydi.
  const myToken=isProd?await _zkInvanEnsureToken("prod"):null;
  if(isProd&&!myToken)return;
  let confirmMsg=(isProd?t("zk_file_confirm_prod"):t("zk_file_confirm_demo")).replace("{n}",items.length).replace("{sup}",sup);
  if(isProd)confirmMsg+="\n\n"+t("zk_invan_sending_as").replace("{name}",_zkInvanMyName("prod")||"");
  // MUHIM (foydalanuvchi topilmasi, 2026-07-24, konsolda tasdiqlangan): yangi tab
  // confirm()DAN OLDIN ochilsa, Chrome sahifani "faol emas" deb hisoblab, confirm()ni
  // BUTUNLAY BOSTIRADI (window.focus() ham yordam bermaydi - bu qat'iy xavfsizlik
  // siyosati, https://www.chromestatus.com/feature/5140698722467840). Shuning uchun
  // ENDI tab OCHILMAYDI confirm()dan oldin - avval oddiy, hech narsa ochmaydigan
  // confirm() ishlatiladi, tab esa FAQAT muvaffaqiyatli yuborilgandan KEYIN ochiladi
  // (shu paytda popup-bloker xavfi bo'lsa ham, bu ancha kam ziyonli - buyurtma
  // baribir yaratilgan bo'ladi, foydalanuvchi PO raqamini alert orqali ko'radi).
  if(!confirm(confirmMsg))return;
  _zkInvanSending=true;
  const _mgr=_zkManagerName();
  const _nd=new Date();
  const _expIso=`${_nd.getFullYear()}-${String(_nd.getMonth()+1).padStart(2,"0")}-${String(_nd.getDate()).padStart(2,"0")}T00:00:00Z`;
  const btnId=isProd?"zk-invan-prod-btn":"zk-invan-demo-btn";
  const btn=document.getElementById(btnId);const old=btn?btn.innerHTML:"";
  if(btn){btn.disabled=true;btn.innerHTML=t("zk_file_sending");}
  try{
    const r=await fetch(_zkInvanEndpoint(),{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({target,supplier_name:sup,comment:"Zakas: "+sup+(_mgr?(" - "+_mgr):""),expected_date:_expIso,items,invan_token:myToken||undefined})});
    const j=await r.json();
    if(j.ok){
      _zkInvanLastSent={sig,at:Date.now(),po:j.po};
      // Yuborilgan tovarlardan FAQAT haqiqatan Invan'ga QO'SHILGANLARINI (mapped)
      // belgidan chiqaramiz - qo'shilmagan (unmapped) qatorlar BELGILANGAN holicha
      // qoladi, aks holda ular "yuborishga tayyor" holatda ko'rinmay, foydalanuvchi
      // aynan qaysi tovar tushib qolganini bilmasdan qolardi (2026-07-28 aniqlangan
      // xato - avval HAMMASI, muvaffaqiyatsizlar ham, belgidan chiqarilardi).
      const _mappedSkus=new Set((j.mapped||[]).map(m=>String(m.sku)));
      rows.forEach(rr=>{if(_mappedSkus.has(String(rr.sku)))zkRowChecked[rr.key]=false;});zkSaveManual();
      window.open(_zkInvanOrdersUrl(isProd),"_blank");
      let m=(isProd?t("zk_file_success_prod"):t("zk_file_success_demo")).replace("{po}",j.po||"—").replace("{n}",j.added);
      if(j.unmapped&&j.unmapped.length)m+=`\n${t("zk_file_unmapped_suffix")} ${j.unmapped.length} ta`;
      m+="\n\n"+(isProd?t("zk_send_note_prod"):t("zk_send_note_demo"));
      alert(m);
      if(j.unmapped&&j.unmapped.length)zkInvanShowUnmapped(j.unmapped,"normal");
    }else if(j.token_expired){
      _zkInvanClearMy("prod");
      alert(t("zk_invan_token_expired"));
    }else{
      alert(t("zk_file_error_prefix")+" "+(j.error||t("zk_file_unknown_error"))+((j.unmapped&&j.unmapped.length)?("\n"+t("zk_file_unmapped_suffix")+" "+j.unmapped.length+" ta"):""));
      if(j.unmapped&&j.unmapped.length)zkInvanShowUnmapped(j.unmapped,"normal");
    }
  }catch(e){
    alert(t("zk_file_conn_error")+" "+(e&&e.message||e));
  }
  finally{_zkInvanSending=false;if(btn){btn.disabled=false;btn.innerHTML=old;}renderZakas();}
}
// ─── Invanga qo'shilmagan tovarlar (2026-07-28) ───
// resolveProductLocal() (api/invan-order.js) mahalliy indeksda topa olmagan
// tovarlar - haqiqatan Invan katalogida yo'q yoki SKU/barcode mos kelmadi.
// Modal: ro'yxat + Excel eksport + "belgini olib tashlash" (keyingi safar
// qisqaroq ro'yxat yuborilishi uchun) - foydalanuvchi so'rovi, 2026-07-28.
let _zkInvanUnmappedCtx=null;
function zkInvanShowUnmapped(items,flow){
  if(!items||!items.length)return;
  _zkInvanUnmappedCtx={items,flow};
  let ov=document.getElementById("zk-invan-unmapped-modal");
  if(ov)ov.remove();
  ov=document.createElement("div");ov.id="zk-invan-unmapped-modal";
  ov.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px";
  ov.onclick=e=>{if(e.target===ov)ov.remove();};
  document.body.appendChild(ov);
  const rh=items.map((u,i)=>`<tr style="${i%2?'background:#faf9fe':''}"><td style="padding:7px 10px;color:#bbb">${i+1}</td><td style="padding:7px 10px">${esc(u.name||'—')}</td><td style="padding:7px 10px;font-family:monospace;white-space:nowrap">${esc(u.sku||'—')}</td><td style="padding:7px 10px;font-family:monospace;white-space:nowrap">${esc((u.bc&&u.bc[0])||'—')}</td><td style="padding:7px 10px;text-align:right">${u.qty!=null?esc(String(u.qty)):'—'}</td></tr>`).join("");
  ov.innerHTML=`<div style="background:#fff;border-radius:16px;max-width:780px;width:100%;max-height:82vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.3)">
    <div style="padding:15px 20px;border-bottom:1px solid #eee;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
      <span style="font-size:16px;font-weight:700;color:#E24B4A">Invanga qo'shilmagan tovarlar (${items.length})</span>
      <span style="color:#888;font-size:12px">Invan katalogida SKU/shtrix-kod bo'yicha topilmadi</span>
      <span style="flex:1"></span>
      <button onclick="zkInvanExportUnmapped()" style="display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:12px;background:#1D9E75;border:none;color:#fff;font-size:13px;font-weight:600;cursor:pointer">⬇ Excel yuklab olish</button>
      <button onclick="document.getElementById('zk-invan-unmapped-modal').remove()" style="width:32px;height:32px;border-radius:8px;border:none;background:#f2f2f2;cursor:pointer;font-size:15px">✕</button>
    </div>
    <div style="overflow:auto;padding:6px 20px 16px">
      <table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="text-align:left;color:#888;font-size:11px;text-transform:uppercase;border-bottom:2px solid #f0eef8"><th style="padding:8px 10px">#</th><th style="padding:8px 10px">Tovar nomi</th><th style="padding:8px 10px">SKU</th><th style="padding:8px 10px">Shtrix-kod</th><th style="padding:8px 10px;text-align:right">Miqdor</th></tr></thead><tbody>${rh}</tbody></table>
    </div>
    <div style="padding:12px 20px;border-top:1px solid #eee;display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:#faf9fe">
      <span style="font-size:12.5px;color:#666">Keyingi safar bu ${items.length} ta tovar zakas ro'yxatida belgilangan holda qolaveradi (to'liq ro'yxat). Agar keyingi yuborishda ular QATNASHMASIN (qisqaroq ro'yxat) desangiz:</span>
      <span style="flex:1"></span>
      <button onclick="zkInvanUncheckUnmapped()" style="padding:7px 14px;border-radius:10px;border:1.5px solid #e6e2f7;background:#fff;font-size:12.5px;font-weight:600;color:#534AB7;cursor:pointer;white-space:nowrap">Belgini olib tashlash</button>
    </div>
  </div>`;
}
function zkInvanUncheckUnmapped(){
  if(!_zkInvanUnmappedCtx)return;
  const {items,flow}=_zkInvanUnmappedCtx;
  const skus=new Set(items.map(u=>String(u.sku)));
  if(flow==="file"){
    zkFileRows.forEach(r=>{if(skus.has(String(r.sku)))r.checked=false;});
    _zkSaveFileState();_renderZkFileTab();
  }else{
    const supN=_zkBuildSuppliers("normal"),supC=_zkBuildSuppliers("chuqur");
    [...supN,...supC].forEach(s=>s.rows.forEach(r=>{if(skus.has(String(r.sku)))zkRowChecked[r.key]=false;}));
    zkSaveManual();renderZakas();
  }
  const ov=document.getElementById("zk-invan-unmapped-modal");if(ov)ov.remove();
}
async function zkInvanExportUnmapped(){
  if(!_zkInvanUnmappedCtx||!_zkInvanUnmappedCtx.items.length)return;
  await _ensureExcelJS();
  if(typeof ExcelJS==="undefined")return;
  const wb=new ExcelJS.Workbook(),ws=wb.addWorksheet("Qo'shilmagan");
  const hdr=ws.addRow(["Tovar nomi","SKU","Shtrix-kod","Miqdor"]);
  hdr.eachCell(c=>{c.font={bold:true,color:{argb:"FFFFFFFF"}};c.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFE24B4A"}};c.alignment={horizontal:"center",vertical:"middle"};});
  _zkInvanUnmappedCtx.items.forEach(u=>ws.addRow([u.name||"",u.sku||"",(u.bc&&u.bc[0])||"",u.qty!=null?u.qty:""]));
  ws.columns=[{width:46},{width:16},{width:20},{width:12}];
  const buf=await wb.xlsx.writeBuffer();
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([buf],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));
  a.download=`invanga_qoshilmagan_${new Date().toISOString().slice(0,10)}.xlsx`;a.click();URL.revokeObjectURL(a.href);
}
// ─── Excel shtrix-kod tekshiruvi (supplier kelgan tovarni solishtirish) ───
// Supplier olib kelgan tovarlar ro'yxatini (Excel) yuklaymiz -> shtrix-kod bo'yicha shu
// supplierning zakas tovarlariga solishtiramiz. Topilganlar jadvalda filtrlanadi (faqat
// ular ko'rinadi, "Barchasini ko'rsatish" bilan qolganlari ham); topilmaganlar (yangi/
// boshqa tovarlar) alohida oynada (nom/barcode/miqdor/narx - FAYLDAN) va Excel eksportda.
function _zkNormBc(v){return String(v==null?"":v).replace(/\D/g,"");}
function _zkRowBcHit(r){if(!zkBcFilter)return true;return (r.bc||[]).some(b=>zkBcFilter.has(_zkNormBc(b)));}
function _zkPickBarcodeFile(){
  let inp=document.getElementById("zk-bc-file");
  if(!inp){
    inp=document.createElement("input");inp.type="file";inp.id="zk-bc-file";
    inp.accept=".xlsx,.xls,.csv";inp.style.display="none";
    inp.onchange=e=>{const f=e.target.files&&e.target.files[0];if(f)zkImportBarcodes(f);e.target.value="";};
    document.body.appendChild(inp);
  }
  inp.click();
}
// Excel ustunlarini sarlavha so'zi bo'yicha aniqlaydi (zakas/build_shablon.js naqshi)
function _zkDetectCols(headerRow){
  const col={name:-1,bc:-1,qty:-1,price:-1};
  headerRow.eachCell((c,i)=>{
    const t=String(c.value==null?"":c.value).toLowerCase();
    if(col.bc<0&&/штри|баркод|shtrix|barcode|bar\s*code|\bean\b/.test(t))col.bc=i;
    else if(col.name<0&&/наимен|назван|продукц|tovar|nomi|\bname\b|товар/.test(t))col.name=i;
    else if(col.qty<0&&/кол-?во|количест|miqdor|soni|\bqty\b|кол\b/.test(t))col.qty=i;
    else if(col.price<0&&/цена|нарх|narx|price|стоим/.test(t))col.price=i;
  });
  return col;
}
// Ba'zi ta'minotchi накладнаяlarida haqiqiy jadval sarlavhasi 1-qatorda emas (avval
// sarlavha/"Исполнитель"/"Заказчик" kabi meta-ma'lumot qatorlari bo'ladi, ba'zan
// birlashtirilgan katakchalar bilan). Shuning uchun birinchi bir nechta qatorni
// skanerlab, ENG KO'P kalit so'z (shtrix-kod SHART) topilgan qatorni sarlavha deb
// tanlaymiz - zakas/build_shablon.js'dagi bilan bir xil naqsh, faqat brauzerda.
function _zkFindHeaderRow(ws,maxScan){
  maxScan=Math.min(maxScan||30,ws.rowCount||30);
  let best=null,bestScore=-1;
  for(let rn=1;rn<=maxScan;rn++){
    const col=_zkDetectCols(ws.getRow(rn));
    if(col.bc<0)continue;  // shtrix-kod ustuni topilmasa - bu sarlavha bo'lolmaydi
    let score=3;
    if(col.name>=0)score++;
    if(col.qty>=0)score++;
    if(col.price>=0)score++;
    if(score>bestScore){bestScore=score;best={rn,col};}
  }
  return best;
}
async function zkImportBarcodes(file){
  const sup=zkSupFilter;
  if(!sup){alert(t("zk_sup_open_first"));return;}
  await _ensureExcelJS();
  if(typeof ExcelJS==="undefined"){alert(t("zk_file_lib_load_fail"));return;}
  let uploaded=[]; // {name,bc(norm),bcRaw,qty,price}
  const readInto=(wb)=>{
    const ws=wb.worksheets[0];
    if(!ws)throw new Error("EMPTY_SHEET");
    const found=_zkFindHeaderRow(ws);
    const col=found?found.col:_zkDetectCols(ws.getRow(1));
    const headerRn=found?found.rn:1;
    const hasHeader=col.bc>=0;
    ws.eachRow((row,rn)=>{
      if(rn<=headerRn&&hasHeader)return;
      let bcNorm="",bcRaw="",name="",qty="",price="";
      if(hasHeader){
        bcRaw=String(row.getCell(col.bc).value==null?"":row.getCell(col.bc).value);
        bcNorm=_zkNormBc(bcRaw.split(/[,;]/)[0]);
        if(col.name>0){const v=row.getCell(col.name).value;name=String(v==null?"":v).trim();}
        if(col.qty>0){const v=row.getCell(col.qty).value;qty=(v==null?"":v);}
        if(col.price>0){const v=row.getCell(col.price).value;price=(v==null?"":v);}
      }else{
        row.eachCell(c=>{if(bcNorm)return;const raw=String(c.value==null?"":c.value);const n=_zkNormBc(raw);if(n.length>=8){bcNorm=n;bcRaw=raw;}});
      }
      if(bcNorm.length>=6)uploaded.push({name,bc:bcNorm,bcRaw,qty,price});
    });
  };
  try{
    const buf=await file.arrayBuffer();
    try{
      const wb=new ExcelJS.Workbook();
      await wb.xlsx.load(buf);
      readInto(wb);
    }catch(inner){
      // ExcelJS ba'zi fayllarda (rasm/chizma bilan) "anchors" xatosi bilan yiqiladi -
      // faylni "tozalab" (drawing havolalari olib tashlanadi) avtomatik qayta urinamiz.
      if(inner&&inner.message==="EMPTY_SHEET")throw inner;
      uploaded=[];
      const cleanedBuf=await _zkStripDrawingsAndRetry(buf);
      const wb2=new ExcelJS.Workbook();
      await wb2.xlsx.load(cleanedBuf);
      readInto(wb2);
    }
  }catch(err){
    const msg=err&&err.message==="EMPTY_SHEET"?t("zk_file_empty_file"):(err&&err.message||err);
    alert(t("zk_file_read_error")+": "+msg);return;
  }
  if(!uploaded.length){alert(t("zk_bc_no_barcode"));return;}
  const supN=_zkBuildSuppliers("normal"),supC=_zkBuildSuppliers("chuqur");
  const sN=supN.find(s=>s.sup===sup),sC=supC.find(s=>s.sup===sup);
  const allRows=[...(sN?sN.rows:[]),...(sC?sC.rows:[])];
  const supBc=new Set();
  allRows.forEach(r=>(r.bc||[]).forEach(b=>supBc.add(_zkNormBc(b))));
  const seen=new Set(),notFound=[],matchedSet=new Set();
  uploaded.forEach(u=>{
    if(!u.bc||seen.has(u.bc))return;seen.add(u.bc);
    if(supBc.has(u.bc))matchedSet.add(u.bc);
    else notFound.push(u);
  });
  zkBcFilter=matchedSet;zkBcShowAll=false;
  zkBcStats={total:seen.size,matched:matchedSet.size,notFound};
  zkPage=1;
  renderZakas();
}
function zkBcToggleShowAll(){zkBcShowAll=!zkBcShowAll;renderZakas();}
function zkBcClear(){zkBcFilter=null;zkBcShowAll=false;zkBcStats=null;zkPage=1;renderZakas();}
// Banner HTML (aktiv bo'lsa) - jadval tepasida ko'rsatiladi
function _zkBcBanner(){
  if(!zkBcFilter||!zkBcStats)return "";
  const st=zkBcStats;
  const nf=st.notFound.length;
  const toggleTxt=zkBcShowAll?"Faqat topilganlar":"Barchasini ko'rsatish";
  return `<div style="margin:0 0 12px;padding:11px 16px;background:#f0f9f5;border:1px solid #cdeede;border-radius:12px;display:flex;align-items:center;gap:16px;flex-wrap:wrap;font-size:13px">
    <span style="font-weight:700;color:#1D9E75;display:inline-flex;align-items:center;gap:6px">📋 Shtrix-kod tekshiruvi</span>
    <span>Faylда <b>${st.total}</b> ta kod</span>
    <span style="color:#1D9E75">✓ <b>${st.matched}</b> topildi</span>
    ${nf?`<span style="color:#E24B4A;cursor:pointer;text-decoration:underline;font-weight:600" onclick="zkBcShowNotFound()">✕ ${nf} topilmadi — ko'rish</span>`:`<span style="color:#888">hammasi topildi</span>`}
    <span style="flex:1;min-width:8px"></span>
    <button onclick="zkBcToggleShowAll()" style="padding:6px 12px;border-radius:10px;border:1.5px solid #cdeede;background:#fff;font-size:12px;font-weight:600;color:#1D9E75;cursor:pointer">${toggleTxt}</button>
    <button onclick="zkBcClear()" style="padding:6px 12px;border-radius:10px;border:1.5px solid #fde2e2;background:#fff;font-size:12px;font-weight:600;color:#E24B4A;cursor:pointer">✕ Bekor qilish</button>
  </div>`;
}
function zkBcShowNotFound(){
  if(!zkBcStats||!zkBcStats.notFound.length)return;
  let ov=document.getElementById("zk-bc-modal");
  if(ov)ov.remove();
  ov=document.createElement("div");ov.id="zk-bc-modal";
  ov.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px";
  ov.onclick=e=>{if(e.target===ov)ov.remove();};
  document.body.appendChild(ov);
  const rows=zkBcStats.notFound;
  const rh=rows.map((u,i)=>`<tr style="${i%2?'background:#faf9fe':''}"><td style="padding:7px 10px;color:#bbb">${i+1}</td><td style="padding:7px 10px">${esc(u.name||'—')}</td><td style="padding:7px 10px;font-family:monospace;white-space:nowrap">${esc(u.bcRaw||u.bc)}</td><td style="padding:7px 10px;text-align:right">${u.qty!==''&&u.qty!=null?esc(String(u.qty)):'—'}</td><td style="padding:7px 10px;text-align:right">${u.price!==''&&u.price!=null?esc(String(u.price)):'—'}</td></tr>`).join("");
  ov.innerHTML=`<div style="background:#fff;border-radius:16px;max-width:780px;width:100%;max-height:82vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.3)">
    <div style="padding:15px 20px;border-bottom:1px solid #eee;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
      <span style="font-size:16px;font-weight:700;color:#E24B4A">Zakasda topilmagan tovarlar (${rows.length})</span>
      <span style="color:#888;font-size:12px">yangi yoki boshqa supplier tovarlari bo'lishi mumkin</span>
      <span style="flex:1"></span>
      <button onclick="zkBcExportNotFound()" style="display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:12px;background:#1D9E75;border:none;color:#fff;font-size:13px;font-weight:600;cursor:pointer">⬇ Excel yuklab olish</button>
      <button onclick="document.getElementById('zk-bc-modal').remove()" style="width:32px;height:32px;border-radius:8px;border:none;background:#f2f2f2;cursor:pointer;font-size:15px">✕</button>
    </div>
    <div style="overflow:auto;padding:6px 20px 16px">
      <table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="text-align:left;color:#888;font-size:11px;text-transform:uppercase;border-bottom:2px solid #f0eef8"><th style="padding:8px 10px">#</th><th style="padding:8px 10px">Tovar nomi</th><th style="padding:8px 10px">Shtrix-kod</th><th style="padding:8px 10px;text-align:right">Miqdor</th><th style="padding:8px 10px;text-align:right">Narx</th></tr></thead><tbody>${rh}</tbody></table>
    </div>
  </div>`;
}
async function zkBcExportNotFound(){
  if(!zkBcStats||!zkBcStats.notFound.length)return;
  await _ensureExcelJS();
  if(typeof ExcelJS==="undefined")return;
  const wb=new ExcelJS.Workbook(),ws=wb.addWorksheet("Topilmagan");
  const hdr=ws.addRow(["Tovar nomi","Shtrix-kod","Miqdor","Narx"]);
  hdr.eachCell(c=>{c.font={bold:true,color:{argb:"FFFFFFFF"}};c.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFE24B4A"}};c.alignment={horizontal:"center",vertical:"middle"};});
  zkBcStats.notFound.forEach(u=>ws.addRow([u.name||"",u.bcRaw||u.bc,u.qty===''?"":u.qty,u.price===''?"":u.price]));
  ws.columns=[{width:46},{width:20},{width:12},{width:14}];
  const buf=await wb.xlsx.writeBuffer();
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([buf],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));
  a.download=`topilmagan_tovarlar_${new Date().toISOString().slice(0,10)}.xlsx`;a.click();URL.revokeObjectURL(a.href);
}
// ─── "Hujjatdan buyurtma" tabi (2026-07-24) ───
// To'liq katalog (ZITEMS, ta'minotchidan qat'i nazar barcha tovar) bo'yicha shtrix-kod
// xaritasi - bir marta quriladi, keshlanadi (sahifa davomida katalog o'zgarmaydi).
function _zkFullBcMap(){
  if(_zkBcMapCache)return _zkBcMapCache;
  if(!ZITEMS){if(P2)_buildZItems();else return new Map();}
  const map=new Map();
  ZITEMS.forEach(v=>(v.bc||[]).forEach(b=>{const n=_zkNormBc(b);if(n&&!map.has(n))map.set(n,v);}));
  _zkBcMapCache=map;
  return map;
}
function zkSetPageTab(tab){if(zkPageTab===tab)return;zkPageTab=tab;_zkSaveViewState();renderZakas();}
// Yuqori tab (Avtomatik/Hujjatdan) faqat ta'minotchilar RO'YXATIDA ko'rinadi - bitta
// ta'minotchi ichiga kirilganda ("Avtomatik buyurtma" tabining detail ko'rinishi)
// yashiriladi, faqat "Ortga" tugmasi qoladi (foydalanuvchi so'rovi, 2026-07-24).
function _zkRenderPageTabs(){
  const el=document.getElementById("zk-page-tabs");if(!el)return;
  const show=zkPageTab==="file"||zkMode==="list";
  el.style.display=show?"":"none";
  if(!show)return;
  el.innerHTML=`<div class="zk-depth-tabs"><button class="zk-dtab${zkPageTab==="auto"?" active":""}" onclick="zkSetPageTab('auto')">${t("zk_tab_auto")}</button><button class="zk-dtab${zkPageTab==="file"?" active":""}" onclick="zkSetPageTab('file')">${t("zk_tab_file")}</button></div>`;
}
function zkFileSupplierPick(v){zkFileSupplier=v;zkFileRows=[];zkFileUnmatched=[];_zkSaveFileState();renderZakas();}
function _zkPickFileOrderFile(){
  if(!zkFileSupplier){alert(t("zk_file_pick_supplier_first"));return;}
  let inp=document.getElementById("zk-file-order-file");
  if(!inp){
    inp=document.createElement("input");inp.type="file";inp.id="zk-file-order-file";
    inp.accept=".xlsx,.xls";inp.style.display="none";
    inp.onchange=e=>{const f=e.target.files&&e.target.files[0];if(f)zkImportFileOrder(f);e.target.value="";};
    document.body.appendChild(inp);
  }
  inp.click();
}
function _zkCellText(v){
  if(v==null)return "";
  if(typeof v==="object")return v.richText?v.richText.map(p=>p.text).join(""):String(v.result==null?"":v.result);
  return String(v);
}
// Son o'qish: narx/soni ba'zi ta'minotchi fayllarida MATN sifatida ruscha formatда keladi
// ("28 000,00" — probel/nbsp mingliklar ajratkichi, vergul kasr ajratkichi). Oddiy Number()
// buni NaN qiladi va butun import "qator topilmadi" bilan yiqiladi — shuning uchun probel/nbsp
// olib tashlanadi va vergul kasr ajratkichi nuqtaga aylantiriladi (zakas/build_shablon.js naqshi).
function _zkParseNum(v){
  let s=_zkCellText(v).replace(/ /g," ").trim();
  if(!s)return NaN;
  s=s.replace(/\s+/g,"");
  const hasComma=s.includes(","),hasDot=s.includes(".");
  if(hasComma&&hasDot){
    if(s.lastIndexOf(",")>s.lastIndexOf("."))s=s.replace(/\./g,"").replace(",",".");
    else s=s.replace(/,/g,"");
  }else if(hasComma){s=s.replace(",",".");}
  return Number(s);
}
// Fayl o'qish - накладная kabi hujjatlarda sarlavha 1-qatorda bo'lmasligi mumkin, shuning
// uchun birinchi 20 qatorni skanerlab, nomi/soni/narxi ustunlari BOR qatorni topamiz
// (_zkDetectCols - sarlavha so'zi bo'yicha aniqlash, zakas/build_shablon.js bilan bir xil
// naqsh). Qator to'xtash sharti nomga emas, soni/narx SON ekanligiga tayanadi - "Итого"
// kabi jamlanma qatorlar ustidagi birlashtirilgan katakchalar matnni "sizdirib" yuborishi
// mumkin (build_shablon.js qurish jarayonida topilgan xato, shu yerda oldindan hisobga olindi).
async function zkImportFileOrder(file){
  if(!zkFileSupplier){alert(t("zk_file_pick_supplier_first"));return;}
  await _ensureExcelJS();
  if(typeof ExcelJS==="undefined"){alert(t("zk_file_lib_load_fail"));return;}
  let parsed=[];
  const readInto=(wb)=>{
    const ws=wb.worksheets[0];
    if(!ws)throw new Error("EMPTY_SHEET");
    let col=null,headerRn=0;
    for(let rn=1;rn<=Math.min(ws.rowCount,20);rn++){
      const c=_zkDetectCols(ws.getRow(rn));
      if(c.name>=0&&c.qty>=0&&c.price>=0){col=c;headerRn=rn;break;}
    }
    if(!col)throw new Error("NO_HEADER");
    for(let rn=headerRn+1;rn<=ws.rowCount;rn++){
      const row=ws.getRow(rn);
      const name=_zkCellText(row.getCell(col.name).value).trim();
      const qtyNum=_zkParseNum(row.getCell(col.qty).value);
      const priceNum=_zkParseNum(row.getCell(col.price).value);
      if(!name||isNaN(qtyNum)||isNaN(priceNum)){
        // Ba'zi hujjatlarda sarlavha 2 qatorga bo'lingan (masalan "Ставка"/"Сумма" davomi
        // boshqa ustunlarda) - hali birorta ham qator topilmagan bo'lsa, bu haqiqiy
        // ma'lumot TUGAGANI emas, faqat sarlavha davomi/bo'sh oraliq bo'lishi mumkin -
        // o'tkazib yuboramiz. Ma'lumot BOSHLANGANDAN keyingi bo'sh qator - haqiqiy oxiri
        // (Итого va h.k.), shundagina to'xtaymiz.
        if(parsed.length===0)continue;
        break;
      }
      let bcRaw="";
      if(col.bc>0)bcRaw=_zkCellText(row.getCell(col.bc).value).split(/[,;]/)[0].trim();
      parsed.push({name,bcRaw,bc:_zkNormBc(bcRaw),qty:qtyNum,price:priceNum});
    }
  };
  try{
    const buf=await file.arrayBuffer();
    try{
      const wb=new ExcelJS.Workbook();await wb.xlsx.load(buf);readInto(wb);
    }catch(inner){
      if(inner&&(inner.message==="EMPTY_SHEET"||inner.message==="NO_HEADER"))throw inner;
      parsed=[];
      const cleanedBuf=await _zkStripDrawingsAndRetry(buf);
      const wb2=new ExcelJS.Workbook();await wb2.xlsx.load(cleanedBuf);readInto(wb2);
    }
  }catch(err){
    const msg=err&&err.message==="EMPTY_SHEET"?t("zk_file_empty_file"):err&&err.message==="NO_HEADER"?t("zk_file_no_header"):(err&&err.message||err);
    alert(t("zk_file_read_error")+": "+msg);return;
  }
  if(!parsed.length){alert(t("zk_file_no_rows"));return;}
  const bcMap=_zkFullBcMap();
  const rows=[],unmatched=[];
  parsed.forEach(p=>{
    const hit=p.bc?bcMap.get(p.bc):null;
    if(hit)rows.push({name:p.name,bc:p.bc,bcRaw:p.bcRaw,qty:p.qty,price:p.price,origQty:p.qty,origPrice:p.price,sku:hit.sku,checked:true});
    else unmatched.push({name:p.name,bcRaw:p.bcRaw||"—",qty:p.qty,price:p.price});
  });
  zkFileRows=rows;zkFileUnmatched=unmatched;_zkSaveFileState();
  renderZakas();
}
// Qo'lda o'zgartirilgan soni/narxni fayldan yuklangan ASL qiymatga qaytaradi
// (foydalanuvchi so'rovi, 2026-07-25) - checked/tanlov holatiga tegmaydi.
function zkFileResetAll(){
  if(!zkFileRows.length)return;
  if(!confirm(t("zk_reset_confirm")))return;
  zkFileRows.forEach(r=>{r.qty=r.origQty;r.price=r.origPrice;});
  _zkSaveFileState();
  _renderZkFileTab();
}
function zkFileToggleRow(i){if(zkFileRows[i])zkFileRows[i].checked=!zkFileRows[i].checked;_zkSaveFileState();_renderZkFileTab();}
function zkFileToggleAll(){const all=zkFileRows.every(r=>r.checked);zkFileRows.forEach(r=>r.checked=!all);_zkSaveFileState();_renderZkFileTab();}
function zkFileSetQty(i,v){const n=Number(v);if(zkFileRows[i])zkFileRows[i].qty=isNaN(n)?0:n;_zkSaveFileState();_renderZkFileTab();}
// Ming ajratkichlarni (vergul va h.k.) tozalab, faqat raqam+nuqtani qoldiramiz -
// Avtomatik buyurtmadagi zkSetCost() bilan bir xil naqsh (foydalanuvchi so'rovi, 2026-07-25).
function zkFileSetPrice(i,v){const n=parseFloat(String(v).replace(/[^0-9.]/g,""));if(zkFileRows[i])zkFileRows[i].price=isNaN(n)?0:n;_zkSaveFileState();_renderZkFileTab();}
function zkFileShowUnmatched(){
  if(!zkFileUnmatched.length)return;
  let ov=document.getElementById("zk-file-modal");if(ov)ov.remove();
  ov=document.createElement("div");ov.id="zk-file-modal";
  ov.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px";
  ov.onclick=e=>{if(e.target===ov)ov.remove();};
  document.body.appendChild(ov);
  const rows=zkFileUnmatched;
  const rh=rows.map((u,i)=>`<tr style="${i%2?'background:#faf9fe':''}"><td style="padding:7px 10px;color:#bbb">${i+1}</td><td style="padding:7px 10px">${esc(u.name||'—')}</td><td style="padding:7px 10px;font-family:monospace;white-space:nowrap">${esc(u.bcRaw||'—')}</td><td style="padding:7px 10px;text-align:right">${u.qty!=null?esc(String(u.qty)):'—'}</td><td style="padding:7px 10px;text-align:right">${u.price!=null?esc(String(u.price)):'—'}</td></tr>`).join("");
  ov.innerHTML=`<div style="background:#fff;border-radius:16px;max-width:780px;width:100%;max-height:82vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.3)">
    <div style="padding:15px 20px;border-bottom:1px solid #eee;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
      <span style="font-size:16px;font-weight:700;color:#E24B4A">${esc(t("zk_file_modal_title"))} (${rows.length})</span>
      <span style="flex:1"></span>
      <button onclick="zkFileExportUnmatched()" style="display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:12px;background:#1D9E75;border:none;color:#fff;font-size:13px;font-weight:600;cursor:pointer">⬇ ${esc(t("zk_file_modal_export"))}</button>
      <button onclick="document.getElementById('zk-file-modal').remove()" style="width:32px;height:32px;border-radius:8px;border:none;background:#f2f2f2;cursor:pointer;font-size:15px">✕</button>
    </div>
    <div style="overflow:auto;padding:6px 20px 16px">
      <table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="text-align:left;color:#888;font-size:11px;text-transform:uppercase;border-bottom:2px solid #f0eef8"><th style="padding:8px 10px">#</th><th style="padding:8px 10px">${esc(t("zk_col_product"))}</th><th style="padding:8px 10px">${esc(t("zk_col_barcode"))}</th><th style="padding:8px 10px;text-align:right">${esc(t("zk_col_qty"))}</th><th style="padding:8px 10px;text-align:right">${esc(t("zk_col_cost"))}</th></tr></thead><tbody>${rh}</tbody></table>
    </div>
  </div>`;
}
async function zkFileExportUnmatched(){
  if(!zkFileUnmatched.length)return;
  await _ensureExcelJS();if(typeof ExcelJS==="undefined")return;
  const wb=new ExcelJS.Workbook(),ws=wb.addWorksheet("Topilmagan");
  const hdr=ws.addRow([t("zk_col_product"),t("zk_col_barcode"),t("zk_col_qty"),t("zk_col_cost")]);
  hdr.eachCell(c=>{c.font={bold:true,color:{argb:"FFFFFFFF"}};c.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFE24B4A"}};c.alignment={horizontal:"center",vertical:"middle"};});
  zkFileUnmatched.forEach(u=>{
    const row=ws.addRow([u.name||"",u.bcRaw||"",u.qty==null?"":u.qty,u.price==null?"":u.price]);
    if(u.qty!=null)row.getCell(3).numFmt=Number.isInteger(u.qty)?"#,##0":"#,##0.##";
    if(u.price!=null)row.getCell(4).numFmt=Number.isInteger(u.price)?"#,##0":"#,##0.##";
  });
  ws.columns=[{width:46},{width:20},{width:12},{width:14}];
  const buf=await wb.xlsx.writeBuffer();
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([buf],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));
  a.download=`topilmagan_tovarlar_${new Date().toISOString().slice(0,10)}.xlsx`;a.click();URL.revokeObjectURL(a.href);
}
// Ta'minotchi ro'yxatini keshlaydi (qidiruv har harf bosilganda qayta qurilmasligi
// uchun) - faqat _renderZkFileTab() chaqirilganda (holat o'zgarganda) yangilanadi.
let _zkFileSupAllNames=null;
function _zkFileSupToolbarHtml(){
  if(zkFileSupplier){
    return `<div class="zk-file-sup-chip" title="${esc(zkFileSupplier)}"><span>${esc(zkFileSupplier)}</span><button type="button" onclick="zkFileSupplierClear()" title="${esc(t("zk_file_sup_clear"))}">✕</button></div>`;
  }
  return `<div class="zk-file-sup-wrap" id="zk-file-sup-wrap"><input type="text" id="zk-file-sup-search" class="zk-file-sup-sel" placeholder="${esc(t("zk_file_sup_placeholder"))}" autocomplete="off" oninput="_zkFileRenderSupDrop()" onfocus="_zkFileRenderSupDrop()"><div class="zk-sup-drop" id="zk-file-sup-drop"></div></div>`;
}
function _zkFileRenderSupDrop(){
  const d=document.getElementById("zk-file-sup-drop");if(!d)return;
  const inp=document.getElementById("zk-file-sup-search");
  const q=(inp&&inp.value||"").toLowerCase().trim();
  let list=_zkFileSupAllNames||[];
  if(q)list=list.filter(n=>n.toLowerCase().includes(q));
  d._zkList=list;
  if(!list.length){d.innerHTML=`<div class="zk-sup-drop-empty">${t("topilmadi")}</div>`;}
  else{d.innerHTML=list.slice(0,300).map((n,i)=>`<div class="zk-sup-drop-item" data-si="${i}"><span>${esc(n)}</span></div>`).join("");}
  d.classList.add("open");
}
document.addEventListener("click",e=>{
  const item=e.target.closest&&e.target.closest("#zk-file-sup-drop .zk-sup-drop-item");
  if(item){
    const d=document.getElementById("zk-file-sup-drop");
    const list=d&&d._zkList;
    const n=list&&list[parseInt(item.dataset.si)];
    if(n)zkFileSupplierPick(n);
    return;
  }
  const wrap=document.getElementById("zk-file-sup-wrap");
  const drop=document.getElementById("zk-file-sup-drop");
  if(wrap&&drop&&!wrap.contains(e.target))drop.classList.remove("open");
});
function zkFileSupplierClear(){zkFileSupplier="";zkFileRows=[];zkFileUnmatched=[];_zkSaveFileState();renderZakas();}
// Import (bitta tugma+menyu, Avtomatik buyurtma bo'limidagi bilan bir xil ko'rinish/
// naqsh) - Excel yuklash/Demo/Invan uchtasi shu yerda. Farqi: bu yerda fayldan olingan
// soni/narx AYNAN saqlanadi (hisoblanmaydi) - _zkFullBcMap() orqali TO'LIQ katalog
// bo'yicha moslashtiriladi, "Excel tekshiruv"dagidek faqat filtr uchun ishlatilmaydi.
function _zkFileImportToggle(e){if(e)e.stopPropagation();const m=document.getElementById("zk-file-import-menu");if(m)m.style.display=(m.style.display==="none"||!m.style.display)?"block":"none";}
function _zkFileImportMenuClick(kind){
  const m=document.getElementById("zk-file-import-menu");if(m)m.style.display="none";
  if(kind==="excel"){
    if(!zkFileSupplier){alert(t("zk_file_pick_supplier_first"));return;}
    _zkPickFileOrderFile();
  }else if(kind==="account"){
    zkInvanSwitchAccount();
  }else{
    if(!zkFileRows.length){alert(t("zk_file_load_excel_first"));return;}
    zkSendFileToInvan(kind,null);
  }
}
document.addEventListener("click",function(e){const w=document.getElementById("zk-file-import-wrap");const m=document.getElementById("zk-file-import-menu");if(w&&m&&!w.contains(e.target))m.style.display="none";});
function _zkFileImportHtml(){
  return `<div class="zk-file-import-wrap" id="zk-file-import-wrap" style="position:relative;display:inline-flex">
    <button type="button" class="xls-export-btn" onclick="_zkFileImportToggle(event)"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v13"/><path d="M8 7l4-4 4 4"/><path d="M5 21h14"/></svg><span>Импорт</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="margin-left:2px"><polyline points="6 9 12 15 18 9"/></svg></button>
    <div class="zk-invan-menu" id="zk-file-import-menu" style="display:none;position:absolute;top:calc(100% + 6px);left:0;z-index:60;background:#fff;border:1px solid #e6e2f7;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.14);overflow:hidden;min-width:220px">
      <button type="button" onclick="_zkFileImportMenuClick('excel')" style="display:flex;align-items:center;gap:9px;width:100%;padding:11px 15px;border:none;background:#fff;cursor:pointer;font-size:13px;font-weight:600;color:#534AB7;text-align:left"><span style="flex-shrink:0">📋</span>${esc(t("zk_file_menu_excel"))}</button>
      <button type="button" onclick="_zkFileImportMenuClick('demo')" style="display:flex;align-items:center;gap:9px;width:100%;padding:11px 15px;border:none;border-top:1px solid #f0eef8;background:#fff;cursor:pointer;font-size:13px;font-weight:600;color:#1D9E75;text-align:left"><span style="width:9px;height:9px;border-radius:50%;background:#1D9E75;flex-shrink:0"></span>${esc(t("zk_file_menu_demo"))}</button>
      <button type="button" onclick="_zkFileImportMenuClick('prod')" style="display:flex;align-items:center;gap:9px;width:100%;padding:11px 15px;border:none;border-top:1px solid #f0eef8;background:#fff;cursor:pointer;font-size:13px;font-weight:600;color:#E24B4A;text-align:left"><span style="width:9px;height:9px;border-radius:50%;background:#E24B4A;flex-shrink:0"></span>${esc(t("zk_file_menu_invan"))}${_zkInvanMyName("prod")?" ("+esc(_zkInvanMyName("prod"))+")":""}</button>
      <button type="button" onclick="_zkFileImportMenuClick('account')" style="display:flex;align-items:center;gap:9px;width:100%;padding:11px 15px;border:none;border-top:1px solid #f0eef8;background:#fff;cursor:pointer;font-size:12.5px;font-weight:600;color:#888;text-align:left"><span style="flex-shrink:0">👤</span>${esc(t("zk_invan_switch_account_menu"))}</button>
    </div>
  </div>`;
}
// Topilgan (checked) qatorlarni Invan "Заказ" import shablonida (Наименование/Штрих
// код/Кол-во/Цена) yuklab beradi - fayldagi soni/narx AYNAN shu holicha (Avtomatik
// buyurtma'dagi _zkExportInvanTemplate bilan bir xil format, alohida - manba boshqa).
async function zkFileExportXLSX(){
  await _ensureExcelJS();
  if(typeof ExcelJS==="undefined")return;
  const rows=zkFileRows.filter(r=>r.checked);
  if(!rows.length){alert(t("zk_no_selection"));return;}
  const wb=new ExcelJS.Workbook();
  const ws=wb.addWorksheet("Заказ");
  // Supplier nomi + Summa ustuni + jami (2026-08-04) - _zkExportInvanTemplate bilan bir xil.
  const supRow=ws.addRow([zkFileSupplier||""]);
  ws.mergeCells(1,1,1,5);
  supRow.getCell(1).font={bold:true,size:12};
  const headerRow=ws.addRow(["Наименование","Штрих код","Кол-во","Цена","Сумма"]);
  headerRow.eachCell(c=>{c.font={bold:true};c.fill={type:"pattern",pattern:"solid",fgColor:{argb:"DDEBF7"}};c.alignment={horizontal:"center",vertical:"middle"};});
  let jami=0;
  rows.forEach(r=>{
    const summa=(r.qty||0)*(r.price||0);
    jami+=summa;
    const row=ws.addRow([r.name,r.bcRaw||r.bc||"",r.qty,r.price||0,summa]);
    row.getCell(3).numFmt=Number.isInteger(r.qty)?"#,##0":"#,##0.##";
    row.getCell(4).numFmt=Number.isInteger(r.price)?"#,##0":"#,##0.##";
    row.getCell(5).numFmt="#,##0";
  });
  const totRow=ws.addRow(["","","","ИТОГО",jami]);
  totRow.getCell(4).font={bold:true};totRow.getCell(4).alignment={horizontal:"right"};
  totRow.getCell(5).font={bold:true};totRow.getCell(5).numFmt="#,##0";
  ws.columns=[{width:42},{width:18},{width:10},{width:12},{width:16}];
  const buf=await wb.xlsx.writeBuffer();
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([buf],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));
  a.download=`buyurtma_${_zkSafeFileName(zkFileSupplier)}_${new Date().toISOString().slice(0,10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(a.href);
}
function _renderZkFileTab(){
  // "Avtomatik buyurtma" bo'limiga xos STATIK tugmalar (Export/Import/Tozalash/Tezkor
  // ro'yxat) - bular #zk-body TASHQARISIDA joylashgan, shuning uchun body.innerHTML
  // almashtirilganda avtomatik yo'qolmaydi va eski holicha (masalan ko'rinadigan)
  // qolib, yangi "Hujjatdan buyurtma" tugmalari bilan ustma-ust tushib qolar edi -
  // aynan shu sabab "Invan'ga yuborish" bosilganda hech narsa bo'lmasdi (foydalanuvchi
  // aslida ESKI, boshqa supplier kontekstiga bog'langan tugmani bosayotgan edi).
  ["zk-sup-count-row","zk-filter-row","zk-detail-search-row","zk-pag","zk-export-btn","zk-invan-wrap","zk-reset-btn","zk-quickbtn-wrap","zk-clearchk-btn"].forEach(id=>{const e=document.getElementById(id);if(e)e.style.display="none";});
  const body=document.getElementById("zk-body");if(!body)return;
  const supN=_zkBuildSuppliers("normal"),supC=_zkBuildSuppliers("chuqur");
  const names=new Set();
  supN.forEach(s=>{if(s.sup!==ZK_NO_SUPPLIER)names.add(s.sup);});
  supC.forEach(s=>{if(s.sup!==ZK_NO_SUPPLIER)names.add(s.sup);});
  _zkFileSupAllNames=[...names].sort((a,b)=>a.localeCompare(b,"ru"));
  let h=`<div class="zk-file-toolbar">
    ${_zkFileSupToolbarHtml()}
    ${_zkFileImportHtml()}
    <button class="xls-export-btn" type="button" onclick="zkFileExportXLSX()"${zkFileRows.length?"":" disabled"}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2F6FED" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></svg><span>${esc(t("export_btn"))}</span></button>
    <button type="button" onclick="zkFileResetAll()"${zkFileRows.length?"":" disabled"} style="display:inline-flex;align-items:center;gap:6px;padding:9px 14px;border-radius:8px;background:#fff;border:1.5px solid #fde8e8;font-size:13px;font-weight:700;color:#E24B4A;cursor:pointer;font-family:inherit"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/></svg><span>${esc(t("zk_reset_btn"))}</span></button>
  </div>`;
  if(!zkFileRows.length&&!zkFileUnmatched.length){
    h+=`<div class="zk-empty">${esc(t("zk_file_empty_hint"))}</div>`;
    body.innerHTML=h;return;
  }
  const nf=zkFileUnmatched.length;
  h+=`<div class="zk-file-banner">
    <span style="font-weight:700;color:#1D9E75">✓ ${zkFileRows.length} ${esc(t("zk_file_found_label"))}</span>
    ${nf?`<span style="color:#E24B4A;cursor:pointer;text-decoration:underline;font-weight:600" onclick="zkFileShowUnmatched()">✕ ${nf} ${esc(t("zk_file_unmatched_view"))}</span>`:`<span style="color:#888">${esc(t("zk_file_all_found"))}</span>`}
  </div>`;
  if(zkFileRows.length){
    const allChecked=zkFileRows.every(r=>r.checked);
    const rowsHtml=zkFileRows.map((r,i)=>{
      const sum=r.checked?r.qty*r.price:0;
      const priceDisp=r.price>0?r.price.toLocaleString(undefined,{maximumFractionDigits:2}):"";
      return `<tr><td style="text-align:center"><input type="checkbox" class="zk-chk"${r.checked?" checked":""} onchange="zkFileToggleRow(${i})"></td><td style="color:#bbb;font-size:11px">${i+1}</td><td>${esc(r.name)}</td><td style="font-family:monospace;font-size:11px;color:#888">${esc(r.bcRaw||r.bc||"—")}</td><td style="text-align:right"><input class="zk-adj-inp" type="number" min="0" step="0.01" value="${r.qty}" onchange="zkFileSetQty(${i},this.value)"></td><td style="text-align:right"><input class="zk-adj-inp" type="text" inputmode="decimal" style="width:86px" value="${priceDisp}" onchange="zkFileSetPrice(${i},this.value)"></td><td style="text-align:right;font-weight:600;color:#1D9E75">${sum?Math.round(sum).toLocaleString():"—"}</td></tr>`;
    }).join("");
    const total=zkFileRows.reduce((a,r)=>a+(r.checked?r.qty*r.price:0),0);
    // .zk-sup-block - Avtomatik buyurtmadagi bilan AYNAN bir xil klass (flex-column,
    // ichida jadval scroll bo'ladi, jami summa esa DOIM ko'rinadigan qoladi) - avval
    // oddiy <div> ishlatilgani sabab jadval scroll qilinmas, jami summa ko'rinmas edi
    // (foydalanuvchi topilmasi, 2026-07-25).
    h+=`<div class="zk-sup-block"><div class="zk-tbl-wrap"><table class="zk-ktbl"><colgroup><col style="width:4%"><col style="width:3%"><col style="width:36%"><col style="width:16%"><col style="width:12%"><col style="width:14%"><col style="width:15%"></colgroup>
      <thead><tr><th style="text-align:center"><input type="checkbox" class="zk-chk"${allChecked?" checked":""} onchange="zkFileToggleAll()"></th><th>#</th><th style="text-align:left">${esc(t("zk_col_product"))}</th><th style="text-align:left">${esc(t("zk_col_barcode"))}</th><th style="text-align:right">${esc(t("zk_col_qty"))}</th><th style="text-align:right">${esc(t("zk_col_cost"))}</th><th style="text-align:right">${esc(t("zk_col_sum"))}</th></tr></thead>
      <tbody>${rowsHtml}</tbody></table></div>
      <div style="text-align:right;padding:9px 16px 11px;font-size:13px;color:#666;border-top:1px solid #f0eef8">${esc(t("zk_checked_total_label"))}: <b style="color:#1D9E75;font-size:18px">${Math.round(total).toLocaleString()} so'm</b></div></div>`;
  }
  body.innerHTML=h;
}
async function zkSendFileToInvan(target,btnEl){
  if(_zkInvanSending)return;
  const sup=zkFileSupplier;if(!sup){alert(t("zk_file_pick_supplier_first"));return;}
  const rows=zkFileRows.filter(r=>r.checked&&r.qty>0&&r.sku);
  if(!rows.length){alert(t("zk_file_no_checked"));return;}
  const items=rows.map(r=>({sku:String(r.sku),qty:r.qty,cost:r.price||0,name:r.name,bc:r.bc||[]}));
  const isProd=target==="prod";
  const sig=_zkInvanSig(sup,target,items);
  if(!_zkInvanCheckDup(sig))return;
  const myToken=isProd?await _zkInvanEnsureToken("prod"):null;
  if(isProd&&!myToken)return;
  let confirmMsg=(isProd?t("zk_file_confirm_prod"):t("zk_file_confirm_demo")).replace("{n}",items.length).replace("{sup}",sup);
  if(isProd)confirmMsg+="\n\n"+t("zk_invan_sending_as").replace("{name}",_zkInvanMyName("prod")||"");
  // Tab confirm()DAN OLDIN OCHILMAYDI - Chrome "faol emas tab" bo'lsa confirm()ni
  // butunlay bostiradi (window.focus() ham yordam bermaydi, konsolda tasdiqlangan
  // xavfsiz siyosat). Tab faqat muvaffaqiyatli yuborilgandan KEYIN ochiladi.
  if(!confirm(confirmMsg))return;
  _zkInvanSending=true;
  const _mgr=_zkManagerName();
  const _nd=new Date();
  const _expIso=`${_nd.getFullYear()}-${String(_nd.getMonth()+1).padStart(2,"0")}-${String(_nd.getDate()).padStart(2,"0")}T00:00:00Z`;
  const old=btnEl?btnEl.innerHTML:"";
  if(btnEl){btnEl.disabled=true;btnEl.innerHTML=t("zk_file_sending");}
  try{
    const r=await fetch(_zkInvanEndpoint(),{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({target,supplier_name:sup,comment:"Hujjatdan buyurtma: "+sup+(_mgr?(" - "+_mgr):""),expected_date:_expIso,items,invan_token:myToken||undefined})});
    const j=await r.json();
    if(j.ok){
      _zkInvanLastSent={sig,at:Date.now(),po:j.po};
      // Faqat haqiqatan qo'shilgan (mapped) qatorlar belgidan chiqariladi - qo'shilmagan
      // (unmapped) qatorlar BELGILANGAN qoladi (2026-07-28 tuzatildi, avval hammasi
      // - muvaffaqiyatsizlar ham - belgidan chiqarilib, tushib qolgan tovar
      // ko'rinmas bo'lib qolardi).
      const _mappedSkus=new Set((j.mapped||[]).map(m=>String(m.sku)));
      rows.forEach(rr=>{if(_mappedSkus.has(String(rr.sku)))rr.checked=false;});_zkSaveFileState();
      window.open(_zkInvanOrdersUrl(isProd),"_blank");
      let m=(isProd?t("zk_file_success_prod"):t("zk_file_success_demo")).replace("{po}",j.po||"—").replace("{n}",j.added);
      if(j.unmapped&&j.unmapped.length)m+=`\n${t("zk_file_unmapped_suffix")} ${j.unmapped.length} ta`;
      alert(m);
      if(j.unmapped&&j.unmapped.length)zkInvanShowUnmapped(j.unmapped,"file");
    }else if(j.token_expired){
      _zkInvanClearMy("prod");
      alert(t("zk_invan_token_expired"));
    }else{
      alert(t("zk_file_error_prefix")+" "+(j.error||t("zk_file_unknown_error"))+((j.unmapped&&j.unmapped.length)?("\n"+t("zk_file_unmapped_suffix")+" "+j.unmapped.length+" ta"):""));
      if(j.unmapped&&j.unmapped.length)zkInvanShowUnmapped(j.unmapped,"file");
    }
  }catch(e){
    alert(t("zk_file_conn_error")+" "+(e&&e.message||e));
  }
  finally{_zkInvanSending=false;if(btnEl){btnEl.disabled=false;btnEl.innerHTML=old;}_renderZkFileTab();}
}
// Invan'ning "Buyurtmalar" (Orders) sahifasi - bugungi kundan 7 kun orqaga oralig'ida,
// do'kon bo'yicha filtrlangan. isProd=true -> haqiqiy (my.invan.uz, Tiin Optom),
// aks holda demo (dev.7i.uz, MaxiBoom).
function _zkInvanOrdersUrl(isProd){
  const fmt=d=>d.toISOString().slice(0,10);
  const today=new Date();
  const weekAgo=new Date(today.getTime()-7*864e5);
  const host=isProd?"https://my.invan.uz":"https://dev.7i.uz";
  const shop=isProd?"aa954511-3801-46f8-a0bd-d41fa7e40369":"fc0a3ed0-b8ce-4445-a8c9-7f0c077d1741";
  return `${host}/inventory/orders?search=&limit=10&page=1&shop_ids=${shop}&start_date=${fmt(weekAgo)}+00%3A00%3A00&end_date=${fmt(today)}+23%3A59%3A59`;
}
// Agar shu SKU'ning ENG SO'NGGI (sana bo'yicha) ta'minotchi buyurtmasi hali ochiq
// (Open/New) bo'lsa, kutilayotgan miqdorni qaytaradi - shunda Zakas takror buyurtma
// tavsiya qilmaydi, lekin tovar ro'yxatdan tushib qolmaydi. Faqat ENG SO'NGGI
// buyurtmaga qaraladi (barcha Open'larni jamlamaydi) - aks holda eski Ochiq buyurtma
// keyinroq boshqa (alohida) buyurtma orqali Qabul qilingan bo'lsa ham "Open" bo'lib
// noto'g'ri ko'rinib qolar edi.
// 2026-08-17 (Bilol so'rovi): "Open" buyurtma abadiy ochiq qolib ketishi mumkin
// (ta'minotchi hech qachon yopmagan/unutilgan) - shunday tovar Zakas'da CHEKSIZ
// muddat chetlab o'tilib qolmasin. Shu limitdan o'tgan "Open" buyurtma Zakas
// UCHUN (FAQAT shu yerda - Kirim/p8 bo'limidagi haqiqiy status buzilmaydi)
// endi yo'q hisoblanadi, tovar oddiy formulaga qaytadi.
const KR_OPEN_PO_ZAKAS_LIMIT_DAYS=30;
function krPendingQty(sku){
  if(!P8||!P8.skus||!sku)return 0;
  const entry=P8.skus[String(sku)];
  if(!entry||!entry.arrivals||!entry.arrivals.length)return 0;
  const latest=entry.arrivals.reduce((a,b)=>(b.date||"")>(a.date||"")?b:a);
  if(latest.status!=="Open"&&latest.status!=="New")return 0;
  // Menejer "bu Open buyurtma kelmaydi" deb qo'lda belgilagan bo'lsa (zkResetOpenPo())
  // - 30-kunlik muddatni kutmasdan darhol e'tiborsiz qoldiriladi. Belgi FAQAT
  // belgilangan PAYTDAGI aniq buyurtmaga tegishli - shu orada YANGI Open buyurtma
  // kelgan bo'lsa (order_no farq qiladi), eski belgi endi mos kelmaydi va tabiiy
  // ravishda o'tkazib yuboriladi (qo'lda tozalash shart emas).
  const ign=zkIgnoreOpenPo["s:"+sku];
  if(ign&&ign.po===(latest.order_no||latest.order_id||latest.date))return 0;
  if(latest.date){
    const openDays=Math.round((Date.now()-new Date(latest.date).getTime())/86400000);
    if(openDays>KR_OPEN_PO_ZAKAS_LIMIT_DAYS)return 0;
  }
  return latest.expected||0;
}
// Shu SKU'ning ehtimoliy karobka/blok o'lchamini P8 (kirim tarixi) orqali
// taxmin qiladi - hech qanday ta'minotchi/rasmiy manbada bu ma'lumot yozilmagan
// (2026-08-06, foydalanuvchi bilan tekshirilgan - Google/rasmiy shtrix-kod
// bazalarida ham topilmadi). Faqat HAQIQATDA kelgan (Received) miqdorlardan,
// 2 TA XIL son bo'lsagina (masalan 24 va 48) ularning eng katta umumiy
// bo'luvchisi (GCD) qaytariladi - bitta sondan (masalan faqat 48) ishonchli
// taxmin qilib bo'lmaydi (48 ning ko'p bo'luvchisi bor), shu holda 0 qaytadi
// va zakas soni yaxlitlanmaydi (xato taxmindan ko'ra yaxlitlamaslik xavfsiz).
function _zkBoxSize(sku){
  if(!P8||!P8.skus||!sku)return 0;
  const entry=P8.skus[String(sku)];
  if(!entry||!entry.arrivals)return 0;
  const qtys=[...new Set(entry.arrivals.filter(a=>a.status==="Received"&&a.qty>0).map(a=>Math.round(a.qty)))];
  if(qtys.length<2)return 0;
  const gcd=(a,b)=>b?gcd(b,a%b):a;
  const g=qtys.reduce((a,b)=>gcd(a,b));
  return g>1?g:0;
}
// Shu SKU uchun oxirgi kirim (kelish) sanasini P8 (kirim) ma'lumotidan qaytaradi.
function krLastDate(sku){
  if(!P8||!P8.skus||!sku)return"";
  const entry=P8.skus[String(sku)];
  return entry?(entry.last_date||""):"";
}
// Bir supplierning ISTALGAN tovari kritik/urgent bo'lsa - shu supplierning BARCHA tovarlari
// (dailyAvg>0 bo'lganlari) zakas ro'yxatiga tushadi, bir xil "maqsadli kun"ga moslab -
// shunda supplier bir martagina kelib hammasini birga to'ldiradi.
// MUHIM: bu funksiya global _ZK_ALLROWS'ga HECH QACHON tegmaydi (faqat o'z ichidagi
// lokal massivda _ri raqamlaydi) - shu sababli uni istalgan maqsadda (Tezkor ro'yxat,
// Export, qidiruv tekshiruvi va h.k.) xavfsiz chaqirish mumkin, ekranda ko'rsatilgan
// jadval bilan bog'liq global click-holatni buzmaydi. _ZK_ALLROWS'ni FAQAT renderZakas()
// o'zi, bitta aniq joyda (haqiqiy ko'rsatiladigan depth uchun) yangilaydi - avval bu
// funksiya global massivni har chaqiriqda qayta yozib yuborardi, natijada Tezkor
// ro'yxat/Export kabi "orqa fondagi" hisob-kitoblar keyinroq tovar ustiga bosilganda
// BUTUNLAY BOSHQA (tasodifiy) tovar ochilishiga sabab bo'lardi.
function _zkBuildSuppliers(depth){
  if(!ZITEMS)return [];
  const chuqur=(depth||zkDepth)==="chuqur";
  // Effektiv kunlik o'rtacha: muntazam = dailyAvg (30 kunlik), chuqur = pav (avvalgi davr)
  const eda=v=>chuqur?(v.pav||0):(v.dailyAvg||0);
  // Bo'lim doirasi: muntazam = oxirgi 30 kunda sotilgan (dailyAvg>0). Chuqur =
  // muntazamga tushmagan HAMMA tovar - ham avval sotilgan (pav>0, chuqur zakas
  // miqdori hisoblanadi), ham UMUMAN sotilmagan (pav=0 - miqdor 0, lekin tovar
  // baribir shu supplierning "hammasini ko'rsatish" ro'yxatida ko'rinadi, rahbar
  // shu supplierdan bu tovar ham mavjudligini bilib, xohlasa qo'lda buyurtma
  // kiritishi mumkin - "yo'qolib qolmasin" tamoyili).
  const inScope=v=>chuqur?!(v.dailyAvg>0):(v.dailyAvg>0);
  // Ta'minotchisi noma'lum tovarlar ZK_NO_SUPPLIER umumiy guruhiga tushadi.
  const supOf=v=>v.sup||ZK_NO_SUPPLIER;
  // HAR BIR ta'minotchi (real yoki Noma'lum) shu bo'lim (muntazam/chuqur) doirasiga
  // mos tovari bo'lsa - ko'rinadi, "kritik/urgent" signalidan QAT'I NAZAR (avval
  // faqat kritik/urgent bor ta'minotchilar ko'rinar edi, ko'plab tovarni butunlay
  // yashirib qo'ygan edi). eda(v)=0 (na dailyAvg, na pav) bo'lgan tovar ham
  // qo'shiladi - pastdagi orderQty formulasi bunday tovar uchun tabiiy ravishda 0
  // beradi (_da=0), "faqat kerak bo'lganlar" ko'rinishida avtomatik yashiriladi,
  // "hammasini ko'rsatish"da esa ko'rinadi. "Zakas kerak" (orderQty>0) - maqsadli
  // kun (target) asosida pastda alohida hisoblanadi, bu yerga bog'liq emas.
  const bySup={};
  ZITEMS.forEach(v=>{
    if(!inScope(v))return;
    const sup=supOf(v);
    (bySup[sup]=bySup[sup]||[]).push(v);
  });
  const supNames=Object.keys(bySup).sort((a,b)=>a.localeCompare(b,"ru"));
  const out=supNames.map(sup=>{
    const target=zkSupTargets[sup]!=null?zkSupTargets[sup]:ZK_DEFAULT_TARGET;
    const rows=bySup[sup].map(v=>{
      // Kalit depth (muntazam/chuqur) bilan prefikslanadi - shu SKU ikkala bo'limda
      // ham (masalan qayta tasniflanganda) BUTUNLAY MUSTAQIL adj/qty/galochka holatiga
      // ega bo'lishi kk, biri ikkinchisiga "o'tib qolmasin" (foydalanuvchi so'rovi, 2026-07-21).
      const key=(chuqur?"chuqur:":"normal:")+_zkRowKey(v);
      const adj=zkRowAdj[key]||0;
      // Stok manbai: sukut bo'yicha Invan (v.stock). Foydalanuvchi shu qatorda "Hisoblangan
      // stok"ni tanlagan bo'lsa (zkRowStockMode[key]==="calc") VA backend_p_calc_stock.py
      // shu SKU uchun ishonchli qiymat topgan bo'lsa (v.calcStock!=null) - o'shani ishlatadi.
      // DIQQAT: bu FAQAT kirish qiymatini tanlaydi - zakasDays/orderQty formulasi (pastda)
      // BIR HARF HAM o'zgarmagan, faqat "qaysi son"dan boshlanishi almashadi (Bilol ruxsati
      // bilan, 2026-07-27). _dl formulasi avvalgi umumiy edl(v)dagi bilan AYNAN bir xil -
      // faqat endi qatorning effektiv stokidan hisoblanadi (edl endi hech qayerdan
      // chaqirilmagani uchun olib tashlandi, formula o'zi o'zgarmagan).
      // STANDART REJIM = HISOB (2026-08-04, foydalanuvchi qarori): zakas endi
      // hisoblangan stokdan boshlanadi, Invan qiymati kerak bo'lsa qo'lda tanlanadi.
      // Shuning uchun mantiq TESKARI saqlanadi: xotirada BELGI YO'Q = "calc",
      // "invan" esa foydalanuvchi ataylab tanlaganda yoziladi (eski xotirada
      // saqlangan "calc" qiymatlar ham to'g'ri ishlayveradi - ular ham !== "invan").
      // Qo'lda tuzatish (STOCK_OV, Vercel Blob'dan) bo'lsa - u calcStock'ning
      // USTIDAN eng yuqori ustuvorlik bilan qo'llaniladi (menejer jismonan
      // sanagan son, modeldan ishonchliroq). "Invan" rejimi tanlangan bo'lsa
      // ham bu tuzatish ko'rsatiladi - tuzatish aynan "hisoblangan" tarafning
      // o'rnini bosadi.
      // 2026-08-19 (Bilol so'rovi: "qo'lda o'zgartirsam ham savdo/kirim bilan
      // yangilanib borsin" - avval qiymat butunlay QOTIB QOLARDI). Backend
      // (_live_invdata) endi tuzatish kiritilgan VAQTdan (updated_at) buyon
      // Invan'da sodir bo'lgan sotuv/kirimni hisobga olib, jonli yangilangan
      // qiymatni `v.ovEffective`da beradi - calcStock live-tuzatishi bilan
      // BIR XIL mantiq, faqat har tuzatish O'Z vaqtidan boshlanadi. Server
      // shu safar hisoblay olmasa (masalan Blob/Invan vaqtincha xato bersa)
      // xom `_ov.value`ga qaytiladi - hech qachon butunlay yo'qolib qolmaydi.
      const _ov=v.sku?STOCK_OV[String(v.sku)]:null;
      const _effCalc=_ov?(v.ovEffective!=null?v.ovEffective:_ov.value):v.calcStock;
      const useCalcStock=_effCalc!=null&&zkRowStockMode[key]!=="invan";
      const stock=(useCalcStock?_effCalc:v.stock)||0;
      const _da=eda(v);
      const _dl=(stock>0&&_da>0)?Math.round(stock/_da):(stock===0?0:null);
      // Manfiy stok = haqiqiy qoldiq noma'lum (Invan xatosi) - zakas miqdori taklif qilinmaydi,
      // lekin tovar tekshirish uchun ro'yxatda ko'rinishda qoladi.
      const daysLeft=_dl!=null?_dl:0;
      // Xavfsizlik zaxirasi: maqsadli kun ABC bo'yicha kengaytiriladi (ZK_BUFFER).
      // FAQAT MUNTAZAM bo'limga qo'llanadi - chuqur zakas (pav asosidagi, oylab
      // sotilmagan tovarlar) o'z mantig'ida qoladi, unga zaxira qo'shish ma'nosiz
      // va xavfli (foydalanuvchi so'rovi, 2026-07-21).
      // ABC bo'sh bo'lgan tovar (katalogda bor, oxirgi 30 kunda sotuvi yo'q) C sifatida.
      // ZABC (kategoriya-ichi ABC, 2026-08-06) ishlatiladi - butun do'kon bo'yicha
      // global ABC emas (backend_p_zakas_abc.py). FAQAT Zakas'da, boshqa sahifalar
      // (Stock va h.k.) hali ham global v.abc bilan ishlaydi.
      const _buf=chuqur?0:(ZK_BUFFER_SKIP_CATS.includes(v.catTop||v.cat||"")?0:(ZK_BUFFER[v.zabc]!=null?ZK_BUFFER[v.zabc]:ZK_BUFFER.C));
      // Zaxira faqat ALLAQACHON zakas kk bo'lgan tovarga qo'llanadi - "buyurtma kerakmi"
      // degan qarorga emas, faqat "qancha buyurtma" degan miqdorga ta'sir qiladi (ombor
      // boshqaruvidagi reorder point / order-up-to-level farqi, foydalanuvchi tuzatishi,
      // 2026-07-22). Aks holda qolgan kuni BAZAVIY maqsaddan (target) baland (masalan
      // 22>20) - ya'ni allaqachon YETARLI - tovarga ham faqat zaxira sababli mayda zakas
      // berilib qolardi (real ma'lumotda tekshirilgan: 286 tovar, 35.5 mln so'm - buni
      // foydalanuvchi to'g'ri payqadi). Qo'lda kiritilgan "Qo'shimcha kun" (adj) baribir
      // qo'shiladi - menejer istalgan tovarga qo'lda zakasni majburlashi mumkin bo'lib qoladi.
      const _needsOrder=daysLeft<target;
      const _target=_needsOrder?target*(1+_buf):target;
      // MUNTAZAM (Open emas, stok>=0) tovar: bazaviy maqsadli kun stokni to'ldiradi
      // (zaxira bilan), ustiga qo'lda "Qo'shimcha kun" (adj) qo'shiladi.
      const zakasDays=(_needsOrder?Math.max(0,_target-daysLeft):0)+adj;
      const pendingQty=krPendingQty(v.sku);
      // OPEN (yo'lda buyurtma bor) yoki MANFIY STOK: bazaviy MAQSADLI KUN ISHLAMAYDI
      // (sukut ravishda zakas 0 - to'g'ri: buyurtma allaqachon yo'lda / qoldiq noaniq).
      // Bunday tovarga faqat menejer qo'lda "Qo'shimcha kun" (adj) kiritsa zakas beriladi
      // va o'sha kun ZAXIRA foizi (ABC) bilan hisoblanadi - bazaviy maqsad QO'SHILMAYDI.
      // Musbat stokli Open'da mavjud stok (daysLeft) ayiriladi; manfiy stokda daysLeft=0,
      // ya'ni to'liq adj×zaxira kunlik olinadi (foydalanuvchi so'rovi, 2026-07-23).
      // To'g'ridan-to'g'ri aniq miqdor kk bo'lsa - ЗАКАЗ ustunidagi input orqali (manualQty).
      const adjMode=pendingQty>0||stock<0;
      let orderQty=adjMode?_da*Math.max(0,adj*(1+_buf)-daysLeft):_da*zakasDays;
      orderQty=v.kg?Math.round(orderQty*100)/100:Math.ceil(orderQty);
      let minAdd=0;
      if(!v.kg&&orderQty>0&&orderQty<ZK_MIN_ORDER){minAdd=ZK_MIN_ORDER-orderQty;orderQty=ZK_MIN_ORDER;}
      const manualQty=zkRowQty[key];if(manualQty!=null){orderQty=manualQty;minAdd=0;}
      // Karobka/blok o'lchamiga yaxlitlash (foydalanuvchi so'rovi, 2026-08-06):
      // ta'minotchidan real karobkasiz sonlarda (11, 19, 67...) zakas berib
      // bo'lmaydi. Karobka o'lchami HECH QAYERDA yozilmagan - shu SKU'ning
      // tarixiy kirim miqdorlaridan (P8/data_kirim.json, faqat HAQIQATDA
      // Received bo'lganlar) taxmin qilinadi: 2+ XIL miqdor bo'lsa, ularning eng
      // katta umumiy bo'luvchisi (GCD) - masalan tarixda 24 va 48 kelgan bo'lsa,
      // karobka=24. FAQAT BITTA tarixiy miqdor bo'lsa (masalan faqat 48 marta
      // kelgan) - qaysi bo'luvchisi haqiqiy karobka ekanini bilib bo'lmaydi
      // (48 ning ko'p bo'luvchisi bor), shu holda YAXLITLANMAYDI (taxmin qilib
      // xato buyurtma chiqarishdan ko'ra yaxlitlamaslik xavfsizroq).
      //
      // CHEGARA (foydalanuvchi so'rovi, 2026-08-08): yaxlitlash qo'shimchasi xom
      // miqdordan BIR BAROBARDAN (o'zidan) OSHMASLIGI kerak - masalan xom ehtiyoj
      // 57 bo'lsa-yu, karobka 200 bo'lsa, +143 qo'shib 200 ga chiqarish haddan
      // tashqari ortiqcha zaxira beradi. Bunday holda yaxlitlanmaydi, kichikroq
      // xom miqdor o'z holicha qoladi - ortiqcha zakasdan ko'ra ozroq zakas
      // xavfsizroq (menejer kerak bo'lsa qo'lda karobkaga to'ldiradi).
      let boxAdd=0,boxSize=0;
      if(manualQty==null&&!v.kg&&orderQty>0){
        boxSize=_zkBoxSize(v.sku);
        if(boxSize>1){
          const rem=orderQty%boxSize;
          const potentialAdd=rem!==0?boxSize-rem:0;
          if(potentialAdd>0&&potentialAdd<orderQty){boxAdd=potentialAdd;orderQty+=boxAdd;}
        }
      }
      // Narx qo'lda tuzatilgan bo'lishi mumkin (foydalanuvchi so'rovi, 2026-07-22: "narx
      // yaqinda o'zgargan bo'lsa qo'lda tuzatib qo'yamiz"). "base" - kiritilgan PAYTDAGI
      // backend narxi (rawCost) - keyingi build'da HAQIQIY narx (yangi prixod) shundan
      // farqli bo'lib qolsa, qo'lda kiritilgan qiymat AVTOMATIK bekor qilinadi
      // (_zkAutoClearManualCost(), "Zakas berildi" belgisi stok oshganda avtomatik
      // bekor bo'lishi bilan bir xil naqsh). Aks holda (narx hali ham eski) - qo'lda
      // kiritilgan qiymat "Сбросить" bosilmaguncha turaveradi.
      const rawCost=v.rcost||0;
      const _costOv=zkRowCost[key];
      const costManual=_costOv!=null&&_costOv.base===rawCost;
      const rcost=costManual?_costOv.val:rawCost;
      const rcostApprox=costManual?false:!!v.rcostApprox;
      return {key,name:v.name,sku:v.sku,bc:v.bc||[],abc:v.zabc||"",cat:v.cat,catTop:v.catTop||"",kg:v.kg,stock,dailyAvg:_da,daysLeft:_dl,adj,zakasDays,orderQty,minAdd,boxAdd,boxSize,signal:v.signal,price:_zkPriceOf(v),rcost,rcostApprox,rawCost,costManual,pendingQty,calcStock:v.calcStock,calcConf:v.calcConf,calcEvidence:v.calcEvidence,calcAnchor:v.calcAnchor,calcRule:v.calcRule,calcOverride:_ov||null,ovEffective:v.ovEffective!=null?v.ovEffective:null,lkQty:v.lkQty,lkSold:v.lkSold,lkDate:v.lkDate,invanStock:v.stock||0,stockMode:useCalcStock?"calc":"invan"};
    }).sort((a,b)=>{
      // zkRowOrder depth+supplier bo'yicha kalitlanadi - Muntazam va Chuqur bo'limlari
      // BIR XIL supplier nomi ostida BUTUNLAY BOSHQA tovarlarga ega bo'lishi mumkin,
      // shuning uchun faqat "sup" bilan kalitlash ikkala bo'lim keshini bir-biriga
      // ifloslardi (renderZakas() har render'da IKKALA depth'ni ham chaqiradi - avval
      // "boshqa" depth, keyin joriy depth - birinchisi keshni to'ldirib qo'yib, ikkinchi
      // depth'ning HAQIQIY sort so'rovini e'tiborsiz qoldirar edi, natijada sort tugmasi
      // ishlamagandek ko'rinardi va qatorlar tartibi render'lar orasida beqaror bo'lardi).
      const _dk=(chuqur?"chuqur:":"normal:")+sup;
      const ord=zkRowOrder[_dk];if(ord){const ia=ord.indexOf(a.key),ib=ord.indexOf(b.key);return(ia>=0?ia:9999)-(ib>=0?ib:9999);}
      const k=zkSortKey||"orderQty";let va=a[k],vb=b[k];
      if(k==="name"){va=va||"";vb=vb||"";return zkSortAsc?va.localeCompare(vb,"ru"):vb.localeCompare(va,"ru");}
      if(k==="abc"){const o={A:0,B:1,C:2};va=o[va]??3;vb=o[vb]??3;return zkSortAsc?va-vb:vb-va;}
      va=va??0;vb=vb??0;return zkSortAsc?va-vb:vb-va;
    });
    {const _dk=(chuqur?"chuqur:":"normal:")+sup;if(!zkRowOrder[_dk])zkRowOrder[_dk]=rows.map(r=>r.key);}
    const qtyDona=rows.filter(r=>!r.kg).reduce((s,r)=>s+r.orderQty,0);
    const qtyKg=rows.filter(r=>r.kg).reduce((s,r)=>s+r.orderQty,0);
    const valTotal=rows.reduce((s,r)=>s+r.orderQty*(r.price||0),0);
    return {sup,target,rows,qtyDona,qtyKg,valTotal};
  });
  const _localRows=[];
  out.forEach((s,si)=>{s._si=si;s.rows.forEach(r=>{r._ri=_localRows.length;_localRows.push(r);});});
  return out;
}
// 2026-08-12: zkQuery/renderZakas() endi HAR HARFDA emas, faqat Enter
// bosilganda ishga tushadi (foydalanuvchi so'rovi - katta ro'yxatni har
// harfda qayta hisoblash "qotish"dek sezilar edi). Tugma/dropdown ko'rinishi
// (arzon, DOM-only) va ta'minotchi-ichi tez qidiruv (_zkRenderSupDrop,
// qisqa ro'yxat) hamon HAR HARFDA yangilanadi - faqat asosiy og'ir
// renderZakas() kechiktiriladi.
function zkSearchInput(v){
  const x=document.getElementById("zk-search-x");if(x)x.style.display=v?"flex":"none";
  if(zkMode!=="list")_zkRenderSupDrop();
}
function zkSearchSubmit(v){
  zkQuery=(v||"").toLowerCase().trim();
  if(zkMode!=="detail")zkSupFilter="";
  zkPage=1;
  renderZakas();
}
function zkSearchFocus(){if(zkMode==="list")return;_zkRenderSupDrop();}
function zkSearchClear(){
  const inp=document.getElementById("zk-search");if(inp)inp.value="";
  if(zkMode==="detail"){zkBackToList();return;}
  zkQuery="";zkSupFilter="";zkPage=1;
  const x=document.getElementById("zk-search-x");if(x)x.style.display="none";
  const d=document.getElementById("zk-sup-drop");if(d)d.classList.remove("open");
  renderZakas();
  if(inp)inp.focus();
}
function zkPickSupplier(sup){
  zkMode="detail";zkSupFilter=sup;zkQuery="";zkDetailQuery="";zkPage=1;zkCatFilter="";zkSubFilter="";zkBcFilter=null;zkBcShowAll=false;zkBcStats=null;
  const _dsi=document.getElementById("zk-detail-search");if(_dsi)_dsi.value="";
  const inp=document.getElementById("zk-search");if(inp)inp.value=sup;
  const x=document.getElementById("zk-search-x");if(x)x.style.display="flex";
  const d=document.getElementById("zk-sup-drop");if(d)d.classList.remove("open");
  _zkRefreshCatFilters();
  _zkSaveViewState();
  renderZakas();
}
function zkGo(p){zkPage=p;renderZakas();const body=document.getElementById("zk-body");if(body)body.scrollTop=0;}
// Supplier ochilganda qaysi bo'lim ochilsin: zakas bor bo'lgani (Muntazam ustun)
function _zkPickDepthFor(sup){
  const sN=_zkBuildSuppliers("normal").find(x=>x.sup===sup);
  const needN=sN?sN.rows.filter(r=>r.orderQty>0).length:0;
  return needN>0?"normal":"chuqur";
}
function zkOpenSupplier(sup){
  const _q=zkQuery;
  zkMode="detail";zkSupFilter=sup;zkLastSup=sup;zkQuery="";zkPage=1;zkCatFilter="";zkSubFilter="";zkBcFilter=null;zkBcShowAll=false;zkBcStats=null;zkDepth=_zkPickDepthFor(sup);
  // Ro'yxatdagi qidiruv (masalan shtrix-kod) shu supplierning biror TOVARIGA mos kelgan
  // bo'lsa (nafaqat firma nomiga) - detail ichida ham saqlanadi, aks holda mahsulotni
  // qayta topish uchun ichki qidiruvga bir xil narsani qayta kiritish kerak bo'lardi
  // (foydalanuvchi so'rovi, 2026-08-08). Faqat firma nomi bo'yicha topilgan bo'lsa (tovar
  // mos kelmagan) - ichki qidiruv bo'sh qoladi, aks holda hamma tovar filtrlanib ketardi.
  let _keepQ="";
  if(_q){
    const cur=_zkBuildSuppliers(zkDepth).find(x=>x.sup===sup);
    if(cur&&cur.rows.some(r=>_zkRowHit(r,_q)))_keepQ=_q;
  }
  zkDetailQuery=_keepQ;
  const inp=document.getElementById("zk-search");if(inp)inp.value="";
  const x=document.getElementById("zk-search-x");if(x)x.style.display="none";
  const di=document.getElementById("zk-detail-search");if(di)di.value=_keepQ;
  const dx=document.getElementById("zk-detail-search-x");if(dx)dx.style.display=_keepQ?"flex":"none";
  _zkRefreshCatFilters();_zkSaveViewState();renderZakas();
}
function zkBackToList(){zkMode="list";zkSupFilter="";zkQuery="";zkDetailQuery="";zkPage=1;zkCatFilter="";zkSubFilter="";zkBcFilter=null;zkBcShowAll=false;zkBcStats=null;const inp=document.getElementById("zk-search");if(inp)inp.value="";const x=document.getElementById("zk-search-x");if(x)x.style.display="none";const di=document.getElementById("zk-detail-search");if(di)di.value="";const fp=document.getElementById("zk-fpop");if(fp)fp.classList.remove("open");_zkSaveViewState();
  // Zakas oynasi yopildi — orqa fonda kelib turgan yangilanish endi
  // xavfsiz qo'llanadi (ish ustida turgan sonlar o'zgarmasligi uchun u
  // shu paytgacha ushlab turilgan edi).
  if(_pendingBg){const _d=_pendingBg;_pendingBg=null;if(_d.inventory)INVDATA=_d.inventory;if(_d.kirim)P8=_d.kirim;if(P2)_buildZItems();}
  if(typeof _pendingStaticRefresh!=="undefined"&&_pendingStaticRefresh){_pendingStaticRefresh=false;_quietBuildRefresh();}
  renderZakas();}
// ── Detail (bitta supplier) ichida qidiruv: shu supplierning tovarlarini nom/SKU/barcode
// bo'yicha filtrlaydi. Enter bosilganda — agar moslik joriy bo'limda topilmasa, lekin
// ikkinchi bo'limda (Muntazam ↔ Chuqur) bo'lsa, avtomatik o'sha bo'limga o'tadi.
// 2026-08-12: og'ir qism (renderZakas) faqat Enter bosilganda.
function zkDetailSearchInput(v){
  const x=document.getElementById("zk-detail-search-x");if(x)x.style.display=v?"flex":"none";
}
function zkDetailSearchSubmit(v){
  zkDetailQuery=(v||"").toLowerCase().trim();
  zkPage=1;
  const x=document.getElementById("zk-detail-search-x");if(x)x.style.display=v?"flex":"none";
  renderZakas();
}
function zkDetailSearchClear(){
  zkDetailQuery="";zkPage=1;
  const inp=document.getElementById("zk-detail-search");if(inp)inp.value="";
  const x=document.getElementById("zk-detail-search-x");if(x)x.style.display="none";
  renderZakas();
  if(inp)inp.focus();
}
function zkDetailSearchEnter(){
  const q=zkDetailQuery;if(!q||!zkSupFilter)return;
  const cur=_zkBuildSuppliers(zkDepth).find(s=>s.sup===zkSupFilter);
  if(cur&&cur.rows.some(r=>_zkRowHit(r,q)))return;  // joriy bo'limda topildi — shu yerda qoladi
  const other=zkDepth==="chuqur"?"normal":"chuqur";
  const oth=_zkBuildSuppliers(other).find(s=>s.sup===zkSupFilter);
  if(oth&&oth.rows.some(r=>_zkRowHit(r,q))){zkDepth=other;zkPage=1;renderZakas();}
}
function zkSetDepth(d){
  if(zkDepth===d)return;
  zkDepth=d;zkPage=1;
  _zkSaveViewState();
  renderZakas();  // detail'да qolamiz — faqat bo'lim almashadi
}
// Muntazam + Chuqur birga: har supplier bir marta, ikkala bo'lim soni bilan
function _renderZkSupListMerged(supN,supC){
  const rb=document.getElementById("zk-reset-btn");if(rb)rb.style.display="none";
  const qw=document.getElementById("zk-quickbtn-wrap");if(qw)qw.style.display="none";
  const fr=document.getElementById("zk-filter-row");if(fr)fr.style.display="";
  const dsr=document.getElementById("zk-detail-search-row");if(dsr)dsr.style.display="none";
  const foot=document.getElementById("zk-export-btn");if(foot)foot.style.display="none";
  // "Belgilarni tozalash" faqat RO'YXAT (list) sahifasida kerak - bitta supplier
  // ichiga kirilganda kerak emas (foydalanuvchi so'rovi, 2026-07-21).
  const cc=document.getElementById("zk-clearchk-btn");if(cc)cc.style.display="";
  const pag=document.getElementById("zk-pag");if(pag)pag.innerHTML="";
  const d=document.getElementById("zk-sup-drop");if(d)d.classList.remove("open");
  _zkRefreshListCatFilters();
  const need=s=>s?s.rows.filter(r=>r.orderQty>0).length:0;
  const mp={};
  supN.forEach(s=>{mp[s.sup]=mp[s.sup]||{sup:s.sup};mp[s.sup].n=s;mp[s.sup].needN=need(s);});
  supC.forEach(s=>{mp[s.sup]=mp[s.sup]||{sup:s.sup};mp[s.sup].c=s;mp[s.sup].needC=need(s);});
  let all=Object.values(mp).map(e=>({sup:e.sup,needN:e.needN||0,needC:e.needC||0,
    total:((e.n&&e.n.rows.length)||0)+((e.c&&e.c.rows.length)||0),
    needAny:(e.needN||0)+(e.needC||0),
    _rowsN:(e.n&&e.n.rows)||[],_rowsC:(e.c&&e.c.rows)||[]}));
  if(zkQuery){const q=zkQuery;all=all.filter(s=>s.sup.toLowerCase().includes(q)||s._rowsN.some(r=>_zkRowHit(r,q))||s._rowsC.some(r=>_zkRowHit(r,q)));}
  // Ro'yxat darajasidagi Kategoriya/Subkategoriya filtri - shu supplierning ICHKI
  // qismida (Muntazam yoki Chuqur) kamida bitta tovar mos kelsa, supplier qoladi
  // (foydalanuvchi so'rovi, 2026-08-10: masalan barcha suv olib keladigan supplierlarni ajratish).
  if(zkListCatFilter)all=all.filter(s=>s._rowsN.some(r=>r.catTop===zkListCatFilter)||s._rowsC.some(r=>r.catTop===zkListCatFilter));
  if(zkListSubFilter)all=all.filter(s=>s._rowsN.some(r=>r.cat===zkListSubFilter)||s._rowsC.some(r=>r.cat===zkListSubFilter));
  let withNeed=all.filter(s=>s.needAny>0);
  let noNeed=all.filter(s=>s.needAny===0).sort((a,b)=>a.sup.localeCompare(b.sup,"ru"));
  if(zkSlSort==="sup")withNeed.sort((a,b)=>zkSlAsc?a.sup.localeCompare(b.sup,"ru"):b.sup.localeCompare(a.sup,"ru"));
  else if(zkSlSort==="total")withNeed.sort((a,b)=>zkSlAsc?a.total-b.total:b.total-a.total);
  else if(zkSlSort==="chuqur")withNeed.sort((a,b)=>zkSlAsc?a.needC-b.needC:b.needC-a.needC);
  else withNeed.sort((a,b)=>zkSlAsc?a.needN-b.needN:b.needN-a.needN);
  const supCountEl=document.getElementById("zk-sup-count");
  if(supCountEl)supCountEl.innerHTML=`<div class="zk-sl-stat"><span class="zk-sl-stat-n">${all.length}</span><span class="zk-sl-stat-l">${t("zk_stat_all")}</span></div><div class="zk-sl-stat zk-sl-stat-red"><span class="zk-sl-stat-n">${withNeed.length}</span><span class="zk-sl-stat-l">${t("zk_stat_need")}</span></div>${_zkMobMoreBtnHtml()}`;
  const confirmSlot0=document.getElementById("zk-confirm-slot");if(confirmSlot0)confirmSlot0.innerHTML="";
  const body=document.getElementById("zk-body");if(!body)return;
  const prevSl=body.querySelector(".zk-sl");const prevSt=prevSl?prevSl.scrollTop:0;
  const sa=(k)=>k===zkSlSort?(zkSlAsc?'▲':'▼'):'<span style="color:#ddd">▼</span>';
  let h=`<div class="zk-sl"><div class="zk-sl-hdr"><span class="zk-sl-dot-hdr"></span><span class="zk-sl-name zk-sl-th" onclick="zkSlSetSort('sup')">${t('zk_sl_nom')} ${sa('sup')}</span><span class="zk-sl-need zk-sl-th" onclick="zkSlSetSort('needCount')">${t('zk_sl_zakas')} ${sa('needCount')}</span><span class="zk-sl-chuqur zk-sl-th" onclick="zkSlSetSort('chuqur')">${t('zk_sl_chuqur')} ${sa('chuqur')}</span><span class="zk-sl-total zk-sl-th" onclick="zkSlSetSort('total')">${t('zk_sl_jami')} ${sa('total')}</span><span class="zk-sl-arr"></span></div>`;
  const rowHtml=(s,i,dim)=>{
    const supJ=JSON.stringify(s.sup).replace(/"/g,'&quot;');
    const sel=s.sup===zkLastSup?' zk-sl-sel':'';
    const alt=i%2===1?' zk-sl-alt':'';
    const conf=zkIsConfirmed(s.sup);
    const dot=`<span class="zk-sl-dot${conf?' zk-sl-dot-ok':''}" title="${conf?t('zk_confirm_btn'):''}"></span>`;
    const nCell=s.needN>0?s.needN:`<span style="color:#ccc">—</span>`;
    const cCell=s.needC>0?s.needC:`<span style="color:#ccc">—</span>`;
    return `<div class="zk-sl-row${dim?' zk-sl-dim':''}${sel}${alt}">${dot}<span class="zk-sl-name zk-sl-clickable" onclick="zkOpenSupplier(${supJ})">${esc(s.sup)}</span><span class="zk-sl-need">${nCell}</span><span class="zk-sl-chuqur">${cCell}</span><span class="zk-sl-total">${s.total}</span><span class="zk-sl-arr${sel}" onclick="zkOpenSupplier(${supJ})">›</span></div>`;
  };
  withNeed.forEach((s,i)=>{h+=rowHtml(s,i,false);});
  if(noNeed.length){
    h+=`<div class="zk-sl-sep">${t("zk_no_need_sep")} (${noNeed.length})</div>`;
    noNeed.forEach((s,i)=>{h+=rowHtml(s,i,true);});
  }
  h+="</div>";
  body.innerHTML=h;
  requestAnimationFrame(()=>{const sl=body.querySelector(".zk-sl");if(sl&&prevSt)sl.scrollTop=prevSt;});
}
function _renderZkSupList(allSups){
  const rb=document.getElementById("zk-reset-btn");if(rb)rb.style.display="none";
  const qw=document.getElementById("zk-quickbtn-wrap");if(qw)qw.style.display="none";
  const fr=document.getElementById("zk-filter-row");if(fr)fr.style.display="";
  const foot=document.getElementById("zk-export-btn");if(foot)foot.style.display="none";
  const pag=document.getElementById("zk-pag");if(pag)pag.innerHTML="";
  const d=document.getElementById("zk-sup-drop");if(d)d.classList.remove("open");
  let all=allSups.map(s=>({...s,needCount:s.rows.filter(r=>r.orderQty>0).length}));
  if(zkQuery){const q=zkQuery;all=all.filter(s=>s.sup.toLowerCase().includes(q)||s.rows.some(r=>(r.name&&r.name.toLowerCase().includes(q))||(r.sku&&String(r.sku).includes(q))));}
  let withNeed=all.filter(s=>s.needCount>0);
  let noNeed=all.filter(s=>s.needCount===0).sort((a,b)=>a.sup.localeCompare(b.sup,"ru"));
  if(zkSlSort==="sup")withNeed.sort((a,b)=>zkSlAsc?a.sup.localeCompare(b.sup,"ru"):b.sup.localeCompare(a.sup,"ru"));
  else if(zkSlSort==="total")withNeed.sort((a,b)=>zkSlAsc?a.rows.length-b.rows.length:b.rows.length-a.rows.length);
  else withNeed.sort((a,b)=>zkSlAsc?a.needCount-b.needCount:b.needCount-a.needCount);
  const supCountEl=document.getElementById("zk-sup-count");
  if(supCountEl)supCountEl.innerHTML=`<div class="zk-sl-stat"><span class="zk-sl-stat-n">${allSups.length}</span><span class="zk-sl-stat-l">${t("zk_stat_all")}</span></div><div class="zk-sl-stat zk-sl-stat-red"><span class="zk-sl-stat-n">${withNeed.length}</span><span class="zk-sl-stat-l">${t("zk_stat_need")}</span></div>${_zkMobMoreBtnHtml()}`;
  const confirmSlot1=document.getElementById("zk-confirm-slot");if(confirmSlot1)confirmSlot1.innerHTML="";
  zkAutoRemoveConfirmed(allSups);
  const body=document.getElementById("zk-body");if(!body)return;
  const prevSl=body.querySelector(".zk-sl");const prevSt=prevSl?prevSl.scrollTop:0;
  const sa=(k)=>k===zkSlSort?(zkSlAsc?'▲':'▼'):'<span style="color:#ddd">▼</span>';
  let h=`<div class="zk-sl"><div class="zk-sl-hdr"><span class="zk-sl-dot-hdr"></span><span class="zk-sl-name zk-sl-th" onclick="zkSlSetSort('sup')">${t('zk_sl_nom')} ${sa('sup')}</span><span class="zk-sl-need zk-sl-th" onclick="zkSlSetSort('needCount')">${t('zk_sl_zakas')} ${sa('needCount')}</span><span class="zk-sl-total zk-sl-th" onclick="zkSlSetSort('total')">${t('zk_sl_jami')} ${sa('total')}</span><span class="zk-sl-arr"></span></div>`;
  withNeed.forEach((s,i)=>{
    const supJ=JSON.stringify(s.sup).replace(/"/g,'&quot;');
    const sel=s.sup===zkLastSup?' zk-sl-sel':'';
    const alt=i%2===1?' zk-sl-alt':'';
    const conf=zkIsConfirmed(s.sup);
    const dot=`<span class="zk-sl-dot${conf?' zk-sl-dot-ok':''}" title="${conf?t('zk_confirm_btn'):''}"></span>`;
    h+=`<div class="zk-sl-row${sel}${alt}">${dot}<span class="zk-sl-name zk-sl-clickable" onclick="zkOpenSupplier(${supJ})">${esc(s.sup)}</span><span class="zk-sl-need">${s.needCount}</span><span class="zk-sl-total">${s.rows.length}</span><span class="zk-sl-arr${sel}" onclick="zkOpenSupplier(${supJ})">›</span></div>`;
  });
  if(noNeed.length){
    h+=`<div class="zk-sl-sep">${t("zk_no_need_sep")} (${noNeed.length})</div>`;
    noNeed.forEach((s,i)=>{
      const supJ=JSON.stringify(s.sup).replace(/"/g,'&quot;');
      const sel=s.sup===zkLastSup?' zk-sl-sel':'';
      const alt=i%2===1?' zk-sl-alt':'';
      const conf=zkIsConfirmed(s.sup);
      const dot=`<span class="zk-sl-dot${conf?' zk-sl-dot-ok':''}" title="${conf?t('zk_confirm_btn'):''}"></span>`;
      h+=`<div class="zk-sl-row zk-sl-dim${sel}${alt}">${dot}<span class="zk-sl-name zk-sl-clickable" onclick="zkOpenSupplier(${supJ})">${esc(s.sup)}</span><span class="zk-sl-need" style="color:#ccc">—</span><span class="zk-sl-total">${s.rows.length}</span><span class="zk-sl-arr${sel}" onclick="zkOpenSupplier(${supJ})">›</span></div>`;
    });
  }
  h+="</div>";
  body.innerHTML=h;
  requestAnimationFrame(()=>{const sl=body.querySelector(".zk-sl");if(sl&&prevSt)sl.scrollTop=prevSt;});
}
function renderZakasPag(totalP){
  const pag=document.getElementById("zk-pag");if(!pag)return;
  if(totalP<=1){pag.innerHTML="";return;}
  const mk=(l,p,d,a)=>`<button ${d?"disabled":""} ${a?'class="active"':""} onclick="zkGo(${p})">${l}</button>`;
  let h=mk("‹",zkPage-1,zkPage<=1,false);
  let s=Math.max(1,zkPage-2),e=Math.min(totalP,zkPage+2);
  if(s>1){h+=mk("1",1,false,zkPage===1);if(s>2)h+='<button disabled>…</button>';}
  for(let p=s;p<=e;p++)h+=mk(p,p,false,p===zkPage);
  if(e<totalP){if(e<totalP-1)h+='<button disabled>…</button>';h+=mk(totalP,totalP,false,zkPage===totalP);}
  h+=mk("›",zkPage+1,zkPage>=totalP,false);
  pag.innerHTML=h;
}
let zkQuickPanelOpen=false;
function zkToggleQuickPanel(e){
  if(e)e.stopPropagation();
  zkQuickPanelOpen=!zkQuickPanelOpen;
  _zkRenderQuickPanel();
}
// ─── SOZLAMALAR PANELI: qo'lda stok tuzatish (2026-08-09, foydalanuvchi so'rovi) ───
// Zakas jadvalidagi har qatorga alohida qalam belgisi qo'yish o'rniga - bitta
// markaziy ⚙ tugma orqali istalgan tovarni QIDIRIB topib, "Hisoblangan stok"ni
// qo'lda to'g'irlash mumkin. Saqlash Turso'ga (api/stock-override.py) yoziladi -
// natija BARCHA qurilma/foydalanuvchida darhol ko'rinadi (STOCK_OV orqali,
// _zkBuildSuppliers() calcStock o'rniga shuni ustuvor ishlatadi).
let zkSetOpen=false,zkSetQuery="",zkSetPickedSku=null,zkSetSaving=false,zkSetMsg="";
function zkToggleSettingsPanel(e){
  if(e)e.stopPropagation();
  zkSetOpen=!zkSetOpen;
  if(zkSetOpen){zkSetQuery="";zkSetPickedSku=null;zkSetMsg="";}
  _zkRenderSettingsPanel();
}
// 2026-08-12: har harfda emas, faqat Enter bosilganda (boshqa qidiruvlar
// bilan bir xil tuzatish - katta ro'yxatni har harfda qayta chizish
// "qotish"dek sezilardi).
function zkSetSearchSubmit(v){
  zkSetQuery=(v||"").toLowerCase().trim();
  _zkRenderSettingsPanel();
}
function zkSetPick(sku){
  zkSetPickedSku=String(sku);
  zkSetMsg="";
  _zkRenderSettingsPanel();
  setTimeout(()=>{const inp=document.getElementById("zk-set-val-inp");if(inp)inp.focus();},30);
}
function zkSetBackToSearch(){
  zkSetPickedSku=null;zkSetMsg="";
  _zkRenderSettingsPanel();
}
async function zkSetSaveOverride(){
  const sku=zkSetPickedSku;if(!sku||zkSetSaving)return;
  const inp=document.getElementById("zk-set-val-inp");
  const noteInp=document.getElementById("zk-set-note-inp");
  const val=parseFloat(String(inp&&inp.value||"").replace(",","."));
  if(isNaN(val)||val<0){zkSetMsg="To'g'ri son kiriting";_zkRenderSettingsPanel();return;}
  zkSetSaving=true;zkSetMsg="Saqlanmoqda...";_zkRenderSettingsPanel();
  try{
    const r=await fetch(_zkStockOvEndpoint(),{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({sku,value:val,note:(noteInp&&noteInp.value||"").trim(),updated_by:_zkManagerName()})});
    const d=await r.json();
    if(!d||!d.ok)throw new Error((d&&d.error)||"Noma'lum xato");
    STOCK_OV[sku]={value:val,note:(noteInp&&noteInp.value||"").trim(),updated_by:_zkManagerName(),updated_at:d.updated_at};
    zkSetMsg="✓ Saqlandi";
    renderZakas();
  }catch(e){
    zkSetMsg="Xato: "+(e&&e.message||e);
  }
  zkSetSaving=false;
  _zkRenderSettingsPanel();
}
async function zkSetClearOverride(sku){
  if(!sku||zkSetSaving)return;
  zkSetSaving=true;zkSetMsg="O'chirilmoqda...";_zkRenderSettingsPanel();
  try{
    const r=await fetch(_zkStockOvEndpoint(),{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({sku,delete:true})});
    const d=await r.json();
    if(!d||!d.ok)throw new Error((d&&d.error)||"Noma'lum xato");
    delete STOCK_OV[sku];
    zkSetMsg="";
    renderZakas();
  }catch(e){
    zkSetMsg="Xato: "+(e&&e.message||e);
  }
  zkSetSaving=false;
  _zkRenderSettingsPanel();
}
function _zkRenderSettingsPanel(){
  const panel=document.getElementById("zk-settings-panel");if(!panel)return;
  panel.classList.toggle("open",zkSetOpen);
  if(!zkSetOpen)return;
  const ovEntries=Object.entries(STOCK_OV);
  if(zkSetPickedSku){
    // Tanlangan tovar uchun tuzatish formasi
    let it=(ZITEMS||[]).find(z=>String(z.sku)===zkSetPickedSku);
    const ov=STOCK_OV[zkSetPickedSku];
    const name=it?it.name:(ov?zkSetPickedSku:"");
    const curCalc=it&&it.calcStock!=null?it.calcStock:null;
    const curInvan=it?it.stock:null;
    panel.innerHTML=`
      <div class="zk-settings-title">Stokni qo'lda tuzatish</div>
      <div class="zk-set-edit-box">
        <div class="zk-set-edit-name">${esc(name)}</div>
        <div class="zk-set-edit-row">SKU: <b>${esc(zkSetPickedSku)}</b></div>
        ${curCalc!=null?`<div class="zk-set-edit-row">Hisoblangan (model): <b>${curCalc}</b></div>`:""}
        ${curInvan!=null?`<div class="zk-set-edit-row">Invan: <b>${curInvan}</b></div>`:""}
        ${ov?`<div class="zk-set-edit-row" style="color:#534AB7">Joriy tuzatish: <b>${ov.value}</b>${ov.updated_by?` (${esc(ov.updated_by)})`:""}</div>`:""}
        <input id="zk-set-val-inp" class="zk-set-edit-inp" type="number" min="0" step="any" placeholder="Haqiqiy qolgan miqdor" value="${ov?ov.value:""}">
        <input id="zk-set-note-inp" class="zk-set-edit-inp" type="text" placeholder="Izoh (ixtiyoriy)" value="${ov?esc(ov.note||""):""}">
        <div class="zk-set-edit-actions">
          <button class="zk-set-save-btn" type="button" onclick="zkSetSaveOverride()"${zkSetSaving?" disabled":""}>Saqlash</button>
          <button class="zk-set-cancel-btn" type="button" onclick="zkSetBackToSearch()">Orqaga</button>
        </div>
        ${ov?`<button class="zk-set-clear-btn" style="margin-top:6px;width:100%" type="button" onclick="zkSetClearOverride('${zkSetPickedSku}')"${zkSetSaving?" disabled":""}>Tuzatishni bekor qilish (avtomatikka qaytarish)</button>`:""}
        ${zkSetMsg?`<div style="font-size:11px;margin-top:6px;color:${zkSetMsg.startsWith("Xato")?"#E24B4A":"#1D9E75"}">${esc(zkSetMsg)}</div>`:""}
      </div>`;
    return;
  }
  const q=zkSetQuery;
  let results=[];
  if(q&&ZITEMS){
    const seen=new Set();
    for(const it of ZITEMS){
      if(!it.sku||seen.has(String(it.sku)))continue;
      if(_matchNSB(it,q)){seen.add(String(it.sku));results.push(it);}
      if(results.length>=30)break;
    }
  }
  panel.innerHTML=`
    <div class="zk-settings-title">Stokni qo'lda tuzatish</div>
    <div class="zk-settings-hint">Model hisoblagan "Hisoblangan stok" xato bo'lsa (masalan jismonan sanaganda son boshqacha chiqsa) - shu yerdan tovarni qidirib, to'g'ri sonni kiriting. O'zgarish darhol BARCHA kompyuterlarda ko'rinadi.</div>
    <div class="zk-set-search"><input type="text" placeholder="Mahsulot nomi, SKU yoki shtrix-kod..." value="${esc(q)}" onkeydown="if(event.key==='Enter'){event.preventDefault();zkSetSearchSubmit(this.value);}" autocomplete="off"></div>
    ${q?`<div class="zk-set-results">${results.length?results.map(it=>`<div class="zk-set-result-row" onclick="zkSetPick('${it.sku}')"><span class="zk-set-result-name">${esc(it.name)}</span><span class="zk-set-result-stock">${it.calcStock!=null?it.calcStock:(it.stock!=null?it.stock:"—")}${STOCK_OV[String(it.sku)]?" ✎":""}</span></div>`).join(""):'<div style="padding:10px;text-align:center;color:#bbb;font-size:11.5px">Topilmadi</div>'}</div>`:""}
    ${!q&&ovEntries.length?`<div class="zk-set-ov-list"><div style="font-size:11px;color:#999;margin-bottom:4px">Qo'lda tuzatilgan tovarlar (${ovEntries.length}):</div>${ovEntries.map(([sku,ov])=>{const it=(ZITEMS||[]).find(z=>String(z.sku)===sku);const _eff=it&&it.ovEffective!=null?it.ovEffective:null;const _valTxt=(_eff!=null&&_eff!==ov.value)?`${_eff} <span style="color:#bbb;font-weight:400;text-decoration:line-through">${ov.value}</span>`:ov.value;return `<div class="zk-set-ov-row"><span class="zk-set-ov-name" onclick="zkSetPick('${sku}')">${esc(it?it.name:sku)}</span><b>${_valTxt}</b></div>`;}).join("")}</div>`:""}
  `;
}
// Ro'yxat sahifasidagi "N zakasga muhtoj" bilan HAR DOIM mos bo'lishi uchun - ikkala
// bo'lim (Muntazam+Chuqur) birlashtirilgan holda, joriy zkDepth/_ZK_SUPPLIERS'dan
// MUSTAQIL hisoblanadi. Avval faqat _ZK_SUPPLIERS (bitta depth, faqat Detail rejimida
// to'ldiriladigan) ishlatilardi - shuning uchun (1) Ro'yxat rejimida umuman
// yangilanmasdan eskirib qolar, (2) hatto Detailда ham faqat bitta bo'limni hisoblab,
// haqiqiy sondan kamroq ko'rsatardi (real holatda: 344 vs to'g'ri 454).
function _zkRenderQuickPanel(){
  const panel=document.getElementById("zk-quick-panel");if(!panel)return;
  panel.classList.toggle("open",zkQuickPanelOpen);
  const supN=_zkBuildSuppliers("normal"),supC=_zkBuildSuppliers("chuqur");
  const merged={};
  const mergeIn=arr=>arr.forEach(s=>{(merged[s.sup]=merged[s.sup]||{sup:s.sup,rows:[]}).rows=merged[s.sup].rows.concat(s.rows);});
  mergeIn(supN);mergeIn(supC);
  const list=Object.values(merged).map(s=>({s,needCount:s.rows.filter(r=>r.orderQty>0).length})).filter(x=>x.needCount>0).sort((a,b)=>b.needCount-a.needCount).map(x=>x.s);
  const badge=document.getElementById("zk-quickbtn-badge");
  if(badge){badge.textContent=list.length;badge.style.display=list.length?"flex":"none";}
  if(!zkQuickPanelOpen)return;
  panel._zkList=list;
  panel.innerHTML=list.map((s,i)=>{
    const needCount=s.rows.filter(r=>r.orderQty>0).length;
    const rel=_zkRelevantRows(s);
    const checkedCount=rel.filter(r=>_zkIsChecked(r)).length;
    const allChecked=checkedCount===rel.length;
    const indet=checkedCount>0&&!allChecked;
    return `<div class="zk-quick-row" data-qi="${i}"><input type="checkbox" class="zk-chk zk-quick-chk" data-qi="${i}"${allChecked?" checked":""}${indet?' data-indet="1"':""}><span>${esc(s.sup)}</span><b>${needCount}</b></div>`;
  }).join("");
  panel.querySelectorAll('.zk-quick-chk[data-indet="1"]').forEach(el=>{el.indeterminate=true;});
}
function _zkRenderSupDrop(){
  const d=document.getElementById("zk-sup-drop");if(!d)return;
  const inp=document.getElementById("zk-search");
  const q=(inp&&inp.value||"").toLowerCase().trim();
  const list=q?_ZK_SUPPLIERS.filter(s=>s.sup.toLowerCase().includes(q)):_ZK_SUPPLIERS;
  d._zkList=list;
  if(!list.length){d.innerHTML=`<div class="zk-sup-drop-empty">${t("topilmadi")}</div>`;}
  else{
    d.innerHTML=list.slice(0,500).map((s,i)=>`<div class="zk-sup-drop-item" data-si="${i}"><span>${esc(s.sup)}</span><b>${s.rows.length}</b></div>`).join("");
  }
  d.classList.add("open");
}
document.addEventListener("click",e=>{
  const item=e.target.closest&&e.target.closest(".zk-sup-drop-item");
  if(item){
    const d=document.getElementById("zk-sup-drop");
    const list=d&&d._zkList;
    const s=list&&list[parseInt(item.dataset.si)];
    if(s)zkPickSupplier(s.sup);
    return;
  }
  const qchk=e.target.closest&&e.target.closest(".zk-quick-chk");
  if(qchk){
    const panel=document.getElementById("zk-quick-panel");
    const list=panel&&panel._zkList;
    const s=list&&list[parseInt(qchk.dataset.qi)];
    // s - birlashtirilgan (Muntazam+Chuqur) obyekt, _ZK_SUPPLIERS ichida emas -
    // shuning uchun zkToggleSupplier(_si) ishlatilmaydi, xuddi shu funksiya ichidagi
    // mantiq to'g'ridan-to'g'ri s.rows'ga qo'llaniladi (zkRowChecked kalit bo'yicha,
    // depth'dan mustaqil, shuning uchun xavfsiz).
    if(s){
      const rel=_zkRelevantRows(s);
      const allChecked=rel.every(r=>_zkIsChecked(r));
      if(allChecked){
        // Bekor qilishda BARCHA qatorlar (qo'lda belgilangan, orderQty=0 bo'lganlari
        // ham) tozalanadi - zkToggleSupplier bilan bir xil tuzatish (2026-07-20).
        s.rows.forEach(r=>{zkRowChecked[r.key]=false;});
      }else{
        rel.forEach(r=>{zkRowChecked[r.key]=true;});
      }
      zkSaveManual();
      renderZakas();
    }
    return;
  }
  const qrow=e.target.closest&&e.target.closest(".zk-quick-row");
  if(qrow){
    const panel=document.getElementById("zk-quick-panel");
    const list=panel&&panel._zkList;
    const s=list&&list[parseInt(qrow.dataset.qi)];
    if(s){zkQuickPanelOpen=false;_zkRenderQuickPanel();zkPickSupplier(s.sup);}
    return;
  }
  const wrap=document.getElementById("zk-search-wrap");
  if(wrap&&!wrap.contains(e.target)){const d=document.getElementById("zk-sup-drop");if(d)d.classList.remove("open");}
  const qwrap=document.getElementById("zk-quickbtn-wrap");
  if(qwrap&&!qwrap.contains(e.target)&&zkQuickPanelOpen){zkQuickPanelOpen=false;_zkRenderQuickPanel();}
  const swrap=document.getElementById("zk-settingsbtn-wrap");
  if(swrap&&!swrap.contains(e.target)&&zkSetOpen){zkSetOpen=false;_zkRenderSettingsPanel();}
});
function zkSetTarget(si,val){
  const s=_ZK_SUPPLIERS[si];if(!s)return;
  let v=parseInt(val);if(isNaN(v)||v<0)v=ZK_DEFAULT_TARGET;
  const _ops=[{ns:"suptarget",k:s.sup,v}];
  s.rows.forEach(r=>{if(zkRowQty[r.key]!=null)_ops.push({ns:"qty",k:r.key,delete:true});delete zkRowQty[r.key];});
  delete zkRowOrder["normal:"+s.sup];delete zkRowOrder["chuqur:"+s.sup];
  zkSupTargets[s.sup]=v;
  zkSaveManual();
  _zkDraftPush(_ops);
  renderZakas();
}
function zkSetQty(ri,val){
  const r=_ZK_ALLROWS[ri];if(!r)return;
  const v=r.kg?parseFloat(val):parseInt(val);
  if(!isNaN(v)&&v>=0){zkRowQty[r.key]=v;_zkDraftPush([{ns:"qty",k:r.key,v}]);}
  else{delete zkRowQty[r.key];_zkDraftPush([{ns:"qty",k:r.key,delete:true}]);}
  zkSaveManual();
  renderZakas();
}
// Bitta qatorda Invan/Hisoblangan tomonlardan BIRINI aniq tanlash (ikkita kichik
// ustuncha, foydalanuvchi so'rovi 2026-07-27) - mode="invan" yoki "calc". calcStock
// ishonchli bo'lmagan (backend yozmagan) qatorda "calc" tomon bosilsa e'tiborsiz
// qoldiriladi (render'da allaqachon shu tomon ko'rsatilmaydi - ikki tomonlama himoya).
function zkSetRowStockMode(ri,mode){
  const r=_ZK_ALLROWS[ri];if(!r)return;
  if(mode==="calc"){if(r.calcStock==null)return;delete zkRowStockMode[r.key];_zkDraftPush([{ns:"stockmode",k:r.key,delete:true}]);}
  else{zkRowStockMode[r.key]="invan";_zkDraftPush([{ns:"stockmode",k:r.key,v:"invan"}]);}
  zkSaveManual();
  renderZakas();
}
// Bitta supplierga tegishli BARCHA qatorni bir zumda Hisoblangan/Invan stokka o'tkazadi
// (foydalanuvchi so'rovi, 2026-07-27) - faqat calcStock mavjud qatorlarga ta'sir qiladi,
// ishonchli qiymati yo'q qatorlar Invan'da qoladi. zkSetTarget() bilan bir xil naqsh.
function zkSetSupplierStockMode(si,mode){
  const s=_ZK_SUPPLIERS[si];if(!s)return;
  const _ops=[];
  s.rows.forEach(r=>{
    if(r.calcStock==null)return;
    if(mode==="calc"){delete zkRowStockMode[r.key];_ops.push({ns:"stockmode",k:r.key,delete:true});}
    else{zkRowStockMode[r.key]="invan";_ops.push({ns:"stockmode",k:r.key,v:"invan"});}
  });
  zkSaveManual();
  if(_ops.length)_zkDraftPush(_ops);
  renderZakas();
}
function zkSetAdj(ri,val){
  const r=_ZK_ALLROWS[ri];if(!r)return;
  let v=parseInt(val);if(isNaN(v))v=0;
  zkRowAdj[r.key]=v;
  zkSaveManual();
  _zkDraftPush([{ns:"adj",k:r.key,v}]);
  renderZakas();
}
// Narxni qo'lda tuzatish (foydalanuvchi so'rovi, 2026-07-22). "base" - kiritilgan
// PAYTDAGI backend narxi (r.rawCost) - shu snapshot orqali keyinroq _zkAutoClearManualCost()
// haqiqiy narx o'zgarganini (yangi prixod kelganini) aniqlab, qo'lda kiritilganni
// avtomatik bekor qiladi.
function zkSetCost(ri,val){
  const r=_ZK_ALLROWS[ri];if(!r)return;
  // Ming ajratkichlarni (vergul, bo'shliq va h.k.) tozalab, faqat raqam+nuqtani qoldiramiz.
  const v=parseFloat(String(val).replace(/[^0-9.]/g,""));
  if(!isNaN(v)&&v>=0){const _cv={val:v,base:r.rawCost};zkRowCost[r.key]=_cv;_zkDraftPush([{ns:"cost",k:r.key,v:_cv}]);}
  else{delete zkRowCost[r.key];_zkDraftPush([{ns:"cost",k:r.key,delete:true}]);}
  zkSaveManual();
  renderZakas();
}
// Qo'lda kiritilgan narxni backend'dagi HAQIQIY narx bilan solishtiradi - agar
// yangi prixod kelib backend narxi o'zgargan bo'lsa (snapshot - joriy rcost mos
// kelmasa), qo'lda kiritilgan qiymat AVTOMATIK bekor qilinadi (_zkAutoUnconfirmByStock()
// bilan bir xil naqsh - u ham stok o'zgarganda "Zakas berildi" belgisini avtomatik
// olib tashlaydi).
function _zkAutoClearManualCost(){
  if(!ZITEMS)return;
  const keys=Object.keys(zkRowCost);
  if(!keys.length)return;
  let changed=false;const _delOps=[];
  keys.forEach(key=>{
    const raw=key.replace(/^(normal|chuqur):/,"");
    let v=null;
    if(raw.startsWith("s:")){const sku=raw.slice(2);v=ZITEMS.find(x=>x.sku&&String(x.sku)===sku);}
    else if(raw.startsWith("n:")){const nm=raw.slice(2);v=ZITEMS.find(x=>!x.sku&&x.name===nm);}
    const curRcost=v?(v.rcost||0):0;
    if(zkRowCost[key].base!==curRcost){delete zkRowCost[key];changed=true;_delOps.push({ns:"cost",k:key,delete:true});}
  });
  if(changed){zkSaveManual();_zkDraftPush(_delOps);}
}
function zkAddAdj(ri,delta){
  const r=_ZK_ALLROWS[ri];if(!r)return;
  const cur=zkRowAdj[r.key]||r.adj||0;
  const v=Math.max(0,cur+delta);
  zkRowAdj[r.key]=v;
  zkSaveManual();
  _zkDraftPush([{ns:"adj",k:r.key,v}]);
  renderZakas();
}
function renderZakas(){
  if(!ZITEMS){if(P2)_buildZItems();else return;}
  _zkRenderPageTabs();
  if(zkPageTab==="file"){_renderZkFileTab();return;}
  ["zk-sup-count-row","zk-filter-row","zk-detail-search-row","zk-pag"].forEach(id=>{const e=document.getElementById(id);if(e&&e.style.display==="none")e.style.display="";});
  _zkAutoUnconfirmByStock();
  _zkAutoClearManualCost();
  _zkInitResetBtn();
  _zkInitInvanBtn();
  if(zkMode==="list"){
    // Ro'yxatда ikkala bo'lim (Muntazam + Chuqur) birga ko'rsatiladi
    const supN=_zkBuildSuppliers("normal");
    const supC=_zkBuildSuppliers("chuqur");
    _renderZkSupListMerged(supN,supC);
    return;
  }
  // Detail: ikkala bo'lim sonini olamiz (tab yorliqlari uchun)
  _zkRenderQuickPanel();
  const _otherDepth=zkDepth==="chuqur"?"normal":"chuqur";
  const _supOther=_zkBuildSuppliers(_otherDepth);
  const _oS=_supOther.find(x=>x.sup===zkSupFilter);
  window._zkNeedOther=_oS?_oS.rows.filter(r=>r.orderQty>0).length:0;
  window._zkTotOther=_oS?_oS.rows.length:0;
  _ZK_SUPPLIERS=_zkBuildSuppliers(zkDepth);
  // _ZK_ALLROWS FAQAT shu yerda, hozirgi ko'rsatilayotgan _ZK_SUPPLIERS'dan tekislanadi -
  // _zkBuildSuppliers() global holatga tegmagani uchun (yuqoridagi izoh) yuqoridagi
  // _zkRenderQuickPanel()/_supOther chaqiruvlari bu massivni endi buzolmaydi.
  _ZK_ALLROWS=[];_ZK_SUPPLIERS.forEach(s=>s.rows.forEach(r=>_ZK_ALLROWS.push(r)));
  const _cS=_ZK_SUPPLIERS.find(x=>x.sup===zkSupFilter);
  window._zkNeedCur=_cS?_cS.rows.filter(r=>r.orderQty>0).length:0;
  window._zkTotCur=_cS?_cS.rows.length:0;
  const fr=document.getElementById("zk-filter-row");if(fr)fr.style.display="none";
  const dsr=document.getElementById("zk-detail-search-row");if(dsr)dsr.style.display="";
  const dsx=document.getElementById("zk-detail-search-x");if(dsx)dsx.style.display=zkDetailQuery?"flex":"none";
  const foot=document.getElementById("zk-export-btn");if(foot)foot.style.display="";
  const qw=document.getElementById("zk-quickbtn-wrap");if(qw)qw.style.display="";
  const cc=document.getElementById("zk-clearchk-btn");if(cc)cc.style.display="none";
  const rb=document.getElementById("zk-reset-btn");if(rb)rb.style.display="";
  let sups=_ZK_SUPPLIERS;
  if(zkSupFilter)sups=sups.filter(s=>s.sup===zkSupFilter);
  // Qidiruv + Kategoriya/Subkategoriya filtri - bitta umumiy funksiya orqali (renderZakas
  // va zkToggleSupplier o'rtasida mos kelishi kk, aks holda "hammasini belgilash"
  // ekranda ko'rinmagan qatorlarga ham tegib qolishi mumkin edi).
  if(zkQuery||zkDetailQuery||zkCatFilter||zkSubFilter||zkBcFilter){
    sups=sups.map(s=>({...s,rows:_zkApplyQueryFilters(s)})).filter(s=>s.rows.length);
  }
  sups=sups.slice().sort((a,b)=>b.valTotal-a.valTotal);
  const supCountEl=document.getElementById("zk-sup-count");
  // Mobil "⋮" tugmasi - Tezkor ro'yxat/Sozlamalar/Tozalash/Export panelini ochadi
  // (desktopda display:none, joyni egallamaydi). Chuqur zakas tabining yonida
  // ko'rinishi uchun dtabs ichiga, ro'yxat rejimida esa hisoblagich matni yoniga
  // qo'shiladi (foydalanuvchi so'rovi, 2026-09-01).
  const mobMoreBtn=_zkMobMoreBtnHtml();
  const confirmSlot=document.getElementById("zk-confirm-slot");
  if(supCountEl){if(zkSupFilter){const conf=zkIsConfirmed(zkSupFilter);const supJ=JSON.stringify(zkSupFilter).replace(/"/g,'&quot;');
    const needN=zkDepth==="normal"?window._zkNeedCur:window._zkNeedOther;
    const needC=zkDepth==="chuqur"?window._zkNeedCur:window._zkNeedOther;
    const dtabs=`<div class="zk-dtabs-detail"><button class="zk-dtab${zkDepth==="normal"?" active":""}" onclick="zkSetDepth('normal')">${t("zk_depth_normal")} <b>${needN||0}</b></button><button class="zk-dtab${zkDepth==="chuqur"?" active":""}" onclick="zkSetDepth('chuqur')">${t("zk_depth_chuqur")} <b>${needC||0}</b></button>${mobMoreBtn}</div>`;
    supCountEl.innerHTML=`<button class="zk-back-btn" onclick="zkBackToList()" style="display:inline-flex;align-items:center;gap:6px;padding:7px 16px;border-radius:14px;border:1.5px solid #e6e2f7;background:#fff;font-size:13px;font-weight:600;color:#534AB7;cursor:pointer"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>${t("zk_back_list")}</button>${dtabs}<button class="zk-confirm-btn${conf?' zk-confirm-btn-ok':''}" onclick="zkMarkConfirmedFromDetail(${supJ})">${conf?'✓ '+t('zk_confirm_cancel'):t('zk_confirm_btn')}</button>`;
    if(confirmSlot)confirmSlot.innerHTML=`<button class="zk-confirm-btn zk-confirm-btn-mob${conf?' zk-confirm-btn-ok':''}" onclick="zkMarkConfirmedFromDetail(${supJ})">${conf?'✓ '+t('zk_confirm_cancel'):t('zk_confirm_btn')}</button>`;
    }else{supCountEl.innerHTML=`<b>${sups.length}</b> ${t("zk_sum_sup")} ${mobMoreBtn}`;if(confirmSlot)confirmSlot.innerHTML="";}}
  const body=document.getElementById("zk-body");if(!body)return;
  if(!sups.length){body.innerHTML=_zkBcBanner()+`<div class="zk-empty">${zkBcFilter?"Bu ta'minotchida faylдаgi shtrix-kodlarga mos tovar topilmadi. Topilmagan tovarlarni banner'dagi \"ko'rish\" orqali ko'ring.":t("zk_empty")}</div>`;const pag=document.getElementById("zk-pag");if(pag)pag.innerHTML="";return;}
  const totalSups=sups.length;
  if(zkPage<1)zkPage=1;
  if(zkPage>totalSups)zkPage=totalSups;
  const shownSups=sups.slice(zkPage-1,zkPage);
  const sigLbl={kritik:["dot-kritik",t("sig_kritik")],urgent:["dot-urgent",t("sig_urgent")],tekshir:["dot-tekshir",t("sig_tekshir")],excess:["dot-excess",t("sig_excess")],normal:["dot-normal",t("sig_normal")]};
  let h=_zkBcBanner();
  shownSups.forEach(s=>{
    const totTxt=(s.qtyDona>0?s.qtyDona.toLocaleString()+" sht":"")+(s.qtyDona>0&&s.qtyKg>0?" · ":"")+(s.qtyKg>0?s.qtyKg.toLocaleString()+" kg":"");
    const supRel=_zkRelevantRows(s);
    const checkedCount=supRel.filter(r=>_zkIsChecked(r)).length;
    const supAllChecked=checkedCount===supRel.length;
    const supIndet=checkedCount>0&&!supAllChecked;
    const supChkAttrs=`${supAllChecked?" checked":""}${supIndet?" data-indet=\"1\"":""}`;
    const needCount=s.rows.filter(r=>r.orderQty>0).length;
    const showAll=!!zkSupShowAll[s.sup]||needCount===0||!!zkDetailQuery||!!zkBcFilter;
    // Manfiy stokli tovarlar ODDIY ko'rinishda ham chiqadi (orderQty=0 bo'lsa ham) - aks holda
    // ular "Hammasini ko'rsatish" ortida yashirinib qolardi va menejer ularning borligini ham
    // bilmasdi (jonli bazada 1,116 ta sotilayotgan tovar aynan shunday holatda edi, 2026-07-21).
    const visRows=showAll?s.rows:s.rows.filter(r=>r.orderQty>0||r.pendingQty>0||r.stock<0);
    const needBadge=`<span class="zk-needbadge" onclick="zkToggleSupShowAll(${s._si})"><b>${needCount}</b> ${t("zk_need_label")} &nbsp;·&nbsp; ${showAll?t("zk_show_need_only"):t("zk_show_all_n").replace("{n}",s.rows.length)}</span>`;
    // STOK ustuni sarlavhasi: "Invan"/"Hisoblangan" ikkita kichik almashtiruvchi yorliq
    // bilan (foydalanuvchi so'rovi, 2026-07-27) - bosilsa shu supplierdagi BARCHA qatorni
    // bir zumda o'sha rejimga o'tkazadi (zkSetSupplierStockMode - faqat calcStock bor
    // qatorlarga ta'sir qiladi). Qator darajasida alohida o'zgartirish ham ochiq qoladi
    // (pastda, har katakchada) - bu yerdagi bosish faqat "hammasi" uchun tezkor yo'l.
    const stockTh=`<th style="text-align:center"><span onclick="zkSort('stock')" style="cursor:pointer;user-select:none">${t("zk_col_stock")}<span style="margin-left:2px;color:${zkSortKey==="stock"?"#534AB7":"#ccc"};font-size:9px">${zkSortKey==="stock"?(zkSortAsc?"↑":"↓"):"↕"}</span></span><div class="zk-stock-hdr-switch"><span onclick="event.stopPropagation();zkSetSupplierStockMode(${s._si},'calc')">${t("zk_stock_th_calc")}</span><span onclick="event.stopPropagation();zkSetSupplierStockMode(${s._si},'invan')">${t("zk_stock_th_invan")}</span></div></th>`;
    h+=`<div class="zk-sup-block"><div class="zk-sup-name"><span style="display:flex;align-items:center;gap:10px;min-width:0;flex:1 1 auto"><input type="checkbox" class="zk-chk zk-sup-chk"${supChkAttrs} onchange="zkToggleSupplier(${s._si})"><span class="zk-sup-title" title="${esc(s.sup)}">${esc(s.sup)}</span></span><span class="zk-sup-meta">${needBadge} &nbsp;·&nbsp; ${t("zk_total_label")} <b>${totTxt||"0"}</b><span class="zk-target-edit">${t("zk_target_label")} <input class="zk-target-inp" type="number" min="0" max="365" value="${s.target}" onchange="zkSetTarget(${s._si},this.value)"></span></span></div><div class="zk-tbl-wrap"><table class="zk-ktbl"><colgroup><col style="width:4%"><col style="width:3%"><col style="width:15%"><col style="width:4%"><col style="width:15%"><col style="width:8%"><col style="width:6%"><col style="width:5%"><col style="width:6%"><col style="width:5%"><col style="width:8%"><col style="width:12%"><col style="width:9%"></colgroup><thead><tr><th style="text-align:center"><input type="checkbox" class="zk-chk zk-sup-chk"${supChkAttrs} onchange="zkToggleSupplier(${s._si})"></th><th>#</th>${_zkTh(t("zk_col_product"),"name","left")}${_zkTh("ABC","abc","center")}${stockTh}<th style="text-align:center">${t("zk_col_lk")}</th>${_zkTh(t("zk_col_daily"),"dailyAvg")}${_zkTh(t("zk_col_days_left"),"daysLeft")}<th style="text-align:right">${t("zk_col_extra_days")}</th><th style="text-align:center">${t("zk_col_status")}</th>${_zkTh(t("zk_col_cost"),"rcost")}${_zkTh(t("zk_col_order"),"orderQty")}<th style="text-align:right">${t("zk_col_sum")}</th></tr></thead><tbody>`;
    if(!visRows.length){
      h+=`<tr><td colspan="10" style="text-align:center;color:#bbb;padding:18px;font-size:12px">${t("zk_no_need_rows")}</td></tr>`;
    }
    visRows.forEach((r,i)=>{
      const u=r.kg?"кг":"шт";
      // STOK katakchasi: Hisoblangan (CHAP, doim shu tarafda) va Invan (O'NG, doim shu
      // tarafda) QAT'IY ikki ustunchada, orasida vertikal chiziq (foydalanuvchi so'rovi,
      // 2026-07-28 - joylashuv endi barqaror, faqat STIL o'zgaradi: faol tomon qalin,
      // nofaol tomon xira/shaffof). Hisoblangan tomon ISHONCH DARAJASIGA qarab doim
      // ranglanadi (yuqori=yashil, o'rta=sariq, eskirgan=kulrang) - faol yoki xira bo'lsa ham.
      const _fmt=n=>r.kg?n.toFixed(2):n.toLocaleString();
      const invTxt=_fmt(r.invanStock);
      let calcCell, invCell;
      // Qo'lda tuzatish (r.calcOverride, Vercel Blob'dan) bo'lsa - u calcStock
      // o'rnida ko'rsatiladi (binafsha rang + qalam belgisi). Qator ichida
      // alohida tahrir belgisi YO'Q (foydalanuvchi so'rovi, 2026-08-10) -
      // tuzatish faqat yuqoridagi ⚙ Sozlamalar panelidan (qidiruv orqali)
      // kiritiladi.
      // 2026-08-20 (Bilol topilmasi, real misol: "coca-cola 2l" 680 kiritilgan,
      // 22 dona sotilgan, lekin bu yerda hamon 680 ko'rinardi): bu yerda
      // ATAYLAB alohida hisoblanadigan _effStock bor edi (yuqoridagi
      // _zkBuildSuppliers'dagi jonli-tuzatilgan `stock`dan MUSTAQIL) - shu
      // sabab u yerdagi tuzatish (ovEffective) bu YERGA yetib bormagan edi.
      // Endi bu ham xuddi calcStock live-tuzatishi kabi `r.ovEffective`ni
      // ishlatadi (mavjud bo'lmasa xom qiymatga qaytadi).
      const _ovActive=!!r.calcOverride;
      const _effStock=_ovActive?(r.ovEffective!=null?r.ovEffective:r.calcOverride.value):r.calcStock;
      if(_effStock==null){
        const invStyle=r.invanStock<=0?"color:#E24B4A;font-weight:700":"font-weight:600";
        calcCell=`<span class="zk-stock-half zk-stock-calc" style="color:#ccc">—</span>`;
        invCell=`<span class="zk-stock-half zk-stock-invan" style="${invStyle}">${invTxt}</span>`;
      }else{
        const confCls=_ovActive?"zk-stock-conf-hi":(r.calcConf==="yuqori"?"zk-stock-conf-hi":r.calcConf==="eskirgan"?"zk-stock-conf-stale":"zk-stock-conf-mid");
        const calcTxt=_fmt(_effStock);
        const tt=_ovActive
          ?esc(`Qo'lda tuzatilgan: ${calcTxt}`+(r.calcOverride.updated_by?` (${r.calcOverride.updated_by})`:"")+(r.calcOverride.note?` — ${r.calcOverride.note}`:""))
          :esc(`${t("zk_stock_tt_calc")}: ${calcTxt} — ${t("zk_stock_tt_conf_"+(r.calcConf==="yuqori"?"hi":r.calcConf==="eskirgan"?"stale":"mid"))}, ${t("zk_stock_tt_evidence")} ${r.calcEvidence}, ${t("zk_stock_tt_anchor")} ${r.calcAnchor}`);
        const isCalc=r.stockMode==="calc";
        const calcStyle=(isCalc?"font-weight:700":"font-weight:600;opacity:.72")+(_ovActive?";color:#534AB7":"");
        const invStyle=isCalc?"font-weight:600;opacity:.72":(r.invanStock<=0?"color:#E24B4A;font-weight:700":"font-weight:700");
        // VAQTINCHA belgi (2026-07-29): "tugab qolgan" davri aniqlanib, qiymati
        // qayta hisoblangan tovarlar chap tomonida kichik yashil nuqta bilan
        // ajratiladi. Maqsad - qolgan ~17 ming tovar tekshirilayotganda qaysi
        // biri allaqachon tekshirilgan qoidadan o'tganini ko'rish. HAMMA tovar
        // tekshirilgach shu belgi OLIB TASHLANADI (foydalanuvchi so'rovi).
        const _chk=(!_ovActive&&r.calcRule&&r.calcRule!=="oddiy")
          ?`<span class="zk-stock-chk" title="${esc(t("zk_stock_tt_checked"))}"></span>`:"";
        const _ovMark=_ovActive?`<span style="margin-right:2px">&#9998;</span>`:"";
        calcCell=`<span class="zk-stock-half zk-stock-calc ${confCls}" style="${calcStyle}" onclick="event.stopPropagation();zkSetRowStockMode(${r._ri},'calc')" title="${tt}">${_chk}${_ovMark}${calcTxt}</span>`;
        invCell=`<span class="zk-stock-half zk-stock-invan" style="${invStyle}" onclick="event.stopPropagation();zkSetRowStockMode(${r._ri},'invan')" title="${t("zk_stock_tt_invan")}: ${invTxt}">${invTxt}</span>`;
      }
      const stTxt=`<div class="zk-stock-split">${calcCell}${invCell}</div>`;
      // "Oxirgi kirimdan qolgan" (2026-08-04, 2026-08-08'da tartib almashtirildi
      // foydalanuvchi so'rovi bilan): eng OXIRGI kirimda kelgan dona va o'shandan
      // buyon sotilgani — "kelgan/qolgan" ko'rinishida (45/6). Faqat eng oxirgi
      // kirim hisobga olinadi, undan oldingilari emas.
      let lkTxt="—";
      if(r.lkQty>0){
        const _s=r.lkSold||0, _r=Math.max(0,r.lkQty-_s);
        const _f=v=>r.kg?Math.round(v*10)/10:Math.round(v);
        const _tt=t("zk_lk_tt").replace("{q}",_f(r.lkQty)).replace("{d}",r.lkDate||"")
          .replace("{s}",_f(_s)).replace("{r}",_f(_r));
        const _col=_r<=0?"#E24B4A":(_r<=r.lkQty*0.2?"#EF9F27":"#1D9E75");
        lkTxt=`<span title="${esc(_tt)}" style="font-size:12.5px;white-space:nowrap"><span style="color:#bbb">${_f(r.lkQty)}/</span><b style="color:${_col}">${_f(_r)}</b></span>`;
      }
      const dTxt=r.dailyAvg>0?(r.kg?r.dailyAvg.toFixed(2):Math.round(r.dailyAvg*10)/10)+" "+u:"—";
      const dlTxt=r.daysLeft!=null?r.daysLeft:"—";
      const oqRaw=r.kg?r.orderQty:r.orderQty;
      const isManual=zkRowQty[r.key]!=null;
      const sl=sigLbl[r.signal]||["dot-normal",r.signal||"—"];
      // Bosilganda Kirim (p8) bo'limidagi kabi shu tovarning TO'LIQ kirim tarixini
      // ko'rsatadi (zkOpenKirimDetail) - foydalanuvchi so'rovi (2026-08-18): "Open"
      // buyurtma haqiqiy kelmaydigan bo'lsa, buni Zakas'ning o'zidan (Kirim bo'limiga
      // alohida o'tmasdan) darhol tekshirib ko'rish uchun.
      const _krClick=r.sku?` onclick="event.stopPropagation();zkOpenKirimDetail('${esc(String(r.sku))}')" style="cursor:pointer"`:"";
      const statusCell=r.pendingQty>0?`<span class="zk-open-badge"${_krClick} title="${r.pendingQty.toLocaleString()} dona yo'lda - ${t("zk_kr_click_tt")}">Open</span>`:`<span class="status-dot ${sl[0]}"${_krClick} title="${esc(sl[1])}"></span>`;
      // Narx: eng ishonchli tannarx (haqiqiy kirim tarixi, topilmasa katalog fallback -
      // build_prev_avg.py: recompute_current_cost()). Taxminiy bo'lsa (kirim tarixi hali
      // yo'q - yangi tovar) "≈" bilan belgilanadi va tooltip'da tushuntiriladi.
      // Yaxlitlanmagan - asl narx qanday bo'lsa shunday (Excel eksporti bilan bir xil,
      // foydalanuvchi so'rovi, 2026-07-22: Math.round() 34,999.88'ni 35,000 qilib
      // ko'rsatib, chalg'itardi).
      // Narx endi QO'LDA TAHRIRLANADIGAN input - Zakas/Qo'shimcha kun bilan bir xil
      // (.zk-adj-inp) uslubda, HAMMA qatorda bir xil ko'rinishda (foydalanuvchi so'rovi,
      // 2026-07-22: "ba'zi qatorlarda boshqacha bo'lmasin, hammasida bir xil bo'lsin").
      // Qo'lda tuzatilgan bo'lsa "nonzero" klassi bilan (boshqa qo'lda-kiritilgan
      // maydonlar bilan bir xil belgilash), taxminiy narx uchun faqat hover tooltip -
      // ko'rinishni o'zgartirmaydi.
      // Ming ajratkichsiz (149950) bir qarashda o'qish qiyin edi (foydalanuvchi so'rovi,
      // 2026-07-22) - endi ko'rinishda ming ajratkichli (149,950), lekin type="text" bilan
      // (number input ming ajratkichli qiymatni qabul qilmaydi). zkSetCost() ajratkichlarni
      // tozalab, asl sonni oladi.
      const costDisp=r.rcost>0?r.rcost.toLocaleString(undefined,{maximumFractionDigits:2}):'';
      const costCell=`<input class="zk-adj-inp${r.costManual?' nonzero':''}" type="text" inputmode="decimal" style="width:86px" value="${costDisp}" onchange="zkSetCost(${r._ri},this.value)" onclick="event.stopPropagation()"${r.rcostApprox?` title="${esc(t("zk_cost_approx_tt"))}"`:''}>`;
      // Summa: faqat galochka qo'yilgan qatorlarda hisoblanadi (foydalanuvchi so'rovi,
      // 2026-07-22) - belgilanmagan qatorda "—", chunki bu tovar hali zakasga kirmagan.
      const _checked=_zkIsChecked(r);
      const sumVal=_checked?r.orderQty*r.rcost:0;
      const sumTxt=_checked&&sumVal>0?`<span style="color:#1D9E75">${Math.round(sumVal).toLocaleString()}</span>`:"—";
      h+=`<tr><td style="text-align:center"><input type="checkbox" class="zk-chk" ${_checked?"checked":""} onchange="zkToggleRow(${r._ri})" onclick="event.stopPropagation()"></td><td style="color:#bbb;font-size:12px">${i+1}</td><td><div class="zk-prod-link" onclick="zkOpenProduct(${r._ri})">${esc(r.name)}</div>${(r.bc&&r.bc.length)||r.sku?`<div style="font-size:11px;color:#aaa">${esc(r.bc&&r.bc.length?r.bc.join(", "):r.sku)}</div>`:""}</td><td style="text-align:center"><span style="font-size:11.5px;font-weight:700;padding:3px 8px;border-radius:4px;background:${r.abc==="A"?"#d7f3ea":r.abc==="B"?"#e3ddf9":"#fce8c8"};color:${r.abc==="A"?"#1D9E75":r.abc==="B"?"#534AB7":"#c97f14"}">${r.abc||"—"}</span></td><td style="text-align:right">${stTxt}</td><td style="text-align:center">${lkTxt}</td><td style="text-align:right;color:#666">${dTxt}</td><td style="text-align:right;color:#666">${dlTxt}</td><td style="text-align:right"><input class="zk-adj-inp${r.adj?" nonzero":""}" type="number" value="${r.adj}" onchange="zkSetAdj(${r._ri},this.value)" onclick="event.stopPropagation()"></td><td style="text-align:center">${statusCell}</td><td style="text-align:right">${costCell}</td><td style="text-align:right;padding:2px 4px">${r.minAdd>0&&!isManual?`<span style="color:#EF9F27;font-size:11px;margin-right:3px">+${r.minAdd}</span>`:"" }${r.boxAdd>0&&!isManual?`<span style="color:#1D9E75;font-size:11px;margin-right:3px" title="Karobka: ${r.boxSize} dona (tarixiy kirimdan taxmin qilingan)">+${r.boxAdd}</span>`:"" }<input class="zk-adj-inp${isManual?' nonzero':''}" type="number" min="0" step="${r.kg?'0.1':'1'}" value="${oqRaw}" onchange="zkSetQty(${r._ri},this.value)" onclick="event.stopPropagation()"> <span style="color:#888;font-size:12px">${u}</span></td><td style="text-align:right;font-weight:600">${sumTxt}</td></tr>`;
    });
    // Belgilangan (galochka qo'yilgan) qatorlarning summasi - jadval OSTIDA, o'ng
    // burchakda (foydalanuvchi so'rovi, 2026-07-22). Faqat shu supplierning qatorlari
    // - "faqat zakas beriladigan summa chiqadi" (checked bo'lmagan qatorlar 0 hisoblanadi).
    // Jami summa MUNTAZAM va CHUQUR ikkalasini birga hisoblaydi (foydalanuvchi so'rovi,
    // 2026-07-22) - avval faqat joriy ochiq bo'lim (tab) qatorlaridan hisoblanardi, shu
    // sabab bitta supplierda ikkala bo'limda ham galochka qo'yilgan bo'lsa, jami noto'g'ri
    // (kam) chiqardi. _supOther (yuqorida, boshqa bo'lim uchun) shu supplierning
    // qatorlarini topib, ularning ham belgilangan summasi qo'shiladi.
    const _otherSupMatch=_supOther.find(x=>x.sup===s.sup);
    const _otherCheckedSum=_otherSupMatch?_otherSupMatch.rows.reduce((acc,r)=>acc+(_zkIsChecked(r)?r.orderQty*r.rcost:0),0):0;
    const _supCheckedSum=s.rows.reduce((acc,r)=>acc+(_zkIsChecked(r)?r.orderQty*r.rcost:0),0)+_otherCheckedSum;
    h+=`</tbody></table></div><div style="text-align:right;padding:9px 16px 11px;font-size:13px;color:#666;border-top:1px solid #f0eef8">${t("zk_checked_total_label")}: <b style="color:#1D9E75;font-size:18px">${Math.round(_supCheckedSum).toLocaleString()} so'm</b></div></div>`;
  });
  const _prevWrap=body.querySelector(".zk-tbl-wrap");const _prevST=_prevWrap?_prevWrap.scrollTop:0;
  body.innerHTML=h;
  if(_prevST>0){const nw=body.querySelector(".zk-tbl-wrap");if(nw)nw.scrollTop=_prevST;}
  body.querySelectorAll('.zk-sup-chk[data-indet="1"]').forEach(el=>{el.indeterminate=true;});
  renderZakasPag(totalSups);
}
function _zkSafeFileName(s){
  return String(s||"").replace(/[\\/:*?"<>|]+/g,"_").trim().slice(0,60)||"postavshik";
}
// Invan "Заказ" bo'limiga TO'G'RIDAN-TO'G'RI import qilish uchun - Invan shu 4 ustunli
// shablonni kutadi: Наименование, Штрих код, Кол-во, Цена (foydalanuvchi taqdim etgan
// shablon, 2026-07-22). Sarlavhalar ATAYLAB ilova tilidan (t()) mustaqil - Invan import
// moslamasi aynan shu rus tilidagi nomlarni kutadi, ilova tili o'zgarsa ham bu o'zgarmaydi.
// Supplier ustuni YO'Q - shablonda yo'q edi, Invan'da bitta supplier tanlab keyin uning
// tovarlari import qilinadi, shuning uchun HAR SUPPLIER uchun ALOHIDA fayl chiqariladi
// (foydalanuvchi so'rovi, 2026-07-22).
async function _zkExportInvanTemplate(sups){
  const bySup=new Map();
  sups.forEach(s=>{
    s.rows.filter(r=>_zkIsChecked(r)).forEach(r=>{
      if(!bySup.has(s.sup))bySup.set(s.sup,[]);
      bySup.get(s.sup).push(r);
    });
  });
  if(!bySup.size)return false;
  // 2026-08-04 (foydalanuvchi so'rovi): eng yuqorida SUPPLIER NOMI, "Цена"dan keyin
  // har tovar uchun SUMMA ustuni, eng pastda esa JAMI SUMMA qatori qo'shildi.
  // Sarlavha qatori endi 1-emas, 2-qator (ustidagi qator supplier nomi uchun).
  const headers=["Наименование","Штрих код","Кол-во","Цена","Сумма"];
  let first=true;
  for(const [sup,rows] of bySup){
    rows.sort((a,b)=>b.orderQty-a.orderQty);
    const wb=new ExcelJS.Workbook();
    const ws=wb.addWorksheet("Заказ");
    const supRow=ws.addRow([sup]);
    ws.mergeCells(1,1,1,headers.length);
    supRow.getCell(1).font={bold:true,size:12};
    supRow.getCell(1).alignment={horizontal:"left",vertical:"middle"};
    const headerRow=ws.addRow(headers);
    headerRow.eachCell(c=>{
      c.font={bold:true};
      c.fill={type:"pattern",pattern:"solid",fgColor:{argb:"DDEBF7"}};
      c.alignment={horizontal:"center",vertical:"middle"};
    });
    let jami=0;
    rows.forEach(r=>{
      const bcTxt=(r.bc&&r.bc.length)?r.bc[0]:"";
      const summa=(r.orderQty||0)*(r.rcost||0);
      jami+=summa;
      const row=ws.addRow([r.name,bcTxt,r.orderQty,r.rcost||0,summa]);
      row.getCell(3).numFmt=r.kg?"#,##0.00":"#,##0";
      row.getCell(4).numFmt=Number.isInteger(r.rcost||0)?"#,##0":"#,##0.##";
      row.getCell(5).numFmt="#,##0";
    });
    const totRow=ws.addRow(["","","","ИТОГО",jami]);
    totRow.getCell(4).font={bold:true};
    totRow.getCell(5).font={bold:true};
    totRow.getCell(5).numFmt="#,##0";
    totRow.getCell(4).alignment={horizontal:"right"};
    ws.columns=[{width:42},{width:18},{width:10},{width:12},{width:16}];
    const buf=await wb.xlsx.writeBuffer();
    if(!first)await new Promise(res=>setTimeout(res,300));  // brauzer ketma-ket yuklashlarni bloklab qoymasligi uchun
    first=false;
    const a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob([buf],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));
    a.download=`zakas_${_zkSafeFileName(sup)}_${new Date().toISOString().slice(0,10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  return true;
}
async function exportZakasCSV(){
  await _ensureExcelJS();
  if(typeof ExcelJS==="undefined")return;
  // Muntazam va Chuqur ENDI BITTA faylga BIRLASHTIRILADI, har supplier uchun
  // (foydalanuvchi so'rovi, 2026-07-22) - Invan'ga import qilishda bitta supplierning
  // BARCHA (ham muntazam, ham chuqur) belgilangan tovarlarini bir yo'la yuklash kk,
  // ikkita alohida faylni birma-bir import qilish import jarayonini qiyinlashtirardi.
  // _zkBuildSuppliers("normal"/"chuqur") har doim TO'LIQ ro'yxat qaytaradi (joriy
  // ochiq tab'dan qat'i nazar), shuning uchun ikkalasini birlashtirish hech qanday
  // belgilangan qatorni yo'qotmaydi - key'lar depth bilan prefikslangani uchun
  // (normal:/chuqur:) bir xil mahsulot ikki marta hisoblanib qolmaydi (har bir
  // mahsulot faqat BITTA depth doirasiga tushadi, _zkBuildSuppliers'dagi inScope()).
  const supN=_zkBuildSuppliers("normal"),supC=_zkBuildSuppliers("chuqur");
  const ok=await _zkExportInvanTemplate([...supN,...supC]);
  if(!ok)alert(t("zk_no_selection"));
}
async function exportStockXLSX(){
  await _ensureExcelJS();
  if(!ZITEMS||typeof ExcelJS==="undefined")return;
  // Ekranda ko'rsatilayotgan aynan shu ro'yxatni eksport qilamiz (Aktiv yoki Noaktiv
  // tab, tanlangan karta/signal, qidiruv va dinamik filtrlar - barchasi hisobga olinadi).
  const items=_zVisibleItems();
  items.sort((a,b)=>(b.frozenVal||0)-(a.frozenVal||0));
  const totalFrozen=items.reduce((s,v)=>s+(v.frozenVal||0),0);
  const isNoaktiv=zCurFilter==="muzlagan"||zCurFilter==="eskirgan"||zCurFilter==="yoq"||zCurFilter==="noaktiv_all";
  const titleKeyMap={all:"filt_all",kritik:"sig_kritik",urgent:"sig_urgent",tekshir:"sig_tekshir",excess:"sig_excess",normal:"sig_normal",sekin:"sig_sekin",muzlagan:"xls_title_muzlagan",eskirgan:"xls_title_eskirgan",yoq:"xls_title_yoq",noaktiv_all:"xls_noaktiv_all"};
  const title=t(titleKeyMap[zCurFilter]||"filt_all");
  const statusMap={
    muzlagan:`${t("xls_status_muzlagan")}, ${STOCK_ACTIVE_DAYS} ${t("xls_status_muzlagan_sub")}`,
    eskirgan:t("xls_status_eskirgan"),
    yoq:t("xls_status_yoq"),
    noaktiv_all:t("xls_status_all"),
  };
  const statusText=statusMap[zCurFilter]||"";
  const localeMap={uz:"uz-UZ",en:"en-US",ru:"ru-RU"};
  const dtLocale=localeMap[LANG]||"uz-UZ";

  const wb=new ExcelJS.Workbook();
  const ws=wb.addWorksheet(isNoaktiv?t("xls_noaktiv_sheet"):(t("nav_p5")||"Stock"),{views:[{state:"frozen",ySplit:5}]});
  const PURPLE="7C3AED",LIGHT="F3F0FF",DARK="3B2A6B";

  ws.mergeCells("A1:B1");
  const sumLabel=isNoaktiv?t("xls_frozen_sum_prefix"):t("xls_stock_value_prefix");
  ws.getCell("A1").value=title+` — ${sumLabel}: ${Math.round(totalFrozen).toLocaleString("ru-RU")} so'm`;
  ws.getCell("A1").font={bold:true,size:13,color:{argb:DARK}};
  ws.getCell("A2").value=`${t("xls_product_count")}: ${items.length}`;
  ws.getCell("A2").font={bold:true,size:11,color:{argb:"6B7280"}};
  if(statusText){
    ws.getCell("A3").value=statusText+` (${new Date().toLocaleDateString(dtLocale)} ${t("xls_asof")})`;
    ws.getCell("A3").font={italic:true,size:10,color:{argb:"9CA3AF"}};
  }
  const filterDesc=_zfDescribeFilters();
  if(filterDesc){
    ws.mergeCells("A4:I4");
    ws.getCell("A4").value=`${t("xls_filters_label")}: ${filterDesc}`;
    ws.getCell("A4").font={italic:true,size:10,color:{argb:"2563EB"}};
    ws.getCell("A4").alignment={wrapText:true,vertical:"middle"};
    ws.getRow(4).height=Math.max(16,Math.ceil(filterDesc.length/110)*14);
  }

  const headerRow=ws.getRow(5);
  const headers=[t("xls_th_sku"),t("xls_th_name"),t("xls_th_cat"),t("xls_th_buy_price"),t("xls_th_sell_price"),t("xls_th_stock"),isNoaktiv?t("xls_th_frozen_sum"):t("xls_th_stock_value"),t("xls_th_last_sale"),t("xls_th_last_arrival")];
  headers.forEach((h,i)=>{
    const c=headerRow.getCell(i+1);
    c.value=h;
    c.font={bold:true,color:{argb:"FFFFFF"}};
    c.fill={type:"pattern",pattern:"solid",fgColor:{argb:PURPLE}};
    c.alignment={vertical:"middle",horizontal:i>=3?"right":"left"};
    c.border={bottom:{style:"thin",color:{argb:PURPLE}}};
  });
  headerRow.height=22;

  const _now=new Date();
  items.forEach((v,i)=>{
    const _laVal=_zfLastArrivalDate(v);
    const laRecent=_laVal?String(_laVal).slice(0,10):"";
    const laIsRecent=!!_laVal&&((_now-new Date(_laVal))/86400000)<=STOCK_ACTIVE_DAYS;
    const lastSold=_zfLastSaleDate(v)||"";
    const r=ws.addRow([v.sku||"",v.name,v.cat||"",Math.round(v.sp||0),Math.round(v.rp||0),v.stock,Math.round(v.frozenVal||0),lastSold,laRecent]);
    r.getCell(4).numFmt='#,##0 "so\'m"';
    r.getCell(5).numFmt='#,##0 "so\'m"';
    r.getCell(6).numFmt=Number.isInteger(v.stock)?"#,##0":"#,##0.00";
    r.getCell(7).numFmt='#,##0 "so\'m"';
    r.getCell(7).font={bold:true,color:{argb:PURPLE}};
    if(!lastSold)r.getCell(8).font={color:{argb:"E24B4A"},italic:true};
    r.getCell(9).font={color:{argb:"0E7490"},bold:laIsRecent};
    if(i%2===1){for(let c=1;c<=9;c++)r.getCell(c).fill={type:"pattern",pattern:"solid",fgColor:{argb:LIGHT}};}
  });

  ws.columns=[{width:11},{width:42},{width:24},{width:15},{width:15},{width:11},{width:20},{width:15},{width:15}];
  ws.getColumn(4).alignment={horizontal:"right"};
  ws.getColumn(5).alignment={horizontal:"right"};
  ws.getColumn(6).alignment={horizontal:"right"};
  ws.getColumn(7).alignment={horizontal:"right"};

  const buf=await wb.xlsx.writeBuffer();
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([buf],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));
  a.download=`stock_${zCurFilter}_${new Date().toISOString().slice(0,10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(a.href);
}
function _zFitTableHeight(){
  const p5=document.getElementById("p5");
  const wrap=document.querySelector("#p5 .z-table-wrap");
  if(!p5||!wrap||!p5.classList.contains("active"))return;
  const top=wrap.getBoundingClientRect().top;
  const pagEl=document.getElementById("z-pag");
  const pagH=pagEl?pagEl.getBoundingClientRect().height:0;
  const h=window.innerHeight-top-pagH-32;
  wrap.style.maxHeight=Math.max(200,Math.round(h))+"px";
}
(function(){
  const ro=new ResizeObserver(()=>_zFitTableHeight());
  window.addEventListener("load",()=>{
    const h=document.querySelector(".z-header"),tb=document.querySelector("#p5 .z-toolbar");
    if(h)ro.observe(h);
    if(tb)ro.observe(tb);
  });
  window.addEventListener("resize",_zFitTableHeight);
})();
function _spFitTableHeight(){
  const p6=document.getElementById("p6");
  const wrap=document.querySelector("#p6 .sp-tbl-wrap");
  if(!p6||!wrap||!p6.classList.contains("active"))return;
  const top=wrap.getBoundingClientRect().top;
  const pagEl=document.getElementById("sp-pag");
  const pagH=pagEl?pagEl.getBoundingClientRect().height:0;
  const h=window.innerHeight-top-pagH-32;
  wrap.style.maxHeight=Math.max(200,Math.round(h))+"px";
}
(function(){
  const ro=new ResizeObserver(()=>_spFitTableHeight());
  window.addEventListener("load",()=>{
    const h=document.querySelector("#p6 .sp-header"),tb=document.querySelector("#p6 .sp-toolbar");
    if(h)ro.observe(h);
    if(tb)ro.observe(tb);
  });
  window.addEventListener("resize",_spFitTableHeight);
})();
// 2026-08-18 (Bilol so'rovi): Kategoriyalar jadvali (.kt-scroller) statik
// CSS "calc(100vh - 268px)" bilan cheklangan edi - bu qiymat sahifa
// tarkibiga qarab ba'zan haqiqiy bo'sh joydan kamroq bo'lib, pastda
// foydalanilmagan joy qolib ketardi. p5/p6'dagi kabi DINAMIK usulga
// o'tkazildi - haqiqiy joylashuvdan (getBoundingClientRect) hisoblanadi.
// 2026-08-19 (Bilol so'rovi): birinchi hisob ba'zan bir necha piksel
// yetishmay, BUTUN SAHIFA (tashqi) skrollanib qolar edi - sarlavha qisman
// ko'rinmay ketardi. Endi ikkinchi (o'z-o'zini tuzatuvchi) qadam qo'shildi:
// agar shu qadamdan keyin ham HUJJAT balandligi oyna balandligidan katta
// bo'lsa (biror hisobga olinmagan element sabab), aynan shu farqga jadval
// balandligi yana qisqartiriladi - tashqi skroll HECH QACHON chiqmasligi
// kafolatlanadi, ichki (jadval o'zi) skroll esa avvalgidek ishlayveradi.
function _ktFitTableHeight(){
  const p10=document.getElementById("p10");
  const wrap=document.querySelector("#p10 .kt-scroller");
  if(!p10||!wrap||!p10.classList.contains("active"))return;
  const top=wrap.getBoundingClientRect().top;
  let h=window.innerHeight-top-32;
  wrap.style.maxHeight=Math.max(200,Math.round(h))+"px";
  const overflow=document.documentElement.scrollHeight-window.innerHeight;
  if(overflow>0){
    h=Math.max(200,h-overflow-4);
    wrap.style.maxHeight=Math.round(h)+"px";
  }
}
(function(){
  const ro=new ResizeObserver(()=>_ktFitTableHeight());
  window.addEventListener("load",()=>{
    const h=document.querySelector(".kt-header"),tb=document.querySelector("#p10 .kt-toolbar");
    if(h)ro.observe(h);
    if(tb)ro.observe(tb);
  });
  window.addEventListener("resize",_ktFitTableHeight);
})();
function toggleSidebar(){
  document.body.classList.toggle("sb-collapsed");
  localStorage.setItem("tiin_sidebar",document.body.classList.contains("sb-collapsed")?"collapsed":"open");
}
// Mobil ekranlarda sidebar overlay (drawer) sifatida ochiladi/yopiladi -
// desktopdagi toggleSidebar() (rail kengligini o'zgartiradi) bilan aralashmaydi.
function toggleMobileSidebar(){document.body.classList.toggle("mb-open");}
function closeMobileSidebar(){document.body.classList.remove("mb-open");}
// Zakas ta'minotchi qatoridagi tugmalar guruhini (Tezkor ro'yxat/Sozlamalar/Tozalash/
// Export) mobil kenglikda "⋮ Ko'proq" tugmasi ostida yig'ish/yoyish - desktopda bu
// funksiya chaqirilmaydi (tugma display:none bo'lgani uchun bosilmaydi).
function toggleZkMobileMore(){const m=document.getElementById("zk-mobile-more");if(m)m.classList.toggle("open");}
function _zkMobMoreBtnHtml(){return `<button class="zk-mobile-more-toggle" type="button" onclick="toggleZkMobileMore()" title="${esc(t("zk_more_btn"))}"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg></button>`;}
// ─── showPage(): sahifa almashtirish dispatcheri — BARCHA sahifalar
// (p1-p9, nazorat) shu funksiya orqali ochiladi, har sahifaning
// birinchi marta ochilishida kerakli ma'lumotni yuklaydi ───
async function showPage(btn){closeMobileSidebar();const _zb=document.getElementById("z-back");if(_zb)_zb.style.display="none";const _pb=document.getElementById("p5-back");if(_pb)_pb.style.display="none";document.querySelectorAll(".sb-item").forEach(b=>b.classList.remove("active"));btn.classList.add("active");document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));const pid=btn.dataset.page;if(curPageId==="p7"&&pid!=="p7")_zkDraftStopPoll();curPageId=pid;try{sessionStorage.setItem("tiin_resume_page",pid);}catch(_){}document.getElementById(pid).classList.add("active");const _cr=document.getElementById("tb-crumb");if(_cr)_cr.textContent=btn.textContent.trim();const _tbdt=document.querySelector(".tb-dt");if(_tbdt)_tbdt.style.display=(pid==="p7"||pid==="p6"||pid==="p5"||pid==="p8"||pid==="p9"||pid==="p10"||pid==="p11"||pid==="p12")?"none":"";const _hs=document.getElementById("dt-hist-section");if(_hs)_hs.style.display=(pid==="p2")?"block":"none";window.scrollTo(0,0);if(pid==="p2"){if(!P2){_ensureDailyDemand();let apiData=await _apiBoot();await _ensureP2Data(apiData);await initP2(apiData);}}if(pid==="p3"&&!P3){try{const _p3el=document.getElementById("p3data");let _p3v=JSON.parse((_p3el&&_p3el.textContent)||"[]");if(!_p3v.length){const _r=await fetch("data_abc.json",{cache:"no-store"});_p3v=await _r.json();}P3=_p3v;}catch(e){P3=null;}if(P3)await initP3();}if(pid==="p4"&&!P4){P4=JSON.parse(document.getElementById("p4data").textContent);initP4();}
if(pid==="p5"){if(!P2){_ensureDailyDemand();let apiData=await _apiBoot();await _ensureP2Data(apiData);await initP2(apiData);}if(!ZITEMS)_buildZItems();else renderZaxira();setTimeout(_zFitTableHeight,0);}
if(pid==="p7"){if(!P2||!ZITEMS){await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));}const _kirimP=_ensureKirimData();if(!P2){_ensureDailyDemand();let apiData=await _apiBoot();await _ensureP2Data(apiData);await initP2(apiData);}if(!ZITEMS)_buildZItems();await _kirimP;
  // 2026-08-15: qotish tekshiruvida topildi — Zakas'ga har kirishda
  // renderZakas() IKKI MARTA chaqirilardi (har biri ~22k tovarni to'liq
  // qayta hisoblaydi). Birinchi marta zarur (stok tuzatishlari hali
  // yuklanmagan bo'lishi mumkin), lekin `_ensureStockOverrides()` bir
  // martalik (`_stockOvLoaded` bilan keshlanadi) — sessiyada Zakas'ga
  // IKKINCHI marta kirilganda ular ALLAQACHON yuklangan, shuning uchun
  // qayta render shart emas.
  const _zkNeedSecondRender=!_stockOvLoaded||!_zkDraftLoaded;
  renderZakas();await Promise.all([_ensureStockOverrides(),_ensureZkDraft()]);if(_zkNeedSecondRender)renderZakas();_zkDraftStartPoll();}
if(pid==="p6"){const _kirimP=P8?null:_ensureKirimData();const _supP=P6?null:_ensureSupplierData();if(!P2){await _ensureP2Data();await initP2(null);}if(!ZITEMS&&P2){_buildZItems();}if(_kirimP)await _kirimP;if(_supP){await _supP;initP6();}setTimeout(_spFitTableHeight,0);}
if(pid==="p8"){if(!P8){await _ensureKirimData();}initP8();}
if(pid==="p9"){oaInit();}
if(pid==="p10"){await ktInit();setTimeout(_ktFitTableHeight,0);}
if(pid==="p11"){await fmInit();}
if(pid==="p12"){await mgInit();}
if(pid==="p_nazorat"){nazLoad();}_applyPageRange(pid);};
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
  if(idx<0){const pq0=document.getElementById("pf-q");if(pq0){pq0.value=z.name;if(typeof pfQToggle==="function")pfQToggle();if(typeof p2Filter==="function")p2Filter();}const bb=document.getElementById("z-back");if(bb){bb.style.display="inline-flex";bb.textContent=t("z_back_zaxira");}return;}
  const pq=document.getElementById("pf-q");if(pq){pq.value=P2[idx].name;if(typeof pfQToggle==="function")pfQToggle();if(typeof p2Filter==="function")p2Filter();}
  if(typeof p2Open==="function")p2Open(P2[idx]._i!=null?P2[idx]._i:idx);
  const bb=document.getElementById("z-back");if(bb){bb.style.display="inline-flex";bb.textContent=t("z_back_zaxira");}
}
function zBack(){
  const bb=document.getElementById("z-back");if(bb)bb.style.display="none";
  const dest=_zBackPage||"p5";_zBackPage="p5";
  const zbtn=document.querySelector(`.sb-item[data-page="${dest}"]`);
  if(zbtn)showPage(zbtn);
}
// Chuqur zakas: mahsulot dashboardini pav HISOBLANGAN DAVRGA (oxirgi sotuvda
// tugaydigan 30 kunlik oyna) o'rnatadi — qo'lda o'zgartirilmaguncha saqlanadi
// Chuqur zakas pav ko'rinishi belgisi. Oyna renderP2 ichida INLINE hisoblanadi
// (p2HistCustom/GRA-GRB ga tegmaydi -> boshqa ko'rinishlarga oqmaydi). HIST kech
// yuklansa loadHistory tugagach renderP2 qayta chaqiriladi va pav ko'rinishi chiqadi.
function _zkPavRange(lsd,sku){
  window._p2PavSku=sku||null;
  if(typeof loadHistory==="function"&&histLoadState==="idle")loadHistory();
  if(Number.isInteger(window.p2ActiveIndex))renderP2(window.p2ActiveIndex);
}
async function zkOpenProduct(ri){
  const r=_ZK_ALLROWS[ri];if(!r)return;
  _zBackPage="p7";
  const _chuqur=zkDepth==="chuqur";
  const p2btn=document.querySelector('.sb-item[data-page="p2"]');
  if(p2btn)await showPage(p2btn);
  if(!P2)return;
  let idx=-1;
  if(r.sku)idx=P2.findIndex(v=>String(v.sku||"")===String(r.sku));
  if(idx<0)idx=P2.findIndex(v=>v.name===r.name);
  const pq=document.getElementById("pf-q");
  if(pq){pq.value=idx>=0?P2[idx].name:r.name;if(typeof pfQToggle==="function")pfQToggle();if(typeof p2Filter==="function")p2Filter();}
  if(idx>=0&&typeof p2Open==="function")p2Open(P2[idx]._i!=null?P2[idx]._i:idx);
  // Chuqur zakasda: dashboard pav hisoblangan davrni ko'rsatsin (oxirgi sotuv oynasi)
  if(_chuqur&&idx>=0)_zkPavRange(P2[idx].lsd,P2[idx].sku);
  else window._p2PavSku=null;
  const bb=document.getElementById("z-back");
  if(bb){bb.style.display="inline-flex";bb.textContent=t("z_back_zakas");}
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
  zCurFilter="all";zQuery="";zFilters=[];
  zfRenderRows();
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
function _zReasonTxt(v){
  if(!v.reasonKey)return "";
  const tpl=t(v.reasonKey);
  return v.reasonN!=null?tpl.replace("{n}",v.reasonN):tpl;
}
function _zClassify(d,stock,smartDaily,activeAvg,noWindow){
  // d: kunlik miqdor massivi; noWindow=true bo'lsa sana oralig'i qo'llanilmaydi (Stock bo'limi)
  // smartDaily: aqlli velocity (retail + recency) — "daily"; activeAvg: savdo bo'lgan kunlarga bo'lingan o'rtacha
  const rangeActive=!noWindow&&(GRA!=null&&DMETAFULL&&!(GRA===0&&GRB===DMETAFULL.days-1));
  let arr=d;
  if(rangeActive){arr=d.slice(GRA,GRB+1);}
  const n=arr.length;
  if(n===0){
    if(stock>0)return {signal:"muzlagan",reasonKey:"reason_frozen_no_history",di:999,dailyAvg:0,daysLeft:null,stock,wasGoodSeller:false,histRatio:0};
    return {signal:"yoq",reasonKey:"reason_no_stock_no_history",di:999,dailyAvg:0,daysLeft:null,stock:stock||0,wasGoodSeller:false,histRatio:0};
  }
  // oxirgi sotuv kuni
  let last=-1;for(let i=n-1;i>=0;i--){if(arr[i]>0){last=i;break;}}
  const di=last<0?999:(n-1-last);                // sotuvsiz kunlar (oxiridan)
  const totalQty=arr.reduce((a,b)=>a+b,0);
  const activeDays=arr.filter(x=>x>0).length;
  const plainAvg=n>0?totalQty/n:0;
  // VELOCITY: zakas miqdori har doim aqlli (ulgurjisiz) tezlikdan olinadi - max(aqlli recency,
  // retail oylik o'rtacha) - sana oralig'i tanlangan-tanlanmaganidan qat'i nazar. Aks holda
  // bitta yirik ulgurji xaridi xom o'rtachani shishirib, noto'g'ri katta zakasga olib kelardi.
  const dailyAvg=Math.max(smartDaily||0,activeAvg||0);
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
  let signal=null,reasonKey="",reasonN=null;
  if(stock<0){
    signal="tekshir";reasonKey="reason_neg_stock";
  }else if(stock===0&&totalQty>0){
    signal="kritik";reasonKey="reason_stock_out_sold";
  }else if(stock>0&&daysLeft===0){
    signal="kritik";reasonKey="reason_stock_out_effective";
  }else if(di>=7&&wasGoodSeller){
    // Yaxshi sotilardi, keyin sotuv to'xtadi — stokka qarab ajratamiz
    if(stock>0&&stock<=LOW_BUFFER){signal="kritik";reasonKey="reason_stock_out_effective";}
    else if(stock>0){signal="tekshir";reasonKey="reason_check_stock_lost";}
    else{signal="yoq";reasonKey="reason_sold_before_stopped";}
  }else if(stock>0&&totalQty>0&&stock<=LOW_BUFFER){
    signal="urgent";reasonKey="reason_low_stock_risk";
  }else if(stock>0&&dailyAvg>0&&daysLeft!=null&&daysLeft<=10&&di<7){
    signal="urgent";reasonKey="reason_active_selling_days_left";reasonN=daysLeft;
  }else if(stock>3&&totalQty>0&&di>15&&di<30&&(daysLeft==null||daysLeft<45)){
    // Sekin sotiladi: stok 3tadan ko'p (1-2 dona qolgan bo'lsa "tugashga yaqin" bo'ladi,
    // yuqoridagi shart ushlab qoladi), 15-29 kun sotilmagan (30+ kun — noaktivga o'tadi).
    // Kunga yetadi 45 kundan katta bo'lsa — bu allaqachon "ortiqcha" (quyida tekshiriladi).
    signal="sekin";reasonKey="reason_slow_recent";reasonN=di;
  }else if(stock>0&&dailyAvg>0&&daysLeft!=null&&daysLeft>90&&stock>excessMin){
    signal="excess";reasonKey="reason_excess_days_stock";reasonN=daysLeft;
  }else if(stock>0&&dailyAvg<=0&&(plainAvg>0||histActive>0)&&stock>EXCESS_FLOOR){
    signal="excess";reasonKey="reason_excess_no_demand";
  }else if(stock>0&&totalQty>0){
    if(daysLeft!=null&&daysLeft>90){signal="excess";reasonKey="reason_excess_days_stock_3m";reasonN=daysLeft;}
    else{signal="normal";reasonKey="reason_stable_ok";}
  }else if(stock>0&&totalQty===0){
    signal="muzlagan";reasonKey="reason_frozen_zero_sold";
  }else{
    // stock<=0, totalQty=0 — stok ham yo'q, savdo ham yo'q → yo'q kategoriya
    signal="yoq";reasonKey="reason_no_stock_zero_sold";
  }
  return {signal,reasonKey,reasonN,di,dailyAvg:Math.round(dailyAvg*100)/100,daysLeft,stock,wasGoodSeller,histRatio:Math.round(histRatio*100)};
}
function _buildZItems(){
  ZITEMS=[];
  const _endRefZ=(DMETAFULL&&DMETAFULL.end)?new Date(DMETAFULL.end):new Date();
  const _daysSince=ds=>{if(!ds)return 999;const dd=Math.round((_endRefZ-new Date(ds))/86400000);return dd<0?0:dd;};
  P2.forEach(v=>{
    const stock=(v.amt!=null)?parseFloat(v.amt):0;
    if(isNaN(stock))return;
    // Stock bo'limi uchun har doim to'liq ma'lumot (sana oralig'idan mustaqil)
    const _dlFull=typeof dailyForFull==="function"?dailyForFull(v):null;
    const d=_dlFull?(_dlFull.q||[]):(Array.isArray(v.d)?v.d:[]);
    // aqlli velocity — har doim 30 kunlik o'rtacha (tanlangan oraliqdan emas)
    const _avg30z=_get30Avg(v);
    let smartDaily=_avg30z!=null?_avg30z:null,activeAvg=null;
    if(smartDaily==null){
      if(_dlFull&&_dlFull.m){if(_dlFull.m.daily!=null)smartDaily=_dlFull.m.daily;const _ad=_dlFull.m.activeDays||0;const _useAct=_ad>=8;if(_useAct&&_dlFull.m.activeAvg!=null)activeAvg=_dlFull.m.activeAvg;else if(_dlFull.m.calendarAvg!=null)activeAvg=_dlFull.m.calendarAvg;}
      if(smartDaily==null&&v.da!=null)smartDaily=v.da;
    }
    const c=_zClassify(d,stock,smartDaily,activeAvg,true);
    if(!c)return;
    // Inactive tovarlar uchun oxirgi sotuv (di) Jan 1 dan (lsd) hisoblanadi:
    // - muzlagan (stok bor): lsd bo'lsa oxirgi sotuv kuni, bo'lmasa hech sotilmagan
    // - yoq (stok yo'q): lsd bo'lsa "eskirgan" ga o'tadi, bo'lmasa "yoq" qoladi
    if(c.signal==="muzlagan"){
      c.di=v.lsd?_daysSince(v.lsd):999;
    }else if(c.signal==="yoq"&&v.lsd){
      const _di=_daysSince(v.lsd);
      c.signal="eskirgan";c.di=_di;
      c.reasonKey="reason_last_sold_days_ago_no_stock";c.reasonN=_di;
    }
    // narxlar: sp = kelish narxi (supply), rp = sotilish narxi (retail)
    const _sp=parseFloat(v.suprice||0)||0;
    const _rp=parseFloat(v.iprice||v.p||0)||0;
    const _frozenVal=stock>0?Math.round(stock*(_sp||_rp)):0;
    ZITEMS.push({_zi:ZITEMS.length,name:v.name,sku:v.sku||"",bc:v.bc||[],abc:v.abc||"",zabc:v.zabc||"",cat:v.cat||"",catTop:v.catTop||"",sup:v.sup||"",itype:v.itype||"",sub:v.sub||"",rev:v.rev||0,kg:v.kg||false,price:_sp||_rp,sp:_sp,rp:_rp,rcost:v.rcost||0,rcostApprox:!!v.rcostApprox,frozenVal:_frozenVal,ld:v.ld||null,lsd:v.ld||null,pav:v.pav||0,la:v.la||null,calcStock:v.calcStock!=null?v.calcStock:null,calcConf:v.calcConf||null,calcEvidence:v.calcEvidence!=null?v.calcEvidence:null,calcAnchor:v.calcAnchor||null,calcRule:v.calcRule||null,lkQty:v.lkQty!=null?v.lkQty:null,lkSold:v.lkSold!=null?v.lkSold:null,lkDate:v.lkDate||null,ovEffective:v.ovEffective!=null?v.ovEffective:null,...c});
  });
  if(INVDATA){
    const p2skus=new Set(P2.filter(v=>v.sku).map(v=>String(v.sku)));
    const p2norms=new Set(P2.map(v=>nn2(v.name)));
    const _endRef=(DMETAFULL&&DMETAFULL.end)?new Date(DMETAFULL.end):new Date();
    Object.entries(INVDATA).forEach(([key,iv])=>{
      if(iv.sku&&p2skus.has(String(iv.sku)))return;
      if(p2norms.has(key))return;
      const stock=parseFloat(iv.a||0);
      const sp=parseFloat(iv.sp||0),rp=parseFloat(iv.p||0);
      const price=sp||rp;const frozenVal=stock>0?Math.round(stock*price):0;
      const la=iv.la||null;
      if(stock>0&&iv.ld60){
        // So'nggi 30 kunda emas, lekin 60 kunlik oynada sotilgan — "aktiv" tarafda, sekinlashgan
        const di60=Math.max(0,Math.round((_endRef-new Date(iv.ld60))/86400000));
        ZITEMS.push({_zi:ZITEMS.length,name:key,sku:iv.sku||"",bc:iv.bc||[],abc:"",zabc:iv.zabc||"",cat:iv.catTop||iv.cat||"",catTop:iv.catTop||iv.cat||"",sup:iv.su||"",itype:iv.t||"",sub:iv.sb||"",rev:0,signal:"sekin",reasonKey:"reason_slow_recent",reasonN:di60,di:di60,dailyAvg:0,daysLeft:null,stock,wasGoodSeller:false,histRatio:0,frozenVal,price,sp,rp,rcost:iv.rcost||0,rcostApprox:!!iv.rcost_approx,la,calcStock:iv.calcStock!=null?iv.calcStock:null,calcConf:iv.calcConf||null,calcEvidence:iv.calcEvidence!=null?iv.calcEvidence:null,calcAnchor:iv.calcAnchor||null,calcRule:iv.calcRule||null,lkQty:iv.lkQty!=null?iv.lkQty:null,lkSold:iv.lkSold!=null?iv.lkSold:null,lkDate:iv.lkDate||null,ovEffective:iv.ovEffective!=null?iv.ovEffective:null});
        return;
      }
      // stok bor → muzlagan; stok yo'q + avval sotilgan → eskirgan; stok yo'q + hech sotilmagan → yoq
      let _sig,_rk,_rn=null,_di=999;
      const _lsdDi=iv.lsd?Math.max(0,Math.round((_endRef-new Date(iv.lsd))/86400000)):999;
      if(stock>0){_sig="muzlagan";_di=_lsdDi;if(iv.lsd){_rk="reason_last_sold_days_ago";_rn=_lsdDi;}else{_rk="reason_no_sale_history";}}
      else if(iv.lsd){_di=_lsdDi;_sig="eskirgan";_rk="reason_last_sold_days_ago_no_stock";_rn=_di;}
      else{_sig="yoq";_rk="reason_no_stock_jan1";}
      ZITEMS.push({_zi:ZITEMS.length,name:key,sku:iv.sku||"",bc:iv.bc||[],abc:"",zabc:iv.zabc||"",cat:iv.catTop||iv.cat||"",catTop:iv.catTop||iv.cat||"",sup:iv.su||"",itype:iv.t||"",sub:iv.sb||"",rev:0,signal:_sig,reasonKey:_rk,reasonN:_rn,di:_di,dailyAvg:0,daysLeft:null,stock,wasGoodSeller:false,histRatio:0,frozenVal,price,sp,rp,rcost:iv.rcost||0,rcostApprox:!!iv.rcost_approx,la,lsd:iv.lsd||null,pav:iv.pav||0,calcStock:iv.calcStock!=null?iv.calcStock:null,calcConf:iv.calcConf||null,calcEvidence:iv.calcEvidence!=null?iv.calcEvidence:null,calcAnchor:iv.calcAnchor||null,calcRule:iv.calcRule||null,lkQty:iv.lkQty!=null?iv.lkQty:null,lkSold:iv.lkSold!=null?iv.lkSold:null,lkDate:iv.lkDate||null,ovEffective:iv.ovEffective!=null?iv.ovEffective:null});
    });
  }
  // Muzlagan kapital summasi — barcha muzlagan (stok bor, sotuv yo'q) ZITEMS'dan
  const mzCap=ZITEMS.filter(v=>v.signal==="muzlagan").reduce((a,v)=>a+(v.frozenVal||0),0);
  const fvEl=document.getElementById("z-frozen-val");if(fvEl)fvEl.textContent=Math.round(mzCap).toLocaleString();
  const fvBnr=document.getElementById("z-mz-total");if(fvBnr)fvBnr.textContent=Math.round(mzCap).toLocaleString()+" so'm";
  const fvBnr2=document.getElementById("z-mz-total2");if(fvBnr2)fvBnr2.textContent=Math.round(mzCap).toLocaleString()+" so'm";
  const cnt={kritik:0,tekshir:0,urgent:0,excess:0,normal:0,sekin:0,muzlagan:0,eskirgan:0,yoq:0};
  ZITEMS.forEach(v=>{if(cnt[v.signal]!==undefined)cnt[v.signal]++;});
  const s=(id,n)=>{const el=document.getElementById(id);if(el)el.textContent=n.toLocaleString();};
  s("z-n-kritik",cnt.kritik);s("z-n-tekshir",cnt.tekshir);s("z-n-urgent",cnt.urgent);s("z-n-excess",cnt.excess);s("z-n-normal",cnt.normal);s("z-n-sekin",cnt.sekin);s("z-n-muzlagan",cnt.muzlagan);s("z-n-eskirgan",cnt.eskirgan);s("z-n-yoq",cnt.yoq);s("z-n-noaktiv-all",cnt.muzlagan+cnt.eskirgan+cnt.yoq);
  const bnr=document.getElementById("z-mz-cnt");if(bnr)bnr.textContent=cnt.muzlagan.toLocaleString();
  const ntab=document.getElementById("z-noaktiv-cnt");if(ntab)ntab.textContent="("+(cnt.muzlagan+cnt.eskirgan+cnt.yoq).toLocaleString()+")";
  zFilled=false;zFillSelects();
}
function zSuperTab(tab){
  zFilter(tab==="noaktiv"?"noaktiv_all":"all");
}
function zFilter(f){
  zCurFilter=f;
  zPage=1;
  zSort={key:null,dir:1};
  const wantTab=(f==="muzlagan"||f==="eskirgan"||f==="yoq"||f==="noaktiv_all")?"noaktiv":"aktiv";
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
// 2026-08-12: og'ir qism (renderZaxira) faqat Enter bosilganda - har harfda
// minglab qatorni qayta chizish "qotish"dek sezilar edi.
function zSearchInput(){
  const inp=document.getElementById("z-q");
  const cl=document.getElementById("z-clear");if(cl)cl.classList.toggle("show",!!(inp&&inp.value));
}
function zSearchSubmit(){
  const inp=document.getElementById("z-q");
  zQuery=(inp?inp.value:"").toLowerCase().trim();
  zPage=1;
  const cl=document.getElementById("z-clear");if(cl)cl.classList.toggle("show",zQuery.length>0);
  renderZaxira();
}
const ZF_FIELDS=["cat","sup","itype","abc","stock","kirimkun","sotuvkun"];
const ZF_FIELD_LABEL={cat:"filt_cat",sup:"filt_sup",itype:"filt_type",abc:"filt_abc",stock:"filt_stock",kirimkun:"filt_kirimkun",sotuvkun:"filt_sotuvkun"};
const ZF_NUMERIC=new Set(["stock","kirimkun","sotuvkun"]);
let ZF_OPTIONS={cat:[],sup:[],itype:[]};
function zFillSelects(){
  if(zFilled||!ZITEMS)return;
  const uniq=key=>[...new Set(ZITEMS.map(v=>v[key]).filter(x=>x))].sort((a,b)=>String(a).localeCompare(String(b),"ru"));
  ZF_OPTIONS={cat:uniq("cat"),sup:uniq("sup"),itype:uniq("itype")};
  zFilled=true;
}
function zFToggle(e){if(e)e.stopPropagation();const p=document.getElementById("z-fpop");if(p)p.classList.toggle("open");}
function _zfSelectOptions(field){
  if(field==="abc")return [["A",t("abc_a_opt")],["B",t("abc_b_opt")],["C",t("abc_c_opt")]];
  return (ZF_OPTIONS[field]||[]).map(o=>[o,o]);
}
function zfAddRow(){
  zFilters.push({field:"",op:"=",value:""});
  zfRenderRows();
}
function zfRemoveRow(i){
  zFilters.splice(i,1);
  zfRenderRows();
}
function zfRowFieldChanged(i,newField){
  if(!zFilters[i])return;
  zFilters[i]={field:newField,op:(ZF_NUMERIC.has(newField)?">":"="),value:""};
  zfRenderRows();
}
function zfRowOpChanged(i,newOp){
  if(!zFilters[i])return;
  zFilters[i].op=newOp;
  if(newOp==="never")zFilters[i].value="never";
  else if(zFilters[i].value==="never")zFilters[i].value="";
  zfRenderRows();
}
function zfRowValChanged(i,newVal){
  if(zFilters[i])zFilters[i].value=newVal;
  zfUpdateBadge();
}
function zfApplyFilters(){
  zPage=1;
  renderZaxira();
  const p=document.getElementById("z-fpop");if(p)p.classList.remove("open");
}
function zfUpdateBadge(){
  const n=zFilters.filter(r=>r.value!==""&&r.value!=null).length;
  const b=document.getElementById("z-fcount");if(b)b.textContent=n?"("+n+")":"";
  const btn=document.getElementById("z-fbtn");if(btn)btn.classList.toggle("has",n>0);
}
const ZF_SHORT_LABEL={cat:"zf_short_cat",sup:"zf_short_sup",itype:"zf_short_itype",abc:"zf_short_abc",stock:"zf_short_stock",kirimkun:"zf_short_kirimkun",sotuvkun:"zf_short_sotuvkun"};
function _zfDescribeFilters(){
  const parts=zFilters.filter(row=>row.field&&row.value!==""&&row.value!=null).map(row=>{
    const label=t(ZF_SHORT_LABEL[row.field]||row.field);
    if(row.op==="never")return `${label}: ${t("zf_op_never")}`;
    if(ZF_NUMERIC.has(row.field))return `${label} ${row.op} ${row.value}`;
    return `${label}: ${row.value}`;
  });
  return parts.join(", ");
}
function zfRenderRows(){
  const wrap=document.getElementById("zf-rows");
  if(!wrap)return;
  wrap.innerHTML=zFilters.map((row,i)=>{
    const fieldOpts=`<option value="" ${row.field?"":"selected"}>${esc(t("zf_select_field"))}</option>`
      +ZF_FIELDS.map(f=>`<option value="${f}" ${f===row.field?"selected":""}>${esc(t(ZF_FIELD_LABEL[f]))}</option>`).join("");
    let ctrl;
    if(!row.field){
      ctrl="";
    }else if(ZF_NUMERIC.has(row.field)){
      const isDateField=row.field==="kirimkun"||row.field==="sotuvkun";
      const opList=[[">","zf_op_gt"],["<","zf_op_lt"],["=","zf_op_eq"]];
      if(isDateField)opList.push(["never","zf_op_never"]);
      const opOptions=opList.map(([v,k])=>`<option value="${v}" ${v===row.op?"selected":""}>${esc(t(k))}</option>`).join("");
      const isNever=row.op==="never";
      const val=(row.value!==""&&row.value!=null&&!isNever)?row.value:"";
      const unit=(isDateField&&!isNever)?`<span class="zf-unit">${esc(t("zf_unit_kun"))}</span>`:"";
      ctrl=`<select class="zf-op" onchange="zfRowOpChanged(${i},this.value)">${opOptions}</select>`
        +(isNever?"":`<input class="zf-val-num" type="number" min="0" placeholder="0" value="${esc(val)}" oninput="zfRowValChanged(${i},this.value)" onwheel="this.blur()">`)
        +unit;
    }else{
      const opts=_zfSelectOptions(row.field);
      const selHtml=`<select class="zf-val" id="zf-val-${i}" onchange="zfRowValChanged(${i},this.value)"><option value="">${esc(t("filt_all"))}</option>`
        +opts.map(([v,l])=>`<option value="${esc(v)}" ${v===row.value?"selected":""}>${esc(l)}</option>`).join("")
        +`</select>`;
      // cat/sup uzun ro'yxatli (yuzlab variant) - qidiruvli tanlov bilan; itype/abc qisqa, oddiy select yetarli
      ctrl=(row.field==="cat"||row.field==="sup")
        ?`<div class="ssel zf-val-wrap">${selHtml}<input type="text" class="ssel-inp" id="zf-val-${i}-inp" autocomplete="off"><svg class="ssel-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg><div class="ssel-menu" id="zf-val-${i}-menu"></div></div>`
        :selHtml;
    }
    return `<div class="zf-row">`
      +`<select class="zf-field" onchange="zfRowFieldChanged(${i},this.value)">${fieldOpts}</select>`
      +ctrl
      +`<button type="button" class="zf-del" onclick="zfRemoveRow(${i})">&#10005;</button>`
      +`</div>`;
  }).join("");
  zFilters.forEach((row,i)=>{if(row.field==="cat"||row.field==="sup")sselAttach("zf-val-"+i);});
  zfUpdateBadge();
}
function _zfRefDate(){return (DMETAFULL&&DMETAFULL.end)?new Date(DMETAFULL.end):new Date();}
// P2'dan kelgan tovarlarda "la" (oxirgi kirim) maydoni backendda umuman yo'q (faqat
// INVDATA-fallback tovarlarda bor) - shuning uchun P8 (data_kirim.json, yuklangan bo'lsa)
// dan sku bo'yicha qidirib, ko'proq tovar uchun haqiqiy sanani topamiz.
function _zfLastArrivalDate(v){
  if(v.la)return v.la;
  if(typeof P8!=="undefined"&&P8&&P8.skus&&v.sku){
    const e=P8.skus[String(v.sku)];
    if(e&&e.last_date)return e.last_date;
  }
  return null;
}
// "lsd"/"ld" (backend hisoblagan oxirgi sotuv) faqat yaqinda sotilgan tovarlarda bor -
// nofaol tovarlarda (aynan shu filtr eng ko'p kerak bo'ladigan joyda) deyarli doim bo'sh.
// Shuning uchun HIST (data_history.json, yuklangan bo'lsa) dan sku bo'yicha kunlik sotuv
// massividan orqaga qarab qidirib, haqiqiy oxirgi sotuv sanasini topamiz - bu ancha
// to'liqroq (butun tarix bo'yicha), backend maydoniga qaraganda.
function _zfLastSaleDate(v){
  if(typeof HIST!=="undefined"&&HIST&&HISTMETA&&v.sku){
    const dArr=HIST.d["sku:"+v.sku];
    if(dArr){
      for(let i=dArr.length-1;i>=0;i--){
        if(dArr[i]){
          const d=new Date(HISTMETA.base+"T00:00:00Z");
          d.setUTCDate(d.getUTCDate()+i);
          return d.toISOString().slice(0,10);
        }
      }
    }
  }
  return v.lsd||null;
}
function _zfActualValue(v,field){
  switch(field){
    case "stock":return v.stock||0;
    case "kirimkun":{const d=_zfLastArrivalDate(v);return d?Math.floor((_zfRefDate()-new Date(d))/86400000):Infinity;}
    case "sotuvkun":return (v.di>=900)?Infinity:v.di;
    default:return null;
  }
}
function _zfRowMatch(v,row){
  if(row.op==="never")return _zfActualValue(v,row.field)===Infinity;
  if(row.value===""||row.value==null)return true;
  if(ZF_NUMERIC.has(row.field)){
    const num=parseFloat(row.value);
    if(isNaN(num))return true;
    const actual=_zfActualValue(v,row.field);
    switch(row.op){
      case ">":return actual>num;
      case ">=":return actual>=num;
      case "<":return actual<num;
      case "<=":return actual<=num;
      case "=":return actual===num;
      default:return true;
    }
  }
  return String(v[row.field]||"")===String(row.value);
}
function zItemsMatchFilters(v){
  for(let i=0;i<zFilters.length;i++){if(!_zfRowMatch(v,zFilters[i]))return false;}
  return true;
}
function zFClearAll(){
  zFilters=[];
  zPage=1;
  zfRenderRows();
  renderZaxira();
}
function zClear(){
  const inp=document.getElementById("z-q");if(inp)inp.value="";
  zQuery="";
  zPage=1;
  const cl=document.getElementById("z-clear");if(cl)cl.classList.remove("show");
  renderZaxira();
}
// Ekranda ko'rsatilayotgan (super-tab + karta/signal + qidiruv + dinamik filtrlar)
// ro'yxatini hisoblaydi - renderZaxira() va eksport bir xil natijani ko'rsatishi uchun
// ikkalasi ham shu funksiyadan foydalanadi.
function _zVisibleItems(){
  if(!ZITEMS)return[];
  let items;
  if(zCurFilter==="all")items=ZITEMS.filter(v=>v.signal!=="muzlagan"&&v.signal!=="eskirgan"&&v.signal!=="yoq");
  else if(zCurFilter==="noaktiv_all")items=ZITEMS.filter(v=>v.signal==="muzlagan"||v.signal==="eskirgan"||v.signal==="yoq");
  else items=ZITEMS.filter(v=>v.signal===zCurFilter);
  if(zQuery)items=items.filter(v=>_matchNSB(v,zQuery));
  if(zFilters.length)items=items.filter(zItemsMatchFilters);
  return items;
}
function renderZaxira(){
  if(!ZITEMS)return;
  let items=_zVisibleItems();
  const ord={kritik:0,urgent:1,tekshir:2,excess:3,normal:4,sekin:5,muzlagan:6,eskirgan:7,yoq:8};
  const _frozenView=zCurFilter==="muzlagan"||zCurFilter==="sekin"||zCurFilter==="eskirgan"||zCurFilter==="yoq";
  if(zSort.key){
    // Foydalanuvchi ustunga bosgan — o'sha ustun bo'yicha saralaymiz
    const k=zSort.key,dir=zSort.dir;
    const gv=v=>{switch(k){
      case "name":return (v.name||"").toLowerCase();
      case "abc":return v.abc||"~";
      case "stock":return v.stock||0;
      case "c5":return _frozenView?(v.sp||0):(v.dailyAvg||0);
      case "c6":return _frozenView?(v.rp||0):(v.daysLeft==null?1e9:v.daysLeft);
      case "di":return v.di||0;
      case "la":return v.la||"";
      default:return 0;
    }};
    items.sort((a,b)=>{const av=gv(a),bv=gv(b);if(typeof av==="string")return dir*av.localeCompare(bv,"ru");return dir*(av-bv);});
  }else{
    items.sort((a,b)=>{
      if(ord[a.signal]!==ord[b.signal])return ord[a.signal]-ord[b.signal];
      if(a.signal==="eskirgan")return (a.di||0)-(b.di||0);
      if(a.signal==="muzlagan"||a.signal==="sekin"||a.signal==="yoq")return (b.frozenVal||0)-(a.frozenVal||0)||(b.di||0)-(a.di||0);
      // Ortiqcha: eng uzun muddatli (eng ko'p stok) birinchi; qolganlar: eng qisqa muddatli birinchi
      if(a.daysLeft!=null&&b.daysLeft!=null)return a.signal==="excess"?b.daysLeft-a.daysLeft:a.daysLeft-b.daysLeft;
      return (b.di||0)-(a.di||0);
    });
  }
  const el=document.getElementById("z-cnt");if(el)el.textContent=items.length.toLocaleString()+" ta mahsulot";
  const thAvg=document.getElementById("z-th-c5");if(thAvg)thAvg.textContent=_frozenView?t("z_th_kelish"):t("z_th_kunlik");
  const thDays=document.getElementById("z-th-c6");if(thDays)thDays.textContent=_frozenView?t("z_th_sotilish"):t("z_th_yetadi");
  // Saralash strelkasini ustun sarlavhalariga qo'yamiz
  document.querySelectorAll(".z-tbl thead th").forEach(th=>{th.classList.remove("z-sort-asc","z-sort-desc");if(zSort.key&&th.dataset.sortkey===zSort.key)th.classList.add(zSort.dir>0?"z-sort-asc":"z-sort-desc");});
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
    const _isFrozen=v.signal==="muzlagan"||v.signal==="sekin"||v.signal==="eskirgan"||v.signal==="yoq";
    if(_isFrozen){
      // frozen ko'rinishda 6-ustun = sotilish narxi (rp)
      const rp=v.rp||0;
      barHtml=rp>0?`<div style="color:#1D9E75;font-weight:600;font-size:13px">${rp.toLocaleString()} so'm</div>`:`<span style="color:#bbb">—</span>`;
    }else if(v.stock===0||v.daysLeft===0){
      barHtml=`<div class="z-bar-wrap"><div class="z-bar z-bar-red"><div class="z-bar-fill" style="width:100%"></div></div><span class="z-bar-days" style="color:#E24B4A">${t("z_val_tugagan")}</span></div>`;
    }else if(v.stock<0){
      barHtml=`<div class="z-bar-wrap"><div class="z-bar" style="background:#ece9f8"><div class="z-bar-fill" style="width:100%;background:#8B7FD1"></div></div><span class="z-bar-days" style="color:#534AB7">${t("z_val_nomalum")}</span></div>`;
    }else if(v.daysLeft!==null){
      const pct=Math.min(100,Math.round(v.daysLeft/MAX_DAYS*100));
      const cls=v.daysLeft<=7?"z-bar-red":v.daysLeft<=14?"z-bar-orange":v.daysLeft<=30?"z-bar-yellow":"z-bar-green";
      const dc=v.daysLeft<=7?"#E24B4A":v.daysLeft<=14?"#EF9F27":v.daysLeft<=30?"#d4a017":"#1D9E75";
      const _df=d=>d>=365?+(d/365).toFixed(1)+" "+t("z_unit_yil"):d>=30?+(d/30).toFixed(1)+" "+t("z_unit_oy"):d+" "+t("in_kun");
      barHtml=`<div class="z-bar-wrap"><div class="z-bar ${cls}"><div class="z-bar-fill" style="width:${pct}%"></div></div><span class="z-bar-days" style="color:${dc}">${_df(v.daysLeft)}</span></div>`;
    }else{
      barHtml=`<span style="color:#bbb">—</span>`;
    }
    const diTxt=v.signal==="muzlagan"?(v.di>=900?t("z_never_sold"):v.di+" "+t("z_sold_days_ago")):v.signal==="yoq"?t("z_never_sold"):v.signal==="eskirgan"?(v.di+" "+t("z_sold_days_ago")):v.signal==="sekin"?(v.di+" "+t("z_sold_days_ago")):v.di>=900?t("z_not_sold"):v.di===0?t("dt_today"):v.di+" "+t("kun_oldin");
    const diColor=v.signal==="muzlagan"?"#7C3AED":v.signal==="yoq"?"#94A3B8":v.signal==="eskirgan"?"#D97706":v.signal==="sekin"?"#0E7490":v.di>=30?"#E24B4A":v.di>=14?"#EF9F27":"#555";
    // frozen ko'rinishda 5-ustun = kelish narxi (sp); aks holda kunlik o'rtacha
    const dailyTxt=_isFrozen?(v.sp?(v.sp.toLocaleString()+" so'm"):"—"):v.dailyAvg>0?(v.dailyAvg>=1?(Math.round(v.dailyAvg*10)/10):v.dailyAvg)+" "+t("z_unit_ta_kun"):"—";
    const _sel=v._zi===zLastZi;
    const laTxt=v.la?krFmtDate(v.la):`<span style="color:#bbb">—</span>`;
    h+=`<tr class="z-row${_sel?" z-row-sel":""}"${_sel?' id="z-sel-row"':""} ondblclick="zToProduct(${v._zi})" title="Ikki marta bosing — mahsulot tahliliga o'tish"><td style="color:#bbb;font-size:11px">${rowOffset+i+1}</td><td><div class="z-name" title="${esc(v.name)}">${esc(v.name)}</div><div class="z-reason">${v.sku?`<span class="z-sku">${esc(v.sku)}</span>`:""}${esc(_zReasonTxt(v))}</div></td><td>${abcBadge}</td><td style="font-weight:600">${stockTxt}</td><td style="color:#888">${dailyTxt}</td><td>${barHtml}</td><td style="color:${diColor};font-size:12px">${diTxt}</td><td style="font-size:12px;color:#555">${laTxt}</td></tr>`;
  });
  if(!h)h=`<tr><td colspan="8" style="text-align:center;padding:40px;color:#bbb">${zQuery?'"'+esc(zQuery)+'" '+t("z_topilmadi"):t("z_malumot_yoq")}</td></tr>`;
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
// ─── UMUMIY YORDAMCHI FUNKSIYALAR (fmt, esc) — barcha sahifalarda ishlatiladi ───
function fmt(n){if(n>=1e9)return(n/1e9).toFixed(2)+" mlrd";if(n>=1e6)return(n/1e6).toFixed(1)+" mln";if(n>=1e3)return Math.round(n/1e3)+" ming";return Math.round(n)+"";}
function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
// ─── P1: RENDER (Bosh sahifa ko'rsatish — renderP1()) ───
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
setT("kpi-refund",Math.round(P1.refund||0).toLocaleString());
setT("kpi-refund-s",t("kpi_refund_s_suffix")+" ("+(P1.refund_pct||0)+"%)");
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
const tiMax=ti.length?(ti[0].val||1):1;
setH("p1-top-items",ti.map((it,i)=>'<div class="rank-row"><div class="rank-bar" style="width:'+Math.max(2,Math.round((it.val||0)/tiMax*100))+'%"></div><div class="rank-n'+(i===0?" top":"")+'">'+(i+1)+'</div><div class="rank-name">'+esc(it.name)+'<span class="rank-sub"> · '+_kelish+': '+fmt(it.cost||0)+' · '+_foyda+': '+fmt(it.profit||0)+'</span></div><div class="rank-val">'+fmt(it.val)+'</div></div>').join(""));
const tp=P1.top_items_profit||[];
const tpMax=tp.length?(tp[0].val||1):1;
setH("p1-top-emp",tp.map((it,i)=>'<div class="rank-row"><div class="rank-bar" style="width:'+Math.max(2,Math.round((it.val||0)/tpMax*100))+'%"></div><div class="rank-n'+(i===0?" top":"")+'">'+(i+1)+'</div><div class="rank-name">'+esc(it.name)+'<span class="rank-sub"> · '+_tushum+': '+fmt(it.rev||0)+' · '+_kelish+': '+fmt(it.cost||0)+'</span></div><div class="rank-val">'+fmt(it.val)+'</div></div>').join(""));
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
function extractBuiltAt(html){
  const m=String(html||"").match(/"builtAt"\s*:\s*"([^"]+)"/);
  return m?m[1]:"";
}
// 2026-08-15 (Bilol talabi): yangi build (pipeline commit'i, kuniga 2 marta,
// yoki har qanday kod push'i, masalan faqat .github/workflows o'zgarishi)
// chiqqanda sahifa ILGARI TO'LIQ QAYTA YUKLANARDI — foydalanuvchi kutmagan
// holda "Yuklanmoqda..." ko'rar, joriy scroll/filtr/holat yo'qolar edi.
// Endi HECH QACHON QAYTA YUKLANMAYDI: har bo'lim o'z ALOHIDA JSON faylidan
// (data_daily.json emas — p1data HTML ichida, p2/p3 esa data_mahsulotlar.json/
// data_abc.json'da, chunki `backend_html_embed.py` ularni HTML hajmini
// kichraytirish uchun ATAYLAB bo'sh qoldiradi — tekshirilgan) jimgina qayta
// olinadi va — FAQAT o'sha sahifa hozir ochiq bo'lsa — qayta chiziladi.
// Boshqa sahifalar (P4/P6/P9/P10/P11) hozircha shu yo'lda emas — ularning
// keshi bo'shatiladi, keyingi tabiiy o'tishda o'zi yangi ma'lumot oladi
// (mavjud fetch-zaxira orqali, allaqachon bor).
// 2026-08-15: XATO TUZATILDI — bu funksiya `check()`dan `await`SIZ
// chaqirilardi, ya'ni bir necha marta ustma-ust (ayniqsa bugungi kabi
// tez-tez push ketganda) BIR VAQTDA ishga tushishi mumkin edi — har
// birida 12-13 MB fayl yuklab, sinxron JSON.parse qilib, sahifani
// SEZILARLI sekinlashtirardi ("juda asta ishlayapti" shikoyati shundan).
// Endi: (1) bir vaqtda faqat BITTASI ishlaydi (`_quietRefreshBusy`),
// (2) ketma-ket juda tez-tez ishlamasligi uchun eng kami 2 daqiqa oraliq,
// (3) P1 uchun BUTUN 13 MB sahifa faqat foydalanuvchi HOZIR aynan Bosh
// sahifada bo'lsa yuklanadi (aks holda foydasiz tarmoq/CPU bosimi).
let _quietRefreshBusy=false,_lastQuietRefresh=0;
async function _quietBuildRefresh(){
  if(_quietRefreshBusy)return;
  const now=Date.now();
  if(now-_lastQuietRefresh<120000)return;   // 2 daqiqadan tez-tez emas
  _quietRefreshBusy=true;_lastQuietRefresh=now;
  try{
    // p1data — faqat HTML ichida (alohida fayli yo'q). Foydasiz 13 MB
    // yuklamaslik uchun faqat aynan shu sahifa ochiq bo'lsa so'raladi.
    if(curPageId==="p1"){
      try{
        const url=new URL(window.location.href);
        url.searchParams.set("_bg",Date.now().toString());
        const res=await fetch(url.toString(),{cache:"no-store"});
        const html=await res.text();
        const m=html.match(/<script id="p1data"[^>]*>([\s\S]*?)<\/script>/);
        if(m){const v=JSON.parse(m[1]);if(v&&v.daily&&v.daily.length){P1=v;P1FULL=v;renderP1();}}
      }catch(e){/* jim - keyingi urinishda qayta */}
    }
    if(P2){                       // faqat allaqachon ochilgan bo'lsa yangilanadi
      try{
        const r=await fetch("data_mahsulotlar.json?_bg="+Date.now(),{cache:"no-store"});
        const v=await r.json();
        if(v&&v.length){P2=v;_p2BcMap=null;if(curPageId==="p2")p2Filter();}
      }catch(e){}
    }
    if(P3){
      try{
        const r=await fetch("data_abc.json?_bg="+Date.now(),{cache:"no-store"});
        const v=await r.json();
        if(v&&v.length){P3=v;if(curPageId==="p3")initP3();}
      }catch(e){}
    }
    // P4/P6/P8/P9/P10/P11: soddalik uchun keshini bo'shatamiz — mavjud
    // "ensure"/fetch-zaxira funksiyalari keyingi tabiiy o'tishda o'zi
    // yangi ma'lumotni oladi (reload shart emas).
    P4=null;P6=null;
  }finally{_quietRefreshBusy=false;}
}
function startFreshBuildWatcher(){
  if(!window.fetch||window.__tiinBuildWatcher)return;
  window.__tiinBuildWatcher=true;
  // Faqat HEAD so'rovi (Last-Modified) bilan tekshiramiz - to'liq sahifani
  // har 5 daqiqada yuklamaslik uchun (u faqat HAQIQATAN o'zgargandagina
  // GET qilinadi, quyida).
  let baseLM=null,checking=false;
  const headLM=async()=>{
    const url=new URL(window.location.href);
    url.searchParams.set("_check",Date.now().toString());
    const res=await fetch(url.toString(),{method:"HEAD",cache:"no-store"});
    return res.headers.get("last-modified")||"";
  };
  const check=async()=>{
    if(checking)return;
    checking=true;
    try{
      const lm=await headLM();
      if(lm){
        // Birinchi muvaffaqiyatli tekshiruv - hozirgi holatni bazaviy qiymat
        // sifatida belgilaydi (solishtirmaydi), keyingisidan boshlab solishtiradi.
        if(baseLM===null){baseLM=lm;}
        else if(lm!==baseLM){
          baseLM=lm;
          // Supplier zakasi ustida ishlayotgan bo'lsa — hozir umuman
          // tegilmaydi (ekrandagi sonlar joyida qoladi). Kutib turgan
          // yangilanish `zkBackToList()`da qo'llanadi (_bgSilentRefresh
          // bilan bir xil `_pendingBg` mexanizmi FOYDALANMAYDI — bu yerda
          // statik bloklar, alohida; shuning uchun oddiy sharti yetarli:
          // oyna ochiq bo'lsa, keyingi tekshiruv (5 daqiqadan keyin)da
          // baribir qayta urinadi, chunki `baseLM` allaqachon yangilangan
          // bo'lsa-da, statik ma'lumot ALIB QO'YILMAGAN).
          if(typeof _zkEditingSupplier==="function"&&_zkEditingSupplier())_pendingStaticRefresh=true;
          else await _quietBuildRefresh();
        }
      }
    }catch(_){}
    checking=false;
  };
  setTimeout(check,30000);
  setInterval(check,5*60*1000);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)check();});
}
let _pendingStaticRefresh=false;
document.querySelectorAll(".lang-btn").forEach(b=>b.classList.toggle("active",b.dataset.lang===LANG));
applyI18n();
renderP1();
startFreshBuildWatcher();
// Buyurtma/Poставщики/Приход/Обороты bo'limlariga tez kira olish uchun ularning
// umumiy og'ir ma'lumotini (data_kirim.json, data_history.json, stock snapshot)
// fon rejimida, brauzer bo'sh vaqtida oldindan yuklab/hisoblab qo'yamiz - shu
// bo'limlarga birinchi marta kirganda bo'sh/kutish holati ko'rinmasin.
(function _prefetchHeavyTabs(){
  const run=()=>{
    if(typeof oaEnsureData!=="function")return;
    oaEnsureData().then(()=>{
      if(OA_BY_SKU&&typeof oaCompute==="function")oaCompute();
    }).catch(()=>{});
  };
  if(window.requestIdleCallback)requestIdleCallback(run,{timeout:4000});
  else setTimeout(run,2500);
})();
curPageId="p1";if(P1FULL&&P1FULL.days>1)_applyPageRange("p1");  // har bo'lim o'z standart oralig'i: Bosh sahifa 7 kun, qolganlari 30 kun
(function(){
  // Build watcher qayta yuklagan bo'lsa YOKI foydalanuvchi shunchaki F5 bossa ham,
  // avvalgi turgan bo'limini tiklaymiz (showPage() har navigatsiyada shu qiymatni
  // yangilab boradi, shuning uchun bu yerda o'chirilmaydi - ketma-ket F5 bosilsa ham ishlaydi).
  let _resumePage=null;
  try{_resumePage=sessionStorage.getItem("tiin_resume_page");}catch(_){}
  if(_resumePage&&_resumePage!=="p1"){
    const _rbtn=document.querySelector(`.sb-item[data-page="${_resumePage}"]`);
    if(_rbtn&&_rbtn.style.display!=="none")showPage(_rbtn);
  }
})();
// ── Sana oralig'i (date-range) ──
// Calendar picker state
// ─── SANA ORALIG'I (DATE RANGE) TANLAGICH — BARCHA SAHIFALAR UCHUN UMUMIY ───
let _calSel={from:null,to:null,hov:null,view:null};
const _CAL_M={uz:['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'],en:['January','February','March','April','May','June','July','August','September','October','November','December'],ru:['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']};
const _CAL_D={uz:['Ya','Du','Se','Ch','Pa','Ju','Sh'],en:['Su','Mo','Tu','We','Th','Fr','Sa'],ru:['Вс','Пн','Вт','Ср','Чт','Пт','Сб']};
function _calFmt(d){if(!d)return'';const[y,mo,day]=d.split('-');return day+' '+(_CAL_M[LANG]||_CAL_M.uz)[+mo-1]+' '+y;}
function _dtCalPrev(){let{y,m}=_calSel.view;m--;if(m<0){m=11;y--;}if(y<2026)return;_calSel.view={y,m};_dtCalRender();}
function _dtCalNext(){let{y,m}=_calSel.view;m++;if(m>11){m=0;y++;}const td=new Date();if(y>td.getFullYear()||(y===td.getFullYear()&&m>td.getMonth()))return;_calSel.view={y,m};_dtCalRender();}
function _dtCalClick(ev,ds){
  if(ev&&ev.stopPropagation)ev.stopPropagation();
  if(!_calSel.from||(_calSel.from&&_calSel.to)){
    _calSel.from=ds;_calSel.to=null;_calSel.hov=null;
  } else {
    if(ds<_calSel.from){_calSel.to=_calSel.from;_calSel.from=ds;}
    else _calSel.to=ds;
    _calSel.hov=null;
  }
  _dtCalPaint(); // faqat klasslarni yangilaymiz — DOM ajralmaydi, klik ishonchli bo'ladi
}
function _dtCalHov(ds){if(_calSel.from&&!_calSel.to){_calSel.hov=ds;_dtCalPaint();}}
// To'liq qayta qurish faqat oy o'zgarganda/ochilganda. Hover va klikda esa _dtCalPaint
// ishlaydi — mavjud DOM saqlanib, faqat CSS klasslar yangilanadi (katak ajralmaydi).
function _dtCalRender(){
  const cal=document.getElementById('dt-calendar');if(!cal||!_calSel.view)return;
  const{y,m}=_calSel.view;
  const mn=_CAL_M[LANG]||_CAL_M.uz,dn=_CAL_D[LANG]||_CAL_D.uz;
  const ml=document.getElementById('dt-cal-mlbl');if(ml)ml.textContent=mn[m]+' '+y;
  const todayS=new Date().toISOString().slice(0,10);
  const minD='2026-01-01';
  const firstDay=new Date(y,m,1).getDay(); // 0=Sun, Sunday-first
  const dim=new Date(y,m+1,0).getDate();
  const prevDim=new Date(y,m,0).getDate();
  let h='<div class="dt-cal-grid">';
  dn.forEach(d=>h+=`<div class="dt-cal-dh">${d}</div>`);
  // Oldingi oy overflow kunlari
  for(let i=firstDay-1;i>=0;i--){h+=`<div class="dt-cal-dc dt-cd-dis dt-cd-ov">${prevDim-i}</div>`;}
  // Joriy oy
  for(let d=1;d<=dim;d++){
    const ds=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dis=ds>todayS||ds<minD;
    if(dis){h+=`<div class="dt-cal-dc dt-cd-dis" data-ds="${ds}">${d}</div>`;}
    else{h+=`<div class="dt-cal-dc" data-ds="${ds}" onclick="_dtCalClick(event,'${ds}')" onmouseenter="_dtCalHov('${ds}')" onmouseleave="_dtCalHov(null)">${d}</div>`;}
  }
  // Keyingi oy overflow kunlari
  const used=firstDay+dim;const nextCells=(7-used%7)%7;
  for(let d=1;d<=nextCells;d++)h+=`<div class="dt-cal-dc dt-cd-dis dt-cd-ov">${d}</div>`;
  h+='</div>';cal.innerHTML=h;
  _dtCalPaint();
}
// Tanlov holatini (from/to/hover) mavjud katakchalarga klass sifatida bo'yaydi — DOM ni
// qayta qurmaydi, shuning uchun hover/klik paytida element ajralmaydi.
function _dtCalPaint(){
  const cal=document.getElementById('dt-calendar');if(!cal)return;
  const todayS=new Date().toISOString().slice(0,10);
  const fb=document.getElementById('dt-cal-from'),tb=document.getElementById('dt-cal-to');
  if(fb){fb.textContent=_calSel.from?_calFmt(_calSel.from):(t('dt_from')||'Boshlanish');fb.className='dt-cal-disp'+(_calSel.from?' dt-cs-set':'');}
  if(tb){tb.textContent=_calSel.to?_calFmt(_calSel.to):(t('dt_to')||'Tugash');tb.className='dt-cal-disp'+(_calSel.to?' dt-cs-set':'');}
  const fr=_calSel.from,to=_calSel.to,hv=_calSel.hov;
  cal.querySelectorAll('.dt-cal-dc[data-ds]').forEach(cell=>{
    const ds=cell.getAttribute('data-ds');
    cell.classList.remove('dt-cd-in','dt-cd-from','dt-cd-to','dt-cd-hov-e','dt-cd-today');
    if(ds===todayS)cell.classList.add('dt-cd-today');
    if(cell.classList.contains('dt-cd-dis'))return;
    let inR=false,isHovE=false;
    if(fr&&to){inR=ds>fr&&ds<to;}
    else if(fr&&!to&&hv){const lo=fr<hv?fr:hv,hi=fr<hv?hv:fr;inR=ds>lo&&ds<hi;isHovE=ds===hi&&ds!==fr;}
    if(inR)cell.classList.add('dt-cd-in');
    if(ds===fr)cell.classList.add('dt-cd-from');
    if(ds===to)cell.classList.add('dt-cd-to');
    if(isHovE)cell.classList.add('dt-cd-hov-e');
  });
}
function _dtCalOpen(){
  const td=new Date();
  if(!_calSel.view)_calSel.view={y:td.getFullYear(),m:td.getMonth()};
  if(!_calSel.from){
    const dates=P1FULL.dates||(DMETAFULL&&DMETAFULL.labels)||[];
    if(dates.length){_calSel.from=dates[GRA!=null?GRA:0]||dates[0];_calSel.to=dates[GRB!=null?Math.min(GRB,dates.length-1):dates.length-1]||dates[dates.length-1];}
  }
  _dtCalRender();
}
function dtCalApply(){
  window._p2PavSku=null;  // qo'lda vaqt o'zgartirildi — pav ko'rinishidan chiqamiz
  if(!_calSel.from)return;
  const from=_calSel.from,to=_calSel.to||_calSel.from;
  const si=document.getElementById('dt-start'),ei=document.getElementById('dt-end');
  if(si)si.value=from;if(ei)ei.value=to;
  const n=(P1FULL.dates||[]).length||P1FULL.days||60;
  let a=_dtIdx(from),b=_dtIdx(to);
  if(a<0)a=0;if(b<0)b=n-1;if(a>b){const tmp=a;a=b;b=tmp;}
  _dtApplyRange(a,b);
  if(curPageId==='p2')_histApplyRange(from,to);
  const p=document.getElementById('dt-pop');if(p)p.classList.remove('open');
}
function dtToggle(e){if(e)e.stopPropagation();const p=document.getElementById("dt-pop");if(p){p.classList.toggle("open");if(p.classList.contains("open"))_dtCalOpen();}}
document.addEventListener("click",function(e){const w=document.querySelector(".tb-dt");const p=document.getElementById("dt-pop");if(!w||!p)return;if(e.target&&e.target.isConnected===false)return;/*re-render'da ajralgan katak*/if(!w.contains(e.target))p.classList.remove("open");});
function _dtIdx(iso){return (P1FULL.dates||(DMETAFULL&&DMETAFULL.labels)||[]).indexOf(iso);}
function dtPreset(kind){
  window._p2PavSku=null;  // qo'lda vaqt o'zgartirildi — pav ko'rinishidan chiqamiz
  const td=new Date(),y=td.getFullYear(),mo=td.getMonth(),d=td.getDate();
  const fmt=dt=>`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
  const todayS=fmt(td);
  let fromS,toS=todayS;
  const _apply=(fs,ts)=>{
    _calSel.from=fs;_calSel.to=ts;
    const n=(P1FULL.dates||[]).length||P1FULL.days||60;
    let a=_dtIdx(fs),b=_dtIdx(ts);if(a<0)a=0;if(b<0)b=n-1;if(a>b){const tmp=a;a=b;b=tmp;}
    _dtApplyRange(a,b);
    if(curPageId==='p2')_histApplyRange(fs,ts);
    const p=document.getElementById('dt-pop');if(p)p.classList.remove('open');
  };
  if(kind==='today'){_apply(todayS,todayS);}
  else if(kind==='yesterday'){const yest=new Date(y,mo,d-1);const ys=fmt(yest);_apply(ys,ys);}
  else if(kind==='thisweek'){_apply(fmt(new Date(y,mo,d-((td.getDay()+6)%7))),todayS);}
  else if(kind==='lastweek'){_apply(fmt(new Date(y,mo,d-((td.getDay()+6)%7)-7)),fmt(new Date(y,mo,d-((td.getDay()+6)%7)-1)));}
  else if(kind==='thismonth'){_apply(`${y}-${String(mo+1).padStart(2,'0')}-01`,todayS);}
  else if(kind==='lastmonth'){const lm=mo===0?{y:y-1,m:12}:{y,m:mo};_apply(`${lm.y}-${String(lm.m).padStart(2,'0')}-01`,fmt(new Date(y,mo,0)));}
  else{const dates=P1FULL.dates||(DMETAFULL&&DMETAFULL.labels)||[];const n=dates.length||P1FULL.days||60;let a,b=n-1;if(kind==="all")a=0;else a=Math.max(0,n-(+kind));_dtApplyRange(a,b);_calSel.from=dates[a]||null;_calSel.to=dates[b]||null;if(curPageId==='p2'&&_calSel.from&&_calSel.to)_histApplyRange(_calSel.from,_calSel.to);const p=document.getElementById('dt-pop');if(p)p.classList.remove('open');}
}
function dtApply(){const s=document.getElementById("dt-start").value,e=document.getElementById("dt-end").value;if(s)dtCalApply();}
function _pageDefaultRange(pid){const n=P1FULL?P1FULL.days:0;const grp=PAGE_GROUP[pid]||pid;if(grp==="p3"){const months=_p3MonthsInWindow();if(months.length)return[months[months.length-1].from,months[months.length-1].to];}const days=PAGE_DEFAULT_DAYS[grp]||30;return [Math.max(0,n-days),n-1];}
function _applyPageRange(pid){if(!P1FULL)return;const grp=PAGE_GROUP[pid]||pid;const r=pageRanges[grp]||_pageDefaultRange(pid);if(r[0]!==GRA||r[1]!==GRB)_dtApplyRange(r[0],r[1]);}
function _dtApplyRange(a,b){
const full=(a===0&&b===P1FULL.days-1);
GRA=a;GRB=b;
if(curPageId){const grp=PAGE_GROUP[curPageId]||curPageId;pageRanges[grp]=[a,b];}
P1=full?P1FULL:buildRangedP1(P1FULL,a,b);
_winDaily();
renderP1();
if(P2){_winArr(P2);if(typeof p2Filter==='function')p2Filter();if(Number.isInteger(window.p2ActiveIndex))renderP2(window.p2ActiveIndex);}
if(P3&&typeof initP3==='function'){initP3();}
if(ZITEMS!==null){
  _buildZItems();
  renderZaxira();
  if(curPageId==="p7"&&typeof renderZakas==="function")renderZakas();
}
const st=document.getElementById("dt-start"),en=document.getElementById("dt-end");if(st&&P1FULL.dates){st.value=P1FULL.dates[a];en.value=P1FULL.dates[b];}
const nt=document.getElementById("dt-note");if(nt)nt.textContent=full?t("dt_note_full"):t("dt_note_range");
}
// 2026-08-18 (Bilol topilmasi, real misol: SKU 001267 "coca-cola" mahsuloti
// kartochkasini ochganda SKU 1267 "Al-Safi pishloq" savdosi ko'rsatilgan -
// ikkalasi Mahsulotlar sahifasida TASODIFAN bir xil nomga ega bo'lib chiqqan,
// chunki Invan'da SKU vaqti bilan boshqa tovarga qayta biriktirilishi mumkin
// ekan, eski savdo yozuvi esa eski nom bilan saqlanib qolgan). SKU orqali
// topilmasa, endi NOMDAN OLDIN SHTRIX-KODga qaraladi (Bilol so'rovi,
// 2026-08-18) - shtrix-kod fizik/global identifikator, SKU kabi qayta
// ishlatilmaydi, shuning uchun ancha ishonchli. Nom bo'yicha moslashtirish
// FAQAT shtrix-kod ham topilmagandagina, va ikkala tomonning SKU'si BOR-u
// BOSHQA-BOSHQA bo'lsa ishlatilmaydi - haqiqiy boshqa tovarga boshqasining
// ma'lumotini ko'rsatishdan ko'ra umuman ko'rsatmaslik xavfsizroq.
function dailyForFull(v){
  if(!DAILYFULL||!v)return null;
  const sk=v.sku&&DSKU?DSKU["sku:"+String(v.sku)]:null;
  if(sk&&DAILYFULL[sk])return DAILYFULL[sk];
  if(DBC&&Array.isArray(v.bc)){
    for(const b of v.bc){
      const bk=b&&DBC[b];
      if(bk&&DAILYFULL[bk])return DAILYFULL[bk];
    }
  }
  const nk=DNAME?DNAME[nn2(v.name)]:null;
  const nameHit=DAILYFULL[nk]||DAILYFULL[nn2(v.name)]||null;
  if(nameHit&&v.sku&&nameHit.sku&&String(nameHit.sku)!==String(v.sku))return null;
  return nameHit;
}
// ── Tarix (data_history.json, ~85MB) LAZY load ──
// 2026-08-17: ilgari Mahsulotlar bo'limi OCHILGANDA (kerak-kerakmasligidan
// qat'iy nazar) darhol yuklanardi. Standart (<=60 kunlik) ko'rinish aslida
// buni ishlatmaydi — kichikroq data_daily.json (DAILYFULL) yetarli. Endi
// FAQAT foydalanuvchi haqiqatan 60 kundan uzoqroq/maxsus sana oralig'ini
// yoki "to'liq tarix"ni so'raganda yuklanadi (pastdagi chaqiruvchilarga q.).
let _histLoadPromise=null,_histPendingRange=null;
function loadHistory(){
  if(_histLoadPromise)return _histLoadPromise;
  if(histLoadState==="loaded")return Promise.resolve();
  histLoadState="loading";
  const ind=document.getElementById("hist-load-ind");if(ind)ind.style.display="inline";
  _histLoadPromise=(async()=>{
    try{
      const resp=await fetch("data_history.json");
      if(!resp.ok)throw new Error("HTTP "+resp.status);
      const data=await resp.json();
      const [by,bm,bd]=data.base.split("-").map(Number);
      const labels=[];
      for(let i=0;i<data.days;i++){const d=new Date(Date.UTC(by,bm-1,bd+i));labels.push(d.toISOString().slice(0,10));}
      HIST={d:data.d,r:data.r,rc:data.rc||{},wi:data.wi||{},we:data.we||{},rt:data.rt||{},rr:data.rr||{},wri:data.wri||{},wre:data.wre||{},qf:data.qf||{},rf:data.rf||{}};
      HISTMETA={base:data.base,days:data.days,labels};
      histLoadState="loaded";
      if(ind)ind.style.display="none";
      // Yuklash tugashidan OLDIN so'ralgan maxsus sana oralig'i bo'lsa (masalan
      // global sana tanlagichdan) - endi HISTMETA tayyor, shu holda qo'llaymiz.
      if(_histPendingRange){
        const{from,to}=_histPendingRange;_histPendingRange=null;
        const hf=_dateToHistIdx(from),ht=_dateToHistIdx(to);
        if(hf>=0&&ht>=hf){p2HistCustom={from:hf,to:ht};p2HistDays=null;}
      }
      _histSyncInputs();
      if(Number.isInteger(window.p2ActiveIndex))renderP2(window.p2ActiveIndex);
    }catch(e){
      histLoadState="error";
      _histLoadPromise=null;
      if(ind)ind.style.display="none";
      console.warn("data_history.json yuklanmadi:",e);
    }
  })();
  return _histLoadPromise;
}
// Sana oralig'i (masalan global sana tanlagichdan) HIST'ga bog'liq bo'lsa
// shu orqali qo'llanadi: HIST hali yuklanmagan bo'lsa - yuklashni boshlaydi
// va oraliqni "kutilayotgan" qilib saqlaydi (yuqoridagi loadHistory() uni
// yuklash tugagach qo'llaydi), aks holda darhol qo'llaydi.
function _histApplyRange(fromISO,toISO){
  if(!HISTMETA){
    _histPendingRange={from:fromISO,to:toISO};
    loadHistory();
    // Yuklash sinxron ravishda histLoadState="loading" qilib qo'yadi (loadHistory()
    // ichida) - shu yerda DARHOL qayta chizib, "yuklanmoqda..." ko'rinishi (hist-range-bar,
    // renderP2 ichida) darhol chiqishini ta'minlaymiz - global sana tanlagichdan
    // (dtCalApply/dtPreset) kelganda ham setHistDays bilan bir xil tez fikr-mulohaza.
    if(curPageId==='p2'&&Number.isInteger(window.p2ActiveIndex))renderP2(window.p2ActiveIndex);
    return;
  }
  const hf=_dateToHistIdx(fromISO),ht=_dateToHistIdx(toISO);
  if(hf>=0&&ht>=hf){p2HistCustom={from:hf,to:ht};p2HistDays=null;if(curPageId==='p2'&&Number.isInteger(window.p2ActiveIndex))renderP2(window.p2ActiveIndex);}
}
function _dateToHistIdx(dateStr){
  if(!HISTMETA||!dateStr)return -1;
  const [y,m,d]=dateStr.split("-").map(Number);
  const [by,bm,bd]=HISTMETA.base.split("-").map(Number);
  return Math.max(0,Math.min(HISTMETA.days-1,Math.round((Date.UTC(y,m-1,d)-Date.UTC(by,bm-1,bd))/86400000)));
}
function getHistSlice(v,override){
  if(!HIST||!HISTMETA||!v||!v.sku)return null;
  const key="sku:"+String(v.sku);
  const qFull=HIST.d[key];if(!qFull)return null;
  const rFull=HIST.r[key]||new Array(qFull.length).fill(0);
  const total=HISTMETA.days,labFull=HISTMETA.labels;
  let from,to=total-1;
  if(override){from=override.from;to=Math.min(override.to,total-1);}
  else if(p2HistCustom){from=p2HistCustom.from;to=p2HistCustom.to;}
  else{const n=(p2HistDays==="full")?total:Math.min(+p2HistDays,total);from=(total-n)<10?0:(total-n);}
  const sl=arr=>arr?arr.slice(from,to+1):null;
  return{
    q:qFull.slice(from,to+1),
    r:rFull.slice(from,to+1),
    rc:sl(HIST.rc&&HIST.rc[key]),
    wi:sl(HIST.wi&&HIST.wi[key]),
    we:sl(HIST.we&&HIST.we[key]),
    rt:sl(HIST.rt&&HIST.rt[key]),
    rr:sl(HIST.rr&&HIST.rr[key]),
    wri:sl(HIST.wri&&HIST.wri[key]),
    wre:sl(HIST.wre&&HIST.wre[key]),
    labels:(labFull?labFull.slice(from,to+1):[]).map(l=>l.slice(5)),
    from,to,total
  };
}
function _histSyncInputs(){
  if(!HISTMETA)return;
  const lab=HISTMETA.labels,total=HISTMETA.days;
  let from,to=total-1;
  if(p2HistCustom){from=p2HistCustom.from;to=p2HistCustom.to;}
  else{const n=(p2HistDays==="full")?total:Math.min(+p2HistDays,total);from=(total-n)<10?0:(total-n);}
  const fi=document.getElementById("hist-from-inp"),ti=document.getElementById("hist-to-inp"),cb=document.getElementById("hist-clr-btn");
  if(fi){fi.value=lab[from]||"";fi.min=HISTMETA.base;fi.max=lab[total-1]||"";}
  if(ti){ti.value=lab[to]||"";ti.min=HISTMETA.base;ti.max=lab[total-1]||"";}
  if(cb)cb.style.display=p2HistCustom?"inline-block":"none";
}
function histDateChange(){
  window._p2PavSku=null;  // qo'lda tarix o'zgartirildi — pav ko'rinishidan chiqamiz
  const fi=document.getElementById("hist-from-inp"),ti=document.getElementById("hist-to-inp");
  if(!fi||!ti||!HISTMETA)return;
  const fv=fi.value,tv=ti.value;if(!fv||!tv)return;
  const from=_dateToHistIdx(fv),to=_dateToHistIdx(tv);
  if(from>to)return;
  p2HistCustom={from,to};p2HistDays=null;
  const cb=document.getElementById("hist-clr-btn");if(cb)cb.style.display="inline-block";
  if(Number.isInteger(window.p2ActiveIndex))renderP2(window.p2ActiveIndex);
}
function histClearCustom(){window._p2PavSku=null;p2HistCustom=null;p2HistDays=60;_histSyncInputs();if(Number.isInteger(window.p2ActiveIndex))renderP2(window.p2ActiveIndex);}
function setHistDays(d){
  window._p2PavSku=null;
  p2HistDays=d;p2HistCustom=null;
  // 60 kundan uzoqroq (yoki "to'liq") so'ralganda — 85MB HIST hali
  // yuklanmagan bo'lsa, shu yerda LAZY boshlanadi (renderP2 yuklangach
  // avtomatik qayta chiziladi, loadHistory() ichida).
  if((d==='full'||+d>60)&&histLoadState!=="loaded")loadHistory();
  _histSyncInputs();
  if(HISTMETA){const total=HISTMETA.days,lab=HISTMETA.labels;const n=(d==='full')?total:Math.min(+d,total);const from=(total-n)<10?0:(total-n);_calSel.from=lab[from];_calSel.to=lab[total-1];}
  const dp=document.getElementById('dt-pop');if(dp)dp.classList.remove('open');
  if(Number.isInteger(window.p2ActiveIndex))renderP2(window.p2ActiveIndex);
}
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ZAKAS HISOB — QULFLANGAN. O'ZGARTIRISH TAQIQLANGAN!          ║
// ║  Har doim oxirgi 30 kunlik DAILYFULL dan hisoblanadi.          ║
// ║  Grafik oralig'i (HIST/GRA/GRB) bu hisoblashga ta'sir qilmaydi.║
// ║  O'zgartirish uchun Biloldan RUXSAT kerak.                     ║
// ║  2026-07-20: Bilol ruxsati bilan — v.avg30sa (backend, stok-   ║
// ║  asosli, build_prev_avg.py) tayyor bo'lsa ISHLATILADI; bo'l-   ║
// ║  masa pastdagi ESKI (o'zgarmagan) hisobga tushadi.             ║
// ╚══════════════════════════════════════════════════════════════════╝
function _get30Avg(v){
  if(v.avg30sa!=null)return v.avg30sa;
  const dl=dailyForFull(v);if(!dl)return null;
  const rt=dl.rt||dl.q||[];if(!rt.length)return null;
  const wi=dl.wi||[];
  const n=rt.length;const s=Math.max(0,n-30);
  const sl=rt.slice(s).map((x,i)=>(x||0)+(wi[s+i]||0));
  const tot=sl.reduce((a,b)=>a+b,0);
  const active=sl.filter(x=>x>0).length;
  return active>=8?Math.round(tot/active*100)/100:Math.round(tot/30*100)/100;
}
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
const _aavg=active?Math.round(tot/active*100)/100:0;const _ed=active>=8?_aavg:Math.round(fa*100)/100;
o.m=Object.assign({},it.m||{},{daily:_ed,baselineDaily:Math.round(fa*100)/100,week:Math.round(_ed*7*100)/100,month:Math.round(_ed*30*100)/100,calendarAvg:Math.round(fa*100)/100,activeAvg:_aavg,activeDays:active,wholesalePct:obs?Math.round((xs+is)/obs*1000)/10:0,explicitWholesale:Math.round(xs),inferredWholesale:Math.round(is),revenue:Math.round(rev.reduce((s,y)=>s+(y||0),0)),totalSold:Math.round(obs),totalReceipts:(o.r||[]).reduce((s,y)=>s+(y||0),0)});
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
(function dtInit(){const dates=P1FULL.dates||(DMETAFULL&&DMETAFULL.labels)||[];if(dates.length){const f=dates[0],l=dates[dates.length-1];const st=document.getElementById("dt-start"),en=document.getElementById("dt-end");if(st)st.value=f;if(en)en.value=l;_calSel.from=f;_calSel.to=l;_calSel.view={y:new Date(l).getFullYear(),m:new Date(l).getMonth()};}})();
const ADESC={"A":"A guruh - tushumning 80 foizini taminlaydi. Eng muhim mahsulot, stokdan chiqmasin!","B":"B guruh - tushumning 15 foizini taminlaydi. Orta muhimlik, promo bilan kuchaytiring.","C":"C guruh - tushumning 5 foizini taminlaydi. Kam sotiladi, assortimentni korib chiqing."};
const AS={"A":["#E1F5EE","#085041","A guruh","abc-A-d"],"B":["#FAEEDA","#633806","B guruh","abc-B-d"],"C":["#FCEBEB","#501313","C guruh","abc-C-d"]};
const DATES=["01","02","03","04","05","06","07","08","09","10","11","12","13","14","15","16","17","18","19","20","21","22","23","24","25","26","27","28","29","30","31"];
let p2page=1,P2PS=50,p2rows=[];
function nn2(s){return String(s||"").replace(/\s+/g," ").trim().toLowerCase();}function dailyFor(v){if(!DAILY||!v)return null;const skuKey=v.sku&&DSKU?DSKU["sku:"+String(v.sku)]:null;const nameKey=DNAME?DNAME[nn2(v.name)]:null;return DAILY[skuKey]||DAILY[nameKey]||DAILY[nn2(v.name)]||null;}
// Nom/SKU/barcode bo'yicha qidiruv moslik tekshiruvi - barcode substring sifatida solishtiriladi,
// shuning uchun to'liq barcode ham, oxirgi bir necha raqami ham (masalan oxirgi 6 ta) mos keladi.
function _matchNSB(v,q){return (v.name&&v.name.toLowerCase().includes(q))||(v.sku&&String(v.sku).toLowerCase().includes(q))||(v.bc&&v.bc.some(b=>String(b).toLowerCase().includes(q)));}
let _p2BcMap=null;
function _p2BcBySku(sku){
  if(!P2)return[];
  if(!_p2BcMap){_p2BcMap=new Map();P2.forEach(v=>{if(v.sku)_p2BcMap.set(String(v.sku),v.bc||[]);});}
  return _p2BcMap.get(String(sku))||[];
}
// ─── MA'LUMOTNI YUKLASH YORDAMCHILARI (fetch on demand) — P2/INVDATA/
// DAILYFULL/SUPPLIERDATA/ExcelJS'ni faqat kerak bo'lganda yuklaydi,
// bir necha sahifa (p2/p5/p6/p7) tomonidan ishlatiladi ───
// 2026-08-19 (Bilol so'rovi, sahifa tezligi): ilgari bu FAQAT initP2() ichida
// invdata (_apiBoot) TO'LIQ kutilgandan KEYIN boshlanardi - ikkalasi bir-
// biriga bog'liq bo'lmasa ham, ketma-ket kutilgani uchun sovuq holatda
// vaqt qo'shilib ketardi (~15s + ~6.5s = ~21.5s). Endi promise-kesh bilan
// himoyalangan - showPage() ikkalasini (_apiBoot va shu funksiyani)
// BIR VAQTDA ishga tushiradi, keyinroq initP2() ichidagi qayta chaqiruv
// esa shu ALLAQACHON ishlab turgan (yoki tugagan) so'rovni qayta ishlatadi
// - qo'shimcha tarmoq so'rovi yubormaydi, faqat kutadi.
let _dailyDemandP=null;
async function _ensureDailyDemand(apiData){
  if(DAILYFULL)return;
  if(_dailyDemandP)return _dailyDemandP;
  _dailyDemandP=(async()=>{
    try{
      let _dp=apiData&&apiData.demand?apiData.demand:JSON.parse(document.getElementById("dailydata").textContent);
      if(!_dp||!Object.keys(_dp).length){const _r=await fetch("data_daily.json",{cache:"no-store"});_dp=await _r.json();}
      DAILYFULL=_dp.items;DSKU=_dp.skuAliases||{};DNAME=_dp.nameAliases||{};DMETAFULL=_dp.__meta__;
      // 2026-08-18 (Bilol so'rovi): shtrix-kod SKU'dan ham ishonchliroq
      // identifikator (SKU Invan'da qayta ishlatilishi mumkin, shtrix-kod
      // esa fizik/global). build_all_from_api.py endi har yozuvga "bc"
      // (shtrix-kodlar ro'yxati) qo'shadi - shu yerda bitta marta
      // shtrix-kod->kalit indeksi quriladi, dailyForFull() shundan
      // foydalanadi (SKU topilmasa, NOMDAN OLDIN shtrix-kodga qaraydi).
      DBC={};
      for(const key in DAILYFULL){
        const bc=DAILYFULL[key].bc;
        if(bc)for(const b of bc)if(b&&!(b in DBC))DBC[b]=key;
      }
      _winDaily();
      const ph=document.getElementById("p2-period");if(ph)ph.textContent=(DMETA.title||"")+" · "+DMETA.days+" kun";
    }catch(e){DAILY=null;DSKU={};DNAME={};DBC={};DMETA=null;_dailyDemandP=null;}
  })();
  return _dailyDemandP;
}
// JONLI ma'lumot uchun BITTA umumiy so'rov — bir necha bo'lim bir vaqtda
// so'rasa ham Invan'dan bir marta olinadi (bootstrap ~15-20s).
let _apiBootP=null;
function _apiBoot(){
  if(!window.TiinDataAPI)return Promise.resolve(null);
  if(!_apiBootP)_apiBootP=window.TiinDataAPI.bootstrap().catch(()=>null);
  return _apiBootP;
}
async function _ensureInvData(apiData){
  if(!INVDATA){
    let _iv=apiData&&apiData.inventory?apiData.inventory:null;
    // 2026-08-15: MUHIM TUZATISH. Ilgari `apiData` berilmasa TO'G'RIDAN-TO'G'RI
    // HTML ichidagi statik (eski) ma'lumotga tushardi. Ba'zi yo'llar esa uni
    // ataylab bermaydi — p6 "Ta'minotchilar" (initP2(null)) va p10
    // "Kategoriyalar" (ktEnsureData). Ya'ni foydalanuvchi Zakas'ga O'SHA
    // yo'ldan kirsa, INVDATA butun sessiya davomida STATIK qolar edi
    // (`if(!INVDATA)` sabab qayta so'ralmaydi) — stok/narx eski ko'rinardi,
    // garchi API to'g'ri javob berayotgan bo'lsa ham. Endi manba qaysi
    // yo'ldan kirilganiga bog'liq emas: avval har doim API sinaladi.
    if(!_iv){const _b=await _apiBoot();_iv=(_b&&_b.inventory)||null;}
    // 2026-08-17 TUZATISH: "Buyurtma"da barcha tovarlar bitta "Noma'lum"
    // ta'minotchi ostiga tushib qolish shikoyati tekshirildi. Sabab: bu
    // yerdagi JSON.parse/fetch HIMOYASIZ edi — HTML ichidagi statik blok
    // buzilgan/to'liqsiz bo'lsa (yoki data_inv_new.json fetch xato bersa),
    // istisno TASHQARIGA chiqib ketardi va `initP2()` yarim bajarilgan
    // holda to'xtardi: P2 ALLAQACHON o'rnatilgan (shuning uchun keyingi
    // sahifaga kirishlarda `if(!P2)` qayta urinib ko'rmaydi), lekin
    // `.sup`/`.amt` HECH QACHON to'ldirilmagan — sessiya oxirigacha (to'liq
    // sahifa yangilanmaguncha) HAR BIR tovar ta'minotchisiz qolib, Zakas
    // butun katalogni bitta "Noma'lum" guruhga yig'ib qo'yardi. Endi har
    // qadam alohida ushlanadi, va agar HAMMASI muvaffaqiyatsiz tugasa
    // `INVDATA` bo'sh holda KESHLANMAYDI — keyingi chaqiruv qayta urinadi.
    if(!_iv){
      try{_iv=JSON.parse(document.getElementById("invdata").textContent);}catch(e){_iv=null;}
    }
    if(!_iv||!Object.keys(_iv).length){
      try{const _r=await fetch("data_inv_new.json",{cache:"no-store"});_iv=await _r.json();}catch(e){/* pastda bo'sh qaytariladi */}
    }
    if(_iv&&Object.keys(_iv).length){INVDATA=_iv;}
    else return _iv||{};
  }
  return INVDATA;
}
async function _ensureP2Data(apiData){
  if(P2)return P2;
  let _p2=apiData&&apiData.products?apiData.products:JSON.parse(document.getElementById("p2data").textContent);
  if(!_p2||!_p2.length){const _r=await fetch("data_mahsulotlar.json",{cache:"no-store"});_p2=await _r.json();}
  P2=_p2;
  return P2;
}
async function _ensureSupplierData(){
  if(P6)return P6;
  let _sp=JSON.parse(document.getElementById("supplierdata").textContent);
  if(!_sp||!Object.keys(_sp).length){const _r=await fetch("data_supplier.json",{cache:"no-store"});_sp=await _r.json();}
  P6=_sp;
  return P6;
}
// P8 (Kirim) - avval JONLI API'ni sinaydi (window.TiinDataAPI.kirimdata(),
// backend/app.py: _live_kirimdata() - Turso'dan real vaqtda), tarmoq
// xatosida yoki file:// rejimida avtomatik statik data_kirim.json'ga
// qaytadi. Natija shakli ikkalasida ham bir xil ({skus:{...}}).
// DIQQAT: API varianti (`/api/v1/kirimdata`) ATAYLAB faqat SO'NGGI 120 KUNni
// qaytaradi (supplier_orders_from_invan(max_days=120) — Vercel'ning 60s
// chegarasiga sig'ish uchun). Zakas/Kirim uchun bu yetarli, LEKIN tarixiy
// tannarx hisobi (p9 Ombor aylanmasi, p10 Kategoriyalar) uchun YETARLI EMAS:
// oxirgi kirimi 120 kundan eski tovar "kirim narxi yo'q" bo'lib qolardi.
// Shuning uchun manba `window._p8FromApi` bilan belgilanadi — ombor_aylanmasi.js
// shunga qarab to'liq statik tarixni (data_kirim.json) alohida yuklaydi.
async function _ensureKirimData(){
  if(P8)return P8;
  if(window.TiinDataAPI){
    try{P8=await window.TiinDataAPI.kirimdata();window._p8FromApi=true;return P8;}catch(e){/* pastga, statik zaxiraga */}
  }
  try{const _r=await fetch("data_kirim.json",{cache:"no-store"});P8=await _r.json();window._p8FromApi=false;}catch(e){P8={skus:{}};window._p8FromApi=false;}
  return P8;
}
// ExcelJS (~925KB) endi HTML'da darhol yuklanmaydi - faqat Export/Import
// tugmasi bosilganda, shu funksiya orqali kerak bo'lganda yuklanadi.
let _exceljsPromise=null;
function _ensureExcelJS(){
  if(typeof ExcelJS!=="undefined")return Promise.resolve();
  if(_exceljsPromise)return _exceljsPromise;
  _exceljsPromise=new Promise((resolve,reject)=>{
    const s=document.createElement("script");
    s.src="https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js";
    s.onload=resolve;s.onerror=reject;
    document.head.appendChild(s);
  });
  return _exceljsPromise;
}
// JSZip (faqat "rasm/chizma bor faylni tuzatish" zaxira yo'li uchun kerak bo'lganda yuklanadi)
let _jszipPromise=null;
function _ensureJSZip(){
  if(typeof JSZip!=="undefined")return Promise.resolve();
  if(_jszipPromise)return _jszipPromise;
  _jszipPromise=new Promise((resolve,reject)=>{
    const s=document.createElement("script");
    s.src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
    s.onload=resolve;s.onerror=reject;
    document.head.appendChild(s);
  });
  return _jszipPromise;
}
// ExcelJS ba'zi fayllarda (ichida rasm/logotip/chizma - "drawing" bo'lsa) "Cannot read
// properties of undefined (reading 'anchors')" xatosi bilan yiqiladi - bu kutubxonaning
// ma'lum kamchiligi (chart/absoluteAnchor turlarini to'liq qo'llab-quvvatlamaydi). Bizga
// rasm kerak emas, faqat katak qiymatlari - shuning uchun .xlsx (zip) ichidan drawing
// havolalarini (<drawing.../> teglari + rels yozuvlari) olib tashlab, faylni "tozalab"
// qayta o'qishga urinamiz. Foydalanuvchi hech narsa qilishi shart emas - avtomatik.
async function _zkStripDrawingsAndRetry(buf){
  await _ensureJSZip();
  if(typeof JSZip==="undefined")throw new Error("JSZip yuklanmadi");
  const zip=await JSZip.loadAsync(buf);
  const names=Object.keys(zip.files);
  for(const name of names){
    if(!/^xl\/worksheets\/sheet\d+\.xml$/.test(name)&&!/^xl\/worksheets\/_rels\/sheet\d+\.xml\.rels$/.test(name))continue;
    const txt=await zip.files[name].async("string");
    let cleaned=txt;
    if(/^xl\/worksheets\/sheet\d+\.xml$/.test(name)){
      cleaned=cleaned.replace(/<drawing[^>]*\/>/g,"").replace(/<legacyDrawing[^>]*\/>/g,"");
    }else{
      cleaned=cleaned.replace(/<Relationship[^>]*Type="[^"]*\/(?:drawing|vmlDrawing)"[^>]*\/>/g,"");
    }
    if(cleaned!==txt)zip.file(name,cleaned);
  }
  return zip.generateAsync({type:"arraybuffer"});
}
// 2026-08-15: Zakas/Mahsulotlar ochilishi va ichkaridagi qotish shikoyati
// tekshirildi — asosiy sabablardan biri shu yerda topildi. Avval SKU/aniq
// nom bilan topilmagan har bir tovar uchun `invKeys.find(k=>k.startsWith(norm))`
// BUTUN ~22k kalitni CHIZIQLI qidirardi — ya'ni eng yomon holatda ~22k x
// ~22k = ~484 million amal, BOSH OQIMNI (main thread) sezilarli bloklardi.
// Endi kalitlar BIR MARTA saralanadi, har qidiruv esa ikkilik qidiruv
// (binary search) bilan O(log n) — amalda sezilmas tezlikda.
function _prefixIndex(keys){
  const sorted=keys.slice().sort();
  return norm=>{
    let lo=0,hi=sorted.length;
    while(lo<hi){const mid=(lo+hi)>>1;if(sorted[mid]<norm)lo=mid+1;else hi=mid;}
    return (lo<sorted.length&&sorted[lo].startsWith(norm))?sorted[lo]:null;
  };
}
async function _enrichWithInventory(arr,apiData){
  const INV=await _ensureInvData(apiData);
  const invKeys=Object.keys(INV);
  const invBySku={};
  const invKeyBySku={};
  for(const _k of invKeys){const _s=INV[_k]&&INV[_k].sku;if(_s!=null&&_s!==""){invBySku[String(_s)]=INV[_k];invKeyBySku[String(_s)]=_k;}}
  const findByPrefix=_prefixIndex(invKeys);
  arr.forEach((v,i)=>{
    if(v._i==null)v._i=i;
    let iv=(v.sku!=null&&v.sku!=="")?invBySku[String(v.sku)]:null;
    const matchedBySku=!!iv;
    if(!iv){const norm=nn2(v.name);iv=INV[norm];if(!iv){const pk=findByPrefix(norm);if(pk)iv=INV[pk];}}
    if(iv){
      if(v.sku==null||v.sku==="")v.sku=iv.sku;
      // 2026-08-18/19 (Bilol topilmasi, real misol: SKU 3326 avval "borjomi,
      // gruziya limonadi nok" edi, Invan'da endi butunlay boshqa tovarga
      // - "kakao" ga qayta biriktirilgan, borjomi esa YANGI SKU'ga ko'chgan.
      // Bizning eski savdo tarixi hali ham SKU 3326'ni "borjomi" deb
      // ataydi, shu payt unga stok/narx/ta'minotchi/shtrix-kod JONLI
      // Invan'dan (hozirgi - kakao'niki) qo'shilib, chalkash aralashma
      // hosil bo'lardi ("borjomi" nomi + kakao'ning ta'minotchisi/stoki).
      // Bu xato boshqa SKU'da ham TAKRORLANISHI mumkin (Invan istalgan
      // vaqt SKU'ni qayta ishlatishi mumkin) - shuning uchun BIR MARTALIK
      // (faqat shu SKU uchun) tuzatish o'rniga UMUMIY qoida qo'yildi: SKU
      // orqali ISHONCHLI moslik topilganda (nom-fallback EMAS), nom ham
      // joriy Invan katalogidan yangilanadi - shunda nom va stok/narx
      // doim BIR XIL (joriy) tovarga tegishli bo'lib qoladi, SKU qayta
      // ishlatilgan har qanday holatda ham avtomatik to'g'irlanadi.
      if(matchedBySku){
        const curName=invKeyBySku[String(v.sku)];
        if(curName)v.name=curName;
      }
      v.iprice=iv.p;v.suprice=iv.sp;v.amt=iv.a;v.itype=iv.t;v.sub=iv.sb;v.sup=iv.su;v.lsd=iv.lsd||null;v.ld60=iv.ld60||null;v.pav=iv.pav||null;v.pavm=iv.pavm||null;v.avg30sa=iv.avg30sa||null;v.la=iv.la||null;v.bc=iv.bc||[];v.rcost=iv.rcost||0;v.rcostApprox=!!iv.rcost_approx;v.calcStock=iv.calcStock!=null?iv.calcStock:null;v.calcConf=iv.calcConf||null;v.calcEvidence=iv.calcEvidence!=null?iv.calcEvidence:null;v.calcAnchor=iv.calcAnchor||null;v.calcRule=iv.calcRule||null;v.lkQty=iv.lkQty!=null?iv.lkQty:null;v.lkSold=iv.lkSold!=null?iv.lkSold:null;v.lkDate=iv.lkDate||null;v.zabc=iv.zabc||"";v.ovEffective=iv.ovEffective!=null?iv.ovEffective:null;
    }
  });
}
// ─── P2: MAHSULOTLAR ───
async function initP2(apiData){
  await _ensureDailyDemand(apiData);
  await _enrichWithInventory(P2,apiData);
  if(_rangeActive())_winArr(P2);
  p2FillCat();p2Filter();
  sselAttach("pf-cat");sselAttach("pf-sup");
}
// ── Qidiruvli tanlov (searchable select) — uzun ro'yxatli filtrlar (Kategoriya/Ta'minotchi) uchun ──
// Asl <select> elementga tegilmaydi (butun mavjud filtr mantig'i - p2Match/p3Match va h.k. -
// o'zgarishsiz qoladi) - faqat uning ustiga qidiruv maydoni + ro'yxat qo'yiladi. Tanlanganda
// select.value o'rnatilib "change" hodisasi yuboriladi - xuddi foydalanuvchi asl select'ni
// ishlatgandek, mavjud onchange="..." handlerlar (p2Filter/p3ApplyFilters) o'zgarishsiz ishlaydi.
function sselAttach(selectId){
  const sel=document.getElementById(selectId);
  const inp=document.getElementById(selectId+"-inp");
  const menu=document.getElementById(selectId+"-menu");
  if(!sel||!inp||!menu||sel._sselSync)return;
  const label=()=>{const o=sel.options[sel.selectedIndex];return o&&o.value?o.textContent:"";};
  const sync=()=>{inp.value=label();inp.placeholder=t("filt_all");inp.classList.toggle("on",!!sel.value);};
  const renderMenu=q=>{
    const query=(q||"").toLowerCase().trim();
    const rows=[...sel.options].filter(o=>!query||o.textContent.toLowerCase().includes(query));
    menu.innerHTML=rows.length?rows.map(o=>'<div class="ssel-opt'+(o.value===""?" all":"")+(o.value===sel.value?" hl":"")+'" data-v="'+esc(o.value)+'">'+esc(o.textContent)+'</div>').join(""):'<div class="ssel-empty">'+esc(t("topilmadi"))+'</div>';
    menu.classList.add("open");
  };
  inp.addEventListener("focus",()=>{inp.value="";renderMenu("");});
  inp.addEventListener("input",()=>renderMenu(inp.value));
  inp.addEventListener("keydown",e=>{if(e.key==="Escape")inp.blur();});
  inp.addEventListener("blur",()=>{setTimeout(()=>{menu.classList.remove("open");sync();},150);});
  menu.addEventListener("mousedown",e=>{
    const opt=e.target.closest(".ssel-opt");if(!opt)return;
    e.preventDefault();
    sel.value=opt.dataset.v;
    sel.dispatchEvent(new Event("change"));
    menu.classList.remove("open");
    sync();
  });
  sel._sselSync=sync;
  sync();
}
function sselSyncAll(){document.querySelectorAll("select").forEach(s=>{if(s._sselSync)s._sselSync();});}
const P2FF=[{id:"pf-sub",k:v=>v.sub},{id:"pf-type",k:v=>v.itype},{id:"pf-sup",k:v=>v.sup}];
function p2FillCat(){const opts=[...new Set(P2.map(v=>v.cat).filter(x=>x))].sort((a,b)=>String(a).localeCompare(String(b),"ru"));const sel=document.getElementById("pf-cat");opts.forEach(v=>{const o=document.createElement("option");o.value=v;o.textContent=v;sel.appendChild(o);});}
function p2Match(v,skip){const fc=p2gv("pf-cat"),fs=p2gv("pf-sub"),ft=p2gv("pf-type"),fp=p2gv("pf-sup"),fa=p2gv("pf-amt"),fb=p2gv("pf-abc");if(skip!=="pf-cat"&&fc&&v.cat!==fc)return false;if(skip!=="pf-sub"&&fs&&v.sub!==fs)return false;if(skip!=="pf-type"&&ft&&v.itype!==ft)return false;if(skip!=="pf-sup"&&fp&&v.sup!==fp)return false;if(skip!=="pf-abc"&&fb&&v.abc!==fb)return false;if(skip!=="pf-amt"&&fa){const a=v.amt;if(a===undefined)return false;if(fa==="pos"&&!(a>0))return false;if(fa==="zero"&&a!==0)return false;if(fa==="neg"&&!(a<0))return false;}return true;}
function p2UniqWhere(kf,skip){const s=new Set();P2.forEach(v=>{if(p2Match(v,skip)){const x=kf(v);if(x)s.add(x);}});return [...s].sort((a,b)=>String(a).localeCompare(String(b),"ru"));}
function p2RebuildSel(id,opts,cur){const sel=document.getElementById(id);sel.innerHTML="";const o0=document.createElement("option");o0.value="";o0.textContent=t("filt_all");sel.appendChild(o0);opts.forEach(v=>{const o=document.createElement("option");o.value=v;o.textContent=v;sel.appendChild(o);});sel.value=(cur&&opts.includes(cur))?cur:"";sel.className=sel.value?"on":"";if(sel._sselSync)sel._sselSync();}
function p2gv(id){return document.getElementById(id).value;}
function p2Filter(){P2FF.forEach(f=>{const cur=p2gv(f.id);const opts=p2UniqWhere(f.k,f.id);p2RebuildSel(f.id,opts,cur);});["pf-cat","pf-amt","pf-abc"].forEach(id=>{const e=document.getElementById(id);e.className=e.value?"on":"";});const q=document.getElementById("pf-q").value.trim().toLowerCase();p2rows=P2.filter(v=>{if(!v.sku)return false;if(!p2Match(v,null))return false;if(q&&!_matchNSB(v,q))return false;return true;});p2page=1;document.getElementById("pf-cnt").textContent=p2rows.length.toLocaleString()+" "+t("p2_cnt_suffix");renderP2Table();}
function renderP2Table(){const tb=document.getElementById("pf-tbody");const ro=(p2page-1)*P2PS;const pg=p2rows.slice(ro,ro+P2PS);if(!pg.length){tb.innerHTML='<tr><td colspan="7" style="text-align:center;padding:34px;color:#bbb">'+t("p2_not_found")+'</td></tr>';document.getElementById("pf-pag").innerHTML="";return;}const END=new Date((DMETA&&DMETA.end)?DMETA.end:'2026-05-31');let h="";pg.forEach((v,i)=>{const abc=v.abc||"";let di=v.di;if((di===undefined||di===null||di>=900)&&v.ld){const d=new Date(v.ld);di=Math.max(0,Math.round((END-d)/86400000));}else if(di===undefined||di===null){di=999;}const[sc,stTxt]=sotuv(di);const price=v.iprice||v.p||0;const suprice=v.suprice||0;const priceCell=price?'<div class="p2-price-main">'+price.toLocaleString()+" so'm</div>"+(suprice?'<div class="p2-price-sub">'+t("kelish_lc")+': '+suprice.toLocaleString()+" so'm</div>":""):'<span class="p2-empty">&mdash;</span>';const skuMeta=v.sku?'<span class="p2-chip">SKU: '+esc(v.sku)+'</span>':'';const kgMeta=v.kg&&!v.name.toLowerCase().includes('kg')?'<span class="sug-kg">KG</span>':'';const unitCell=v.itype?esc(v.itype):'<span class="p2-empty">&mdash;</span>';const supCell=v.sup?'<div class="p2-supplier" title="'+esc(v.sup)+'">'+esc(v.sup)+'</div>':'<span class="p2-empty">&mdash;</span>';h+=`<tr data-pi="${v._i}" onclick="p2RowClick(${v._i})" title="Ikki marta bosing - Zaxirada korish"><td style="color:#bbb">${ro+i+1}</td><td title="${esc(v.name)}"><div class="p2-prod-name">${esc(v.name)}${kgMeta}</div><div class="p2-prod-meta">${skuMeta}</div></td><td style="white-space:nowrap;color:#64748B">${unitCell}</td><td>${supCell}</td><td>${priceCell}</td><td><span class="badge ${sc}">${stTxt}</span></td><td>${abc?'<span class="p2-abc p2-abc-'+abc+'">'+abc+'</span>':'<span class="p2-empty">&mdash;</span>'}</td></tr>`;});tb.innerHTML=h;renderP2Pag();}
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
  // Chuqur zakas pav ko'rinishi: pav davri (oxirgi sotuvda tugaydigan 30 kun) HIST'dan
  // olinadi, kartalar pavm'dan. Oyna INLINE hisoblanadi — HIST kech yuklansa ham ishlaydi.
  const _pavIntended=!!(window._p2PavSku&&String(window._p2PavSku)===String(v.sku)&&v.pavm&&v.lsd);
  let _pavHist=null;
  if(_pavIntended&&HISTMETA){
    const _ld=new Date(v.lsd);const _fd=new Date(v.lsd);_fd.setDate(_fd.getDate()-29);
    const _iso=d=>d.toISOString().slice(0,10);
    const _hf=_dateToHistIdx(_iso(_fd)),_ht=_dateToHistIdx(_iso(_ld));
    if(_hf>=0&&_ht>=_hf)_pavHist={from:_hf,to:_ht};
  }
  const _pavView=!!(_pavIntended&&_pavHist);
  // Prognoz/grafik tanlangan sana-oralig'iga (window) moslashadi - kunlik o'rtacha
  // o'sha oraliqdan olinadi (dailyFor). Shu bilan grafik, prognoz va zakas hisobi
  // hammasi bir xil tanlangan davrga tayanadi.
  const dl=dailyFor(v);
  // Tarix (HIST) yoki DAILYFULL: p2HistDays > 60 yoki "full" bo'lsa HIST ishlatiladi
  const useHist=histLoadState==="loaded"&&(_pavView||!!p2HistCustom||p2HistDays==="full"||(+p2HistDays)>60);
  const hs=useHist?getHistSlice(v,_pavView?_pavHist:null):null;
  const dd=hs?hs.q:(dl?dl.q:(v.d||[]));
  const dr=hs?hs.r:(dl?dl.r:null);
  const drr=hs?(hs.rr||null):(dl?dl.rr:null);
  const dwr=hs?null:(dl?dl.wr:null);
  const dwi=hs?(hs.wi||null):(dl?dl.wi:null);
  const dwe=hs?(hs.we||null):(dl?dl.we:null);
  const dwri=hs?(hs.wri||null):(dl?dl.wri:null);
  const dwre=hs?(hs.wre||null):(dl?dl.wre:null);
  const labels=hs?hs.labels:((DMETA&&DMETA.labels&&DMETA.labels.length===dd.length)
    ?DMETA.labels.map(value=>value.slice(5))
    :dd.map((_,i)=>String(i+1).padStart(2,"0")));
  // Demand/Zakas hisoblash uchun DOIM DAILYFULL (30 kun) ishlatiladi
  const dlFull=dailyFor(v);
  const ddDemand=dlFull?dlFull.q:(v.d||[]);
  const drDemand=dlFull?dlFull.r:null;
  const dwDemand=dlFull?dlFull.w:null;
  const tz=calcTozaOrtacha(ddDemand,drDemand,dwDemand,dlFull);
  // HIST mode: hs.wi mavjud va uzunlik mos bo'lsa — to'liq rang ajratish (retail/wi/we)
  const hsHasBreakdown=!!(hs&&hs.wi&&hs.wi.length===dd.length);
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
  // ── ZAKAS QULFLANGAN: doim 30 kun, o'zgartirma ──
  const _avg30r=_get30Avg(v);
  if(_avg30r!=null){m.daily=_avg30r;m.month=Math.round(_avg30r*30*100)/100;m.week=Math.round(_avg30r*7*100)/100;}
  // ── /ZAKAS QULFLANGAN ──
  // CHUQUR ZAKAS pav ko'rinishi: DAILY(60 kun) pav davrini qamramaydi — hisobot
  // raqamlarini backend'da hisoblangan pav davri summary'sidan (pavm) to'ldiramiz.
  // Vaqt oralig'i qo'lda o'zgartirilsa _p2PavSku tozalanadi va normal logika ishlaydi.
  if(_pavView){const pm=v.pavm;m.daily=v.pav||m.daily;m.week=(v.pav||0)*7;m.month=(v.pav||0)*30;m.revenue=pm.rev||0;m.totalSold=pm.q||0;m.totalReceipts=pm.r||0;tz.wiSum=pm.wi||0;tz.weSum=pm.we||0;m.recurringWholesale=pm.wi||0;m.oneoffWholesale=pm.we||0;}
  const pureRetailSum=_pavView?(v.pavm.rt||0):(tz.pureRetail?tz.pureRetail.reduce((a,b)=>a+b,0):tz.retailMonth);
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
  let lastSaleDate,daysSinceSale;
  if(lastSaleIndex>=0){
    // hs (HIST) faol bo'lsa dd to'liq tarix massivi (190 kun) - DMETA.labels esa
    // doim 30 kunlik oyna, indekslar mos kelmaydi. HISTMETA.labels+hs.from orqali
    // to'g'ri sanani olamiz, aks holda DMETA (standart 30 kunlik oyna) ishlatiladi.
    lastSaleDate=hs&&HISTMETA&&HISTMETA.labels
      ?(HISTMETA.labels[hs.from+lastSaleIndex]||v.ld||"-")
      :(DMETA&&DMETA.labels?DMETA.labels[lastSaleIndex]:(v.ld||"-"));
    daysSinceSale=dd.length-1-lastSaleIndex;
  }else if(v.lsd){
    // Tanlangan sana oralig'ida (dd) sotuv topilmasa ham, v.lsd (Jan 1dan to'liq
    // tarix) orqali haqiqiy oxirgi sotuvni ko'rsatamiz — aks holda tor oyna
    // tanlanganda (masalan bir kunlik) mahsulot "Savdo kuzatilmadi" deb noto'g'ri
    // chiqadi, garchi u haqiqatda bir necha hafta oldin sotilgan bo'lsa ham.
    const _endRef=(DMETAFULL&&DMETAFULL.end)?new Date(DMETAFULL.end):new Date();
    lastSaleDate=v.lsd;
    daysSinceSale=Math.max(0,Math.round((_endRef-new Date(v.lsd))/86400000));
  }else{
    lastSaleDate=v.ld||"-";
    daysSinceSale=null;
  }
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

  // "X kunlik savdo" ko'rsatkichi ko'rsatilgan davrning o'zidan (dd/dr) hisoblanadi.
  // m.revenue/m.totalSold zakas hisobi uchun DOIM 30 kunlik DAILYFULL'ga qulflangan
  // (yuqorida), shuning uchun HIST rejimida (masalan "to'liq" tanlanganda) ularni
  // ishlatish davr uzunligiga mos kelmay, sotuvi bor tovarlarda ham 0 ko'rsatib qo'yardi.
  const periodRevenue=(hs&&!_pavView)?(dr||[]).reduce((a,b)=>a+(b||0),0):(m.revenue||0);
  const periodQty=(hs&&!_pavView)?dd.reduce((a,b)=>a+(b||0),0):m.totalSold;
  // "Birga sotilgan" o'rniga kirim (Invan supply order) tarixi - P8 (data_kirim.json).
  // p6/p7/p8 ochilishida oldindan yuklab qo'yiladi, lekin p2 (Mahsulotlar)ga
  // to'g'ridan-to'g'ri kirilsa P8 hali yuklanmagan bo'lishi mumkin - shu holatda
  // fonda o'zi yuklab, tayyor bo'lgach shu kartani qayta chizadi (renderP2 sync
  // funksiya, chaqiruvchilarni o'zgartirmaslik uchun await emas, orqadan yangilash).
  if(!P8&&!window._p8Loading){
    window._p8Loading=true;
    _ensureKirimData().then(d=>{P8=d;window._p8Loading=false;if(window.p2ActiveIndex===idx)renderP2(idx);}).catch(()=>{P8={skus:{}};window._p8Loading=false;});
  }
  const kirimEntry=(P8&&P8.skus&&v.sku)?P8.skus[String(v.sku)]:null;
  // Faqat HAQIQATDA kelgan (Open/New - hali kelmagan, kutilayotgan) qatorlar -
  // Invan'ning o'z "Supply order" tab'i ham xuddi shunday, faqat real harakat
  // bo'lgan buyurtmalarni ko'rsatadi (2026-08-06, foydalanuvchi so'rovi bilan
  // tasdiqlandi - "Open" p8 Kirim bo'limida qolaveradi, bu yerda chalg'itmasin).
  const arrivals=(kirimEntry&&kirimEntry.arrivals)?[...kirimEntry.arrivals].filter(a=>a.status!=="Open"&&a.status!=="New").sort((a,b)=>(b.date||"").localeCompare(a.date||"")):[];
  document.getElementById("bcnt").textContent=P8?(arrivals.length+" ta"):"—";
  document.getElementById("blist").innerHTML=!P8
    ?'<div class="empty"><div class="empty-txt">Yuklanmoqda...</div></div>'
    :arrivals.length
      ?arrivals.map(a=>{
        const notReceived=a.status&&a.status!=="Received";
        const badge=notReceived?' <span class="'+krStatusBadgeCls(a.status)+'" style="font-size:9px;padding:2px 7px;margin-left:4px;vertical-align:1px">'+esc(a.status)+'</span>':'';
        return '<div class="prod-row"><div class="pname">'+krFmtDate(a.date)+' — '+esc(a.supplier||"")+badge+'</div><div class="ppct" style="color:#1D9E75">'+(a.qty||0).toLocaleString()+'</div></div>';
      }).join("")
      :'<div class="empty"><div class="empty-txt">Kirim tarixi topilmadi</div></div>';

  document.getElementById("dstats").innerHTML=
    '<div class="stat-grid">'+
      '<div class="sbox tz-sbox"><div class="slbl">'+primaryLabel+'</div><div class="sval">'+primaryDisplay+' '+u+'</div></div>'+
      '<div class="sbox"><div class="slbl">'+horizon+' kunlik ehtiyoj</div><div class="sval">'+demandDisplay+' '+u+'</div></div>'+
      '<div class="sbox"><div class="slbl">Sof retail</div><div class="sval">'+fmtQty(pureRetailSum)+' '+u+'</div></div>'+
      '<div class="sbox" style="border-left:3px solid #EF9F27"><div class="slbl">Doimiy ulgurji (zakasga qo\'shildi)</div><div class="sval">'+fmtQty(tz.wiSum)+' '+u+'</div></div>'+
      '<div class="sbox" style="border-left:3px solid #E24B4A"><div class="slbl">Bir martalik ulgurji (chiqarildi)</div><div class="sval">'+fmtQty(tz.weSum)+' '+u+'</div></div>'+
      '<div class="sbox" style="grid-column:1/-1;background:#F8FAFC;border:1px solid #E2E8F0;"><div class="slbl">'+dd.length+' kunlik savdo</div><div class="sval">'+fmt(periodRevenue)+' UZS · '+fmtQty(periodQty)+' '+u+'</div></div>'+
    '</div>'+
    '<div style="margin-top:8px;padding:7px 10px;border-left:3px solid '+pat.color+';background:#F8FAFC;border-radius:0 7px 7px 0;font-size:10px;color:#4B5563;">'+
      '<b style="color:'+pat.color+'">Ajratish sababi:</b> '+separationReason+
    '</div>';

  const canvasWrap=document.getElementById("cwrap");
  canvasWrap.style.display="block";
  // Sana dropdownida grafik tarixi bo'limini ko'rsat
  const histSec=document.getElementById("dt-hist-section");
  if(histSec)histSec.style.display="block";
  const histOpts=[{v:90,l:t('dt_3m_hist')||"3 oy tarixi"},{v:180,l:t('dt_6m_hist')||"6 oy tarixi"},{v:"full",l:t('dt_from_jan')||"1-yanvardan"}];
  const histBar=document.getElementById("hist-range-bar");
  if(histBar){
    const loaded=histLoadState==="loaded";
    histBar.innerHTML=histOpts.map(o=>{
      const isActive=!p2HistCustom&&(p2HistDays===o.v);
      const disabled=!loaded;
      return'<button class="dt-preset'+(isActive?" dt-ps-active":"")+(disabled?" dt-hr-wait":"")+'"'
        +(disabled?' disabled title="Tarix yuklanmoqda..."':'')+' onclick="setHistDays('
        +(typeof o.v==="string"?'"'+o.v+'"':o.v)+'">'+o.l+'</button>';
    }).join("")
    +(histLoadState==="loading"?'<div class="hist-load-txt">&#8987; yuklanmoqda...</div>':"")
    +(histLoadState==="error"?'<div class="hist-load-txt" style="color:#E24B4A">&#9888; yuklanmadi</div>':"");
  }
  if(p2chart)p2chart.destroy();
  // HIST breakdown bo'lsa hs.wi/we/rt, bo'lmasa DAILY manba, HIST-only bo'lsa null
  const _wiD=hsHasBreakdown?hs.wi:(!hs?dwi:null);
  const _weD=hsHasBreakdown?hs.we:(!hs?dwe:null);
  const _rtD=hsHasBreakdown?hs.rt:(tz.pureRetail||null);
  const _stacked=!hs||hsHasBreakdown;
  const chartDatasets=(hs&&!hsHasBreakdown)?[
    // HIST mode, breakdown yo'q (eski data_history.json): faqat jami (1 rang)
    {label:"Jami sotilgan",data:dd,backgroundColor:"rgba(29,158,117,.72)",borderRadius:3},
    {type:"line",label:"Kunlik talab (30 kun o'rtacha): "+fmtRate(m.daily),data:new Array(dd.length).fill(m.daily),borderColor:"#534AB7",borderWidth:2,pointRadius:0,borderDash:[5,4]}
  ]:[
    {label:"Retail — odatiy savdo",data:_rtD||new Array(dd.length).fill(0),backgroundColor:"rgba(29,158,117,.72)",borderRadius:3,stack:"sales"},
    {label:"Doimiy ulgurji — takrorlanuvchi, zakasga qo'shilgan",data:_wiD||new Array(dd.length).fill(0),backgroundColor:"#EF9F27",borderRadius:3,stack:"sales"},
    {label:"Bir martalik ulgurji — favqulodda, zakasdan chiqarilgan",data:_weD||new Array(dd.length).fill(0),backgroundColor:"#E24B4A",borderRadius:3,stack:"sales"},
    {type:"line",label:"Kunlik talab: "+fmtRate(m.daily),data:new Array(dd.length).fill(m.daily),borderColor:"#534AB7",borderWidth:2,pointRadius:0,borderDash:[5,4]}
  ];
  p2chart=new Chart(document.getElementById("dc"),{
    type:"bar",
    data:{labels,datasets:chartDatasets},
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
            title:items=>labels[items[0].dataIndex],
            label:()=>null,
            afterBody:items=>{
              const day=items[0].dataIndex;
              if(hs&&!hsHasBreakdown){return["Jami: "+fmtQty(dd[day])+" "+u,"Daromad: "+fmt(dr&&dr[day]||0)+" UZS"];}
              const _rr=drr;
              const _wri=dwri;
              const _wre=dwre;
              const _totR=hs?((hs.rc&&hs.rc[day])||0):(dr?dr[day]||0:0);
              const _ret=(_rtD&&_rtD[day])||0;
              const _wi=(_wiD&&_wiD[day])||0;
              const _we=(_weD&&_weD[day])||0;
              const _tot=_ret+_wi+_we;
              return[
                "Retail: "+fmtQty(_ret)+" "+u+(_rr?" / "+(_rr[day]||0)+" chekda":""),
                "Doimiy ulgurji: "+fmtQty(_wi)+" "+u+(_wri?" / "+(_wri[day]||0)+" chekda":""),
                "Bir martalik: "+fmtQty(_we)+" "+u+(_wre?" / "+(_wre[day]||0)+" chekda":""),
                "─────────────────",
                "Jami: "+fmtQty(_tot)+" "+u+(_totR?" / "+_totR+" chekda":"")
              ];
            }
          }
        }
      },
      scales:{
        x:{stacked:_stacked,grid:{display:false},ticks:{font:{size:9},maxTicksLimit:_stacked?12:16}},
        y:{stacked:_stacked,grid:{color:"rgba(0,0,0,.05)"},ticks:{font:{size:9}}}
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
      '<div class="sbox"><div class="slbl">Sotuv narxi</div><div class="sval">'+(v.iprice||v.p||0).toLocaleString()+' UZS</div></div>'+
      '<div class="sbox"><div class="slbl">Kelish narxi</div><div class="sval">'+(v.suprice?v.suprice.toLocaleString()+' UZS':'—')+'</div></div>'+
      '<div class="sbox"><div class="slbl">Cheklar</div><div class="sval">'+(v.rec||0).toLocaleString()+'</div></div>'+
      '<div class="sbox"><div class="slbl">Davr</div><div class="sval">'+(_pavView?(v.pavm.f+" — "+v.pavm.t):(hs&&HISTMETA&&HISTMETA.labels?(HISTMETA.labels[hs.from]+" — "+HISTMETA.labels[hs.to]):(DMETA?DMETA.start+" — "+DMETA.end:"-")))+'</div></div>'+
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
// ABC guruh UMUMIY tushum (chakana+ulgurji) asosida hisoblanadi - ulgurji chiqarib
// tashlash faqat Zakas (buyurtma miqdori) hisobida qo'llaniladi, ABC'da emas.
// retRev/retRatio hali ham hisoblanadi - lekin faqat "Ulgurji ulushi" ko'rsatkichi
// (tafsilot panelida shaffoflik uchun) maqsadida, ABC guruhga ta'sir qilmaydi.
function recomputeABC(){if(!P3)return;const ra=_rangeActive();P3.forEach(v=>{v._off=ra&&(v.qty||0)<=0;let ratio=1;if(DAILY){const dl=dailyFor(v);if(dl){const t=dl.q.reduce((a,b)=>a+b,0);const w=dl.w.reduce((a,b)=>a+b,0);ratio=t>0?Math.max(0,(t-w)/t):1;}}v.retRev=(v.rev||0)*ratio;v.retRatio=ratio;});const act=P3.filter(v=>!v._off);const sorted=[...act].sort((a,b)=>b.rev-a.rev);const totRev=sorted.reduce((a,v)=>a+v.rev,0)||1;let cum=0;sorted.forEach((v,i)=>{cum+=v.rev;const p=cum/totRev;v.abc=p<=0.8?"A":p<=0.95?"B":"C";v.r=i+1;v.rp=Math.round(v.rev/totRev*100000)/1000;if(v.abc==="C"){v.sub=(v.di>20)?"C1":(v.tr==="down"?"C2":"C3");}else{v.sub=v.abc;}});P3.forEach(v=>{if(v._off){v.abc="";v.sub="";v.rp=0;}});}
// KPI kartochkalar/tab sonlari/donut/C1-C2-C3 chiplar - joriy FILTRGA mos holda
// (p3Match orqali) hisoblanadi, shuning uchun filtr o'zgarganda ham qayta chaqiriladi
// (p3ApplyFilters()'da), nafaqat sahifa ochilganda/sana oralig'i o'zgarganda.
// ─── P3: ABC TAHLILI ───
function _p3RenderSummary(){
  let A3=0,B3=0,C3=0,aV=0,bV=0,cV=0;
  P3.forEach(v=>{if(v._off||!p3Match(v,null))return;if(v.abc==="A"){A3++;aV+=v.rev;}else if(v.abc==="B"){B3++;bV+=v.rev;}else{C3++;cV+=v.rev;}});
  const tV3=(aV+bV+cV)||1,pA=aV/tV3*100,pB=bV/tV3*100,pC=cV/tV3*100;
  const setT=(id,txt)=>{const el=document.getElementById(id);if(el)el.textContent=txt;};
  setT("k3a-n",A3.toLocaleString());setT("k3b-n",B3.toLocaleString());setT("k3c-n",C3.toLocaleString());
  setT("k3a-s",Math.round(pA)+"% tushum · "+fmt(aV)+" UZS");setT("k3b-s",Math.round(pB)+"% tushum · "+fmt(bV)+" UZS");setT("k3c-s",Math.round(pC)+"% tushum · "+fmt(cV)+" UZS");
  setT("lg-a",Math.round(pA)+"%");setT("lg-b",Math.round(pB)+"%");setT("lg-c",Math.round(pC)+"%");
  const c1n=P3.filter(v=>!v._off&&v.sub==="C1"&&p3Match(v,null)).length;
  const c2n=P3.filter(v=>!v._off&&v.sub==="C2"&&p3Match(v,null)).length;
  const c3n=P3.filter(v=>!v._off&&v.sub==="C3"&&p3Match(v,null)).length;
  setT("tab-A-n",A3.toLocaleString());setT("tab-B-n",B3.toLocaleString());setT("tab-C-n",C3.toLocaleString());setT("tab-C1-n",c1n.toLocaleString());
  const chipsEl=document.getElementById("k3c-chips");if(chipsEl)chipsEl.innerHTML='<span class="badge b-c1" title="'+esc(t("abc3_c1_hint"))+'">C1 '+c1n.toLocaleString()+'</span> <span class="badge b-c2" title="'+esc(t("abc3_c2_hint"))+'">C2 '+c2n.toLocaleString()+'</span> <span class="badge b-c3" title="'+esc(t("abc3_c3_hint"))+'">C3 '+c3n.toLocaleString()+'</span>';
  if(donut3Chart){donut3Chart.destroy();}
  donut3Chart=new Chart(document.getElementById("donut3"),{type:"doughnut",data:{labels:["A guruh","B guruh","C guruh"],datasets:[{data:[pA,pB,pC],backgroundColor:["#1D9E75","#EF9F27","#E24B4A"],borderWidth:0,hoverOffset:6}]},options:{responsive:true,maintainAspectRatio:false,cutout:"60%",onClick:(_e,els)=>{if(els&&els.length){const tab=["A","B","C"][els[0].index];const btn=document.querySelector('.atab[data-tab="'+tab+'"]');if(btn)setTab(btn);}},plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>c.label+": "+c.parsed.toFixed(1)+"%"}}}}});
}
async function initP3(){
await _ensureDailyDemand();await _enrichWithInventory(P3);
if(_rangeActive())_winArr(P3);recomputeABC();
_p3RenderSummary();
renderMonthly3();
p3RenderMonthMenu();
p3FillFilters();p3FCount();
sselAttach("p3f-cat");sselAttach("p3f-sup");
curRows3=getRows3(curTab3);renderTable3(curRows3);}
function getRows3(tab){const base=tab==="A"?(v=>v.abc==="A"):tab==="B"?(v=>v.abc==="B"):tab==="C"?(v=>v.abc==="C"):(v=>v.sub==="C1");return P3.filter(v=>!v._off&&base(v)&&p3Match(v,null));}
const P3FF=[{id:"p3f-cat",k:v=>v.cat},{id:"p3f-sup",k:v=>v.sup},{id:"p3f-type",k:v=>v.itype}];
function p3gv(id){const e=document.getElementById(id);return e?e.value:"";}
function p3Match(v,skip){const fc=p3gv("p3f-cat"),fs=p3gv("p3f-sup"),ft=p3gv("p3f-type"),ftr=p3gv("p3f-tr");if(skip!=="p3f-cat"&&fc&&v.cat!==fc)return false;if(skip!=="p3f-sup"&&fs&&v.sup!==fs)return false;if(skip!=="p3f-type"&&ft&&v.itype!==ft)return false;if(skip!=="p3f-tr"&&ftr&&v.tr!==ftr)return false;return true;}
function p3UniqWhere(kf,skip){const s=new Set();P3.forEach(v=>{if(!v._off&&p3Match(v,skip)){const x=kf(v);if(x)s.add(x);}});return[...s].sort((a,b)=>String(a).localeCompare(String(b),"ru"));}
function p3RebuildSel(id,opts,cur){const sel=document.getElementById(id);if(!sel)return;sel.innerHTML="";const o0=document.createElement("option");o0.value="";o0.textContent=t("filt_all");sel.appendChild(o0);opts.forEach(v=>{const o=document.createElement("option");o.value=v;o.textContent=v;sel.appendChild(o);});sel.value=(cur&&opts.includes(cur))?cur:"";sel.className=sel.value?"on":"";if(sel._sselSync)sel._sselSync();}
function p3FillFilters(){if(!P3)return;P3FF.forEach(f=>{const cur=p3gv(f.id);const opts=p3UniqWhere(f.k,f.id);p3RebuildSel(f.id,opts,cur);});}
function p3FCount(){const ids=["p3f-cat","p3f-sup","p3f-type","p3f-tr"];let n=0;ids.forEach(id=>{const e=document.getElementById(id);if(e&&e.value)n++;});const b=document.getElementById("p3-fcount");if(b)b.textContent=n?"("+n+")":"";const btn=document.getElementById("p3-fbtn");if(btn)btn.classList.toggle("has",n>0);}
function p3FToggle(e){if(e)e.stopPropagation();const p=document.getElementById("p3-fpop");if(p)p.classList.toggle("open");p3FillFilters();}
function p3ApplyFilters(){p3FillFilters();p3FCount();_p3RenderSummary();curRows3=getRows3(curTab3);renderTable3(curRows3);}
function p3Clear(){["p3f-cat","p3f-sup","p3f-type","p3f-tr"].forEach(id=>{const e=document.getElementById(id);if(e)e.value="";});p3ApplyFilters();}
document.addEventListener("click",function(e){const w=document.querySelector(".p3-fwrap");const p=document.getElementById("p3-fpop");if(w&&p&&!w.contains(e.target))p.classList.remove("open");});
function kpi3Jump(tab){const b=document.querySelector('.atab[data-tab="'+tab+'"]');if(b)setTab(b);}
// ── p3 oy tanlash (joriy 30-kunlik oynadagi kalendar oylar) ──
const MONTHS_UZ_SHORT=["Yanvar","Fevral","Mart","Aprel","May","Iyun","Iyul","Avgust","Sentabr","Oktabr","Noyabr","Dekabr"];
function _p3MonthsInWindow(){
  if(!P1FULL||!P1FULL.dates)return[];
  const dates=P1FULL.dates,out=[];let cur=null;
  dates.forEach((dstr,i)=>{const ym=dstr.slice(0,7);if(!cur||cur.ym!==ym){cur={ym,label:MONTHS_UZ_SHORT[+dstr.slice(5,7)-1],from:i,to:i};out.push(cur);}cur.to=i;});
  return out;
}
function p3MonthLabel(){const months=_p3MonthsInWindow();if(!months.length)return"";const a=GRA==null?0:GRA,b=GRB==null?(P1FULL.days-1):GRB;const hit=months.find(m=>a>=m.from&&b<=m.to)||months[months.length-1];return hit.label;}
function p3ToggleMonthMenu(e){if(e)e.stopPropagation();const dd=document.getElementById("p3-month-dd");if(dd)dd.classList.toggle("open");}
function p3PickMonth(a,b,e){if(e)e.stopPropagation();_dtApplyRange(a,b);const dd=document.getElementById("p3-month-dd");if(dd)dd.classList.remove("open");}
function p3RenderMonthMenu(){
  const wrap=document.getElementById("p3-month-dd");if(!wrap)return;
  if(typeof ensureSupplierProductTableStyles==="function")ensureSupplierProductTableStyles();
  const months=_p3MonthsInWindow();if(!months.length){wrap.innerHTML="";return;}
  const curLbl=p3MonthLabel();
  wrap.innerHTML='<button class="sp-month-current" type="button" onclick="p3ToggleMonthMenu(event)">'+esc(curLbl)+'</button><div class="sp-month-menu">'+
    months.map(m=>'<button class="sp-month-option'+(m.label===curLbl?" active":"")+'" type="button" onclick="p3PickMonth('+m.from+','+m.to+',event)">'+esc(m.label)+'</button>').join("")+'</div>';
}
document.addEventListener("click",function(e){const dd=document.getElementById("p3-month-dd");if(dd&&!dd.contains(e.target))dd.classList.remove("open");});
// ── p3 oylik hisobot (data_history.json asosida, umumiy tushum tendensiyasi) ──
// data_history.json (o'nlab MB, har SKU/kun bo'yicha) o'rniga backend har build'da
// oldindan hisoblab qo'ygan KICHIK oylik jami tushum faylini o'qiydi (data_monthly_rev.json,
// bir necha yuz bayt) - shu sabab bu grafik darhol (sekin fetch/parse'siz) ochiladi.
function _loadMonthlyRev(){
  if(MONTHLY_REV_DATA)return Promise.resolve(MONTHLY_REV_DATA);
  if(_monthlyRevLoadPromise)return _monthlyRevLoadPromise;
  _monthlyRevLoadPromise=fetch("data_monthly_rev.json",{cache:"no-store"})
    .then(r=>r.ok?r.json():null)
    .then(d=>{MONTHLY_REV_DATA=(d&&d.months)||[];return MONTHLY_REV_DATA;})
    .catch(()=>{MONTHLY_REV_DATA=[];return MONTHLY_REV_DATA;});
  return _monthlyRevLoadPromise;
}
function renderMonthly3(){
  const canvas=document.getElementById("monthly3");if(!canvas)return;
  _loadMonthlyRev().then(buckets=>{
    if(!buckets||!buckets.length)return;
    const last=buckets[buckets.length-1],prev=buckets.length>1?buckets[buckets.length-2]:null;
    const pct=(prev&&prev.rev>0)?Math.round((last.rev-prev.rev)/prev.rev*1000)/10:null;
    const statEl=document.getElementById("monthly3-stat");
    if(statEl){
      const arrow=pct==null?"":(pct>=0?"▲":"▼");
      const color=pct==null?"#888":(pct>=0?"#1D9E75":"#E24B4A");
      statEl.innerHTML='<span style="font-size:20px;font-weight:700;color:#1a1a2e;">'+Math.round(last.rev).toLocaleString()+' UZS</span> <span style="color:#888;font-size:11px;">('+last.label+')</span>'+(pct==null?"":' <span style="color:'+color+';font-weight:700;font-size:12px;margin-left:6px;">'+arrow+' '+Math.abs(pct)+'% '+esc(t("oylik_prev"))+'</span>');
    }
    if(monthly3Chart)monthly3Chart.destroy();
    const n=buckets.length;
    monthly3Chart=new Chart(canvas,{type:"bar",data:{labels:buckets.map(b=>b.label),datasets:[{data:buckets.map(b=>+(b.rev/1e6).toFixed(1)),backgroundColor:buckets.map((_b,i)=>i===n-1?"#534AB7":"rgba(83,74,183,0.35)"),borderRadius:6,borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>Math.round(c.parsed.y*1e6).toLocaleString()+" UZS"}}},scales:{x:{grid:{display:false},ticks:{font:{size:10}}},y:{grid:{color:"rgba(0,0,0,0.06)"},ticks:{font:{size:9},callback:v=>fmt(v*1e6)}}}}});
  });
}
function sotuv(di){if(di>=900)return["b-bad",t("sotuv_yoq_davr")];if(di===0)return["b-ok",t("oxirgi_kuni_sotildi")];if(di<=14)return["b-w",di+" "+t("kun_oldin")];return["b-bad",di+" "+t("kun_oldin")];}
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
function renderTable3(rows){const q=nn2(document.getElementById("srch3").value);let filtered=rows;if(q){filtered=P3.filter(v=>!v._off&&p3Match(v,null)&&nn2(v.name).includes(q));if(filtered.length>0){const fv=filtered[0];const tt=fv.sub==="C1"?"C1":fv.abc;if(tt!==curTab3){curTab3=tt;document.querySelectorAll(".atab").forEach(b=>b.className="atab");document.querySelectorAll(".atab").forEach(b=>{if(b.dataset.tab===tt)b.className="atab sel-"+tt;});curRows3=getRows3(tt);}}}if(p3Sort.key){const k=p3Sort.key,dir=p3Sort.dir;const gv=v=>{switch(k){case "name":return (v.name||"").toLowerCase();case "cat":return (v.cat||"").toLowerCase();case "rev":return v.rev||0;case "rec":return v.rec||0;case "di":return v.di||0;case "abc":return v.abc||"~";default:return 0;}};filtered=[...filtered].sort((a,b)=>{const av=gv(a),bv=gv(b);if(typeof av==="string")return dir*av.localeCompare(bv,"ru");return dir*(av-bv);});}document.querySelectorAll("#p3-table thead th").forEach(th=>{th.classList.remove("z-sort-asc","z-sort-desc");if(p3Sort.key&&th.dataset.sortkey===p3Sort.key)th.classList.add(p3Sort.dir>0?"z-sort-asc":"z-sort-desc");});document.getElementById("tcnt").textContent=filtered.length.toLocaleString()+" "+t("p2_cnt_suffix");const max=Math.min(filtered.length,500);const rows2=[];for(let i=0;i<max;i++){const v=filtered[i];const idx=P3.indexOf(v);const[sc,st]=sotuv(v.di);const sub=v.sub?'<span class="badge '+(v.sub==="C1"?"b-c1":v.sub==="C2"?"b-c2":"b-c3")+'">'+v.sub+"</span>":"";rows2.push('<tr data-idx="'+idx+'" onclick="showDetail3('+idx+')"><td style="color:#bbb;">'+v.r+'</td><td style="font-weight:500;">'+esc(v.name)+'</td><td style="color:#888;">'+esc(v.cat.substring(0,20))+'</td><td style="font-weight:700;color:#1D9E75;">'+fmt(v.rev)+'</td><td>'+v.rec.toLocaleString()+'</td><td style="color:'+(v.di>7?"#E24B4A":"#1D9E75")+';">'+v.ld+'</td><td><span class="badge '+sc+'">'+st+'</span></td><td><span class="badge b-'+v.abc+'">'+v.abc+'</span></td></tr>');}if(!rows2.length)rows2.push('<tr><td colspan="8" style="text-align:center;padding:20px;color:#bbb;">'+t("topilmadi")+'</td></tr>');document.getElementById("tbody3").innerHTML=rows2.join("");document.getElementById("detail3").style.display="none";}
function setTab(btn){const tab=btn.dataset.tab;curTab3=tab;document.querySelectorAll(".atab").forEach(b=>b.className="atab");btn.className="atab sel-"+tab;document.getElementById("srch3").value="";curRows3=getRows3(tab);renderTable3(curRows3);}
function filterTable(){renderTable3(curRows3);}
function _trendUz(tr){return tr==="up"?"o'sish":tr==="down"?"pasayish":tr==="new"?"yangi paydo bo'lish":"barqaror";}
function genWhyHow3(v){
  const dl=dailyFor(v);
  const days=(DMETA&&DMETA.days)||1;
  const active=dl&&dl.m?(dl.m.activeDays||0):0;
  const trendUz=_trendUz(dl&&dl.m?(dl.m.trend||"stable"):(v.tr||"stable"));
  const rev=v.rev||0,qty=v.qty||0,rec=v.rec||0;
  const di=Math.min(v.di||0,days);
  const dayAvg=days?Math.round((qty/days)*10)/10:0;
  let why,how;
  if(v.abc==="A"){
    why=["Daromadning 80% ini ta'minlovchi muhim mahsulot","Oyda "+rec+" ta chekda sotilgan — yuqori talab","Savdo "+trendUz+" tendensiyasida","Zaxira tugashi butun savdoga zarar keltiradi"];
    how=["Zaxira hech qachon tugamasligini ta'minlash (safety stock oshirish)","Yetkazib beruvchi bilan uzoq muddatli shartnoma tuzish","Savdo hajmini haftalik monitoring qilish"];
  }else if(v.abc==="B"){
    why=["Daromad ulushi 15% oralig'ida — o'rta muhimlikdagi mahsulot","Oyda "+rec+" ta chekda sotilgan","Savdo "+trendUz+" tendensiyasida","A guruhiga o'tish imkoniyati mavjud"];
    how=["Savdo hajmini oshirish uchun A guruh mahsulotlari bilan birga taklif qilish","Zaxira darajasini optimallashtirish — haddan oshiq buyurtma qilmaslik","Aksiya vaqtida e'tibor berish — B dan A ga o'tkazish mumkin"];
  }else if(v.sub==="C1"){
    why=["So'nggi "+di+" kun ichida savdo kuzatilmadi","Oylik daromad juda past ("+Math.round(rev/1000)+"K so'm)","Jami "+active+" kun aktiv savdo bo'lgan ("+days+" kundan)","Omborda qoldiq to'planib qolishi xavfi bor"];
    how=["Chegirma yoki aksiya bilan qolgan zaxirani sotish","Yangi buyurtma to'xtatish","30 kun ichida savdo bo'lmasa assortimentdan chiqarish"];
  }else if(v.sub==="C2"){
    why=["Savdo hajmi pasayish tendensiyasida","Faqat "+rec+" ta chekda sotilgan (kam talab)","Mijozlar boshqa alternativlarga o'tmoqda","Daromad ulushi 5% dan past"];
    how=["Mahsulotni ko'p sotiluvchi mahsulotlar yonida joylash","Narxni raqobatchilar bilan solishtirish","Minimum zaxira darajasini kamaytirib, buyurtma hajmini qisqartirish"];
  }else{
    why=["Mahsulot past chastotada, lekin barqaror sotiladi","O'rtacha "+dayAvg+" dona/kun savdo (past hajm)","Umumiy daromad ulushi 5% dan past","Savdo barqaror lekin hajm kichik"];
    how=["Buyurtma hajmini minimal darajada ushlab turish","Savat tahlili asosida ko'p sotiluvchi mahsulotlar yoniga joylashtirish","Agar 2 oy ketma-ket C bo'lsa, assortiment qayta ko'rib chiqish"];
  }
  return {why,how};
}
function showDetail3(idx){const v=P3[idx];if(!v)return;const u=v.kg?"kg":"dona";const[sc,st]=sotuv(v.di);document.querySelectorAll("tr.sel").forEach(r=>r.classList.remove("sel"));const row=document.querySelector('tr[data-idx="'+idx+'"]');if(row){row.classList.add("sel");row.scrollIntoView({block:"nearest"});}document.getElementById("d3-name").textContent=v.name;document.getElementById("detail3").className="detail d"+v.abc;let bdg='<span class="badge b-'+v.abc+'" style="font-size:11px;padding:3px 9px;">'+v.abc+' guruh</span>';if(v.sub){const sc2=v.sub==="C1"?"b-c1":v.sub==="C2"?"b-c2":"b-c3";bdg+=' <span class="badge '+sc2+'" style="font-size:11px;padding:3px 9px;">'+v.sub+'</span>';}if(v.kg)bdg+=' <span class="badge" style="background:#EAF3DE;color:#27500A;font-size:11px;padding:3px 9px;">'+t("kg_tovar")+'</span>';document.getElementById("d3-badges").innerHTML=bdg;const wsPct=Math.round((1-(v.retRatio!=null?v.retRatio:1))*100);const wsColor=wsPct>=50?"#E24B4A":wsPct>=15?"#EF9F27":"#1D9E75";document.getElementById("d3-stats").innerHTML='<div class="ds"><div class="ds-l">'+t("jami_tushum")+'</div><div class="ds-v" style="color:#1D9E75;">'+fmt(v.rev)+' UZS</div></div><div class="ds"><div class="ds-l">'+t("narxi_1")+' '+u+')</div><div class="ds-v">'+v.p.toLocaleString()+' UZS</div></div><div class="ds"><div class="ds-l">'+t("cheklar_soni")+'</div><div class="ds-v">'+v.rec.toLocaleString()+'</div></div><div class="ds"><div class="ds-l">'+t("tushum_ulushi")+'</div><div class="ds-v">'+(v.rp||0).toFixed(3)+'%</div></div><div class="ds"><div class="ds-l">'+t("oxirgi_sotilgan")+'</div><div class="ds-v" style="color:'+(v.di>7?"#E24B4A":"#1D9E75")+';">'+v.ld+'</div></div><div class="ds"><div class="ds-l">'+t("th_sotuv_holati2")+'</div><div class="ds-v"><span class="badge '+sc+'">'+st+'</span></div></div><div class="ds"><div class="ds-l">'+t("kunlik_ortacha")+'</div><div class="ds-v">'+(v.qty/((DMETA&&DMETA.days)||31)).toFixed(v.kg?2:1)+' '+u+'</div></div><div class="ds"><div class="ds-l">'+t("jami_sotilgan")+'</div><div class="ds-v">'+v.qty.toFixed(v.kg?2:0)+' '+u+'</div></div><div class="ds"><div class="ds-l">'+t("ulgurji_ulushi")+'</div><div class="ds-v" style="color:'+wsColor+';" title="'+esc(t("ulgurji_ulushi_hint"))+'">'+wsPct+'%</div></div>';const {why,how:howArr}=genWhyHow3(v);const whyHtml=why.map(w=>'<div class="bx-item"><div class="bx-dot"></div><div class="bx-txt">'+esc(w)+'</div></div>').join("");const howHtml=howArr.map((h,i)=>'<div class="bx-item"><div class="bx-num">'+(i+1)+'.</div><div class="bx-txt">'+esc(h)+'</div></div>').join("");document.getElementById("d3-ra").innerHTML='<div class="box bx-why"><div class="bx-t">'+t("nega_guruhda")+' '+v.abc+' '+t("guruhda_savol")+'</div>'+whyHtml+'</div><div class="box bx-'+v.abc+'"><div class="bx-t">'+t("nima_qk")+'</div>'+howHtml+'</div>';const dw=document.getElementById("detail3");dw.style.display="block";setTimeout(()=>dw.scrollIntoView({behavior:"smooth",block:"nearest"}),50);}
function p2FCount(){const ids=["pf-cat","pf-sub","pf-type","pf-sup","pf-amt","pf-abc"];let n=0;ids.forEach(id=>{const e=document.getElementById(id);if(e&&e.value)n++;});const b=document.getElementById("p2-fcount");if(b)b.textContent=n?"("+n+")":"";const btn=document.getElementById("p2-fbtn");if(btn)btn.classList.toggle("has",n>0);}
function p2FToggle(e){if(e)e.stopPropagation();const p=document.getElementById("p2-fpop");if(p)p.classList.toggle("open");p2FCount();}
document.addEventListener("click",function(e){const w=document.querySelector(".p2-fwrap");const p=document.getElementById("p2-fpop");if(w&&p&&!w.contains(e.target))p.classList.remove("open");});
document.addEventListener("click",function(e){const b=document.getElementById("z-fbtn");const p=document.getElementById("z-fpop");if(b&&p&&!b.contains(e.target)&&!p.contains(e.target))p.classList.remove("open")   ;});
document.addEventListener("click",function(e){const dd=document.getElementById("sp-month-dd");if(dd&&!dd.contains(e.target))dd.classList.remove("open");});
document.addEventListener("keydown",function(e){if(e.key==="Escape"){const m=document.getElementById("zk-prod-modal");if(m&&m.style.display==="flex")zkCloseProdModal();}});

// ─── P6 Supplier Tahlili ───
function initP6(){
  if(!P6)return;
  if(p6CardMonth==null)p6CardMonth=p6LatestMonthIndex();
  renderP6();
}
function p6SetFilter(f){
  p6CurF=f;p6Page=1;p6SelI=null;
  document.querySelectorAll(".sp-card").forEach(c=>c.classList.remove("sp-selected"));
  if(f!=="all"){const el=document.getElementById("sp-card-"+f);if(el)el.classList.add("sp-selected");}
  renderP6();
}
// 2026-08-12: og'ir qism (renderP6) faqat Enter bosilganda.
function p6SearchInput(){
  const inp=document.getElementById("sp-q");
  const clr=document.getElementById("sp-clear");
  if(clr)clr.style.display=(inp&&inp.value)?"inline-block":"none";
}
function p6SearchSubmit(){
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
function p6Go(page){p6Page=page;renderP6();const w=document.querySelector(".sp-tbl-wrap");if(w)w.scrollTop=0;}
function _p6SafeName(s){return String(s||"").replace(/[\\/:*?"<>|\[\]]/g,"_");}
// Excel ish varag'i nomi bitta qo'shtirnoq (') bilan boshlana yoki tugay olmaydi
// (OOXML qoidasi) - ko'p supplier nomlari ''NOM'' shaklida boshlangani uchun
// _p6SafeName+slice(0,31) yetarli emas edi (31-belgida kesish ham yangi
// chetki qo'shtirnoq hosil qilishi mumkin) - shuning uchun kesishdan KEYIN ham
// chetlardagi qo'shtirnoqlar tozalanadi.
function _p6SafeSheetName(s){
  let n=_p6SafeName(s).slice(0,31).replace(/^'+|'+$/g,"").trim();
  return n||"Supplier";
}
async function exportSuppliersXLSX(){
  await _ensureExcelJS();
  if(!P6||typeof ExcelJS==="undefined")return;
  let items=p6MonthItems();
  if(p6CurF!=="all")items=items.filter(s=>p6MonthAbc(s)===p6CurF);
  if(p6Q)items=items.filter(s=>s.name.toLowerCase().includes(p6Q));
  const abcColor={A:"1D9E75",B:"534AB7",C:"EF9F27"};
  const modeLabels={rev:t("sp_stat_tushum"),profit:t("sp_stat_foyda"),marja:t("sp_stat_marja")};
  const totalCols=2+P6_MONTH_KEYS.length;
  const colLetter=n=>String.fromCharCode(64+n);
  const wb=new ExcelJS.Workbook();
  const ws=wb.addWorksheet(t("nav_p6"),{views:[{state:"frozen",ySplit:2}]});
  ws.mergeCells(`A1:${colLetter(totalCols)}1`);
  ws.getCell("A1").value=`${t("sp_group_by")}: ${modeLabels[p6ValueMode]}`;
  ws.getCell("A1").font={bold:true,size:11,color:{argb:"FFFFFF"}};
  ws.getCell("A1").alignment={horizontal:"center",vertical:"middle"};
  ws.getCell("A1").fill={type:"pattern",pattern:"solid",fgColor:{argb:"534AB7"}};
  ws.getRow(1).height=22;
  ws.addRow(["#",t("sp_col_name"),...P6_MONTH_KEYS.map(k=>t(k))]);
  ws.getRow(2).eachCell(c=>{
    c.font={bold:true,color:{argb:"FFFFFF"}};
    c.fill={type:"pattern",pattern:"solid",fgColor:{argb:"1D9E75"}};
    c.alignment={horizontal:"center",vertical:"middle"};
  });
  items.forEach((s,i)=>{
    const row=ws.addRow([i+1,s.name,...P6_MONTH_KEYS.map((_,mi)=>{
      const me=s.months&&s.months[mi];
      if(!me)return"—";
      if(p6ValueMode==="marja")return(me.marja||0)+"%";
      return(p6ValueMode==="rev"?me.abc:me.abc_profit)||"—";
    })]);
    row.getCell(2).alignment={horizontal:"left"};
    for(let mi=0;mi<P6_MONTH_KEYS.length;mi++){
      const cell=row.getCell(3+mi);
      if(abcColor[cell.value])cell.font={bold:true,color:{argb:abcColor[cell.value]}};
      cell.alignment={horizontal:"center"};
    }
  });
  ws.columns=[{width:6},{width:38},...P6_MONTH_KEYS.map(()=>({width:9}))];
  const buf=await wb.xlsx.writeBuffer();
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([buf],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));
  a.download=`taminotchilar_${new Date().toISOString().slice(0,10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(a.href);
}
async function exportP6DetailXLSX(){
  await _ensureExcelJS();
  if(!P6||p6SelI==null||typeof ExcelJS==="undefined")return;
  const S=P6.suppliers.find(x=>x.r===p6SelI);
  if(!S)return;
  const abcColor={A:"1D9E75",B:"534AB7",C:"EF9F27"};
  const modeLabels={rev:t("sp_stat_tushum"),profit:t("sp_stat_foyda"),marja:t("sp_stat_marja")};
  const colLetter=n=>String.fromCharCode(64+n);
  const totalCols=3+P6_MONTH_KEYS.length;
  const st=_p6MonthStats(S,p6CardMonth);
  const monthName=P6_MONTHS_NOW()[p6CardMonth]||P6_MONTHS_NOW()[p6LatestMonthIndex()]||"";
  const wb=new ExcelJS.Workbook();
  const ws=wb.addWorksheet(_p6SafeSheetName(S.name),{views:[{state:"frozen",ySplit:4}]});
  ws.mergeCells(`A1:${colLetter(totalCols)}1`);
  ws.getCell("A1").value=S.name;
  ws.getCell("A1").font={bold:true,size:13,color:{argb:"FFFFFF"}};
  ws.getCell("A1").alignment={horizontal:"center",vertical:"middle"};
  ws.getCell("A1").fill={type:"pattern",pattern:"solid",fgColor:{argb:"534AB7"}};
  ws.getRow(1).height=24;
  ws.mergeCells(`A2:${colLetter(totalCols)}2`);
  ws.getCell("A2").value=`${t("sp_month_select")}: ${monthName}   |   ${t("sp_group_by")}: ${modeLabels[p6ValueMode]}`;
  ws.getCell("A2").font={bold:true,size:11,color:{argb:"1D9E75"}};
  ws.getCell("A2").alignment={horizontal:"center",vertical:"middle"};
  ws.mergeCells(`A3:${colLetter(totalCols)}3`);
  ws.getCell("A3").value=`${t("sp_stat_tushum")}: ${_p6FmtSom(st.rev)}   |   ${t("sp_stat_tannarx")}: ${_p6FmtSom(st.cost)}   |   ${t("sp_stat_foyda")}: ${_p6FmtSom(st.profit)}   |   ${t("sp_stat_jami")}: ${st.jami} ${t("sp_ta")}   |   A: ${st.a}   B: ${st.b}   C: ${st.c}`;
  ws.getCell("A3").font={size:10.5,color:{argb:"444444"}};
  ws.getCell("A3").alignment={horizontal:"center",vertical:"middle"};
  ws.getRow(3).height=20;
  ws.addRow(["#",t("sp_prod_name"),"SKU",...P6_MONTH_KEYS.map(k=>t(k))]);
  ws.getRow(4).eachCell(c=>{
    c.font={bold:true,color:{argb:"FFFFFF"}};
    c.fill={type:"pattern",pattern:"solid",fgColor:{argb:"1D9E75"}};
    c.alignment={horizontal:"center",vertical:"middle"};
  });
  _p6DetailProds.forEach((p,i)=>{
    const row=ws.addRow([i+1,p.name,p.sku||"",...p.months.map(me=>{
      if(!me)return"—";
      if(p6ValueMode==="marja")return(me.marja||0)+"%";
      return(p6ValueMode==="rev"?me.abc:me.abc_profit)||me.abc||"—";
    })]);
    row.getCell(2).alignment={horizontal:"left"};
    for(let mi=0;mi<P6_MONTH_KEYS.length;mi++){
      const cell=row.getCell(4+mi);
      if(abcColor[cell.value])cell.font={bold:true,color:{argb:abcColor[cell.value]}};
      cell.alignment={horizontal:"center"};
    }
  });
  ws.columns=[{width:6},{width:38},{width:12},...P6_MONTH_KEYS.map(()=>({width:9}))];
  const buf=await wb.xlsx.writeBuffer();
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([buf],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));
  a.download=`${_p6SafeName(S.name)}_${new Date().toISOString().slice(0,10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(a.href);
}
async function exportP6MzXLSX(){
  await _ensureExcelJS();
  if(!P6||p6SelI==null||typeof ExcelJS==="undefined")return;
  const S=P6.suppliers.find(x=>x.r===p6SelI);
  if(!S)return;
  const items=_p6MzViewItems&&_p6MzViewItems.length?_p6MzViewItems:_p6MzAllItems;
  if(!items.length)return;
  const wb=new ExcelJS.Workbook();
  const ws=wb.addWorksheet(_p6SafeSheetName(S.name),{views:[{state:"frozen",ySplit:2}]});
  ws.mergeCells("A1:H1");
  ws.getCell("A1").value=S.name;
  ws.getCell("A1").font={bold:true,size:13,color:{argb:"FFFFFF"}};
  ws.getCell("A1").alignment={horizontal:"center",vertical:"middle"};
  ws.getCell("A1").fill={type:"pattern",pattern:"solid",fgColor:{argb:"EF9F27"}};
  ws.getRow(1).height=24;
  ws.addRow(["#",t("sp_mz_prod"),t("sp_mz_stock"),t("sp_mz_buy"),t("sp_mz_frozen"),t("sp_mz_sell"),t("sp_mz_days"),t("sp_mz_lastkirim")]);
  ws.getRow(2).eachCell(c=>{
    c.font={bold:true,color:{argb:"FFFFFF"}};
    c.fill={type:"pattern",pattern:"solid",fgColor:{argb:"EF9F27"}};
    c.alignment={horizontal:"center",vertical:"middle"};
  });
  items.forEach((v,i)=>{
    const diTxt=v.di>=999?"60+":String(v.di||0);
    const lastKirim=krFmtDate(krLastDate(v.sku))||"—";
    const row=ws.addRow([i+1,v.name,v.kg?+(v.stock||0).toFixed(2):Math.round(v.stock||0),Math.round(v.sp||0),Math.round(v.frozenVal||0),Math.round(v.rp||0),diTxt,lastKirim]);
    row.getCell(2).alignment={horizontal:"left"};
    row.getCell(3).numFmt=v.kg?"#,##0.00":"#,##0";
    row.getCell(4).numFmt='#,##0 "so\'m"';
    row.getCell(5).numFmt='#,##0 "so\'m"';
    row.getCell(5).font={bold:true,color:{argb:"EF9F27"}};
    row.getCell(6).numFmt='#,##0 "so\'m"';
    for(let c=3;c<=6;c++)row.getCell(c).alignment={horizontal:"right"};
  });
  ws.columns=[{width:6},{width:38},{width:11},{width:15},{width:18},{width:15},{width:11},{width:14}];
  const buf=await wb.xlsx.writeBuffer();
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([buf],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));
  a.download=`${_p6SafeName(S.name)}_sotilmayotgan_${new Date().toISOString().slice(0,10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(a.href);
}
const _P6_ALL_MON=["sp_mon_yan","sp_mon_fev","sp_mon_mar","sp_mon_apr","sp_mon_may","sp_mon_iyun","sp_mon_iyul","sp_mon_avg","sp_mon_sen","sp_mon_okt","sp_mon_noy","sp_mon_dek"];
const P6_MONTH_KEYS=_P6_ALL_MON.slice(0,new Date().getMonth()+1);
function P6_MONTHS_NOW(){return P6_MONTH_KEYS.map(k=>t(k));}
function p6LatestMonthIndex(){
  if(!P6||!P6.suppliers)return P6_MONTH_KEYS.length-1;
  for(let i=P6_MONTH_KEYS.length-1;i>=0;i--){
    if(P6.suppliers.some(s=>s.months&&s.months[i]))return i;
  }
  return P6_MONTH_KEYS.length-1;
}
function p6MonthEntry(s){return s&&s.months&&p6CardMonth!=null?s.months[p6CardMonth]:null;}
function p6MonthAbc(s){
  const me=p6MonthEntry(s);
  if(!me)return s.abc;
  return (p6ValueMode==="rev"?me.abc:me.abc_profit)||me.abc||"C";
}
function p6SetValueMode(mode){
  if(p6ValueMode===mode)return;
  p6ValueMode=mode;
  p6ListSortMi=null;p6ListSortDir=1;
  renderP6();
}
function p6ListSortBy(mi){
  if(p6ListSortMi===mi){p6ListSortDir=-p6ListSortDir;}else{p6ListSortMi=mi;p6ListSortDir=1;}
  p6Page=1;
  renderP6();
}
function _p6MarjaTier(marja){
  if(marja>=20)return"a";
  if(marja>=10)return"b";
  return"c";
}
function p6MonthItems(){
  return (P6&&P6.suppliers?P6.suppliers:[]).filter(s=>p6MonthEntry(s));
}
function p6SetCardMonth(mi){
  p6CardMonth=mi;renderP6();
}
function p6ToggleMonthMenu(e){
  if(e)e.stopPropagation();
  const dd=document.getElementById("sp-month-dd");
  if(dd)dd.classList.toggle("open");
}
function p6PickCardMonth(mi,e){
  if(e)e.stopPropagation();
  const dd=document.getElementById("sp-month-dd");
  if(dd)dd.classList.remove("open");
  p6SetCardMonth(mi);
}
function renderP6(){
  if(!P6)return;
  ensureSupplierProductTableStyles();
  if(p6CardMonth==null)p6CardMonth=p6LatestMonthIndex();
  renderP6MonthControls();
  renderP6Cards();
  const tblWrap=document.querySelector(".sp-tbl-wrap");
  const savedSL=tblWrap?tblWrap.scrollLeft:0;
  const savedWY=window.scrollY;
  const headRow=document.getElementById("sp-head-row");
  if(headRow){
    let hh=`<th class="sp-th-idx">#</th><th class="sp-th-name">${esc(t("sp_col_name"))}</th>`;
    P6_MONTH_KEYS.forEach((k,mi)=>{
      const isSorted=p6ListSortMi===mi;
      const arrow=isSorted?(p6ListSortDir===1?" ↑":" ↓"):"";
      hh+=`<th class="sp-th-mon" style="cursor:pointer;user-select:none${isSorted?";color:#1D9E75":""}" onclick="p6ListSortBy(${mi})">${esc(t(k))}${arrow}</th>`;
    });
    headRow.innerHTML=hh;
  }
  let items=p6MonthItems();
  if(p6CurF!=="all")items=items.filter(s=>p6MonthAbc(s)===p6CurF);
  if(p6Q)items=items.filter(s=>s.name.toLowerCase().includes(p6Q));
  if(p6ListSortMi!==null){
    const mi=p6ListSortMi;
    const abcRank={A:0,B:1,C:2};
    items=items.slice().sort((a,b)=>{
      const ma=a.months&&a.months[mi],mb=b.months&&b.months[mi];
      if(p6ValueMode==="marja"){
        const va=ma?(ma.marja||0):null,vb=mb?(mb.marja||0):null;
        if(va==null&&vb==null)return 0;
        if(va==null)return 1;
        if(vb==null)return -1;
        return p6ListSortDir*(vb-va);
      }
      const fa=ma?(p6ValueMode==="rev"?ma.abc:ma.abc_profit):null;
      const fb=mb?(p6ValueMode==="rev"?mb.abc:mb.abc_profit):null;
      const ra=abcRank[fa]??3,rb=abcRank[fb]??3;
      return p6ListSortDir*(ra-rb);
    });
  }
  const cnt=document.getElementById("sp-cnt");if(cnt)cnt.textContent=items.length.toLocaleString()+" "+t("sp_cnt_suffix");
  const totalP=Math.max(1,Math.ceil(items.length/P6PS));
  if(p6Page>totalP)p6Page=totalP;
  const off=(p6Page-1)*P6PS;
  const shown=items.slice(off,off+P6PS);
  const mzMap={};
  if(ZITEMS){ZITEMS.filter(v=>v.signal==="muzlagan").forEach(v=>{if(v.sup)mzMap[v.sup]=(mzMap[v.sup]||0)+1;});}
  let h="";
  shown.forEach((s,i)=>{
    h+=`<tr class="sp-row sp6-sup-row" onclick="p6OpenSupplierDetail(${s.r})">`;
    h+=`<td class="sp-td-idx" style="color:#bbb;font-size:11px">${off+i+1}</td>`;
    h+=`<td class="sp-td-name"><div class="sp-name sp6-sup-link" title="${esc(s.name)}">${esc(s.name)}</div></td>`;
    P6_MONTH_KEYS.forEach((_,mi)=>{
      const me=s.months&&s.months[mi];
      if(!me){
        h+=`<td class="sp-td-mon"><span class="sp-month-chip sp-month-empty" onclick="event.stopPropagation()">—</span></td>`;
      }else if(p6ValueMode==="marja"){
        const marja=me.marja||0;
        const tier=_p6MarjaTier(marja);
        h+=`<td class="sp-td-mon"><span class="sp-month-chip sp-month-chip-wide sp-abc-${tier}" onclick="event.stopPropagation()">${Math.round(marja)}%</span></td>`;
      }else{
        const abc=(p6ValueMode==="rev"?me.abc:me.abc_profit)||me.abc||"C";
        h+=`<td class="sp-td-mon"><span class="sp-month-chip sp-abc-${abc.toLowerCase()}" onclick="event.stopPropagation()">${abc}</span></td>`;
      }
    });
    h+=`</tr>`;
  });
  if(!h)h=`<tr><td colspan="8" style="text-align:center;padding:40px;color:#bbb">${t("sp_topilmadi")}</td></tr>`;
  document.getElementById("sp-tbody").innerHTML=h;
  renderP6Pag(totalP);
  requestAnimationFrame(()=>{if(tblWrap)tblWrap.scrollLeft=savedSL;window.scrollTo(0,savedWY);});
}
function p6ShowMzPage(){
  const mz=document.getElementById("sp-mz-page");
  if(!mz)return;
  mz.style.display="block";
  mz.scrollTop=0;
  requestAnimationFrame(_p6SyncMzStickyTop);
}
function p6SortByMonth(mi){
  if(_p6DetailSortMi===mi){_p6DetailSortDir*=-1;}else{_p6DetailSortMi=mi;_p6DetailSortDir=1;}
  p6OpenSupplierDetail(p6SelI);
}
function p6CloseOverlay(){
  const ov=document.getElementById("sp-fullscreen");if(ov)ov.style.display="none";
  const mz=document.getElementById("sp-mz-page");if(mz)mz.style.display="none";
  const portal=document.getElementById("sp6-det-month-portal");if(portal)portal.style.display="none";
  p6SelI=null;_p6DetailProds=[];_p6DetailAllProds=[];_p6DetailQ="";_p6DetailR=null;_p6DetailSortMi=null;_p6DetailSortDir=1;_p6MzAllItems=[];_p6MzQ="";_p6MzViewItems=[];
}
// ─── P6 detail: oy bo'yicha tannarx/foyda/marja — backend'da (har 30 daqiqada,
// build_all_from_api.py/backend_p6_suppliers.py) haqiqiy tarixiy kirim narxi
// bilan OLDINDAN hisoblanib supplier_months_cache.json'ga yozib qo'yiladi (S.months[mi]
// ichida cost/profit/marja/abc_profit/cost_approx tayyor keladi) - frontend faqat
// o'qiydi, brauzerda qayta hisoblash shart emas.
// Tanlangan oy uchun: tushum/tannarx/foyda va A/B/C soni (backend'da hisoblangan
// abc_cnt, faqat shu oy sotilgan tovarlar orasida).
// "jami" — BARCHA ustun-oylarda (Yan-Iyul, faqat tanlangan oy emas) sotilgan
// noyob SKU/nom soni — pastdagi mahsulot jadvali (p6OpenSupplierDetail'dagi
// prodMap) bilan AYNAN bir xil kalit mantig'i (item.sku||item.name) ishlatiladi,
// shuning uchun bu son doim jadvaldagi qatorlar soniga teng chiqadi.
// Muzlagan (hech qachon sotilmagan) tovarlar bu yerga QO'SHILMAYDI - ular
// allaqachon alohida "Sotilmayotgan tovarlar" tugmasида o'z hisobiga ega,
// shu yerga qo'shilsa jadval qatorlari bilan mos kelmay, chalkashlik keltirardi.
function _p6MonthStats(S,mi){
  const me=S.months&&S.months[mi];
  const soldSkus=new Set();
  (S.months||[]).forEach(month=>{(month&&month.top||[]).forEach(item=>{soldSkus.add(item.sku||item.name);});});
  const abc=(me&&me.abc_cnt)||{A:0,B:0,C:0};
  return{
    rev:(me&&me.rev)||0,
    cost:(me&&me.cost)||0,
    profit:(me&&me.profit)||0,
    marja:(me&&me.marja)||0,
    jami:soldSkus.size,a:abc.A||0,b:abc.B||0,c:abc.C||0,
    costReady:!(me&&me.cost_approx),
  };
}
function _p6FmtSom(n){
  const v=Math.round(n||0);
  const sign=v<0?"-":"";
  return sign+Math.abs(v).toLocaleString();
}
function _p6DetailMonthDD(){
  const names=P6_MONTHS_NOW();
  const cur=names[p6CardMonth]||names[p6LatestMonthIndex()]||"";
  return `<div class="sp-month-dd" id="sp6-det-month-dd"><button id="sp6-det-month-btn" class="sp-month-current" type="button" style="height:26px;min-width:0;padding:0 10px;font-size:11px;border-radius:14px;background:#F5F6F8;border-color:#EAECEF;color:#1a1a2e" onclick="p6ToggleDetailMonthMenu(event)">${esc(cur)}</button></div>`;
}
function _p6EnsureDetailMonthPortal(){
  let el=document.getElementById("sp6-det-month-portal");
  if(!el){
    el=document.createElement("div");
    el.id="sp6-det-month-portal";
    el.className="sp-month-menu";
    el.style.position="fixed";
    el.style.zIndex="99999";
    el.style.display="none";
    document.body.appendChild(el);
  }
  return el;
}
function _p6DetailSummaryH(S){
  const st=_p6MonthStats(S,p6CardMonth);
  const NEUTRAL_BG="#F5F6F8",NEUTRAL_BORDER="1px solid #EAECEF";
  const approxNote=st.costReady?"":` <span title="${esc(t("sp_stat_approx_hint"))}" style="color:#c7c7c2">…</span>`;
  const tile=(label,val,note)=>`<div style="background:${NEUTRAL_BG};border:${NEUTRAL_BORDER};border-radius:10px;padding:8px 14px;font-size:12px"><span style="color:#888;font-weight:600">${label}: </span><span style="color:#1a1a2e;font-weight:800">${val}</span>${note||""}</div>`;
  const abcTile=(letter,color,val)=>`<div style="background:${NEUTRAL_BG};border:${NEUTRAL_BORDER};border-radius:10px;padding:8px 14px;font-size:12px"><span style="color:${color};font-weight:800">${letter}</span><span style="color:#888;font-weight:600">: </span><span style="color:#1a1a2e;font-weight:800">${val}</span></div>`;
  return `<div id="sp-ov-summary" style="flex-shrink:0;display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:12px 14px;border-bottom:1.5px solid #f0f0ec">`
    +_p6DetailMonthDD()
    +tile(t("sp_stat_tushum"),_p6FmtSom(st.rev))
    +tile(t("sp_stat_tannarx"),_p6FmtSom(st.cost),approxNote)
    +tile(t("sp_stat_foyda"),_p6FmtSom(st.profit),approxNote)
    +tile(t("sp_stat_jami"),st.jami+" "+t("sp_ta"))
    +abcTile("A","#1D9E75",st.a)
    +abcTile("B","#534AB7",st.b)
    +abcTile("C","#EF9F27",st.c)
    +`</div>`;
}
function p6ToggleDetailMonthMenu(e){
  if(e)e.stopPropagation();
  const portal=_p6EnsureDetailMonthPortal();
  if(portal.style.display==="block"){portal.style.display="none";return;}
  const btn=document.getElementById("sp6-det-month-btn");
  if(!btn)return;
  const r=btn.getBoundingClientRect();
  const names=P6_MONTHS_NOW();
  portal.innerHTML=names.map((m,i)=>`<button class="sp-month-option ${i===p6CardMonth?"active":""}" type="button" onclick="p6PickDetailMonth(${i},event)">${esc(m)}</button>`).join("");
  portal.style.top=(r.bottom+4)+"px";
  portal.style.left=r.left+"px";
  portal.style.display="block";
}
function p6PickDetailMonth(mi,e){
  if(e)e.stopPropagation();
  p6CardMonth=mi;
  const portal=document.getElementById("sp6-det-month-portal");
  if(portal)portal.style.display="none";
  const S=P6&&P6.suppliers?P6.suppliers.find(x=>x.r===p6SelI):null;
  if(!S)return;
  const holder=document.getElementById("sp-ov-summary");
  if(holder)holder.outerHTML=_p6DetailSummaryH(S);
}
document.addEventListener("click",function(e){
  const portal=document.getElementById("sp6-det-month-portal");
  if(!portal||portal.style.display!=="block")return;
  const btn=document.getElementById("sp6-det-month-btn");
  if(!portal.contains(e.target)&&(!btn||!btn.contains(e.target)))portal.style.display="none";
});
function p6OpenSupplierDetail(r){
  if(!P6)return;
  p6SelI=r;
  if(_p6DetailR!==r){_p6DetailQ="";_p6MzQ="";}
  _p6DetailR=r;
  const S=P6.suppliers.find(x=>x.r===r);
  if(!S)return;
  _p6EnsureDetailStyles();
  // Build product×month matrix — collect all products across all months
  const prodMap=new Map();
  P6_MONTH_KEYS.forEach((_,mi)=>{
    const month=S.months&&S.months[mi];
    if(!month)return;
    (month.top||[]).forEach(item=>{
      const key=item.sku||item.name;
      if(!prodMap.has(key)){prodMap.set(key,{name:item.name,sku:item.sku||"",bc:_p2BcBySku(item.sku),months:new Array(P6_MONTH_KEYS.length).fill(null),latestRev:0,latestMi:-1});}
      const p=prodMap.get(key);
      p.months[mi]={abc:item.abc,abc_profit:item.abc_profit,marja:item.marja};
      if(mi>=p.latestMi){p.latestRev=item.rev||0;p.latestMi=mi;}
    });
  });
  _p6DetailAllProds=[...prodMap.values()];
  if(_p6DetailSortMi!==null){
    const mi=_p6DetailSortMi;
    const abcRank={A:0,B:1,C:2};
    _p6DetailAllProds.sort((a,b)=>{
      const ma=a.months[mi],mb=b.months[mi];
      if(p6ValueMode==="marja"){
        const va=ma?(ma.marja||0):null,vb=mb?(mb.marja||0):null;
        if(va==null&&vb==null)return b.latestRev-a.latestRev;
        if(va==null)return 1;
        if(vb==null)return -1;
        return _p6DetailSortDir*(vb-va);
      }
      const fa=ma?(p6ValueMode==="rev"?ma.abc:ma.abc_profit):null;
      const fb=mb?(p6ValueMode==="rev"?mb.abc:mb.abc_profit):null;
      const ra=abcRank[fa]??3,rb=abcRank[fb]??3;
      if(ra!==rb)return _p6DetailSortDir*(ra-rb);
      return b.latestRev-a.latestRev;
    });
  }else{
    _p6DetailAllProds.sort((a,b)=>b.latestRev-a.latestRev);
  }
  const searchIcon=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="position:absolute;left:14px;top:50%;transform:translateY(-50%);width:17px;height:17px;color:#b5bac4;pointer-events:none"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>`;
  const clearBtn=(id,fn,q)=>`<button id="${id}" onclick="${fn}" style="display:${q?"flex":"none"};align-items:center;justify-content:center;position:absolute;right:14px;top:50%;transform:translateY(-50%);width:18px;height:18px;background:none;border:none;cursor:pointer;color:#b5bac4;font-size:13px;line-height:1;padding:0;" title="Tozalash">✕</button>`;
  const searchH=`<div style="padding:0 14px 12px"><div class="sp-search" style="max-width:340px">${searchIcon}<input id="sp6-det-q" type="text" placeholder="${esc(t("p2_search_ph"))}" value="${esc(_p6DetailQ)}" oninput="p6DetailSearch(this.value)" onkeydown="if(event.key==='Enter'){event.preventDefault();p6DetailSearchSubmit(this.value);}">${clearBtn("sp6-det-clear","p6DetailClearSearch()",_p6DetailQ)}</div></div>`;
  const tableH=`<div id="sp6-matrix-wrap-outer">${_p6DetailMatrixInner()}</div>`;
  // Build mz (unsold) page
  _p6MzAllItems=ZITEMS?ZITEMS.filter(v=>v.signal==="muzlagan"&&v.sup===S.name).sort((a,b)=>(b.frozenVal||0)-(a.frozenVal||0)):[];
  let mzSearchH="",mzTableH="";
  if(_p6MzAllItems.length){
    mzSearchH=`<div style="padding:0 0 12px"><div class="sp-search" style="max-width:340px">${searchIcon}<input id="sp6-mz-q" type="text" placeholder="${esc(t("p2_search_ph"))}" value="${esc(_p6MzQ)}" oninput="p6MzSearch(this.value)" onkeydown="if(event.key==='Enter'){event.preventDefault();p6MzSearchSubmit(this.value);}">${clearBtn("sp6-mz-clear","p6MzClearSearch()",_p6MzQ)}</div></div>`;
    mzTableH=`<div id="sp6-mz-wrap-outer">${_p6MzMatrixInner()}</div>`;
  }
  // Show per-month stats row at top (tanlangan oy bo'yicha, p6CardMonth orqali)
  const summaryH=_p6DetailSummaryH(S);
  _p6ShowOverlay(S.name,summaryH+_p6ModeLabelH()+searchH,tableH,"",(S.months&&S.months[p6LatestMonthIndex()]&&S.months[p6LatestMonthIndex()].abc)||S.abc,_p6MzAllItems.length,mzSearchH,mzTableH);
}
function _p6ModeLabelH(){
  const labels={rev:t("sp_stat_tushum"),profit:t("sp_stat_foyda"),marja:t("sp_stat_marja")};
  const colors={rev:"#1D9E75",profit:"#534AB7",marja:"#EF9F27"};
  return `<div style="padding:0 14px 8px;font-size:11px;color:#7b8494;font-weight:600">${esc(t("sp_group_by"))}: <span style="color:${colors[p6ValueMode]};font-weight:800">${esc(labels[p6ValueMode])}</span></div>`;
}
function _p6DetailMatrixInner(){
  const q=_p6DetailQ;
  _p6DetailProds=q?_p6DetailAllProds.filter(p=>_matchNSB(p,q)):_p6DetailAllProds;
  const abcBg={A:"#e8f8f3",B:"#eeebfb",C:"#fef3e2"};
  const abcFg={A:"#1D9E75",B:"#534AB7",C:"#EF9F27"};
  const monthHdrs=P6_MONTH_KEYS.map((k,mi)=>{
    const isSorted=_p6DetailSortMi===mi;
    const arrow=isSorted?(_p6DetailSortDir===1?" ↑":" ↓"):"";
    return `<th style="text-align:center;min-width:54px;cursor:pointer;user-select:none${isSorted?";color:#1D9E75":""}" onclick="p6SortByMonth(${mi})">${t(k)}${arrow}</th>`;
  }).join("");
  const rows=_p6DetailProds.map((p,i)=>{
    const abcCells=p.months.map(me=>{
      if(!me)return `<td style="text-align:center;color:#d0d0d0;font-size:12px">—</td>`;
      if(p6ValueMode==="marja"){
        const marja=me.marja||0;
        const tierKey=_p6MarjaTier(marja).toUpperCase();
        return `<td style="text-align:center"><span style="display:inline-block;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:800;background:${abcBg[tierKey]||"#f4f4f0"};color:${abcFg[tierKey]||"#555"}">${Math.round(marja)}%</span></td>`;
      }
      const abc=(p6ValueMode==="rev"?me.abc:me.abc_profit)||me.abc||"C";
      return `<td style="text-align:center"><span style="display:inline-block;padding:2px 10px;border-radius:6px;font-size:11px;font-weight:800;background:${abcBg[abc]||"#f4f4f0"};color:${abcFg[abc]||"#555"}">${abc}</span></td>`;
    }).join("");
    const skuLine=p.sku?`<div class="p2-prod-meta"><span class="p2-chip">SKU: ${esc(p.sku)}</span></div>`:"";
    return `<tr class="sp6-prod-row"><td style="color:#bbb;font-size:10px;text-align:center;width:32px">${i+1}</td><td style="max-width:280px;overflow:hidden"><div class="p2-prod-name sp6-prod-link" onclick="p6GoToProduct(${i})" title="${esc(p.name)}">${esc(p.name)}</div>${skuLine}</td>${abcCells}</tr>`;
  }).join("");
  if(!_p6DetailProds.length){
    return `<div style="flex:1;display:flex;align-items:center;justify-content:center;color:#bbb;padding:40px">${q?t("p2_not_found"):t("sp6_no_data")}</div>`;
  }
  return `<div id="sp6-matrix-wrap"><table class="sp6-matrix"><thead><tr><th style="width:38px;text-align:center">#</th><th style="text-align:left">${t("sp_prod_name")}</th>${monthHdrs}</tr></thead><tbody>${rows}</tbody></table></div>`;
}
function _p6SyncDetailStickyTop(){
  const ov=document.getElementById("sp-fullscreen");
  const hdr=document.getElementById("sp-ov-header");
  if(!ov||!hdr)return;
  const h=Math.ceil(hdr.getBoundingClientRect().height);
  ov.querySelectorAll("#sp6-matrix-wrap .sp6-matrix th").forEach(th=>{th.style.top=h+"px";});
}
function p6DetailSearch(val){
  const clr=document.getElementById("sp6-det-clear");
  if(clr)clr.style.display=val?"flex":"none";
}
// 2026-08-12: og'ir qism (jadval qayta chizish) faqat Enter bosilganda.
function p6DetailSearchSubmit(val){
  _p6DetailQ=(val||"").toLowerCase().trim();
  const wrap=document.getElementById("sp6-matrix-wrap-outer");
  if(wrap)wrap.innerHTML=_p6DetailMatrixInner();
  requestAnimationFrame(_p6SyncDetailStickyTop);
}
function p6DetailClearSearch(){
  const inp=document.getElementById("sp6-det-q");
  if(inp)inp.value="";
  p6DetailSearch("");
  p6DetailSearchSubmit("");
  if(inp)inp.focus();
}
let _p6MzSortKey=null,_p6MzSortDir=-1;
function p6MzSortBy(key){
  if(_p6MzSortKey===key){_p6MzSortDir=-_p6MzSortDir;}else{_p6MzSortKey=key;_p6MzSortDir=key==="name"?1:-1;}
  const wrap=document.getElementById("sp6-mz-wrap-outer");
  if(wrap)wrap.innerHTML=_p6MzMatrixInner();
  requestAnimationFrame(_p6SyncMzStickyTop);
}
function _p6MzMatrixInner(){
  const q=_p6MzQ;
  let items=q?_p6MzAllItems.filter(v=>_matchNSB(v,q)):_p6MzAllItems.slice();
  if(_p6MzSortKey){
    const gv=v=>{switch(_p6MzSortKey){
      case "name":return (v.name||"").toLowerCase();
      case "stock":return v.stock||0;
      case "buy":return v.sp||0;
      case "frozen":return v.frozenVal||0;
      case "sell":return v.rp||0;
      case "days":return v.di>=999?99999:(v.di||0);
      case "lastkirim":return krLastDate(v.sku)||"";
      default:return 0;
    }};
    items=items.slice().sort((a,b)=>{const av=gv(a),bv=gv(b);if(typeof av==="string")return _p6MzSortDir*av.localeCompare(bv,"ru");return _p6MzSortDir*(av-bv);});
  }
  _p6MzViewItems=items;
  if(!items.length){
    return `<div style="padding:40px;text-align:center;color:#bbb">${t("p2_not_found")}</div>`;
  }
  const fmtP=n=>n?(Math.round(n)).toLocaleString()+" so'm":"—";
  const mzRows=items.map((v,vi)=>{
    const stk=v.kg?(v.stock||0).toFixed(2):Math.round(v.stock||0);
    const diNum=v.di>=999?"60+":String(v.di);
    const di=`${diNum} ${t("sp_days_unit")}`;
    const skuLine=v.sku?`<div class="p2-prod-meta"><span class="p2-chip">SKU: ${esc(v.sku)}</span></div>`:"";
    const fv=v.frozenVal||0;
    const fvStr=fv>=1e6?`${(fv/1e6).toFixed(1)} mln`:`${fv.toLocaleString()}`;
    const lastKirim=krFmtDate(krLastDate(v.sku))||"—";
    return `<tr class="sp6-prod-row"><td style="color:#bbb;font-size:10px;text-align:center;width:32px">${vi+1}</td><td style="white-space:nowrap"><div class="p2-prod-name" title="${esc(v.name)}">${esc(v.name)}</div>${skuLine}</td><td style="text-align:right;color:#1D9E75;font-weight:700;font-size:11px;white-space:nowrap">${stk}</td><td style="text-align:right;font-size:11px;color:#534AB7;font-weight:600;white-space:nowrap">${fmtP(v.sp)}</td><td style="text-align:right;font-size:11px;color:#EF9F27;font-weight:700;white-space:nowrap">${fvStr} so'm</td><td style="text-align:right;font-size:11px;color:#1D9E75;font-weight:600;white-space:nowrap">${fmtP(v.rp)}</td><td style="text-align:right;color:#999;font-size:11px;white-space:nowrap">${di}</td><td style="text-align:right;color:#777;font-size:11px;white-space:nowrap">${lastKirim}</td></tr>`;
  }).join("");
  const th=(label,key,align)=>{
    const isSorted=_p6MzSortKey===key;
    const arrow=isSorted?(_p6MzSortDir===1?" ↑":" ↓"):"";
    return `<th style="text-align:${align||"right"};cursor:pointer;user-select:none${isSorted?";color:#1D9E75":""}" onclick="p6MzSortBy('${key}')">${label}${arrow}</th>`;
  };
  const colgroup=`<colgroup><col style="width:4%"><col style="width:27%"><col style="width:8%"><col style="width:13%"><col style="width:14%"><col style="width:13%"><col style="width:9%"><col style="width:12%"></colgroup>`;
  return `<div style="padding:0 14px 40px"><table class="sp6-matrix" style="width:100%;table-layout:fixed">${colgroup}<thead id="sp6-mz-thead"><tr><th style="width:32px;text-align:center">#</th>${th(t("sp_mz_prod"),"name","left")}${th(t("sp_mz_stock"),"stock")}${th(t("sp_mz_buy"),"buy")}${th(t("sp_mz_frozen"),"frozen")}${th(t("sp_mz_sell"),"sell")}${th(t("sp_mz_days"),"days")}${th(t("sp_mz_lastkirim"),"lastkirim")}</tr></thead><tbody>${mzRows}</tbody></table></div>`;
}
function _p6SyncMzStickyTop(){
  const mz=document.getElementById("sp-mz-page");
  if(!mz)return;
  const hdr=mz.firstElementChild;
  if(!hdr)return;
  const h=Math.ceil(hdr.getBoundingClientRect().height);
  mz.querySelectorAll("#sp6-mz-thead th").forEach(th=>{th.style.top=h+"px";});
}
function p6MzSearch(val){
  const clr=document.getElementById("sp6-mz-clear");
  if(clr)clr.style.display=val?"flex":"none";
}
// 2026-08-12: og'ir qism (jadval qayta chizish) faqat Enter bosilganda.
function p6MzSearchSubmit(val){
  _p6MzQ=(val||"").toLowerCase().trim();
  const wrap=document.getElementById("sp6-mz-wrap-outer");
  if(wrap)wrap.innerHTML=_p6MzMatrixInner();
  requestAnimationFrame(_p6SyncMzStickyTop);
}
function p6MzClearSearch(){
  const inp=document.getElementById("sp6-mz-q");
  if(inp)inp.value="";
  p6MzSearch("");
  p6MzSearchSubmit("");
  if(inp)inp.focus();
}
async function p6GoToProduct(pi){
  const p=_p6DetailProds[pi];
  if(!p)return;
  _zBackPage="p6";
  const p2btn=document.querySelector('.sb-item[data-page="p2"]');
  if(p2btn)await showPage(p2btn);
  if(!P2)return;
  let idx=-1;
  if(p.sku)idx=P2.findIndex(v=>String(v.sku||"")===String(p.sku));
  if(idx<0)idx=P2.findIndex(v=>v.name===p.name);
  const pq=document.getElementById("pf-q");
  if(pq){pq.value=idx>=0?P2[idx].name:p.name;if(typeof pfQToggle==="function")pfQToggle();if(typeof p2Filter==="function")p2Filter();}
  if(idx>=0&&typeof p2Open==="function")p2Open(P2[idx]._i!=null?P2[idx]._i:idx);
  const bb=document.getElementById("z-back");
  if(bb){bb.style.display="inline-flex";bb.textContent=t("sp6_back_label");}
}
function _p6EnsureDetailStyles(){
  if(document.getElementById("sp6-detail-style"))return;
  const st=document.createElement("style");
  st.id="sp6-detail-style";
  st.textContent=`#sp-fullscreen,#sp-mz-page{position:fixed!important;top:0;bottom:0;left:195px;right:0;background:#fff;box-sizing:border-box;transition:left .18s ease}body.sb-collapsed #sp-fullscreen,body.sb-collapsed #sp-mz-page{left:64px}#sp-fullscreen{overflow-y:auto;overflow-x:auto;z-index:1500}#sp-mz-page{overflow-y:auto;overflow-x:auto;padding:0 24px 60px;z-index:1600}#sp6-matrix-wrap{padding:0 14px 40px}.sp6-sup-row{cursor:pointer}.sp6-sup-row:hover .sp6-sup-link{color:#1D9E75;text-decoration:underline}.sp6-sup-link{font-weight:600;transition:color .15s}.sp6-prod-link{cursor:pointer}.sp6-prod-link:hover{text-decoration:underline;color:#1D9E75}.sp6-matrix{font-size:12px;width:auto;min-width:100%;border-collapse:collapse}.sp6-matrix th{position:sticky;top:0;z-index:1;background:#F0F4F8;color:#374151;font-size:10.5px;font-weight:700;text-align:left;padding:12px 12px;border-bottom:2px solid #D1D9E0;white-space:nowrap;letter-spacing:.3px;text-transform:uppercase}.sp6-matrix td{padding:13px 12px;border-bottom:1px solid #EAECF0;color:#1F2937;vertical-align:middle}.sp6-matrix tbody tr{transition:background .15s}.sp6-matrix tbody tr:nth-child(even){background:#F9FAFB}.sp6-matrix tbody tr:hover td{background:#E6F4F0!important}`;
  document.head.appendChild(st);
}
function _p6ShowOverlay(name,stickyExtra,tableH,monthName,abc,mzCount,mzSearchH,mzTableH){
  const p6el=document.getElementById("p6");if(!p6el)return;
  p6el.style.position="relative";
  let ov=document.getElementById("sp-fullscreen");
  if(!ov){ov=document.createElement("div");ov.id="sp-fullscreen";
    ov.style.display="none";
    p6el.appendChild(ov);}
  let mzPage=document.getElementById("sp-mz-page");
  if(!mzPage){mzPage=document.createElement("div");mzPage.id="sp-mz-page";
    mzPage.style.display="none";
    p6el.appendChild(mzPage);}
  const abcC=abc==="A"?"#1D9E75":abc==="B"?"#534AB7":"#EF9F27";
  const abcBadge=abc?`<span style="background:${abcC};color:#fff;padding:5px 14px;border-radius:10px;font-size:18px;font-weight:800;letter-spacing:1px;flex-shrink:0">${abc}</span>`:"";
  const monthBadge=monthName?`<span style="background:#f0faf6;color:#1D9E75;padding:5px 14px;border-radius:10px;font-size:15px;font-weight:700;flex-shrink:0;border:1px solid #d4f0e5">${monthName}</span>`:"";
  const mzToggle=mzCount?`<button onclick="p6ShowMzPage()" style="margin-left:auto;display:inline-flex;align-items:center;gap:8px;padding:7px 14px;border-radius:14px;border:1.5px solid #d4f0e5;background:#f0faf6;color:#1D9E75;font-size:13px;font-weight:700;cursor:pointer;flex-shrink:0">🛒 ${t("sp_mz_btn")} <span style="background:#1D9E75;color:#fff;border-radius:8px;padding:1px 8px;font-size:11px;font-weight:700">${mzCount}</span></button>`:"";
  const xlsIcon=`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2F6FED" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></svg>`;
  const detExportBtn=`<button class="xls-export-btn" onclick="exportP6DetailXLSX()" style="flex-shrink:0">${xlsIcon}${t("export_btn")}</button>`;
  const mzExportBtn=`<button class="xls-export-btn" onclick="exportP6MzXLSX()" style="flex-shrink:0;margin-left:auto">${xlsIcon}${t("export_btn")}</button>`;
  ov.innerHTML=`<div id="sp-ov-header" style="position:sticky;top:0;background:#fff;z-index:2">
    <div class="mob-ov-hdr" style="padding:14px 14px 12px;border-bottom:1.5px solid #f0f0ec;display:flex;align-items:center;gap:12px;flex-wrap:nowrap;min-width:0;overflow:hidden">
      <button onclick="p6CloseOverlay()" style="display:inline-flex;align-items:center;gap:6px;padding:7px 16px;border-radius:14px;border:1.5px solid #e6e2f7;background:#fff;font-size:13px;font-weight:600;color:#534AB7;cursor:pointer;flex-shrink:0">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        ${t("sp_back_sup")}
      </button>
      ${monthBadge}${abcBadge}
      <span style="font-size:15px;font-weight:700;color:#1a1a2e;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(name)}</span>
      ${detExportBtn}
      ${mzToggle}
    </div>
    ${stickyExtra||""}
  </div>
  <div class="sp-det-wrap">${tableH}</div>`;
  if(mzCount&&mzTableH){
    mzPage.innerHTML=`<div style="position:sticky;top:0;background:#fff;z-index:2">
      <div class="mob-ov-hdr" style="padding:14px 0 12px;border-bottom:1.5px solid #f0f0ec;display:flex;align-items:center;gap:12px">
        <button onclick="document.getElementById('sp-mz-page').style.display='none'" style="display:inline-flex;align-items:center;gap:6px;padding:7px 16px;border-radius:14px;border:1.5px solid #e6e2f7;background:#fff;font-size:13px;font-weight:600;color:#534AB7;cursor:pointer;flex-shrink:0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          ${t("sp_back_sup")}
        </button>
        ${monthBadge}${abcBadge}
        <span style="font-size:15px;font-weight:700;color:#1a1a2e">🛒 ${t("sp_mz_btn")} <span style="background:#1D9E75;color:#fff;border-radius:8px;padding:2px 9px;font-size:13px;font-weight:700;margin-left:6px">${mzCount}</span></span>
        ${mzExportBtn}
      </div>
      ${mzSearchH||""}
    </div>
    ${mzTableH}`;
    mzPage.style.display="none";
  }else{
    mzPage.innerHTML="";
    mzPage.style.display="none";
  }
  ov.style.display="block";
  ov.scrollTop=0;
  requestAnimationFrame(_p6SyncDetailStickyTop);
}
function ensureSupplierProductTableStyles(){
  if(document.getElementById("sp-prod-table-style"))return;
  const st=document.createElement("style");
  st.id="sp-prod-table-style";
  st.textContent=`.sp-det-wrap{background:#fff!important;border:none!important;border-radius:0!important;padding:0!important;margin:0!important;max-width:100%!important}.sp-month-tabs{display:flex;align-items:center;gap:8px;padding:0 24px 6px;position:relative}.sp-month-tabs-label{font-size:11px;font-weight:700;color:#7b8494}.sp-month-dd{position:relative}.sp-month-current{height:30px;min-width:92px;padding:0 12px;border:1.5px solid #1D9E75;border-radius:18px;background:#1D9E75;color:#fff;font-size:12px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:8px}.sp-month-current:after{content:"";border-left:4px solid transparent;border-right:4px solid transparent;border-top:5px solid currentColor;margin-top:2px}.sp-month-menu{display:none;position:absolute;top:36px;left:0;z-index:30;background:#fff;border:1px solid #e5e7eb;border-radius:9px;box-shadow:0 12px 28px rgba(15,23,42,.16);padding:5px;min-width:110px}.sp-month-dd.open .sp-month-menu{display:block}.sp-month-option{width:100%;height:30px;border:0;background:#fff;border-radius:7px;color:#374151;font-size:12px;font-weight:600;cursor:pointer;text-align:left;padding:0 10px}.sp-month-option:hover{background:#f0fdf4;color:#0D7A55}.sp-month-option.active{background:#E1F5EE;color:#085041}.sp-value-toggle{display:flex;gap:4px;margin-left:auto}.sp-value-btn{height:30px;padding:0 12px;border:1.5px solid #EAECEF;border-radius:18px;background:#fff;color:#7b8494;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .15s}.sp-value-btn:hover{background:#f5f6f8}.sp-value-btn.active{background:#1D9E75;border-color:#1D9E75;color:#fff}.sp-month-chip.sp-month-chip-wide{width:auto;min-width:34px;padding:0 5px}`;
  document.head.appendChild(st);
}
function renderP6MonthControls(){
  let wrap=document.getElementById("sp-month-tabs");
  if(!wrap){
    wrap=document.createElement("div");
    wrap.id="sp-month-tabs";
    wrap.className="sp-month-tabs";
    const header=document.querySelector("#p6 .sp-header");
    if(header&&header.parentNode)header.parentNode.insertBefore(wrap,header);
  }
  const names=P6_MONTHS_NOW();
  const active=names[p6CardMonth]||names[p6LatestMonthIndex()]||"";
  const modeBtn=(m,label)=>`<button type="button" class="sp-value-btn ${p6ValueMode===m?"active":""}" onclick="p6SetValueMode('${m}')">${esc(label)}</button>`;
  wrap.innerHTML=`<span class="sp-month-tabs-label">${t("sp_month_select")}:</span><div class="sp-month-dd" id="sp-month-dd"><button class="sp-month-current" type="button" onclick="p6ToggleMonthMenu(event)">${active}</button><div class="sp-month-menu">`+
    names.map((m,i)=>`<button class="sp-month-option ${i===p6CardMonth?"active":""}" type="button" onclick="p6PickCardMonth(${i},event)">${m}</button>`).join("")+
    `</div></div>`+
    `<div class="sp-value-toggle">${modeBtn("rev",t("sp_stat_tushum"))}${modeBtn("profit",t("sp_stat_foyda"))}${modeBtn("marja",t("sp_stat_marja"))}</div>`;
}
function renderP6Cards(){
  const items=p6MonthItems();
  const cnt={A:0,B:0,C:0};
  items.forEach(s=>{const a=p6MonthAbc(s);if(cnt[a]!=null)cnt[a]++;});
  const s=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  s("sp-n-a",cnt.A.toLocaleString());
  s("sp-n-b",cnt.B.toLocaleString());
  s("sp-n-c",cnt.C.toLocaleString());
  s("sp-n-all",items.length.toLocaleString());
  const month=t(P6_MONTH_KEYS[p6CardMonth]||P6_MONTH_KEYS[p6LatestMonthIndex()]);
  document.querySelectorAll("#p6 .sp-card-sub").forEach(el=>{el.textContent=t("sp_month_calc").replace("{month}",month);});
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

// ─── P10 Kategoriyalar (kategoriya→subkategoriya→mahsulot kesimida tushum/tannarx/foyda) ───
// Tushum/miqdor: data_history.json (HIST, kunlik massiv) - tanlangan kun oralig'ida ANIQ.
// Tannarx: data_kirim.json (P8) dagi HAQIQIY kirim yozuvlari, sanasi shu oraliqqa tushganlari
// (ombor_aylanmasi.js'dagi _oaIsRealKirim/_oaLocalDate/_oaDayIdx qayta ishlatiladi) - bu "shu
// davrda SOTILGAN tovar tannarxi" emas, balki "shu davrda QABUL QILINGAN tovarga sarflangan
// summa" (naqd oqim ko'rsatkichi). ABC — har mahsulotning P2'da allaqachon hisoblangan GLOBAL
// (butun do'kon bo'yicha) klassifikatsiyasi qayta ishlatiladi (p6 supplierlar bilan bir xil
// mantiq), kategoriya kesimida alohida qayta hisoblanmaydi.
let KT_TOP=null,ktStart=null,ktEnd=null,ktRangeInited=false,ktRevMode="chakana";
function ktSetRevMode(mode){
  if(ktRevMode===mode)return;
  ktRevMode=mode;
  const bAll=document.getElementById("kt-revmode-all"),bRet=document.getElementById("kt-revmode-retail");
  if(bAll)bAll.classList.toggle("kt-revmode-active",mode==="umumiy");
  if(bRet)bRet.classList.toggle("kt-revmode-active",mode==="chakana");
  ktCompute();
  ktRenderList();
}
let ktLevel="top",ktCurTop=null,ktQ="",ktSortKey=null,ktSortDir=-1,_ktRenderedItems=[];
let ktSelTop=null,ktSelSub=null,ktDetailAllProds=[],ktDetailProds=[],ktDetailQ="",ktDetailSortKey=null,ktDetailSortDir=-1;
let ktMzAllItems=[],ktMzQ="",ktMzViewItems=[],ktMzSortKey=null,ktMzSortDir=-1;

async function ktEnsureData(){
  if(!P2){await _ensureP2Data();await initP2(null);}
  if(!ZITEMS&&P2)_buildZItems();
  await oaEnsureData();
}
function ktInitRangeDefaults(){
  if(ktRangeInited)return;
  ktRangeInited=true;
  if(!HISTMETA)return;
  const today=new Date(new Date(HISTMETA.base).getTime()+(HISTMETA.days-1)*86400000).toISOString().slice(0,10);
  const minDate=HISTMETA.base;
  const startDefault=new Date(new Date(today).getTime()-6*86400000);
  const startClamped=startDefault<new Date(minDate)?minDate:startDefault.toISOString().slice(0,10);
  ktStart=startClamped;ktEnd=today;
  const si=document.getElementById("kt-start"),ei=document.getElementById("kt-end");
  if(si){si.value=ktStart;si.min=minDate;si.max=today;}
  if(ei){ei.value=ktEnd;ei.min=minDate;ei.max=today;}
}
// Kirim tarixi UMUMAN yo'q tovarlar (2026-08-18 holatiga 289 ta, tushumning ~2.4%i -
// Invan'da hech qachon kirim hujjati yozilmagan, ko'pchiligining qoldig'i ham manfiy)
// uchun ZAXIRA tannarx manbai: Invan katalogidagi `sp` (last_supply_price).
// DIQQAT: sotuv narxi `p` ATAYLAB ishlatilmaydi - u tannarx emas; undan hisoblangan
// "foyda" nolga teng bo'lib marjani buzardi. `sp` ham yo'q bo'lsa - tovar avvalgidek
// "kirim narxi yo'q" bo'lib qoladi (tannarx/foyda/marjaga umuman kirmaydi).
let _KT_SP=null;
function _ktSpAt(sku){
  if(_KT_SP===null){
    _KT_SP={};
    if(INVDATA)Object.keys(INVDATA).forEach(k=>{
      const iv=INVDATA[k];
      if(iv&&iv.sku!=null&&iv.sku!==""&&(iv.sp||0)>0)_KT_SP[String(iv.sku)]=iv.sp;
    });
  }
  return _KT_SP[String(sku)]||0;
}
function ktCompute(){
  KT_TOP=null;
  if(!P2||!HIST||!HISTMETA||!ktStart||!ktEnd)return;
  const topMap=new Map();
  const s=Math.max(0,_oaDayIdx(HISTMETA.base,ktStart));
  const e=Math.min(HISTMETA.days-1,_oaDayIdx(HISTMETA.base,ktEnd));
  const unk=t("kt_unknown");
  const baseMs=new Date(HISTMETA.base).getTime();
  const _ktExclFirma=ktRevMode==="chakana";
  P2.forEach(v=>{
    if(!v.sku)return;
    const key="sku:"+v.sku;
    const dArr=HIST.d[key],rArr=HIST.r[key];
    const qfArr=_ktExclFirma&&HIST.qf?HIST.qf[key]:null;
    const rfArr=_ktExclFirma&&HIST.rf?HIST.rf[key]:null;
    let qty=0,rev=0,cost=0,knownQty=0,approxQty=0;
    if(dArr||rArr){
      for(let i=s;i<=e;i++){
        // "Faqat chakana" rejimida (ktRevMode==="chakana") - shu kunning Firmalar
        // (p11, client.id) ro'yxatidagi RASMIY biznes-mijozlarga tegishli miqdori/tushumi
        // ayriladi (HIST.qf/rf, build_sales_demand.py'dagi q_firma/rev_d_firma'dan) -
        // tannarx ham shu (chakana) miqdorga qarab hisoblanadi, aks holda foyda/marja
        // to'g'ri chiqmasdi (kirim summasi o'zgarmay, tushum kamayib qolardi).
        let q=dArr&&dArr[i]?dArr[i]:0;
        let rDay=rArr&&rArr[i]?rArr[i]:0;
        if(_ktExclFirma){
          if(qfArr&&qfArr[i])q=Math.max(0,q-qfArr[i]);
          if(rfArr&&rfArr[i])rDay-=rfArr[i];
        }
        if(q){
          qty+=q;
          // Sotilgan birlik uchun tannarx - shu SOTUV kunidan OLDINGI (yoki shu kundagi) eng
          // so'nggi haqiqiy kirim narxi (_oaLastKirimCostAt, ombor_aylanmasi.js) - "shu davrda
          // kirim qilingan summa" emas, balki haqiqiy COGS: eski zaxiradan sotilgan tovar ham
          // to'g'ri tannarxda hisoblanadi (kirim tanlangan oraliqdan oldin bo'lsa ham). Agar SKU
          // uchun umuman haqiqiy kirim tarixi topilmasa - narx TAXMIN QILINMAYDI, shu qism
          // tannarxga qo'shilmaydi (pastda knownQty=0 bo'lsa butun tovar tannarxi "—" ko'rsatiladi).
          const dateIso=new Date(baseMs+i*86400000).toISOString().slice(0,10);
          const unitCost=_oaLastKirimCostAt(v.sku,dateIso);
          if(unitCost!=null){cost+=q*unitCost;knownQty+=q;}
          else{const sp=_ktSpAt(v.sku);if(sp>0){cost+=q*sp;knownQty+=q;approxQty+=q;}}
        }
        if(rDay)rev+=rDay;
      }
    }
    if(!qty&&!rev)return;
    const costKnown=knownQty>0;
    // Tannarxning qancha qismi `sp`dan (taxminiy) olingani - foydalanuvchiga "≈" bilan
    // ko'rsatiladi, chunki bu haqiqiy kirim hujjatidan emas, katalog narxidan olingan.
    const approxRev=qty?rev*(approxQty/qty):0;
    const topName=v.catTop||v.cat||unk;
    const subName=v.cat||unk;
    if(!topMap.has(topName))topMap.set(topName,{name:topName,rev:0,cost:0,knownRev:0,approxRev:0,costKnownCnt:0,abcCnt:{A:0,B:0,C:0},subs:new Map()});
    const top=topMap.get(topName);
    // ABC: kategoriya-ICHI tasnif (`zabc`, backend_p_zakas_abc.py) - global do'kon
    // bo'yicha `abc` EMAS. Sabab: bu bo'lim aynan kategoriya kesimida tahlil qiladi,
    // global Pareto'da kichik kategoriyaning eng yaxshi tovari ham C bo'lib chiqardi.
    const abc=v.zabc||v.abc||"";
    top.rev+=rev;top.cost+=cost;top.approxRev+=approxRev;
    if(costKnown){top.costKnownCnt++;top.knownRev+=rev;}
    if(top.abcCnt[abc]!=null)top.abcCnt[abc]++;
    if(!top.subs.has(subName))top.subs.set(subName,{name:subName,rev:0,cost:0,knownRev:0,approxRev:0,costKnownCnt:0,abcCnt:{A:0,B:0,C:0},items:[]});
    const sub=top.subs.get(subName);
    sub.rev+=rev;sub.cost+=cost;sub.approxRev+=approxRev;
    if(costKnown){sub.costKnownCnt++;sub.knownRev+=rev;}
    if(sub.abcCnt[abc]!=null)sub.abcCnt[abc]++;
    sub.items.push({name:v.name,sku:v.sku,bc:v.bc||[],rev:Math.round(rev),cost:costKnown?Math.round(cost):null,qty:Math.round(qty*100)/100,abc,approx:approxQty>0});
  });
  // Foyda/marja FAQAT tannarxi ma'lum bo'lgan tushum qismidan hisoblanadi (knownRev) - jami
  // tushum (rev, "noma'lum tannarxli" mahsulotlarni ham qamrab oladi) bilan aralashtirilsa,
  // marja sun'iy shishib ketardi (chunki noma'lum-tannarxli tushum "0 xarajat"dek hisoblanardi).
  const mkEntry=(name,rev,cost,cnt,abcCnt,costKnownCnt,knownRev,approxRev)=>{
    const costKnown=costKnownCnt>0;
    return {name,rev:Math.round(rev),cost:costKnown?Math.round(cost):null,profit:costKnown?Math.round(knownRev-cost):null,marja:costKnown&&knownRev?Math.round((knownRev-cost)/knownRev*1000)/10:null,unknownRev:Math.round(rev-knownRev),approxRev:Math.round(approxRev||0),cnt,abcCnt};
  };
  KT_TOP=[...topMap.values()].map(top=>{
    const subs=[...top.subs.values()].map(sub=>Object.assign(mkEntry(sub.name,sub.rev,sub.cost,sub.items.length,sub.abcCnt,sub.costKnownCnt,sub.knownRev,sub.approxRev),{items:sub.items.sort((a,b)=>b.rev-a.rev)})).sort((a,b)=>b.rev-a.rev);
    const cnt=subs.reduce((a,s)=>a+s.cnt,0);
    return Object.assign(mkEntry(top.name,top.rev,top.cost,cnt,top.abcCnt,top.costKnownCnt,top.knownRev,top.approxRev),{subs});
  }).sort((a,b)=>b.rev-a.rev);
}
async function ktInit(){
  const firstLoad=!KT_TOP;
  await ktEnsureData();
  if(firstLoad){ktInitRangeDefaults();ktCompute();}
  ktRenderList();
}
function ktRangeChange(){
  const si=document.getElementById("kt-start"),ei=document.getElementById("kt-end");
  if(si&&si.value)ktStart=si.value;
  if(ei&&ei.value)ktEnd=ei.value;
  if(ktStart>ktEnd){const tmp=ktStart;ktStart=ktEnd;ktEnd=tmp;if(si)si.value=ktStart;if(ei)ei.value=ktEnd;}
  ktCompute();
  ktRenderList();
}
// 2026-08-12: og'ir qism (ktRenderList) faqat Enter bosilganda.
function ktSearchInput(){
  const inp=document.getElementById("kt-q");
  const clr=document.getElementById("kt-clear");
  if(clr)clr.classList.toggle("show",!!(inp&&inp.value));
}
function ktSearchSubmit(){
  const inp=document.getElementById("kt-q");
  ktQ=inp?inp.value.toLowerCase().trim():"";
  const clr=document.getElementById("kt-clear");
  if(clr)clr.classList.toggle("show",ktQ.length>0);
  ktRenderList();
}
function ktClearSearch(){
  const inp=document.getElementById("kt-q");if(inp){inp.value="";inp.focus();}
  const clr=document.getElementById("kt-clear");if(clr)clr.classList.remove("show");
  ktQ="";ktRenderList();
}
function ktSortBy(key){
  if(ktSortKey===key){ktSortDir=-ktSortDir;}else{ktSortKey=key;ktSortDir=key==="name"?1:-1;}
  ktRenderList();
}
function ktCurItems(){
  if(!KT_TOP)return[];
  if(ktLevel==="top")return KT_TOP;
  const top=KT_TOP.find(x=>x.name===ktCurTop);
  return top?top.subs:[];
}
function ktRowClick(i){
  const it=_ktRenderedItems[i];if(!it)return;
  if(ktLevel==="top"){
    ktLevel="sub";ktCurTop=it.name;ktQ="";ktSortKey=null;ktSortDir=-1;
    const qi=document.getElementById("kt-q");if(qi)qi.value="";
    ktRenderList();
  }else{
    ktOpenSub(ktCurTop,it.name);
  }
}
function ktBack(){
  ktLevel="top";ktCurTop=null;ktQ="";ktSortKey=null;ktSortDir=-1;
  const qi=document.getElementById("kt-q");if(qi)qi.value="";
  ktRenderList();
}
function ktRenderList(){
  const tbody=document.getElementById("kt-tbody");
  const tfoot=document.getElementById("kt-tfoot");
  if(!tbody)return;
  if(!KT_TOP){tbody.innerHTML=`<tr><td colspan="8" style="text-align:center;padding:40px;color:#bbb">${t("yuklanmoqda")}</td></tr>`;if(tfoot)tfoot.innerHTML="";return;}
  // Ulush/foizlar joriy DARAJANING TO'LIQ ro'yxatiga nisbatan hisoblanadi (qidiruv
  // matni ta'sir qilmasin - aks holda qidiruv yozganda foizlar "joriy ko'rinishga
  // nisbatan"ga aylanib, tushunarsiz bo'lib qolardi).
  const allItems=ktCurItems();
  let items=allItems;
  if(ktQ)items=items.filter(it=>it.name.toLowerCase().includes(ktQ));
  if(ktSortKey){
    const gv=it=>{switch(ktSortKey){case "name":return it.name.toLowerCase();case "cnt":return it.cnt;case "rev":return it.rev;case "cost":return it.cost;case "profit":return it.profit;case "marja":return it.marja;default:return 0;}};
    items=items.slice().sort((a,b)=>{const av=gv(a),bv=gv(b);if(typeof av==="string")return ktSortDir*av.localeCompare(bv,"ru");return ktSortDir*(av-bv);});
  }
  _ktRenderedItems=items;
  const back=document.getElementById("kt-back");if(back)back.style.display=ktLevel==="sub"?"inline-flex":"none";
  const crumb=document.getElementById("kt-crumb");if(crumb)crumb.textContent=ktLevel==="sub"?ktCurTop:"";
  const cnt=document.getElementById("kt-cnt");
  if(cnt)cnt.textContent=items.length.toLocaleString()+" "+(ktLevel==="top"?t("kt_unit_top"):t("kt_unit_sub"));
  document.querySelectorAll("#p10 .kt-tbl thead th").forEach(th=>{th.classList.remove("z-sort-asc","z-sort-desc");if(th.dataset.sortkey===ktSortKey)th.classList.add(ktSortDir>0?"z-sort-asc":"z-sort-desc");});
  const fmtSom=n=>Math.round(n||0).toLocaleString();
  const chevron=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;color:#8B95A6;flex-shrink:0"><polyline points="9 6 15 12 9 18"/></svg>`;
  const dash=`<span style="color:#c8c8ce">—</span>`;
  const T={cnt:0,rev:0,cost:0,profit:0,known:false};
  allItems.forEach(it=>{T.cnt+=it.cnt;T.rev+=it.rev;if(it.cost!=null){T.cost+=it.cost;T.profit+=it.profit;T.known=true;}});
  const pct=(v,tot)=>tot?(v/tot*100).toFixed(1)+"%":"";
  const shareBar=share=>`<div class="kt-share-wrap"><span class="kt-share-pct">${share.toFixed(1)}%</span><span class="kt-share-track"><span class="kt-share-fill" style="width:${Math.min(100,share).toFixed(2)}%"></span></span></div>`;
  const rows=items.map((it,i)=>{
    const costKnown=it.cost!=null;
    const profColor=costKnown&&it.profit<0?"#E24B4A":"#1D9E75";
    const costCell=costKnown?fmtSom(it.cost):dash;
    const profCell=costKnown?`<span style="color:${profColor};font-weight:700">${fmtSom(it.profit)}</span>`:dash;
    const marjaCell=costKnown?it.marja+"%":dash;
    const unknownNote=it.unknownRev>0?`<div style="font-size:10px;color:#c7ac27;font-weight:600;margin-top:1px">+${fmtSom(it.unknownRev)} ${t("kt_unknown_cost_note")}</div>`:"";
    const costSh=costKnown?`<div class="kt-sh">${pct(it.cost,T.cost)}</div>`:"";
    const profSh=costKnown?`<div class="kt-sh">${pct(it.profit,T.profit)}</div>`:"";
    const share=T.rev?it.rev/T.rev*100:0;
    return `<tr class="kt-row" onclick="ktRowClick(${i})"><td style="color:#bbb;font-size:11px">${i+1}</td><td><div class="p2-prod-name" style="display:flex;align-items:center;gap:6px">${chevron}${esc(it.name)}</div></td><td style="text-align:right">${it.cnt.toLocaleString()}</td><td style="text-align:right;font-weight:600">${fmtSom(it.rev)}${unknownNote}</td><td style="text-align:right;color:#EF9F27">${costCell}${costSh}</td><td style="text-align:right">${profCell}${profSh}</td><td style="text-align:right">${marjaCell}</td><td class="kt-share-td">${shareBar(share)}</td></tr>`;
  }).join("");
  tbody.innerHTML=rows||`<tr><td colspan="8" style="text-align:center;padding:40px;color:#bbb">${ktQ?t("p2_not_found"):t("sp6_no_data")}</td></tr>`;
  if(tfoot){
    if(!allItems.length){tfoot.innerHTML="";}
    else{
      const profColor=T.known&&T.profit<0?"#E24B4A":"#1D9E75";
      tfoot.innerHTML=`<tr>
<td></td>
<td class="kt-foot-lbl">${t("sp_stat_jami")}</td>
<td style="text-align:right;font-weight:800">${T.cnt.toLocaleString()}</td>
<td style="text-align:right;font-weight:800">${fmtSom(T.rev)}</td>
<td style="text-align:right;font-weight:800;color:#EF9F27">${T.known?fmtSom(T.cost):dash}</td>
<td style="text-align:right;font-weight:800;color:${profColor}">${T.known?fmtSom(T.profit):dash}</td>
<td></td>
<td class="kt-share-td">${shareBar(100)}</td>
</tr>`;
    }
  }
}
function _ktEnsureDetailStyles(){
  if(document.getElementById("kt-detail-style"))return;
  const st=document.createElement("style");
  st.id="kt-detail-style";
  st.textContent=`#kt-fullscreen,#kt-mz-page{position:fixed!important;top:0;bottom:0;left:195px;right:0;background:#fff;box-sizing:border-box;transition:left .18s ease}body.sb-collapsed #kt-fullscreen,body.sb-collapsed #kt-mz-page{left:64px}#kt-fullscreen{overflow-y:auto;overflow-x:auto;z-index:1500}#kt-mz-page{overflow-y:auto;overflow-x:hidden;padding:0 24px 60px;z-index:1600}.kt-prod-link{cursor:pointer}.kt-prod-link:hover{text-decoration:underline;color:#1D9E75}.kt-dtbl{table-layout:fixed;width:100%;font-size:13.5px;border-collapse:collapse}.kt-dtbl th{position:sticky;top:0;z-index:1;background:#fafaf5;color:#94A3B8;font-size:11px;font-weight:700;text-align:left;padding:12px 14px;border-bottom:1.5px solid #eee;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:.04em;text-transform:uppercase;user-select:none}.kt-dtbl th[onclick]{cursor:pointer}.kt-dtbl td{padding:12px 14px;border-bottom:1px solid #ebe8e0;color:#1F2937;vertical-align:middle;overflow-wrap:break-word;font-variant-numeric:tabular-nums}.kt-dtbl th:last-child,.kt-dtbl td:last-child{padding-right:22px}.kt-dtbl tbody tr:hover td{background:#f0faf6}`;
  document.head.appendChild(st);
}
function _ktDetailStats(){
  const items=ktDetailAllProds;
  const rev=items.reduce((a,p)=>a+(p.rev||0),0);
  const known=items.filter(p=>p.cost!=null);
  const knownRev=known.reduce((a,p)=>a+(p.rev||0),0);
  const cost=known.length?known.reduce((a,p)=>a+(p.cost||0),0):null;
  // Foyda faqat tannarxi ma'lum tushum qismidan (knownRev) - jami tushumdan (rev) emas,
  // aks holda noma'lum-tannarxli mahsulotlar "0 xarajat"dek hisoblanib marja shishib ketadi.
  const profit=known.length?knownRev-cost:null;
  const abc={A:0,B:0,C:0};items.forEach(p=>{if(abc[p.abc]!=null)abc[p.abc]++;});
  return{rev,cost,profit,unknownRev:Math.round(rev-knownRev),jami:items.length,a:abc.A,b:abc.B,c:abc.C};
}
function _ktFmtSom(n){if(n==null)return"—";const v=Math.round(n);return (v<0?"-":"")+Math.abs(v).toLocaleString();}
function _ktSummaryH(){
  const st=_ktDetailStats();
  const NEUTRAL_BG="#F5F6F8",NEUTRAL_BORDER="1px solid #EAECEF";
  const tile=(label,val,note)=>`<div style="background:${NEUTRAL_BG};border:${NEUTRAL_BORDER};border-radius:10px;padding:8px 14px;font-size:12px"><span style="color:#888;font-weight:600">${label}: </span><span style="color:#1a1a2e;font-weight:800;font-variant-numeric:tabular-nums">${val}</span>${note||""}</div>`;
  const abcTile=(letter,color,val)=>`<div style="background:${NEUTRAL_BG};border:${NEUTRAL_BORDER};border-radius:10px;padding:8px 14px;font-size:12px;color:${color};font-weight:800"><span>${letter}</span><span style="font-weight:600">: </span><span style="font-variant-numeric:tabular-nums">${val}</span></div>`;
  const revNote=st.unknownRev>0?` <span style="color:#c7ac27;font-weight:700">(+${_ktFmtSom(st.unknownRev)} ${t("kt_unknown_cost_note")})</span>`:"";
  return `<div id="kt-ov-summary" style="flex-shrink:0;display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:12px 14px;border-bottom:1.5px solid #f0f0ec">`
    +tile(t("sp_stat_tushum"),_ktFmtSom(st.rev),revNote)
    +tile(t("sp_stat_tannarx"),_ktFmtSom(st.cost))
    +tile(t("sp_stat_foyda"),_ktFmtSom(st.profit))
    +tile(t("sp_stat_jami"),st.jami+" "+t("sp_ta"))
    +abcTile("A","#085041",st.a)+abcTile("B","#633806",st.b)+abcTile("C","#A32D2D",st.c)
    +`</div>`;
}
// 2026-08-19 (Bilol so'rovi): har mahsulot uchun MARJA (foyda/tushum %)
// ustuni qo'shildi - kategoriya darajasidagi jadvalda allaqachon bor edi
// (ktCompute()dagi mkEntry), shu FORMULA (foyda/tushum*100) aynan bir xil
// har bir QATOR uchun ham qo'llanildi - shu bo'linmada qaysi mahsulot
// narxi past/baland (marja g'ayrioddiy past yoki manfiy) darhol ko'rinadi.
function _ktDetailMatrixInner(){
  const q=ktDetailQ;
  let items=q?ktDetailAllProds.filter(p=>_matchNSB(p,q)):ktDetailAllProds.slice();
  const marjaOf=p=>(p.cost!=null&&p.rev)?((p.rev-p.cost)/p.rev*100):null;
  if(ktDetailSortKey){
    const gv=p=>{switch(ktDetailSortKey){case "name":return (p.name||"").toLowerCase();case "qty":return p.qty||0;case "rev":return p.rev||0;case "cost":return p.cost||0;case "profit":return (p.rev||0)-(p.cost||0);case "marja":return marjaOf(p)??-Infinity;case "abc":return p.abc||"";default:return 0;}};
    items=items.slice().sort((a,b)=>{const av=gv(a),bv=gv(b);if(typeof av==="string")return ktDetailSortDir*av.localeCompare(bv,"ru");return ktDetailSortDir*(av-bv);});
  }
  ktDetailProds=items;
  if(!items.length)return `<div style="flex:1;display:flex;align-items:center;justify-content:center;color:#bbb;padding:40px">${q?t("p2_not_found"):t("sp6_no_data")}</div>`;
  const abcBg={A:"#e8f8f3",B:"#eeebfb",C:"#fef3e2"},abcFg={A:"#1D9E75",B:"#534AB7",C:"#EF9F27"};
  const dash=`<span style="color:#c8c8ce">—</span>`;
  const rows=items.map((p,i)=>{
    const costKnown=p.cost!=null;
    const profit=costKnown?(p.rev||0)-p.cost:null;
    const profColor=profit!=null&&profit<0?"#E24B4A":"#1D9E75";
    const skuLine=p.sku?`<div class="p2-prod-meta"><span class="p2-chip">SKU: ${esc(p.sku)}</span></div>`:"";
    const abc=p.abc||"";
    const abcCell=abc?`<span style="display:inline-block;padding:2px 10px;border-radius:6px;font-size:11px;font-weight:800;background:${abcBg[abc]};color:${abcFg[abc]}">${abc}</span>`:dash;
    const costCell=costKnown?_ktFmtSom(p.cost):dash;
    const profCell=costKnown?`<span style="color:${profColor};font-weight:700">${_ktFmtSom(profit)}</span>`:dash;
    const marja=marjaOf(p);
    const marjaCell=marja!=null?`<span style="color:${marja<0?"#E24B4A":"#1D9E75"};font-weight:700">${marja.toFixed(1)}%</span>`:dash;
    return `<tr><td style="color:#bbb;font-size:10px;text-align:center">${i+1}</td><td><div class="p2-prod-name kt-prod-link" onclick="ktGoToProduct(${i})" title="${esc(p.name)}">${esc(p.name)}</div>${skuLine}</td><td style="text-align:center">${abcCell}</td><td style="text-align:right">${p.qty.toLocaleString()}</td><td style="text-align:right;font-weight:600">${_ktFmtSom(p.rev)}</td><td style="text-align:right;color:#EF9F27">${costCell}</td><td style="text-align:right">${profCell}</td><td style="text-align:right">${marjaCell}</td></tr>`;
  }).join("");
  const th=(label,key,align)=>{const st=align?` style="text-align:${align}"`:"";if(!key)return `<th${st}>${label}</th>`;const s=ktDetailSortKey===key;const arrow=s?(ktDetailSortDir===1?" ↑":" ↓"):"";return `<th${st} onclick="ktDetailSortBy('${key}')">${label}${arrow}</th>`;};
  return `<table class="kt-dtbl"><colgroup><col style="width:5%"><col style="width:25%"><col style="width:6%"><col style="width:10%"><col style="width:14%"><col style="width:14%"><col style="width:13%"><col style="width:13%"></colgroup><thead><tr>${th("#",null,"center")}${th(t("sp_prod_name"),"name")}${th("ABC","abc","center")}${th(t("kt_col_qty"),"qty","right")}${th(t("sp_stat_tushum"),"rev","right")}${th(t("sp_stat_tannarx"),"cost","right")}${th(t("sp_stat_foyda"),"profit","right")}${th(t("sp_stat_marja"),"marja","right")}</tr></thead><tbody>${rows}</tbody></table>`;
}
function ktDetailSortBy(key){
  if(ktDetailSortKey===key){ktDetailSortDir=-ktDetailSortDir;}else{ktDetailSortKey=key;ktDetailSortDir=key==="name"?1:-1;}
  const wrap=document.getElementById("kt-matrix-wrap-outer");if(wrap)wrap.innerHTML=_ktDetailMatrixInner();
}
function ktDetailSearch(val){
  const clr=document.getElementById("kt-det-clear");if(clr)clr.style.display=val?"flex":"none";
}
// 2026-08-12: og'ir qism (jadval qayta chizish) faqat Enter bosilganda.
function ktDetailSearchSubmit(val){
  ktDetailQ=(val||"").toLowerCase().trim();
  const wrap=document.getElementById("kt-matrix-wrap-outer");if(wrap)wrap.innerHTML=_ktDetailMatrixInner();
  requestAnimationFrame(_ktSyncDetailStickyTop);
}
function ktDetailClearSearch(){
  const inp=document.getElementById("kt-det-q");if(inp)inp.value="";
  ktDetailSearch("");
  ktDetailSearchSubmit("");
  if(inp)inp.focus();
}
function _ktMzMatrixInner(){
  const q=ktMzQ;
  let items=q?ktMzAllItems.filter(v=>_matchNSB(v,q)):ktMzAllItems.slice();
  if(ktMzSortKey){
    const gv=v=>{switch(ktMzSortKey){case "name":return (v.name||"").toLowerCase();case "stock":return v.stock||0;case "buy":return v.sp||0;case "frozen":return v.frozenVal||0;case "sell":return v.rp||0;case "days":return v.di>=999?99999:(v.di||0);case "lastkirim":return krLastDate(v.sku)||"";default:return 0;}};
    items=items.slice().sort((a,b)=>{const av=gv(a),bv=gv(b);if(typeof av==="string")return ktMzSortDir*av.localeCompare(bv,"ru");return ktMzSortDir*(av-bv);});
  }
  ktMzViewItems=items;
  if(!items.length)return `<div style="padding:40px;text-align:center;color:#bbb">${t("p2_not_found")}</div>`;
  const fmtP=n=>n?Math.round(n).toLocaleString()+" so'm":"—";
  const rows=items.map((v,i)=>{
    const stk=v.kg?(v.stock||0).toFixed(2):Math.round(v.stock||0);
    const diNum=v.di>=999?"60+":String(v.di);
    const skuLine=v.sku?`<div class="p2-prod-meta"><span class="p2-chip">SKU: ${esc(v.sku)}</span></div>`:"";
    const fv=v.frozenVal||0;
    const fvStr=fv>=1e6?`${(fv/1e6).toFixed(1)} mln`:`${fv.toLocaleString()}`;
    const lastKirim=krFmtDate(krLastDate(v.sku))||"—";
    return `<tr><td style="color:#bbb;font-size:10px;text-align:center">${i+1}</td><td><div class="p2-prod-name" title="${esc(v.name)}">${esc(v.name)}</div>${skuLine}</td><td style="text-align:right;color:#1D9E75;font-weight:700">${stk}</td><td style="text-align:right;color:#534AB7;font-weight:600">${fmtP(v.sp)}</td><td style="text-align:right;color:#EF9F27;font-weight:700">${fvStr} so'm</td><td style="text-align:right;color:#1D9E75;font-weight:600">${fmtP(v.rp)}</td><td style="text-align:right;color:#999">${diNum} ${t("sp_days_unit")}</td><td style="text-align:right;color:#777">${lastKirim}</td></tr>`;
  }).join("");
  const th=(label,key,align)=>{const st=align?` style="text-align:${align}"`:"";if(!key)return `<th${st}>${label}</th>`;const s=ktMzSortKey===key;const arrow=s?(ktMzSortDir===1?" ↑":" ↓"):"";return `<th${st} onclick="ktMzSortBy('${key}')">${label}${arrow}</th>`;};
  return `<table class="kt-dtbl"><colgroup><col style="width:5%"><col style="width:26%"><col style="width:12%"><col style="width:14%"><col style="width:15%"><col style="width:14%"><col style="width:9%"><col style="width:11%"></colgroup><thead><tr>${th("#",null,"center")}${th(t("sp_mz_prod"),"name")}${th(t("sp_mz_stock"),"stock","right")}${th(t("sp_mz_buy"),"buy","right")}${th(t("sp_mz_frozen"),"frozen","right")}${th(t("sp_mz_sell"),"sell","right")}${th(t("sp_mz_days"),"days","right")}${th(t("sp_mz_lastkirim"),"lastkirim","right")}</tr></thead><tbody>${rows}</tbody></table>`;
}
function ktMzSortBy(key){
  if(ktMzSortKey===key){ktMzSortDir=-ktMzSortDir;}else{ktMzSortKey=key;ktMzSortDir=key==="name"?1:-1;}
  const wrap=document.getElementById("kt-mz-wrap-outer");if(wrap)wrap.innerHTML=_ktMzMatrixInner();
}
function ktMzSearch(val){
  const clr=document.getElementById("kt-mz-clear");if(clr)clr.style.display=val?"flex":"none";
}
// 2026-08-12: og'ir qism (jadval qayta chizish) faqat Enter bosilganda.
function ktMzSearchSubmit(val){
  ktMzQ=(val||"").toLowerCase().trim();
  const wrap=document.getElementById("kt-mz-wrap-outer");if(wrap)wrap.innerHTML=_ktMzMatrixInner();
  requestAnimationFrame(_ktSyncMzStickyTop);
}
function ktMzClearSearch(){
  const inp=document.getElementById("kt-mz-q");if(inp)inp.value="";
  ktMzSearch("");
  ktMzSearchSubmit("");
  if(inp)inp.focus();
}
function ktShowMzPage(){
  const mz=document.getElementById("kt-mz-page");if(!mz)return;
  mz.style.display="block";mz.scrollTop=0;
  _ktSyncMzStickyTop();
  requestAnimationFrame(_ktSyncMzStickyTop);
  _ktObserveHeaderResize(mz.firstElementChild,_ktSyncMzStickyTop);
}
// Sotilmayotgan ro'yxati Kategoriyalar sahifasining O'ZIGA tanlangan sana oralig'iga mos
// bo'lishi kerak (Stock/p5'ning global, doim 15/30-kunlik oynaga qarab hisoblangan "signal"
// klassifikatsiyasidan farqli) - shuning uchun ZITEMS'ning signal maydoniga tayanmaymiz,
// har mahsulot uchun HIST'dan aynan shu ktStart..ktEnd oralig'ida sotuv bo'lgan-bo'lmaganini
// o'zimiz tekshiramiz. Kengroq oraliq tanlansa (mas. 30 kun) - ko'proq tovar "sotilgan"
// safiga o'tib, sotilmayotganlar soni tabiiy ravishda kamayadi.
function _ktComputeMzItems(subName){
  if(!ZITEMS||!HIST||!HISTMETA||!ktStart||!ktEnd)return[];
  const s=Math.max(0,_oaDayIdx(HISTMETA.base,ktStart));
  const e=Math.min(HISTMETA.days-1,_oaDayIdx(HISTMETA.base,ktEnd));
  return ZITEMS.filter(v=>{
    if(v.cat!==subName)return false;
    const dArr=v.sku?HIST.d["sku:"+v.sku]:null;
    if(!dArr)return true;
    for(let i=s;i<=e;i++){if(dArr[i])return false;}
    return true;
  }).sort((a,b)=>(b.frozenVal||0)-(a.frozenVal||0));
}
function ktOpenSub(topName,subName){
  if(!KT_TOP)return;
  const top=KT_TOP.find(x=>x.name===topName);
  const sub=top&&top.subs.find(x=>x.name===subName);
  if(!sub)return;
  ktSelTop=topName;ktSelSub=subName;
  ktDetailAllProds=sub.items;
  ktDetailQ="";ktDetailSortKey=null;ktDetailSortDir=-1;
  ktMzAllItems=_ktComputeMzItems(subName);
  ktMzQ="";ktMzSortKey=null;ktMzSortDir=-1;
  _ktShowOverlay(sub);
}
function _ktShowOverlay(sub){
  const p10el=document.getElementById("p10");if(!p10el)return;
  p10el.style.position="relative";
  _ktEnsureDetailStyles();
  let ov=document.getElementById("kt-fullscreen");
  if(!ov){ov=document.createElement("div");ov.id="kt-fullscreen";ov.style.display="none";p10el.appendChild(ov);}
  let mzPage=document.getElementById("kt-mz-page");
  if(!mzPage){mzPage=document.createElement("div");mzPage.id="kt-mz-page";mzPage.style.display="none";p10el.appendChild(mzPage);}
  const searchIcon=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="position:absolute;left:14px;top:50%;transform:translateY(-50%);width:17px;height:17px;color:#b5bac4;pointer-events:none"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>`;
  const clearBtn=(id,fn,q)=>`<button id="${id}" onclick="${fn}" style="display:${q?"flex":"none"};align-items:center;justify-content:center;position:absolute;right:14px;top:50%;transform:translateY(-50%);width:18px;height:18px;background:none;border:none;cursor:pointer;color:#b5bac4;font-size:13px;line-height:1;padding:0;" title="Tozalash">✕</button>`;
  const searchH=`<div style="padding:0 14px 12px"><div class="sp-search" style="max-width:340px">${searchIcon}<input id="kt-det-q" type="text" placeholder="${esc(t("p2_search_ph"))}" value="${esc(ktDetailQ)}" oninput="ktDetailSearch(this.value)" onkeydown="if(event.key==='Enter'){event.preventDefault();ktDetailSearchSubmit(this.value);}">${clearBtn("kt-det-clear","ktDetailClearSearch()",ktDetailQ)}</div></div>`;
  const xlsIcon=`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2F6FED" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></svg>`;
  const detExportBtn=`<button class="xls-export-btn" onclick="ktExportDetailXLSX()" style="flex-shrink:0">${xlsIcon}${t("export_btn")}</button>`;
  const mzCount=ktMzAllItems.length;
  const mzToggle=mzCount?`<button onclick="ktShowMzPage()" style="margin-left:auto;display:inline-flex;align-items:center;gap:8px;padding:7px 14px;border-radius:14px;border:1.5px solid #d4f0e5;background:#f0faf6;color:#1D9E75;font-size:13px;font-weight:700;cursor:pointer;flex-shrink:0">🛒 ${t("sp_mz_btn")} <span style="background:#1D9E75;color:#fff;border-radius:8px;padding:1px 8px;font-size:11px;font-weight:700">${mzCount}</span></button>`:"";
  ov.innerHTML=`<div id="kt-ov-header" style="position:sticky;top:0;background:#fff;z-index:2">
    <div class="mob-ov-hdr" style="padding:14px 14px 12px;border-bottom:1.5px solid #f0f0ec;display:flex;align-items:center;gap:12px;flex-wrap:nowrap;min-width:0;overflow:hidden">
      <button onclick="ktCloseOverlay()" style="display:inline-flex;align-items:center;gap:6px;padding:7px 16px;border-radius:14px;border:1.5px solid #e6e2f7;background:#fff;font-size:13px;font-weight:600;color:#534AB7;cursor:pointer;flex-shrink:0">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        ${t("kt_back_cat")}
      </button>
      <span style="font-size:15px;font-weight:700;color:#1a1a2e;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(sub.name)}</span>
      ${detExportBtn}
      ${mzToggle}
    </div>
    ${_ktSummaryH()}${searchH}
  </div>
  <div style="padding:0 14px 40px" id="kt-matrix-wrap-outer">${_ktDetailMatrixInner()}</div>`;
  if(mzCount){
    const mzSearchH=`<div style="padding:0 0 12px"><div class="sp-search" style="max-width:340px">${searchIcon}<input id="kt-mz-q" type="text" placeholder="${esc(t("p2_search_ph"))}" value="${esc(ktMzQ)}" oninput="ktMzSearch(this.value)" onkeydown="if(event.key==='Enter'){event.preventDefault();ktMzSearchSubmit(this.value);}">${clearBtn("kt-mz-clear","ktMzClearSearch()",ktMzQ)}</div></div>`;
    mzPage.innerHTML=`<div style="position:sticky;top:0;background:#fff;z-index:2">
      <div class="mob-ov-hdr" style="padding:14px 0 12px;border-bottom:1.5px solid #f0f0ec;display:flex;align-items:center;gap:12px">
        <button onclick="document.getElementById('kt-mz-page').style.display='none'" style="display:inline-flex;align-items:center;gap:6px;padding:7px 16px;border-radius:14px;border:1.5px solid #e6e2f7;background:#fff;font-size:13px;font-weight:600;color:#534AB7;cursor:pointer;flex-shrink:0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          ${t("kt_back_cat")}
        </button>
        <span style="font-size:15px;font-weight:700;color:#1a1a2e">🛒 ${t("sp_mz_btn")} <span style="background:#1D9E75;color:#fff;border-radius:8px;padding:2px 9px;font-size:13px;font-weight:700;margin-left:6px">${mzCount}</span></span>
        <button class="xls-export-btn" onclick="ktExportMzXLSX()" style="flex-shrink:0;margin-left:auto">${xlsIcon}${t("export_btn")}</button>
      </div>
      ${mzSearchH}
    </div>
    <div id="kt-mz-wrap-outer">${_ktMzMatrixInner()}</div>`;
    mzPage.style.display="none";
  }else{
    mzPage.innerHTML="";mzPage.style.display="none";
  }
  ov.style.display="block";ov.scrollTop=0;
  _ktSyncDetailStickyTop();
  requestAnimationFrame(_ktSyncDetailStickyTop);
  _ktObserveHeaderResize(document.getElementById("kt-ov-header"),_ktSyncDetailStickyTop);
}
// Sarlavha balandligi bir marta (rAF'da) o'lchanib QOTIRILGAN edi - agar keyinroq
// (shrift yuklanishi, oyna o'lchami, qidiruv "tozalash" tugmasi ko'rinishi kabi
// sabablar bilan) balandlik o'zgarsa, jadval sarlavhasi statistik panel bilan
// ustma-ust tushib qolardi (2026-08-18, foydalanuvchi skrinshotda topdi).
// ResizeObserver har o'zgarishda avtomatik qayta hisoblaydi - bir martalik
// o'lchashga qaraganda ancha ishonchli.
const _ktRO={};
function _ktObserveHeaderResize(hdrEl,syncFn){
  if(!hdrEl||typeof ResizeObserver==="undefined")return;
  const key=hdrEl.id||"mz";
  if(_ktRO[key])_ktRO[key].disconnect();
  _ktRO[key]=new ResizeObserver(()=>syncFn());
  _ktRO[key].observe(hdrEl);
}
function _ktSyncDetailStickyTop(){
  const ov=document.getElementById("kt-fullscreen");
  const hdr=document.getElementById("kt-ov-header");
  if(!ov||!hdr)return;
  const h=Math.ceil(hdr.getBoundingClientRect().height);
  ov.querySelectorAll("#kt-matrix-wrap-outer .kt-dtbl th").forEach(th=>{th.style.top=h+"px";});
}
function _ktSyncMzStickyTop(){
  const mz=document.getElementById("kt-mz-page");
  if(!mz)return;
  const hdr=mz.firstElementChild;
  if(!hdr)return;
  const h=Math.ceil(hdr.getBoundingClientRect().height);
  mz.querySelectorAll("#kt-mz-wrap-outer .kt-dtbl th").forEach(th=>{th.style.top=h+"px";});
}
function ktCloseOverlay(){
  const ov=document.getElementById("kt-fullscreen");if(ov)ov.style.display="none";
  const mz=document.getElementById("kt-mz-page");if(mz)mz.style.display="none";
  ktSelTop=null;ktSelSub=null;ktDetailProds=[];ktDetailAllProds=[];ktDetailQ="";ktMzAllItems=[];ktMzQ="";ktMzViewItems=[];
}
async function ktGoToProduct(pi){
  const p=ktDetailProds[pi];if(!p)return;
  _zBackPage="p10";
  const p2btn=document.querySelector('.sb-item[data-page="p2"]');
  if(p2btn)await showPage(p2btn);
  if(!P2)return;
  let idx=-1;
  if(p.sku)idx=P2.findIndex(v=>String(v.sku||"")===String(p.sku));
  if(idx<0)idx=P2.findIndex(v=>v.name===p.name);
  const pq=document.getElementById("pf-q");
  if(pq){pq.value=idx>=0?P2[idx].name:p.name;if(typeof pfQToggle==="function")pfQToggle();if(typeof p2Filter==="function")p2Filter();}
  if(idx>=0&&typeof p2Open==="function")p2Open(P2[idx]._i!=null?P2[idx]._i:idx);
  const bb=document.getElementById("z-back");
  if(bb){bb.style.display="inline-flex";bb.textContent=t("kt_back_label");}
}
function _ktSafeName(s){return String(s||"").replace(/[\\/:*?"<>|\[\]]/g,"_");}
function _ktSafeSheetName(s){let n=_ktSafeName(s).slice(0,31).replace(/^'+|'+$/g,"").trim();return n||"Kategoriya";}
async function ktExportTopXLSX(){
  await _ensureExcelJS();
  if(!KT_TOP||typeof ExcelJS==="undefined")return;
  let items=ktCurItems();
  if(ktQ)items=items.filter(it=>it.name.toLowerCase().includes(ktQ));
  const wb=new ExcelJS.Workbook();
  const sheetName=ktLevel==="sub"?_ktSafeSheetName(ktCurTop):t("nav_p10");
  const ws=wb.addWorksheet(sheetName,{views:[{state:"frozen",ySplit:2}]});
  ws.mergeCells("A1:J1");
  ws.getCell("A1").value=(ktLevel==="sub"?ktCurTop+" — ":"")+ktStart+" — "+ktEnd;
  ws.getCell("A1").font={bold:true,size:12,color:{argb:"FFFFFF"}};
  ws.getCell("A1").alignment={horizontal:"center",vertical:"middle"};
  ws.getCell("A1").fill={type:"pattern",pattern:"solid",fgColor:{argb:"534AB7"}};
  ws.getRow(1).height=22;
  ws.addRow(["#",t("kt_col_name"),t("kt_col_qty_cnt"),t("sp_stat_tushum"),t("sp_stat_tannarx"),t("sp_stat_foyda"),t("sp_stat_marja"),"A","B","C"]);
  ws.getRow(2).eachCell(c=>{c.font={bold:true,color:{argb:"FFFFFF"}};c.fill={type:"pattern",pattern:"solid",fgColor:{argb:"1D9E75"}};c.alignment={horizontal:"center",vertical:"middle"};});
  items.forEach((it,i)=>{
    const costKnown=it.cost!=null;
    const row=ws.addRow([i+1,it.name,it.cnt,Math.round(it.rev),costKnown?Math.round(it.cost):"—",costKnown?Math.round(it.profit):"—",costKnown?it.marja+"%":"—",it.abcCnt.A,it.abcCnt.B,it.abcCnt.C]);
    row.getCell(2).alignment={horizontal:"left"};
    row.getCell(4).numFmt='#,##0 "so\'m"';row.getCell(4).alignment={horizontal:"right"};
    if(costKnown){[5,6].forEach(c=>{row.getCell(c).numFmt='#,##0 "so\'m"';row.getCell(c).alignment={horizontal:"right"};});}
    else{[5,6].forEach(c=>{row.getCell(c).alignment={horizontal:"right"};});}
  });
  ws.columns=[{width:6},{width:38},{width:14},{width:16},{width:16},{width:16},{width:10},{width:6},{width:6},{width:6}];
  const buf=await wb.xlsx.writeBuffer();
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([buf],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));
  a.download=`kategoriyalar_${ktStart}_${ktEnd}.xlsx`;
  a.click();URL.revokeObjectURL(a.href);
}
// 2026-08-19 (Bilol so'rovi): "oxirgi kelish narxi" va "hozirgi sotilish
// narxi" o'rtasidagi marja (davr bo'yicha o'rtacha EMAS, aynan HOZIRGI ikki
// narx nisbati) 20%dan kam bo'lgan BARCHA tovarlarni (butun katalog
// bo'yicha, faqat joriy kategoriya emas) Excel'ga chiqaradi. Kelish narxi
// - v.rcost (build_prev_avg.py: haqiqiy kirim tarixidagi ENG SO'NGGI narx,
// kirim topilmasa taxminiy katalog narxiga tushadi - shu holat rcostApprox
// bilan belgilanadi va bu ro'yxatdan CHIQARIB TASHLANADI, chunki "aniq
// hisoblangan" so'ralgan edi, taxminiy emas).
const KT_LOW_MARGIN_PCT=20;
async function ktExportLowMarginXLSX(){
  await _ensureExcelJS();
  if(!P2||typeof ExcelJS==="undefined")return;
  const rows=[];
  P2.forEach(v=>{
    // v.rcost enrichment paytida "iv.rcost||0" bilan o'rnatiladi - ya'ni
    // "ma'lumot yo'q" va "haqiqatan 0 so'm" ikkalasi ham 0 bo'lib chiqadi.
    // Bu yerda "aniq hisoblangan" so'ralgani uchun ikkalasi ham chetlab
    // o'tiladi (0/noma'lum narxni "100% marja" deb noto'g'ri hisoblab
    // qo'ymaslik uchun).
    if(!v.rcost||v.rcostApprox)return;
    const sell=v.iprice||v.p||0;
    if(!sell)return;
    const cost=v.rcost;
    const profit=sell-cost;
    const marja=profit/sell*100;
    if(marja>=KT_LOW_MARGIN_PCT)return;
    rows.push({bc:(v.bc||[]).join(", "),name:v.name,sku:v.sku||"",sell,cost,profit,marja});
  });
  rows.sort((a,b)=>a.marja-b.marja);
  const wb=new ExcelJS.Workbook();
  const ws=wb.addWorksheet(t("nav_p10"),{views:[{state:"frozen",ySplit:2}]});
  ws.mergeCells("A1:F1");
  ws.getCell("A1").value=`Marja < ${KT_LOW_MARGIN_PCT}% (${rows.length} ta tovar)`;
  ws.getCell("A1").font={bold:true,size:12,color:{argb:"FFFFFF"}};
  ws.getCell("A1").alignment={horizontal:"center",vertical:"middle"};
  ws.getCell("A1").fill={type:"pattern",pattern:"solid",fgColor:{argb:"E24B4A"}};
  ws.getRow(1).height=22;
  ws.addRow(["Shtrix kod",t("sp_prod_name"),t("xls_th_sell_price"),t("kpi_cost_l"),t("sp_stat_foyda"),t("sp_stat_marja")]);
  ws.getRow(2).eachCell(c=>{c.font={bold:true,color:{argb:"FFFFFF"}};c.fill={type:"pattern",pattern:"solid",fgColor:{argb:"1D9E75"}};c.alignment={horizontal:"center",vertical:"middle"};});
  rows.forEach(r=>{
    const row=ws.addRow([r.bc,r.name,Math.round(r.sell),Math.round(r.cost),Math.round(r.profit),Math.round(r.marja*10)/10+"%"]);
    row.getCell(2).alignment={horizontal:"left"};
    [3,4,5].forEach(c=>{row.getCell(c).numFmt='#,##0 "so\'m"';row.getCell(c).alignment={horizontal:"right"};});
    row.getCell(6).alignment={horizontal:"right"};
    if(r.marja<0)row.getCell(6).font={color:{argb:"E24B4A"},bold:true};
  });
  ws.columns=[{width:16},{width:42},{width:16},{width:16},{width:16},{width:10}];
  const buf=await wb.xlsx.writeBuffer();
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([buf],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));
  a.download=`past_marjali_tovarlar_${new Date().toISOString().slice(0,10)}.xlsx`;
  a.click();URL.revokeObjectURL(a.href);
}

// ─── p12 "Marja nazorati" — sotilish narxi va OXIRGI kelish narxi orasidagi
// marjasi belgilangan chegaradan past BARCHA tovarlarni bildirishnoma-oqim
// (kartochkalar) sifatida doim ko'rsatib turadi, eng past marjali eng
// tepada (foydalanuvchi so'rovi, 2026-08-21). ktExportLowMarginXLSX() bilan
// BIR XIL formula (v.rcost/v.iprice, taxminiy narxlilar chetlab o'tiladi) -
// lekin bu yerda chegara QOTIB QOLMAGAN (mgThreshold, standart 20%),
// foydalanuvchi o'zgartirishi mumkin. Yangi kirim kelib v.rcost oshsa
// (yoki kamaysa) - keyingi renderda (bg-refresh yoki qayta ochilganda)
// marja o'zi qayta hisoblanadi, alohida "yangi/eski" holat saqlanmaydi -
// har doim JORIY holatni ko'rsatadi. Sodda/tushunarli bo'lishi uchun
// interaktiv ustun-saralash yo'q - doim eng past marjadan boshlanadi.
let mgThreshold=20,mgQ="",mgCatFilter="",mgSupFilter="",mgSortKey="marja",mgSortDir=1;
function mgCurRows(){
  const rows=[];
  if(!P2)return rows;
  P2.forEach(v=>{
    if(!v.rcost||v.rcostApprox)return;
    const sell=v.iprice||v.p||0;
    if(!sell)return;
    const cost=v.rcost;
    const profit=sell-cost;
    const marja=profit/sell*100;
    if(marja>=mgThreshold)return;
    const stock=v.calcStock!=null?v.calcStock:(v.amt!=null?v.amt:null);
    rows.push({bc:(v.bc||[]).join(", "),name:v.name,sku:v.sku||"",cat:v.catTop||v.cat||"",sup:v.sup||"",sell,cost,profit,marja,stock,kg:!!v.kg});
  });
  rows.sort((a,b)=>a.marja-b.marja);
  return rows;
}
async function mgInit(){
  if(!P2){
    _ensureDailyDemand();
    // _apiBoot() ba'zan (server sovuq boshlanishi va h.k.) uzoq osilib qolishi
    // mumkin - p2/p5/p7 buni sezmaydi, chunki foydalanuvchi odatda avval
    // boshqa sahifani ochib ulguradi (shu payt _apiBoot() allaqachon tayyor
    // bo'ladi). Bu yerga TO'G'RIDAN-TO'G'RI (sovuq) kirilishi mumkinligi
    // uchun 6 soniyadan keyin sekinroq, lekin ISHONCHLI zaxira yo'lga
    // (_ensureP2Data() ning statik fayl fallback'iga) o'tamiz - "Yuklanmoqda..."
    // abadiy qolib ketmasligi uchun.
    let apiData=null;
    try{
      apiData=await Promise.race([_apiBoot(),new Promise((_,rej)=>setTimeout(()=>rej(new Error("apiBoot timeout")),6000))]);
    }catch(e){apiData=null;}
    await _ensureP2Data(apiData);
    await initP2(apiData);
  }
  _mgRefreshFilters();
  mgRenderList();
}
// Kategoriya/Ta'minotchi filtri (foydalanuvchi so'rovi, 2026-08-22) - Zakas
// ro'yxat darajasidagi filtr bilan BIR XIL naqsh (p2-fwrap/p2-fbtn/zk-fpop/
// p2-fgrp, _zkRefreshListCatFilters() ga o'xshash) - variantlar HOZIRGI
// chegaradan past tovarlar orasidan yig'iladi.
function _mgRefreshFilters(){
  const sel1=document.getElementById("mg-cat-filter");
  const sel2=document.getElementById("mg-sup-filter");
  if(!sel1||!sel2)return;
  const rows=mgCurRows();
  const cats=[...new Set(rows.map(r=>r.cat).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ru"));
  sel1.innerHTML=`<option value="">${t("zk_all_cat")}</option>`+cats.map(c=>`<option value="${esc(c)}"${c===mgCatFilter?" selected":""}>${esc(c)}</option>`).join("");
  const sups=[...new Set(rows.map(r=>r.sup).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ru"));
  sel2.innerHTML=`<option value="">${t("filt_all")}</option>`+sups.map(s=>`<option value="${esc(s)}"${s===mgSupFilter?" selected":""}>${esc(s)}</option>`).join("");
  sselAttach("mg-cat-filter");sselAttach("mg-sup-filter");
  _mgFCount();
}
function mgCatFilterChange(v){mgCatFilter=v;_mgFCount();mgRenderList();}
function mgSupFilterChange(v){mgSupFilter=v;_mgFCount();mgRenderList();}
function _mgFCount(){
  let n=0;if(mgCatFilter)n++;if(mgSupFilter)n++;
  const b=document.getElementById("mg-fcount");if(b)b.textContent=n?"("+n+")":"";
  const btn=document.getElementById("mg-fbtn");if(btn)btn.classList.toggle("has",n>0);
}
function mgFToggle(e){if(e)e.stopPropagation();const p=document.getElementById("mg-fpop");if(p)p.classList.toggle("open");}
function mgClearFilters(){
  mgCatFilter="";mgSupFilter="";
  _mgRefreshFilters();
  mgRenderList();
  const p=document.getElementById("mg-fpop");if(p)p.classList.remove("open");
}
document.addEventListener("click",function(e){const w=document.getElementById("mg-fwrap");const p=document.getElementById("mg-fpop");if(w&&p&&!w.contains(e.target))p.classList.remove("open");});
function mgSortBy(key){
  if(mgSortKey===key)mgSortDir=-mgSortDir;else{mgSortKey=key;mgSortDir=key==="name"?1:-1;}
  mgRenderList();
}
function mgRenderList(){
  const tbody=document.getElementById("mg-tbody");
  if(!tbody)return;
  let items=mgCurRows();
  if(mgCatFilter)items=items.filter(v=>v.cat===mgCatFilter);
  if(mgSupFilter)items=items.filter(v=>v.sup===mgSupFilter);
  if(mgQ){
    const q=mgQ;
    items=items.filter(v=>v.name.toLowerCase().includes(q)||String(v.sku).toLowerCase().includes(q)||v.bc.toLowerCase().includes(q));
  }
  const suggOf=it=>mgThreshold>=100?Infinity:it.cost/(1-mgThreshold/100);
  const gv=it=>{switch(mgSortKey){case "name":return it.name.toLowerCase();case "sell":return it.sell;case "cost":return it.cost;case "suggested":return suggOf(it);case "profit":return it.profit;default:return it.marja;}};
  items=items.slice().sort((a,b)=>{const av=gv(a),bv=gv(b);if(typeof av==="string")return mgSortDir*av.localeCompare(bv,"ru");return mgSortDir*(av-bv);});
  const cnt=document.getElementById("mg-cnt");
  if(cnt)cnt.textContent=items.length.toLocaleString()+" "+t("mg_cnt_unit");
  document.querySelectorAll("#p12 .kt-tbl thead th").forEach(th=>{th.classList.remove("z-sort-asc","z-sort-desc");if(th.dataset.sortkey===mgSortKey)th.classList.add(mgSortDir>0?"z-sort-asc":"z-sort-desc");});
  if(!items.length){
    tbody.innerHTML=`<tr><td colspan="6" style="text-align:center;padding:40px;color:#bbb">${esc(t("mg_empty"))}</td></tr>`;
    return;
  }
  const fmtSom=n=>Math.round(n||0).toLocaleString();
  tbody.innerHTML=items.map(v=>{
    const sevColor=v.marja<0?"#E24B4A":v.marja<10?"#EF9F27":"#534AB7";
    const meta=v.sup||"";
    const sub=v.bc?esc(v.bc)+(meta?" | ":""):"";
    const subFull=(v.bc?v.bc+(meta?" | ":""):"")+meta;
    const sugg=suggOf(v);
    const suggTxt=isFinite(sugg)?fmtSom(sugg):"—";
    return `<tr><td><div class="mg-name mg-name-link" onclick="mgOpenKirimDetail('${esc(String(v.sku))}')" title="${esc(t("kr_det_sana"))}">${esc(v.name)}</div>${(sub||meta)?`<div class="mg-sub" title="${esc(subFull).replace(/"/g,"&quot;")}">${sub}${esc(meta)}</div>`:""}</td><td class="mg-num" style="text-align:right">${fmtSom(v.sell)}</td><td class="mg-num" style="text-align:right">${fmtSom(v.cost)}</td><td class="mg-num${v.profit<0?" mg-neg":""}" style="text-align:right">${fmtSom(v.profit)}</td><td class="mg-sugg" style="text-align:right">${suggTxt}</td><td class="mg-marja" style="text-align:right;font-weight:750;color:${sevColor}">${Math.round(v.marja*10)/10}%</td></tr>`;
  }).join("");
}
// Tovar nomi bosilganda Kirim bo'limidagi shu tovarning to'liq kelish tarixi
// ochiladi (foydalanuvchi so'rovi, 2026-08-22) - zkOpenKirimDetail() (p7)
// bilan AYNAN bir xil naqsh/jadval, faqat #p12 ichida mustaqil overlay
// (krOpenDetail/zkOpenKirimDetail'dagi bilan bir xil sabab - #p8/#p7'dagi
// overlay bilan ID to'qnashmasin, sahifalar orasida bir vaqtda DOM'da
// qolishi mumkin).
function _mgKrEnsureStyles(){
  krEnsureDetailStyles();
  if(document.getElementById("mg-kr-detail-style"))return;
  const st=document.createElement("style");
  st.id="mg-kr-detail-style";
  st.textContent=`#mg-kr-fullscreen{position:fixed!important;top:0;bottom:0;left:195px;right:0;background:#fff;box-sizing:border-box;transition:left .18s ease;overflow-y:auto;z-index:1500;display:none}body.sb-collapsed #mg-kr-fullscreen{left:64px}`;
  document.head.appendChild(st);
}
async function mgOpenKirimDetail(sku){
  if(!P8)await _ensureKirimData();
  if(!P8||!P8.skus||!sku)return;
  const entry=P8.skus[String(sku)];if(!entry)return;
  _mgKrEnsureStyles();
  const p12el=document.getElementById("p12");if(!p12el)return;
  p12el.style.position="relative";
  let ov=document.getElementById("mg-kr-fullscreen");
  if(!ov){ov=document.createElement("div");ov.id="mg-kr-fullscreen";p12el.appendChild(ov);}
  const arrivals=[...(entry.arrivals||[])].sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  const rows=arrivals.map(a=>`<tr><td>${krFmtDate(a.date)}</td><td>${esc(a.supplier)}</td><td>${(a.expected||0).toLocaleString()}</td><td>${(a.qty||0).toLocaleString()}</td><td>${(a.cost||0).toLocaleString()}</td><td>${Math.round((a.qty||0)*(a.cost||0)).toLocaleString()}</td><td><span class="${krStatusBadgeCls(a.status)}">${esc(a.status||"")}</span></td></tr>`).join("");
  ov.innerHTML=`<div style="position:sticky;top:0;background:#fff;z-index:2;padding:14px 24px 12px;border-bottom:1.5px solid #f0f0ec;display:flex;align-items:center;gap:12px">
    <button onclick="mgKrCloseOverlay()" style="display:inline-flex;align-items:center;gap:6px;padding:7px 16px;border-radius:14px;border:1.5px solid #e6e2f7;background:#fff;font-size:13px;font-weight:600;color:#534AB7;cursor:pointer;flex-shrink:0">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
      ${esc(t("kr_back"))}
    </button>
    <span style="font-size:15px;font-weight:700;color:#1a1a2e;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(entry.name)} (${esc(sku)})</span>
  </div>
  <div class="kr-det-wrap">${arrivals.length?`<table class="kr-det-tbl"><thead><tr><th>${esc(t("kr_det_sana"))}</th><th>${esc(t("kr_det_sup"))}</th><th>${esc(t("kr_det_expected"))}</th><th>${esc(t("kr_det_qty"))}</th><th>${esc(t("kr_det_cost"))}</th><th>${esc(t("kr_det_summa"))}</th><th>${esc(t("kr_det_status"))}</th></tr></thead><tbody>${rows}</tbody></table>`:`<div style="text-align:center;padding:40px;color:#bbb">${esc(t("kr_not_found"))}</div>`}</div>`;
  ov.style.display="block";
  ov.scrollTop=0;
}
function mgKrCloseOverlay(){
  const ov=document.getElementById("mg-kr-fullscreen");
  if(ov)ov.style.display="none";
}
function mgSetThreshold(val){
  const n=parseFloat(val);
  mgThreshold=isNaN(n)?20:Math.max(0,Math.min(100,n));
  mgRenderList();
}
function mgSearchInput(){
  const inp=document.getElementById("mg-q");
  const clr=document.getElementById("mg-clear");
  if(clr)clr.classList.toggle("show",!!(inp&&inp.value));
}
function mgSearchSubmit(){
  const inp=document.getElementById("mg-q");
  mgQ=inp?inp.value.toLowerCase().trim():"";
  const clr=document.getElementById("mg-clear");
  if(clr)clr.classList.toggle("show",mgQ.length>0);
  mgRenderList();
}
function mgClearSearch(){
  const inp=document.getElementById("mg-q");if(inp){inp.value="";inp.focus();}
  const clr=document.getElementById("mg-clear");if(clr)clr.classList.remove("show");
  mgQ="";mgRenderList();
}
async function mgExportXLSX(){
  await _ensureExcelJS();
  if(!P2||typeof ExcelJS==="undefined")return;
  const rows=mgCurRows().slice().sort((a,b)=>a.marja-b.marja);
  const wb=new ExcelJS.Workbook();
  const ws=wb.addWorksheet(t("nav_p12"),{views:[{state:"frozen",ySplit:2}]});
  ws.mergeCells("A1:I1");
  ws.getCell("A1").value=`Marja < ${mgThreshold}% (${rows.length} ta tovar)`;
  ws.getCell("A1").font={bold:true,size:12,color:{argb:"FFFFFF"}};
  ws.getCell("A1").alignment={horizontal:"center",vertical:"middle"};
  ws.getCell("A1").fill={type:"pattern",pattern:"solid",fgColor:{argb:"E24B4A"}};
  ws.getRow(1).height=22;
  ws.addRow(["Shtrix kod",t("sp_prod_name"),t("mg_col_cat"),t("kr_det_sup"),t("xls_th_sell_price"),t("kpi_cost_l"),t("sp_stat_foyda"),t("mg_col_suggested"),t("sp_stat_marja")]);
  ws.getRow(2).eachCell(c=>{c.font={bold:true,color:{argb:"FFFFFF"}};c.fill={type:"pattern",pattern:"solid",fgColor:{argb:"1D9E75"}};c.alignment={horizontal:"center",vertical:"middle"};});
  rows.forEach(r=>{
    const sugg=mgThreshold>=100?null:r.cost/(1-mgThreshold/100);
    const row=ws.addRow([r.bc,r.name,r.cat,r.sup,Math.round(r.sell),Math.round(r.cost),Math.round(r.profit),sugg==null?"—":Math.round(sugg),Math.round(r.marja*10)/10+"%"]);
    row.getCell(2).alignment={horizontal:"left"};
    [5,6,7,8].forEach(c=>{row.getCell(c).numFmt='#,##0 "so\'m"';row.getCell(c).alignment={horizontal:"right"};});
    row.getCell(8).font={color:{argb:"2FAF7F"},bold:true};
    row.getCell(9).alignment={horizontal:"right"};
    if(r.marja<0)row.getCell(9).font={color:{argb:"E24B4A"},bold:true};
  });
  ws.columns=[{width:16},{width:38},{width:20},{width:20},{width:14},{width:14},{width:14},{width:14},{width:10}];
  const buf=await wb.xlsx.writeBuffer();
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([buf],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));
  a.download=`marja_nazorati_${new Date().toISOString().slice(0,10)}.xlsx`;
  a.click();URL.revokeObjectURL(a.href);
}

async function ktExportDetailXLSX(){
  await _ensureExcelJS();
  if(!ktSelSub||typeof ExcelJS==="undefined")return;
  const wb=new ExcelJS.Workbook();
  const ws=wb.addWorksheet(_ktSafeSheetName(ktSelSub),{views:[{state:"frozen",ySplit:4}]});
  ws.mergeCells("A1:I1");
  ws.getCell("A1").value=ktSelSub;
  ws.getCell("A1").font={bold:true,size:13,color:{argb:"FFFFFF"}};
  ws.getCell("A1").alignment={horizontal:"center",vertical:"middle"};
  ws.getCell("A1").fill={type:"pattern",pattern:"solid",fgColor:{argb:"534AB7"}};
  ws.getRow(1).height=24;
  const st=_ktDetailStats();
  ws.mergeCells("A2:I2");
  ws.getCell("A2").value=`${ktStart} — ${ktEnd}`;
  ws.getCell("A2").font={bold:true,size:11,color:{argb:"1D9E75"}};
  ws.getCell("A2").alignment={horizontal:"center",vertical:"middle"};
  ws.mergeCells("A3:I3");
  ws.getCell("A3").value=`${t("sp_stat_tushum")}: ${_ktFmtSom(st.rev)}   |   ${t("sp_stat_tannarx")}: ${_ktFmtSom(st.cost)}   |   ${t("sp_stat_foyda")}: ${_ktFmtSom(st.profit)}   |   ${t("sp_stat_jami")}: ${st.jami}   |   A: ${st.a}  B: ${st.b}  C: ${st.c}`;
  ws.getCell("A3").font={size:10.5,color:{argb:"444444"}};
  ws.getCell("A3").alignment={horizontal:"center",vertical:"middle"};
  ws.getRow(3).height=20;
  ws.addRow(["#",t("sp_prod_name"),"ABC","SKU",t("kt_col_qty"),t("sp_stat_tushum"),t("sp_stat_tannarx"),t("sp_stat_foyda"),t("sp_stat_marja")]);
  ws.getRow(4).eachCell(c=>{c.font={bold:true,color:{argb:"FFFFFF"}};c.fill={type:"pattern",pattern:"solid",fgColor:{argb:"1D9E75"}};c.alignment={horizontal:"center",vertical:"middle"};});
  ktDetailProds.forEach((p,i)=>{
    const costKnown=p.cost!=null;
    const profit=costKnown?(p.rev||0)-p.cost:null;
    const marja=(costKnown&&p.rev)?Math.round(profit/p.rev*1000)/10:null;
    const row=ws.addRow([i+1,p.name,p.abc||"—",p.sku||"",p.qty,Math.round(p.rev),costKnown?Math.round(p.cost):"—",costKnown?Math.round(profit):"—",marja!=null?marja+"%":"—"]);
    row.getCell(2).alignment={horizontal:"left"};
    row.getCell(6).numFmt='#,##0 "so\'m"';row.getCell(6).alignment={horizontal:"right"};
    if(costKnown){[7,8].forEach(c=>{row.getCell(c).numFmt='#,##0 "so\'m"';row.getCell(c).alignment={horizontal:"right"};});}
    else{[7,8].forEach(c=>{row.getCell(c).alignment={horizontal:"right"};});}
    row.getCell(9).alignment={horizontal:"right"};
  });
  ws.columns=[{width:6},{width:38},{width:6},{width:12},{width:10},{width:16},{width:16},{width:16},{width:10}];
  const buf=await wb.xlsx.writeBuffer();
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([buf],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));
  a.download=`${_ktSafeName(ktSelSub)}_${ktStart}_${ktEnd}.xlsx`;
  a.click();URL.revokeObjectURL(a.href);
}
async function ktExportMzXLSX(){
  await _ensureExcelJS();
  if(!ktSelSub||typeof ExcelJS==="undefined")return;
  const items=ktMzViewItems&&ktMzViewItems.length?ktMzViewItems:ktMzAllItems;
  if(!items.length)return;
  const wb=new ExcelJS.Workbook();
  const ws=wb.addWorksheet(_ktSafeSheetName(ktSelSub),{views:[{state:"frozen",ySplit:2}]});
  ws.mergeCells("A1:H1");
  ws.getCell("A1").value=ktSelSub;
  ws.getCell("A1").font={bold:true,size:13,color:{argb:"FFFFFF"}};
  ws.getCell("A1").alignment={horizontal:"center",vertical:"middle"};
  ws.getCell("A1").fill={type:"pattern",pattern:"solid",fgColor:{argb:"EF9F27"}};
  ws.getRow(1).height=24;
  ws.addRow(["#",t("sp_mz_prod"),t("sp_mz_stock"),t("sp_mz_buy"),t("sp_mz_frozen"),t("sp_mz_sell"),t("sp_mz_days"),t("sp_mz_lastkirim")]);
  ws.getRow(2).eachCell(c=>{c.font={bold:true,color:{argb:"FFFFFF"}};c.fill={type:"pattern",pattern:"solid",fgColor:{argb:"EF9F27"}};c.alignment={horizontal:"center",vertical:"middle"};});
  items.forEach((v,i)=>{
    const diTxt=v.di>=999?"60+":String(v.di||0);
    const lastKirim=krFmtDate(krLastDate(v.sku))||"—";
    const row=ws.addRow([i+1,v.name,v.kg?+(v.stock||0).toFixed(2):Math.round(v.stock||0),Math.round(v.sp||0),Math.round(v.frozenVal||0),Math.round(v.rp||0),diTxt,lastKirim]);
    row.getCell(2).alignment={horizontal:"left"};
    row.getCell(3).numFmt=v.kg?"#,##0.00":"#,##0";
    row.getCell(4).numFmt='#,##0 "so\'m"';
    row.getCell(5).numFmt='#,##0 "so\'m"';row.getCell(5).font={bold:true,color:{argb:"EF9F27"}};
    row.getCell(6).numFmt='#,##0 "so\'m"';
    for(let c=3;c<=6;c++)row.getCell(c).alignment={horizontal:"right"};
  });
  ws.columns=[{width:6},{width:38},{width:11},{width:15},{width:18},{width:15},{width:11},{width:14}];
  const buf=await wb.xlsx.writeBuffer();
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([buf],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));
  a.download=`${_ktSafeName(ktSelSub)}_sotilmayotgan_${ktStart}_${ktEnd}.xlsx`;
  a.click();URL.revokeObjectURL(a.href);
}

// ─── P8 Kirim (ta'minotchidan kelgan tovar) tarixi ───
let _krPageItems=[];
function initP8(){if(!P8)return;renderP8();}
// 2026-08-12: og'ir qism (renderP8) faqat Enter bosilganda.
function krSearchInput(){
  const inp=document.getElementById("kr-q");
  const clr=document.getElementById("kr-clear");
  if(clr)clr.classList.toggle("show",!!(inp&&inp.value));
}
function krSearchSubmit(){
  const inp=document.getElementById("kr-q");
  krQ=inp?nn2(inp.value):"";
  const clr=document.getElementById("kr-clear");
  if(clr)clr.classList.toggle("show",krQ.length>0);
  krPage=1;renderP8();
}
function krClearSearch(){
  const inp=document.getElementById("kr-q");
  if(inp){inp.value="";inp.focus();}
  const clr=document.getElementById("kr-clear");
  if(clr)clr.classList.remove("show");
  krQ="";krPage=1;renderP8();
}
function krSortBy(key){
  if(krSortKey===key){krSortDir=-krSortDir;}else{krSortKey=key;krSortDir=key==="name"?1:-1;}
  krPage=1;renderP8();
}
function krGo(page){krPage=page;renderP8();const w=document.querySelector("#p8 .kr-tbl-wrap");if(w)w.scrollTop=0;}
function krFmtDate(iso){
  if(!iso)return"";
  const d=new Date(iso);
  if(isNaN(d))return String(iso).slice(0,10);
  return String(d.getDate()).padStart(2,"0")+"."+String(d.getMonth()+1).padStart(2,"0")+"."+d.getFullYear();
}
function krStatusBadgeCls(s){
  const map={"New":"kr-status-open","Open":"kr-status-open","Received":"kr-status-received","Returned":"kr-status-returned","Custom Return":"kr-status-returned","Partially received":"kr-status-partial"};
  return "kr-status-badge "+(map[s]||"kr-status-open");
}
function renderP8(){
  if(!P8)return;
  let items=Object.keys(P8.skus).map(sku=>({sku,...P8.skus[sku]}));
  if(krQ)items=items.filter(it=>nn2(it.name).includes(krQ)||String(it.sku).toLowerCase().includes(krQ));
  const gv=it=>{switch(krSortKey){case "name":return (it.name||"").toLowerCase();case "stock":return it.current_stock||0;case "total":return it.last_qty||0;case "cost":return it.last_cost||0;default:return it.last_date||"";}};
  items.sort((a,b)=>{const av=gv(a),bv=gv(b);if(typeof av==="string")return krSortDir*av.localeCompare(bv,"ru");return krSortDir*(av-bv);});
  document.querySelectorAll("#p8 .z-tbl thead th").forEach(th=>{th.classList.remove("z-sort-asc","z-sort-desc");if(th.dataset.sortkey===krSortKey)th.classList.add(krSortDir>0?"z-sort-asc":"z-sort-desc");});
  const cnt=document.getElementById("kr-cnt");
  if(cnt)cnt.textContent=items.length.toLocaleString()+" "+t("ta_mahsulot");
  const totalP=Math.max(1,Math.ceil(items.length/KRPS));
  if(krPage>totalP)krPage=totalP;
  const rowOffset=(krPage-1)*KRPS;
  _krPageItems=items.slice(rowOffset,rowOffset+KRPS);
  const tbody=document.getElementById("kr-tbody");
  if(tbody){
    if(!_krPageItems.length){
      tbody.innerHTML='<tr><td colspan="7" style="text-align:center;padding:40px;color:#bbb">'+esc(t("kr_not_found"))+'</td></tr>';
    }else{
      tbody.innerHTML=_krPageItems.map((it,i)=>{
        const stock=it.current_stock||0;
        const stockCls=stock>0?"kr-stock-badge":"kr-stock-badge kr-stock-zero";
        return `<tr class="z-row" onclick="krOpenDetail(${i})"><td style="color:#bbb;font-size:11px">${rowOffset+i+1}</td><td><div class="z-name" title="${esc(it.name)}">${esc(it.name)}</div><div class="z-reason"><span class="z-sku">${esc(it.sku)}</span></div></td><td><span class="${stockCls}">${stock.toLocaleString()}</span></td><td class="kr-num">${(it.last_qty||0).toLocaleString()}</td><td class="kr-num">${(it.last_cost||0).toLocaleString()}</td><td class="kr-date">${krFmtDate(it.last_date)}</td><td><span class="${krStatusBadgeCls(it.last_status)}">${esc(it.last_status||"")}</span></td></tr>`;
      }).join("");
    }
  }
  renderP8Pag(totalP);
}
function renderP8Pag(totalP){
  const pag=document.getElementById("kr-pag");if(!pag)return;
  if(totalP<=1){pag.innerHTML="";return;}
  const mk=(l,p,d,a)=>`<button ${d?"disabled":""} ${a?'class="active"':""} onclick="krGo(${p})">${l}</button>`;
  let h=mk("‹",krPage-1,krPage<=1,false);
  let s=Math.max(1,krPage-2),e=Math.min(totalP,krPage+2);
  if(s>1){h+=mk("1",1,false,krPage===1);if(s>2)h+='<button disabled>…</button>';}
  for(let p=s;p<=e;p++)h+=mk(p,p,false,p===krPage);
  if(e<totalP){if(e<totalP-1)h+='<button disabled>…</button>';h+=mk(totalP,totalP,false,krPage===totalP);}
  h+=mk("›",krPage+1,krPage>=totalP,false);
  pag.innerHTML=h;
}
function krEnsureDetailStyles(){
  if(document.getElementById("kr-detail-style"))return;
  const st=document.createElement("style");
  st.id="kr-detail-style";
  st.textContent=`#kr-fullscreen{position:fixed!important;top:0;bottom:0;left:195px;right:0;background:#fff;box-sizing:border-box;transition:left .18s ease;overflow-y:auto;z-index:1500;display:none}body.sb-collapsed #kr-fullscreen{left:64px}
.kr-det-wrap{padding:8px 24px 40px}
.kr-det-tbl{width:100%;border-collapse:separate;border-spacing:0;font-size:13px;margin-top:12px}
.kr-det-tbl th{position:sticky;top:0;background:#fafaf5;text-align:left;padding:12px 16px;border-bottom:1.5px solid #eee;font-weight:700;color:#9a9a9a;font-size:10.5px;letter-spacing:.04em;text-transform:uppercase;white-space:nowrap}
.kr-det-tbl td{padding:13px 16px;border-bottom:1px solid #f0ede4;white-space:nowrap;color:#2a2a35;font-size:13px}
.kr-det-tbl tbody tr:hover td{background:#faf9f5}
.kr-det-tbl tbody tr:last-child td{border-bottom:none}
.kr-det-tbl th:nth-child(3),.kr-det-tbl td:nth-child(3),.kr-det-tbl th:nth-child(4),.kr-det-tbl td:nth-child(4),.kr-det-tbl th:nth-child(5),.kr-det-tbl td:nth-child(5),.kr-det-tbl th:nth-child(6),.kr-det-tbl td:nth-child(6){text-align:right}
.kr-det-tbl th:nth-child(7),.kr-det-tbl td:nth-child(7){text-align:center}
.kr-det-tbl td:nth-child(4){font-weight:700;color:#1a1a2e}
.kr-det-tbl td:nth-child(6){font-weight:700;color:#0D7A55}
.kr-det-tbl .kr-status-badge{font-size:11px;padding:4px 11px}`;
  document.head.appendChild(st);
}
function krCloseOverlay(){
  const ov=document.getElementById("kr-fullscreen");
  if(ov)ov.style.display="none";
}
// Zakas (p7)'dan bosilganda, Kirim (p8)'ga o'tmasdan, shu tovarning TO'LIQ kirim
// tarixini (krOpenDetail bilan bir xil jadval) ko'rsatadi. #p8'dagi #kr-fullscreen'ni
// QAYTA ISHLATMAYDI (mustaqil #zk-kr-fullscreen, #p7 ichida) - ikkalasi bir vaqtda
// DOM'da bo'lishi mumkin (foydalanuvchi p7'dan p8'ga o'tishi mumkin), ID to'qnashuvi
// va noto'g'ri joylashuv (chap panel kengligi p8/p7'da bir xil, lekin mustaqil
// bo'lish xavfsizroq) oldini olish uchun. .kr-det-wrap/.kr-det-tbl klasslari umumiy
// (krEnsureDetailStyles() orqali) - qayta e'lon qilinmaydi.
function _zkKrEnsureStyles(){
  krEnsureDetailStyles();
  if(document.getElementById("zk-kr-detail-style"))return;
  const st=document.createElement("style");
  st.id="zk-kr-detail-style";
  st.textContent=`#zk-kr-fullscreen{position:fixed!important;top:0;bottom:0;left:195px;right:0;background:#fff;box-sizing:border-box;transition:left .18s ease;overflow-y:auto;z-index:1500;display:none}body.sb-collapsed #zk-kr-fullscreen{left:64px}`;
  document.head.appendChild(st);
}
function zkOpenKirimDetail(sku){
  if(!P8||!P8.skus||!sku)return;
  const entry=P8.skus[String(sku)];if(!entry)return;
  _zkKrEnsureStyles();
  const p7el=document.getElementById("p7");if(!p7el)return;
  p7el.style.position="relative";
  let ov=document.getElementById("zk-kr-fullscreen");
  if(!ov){ov=document.createElement("div");ov.id="zk-kr-fullscreen";p7el.appendChild(ov);}
  const arrivals=[...(entry.arrivals||[])].sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  const rows=arrivals.map(a=>`<tr><td>${krFmtDate(a.date)}</td><td>${esc(a.supplier)}</td><td>${(a.expected||0).toLocaleString()}</td><td>${(a.qty||0).toLocaleString()}</td><td>${(a.cost||0).toLocaleString()}</td><td>${Math.round((a.qty||0)*(a.cost||0)).toLocaleString()}</td><td><span class="${krStatusBadgeCls(a.status)}">${esc(a.status||"")}</span></td></tr>`).join("");
  ov.innerHTML=`<div style="position:sticky;top:0;background:#fff;z-index:2;padding:14px 24px 12px;border-bottom:1.5px solid #f0f0ec;display:flex;align-items:center;gap:12px">
    <button onclick="zkKrCloseOverlay()" style="display:inline-flex;align-items:center;gap:6px;padding:7px 16px;border-radius:14px;border:1.5px solid #e6e2f7;background:#fff;font-size:13px;font-weight:600;color:#534AB7;cursor:pointer;flex-shrink:0">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
      ${esc(t("kr_back"))}
    </button>
    <span style="font-size:15px;font-weight:700;color:#1a1a2e;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(entry.name)} (${esc(sku)})</span>
  </div>
  <div class="kr-det-wrap">${arrivals.length?`<table class="kr-det-tbl"><thead><tr><th>${esc(t("kr_det_sana"))}</th><th>${esc(t("kr_det_sup"))}</th><th>${esc(t("kr_det_expected"))}</th><th>${esc(t("kr_det_qty"))}</th><th>${esc(t("kr_det_cost"))}</th><th>${esc(t("kr_det_summa"))}</th><th>${esc(t("kr_det_status"))}</th></tr></thead><tbody>${rows}</tbody></table>`:`<div style="text-align:center;padding:40px;color:#bbb">${esc(t("kr_not_found"))}</div>`}</div>`;
  ov.style.display="block";
  ov.scrollTop=0;
}
function zkKrCloseOverlay(){
  const ov=document.getElementById("zk-kr-fullscreen");
  if(ov)ov.style.display="none";
}
function krOpenDetail(i){
  const entry=_krPageItems[i];if(!entry)return;
  krEnsureDetailStyles();
  const p8el=document.getElementById("p8");if(!p8el)return;
  p8el.style.position="relative";
  let ov=document.getElementById("kr-fullscreen");
  if(!ov){ov=document.createElement("div");ov.id="kr-fullscreen";p8el.appendChild(ov);}
  const arrivals=[...entry.arrivals].sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  const rows=arrivals.map(a=>`<tr><td>${krFmtDate(a.date)}</td><td>${esc(a.supplier)}</td><td>${(a.expected||0).toLocaleString()}</td><td>${(a.qty||0).toLocaleString()}</td><td>${(a.cost||0).toLocaleString()}</td><td>${Math.round((a.qty||0)*(a.cost||0)).toLocaleString()}</td><td><span class="${krStatusBadgeCls(a.status)}">${esc(a.status||"")}</span></td></tr>`).join("");
  ov.innerHTML=`<div class="mob-ov-hdr" style="position:sticky;top:0;background:#fff;z-index:2;padding:14px 24px 12px;border-bottom:1.5px solid #f0f0ec;display:flex;align-items:center;gap:12px">
    <button onclick="krCloseOverlay()" style="display:inline-flex;align-items:center;gap:6px;padding:7px 16px;border-radius:14px;border:1.5px solid #e6e2f7;background:#fff;font-size:13px;font-weight:600;color:#534AB7;cursor:pointer;flex-shrink:0">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
      ${esc(t("kr_back"))}
    </button>
    <span style="font-size:15px;font-weight:700;color:#1a1a2e;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(entry.name)} (${esc(entry.sku)})</span>
  </div>
  <div class="kr-det-wrap"><table class="kr-det-tbl"><thead><tr><th>${esc(t("kr_det_sana"))}</th><th>${esc(t("kr_det_sup"))}</th><th>${esc(t("kr_det_expected"))}</th><th>${esc(t("kr_det_qty"))}</th><th>${esc(t("kr_det_cost"))}</th><th>${esc(t("kr_det_summa"))}</th><th>${esc(t("kr_det_status"))}</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  ov.style.display="block";
  ov.scrollTop=0;
}

// ─── Nazorat bo'limi ───
// Yangi bo'lim (pN) qo'shilganda FAQAT shu ro'yxatga bitta yozuv qo'shish kifoya -
// "Xodim qo'shish/tahrirlash" oynasidagi checkbox'lar shundan avtomatik yasaladi
// (_nazBuildTabsGrid), alohida HTML tahrirlash shart emas.
const NAZ_TABS=[{id:"p1",label:"Bosh sahifa"},{id:"p2",label:"Mahsulotlar"},{id:"p3",label:"ABC tahlili"},{id:"p5",label:"Stock"},{id:"p7",label:"Buyurtma"},{id:"p6",label:"Suppliers"},{id:"p8",label:"Kirim"},{id:"p9",label:"Ombor aylanmasi"},{id:"p10",label:"Kategoriyalar"},{id:"p11",label:"Firmalar"},{id:"p12",label:"Marja nazorati"},{id:"p_nazorat",label:"Nazorat"}];
function _nazBuildTabsGrid(){
  const grid=document.getElementById("naz-tabs-grid");
  if(!grid||grid.dataset.built)return;
  grid.dataset.built="1";
  grid.innerHTML=NAZ_TABS.map(tb=>tb.id==="p_nazorat"
    ?`<label class="naz-tab-cb" id="naz-nazorat-wrap" style="display:none;border-color:#534AB7;background:#F3F2FF"><input type="checkbox" id="naz-tab-${tb.id}"> <span data-i18n="nav_${tb.id}">${esc(tb.label)}</span></label>`
    :`<label class="naz-tab-cb"><input type="checkbox" id="naz-tab-${tb.id}"> <span data-i18n="nav_${tb.id}">${esc(tb.label)}</span></label>`
  ).join("");
  applyI18n();
}
function nazRoleChange(){
  const role=document.getElementById("naz-role").value;
  const wrap=document.getElementById("naz-nazorat-wrap");
  const cb=document.getElementById("naz-tab-p_nazorat");
  if(!wrap||!cb)return;
  if(role==="admin"){wrap.style.display="";cb.checked=true;}
  else{wrap.style.display="none";cb.checked=false;}
}
let _nazUsers=[],_nazEditing=null,_nazOrigPass="";

function nazPassEye(){const i=document.getElementById("naz-pass");i.type=i.type==="password"?"text":"password";}

async function nazLoad(){
  try{
    const data=await _authCall("list_users",{});
    if(!data.ok)throw new Error(data.error||"Ruxsat yo'q");
    _nazUsers=data.users||[];
    _nazRender();
  }catch(e){console.error(e);const tb=document.getElementById("naz-tbody");if(tb)tb.innerHTML='<tr><td colspan="6" style="text-align:center;color:#E24B4A;padding:20px">Xatolik: '+e.message+'</td></tr>';}
}

function _nazRender(){
  const total=_nazUsers.length;
  const admins=_nazUsers.filter(u=>u.role==="admin").length;
  const active=_nazUsers.filter(u=>u.active).length;
  const elTotal=document.getElementById("naz-total"),elAdm=document.getElementById("naz-admins"),elAct=document.getElementById("naz-active");
  if(elTotal)elTotal.textContent=total;if(elAdm)elAdm.textContent=admins;if(elAct)elAct.textContent=active;
  const tbody=document.getElementById("naz-tbody");
  if(!tbody)return;
  if(!total){tbody.innerHTML='<tr><td colspan="6" style="text-align:center;color:#999;padding:24px">Hali foydalanuvchilar qo\'shilmagan</td></tr>';return;}
  tbody.innerHTML=_nazUsers.map(u=>`<tr>
    <td><strong>${esc(u.name||"—")}</strong></td>
    <td style="font-family:monospace">${esc(u.phone)}</td>
    <td><span class="badge ${u.role==="admin"?"b-A":"b-B"}">${u.role==="admin"?t("role_admin"):t("role_staff")}</span></td>
    <td style="font-size:10px;color:#555">${(u.tabs||[]).filter(tb=>tb!=="p_nazorat").map(tb=>{const found=NAZ_TABS.find(x=>x.id===tb);return found?t("nav_"+found.id)||found.label:tb;}).join(", ")||"—"}</td>
    <td><span class="badge ${u.active?"b-ok":"b-bad"}">${u.active?t("status_active"):t("status_blocked")}</span></td>
    <td style="padding:6px 8px">
      <div style="display:flex;flex-wrap:wrap;gap:5px;justify-content:flex-end">
        <button onclick="nazEdit('${u.id}')" style="font-size:11px;padding:4px 8px;border:1px solid #CBD5E1;border-radius:6px;cursor:pointer;background:#fff;white-space:nowrap">${t("naz_edit")}</button>
        <button onclick="nazToggle('${u.id}',${!u.active})" style="font-size:11px;padding:4px 8px;border:1px solid #CBD5E1;border-radius:6px;cursor:pointer;white-space:nowrap;background:${u.active?"#FEF2F2":"#F0FDF4"};color:${u.active?"#991B1B":"#14532D"}">${u.active?t("naz_block"):t("naz_activate")}</button>
        ${_nazSelf(u.phone)?"":`<button onclick="nazDelete('${u.id}')" style="font-size:11px;padding:4px 8px;border:1px solid #FECACA;border-radius:6px;cursor:pointer;background:#FEF2F2;color:#991B1B;white-space:nowrap">${t("naz_delete")}</button>`}
      </div>
    </td>
  </tr>`).join("");
}

function nazShowAdd(){
  _nazEditing=null;
  _nazOrigPass="";
  _nazBuildTabsGrid();
  document.getElementById("naz-modal-title").textContent=t("naz_modal_add");
  document.getElementById("naz-form").reset();
  document.getElementById("naz-pass-hint").textContent="";
  NAZ_TABS.forEach(tb=>{const cb=document.getElementById("naz-tab-"+tb.id);if(cb)cb.checked=tb.id==="p1";});
  nazRoleChange();
  document.getElementById("naz-modal").style.display="flex";
  setTimeout(()=>document.getElementById("naz-fname").focus(),100);
}

async function nazEdit(id){
  const u=_nazUsers.find(x=>x.id===id);if(!u)return;
  _nazEditing=id;
  _nazOrigPass="";
  _nazBuildTabsGrid();
  document.getElementById("naz-modal-title").textContent=t("naz_modal_edit");
  const parts=(u.name||"").trim().split(/\s+/);
  document.getElementById("naz-fname").value=parts[0]||"";
  document.getElementById("naz-lname").value=parts.slice(1).join(" ")||"";
  document.getElementById("naz-phone").value=u.phone||"";
  document.getElementById("naz-role").value=u.role||"staff";
  const passEl=document.getElementById("naz-pass");
  passEl.type="password";passEl.value="";
  document.getElementById("naz-pass-hint").textContent="";
  NAZ_TABS.forEach(tb=>{const cb=document.getElementById("naz-tab-"+tb.id);if(cb)cb.checked=(u.tabs||[]).includes(tb.id);});
  nazRoleChange();
  document.getElementById("naz-modal").style.display="flex";
  setTimeout(()=>document.getElementById("naz-fname").focus(),100);
  // Joriy parolni fonda olib, maydonga (nuqta holida) to'ldiramiz - ko'zcha
  // bosilsa ko'rinadi. Agar tahrirlash oynasi shu orada yopilgan/boshqa
  // foydalanuvchiga o'tilgan bo'lsa, natijani qo'llamaymiz.
  const data=await _authCall("reveal_password",{id});
  if(_nazEditing!==id)return;
  if(data.ok){
    _nazOrigPass=data.password;
    passEl.value=data.password;
    document.getElementById("naz-pass-hint").textContent=t("naz_pass_hint");
  }else{
    document.getElementById("naz-pass-hint").textContent=t("naz_pass_hint_new");
  }
}

function _nazSelf(phone){try{const u=JSON.parse(localStorage.getItem("tiin_user")||"{}");return u.phone===phone;}catch(_){return false;}}

async function nazToggle(id,active){
  if(!confirm(active?t("naz_confirm_activate"):t("naz_confirm_block")))return;
  try{
    const data=await _authCall("toggle_active",{id,active});
    if(!data.ok)throw new Error(data.error||"Xatolik");
    await nazLoad();
  }catch(e){alert("Xatolik: "+e.message);}
}

async function nazDelete(id){
  const u=_nazUsers.find(x=>x.id===id);if(!u)return;
  if(!confirm(t("naz_confirm_delete")))return;
  try{
    const data=await _authCall("delete_user",{id});
    if(!data.ok)throw new Error(data.error||"Xatolik");
    await nazLoad();
  }catch(e){alert("Xatolik: "+e.message);}
}

function nazClose(){document.getElementById("naz-modal").style.display="none";_nazEditing=null;_nazOrigPass="";}

async function nazSave(e){
  e.preventDefault();
  const fname=(document.getElementById("naz-fname").value||"").trim();
  const lname=(document.getElementById("naz-lname").value||"").trim();
  const name=(fname+(lname?" "+lname:"")).trim();
  const phone=(document.getElementById("naz-phone").value||"").replace(/\D/g,"");
  const role=document.getElementById("naz-role").value;
  const pass=document.getElementById("naz-pass").value;
  // Parol maydoni endi joriy parol bilan oldindan to'ldirilgan (nuqta
  // holida) - agar admin uni tegmasdan qoldirsa yoki o'chirib bo'sh
  // qoldirsa, parol O'ZGARMAYDI. Faqat ustiga BOSHQA qiymat yozilsa,
  // yangi parol sifatida yuboriladi.
  const passChanged=!!pass&&pass!==_nazOrigPass;
  if(!fname){alert(t("naz_lbl_fname")+" kiriting");return;}
  if(!lname){alert(t("naz_lbl_lname")+" kiriting");return;}
  if(!phone){alert("Telefon kiriting");return;}
  if(!_nazEditing&&!pass){alert("Parol kiriting");return;}
  if(passChanged&&pass.length<6){alert("Parol kamida 6 belgi bo'lishi kerak");return;}
  const tabs=NAZ_TABS.filter(tb=>{const cb=document.getElementById("naz-tab-"+tb.id);return cb&&cb.checked;}).map(tb=>tb.id);
  if(role==="admin"&&!tabs.includes("p_nazorat"))tabs.push("p_nazorat");
  const saveBtn=document.getElementById("naz-save-btn");
  saveBtn.disabled=true;saveBtn.textContent="Saqlanmoqda...";
  try{
    // E'TIBOR: `active` ataylab yuborilmaydi - server uni saqlash amalida
    // o'zgartirmaydi, faqat "Bloklash/Faollashtirish" tugmasi orqali
    // (avvalgi xato: har saqlashda bloklangan xodim bexosdan qayta faollashib
    // qolardi).
    const payload={name,phone,role,tabs};
    if(passChanged)payload.password=pass;
    if(_nazEditing)payload.id=_nazEditing;
    const data=await _authCall(_nazEditing?"update_user":"create_user",payload);
    if(!data.ok)throw new Error(data.error||"Xatolik");
    nazClose();await nazLoad();
  }catch(err){alert("Xatolik: "+err.message);}
  finally{saveBtn.disabled=false;saveBtn.textContent="Saqlash";}
}

// ─── P11 Firmalar (xaridor firmalar: qarz muddati bo'yicha tahlil) ───
// Ma'lumot: data_firmalar.json (fetch_clients.py yasaydi — Invan `api/v1/clients`
// reyestri + Turso `orders`dagi DEBT (qarzga sotilgan) cheklari — naqd/karta/click
// bilan to'langan xaridlar bu yerga kirmaydi). Guruhlar: 0-15 / 16-30 / 31-45 / 45+ kun.
// Firma bosilganda ALOHIDA OYNA ochiladi (p10 Kategoriyalar naqshiga o'xshash).
// Boshqa bo'limlarga bog'liq emas — o'z ma'lumotini o'zi yuklaydi.
let FM=null,fmFilt="all",fmQ="",fmFrom="",fmTo="",fmOpenId=null,fmTab="buyer";
const FM_KEYS=["b15","b30","b45","b60"];
const FM_LAB=["0–15 kun","16–30 kun","31–45 kun","45+ kun"];
const FM_CLR=["#7C8C85","#D99B23","#D4692B","#C0342F"];
const FM_DASH='';
function _fmBucket(kun){return kun<=15?"b15":kun<=30?"b30":kun<=45?"b45":"b60";}
function _fmAge(d){return Math.round((new Date(FM.bugun+"T00:00:00Z")-new Date(d+"T00:00:00Z"))/864e5);}
function _fmNum(n){return n?Math.round(n).toLocaleString("ru-RU").replace(/ /g," "):"";}
// Qarz ustunlari (0-15/16-30/31-45/45+/Jami) — qizil, oldida "-". Refund/ortiqcha
// to'lov qarzdan ko'p bo'lib qolsa (kamdan-kam holat) manfiy chiqadi - bu holda
// yashilda "+" bilan ko'rsatiladi ("-"+_fmNum(manfiy) kabi ikki minus bo'lmasin uchun).
// Xaridorlar (fmRender) va ta'minotchilar (fmsRender) bir xil jadval uslubini
// ishlatgani uchun umumiy — ikkalasida ham qayta ishlatiladi.
function _fmDebtCell(v){
  if(!v)return '<td class="fm-r">'+FM_DASH+"</td>";
  return v>0?'<td class="fm-r fm-debt">-'+_fmNum(v)+"</td>":'<td class="fm-r fm-pb">+'+_fmNum(-v)+"</td>";
}
function _fmDebtJmCell(v){
  if(!v)return '<td class="fm-r fm-jm">'+FM_DASH+"</td>";
  return v>0?'<td class="fm-r fm-jm">-'+_fmNum(v)+"</td>":'<td class="fm-r fm-jm" style="color:#1D9E75">+'+_fmNum(-v)+"</td>";
}
// KPI kartochkalari uchun til-moslashuvchan summa formati (global fmt() dan
// farqli - fmt() boshqa ko'p joyda "mlrd/mln/UZS" hardcoded holda ishlatiladi,
// uni o'zgartirish butun saytga ta'sir qilardi, shuning uchun bu yerga alohida).
function _fmKpiMoney(n){
  const s=t("fm_currency"),a=Math.abs(n||0);
  if(a>=1e9)return(n/1e9).toFixed(2)+" "+t("fm_unit_mlrd")+" "+s;
  if(a>=1e6)return(n/1e6).toFixed(1)+" "+t("fm_unit_mln")+" "+s;
  if(a>=1e3)return Math.round(n/1e3)+" "+t("fm_unit_ming")+" "+s;
  return Math.round(n||0)+" "+s;
}
// Ixcham KPI kartochkalari (jadval balandligiga deyarli ta'sir qilmasin uchun kichik) — [{l,v,s,c}]
function _fmKpiHtml(tiles){
  return tiles.map(x=>'<div class="fm-kpi" style="--c:'+x.c+'"><div class="fm-kpi-l">'+esc(x.l)+'</div>'
    +'<div class="fm-kpi-v">'+esc(x.v)+'</div>'+(x.s?'<div class="fm-kpi-s" title="'+esc(x.s)+'">'+esc(x.s)+'</div>':'')+'</div>').join("");
}
async function _ensureFirmaData(){
  if(FM)return FM;
  try{const r=await fetch("data_firmalar.json",{cache:"no-store"});FM=await r.json();}
  catch(e){FM={firmalar:[],bugun:new Date().toISOString().slice(0,10),firma_soni:0,chek_soni:0,sana_boshi:"",sana_oxiri:""};}
  return FM;
}
// Jadval o'ram balandligini oynaning haqiqiy bo'sh joyiga moslab hisoblaydi —
// sarlavha balandligi keyinchalik o'zgarsa (masalan yana KPI/qator qo'shilsa)
// qo'lda qayta sozlash shart emas, CSS'dagi magic-number'ga tayanmaydi
// (2026-08-11: KPI qator qo'shilganda calc(100vh-250px) eskirib, butun sahifa
// bitta blok holida skroll bo'lib, sarlavha/filtrlar ko'zdan yo'qolib qolgan edi).
function _fmFitTable(){
  const wrap=fmTab==="buyer"?document.getElementById("fm-buyer-panel"):document.getElementById("fm-supplier-panel");
  const tbl=wrap?wrap.querySelector(".fm-tbl-wrap"):null;
  if(!tbl)return;
  const top=tbl.getBoundingClientRect().top;
  // Xaridorlar panelida jadvaldan KEYIN "qarz/oldindan to'lagan" legend qatori
  // bor - shu balandlikni ham hisobga olish kerak (marginlari bilan birga -
  // getBoundingClientRect margin'ni hisobga olmaydi), aks holda sahifa kichik
  // ekranlarda ortiqcha bo'lib, tashqi skroll paydo bo'ladi.
  const legend=wrap?wrap.querySelector(".fm-legend"):null;
  let legendH=0;
  if(legend){
    const cs=getComputedStyle(legend);
    legendH=legend.getBoundingClientRect().height+parseFloat(cs.marginTop||0)+parseFloat(cs.marginBottom||0);
  }
  tbl.style.maxHeight=Math.max(220,window.innerHeight-top-legendH-32)+"px";
}
window.addEventListener("resize",_fmFitTable);
async function fmInit(){
  await _ensureFirmaData();
  if(!fmFrom){fmFrom=FM.sana_boshi||FM.bugun;fmTo=FM.sana_oxiri||FM.bugun;}
  const i1=document.getElementById("fm-start"),i2=document.getElementById("fm-end");
  if(i1&&i2){i1.min=i2.min=FM.sana_boshi||"";i1.max=i2.max=FM.sana_oxiri||"";i1.value=fmFrom;i2.value=fmTo;}
  fmRender();
  _fmFitTable();
}
// ── Tab almashtirish: Xaridorlar (mavjud) / Ta'minotchilar (yangi) ──
function fmSwitchTab(tab){
  fmTab=tab;
  document.querySelectorAll("#p11 .fm-tab-btn").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));
  const bp=document.getElementById("fm-buyer-panel"),sp=document.getElementById("fm-supplier-panel");
  if(bp)bp.style.display=tab==="buyer"?"":"none";
  if(sp)sp.style.display=tab==="supplier"?"":"none";
  const title=document.getElementById("fm-page-title");
  if(title){const k=tab==="buyer"?"fm_title":"fm_title_supplier";title.dataset.i18n=k;title.textContent=t(k);}
  if(tab==="supplier")fmsInit();else fmRender();
  _fmFitTable();
}
function _fmCalc(f){
  const o={b15:0,b30:0,b45:0,b60:0,jami:0,pb:0,n:0};
  // Invan'ning YAGONA `balans` maydoni (butun tarix bo'yicha joriy holat, biz
  // ko'rmaydigan to'lovlarni ham hisobga oladi) - haqiqiy qarz bor-yo'qligini
  // shu hal qiladi, bizning tor sinxron oynamiz emas.
  const hasDebt=f.balans<0;
  (f.cheklar||[]).forEach(c=>{
    if(c.d<fmFrom||c.d>fmTo)return;
    o.n++;
    // Guruh ustunlari (0-15..45+) FAQAT firma haqiqatan qarzdor bo'lsa
    // to'ldiriladi (2026-08-01 tuzatildi: avval firma umumiy holatda
    // qarzi bo'lmasa ham - Invan balansi musbat - eski cheklar asosida
    // "qarz" ko'rsatib, chalkashlik keltirib chiqargan edi, masalan
    // HOTEL MANOR: balans +21mln bo'lsa ham buket -46mln ko'rsatgan).
    if(hasDebt)o[_fmBucket(_fmAge(c.d))]+=c.s;
  });
  o.jami=hasDebt?-f.balans:0;
  o.pb=hasDebt?0:(f.balans>0?f.balans:0);
  return o;
}
function _fmRows(){
  const q=fmQ.trim().toLowerCase();
  const rows=(FM.firmalar||[]).map(f=>({f,c:_fmCalc(f)})).filter(function(o){
    if(q&&!(o.f.nom.toLowerCase().includes(q)||(o.f.tin||"").includes(q)))return false;
    if(fmFilt==="all")return o.c.jami>0||o.c.pb>0;
    if(fmFilt==="pb")return o.c.pb>0;
    return o.c[fmFilt]>0;
  });
  const k=fmFilt==="all"?"jami":fmFilt==="pb"?"pb":fmFilt;
  rows.sort((a,b)=>b.c[k]-a.c[k]);
  return rows;
}
function _fmTotals(rows){
  const T={b15:0,b30:0,b45:0,b60:0,jami:0,pb:0};
  rows.forEach(o=>Object.keys(T).forEach(x=>T[x]+=o.c[x]));
  return T;
}
function fmRender(){
  if(!FM)return;
  const rows=_fmRows(),T=_fmTotals(rows),tb=document.getElementById("fm-tbody");
  if(!tb)return;
  const cnt=document.getElementById("fm-cnt");
  if(fmTab==="buyer"&&cnt)cnt.textContent=rows.length+" "+t("fm_firma_cnt")+" · "+t("fm_jami").toLowerCase()+" "+(_fmNum(T.jami)||"0")+" "+t("fm_currency");
  const kpiEl=document.getElementById("fm-kpi-row");
  if(kpiEl){
    const top=rows[0],topV=top?(top.c.jami||top.c.pb):0;
    kpiEl.innerHTML=_fmKpiHtml([
      {l:t("fm_kpi_cnt_b"),v:rows.length+"",c:"#534AB7"},
      {l:t("fm_jami"),v:_fmKpiMoney(T.jami),c:"#C0342F"},
      {l:t("fm_kpi_top"),v:top?_fmKpiMoney(topV):FM_DASH,s:top?top.f.nom:"",c:"#EF9F27"}
    ]);
  }
  let h="";
  rows.forEach(function(o,i){
    const f=o.f,c=o.c;
    h+='<tr class="fm-row" onclick="fmOpen(\''+f.id+'\')">'
      +'<td class="fm-z">'+(i+1)+'</td>'
      +'<td><span class="fm-nm" title="'+esc(f.nom)+'">'+esc(f.nom)+'</span></td>'
      +'<td><span class="fm-tin">'+(esc(f.tin)||FM_DASH)+'</span></td>'
      +_fmDebtCell(c.b15)+_fmDebtCell(c.b30)+_fmDebtCell(c.b45)+_fmDebtCell(c.b60)+_fmDebtJmCell(c.jami)
      +'<td class="fm-r'+(c.pb?" fm-pb":"")+'">'+(c.pb?_fmNum(c.pb):FM_DASH)+'</td></tr>';
  });
  h+='<tr class="fm-tot"><td></td><td>'+t("fm_jami")+'</td><td></td>'
    +_fmDebtCell(T.b15)+_fmDebtCell(T.b30)+_fmDebtCell(T.b45)+_fmDebtCell(T.b60)+_fmDebtJmCell(T.jami)
    +'<td class="fm-r fm-pb">'+(_fmNum(T.pb)||FM_DASH)+"</td></tr>";
  tb.innerHTML=h||'<tr><td colspan="9" style="text-align:center;padding:40px;color:#bbb">'+t("fm_bosh")+"</td></tr>";
  document.querySelectorAll("#fm-buyer-panel .fm-seg-btn").forEach(b=>b.classList.toggle("active",b.dataset.k===fmFilt));
}
// ── Firma kartochkasi — ALOHIDA OYNA (p10'ning _ktShowOverlay naqshiga o'xshash) ──
function fmOpen(id){
  const f=(FM.firmalar||[]).find(x=>x.id===id);if(!f)return;
  fmOpenId=id;
  const c=_fmCalc(f);
  const all=(f.cheklar||[]).filter(x=>x.d>=fmFrom&&x.d<=fmTo);
  const ov=document.getElementById("fm-ov");
  const facts=[[t("fm_col_stir"),f.tin||"—"],[t("fm_fact_shartnoma"),f.shartnoma||"—"],
    [t("fm_fact_tel"),f.tel||"—"],[t("fm_fact_chek"),c.n]];
  ov.innerHTML='<div class="fm-ov-head"><div class="fm-ov-bar mob-ov-hdr">'
    +'<button class="fm-back" onclick="fmClose()">'
    +'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>'
    +t("fm_back")+'</button>'
    +'<span class="fm-ov-nom" id="fm-ov-nom">'+esc(f.nom)+'</span></div></div>'
    +'<div class="fm-ov-body">'
    +'<div class="fm-facts">'+facts.map(x=>'<div class="fm-fact"><b>'+esc(x[0])+'</b><span>'+esc(x[1])+'</span></div>').join("")
    +'<div class="fm-fact"><b>'+t("fm_jami")+'</b><span style="color:'+(c.jami>0?"#C0342F":"#1D9E75")+'">'+(c.jami?(c.jami>0?"-":"+")+_fmNum(Math.abs(c.jami)):"0")+'</span></div>'
    +(c.pb?'<div class="fm-fact"><b>'+t("fm_pb")+'</b><span style="color:#1D9E75">'+_fmNum(c.pb)+'</span></div>':"")
    +'</div>'
    +'<div class="fm-aging">'+FM_KEYS.map((k,i)=>
      '<div class="fm-ag" style="--fm-acc:'+FM_CLR[i]+'"><b>'+FM_LAB[i]+'</b><span>'+(_fmNum(c[k])||"0")+'</span></div>').join("")
    +'</div>'
    +'<div class="fm-ov-h">'+t("fm_det_title")+'</div>'
    +'<div style="overflow-x:auto"><table class="fm-rc"><thead><tr>'
    +'<th class="l">'+t("fm_col_sana")+'</th><th class="l">'+t("fm_col_chek")+'</th>'
    +'<th>'+t("fm_col_summa")+'</th><th>'+t("fm_col_tovar")+'</th><th>'+t("fm_col_kun")+'</th>'
    +'<th class="l">'+t("fm_col_guruh")+'</th><th class="l">'+t("fm_col_kassir")+'</th></tr></thead><tbody>'
    +(all.map(x=>{const a=_fmAge(x.d),k=FM_KEYS.indexOf(_fmBucket(a));
        return '<tr><td class="l">'+x.d+'</td><td class="l">'+esc(x.c)+'</td>'
          +'<td>'+_fmNum(x.s)+'</td><td>'+x.n+'</td><td style="color:'+FM_CLR[k]+'">'+a+'</td>'
          +'<td class="l" style="color:'+FM_CLR[k]+'">'+FM_LAB[k]+'</td>'
          +'<td class="l">'+(esc(x.k)||"—")+'</td></tr>';}).join("")
      ||'<tr><td colspan="7" style="text-align:center;padding:30px;color:#94A3B8">'+t("fm_bosh")+'</td></tr>')
    +'</tbody></table></div></div>';
  ov.classList.add("on");document.body.style.overflow="hidden";
  const bb=ov.querySelector(".fm-back");if(bb)bb.focus();
}
function fmClose(){
  const ov=document.getElementById("fm-ov");if(ov)ov.classList.remove("on");
  document.body.style.overflow="";
  fmOpenId=null;
}
document.addEventListener("keydown",function(e){if(e.key==="Escape"&&fmOpenId)fmClose();});
function fmSetFilter(k){fmFilt=k;fmRender();}
function fmSearchInput(){const el=document.getElementById("fm-q");fmQ=el?el.value:"";const c=document.getElementById("fm-clear");if(c)c.style.display=fmQ?"block":"none";fmRender();}
function fmClearSearch(){const el=document.getElementById("fm-q");if(el)el.value="";fmQ="";const c=document.getElementById("fm-clear");if(c)c.style.display="none";fmRender();}
function fmRangeChange(){
  const i1=document.getElementById("fm-start"),i2=document.getElementById("fm-end");
  if(i1&&i1.value)fmFrom=i1.value;
  if(i2&&i2.value)fmTo=i2.value;
  document.querySelectorAll("#p11 .fm-q-btn").forEach(b=>b.classList.remove("active"));
  fmRender();
}
function fmQuick(kun,btn){
  if(!FM)return;
  fmTo=FM.sana_oxiri||FM.bugun;
  if(!kun){fmFrom=FM.sana_boshi||fmTo;}
  else{
    const d=new Date(new Date(fmTo+"T00:00:00Z").getTime()-(kun-1)*864e5).toISOString().slice(0,10);
    fmFrom=(FM.sana_boshi&&d<FM.sana_boshi)?FM.sana_boshi:d;
  }
  const i1=document.getElementById("fm-start"),i2=document.getElementById("fm-end");
  if(i1)i1.value=fmFrom;
  if(i2)i2.value=fmTo;
  document.querySelectorAll("#p11 .fm-q-btn").forEach(b=>b.classList.remove("active"));
  if(btn)btn.classList.add("active");
  fmRender();
}
// Excel eksport — p10/p6 bilan bir xil naqsh (ExcelJS, lazy yuklanadi)
async function fmExportXLSX(){
  await _ensureExcelJS();
  if(!FM||typeof ExcelJS==="undefined")return;
  const rows=_fmRows(),T=_fmTotals(rows);
  const FN={all:"fm_f_all",b15:"fm_b15",b30:"fm_b30",b45:"fm_b45",b60:"fm_b60",pb:"fm_pb"};
  const wb=new ExcelJS.Workbook();
  const ws=wb.addWorksheet(t("nav_p11"),{views:[{state:"frozen",ySplit:5}]});
  ws.mergeCells("A1:I1");
  ws.getCell("A1").value=t("fm_xls_title")+" — "+fmFrom+" — "+fmTo;
  ws.getCell("A1").font={bold:true,size:12,color:{argb:"FFFFFF"}};
  ws.getCell("A1").alignment={horizontal:"center",vertical:"middle"};
  ws.getCell("A1").fill={type:"pattern",pattern:"solid",fgColor:{argb:"534AB7"}};
  ws.getRow(1).height=22;
  ws.addRow([t("fm_xls_filter")+":",t(FN[fmFilt])]);
  ws.addRow([t("fm_xls_date")+":",FM.bugun]);
  ws.addRow([]);
  ws.addRow(["#",t("fm_col_firma"),t("fm_col_stir"),t("fm_b15"),t("fm_b30"),t("fm_b45"),t("fm_b60"),t("fm_jami"),t("fm_pb")]);
  ws.getRow(5).eachCell(c=>{c.font={bold:true,color:{argb:"FFFFFF"}};c.fill={type:"pattern",pattern:"solid",fgColor:{argb:"1D9E75"}};c.alignment={horizontal:"center",vertical:"middle",wrapText:true};});
  rows.forEach(function(o,i){
    const r=ws.addRow([i+1,o.f.nom,o.f.tin||"",o.c.b15||null,o.c.b30||null,o.c.b45||null,o.c.b60||null,o.c.jami||null,o.c.pb||null]);
    r.getCell(2).alignment={horizontal:"left"};
    for(let k=4;k<=9;k++){r.getCell(k).numFmt="#,##0";r.getCell(k).alignment={horizontal:"right"};}
  });
  const tr=ws.addRow(["",t("fm_jami")+":","",T.b15,T.b30,T.b45,T.b60,T.jami,T.pb]);
  tr.eachCell(c=>{c.font={bold:true};});
  for(let k=4;k<=9;k++){tr.getCell(k).numFmt="#,##0";tr.getCell(k).alignment={horizontal:"right"};}
  ws.columns=[{width:5},{width:42},{width:13},{width:15},{width:15},{width:17},{width:17},{width:16},{width:14}];
  const buf=await wb.xlsx.writeBuffer();
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([buf],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));
  a.download="firmalar_"+fmFrom+"_"+fmTo+".xlsx";
  a.click();URL.revokeObjectURL(a.href);
}
// ── P11 "Ta'minotchilar" tab — biz qarzdor bo'lgan ta'minotchilar ──
// Ma'lumot: data_ta_qarz.json (fetch_supplier_debt.py yasaydi — Invan
// `api/v1/suppliers` reyestri, `id` bo'yicha dedup qilingan). Xaridorlar
// tab'idan farqli: aging (0-15/16-30 kabi) YO'Q — Invan API tranzaksiya
// darajasidagi to'lov tarixini bermaydi, faqat joriy umumiy balans bor.
let FMS=null,fmsQ="";
async function _ensureSupplierDebtData(){
  if(FMS)return FMS;
  try{const r=await fetch("data_ta_qarz.json",{cache:"no-store"});FMS=await r.json();}
  catch(e){FMS={taminotchilar:[],ta_soni:0,qarzdor_soni:0,bugun:new Date().toISOString().slice(0,10)};}
  return FMS;
}
let fmsFrom="",fmsTo="";
async function fmsInit(){
  await _ensureSupplierDebtData();
  if(!fmsFrom){fmsFrom=FMS.sana_boshi||FMS.bugun;fmsTo=FMS.sana_oxiri||FMS.bugun;}
  const i1=document.getElementById("fms-start"),i2=document.getElementById("fms-end");
  if(i1&&i2){i1.min=i2.min=FMS.sana_boshi||"";i1.max=i2.max=FMS.sana_oxiri||"";i1.value=fmsFrom;i2.value=fmsTo;}
  fmsRender();
  // fmSwitchTab'dagi darhol chaqiruv KPI qatori hali bo'sh (ma'lumot kelmagan)
  // paytda ishga tushishi mumkin - shu sabab ma'lumot kelib render bo'lgach
  // yana bir bor to'g'ri balandlikni hisoblaymiz.
  _fmFitTable();
}
function fmsRangeChange(){
  const i1=document.getElementById("fms-start"),i2=document.getElementById("fms-end");
  if(i1&&i1.value)fmsFrom=i1.value;
  if(i2&&i2.value)fmsTo=i2.value;
  document.querySelectorAll("#fm-supplier-panel .fms-q-btn").forEach(b=>b.classList.remove("active"));
  fmsRender();
}
function fmsQuick(kun,btn){
  if(!FMS)return;
  fmsTo=FMS.sana_oxiri||FMS.bugun;
  if(!kun){fmsFrom=FMS.sana_boshi||fmsTo;}
  else{
    const d=new Date(new Date(fmsTo+"T00:00:00Z").getTime()-(kun-1)*864e5).toISOString().slice(0,10);
    fmsFrom=(FMS.sana_boshi&&d<FMS.sana_boshi)?FMS.sana_boshi:d;
  }
  const i1=document.getElementById("fms-start"),i2=document.getElementById("fms-end");
  if(i1)i1.value=fmsFrom;
  if(i2)i2.value=fmsTo;
  document.querySelectorAll("#fm-supplier-panel .fms-q-btn").forEach(b=>b.classList.remove("active"));
  if(btn)btn.classList.add("active");
  fmsRender();
}
let fmsFilt="all";
// Ta'minotchi obyektidan (backend allaqachon b15/b30/b45/b60'ni TAXMINIY
// hisoblab bergan - fetch_supplier_debt.py'dagi estimate_aging() ga qarang)
// xaridorlar bilan bir xil {b15,b30,b45,b60,jami,pb} shaklini quradi.
function _fmsCalc(f){
  return {b15:f.b15||0,b30:f.b30||0,b45:f.b45||0,b60:f.b60||0,
    jami:f.balans<0?-f.balans:0,pb:f.balans>0?f.balans:0};
}
function _fmsRows(){
  const q=fmsQ.trim().toLowerCase();
  const rows=(FMS.taminotchilar||[]).map(f=>({f,c:_fmsCalc(f)})).filter(function(o){
    if(q&&!(o.f.nom.toLowerCase().includes(q)||(o.f.tin||"").includes(q)))return false;
    // Sana oralig'i - "oxirgi kirim sanasi" bo'yicha filtrlaydi (kirim tarixi
    // yo'q ta'minotchilar HAR DOIM ko'rsatiladi - qarzni sanasiz sabab bilan
    // yashirmaslik uchun, chunki bu qarz kuzatuv vositasi).
    if(o.f.last_kirim&&fmsFrom&&fmsTo&&(o.f.last_kirim<fmsFrom||o.f.last_kirim>fmsTo))return false;
    if(fmsFilt==="all")return o.c.jami>0||o.c.pb>0;
    if(fmsFilt==="pb")return o.c.pb>0;
    return o.c[fmsFilt]>0;
  });
  const k=fmsFilt==="all"?"jami":fmsFilt==="pb"?"pb":fmsFilt;
  rows.sort((a,b)=>b.c[k]-a.c[k]);
  return rows;
}
function _fmsTotals(rows){
  const T={b15:0,b30:0,b45:0,b60:0,jami:0,pb:0};
  rows.forEach(o=>Object.keys(T).forEach(x=>T[x]+=o.c[x]));
  return T;
}
function fmsSetFilter(k){fmsFilt=k;fmsRender();}
function fmsRender(){
  if(!FMS)return;
  const rows=_fmsRows(),T=_fmsTotals(rows),tb=document.getElementById("fms-tbody");
  if(!tb)return;
  const cnt=document.getElementById("fm-cnt");
  if(fmTab==="supplier"&&cnt)cnt.textContent=rows.length+" "+t("fm_ta_cnt")+" · "+t("fm_jami").toLowerCase()+" "+(_fmNum(T.jami)||"0")+" "+t("fm_currency");
  const kpiEl=document.getElementById("fms-kpi-row");
  if(kpiEl){
    const top=rows[0],topV=top?(top.c.jami||top.c.pb):0;
    kpiEl.innerHTML=_fmKpiHtml([
      {l:t("fm_kpi_cnt_s"),v:rows.length+"",c:"#534AB7"},
      {l:t("fm_jami"),v:_fmKpiMoney(T.jami),c:"#C0342F"},
      {l:t("fm_kpi_top"),v:top?_fmKpiMoney(topV):FM_DASH,s:top?top.f.nom:"",c:"#EF9F27"}
    ]);
  }
  let h="";
  rows.forEach(function(o,i){
    const f=o.f,c=o.c;
    h+='<tr class="fm-row">'
      +'<td class="fm-z">'+(i+1)+'</td>'
      +'<td><span class="fm-nm" title="'+esc(f.nom)+'">'+esc(f.nom)+'</span></td>'
      +'<td><span class="fm-tin">'+(esc(f.tin)||FM_DASH)+'</span></td>'
      +_fmDebtCell(c.b15)+_fmDebtCell(c.b30)+_fmDebtCell(c.b45)+_fmDebtCell(c.b60)+_fmDebtJmCell(c.jami)
      +'<td class="fm-r'+(c.pb?" fm-pb":"")+'">'+(c.pb?_fmNum(c.pb):FM_DASH)+'</td></tr>';
  });
  h+='<tr class="fm-tot"><td></td><td>'+t("fm_jami")+'</td><td></td>'
    +_fmDebtCell(T.b15)+_fmDebtCell(T.b30)+_fmDebtCell(T.b45)+_fmDebtCell(T.b60)+_fmDebtJmCell(T.jami)
    +'<td class="fm-r fm-pb">'+(_fmNum(T.pb)||FM_DASH)+"</td></tr>";
  tb.innerHTML=h||'<tr><td colspan="9" style="text-align:center;padding:40px;color:#bbb">'+t("fm_bosh")+"</td></tr>";
  document.querySelectorAll("#fm-supplier-panel .fms-seg-btn").forEach(b=>b.classList.toggle("active",b.dataset.k===fmsFilt));
}
function fmsSearchInput(){const el=document.getElementById("fms-q");fmsQ=el?el.value:"";const c=document.getElementById("fms-clear");if(c)c.style.display=fmsQ?"block":"none";fmsRender();}
function fmsClearSearch(){const el=document.getElementById("fms-q");if(el)el.value="";fmsQ="";const c=document.getElementById("fms-clear");if(c)c.style.display="none";fmsRender();}
async function fmsExportXLSX(){
  await _ensureExcelJS();
  if(!FMS||typeof ExcelJS==="undefined")return;
  const rows=_fmsRows(),T=_fmsTotals(rows);
  const wb=new ExcelJS.Workbook();
  const ws=wb.addWorksheet(t("fm_tab_supplier"),{views:[{state:"frozen",ySplit:5}]});
  ws.mergeCells("A1:I1");
  ws.getCell("A1").value=t("fm_tab_supplier")+" — "+(FMS.bugun||"")+" ("+t("fm_aging_note")+")";
  ws.getCell("A1").font={bold:true,size:12,color:{argb:"FFFFFF"}};
  ws.getCell("A1").alignment={horizontal:"center",vertical:"middle"};
  ws.getCell("A1").fill={type:"pattern",pattern:"solid",fgColor:{argb:"534AB7"}};
  ws.getRow(1).height=22;
  ws.addRow([]);
  ws.addRow([]);
  ws.addRow(["#",t("fm_col_ta"),t("fm_col_stir"),t("fm_b15"),t("fm_b30"),t("fm_b45"),t("fm_b60"),t("fm_jami"),t("fm_pb")]);
  ws.getRow(4).eachCell(c=>{c.font={bold:true,color:{argb:"FFFFFF"}};c.fill={type:"pattern",pattern:"solid",fgColor:{argb:"1D9E75"}};c.alignment={horizontal:"center",vertical:"middle",wrapText:true};});
  rows.forEach(function(o,i){
    const r=ws.addRow([i+1,o.f.nom,o.f.tin||"",o.c.b15||null,o.c.b30||null,o.c.b45||null,o.c.b60||null,o.c.jami||null,o.c.pb||null]);
    r.getCell(2).alignment={horizontal:"left"};
    for(let k=4;k<=9;k++){r.getCell(k).numFmt="#,##0";r.getCell(k).alignment={horizontal:"right"};}
  });
  const tr=ws.addRow(["",t("fm_jami")+":","",T.b15,T.b30,T.b45,T.b60,T.jami,T.pb]);
  tr.eachCell(c=>{c.font={bold:true};});
  for(let k=4;k<=9;k++){tr.getCell(k).numFmt="#,##0";tr.getCell(k).alignment={horizontal:"right"};}
  ws.columns=[{width:5},{width:42},{width:13},{width:15},{width:15},{width:17},{width:17},{width:16},{width:14}];
  const buf=await wb.xlsx.writeBuffer();
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([buf],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));
  a.download="taminotchi_qarzi_"+(FMS.bugun||"")+".xlsx";
  a.click();URL.revokeObjectURL(a.href);
}

// Sahifa ochilishi bilanoq, foydalanuvchi hali hech qayerga bosmasdan, jonli
// API'dan INVDATA/P8 (kirim) ni fonda oldindan yuklab qo'yamiz - 2026-08-12,
// foydalanuvchi shikoyati: API'ga ulangan bo'limlarda (p2/p5/p7/p8) HAR bir
// tugma bosilganda ~3-5s kutish "qotish"dek sezilar edi, chunki bu ma'lumot
// avval FAQAT o'sha bo'lim ochilganda so'ralardi. _ensureInvData/
// _ensureKirimData ichidagi keshlash (INVDATA/P8 global o'zgaruvchilar)
// o'zgarishsiz qoladi - shu funksiyalarni shunchaki ERTAROQ chaqiramiz,
// keyinroq chaqirilganda esa allaqachon tayyor natijani darhol qaytaradi.
if(location.protocol!=="file:"){
  _ensureInvData().catch(()=>{});
  _ensureKirimData().catch(()=>{});
}

// Fonda, sezilmasdan yangilanish - har 5 daqiqada. Foydalanuvchi so'rovi
// (2026-08-13): sayt kun bo'yi ochiq tursa, stok/kirim ma'lumoti jimgina
// eskirib boradi (faqat sahifa qayta yuklanganda yangilanardi). MUHIM
// QOIDA: agar foydalanuvchi Zakas'da aynan bitta ta'minotchini ochib,
// miqdor kiritayotgan bo'lsa (zkMode==="detail") - HECH NARSA qayta
// chizilmaydi, ishini buzmaslik uchun. Ma'lumotning o'zi baribir fonda
// yangilanadi (INVDATA/P8/ZITEMS) - o'sha ta'minotchidan chiqqach yangi
// holat avtomatik ko'rinadi. Boshqa barcha holatda (ro'yxat ko'rinishi,
// boshqa sahifalar) darhol qayta chiziladi.
// ─── ORQA FONDA JIM YANGILANISH ───────────────────────────────────────────
// Talab (Bilol, 2026-08-15): ma'lumot o'zi yangilanib tursin, "yuklanmoqda"
// ko'rinmasin, va foydalanuvchi BIROR SUPPLIER ZAKASI ustida ishlayotgan
// bo'lsa — o'sha oyna umuman o'zgarmasin (kiritgan sonlari yo'qolmasin);
// yangilanish faqat o'sha oynadan chiqqandan keyin qo'llansin.
let _pendingBg=null;   // qo'llanishi kutilayotgan yangi ma'lumot

// Foydalanuvchi aynan bitta supplier zakasi ustida ishlayaptimi?
function _zkEditingSupplier(){return curPageId==="p7"&&zkMode==="detail";}

// 2026-08-19 (Bilol topilmasi, TAKRORLANUVCHI "Noma'lum" bug): P2'ning
// har tovar uchun sup/amt/price kabi maydonlari FAQAT BIR MARTA
// (_enrichWithInventory, birinchi sahifa yuklanishida) to'ldirilardi.
// Agar o'sha BIR MARTALIK to'ldirish biror sababdan (vaqtinchalik tarmoq
// muammosi, sovuq boshlanish va h.k.) to'liq bo'lmay qolsa, P2 butun
// sessiya davomida BUZUQ qolib ketardi - _bgSilentRefresh() har 15
// daqiqada YANGI, TO'G'RI INVDATA olib kelsa ham, hech kim P2'ning
// mavjud qatorlarini o'sha yangi ma'lumot bilan QAYTA to'ldirmasdi
// (_buildZItems() faqat P2'da ALLAQACHON turgan qiymatni o'qiydi).
// Endi INVDATA yangilanganda P2 ham QAYTA boyitiladi - shu sabab bir
// martalik xato o'zi tuzalib ketadi (foydalanuvchi qayta yuklashi shart
// emas), va bug qaytalanmaydi.
async function _applyBgData(d){
  if(d.inventory)INVDATA=d.inventory;
  if(d.kirim)P8=d.kirim;
  if(P2){
    if(d.inventory)await _enrichWithInventory(P2);
    _buildZItems();
  }
  if(curPageId==="p7"&&ZITEMS)renderZakas();
  else if(curPageId==="p5"&&ZITEMS)renderZaxira();
  else if(curPageId==="p8"&&P8)renderP8();
  else if(curPageId==="p12"&&P2){_mgRefreshFilters();mgRenderList();}
}

// Kutib turgan yangilanishni qo'llaydi — zakas oynasidan chiqilganda
// (zkBackToList) va bo'lim almashtirilganda (showPage) chaqiriladi.
function _flushPendingBg(){
  if(!_pendingBg||_zkEditingSupplier())return;
  const d=_pendingBg;_pendingBg=null;_applyBgData(d);
}

let _bgSilentBusy=false;
async function _bgSilentRefresh(){
  if(!window.TiinDataAPI||location.protocol==="file:"||_bgSilentBusy)return;
  _bgSilentBusy=true;
  let d;
  try{
    // DIQQAT: ma'lumot avval TO'LIQ olinadi, keyingina qo'llanadi. Ilgari
    // INVDATA/P8/ZITEMS zakas oynasi ochiq turganda ham yangilanib,
    // faqat qayta chizish o'tkazib yuborilardi — ya'ni foydalanuvchining
    // ostidagi sonlar jimgina o'zgarib ketardi.
    const boot=await window.TiinDataAPI.bootstrap();
    const inv=(boot&&boot.inventory&&Object.keys(boot.inventory).length)?boot.inventory:null;
    const kirim=await window.TiinDataAPI.kirimdata();
    d={inventory:inv,kirim:kirim||null};
  }catch(e){_bgSilentBusy=false;return;}  // tarmoq xatosi — jimgina o'tkaziladi, keyingi urinishda qayta
  _bgSilentBusy=false;
  if(_zkEditingSupplier()){_pendingBg=d;return;}   // ochiq oynaga TEGMAYDI
  await _applyBgData(d);
}
// 2026-08-15: 5 -> 15 daqiqa (Bilol so'rovi) - backend keshi ham 15
// daqiqalik (calcStock endi shu oraliqda Invan'dagi jonli sotuv/kirim
// bilan tuzatiladi, backend/app.py: `_live_invdata()`). Bu so'rov ham
// ma'lumotni yangilab turadi, ham funksiyani "issiq" saqlaydi — foydalanuvchi
// sahifani ochganda sovuq boshlanishni (~20-25s) kutmaydi.
if(location.protocol!=="file:")setInterval(_bgSilentRefresh,15*60*1000);

// ─── Node.js eksporti (zakas/watch_agent.js uchun) ─────────────────────────
// Faqat CommonJS muhitida (Node) ishga tushadi - brauzerda `module` yo'q,
// shuning uchun bu blok hech narsaga ta'sir qilmaydi. Yuqoridagi mantiqning
// BIR HARFI HAM o'zgartirilmagan - zakas miqdorini Python/Node'da qayta
// yozish o'rniga (avvalgi 46x xato tajribasi, [[feedback-reuse-not-rewrite-calc-code]])
// xuddi shu funksiyalar to'g'ridan-to'g'ri chaqiriladi. Chaqiruvchi tomonda
// (watch_agent.js) `document`/`window`/`location`/`localStorage` uchun sodda
// stub o'rnatiladi - `location.protocol="file:"` qilib qo'yilsa, yuqoridagi
// _zkStockOvEndpoint()/_zkDraftEndpoint() kabi funksiyalar AVTOMATIK ravishda
// production absolute URL (https://tiin-market.vercel.app/...) ishlatadi -
// xuddi shu fayl lokal file:// orqali ochilganda ishlaydigani kabi.
if(typeof module!=="undefined"&&module.exports){
  module.exports={
    _ensureP2Data,_enrichWithInventory,_buildZItems,_zkBuildSuppliers,
    krPendingQty,_zkBoxSize,_ensureStockOverrides,_ensureZkDraft,
    ZK_DEFAULT_TARGET,ZK_BUFFER,ZK_NO_SUPPLIER,ZK_MIN_ORDER,
    getZItems:()=>ZITEMS,
    getZkSupTargets:()=>zkSupTargets,
    setP8:(v)=>{P8=v;},
  };
}
