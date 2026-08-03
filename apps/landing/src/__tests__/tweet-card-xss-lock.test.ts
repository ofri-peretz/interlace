import { MagicTweet } from "#interlace/components/marketing/tweet-card";
import { renderToStaticMarkup } from "react-dom/server";
import type { EnrichedTweet } from "react-tweet";
/**
 * TweetCard XSS lock — CWE-79 (Claude Code Review finding on PR #6, deferred).
 *
 * `TweetBody`'s 'text' case used to render `entity.text` via
 * `dangerouslySetInnerHTML` with no sanitization. Twitter's syndication API
 * normally HTML-encodes tweet text, but a malicious/edited tweet or an
 * upstream encoding miss would have been parsed as live markup. The fix
 * decodes the small set of entities Twitter emits and renders as a plain
 * text child instead, so React's own text-escaping makes injected markup
 * inert by construction — no sanitizer library needed.
 *
 * `enrichTweet` is mocked to a passthrough: this test constructs the
 * already-"enriched" shape directly and asserts on the actual `MagicTweet` /
 * `TweetBody` render path, without pulling in `react-tweet`'s theme CSS.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("react-tweet", () => ({
  enrichTweet: (tweet: unknown) => tweet,
}));

const enrichedTweetWithText = (text: string) =>
  ({
    id_str: "1",
    text,
    url: "https://x.com/testuser/status/1",
    user: {
      name: "Test User",
      screen_name: "testuser",
      profile_image_url_https: "https://example.com/avatar.png",
      verified: false,
      is_blue_verified: false,
      url: "https://x.com/testuser",
      follow_url: "https://x.com/intent/follow?screen_name=testuser",
    },
    entities: [{ type: "text", text }],
  }) as unknown as EnrichedTweet;

describe("TweetCard XSS lock", () => {
  it("renders a <script> tag in tweet text as inert text, not live markup", () => {
    const html = renderToStaticMarkup(
      // @ts-expect-error — mocked `enrichTweet` accepts the already-enriched shape.
      MagicTweet({
        tweet: enrichedTweetWithText("hello <script>alert(1)</script>"),
      }),
    );

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("renders an on*-attribute injection as inert text, not a live attribute", () => {
    const html = renderToStaticMarkup(
      // @ts-expect-error — mocked `enrichTweet` accepts the already-enriched shape.
      MagicTweet({
        tweet: enrichedTweetWithText('<img src=x onerror="alert(1)">'),
      }),
    );

    expect(html).not.toMatch(/<img[^>]*onerror/i);
    expect(html).toContain("&lt;img src=x onerror=");
  });

  it("still decodes legitimate entities Twitter pre-escapes (e.g. &amp;)", () => {
    const html = renderToStaticMarkup(
      // @ts-expect-error — mocked `enrichTweet` accepts the already-enriched shape.
      MagicTweet({ tweet: enrichedTweetWithText("Q&amp;A session") }),
    );

    expect(html).toContain("Q&amp;A session");
    expect(html).not.toContain("&amp;amp;");
  });
});
