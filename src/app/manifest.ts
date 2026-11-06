import type { MetadataRoute } from "next";

/**
 * Installable PWA. The share target puts Linkly in the OS share sheet
 * (Android, ChromeOS, desktop Chrome): sharing a page opens the link builder
 * with the URL filled in.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Linkly - URL Shortener",
    short_name: "Linkly",
    description: "Short links with analytics, QR codes, targeting and more.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#0b101b",
    theme_color: "#144ee3",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/apple-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
    share_target: {
      action: "/dashboard/links/new",
      method: "GET",
      params: { title: "title", text: "text", url: "url" },
    },
    shortcuts: [
      { name: "New link", url: "/dashboard/links/new" },
      { name: "Analytics", url: "/dashboard/statistics" },
      { name: "Live clicks", url: "/dashboard/click-stream" },
    ],
  };
}
