import { getAppOrigin } from "@/lib/app-url";
import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = getAppOrigin();
  return [
    { url: `${origin}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${origin}/docs`, changeFrequency: "monthly", priority: 0.7 },
  ];
}
