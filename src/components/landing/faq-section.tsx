import Link from "next/link";
import { ChevronDown } from "lucide-react";

const FAQS: Array<{ q: string; a: React.ReactNode }> = [
  {
    q: "Do I need an account?",
    a: "No. Anyone can shorten links, add a password, set an expiry or make a one-time link. A free account adds analytics, editing, tags, QR design, custom domains, bio pages and the API.",
  },
  {
    q: "How can I check where a short link goes before I open it?",
    a: (
      <>
        Add a <code className="bg-secondary rounded px-1.5 py-0.5 text-xs">+</code> to the end of
        any short link (for example{" "}
        <code className="bg-secondary rounded px-1.5 py-0.5 text-xs">/launch+</code>) to see its
        destination, safety details and QR code without being redirected.
      </>
    ),
  },
  {
    q: "What happens when a link expires or reaches its click limit?",
    a: "Visitors see a friendly notice, or are sent to a fallback URL you choose. Click limits only count humans - preview bots from Slack, WhatsApp and friends never use up a one-time link.",
  },
  {
    q: "Do you track my visitors?",
    a: "Only what a link owner needs: anonymous counts by country, device and referrer. IP addresses are hashed with a secret salt and never stored, and the only cookie set is the one that keeps an A/B test variant stable.",
  },
  {
    q: "Can I use my own domain?",
    a: "Yes. Add a subdomain such as go.yourbrand.com in Settings, point it at the server with a CNAME, and verify it with a TXT record. You can also choose where the domain root and unknown codes redirect.",
  },
  {
    q: "Can I host it myself?",
    a: (
      <>
        Yes - Linkly is open source and ships with Docker Compose. It runs on any PostgreSQL
        database, and Redis is optional. See the{" "}
        <Link href="/docs" className="text-primary underline">
          docs
        </Link>{" "}
        for the API.
      </>
    ),
  },
];

export function FaqSection() {
  return (
    <section id="faq" className="relative z-10 px-4 py-20 sm:px-6 md:px-12">
      <div className="mx-auto max-w-3xl">
        <h2 className="text-foreground mb-10 text-center text-3xl font-extrabold tracking-tight">
          Questions, answered
        </h2>
        <div className="space-y-3">
          {FAQS.map(({ q, a }) => (
            <details
              key={q}
              className="group border-border/60 bg-card/60 open:border-primary/40 rounded-2xl border backdrop-blur-sm transition-colors"
            >
              <summary className="text-foreground flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[15px] font-semibold [&::-webkit-details-marker]:hidden">
                {q}
                <ChevronDown className="text-muted-foreground size-4 shrink-0 transition-transform group-open:rotate-180" />
              </summary>
              <div className="text-muted-foreground px-5 pb-5 text-sm leading-relaxed">{a}</div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CtaSection({ registrationEnabled }: { registrationEnabled: boolean }) {
  return (
    <section className="relative z-10 px-4 pt-6 pb-24 sm:px-6 md:px-12">
      <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl bg-gradient-to-br from-[#144ee3] via-[#3b5bdb] to-[#eb568e] p-10 text-center shadow-[0_30px_80px_-20px_rgba(20,78,227,0.6)] md:p-14">
        <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-white/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 size-72 rounded-full bg-black/10 blur-3xl" />
        <h2 className="relative text-3xl font-extrabold tracking-tight text-white md:text-4xl">
          Your links deserve better
        </h2>
        <p className="relative mx-auto mt-3 max-w-xl text-white/85">
          Analytics, branded domains, QR codes and a link-in-bio page. Free, open source, and ready
          in seconds.
        </p>
        <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          {registrationEnabled && (
            <Link
              href="/auth/signup"
              className="inline-flex h-12 items-center justify-center rounded-full bg-white px-7 text-sm font-bold text-[#144ee3] transition-transform hover:scale-[1.02]"
            >
              Create a free account
            </Link>
          )}
          <Link
            href="/docs"
            className="inline-flex h-12 items-center justify-center rounded-full border border-white/40 px-7 text-sm font-semibold text-white transition-colors hover:bg-white/10"
          >
            Explore the API
          </Link>
        </div>
      </div>
    </section>
  );
}
