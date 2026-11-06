import { getAppOrigin } from "@/lib/app-url";
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const origin = getAppOrigin();
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/docs"],
        disallow: ["/dashboard", "/admin", "/api/", "/auth", "/unlock", "/link-"],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
  };
}
