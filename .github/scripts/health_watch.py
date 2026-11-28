#!/usr/bin/env python3
"""Pipeline sog'lig'ini tekshirish (2026-09-28) — `health_check.yml` va `live_data.yml` chaqiradi.

Nima uchun yangi: eski tekshiruv faqat "main'dagi oxirgi commit 14 soatdan eskimi" degan
savolga javob berardi. Sync kuniga 2 marta (04:00 va 09:00 UTC), oddiy tungi oraliq 19 soat —
chegara jadvalga mos emasdi, ustiga sync "muvaffaqiyatli" tugab fayl yangilanmay qolgan holat
(data_ta_qarz.json, 08-11 dan 48 kun) ko'rinmasdi. Bu skript SAYTNING O'ZI xizmat qilayotgan
fayllarni (deploy'dan keyingi holat) sync jadvaliga nisbatan tekshiradi.

Tekshiruvlar:
  live_stale   — jonli qatlam (meta.json) 40 daqiqadan eski (saytdagi sariq banner bilan bir xil chegara)
  sync_stale   — data_calc_baseline.json oxirgi rejalashtirilgan sync'dan (04:00/09:00 UTC) eski
  file_stale   — GEN_FILES ro'yxatidagi fayllarning `gen` sanasi sync'dan eski (hozir ro'yxat bo'sh)
  site_down    — sayt bosh sahifasi 200 qaytarmayapti

Ogohlantirish har muammo uchun BITTA GitHub Issue (label `pipeline-alert`) sifatida yuritiladi:
muammo paydo bo'lsa ochiladi (+Telegram), tiklansa o'zi yopiladi (+Telegram). Takroriy spam yo'q.
Ochiq issue'lar Claude uchun ham ish navbati (matnida tekshirish havolalari bor).

Ishlatish:
  python health_watch.py              # haqiqiy rejim (GITHUB_TOKEN bo'lsa issue ochadi/yopadi)
  python health_watch.py --dry-run    # faqat natijani chiqaradi, hech narsa yozmaydi
  python health_watch.py --now 2026-09-29T10:30:00Z --dry-run   # vaqtni sinash uchun
"""
import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

REPO = os.environ.get("GITHUB_REPOSITORY", "Bilol2747/Tiin-Market")
SITE = "https://tiin-market.vercel.app"
LIVE_META_URL = f"https://raw.githubusercontent.com/{REPO}/live-data-latest/live/meta.json"
SYNC_SLOTS_UTC = (4, 9)     # sync.yml: Toshkent 09:00 va 14:00
SYNC_GRACE_MIN = 75         # sync (~9 daq) + deploy (~4 daq) + kechikish uchun zaxira
SLOT_TOLERANCE_MIN = 10     # dispatch bir necha daqiqa erta tushsa ham xato emas
LIVE_STALE_MIN = 40
LABEL = "pipeline-alert"
TG_CHAT_DEFAULT = "7034777747"
GEN_FILES = ()   # sync'da jim yiqilishi mumkin bo'lgan `gen` fayllar (hozir hech qaysi: firmalar/ta'minotchi qarzi ishlatilmaydi)


def parse_iso(s):
    return datetime.fromisoformat(str(s).replace("Z", "+00:00")).astimezone(timezone.utc)


def http(url, method="GET", headers=None, data=None, timeout=25, retries=3):
    """Matn qaytaradi; muvaffaqiyatsiz bo'lsa (retries marta urinib) xato ko'taradi."""
    last = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, data=data, method=method, headers=headers or {})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.status, resp.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as exc:
            last = exc
            if exc.code < 500:
                raise
        except Exception as exc:  # tarmoq
            last = exc
        time.sleep(3 * (attempt + 1))
    raise last


def gh(path, method="GET", body=None):
    token = os.environ.get("GITHUB_TOKEN", "")
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "tiin-health-watch"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode() if body is not None else None
    if data:
        headers["Content-Type"] = "application/json"
    _, text = http(f"https://api.github.com/repos/{REPO}{path}", method=method, headers=headers, data=data)
    return json.loads(text) if text else {}


