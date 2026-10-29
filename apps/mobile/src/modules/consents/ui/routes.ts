// Route names of the consents module, and the ones it opens in other modules.
export const CONSENTS_ROUTE = 'consents.List' as const;
export const CONSENT_DETAIL_ROUTE = 'consents.Detail' as const;
/** M5's Conectar banco. */
export const CONNECT_BANK_ROUTE = 'bank.Connect' as const;

export interface ConsentDetailParams {
  id: string;
}
