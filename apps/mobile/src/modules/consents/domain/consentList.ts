// Rules of the Consentimientos list and detail (HU-007, HU-008). Pure: the time comes from a
// Clock the caller passes, dates are shown in America/Bogota.
import type { Consent, ConsentStatus } from './consent';

/** Status as of `now`: an active consent past its end is shown as expired at once. */
export function statusAt(consent: Pick<Consent, 'status' | 'expiresAt'>, now: Date): ConsentStatus {
  if (consent.status !== 'active' || !consent.expiresAt) return consent.status;
  return Date.parse(consent.expiresAt) <= now.getTime() ? 'expired' : 'active';
}

/** Only an active or pending consent can be revoked (the API answers 409 otherwise). */
export const canRevoke = (status: ConsentStatus): boolean =>
  status === 'active' || status === 'pending';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
// Colombia has no daylight saving time.
const BOGOTA_OFFSET_MS = -5 * 60 * 60 * 1000;

/** "3 sep 2026", the date format of Privacidad y datos, in Bogotá time. Empty when invalid. */
export function shortDate(iso: string | undefined): string {
  if (!iso) return '';
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return '';
  const d = new Date(time + BOGOTA_OFFSET_MS);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

const ORDER: Record<ConsentStatus, number> = {
  active: 0,
  pending: 1,
  expired: 2,
  revoked: 3,
  failed: 4,
};

/** Live consents first, then the ended ones; newest first inside each group. */
export function sortForList<T extends Pick<Consent, 'createdAt'>>(
  items: readonly (T & { status: ConsentStatus })[],
): (T & { status: ConsentStatus })[] {
  return [...items].sort(
    (a, b) =>
      ORDER[a.status] - ORDER[b.status] || Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
}

/** Entity name from M5's provider list; the id when the entity is no longer listed. */
export function entityName(provider: string, names: Readonly<Record<string, string>>): string {
  return names[provider] ?? provider;
}
