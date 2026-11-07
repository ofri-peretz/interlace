import messages from "@/data/brand-messages.json";
import { getDownloadsMilestone } from "@/lib/downloads";
import { FALLBACK_NUMBERS, getLiveNumbers, type LiveNumbers } from "@/lib/live-numbers";

/**
 * The one source for Interlace copy. `brand-messages.json` holds the words;
 * counts are read live (`live-numbers.ts`) and the downloads milestone comes
 * from the profile README. Every `{path}` placeholder is filled here, so pages
 * and the published /brand.json never hand-type a number.
 */
export type BrandMessages = typeof messages;

export function fillPlaceholders(
  text: string,
  downloads: string | null,
  numbers: LiveNumbers = FALLBACK_NUMBERS,
): string {
  return text.replace(/\{([\w.]+)\}/g, (token, path: string) => {
    if (path === "downloads") return downloads ?? "1M+";
    const value = path
      .split(".")
      .reduce<unknown>((node, key) => (node as Record<string, unknown>)?.[key], numbers);
    if (typeof value !== "number") throw new Error(`brand: unknown placeholder ${token}`);
    return String(value);
  });
}

/** Messages with every placeholder filled. Throws on an unknown placeholder. */
export function renderBrand(
  downloads: string | null,
  numbers: LiveNumbers = FALLBACK_NUMBERS,
): BrandMessages {
  return JSON.parse(
    JSON.stringify(messages, (_key, value) =>
      typeof value === "string" ? fillPlaceholders(value, downloads, numbers) : value,
    ),
  ) as BrandMessages;
}

/** The brand with today's numbers: what pages, /brand.json and llms.txt serve. */
export async function getBrand(): Promise<BrandMessages> {
  const [downloads, numbers] = await Promise.all([getDownloadsMilestone(), getLiveNumbers()]);
  return renderBrand(downloads, numbers);
}
