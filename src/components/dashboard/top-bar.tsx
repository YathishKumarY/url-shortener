"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  ChevronDown,
  Loader2,
  LogOut,
  Plus,
  Settings,
  ShieldCheck,
  User,
  UserRound,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { toast } from "sonner";
import { LinklyIcon } from "@/components/shared/linkly-icon";
import { Kbd } from "@/components/shared/ui-kit";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useCreateLink } from "@/hooks/use-links";
import { copyToClipboard } from "@/lib/utils";

/** Prepend https:// when someone pastes a bare domain like "example.com/page". */
export function normalizeUrlInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || /^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function TopBar() {
  const { data: session } = useSession();
  const router = useRouter();
  const [url, setUrl] = useState("");
  const createLink = useCreateLink();
  const inputRef = useRef<HTMLInputElement>(null);

  // Cmd/Ctrl+K jumps to the quick-shorten box from anywhere in the dashboard.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function handleShorten(e: React.FormEvent) {
    e.preventDefault();
    const value = normalizeUrlInput(url);
    if (!value) return;

    try {
      const link = await createLink.mutateAsync({ url: value });
      await copyToClipboard(link.shortUrl);
      toast.success("Short link copied to clipboard", {
        description: link.displayUrl,
        action: {
          label: "Edit",
          onClick: () => router.push(`/dashboard/links/${link.id}?tab=settings`),
        },
      });
      setUrl("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to shorten");
    }
  }

  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <header className="relative z-10 px-4 py-5 sm:px-6">
      <div className="mx-auto flex max-w-6xl items-center gap-4">
        <Link
          href="/dashboard"
          className="flex shrink-0 items-baseline"
          aria-label="Linkly dashboard"
        >
          <span className="gradient-logo text-3xl font-extrabold sm:text-4xl">Linkly</span>
          <span className="text-foreground/50 -mt-3 -ml-0.5 text-sm">®</span>
        </Link>

        <form onSubmit={handleShorten} className="mx-auto hidden max-w-3xl flex-1 sm:flex">
          <div className="shadow-soft search-pill relative flex w-full items-center rounded-[48px]">
            <div className="flex flex-1 items-center gap-3 pl-5">
              <LinklyIcon className="h-5 w-5 shrink-0" />
              <Input
                ref={inputRef}
                type="text"
                inputMode="url"
                aria-label="URL to shorten"
                placeholder="Paste a long link to shorten it instantly"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="text-card-foreground placeholder:text-card-foreground/70 h-[56px] border-0 bg-transparent text-base font-light focus-visible:ring-0 dark:bg-transparent"
              />
              <span className="hidden items-center gap-1 lg:flex">
                <Kbd>⌘</Kbd>
                <Kbd>K</Kbd>
              </span>
            </div>
            <div className="pr-1.5 pl-2">
              <Button
                type="submit"
                disabled={createLink.isPending}
                className="bg-primary shadow-blue hover:bg-primary/90 h-[46px] rounded-[48px] px-6 text-sm font-semibold text-white"
              >
                {createLink.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Shorten"}
              </Button>
            </div>
          </div>
        </form>

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:ml-0">
          <Link
            href="/dashboard/links/new"
            className="border-border bg-secondary shadow-soft text-card-foreground hover:text-foreground hidden h-[52px] items-center gap-2 rounded-[48px] border px-5 text-sm font-semibold transition-colors lg:flex"
          >
            <Plus className="h-4 w-4" />
            Advanced
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Account menu"
              className="border-border bg-secondary shadow-soft flex h-[52px] cursor-pointer items-center gap-2.5 rounded-[48px] border px-2 outline-none sm:px-4"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={session?.user?.image ?? undefined} />
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                  {session?.user?.name?.charAt(0)?.toUpperCase() ?? <User className="h-4 w-4" />}
                </AvatarFallback>
              </Avatar>
              <div className="hidden flex-col items-start md:flex">
                <span className="text-foreground text-[10px] leading-tight font-light">
                  Welcome
                </span>
                <span className="text-foreground max-w-[140px] truncate text-sm leading-tight font-semibold">
                  {session?.user?.name ?? "User"}
                </span>
              </div>
              <ChevronDown className="text-card-foreground hidden h-4 w-4 sm:block" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem className="text-muted-foreground text-xs" disabled>
                {session?.user?.email}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => router.push("/dashboard/links/new")}
                className="cursor-pointer"
              >
                <Plus className="mr-2 h-4 w-4" /> New link
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push("/dashboard/bio")}
                className="cursor-pointer"
              >
                <UserRound className="mr-2 h-4 w-4" /> Bio page
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push("/dashboard/settings")}
                className="cursor-pointer"
              >
                <Settings className="mr-2 h-4 w-4" /> Settings
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => window.open("/docs", "_blank")}
                className="cursor-pointer"
              >
                <BookOpen className="mr-2 h-4 w-4" /> API docs
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem onClick={() => router.push("/admin")} className="cursor-pointer">
                  <ShieldCheck className="mr-2 h-4 w-4" /> Admin
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => signOut({ callbackUrl: "/" })}
                className="text-destructive cursor-pointer"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <form onSubmit={handleShorten} className="mt-4 flex items-center gap-2 sm:hidden">
        <div className="relative flex-1">
          <LinklyIcon className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            type="text"
            inputMode="url"
            aria-label="URL to shorten"
            placeholder="Paste a long link"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="border-border bg-input h-12 rounded-[48px] pr-3 pl-9 text-sm"
          />
        </div>
        <Button
          type="submit"
          disabled={createLink.isPending}
          className="bg-primary shadow-blue h-12 shrink-0 rounded-[48px] px-5 text-sm font-semibold text-white"
        >
          {createLink.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Shorten"}
        </Button>
      </form>
    </header>
  );
}
