/** Tailwind classes per tag colour, readable in both themes. */
export const TAG_COLOR_CLASSES: Record<string, string> = {
  blue: "bg-blue-500/12 text-blue-700 ring-blue-500/25 dark:text-blue-300",
  green: "bg-green-500/12 text-green-700 ring-green-500/25 dark:text-green-300",
  pink: "bg-pink-500/12 text-pink-700 ring-pink-500/25 dark:text-pink-300",
  amber: "bg-amber-500/12 text-amber-700 ring-amber-500/25 dark:text-amber-300",
  purple: "bg-violet-500/12 text-violet-700 ring-violet-500/25 dark:text-violet-300",
  teal: "bg-teal-500/12 text-teal-700 ring-teal-500/25 dark:text-teal-300",
  red: "bg-red-500/12 text-red-700 ring-red-500/25 dark:text-red-300",
  gray: "bg-zinc-500/12 text-zinc-700 ring-zinc-500/25 dark:text-zinc-300",
};

export const TAG_DOT_CLASSES: Record<string, string> = {
  blue: "bg-blue-500",
  green: "bg-green-500",
  pink: "bg-pink-500",
  amber: "bg-amber-500",
  purple: "bg-violet-500",
  teal: "bg-teal-500",
  red: "bg-red-500",
  gray: "bg-zinc-500",
};

export function tagClasses(color: string): string {
  return TAG_COLOR_CLASSES[color] ?? TAG_COLOR_CLASSES.gray;
}
