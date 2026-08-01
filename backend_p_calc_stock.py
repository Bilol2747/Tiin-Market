"""
Buyurtma (Zakas) sahifasi uchun "Hisoblangan stok" — Invan ko'rsatgan qoldiqdan
MUSTAQIL, kirim (data_kirim.json) + sotuv (data_history.json + data_sales_2025h2.json)
oqimidan qayta tiklangan haqiqiy qoldiq.

--- Nega kerak ---
Invan qoldig'i ko'p tovarda haqiqiy javondagi miqdorga to'g'ri kelmaydi (rahbarlar
shikoyati, 2026-07-28: "stokni yo'q deb hisobga olib qaytadan hisoblab chiqinglar").

--- Usul (GIBRID v3 — 2026-07-28, chuqur tahlil va jismoniy tekshiruv bilan
tasdiqlangan; eski drought-anchor usulini TO'LIQ almashtiradi) ---

1. CLAMP MODELI: har tovar uchun birinchi (kirim tarixidagi eng erta) kirimdan
   boshlab market BO'SH deb olinadi. Har kun: balans += kirim - sotuv. Balans
   manfiyga tushsa - bu "ko'rinmas (hisobga olinmagan) zaxira" borligining
   belgisi - keyingi kirimgacha 0'GA QAYTARILADI. Natija HECH QACHON manfiy
   chiqmaydi (matematik kafolat).

2. GIBRID (2026-only vs 2025-07-01 dan): sof 1-yanvar(2026)dan boshlab hisoblash
   ko'p tovarda "kam ko'rsatish" xatosiga olib keladi - chunki 2025-yilda kelgan
   va hali tugamagan zaxira ko'rinmay qoladi. Buni tuzatish uchun 2 ta DALILGA
   asoslangan signal tekshiriladi:
     - signal1: 2025-07-01dan hisoblaganda ham hali "birinchi kirimdan OLDIN"
       sotuv bor (ya'ni 6 oy orqaga borish HAM yetarli emasligi isboti)
     - signal2: 2026-only model natijasi 0, LEKIN oxirgi 60 kunda xom sotuv
       >=5 dona (ya'ni tovar hali ham faol sotiladi - "0" ishonchsiz)
   Ikkalasidan biri bo'lsa - tovar "MUAMMOLI", natija 2025-07-01dan (6 oy
   qo'shimcha tarix bilan) hisoblanadi. Aks holda "MUAMMOSIZ" - sof 2026-model
   saqlanadi (qo'shimcha tarixga hojat yo'q, ziddiyat topilmagan).

3. ISHONCH DARAJASI (frontendning mavjud rang-kodlashi bilan mos):
     - "yuqori" (yashil)  - muammosiz, 2026-model o'zi bilan ziddiyatsiz
     - "o'rta"  (sariq)   - muammoli, 2025-07 bilan tuzatildi
     - "eskirgan" (kulrang) - eng yaxshi urinishdan keyin ham natija=0, lekin
       xom sotuv hali bor - bu BILINGAN, tuzatib bo'lmaydigan qoldiq (kirim
       ma'lumoti butun davr davomida sotuvdan orqada qoladi - masalan ba'zi
       tez-tez yetkaziladigan tovarlarda kirim hujjatlari to'liq emas).
       Foydalanuvchiga "bunga to'liq ishonma" signali.

--- Doirasi (foydalanuvchi qarori bilan ATAYLAB tashqarida qoldirilganlar) ---
- Faqat 2026-yilda kamida bitta Received kirimi bor ACTIVE tovarlar hisoblanadi
  ("target populyatsiya" - Zakas'da haqiqatan kerak bo'ladigan tovarlar).
- "Shubhali kirim" (Invan'da bitta g'ayrioddiy katta yozuv, boshqalaridan 15x+)
  uchun maxsus ishlov QO'LLANILMAYDI - foydalanuvchi buni ataylab shunday
  qoldirishga qaror qildi (2026-07-28).

Bu hisob HAR build'da (har ~30 daqiqada) qayta ishlaydi, KESHLANMAYDI - shu
bilan doim eng yangi kirim/sotuvni hisobga oladi. data_sales_2025h2.json esa
STATIK (bir martalik, Invan API'dan qo'lda yuklangan - fetch_historical_sales.py
qarang) - 2025-yil 2-yarim yilligi o'zgarmaydi, shuning uchun qayta yuklanmaydi.

build_avg30sa()/build_prev_avg()/build_current_cost()dan MUSTAQIL - bittasi
xato bersa boshqalariga ta'sir qilmaydi. Natija data_inv_new.json ga qo'llanadi:
calcStock, calcConf, calcEvidence (necha marta 0'ga qaytarilgani), calcAnchor
(ishlatilgan modelning nol-nuqta sanasi). Frontend (sales_runtime.js) bularni
Invan stok yoniga ko'rsatib, foydalanuvchi har tovar uchun alohida qaysi son
bilan zakas hisoblanishini tanlaydi - bu modul FAQAT ma'lumot tayyorlaydi,
zakas formulasining o'ziga (qulflangan) mutlaqo tegmaydi.
"""
import json
from datetime import date, datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).parent

WINDOW_2025H2_START = date(2025, 7, 1)   # data_sales_2025h2.json shu sanadan boshlanadi
LAST60_DAYS = 60
LAST60_MIN_UNITS = 5                      # signal2/eskirish uchun "hali faol sotiladi" chegarasi

# --- "TUGAB QOLGAN" (pauza) testi sozlamalari, 2026-07-29 ---
PAUSE_LOOKBACK = 90       # sotuv tezligini o'lchash oynasi (kun)
# To'xtash oldidagi QISQA oyna. Uzoq o'rtacha "jadal sotilib turib birdan
# to'xtagan" tovarni yashiradi: SKU 2687 (makaron) 90-kunlik o'rtachada
# 0.49 dona/kun, lekin to'xtash oldidagi 21 kunda 1.36 dona/kun sotilgan -
# 24 dona zaxira 49 kunga emas, 18 kunga yetardi. Tezlik sifatida ikkalasining
# KATTAROG'I olinadi (2026-07-29, foydalanuvchi topilmasi).
PAUSE_RECENT_WIN = 21
# Jimlik TASODIFAN bo'lish ehtimoli chegarasi. Asosiy dalil - "zaxira qoplamasi"
# testi (pauza > zaxira/kunlik_sotuv); bu esa qo'shimcha xavfsizlik chorasi.
# 0.05 juda qattiq edi: SEKIN sotiladigan tovarda (non 38008 - kuniga 0.18 dona)
# 16 kunlik jimlikning "tabiiy" ehtimoli 0.185 bo'lib, jismonan TASDIQLANGAN
# tugash holatini bloklab qo'yardi. 0.25 da 4/4 tasdiqlangan holat to'g'ri
# chiqadi va sekin/mavsumiy tovar (Nescafe 2496) baribir himoyalangan qoladi -
# uni qoplama testi ushlab turadi (8 kun jimlik / 678 kunlik zaxira).
PAUSE_P_MAX = 0.25
PAUSE_MIN_RATIO = 2.0     # jimlik qoplamadan necha barobar uzun bo'lsa ishonchli
PAUSE_STRONG_RATIO = 5.0  # shundan yuqorisi "yuqori" ishonch

