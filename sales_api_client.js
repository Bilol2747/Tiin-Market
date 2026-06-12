(function () {
  const DEFAULT_BASE = "/api/v1";
  const timeoutMs = 8000;

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
      return request("/bootstrap");
    },
    async health() {
      return request("/health");
    },
    async product(sku) {
      return request("/products?sku=" + encodeURIComponent(sku));
    },
    async demand(sku) {
      return request("/demand?sku=" + encodeURIComponent(sku));
    },
    async stock(sku) {
      return request("/stocks?sku=" + encodeURIComponent(sku));
    }
  };
})();
