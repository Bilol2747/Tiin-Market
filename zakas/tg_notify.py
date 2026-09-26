# -*- coding: utf-8 -*-
"""
ZAKAS OCHILGANDA TELEGRAM XABARI (2026-09-25, Bilol): Invan'da zakas (buyurtma) ochilgach "Tiin Analitika" guruhiga
SENING NOMINGDAN buyurtma PDF'i va uning ostida xabar yuboriladi (kategoriyali menejerlar ta'minotchiga xabar berishi uchun).

Matn (kelishilgan):
    <ta'minotchi nomi>

    📌 Hurmatli menejer!
    Shu firma kimga tegishli bo'lsa, shu postavshikka avtozakaz ochildi.

    ✅ SMS yuborildi: +998 ...          (raqami bor bo'lsa)
    ⚠️ SMS yuborilmadi — sababi: postavshikning telefon raqami kiritilmagan.   (raqami yo'q bo'lsa)
    🙏 Iltimos, postavshikka xabar bering.

Ishga tushirish: .github/workflows/telegram_notify.yml (sayt katakchasi - api/invan-order.js, avtomat - zakas/auto_control.js
workflow_dispatch qiladi). Lokal sinov (o'z sessiyang bilan, "Saqlangan xabarlar"ga):
    python zakas/tg_notify.py --order-no 21597 --target me --local-session C:\\Users\\User\\.telegram-claude

Muhit: TG_API_ID, TG_API_HASH, TG_SESSION (StringSession), INVAN_API_TOKEN (o'qish), INVAN_PERSONAL_TOKEN (ta'minotchi telefoni),
GITHUB_TOKEN + GITHUB_REPOSITORY (takroriy yuborishga qarshi ro'yxat - auto-data branch, faqat guruhga yuborishda).
Telefon raqamlari va sessiya HECH QACHON logga chiqarilmaydi (repo ochiq - loglar hammaga ko'rinadi).
"""
import argparse
import base64
import io
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

API_V1 = "https://api.7i.uz/api/v1"
INTEG = "https://api.7i.uz/integration/v1"
GROUP_TITLE = os.environ.get("TG_GROUP_TITLE", "Tiin Analitika")
POSTED_FILE = "zakas_tg_posted.json"
POSTED_BRANCH = "auto-data"


# ── Xabar matni (sof funksiya - sinash oson) ───────────────────────────────────
def fmt_phone(p):
    d = re.sub(r"\D", "", str(p or ""))
    if len(d) == 12 and d.startswith("998"):
        return f"+{d[0:3]} {d[3:5]} {d[5:8]} {d[8:10]} {d[10:12]}"
    return ("+" + d) if d else ""


def compose(firma, sms, phones):
    """sms: 'sent' | 'nophone' | 'failed'"""
    bosh = f"{firma}\n\n📌 Hurmatli menejer!\nShu firma kimga tegishli bo'lsa, shu postavshikka avtozakaz ochildi.\n\n"
    if sms == "sent":
        ph = ", ".join(x for x in (fmt_phone(p) for p in phones) if x)
        sms_line = "✅ SMS yuborildi" + (f": {ph}" if ph else "")
    elif sms == "failed":
        sms_line = "⚠️ SMS yuborilmadi — sababi: texnik xato (Invan'da SMS ketmadi)."
    else:
        sms_line = "⚠️ SMS yuborilmadi — sababi: postavshikning telefon raqami kiritilmagan."
    return bosh + sms_line + "\n🙏 Iltimos, postavshikka xabar bering."


# ── HTTP yordamchilar ─────────────────────────────────────────────────────────
def http(method, url, headers=None, body=None, timeout=60, raw=False):
    data = body if isinstance(body, (bytes, type(None))) else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, method=method, headers=headers or {})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        buf = r.read()
    return buf if raw else (json.loads(buf.decode("utf-8")) if buf else {})


def inv_headers(tok):
    return {"Authorization": "Bearer " + tok, "Content-Type": "application/json", "Timezone": "300"}


def find_order(order_no, tok, tries=6, wait=10):
    """Buyurtma Invan ro'yxatida paydo bo'lguncha bir necha marta urinadi (yaratilgandan keyin bir necha soniya)."""
    for i in range(tries):
        j = http("POST", f"{INTEG}/supplier_order?page=1&limit=300", inv_headers(tok), {"filters": []})
        for o in j.get("data", []):
            if str(o.get("external_id")) == str(order_no):
                return o
        if i < tries - 1:
            time.sleep(wait)
    return None


def get_pdf(order_id, tok):
    j = http("POST", f"{API_V1}/supplier_order_pdf/{order_id}", inv_headers(tok), {})
    link = j.get("link")
    if not link:
        raise RuntimeError("PDF havolasi kelmadi")
    return http("GET", link, raw=True, timeout=120)


def get_phones(supplier_id, tok):
    j = http("GET", f"{API_V1}/supplier/{supplier_id}", inv_headers(tok))
    d = j.get("data", j) if isinstance(j, dict) else {}
    return [str(p).strip() for p in (d.get("phone_number") or []) if str(p or "").strip()]