# --- UZOQ JIMLIK qoidasi (zaxira raqamiga BOG'LIQ EMAS), 2026-07-29 ---
# Yuqoridagi "qoplama" testining ko'r nuqtasi: agar hisoblangan qoldiq XATO
# ravishda juda katta bo'lsa (Invan'dagi bitta noto'g'ri kirim yozuvi sabab -
# masalan SKU 9293 qahva: odatda 480 keladi, bir marta 294,600 deb yozilgan),
# qoplama yillar bilan o'lchanadi va jimlik hech qachon "uzun" chiqmaydi.
# Ya'ni xato kirim o'zini o'zi himoya qiladi. Real ma'lumotda 676 tovar shunday.
#
# Foydalanuvchi mantiqi (2026-07-29): "anchadan beri sotilmayotganini ko'rsang
# bo'ladiku" - uzoq jimlikning o'zi, qoldiq nechta deb yozilganidan qat'i nazar,
# dalil bo'lishi kerak.
#
# Chegara real ma'lumotda tanlangan: 60 kun Nescafe 2496 ni buzardi (uning
# tarixiy 64 kunlik HAQIQIY pauzasi bor), 120 kun esa 9293 ni o'tkazib
# yuborardi. 90 kun + tabiiy pauzadan 3x uzunlik - 5/5 tasdiqlangan tovarda
# to'g'ri ishlaydi.
PAUSE_STALE_DAYS = 90     # mutlaq chegara (kun)
PAUSE_STALE_MULT = 3.0    # tovarning o'z tabiiy pauzasidan necha barobar uzun

# --- SOTILMAGAN tovarlar qoidasi (2026-07-30, foydalanuvchi qarori) ---
# 2026 da BITTA HAM sotuv yozuvi yo'q tovarlar. Ular asosiy hisobga umuman
# tushmaydi (data_history.json faqat 2026 da sotilgan tovarni saqlaydi),
# shuning uchun saytda "—" bo'lib turadi va zakas Invan soniga tayanadi -
# Invan esa bunday tovarlarda ko'pincha arvoh qoldiq ko'rsatadi.
#
# Qoida: oxirgi kirimdan 60+ kun o'tgan VA 2026 da bitta ham sotilmagan
# bo'lsa -> stok 0.
#
# Ikki xil holatni qamraydi (ikkalasi ham foydalanuvchi qarori bilan):
#   1. UMUMAN sotilmagan (2025 ham, 2026 ham) - 271 ta. Ko'pchiligi umuman
#      sotiladigan tovar emas ("salafan 20x30", "termobumaga", "flakon" kabi
#      ICHKI SARF materiallari - kassada skanerlanmaydi, "sotuv" ko'rinmaydi).
#   2. 2025 da sotilgan, 2026 da YO'Q - 1,825 ta. Eskirgan assortiment:
#      7-10 oydan beri jim, Invan'dagi qoldiq arvoh (jami atigi ~3,100 dona).
#
# 60 kun tanlandi (30/45/60/90 solishtirilgandan keyin): 30 kun yaqinda kelgan
# tovarni noto'g'ri 0 qilib yuborardi (masalan 7 kun oldin 3,600 dona kelgan
# borjomi), 90 kun esa juda ko'pini chetda qoldirardi.
# YAQINDA kelganlarga TEGILMAYDI - ularda "—" qoladi, chunki tovar hali
# sotilishga ulgurmagan bo'lishi mumkin. Vaqt o'tib sotilmasa, o'zi shu
# qoidaga tushadi. Kirim kelsa - hisob avtomatik ko'tariladi (mavsumiy
# tovar himoyasi).
NOSALE_STALE_DAYS = 60

# --- ESKIRGAN ASSORTIMENT qoidasi (2026-07-30, foydalanuvchi qarori) ---
# 2026 da sotilgan, LEKIN 2026 da bironta kirim OLMAGAN tovarlar. Ular ham
# asosiy hisobga tushmaydi (u yerda "2026 da kamida bitta kirim" sharti bor),
# shuning uchun saytda "—" bo'lib turadi.
#
# Qoida: 2026 da kirimi yo'q + oxirgi sotuvdan 90+ kun o'tgan -> stok 0.
# Mantiq: yangi kirim kelmagan va 3 oydan beri sotilmagan bo'lsa, eski zaxira
# tugagan deb qaraladi (masalan "qorbobo maskasi" - yangi yil tovari, Invan
# 2,401 dona deydi; "bir martalik idish 750ml" - oxirgi kirim bir yil oldin,
# Invan 3,908 dona deydi).
#
# 3 oydan KAM jim turganlarga TEGILMAYDI (hali faol bo'lishi mumkin).
STALE_ASSORT_DAYS = 90

# Kirim yozuvi UMUMAN yo'q tovarlar uchun alohida, YUMSHOQROQ chegara.
# Ularda hisoblash uchun boshlang'ich nuqta yo'q (kirim qachon/qancha
# bo'lgani noma'lum), shuning uchun xulosa chiqarish qiyinroq -
# foydalanuvchi qarori bilan 6 oy (2026-07-30).
NOKIRIM_STALE_DAYS = 180

# TABIIY TANAFFUS HIMOYASI (2026-07-30, foydalanuvchi topilmasi).
# Yuqoridagi 90 kunlik chegara OZIQ-OVQAT BO'LMAGAN tovarda xato ishlaydi:
# kanselyariya, o'yinchoq, izolenta, choynak, mavsumiy krem kabi buyumlar
# tabiatan oylab turadi va keyin sotiladi. Real ma'lumotda 171 ta shunday
# tovar noto'g'ri 0 qilingan edi - 62 tasida hozirgi jimlik ularning O'Z
# eng uzun tanaffusidan hatto KICHIK edi (masalan shampun: 91 kun jim,
# lekin tarixda 229 kunlik tanaffusi bor).
#
# Shuning uchun OZIQ-OVQAT BO'LMAGAN tovarga qo'shimcha shart: jimlik uning
# o'z eng uzun tanaffusidan STALE_ASSORT_GAP_MULT barobar uzun bo'lishi kerak.
# OZIQ-OVQAT (va suv/ichimlik) bunday himoyasiz - ular saqlanmaydi, uzoq
# jimlik ularda haqiqatan tugaganni bildiradi (foydalanuvchi qarori).
STALE_ASSORT_GAP_MULT = 1.5

