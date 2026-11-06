/**
 * Link-in-bio theme presets.
 *
 * Shared by the public page (`/@slug`) and the dashboard editor's live
 * preview, so both render from exactly the same tokens. Every value is an
 * explicit colour rather than an app token: a bio page must look the same
 * whether the visitor's app theme is light or dark.
 *
 * Class names are complete string literals so Tailwind can see them.
 * Contrast was checked against the brightest part of each canvas that text
 * can sit on (link buttons carry their own tinted glass for that reason).
 */

export const BIO_THEME_IDS = [
  "midnight",
  "aurora",
  "sunset",
  "ocean",
  "minimal",
  "forest",
] as const;

export type BioThemeId = (typeof BIO_THEME_IDS)[number];

export const DEFAULT_BIO_THEME: BioThemeId = "midnight";

export interface BioTheme {
  id: BioThemeId;
  name: string;
  /** One-line description for the picker. */
  tagline: string;
  /** Drives `color-scheme` (form controls, scrollbars) and the meta theme colour. */
  scheme: "dark" | "light";
  /** Browser UI colour on mobile (`<meta name="theme-color">`). */
  themeColor: string;
  /** Signature colour, used for the preview glow in the editor. */
  accent: string;
  /** Solid colour of the gap between the avatar and its gradient ring. */
  ringGap: string;
  /** CSS background for the small swatch in the theme picker. */
  swatch: string;
  /** Layered CSS background for the full-page canvas. */
  canvas: string;
  /** Opacity of the film-grain overlay (0 disables it). */
  grain: number;
  classes: {
    name: string;
    handle: string;
    bio: string;
    avatarRing: string;
    avatarImage: string;
    /** Initials fallback when there is no avatar. */
    avatarFallback: string;
    social: string;
    link: string;
    /** Chip behind each favicon. */
    linkIcon: string;
    linkArrow: string;
    /** focus-visible outline colour, tuned per canvas. */
    focus: string;
    footer: string;
    /** Dashed placeholder rows shown in the editor preview. */
    placeholder: string;
    miniLine: string;
    miniButton: string;
  };
}

/* Shared glass recipe for the dark themes: translucent fill, hairline ring
 * drawn with box-shadow (adapts to any canvas), a top highlight and a soft
 * drop shadow. Per-theme tints are layered on top. */
const glass = "backdrop-blur-xl backdrop-saturate-150 ring-1 ring-inset";

