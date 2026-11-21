// Detection of recurring payments on the phone (SCRUM-55, M9 prompt "Detection algorithm").
// Pure: the caller passes the movements of the last 12 months, the catalog lookup, the items
// the person already has, the proposals they dismissed and today's date in Bogotá.
import type { CategoryId, Id, IsoDate, MoneyMinor, Transaction } from '@shared/domain/types';

import { nextCharge } from './schedule';
import type { RecurringKind, Schedule, WeekdaysMask } from './types';

/** What the shared merchant catalog (M9 backend) says about a merchant. */
export interface CatalogMerchant {
  displayName: string;
  isSubscription: boolean;
}

export interface DetectInput {
  transactions: readonly Transaction[];
  catalog: (merchantKey: string) => CatalogMerchant | null;
  /** Merchants that already have a recurring item. */
  knownMerchantKeys: ReadonlySet<string>;
  /** Merchant key → amount of the proposal the person dismissed. */
  dismissed: ReadonlyMap<string, MoneyMinor>;
  today: IsoDate;
}

export interface Proposal {
  merchantKey: string;
  name: string;
  kind: RecurringKind;
  categoryId: CategoryId;
  /** The most recent charge. The person can edit it. */
  amountMinor: MoneyMinor;
  schedule: Schedule;
  nextChargeOn: IsoDate;
  /** Account or card of the most recent charge. */
  accountId: Id;
  /** 0 to 1. Only proposals at or above MIN_SCORE are returned. */
  score: number;
  transactionIds: Id[];
}

export const MIN_SCORE = 0.7;

/** Moving money between the person's own accounts is not an expense. */
const NOT_EXPENSES: ReadonlySet<CategoryId> = new Set([
  'transfers',
  'card_payment',
  'savings',
  'salary',
  'income_other',
]);
/** Bills whose amount changes every month. */
const VARIABLE: ReadonlySet<CategoryId> = new Set(['utilities', 'telecom']);
/** A proposal dismissed by the person comes back only when the amount changes this much. */
const DISMISSED_CHANGE = 0.3;

const DAY_MS = 24 * 60 * 60 * 1000;
const BOGOTA_OFFSET_MS = -5 * 60 * 60 * 1000;

/** Calendar day in Bogotá, as days since 1970-01-01. */
const bogotaDay = (iso: string) => Math.floor((Date.parse(iso) + BOGOTA_OFFSET_MS) / DAY_MS);
const isoDay = (day: number): IsoDate => new Date(day * DAY_MS).toISOString().slice(0, 10);
const dayOfMonth = (day: number) => new Date(day * DAY_MS).getUTCDate();
const weekdayOf = (day: number) => new Date(day * DAY_MS).getUTCDay();

function median(values: readonly number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

function mode(values: readonly number[]): number {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]![0];
}

interface Charge {
  tx: Transaction;
  day: number;
  amount: MoneyMinor; // positive
}

interface Rhythm {
  schedule: Schedule;
  /** Typical days between charges, used to tell a stopped payment. */
  period: number;
  /** Fraction of the intervals that fit the rhythm. */
  regularity: number;
}

const fraction = (ok: number, total: number) => (total === 0 ? 0 : ok / total);

/** Weekdays seen in at least a fifth of the charges of the busiest weekday. */
function weekdaysOf(days: readonly number[]): WeekdaysMask {
  const counts = new Array<number>(7).fill(0);
  for (const d of days) counts[weekdayOf(d)]! += 1;
  const busiest = Math.max(...counts);
  return counts.reduce((mask, n, wd) => (n * 5 >= busiest ? mask | (1 << wd) : mask), 0);
}

/** Step 3 of the algorithm: classify by the median interval between charges. */
function rhythmOf(days: readonly number[]): Rhythm | null {
  const intervals = days.slice(1).map((d, i) => d - days[i]!);
  const m = median(intervals);
  const fits = (lo: number, hi: number) =>
    fraction(intervals.filter((i) => i >= lo && i <= hi).length, intervals.length);

  if (m >= 1 && m <= 3) {
    // Daily on the weekdays it happens; skipping a weekend or a holiday is still regular.
    return {
      schedule: { periodicity: 'daily', weekdaysMask: weekdaysOf(days) },
      period: 1,
      regularity: fits(1, 4),
    };
  }
  if (m >= 5 && m <= 9) {
    return {
      schedule: { periodicity: 'weekly', weekdaysMask: 1 << mode(days.map(weekdayOf)) },
      period: 7,
      regularity: fits(5, 9),
    };
  }
  if (m >= 11 && m <= 17) {
    return {
      schedule: { periodicity: 'biweekly', anchorDate: isoDay(days[days.length - 1]!) },
      period: 14,
      regularity: fits(11, 17),
    };
  }
  if (m >= 25 && m <= 36) {
    // 28 to 33 days, or the same day of the month ± 3 (February, the 31st).
    const anchorDay = mode(days.map(dayOfMonth));
    const sameDay = (d: number) => Math.abs(dayOfMonth(d) - anchorDay) <= 3;
    const regular = intervals.filter((iv, i) => (iv >= 28 && iv <= 33) || sameDay(days[i + 1]!));
    return {
      schedule: { periodicity: 'monthly', anchorDay },
      period: 31,
      regularity: fraction(regular.length, intervals.length),
    };
  }
  if (m >= 360 && m <= 370) {
    return {
      schedule: { periodicity: 'yearly', anchorDate: isoDay(days[days.length - 1]!) },
      period: 365,
      regularity: fits(360, 370),
    };
  }
  return null;
}

