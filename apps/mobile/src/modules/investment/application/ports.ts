// Ports of the investment module.
import type { Account, IsoDate, IsoDateTime } from '@shared/domain';

import type { BalancePoint, CdtProduct } from '../domain/investment';

/** M6: the user's CDT accounts and, when M6 offers it, their balance history. */
export interface AccountsPort {
  getCdtAccounts(): Promise<Account[]>;
  getCdtBalanceHistory?(): Promise<BalancePoint[]>;
}

export interface CdtReference {
  termDays: number;
  rateEaBps: number;
  week: IsoDate;
  sourceUrl: string;
  stale: boolean;
}

export interface StockQuote {
  symbol: string;
  name: string;
  lastPriceCents: number;
  dayChangeBps: number;
  at: IsoDateTime;
}

/** The market endpoints (M15 backend). Same answers for every user. */
export interface MarketPort {
  getCdtProducts(): Promise<CdtProduct[]>;
  getCdtReference(): Promise<CdtReference>;
  getQuotes(): Promise<StockQuote[]>;
}