export const BIO_THEMES: Record<BioThemeId, BioTheme> = {
  midnight: {
    id: "midnight",
    name: "Midnight",
    tagline: "Deep navy with Linkly blue and pink glow",
    scheme: "dark",
    themeColor: "#070b16",
    accent: "#144ee3",
    ringGap: "#0a1124",
    swatch:
      "radial-gradient(circle at 12% 8%, rgba(20,78,227,0.95) 0%, transparent 55%), radial-gradient(circle at 92% 92%, rgba(235,86,142,0.8) 0%, transparent 55%), #070b16",
    canvas: [
      "radial-gradient(ellipse 70% 45% at 12% -5%, rgba(20,78,227,0.55), transparent 70%)",
      "radial-gradient(ellipse 55% 40% at 96% 18%, rgba(235,86,142,0.30), transparent 70%)",
      "radial-gradient(ellipse 70% 50% at 88% 102%, rgba(20,78,227,0.38), transparent 70%)",
      "radial-gradient(ellipse 60% 45% at 8% 100%, rgba(235,86,142,0.22), transparent 70%)",
      "linear-gradient(180deg, #0a1124 0%, #070b16 52%, #05070e 100%)",
    ].join(", "),
    grain: 0.08,
    classes: {
      name: "text-white",
      handle: "text-white/60",
      bio: "text-[#c9ced6]",
      avatarRing: "bg-linear-to-br from-[#3b6ff5] via-[#7b5cf0] to-[#eb568e]",
      avatarImage: "outline-white/10",
      avatarFallback: "bg-linear-to-br from-[#144ee3] to-[#eb568e] text-white",
      social: `${glass} bg-white/[0.06] text-white/85 ring-white/12 hover:bg-white/[0.12] hover:text-white`,
      link: `${glass} bg-white/[0.06] text-white ring-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_12px_32px_-16px_rgba(0,0,0,0.7)] hover:bg-white/[0.1] hover:ring-white/20`,
      linkIcon: "bg-white",
      linkArrow: "text-white/70",
      focus: "focus-visible:outline-white",
      footer: `${glass} bg-white/[0.06] text-white/70 ring-white/10 hover:bg-white/[0.1] hover:text-white`,
      placeholder: "border-white/15 text-white/50",
      miniLine: "bg-white/75",
      miniButton: "bg-white/15 ring-1 ring-inset ring-white/20",
    },
  },

  aurora: {
    id: "aurora",
    name: "Aurora",
    tagline: "Northern lights in emerald, teal and violet",
    scheme: "dark",
    themeColor: "#06121c",
    accent: "#34d399",
    ringGap: "#07141f",
    swatch:
      "radial-gradient(circle at 0% 0%, rgba(16,185,129,0.95) 0%, transparent 60%), radial-gradient(circle at 100% 8%, rgba(139,92,246,0.9) 0%, transparent 60%), radial-gradient(circle at 25% 100%, rgba(99,102,241,0.85) 0%, transparent 60%), #071422",
    canvas: [
      "radial-gradient(ellipse 60% 40% at 0% 0%, rgba(16,185,129,0.50), transparent 70%)",
      "radial-gradient(ellipse 55% 40% at 100% 4%, rgba(139,92,246,0.45), transparent 70%)",
      "radial-gradient(ellipse 45% 32% at 50% 52%, rgba(45,212,191,0.12), transparent 70%)",
      "radial-gradient(ellipse 70% 45% at 88% 72%, rgba(20,184,166,0.30), transparent 70%)",
      "radial-gradient(ellipse 65% 45% at 4% 96%, rgba(99,102,241,0.38), transparent 70%)",
      "linear-gradient(165deg, #05161d 0%, #0a1026 55%, #0d0a24 100%)",
    ].join(", "),
    grain: 0.08,
    classes: {
      name: "text-white",
      handle: "text-emerald-100/65",
      bio: "text-emerald-50/85",
      avatarRing: "bg-linear-to-br from-emerald-300 via-teal-400 to-violet-500",
      avatarImage: "outline-white/10",
      avatarFallback: "bg-linear-to-br from-emerald-500 to-violet-600 text-white",
      social: `${glass} bg-white/[0.07] text-emerald-50/90 ring-white/12 hover:bg-white/[0.13] hover:text-white`,
      link: `${glass} bg-white/[0.07] text-white ring-white/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_12px_32px_-16px_rgba(2,6,23,0.75)] hover:bg-white/[0.12] hover:ring-emerald-200/30`,
      linkIcon: "bg-white",
      linkArrow: "text-emerald-100/80",
      focus: "focus-visible:outline-emerald-200",
      footer: `${glass} bg-white/[0.07] text-emerald-50/75 ring-white/12 hover:bg-white/[0.12] hover:text-white`,
      placeholder: "border-emerald-100/20 text-emerald-50/55",
      miniLine: "bg-white/75",
      miniButton: "bg-white/15 ring-1 ring-inset ring-white/20",
    },
  },

  sunset: {
    id: "sunset",
    name: "Sunset",
    tagline: "Dusk sky fading from plum to coral",
    scheme: "dark",
    themeColor: "#1a0a2e",
    accent: "#fb7185",
    ringGap: "#1c0b31",
    swatch: "linear-gradient(180deg, #2a0c45 0%, #7a1f5c 45%, #e2574c 80%, #ffa45c 100%)",
    canvas: [
      "radial-gradient(ellipse 120% 55% at 50% 118%, rgba(255,150,80,0.75), rgba(255,94,120,0.35) 40%, transparent 72%)",
      "radial-gradient(ellipse 60% 40% at 100% 35%, rgba(236,72,153,0.30), transparent 70%)",
      "radial-gradient(ellipse 55% 35% at 0% 20%, rgba(168,85,247,0.28), transparent 70%)",
      "linear-gradient(180deg, #1a0a2e 0%, #33104f 30%, #6b1a5e 58%, #a8325f 82%, #d4564f 100%)",
    ].join(", "),
    grain: 0.09,
    classes: {
      name: "text-white",
      handle: "text-rose-100/70",
      bio: "text-rose-50/90",
      avatarRing: "bg-linear-to-br from-amber-300 via-orange-400 to-pink-500",
      avatarImage: "outline-white/10",
      avatarFallback: "bg-linear-to-br from-orange-400 to-fuchsia-600 text-white",
      // Plum-tinted glass keeps white text above 4.5:1 even over the coral glow.
      social: `${glass} bg-[#2b0b33]/35 text-rose-50/90 ring-white/15 hover:bg-[#2b0b33]/50 hover:text-white`,
      link: `${glass} bg-[#2b0b33]/40 text-white ring-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_14px_32px_-16px_rgba(40,5,30,0.85)] hover:bg-[#2b0b33]/55 hover:ring-white/25`,
      linkIcon: "bg-white",
      linkArrow: "text-rose-100/80",
      focus: "focus-visible:outline-amber-200",
      footer: `${glass} bg-[#2b0b33]/45 text-rose-50/85 ring-white/15 hover:bg-[#2b0b33]/60 hover:text-white`,
      placeholder: "border-rose-100/25 text-rose-50/60",
      miniLine: "bg-white/80",
      miniButton: "bg-[#2b0b33]/45 ring-1 ring-inset ring-white/20",
    },
  },

  ocean: {
    id: "ocean",
    name: "Ocean",
    tagline: "Sunlit shallows into deep blue",
    scheme: "dark",
    themeColor: "#062a45",
    accent: "#38bdf8",
    ringGap: "#08324f",
    swatch:
      "radial-gradient(circle at 50% 0%, rgba(56,189,248,0.95) 0%, transparent 60%), radial-gradient(circle at 100% 100%, rgba(37,99,235,0.9) 0%, transparent 60%), linear-gradient(180deg, #0a3a5c, #061a36)",
    canvas: [
      "radial-gradient(ellipse 80% 45% at 50% -12%, rgba(56,189,248,0.45), transparent 70%)",
      "radial-gradient(ellipse 55% 45% at 0% 55%, rgba(6,182,212,0.28), transparent 70%)",
      "radial-gradient(ellipse 60% 45% at 100% 80%, rgba(37,99,235,0.40), transparent 70%)",
      "radial-gradient(ellipse 90% 40% at 50% 110%, rgba(14,165,233,0.25), transparent 70%)",
      "linear-gradient(180deg, #08324f 0%, #0a2647 40%, #071c38 72%, #04122a 100%)",
    ].join(", "),
    grain: 0.07,
    classes: {
      name: "text-white",
      handle: "text-sky-100/70",
      bio: "text-sky-50/85",
      avatarRing: "bg-linear-to-br from-cyan-300 via-sky-400 to-blue-600",
      avatarImage: "outline-white/10",
      avatarFallback: "bg-linear-to-br from-cyan-500 to-blue-700 text-white",
      social: `${glass} bg-white/[0.08] text-sky-50/90 ring-white/15 hover:bg-white/[0.14] hover:text-white`,
      link: `${glass} bg-white/[0.08] text-white ring-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_14px_32px_-16px_rgba(2,12,27,0.85)] hover:bg-white/[0.14] hover:ring-cyan-200/35`,
      linkIcon: "bg-white",
      linkArrow: "text-sky-100/80",
      focus: "focus-visible:outline-cyan-200",
      footer: `${glass} bg-white/[0.08] text-sky-50/80 ring-white/15 hover:bg-white/[0.14] hover:text-white`,
      placeholder: "border-sky-100/25 text-sky-50/55",
      miniLine: "bg-white/80",
      miniButton: "bg-white/18 ring-1 ring-inset ring-white/25",
    },
  },

  minimal: {
    id: "minimal",
    name: "Minimal",
    tagline: "Clean paper with crisp, solid buttons",
    scheme: "light",
    themeColor: "#f8f9fb",
    accent: "#144ee3",
    ringGap: "#ffffff",
    swatch:
      "radial-gradient(rgba(11,16,27,0.12) 1px, transparent 1.5px) 0 0 / 8px 8px, linear-gradient(180deg, #ffffff, #eef1f6)",
    canvas: [
      "radial-gradient(rgba(11,16,27,0.06) 1px, transparent 1.5px) 0 0 / 22px 22px",
      "radial-gradient(ellipse 70% 40% at 50% 0%, rgba(20,78,227,0.07), transparent 70%)",
      "linear-gradient(180deg, #ffffff 0%, #f8f9fb 45%, #f1f3f7 100%)",
    ].join(", "),
    grain: 0,
    classes: {
      name: "text-[#0b101b]",
      handle: "text-[#5b6170]",
      bio: "text-[#3d4452]",
      avatarRing: "bg-linear-to-br from-[#144ee3] to-[#eb568e]",
      avatarImage: "outline-black/10",
      avatarFallback: "bg-linear-to-br from-[#144ee3] to-[#eb568e] text-white",
      social:
        "bg-white text-[#3d4452] shadow-[0_0_0_1px_rgba(11,16,27,0.08),0_1px_2px_rgba(11,16,27,0.06)] hover:text-[#0b101b] hover:shadow-[0_0_0_1px_rgba(11,16,27,0.12),0_6px_14px_-6px_rgba(11,16,27,0.2)]",
      link: "bg-white text-[#0b101b] shadow-[0_0_0_1px_rgba(11,16,27,0.07),0_1px_2px_-1px_rgba(11,16,27,0.08),0_4px_14px_-6px_rgba(11,16,27,0.1)] hover:shadow-[0_0_0_1px_rgba(11,16,27,0.1),0_2px_4px_-2px_rgba(11,16,27,0.1),0_14px_30px_-12px_rgba(11,16,27,0.2)]",
      linkIcon: "bg-[#f1f3f7]",
      linkArrow: "text-[#144ee3]",
      focus: "focus-visible:outline-[#144ee3]",
      footer:
        "bg-white text-[#5b6170] shadow-[0_0_0_1px_rgba(11,16,27,0.08),0_1px_2px_rgba(11,16,27,0.05)] hover:text-[#0b101b]",
      placeholder: "border-[#0b101b]/15 text-[#5b6170]",
      miniLine: "bg-[#0b101b]/70",
      miniButton: "bg-white shadow-[0_0_0_1px_rgba(11,16,27,0.1),0_1px_2px_rgba(11,16,27,0.08)]",
    },
  },

  forest: {
    id: "forest",
    name: "Forest",
    tagline: "Mossy greens with a soft canopy glow",
    scheme: "dark",
    themeColor: "#0a2219",
    accent: "#4ade80",
    ringGap: "#0d2a1f",
    swatch:
      "radial-gradient(circle at 10% 0%, rgba(74,222,128,0.85) 0%, transparent 55%), radial-gradient(circle at 92% 100%, rgba(21,128,61,0.95) 0%, transparent 60%), linear-gradient(180deg, #0f3324, #06170f)",
    canvas: [
      "radial-gradient(ellipse 65% 45% at 14% -6%, rgba(74,222,128,0.24), transparent 70%)",
      "radial-gradient(ellipse 50% 40% at 100% 30%, rgba(190,242,100,0.12), transparent 70%)",
      "radial-gradient(ellipse 70% 45% at 28% 105%, rgba(16,185,129,0.28), transparent 70%)",
      "radial-gradient(ellipse 60% 40% at 96% 100%, rgba(21,128,61,0.36), transparent 70%)",
      "linear-gradient(180deg, #0d2a1f 0%, #0a2219 45%, #06170f 100%)",
    ].join(", "),
    grain: 0.09,
    classes: {
      name: "text-[#f0fdf4]",
      handle: "text-emerald-100/65",
      bio: "text-green-50/85",
      avatarRing: "bg-linear-to-br from-lime-300 via-green-400 to-emerald-600",
      avatarImage: "outline-white/10",
      avatarFallback: "bg-linear-to-br from-green-500 to-emerald-800 text-white",
      social: `${glass} bg-white/[0.07] text-green-50/90 ring-white/12 hover:bg-white/[0.12] hover:text-white`,
      link: `${glass} bg-white/[0.07] text-[#f0fdf4] ring-white/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_12px_32px_-16px_rgba(0,0,0,0.7)] hover:bg-white/[0.11] hover:ring-lime-200/30`,
      linkIcon: "bg-white",
      linkArrow: "text-lime-100/80",
      focus: "focus-visible:outline-lime-200",
      footer: `${glass} bg-white/[0.07] text-green-50/75 ring-white/12 hover:bg-white/[0.12] hover:text-white`,
      placeholder: "border-green-100/20 text-green-50/55",
      miniLine: "bg-white/75",
      miniButton: "bg-white/15 ring-1 ring-inset ring-white/20",
    },
  },
};

/** Themes in picker order. */
export const BIO_THEME_LIST: BioTheme[] = BIO_THEME_IDS.map((id) => BIO_THEMES[id]);

export function isBioThemeId(value: unknown): value is BioThemeId {
  return typeof value === "string" && (BIO_THEME_IDS as readonly string[]).includes(value);
}

/** The preset for a stored theme name, falling back to the default. */
export function getBioTheme(id: string | null | undefined): BioTheme {
  return isBioThemeId(id) ? BIO_THEMES[id] : BIO_THEMES[DEFAULT_BIO_THEME];
}

/** Tileable film grain (SVG turbulence), layered over dark canvases for depth. */
export const GRAIN_TEXTURE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";
