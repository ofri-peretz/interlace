"use client";

import { useEffect, useState } from "react";

const STORYBOOK_URL = "https://storybook.interlace.tools";

/**
 * A LIVE render of the component, embedded from the deployed Storybook.
 *
 * Deliberately an iframe rather than importing the component here: the story
 * being shown is the exact one the `storybook (a11y)` CI gate renders and runs
 * axe against, so the preview can never show something that hasn't been
 * verified — and the registry site ships zero component JS to do it.
 *
 * `args` overrides let one story serve several demos: the skeleton preview is
 * the same story with `loading:!true`, so every component with a `loading`
 * prop gets a skeleton demo, not just the 11 with a dedicated Loading story.
 *
 * Client-side only because of the theme. This app follows
 * `prefers-color-scheme` by toggling `.dark` on `<html>`; a light story canvas
 * dropped into the near-black page is the first thing on the page and reads as
 * broken. `?globals=theme:dark` does NOT work against the deployed Storybook
 * (verified — the story still renders light), so we swap to the component's
 * `--dark` story, which carries the theme decorator and is itself a11y-gated.
 */

export function storyUrl(storyId: string, args?: string): string {
  const query = new URLSearchParams({ id: storyId, viewMode: "story" });
  if (args) query.set("args", args);
  return `${STORYBOOK_URL}/iframe.html?${query.toString()}`;
}

type Props = {
  storyId: string;
  /** Dark-theme twin. Falls back to `storyId` when the component has none. */
  darkStoryId?: string | null;
  label: string;
  args?: string;
  /** Preview frame height in px. Stories are centred, so this is generous. */
  height?: number;
};

export function StoryPreview({
  storyId,
  darkStoryId,
  label,
  args,
  height = 320,
}: Props) {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setTheme(media.matches ? "dark" : "light");
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const shown = theme === "dark" && darkStoryId ? darkStoryId : storyId;

  return (
    <figure className="border-border bg-card/40 overflow-hidden rounded-lg border">
      {theme ? (
        /*
         * The title IS set — from the per-preview `label` prop, unique per
         * frame ("live render", "loading state", one per example story). The
         * rule only recognises a string literal, so it can't see through the
         * JSX expression container.
         */
        // eslint-disable-next-line react-a11y/iframe-has-title
        <iframe
          src={storyUrl(shown, args)}
          title={label}
          loading="lazy"
          className="bg-background block w-full"
          style={{ height }}
        />
      ) : (
        <div
          className="bg-card/60 animate-pulse"
          style={{ height }}
          aria-hidden
        />
      )}
      <figcaption className="border-border text-muted-foreground flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2 text-xs">
        <span>{label}</span>
        <a
          href={`${STORYBOOK_URL}/?path=/story/${shown}`}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-foreground font-mono transition-colors"
        >
          {shown} ↗
        </a>
      </figcaption>
    </figure>
  );
}