# --- JIM QOLDIQ qoidasi (2026-07-30, foydalanuvchi qarori) ---
# Asosiy pauza modeli aralashmagan ("oddiy") tovarlar orasida ham shubhali
# holat qoladi: hisob 0 dan katta, LEKIN uzoq vaqt na SOTUV, na KIRIM bo'lgan.
#
# Foydalanuvchi topilmasi: faqat sotuv jimligiga qarash YETARLI EMAS - 140 ta
# tovar uzoq sotilmagan bo'lsa-da, YAQINDA kirim olgan (masalan "konfet
# марсианка": 147 kun jim, ammo bugun 96 dona kelgan). Ularda tovar javonda
# BOR, shubha yo'q. Shuning uchun IKKALA shart birga talab qilinadi.
#
# Qoida: hisob>0 + 90+ kun sotuv yo'q + 90+ kun kirim yo'q -> stok 0.
# Oziq-ovqat bo'lmaganlarda tabiiy tanaffus himoyasi bu yerda ham ishlaydi.
QUIET_STOCK_DAYS = 90

# Oziq-ovqat kategoriyalari (data_inv_new.json'dagi catTop maydoni).
FOOD_CATEGORIES = {
    "Торты и сладости", "Замороженные Продукты", "Вода и Напитки", "Чай/Кофе",
    "Бакалея", "Яйца / Молоко и молочные изделия", "Овощи и фрукты",
    "Консервированная продукция", "Фреш", "Мясо/Рыба", "Хлеб/Выпечка",
    "Мясные изделия", "Рыба и морепродукты", "Снеки", "Соусы и специи",
}
# "Для детей" aralash (o'yinchoq ham, ovqat ham) - subkategoriya ajratadi.
FOOD_SUBCATEGORIES = {"Детское питание"}
# Uy hayvonlari yemi ham oziq-ovqat (nomida "корм"/"yem" bo'lsa).
FOOD_NAME_HINTS = ("корм", "yem")


def _is_food(cat_top, cat_sub, name):
    if cat_top in FOOD_CATEGORIES or cat_sub in FOOD_SUBCATEGORIES:
        return True
    low = str(name).lower()
    return any(h in low for h in FOOD_NAME_HINTS)


def _utc_date(iso_str):
    """ISO timestamp (soat/daqiqa bilan) -> UTC kalendar sana. Soat/daqiqa
    tashlanadi (Math.round emas) - bu 2026-07-27'da topilgan va tuzatilgan
    xatoning (kirim vaqti soat>=12 bo'lsa bir kun keyinga surilib ketishi)
    oldini oladi."""
    dt = datetime.fromisoformat(str(iso_str).replace("Z", "+00:00"))
    return dt.date()


def _day_idx(iso_str, base_date):
    return (_utc_date(iso_str) - base_date).days


def _kirim_by_day(kirim_skus, sku, base_date, total_days):
    """{kun_idx: dona} - faqat Received, [base_date, base_date+total_days) ichida."""
    out = {}
    entry = kirim_skus.get(sku)
    if not entry:
        return out
    for a in (entry.get("arrivals") or []):
        if a.get("status") != "Received" or not a.get("date"):
            continue
        qty = a.get("qty") or 0
        if not qty:
            continue
        di = _day_idx(a["date"], base_date)
        if 0 <= di < total_days:
            out[di] = out.get(di, 0) + qty
    return out


def _walk_clamp(k_by_day, sales_arr, start_idx, end_idx):
    """start_idx (birinchi kirim kuni) dan end_idx (exclusive) gacha kunlik
    balans yuritadi - manfiyga tushsa 0'ga qaytaradi. Qaytaradi:
    (yakuniy_stok, clamp_hodisalari_soni, start_idx'dan OLDIN sotilgan dona)."""
    bal = 0.0
    clamp_events = 0
    for i in range(start_idx, end_idx):
        s = sales_arr[i] if i < len(sales_arr) else 0
        bal += k_by_day.get(i, 0) - (s or 0)
        if bal < 0:
            clamp_events += 1
            bal = 0.0
    sold_before = 0.0
    for i in range(0, min(start_idx, len(sales_arr))):
        sold_before += sales_arr[i] or 0
    return bal, clamp_events, sold_before


def _winsor_rate(sales, lo, hi):
    """[lo,hi) oralig'idagi kunlik sotuv tezligi + sotuv bo'lgan kunlar ulushi.

    Kunlik son 90-protsentil bilan CHEKLANADI (winsorizatsiya) - aks holda
    bitta yirik ULGURJI sotuv o'rtachani ko'tarib yuboradi va sekin tovar
    "tez sotiladigan" bo'lib ko'rinadi (SKU 2496 Nescafe misolida shu xato
    aniqlangan edi)."""
    days = hi - lo
    if days <= 0:
        return 0.0, 0.0
    vals = sorted(v for v in sales[lo:hi] if v > 0)
    if not vals:
        return 0.0, 0.0
    cap = vals[max(0, int(len(vals) * 0.9) - 1)] if len(vals) >= 5 else vals[-1]
    return sum(min(v, cap) for v in sales[lo:hi]) / days, len(vals) / days


def _natural_max_gap(sales, k_by_day, first_k, last_sold):
    """Tovarning O'ZI isbotlagan eng uzun KIRIMSIZ pauzasi - ya'ni stok bor
    bo'la turib shuncha kun sotilmagan. Bundan qisqa jimlik hech qachon
    "tugadi" deb baholanmaydi (mavsumiy/notekis sotiladigan tovar himoyasi).

    !!! MUHIM: PAUSE_STALE_DAYS dan uzun pauzalar "tabiiy" deb HISOBLANMAYDI.
    Aks holda AYLANMA XATO chiqadi (2026-07-29 simulyatsiyada topilgan):
    tovar 114 kun sotilmay tursa, "uzoq jimlik" qoidasi uni 0 qiladi; lekin
    tovar QAYTA sotila boshlashi bilan o'sha 114 kunlik jimlik "tabiiy pauza"
    bo'lib qolib, qoidaning o'zini o'chirib qo'yardi (114 > 114*3 emas) va
    qiymat 0 dan 294,980 ga sakrab ketardi. Ya'ni jimlik o'zini o'zi oqlardi.

    90+ kunlik jimlik hech qachon "stok bor bo'la turib normal xatti-harakat"
    emas - shuning uchun bazadan chiqariladi. Nescafe 2496 ning HAQIQIY
    64 kunlik pauzasi chegaradan past, ya'ni himoyasi saqlanadi.
    """
    natural = 0
    i = first_k
    while i <= last_sold:
        if sales[i]:
            i += 1
            continue
        a = i
        while i <= last_sold and not sales[i]:
            i += 1
        gap = i - a
        if gap >= PAUSE_STALE_DAYS:
            continue                      # bunday jimlik "tabiiy" emas
        if not any(a <= d <= i for d in k_by_day):
            natural = max(natural, gap)
    return natural


