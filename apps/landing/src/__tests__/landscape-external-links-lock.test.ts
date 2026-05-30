/**
 * Landscape external-links lock — keeps the Landscape page's two outbound
 * sub-product links pointing at URLs that actually exist.
 *
 * Why: `content/docs/reference/landscape.mdx` is the Interlace docs hub's
 * "Evidence" entry point. It links to the per-product deep dives on
 * `eslint.interlace.tools` and `serverless.interlace.tools`. The
 * `internal-links.test.ts` lock in this app only validates same-host
 * `/docs/*` paths — cross-subdomain URLs are invisible to it, so an
 * outbound link can rot to a 404 silently. That's exactly what happened
 * with `https://eslint.interlace.tools/docs/reference/landscape`
 * (no such page; the equivalent content lives at
 * `/docs/getting-started/concepts/ecosystem`).
 *
 * What's locked:
 *   1. The ESLint outbound link points at a non-`/docs/reference/landscape`
 *      URL on `eslint.interlace.tools` (that URL is a confirmed 404).
 *   2. The Serverless outbound link still points at the serverless page
 *      that *does* exist at `/docs/reference/landscape` (asymmetric on
 *      purpose — the serverless app hosts a real page at that URL).
 *   3. Both links are HTTPS.
 *
 * If you add a new sub-product, add its outbound link to LANDSCAPE_OUTBOUND
 * below so this lock keeps it honest.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const LANDSCAPE_MDX = join(
  process.cwd(),
  "content/docs/reference/landscape.mdx",
);

interface OutboundClaim {
  readonly label: string;
  readonly host: string;
  readonly mustContainPath: string;
  readonly mustNotContainPath?: string;
}

const LANDSCAPE_OUTBOUND: readonly OutboundClaim[] = [
  {
    label: "ESLint plugin suite deep link",
    host: "eslint.interlace.tools",
    // The eslint app hosts the equivalent at /docs/getting-started/concepts/ecosystem.
    // There is NO page at /docs/reference/landscape on eslint.interlace.tools.
    mustContainPath: "/docs/getting-started/concepts/ecosystem",
    mustNotContainPath: "/docs/reference/landscape",
  },
  {
    label: "Serverless plugin suite deep link",
    host: "serverless.interlace.tools",
    // The serverless app DOES host a real page at /docs/reference/landscape.
    // Keep this asymmetric on purpose — it reflects reality.
    mustContainPath: "/docs/reference/landscape",
  },
];

describe("Landscape MDX outbound links", () => {
  const source = readFileSync(LANDSCAPE_MDX, "utf-8");

  it.each(LANDSCAPE_OUTBOUND)(
    "$label: links to https://$host$mustContainPath",
    ({ host, mustContainPath }) => {
      const expected = `https://${host}${mustContainPath}`;
      expect(
        source,
        `landscape.mdx must link to ${expected} — open the URL in a browser if this fails to confirm it still resolves.`,
      ).toContain(expected);
    },
  );

  it.each(
    LANDSCAPE_OUTBOUND.filter(
      (o): o is OutboundClaim & { mustNotContainPath: string } =>
        typeof o.mustNotContainPath === "string",
    ),
  )(
    "$label: does NOT link to https://$host$mustNotContainPath (confirmed 404)",
    ({ host, mustNotContainPath }) => {
      const forbidden = `https://${host}${mustNotContainPath}`;
      expect(
        source,
        `landscape.mdx must not link to ${forbidden} — that URL 404s. Use the deep-link target this lock asserts instead.`,
      ).not.toContain(forbidden);
    },
  );

  it("all external links from this file use HTTPS", () => {
    const httpMatches = source.match(/\bhttp:\/\/[^\s"')]+/g) ?? [];
    expect(
      httpMatches,
      `landscape.mdx contains insecure HTTP links: ${httpMatches.join(", ")}`,
    ).toHaveLength(0);
  });
});
