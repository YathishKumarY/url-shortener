"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Copy, Download, ImagePlus, RotateCcw, X } from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Field, inputClass, Panel, pill, Segmented, ToggleRow } from "@/components/shared/ui-kit";
import { downloadText } from "@/lib/api-client";
import { cn, copyToClipboard } from "@/lib/utils";
import type { LinkItem } from "@/types";

type Ecl = "L" | "M" | "Q" | "H";

interface QrOptions {
  fg: string;
  bg: string;
  ecl: Ecl;
  margin: number;
  size: number;
  logo: string | null;
  logoScale: number;
  track: boolean;
}

const DEFAULTS: QrOptions = {
  fg: "#000000",
  bg: "#ffffff",
  ecl: "M",
  margin: 4,
  size: 1024,
  logo: null,
  logoScale: 0.22,
  track: true,
};

const PRESETS = [
  { name: "Classic", fg: "#000000", bg: "#ffffff" },
  { name: "Linkly", fg: "#144ee3", bg: "#ffffff" },
  { name: "Berry", fg: "#c2185b", bg: "#fff5f8" },
  { name: "Forest", fg: "#14532d", bg: "#f0fdf4" },
  { name: "Night", fg: "#0b101b", bg: "#e8edf7" },
  { name: "Sunset", fg: "#9a3412", bg: "#fff7ed" },
];

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

async function buildSvg(text: string, opts: QrOptions): Promise<string> {
  let svg = await QRCode.toString(text, {
    type: "svg",
    // A centre logo hides modules, so it needs the highest error correction.
    errorCorrectionLevel: opts.logo ? "H" : opts.ecl,
    margin: opts.margin,
    color: { dark: opts.fg, light: opts.bg },
  });
  const modules = Number(/viewBox="0 0 (\d+(?:\.\d+)?) /.exec(svg)?.[1] ?? 0);
  if (opts.logo && modules) {
    const logoSize = modules * opts.logoScale;
    const pad = logoSize * 0.14;
    const start = (modules - logoSize) / 2;
    const plate = logoSize + pad * 2;
    svg = svg.replace(
      "</svg>",
      `<rect x="${start - pad}" y="${start - pad}" width="${plate}" height="${plate}" rx="${plate * 0.2}" fill="${opts.bg}"/>` +
        `<image href="${opts.logo}" x="${start}" y="${start}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet"/></svg>`,
    );
  }
  return svg.replace("<svg ", `<svg width="${opts.size}" height="${opts.size}" `);
}

async function svgToPng(svg: string, size: number): Promise<Blob> {
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(img, 0, 0, size, size);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("PNG export failed"))),
      "image/png",
    ),
  );
}

