"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Clock, BarChart3, MousePointerClick, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "History", href: "/dashboard", icon: Clock },
  { label: "Statistics", href: "/dashboard/statistics", icon: BarChart3 },
  {
    label: "Click Stream",
    href: "/dashboard/click-stream",
    icon: MousePointerClick,
  },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

export function TabNav() {
  const pathname = usePathname();
  const router = useRouter();
  const navRef = useRef<HTMLElement>(null);
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  const activeIndex = tabs.findIndex((tab) =>
    tab.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(tab.href),
  );

  const updateIndicator = useCallback(() => {
    const el = tabRefs.current[activeIndex];
    const nav = navRef.current;
    if (!el || !nav) return;
    const navRect = nav.getBoundingClientRect();
    const tabRect = el.getBoundingClientRect();
    setIndicator({
      left: tabRect.left - navRect.left + tabRect.width / 2 - 56,
      width: 112,
    });
  }, [activeIndex]);

  useEffect(() => {
    updateIndicator();
    window.addEventListener("resize", updateIndicator);
    return () => window.removeEventListener("resize", updateIndicator);
  }, [updateIndicator]);

  function handleTabClick(e: React.MouseEvent, href: string) {
    e.preventDefault();
    if (!document.startViewTransition) {
      router.push(href);
      return;
    }
    document.startViewTransition(() => {
      router.push(href);
    });
  }

  return (
    <div className="bg-secondary shadow-soft relative z-10 backdrop-blur-[14px]">
      <nav
        ref={navRef}
        className="scrollbar-none relative flex justify-between gap-0 overflow-x-auto px-2 sm:justify-center sm:gap-1 sm:px-6"
      >
        {tabs.map((tab, i) => {
          const active = i === activeIndex;
          return (
            <a
              key={tab.href}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              href={tab.href}
              onClick={(e) => handleTabClick(e, tab.href)}
              className={cn(
                "relative flex flex-1 items-center justify-center gap-1.5 px-3 py-4 text-xs font-bold whitespace-nowrap transition-colors duration-300 sm:flex-none sm:gap-2.5 sm:px-8 sm:py-5 sm:text-[15px]",
                active
                  ? "text-card-foreground"
                  : "text-card-foreground/70 hover:text-card-foreground",
              )}
            >
              {active && <div className="tab-glow absolute inset-x-0 top-0 h-full" />}
              <tab.icon className="relative h-4 w-4 shrink-0" />
              <span className="relative hidden sm:inline">{tab.label}</span>
            </a>
          );
        })}

        {/* Sliding bottom indicator */}
        <div
          className="bg-primary shadow-blue absolute bottom-0 h-1 rounded-full transition-all duration-500 ease-in-out"
          style={{
            left: indicator.left,
            width: indicator.width,
          }}
        />
      </nav>
    </div>
  );
}
