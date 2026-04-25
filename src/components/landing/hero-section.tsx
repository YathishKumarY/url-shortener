"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Link2,
  Loader2,
  Copy,
  Check,
  HelpCircle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { LinklyIcon } from "@/components/shared/linkly-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { copyToClipboard } from "@/lib/utils";

type ShortenedLink = {
  id: string;
  shortCode: string;
  shortUrl: string;
  originalUrl: string;
  clickCount: number;
  createdAt: string;
  isActive: boolean;
};

function CopyCell({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    await copyToClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      onClick={handleCopy}
      className="copy-btn-bg text-card-foreground hover:text-foreground flex shrink-0 items-center justify-center rounded-full p-2.5 transition-colors"
    >
      {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
    </button>
  );
}

function MobileAccordionRow({ link, dim }: { link: ShortenedLink; dim?: boolean }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`${dim ? "glass-row-dim" : "glass-row"}`}>
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="text-card-foreground truncate text-sm font-light">{link.shortUrl}</span>
          <CopyCell text={link.shortUrl} />
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="copy-btn-bg text-card-foreground hover:text-foreground ml-2 flex shrink-0 items-center justify-center rounded-full p-2.5 transition-colors"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>
      {expanded && (
        <div className="space-y-3 px-6 pb-4">
          <div className="flex items-center gap-2.5">
            <img
              src={`https://www.google.com/s2/favicons?domain=${new URL(link.originalUrl).hostname}&sz=32`}
              alt=""
              className="h-8 w-8 shrink-0 rounded"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <span className="text-card-foreground truncate text-sm font-light">
              {link.originalUrl}
            </span>
          </div>
          <div className="text-card-foreground flex items-center justify-between text-sm">
            <span className="font-light">{link.clickCount} clicks</span>
            <span className={`font-light ${link.isActive ? "text-[#1eb036]" : "text-[#b0901e]"}`}>
              {link.isActive ? "Active" : "Inactive"}
            </span>
            <span className="font-light">
              {new Date(link.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export function HeroSection() {
  const [url, setUrl] = useState("");
  const [links, setLinks] = useState<ShortenedLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const trialLinksRemaining = Math.max(0, 5 - links.length);

  async function handleShorten(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.url?.[0] ?? "Failed to shorten URL");
        return;
      }

      const data = await res.json();
      const newLink: ShortenedLink = {
        id: data.id ?? String(Date.now()),
        shortCode: data.shortCode,
        shortUrl: data.shortUrl,
        originalUrl: url,
        clickCount: 0,
        createdAt: new Date().toISOString(),
        isActive: true,
      };
      setLinks((prev) => [newLink, ...prev]);
      setUrl("");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="relative z-10 flex flex-col items-center px-6 pt-8 pb-12 text-center sm:px-6 md:pt-16">
      {/* Title */}
      <h1 className="max-w-4xl text-[35px] leading-[1.185] font-extrabold tracking-tight sm:text-4xl md:text-[60px] md:leading-[80px]">
        <span className="gradient-title">Shorten Your Loooong Links :)</span>
      </h1>

      <p className="text-card-foreground mt-5 max-w-[358px] text-base leading-[23.5px] font-light md:max-w-xl">
        Linkly is an efficient and easy-to-use URL shortening service that streamlines your online
        experience.
      </p>

      {/* Desktop URL Input pill */}
      <form onSubmit={handleShorten} className="mt-10 hidden w-full max-w-[660px] sm:block">
        <div className="shadow-soft search-pill relative flex items-center rounded-[48px]">
          <div className="flex flex-1 items-center gap-4 pl-6">
            <LinklyIcon className="h-5 w-5 shrink-0" />
            <Input
              type="url"
              placeholder="Enter the link here"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="text-card-foreground placeholder:text-card-foreground h-[68px] border-0 bg-transparent text-base font-light focus-visible:ring-0"
            />
          </div>
          <div className="pr-2">
            <Button
              type="submit"
              disabled={loading}
              className="bg-primary shadow-blue hover:bg-primary/90 h-[60px] rounded-[48px] px-8 text-sm font-semibold text-white"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Shorten Now!"}
            </Button>
          </div>
        </div>
      </form>

      {/* Mobile URL Input pill - with circular arrow button */}
      <form onSubmit={handleShorten} className="mt-6 w-full sm:hidden">
        <div className="shadow-soft search-pill relative flex h-[60px] items-center rounded-[48px]">
          <div className="flex flex-1 items-center gap-5 pl-6">
            <LinklyIcon className="h-5 w-5 shrink-0" />
            <Input
              type="url"
              placeholder="Enter the link here"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="text-card-foreground placeholder:text-card-foreground h-full border-0 bg-transparent p-0 text-base font-light focus-visible:ring-0"
            />
          </div>
          <div className="pr-2">
            <Button
              type="submit"
              disabled={loading}
              className="bg-primary shadow-blue hover:bg-primary/90 h-[45px] w-[45px] rounded-full p-0 text-white"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </form>

      {error && <p className="text-destructive mt-3 text-sm">{error}</p>}

      {/* Trial message */}
      <div className="mt-8 flex flex-col items-center gap-6">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-card-foreground text-center font-light">
            You can create{" "}
            <span className="font-bold text-[#eb568e]">
              {String(trialLinksRemaining).padStart(2, "0")}
            </span>{" "}
            more links.
            <br className="sm:hidden" />
            <span className="hidden sm:inline"> </span>
            <Link
              href="/auth/signup"
              className="text-card-foreground hover:text-foreground font-bold underline decoration-solid"
            >
              Register Now
            </Link>{" "}
            to enjoy Unlimited usage
          </span>
          <HelpCircle className="text-card-foreground hidden h-4 w-4 sm:block" />
        </div>
      </div>

      {/* Links table */}
      {links.length > 0 && (
        <div className="mt-10 w-full max-w-6xl">
          <div className="flex flex-col gap-[3px]">
            {/* Desktop table header */}
            <div className="glass-header hidden items-center justify-between px-6 py-5 md:flex">
              <span className="text-card-foreground w-[220px] text-left text-[15px] font-bold">
                Short Link
              </span>
              <span className="text-card-foreground w-[320px] text-left text-[15px] font-bold">
                Original Link
              </span>
              <span className="text-card-foreground w-[80px] text-center text-[15px] font-bold">
                QR Code
              </span>
              <span className="text-card-foreground w-[60px] text-center text-[15px] font-bold">
                Clicks
              </span>
              <span className="text-card-foreground w-[100px] text-center text-[15px] font-bold">
                Status
              </span>
              <span className="text-card-foreground w-[120px] text-center text-[15px] font-bold">
                Date
              </span>
            </div>

            {/* Mobile header */}
            <div className="glass-header flex items-center rounded-t-[10px] px-6 py-5 md:hidden">
              <span className="text-card-foreground text-[15px] font-bold">Shorten Links</span>
            </div>

            {/* Desktop rows */}
            {links.map((link, idx) => (
              <div
                key={link.id}
                className={`${idx >= 5 ? "glass-row-dim" : "glass-row"} hidden items-center justify-between px-6 py-4 md:flex`}
              >
                <div className="flex w-[220px] items-center gap-2.5">
                  <span className="text-card-foreground truncate text-sm font-light">
                    {link.shortUrl}
                  </span>
                  <CopyCell text={link.shortUrl} />
                </div>

                <div className="flex w-[320px] items-center gap-2.5">
                  <img
                    src={`https://www.google.com/s2/favicons?domain=${new URL(link.originalUrl).hostname}&sz=32`}
                    alt=""
                    className="h-8 w-8 shrink-0 rounded"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  <span className="text-card-foreground truncate text-sm font-light">
                    {link.originalUrl}
                  </span>
                </div>

                <div className="flex w-[80px] justify-center">
                  <div className="h-9 w-9 rounded bg-white/10 opacity-40" />
                </div>

                <span className="text-card-foreground w-[60px] text-center text-sm font-light">
                  {link.clickCount}
                </span>

                <div className="flex w-[100px] items-center justify-center gap-2">
                  <span
                    className={`text-sm font-light ${link.isActive ? "text-[#1eb036]" : "text-[#b0901e]"}`}
                  >
                    {link.isActive ? "Active" : "Inactive"}
                  </span>
                  <div
                    className={`flex items-center justify-center rounded-full p-2 ${link.isActive ? "bg-[rgba(30,176,54,0.14)]" : "bg-[rgba(176,144,30,0.19)]"}`}
                  >
                    <Link2
                      className={`h-4 w-4 ${link.isActive ? "text-card-foreground" : "text-[#b0901e]"}`}
                    />
                  </div>
                </div>

                <span className="text-card-foreground w-[120px] text-center text-sm font-light">
                  {new Date(link.createdAt)
                    .toLocaleDateString("en-US", {
                      month: "short",
                      day: "2-digit",
                      year: "numeric",
                    })
                    .replace(",", " -")
                    .replace(" ", " - ")}
                </span>
              </div>
            ))}

            {/* Mobile accordion rows */}
            {links.map((link, idx) => (
              <div key={`mobile-${link.id}`} className="md:hidden">
                <MobileAccordionRow link={link} dim={idx >= 5} />
              </div>
            ))}
          </div>

          {/* Bottom fade overlay */}
          {links.length > 3 && (
            <div className="bottom-fade relative -mt-36 flex h-36 w-full items-end justify-center pb-4">
              <p className="text-card-foreground text-sm font-light">
                <Link
                  href="/auth/signup"
                  className="text-primary hover:text-primary/80 underline decoration-solid"
                >
                  Register Now
                </Link>{" "}
                to enjoy Unlimited History
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
