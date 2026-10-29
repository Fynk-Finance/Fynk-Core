// The market endpoints with the shared API client.
import { api, unwrap } from '@shared/api';

import type { MarketPort } from '../../application/ports';

export function createMarketApi(): MarketPort {
  return {
    async getCdtProducts() {
      return (await unwrap(api.GET('/market/cdt-products'))).products;
    },
    async getCdtReference() {
      const r = await unwrap(api.GET('/market/cdt-reference'));
      return {
        termDays: r.termDays,
        rateEaBps: r.rateEaBps,
        week: r.week,
        sourceUrl: r.sourceUrl,
        stale: r.stale,
      };
    },
    async getQuotes() {
      return (await unwrap(api.POST('/market/quotes', { body: {} }))).quotes;
    },
  };
}
