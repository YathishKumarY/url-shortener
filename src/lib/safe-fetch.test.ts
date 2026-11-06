import { lookup } from "node:dns/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assertPublicUrl, isPrivateIp, safeFetch, UnsafeUrlError } from "@/lib/safe-fetch";

// No test may touch real DNS: every lookup goes through this mock.
vi.mock("node:dns/promises", () => ({ lookup: vi.fn() }));

const lookupMock = vi.mocked(lookup);

function resolvesTo(...addresses: string[]) {
  lookupMock.mockResolvedValue(
    addresses.map((address) => ({ address, family: address.includes(":") ? 6 : 4 })) as never,
  );
}

beforeEach(() => {
  lookupMock.mockReset();
  lookupMock.mockRejectedValue(new Error("DNS is disabled in tests"));
  vi.stubEnv("ALLOW_PRIVATE_NETWORK_FETCH", undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("isPrivateIp", () => {
  it.each([
    "0.0.0.0",
    "0.255.255.255",
    "10.0.0.1",
    "10.255.255.255",
    "100.64.0.1",
    "100.127.255.255",
    "127.0.0.1",
    "127.255.255.254",
    "169.254.169.254",
    "172.16.0.1",
    "172.31.255.255",
    "192.0.0.8",
    "192.0.2.1",
    "192.168.0.1",
    "192.168.255.255",
    "198.18.0.1",
    "198.19.255.255",
    "198.51.100.7",
    "203.0.113.9",
    "224.0.0.1",
    "239.255.255.250",
    "240.0.0.1",
    "255.255.255.255",
  ])("treats the IPv4 address %s as private", (ip) => {
    expect(isPrivateIp(ip)).toBe(true);
  });

  it.each([
    "8.8.8.8",
    "1.1.1.1",
    "93.184.216.34",
    "9.255.255.255",
    "11.0.0.1",
    "100.63.255.255",
    "100.128.0.1",
    "126.255.255.255",
    "128.0.0.1",
    "169.253.255.255",
    "169.255.0.1",
    "172.15.255.255",
    "172.32.0.1",
    "192.167.255.255",
    "192.169.0.1",
    "198.17.255.255",
    "198.20.0.1",
    "223.255.255.255",
  ])("treats the IPv4 address %s as public", (ip) => {
    expect(isPrivateIp(ip)).toBe(false);
  });

  it.each([
    "::1",
    "::",
    "fc00::1",
    "fd12:3456:789a::1",
    "fe80::1",
    "febf::1",
    "FE80::1",
    "ff02::1",
    "ff05::1:3",
    "2001:db8::1",
    "2001:db8:85a3::8a2e:370:7334",
  ])("treats the IPv6 address %s as private", (ip) => {
    expect(isPrivateIp(ip)).toBe(true);
  });

  it.each([
    "::ffff:127.0.0.1",
    "::FFFF:127.0.0.1",
    "::ffff:10.0.0.1",
    "::ffff:169.254.169.254",
    "64:ff9b::10.0.0.1",
    "64:ff9b::127.0.0.1",
  ])("checks the IPv4 address embedded in %s", (ip) => {
    expect(isPrivateIp(ip)).toBe(true);
  });

  /*
   * Regression: the URL parser serialises an embedded IPv4 address in hex
   * (http://[::ffff:127.0.0.1]/ has hostname [::ffff:7f00:1]), and only the
   * dotted form was decoded, so these reached loopback and cloud metadata.
   */
  it.each([
    ["::ffff:7f00:1", "127.0.0.1"],
    ["::ffff:a9fe:a9fe", "169.254.169.254"],
    ["::ffff:a00:1", "10.0.0.1"],
    ["::ffff:c0a8:101", "192.168.1.1"],
    ["::ffff:0:0", "0.0.0.0"],
    ["64:ff9b::a00:1", "10.0.0.1"],
    ["64:ff9b::7f00:1", "127.0.0.1"],
  ])("checks the hex-form embedded address %s (%s)", (ip) => {
    expect(isPrivateIp(ip)).toBe(true);
  });

  it.each([
    "2606:4700::1111",
    "2001:4860:4860::8888",
    "2a00:1450:4001:81c::200e",
    "::ffff:8.8.8.8",
    "::ffff:808:808",
    "64:ff9b::8.8.8.8",
    "64:ff9b::808:808",
  ])("treats the IPv6 address %s as public", (ip) => {
    expect(isPrivateIp(ip)).toBe(false);
  });

  it.each(["localhost", "example.com", "", "1.2.3", "256.1.1.1", "not an ip", "[::1]"])(
    "refuses to guess about the non-IP %o",
    (value) => {
      expect(isPrivateIp(value)).toBe(true);
    },
  );
});

describe("assertPublicUrl", () => {
  async function expectUnsafe(url: string, message?: RegExp) {
    const promise = assertPublicUrl(url);
    await expect(promise).rejects.toBeInstanceOf(UnsafeUrlError);
    if (message) await expect(promise).rejects.toThrow(message);
  }

  it.each([
    "ftp://example.com/file",
    "file:///etc/passwd",
    "javascript:alert(1)",
    "data:text/plain,hi",
    "gopher://127.0.0.1:70/",
  ])("rejects the non-http scheme in %s", async (url) => {
    await expectUnsafe(url, /Only http and https/);
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it.each([
    "http://localhost/",
    "http://localhost:3000/admin",
    "http://LOCALHOST/",
    "http://api.localhost/",
    "http://metadata.google.internal/computeMetadata/v1/",
  ])("rejects the local name %s without a DNS lookup", async (url) => {
    await expectUnsafe(url, /local address/);
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it.each([
    "http://127.0.0.1/",
    "http://169.254.169.254/latest/meta-data/",
    "http://10.1.2.3:8080/",
    "http://192.168.1.1/",
    "http://0.0.0.0/",
    "http://[::1]/",
    "http://[fd00::1]/",
    "http://[fe80::1]/",
  ])("rejects the private IP literal in %s", async (url) => {
    await expectUnsafe(url, /private or reserved/);
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it.each([
    "http://2130706433/",
    "http://0x7f.1/",
    "http://127.1/",
    "http://017700000001/",
    "http://0/",
  ])("rejects the alternative IPv4 spelling %s", async (url) => {
    await expectUnsafe(url, /private or reserved/);
  });

  it.each([
    "http://[::ffff:127.0.0.1]/",
    "http://[::ffff:169.254.169.254]/latest/meta-data/",
    "http://[::ffff:7f00:1]:8080/",
    "http://[64:ff9b::10.0.0.1]/",
  ])("rejects the IPv4-mapped literal %s", async (url) => {
    await expectUnsafe(url, /private or reserved/);
  });

  it.each([
    "https://93.184.216.34/",
    "http://[2606:4700::1111]/",
    "https://1.1.1.1:8443/dns-query",
  ])("accepts the public IP literal %s without a DNS lookup", async (url) => {
    await expect(assertPublicUrl(url)).resolves.toBeInstanceOf(URL);
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it("accepts a URL object and returns it", async () => {
    const url = new URL("https://1.1.1.1/dns");
    await expect(assertPublicUrl(url)).resolves.toBe(url);
  });

  it("accepts a host that resolves only to public addresses", async () => {
    resolvesTo("93.184.216.34", "2606:2800:220:1:248:1893:25c8:1946");
    const url = await assertPublicUrl("https://example.com/page");
    expect(url.href).toBe("https://example.com/page");
    expect(lookupMock).toHaveBeenCalledWith("example.com", { all: true, verbatim: true });
  });

  it("rejects a host that resolves to a private address", async () => {
    resolvesTo("10.0.0.5");
    await expectUnsafe("https://intranet.example.com/", /private or reserved/);
  });

  it("rejects a host when any one of its addresses is private", async () => {
    resolvesTo("93.184.216.34", "127.0.0.1");
    await expectUnsafe("https://mixed.example.com/", /private or reserved/);
  });

  it("rejects a host that resolves to an IPv4-mapped loopback address", async () => {
    resolvesTo("::ffff:127.0.0.1");
    await expectUnsafe("https://mapped.example.com/", /private or reserved/);
  });

  it("rejects a host that does not resolve", async () => {
    lookupMock.mockRejectedValue(
      Object.assign(new Error("getaddrinfo ENOTFOUND"), { code: "ENOTFOUND" }),
    );
    await expectUnsafe("https://nxdomain.example.com/", /Could not resolve nxdomain\.example\.com/);
  });

  it("rejects a host with no addresses", async () => {
    resolvesTo();
    await expectUnsafe("https://empty.example.com/", /private or reserved/);
  });

  it("throws on a string that is not a URL", async () => {
    await expect(assertPublicUrl("not a url")).rejects.toThrow();
  });

  describe("with ALLOW_PRIVATE_NETWORK_FETCH", () => {
    it.each([
      "http://127.0.0.1:8080/hook",
      "http://localhost/",
      "http://[::1]/",
      "http://10.0.0.5/",
    ])("allows %s", async (url) => {
      vi.stubEnv("ALLOW_PRIVATE_NETWORK_FETCH", "true");
      await expect(assertPublicUrl(url)).resolves.toBeInstanceOf(URL);
      expect(lookupMock).not.toHaveBeenCalled();
    });

    it("still rejects non-http schemes", async () => {
      vi.stubEnv("ALLOW_PRIVATE_NETWORK_FETCH", "true");
      await expectUnsafe("file:///etc/passwd", /Only http and https/);
    });

    it("stays off for a false value", async () => {
      vi.stubEnv("ALLOW_PRIVATE_NETWORK_FETCH", "false");
      await expectUnsafe("http://127.0.0.1/");
    });
  });
});

describe("safeFetch", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  function redirect(location: string, status = 302) {
    return new Response(null, { status, headers: { location } });
  }

  it("returns the status, headers, final URL and body", async () => {
    fetchMock.mockResolvedValue(
      new Response("<html>ok</html>", { headers: { "content-type": "text/html" } }),
    );
    const result = await safeFetch("https://93.184.216.34/page");
    expect(result.status).toBe(200);
    expect(result.headers.get("content-type")).toBe("text/html");
    expect(result.finalUrl).toBe("https://93.184.216.34/page");
    expect(result.body).toBe("<html>ok</html>");
  });

  it("follows redirects manually so every hop is checked", async () => {
    fetchMock
      .mockResolvedValueOnce(redirect("https://1.1.1.1/next"))
      .mockResolvedValueOnce(new Response("done"));
    const result = await safeFetch("https://93.184.216.34/start");
    expect(result.finalUrl).toBe("https://1.1.1.1/next");
    expect(result.body).toBe("done");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [, init] of fetchMock.mock.calls) {
      expect(init?.redirect).toBe("manual");
      expect(init?.signal).toBeInstanceOf(AbortSignal);
    }
  });

  it("resolves a relative Location against the current URL", async () => {
    fetchMock
      .mockResolvedValueOnce(redirect("/moved?x=1", 301))
      .mockResolvedValueOnce(new Response("here"));
    const result = await safeFetch("https://93.184.216.34/old/page");
    expect(result.finalUrl).toBe("https://93.184.216.34/moved?x=1");
  });

  it("refuses a redirect into the private network", async () => {
    fetchMock.mockResolvedValueOnce(redirect("http://169.254.169.254/latest/meta-data/"));
    await expect(safeFetch("https://93.184.216.34/")).rejects.toBeInstanceOf(UnsafeUrlError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refuses a redirect to an IPv4-mapped loopback literal", async () => {
    fetchMock.mockResolvedValueOnce(redirect("http://[::ffff:127.0.0.1]:6379/"));
    await expect(safeFetch("https://93.184.216.34/")).rejects.toBeInstanceOf(UnsafeUrlError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refuses the first request before fetching when the URL is private", async () => {
    await expect(safeFetch("http://127.0.0.1/")).rejects.toBeInstanceOf(UnsafeUrlError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("gives up after maxRedirects hops", async () => {
    fetchMock
      .mockResolvedValueOnce(redirect("https://1.1.1.1/a"))
      .mockResolvedValueOnce(redirect("https://1.1.1.1/b"));
    await expect(safeFetch("https://93.184.216.34/", { maxRedirects: 1 })).rejects.toThrow(
      "Too many redirects",
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not follow any redirect when maxRedirects is 0", async () => {
    fetchMock.mockResolvedValueOnce(redirect("https://1.1.1.1/a"));
    await expect(safeFetch("https://93.184.216.34/", { maxRedirects: 0 })).rejects.toThrow(
      "Too many redirects",
    );
  });

  it("returns a 3xx without a Location header as the response", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 304 }));
    const result = await safeFetch("https://93.184.216.34/");
    expect(result.status).toBe(304);
    expect(result.body).toBe("");
  });

  it("drops the request body and switches to GET after a redirect", async () => {
    fetchMock
      .mockResolvedValueOnce(redirect("https://1.1.1.1/next", 302))
      .mockResolvedValueOnce(new Response("ok"));
    await safeFetch("https://93.184.216.34/hook", { method: "POST", body: '{"a":1}' });
    const [, first] = fetchMock.mock.calls[0];
    const [, second] = fetchMock.mock.calls[1];
    expect(first?.method).toBe("POST");
    expect(first?.body).toBe('{"a":1}');
    expect(second?.method).toBe("GET");
    expect(second?.body).toBeUndefined();
  });

  it("stops reading the body once maxBytes is reached", async () => {
    let pulls = 0;
    const chunk = new TextEncoder().encode("0123456789");
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls++;
        if (pulls > 10) controller.close();
        else controller.enqueue(chunk);
      },
    });
    fetchMock.mockResolvedValueOnce(new Response(body));
    const result = await safeFetch("https://93.184.216.34/", { maxBytes: 15 });
    expect(result.body).toBe("01234567890123456789");
    expect(pulls).toBeLessThan(10);
  });

  it("decodes multi-byte characters split across chunks", async () => {
    const bytes = new TextEncoder().encode("héllo");
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, 2));
        controller.enqueue(bytes.slice(2));
        controller.close();
      },
    });
    fetchMock.mockResolvedValueOnce(new Response(body));
    const result = await safeFetch("https://93.184.216.34/");
    expect(result.body).toBe("héllo");
  });
});
