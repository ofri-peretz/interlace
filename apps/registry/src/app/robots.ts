import type { MetadataRoute } from 'next';

const BASE = 'https://ds.interlace.tools';

/**
 * robots.txt for ds.interlace.tools.
 *
 * Allow everything except the build-artifact / framework-internal routes
 * that Next sometimes exposes. Point crawlers at the sitemap so they can
 * fan out to every `/c/<name>` page in one fetch.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/_next/'],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