def _walk_with_pauses(sales, k_by_day, first_k, natural_max, total_days,
                      is_food=True):
    """Clamp yurishiga "tugab qolgan" testini qo'shadi.

    Har pauza (ketma-ket sotuvsiz kunlar) OXIRIDA so'raladi:
        pauza boshidagi zaxira shu pauzani oxirigacha yetkaza olarmidi?
            qoplama = zaxira / kunlik_sotuv
    Yetkaza olmasa VA jimlik shu tovar uchun g'ayrioddiy bo'lsa - zaxira
    pauza ichida TUGAGAN: balans 0 ga tushiriladi va SHUNDAN KEYIN o'sha
    pauzadagi kirim ustiga qo'shiladi.

    Aynan shu tartib (avval 0, keyin kirim) foydalanuvchi topgan xatoni
    tuzatadi (2026-07-29, SKU 38198): Invan arvoh 92 ni yangi kelgan 600
    ga QO'SHIB 692 qilib yuborgan edi - to'g'risi 600.

    Qaytaradi: (yakuniy_balans, reset_soni, oxirgi_reset_ma'lumoti)
      oxirgi_reset: {"idx","gap","ratio","tail"} yoki None.
      "tail"=True - jimlik HOZIR ham davom etyapti (ya'ni tovar bugun tugagan).
    """
    bal = 0.0
    resets = 0
    last = None
    i = first_k
    while i < total_days:
        if sales[i]:
            bal += k_by_day.get(i, 0) - sales[i]
            if bal < 0:
                bal = 0.0
            i += 1
            continue
        a = i
        j = i
        while j < total_days and not sales[j]:
            j += 1
        gap = j - a
        bal0 = bal
        lo = max(first_k, a - PAUSE_LOOKBACK)
        rate, p_kun = _winsor_rate(sales, lo, a) if (a - lo) >= 14 else (0.0, 0.0)
        # To'xtash PAYTIDAGI talab: qisqa oyna uzoq o'rtachadan tez bo'lsa,
        # o'shanisi olinadi ("zor sotilib kelib to'xtab qolgan" holat).
        lo_r = max(first_k, a - PAUSE_RECENT_WIN)
        if (a - lo_r) >= 7:
            r_recent, p_recent = _winsor_rate(sales, lo_r, a)
            if r_recent > rate:
                rate, p_kun = r_recent, max(p_kun, p_recent)
        cover = (bal0 / rate) if rate > 0 else float("inf")
        # Jimlik TASODIFAN bo'lish ehtimoli. p_kun=1 (HAR KUNI sotiladigan tovar)
        # holatini alohida ushlash SHART: aks holda formula chetlab o'tilib
        # "mutlaqo normal" (1.0) deb baholanardi va eng tez sotiladigan tovarlar
        # hech qachon aniqlanmasdi - aynan teskarisi bo'lishi kerak (2026-07-29
        # SKU 38198 misolida topilgan xato: har kuni sotiladigan coca-cola
        # 20 kun jim turgani "normal" deb o'tkazib yuborilardi).
        if p_kun <= 0:
            p_rand = 1.0        # sotuv umuman yo'q - hech narsa deya olmaymiz
        elif p_kun >= 1:
            p_rand = 0.0        # har kuni sotiladi - jimlik imkonsiz
        else:
            p_rand = (1 - p_kun) ** gap
        ratio = gap / max(cover, 0.5) if rate > 0 else 0.0
        fire = (rate > 0 and ratio >= PAUSE_MIN_RATIO
                and gap > natural_max and p_rand < PAUSE_P_MAX)
        # Zaxira raqamiga bog'liq bo'lmagan qo'shimcha dalil: jimlik mutlaq
        # uzun VA tovarning o'z tabiiy pauzasidan ancha uzun bo'lsa, qoldiq
        # qancha yozilganidan qat'i nazar unga ishonib bo'lmaydi (xato kirim
        # yozuvi hisobni shishirib, o'zini himoya qilib qo'yishining oldini oladi).
        stale = False
        if not fire and rate > 0 and gap >= PAUSE_STALE_DAYS \
                and gap > natural_max * PAUSE_STALE_MULT:
            fire = True
            stale = True
        quiet = False
        # JIM QOLDIQ: pauza (rate=0 - tezlik aniqlanmagan/kam sotuv holatlar,
        # "qoplama" ularni ushlay olmaydi) QUIET_STOCK_DAYS dan uzun bo'lsa,
        # PAUZA BOSHIDA 0 qilinadi.
        #
        # MUHIM (2 marta tuzatilgan xato, 2026-07-30): "pauza ICHIDA kirim
        # yo'qligi" shartini QO'SHISH XATO edi - agar pauzaning o'rtasida
        # (yoki oxirida, hali davom etayotgan bo'lsa) kirim kelsa, shart FALSE
        # bo'lib, filtr BUTUNLAY o'chib qolardi va eski arvoh yangi kirimga
        # qo'shilib ketardi (sinovda 100 o'rniga 118 chiqargan edi - aynan
        # 38198 dagi original muammoning o'zi). "qoplama"/"uzoq-jimlik" bunday
        # emas: ular FAQAT "gap >= chegara"ni tekshiradi, kirim borligidan
        # qat'i nazar - chunki "for d in range(a,j): bal+=k_by_day.get(d,0)"
        # qismi 0'dan boshlab barcha kirimlarni TO'G'RI qo'shadi. "jim-qoldiq"
        # ham xuddi shunday ishlashi kerak edi.
        if not fire and gap >= QUIET_STOCK_DAYS:
            if is_food or gap > natural_max * STALE_ASSORT_GAP_MULT:
                fire = True
                quiet = True
        if fire:
            resets += 1
            # bal0/rate/cover - faqat HISOBOT uchun (tekshiruv Excel'i shu
            # dalillarni ko'rsatadi); hisobga ta'sir qilmaydi.
            last = {"idx": a, "gap": gap, "ratio": ratio, "tail": j >= total_days,
                    "bal0": bal0, "rate": rate, "cover": cover, "stale": stale, "quiet": quiet}
            bal = 0.0
        for d in range(a, min(j, total_days)):
            bal += k_by_day.get(d, 0)
        i = j
    return bal, resets, last


