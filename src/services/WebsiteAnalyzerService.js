export class WebsiteAnalyzerService {
  async analyze(url) {
    if (!url || !url.startsWith("http")) return null;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      const html = await fetch(url, { signal: controller.signal }).then((response) =>
        response.text()
      );

      clearTimeout(timeout);

      const lower = html.toLowerCase();

      return {
        hasPricing:
          lower.includes("GBP") ||
          lower.includes("pound") ||
          lower.includes("price") ||
          lower.includes("pricing") ||
          lower.includes("service") ||
          lower.includes("£"),
        hasPackages:
          lower.includes("package") ||
          lower.includes("plan") ||
          lower.includes("membership") ||
          lower.includes("appointment") ||
          lower.includes("bundle") ||
          lower.includes("tier"),
        hasFacebook: lower.includes("facebook.com"),
        hasInstagram: lower.includes("instagram.com"),
        hasTiktok: lower.includes("tiktok.com"),
      };
    } catch {
      return {
        hasFacebook: false,
        hasInstagram: false,
        hasTiktok: false,
        hasPricing: false,
        hasPackages: false,
      };
    }
  }
}
