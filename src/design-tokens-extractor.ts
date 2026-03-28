// ---------------------------------------------------------------------------
// Design tokens extractor — fetches a URL and extracts CSS custom properties
// ---------------------------------------------------------------------------

const FETCH_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Fetch a URL and extract CSS custom properties from its HTML and linked stylesheets.
 * Returns a `:root { ... }` CSS block containing all discovered `--*` properties.
 */
export async function extractDesignTokens(url: string): Promise<{ css: string; tokenCount: number }> {
  const html = await fetchWithLimits(url);

  // Collect all CSS text — inline <style> tags + linked stylesheets
  const cssTexts: string[] = [];

  // Extract inline <style> content
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let match: RegExpExecArray | null;
  while ((match = styleRegex.exec(html)) !== null) {
    cssTexts.push(match[1]);
  }

  // Extract <link rel="stylesheet"> hrefs and fetch them
  const linkRegex = /<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
  const linkRegex2 = /<link[^>]+href=["']([^"']+)["'][^>]*rel=["']stylesheet["'][^>]*>/gi;
  const hrefs = new Set<string>();

  for (const re of [linkRegex, linkRegex2]) {
    while ((match = re.exec(html)) !== null) {
      hrefs.add(match[1]);
    }
  }

  const baseUrl = new URL(url);
  const stylesheetFetches = Array.from(hrefs).map(async (href) => {
    try {
      const resolved = new URL(href, baseUrl).toString();
      const css = await fetchWithLimits(resolved);
      cssTexts.push(css);
    } catch {
      // Skip unreachable stylesheets
    }
  });

  await Promise.all(stylesheetFetches);

  // Extract all CSS custom properties (--name: value)
  const allCss = cssTexts.join("\n");
  const tokenMap = new Map<string, string>();
  const propRegex = /(--[\w-]+)\s*:\s*([^;}\n]+)/g;

  while ((match = propRegex.exec(allCss)) !== null) {
    const name = match[1].trim();
    const value = match[2].trim();
    // Keep the last occurrence (most specific)
    tokenMap.set(name, value);
  }

  if (tokenMap.size === 0) {
    throw new Error(`No CSS custom properties found at ${url}`);
  }

  // Build a clean :root block
  const lines = Array.from(tokenMap.entries()).map(
    ([name, value]) => `  ${name}: ${value};`,
  );
  const css = `:root {\n${lines.join("\n")}\n}\n`;

  return { css, tokenCount: tokenMap.size };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchWithLimits(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });

    if (!res.ok) {
      throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
    }

    const contentLength = res.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_BYTES) {
      throw new Error(`Response from ${url} exceeds ${MAX_RESPONSE_BYTES / 1024 / 1024}MB limit`);
    }

    const text = await res.text();
    if (text.length > MAX_RESPONSE_BYTES) {
      throw new Error(`Response from ${url} exceeds ${MAX_RESPONSE_BYTES / 1024 / 1024}MB limit`);
    }

    return text;
  } finally {
    clearTimeout(timeout);
  }
}
