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
  sp_excel_btn:{uz:"Excel",en:"Excel",ru:"Excel"},
  sp_cnt_suffix:{uz:"ta supplier",en:"suppliers",ru:"поставщиков"},
  sp_topilmadi:{uz:"Supplier topilmadi",en:"No suppliers found",ru:"Поставщики не найдены"},
  sp_det_month:{uz:"{month} oyiga tegishli ma'lumotlar",en:"Data for {month}",ru:"Данные за {month}"},
  sp_det_empty:{uz:"{month} oyi uchun ma'lumot hali yuklanmagan — tarixiy ma'lumotlar bazaga to'liq yuklab bo'lingach bu yerga qo'shiladi.",en:"Data for {month} hasn't loaded yet — it will appear here once the historical data finishes loading.",ru:"Данные за {month} ещё не загружены — появятся здесь после полной загрузки исторических данных."},
  sp_stat_tushum:{uz:"Tushum",en:"Revenue",ru:"Выручка"},
  sp_stat_hissa:{uz:"Hissa",en:"Share",ru:"Доля"},
  sp_stat_tovarlar:{uz:"Tovarlar",en:"Products",ru:"Товары"},
  sp_stat_cheklar:{uz:"Cheklar",en:"Receipts",ru:"Чеки"},
  sp_stat_sotilmay:{uz:"Sotilmay qolgan",en:"Unsold",ru:"Не продано"},
  sp_all_products:{uz:"Barcha tovarlar ({n} ta)",en:"All products ({n})",ru:"Все товары ({n})"},
  sp_month_calc:{uz:"{month} bo'yicha hisob",en:"Calculated for {month}",ru:"Расчет за {month}"},
  sp_month_select:{uz:"Hisob oyi",en:"Calculation month",ru:"Месяц расчета"},
  sp_prod_name:{uz:"Tovar nomi",en:"Product name",ru:"Название товара"},
  sp_prod_sku:{uz:"SKU",en:"SKU",ru:"SKU"},
  sp_prod_revenue:{uz:"Tushum",en:"Revenue",ru:"Выручка"},
  sp_prod_receipts:{uz:"Chek",en:"Receipts",ru:"Чеки"},
  sp_prod_abc:{uz:"ABC",en:"ABC",ru:"ABC"},
  sp_ta:{uz:"ta",en:"",ru:"шт"},
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
  amt_pos:{uz:"Musbat (>0)",en:"Positive (>0)",ru:"Положительный (>0)"},
  amt_zero:{uz:"Nol (0)",en:"Zero (0)",ru:"Ноль (0)"},
  amt_neg:{uz:"Manfiy (<0)",en:"Negative (<0)",ru:"Отрицательный (<0)"},
  abc_a_opt:{uz:"A — Lider",en:"A — Leader",ru:"A — Лидер"},
  abc_b_opt:{uz:"B — Potentsial",en:"B — Potential",ru:"B — Потенциал"},
  abc_c_opt:{uz:"C — Aylanmada yo'q",en:"C — Out of rotation",ru:"C — Не в обороте"},
  // Mahsulotlar (p2)
  p2_search_ph:{uz:"Nom, SKU yoki barcode bo'yicha qidirish...",en:"Search by name, SKU or barcode...",ru:"Поиск по названию, SKU или штрихкоду..."},
  close_graphs:{uz:"Grafiklarni yopish",en:"Close charts",ru:"Закрыть графики"},
  card_birga:{uz:"Birga KO'P sotilgan",en:"Frequently bought together",ru:"Часто покупают вместе"},
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
  abc3_donut_h:{uz:"Tushum ulushi",en:"Revenue share",ru:"Доля выручки"},
  abc3_bar_h:{uz:"Top 15 mahsulot — tushum bo'yicha (mln UZS)",en:"Top 15 products by revenue (mln UZS)",ru:"Топ 15 товаров по выручке (млн UZS)"},
  abc3_tab_a:{uz:"Lider tovarlar — A",en:"Leader products — A",ru:"Лидеры — A"},
  abc3_tab_b:{uz:"Potentsial tovarlar — B",en:"Potential products — B",ru:"Потенциальные — B"},
  abc3_tab_c:{uz:"Aylanmada yo'q — C",en:"Out of rotation — C",ru:"Не в обороте — C"},
  abc3_tab_c1:{uz:"Olib tashlash — C1",en:"To delist — C1",ru:"К удалению — C1"},
  abc3_search_ph:{uz:"Istalgan guruhdan mahsulot qidiring...",en:"Search a product in any group...",ru:"Поиск товара в любой группе..."},
  abc3_th_name:{uz:"Mahsulot nomi",en:"Product name",ru:"Название товара"},
  filt_cat2:{uz:"Kategoriya",en:"Category",ru:"Категория"},
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
  z_th_oxirgi:{uz:"Oxirgi sotuv",en:"Last sale",ru:"Последняя продажа"},
  z_th_signal:{uz:"Signal",en:"Signal",ru:"Сигнал"},
  yuklanmoqda:{uz:"Yuklanmoqda...",en:"Loading...",ru:"Загрузка..."},
  // Zakas (p7)
  nav_p7:{uz:"Zakas",en:"Orders",ru:"Заказ"},
  p7_title:{uz:"Zakas",en:"Orders",ru:"Заказ"},
  p7_sub:{uz:"Yetkazib beruvchi bo'yicha tavsiya etilgan buyurtma ro'yxati — Stock signallaridan avtomatik yangilanadi",en:"Recommended order list by supplier — updates automatically from Stock signals",ru:"Рекомендуемый список заказа по поставщикам — обновляется автоматически из сигналов склада"},
  zk_sum_sup:{uz:"yetkazib beruvchi",en:"suppliers",ru:"поставщиков"},
  zk_sum_items:{uz:"tovar",en:"products",ru:"товаров"},
  zk_sum_amt:{uz:"jami zakas qiymati",en:"total order value",ru:"общая сумма заказа"},
  zk_search_ph:{uz:"Mahsulot, SKU yoki yetkazib beruvchi qidirish...",en:"Search product, SKU or supplier...",ru:"Поиск товара, SKU или поставщика..."},
  zk_all_sup:{uz:"Barcha yetkazib beruvchilar",en:"All suppliers",ru:"Все поставщики"},
  zk_export:{uz:"Excel yuklab olish",en:"Download Excel",ru:"Скачать Excel"},
  zk_col_product:{uz:"Mahsulot",en:"Product",ru:"Товар"},
  zk_col_stock:{uz:"Stok",en:"Stock",ru:"Остаток"},
  zk_col_daily:{uz:"Kunlik o'rtacha",en:"Daily avg",ru:"Средн. в день"},
  zk_col_days_left:{uz:"Qolgan kun",en:"Days left",ru:"Дней осталось"},
  zk_col_extra_days:{uz:"Qo'shimcha kun",en:"Extra days",ru:"Доп. дни"},
  zk_col_order:{uz:"Zakas",en:"Order",ru:"Заказ"},
  zk_col_status:{uz:"Holat",en:"Status",ru:"Статус"},
  zk_col_supplier:{uz:"Yetkazib beruvchi",en:"Supplier",ru:"Поставщик"},
  zk_col_sku:{uz:"SKU",en:"SKU",ru:"SKU"},
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
  zk_reset_btn:{uz:"Tozalash",en:"Reset",ru:"Сбросить"},
  zk_reset_confirm:{uz:"Barcha qo'lda kiritilgan o'zgarishlar (qo'shimcha kunlar, miqdorlar, maqsad kunlar) o'chiriladi. Davom etasizmi?",en:"All manual changes (extra days, quantities, target days) will be cleared. Continue?",ru:"Все ручные изменения (доп. дни, количества, целевые дни) будут сброшены. Продолжить?"},
  zk_show_need_only:{uz:"faqat kerak bo'lganlarni ko'rsat",en:"show needed only",ru:"показать только нужные"},
  zk_show_all_n:{uz:"barchasini ko'rsat ({n})",en:"show all ({n})",ru:"показать все ({n})"},
  zk_no_need_rows:{uz:"Bu yetkazib beruvchida hozircha zakas kerak bo'lgan tovar yo'q",en:"No items need ordering from this supplier right now",ru:"У этого поставщика пока нет товаров, требующих заказа"},
  zk_minadd_hint:{uz:"Minimal buyurtma uchun qo'shildi",en:"Added to reach minimum order quantity",ru:"Добавлено для минимального заказа"},
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
  const _activeNav=document.querySelector(".sb-item.active");
  const _cr=document.getElementById("tb-crumb");
  if(_activeNav&&_cr)_cr.textContent=_activeNav.textContent.trim();
  if(typeof renderP1==="function"&&P1)renderP1();
  if(curPageId==="p7"&&typeof renderZakas==="function")renderZakas();
  if(curPageId==="p6"&&typeof initP6==="function"&&P6)initP6();
}
function applyI18n(){
  document.querySelectorAll("[data-i18n]").forEach(el=>{el.textContent=t(el.dataset.i18n);});
  document.querySelectorAll("[data-i18n-ph]").forEach(el=>{el.placeholder=t(el.dataset.i18nPh);});
}

