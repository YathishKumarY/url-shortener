import { Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import { getAppOrigin } from "@/lib/app-url";
import type { Metadata, Viewport } from "next";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(getAppOrigin()),
  title: {
    default: "Linkly - URL Shortener with Analytics, QR Codes and More",
    template: "%s | Linkly",
  },
  description:
    "Short links with superpowers: passwords, self-destructing links, device and geo targeting, A/B tests, branded QR codes, custom domains, link-in-bio pages and real-time analytics. Open source.",
  applicationName: "Linkly",
  openGraph: {
    type: "website",
    siteName: "Linkly",
    title: "Linkly - Short links with superpowers",
    description:
      "Passwords, targeting, A/B tests, QR codes, custom domains and real-time analytics. Open source.",
  },
  twitter: { card: "summary", title: "Linkly - Short links with superpowers" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b101b" },
    { media: "(prefers-color-scheme: light)", color: "#f8f9fb" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable}`} suppressHydrationWarning>
      <body className="bg-background text-foreground min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
