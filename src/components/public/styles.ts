/**
 * Monospace font stack for URLs and code samples.
 *
 * Tailwind's `font-mono` maps to `var(--font-geist-mono)`, which no layout
 * loads, so it silently falls back to the body font. Naming the system
 * monospace fonts directly keeps URLs and code aligned regardless.
 */
export const mono = "font-[family-name:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace]";
