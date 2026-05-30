import type { MetadataRoute } from 'next';

import { listItemNames, loadIndex } from '@/lib/registry';

const BASE = 'https://ds.interlace.tools';

/**
 * Sitemap for ds.interlace.tools.
 *
 * Emits one entry per static route + one per `/c/<name>` page generated
 * from the registry index. ~95 URLs total (3 static + ~92 components),
 * all reachable, all internally linked from `/`. Google + Bing pick this
 * up automatically; we don't need to register it.
 *
 * Re-evaluated on each build. The registry is static (built from sources
 * on every push to main), so sitemap freshness == repo freshness.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [names, _index] = await Promise.all([listItemNames(), loadIndex()]);

  const lastModified = new Date('2026-05-30');

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${BASE}/`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${BASE}/getting-started`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
  ];

  const componentRoutes: MetadataRoute.Sitemap = names.map((name) => ({
    url: `${BASE}/c/${name}`,
    lastModified,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  return [...staticRoutes, ...componentRoutes];
}
