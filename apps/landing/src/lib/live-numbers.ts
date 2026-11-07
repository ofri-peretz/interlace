import committed from "@/data/interlace-numbers.json";

/**
 * Counts read live, so a new rule or a new package never needs a PR here.
 * Rules and plugins: the manifest the eslint repo generates on every release.
 * Packages: npm itself, every package the maintainer publishes from an Interlace repo.
 * Both are cached for a day; when a source is unreachable the committed snapshot stands in.
 */
const ESLINT_MANIFEST =
  "https://raw.githubusercontent.com/ofri-peretz/eslint/main/apps/docs/src/data/interlace-numbers.json";
const NPM_SEARCH = "https://registry.npmjs.org/-/v1/search?text=maintainer:ofriperetz&size=250";

const REPOS = ["eslint", "burgee", "serverless"] as const;
type Repo = (typeof REPOS)[number];
export type PackageCounts = Record<Repo | "total", number>;

// oxmutate ships from the burgee repo but is its own product, so it isn't a burgee package.
const OWN_PRODUCTS = new Set(["oxmutate"]);

// ponytail: what npm reported on 2026-11-07; only used when npm is unreachable.
export const PACKAGES_FALLBACK: PackageCounts = { total: 77, eslint: 63, burgee: 10, serverless: 3 };

interface NpmObject {
  package: { name: string; version: string; links?: { repository?: string } };
}

/** Shipped packages per Interlace repo. 0.x versions are name reservations, not products. */
export function countPackages(objects: NpmObject[]): PackageCounts {
  const counts: PackageCounts = { total: 0, eslint: 0, burgee: 0, serverless: 0 };
  for (const { package: p } of objects) {
    const repoUrl = (p.links?.repository ?? "").toLowerCase();
    const repo = REPOS.find((r) => repoUrl.includes(`ofri-peretz/${r}`));
    if (!repo || Number(p.version.split(".")[0]) < 1) continue;
    counts.total++;
    if (!(repo === "burgee" && OWN_PRODUCTS.has(p.name))) counts[repo]++;
  }
  return counts;
}

export const FALLBACK_NUMBERS = { ...committed, packages: PACKAGES_FALLBACK };
export type LiveNumbers = typeof FALLBACK_NUMBERS;

async function fetchJson(url: string): Promise<unknown> {
  try {
    const res = await fetch(url, { next: { revalidate: 86_400 } });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

const isManifest = (m: unknown): m is typeof committed =>
  Number.isInteger((m as typeof committed)?.rules?.total) &&
  Number.isInteger((m as typeof committed)?.plugins?.total);

export async function getLiveNumbers(): Promise<LiveNumbers> {
  const [manifest, npm] = await Promise.all([fetchJson(ESLINT_MANIFEST), fetchJson(NPM_SEARCH)]);
  const objects = (npm as { objects?: NpmObject[] } | null)?.objects;
  const packages = Array.isArray(objects) ? countPackages(objects) : PACKAGES_FALLBACK;
  return {
    ...(isManifest(manifest) ? manifest : committed),
    packages: packages.total ? packages : PACKAGES_FALLBACK,
  };
}
