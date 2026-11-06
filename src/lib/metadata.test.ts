import { beforeEach, describe, expect, it, vi } from "vitest";
import { decodeEntities, fetchPageMetadata, parseHtmlMetadata } from "@/lib/metadata";
import { safeFetch } from "@/lib/safe-fetch";

// fetchPageMetadata must never reach the network from a test.
vi.mock("@/lib/safe-fetch", () => ({ safeFetch: vi.fn() }));

const BASE = "https://example.com/blog/post";

function doc(head: string, body = ""): string {
  return `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;
}

describe("parseHtmlMetadata", () => {
  describe("title", () => {
    it("prefers og:title over twitter:title and <title>", () => {
      const html = doc(
        `<title>Tag</title><meta name="twitter:title" content="Twitter"><meta property="og:title" content="OG">`,
      );
      expect(parseHtmlMetadata(html, BASE).title).toBe("OG");
    });

    it("falls back to twitter:title, then the <title> tag", () => {
      expect(
        parseHtmlMetadata(
          doc(`<title>Tag</title><meta name="twitter:title" content="Twitter">`),
          BASE,
        ).title,
      ).toBe("Twitter");
      expect(parseHtmlMetadata(doc(`<title lang="en">Tag</title>`), BASE).title).toBe("Tag");
    });

    /*
     * Regression: an empty og:title was stored and shadowed every fallback, so
     * a page with a perfectly good <title> came back untitled.
     */
    it("skips an empty or blank og:title in favour of the fallbacks", () => {
      expect(
        parseHtmlMetadata(
          doc(`<meta property="og:title" content=""><title>Real title</title>`),
          BASE,
        ).title,
      ).toBe("Real title");
      expect(
        parseHtmlMetadata(
          doc(
            `<meta property="og:title" content="   "><meta name="twitter:title" content="Twitter">`,
          ),
          BASE,
        ).title,
      ).toBe("Twitter");
    });

    it("uses the first non-empty occurrence of a repeated tag", () => {
      const html = doc(
        `<meta property="og:title" content="First"><meta property="og:title" content="Second">`,
      );
      expect(parseHtmlMetadata(html, BASE).title).toBe("First");
    });

    it("collapses whitespace", () => {
      expect(parseHtmlMetadata(doc("<title>\n   Hello\t\t  World \n</title>"), BASE).title).toBe(
        "Hello World",
      );
    });

    it("decodes entities, including numeric and hex references", () => {
      const html = doc(
        "<title>Tom &amp; Jerry &#8211; &quot;Cartoon&quot; &#x1F600; &lt;b&gt; it&#39;s&nbsp;here</title>",
      );
      expect(parseHtmlMetadata(html, BASE).title).toBe(`Tom & Jerry – "Cartoon" 😀 <b> it's here`);
    });

    it("truncates to 200 characters", () => {
      const html = doc(`<meta property="og:title" content="${"t".repeat(300)}">`);
      expect(parseHtmlMetadata(html, BASE).title).toBe("t".repeat(200));
    });

    it("is null when the page has no title at all", () => {
      expect(parseHtmlMetadata(doc(""), BASE).title).toBeNull();
      expect(parseHtmlMetadata(doc("<title>   </title>"), BASE).title).toBeNull();
    });
  });

  describe("description", () => {
    it("prefers og:description, then twitter:description, then description", () => {
      const all = `<meta name="description" content="Plain"><meta name="twitter:description" content="Twitter"><meta property="og:description" content="OG">`;
      expect(parseHtmlMetadata(doc(all), BASE).description).toBe("OG");
      expect(
        parseHtmlMetadata(
          doc(
            `<meta name="description" content="Plain"><meta name="twitter:description" content="Twitter">`,
          ),
          BASE,
        ).description,
      ).toBe("Twitter");
      expect(
        parseHtmlMetadata(doc(`<meta name="description" content="Plain">`), BASE).description,
      ).toBe("Plain");
    });

    it("reads a microdata itemprop description", () => {
      expect(
        parseHtmlMetadata(doc(`<meta itemprop="description" content="Micro">`), BASE).description,
      ).toBe("Micro");
    });

    it("skips an empty og:description in favour of the plain description", () => {
      expect(
        parseHtmlMetadata(
          doc(
            `<meta property="og:description" content=""><meta name="description" content="Plain">`,
          ),
          BASE,
        ).description,
      ).toBe("Plain");
    });

    it("truncates to 500 characters", () => {
      const html = doc(`<meta name="description" content="${"d".repeat(600)}">`);
      expect(parseHtmlMetadata(html, BASE).description).toBe("d".repeat(500));
    });
  });

  describe("meta tag syntax", () => {
    it.each([
      [`<meta content="Reordered" property="og:title">`, "Reordered"],
      [`<meta property='og:title' content='Single'>`, "Single"],
      [`<meta property=og:title content=Unquoted>`, "Unquoted"],
      [`<META PROPERTY="og:title" CONTENT="Shouting">`, "Shouting"],
      [`<meta property="OG:Title" content="MixedKey">`, "MixedKey"],
      [`<meta property="og:title" content="Closed" />`, "Closed"],
      [`<meta data-x="1" property = "og:title"  content = "Spaced" data-y="2">`, "Spaced"],
      [`<meta property="og:title" content='He said "hi"'>`, `He said "hi"`],
      [
        `<meta name="description" content="a=b"><meta property="og:title" content="After">`,
        "After",
      ],
    ])("reads %s", (tag, expected) => {
      expect(parseHtmlMetadata(doc(tag), BASE).title).toBe(expected);
    });
  });

  describe("image", () => {
    it("prefers og:image, then og:image:url, then twitter:image", () => {
      const twitter = `<meta name="twitter:image" content="https://cdn.example.com/twitter.png">`;
      const ogUrl = `<meta property="og:image:url" content="https://cdn.example.com/og-url.png">`;
      const og = `<meta property="og:image" content="https://cdn.example.com/og.png">`;
      expect(parseHtmlMetadata(doc(twitter + ogUrl + og), BASE).image).toBe(
        "https://cdn.example.com/og.png",
      );
      expect(parseHtmlMetadata(doc(twitter + ogUrl), BASE).image).toBe(
        "https://cdn.example.com/og-url.png",
      );
      expect(parseHtmlMetadata(doc(twitter), BASE).image).toBe(
        "https://cdn.example.com/twitter.png",
      );
    });

    it.each([
      ["/img/card.png", "https://example.com/img/card.png"],
      ["card.png", "https://example.com/blog/card.png"],
      ["//cdn.example.com/x.png", "https://cdn.example.com/x.png"],
      ["  /padded.png  ", "https://example.com/padded.png"],
    ])("resolves the relative image %o against the page URL", (src, expected) => {
      expect(
        parseHtmlMetadata(doc(`<meta property="og:image" content="${src}">`), BASE).image,
      ).toBe(expected);
    });

    it("decodes entities in the image URL", () => {
      const html = doc(
        `<meta property="og:image" content="https://cdn.example.com/i.png?w=1200&amp;h=630">`,
      );
      expect(parseHtmlMetadata(html, BASE).image).toBe(
        "https://cdn.example.com/i.png?w=1200&h=630",
      );
    });

    it.each(["javascript:alert(1)", "data:image/png;base64,AAAA", "ftp://example.com/x.png"])(
      "drops the non-http image %s",
      (src) => {
        expect(
          parseHtmlMetadata(doc(`<meta property="og:image" content="${src}">`), BASE).image,
        ).toBeNull();
      },
    );

    it("skips an empty og:image in favour of twitter:image", () => {
      const html = doc(
        `<meta property="og:image" content=""><meta name="twitter:image" content="https://cdn.example.com/t.png">`,
      );
      expect(parseHtmlMetadata(html, BASE).image).toBe("https://cdn.example.com/t.png");
    });

    it("is null without any image tag", () => {
      expect(parseHtmlMetadata(doc("<title>x</title>"), BASE).image).toBeNull();
    });
  });

  describe("favicon", () => {
    it("resolves a relative rel=icon", () => {
      const html = doc(`<link rel="icon" href="/static/icon.png">`);
      expect(parseHtmlMetadata(html, BASE).favicon).toBe("https://example.com/static/icon.png");
    });

    it('accepts rel="shortcut icon" and a page-relative href', () => {
      const html = doc(`<link rel="shortcut icon" href="favicon.png">`);
      expect(parseHtmlMetadata(html, BASE).favicon).toBe("https://example.com/blog/favicon.png");
    });

    it("matches rel case-insensitively", () => {
      const html = doc(`<LINK REL="ICON" HREF="/upper.ico">`);
      expect(parseHtmlMetadata(html, BASE).favicon).toBe("https://example.com/upper.ico");
    });

    it("falls back to apple-touch-icon", () => {
      const html = doc(`<link rel="apple-touch-icon" href="/apple.png">`);
      expect(parseHtmlMetadata(html, BASE).favicon).toBe("https://example.com/apple.png");
    });

    it("prefers rel=icon over apple-touch-icon in either order", () => {
      const apple = `<link rel="apple-touch-icon" href="/apple.png">`;
      const icon = `<link rel="icon" href="/icon.png">`;
      expect(parseHtmlMetadata(doc(apple + icon), BASE).favicon).toBe(
        "https://example.com/icon.png",
      );
      expect(parseHtmlMetadata(doc(icon + apple), BASE).favicon).toBe(
        "https://example.com/icon.png",
      );
    });

    it("ignores links that are not icons", () => {
      const html = doc(`<link rel="stylesheet" href="/site.css"><link rel="icon">`);
      expect(parseHtmlMetadata(html, BASE).favicon).toBe("https://example.com/favicon.ico");
    });

    it("defaults to /favicon.ico at the site root", () => {
      expect(parseHtmlMetadata(doc(""), BASE).favicon).toBe("https://example.com/favicon.ico");
    });
  });

  describe("site name", () => {
    it("reads og:site_name and truncates to 100 characters", () => {
      expect(
        parseHtmlMetadata(doc(`<meta property="og:site_name" content="Example">`), BASE).siteName,
      ).toBe("Example");
      expect(
        parseHtmlMetadata(doc(`<meta property="og:site_name" content="${"s".repeat(150)}">`), BASE)
          .siteName,
      ).toBe("s".repeat(100));
    });

    it("is null when absent", () => {
      expect(parseHtmlMetadata(doc(""), BASE).siteName).toBeNull();
    });
  });

  describe("document scope", () => {
    it("ignores tags after </head>", () => {
      const html = doc(
        `<title>Head title</title>`,
        `<title>Body title</title><meta property="og:title" content="Body OG"><meta property="og:image" content="/body.png"><link rel="icon" href="/body.ico">`,
      );
      expect(parseHtmlMetadata(html, BASE)).toEqual({
        title: "Head title",
        description: null,
        image: null,
        favicon: "https://example.com/favicon.ico",
        siteName: null,
      });
    });

    it("matches </HEAD> case-insensitively", () => {
      const html = `<html><HEAD><title>In</title></HEAD><body><meta property="og:title" content="Out"></body></html>`;
      expect(parseHtmlMetadata(html, BASE).title).toBe("In");
    });

    it("scans the document when there is no </head>", () => {
      const html = `<title>No head</title><meta property="og:title" content="Found">`;
      expect(parseHtmlMetadata(html, BASE).title).toBe("Found");
    });

    it("returns only the favicon default for an empty document", () => {
      expect(parseHtmlMetadata("", BASE)).toEqual({
        title: null,
        description: null,
        image: null,
        favicon: "https://example.com/favicon.ico",
        siteName: null,
      });
    });
  });
});

