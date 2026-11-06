/**
 * Small standalone HTML documents returned straight from route handlers:
 * social preview cards for crawlers, and the cloaking frame.
 */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface PreviewCardOptions {
  title: string;
  description?: string | null;
  image?: string | null;
  /** Canonical URL of the card: the short link itself. */
  url: string;
  siteName: string;
}

/** Open Graph / Twitter card for link-unfurling bots. Never redirects. */
export function previewCardHtml({ title, description, image, url, siteName }: PreviewCardOptions) {
  const t = escapeHtml(title);
  const d = description ? escapeHtml(description) : "";
  const tags = [
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${escapeHtml(siteName)}">`,
    `<meta property="og:title" content="${t}">`,
    `<meta property="og:url" content="${escapeHtml(url)}">`,
    `<meta name="twitter:title" content="${t}">`,
    `<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}">`,
  ];
  if (d) {
    tags.push(`<meta property="og:description" content="${d}">`);
    tags.push(`<meta name="twitter:description" content="${d}">`);
    tags.push(`<meta name="description" content="${d}">`);
  }
  if (image) {
    tags.push(`<meta property="og:image" content="${escapeHtml(image)}">`);
    tags.push(`<meta name="twitter:image" content="${escapeHtml(image)}">`);
  }

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${t}</title>
<meta name="robots" content="noindex">
${tags.join("\n")}
</head>
<body>
<h1>${t}</h1>
${d ? `<p>${d}</p>` : ""}
</body>
</html>`;
}

interface CloakOptions {
  url: string;
  title: string;
  hideReferrer: boolean;
}

/**
 * Full-viewport frame that keeps the short URL in the address bar. Sites that
 * send X-Frame-Options or a frame-ancestors CSP will refuse to render inside
 * it; the dashboard warns about that when cloaking is switched on.
 */
export function cloakHtml({ url, title, hideReferrer }: CloakOptions) {
  const policy = hideReferrer ? "no-referrer" : "strict-origin-when-cross-origin";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="${policy}">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)}</title>
<style>html,body{margin:0;height:100%;overflow:hidden;background:#fff}iframe{border:0;width:100%;height:100%;display:block}</style>
</head>
<body>
<iframe src="${escapeHtml(url)}" title="${escapeHtml(title)}" referrerpolicy="${policy}" allow="fullscreen; clipboard-write; autoplay; encrypted-media; picture-in-picture"></iframe>
</body>
</html>`;
}
