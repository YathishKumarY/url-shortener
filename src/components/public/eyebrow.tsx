import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

/** Small labelled chip above a page title ("Link preview", "Public stats"). */
export function Eyebrow({
  icon: Icon,
  children,
  className,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "border-border/70 bg-secondary/70 text-card-foreground shadow-soft inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs font-medium",
        className,
      )}
    >
      <Icon className="text-primary size-3.5" aria-hidden />
      {children}
    </span>
  );
}
