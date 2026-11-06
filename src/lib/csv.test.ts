import { describe, expect, it } from "vitest";
import { parseCsv, parseCsvRecords, toCsv } from "@/lib/csv";

/** Serialise a single cell and strip the header line and trailing CRLF. */
function cell(value: unknown): string {
  return toCsv([{ v: value }], ["v"]).slice("v\r\n".length, -2);
}

describe("toCsv", () => {
  it("writes a header and CRLF-terminated rows", () => {
    expect(
      toCsv(
        [
          { a: 1, b: "x" },
          { a: 2, b: "y" },
        ],
        ["a", "b"],
      ),
    ).toBe("a,b\r\n1,x\r\n2,y\r\n");
  });

  it("follows the column order and leaves out other keys", () => {
    expect(toCsv([{ a: 1, b: 2, secret: "hash" }], ["b", "a"])).toBe("b,a\r\n2,1\r\n");
  });

  it("writes only the header for no rows", () => {
    expect(toCsv([], ["url", "clicks"])).toBe("url,clicks\r\n");
  });

  it.each([
    ["a,b", '"a,b"'],
    ['say "hi"', '"say ""hi"""'],
    ["line1\nline2", '"line1\nline2"'],
    ["line1\r\nline2", '"line1\r\nline2"'],
    ["cr\ronly", '"cr\ronly"'],
  ])("quotes %o", (value, expected) => {
    expect(cell(value)).toBe(expected);
  });

  it("leaves plain values unquoted", () => {
    expect(cell("https://example.com/path?a=1&b=2")).toBe("https://example.com/path?a=1&b=2");
  });

  it("writes dates as ISO 8601", () => {
    expect(cell(new Date("2026-11-06T12:34:56.789Z"))).toBe("2026-11-06T12:34:56.789Z");
  });

  it("writes null and undefined as empty cells but keeps falsy values", () => {
    expect(
      toCsv([{ a: null, b: undefined, c: 0, d: false, e: "" }], ["a", "b", "c", "d", "e"]),
    ).toBe("a,b,c,d,e\r\n,,0,false,\r\n");
  });

  it("writes a missing key as an empty cell", () => {
    const rows: Array<Record<string, unknown>> = [{ a: 1 }];
    expect(toCsv(rows, ["a", "b"])).toBe("a,b\r\n1,\r\n");
  });

  /* OWASP CSV injection: a spreadsheet would run these cells as formulas. */
  it.each([
    ['=HYPERLINK("http://evil","x")', '\'=HYPERLINK("http://evil","x")'],
    ["=SUM(A1:A2)", "'=SUM(A1:A2)"],
    ["+1+1", "'+1+1"],
    ["-2+3", "'-2+3"],
    ["@SUM(1)", "'@SUM(1)"],
    ["\t=1", "'\t=1"],
  ])("neutralises the formula %o", (value, expected) => {
    expect(cell(value).replace(/^"|"$/g, "").replace(/""/g, '"')).toBe(expected);
  });

  it("neutralises a leading carriage return and still quotes it", () => {
    expect(cell("\r=1")).toBe(`"'\r=1"`);
  });

  it("quotes a neutralised formula that contains a comma", () => {
    expect(cell("=1,2")).toBe(`"'=1,2"`);
  });

  it.each(["a=b", "user@example.com", "x-y", "1+1"])(
    "leaves %o alone when the trigger is not first",
    (value) => {
      expect(cell(value)).toBe(value);
    },
  );
});

describe("parseCsv", () => {
  it.each([
    ["a,b\n1,2\n", "LF"],
    ["a,b\r\n1,2\r\n", "CRLF"],
    ["a,b\r1,2\r", "CR"],
    ["a,b\r\n1,2", "no trailing newline"],
    ["a,b\n1,2\r\n", "mixed endings"],
  ])("parses %o (%s)", (input) => {
    expect(parseCsv(input)).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("keeps commas inside quoted fields", () => {
    expect(parseCsv('"Smith, John",42')).toEqual([["Smith, John", "42"]]);
  });

  it("keeps LF and CRLF line breaks inside quoted fields", () => {
    expect(parseCsv('"line1\nline2",x\r\n"a\r\nb",y')).toEqual([
      ["line1\nline2", "x"],
      ["a\r\nb", "y"],
    ]);
  });

  it("unescapes doubled quotes", () => {
    expect(parseCsv('"He said ""hi""",y')).toEqual([['He said "hi"', "y"]]);
  });

  it("parses empty quoted and unquoted cells", () => {
    expect(parseCsv('"",x,,"z"')).toEqual([["", "x", "", "z"]]);
    expect(parseCsv("a,b,")).toEqual([["a", "b", ""]]);
  });

  it("strips a leading byte order mark", () => {
    expect(parseCsv("\uFEFFurl,alias\r\nhttps://a.com,x")).toEqual([
      ["url", "alias"],
      ["https://a.com", "x"],
    ]);
  });

  it("drops blank and whitespace-only lines", () => {
    expect(parseCsv("a\n\n\nb\n   \n,,\n\nc\n")).toEqual([["a"], ["b"], ["c"]]);
  });

  it.each(["", "\n", "\r\n\r\n", "\uFEFF"])("returns no rows for %o", (input) => {
    expect(parseCsv(input)).toEqual([]);
  });

  it("round-trips values written by toCsv", () => {
    const rows = [
      { title: 'Comma, "quote"\nnewline', url: "https://x.com/?a=1&b=2" },
      { title: "", url: "https://y.com/" },
    ];
    expect(parseCsv(toCsv(rows, ["title", "url"]))).toEqual([
      ["title", "url"],
      ['Comma, "quote"\nnewline', "https://x.com/?a=1&b=2"],
      ["", "https://y.com/"],
    ]);
  });
});

describe("parseCsvRecords", () => {
  it("keys records by trimmed, lower-cased headers", () => {
    expect(parseCsvRecords(" URL ,Custom Alias,TAGS\nhttps://a.com,my-alias,news")).toEqual([
      { url: "https://a.com", "custom alias": "my-alias", tags: "news" },
    ]);
  });

  it("fills missing cells with empty strings", () => {
    expect(parseCsvRecords("url,alias,title\nhttps://a.com")).toEqual([
      { url: "https://a.com", alias: "", title: "" },
    ]);
  });

  it("trims cell values", () => {
    expect(parseCsvRecords('url,title\n  https://a.com  ,"  Padded  "')).toEqual([
      { url: "https://a.com", title: "Padded" },
    ]);
  });

  it("ignores cells beyond the header", () => {
    expect(parseCsvRecords("url\nhttps://a.com,extra")).toEqual([{ url: "https://a.com" }]);
  });

  it("handles an Excel export with a BOM, CRLF and blank lines", () => {
    expect(
      parseCsvRecords("\uFEFFURL,Title\r\nhttps://a.com,A\r\n\r\nhttps://b.com,B\r\n"),
    ).toEqual([
      { url: "https://a.com", title: "A" },
      { url: "https://b.com", title: "B" },
    ]);
  });

  it.each(["", "url,alias", "url,alias\r\n"])("returns no records for %o", (input) => {
    expect(parseCsvRecords(input)).toEqual([]);
  });
});
