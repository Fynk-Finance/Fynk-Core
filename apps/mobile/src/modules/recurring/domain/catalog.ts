// The shared merchant catalog on the phone (SCRUM-58, M9 prompt): find the merchant of a movement
// and how to cancel it. Pure. The catalog holds no personal data; Fynk never cancels anything.
import type { CatalogMerchant } from './detect';

export interface CatalogEntry {
  key: string;
  displayName: string;
  /** A movement category id of the app. */
  category: string;
  isSubscription: boolean;
  /** Normalized words that recognise the merchant inside a normalized description. */
  matchPatterns: string[];
  /** The official cancellation page, opened in the browser. */
  cancelUrl: string | null;
  cancelSteps: string[];
}

/**
 * The catalog entry of a merchant key: the same key, or else the entry with the longest pattern
 * found as whole words in the key ("cargo netflix com" matches "netflix").
 */
export function findMerchant(
  entries: readonly CatalogEntry[],
  merchantKey: string | null,
): CatalogEntry | null {
  if (!merchantKey) return null;
  const exact = entries.find((e) => e.key === merchantKey);
  if (exact) return exact;
  const padded = ` ${merchantKey} `;
  let best: { entry: CatalogEntry; length: number } | null = null;
  for (const entry of entries) {
    for (const pattern of entry.matchPatterns) {
      if (pattern && padded.includes(` ${pattern} `) && pattern.length > (best?.length ?? 0))
        best = { entry, length: pattern.length };
    }
  }
  return best?.entry ?? null;
}

/** What detection needs from an entry (domain/detect.ts). */
export const forDetection = (entry: CatalogEntry | null): CatalogMerchant | null =>
  entry ? { displayName: entry.displayName, isSubscription: entry.isSubscription } : null;

/** Only an https link to the merchant's own page is opened. */
export function safeCancelUrl(entry: CatalogEntry | null): string | null {
  const url = entry?.cancelUrl;
  return url && /^https:\/\/[^\s]+$/.test(url) ? url : null;
}
