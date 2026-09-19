#!/usr/bin/env python3
"""
backend_p3_abc.py — "ABC tahlili" (p3) bo'limi uchun ABC/C1-C2-C3 klassifikatsiya
va har mahsulot uchun why/how (sabab/tavsiya) matnlarini shakllantiradi.
Frontend: sales_runtime.js initP3().
"""


def gen_why_how(abc, sub, di, active, days, trend, rev, qty, rec):
    day_avg = round(qty / days, 1) if days else 0

    if abc == "A":
        why = [
            "Daromadning 80% ini ta'minlovchi muhim mahsulot",
            f"Oyda {rec} ta chekda sotilgan — yuqori talab",
            f"Savdo {trend} tendensiyasida",
            "Zaxira tugashi butun savdoga zarar keltiradi",
        ]
        how = [
            "Zaxira hech qachon tugamasligini ta'minlash (safety stock oshirish)",
            "Yetkazib beruvchi bilan uzoq muddatli shartnoma tuzish",
            "Savdo hajmini haftalik monitoring qilish",
        ]
    elif abc == "B":
        why = [
            "Daromad ulushi 15% oralig'ida — o'rta muhimlikdagi mahsulot",
            f"Oyda {rec} ta chekda sotilgan",
            f"Savdo {trend} tendensiyasida",
            "A guruhiga o'tish imkoniyati mavjud",
        ]
        how = [
            "Savdo hajmini oshirish uchun A guruh mahsulotlari bilan birga taklif qilish",
            "Zaxira darajasini optimallashtirish — haddan oshiq buyurtma qilmaslik",
            "Aksiya vaqtida e'tibor berish — B dan A ga o'tkazish mumkin",
        ]
    else:
        if sub == "C1":
            why = [
                f"So'nggi {di} kun ichida savdo kuzatilmadi",
                f"Oylik daromad juda past ({round(rev/1000)}K so'm)",
                f"Jami {active} kun aktiv savdo bo'lgan ({days} kundan)",
                "Omborda qoldiq to'planib qolishi xavfi bor",
            ]
            how = [
                "Chegirma yoki aksiya bilan qolgan zaxirani sotish",
                "Yangi buyurtma to'xtatish",
                "30 kun ichida savdo bo'lmasa assortimentdan chiqarish",
            ]
        elif sub == "C2":
            why = [
                "Savdo hajmi pasayish tendensiyasida",
                f"Faqat {rec} ta chekda sotilgan (kam talab)",
                "Mijozlar boshqa alternativlarga o'tmoqda",
                "Daromad ulushi 5% dan past",
            ]
            how = [
                "Mahsulotni ko'p sotiluvchi mahsulotlar yonida joylash",
                "Narxni raqobatchilar bilan solishtirish",
                "Minimum zaxira darajasini kamaytirib, buyurtma hajmini qisqartirish",
            ]
        else:
            why = [
                "Mahsulot past chastotada, lekin barqaror sotiladi",
                f"O'rtacha {day_avg} dona/kun savdo (past hajm)",
                "Umumiy daromad ulushi 5% dan past",
                "Savdo barqaror lekin hajm kichik",
            ]
            how = [
                "Buyurtma hajmini minimal darajada ushlab turish",
                "Savat tahlili asosida ko'p sotiluvchi mahsulotlar yoniga joylashtirish",
                "Agar 2 oy ketma-ket C bo'lsa, assortiment qayta ko'rib chiqish",
            ]

    return why, how


def build_p3data(p2data, daily_data, max_d):
    days    = daily_data["__meta__"]["days"]
    items_d = daily_data["items"]

    result = []
    for item in p2data:
        pk  = ("sku:" + item["sku"]) if item["sku"] else ("name:" + item["name"])
        it  = items_d.get(pk)

        # days since last sale
        di = days
        if it:
            for d in range(days - 1, -1, -1):
                if it["q"][d] > 0:
                    di = days - 1 - d
                    break

        active = it["m"]["activeDays"] if it else 0
        trend  = it["m"]["trend"]      if it else "stable"
        ws_pct = it["m"]["wholesalePct"] if it else 0

        abc = item["abc"]
        # C alt-klassifikatsiyasi
        if abc == "C":
            if di > 20:
                sub = "C1"
            elif trend == "down":
                sub = "C2"
            else:
                sub = "C3"
        else:
            sub = abc

        why, how = gen_why_how(
            abc, sub, di, active, days, trend,
            item["rev"], item["qty"], item["rec"]
        )

        result.append({
            "name": item["name"],
            "sku":  item["sku"],
            "r":    item["r"],
            "rev":  item["rev"],
            "rp":   item["rp"],
            "qty":  item["qty"],
            "rec":  item["rec"],
            "p":    item["p"],
            "kg":   item["kg"],
            "ld":   item["ld"],
            "cat":  item["cat"],
            "abc":  abc,
            "sub":  sub,
            "di":   di,
            "tr":   trend,
            "why":  why,
            "how":  how,
        })

    return result
