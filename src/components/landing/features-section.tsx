import {
  BarChart3,
  Bot,
  CalendarClock,
  Code2,
  Flame,
  Globe2,
  Layers,
  Lock,
  MessageSquareQuote,
  QrCode,
  Server,
  ShieldCheck,
  Smartphone,
  Split,
  UserRound,
  Webhook,
  type LucideIcon,
} from "lucide-react";

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
  tone: string;
}

const FEATURES: Feature[] = [
  {
    icon: BarChart3,
    title: "Real-time analytics",
    description:
      "Clicks, unique visitors, countries, cities, devices, referrers and a live click stream. Bots filtered out.",
    tone: "from-blue-500/20 to-blue-500/0 text-blue-500",
  },
  {
    icon: Smartphone,
    title: "Smart targeting",
    description:
      "Send iPhone users to the App Store, Android users to Play, and each country to its own page.",
    tone: "from-violet-500/20 to-violet-500/0 text-violet-500",
  },
  {
    icon: Split,
    title: "A/B testing",
    description:
      "Split traffic between up to five destinations with sticky assignment and per-variant stats.",
    tone: "from-pink-500/20 to-pink-500/0 text-pink-500",
  },
  {
    icon: Lock,
    title: "Password protection",
    description:
      "Share private links that only open with the right password - no account needed for visitors.",
    tone: "from-amber-500/20 to-amber-500/0 text-amber-500",
  },
  {
    icon: Flame,
    title: "Self-destructing links",
    description:
      "One-time links, click limits and expiry dates, with an optional fallback page when they run out.",
    tone: "from-orange-500/20 to-orange-500/0 text-orange-500",
  },
  {
    icon: CalendarClock,
    title: "Scheduled links",
    description:
      "Share today, go live tomorrow. Early visitors get a countdown instead of a dead end.",
    tone: "from-teal-500/20 to-teal-500/0 text-teal-500",
  },
  {
    icon: QrCode,
    title: "Branded QR codes",
    description:
      "Custom colors and your logo in the middle. Scans are tracked separately from clicks.",
    tone: "from-green-500/20 to-green-500/0 text-green-500",
  },
  {
    icon: MessageSquareQuote,
    title: "Social previews",
    description:
      "Choose the title, description and image shown when your link is shared on X, Slack or WhatsApp.",
    tone: "from-sky-500/20 to-sky-500/0 text-sky-500",
  },
  {
    icon: Globe2,
    title: "Custom domains",
    description:
      "Branded links like go.yourbrand.com/launch, verified with a DNS record, with root and 404 redirects.",
    tone: "from-indigo-500/20 to-indigo-500/0 text-indigo-500",
  },
  {
    icon: UserRound,
    title: "Link-in-bio pages",
    description:
      "A beautiful /@you page with your best links and socials, in six themes, tracked like any link.",
    tone: "from-fuchsia-500/20 to-fuchsia-500/0 text-fuchsia-500",
  },
  {
    icon: Layers,
    title: "Bulk tools",
    description:
      "Shorten a hundred URLs at once, import from Bitly or Dub CSVs, export everything, tag and archive.",
    tone: "from-cyan-500/20 to-cyan-500/0 text-cyan-500",
  },
  {
    icon: Code2,
    title: "REST API",
    description:
      "API keys, an OpenAPI spec and a one-line shorten endpoint that returns plain text for scripts.",
    tone: "from-blue-500/20 to-blue-500/0 text-blue-500",
  },
  {
    icon: Webhook,
    title: "Signed webhooks",
    description:
      "Get a signed HTTP POST on every click, create, edit or delete - plug into Zapier, n8n or Slack.",
    tone: "from-rose-500/20 to-rose-500/0 text-rose-500",
  },
  {
    icon: Bot,
    title: "Bot aware",
    description:
      "Crawlers never consume one-time links and never inflate your numbers; link unfurlers get previews.",
    tone: "from-lime-500/20 to-lime-500/0 text-lime-600",
  },
  {
    icon: ShieldCheck,
    title: "Safe by design",
    description:
      "Preview any link with a +, abuse reporting, domain blocklists and optional Google Safe Browsing.",
    tone: "from-emerald-500/20 to-emerald-500/0 text-emerald-500",
  },
  {
    icon: Server,
    title: "Self-hostable",
    description: "Docker Compose, any Postgres, Redis optional. Your data stays on your servers.",
    tone: "from-zinc-500/20 to-zinc-500/0 text-zinc-500",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="relative z-10 px-4 py-20 sm:px-6 md:px-12">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="text-primary text-sm font-semibold tracking-wider uppercase">
            Everything included
          </p>
          <h2 className="text-foreground mt-3 text-3xl font-extrabold tracking-tight md:text-4xl">
            All the features other shorteners charge for
          </h2>
          <p className="text-muted-foreground mt-4 text-base">
            The best of Dub, Bitly, Shlink, Kutt, spoo.me and TinyURL, in one open-source app.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, description, tone }) => (
            <div
              key={title}
              className="group border-border/60 bg-card/60 hover:border-primary/40 relative grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-4 overflow-hidden rounded-2xl border p-4 backdrop-blur-sm transition-[border-color,transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_40px_-12px_rgba(20,78,227,0.35)] sm:block sm:p-5"
            >
              <div
                className={`absolute inset-x-0 top-0 h-24 bg-gradient-to-b opacity-60 ${tone.split(" ").slice(0, 2).join(" ")}`}
              />
              <div
                className={`relative row-span-2 flex size-10 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10 sm:mb-4 ${tone.split(" ").slice(2).join(" ")}`}
              >
                <Icon className="size-5" />
              </div>
              <h3 className="text-foreground relative text-[15px] font-semibold">{title}</h3>
              <p className="text-muted-foreground relative mt-1.5 text-[13px] leading-relaxed">
                {description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