def _check_time_alignment(hist, old, kirim, new_base, hist_base, hist_days, verbose=True):
    """VAQT QATORINI TEKSHIRUVI - har build'da ishlaydi.

    Bu hisobning eng xavfli joyi: sotuv IKKI manbadan, kirim esa ISO vaqt
    tamg'asidan keladi. Sana chegarasi bir kunga siljisa yoki ikki manba
    ustma-ust tushsa, butun hisob jimgina buziladi (ekranda xato ko'rinmaydi,
    faqat sonlar noto'g'ri bo'ladi).

    Tekshiriladi:
      1. USTMA-UST TUSHISH - tarixiy fayl history bazasiga yetib bormasin
         (2026-07-29 da AYNAN SHU xato topilgan: 2026-01-01 ikki marta
         sanalayotgan edi)
      2. BO'SHLIQ - ikki manba orasida tushib qolgan kun bo'lmasin
      3. MASSIV UZUNLIGI - d[] massivlari days bilan mos bo'lsin
      4. KELAJAK KIRIM - oynadan keyingi sanali kirim bo'lmasin

    Xato topilsa OGOHLANTIRISH chiqaradi (jurnalda ko'rinadi). Jiddiy
    (ustma-ust tushish / bo'shliq) bo'lsa False qaytaradi va hisob
    O'TKAZIB YUBORILADI - noto'g'ri son chiqarishdan ko'ra eski qiymat
    qolgani yaxshi.
    """
    ok = True
    hist_end = hist_base + timedelta(days=hist_days - 1)

    all_days = set()
    for dd in (old.get("daily") or {}).values():
        all_days.update(dd.keys())
    if all_days:
        omax = date.fromisoformat(max(all_days))
        omin = date.fromisoformat(min(all_days))
        if omin < new_base:
            if verbose:
                print(f"  ! OGOHLANTIRISH: tarixiy sotuv fayli {omin} dan boshlanadi, "
                      f"oyna esa {new_base} - undan oldingilari e'tiborsiz qoldiriladi")
        # 1) BO'SHLIQ
        if omax + timedelta(days=1) < hist_base:
            miss = (hist_base - omax).days - 1
            print(f"  !! XATO: sotuv tarixida BO'SHLIQ - {omax + timedelta(days=1)} dan "
                  f"{hist_base - timedelta(days=1)} gacha ({miss} kun) ma'lumot yo'q")
            ok = False
        # 2) USTMA-UST (kod di<offset bilan kesadi, lekin hajmini bilib turaylik)
        if omax >= hist_base:
            n = len([d for d in all_days if date.fromisoformat(d) >= hist_base])
            if verbose:
                print(f"  i tarixiy fayl {hist_base} dan keyingi {n} kunni ham o'z ichiga oladi "
                      f"- ular KESIB TASHLANADI (jonli manba ustun)")

    # 3) MASSIV UZUNLIGI
    bad = sum(1 for a in (hist.get("d") or {}).values()
              if a is not None and len(a) != hist_days)
    if bad:
        print(f"  !! XATO: {bad:,} ta sotuv massivi uzunligi days={hist_days} ga mos emas")
        ok = False

    # 4) KELAJAK KIRIM
    late = 0
    for ent in (kirim.get("skus") or {}).values():
        for a in (ent.get("arrivals") or []):
            if a.get("status") != "Received" or not a.get("date"):
                continue
            if _utc_date(a["date"]) > hist_end:
                late += 1
    if late and verbose:
        print(f"  i {late:,} ta kirim sotuv oynasidan ({hist_end}) KEYIN - hisobga olinmaydi "
              f"(keyingi sinxronizatsiyada qo'shiladi)")

    if verbose and ok:
        print(f"  vaqt qatori tekshirildi: {new_base} .. {hist_end} "
              f"({(hist_end - new_base).days + 1} kun, uzluksiz)")
    return ok


