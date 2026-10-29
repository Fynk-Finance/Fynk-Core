// Pure domain of the Inversión tab (M15). Informative only: nothing here ranks, filters or
// highlights a product with the user's balance, income or profile (Decreto 2555, art.
// 2.40.1.1.2 and 2.40.1.1.3). The catalog functions do not even receive the user's data.
import type { Account, IsoDate, MoneyMinor } from '@shared/domain';

const DAY_MS = 86_400_000;

function days(from: IsoDate, to: IsoDate): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/**
 * Compound effective annual interest, rounded down to the peso:
 * interest = amount * ((1 + ea) ^ (days / 365) - 1). 1.000.000 at 10,50 % for 180 days is $50.471.
 */
export function estimatedInterestMinor(
  amountMinor: MoneyMinor,
  rateEaBps: number,
  termDays: number,
): MoneyMinor {
  if (amountMinor <= 0 || rateEaBps <= 0 || termDays <= 0) return 0;
  const pesos = amountMinor / 100;
  const interest = pesos * (Math.pow(1 + rateEaBps / 10_000, termDays / 365) - 1);
  return Math.floor(interest) * 100;
}

export interface CdtHolding {
  id: string;
  name: string;
  amountMinor: MoneyMinor;
  rateEaBps: number;
  termDays: number;
  openedOn: IsoDate;
  maturesOn: IsoDate;
  isSimulated: boolean;
}

/** The user's own CDTs from M6's accounts (active `cdt` accounts with details). */
export function holdingsFrom(accounts: readonly Account[]): CdtHolding[] {
  return accounts
    .filter((a) => a.kind === 'cdt' && a.status === 'active' && a.cdt !== null)
    .map((a) => ({
      id: a.id,
      name: a.displayName,
      amountMinor: a.balanceMinor,
      rateEaBps: a.cdt!.rateEaBps,
      termDays: a.cdt!.termDays,
      openedOn: a.cdt!.openedOn,
      maturesOn: a.cdt!.maturesOn,
      isSimulated: a.isSimulated,
    }))
    .sort((a, b) => a.maturesOn.localeCompare(b.maturesOn) || a.id.localeCompare(b.id));
}

export interface PortfolioSummary {
  totalMinor: MoneyMinor;
  /** Average rate weighted by amount, in basis points. Null without CDTs. */
  averageRateBps: number | null;
  /** Interest the CDTs earn during the calendar year of `today`. */
  yearInterestMinor: MoneyMinor;
  year: number;
  nextMaturity: IsoDate | null;
}

