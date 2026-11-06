import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

const POINTS = [
  "REST API with API keys and an OpenAPI 3.1 spec",
  "One-line shorten endpoint that returns plain text",
  "Signed webhooks for clicks and link changes",
  "Bulk create, CSV import and export",
  "Browser extension, bookmarklet and ShareX config",
];

export function DeveloperSection({ origin }: { origin: string }) {
  return (
    <section className="relative z-10 px-4 py-20 sm:px-6 md:px-12">
      <div className="border-border/60 bg-card/60 mx-auto grid max-w-6xl gap-10 overflow-hidden rounded-3xl border p-6 backdrop-blur-sm md:grid-cols-2 md:p-10">
        <div className="flex flex-col justify-center">
          <p className="text-primary text-sm font-semibold tracking-wider uppercase">
            For developers
          </p>
          <h2 className="text-foreground mt-3 text-3xl font-extrabold tracking-tight">
            Automate everything
          </h2>
          <p className="text-muted-foreground mt-3 leading-relaxed">
            Every feature in the dashboard is in the API too. Shorten links from your CI, your CMS
            or your terminal.
          </p>
          <ul className="mt-6 space-y-2.5">
            {POINTS.map((point) => (
              <li key={point} className="text-card-foreground flex items-start gap-2.5 text-sm">
                <span className="bg-primary/15 text-primary mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full">
                  <Check className="size-3" strokeWidth={3} />
                </span>
                {point}
              </li>
            ))}
          </ul>
          <Link
            href="/docs"
            className="text-primary mt-7 inline-flex items-center gap-1.5 text-sm font-semibold hover:underline"
          >
            Read the API docs <ArrowRight className="size-4" />
          </Link>
        </div>
        <div className="min-w-0 space-y-3">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#070b14] shadow-2xl">
            <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
              <span className="size-2.5 rounded-full bg-[#ff5f57]" />
              <span className="size-2.5 rounded-full bg-[#febc2e]" />
              <span className="size-2.5 rounded-full bg-[#28c840]" />
              <span className="ml-2 font-mono text-[11px] text-white/40">terminal</span>
            </div>
            <pre className="overflow-x-auto p-4 font-mono text-[12.5px] leading-relaxed text-[#c9d1d9]">
              <code>
                <span className="text-[#7ee787]">$</span> curl -X POST {origin}/api/v1/links \{"\n"}
                {"    "}-H{" "}
                <span className="text-[#a5d6ff]">&quot;Authorization: Bearer lk_...&quot;</span> \
                {"\n"}
                {"    "}-d{" "}
                <span className="text-[#a5d6ff]">
                  &apos;{"{"}&quot;url&quot;: &quot;https://example.com/launch&quot;,{"\n"}
                  {"         "}&quot;customAlias&quot;: &quot;launch&quot;, &quot;maxClicks&quot;:
                  500{"}"}&apos;
                </span>
                {"\n\n"}
                <span className="text-white/40">{"{"}</span>
                {"\n"}
                {"  "}
                <span className="text-[#79c0ff]">&quot;shortUrl&quot;</span>:{" "}
                <span className="text-[#a5d6ff]">&quot;{origin}/launch&quot;</span>,{"\n"}
                {"  "}
                <span className="text-[#79c0ff]">&quot;status&quot;</span>:{" "}
                <span className="text-[#a5d6ff]">&quot;active&quot;</span>,{"\n"}
                {"  "}
                <span className="text-[#79c0ff]">&quot;clickCount&quot;</span>:{" "}
                <span className="text-[#ffa657]">0</span>
                {"\n"}
                <span className="text-white/40">{"}"}</span>
              </code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}