def expected_slot(now):
    """Kamida SYNC_GRACE_MIN oldin bo'lgan ENG SO'NGGI sync vaqti (UTC).
    Shu vaqtdan keyin sayt yangi ma'lumot ko'rsatishi SHART."""
    cands = []
    for day_back in (0, 1, 2):
        d = (now - timedelta(days=day_back)).date()
        for h in SYNC_SLOTS_UTC:
            cands.append(datetime(d.year, d.month, d.day, h, 0, tzinfo=timezone.utc))
    ok = [c for c in cands if now - c >= timedelta(minutes=SYNC_GRACE_MIN)]
    return max(ok)


def recent_sync_runs():
    try:
        runs = gh("/actions/workflows/sync.yml/runs?per_page=3").get("workflow_runs", [])
        return "; ".join(
            f"{r['created_at'][5:16]}Z {r['event']} → {r['conclusion'] or r['status']}" for r in runs
        ) or "(ma'lumot yo'q)"
    except Exception as exc:
        return f"(sync tarixini o'qib bo'lmadi: {exc.__class__.__name__})"


def head_json(url, nbytes=400):
    """Katta faylning faqat boshini oladi (Range) — trafikni tejash uchun."""
    _, text = http(url, headers={"Range": f"bytes=0-{nbytes}", "Cache-Control": "no-cache"})
    return text


def run_checks(now):
    problems = {}  # kalit -> (sarlavha, tafsilot)
    runs_url = f"https://github.com/{REPO}/actions/workflows/sync.yml"

    # 1) jonli qatlam
    try:
        _, txt = http(LIVE_META_URL, headers={"Cache-Control": "no-cache"})
        pub = parse_iso(json.loads(txt)["published_at"])
        age = (now - pub).total_seconds() / 60
        if age > LIVE_STALE_MIN:
            problems["live_stale"] = (
                f"Jonli ma'lumot {age:.0f} daqiqa yangilanmagan",
                f"`live-data-latest/live/meta.json` oxirgi nashr: {pub:%Y-%m-%d %H:%M}Z (chegara {LIVE_STALE_MIN} daq). "
                "Ehtimol cron-job.org \"Jonli ma'lumot (15 daqiqa)\" vazifasi to'xtagan yoki "
                f"`live_data.yml` yiqilgan: https://github.com/{REPO}/actions/workflows/live_data.yml",
            )
    except Exception as exc:
        problems["live_stale"] = (
            "Jonli ma'lumot meta.json o'qilmadi",
            f"{LIVE_META_URL} → {exc.__class__.__name__}: {exc}",
        )

    # 2) sync yangiligi (sayt xizmat qilayotgan fayl bo'yicha — deploy'ni ham qamraydi)
    slot = expected_slot(now)
    slot_min = slot - timedelta(minutes=SLOT_TOLERANCE_MIN)
    try:
        base = parse_iso(json.loads(http(f"{SITE}/data_calc_baseline.json", headers={"Cache-Control": "no-cache"})[1])["at"])
        if base < slot_min:
            problems["sync_stale"] = (
                f"Sync/deploy kechikkan: sayt ma'lumoti {base:%Y-%m-%d %H:%M}Z",
                f"Kutilgan: kamida {slot:%Y-%m-%d %H:%M}Z sync'idan. Oxirgi sync ishga tushirishlar: {recent_sync_runs()}. "
                f"{runs_url} — Vercel deploy holatini ham tekshiring (commit status).",
            )
    except Exception as exc:
        problems["sync_stale"] = (
            "data_calc_baseline.json o'qilmadi (sayt/deploy muammosi bo'lishi mumkin)",
            f"{exc.__class__.__name__}: {exc}",
        )

    # 3) jim yiqiladigan qadamlar (continue-on-error): fayl `gen` sanasi sync'dan eskimi
    for fname in GEN_FILES:
        try:
            m = re.search(r'"gen"\s*:\s*"([^"]+)"', head_json(f"{SITE}/{fname}"))
            gen = parse_iso(m.group(1))
            if gen < slot_min:
                problems[f"file_stale:{fname}"] = (
                    f"{fname} yangilanmayapti (oxirgi: {gen:%Y-%m-%d})",
                    f"Fayl ichidagi `gen`={gen:%Y-%m-%d %H:%M}Z, kutilgan >= {slot:%Y-%m-%d %H:%M}Z. Sync qadami jimgina "
                    f"yiqilayotgan yoki fayl `sync.yml`dagi `git add` ro'yxatida yo'q bo'lishi mumkin. Oxirgi sync'lar: {recent_sync_runs()}.",
                )
        except Exception as exc:
            problems[f"file_stale:{fname}"] = (f"{fname} o'qilmadi", f"{exc.__class__.__name__}: {exc}")

    # 4) sayt ochiladimi
    try:
        status, _ = http(f"{SITE}/", method="HEAD", timeout=30)
        if status != 200:
            problems["site_down"] = (f"Sayt {status} qaytardi", f"{SITE}/ → HTTP {status}")
    except Exception as exc:
        problems["site_down"] = ("Sayt ochilmayapti", f"{SITE}/ → {exc.__class__.__name__}: {exc}")

    return problems


