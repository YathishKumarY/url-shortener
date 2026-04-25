"use client";

import Link from "next/link";
import { LogOut, User, LogIn, ChevronDown } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Navbar() {
  const { data: session } = useSession();

  return (
    <nav className="relative z-10 px-6 py-6 md:px-12">
      <div className="flex items-center justify-between">
        <Link href="/" className="flex items-baseline">
          <span className="gradient-logo text-[37px] font-extrabold">Linkly</span>
          <span className="text-foreground/50 -mt-3 -ml-0.5 text-sm">®</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-4 sm:flex">
          {session?.user ? (
            <>
              <Link
                href="/dashboard"
                className="border-border bg-secondary text-secondary-foreground shadow-soft hover:bg-secondary/80 flex items-center gap-2 rounded-[48px] border px-6 py-4 text-sm font-semibold transition-colors"
              >
                Dashboard
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger className="border-border bg-secondary shadow-soft flex cursor-pointer items-center gap-2 rounded-[48px] border px-6 py-3 outline-none">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={session.user.image ?? undefined} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {session.user.name?.charAt(0)?.toUpperCase() ?? <User className="h-4 w-4" />}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start">
                    <span className="text-foreground text-[10px] leading-tight font-light">
                      Welcome
                    </span>
                    <span className="text-foreground text-sm leading-tight font-semibold">
                      {session.user.name ?? "User"}
                    </span>
                  </div>
                  <ChevronDown className="text-card-foreground h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem className="text-muted-foreground text-xs" disabled>
                    {session.user.email}
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
            </>
          ) : (
            <>
              <Link
                href="/auth/signin"
                className="border-border bg-secondary text-secondary-foreground shadow-soft hover:bg-secondary/80 flex items-center gap-2.5 rounded-[48px] border px-6 py-4 text-base font-semibold transition-colors"
              >
                Login
                <LogIn className="text-card-foreground h-5 w-5" />
              </Link>
              <Link
                href="/auth/signup"
                className="bg-primary shadow-blue hover:bg-primary/90 rounded-[48px] px-6 py-4 text-base font-semibold text-white transition-colors"
              >
                Register Now
              </Link>
            </>
          )}
        </div>

        {/* Mobile nav - just Login button, no hamburger */}
        <div className="flex items-center gap-3 sm:hidden">
          {session?.user ? (
            <Link
              href="/dashboard"
              className="border-border bg-secondary text-secondary-foreground shadow-soft rounded-[48px] border px-6 py-3 text-base font-semibold"
            >
              Dashboard
            </Link>
          ) : (
            <Link
              href="/auth/signin"
              className="border-border bg-secondary text-secondary-foreground shadow-soft flex items-center gap-2.5 rounded-[48px] border px-6 py-3 text-base font-semibold"
            >
              Login
              <LogIn className="text-card-foreground h-5 w-5" />
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