def recompute_calc_stock_from_history(root=ROOT, verbose=True):
    """Zakas 'Hisoblangan stok' uchun gibrid v3 modelini hisoblaydi. Har
    build'da qayta ishlaydi (keshlanmaydi)."""
    hist_path = root / "data_history.json"
    kirim_path = root / "data_kirim.json"
    inv_path = root / "data_inv_new.json"
    old_path = root / "data_sales_2025h2.json"
    if not (hist_path.exists() and kirim_path.exists() and inv_path.exists() and old_path.exists()):
        if verbose:
            print("  ! calcStock uchun kerakli fayllardan biri topilmadi - o'tkazib yuborildi")
        return {}

    hist = json.loads(hist_path.read_text(encoding="utf-8"))
    kirim = json.loads(kirim_path.read_text(encoding="utf-8"))
    inv = json.loads(inv_path.read_text(encoding="utf-8"))
    old = json.loads(old_path.read_text(encoding="utf-8"))

    hist_base = date.fromisoformat(hist["base"])
    hist_days = hist.get("days", 0)
    new_base = WINDOW_2025H2_START
    offset = (hist_base - new_base).days
    total_days = offset + hist_days
    if offset < 0 or total_days <= 0:
        if verbose:
            print("  ! data_sales_2025h2.json oynasi data_history.json bilan mos emas - o'tkazib yuborildi")
        return {}

    # Vaqt qatori butunligi - jiddiy xato bo'lsa hisob UMUMAN qilinmaydi
    # (noto'g'ri son chiqarishdan ko'ra eski qiymat qolgani xavfsizroq).
    if not _check_time_alignment(hist, old, kirim, new_base, hist_base, hist_days, verbose):
        if verbose:
            print("  ! vaqt qatorida jiddiy muammo - calcStock QAYTA HISOBLANMADI")
        return {}

    kirim_skus = kirim.get("skus", {})
    d_map = hist.get("d", {})
    old_daily = old.get("daily", {})

    active_skus = set()
    food_sku = set()          # oziq-ovqat (tabiiy tanaffus himoyasidan ozod)
    for nm, iv in inv.items():
        if isinstance(iv, dict):
            sk = str(iv.get("sku") or "").strip()
            if sk:
                active_skus.add(sk)
                if _is_food(iv.get("catTop") or "", iv.get("cat") or "", nm):
                    food_sku.add(sk)

    result = {}
    n_pause_applied = 0
    for key, hist_arr in d_map.items():
        if not key.startswith("sku:"):
            continue
        sku = key[4:].strip()
        if not sku or sku not in active_skus:
            continue
        hist_arr = hist_arr or []

        k_full = _kirim_by_day(kirim_skus, sku, new_base, total_days)
        if not k_full:
            continue  # kirim umuman yo'q -> hisoblab bo'lmaydi

        k_2026 = {i - offset: q for i, q in k_full.items() if i >= offset}
        if not k_2026:
            continue  # 2026-yilda kirimi yo'q -> maqsad populyatsiyadan tashqarida

        # To'liq oyna (2025-07-01..bugun) uchun sotuv massivi.
        #
        # !!! DIQQAT - VAQT CHEGARASI (2026-07-29 da topilgan REAL XATO) !!!
        # Ikki manba birlashtiriladi:
        #   [0 .. offset)          <- data_sales_2025h2.json  (tarixiy, statik)
        #   [offset .. total_days) <- data_history.json        (jonli)
        # data_sales_2025h2.json'ning oxirgi kuni (2026-01-01) data_history'ning
        # BIRINCHI kuni bilan BIR XIL. Avval sharti "di < total_days" edi -
        # shu sabab o'sha kun IKKI MARTA qo'shilib ketardi. To'g'ri chegara:
        # tarixiy manba QAT'IY offset'gacha (di < offset).
        # Bu chegarani o'zgartirmang - pastdagi _assert_no_overlap() tekshiradi.
        full_sales = [0.0] * total_days
        for day_str, qty in old_daily.get(sku, {}).items():
            di = (date.fromisoformat(day_str) - new_base).days
            if 0 <= di < offset:          # <-- QAT'IY offset (ustma-ust tushmasin)
                full_sales[di] += qty
        for i, qty in enumerate(hist_arr):
            if qty and i < hist_days:
                full_sales[offset + i] += qty

        # --- 2026-only model ---
        first_k_2026 = min(k_2026)
        final_2026, clamp_2026, _ = _walk_clamp(k_2026, hist_arr, first_k_2026, hist_days)
        last60 = sum((hist_arr[i] if i < len(hist_arr) else 0)
                     for i in range(max(0, hist_days - LAST60_DAYS), hist_days))

        # --- 2025-07 (kengaytirilgan) model ---
        first_k_full = min(k_full)
        final_full, clamp_full, sold_before = _walk_clamp(k_full, full_sales, first_k_full, total_days)

        signal1 = sold_before > 0
        signal2 = (final_2026 == 0) and (last60 >= LAST60_MIN_UNITS)

        if signal1 or signal2:
            final, clamp_events, anchor_idx, source = final_full, clamp_full, first_k_full, "2025-07"
        else:
            final, clamp_events, anchor_idx, source = final_2026, clamp_2026, first_k_2026 + offset, "2026"

        if final == 0 and last60 >= LAST60_MIN_UNITS:
            conf = "eskirgan"
        elif source == "2025-07":
            conf = "o'rta"
        else:
            conf = "yuqori"

        anchor_date = new_base + timedelta(days=anchor_idx)
        rule = "oddiy"      # pauza testi ishlamasa shu qoladi

        # --- "TUGAB QOLGAN" testi (2026-07-29, foydalanuvchi bilan tasdiqlangan) ---
        # Gibrid clamp modeli tovar tugab qolganini ko'ra olmaydi: uzoq jimlikdan
        # keyin ham eski zaxirani ushlab turaveradi va uni YANGI KIRIMGA qo'shib
        # yuboradi (Invan ham xuddi shunday xato qiladi - 38198: arvoh 92 + yangi
        # 600 = 692, to'g'risi 600). _walk_with_pauses() shu xatoni tuzatadi.
        #
        # NEGA "hozir tugagan"/"tarixda tugagan" deb AJRATILMAYDI: bu farq vaqt
        # funksiyasi - bugun "hozirgi" bo'lgan jimlik, tovar ertaga sotilsa,
        # "tarixiy"ga aylanadi. Faqat "hozirgi"ni qo'llasak, tovar qayta sotilishi
        # bilan tuzatish YO'QOLADI va arvoh qaytib keladi (sinovda tasdiqlangan:
        # 600 -> 684 bo'lib ketardi). Shuning uchun dalili yetarli (nisbat >= 2x)
        # HAR QANDAY reset qo'llanadi - shunda qiymat vaqt bo'yicha barqaror.
        #
        # MUHIM: bu qiymat KESHLANMAYDI - har build'da (har ~30 daqiqada) jonli
        # kirim/sotuvdan qayta hisoblanadi. Kunlar o'tib tovar sotilsa yoki yangi
        # kirim kelsa, natija o'zi ergashadi - "qotib" qolmaydi.
        first_k_all = min(k_full)
        sold_idx = [i for i in range(first_k_all, total_days) if full_sales[i]]
        if len(sold_idx) >= 2:
            nat = _natural_max_gap(full_sales, k_full, first_k_all, sold_idx[-1])
            p_final, p_resets, p_last = _walk_with_pauses(
                full_sales, k_full, first_k_all, nat, total_days,
                is_food=(sku in food_sku))
            if p_last:
                # MUHIM (2026-07-29): qoida ISHLASHI bilan uning NATIJAGA TA'SIR
                # QILISHI bir xil narsa emas. Ko'p tovarda reset bo'ladi, lekin
                # keyin kelgan kirim balansni aynan o'sha songa qaytaradi.
                # Real ma'lumotda: 9,011 tada reset ishlagan, 4,115 tasida
                # natija xom hisobdan farq qiladi.
                #
                # "rule" (va unga bog'liq yashil belgi) TA'SIR QILGANLARGA
                # qo'yiladi - belgi "qiymati o'zgardi" emas, "bu tovar tugash
                # testidan o'tib, ISHONCHLI hisoblangan" degan ma'noda
                # (foydalanuvchi qarori, 2026-07-29).
                #
                # Baza: pauza qoidasisiz sof clamp (to'liq oyna, birinchi
                # kirimdan). Aynan shu qoidaning o'z hissasini ko'rsatadi.
                _plain = 0.0
                for _d in range(first_k_all, total_days):
                    _plain += k_full.get(_d, 0) - full_sales[_d]
                    if _plain < 0:
                        _plain = 0.0
                changed = abs(p_final - _plain) >= 1
                final = p_final
                clamp_events = p_resets
                conf = "yuqori" if p_last["ratio"] >= PAUSE_STRONG_RATIO else "o'rta"
                anchor_date = new_base + timedelta(days=p_last["idx"])
                if changed:
                    rule = ("jim-qoldiq" if p_last.get("quiet") else
                        "uzoq-jimlik" if p_last.get("stale") else "qoplama")
                    n_pause_applied += 1

        result[sku] = {
            "stock": round(final, 2),
            "conf": conf,
            "evidence": clamp_events,
            "anchor": anchor_date.isoformat(),
            # Qaysi qoida QIYMATNI O'ZGARTIRGANI. Frontend shu asosda "tekshirilgan"
            # belgisini (kichik yashil nuqta) qo'yadi - barcha tovar tekshirilgach
            # belgi olib tashlanadi (foydalanuvchi so'rovi, 2026-07-29).
            #   "oddiy"       - qiymat o'zgarmagan (qoida ishlamagan yoki
            #                   ishlab, natija bir xil chiqqan)
            #   "qoplama"     - zaxira jimlikni qoplay olmagan -> tugagan
            #   "uzoq-jimlik" - 90+ kun sotilmagan -> qoldiqqa ishonib bo'lmaydi
            "rule": rule,
        }

    # ─── SOTILMAGAN TOVARLAR (2026-07-30, foydalanuvchi qarori) ───────────
    # Yuqoridagi asosiy halqa faqat data_history.json'dagi (ya'ni 2026 da
    # KAMIDA BIR MARTA SOTILGAN) tovarlarni ko'radi. 2026 da sotilmagan tovar
    # u yerga tushmaydi - saytda "—" bo'lib qoladi va zakas Invan soniga
    # tayanadi, Invan esa bunday tovarlarda ko'pincha arvoh qoldiq ko'rsatadi.
    #
    # Qoida: kirimi BOR + 2026 da BITTA HAM sotuv yo'q + oxirgi kirimdan
    # NOSALE_STALE_DAYS (60) kun o'tgan  ->  stok 0.
    #
    # Yaqinda kelganlarga TEGILMAYDI (tovar hali sotilishga ulgurmagan
    # bo'lishi mumkin) - ularda "—" qoladi va vaqt o'tib sotilmasa, keyingi
    # build'da o'zi shu qoidaga tushadi.
    n_nosale = 0
    n_yangik = 0
    for sku in active_skus:
        if sku in result:
            continue
        k_full = _kirim_by_day(kirim_skus, sku, new_base, total_days)
        if not k_full:
            continue
        # 2026 da (data_history oynasida) birorta sotuv bormi?
        # 2025 dagi sotuv HISOBGA OLINMAYDI - foydalanuvchi qarori: 2026 da
        # sotilmagan bo'lsa, eskirgan assortiment deb qaraladi.
        if any(q for q in (d_map.get("sku:" + sku) or [])):
            continue
        last_k = max(k_full)
        # VAQT MOSLIGI (2026-07-30 sinovda topilgan kamchilik tuzatildi):
        # avval "yaqinda kelgan" tovar butunlay chetlab o'tilardi va saytda
        # "—" bo'lib qolardi - ya'ni 100 dona kelgan tovarda hech narsa
        # ko'rinmasdi. Endi OXIRGI NOSALE_STALE_DAYS (60) kun ichidagi kirim
        # "hali javonda" deb hisoblanadi, undan eskisi esa yo'q deb qaraladi
        # (chunki 60 kun ichida bitta ham sotilmagan).
        # Shu bilan qiymat vaqt bo'yicha uzluksiz bo'ladi:
        #   bugun 100 keldi -> 100;  60 kun sotilmasa -> 0;  sotilsa -> asosiy
        #   model (clamp) o'z ishini boshlaydi.
        recent_k = sum(q for i, q in k_full.items()
                       if (total_days - 1) - i < NOSALE_STALE_DAYS)
        result[sku] = {
            "stock": float(round(recent_k, 2)),
            "conf": "yuqori",
            "evidence": 0,
            "anchor": (new_base + timedelta(days=last_k)).isoformat(),
            "rule": "sotilmagan" if recent_k <= 0 else "yangi-kirim",
        }
        if recent_k <= 0:
            n_nosale += 1
        else:
            n_yangik += 1

    # ─── ESKIRGAN ASSORTIMENT (2026-07-30, foydalanuvchi qarori) ──────────
    # 2026 da SOTILGAN, lekin 2026 da bironta KIRIM olmagan tovarlar. Asosiy
    # halqa ularni "k_2026 yo'q" deb chetlab o'tadi. Oxirgi sotuvdan 90+ kun
    # o'tgan bo'lsa - yangi kirim kelmagani uchun eski zaxira tugagan deb
    # qaraladi. 3 oydan kam jim turganlarga TEGILMAYDI (hali faol).
    n_stale_as = 0
    for sku in active_skus:
        if sku in result:
            continue
        k_full = _kirim_by_day(kirim_skus, sku, new_base, total_days)
        if not k_full or any(i >= offset for i in k_full):
            continue                       # kirim yo'q yoki 2026 da bor
        hist_arr = d_map.get("sku:" + sku) or []
        sold = [i for i in range(len(hist_arr)) if hist_arr[i]]
        if not sold:
            continue                       # 2026 da sotilmagan - yuqorida ishlangan
        gap_now = (hist_days - 1) - sold[-1]
        if gap_now < STALE_ASSORT_DAYS:
            continue                       # hali faol - tegilmaydi
        # OZIQ-OVQAT BO'LMAGAN tovarda tabiiy tanaffusni ham tekshiramiz:
        # kanselyariya/o'yinchoq/izolenta kabi buyum oylab turib sotilishi
        # NORMAL. Oziq-ovqatda bunday himoya yo'q - u saqlanmaydi.
        if sku not in food_sku:
            # Tanaffus TO'LIQ oynadan (2025-07-01 dan) hisoblanadi - faqat 2026
            # dan hisoblansa tarix qisqa bo'lib, tabiiy tanaffus kichik chiqadi
            # va himoya deyarli ishlamay qoladi (sinovda: 171 o'rniga atigi 19).
            full_sold = []
            for ds, q in (old_daily.get(sku) or {}).items():
                if not q:
                    continue
                di = (date.fromisoformat(ds) - new_base).days
                if 0 <= di < offset:
                    full_sold.append(di)
            full_sold.extend(offset + i for i in sold)
            full_sold.sort()
            gaps = [full_sold[i + 1] - full_sold[i] - 1
                    for i in range(len(full_sold) - 1)]
            nat_gap = max(gaps) if gaps else 0
            if gap_now < nat_gap * STALE_ASSORT_GAP_MULT:
                continue                   # o'z ritmi doirasida - tegilmaydi
        result[sku] = {
            "stock": 0.0,
            "conf": "yuqori",
            "evidence": 0,
            "anchor": (hist_base + timedelta(days=sold[-1])).isoformat(),
            "rule": "eskirgan-assortiment",
        }
        n_stale_as += 1

    # ─── KIRIMSIZ TOVARLAR (2026-07-30, foydalanuvchi qarori) ─────────────
    # Invan'da KIRIM YOZUVI UMUMAN yo'q tovarlar (hujjatsiz kelgan, boshqa
    # do'kondan ko'chirilgan yoki tizim ishga tushishidan oldingi qoldiq).
    # Ularda hisoblash uchun boshlang'ich nuqta yo'q, shuning uchun asosiy
    # model ularni umuman ko'rmaydi.
    #
    # Qoida: kirim yozuvi yo'q + oxirgi sotuvdan 90+ kun (yoki umuman
    # sotilmagan) -> stok 0. Mantiq sodda: kirim ham yo'q, sotuv ham yo'q -
    # zaxira qayerdan bo'lsin?
    #
    # OZIQ-OVQAT BO'LMAGANLARDA tabiiy tanaffus himoyasi bu yerda ham
    # ishlaydi (skotch, pemza, maska kabi buyumlar oylab turishi normal).
    n_nokirim = 0
    n_eskikirim = 0
    for sku in active_skus:
        if sku in result:
            continue
        if _kirim_by_day(kirim_skus, sku, new_base, total_days):
            continue                       # oyna ichida kirim bor
        ent = kirim_skus.get(sku) or {}
        # Oynadan OLDIN (2025-07-01 dan avval) kirimi bor tovarlar ham shu
        # yerda ishlanadi - ularning kirimi 1-1.5 YIL oldin bo'lgan, ya'ni
        # yangi tovar kelmagan. 3 oydan beri sotilmagan bo'lsa, qoldiq
        # eskirgan (foydalanuvchi qarori, 2026-07-30). Faqat YORLIG'I boshqa.
        eski_kirim = any(a.get("status") == "Received" and a.get("qty")
                         for a in (ent.get("arrivals") or []))
        hist_arr = d_map.get("sku:" + sku) or []
        sold = [i for i in range(len(hist_arr)) if hist_arr[i]]
        old_sold = sorted(
            (date.fromisoformat(ds) - new_base).days
            for ds, q in (old_daily.get(sku) or {}).items() if q)
        old_sold = [d for d in old_sold if 0 <= d < offset]
        full_sold = old_sold + [offset + i for i in sold]
        # Kirim yozuvi umuman yo'q bo'lsa (eski_kirim=False) 6 oylik,
        # eski kirimi bor bo'lsa 3 oylik chegara qo'llanadi.
        _thr = STALE_ASSORT_DAYS if eski_kirim else NOKIRIM_STALE_DAYS
        if full_sold:
            gap_now = (total_days - 1) - full_sold[-1]
            if gap_now < _thr:
                continue                   # hali faol - tegilmaydi
            if sku not in food_sku:
                gaps = [full_sold[i + 1] - full_sold[i] - 1
                        for i in range(len(full_sold) - 1)]
                nat_gap = max(gaps) if gaps else 0
                if gap_now < nat_gap * STALE_ASSORT_GAP_MULT:
                    continue               # o'z ritmi doirasida
            anchor = (new_base + timedelta(days=full_sold[-1])).isoformat()
        else:
            anchor = new_base.isoformat()  # umuman sotilmagan
        result[sku] = {
            "stock": 0.0,
            "conf": "yuqori",
            "evidence": 0,
            "anchor": anchor,
            "rule": "eski-kirim" if eski_kirim else "kirimsiz",
        }
        if eski_kirim:
            n_eskikirim += 1
        else:
            n_nokirim += 1


    if verbose:
        n_hi = sum(1 for v in result.values() if v["conf"] == "yuqori")
        n_mid = sum(1 for v in result.values() if v["conf"] == "o'rta")
        n_stale = sum(1 for v in result.values() if v["conf"] == "eskirgan")
        print(f"  {len(result):,} mahsulotga calcStock hisoblandi (yuqori={n_hi:,}, o'rta={n_mid:,}, eskirgan={n_stale:,})")
        print(f"  {n_pause_applied:,} mahsulotda 'tugab qolgan' davri aniqlanib, zaxira qayta boshlandi")
        print(f"  {n_nosale:,} mahsulot 'sotilmagan' (kirim bor, {NOSALE_STALE_DAYS}+ kun sotuv yo'q) -> 0")
        print(f"  {n_yangik:,} mahsulot 'yangi-kirim' (hali sotilmagan, oxirgi {NOSALE_STALE_DAYS} kun kirimi = stok)")
        print(f"  {n_stale_as:,} mahsulot 'eskirgan assortiment' (2026 da kirim yo'q, {STALE_ASSORT_DAYS}+ kun jim) -> 0")
        print(f"  {n_nokirim:,} mahsulot 'kirimsiz' (kirim yozuvi yo'q, {NOKIRIM_STALE_DAYS}+ kun jim) -> 0")
        print(f"  {n_eskikirim:,} mahsulot 'eski-kirim' (kirimi 2025-07 dan oldin, {STALE_ASSORT_DAYS}+ kun jim) -> 0")
    return result


