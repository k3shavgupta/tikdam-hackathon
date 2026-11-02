export const dynamic = "force-static";
import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: "https://tikdam.xyz", changeFrequency: "monthly", priority: 1 }];
}
