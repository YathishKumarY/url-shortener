import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-border/30 relative z-10 border-t px-6 py-10 md:px-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 md:flex-row md:justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-baseline">
          <span className="gradient-logo text-2xl font-extrabold">Linkly</span>
          <span className="text-foreground/50 -mt-2 -ml-0.5 text-[10px]">®</span>
        </Link>

        {/* Nav links */}
        <nav className="text-card-foreground flex items-center gap-8 text-sm font-light">
          <Link href="/" className="hover:text-foreground transition-colors">
            Home
          </Link>
          <Link href="/auth/signin" className="hover:text-foreground transition-colors">
            Login
          </Link>
          <Link href="/auth/signup" className="hover:text-foreground transition-colors">
            Register
          </Link>
        </nav>

        {/* Copyright */}
        <p className="text-card-foreground/60 text-xs font-light">
          &copy; {new Date().getFullYear()} Linkly. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
