(function () {
  // sales_runtime.js'dagi _ensureInvData/_ensureP2Data/_ensureDailyDemand
  // birinchi navbatda `apiData.inventory`/`apiData.products`/`apiData.demand`ni
  // tekshiradi — shu yerda faqat `inventory`ni to'ldiramiz (Vercel'da JONLI,
  // backend/app.py: _live_invdata() — products+arrivals+sku_metrics
  // birlashtirilgan holda, bir necha ms'da). `products`/`demand` ATAYLAB
  // bo'sh qoldiriladi — ular hali faqat eski (soatlik) pipeline orqali
  // hisoblanadi, shuning uchun funksiyalar o'zi avtomatik ravishda eski
  // (embedded/statik) manbaga qaytadi — hech narsa buzilmaydi.
  const DEFAULT_BASE = "/api/v1";
  const timeoutMs = 60000;

  async function request(path) {
    if (location.protocol === "file:") throw new Error("local-file-mode");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(DEFAULT_BASE + path, {
        headers: { Accept: "application/json" },
        signal: controller.signal
      });
      if (!response.ok) throw new Error("HTTP " + response.status);
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  // 2026-09-23: invdata/kirimdata endi Vercel funksiyasi (/api/v1/...) o'rniga
  // GitHub `live-data-latest` tag'idan (`backend/publish_live_data.py` - har 15
  // daqiqada GitHub Actions'da yangilanadi, Vercel Compute UMUMAN ishlamaydi)
  // o'qiladi. Sabab: bu ikkalasi (invdata ~13MB, kirimdata ~20MB, har 15
  // daqiqada, ko'p tab/qurilma fonda ham) Vercel'ning "Fast Origin Transfer"
  // oylik kvotasini (Hobby, 10GB) bir necha kunda tugatib qo'ygan edi.
  // raw.githubusercontent.com tanlandi (jsdelivr 20MB+ faylni rad etadi):
  // gzip beradi, CORS ochiq (*), ~5 daqiqa keshlaydi (15 daqiqalik yangilanishga mos).
  const CDN_LIVE_BASE = "https://raw.githubusercontent.com/Bilol2747/Tiin-Market/live-data-latest/live";

  async function requestCdn(path) {
    if (location.protocol === "file:") throw new Error("local-file-mode");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(CDN_LIVE_BASE + path, { signal: controller.signal });
      if (!response.ok) throw new Error("HTTP " + response.status);
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  window.TiinDataAPI = {
    async bootstrap() {
      const inventory = await requestCdn("/invdata.json");
      return { inventory };
    },
    async kirimdata() {
      // live-data-latest tag'idagi static fayl doim TO'LIQ (delta yo'q - endi kerak emas,
      // Vercel Origin Transfer'ga umuman kirmaydi).
      return requestCdn("/kirimdata.json");
    },
    async health() {
      return request("/health");
    }
  };
})();
