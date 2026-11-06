import { describe, expect, it } from "vitest";
import { cloakHtml, escapeHtml, previewCardHtml } from "@/lib/html";

const XSS = `"><script>alert(1)</script><x a='`;

describe("escapeHtml", () => {
  it("escapes all five HTML-significant characters", () => {
    expect(escapeHtml(`<a href="x" onclick='y'>&</a>`)).toBe(
      "&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;",
    );
  });

  it("escapes ampersands first so existing entities are not half-escaped", () => {
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
    expect(escapeHtml("a && b")).toBe("a &amp;&amp; b");
  });

  it("leaves safe text alone", () => {
    expect(escapeHtml("Hello, world 🚀")).toBe("Hello, world 🚀");
    expect(escapeHtml("")).toBe("");
  });
});

describe("previewCardHtml", () => {
  const base = { title: "Launch", url: "https://lnk.example/abc", siteName: "Linkly" };

  it("escapes the title everywhere it appears", () => {
    const html = previewCardHtml({ ...base, title: XSS });
    expect(html).not.toContain("<script>");
    const escaped = escapeHtml(XSS);
    expect(html).toContain(`<title>${escaped}</title>`);
    expect(html).toContain(`<meta property="og:title" content="${escaped}">`);
    expect(html).toContain(`<meta name="twitter:title" content="${escaped}">`);
    expect(html).toContain(`<h1>${escaped}</h1>`);
  });

  it("escapes and repeats the description in every description tag", () => {
    const html = previewCardHtml({ ...base, description: XSS });
    const escaped = escapeHtml(XSS);
    expect(html).not.toContain("<script>");
    expect(html).toContain(`<meta property="og:description" content="${escaped}">`);
    expect(html).toContain(`<meta name="twitter:description" content="${escaped}">`);
    expect(html).toContain(`<meta name="description" content="${escaped}">`);
    expect(html).toContain(`<p>${escaped}</p>`);
  });

  it.each([null, undefined, ""])("omits description tags for %o", (description) => {
    const html = previewCardHtml({ ...base, description });
    expect(html).not.toContain("description");
    expect(html).not.toContain("<p>");
  });

  it("uses a large image card and escapes the image URL", () => {
    const image = `https://cdn.example.com/og.png?a=1&b="2"`;
    const html = previewCardHtml({ ...base, image });
    const escaped = "https://cdn.example.com/og.png?a=1&amp;b=&quot;2&quot;";
    expect(html).toContain(`<meta name="twitter:card" content="summary_large_image">`);
    expect(html).toContain(`<meta property="og:image" content="${escaped}">`);
    expect(html).toContain(`<meta name="twitter:image" content="${escaped}">`);
  });

  it.each([null, undefined, ""])("uses a summary card without an image for %o", (image) => {
    const html = previewCardHtml({ ...base, image });
    expect(html).toContain(`<meta name="twitter:card" content="summary">`);
    expect(html).not.toContain("og:image");
    expect(html).not.toContain("twitter:image");
  });

  it("escapes the site name and canonical URL", () => {
    const html = previewCardHtml({
      ...base,
      siteName: `A&B "Links"`,
      url: `https://lnk.example/a"b`,
    });
    expect(html).toContain(`<meta property="og:site_name" content="A&amp;B &quot;Links&quot;">`);
    expect(html).toContain(`<meta property="og:url" content="https://lnk.example/a&quot;b">`);
  });

  it("is a static, non-indexable page that never redirects", () => {
    const html = previewCardHtml({
      ...base,
      description: "d",
      image: "https://cdn.example.com/x.png",
    });
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain(`<meta name="robots" content="noindex">`);
    expect(html).not.toMatch(/http-equiv|<script|location\s*=/i);
  });
});

describe("cloakHtml", () => {
  it("escapes the destination inside the iframe src", () => {
    const html = cloakHtml({
      url: `https://example.com/?a=1&b=${XSS}`,
      title: "t",
      hideReferrer: false,
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain(`<iframe src="https://example.com/?a=1&amp;b=${escapeHtml(XSS)}"`);
  });

  it("escapes the title in the document and the iframe", () => {
    const html = cloakHtml({ url: "https://example.com/", title: XSS, hideReferrer: false });
    const escaped = escapeHtml(XSS);
    expect(html).not.toContain("<script>");
    expect(html).toContain(`<title>${escaped}</title>`);
    expect(html).toContain(`title="${escaped}"`);
  });

  it("sends no referrer at all when hideReferrer is on", () => {
    const html = cloakHtml({ url: "https://example.com/", title: "t", hideReferrer: true });
    expect(html).toContain(`<meta name="referrer" content="no-referrer">`);
    expect(html).toContain(`referrerpolicy="no-referrer"`);
    expect(html).not.toContain("strict-origin-when-cross-origin");
  });

  it("uses the browser default policy otherwise", () => {
    const html = cloakHtml({ url: "https://example.com/", title: "t", hideReferrer: false });
    expect(html).toContain(`<meta name="referrer" content="strict-origin-when-cross-origin">`);
    expect(html).toContain(`referrerpolicy="strict-origin-when-cross-origin"`);
    expect(html).not.toContain(`"no-referrer"`);
  });

  it("keeps cloaked pages out of search indexes", () => {
    expect(cloakHtml({ url: "https://example.com/", title: "t", hideReferrer: false })).toContain(
      `<meta name="robots" content="noindex">`,
    );
  });
});
