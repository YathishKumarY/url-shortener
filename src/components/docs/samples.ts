import type { CodeSample } from "@/components/docs/code-tabs";
import type { HttpMethod } from "@/components/docs/primitives";

/**
 * Generates matching curl, JavaScript (fetch) and Python (requests) samples
 * from one request description, so every endpoint's examples stay in step.
 */

type Lang = "json" | "js" | "py";
type QueryValue = string | number | boolean;

export interface RequestSpec {
  method: HttpMethod;
  /** Absolute URL without the query string. */
  url: string;
  query?: Record<string, QueryValue>;
  body?: unknown;
  /** Send the API key header (default true). */
  auth?: boolean;
  /** How the example reads the response (default "json"). */
  result?: "json" | "text" | "none";
  /** Variable name for the parsed response (default "data"). */
  name?: string;
}

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/** Pretty-print a JSON value as a JSON, JavaScript or Python literal. */
export function literal(value: unknown, lang: Lang, depth = 0): string {
  const unit = lang === "py" ? "    " : "  ";
  const pad = unit.repeat(depth + 1);
  const close = unit.repeat(depth);
  const trailing = lang === "json" ? "" : ",";

  if (value === null || value === undefined) return lang === "py" ? "None" : "null";
  if (typeof value === "boolean") return lang === "py" ? (value ? "True" : "False") : String(value);
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return JSON.stringify(value);

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const flat = value.every((item) => item === null || typeof item !== "object");
    if (flat) {
      const inline = `[${value.map((item) => literal(item, lang, depth)).join(", ")}]`;
      if (inline.length <= 64) return inline;
    }
    const items = value.map((item) => `${pad}${literal(item, lang, depth + 1)}`);
    return `[\n${items.join(",\n")}${trailing}\n${close}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return "{}";
  const key = (name: string) =>
    lang === "js" && IDENTIFIER.test(name) ? name : JSON.stringify(name);
  const lines = entries.map(
    ([name, item]) => `${pad}${key(name)}: ${literal(item, lang, depth + 1)}`,
  );
  return `{\n${lines.join(",\n")}${trailing}\n${close}}`;
}

/** Query string that keeps ":" and "/" readable (both are legal in a query). */
function queryString(query: Record<string, QueryValue>): string {
  return Object.entries(query)
    .map(([name, value]) => {
      const encoded = encodeURIComponent(String(value)).replace(/%3A/gi, ":").replace(/%2F/gi, "/");
      return `${encodeURIComponent(name)}=${encoded}`;
    })
    .join("&");
}

function fullUrl(spec: RequestSpec): string {
  return spec.query ? `${spec.url}?${queryString(spec.query)}` : spec.url;
}

function curl(spec: RequestSpec): string {
  const parts = [`curl${spec.method === "GET" ? "" : ` -X ${spec.method}`} "${fullUrl(spec)}"`];
  if (spec.auth !== false) parts.push('-H "Authorization: Bearer $LINKLY_API_KEY"');
  if (spec.body !== undefined) {
    parts.push('-H "Content-Type: application/json"');
    parts.push(`-d '${literal(spec.body, "json").replace(/\n/g, "\n  ")}'`);
  }
  return parts.join(" \\\n  ");
}

function javascript(spec: RequestSpec): string {
  const name = spec.name ?? "data";
  const options: string[] = [];
  if (spec.method !== "GET") options.push(`  method: "${spec.method}",`);

  const headers: string[] = [];
  if (spec.auth !== false)
    headers.push("    Authorization: `Bearer ${process.env.LINKLY_API_KEY}`,");
  if (spec.body !== undefined) headers.push('    "Content-Type": "application/json",');
  if (headers.length) options.push(`  headers: {\n${headers.join("\n")}\n  },`);
  if (spec.body !== undefined)
    options.push(`  body: JSON.stringify(${literal(spec.body, "js", 1)}),`);

  const call = options.length
    ? `await fetch("${fullUrl(spec)}", {\n${options.join("\n")}\n});`
    : `await fetch("${fullUrl(spec)}");`;
  const lines = [`const res = ${call}`];

  if (spec.result === "text") {
    lines.push(`const ${name} = (await res.text()).trim();`);
  } else if (spec.result === "none") {
    lines.push("if (!res.ok) throw new Error(`Request failed with status ${res.status}`);");
  } else {
    lines.push(`const ${name} = await res.json();`);
    lines.push(`if (!res.ok) throw new Error(${name}.error);`);
  }
  return lines.join("\n");
}

function python(spec: RequestSpec): string {
  const name = (spec.name ?? "data").replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
  const auth = spec.auth !== false;
  const lines = auth ? ["import os", "import requests", ""] : ["import requests", ""];

  const args = [`    "${spec.url}",`];
  if (auth) args.push(`    headers={"Authorization": f"Bearer {os.environ['LINKLY_API_KEY']}"},`);
  if (spec.query) args.push(`    params=${literal(spec.query, "py", 1)},`);
  if (spec.body !== undefined) args.push(`    json=${literal(spec.body, "py", 1)},`);

  lines.push(`res = requests.${spec.method.toLowerCase()}(\n${args.join("\n")}\n)`);
  lines.push("res.raise_for_status()");
  if (spec.result === "text") lines.push(`${name} = res.text.strip()`);
  else if (spec.result !== "none") lines.push(`${name} = res.json()`);
  return lines.join("\n");
}

export function requestSamples(spec: RequestSpec): CodeSample[] {
  return [
    { label: "curl", code: curl(spec) },
    { label: "JavaScript", code: javascript(spec) },
    { label: "Python", code: python(spec) },
  ];
}

/** Pretty JSON for response examples. */
export function json(value: unknown): string {
  return literal(value, "json");
}