describe("decodeEntities", () => {
  it.each([
    ["&amp;", "&"],
    ["&lt;", "<"],
    ["&gt;", ">"],
    ["&quot;", '"'],
    ["&apos;", "'"],
    ["&nbsp;", " "],
    ["&AMP;", "&"],
    ["&#39;", "'"],
    ["&#8217;", "’"],
    ["&#x27;", "'"],
    ["&#X41;", "A"],
    ["&#x1F600;", "😀"],
  ])("decodes %s", (input, expected) => {
    expect(decodeEntities(input)).toBe(expected);
  });

  it.each(["&copy;", "&#0;", "&#x110000;", "&#1114112;", "AT&T", "a & b", "&amp", "plain text"])(
    "leaves %o untouched",
    (input) => {
      expect(decodeEntities(input)).toBe(input);
    },
  );

  it("decodes in a single pass, so escaped entities stay escaped", () => {
    expect(decodeEntities("&amp;lt;script&amp;gt;")).toBe("&lt;script&gt;");
  });

  it("decodes several entities in one string", () => {
    expect(decodeEntities("a &lt; b &amp;&amp; c &gt; d")).toBe("a < b && c > d");
  });
});

describe("fetchPageMetadata", () => {
  const safeFetchMock = vi.mocked(safeFetch);

  beforeEach(() => {
    safeFetchMock.mockReset();
  });

  function page(body: string, contentType = "text/html; charset=utf-8", status = 200) {
    return {
      status,
      headers: new Headers({ "content-type": contentType }),
      finalUrl: "https://www.example.org/final/page",
      body,
    };
  }

  const EMPTY = { title: null, description: null, image: null, favicon: null, siteName: null };

  it("parses the page, resolving relative URLs against the final URL after redirects", async () => {
    safeFetchMock.mockResolvedValue(
      page(doc(`<title>Fetched</title><link rel="icon" href="icon.png">`)),
    );
    await expect(fetchPageMetadata("https://example.org/start")).resolves.toEqual({
      title: "Fetched",
      description: null,
      image: null,
      favicon: "https://www.example.org/final/icon.png",
      siteName: null,
    });
  });

  it("asks for HTML with a crawler user agent and size and time limits", async () => {
    safeFetchMock.mockResolvedValue(page(doc("")));
    await fetchPageMetadata("https://example.org/");
    expect(safeFetchMock).toHaveBeenCalledWith(
      "https://example.org/",
      expect.objectContaining({
        headers: expect.objectContaining({ "User-Agent": expect.stringContaining("LinklyBot") }),
        timeoutMs: 5000,
        maxBytes: 512 * 1024,
      }),
    );
  });

  it("accepts XHTML responses", async () => {
    safeFetchMock.mockResolvedValue(page(doc("<title>X</title>"), "application/xhtml+xml"));
    expect((await fetchPageMetadata("https://example.org/")).title).toBe("X");
  });

  it("returns empty metadata for a non-HTML response", async () => {
    safeFetchMock.mockResolvedValue(page("%PDF-1.7", "application/pdf"));
    await expect(fetchPageMetadata("https://example.org/file.pdf")).resolves.toEqual(EMPTY);
  });

  it("returns empty metadata for an error status", async () => {
    safeFetchMock.mockResolvedValue(page(doc("<title>Not Found</title>"), "text/html", 404));
    await expect(fetchPageMetadata("https://example.org/missing")).resolves.toEqual(EMPTY);
  });

  it("never throws, even when the fetch is refused", async () => {
    safeFetchMock.mockRejectedValue(new Error("Refusing to fetch a private or reserved address"));
    await expect(fetchPageMetadata("http://127.0.0.1/")).resolves.toEqual(EMPTY);
  });
});
