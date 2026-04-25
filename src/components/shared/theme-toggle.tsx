"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  const isDark = theme === "dark";

  function switchTheme(newTheme: string) {
    if (!document.startViewTransition) {
      setTheme(newTheme);
      return;
    }
    document.startViewTransition(() => {
      setTheme(newTheme);
    });
  }

  return (
    <>
      {/* Mobile: compact horizontal pill at bottom-right */}
      <div className="fixed right-4 bottom-6 z-50 sm:hidden">
        <div className="rounded-pill border-border bg-secondary shadow-soft relative flex h-[44px] w-[90px] items-center border">
          {/* Sliding highlight */}
          <div
            className="rounded-pill bg-primary shadow-blue absolute top-[3px] h-[38px] w-[42px] transition-all duration-500 ease-in-out"
            style={{ left: isDark ? "45px" : "3px" }}
          />
          <button
            onClick={() => switchTheme("light")}
            className="relative z-10 flex h-full w-1/2 cursor-pointer items-center justify-center"
            aria-label="Light theme"
          >
            <Sun
              className={`h-4.5 w-4.5 transition-colors duration-500 ${!isDark ? "text-white" : "text-card-foreground"}`}
            />
          </button>
          <button
            onClick={() => switchTheme("dark")}
            className="relative z-10 flex h-full w-1/2 cursor-pointer items-center justify-center"
            aria-label="Dark theme"
          >
            <Moon
              className={`h-4.5 w-4.5 transition-colors duration-500 ${isDark ? "text-white" : "text-card-foreground"}`}
            />
          </button>
        </div>
      </div>

      {/* Desktop: full vertical sidebar */}
      <div className="fixed top-1/2 right-0 z-50 hidden -translate-y-1/2 sm:block">
        <div className="relative h-[270px] w-[58px]">
          {/* Background pill */}
          <div className="rounded-pill border-border bg-secondary shadow-soft absolute inset-0 border" />

          {/* Sliding highlight pill */}
          <div
            className="rounded-pill bg-primary border-primary shadow-blue absolute left-1/2 w-[44px] -translate-x-1/2 border transition-all duration-500 ease-in-out"
            style={{
              top: isDark ? "calc(100% - 150px - 7px)" : "7px",
              height: isDark ? "150px" : "105px",
            }}
          />

          {/* Light option */}
          <button
            onClick={() => switchTheme("light")}
            className="absolute top-[15px] left-1/2 z-10 flex -translate-x-1/2 cursor-pointer flex-col items-center gap-2.5"
            aria-label="Light theme"
          >
            <Sun
              className={`h-5 w-5 transition-colors duration-500 ${!isDark ? "text-white" : "text-card-foreground"}`}
            />
            <span
              className={`text-base whitespace-nowrap transition-all duration-500 ${
                !isDark ? "font-bold text-white" : "text-card-foreground font-light"
              }`}
              style={{ writingMode: "vertical-rl" }}
            >
              Light
            </span>
          </button>

          {/* Dark Theme option */}
          <button
            onClick={() => switchTheme("dark")}
            className="absolute bottom-[15px] left-1/2 z-10 flex -translate-x-1/2 cursor-pointer flex-col items-center gap-2"
            aria-label="Dark theme"
          >
            <Moon
              className={`h-5 w-5 transition-colors duration-500 ${isDark ? "text-white" : "text-card-foreground"}`}
            />
            <span
              className={`text-base whitespace-nowrap transition-all duration-500 ${
                isDark ? "font-bold text-white" : "text-card-foreground font-light"
              }`}
              style={{ writingMode: "vertical-rl" }}
            >
              Dark Theme
            </span>
          </button>
        </div>
      </div>
    </>
  );
}