let P1=JSON.parse(document.getElementById("p1data").textContent);let P1FULL=P1;
let GRA=null,GRB=null,DAILYFULL=null,DMETAFULL=null;
let curPageId="p1";
// Mahsulotlar (p2) va Stock (p5) bitta umumiy oraliqni baham ko'radi (Zakas ro'yxati ham shu
// orqali yangilanadi) - biridan o'zgartirilsa, ikkinchisi qayta tashrif buyurganda eskisiga
// qaytib ketmaydi. Bosh sahifa va boshqalar mustaqil o'z oralig'ini saqlaydi.
const PAGE_GROUP={p1:"p1",p2:"p2p5",p5:"p2p5",p3:"p3",p6:"p6"};
const PAGE_DEFAULT_DAYS={p1:7,p2p5:30,p3:30,p6:30};
let pageRanges={};
let P2=null,P3=null,P4=null,DAILY=null,DSKU={},DNAME={},DMETA=null,p2chart=null,p4sk="v",p4sa=false,curTab3="A",curRows3=[];
let p2LastI=null;
let ZITEMS=null,INVDATA=null,zCurFilter="all",zQuery="",zF={cat:"",sub:"",sup:"",type:"",abc:""},zFilled=false,zLastZi=null,zPage=1,zSuperTabCur="aktiv";
const ZPS=50;
let P6=null,p6CurF="all",p6Q="",p6Page=1,p6SelI=null,p6SelMonth=null,p6CardMonth=null;
const P6PS=50;
const ZK_DEFAULT_TARGET=20;
const ZK_MIN_ORDER=3;
let zkQuery="",zkSupFilter="",zkSupTargets={},zkRowAdj={},zkRowQty={},zkRowChecked={},zkSupShowAll={},_ZK_SUPPLIERS=[],_ZK_ALLROWS=[],_zkPmap=null,zkPage=1,_zBackPage="p5",zkSortKey="orderQty",zkSortAsc=false,zkRowOrder={};
function zkToggleSupShowAll(si){const s=_ZK_SUPPLIERS[si];if(!s)return;zkSupShowAll[s.sup]=!zkSupShowAll[s.sup];renderZakas();}
function _zkIsChecked(r){const v=zkRowChecked[r.key];return v!=null?v:false;}
function zkToggleRow(ri){const r=_ZK_ALLROWS[ri];if(!r)return;zkRowChecked[r.key]=!_zkIsChecked(r);renderZakas();}
function _zkRelevantRows(s){const rel=s.rows.filter(r=>r.orderQty>0);return rel.length?rel:s.rows;}
function zkToggleSupplier(si){const s=_ZK_SUPPLIERS[si];if(!s)return;const rel=_zkRelevantRows(s);const allChecked=rel.every(r=>_zkIsChecked(r));const newVal=!allChecked;rel.forEach(r=>{zkRowChecked[r.key]=newVal;});renderZakas();}
function _zkRowKey(v){return v.sku?("s:"+v.sku):("n:"+v.name);}
function _zkPriceOf(v){
  if(!P2)return 0;
  if(!_zkPmap){_zkPmap={};P2.forEach(x=>{if(x.sku)_zkPmap["s:"+x.sku]=x.p||0;_zkPmap["n:"+x.name]=x.p||0;});}
  const k=_zkRowKey(v);
  return _zkPmap[k]!=null?_zkPmap[k]:0;
}
function _zkTh(lbl,k,align){
  const a=align||"right";const act=zkSortKey===k;
  const ar=act?(zkSortAsc?"↑":"↓"):"↕";
  return `<th onclick="zkSort('${k}')" style="cursor:pointer;text-align:${a};user-select:none;white-space:nowrap">${lbl}<span style="margin-left:2px;color:${act?"#534AB7":"#ccc"};font-size:9px">${ar}</span></th>`;
}
function zkSort(k){
  if(zkSortKey===k)zkSortAsc=!zkSortAsc;
  else{zkSortKey=k;zkSortAsc=k==="name"||k==="abc";}
  zkRowOrder={};
  renderZakas();
}
function zkResetAll(){
  if(!confirm(t("zk_reset_confirm")))return;
  zkRowQty={};zkRowAdj={};zkSupTargets={};zkRowOrder={};
  renderZakas();
}
// Bir supplierning ISTALGAN tovari kritik/urgent bo'lsa - shu supplierning BARCHA tovarlari
// (dailyAvg>0 bo'lganlari) zakas ro'yxatiga tushadi, bir xil "maqsadli kun"ga moslab -
// shunda supplier bir martagina kelib hammasini birga to'ldiradi.
function _zkBuildSuppliers(){
  _ZK_ALLROWS=[];
  if(!ZITEMS)return [];
  const triggered=new Set();
  ZITEMS.forEach(v=>{if((v.signal==="kritik"||v.signal==="urgent")&&v.sup)triggered.add(v.sup);});
  const bySup={};
  ZITEMS.forEach(v=>{
    if(!v.sup||!triggered.has(v.sup))return;
    if(!(v.dailyAvg>0))return;
    (bySup[v.sup]=bySup[v.sup]||[]).push(v);
  });
  const supNames=Object.keys(bySup).sort((a,b)=>a.localeCompare(b,"ru"));
  const out=supNames.map(sup=>{
    const target=zkSupTargets[sup]!=null?zkSupTargets[sup]:ZK_DEFAULT_TARGET;
    const rows=bySup[sup].map(v=>{
      const key=_zkRowKey(v);
      const adj=zkRowAdj[key]||0;
      const stock=v.stock||0;
      // Manfiy stok = haqiqiy qoldiq noma'lum (Invan xatosi) - zakas miqdori taklif qilinmaydi,
      // lekin tovar tekshirish uchun ro'yxatda ko'rinishda qoladi.
      const daysLeft=v.daysLeft!=null?v.daysLeft:0;
      const zakasDays=Math.max(0,target-daysLeft)+adj;
      let orderQty=stock<0?0:v.dailyAvg*zakasDays;
      orderQty=v.kg?Math.round(orderQty*100)/100:Math.ceil(orderQty);
      let minAdd=0;
      if(!v.kg&&orderQty>0&&orderQty<ZK_MIN_ORDER){minAdd=ZK_MIN_ORDER-orderQty;orderQty=ZK_MIN_ORDER;}
      const manualQty=zkRowQty[key];if(manualQty!=null){orderQty=manualQty;minAdd=0;}
      return {key,name:v.name,sku:v.sku,abc:v.abc,cat:v.cat,kg:v.kg,stock,dailyAvg:v.dailyAvg,daysLeft:v.daysLeft,adj,zakasDays,orderQty,minAdd,signal:v.signal,price:_zkPriceOf(v)};
    }).sort((a,b)=>{
      const ord=zkRowOrder[sup];if(ord){const ia=ord.indexOf(a.key),ib=ord.indexOf(b.key);return(ia>=0?ia:9999)-(ib>=0?ib:9999);}
      const k=zkSortKey||"orderQty";let va=a[k],vb=b[k];
      if(k==="name"){va=va||"";vb=vb||"";return zkSortAsc?va.localeCompare(vb,"ru"):vb.localeCompare(va,"ru");}
      if(k==="abc"){const o={A:0,B:1,C:2};va=o[va]??3;vb=o[vb]??3;return zkSortAsc?va-vb:vb-va;}
      va=va??0;vb=vb??0;return zkSortAsc?va-vb:vb-va;
    });
    if(!zkRowOrder[sup])zkRowOrder[sup]=rows.map(r=>r.key);
    const qtyDona=rows.filter(r=>!r.kg).reduce((s,r)=>s+r.orderQty,0);
    const qtyKg=rows.filter(r=>r.kg).reduce((s,r)=>s+r.orderQty,0);
    const valTotal=rows.reduce((s,r)=>s+r.orderQty*(r.price||0),0);
    return {sup,target,rows,qtyDona,qtyKg,valTotal};
  });
  out.forEach((s,si)=>{s._si=si;s.rows.forEach(r=>{r._ri=_ZK_ALLROWS.length;_ZK_ALLROWS.push(r);});});
  return out;
}
function zkSearchInput(v){
  zkQuery=v.toLowerCase().trim();
  zkSupFilter="";
  zkPage=1;
  const x=document.getElementById("zk-search-x");if(x)x.style.display=v?"flex":"none";
  _zkRenderSupDrop();
  renderZakas();
}
function zkSearchFocus(){_zkRenderSupDrop();}
function zkSearchClear(){
  const inp=document.getElementById("zk-search");if(inp)inp.value="";
  zkQuery="";zkSupFilter="";zkPage=1;
  const x=document.getElementById("zk-search-x");if(x)x.style.display="none";
  const d=document.getElementById("zk-sup-drop");if(d)d.classList.remove("open");
  renderZakas();
  if(inp)inp.focus();
}
function zkPickSupplier(sup){
  zkSupFilter=sup;zkQuery="";zkPage=1;
  const inp=document.getElementById("zk-search");if(inp)inp.value=sup;
  const x=document.getElementById("zk-search-x");if(x)x.style.display="flex";
  const d=document.getElementById("zk-sup-drop");if(d)d.classList.remove("open");
  renderZakas();
}
function zkGo(p){zkPage=p;renderZakas();const body=document.getElementById("zk-body");if(body)body.scrollTop=0;}
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
function _zkRenderQuickPanel(){
  const panel=document.getElementById("zk-quick-panel");if(!panel)return;
  panel.classList.toggle("open",zkQuickPanelOpen);
  const list=_ZK_SUPPLIERS.map(s=>({s,needCount:s.rows.filter(r=>r.orderQty>0).length})).filter(x=>x.needCount>0).sort((a,b)=>b.needCount-a.needCount).map(x=>x.s);
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
    if(s)zkToggleSupplier(s._si);
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
});
function zkSetTarget(si,val){
  const s=_ZK_SUPPLIERS[si];if(!s)return;
  let v=parseInt(val);if(isNaN(v)||v<0)v=ZK_DEFAULT_TARGET;
  s.rows.forEach(r=>{delete zkRowQty[r.key];});
  delete zkRowOrder[s.sup];
  zkSupTargets[s.sup]=v;
  renderZakas();
}
function zkSetQty(ri,val){
  const r=_ZK_ALLROWS[ri];if(!r)return;
  const v=r.kg?parseFloat(val):parseInt(val);
  if(!isNaN(v)&&v>=0)zkRowQty[r.key]=v;else delete zkRowQty[r.key];
  renderZakas();
}
function zkSetAdj(ri,val){
  const r=_ZK_ALLROWS[ri];if(!r)return;
  let v=parseInt(val);if(isNaN(v))v=0;
  zkRowAdj[r.key]=v;
  renderZakas();
}
function zkAddAdj(ri,delta){
  const r=_ZK_ALLROWS[ri];if(!r)return;
  const cur=zkRowAdj[r.key]||r.adj||0;
  zkRowAdj[r.key]=Math.max(0,cur+delta);
  renderZakas();
}
function renderZakas(){
  if(!ZITEMS){if(P2)_buildZItems();else return;}
  _ZK_SUPPLIERS=_zkBuildSuppliers();
  _zkRenderQuickPanel();
  let sups=_ZK_SUPPLIERS;
  if(zkSupFilter)sups=sups.filter(s=>s.sup===zkSupFilter);
  if(zkQuery){
    const q=zkQuery;
    sups=sups.map(s=>({...s,rows:s.rows.filter(r=>(r.name||"").toLowerCase().includes(q)||String(r.sku||"").toLowerCase().includes(q)||s.sup.toLowerCase().includes(q))})).filter(s=>s.rows.length);
  }
  sups=sups.slice().sort((a,b)=>b.valTotal-a.valTotal);
  const supCountEl=document.getElementById("zk-sup-count");
  if(supCountEl)supCountEl.innerHTML=`<b>${sups.length}</b> ${t("zk_sum_sup")}`;
  const body=document.getElementById("zk-body");if(!body)return;
  if(!sups.length){body.innerHTML=`<div class="zk-empty">${t("zk_empty")}</div>`;const pag=document.getElementById("zk-pag");if(pag)pag.innerHTML="";return;}
  const totalSups=sups.length;
  if(zkPage<1)zkPage=1;
  if(zkPage>totalSups)zkPage=totalSups;
  const shownSups=sups.slice(zkPage-1,zkPage);
  const sigLbl={kritik:["dot-kritik",t("sig_kritik")],urgent:["dot-urgent",t("sig_urgent")],tekshir:["dot-tekshir",t("sig_tekshir")],excess:["dot-excess",t("sig_excess")],normal:["dot-normal",t("sig_normal")]};
  let h="";
  shownSups.forEach(s=>{
    const totTxt=(s.qtyDona>0?s.qtyDona.toLocaleString()+" sht":"")+(s.qtyDona>0&&s.qtyKg>0?" · ":"")+(s.qtyKg>0?s.qtyKg.toLocaleString()+" kg":"");
    const supRel=_zkRelevantRows(s);
    const checkedCount=supRel.filter(r=>_zkIsChecked(r)).length;
    const supAllChecked=checkedCount===supRel.length;
    const supIndet=checkedCount>0&&!supAllChecked;
    const supChkAttrs=`${supAllChecked?" checked":""}${supIndet?" data-indet=\"1\"":""}`;
    const needCount=s.rows.filter(r=>r.orderQty>0).length;
    const showAll=!!zkSupShowAll[s.sup]||needCount===0;
    const visRows=showAll?s.rows:s.rows.filter(r=>r.orderQty>0);
    const needBadge=`<span class="zk-needbadge" onclick="zkToggleSupShowAll(${s._si})"><b>${needCount}</b> ${t("zk_need_label")} &nbsp;·&nbsp; ${showAll?t("zk_show_need_only"):t("zk_show_all_n").replace("{n}",s.rows.length)}</span>`;
    h+=`<div class="zk-sup-block"><div class="zk-sup-name"><span style="display:flex;align-items:center;gap:10px"><input type="checkbox" class="zk-chk zk-sup-chk"${supChkAttrs} onchange="zkToggleSupplier(${s._si})"><span>${esc(s.sup)}</span></span><span class="zk-sup-meta">${needBadge} &nbsp;·&nbsp; ${t("zk_total_label")} <b>${totTxt||"0"}</b><span class="zk-target-edit">${t("zk_target_label")} <input class="zk-target-inp" type="number" min="0" max="365" value="${s.target}" onchange="zkSetTarget(${s._si},this.value)"></span></span></div><div class="zk-tbl-wrap"><table class="zk-ktbl"><colgroup><col style="width:4%"><col style="width:4%"><col style="width:31%"><col style="width:5%"><col style="width:8%"><col style="width:11%"><col style="width:9%"><col style="width:10%"><col style="width:7%"><col style="width:11%"></colgroup><thead><tr><th style="text-align:center"><input type="checkbox" class="zk-chk zk-sup-chk"${supChkAttrs} onchange="zkToggleSupplier(${s._si})"></th><th>#</th>${_zkTh(t("zk_col_product"),"name","left")}${_zkTh("ABC","abc","center")}${_zkTh(t("zk_col_stock"),"stock")}${_zkTh(t("zk_col_daily"),"dailyAvg")}${_zkTh(t("zk_col_days_left"),"daysLeft")}<th style="text-align:right">${t("zk_col_extra_days")}</th><th style="text-align:center">${t("zk_col_status")}</th>${_zkTh(t("zk_col_order"),"orderQty")}</tr></thead><tbody>`;
    if(!visRows.length){
      h+=`<tr><td colspan="10" style="text-align:center;color:#bbb;padding:18px;font-size:12px">${t("zk_no_need_rows")}</td></tr>`;
    }
    visRows.forEach((r,i)=>{
      const u=r.kg?"кг":"шт";
      const stTxt=r.stock<=0?`<span style="color:#E24B4A;font-weight:700">${r.kg?r.stock.toFixed(2):r.stock.toLocaleString()}</span>`:(r.kg?r.stock.toFixed(2):r.stock.toLocaleString());
      const dTxt=r.dailyAvg>0?(r.kg?r.dailyAvg.toFixed(2):Math.round(r.dailyAvg*10)/10)+" "+u:"—";
      const dlTxt=r.daysLeft!=null?r.daysLeft:"—";
      const oqRaw=r.kg?r.orderQty:r.orderQty;
      const isManual=zkRowQty[r.key]!=null;
      const sl=sigLbl[r.signal]||["dot-normal",r.signal||"—"];
      h+=`<tr ondblclick="zkOpenProduct(${r._ri})" style="cursor:pointer" title="Ikki marta bosing — grafik ko'rish"><td style="text-align:center"><input type="checkbox" class="zk-chk" ${_zkIsChecked(r)?"checked":""} onchange="zkToggleRow(${r._ri})" onclick="event.stopPropagation()"></td><td style="color:#bbb;font-size:11px">${i+1}</td><td><div style="font-weight:600;white-space:normal;word-break:break-word">${esc(r.name)}</div>${r.sku?`<div style="font-size:10px;color:#bbb">${esc(r.sku)}</div>`:""}</td><td style="text-align:center"><span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:4px;background:${r.abc==="A"?"#e8f8f3":r.abc==="B"?"#eeebfb":"#fef3e2"};color:${r.abc==="A"?"#1D9E75":r.abc==="B"?"#534AB7":"#EF9F27"}">${r.abc||"—"}</span></td><td style="text-align:right">${stTxt}</td><td style="text-align:right;color:#777">${dTxt}</td><td style="text-align:right;color:#777">${dlTxt}</td><td style="text-align:right"><input class="zk-adj-inp${r.adj?" nonzero":""}" type="number" value="${r.adj}" onchange="zkSetAdj(${r._ri},this.value)" onclick="event.stopPropagation()"></td><td style="text-align:center"><span class="status-dot ${sl[0]}" title="${esc(sl[1])}"></span></td><td style="text-align:right;padding:2px 4px">${r.minAdd>0&&!isManual?`<span style="color:#EF9F27;font-size:10px;margin-right:3px">+${r.minAdd}</span>`:"" }<input class="zk-adj-inp${isManual?' nonzero':''}" type="number" min="0" step="${r.kg?'0.1':'1'}" value="${oqRaw}" onchange="zkSetQty(${r._ri},this.value)" onclick="event.stopPropagation()"> <span style="color:#888;font-size:11px">${u}</span></td></tr>`;
    });
    h+=`</tbody></table></div></div>`;
  });
  const _prevWrap=body.querySelector(".zk-tbl-wrap");const _prevST=_prevWrap?_prevWrap.scrollTop:0;
  body.innerHTML=h;
  if(_prevST>0){const nw=body.querySelector(".zk-tbl-wrap");if(nw)nw.scrollTop=_prevST;}
  body.querySelectorAll('.zk-sup-chk[data-indet="1"]').forEach(el=>{el.indeterminate=true;});
  renderZakasPag(totalSups);
}
async function exportZakasCSV(){
  if(typeof ExcelJS==="undefined")return;
  const sups=_ZK_SUPPLIERS.length?_ZK_SUPPLIERS:_zkBuildSuppliers();
  const DARK="1A1A1A";

  let flat=[];
  const targets=new Set();
  sups.forEach(s=>{
    s.rows.filter(r=>_zkIsChecked(r)).forEach(r=>{
      flat.push({sup:s.sup,target:s.target,r});
      targets.add(s.target);
    });
  });
  flat.sort((a,b)=>b.r.orderQty-a.r.orderQty);

  if(!flat.length){alert(t("zk_no_selection"));return;}

  const wb=new ExcelJS.Workbook();
  const ws=wb.addWorksheet(t("nav_p7")||"Zakas",{views:[{state:"frozen",ySplit:2}]});

  const targetTxt=targets.size<=1?[...targets][0]:[...targets].sort((a,b)=>a-b).join(", ");
  ws.getCell("A1").value=`${t("zk_col_target")}: ${targetTxt}`;
  ws.getCell("A1").font={bold:true,size:11,color:{argb:DARK}};

  const headers=[t("zk_col_supplier"),t("zk_col_sku"),t("zk_col_product"),t("zk_col_category"),"ABC",t("zk_col_unit"),t("zk_col_stock"),t("zk_col_extra_days"),t("zk_col_order")];
  const headerRow=ws.getRow(2);
  headers.forEach((h,i)=>{
    const c=headerRow.getCell(i+1);
    c.value=h;
    c.font={bold:true,color:{argb:DARK}};
    c.alignment={vertical:"middle",horizontal:i>=6?"right":"left"};
    c.border={bottom:{style:"thin",color:{argb:"999999"}}};
  });
  headerRow.height=20;

  flat.forEach(({sup,r})=>{
    const unit=r.kg?"кг":"шт";
    const stk=r.kg?Math.round(r.stock*100)/100:r.stock;
    const row=ws.addRow([sup,r.sku||"",r.name,r.cat||"",r.abc||"",unit,stk,r.adj,r.orderQty]);
    row.getCell(7).numFmt=r.kg?"#,##0.00":"#,##0";
    row.getCell(9).numFmt=r.kg?"#,##0.00":"#,##0";
    row.font={color:{argb:DARK}};
  });

  ws.columns=[{width:34},{width:12},{width:38},{width:18},{width:7},{width:9},{width:11},{width:13},{width:12}];
  [7,8,9].forEach(ci=>{ws.getColumn(ci).alignment={horizontal:"right"};});

  const buf=await wb.xlsx.writeBuffer();
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([buf],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));
  a.download=`zakas_${new Date().toISOString().slice(0,10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(a.href);
}
async function exportNoaktivXLSX(){
  if(!ZITEMS||typeof ExcelJS==="undefined")return;
  let items=ZITEMS.filter(v=>v.signal==="muzlagan");
  if(zQuery)items=items.filter(v=>(v.name&&v.name.toLowerCase().includes(zQuery))||(v.sku&&String(v.sku).toLowerCase().includes(zQuery)));
  if(zF.cat)items=items.filter(v=>v.cat===zF.cat);
  if(zF.sub)items=items.filter(v=>v.sub===zF.sub);
  if(zF.sup)items=items.filter(v=>v.sup===zF.sup);
  if(zF.type)items=items.filter(v=>v.itype===zF.type);
  items.sort((a,b)=>(b.frozenVal||0)-(a.frozenVal||0));
  const totalFrozen=items.reduce((s,v)=>s+(v.frozenVal||0),0);

  const wb=new ExcelJS.Workbook();
  const ws=wb.addWorksheet("Noaktiv tovarlar",{views:[{state:"frozen",ySplit:5}]});
  const PURPLE="7C3AED",LIGHT="F3F0FF",DARK="3B2A6B";

  ws.mergeCells("A1:B1");
  ws.getCell("A1").value=`Jami muzlagan summa: ${Math.round(totalFrozen).toLocaleString("ru-RU")} so'm`;
  ws.getCell("A1").font={bold:true,size:13,color:{argb:DARK}};
  ws.getCell("A2").value=`Mahsulot soni: ${items.length} ta`;
  ws.getCell("A2").font={bold:true,size:11,color:{argb:"6B7280"}};
  ws.getCell("A3").value=`Holat: ${STOCK_ACTIVE_DAYS} kun ichida sotuv yo'q (${new Date().toLocaleDateString("uz-UZ")} holatiga)`;
  ws.getCell("A3").font={italic:true,size:10,color:{argb:"9CA3AF"}};

  const headerRow=ws.getRow(5);
  const headers=["SKU","Mahsulot nomi","Kategoriya","Kelish narxi","Sotilish narxi","Stok","Jami muzlagan summa","Oxirgi sotuv","Oxirgi kirim"];
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
    const laRecent=v.la&&((_now-new Date(v.la))/86400000)<=STOCK_ACTIVE_DAYS?v.la:"";
    const r=ws.addRow([v.sku||"",v.name,v.cat||"",Math.round(v.sp||0),Math.round(v.rp||0),v.stock,Math.round(v.frozenVal||0),STOCK_ACTIVE_DAYS+" kun ichida sotuv yo'q",laRecent]);
    r.getCell(4).numFmt='#,##0 "so\'m"';
    r.getCell(5).numFmt='#,##0 "so\'m"';
    r.getCell(6).numFmt=Number.isInteger(v.stock)?"#,##0":"#,##0.00";
    r.getCell(7).numFmt='#,##0 "so\'m"';
    r.getCell(7).font={bold:true,color:{argb:PURPLE}};
    r.getCell(8).font={color:{argb:"E24B4A"},italic:true};
    r.getCell(9).font={color:{argb:"0E7490"},bold:!!laRecent};
    if(i%2===1){for(let c=1;c<=9;c++)r.getCell(c).fill={type:"pattern",pattern:"solid",fgColor:{argb:LIGHT}};}
  });

  ws.columns=[{width:11},{width:42},{width:24},{width:15},{width:15},{width:11},{width:20},{width:24},{width:16}];
  ws.getColumn(4).alignment={horizontal:"right"};
  ws.getColumn(5).alignment={horizontal:"right"};
  ws.getColumn(6).alignment={horizontal:"right"};
  ws.getColumn(7).alignment={horizontal:"right"};
  ws.getColumn(9).alignment={horizontal:"right"};

  const buf=await wb.xlsx.writeBuffer();
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([buf],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));
  a.download=`noaktiv_tovarlar_${new Date().toISOString().slice(0,10)}.xlsx`;
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
function toggleSidebar(){
  document.body.classList.toggle("sb-collapsed");
  localStorage.setItem("tiin_sidebar",document.body.classList.contains("sb-collapsed")?"collapsed":"open");
}
async function showPage(btn){const _zb=document.getElementById("z-back");if(_zb)_zb.style.display="none";const _pb=document.getElementById("p5-back");if(_pb)_pb.style.display="none";document.querySelectorAll(".sb-item").forEach(b=>b.classList.remove("active"));btn.classList.add("active");document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));const pid=btn.dataset.page;curPageId=pid;document.getElementById(pid).classList.add("active");const _cr=document.getElementById("tb-crumb");if(_cr)_cr.textContent=btn.textContent.trim();const _tbdt=document.querySelector(".tb-dt");if(_tbdt)_tbdt.style.display=(pid==="p7"||pid==="p6")?"none":"";window.scrollTo(0,0);if(pid==="p2"&&!P2){let apiData=null;if(window.TiinDataAPI){try{apiData=await window.TiinDataAPI.bootstrap();}catch(e){apiData=null;}}P2=apiData&&apiData.products?apiData.products:JSON.parse(document.getElementById("p2data").textContent);initP2(apiData);}if(pid==="p3"&&!P3){P3=JSON.parse(document.getElementById("p3data").textContent);initP3();}if(pid==="p4"&&!P4){P4=JSON.parse(document.getElementById("p4data").textContent);initP4();}
if(pid==="p5"){if(!P2){P2=JSON.parse(document.getElementById("p2data").textContent);initP2(null);}if(!ZITEMS)_buildZItems();else renderZaxira();setTimeout(_zFitTableHeight,0);}
if(pid==="p7"){if(!P2){P2=JSON.parse(document.getElementById("p2data").textContent);initP2(null);}if(!ZITEMS)_buildZItems();renderZakas();}
if(pid==="p6"){if(!P2){P2=JSON.parse(document.getElementById("p2data").textContent);initP2(null);}if(!ZITEMS&&P2){_buildZItems();}if(!P6){P6=JSON.parse(document.getElementById("supplierdata").textContent);initP6();}setTimeout(_spFitTableHeight,0);}_applyPageRange(pid);};
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
async function zkOpenProduct(ri){
  const r=_ZK_ALLROWS[ri];if(!r)return;
  _zBackPage="p7";
  const p2btn=document.querySelector('.sb-item[data-page="p2"]');
  if(p2btn)await showPage(p2btn);
  if(!P2)return;
  let idx=-1;
  if(r.sku)idx=P2.findIndex(v=>String(v.sku||"")===String(r.sku));
  if(idx<0)idx=P2.findIndex(v=>v.name===r.name);
  const pq=document.getElementById("pf-q");
  if(pq){pq.value=idx>=0?P2[idx].name:r.name;if(typeof pfQToggle==="function")pfQToggle();if(typeof p2Filter==="function")p2Filter();}
  if(idx>=0&&typeof p2Open==="function")p2Open(P2[idx]._i!=null?P2[idx]._i:idx);
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
function _zClassify(d,stock,smartDaily,activeAvg){
  // d: kunlik miqdor massivi (range aktiv bo'lsa kesilgan)
  // smartDaily: aqlli velocity (retail + recency) — "daily"; activeAvg: savdo bo'lgan kunlarga bo'lingan o'rtacha
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
    // aqlli velocity (m.daily) + kunlik o'rtacha — dailydata'dan
    // 60 kunda kamida 15 kun sotilgan mahsulot: activeAvg (sotilgan kunlarga bo'lish)
    // seyrek mahsulot (<15 kun): calendarAvg (kalendar kunlarga bo'lish)
    let smartDaily=null, activeAvg=null;
    if(typeof dailyFor==="function"){const _di=dailyFor(v);if(_di&&_di.m){if(_di.m.daily!=null)smartDaily=_di.m.daily;const _ad=_di.m.activeDays||0;const _useAct=_ad>=8;if(_useAct&&_di.m.activeAvg!=null)activeAvg=_di.m.activeAvg;else if(_di.m.calendarAvg!=null)activeAvg=_di.m.calendarAvg;}}
    if(smartDaily==null&&v.da!=null)smartDaily=v.da;
    const c=_zClassify(d,stock,smartDaily,activeAvg);
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
      const sp=parseFloat(iv.sp||0),rp=parseFloat(iv.p||0);
      const price=sp||rp;const frozenVal=Math.round(stock*price);
      const la=iv.la||null;
      if(iv.ld60){
        // So'nggi 30 kunda emas, lekin 60 kunlik oynada sotilgan — "aktiv" tarafda, sekinlashgan
        const di60=Math.max(0,Math.round((_endRef-new Date(iv.ld60))/86400000));
        ZITEMS.push({_zi:ZITEMS.length,name:key,sku:iv.sku||"",abc:"",cat:iv.catTop||iv.cat||"",sup:iv.su||"",itype:iv.t||"",sub:iv.sb||"",rev:0,signal:"sekin",reason:"So'nggi 30 kunda sotilmagan, "+di60+" kun oldin sotilgan — sekinlashgan, kuzating",di:di60,dailyAvg:0,daysLeft:null,stock,wasGoodSeller:false,histRatio:0,frozenVal,price,sp,rp,la});
        return;
      }
      ZITEMS.push({_zi:ZITEMS.length,name:key,sku:iv.sku||"",abc:"",cat:iv.catTop||iv.cat||"",sup:iv.su||"",itype:iv.t||"",sub:iv.sb||"",rev:0,signal:"muzlagan",reason:STOCK_ACTIVE_DAYS+" kun ichida sotuv yo'q",di:999,dailyAvg:0,daysLeft:null,stock,wasGoodSeller:false,histRatio:0,frozenVal,price,sp,rp,la});
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
    const sigMap={kritik:["dot-kritik","Shoshilinch zakas"],tekshir:["dot-tekshir","Tekshirish kerak"],urgent:["dot-urgent","Tugashga yaqin"],excess:["dot-excess","Ortiqcha stok"],normal:["dot-normal","Normal"],sekin:["dot-sekin","Sekin sotiladi"],muzlagan:["dot-muzlagan","Muzlagan kapital"]};
    const[sigCls,sigTxt]=sigMap[v.signal]||["",""];
    const dailyTxt=(v.signal==="muzlagan"||v.signal==="sekin")?(v.price?(v.price.toLocaleString()+" so'm"):"—"):v.dailyAvg>0?(v.dailyAvg>=1?(Math.round(v.dailyAvg*10)/10):v.dailyAvg)+" ta/kun":"—";
    const _sel=v._zi===zLastZi;
    h+=`<tr class="z-row${_sel?" z-row-sel":""}"${_sel?' id="z-sel-row"':""} ondblclick="zToProduct(${v._zi})" title="Ikki marta bosing — mahsulot tahliliga o'tish"><td style="color:#bbb;font-size:11px">${rowOffset+i+1}</td><td><div class="z-name" title="${esc(v.name)}">${esc(v.name)}</div><div class="z-reason">${v.sku?`<span class="z-sku">${esc(v.sku)}</span>`:""}${esc(v.reason)}</div></td><td>${abcBadge}</td><td style="font-weight:600">${stockTxt}</td><td style="color:#888">${dailyTxt}</td><td>${barHtml}</td><td style="color:${diColor};font-size:12px">${diTxt}</td><td style="text-align:center"><span class="status-dot ${sigCls}" title="${esc(sigTxt)}"></span></td></tr>`;
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
function extractBuiltAt(html){
  const m=String(html||"").match(/"builtAt"\s*:\s*"([^"]+)"/);
  return m?m[1]:"";
}
function startFreshBuildWatcher(){
  const cur=(typeof P1FULL!=="undefined"&&P1FULL&&P1FULL.builtAt)||"";
  if(!cur||!window.fetch||window.__tiinBuildWatcher)return;
  window.__tiinBuildWatcher=true;
  let checking=false;
  const check=async()=>{
    if(checking||document.hidden)return;
    checking=true;
    try{
      const url=new URL(window.location.href);
      url.searchParams.set("_check",Date.now().toString());
      const res=await fetch(url.toString(),{cache:"no-store"});
      const latest=extractBuiltAt(await res.text());
      if(latest&&latest!==cur){
        const next=new URL(window.location.href);
        next.searchParams.delete("_check");
        next.searchParams.set("_v",Date.now().toString());
        window.location.replace(next.toString());
      }
    }catch(_){}
    checking=false;
  };
  setTimeout(check,30000);
  setInterval(check,5*60*1000);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)check();});
}
document.querySelectorAll(".lang-btn").forEach(b=>b.classList.toggle("active",b.dataset.lang===LANG));
applyI18n();
renderP1();
startFreshBuildWatcher();
curPageId="p1";if(P1FULL&&P1FULL.days>1)_applyPageRange("p1");  // har bo'lim o'z standart oralig'i: Bosh sahifa 7 kun, qolganlari 30 kun
// ── Sana oralig'i (date-range) ──
function dtToggle(e){if(e)e.stopPropagation();const p=document.getElementById("dt-pop");if(p)p.classList.toggle("open");}
document.addEventListener("click",function(e){const w=document.querySelector(".tb-dt");const p=document.getElementById("dt-pop");if(w&&p&&!w.contains(e.target))p.classList.remove("open");});
function _dtIdx(iso){return (P1FULL.dates||[]).indexOf(iso);}
function dtPreset(kind){const n=P1FULL.days;let a,b=n-1;if(kind==="all"){a=0;}else{a=Math.max(0,n-(+kind));}_dtApplyRange(a,b);const p=document.getElementById("dt-pop");if(p)p.classList.remove("open");}
function dtApply(){const s=document.getElementById("dt-start").value,e=document.getElementById("dt-end").value;let a=s?_dtIdx(s):0,b=e?_dtIdx(e):P1FULL.days-1;if(a<0)a=0;if(b<0)b=P1FULL.days-1;if(a>b){const t=a;a=b;b=t;}_dtApplyRange(a,b);const p=document.getElementById("dt-pop");if(p)p.classList.remove("open");}
function _pageDefaultRange(pid){const n=P1FULL?P1FULL.days:0;const grp=PAGE_GROUP[pid]||pid;const days=PAGE_DEFAULT_DAYS[grp]||30;return [Math.max(0,n-days),n-1];}
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
function p2Filter(){P2FF.forEach(f=>{const cur=p2gv(f.id);const opts=p2UniqWhere(f.k,f.id);p2RebuildSel(f.id,opts,cur);});["pf-cat","pf-amt","pf-abc"].forEach(id=>{const e=document.getElementById(id);e.className=e.value?"on":"";});const q=document.getElementById("pf-q").value.trim().toLowerCase();p2rows=P2.filter(v=>{if(!v.sku)return false;if(_rangeActive()&&(v.qty||0)<=0)return false;if(!p2Match(v,null))return false;if(q&&!v.name.toLowerCase().includes(q)&&!String(v.sku||"").includes(q))return false;return true;});p2page=1;document.getElementById("pf-cnt").textContent=p2rows.length.toLocaleString()+" "+t("p2_cnt_suffix");renderP2Table();}
function renderP2Table(){const tb=document.getElementById("pf-tbody");const ro=(p2page-1)*P2PS;const pg=p2rows.slice(ro,ro+P2PS);if(!pg.length){tb.innerHTML='<tr><td colspan="9" style="text-align:center;padding:34px;color:#bbb">'+t("p2_not_found")+'</td></tr>';document.getElementById("pf-pag").innerHTML="";return;}const END=new Date((DMETA&&DMETA.end)?DMETA.end:'2026-05-31');let h="";pg.forEach((v,i)=>{const abc=v.abc||"";let di=v.di;if(di===undefined||di===null){if(v.ld){const d=new Date(v.ld);di=Math.max(0,Math.round((END-d)/86400000));}else{di=999;}}const[sc,stTxt]=sotuv(di);const price=v.iprice||0;const suprice=v.suprice||0;const priceCell=price?price.toLocaleString()+" so'm"+(suprice?'<div style="font-size:10px;color:#999;margin-top:1px">'+t("kelish_lc")+': '+suprice.toLocaleString()+" so'm</div>":""):"—";h+=`<tr data-pi="${v._i}" onclick="p2RowClick(${v._i})" title="Ikki marta bosing — Zaxirada koʻrish"><td style="color:#bbb">${ro+i+1}</td><td style="max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600" title="${esc(v.name)}">${esc(v.name)}${v.kg&&!v.name.toLowerCase().includes('kg')?' <span class="sug-kg">KG</span>':''}</td><td style="color:#999">${v.sku||"—"}</td><td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#777" title="${esc(v.cat||"")}">${esc(v.cat||"—")}</td><td style="color:#888;white-space:nowrap">${esc(v.itype||"—")}</td><td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#888" title="${esc(v.sup||"")}">${esc(v.sup||"—")}</td><td style="white-space:nowrap">${priceCell}</td><td><span class="badge ${sc}">${stTxt}</span></td><td>${abc?'<span class="p2-abc p2-abc-'+abc+'">'+abc+'</span>':'—'}</td></tr>`;});tb.innerHTML=h;renderP2Pag();}
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
function renderTable3(rows){const q=document.getElementById("srch3").value.toLowerCase().trim();let filtered=rows;if(q){filtered=P3.filter(v=>!v._off&&v.name.toLowerCase().includes(q));if(filtered.length>0){const fv=filtered[0];const tt=fv.sub==="C1"?"C1":fv.abc;if(tt!==curTab3){curTab3=tt;document.querySelectorAll(".atab").forEach(b=>b.className="atab");document.querySelectorAll(".atab").forEach(b=>{if(b.dataset.tab===tt)b.className="atab sel-"+tt;});curRows3=getRows3(tt);}}}document.getElementById("tcnt").textContent=filtered.length.toLocaleString()+" "+t("p2_cnt_suffix");const max=Math.min(filtered.length,500);const rows2=[];for(let i=0;i<max;i++){const v=filtered[i];const idx=P3.indexOf(v);const[sc,st]=sotuv(v.di);const sub=v.sub?'<span class="badge '+(v.sub==="C1"?"b-c1":v.sub==="C2"?"b-c2":"b-c3")+'">'+v.sub+"</span>":"";rows2.push('<tr data-idx="'+idx+'" onclick="showDetail3('+idx+')"><td style="color:#bbb;">'+v.r+'</td><td style="font-weight:500;">'+esc(v.name)+'</td><td style="color:#888;">'+esc(v.cat.substring(0,20))+'</td><td style="font-weight:700;color:#1D9E75;">'+fmt(v.rev)+'</td><td>'+v.rec.toLocaleString()+'</td><td style="color:'+(v.di>7?"#E24B4A":"#1D9E75")+';">'+v.ld+'</td><td><span class="badge '+sc+'">'+st+'</span></td><td><span class="badge b-'+v.abc+'">'+v.abc+'</span></td></tr>');}if(!rows2.length)rows2.push('<tr><td colspan="8" style="text-align:center;padding:20px;color:#bbb;">'+t("topilmadi")+'</td></tr>');document.getElementById("tbody3").innerHTML=rows2.join("");document.getElementById("detail3").style.display="none";}
function setTab(btn){const tab=btn.dataset.tab;curTab3=tab;document.querySelectorAll(".atab").forEach(b=>b.className="atab");btn.className="atab sel-"+tab;document.getElementById("srch3").value="";curRows3=getRows3(tab);renderTable3(curRows3);}
function filterTable(){renderTable3(curRows3);}
function showDetail3(idx){const v=P3[idx];if(!v)return;const u=v.kg?"kg":"dona";const[sc,st]=sotuv(v.di);document.querySelectorAll("tr.sel").forEach(r=>r.classList.remove("sel"));const row=document.querySelector('tr[data-idx="'+idx+'"]');if(row){row.classList.add("sel");row.scrollIntoView({block:"nearest"});}document.getElementById("d3-name").textContent=v.name;document.getElementById("detail3").className="detail d"+v.abc;let bdg='<span class="badge b-'+v.abc+'" style="font-size:11px;padding:3px 9px;">'+v.abc+' guruh</span>';if(v.sub){const sc2=v.sub==="C1"?"b-c1":v.sub==="C2"?"b-c2":"b-c3";bdg+=' <span class="badge '+sc2+'" style="font-size:11px;padding:3px 9px;">'+v.sub+'</span>';}if(v.kg)bdg+=' <span class="badge" style="background:#EAF3DE;color:#27500A;font-size:11px;padding:3px 9px;">'+t("kg_tovar")+'</span>';document.getElementById("d3-badges").innerHTML=bdg;document.getElementById("d3-stats").innerHTML='<div class="ds"><div class="ds-l">'+t("jami_tushum")+'</div><div class="ds-v" style="color:#1D9E75;">'+fmt(v.rev)+' UZS</div></div><div class="ds"><div class="ds-l">'+t("narxi_1")+' '+u+')</div><div class="ds-v">'+v.p.toLocaleString()+' UZS</div></div><div class="ds"><div class="ds-l">'+t("cheklar_soni")+'</div><div class="ds-v">'+v.rec.toLocaleString()+'</div></div><div class="ds"><div class="ds-l">'+t("tushum_ulushi")+'</div><div class="ds-v">'+v.rp.toFixed(3)+'%</div></div><div class="ds"><div class="ds-l">'+t("oxirgi_sotilgan")+'</div><div class="ds-v" style="color:'+(v.di>7?"#E24B4A":"#1D9E75")+';">'+v.ld+'</div></div><div class="ds"><div class="ds-l">'+t("th_sotuv_holati2")+'</div><div class="ds-v"><span class="badge '+sc+'">'+st+'</span></div></div><div class="ds"><div class="ds-l">'+t("kunlik_ortacha")+'</div><div class="ds-v">'+(v.qty/((DMETA&&DMETA.days)||31)).toFixed(v.kg?2:1)+' '+u+'</div></div><div class="ds"><div class="ds-l">'+t("jami_sotilgan")+'</div><div class="ds-v">'+v.qty.toFixed(v.kg?2:0)+' '+u+'</div></div>';const why=(v.why||[]).map(w=>'<div class="bx-item"><div class="bx-dot"></div><div class="bx-txt">'+esc(w)+'</div></div>').join("");const how=(v.how||[]).map((h,i)=>'<div class="bx-item"><div class="bx-num">'+(i+1)+'.</div><div class="bx-txt">'+esc(h)+'</div></div>').join("");document.getElementById("d3-ra").innerHTML='<div class="box bx-why"><div class="bx-t">'+t("nega_guruhda")+' '+v.abc+' '+t("guruhda_savol")+'</div>'+why+'</div><div class="box bx-'+v.abc+'"><div class="bx-t">'+t("nima_qk")+'</div>'+how+'</div>';const dw=document.getElementById("detail3");dw.style.display="block";setTimeout(()=>dw.scrollIntoView({behavior:"smooth",block:"nearest"}),50);}
function p2FCount(){const ids=["pf-cat","pf-sub","pf-type","pf-sup","pf-amt","pf-abc"];let n=0;ids.forEach(id=>{const e=document.getElementById(id);if(e&&e.value)n++;});const b=document.getElementById("p2-fcount");if(b)b.textContent=n?"("+n+")":"";const btn=document.getElementById("p2-fbtn");if(btn)btn.classList.toggle("has",n>0);}
function p2FToggle(e){if(e)e.stopPropagation();const p=document.getElementById("p2-fpop");if(p)p.classList.toggle("open");p2FCount();}
document.addEventListener("click",function(e){const w=document.querySelector(".p2-fwrap");const p=document.getElementById("p2-fpop");if(w&&p&&!w.contains(e.target))p.classList.remove("open");});
document.addEventListener("click",function(e){const b=document.getElementById("z-fbtn");const p=document.getElementById("z-fpop");if(b&&p&&!b.contains(e.target)&&!p.contains(e.target))p.classList.remove("open")   ;});
document.addEventListener("click",function(e){const dd=document.getElementById("sp-month-dd");if(dd&&!dd.contains(e.target))dd.classList.remove("open");});

