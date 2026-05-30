import type { MetadataRoute } from "next";
import { source } from "#interlace/lib/source";

const SITE_URL = "https://interlace.tools";

export const revalidate = false;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const docs: MetadataRoute.Sitemap = source.getPages().map((page) => ({
    url: `${SITE_URL}${page.url}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/docs`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    ...docs,
  ];
}