/** Branded QR codes, rendered entirely in the browser (logos never leave the device). */
export function QrDesigner({ link }: { link: LinkItem }) {
  const [opts, setOpts] = useState<QrOptions>(DEFAULTS);
  const [svg, setSvg] = useState("");
  const content = opts.track ? `${link.shortUrl}?qr=1` : link.shortUrl;
  const ratio = contrast(opts.fg, opts.bg);
  const inverted = luminance(opts.fg) > luminance(opts.bg);

  function set<K extends keyof QrOptions>(key: K, value: QrOptions[K]) {
    setOpts((prev) => ({ ...prev, [key]: value }));
  }

  useEffect(() => {
    let cancelled = false;
    buildSvg(content, opts)
      .then((result) => !cancelled && setSvg(result))
      .catch(() => !cancelled && setSvg(""));
    return () => {
      cancelled = true;
    };
  }, [content, opts]);

  const previewSrc = useMemo(
    () => (svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : ""),
    [svg],
  );
  const filename = `qr-${link.shortCode.replace(/[^\w-]/g, "") || "link"}`;

  const apiUrl = useMemo(() => {
    const params = new URLSearchParams({
      ...(link.domain ? { domain: link.domain } : {}),
      fg: opts.fg.slice(1),
      bg: opts.bg.slice(1),
      size: String(opts.size),
      ec: opts.ecl,
      margin: String(opts.margin),
      ...(opts.track ? {} : { track: "0" }),
    });
    return `${typeof window === "undefined" ? "" : window.location.origin}/api/qr/${encodeURIComponent(link.shortCode)}?${params}`;
  }, [link, opts]);

  async function onLogo(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Choose an image file");
    if (file.size > 1_000_000) return toast.error("Logos up to 1 MB, please");
    const reader = new FileReader();
    reader.onload = () => set("logo", String(reader.result));
    reader.readAsDataURL(file);
  }

  async function downloadPng() {
    try {
      const blob = await svgToPng(svg, opts.size);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-5">
        <Panel className="space-y-5">
          <div>
            <p className="text-card-foreground mb-2 text-[13px] font-medium">Style presets</p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => setOpts((prev) => ({ ...prev, fg: preset.fg, bg: preset.bg }))}
                  className={cn(
                    "border-border hover:border-primary/60 flex cursor-pointer items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-xs font-medium transition-colors",
                    opts.fg === preset.fg &&
                      opts.bg === preset.bg &&
                      "border-primary ring-primary/30 ring-2",
                  )}
                >
                  <span
                    className="flex size-6 items-center justify-center rounded-full border border-black/10"
                    style={{ background: preset.bg }}
                  >
                    <span className="size-3 rounded-sm" style={{ background: preset.fg }} />
                  </span>
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {(["fg", "bg"] as const).map((key) => (
              <Field key={key} label={key === "fg" ? "Foreground" : "Background"}>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={opts[key]}
                    onChange={(e) => set(key, e.target.value)}
                    aria-label={`${key === "fg" ? "Foreground" : "Background"} color`}
                    className="border-border h-10 w-12 shrink-0 cursor-pointer rounded-xl border bg-transparent p-1"
                  />
                  <input
                    value={opts[key]}
                    onChange={(e) =>
                      /^#[0-9a-fA-F]{0,6}$/.test(e.target.value) &&
                      set(key, e.target.value.toLowerCase())
                    }
                    className={cn(inputClass, "font-mono uppercase")}
                    maxLength={7}
                  />
                </div>
              </Field>
            ))}
          </div>
          {(ratio < 3 || inverted) && (
            <p className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              {inverted
                ? "Light modules on a dark background are not decoded by many phone cameras. Keep the foreground darker."
                : "Low contrast between colors - some phones may struggle to scan this. Test before printing."}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Error correction"
              hint={
                opts.logo
                  ? "Locked to High while a logo is used."
                  : "Higher survives damage and logos better."
              }
            >
              <Segmented
                size="sm"
                value={opts.logo ? "H" : opts.ecl}
                onChange={(v) => !opts.logo && set("ecl", v as Ecl)}
                options={[
                  { value: "L", label: "Low" },
                  { value: "M", label: "Medium" },
                  { value: "Q", label: "Quartile" },
                  { value: "H", label: "High" },
                ]}
              />
            </Field>
            <Field label={`Quiet zone: ${opts.margin} modules`} hint="4 or more is recommended.">
              <input
                type="range"
                min={0}
                max={10}
                value={opts.margin}
                onChange={(e) => set("margin", Number(e.target.value))}
                className="accent-primary mt-2 w-full"
              />
            </Field>
          </div>

          <Field label={`Export size: ${opts.size} px`}>
            <input
              type="range"
              min={256}
              max={2048}
              step={128}
              value={opts.size}
              onChange={(e) => set("size", Number(e.target.value))}
              className="accent-primary w-full"
            />
          </Field>
        </Panel>

        <Panel className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-foreground text-sm font-semibold">Center logo</p>
              <p className="text-muted-foreground text-xs">
                PNG or SVG with a transparent background looks best. Stays on your device.
              </p>
            </div>
            {opts.logo ? (
              <button
                type="button"
                className={cn(pill.secondary, pill.small)}
                onClick={() => set("logo", null)}
              >
                <X /> Remove
              </button>
            ) : (
              <label className={cn(pill.secondary, pill.small)}>
                <ImagePlus /> Upload
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => onLogo(e.target.files?.[0])}
                />
              </label>
            )}
          </div>
          {opts.logo && (
            <Field label={`Logo size: ${Math.round(opts.logoScale * 100)}%`}>
              <input
                type="range"
                min={0.12}
                max={0.3}
                step={0.01}
                value={opts.logoScale}
                onChange={(e) => set("logoScale", Number(e.target.value))}
                className="accent-primary w-full"
              />
            </Field>
          )}
        </Panel>

        <Panel className="p-2">
          <ToggleRow
            title="Track scans"
            description="Adds ?qr=1 so scans appear as 'QR code' in analytics. It is stripped before redirecting."
            checked={opts.track}
            onCheckedChange={(v) => set("track", v)}
          />
        </Panel>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <Panel>
          <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl bg-white p-3 shadow-inner">
            {previewSrc && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewSrc} alt={`QR code for ${link.displayUrl}`} className="size-full" />
            )}
          </div>
          <p className="text-muted-foreground mt-3 text-center text-xs break-all">{content}</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" className={pill.primary} disabled={!svg} onClick={downloadPng}>
              <Download /> PNG
            </button>
            <button
              type="button"
              className={pill.secondary}
              disabled={!svg}
              onClick={() => downloadText(svg, `${filename}.svg`, "image/svg+xml")}
            >
              <Download /> SVG
            </button>
          </div>
          <button
            type="button"
            className={cn(pill.ghost, pill.small, "mt-2 w-full")}
            onClick={() => setOpts(DEFAULTS)}
          >
            <RotateCcw /> Reset
          </button>
        </Panel>
        <Panel>
          <p className="text-foreground text-sm font-semibold">Image URL</p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Embed this QR in emails or docs (logo not included).
          </p>
          <div className="mt-2 flex gap-2">
            <code className="bg-secondary text-muted-foreground min-w-0 flex-1 truncate rounded-lg px-2.5 py-2 text-[11px]">
              {apiUrl}
            </code>
            <button
              type="button"
              aria-label="Copy image URL"
              className={pill.icon}
              onClick={async () => {
                await copyToClipboard(apiUrl);
                toast.success("Image URL copied");
              }}
            >
              <Copy />
            </button>
          </div>
        </Panel>
      </aside>
    </div>
  );
}
