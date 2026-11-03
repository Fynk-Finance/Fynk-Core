// What a list asks for: a filter in the person's terms (Bogotá days) turned into the store's
// terms (UTC instants), and keyset pages on (bookedAt, id), newest first. Never OFFSET: a new
// movement synced between two pages would shift every row and repeat or skip one.
import type { Id, IsoDate, IsoDateTime, MoneyMinor, Transaction } from '@shared/domain/types';

import { bogotaDayStart, bogotaRange } from './bogota';

export interface TransactionFilter {
  /** First Bogotá day, included. */
  from?: IsoDate;
  /** Last Bogotá day, included. */
  to?: IsoDate;
  /** Only these accounts. Empty or missing means every account. */
  accountIds?: Id[];
}

/** The filter in UTC, as the store reads it. `end` is excluded. */
export interface StoreQuery {
  start?: IsoDateTime;
  end?: IsoDateTime;
  accountIds?: Id[];
}

/** The last row of a page: the next page starts strictly after it. */
export interface TransactionCursor {
  bookedAt: IsoDateTime;
  id: Id;
}

export interface PageRequest {
  cursor?: TransactionCursor | null;
  /** Rows per page, 20 by default as in "Cargar 20 más". */
  limit?: number;
}

export interface TransactionPage {
  items: Transaction[];
  /** Null when there are no more rows. */
  nextCursor: TransactionCursor | null;
}

/** The line above the list: "Mostrando 20 de 94 · +$16.545.000 · −$9.903.300". */
export interface TransactionSummary {
  count: number;
  incomeMinor: MoneyMinor;
  /** Money out, as a negative number. */
  spendMinor: MoneyMinor;
}

export const PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 200;

export function toStoreQuery(filter: TransactionFilter): StoreQuery {
  const query: StoreQuery = {};
  if (filter.from && filter.to) {
    Object.assign(query, bogotaRange(filter.from, filter.to));
  } else if (filter.from) {
    query.start = bogotaDayStart(filter.from);
  } else if (filter.to) {
    query.end = bogotaRange(filter.to, filter.to).end;
  }
  if (filter.accountIds && filter.accountIds.length > 0) query.accountIds = [...filter.accountIds];
  return query;
}

export function pageLimit(limit: number | undefined): number {
  if (limit === undefined) return PAGE_SIZE;
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError(`Invalid page size: ${limit}`);
  return Math.min(limit, MAX_PAGE_SIZE);
}

/** Builds a page from `limit + 1` rows: the extra row only says there is a next page. */
export function toPage(rows: Transaction[], limit: number): TransactionPage {
  const items = rows.slice(0, limit);
  const last = items[items.length - 1];
  return {
    items,
    nextCursor: rows.length > limit && last ? { bookedAt: last.bookedAt, id: last.id } : null,
  };
}