function groupByMerchant(transactions: readonly Transaction[]): Map<string, Charge[]> {
  const groups = new Map<string, Charge[]>();
  for (const tx of transactions) {
    if (tx.amountMinor >= 0 || tx.status !== 'booked' || !tx.merchantKey) continue;
    if (NOT_EXPENSES.has(tx.categoryId)) continue;
    const charge = { tx, day: bogotaDay(tx.bookedAt), amount: -tx.amountMinor };
    groups.set(tx.merchantKey, [...(groups.get(tx.merchantKey) ?? []), charge]);
  }
  for (const charges of groups.values()) charges.sort((a, b) => a.day - b.day);
  return groups;
}

function proposalFor(
  merchantKey: string,
  charges: Charge[],
  input: DetectInput,
  todayDay: number,
): Proposal | null {
  const catalog = input.catalog(merchantKey);
  const last = charges[charges.length - 1]!;
  const categoryId = last.tx.categoryId;
  const isSubscription = catalog?.isSubscription === true || categoryId === 'subscriptions';

  // Step 2: at least 3 charges, or 2 for a known subscription.
  if (charges.length < (catalog?.isSubscription ? 2 : 3)) return null;

  const rhythm = rhythmOf(charges.map((c) => c.day));
  if (!rhythm) return null;

  // A payment that stopped (no charge for two periods) is not proposed.
  if (todayDay - last.day > 2 * rhythm.period + 3) return null;

  // Step 4: amounts within ± 10 % of the median, ± 35 % for utilities and telecom.
  const typical = median(charges.map((c) => c.amount));
  const tolerance = VARIABLE.has(categoryId) ? 0.35 : 0.1;
  const stable = charges.filter((c) => Math.abs(c.amount - typical) <= typical * tolerance);
  const stability = fraction(stable.length, charges.length);

  // Step 5: score from regularity, stability and a catalog match.
  const score = Math.min(1, 0.45 * rhythm.regularity + 0.45 * stability + (catalog ? 0.1 : 0));
  if (score < MIN_SCORE) return null;

  // Step 9: a dismissed proposal returns only after a change of more than 30 %.
  const dismissedAt = input.dismissed.get(merchantKey);
  if (
    dismissedAt !== undefined &&
    Math.abs(last.amount - dismissedAt) <= dismissedAt * DISMISSED_CHANGE
  ) {
    return null;
  }

  // Step 7: next charge after the last one; monthly keeps its day.
  const next = nextCharge(rhythm.schedule, isoDay(last.day + 1));
  if (!next) return null;

  return {
    merchantKey,
    name: catalog?.displayName ?? last.tx.merchantRaw ?? last.tx.description,
    kind: isSubscription ? 'subscription' : 'fixed', // step 6
    categoryId,
    amountMinor: last.amount, // step 8
    schedule: rhythm.schedule,
    nextChargeOn: next,
    accountId: last.tx.accountId,
    score: Math.round(score * 100) / 100,
    transactionIds: charges.map((c) => c.tx.id),
  };
}

/** Steps 1 to 9. Proposals, best score first. Never confirms anything by itself. */
export function detectRecurring(input: DetectInput): Proposal[] {
  const todayDay = Date.parse(`${input.today}T00:00:00Z`) / DAY_MS;
  const proposals: Proposal[] = [];
  for (const [merchantKey, charges] of groupByMerchant(input.transactions)) {
    if (input.knownMerchantKeys.has(merchantKey)) continue;
    const p = proposalFor(merchantKey, charges, input, todayDay);
    if (p) proposals.push(p);
  }
  return proposals.sort((a, b) => b.score - a.score || a.merchantKey.localeCompare(b.merchantKey));
}