// ─── P6 Supplier Tahlili ───
function initP6(){
  if(!P6)return;
  if(p6CardMonth==null)p6CardMonth=p6LatestMonthIndex();
  renderP6();
}
function p6SetFilter(f){
  p6CurF=f;p6Page=1;p6SelI=null;p6SelMonth=null;
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
function p6Select(r){
  if(p6SelI===r){p6SelI=null;p6SelMonth=null;}
  else{
    p6SelI=r;
    const s=P6.suppliers.find(x=>x.r===r);
    let mi=p6CardMonth;
    if(!(s&&s.months&&s.months[mi])&&s&&s.months){for(let i=s.months.length-1;i>=0;i--){if(s.months[i]){mi=i;break;}}}
    p6SelMonth=mi;
  }
  renderP6();
}
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
const P6_MONTH_KEYS=["sp_mon_yan","sp_mon_fev","sp_mon_mar","sp_mon_apr","sp_mon_may","sp_mon_iyun"];
function P6_MONTHS_NOW(){return P6_MONTH_KEYS.map(k=>t(k));}
function p6LatestMonthIndex(){
  if(!P6||!P6.suppliers)return P6_MONTH_KEYS.length-1;
  for(let i=P6_MONTH_KEYS.length-1;i>=0;i--){
    if(P6.suppliers.some(s=>s.months&&s.months[i]))return i;
  }
  return P6_MONTH_KEYS.length-1;
}
function p6MonthEntry(s){return s&&s.months&&p6CardMonth!=null?s.months[p6CardMonth]:null;}
function p6MonthAbc(s){const me=p6MonthEntry(s);return me?me.abc:s.abc;}
function p6MonthItems(){
  return (P6&&P6.suppliers?P6.suppliers:[]).filter(s=>p6MonthEntry(s));
}
function p6SetCardMonth(mi){
  p6CardMonth=mi;p6Page=1;p6SelI=null;p6SelMonth=null;renderP6();
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
function p6SelectMonth(r,mi){
  p6CardMonth=mi;
  if(p6SelI===r&&p6SelMonth===mi){p6SelI=null;p6SelMonth=null;}
  else{p6SelI=r;p6SelMonth=mi;}
  renderP6();
}
function renderP6(){
  if(!P6)return;
  ensureSupplierProductTableStyles();
  if(p6CardMonth==null)p6CardMonth=p6LatestMonthIndex();
  renderP6MonthControls();
  renderP6Cards();
  let items=p6MonthItems();
  if(p6CurF!=="all")items=items.filter(s=>p6MonthAbc(s)===p6CurF);
  if(p6Q)items=items.filter(s=>s.name.toLowerCase().includes(p6Q));
  const cnt=document.getElementById("sp-cnt");if(cnt)cnt.textContent=items.length.toLocaleString()+" "+t("sp_cnt_suffix");
  const totalP=Math.max(1,Math.ceil(items.length/P6PS));
  if(p6Page>totalP)p6Page=totalP;
  const off=(p6Page-1)*P6PS;
  const shown=items.slice(off,off+P6PS);
  const mzMap={};
  if(ZITEMS){ZITEMS.filter(v=>v.signal==="muzlagan").forEach(v=>{if(v.sup)mzMap[v.sup]=(mzMap[v.sup]||0)+1;});}
  let h="";
  shown.forEach((s,i)=>{
    const isSel=p6SelI===s.r;
    const selStyle=isSel?" sp-row-sel":"";
    h+=`<tr class="sp-row${selStyle}" onclick="p6Select(${s.r})">`;
    h+=`<td style="color:#bbb;font-size:11px;text-align:center">${off+i+1}</td>`;
    h+=`<td><div class="sp-name" title="${esc(s.name)}">${esc(s.name)}</div></td>`;
    P6_MONTH_KEYS.forEach((_,mi)=>{
      const me=s.months&&s.months[mi];
      const isCellSel=isSel&&p6SelMonth===mi;
      if(me){
        h+=`<td style="text-align:center"><button class="sp-month-chip sp-abc-${me.abc.toLowerCase()}${isCellSel?" sp-month-active":""}" onclick="event.stopPropagation();p6SelectMonth(${s.r},${mi})">${me.abc}</button></td>`;
      }else{
        h+=`<td style="text-align:center"><button class="sp-month-chip sp-month-empty${isCellSel?" sp-month-active":""}" onclick="event.stopPropagation();p6SelectMonth(${s.r},${mi})">—</button></td>`;
      }
    });
    h+=`</tr>`;
    if(isSel){
      let detH;
      const me=s.months&&s.months[p6SelMonth];
      if(me){
        const abc=me.abc;
        const barC=abc==="A"?"#1D9E75":abc==="B"?"#534AB7":"#EF9F27";
        const monthMax=Math.max(1,...P6.suppliers.map(x=>(x.months&&x.months[p6SelMonth]&&x.months[p6SelMonth].rev)||0));
        const pct=Math.min(100,Math.round(me.rev/monthMax*100));
        const revStr=me.rev>=1e9?(me.rev/1e9).toFixed(2)+" mlrd":me.rev>=1e6?Math.round(me.rev/1e6)+" mln":me.rev.toLocaleString();
        const aB=`<span class="sp-mc sp-mc-a">${me.abc_cnt.A||0}A</span>`;
        const bB=`<span class="sp-mc sp-mc-b">${me.abc_cnt.B||0}B</span>`;
        const cB=`<span class="sp-mc sp-mc-c">${me.abc_cnt.C||0}C</span>`;
        const mzTxt=(mzMap[s.name]||0)>0?`<div class="sp-det-stat"><div class="sp-det-stat-lbl">${t("sp_stat_sotilmay")}</div><div class="sp-det-stat-val">&#x1F4A4; ${mzMap[s.name]} ${t("sp_ta")}</div></div>`:"";
        const monthNow=t(P6_MONTH_KEYS[p6SelMonth]);
        detH=`<div class="sp-det-month">${t("sp_det_month").replace("{month}",monthNow)}</div><div class="sp-det-stats">
<div class="sp-det-stat"><div class="sp-det-stat-lbl">${t("sp_stat_tushum")}</div><div class="sp-det-stat-val">${revStr}</div></div>
<div class="sp-det-stat"><div class="sp-det-stat-lbl">${t("sp_stat_hissa")}</div><div class="sp-det-stat-val">${me.rp}%<div class="sp-det-bar"><div class="sp-det-bar-fill" style="width:${pct}%;background:${barC}"></div></div></div></div>
<div class="sp-det-stat"><div class="sp-det-stat-lbl">${t("sp_stat_tovarlar")}</div><div class="sp-det-stat-val">${me.cnt} ${t("sp_ta")} <span style="display:inline-flex;gap:4px;margin-left:6px">${aB}${bB}${cB}</span></div></div>
<div class="sp-det-stat"><div class="sp-det-stat-lbl">${t("sp_stat_cheklar")}</div><div class="sp-det-stat-val">${(me.rec||0).toLocaleString()}</div></div>
${mzTxt}
</div>`;
        const supAll=me.top||[];
        if(supAll.length){
          const money=v=>(v||0)>=1e6?Math.round((v||0)/1e6)+" mln so'm":(v||0).toLocaleString()+" so'm";
          const topH=supAll.map((t2,ti)=>`<tr><td>${ti+1}</td><td><div class="sp-prod-name" title="${esc(t2.name)}">${esc(t2.name)}</div></td><td>${esc(t2.sku||"")}</td><td>${money(t2.rev)}</td><td>${(t2.rec||0).toLocaleString()}</td><td><span class="p2-abc p2-abc-${t2.abc}">${t2.abc||"—"}</span></td></tr>`).join("");
          detH+=`<div class="sp-det-title" style="margin-top:10px">📦 ${t("sp_all_products").replace("{n}",supAll.length)}</div><div class="sp-prod-scroll"><table class="sp-prod-table"><thead><tr><th>#</th><th>${t("sp_prod_name")}</th><th>${t("sp_prod_sku")}</th><th>${t("sp_prod_revenue")}</th><th>${t("sp_prod_receipts")}</th><th>${t("sp_prod_abc")}</th></tr></thead><tbody>${topH}</tbody></table></div>`;
        }
      }else{
        detH=`<div class="sp-det-empty">${t("sp_det_empty").replace("{month}",p6SelMonth!=null?t(P6_MONTH_KEYS[p6SelMonth]):"")}</div>`;
      }
      h+=`<tr class="sp-det-row"><td colspan="8"><div class="sp-det-wrap">${detH}</div></td></tr>`;
    }
  });
  if(!h)h=`<tr><td colspan="8" style="text-align:center;padding:40px;color:#bbb">${t("sp_topilmadi")}</td></tr>`;
  document.getElementById("sp-tbody").innerHTML=h;
  renderP6Pag(totalP);
}
function ensureSupplierProductTableStyles(){
  if(document.getElementById("sp-prod-table-style"))return;
  const st=document.createElement("style");
  st.id="sp-prod-table-style";
  st.textContent=`.sp-month-tabs{display:flex;align-items:center;gap:8px;padding:0 24px 6px;position:relative}.sp-month-tabs-label{font-size:11px;font-weight:700;color:#7b8494}.sp-month-dd{position:relative}.sp-month-current{height:30px;min-width:92px;padding:0 12px;border:1.5px solid #1D9E75;border-radius:18px;background:#1D9E75;color:#fff;font-size:12px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:8px}.sp-month-current:after{content:"";border-left:4px solid transparent;border-right:4px solid transparent;border-top:5px solid currentColor;margin-top:2px}.sp-month-menu{display:none;position:absolute;top:36px;left:0;z-index:30;background:#fff;border:1px solid #e5e7eb;border-radius:9px;box-shadow:0 12px 28px rgba(15,23,42,.16);padding:5px;min-width:110px}.sp-month-dd.open .sp-month-menu{display:block}.sp-month-option{width:100%;height:30px;border:0;background:#fff;border-radius:7px;color:#374151;font-size:12px;font-weight:600;cursor:pointer;text-align:left;padding:0 10px}.sp-month-option:hover{background:#f0fdf4;color:#0D7A55}.sp-month-option.active{background:#E1F5EE;color:#085041}.sp-det-wrap{max-width:1120px!important;margin-right:24px}.sp-prod-scroll{max-height:380px;overflow:auto;border:1px solid #eee;border-radius:8px;background:#fff}.sp-prod-table{width:100%;min-width:760px;border-collapse:collapse;font-size:11px}.sp-prod-table th{position:sticky;top:0;z-index:1;background:#fafaf5;color:#888;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.3px;text-align:left;padding:8px 10px;border-bottom:1px solid #eee;white-space:nowrap}.sp-prod-table td{padding:7px 10px!important;border-bottom:1px solid #f0f0ec!important;vertical-align:middle;color:#333}.sp-prod-table tbody tr:hover td{background:#fff8eb}.sp-prod-table th:first-child,.sp-prod-table td:first-child{width:42px;text-align:center;color:#999}.sp-prod-table th:nth-child(3),.sp-prod-table td:nth-child(3){width:90px;color:#777;font-family:monospace}.sp-prod-table th:nth-child(4),.sp-prod-table td:nth-child(4){width:130px;font-weight:700;white-space:nowrap}.sp-prod-table th:nth-child(5),.sp-prod-table td:nth-child(5){width:70px;text-align:right;white-space:nowrap}.sp-prod-table th:nth-child(6),.sp-prod-table td:nth-child(6){width:54px;text-align:center}.sp-prod-name{font-weight:600;white-space:normal;line-height:1.25}`;
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
  wrap.innerHTML=`<span class="sp-month-tabs-label">${t("sp_month_select")}:</span><div class="sp-month-dd" id="sp-month-dd"><button class="sp-month-current" type="button" onclick="p6ToggleMonthMenu(event)">${active}</button><div class="sp-month-menu">`+
    names.map((m,i)=>`<button class="sp-month-option ${i===p6CardMonth?"active":""}" type="button" onclick="p6PickCardMonth(${i},event)">${m}</button>`).join("")+
    `</div></div>`;
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
