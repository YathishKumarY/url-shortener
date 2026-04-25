"use client";

import { useState } from "react";
import Link from "next/link";
import { LogOut, ChevronDown, Loader2, User } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { toast } from "sonner";
import { LinklyIcon } from "@/components/shared/linkly-icon";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useCreateLink } from "@/hooks/use-links";
import { copyToClipboard } from "@/lib/utils";

export function TopBar() {
  const { data: session } = useSession();
  const [url, setUrl] = useState("");
  const createLink = useCreateLink();

  async function handleShorten(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    try {
      const link = await createLink.mutateAsync({ url: url.trim() });
      const shortUrl = `${window.location.origin}/${link.shortCode}`;
      await copyToClipboard(shortUrl);
      toast.success("Link shortened & copied to clipboard!");
      setUrl("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to shorten");
    }
  }

  return (
    <header className="relative z-10 px-6 py-6 md:px-12">
      <div className="flex items-center">
        {/* Center group: Logo + URL input */}
        <div className="hidden flex-1 items-center justify-center gap-6 sm:flex">
          <Link href="/dashboard" className="flex shrink-0 items-baseline">
            <span className="gradient-logo text-4xl font-extrabold">Linkly</span>
            <span className="text-foreground/50 -mt-3 -ml-0.5 text-sm">®</span>
          </Link>

          <form onSubmit={handleShorten} className="flex max-w-3xl flex-1">
            <div className="shadow-soft search-pill relative flex w-full items-center rounded-[48px]">
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
                  disabled={createLink.isPending}
                  className="bg-primary shadow-blue hover:bg-primary/90 h-[60px] rounded-[48px] px-8 text-sm font-semibold text-white"
                >
                  {createLink.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Shorten Now!"
                  )}
                </Button>
              </div>
            </div>
          </form>
        </div>

        {/* Mobile logo */}
        <Link href="/dashboard" className="flex shrink-0 items-baseline sm:hidden">
          <span className="gradient-logo text-4xl font-extrabold">Linkly</span>
          <span className="text-foreground/50 -mt-3 -ml-0.5 text-sm">®</span>
        </Link>

        {/* Right: user controls */}
        <div className="ml-auto flex shrink-0 items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger className="border-border bg-secondary shadow-soft flex h-[60px] cursor-pointer items-center gap-2.5 rounded-[48px] border px-6 outline-none">
              <Avatar className="h-8 w-8">
                <AvatarImage src={session?.user?.image ?? undefined} />
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                  {session?.user?.name?.charAt(0)?.toUpperCase() ?? <User className="h-4 w-4" />}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-start">
                <span className="text-foreground text-[10px] leading-tight font-light">
                  Welcome
                </span>
                <span className="text-foreground text-base leading-tight font-semibold">
                  {session?.user?.name ?? "User"}
                </span>
              </div>
              <ChevronDown className="text-card-foreground h-5 w-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem className="text-muted-foreground text-xs" disabled>
                {session?.user?.email}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => signOut({ callbackUrl: "/" })}
                className="text-destructive cursor-pointer"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Mobile URL input */}
      <form onSubmit={handleShorten} className="mt-4 flex items-center gap-2 sm:hidden">
        <div className="relative flex-1">
          <LinklyIcon className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            type="url"
            placeholder="Enter the link here"
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
