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
  // 2026-08-15: 8000 -> 60000. 8 sekund JUDA QISQA edi va aynan shu sabab
  // sayt 13-avgustdagi ma'lumotni ko'rsatib turgan edi: /invdata endi
  // (Turso o'rniga) to'g'ridan-to'g'ri Invan API'dan o'qiydi, kesh sovuq
  // bo'lganda javob ~20-25s oladi (issiq bo'lsa ~5-7s). 8s'da so'rov
  // abort qilinib, `_ensureInvData()` (sales_runtime.js) HTML ichiga
  // joylashtirilgan ESKI statik ma'lumotga qaytardi - foydalanuvchiga
  // backend to'g'ri ishlasa ham hamma joyda eski raqamlar ko'rinardi.
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

  window.TiinDataAPI = {
    async bootstrap() {
      const inventory = await request("/invdata");
      return { inventory };
    },
    async kirimdata() {
      // /api/v1/kirimdata - _live_kirimdata() (backend/app.py), P8 (Zakas/
      // Kirim/Ta'minotchilar sahifalari) uchun. data_kirim.json bilan AYNAN
      // bir xil shakl ({skus: {...}}) - sales_runtime.js'da o'zgarishsiz
      // ishlatiladi.
      return request("/kirimdata");
    },
    async health() {
      return request("/health");
    }
  };
})();