# ─── ogohlantirish: Issue (asosiy, Claude ham o'qiydi) + Telegram (ixtiyoriy) ───

def telegram(text):
    token = os.environ.get("TG_BOT_TOKEN") or os.environ.get("TG_ALERT_BOT_TOKEN") or ""
    chat = os.environ.get("TG_ALERT_CHAT_ID") or TG_CHAT_DEFAULT
    if not token:
        return
    try:
        http(f"https://api.telegram.org/bot{token}/sendMessage", method="POST",
             data=urllib.parse.urlencode({"chat_id": chat, "text": text}).encode(), retries=2)
    except Exception as exc:
        print(f"  ! Telegram yuborilmadi: {exc.__class__.__name__}")


def tag(key):
    return f"[health:{key}]"


def sync_issues(problems, now, dry):
    if dry or not os.environ.get("GITHUB_TOKEN"):
        for key, (title, detail) in problems.items():
            print(f"  MUAMMO {key}: {title}\n      {detail}")
        if not problems:
            print("  Hammasi joyida.")
        return
    open_issues = {}
    for it in gh(f"/issues?labels={LABEL}&state=open&per_page=50"):
        if "pull_request" in it:
            continue
        m = re.match(r"\[health:([^\]]+)\]", it["title"])
        if m:
            open_issues[m.group(1)] = it
    for key, (title, detail) in problems.items():
        if key in open_issues:
            print(f"  (davom etmoqda) {key}")
            continue
        body = (
            f"{detail}\n\n---\nAvtomatik ochildi: {now:%Y-%m-%d %H:%M}Z (`.github/scripts/health_watch.py`). "
            "Muammo tiklansa shu issue o'zi yopiladi."
        )
        gh("/issues", method="POST", body={"title": f"{tag(key)} {title}", "body": body, "labels": [LABEL]})
        telegram(f"🚨 Tiin Market: {title}\n{detail[:600]}")
        print(f"  OCHILDI {key}: {title}")
    for key, it in open_issues.items():
        if key not in problems:
            gh(f"/issues/{it['number']}/comments", method="POST", body={"body": f"✅ Tiklandi ({now:%Y-%m-%d %H:%M}Z), avtomatik tekshiruv o'tdi."})
            gh(f"/issues/{it['number']}", method="PATCH", body={"state": "closed"})
            telegram(f"✅ Tiin Market: tiklandi — {it['title']}")
            print(f"  YOPILDI {key}")
    if not problems and not open_issues:
        print("  Hammasi joyida.")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--now", help="ISO vaqt (sinash uchun)")
    args = ap.parse_args()
    now = parse_iso(args.now) if args.now else datetime.now(timezone.utc)
    print(f"Tekshiruv vaqti {now:%Y-%m-%d %H:%M}Z, kutilgan sync: {expected_slot(now):%Y-%m-%d %H:%M}Z")
    problems = run_checks(now)
    sync_issues(problems, now, args.dry_run)
    return 0


if __name__ == "__main__":
    sys.exit(main())
