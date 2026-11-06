import messages from "@/data/brand-messages.json";
import numbers from "@/data/interlace-numbers.json";

/**
 * The one source for Interlace copy. `brand-messages.json` holds the words;
 * counts stay generated in the eslint repo (`interlace-numbers.json`) and the
 * downloads milestone comes from the profile README. Every `{path}` placeholder
 * is filled here, so pages and the published /brand.json never hand-type a number.
 */
export type BrandMessages = typeof messages;

export function fillPlaceholders(text: string, downloads: string | null): string {
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
export function renderBrand(downloads: string | null): BrandMessages {
  return JSON.parse(
    JSON.stringify(messages, (_key, value) =>
      typeof value === "string" ? fillPlaceholders(value, downloads) : value,
    ),
  ) as BrandMessages;
}
