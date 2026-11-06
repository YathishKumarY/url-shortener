"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Link2,
  Radio,
  Settings,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";

interface Tab {
  label: string;
  href: string;
  icon: LucideIcon;
  match: (pathname: string) => boolean;
}

const TABS: Tab[] = [
  {
    label: "Links",
    href: "/dashboard",
    icon: Link2,
    match: (p) => p === "/dashboard" || p.startsWith("/dashboard/links"),
  },
  {
    label: "Analytics",
    href: "/dashboard/statistics",
    icon: BarChart3,
    match: (p) => p.startsWith("/dashboard/statistics"),
  },
  {
    label: "Live",
    href: "/dashboard/click-stream",
    icon: Radio,
    match: (p) => p.startsWith("/dashboard/click-stream"),
  },
  {
    label: "Bio page",
    href: "/dashboard/bio",
    icon: UserRound,
    match: (p) => p.startsWith("/dashboard/bio"),
  },
  {
    label: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
    match: (p) => p.startsWith("/dashboard/settings"),
  },
];

const ADMIN_TAB: Tab = {
  label: "Admin",
  href: "/admin",
  icon: ShieldCheck,
  match: (p) => p.startsWith("/admin"),
};

export function TabNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const navRef = useRef<HTMLElement>(null);
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  const tabs = session?.user?.role === "ADMIN" ? [...TABS, ADMIN_TAB] : TABS;
  const activeIndex = tabs.findIndex((tab) => tab.match(pathname));

  const tabCount = tabs.length;
  useEffect(() => {
    function updateIndicator() {
      const el = tabRefs.current[activeIndex];
      const nav = navRef.current;
      if (!el || !nav) {
        setIndicator({ left: 0, width: 0 });
        return;
      }
      const navRect = nav.getBoundingClientRect();
      const tabRect = el.getBoundingClientRect();
      const width = Math.min(96, tabRect.width - 16);
      setIndicator({
        left: tabRect.left - navRect.left + nav.scrollLeft + (tabRect.width - width) / 2,
        width,
      });
    }
    updateIndicator();
    window.addEventListener("resize", updateIndicator);
    return () => window.removeEventListener("resize", updateIndicator);
  }, [activeIndex, tabCount]);

  function handleTabClick(e: React.MouseEvent, href: string) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    if (!document.startViewTransition) {
      router.push(href);
      return;
    }
    document.startViewTransition(() => router.push(href));
  }

  return (
    <div className="bg-secondary shadow-soft relative z-10 backdrop-blur-[14px]">
      <nav
        ref={navRef}
        aria-label="Dashboard"
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
              aria-current={active ? "page" : undefined}
              aria-label={tab.label}
              onClick={(e) => handleTabClick(e, tab.href)}
              className={cn(
                "relative flex flex-1 items-center justify-center gap-1.5 px-3 py-4 text-xs font-bold whitespace-nowrap transition-colors duration-300 sm:flex-none sm:gap-2.5 sm:px-6 sm:py-5 sm:text-[15px]",
                active
                  ? "text-card-foreground"
                  : "text-card-foreground/65 hover:text-card-foreground",
              )}
            >
              {active && <div className="tab-glow absolute inset-x-0 top-0 h-full" />}
              <tab.icon className="relative h-4 w-4 shrink-0" />
              <span className="relative hidden sm:inline">{tab.label}</span>
            </a>
          );
        })}

        <div
          className="bg-primary shadow-blue absolute bottom-0 h-1 rounded-full transition-all duration-500 ease-in-out"
          style={{ left: indicator.left, width: indicator.width, opacity: indicator.width ? 1 : 0 }}
        />
      </nav>
    </div>
  );
}
