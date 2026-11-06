"use client";

import { Plus, Trash2 } from "lucide-react";
import { inputClass, pill } from "@/components/shared/ui-kit";
import { COMMON_COUNTRIES, countryFlag, countryName } from "@/lib/countries";
import { cn } from "@/lib/utils";

export interface GeoRow {
  country: string;
  url: string;
}

const COUNTRY_OPTIONS = [...COMMON_COUNTRIES].sort((a, b) =>
  countryName(a).localeCompare(countryName(b)),
);

export function GeoTargetsEditor({
  rows,
  onChange,
}: {
  rows: GeoRow[];
  onChange: (rows: GeoRow[]) => void;
}) {
  const used = new Set(rows.map((r) => r.country));
  const nextCountry = COUNTRY_OPTIONS.find((c) => !used.has(c)) ?? "US";

  return (
    <div className="space-y-2">
      {rows.map((row, index) => (
        <div key={index} className="flex flex-col gap-2 sm:flex-row">
          <select
            value={row.country}
            aria-label="Country"
            onChange={(e) =>
              onChange(rows.map((r, i) => (i === index ? { ...r, country: e.target.value } : r)))
            }
            className={cn(inputClass, "sm:w-52")}
          >
            {COUNTRY_OPTIONS.map((code) => (
              <option key={code} value={code} disabled={used.has(code) && code !== row.country}>
                {countryFlag(code)} {countryName(code)}
              </option>
            ))}
          </select>
          <div className="flex flex-1 gap-2">
            <input
              value={row.url}
              aria-label={`Destination for ${countryName(row.country)}`}
              onChange={(e) =>
                onChange(rows.map((r, i) => (i === index ? { ...r, url: e.target.value } : r)))
              }
              placeholder="https://example.com/de"
              className={inputClass}
            />
            <button
              type="button"
              aria-label={`Remove ${countryName(row.country)}`}
              onClick={() => onChange(rows.filter((_, i) => i !== index))}
              className={cn(pill.icon, "size-10")}
            >
              <Trash2 />
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...rows, { country: nextCountry, url: "" }])}
        disabled={rows.length >= 50}
        className={cn(pill.secondary, pill.small)}
      >
        <Plus /> Add country
      </button>
    </div>
  );
}

export interface VariantRow {
  url: string;
  weight: number;
}

const VARIANT_COLORS = ["#144ee3", "#eb568e", "#1eb036", "#b0901e", "#8b5cf6"];

export function VariantsEditor({
  rows,
  onChange,
}: {
  rows: VariantRow[];
  onChange: (rows: VariantRow[]) => void;
}) {
  const total = rows.reduce((sum, r) => sum + r.weight, 0) || 1;

  return (
    <div className="space-y-3">
      {/* Traffic split bar */}
      <div className="flex h-2.5 overflow-hidden rounded-full">
        {rows.map((row, i) => (
          <div
            key={i}
            className="transition-[width] duration-300"
            style={{
              width: `${(row.weight / total) * 100}%`,
              backgroundColor: VARIANT_COLORS[i % VARIANT_COLORS.length],
            }}
          />
        ))}
      </div>
      {rows.map((row, index) => (
        <div key={index} className="border-border/70 space-y-2 rounded-xl border p-3">
          <div className="flex items-center gap-2">
            <span
              className="flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
              style={{ backgroundColor: VARIANT_COLORS[index % VARIANT_COLORS.length] }}
            >
              {String.fromCharCode(65 + index)}
            </span>
            <input
              value={row.url}
              aria-label={`Variant ${String.fromCharCode(65 + index)} URL`}
              onChange={(e) =>
                onChange(rows.map((r, i) => (i === index ? { ...r, url: e.target.value } : r)))
              }
              placeholder={`https://example.com/landing-${String.fromCharCode(97 + index)}`}
              className={cn(inputClass, "h-9")}
            />
            {rows.length > 2 && (
              <button
                type="button"
                aria-label={`Remove variant ${String.fromCharCode(65 + index)}`}
                onClick={() => onChange(rows.filter((_, i) => i !== index))}
                className={cn(pill.icon, "size-9")}
              >
                <Trash2 />
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={100}
              value={row.weight}
              aria-label={`Variant ${String.fromCharCode(65 + index)} weight`}
              onChange={(e) =>
                onChange(
                  rows.map((r, i) => (i === index ? { ...r, weight: Number(e.target.value) } : r)),
                )
              }
              className="accent-primary flex-1"
            />
            <span className="text-foreground w-12 text-right text-sm font-semibold tabular-nums">
              {Math.round((row.weight / total) * 100)}%
            </span>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...rows, { url: "", weight: 50 }])}
        disabled={rows.length >= 5}
        className={cn(pill.secondary, pill.small)}
      >
        <Plus /> Add variant
      </button>
      <p className="text-muted-foreground text-xs">
        Each visitor is assigned a variant and keeps seeing it on repeat visits. Compare results in
        the link&apos;s analytics under Destinations.
      </p>
    </div>
  );
}
