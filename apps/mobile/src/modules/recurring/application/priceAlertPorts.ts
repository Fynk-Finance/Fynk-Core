// Ports of the price increase alerts (SCRUM-61). The vault adapter implements PriceAlertStore
// (adapters/vault/vaultPriceAlertStore.ts).
import type { Id, IsoDateTime, MoneyMinor } from '@shared/domain/types';

export interface PriceAlert {
  id: Id;
  itemId: Id;
  transactionId: Id;
  previousMinor: MoneyMinor;
  newMinor: MoneyMinor;
  detectedAt: IsoDateTime;
}

export interface PriceAlertStore {
  /** Alerts the person has not dismissed, newest first. */
  open(): Promise<PriceAlert[]>;
  /** Saves it unless that charge already has an alert. True when it was new. */
  add(alert: PriceAlert): Promise<boolean>;
  dismiss(id: Id, at: IsoDateTime): Promise<void>;
}
