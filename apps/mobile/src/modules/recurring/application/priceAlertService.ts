// Price increase alerts (SCRUM-61, HU-044, M9 prompt "Price increase"). After each sync, the
// newest charge of every active subscription is compared with the one before it in M7's
// movements. Above max(5 %, $1.000) it creates one alert for that charge and an inbox notice:
// "Streaming de series subió de $32.900 a $36.900 (+$4.000 al mes)." The person dismisses it.
import { formatCop } from '@shared/domain/money';
import type { Clock, Id, IsoDate, Transaction } from '@shared/domain/types';
import type { NotificationsPort } from '@shared/ports';

import { lastCharges } from '../domain/charges';
import type { StoredRecurringItem } from '../domain/item';
import { newestChargeIncrease } from '../domain/priceChange';
import { recurringStrings } from '../ui/strings.es-CO';
import type { PriceAlert, PriceAlertStore } from './priceAlertPorts';

const t = recurringStrings.priceUp;

/** Enough movements to hold the two newest charges of a yearly subscription. */
export const PRICE_WINDOW_DAYS = 400;

const BOGOTA_OFFSET_MS = -5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const isoDay = (ms: number): IsoDate => new Date(ms).toISOString().slice(0, 10);

export interface PriceAlertDeps {
  store: () => PriceAlertStore;
  /** Active items: only subscriptions with a merchant (detected) can be compared. */
  items: () => Promise<StoredRecurringItem[]>;
  /** M7 `getTransactionsBetween`. */
  listMovements: (from: IsoDate, to: IsoDate) => Promise<Transaction[]>;
  notifications: Pick<NotificationsPort, 'notify'>;
  clock: Clock;
  newId: () => Id;
  onChange?: () => void;
}

export interface PriceAlertService {
  /** Compares the newest charges and returns the alerts that are new. */
  check(): Promise<PriceAlert[]>;
  /** Open alerts by item id: Billetera's red "Subió" chip and the detail card. */
  openByItem(): Promise<Map<Id, PriceAlert>>;
  dismiss(id: Id): Promise<void>;
}

/** "+$4.000 al mes" for a monthly subscription, "por cobro" for the others. */
export const isMonthly = (item: Pick<StoredRecurringItem, 'schedule'>) =>
  item.schedule.periodicity === 'monthly';

export function createPriceAlertService(deps: PriceAlertDeps): PriceAlertService {
  return {
    async check() {
      const subscriptions = (await deps.items()).filter(
        (i) => i.kind === 'subscription' && i.status === 'active' && i.merchantKey,
      );
      if (subscriptions.length === 0) return [];
      const nowMs = deps.clock.now().getTime() + BOGOTA_OFFSET_MS;
      const movements = await deps.listMovements(
        isoDay(nowMs - PRICE_WINDOW_DAYS * DAY_MS),
        isoDay(nowMs),
      );
      const store = deps.store();
      const added: PriceAlert[] = [];
      for (const item of subscriptions) {
        const increase = newestChargeIncrease(lastCharges(item, movements, 2));
        if (!increase) continue;
        const alert: PriceAlert = {
          id: deps.newId(),
          itemId: item.id,
          transactionId: increase.transactionId,
          previousMinor: increase.previousMinor,
          newMinor: increase.newMinor,
          detectedAt: deps.clock.now().toISOString(),
        };
        if (!(await store.add(alert))) continue;
        added.push(alert);
        await deps.notifications
          .notify({
            kind: 'subscription_price_up',
            title: item.name,
            body: t.noticeBody(
              item.name,
              formatCop(increase.previousMinor),
              formatCop(increase.newMinor),
              formatCop(increase.differenceMinor),
              isMonthly(item),
            ),
            deepLink: `fynk://billetera/suscripciones/${item.id}`,
            dedupeKey: `recurring.price.${increase.transactionId}`,
          })
          .catch(() => undefined);
      }
      if (added.length > 0) deps.onChange?.();
      return added;
    },

    async openByItem() {
      const byItem = new Map<Id, PriceAlert>();
      // Newest first: the first alert of each item is the one to show.
      for (const a of await deps.store().open()) if (!byItem.has(a.itemId)) byItem.set(a.itemId, a);
      return byItem;
    },

    async dismiss(id) {
      await deps.store().dismiss(id, deps.clock.now().toISOString());
      deps.onChange?.();
    },
  };
}
