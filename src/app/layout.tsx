import { Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import type { Metadata } from "next";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Linkly - URL Shortener",
    template: "%s | Linkly",
  },
  description: "Shorten your URLs, track clicks, and analyze your audience with Linkly.",
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
