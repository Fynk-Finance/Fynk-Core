// Checks the accounts M5 writes after a sync (upsertFromSync) before they reach the vault.
// One row per (provider, providerAccountId): the vault keeps the id of the first row it saw.
import type { Account, IsoDate } from '@shared/domain/types';

import { last4Of } from './masking';

export class InvalidSyncedAccountError extends Error {
  constructor(reason: string) {
    super(`Invalid synced account: ${reason}`);
    this.name = 'InvalidSyncedAccountError';
  }
}

const isMoney = (v: number | null): boolean => v === null || Number.isSafeInteger(v);

function check(a: Account): void {
  if (a.provider === 'manual' || a.kind === 'cash') {
    throw new InvalidSyncedAccountError('manual accounts are not written by sync');
  }
  if (!a.providerAccountId) throw new InvalidSyncedAccountError('providerAccountId is missing');
  if (!a.linkId) throw new InvalidSyncedAccountError('linkId is missing');
  if (!isMoney(a.balanceMinor) || !isMoney(a.availableMinor) || !isMoney(a.creditLimitMinor)) {
    throw new InvalidSyncedAccountError('amounts must be integer centavos');
  }
  if (a.kind === 'cdt' && !a.cdt) throw new InvalidSyncedAccountError('a CDT needs its details');
}

const keyOf = (a: Account): string => `${a.provider}\u0000${a.providerAccountId}`;

/**
 * Validates and cleans the accounts of a sync: one per (provider, providerAccountId), the last
 * one wins, and only the last 4 digits of the number are kept. Throws on a malformed account,
 * so a bad sync never writes half of its accounts.
 */
export function cleanSyncedAccounts(incoming: readonly Account[]): Account[] {
  const byKey = new Map<string, Account>();
  for (const a of incoming) {
    check(a);
    byKey.delete(keyOf(a));
    byKey.set(keyOf(a), { ...a, last4: last4Of(a.last4), currency: 'COP' });
  }
  return [...byKey.values()];
}

// America/Bogota is UTC-5 all year (Colombia has no daylight saving time).
const BOGOTA_OFFSET_MS = -5 * 60 * 60 * 1000;

/** The calendar day in Bogotá, used as the day of a balance history point. */
export function bogotaDate(now: Date): IsoDate {
  return new Date(now.getTime() + BOGOTA_OFFSET_MS).toISOString().slice(0, 10);
}