def _apply_calc_stock(calc_by_sku, root=ROOT, verbose=True):
    """calc_by_sku'ni data_inv_new.json ga calcStock/calcConf/calcEvidence/calcAnchor
    sifatida qo'llaydi (+ HTML embed). avg30sa/pav/rcost'dan MUSTAQIL, alohida o'qish/yozish."""
    inv_path = root / "data_inv_new.json"
    if not inv_path.exists():
        return 0
    inv = json.loads(inv_path.read_text(encoding="utf-8"))
    CALC_KEYS = ("calcStock", "calcConf", "calcEvidence", "calcAnchor", "calcRule")
    matched = 0
    for iv in inv.values():
        if not isinstance(iv, dict):
            continue
        sku = iv.get("sku")
        if sku is None or sku == "":
            for k in CALC_KEYS:
                iv.pop(k, None)
            continue
        res = calc_by_sku.get(str(sku))
        if res:
            iv["calcStock"] = res["stock"]
            iv["calcConf"] = res["conf"]
            iv["calcEvidence"] = res["evidence"]
            iv["calcAnchor"] = res["anchor"]
            iv["calcRule"] = res["rule"]
            matched += 1
        else:
            for k in CALC_KEYS:
                iv.pop(k, None)
    inv_json = json.dumps(inv, ensure_ascii=False, separators=(",", ":"))
    inv_path.write_text(inv_json, encoding="utf-8")
    TAG = '<script id="invdata" type="application/json">'
    for fn in ("index.html", "sales.html"):
        f = root / fn
        if not f.exists():
            continue
        txt = f.read_text(encoding="utf-8")
        i = txt.find(TAG)
        if i < 0:
            continue
        start = i + len(TAG)
        end = txt.find("</script>", start)
        if end < 0:
            continue
        f.write_text(txt[:start] + inv_json + txt[end:], encoding="utf-8")
    if verbose:
        print(f"  {matched:,} mahsulotga calcStock qo'llandi (inv + embed)")
    return matched


def build_calc_stock(root=ROOT, verbose=True):
    """Zakas sahifasida Invan stok yoniga ko'rsatiladigan 'Hisoblangan stok'ni
    qayta hisoblab qo'llaydi. build_avg30sa()/build_prev_avg()/build_current_cost()dan
    MUSTAQIL chaqiriladi (ular bilan bog'liq emas)."""
    try:
        calc_by_sku = recompute_calc_stock_from_history(root=root, verbose=verbose)
    except Exception as e:
        if verbose:
            print(f"  ! calcStock hisoblashda xato: {e}")
        return 0
    if not calc_by_sku:
        return 0
    return _apply_calc_stock(calc_by_sku, root=root, verbose=verbose)


if __name__ == "__main__":
    build_calc_stock(verbose=True)
