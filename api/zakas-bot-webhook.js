// ─────────────────────────────────────────────────────────────────────────
// Vercel Serverless Funksiya: "Zakas kuzatuvchi" (proaktiv ogohlantirish)
// uchun ALOHIDA Telegram bot webhooki.
// ─────────────────────────────────────────────────────────────────────────
// `api/telegram-webhook.js` (Excel tashlab zakas berish boti) bilan
// ARALASHTIRILMASIN deb ATAYLAB alohida qilingan (foydalanuvchi so'rovi,
// 2026-09-05): o'sha bot faqat Excel fayl + tasdiqlash uchun, bu bot esa
// FAQAT stok kam qolgan ta'minotchilar haqida o'zi xabar beradi, tugma
// bosilganda "necha kunlik zakas" so'raydi va `/`-buyruqlar bilan boshqariladi.
//
// SOZLAMALAR - har biri ALOHIDA buyruq (foydalanuvchi so'rovi, 2026-09-08:
// "/" bosganda hammasi ro'yxatda ko'rinsin, erkin matn yozish shart bo'lmasin):
//   /sozlamalar        - joriy sozlamalarni ko'rsatadi
//   /chegara <son>     - necha kun qolganda ogohlantirish (argumentsiz - yordam)
//   /kategoriya <ro'yxat yoki "hammasi">  - qaysi kategoriyalarni kuzatish
//   /yoqish            - ogohlantirishni yoqadi
//   /ochirish          - ogohlantirishni o'chiradi
// Har biri ARGUMENT bilan yozilsa DARHOL qo'llanadi (masalan "/chegara 7") -
// "javob kutish" holati (eski "settings_menu") shu sabab endi umuman KERAK
// EMAS - oddiyroq va ADASHTIRMAYDI (avvalgi "kategoriya:"/"kategoriyalar:"
// kabi erkin matn xatosi endi mumkin emas).
//
// Bot komandalar ro'yxati (Telegram "/" menyusi) - setup/register_commands.js
// orqali BIR MARTA ro'yxatdan o'tkaziladi (setMyCommands).
//
// Og'ir ish (Invan bilan solishtirish, buyurtma yaratish) BU YERDA EMAS -
// xuddi eski botdagidek, `.github/workflows/telegram_zakas.yml` orqali
// GitHub Actions'da (`zakas/telegram_bot_runner.js`, --kind pick_supplier).
// Shu bitta workflow ikkala bot uchun ham umumiy - runner qaysi bot
// tokenidan javob berishni pending holatidagi "source" maydonidan biladi.
//
// Kerakli Environment Variables (Vercel → Settings → Environment Variables):
//   TELEGRAM_ZAKAS_BOT_TOKEN = MAJBURIY — YANGI botning o'z tokeni (@BotFather).
//   GITHUB_PAT               = MAJBURIY — eski webhook bilan BIR XIL sir.
//   ZAKAS_BOT_WEBHOOK_SECRET = (ixtiyoriy) — setWebhook'dagi secret_token bilan
//                              bir xil bo'lishi kerak.
// Reja: C:\Users\User\.claude\plans\replicated-plotting-hoare.md
// ─────────────────────────────────────────────────────────────────────────