export function portfolioSummary(
  holdings: readonly CdtHolding[],
  today: IsoDate,
): PortfolioSummary {
  const year = Number(today.slice(0, 4));
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year + 1}-01-01`;
  let totalMinor = 0;
  let weighted = 0;
  let yearInterestMinor = 0;
  for (const h of holdings) {
    totalMinor += h.amountMinor;
    weighted += h.amountMinor * h.rateEaBps;
    const from = h.openedOn > yearStart ? h.openedOn : yearStart;
    const to = h.maturesOn < yearEnd ? h.maturesOn : yearEnd;
    const d = days(from, to);
    if (d > 0) yearInterestMinor += estimatedInterestMinor(h.amountMinor, h.rateEaBps, d);
  }
  const upcoming = holdings
    .map((h) => h.maturesOn)
    .filter((d) => d >= today)
    .sort();
  return {
    totalMinor,
    averageRateBps: totalMinor > 0 ? Math.round(weighted / totalMinor) : null,
    yearInterestMinor,
    year,
    nextMaturity: upcoming[0] ?? null,
  };
}

export type Risk = 'low' | 'moderate' | 'high';

export interface CdtProduct {
  id: string;
  name: string;
  issuer: string;
  termDays: number;
  rateEaBps: number;
  minAmountMinor: MoneyMinor;
  risk: Risk;
  simulated: boolean;
}

export type ExploreSort = 'name' | 'rate' | 'term';

/** Filters the person chooses. Empty means "all". */
export interface ExploreFilters {
  termDays: number | null;
  risk: Risk | null;
}

export const TERM_FILTERS = [90, 180, 360, 540] as const;
export const DEFAULT_SORT: ExploreSort = 'name'; // neutral

/**
 * Filters and sorts the catalog with what the person chose. It receives only the catalog and the
 * person's choices: no balance, income or profile can reach it.
 */
export function exploreCatalog(
  products: readonly CdtProduct[],
  filters: ExploreFilters,
  sort: ExploreSort,
): CdtProduct[] {
  const list = products.filter(
    (p) =>
      (filters.termDays === null || p.termDays === filters.termDays) &&
      (filters.risk === null || p.risk === filters.risk),
  );
  const byName = (a: CdtProduct, b: CdtProduct) => a.name.localeCompare(b.name, 'es');
  return [...list].sort((a, b) => {
    if (sort === 'rate') return b.rateEaBps - a.rateEaBps || byName(a, b);
    if (sort === 'term') return a.termDays - b.termDays || byName(a, b);
    return byName(a, b);
  });
}

export type ChartPeriod = '1M' | '3M' | '1A' | 'Todo';

export interface BalancePoint {
  date: IsoDate;
  balanceMinor: MoneyMinor;
}

/** The points of the chart for a period, oldest first. */
export function chartPoints(
  history: readonly BalancePoint[],
  period: ChartPeriod,
  today: IsoDate,
): BalancePoint[] {
  const back = { '1M': 31, '3M': 92, '1A': 366, Todo: Infinity }[period];
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  if (back === Infinity) return sorted;
  return sorted.filter((p) => {
    const d = days(p.date, today);
    return d >= 0 && d <= back;
  });
}

/** "10,50 % E.A." */
export function formatRate(bps: number): string {
  const whole = Math.floor(bps / 100);
  const cents = String(bps % 100).padStart(2, '0');
  return `${whole},${cents} % E.A.`;
}

/** 180 → "6 meses", 360 → "12 meses", 45 → "45 días". */
export function termLabel(termDays: number): string {
  const months: Record<number, number> = {
    30: 1,
    60: 2,
    90: 3,
    180: 6,
    270: 9,
    360: 12,
    365: 12,
    540: 18,
    720: 24,
  };
  const m = months[termDays];
  if (m) return `${m} ${m === 1 ? 'mes' : 'meses'}`;
  return `${termDays} días`;
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "2027-03-15" → "15 mar". With `withYear`, "15 mar 2027". */
export function shortDate(date: IsoDate, withYear = false): string {
  const [y, m, d] = date.split('-').map(Number);
  const text = `${d} ${MONTHS[(m ?? 1) - 1]}`;
  return withYear ? `${text} ${y}` : text;
}

/** US cents → "US$1.227,50". */
export function formatUsdCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.round(cents));
  const whole = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}US$${whole},${String(abs % 100).padStart(2, '0')}`;
}

/** 125 → "+1,25 %", -244 → "-2,44 %". */
export function formatChangeBps(bps: number): string {
  const sign = bps > 0 ? '+' : bps < 0 ? '-' : '';
  const abs = Math.abs(bps);
  return `${sign}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')} %`;
}

/** Parses a rate typed by the person, "10,5" or "10.50" → 1050 bps. Null when invalid. */
export function parseRateInput(input: string): number | null {
  const m = /^\s*(\d{1,2})(?:[.,](\d{1,2}))?\s*%?\s*$/.exec(input);
  if (!m) return null;
  const bps = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
  return bps > 0 ? bps : null;
}

/** Parses a term in days typed by the person (1 to 3.650). */
export function parseDaysInput(input: string): number | null {
  const m = /^\s*(\d{1,4})\s*$/.exec(input);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 3650 ? n : null;
}
