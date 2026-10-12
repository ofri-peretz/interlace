/**
 * The all-packages npm downloads milestone ("0.75M+"), never hand-typed.
 *
 * Source: the token `refresh-profile-stats.yml` writes into the GitHub profile
 * README from the North Star ratchet (`eng_downloads_cumulative`, which counts
 * every package in the catalog: ESLint, burgee, serverless). Floored to a
 * milestone and never decreasing, so reading it here inherits both rules.
 *
 * ponytail: reads the published README instead of Supabase because the
 * landing build has no Supabase credentials; switch to the ratchet view if it
 * ever does.
 */
const PROFILE_README =
  "https://raw.githubusercontent.com/ofri-peretz/ofri-peretz/main/README.md";

export const DOWNLOADS_TOKEN = /(\d+(?:\.\d+)?[KM]\+) npm downloads/;

export function parseDownloads(readme: string): string | null {
  return readme.match(DOWNLOADS_TOKEN)?.[1] ?? null;
}

/** null when the README is unreachable or the token is gone; the hero then omits the line. */
export async function getDownloadsMilestone(): Promise<string | null> {
  try {
    const res = await fetch(PROFILE_README, { next: { revalidate: 86_400 } });
    return res.ok ? parseDownloads(await res.text()) : null;
  } catch {
    return null;
  }
}
