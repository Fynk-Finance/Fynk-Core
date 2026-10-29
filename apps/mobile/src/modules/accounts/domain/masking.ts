// Card and account numbers are shown only as their last 4 digits (HU-019, Security rules).
// These functions never return more than 4 digits, whatever they are given.

/** The last 4 digits of whatever the bank sent (`****4821`, `4821`), or null when it has none. */
export function last4Of(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  return digits ? digits.slice(-4) : null;
}

/** `4821` → `•• 4821`. Null when there is no number to show. */
export function maskedNumber(last4: string | null | undefined): string | null {
  const digits = last4Of(last4);
  return digits ? `•• ${digits}` : null;
}