# ── Takroriy yuborishga qarshi ro'yxat (auto-data/zakas_tg_posted.json) ───────
def gh_api(path, method="GET", body=None):
    tok, repo = os.environ.get("GITHUB_TOKEN"), os.environ.get("GITHUB_REPOSITORY", "Bilol2747/Tiin-Market")
    if not tok:
        return None
    h = {"Authorization": "Bearer " + tok, "Accept": "application/vnd.github+json", "Content-Type": "application/json"}
    try:
        return http(method, f"https://api.github.com/repos/{repo}{path}", h, body)
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise


def posted_read():
    f = gh_api(f"/contents/{POSTED_FILE}?ref={POSTED_BRANCH}")
    if not f or "content" not in f:
        return {"orders": []}, None
    try:
        d = json.loads(base64.b64decode(f["content"]).decode("utf-8"))
    except Exception:
        d = {"orders": []}
    if not isinstance(d.get("orders"), list):
        d["orders"] = []
    return d, f.get("sha")


def posted_write(d, sha, msg):
    d["orders"] = d["orders"][-500:]
    body = {"message": msg, "branch": POSTED_BRANCH, "content": base64.b64encode(json.dumps(d, indent=2).encode("utf-8")).decode()}
    if sha:
        body["sha"] = sha
    gh_api(f"/contents/{POSTED_FILE}", "PUT", body)


# ── Asosiy ────────────────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--order-no", required=True, help="Invan buyurtma raqami (external_id, masalan 21597)")
    ap.add_argument("--sms", default="", choices=["", "sent", "nophone", "failed"], help="SMS holati (bo'sh bo'lsa telefon raqamidan aniqlanadi)")
    ap.add_argument("--target", default="group", choices=["group", "me"], help="group = Tiin Analitika, me = Saqlangan xabarlar (sinov)")
    ap.add_argument("--local-session", default="", help="lokal Telethon papkasi (config.json + claude.session) - faqat lokal sinov")
    ap.add_argument("--dry", action="store_true", help="hech narsa yubormaydi, matnni chiqaradi")
    a = ap.parse_args()

    static_tok = os.environ.get("INVAN_API_TOKEN", "").strip()
    pers_tok = os.environ.get("INVAN_PERSONAL_TOKEN", "").strip()
    if not static_tok:
        sys.exit("INVAN_API_TOKEN yo'q")

    posted, psha = ({"orders": []}, None)
    if a.target == "group" and not a.dry:
        posted, psha = posted_read()
        if str(a.order_no) in [str(x.get("order_no")) for x in posted["orders"]]:
            print(f"PO{a.order_no}: allaqachon yuborilgan - o'tkazib yuborildi")
            return

    o = find_order(a.order_no, static_tok)
    if not o:
        sys.exit(f"Buyurtma {a.order_no} Invan ro'yxatida topilmadi")
    firma = (o.get("supplier") or {}).get("name") or "?"
    sid = (o.get("supplier") or {}).get("id")

    phones = []
    if sid and pers_tok:
        try:
            phones = get_phones(sid, pers_tok)
        except Exception as e:
            print("telefonni olib bo'lmadi:", type(e).__name__)
    sms = a.sms or ("sent" if phones else "nophone")
    if sms == "sent" and not phones:
        sms = "nophone"   # SMS ketgan deb aytilgan, lekin raqam ko'rinmasa - raqamsiz yozamiz
    caption = compose(firma, sms, phones)
    assert len(caption) < 1000, "caption juda uzun"

    pdf = get_pdf(o["id"], static_tok)
    print(f"PO{a.order_no}: PDF {len(pdf)} bayt, sms={sms}, maqsad={a.target}")
    if a.dry:
        print(caption)
        return

    from telethon.sync import TelegramClient
    from telethon.sessions import StringSession
    if a.local_session:
        cfg = json.load(open(os.path.join(a.local_session, "config.json"), encoding="utf-8"))
        client = TelegramClient(os.path.join(a.local_session, "claude"), cfg["api_id"], cfg["api_hash"])
    else:
        client = TelegramClient(StringSession(os.environ["TG_SESSION"].strip()), int(os.environ["TG_API_ID"]), os.environ["TG_API_HASH"].strip())
    with client:
        if a.target == "me":
            ent = "me"
        else:
            ent = None
            for d in client.iter_dialogs():
                if (d.name or "").strip() == GROUP_TITLE:
                    ent = d.entity
                    break
            if ent is None:
                sys.exit(f"Telegram guruhi topilmadi: {GROUP_TITLE}")
        f = io.BytesIO(pdf)
        f.name = f"PO{a.order_no}.pdf"
        m = client.send_file(ent, f, caption=caption)
        print(f"YUBORILDI (msg {m.id})")

    if a.target == "group":
        posted["orders"].append({"order_no": str(a.order_no), "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())})
        try:
            posted_write(posted, psha, f"Zakas Telegram: PO{a.order_no} yuborildi")
        except Exception as e:
            print("ro'yxatni yozib bo'lmadi (xabar ketgan):", type(e).__name__)


if __name__ == "__main__":
    main()