const GITHUB_REPO = "Bilol2747/Tiin-Market";
const GITHUB_API = "https://api.github.com";
// Buyurtmani tasdiqlash/bekor qilish so'zlari - eski webhookdagi bilan bir xil.
const YES_RE = /^(ha|ha\.|xa|xa\.|hop|mayli|ok|okay|yes|tasdiq|tasdiqla|tasdiqlayman|tasdiqlaymiz|davom|davom et|yarat|zakas ber|zakas bering|zakas berila|buyurtma ber|buyurtma bering|buyurtma yarat)$/i;
const NO_RE = /^(yo'q|yoq|yo'q\.|yoq\.|bekor|bekor qil|bekor qiling|kerakmas|kerak emas|to'xta|toxta|cancel|no)$/i;

function botToken() {
  const t = process.env.TELEGRAM_ZAKAS_BOT_TOKEN;
  if (!t) throw new Error("TELEGRAM_ZAKAS_BOT_TOKEN o'rnatilmagan");
  return t;
}
function githubToken() {
  const t = process.env.GITHUB_PAT;
  if (!t) throw new Error("GITHUB_PAT o'rnatilmagan");
  return t;
}

async function tgCall(method, body) {
  const r = await fetch(`https://api.telegram.org/bot${botToken()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  const data = await r.json().catch(() => ({}));
  if (!data.ok) throw new Error(`Telegram ${method} -> ${JSON.stringify(data).slice(0, 300)}`);
  return data.result;
}
function sendMessage(chatId, text) {
  return tgCall("sendMessage", { chat_id: chatId, text });
}
function answerCallbackQuery(id, text) {
  return tgCall("answerCallbackQuery", { callback_query_id: id, text: text || undefined }).catch(() => {});
}

// ─── Zakas kuzatuvchi holati (sozlamalar/navbat) — Turso, api/zakas-watch.py ──
const WATCH_ENDPOINT = "https://tiin-market.vercel.app/api/zakas-watch";
async function watchGet(action, params) {
  const qs = new URLSearchParams({ action, ...(params || {}) });
  const r = await fetch(`${WATCH_ENDPOINT}?${qs.toString()}`, { cache: "no-store" });
  const d = await r.json().catch(() => ({}));
  if (!d.ok) throw new Error(d.error || "zakas-watch GET xato");
  return d;
}
async function watchPost(body) {
  const r = await fetch(WATCH_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!d.ok) throw new Error(d.error || "zakas-watch POST xato");
  return d;
}
async function getWatchPendingSafe(chatId) {
  try { const d = await watchGet("pending", { chat_id: String(chatId) }); return d.pending; }
  catch (e) { console.error("zakas-watch pending o'qilmadi:", e.message); return null; }
}
// Guruh chatida oddiy suhbat davom etaveradi - "javob kutilmoqda" holati abadiy
// osilib qolmasligi uchun 10 daqiqadan eskisi E'TIBORGA OLINMAYDI. Endi FAQAT
// "await_days" (tugma bosilgach kun so'rash) shu holatga tushadi - boshqa
// barcha sozlamalar (/chegara, /kategoriya, /yoqish, /ochirish) argumentini
// BUYRUQNING O'ZIDA oladi, "javob kutish" bosqichi kerak emas.
// 2026-09-08: 10 daqiqa REAL foydalanishda kamlik qildi - foydalanuvchi
// tugma bosib, sonni yozguncha 19 daqiqa o'tib ketgan (ish jarayonida
// tabiiy tanaffus) va javob "eskirgan" deb e'tiborsiz qoldirilgan edi.
const WATCH_PENDING_TTL_MS = 30 * 60 * 1000;
function isPendingFresh(pending) {
  if (!pending) return false;
  const age = Date.now() - new Date(pending.created_at || 0).getTime();
  return age >= 0 && age <= WATCH_PENDING_TTL_MS;
}

async function ghApi(path, opts) {
  const r = await fetch(GITHUB_API + path, {
    ...(opts || {}),
    headers: {
      Authorization: "Bearer " + githubToken(),
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      ...((opts && opts.headers) || {}),
    },
  });
  const text = await r.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  if (!r.ok) {
    const detail = typeof body === "string" ? body : JSON.stringify(body);
    throw new Error(`GitHub ${path} -> ${r.status}: ${detail.slice(0, 300)}`);
  }
  return body;
}
// Eski botdagi BILAN BIR XIL workflow (telegram_zakas.yml) - runner har
// `--kind`ni o'zi ajratadi, ikkita bot uchun ikkita alohida workflow shart emas.
async function dispatchWorkflow(inputs) {
  await ghApi(`/repos/${GITHUB_REPO}/actions/workflows/telegram_zakas.yml/dispatches`, {
    method: "POST",
    body: JSON.stringify({ ref: "main", inputs }),
  });
}

function settingsText(s) {
  return `⚙️ Zakas kuzatuvchi sozlamalari:\n` +
    `• Holat: ${s.enabled ? "yoqilgan" : "o'chirilgan"}\n` +
    `• Chegara: ${s.threshold_days} kun (shu va undan kam qolsa ogohlantiradi)\n` +
    `• Kategoriya filtri: ${s.watched_categories.length ? s.watched_categories.join(", ") : "hammasi"}\n\n` +
    `Buyruqlar ("/" yozganda ro'yxatda ham ko'rinadi):\n` +
    `  /chegara 7 - chegarani 7 kunga o'zgartirish\n` +
    `  /kategoriya suvlar, sut - faqat shu kategoriyalarni kuzatish\n` +
    `  /kategoriya hammasi - barcha kategoriyani kuzatish\n` +
    `  /yoqish - ogohlantirishni yoqish\n` +
    `  /ochirish - ogohlantirishni o'chirish`;
}

// "/" bilan boshlanuvchi xabarni {cmd, arg} ga ajratadi. Guruh chatlarida
// Telegram ba'zan "/chegara@zakas_controller_bot 7" kabi bot nomini
// qo'shib yuboradi - shu ham to'g'ri ajratiladi.
function parseCommand(t) {
  const m = /^\/(\w+)(?:@\S+)?(?:\s+([\s\S]*))?$/.exec(t.trim());
  if (!m) return null;
  return { cmd: m[1].toLowerCase(), arg: (m[2] || "").trim() };
}

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    res.status(200).json({ ok: true, msg: "Zakas kuzatuvchi bot webhooki tayyor" });
    return;
  }
  if (req.method !== "POST") { res.status(405).json({ ok: false, error: "Faqat POST" }); return; }

  const expectedSecret = process.env.ZAKAS_BOT_WEBHOOK_SECRET;
  if (expectedSecret && req.headers["x-telegram-bot-api-secret-token"] !== expectedSecret) {
    res.status(401).json({ ok: false, error: "Ruxsat yo'q" });
    return;
  }

  try {
    let update = req.body;
    if (typeof update === "string") update = JSON.parse(update || "{}");
    update = update || {};

    const msg = update.message;
    const cbq = update.callback_query;

    // ── Ta'minotchi tugmasi bosildi ("wsup:<indeks>") ──────────────────────
    if (cbq && cbq.data && cbq.data.startsWith("wsup:")) {
      const chatId = cbq.message && cbq.message.chat && cbq.message.chat.id;
      await answerCallbackQuery(cbq.id);
      if (chatId != null) {
        try {
          const idx = cbq.data.slice(5);
          const pending = await getWatchPendingSafe(chatId);
          // token_map "alert_sent" bilan yoziladi, lekin tugma bosilgach holat
          // "await_days"ga o'tadi - avval shu payt token_map yo'qolib, XUDDI
          // SHU tugmani (yoki eski xabardagi boshqasini) qayta bossa "eskirgan"
          // deb chiqib qolardi (2026-09-08, real foydalanuvchi holatida
          // ko'rildi: birinchi javob "kun soni" muddati o'tib ketgach, tugmani
          // qayta bosolmagan). Endi token_map HAR safar pending_set'ga BIRGA
          // yuboriladi - shu bilan "kind"dan qat'i nazar doim saqlanib qoladi.
          const supplier = pending && pending.token_map ? pending.token_map[idx] : null;
          if (!supplier) {
            await sendMessage(chatId, "Bu tugma eskirgan (yangi ogohlantirish kelgan) - iltimos yangi xabardagi tugmani bosing.");
          } else {
            await watchPost({ action: "pending_set", chat_id: String(chatId), kind: "await_days", supplier, token_map: pending.token_map });
            await sendMessage(chatId, `🏢 ${supplier}\nNecha kunlik zakas tayyorlaylik? Son yozing (masalan: 20)`);
          }
        } catch (e) {
          console.error("wsup callback xatolik:", e.message);
          await sendMessage(chatId, `⚠️ Xatolik chiqdi: ${e.message}`);
        }
      }
      res.status(200).json({ ok: true });
      return;
    }

    if (msg && msg.chat) {
      const chatId = msg.chat.id;
      try {
        if (typeof msg.text === "string") {
          const t = msg.text.trim();
          const parsed = t.startsWith("/") ? parseCommand(t) : null;

          if (parsed && (parsed.cmd === "sozlamalar" || parsed.cmd === "start" || parsed.cmd === "holat")) {
            const s = (await watchGet("settings", { chat_id: String(chatId) })).settings;
            await sendMessage(chatId, settingsText(s));
            res.status(200).json({ ok: true });
            return;
          }

          if (parsed && parsed.cmd === "chegara") {
            if (!/^\d+$/.test(parsed.arg)) {
              await sendMessage(chatId, "Foydalanish: /chegara 7  (masalan, 7 kun yoki kamroq qolganda ogohlantirish)");
            } else {
              await watchPost({ action: "settings_set", chat_id: String(chatId), threshold_days: parseInt(parsed.arg, 10) });
              await sendMessage(chatId, `✅ Chegara ${parsed.arg} kunga o'zgartirildi.`);
            }
            res.status(200).json({ ok: true });
            return;
          }

          if (parsed && parsed.cmd === "kategoriya") {
            if (!parsed.arg) {
              const s = (await watchGet("settings", { chat_id: String(chatId) })).settings;
              await sendMessage(chatId,
                `Joriy kategoriya filtri: ${s.watched_categories.length ? s.watched_categories.join(", ") : "hammasi"}\n\n` +
                `Foydalanish: /kategoriya suvlar, sut  (yoki: /kategoriya hammasi)`);
            } else {
              const cats = /^hammasi$/i.test(parsed.arg) ? [] : parsed.arg.split(",").map(s => s.trim()).filter(Boolean);
              await watchPost({ action: "settings_set", chat_id: String(chatId), watched_categories: cats });
              await sendMessage(chatId, cats.length ? `✅ Kategoriya filtri: ${cats.join(", ")}` : "✅ Kategoriya filtri o'chirildi - endi hammasi kuzatiladi.");
            }
            res.status(200).json({ ok: true });
            return;
          }

          if (parsed && (parsed.cmd === "yoqish" || parsed.cmd === "ochirish")) {
            const enabled = parsed.cmd === "yoqish";
            await watchPost({ action: "settings_set", chat_id: String(chatId), enabled });
            await sendMessage(chatId, enabled ? "✅ Ogohlantirish yoqildi." : "✅ Ogohlantirish o'chirildi.");
            res.status(200).json({ ok: true });
            return;
          }

          // Kutilayotgan (pending) holat - FAQAT tugma bosilgach "necha kun?"
          // savoliga javob uchun qoldi (boshqa sozlamalar endi buyruqning o'zida).
          const watchPendingRaw = await getWatchPendingSafe(chatId);
          const watchPending = isPendingFresh(watchPendingRaw) ? watchPendingRaw : null;
          if (watchPending && watchPending.kind === "await_days") {
            const days = parseInt(t, 10);
            if (Number.isFinite(days) && days > 0 && String(days) === t.replace(/\s+/g, "")) {
              await watchPost({ action: "pending_clear", chat_id: String(chatId) });
              await sendMessage(chatId, `⏳ ${watchPending.supplier} uchun ${days} kunlik zakas tayyorlayapman...`);
              await dispatchWorkflow({
                chat_id: String(chatId), kind: "pick_supplier",
                supplier: watchPending.supplier, days: String(days),
              });
              res.status(200).json({ ok: true });
              return;
            }
            await sendMessage(chatId, "Iltimos, kun sonini yozing (masalan: 20).");
            res.status(200).json({ ok: true });
            return;
          }

          // Tanlangan ta'minotchi uchun tayyorlangan ro'yxatni tasdiqlash/bekor
          // qilish - handlePickSupplier() yozgan pending (telegram_pending/<chat>.json,
          // source:"watch") GitHub Actions'dagi confirm/cancel orqali qayta
          // ishlanadi (eski bot bilan bir xil workflow).
          if (YES_RE.test(t)) {
            await dispatchWorkflow({ chat_id: String(chatId), kind: "confirm" });
          } else if (NO_RE.test(t)) {
            await dispatchWorkflow({ chat_id: String(chatId), kind: "cancel" });
          } else if (parsed) {
            await sendMessage(chatId, "Noma'lum buyruq. /sozlamalar yozing - barcha buyruqlar ro'yxati chiqadi.");
          } else if (/^\d+$/.test(t)) {
            // Sof son yuborilgan, lekin "necha kunlik zakas?" savoliga JAVOB
            // sifatida tanilmadi (pending yo'q yoki 30 daqiqadan eskirgan) -
            // bunday holatda AVVAL jim qolinardi, foydalanuvchi hech narsa
            // tushunmasdi (2026-09-08, real foydalanuvchi shikoyati). Endi
            // aniq sabab aytiladi.
            await sendMessage(chatId, "Bu raqamni qayerga tegishli ekanini bilmadim - avval xabardagi ta'minotchi tugmasini bosing, keyin kun sonini yozing.");
          }
          // Qolgan oddiy xabarlarga javob qaytarmaymiz - guruh suhbatiga aralashmaslik uchun.
        }
      } catch (inner) {
        console.error("zakas-bot-webhook ichki xatolik:", inner && inner.message);
        try { await sendMessage(chatId, `⚠️ Xatolik chiqdi: ${inner && inner.message || inner}`); } catch { /* Telegram ham ishlamasa qila olmaymiz */ }
      }
    }

    res.status(200).json({ ok: true });
  } catch (e) {
    console.error("zakas-bot-webhook xatolik:", e && e.message);
    res.status(200).json({ ok: false, error: String(e && e.message || e) });
  }
};
