"use client";

import Link from "next/link";
import { pill } from "@/components/shared/ui-kit";
import { cn } from "@/lib/utils";

interface PillLinkProps extends Omit<React.ComponentProps<"a">, "href"> {
  href: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "default" | "sm";
  /**
   * Render a plain <a>. Required for short links and external URLs: next/link
   * prefetches internal paths, and fetching a short link would count a click
   * (or use up a one-time link) before the visitor even chose to open it.
   */
  native?: boolean;
}

/**
 * A link styled as one of the app's pill buttons.
 *
 * Lives in a client module because `pill` comes from the client-only ui-kit,
 * and a server component cannot read properties of a client module's export.
 */
export function PillLink({
  href,
  variant = "primary",
  size = "default",
  native = false,
  className,
  ...props
}: PillLinkProps) {
  const classes = cn(pill[variant], size === "sm" && pill.small, className);
  if (native) return <a href={href} className={classes} {...props} />;
  return <Link href={href} className={classes} {...props} />;
}
