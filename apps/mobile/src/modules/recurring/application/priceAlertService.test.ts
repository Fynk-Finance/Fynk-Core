// SCRUM-61 on a real vault (sql.js): the newest charge of a subscription against the one before
// it, above max(5 %, $1.000); one alert and one notice per charge; dismissing it.
import type { Transaction } from '@shared/domain/types';
import {
  createFixedClock,
  createInMemoryNotifications,
  createInMemoryVault,
  type InMemoryVault,
} from '@shared/testing';

import { recurringMigrations } from '../adapters/vault/migrations';
import { createVaultPriceAlertStore } from '../adapters/vault/vaultPriceAlertStore';
import { createVaultRecurringStore } from '../adapters/vault/vaultRecurringStore';
import { newestChargeIncrease } from '../domain/priceChange';
import {
  PRICE_WINDOW_DAYS,
  createPriceAlertService,
  type PriceAlertService,
} from './priceAlertService';
import { createRecurringService, type RecurringService } from './recurringService';

const pesos = (n: number) => n * 100;
const clock = createFixedClock('2026-10-28T15:00:00Z');

let n = 0;
const charge = (day: string, amount: number, merchantKey = 'streaming series'): Transaction => {
  n += 1;
  return {
    id: `t${n}`,
    accountId: 'acc-card',
    providerTxId: `t${n}`,
    source: 'bank',
    bookedAt: `${day}T14:00:00Z`,
    amountMinor: -pesos(amount),
    description: merchantKey.toUpperCase(),
    merchantRaw: merchantKey.toUpperCase(),
    merchantKey,
    categoryId: 'subscriptions',
    categorySource: 'bank',
    status: 'booked',
    goalId: null,
  };
};

let vault: InMemoryVault;
let recurring: RecurringService;
let alerts: PriceAlertService;
let movements: Transaction[];
let notifications: ReturnType<typeof createInMemoryNotifications>;
let windows: [string, string][];
let itemId: string;

beforeEach(async () => {
  vault = await createInMemoryVault();
  vault.registerMigrations('recurring', recurringMigrations);
  await vault.migrate();
  let id = 0;
  recurring = createRecurringService({
    store: () => createVaultRecurringStore(vault.db),
    clock,
    newId: () => `r${++id}`,
  });
  itemId = await recurring.create(
    {
      kind: 'subscription',
      name: 'Streaming de series',
      amountMinor: pesos(32_900),
      schedule: { periodicity: 'monthly', anchorDay: 2 },
      categoryId: 'subscriptions',
    },
    { merchantKey: 'streaming series' },
  );
  notifications = createInMemoryNotifications();
  windows = [];
  movements = [charge('2026-08-02', 32_900), charge('2026-09-02', 32_900)];
  alerts = createPriceAlertService({
    store: () => createVaultPriceAlertStore(vault.db),
    items: () => recurring.list(),
    listMovements: async (from, to) => {
      windows.push([from, to]);
      return movements;
    },
    notifications,
    clock,
    newId: () => `a${++id}`,
  });
});

afterEach(() => vault.close());

describe('newestChargeIncrease', () => {
  it('compares the newest charge with the one before it, as in the M9 prompt', () => {
    expect(
      newestChargeIncrease([charge('2026-10-02', 33_500), charge('2026-09-02', 32_900)]),
    ).toBeNull();
    expect(
      newestChargeIncrease([charge('2026-10-02', 36_900), charge('2026-09-02', 32_900)]),
    ).toMatchObject({
      previousMinor: pesos(32_900),
      newMinor: pesos(36_900),
      differenceMinor: pesos(4_000),
    });
    expect(newestChargeIncrease([charge('2026-10-02', 36_900)])).toBeNull();
  });
});

describe('price alerts after a sync', () => {
  it('32.900 to 33.500 gives no alert', async () => {
    movements.push(charge('2026-10-02', 33_500));
    expect(await alerts.check()).toEqual([]);
    expect(notifications.inbox()).toEqual([]);
  });

  it('32.900 to 36.900 gives one alert and the inbox notice', async () => {
    movements.push(charge('2026-10-02', 36_900));
    const [alert] = await alerts.check();
    expect(alert).toMatchObject({ itemId, previousMinor: pesos(32_900), newMinor: pesos(36_900) });
    expect(notifications.inbox()).toMatchObject([
      {
        kind: 'subscription_price_up',
        title: 'Streaming de series',
        body: 'Streaming de series subió de $32.900 a $36.900 (+$4.000 al mes).',
        deepLink: `fynk://billetera/suscripciones/${itemId}`,
      },
    ]);
    expect(windows[0]).toEqual(['2025-09-23', '2026-10-28']);
    expect(PRICE_WINDOW_DAYS).toBe(400);
  });

  it('creates one alert per charge, never twice', async () => {
    movements.push(charge('2026-10-02', 36_900));
    await alerts.check();
    expect(await alerts.check()).toEqual([]);
    expect(notifications.inbox()).toHaveLength(1);
  });

  it('shows the open alert of the item until the person dismisses it', async () => {
    movements.push(charge('2026-10-02', 36_900));
    const [alert] = await alerts.check();
    expect((await alerts.openByItem()).get(itemId)?.id).toBe(alert!.id);
    await alerts.dismiss(alert!.id);
    expect((await alerts.openByItem()).size).toBe(0);
    // The same charge does not come back after dismissing.
    expect(await alerts.check()).toEqual([]);
  });

  it('ignores cancelled subscriptions and items without a merchant', async () => {
    movements.push(charge('2026-10-02', 36_900));
    await recurring.cancel(itemId);
    expect(await alerts.check()).toEqual([]);
    expect(windows).toEqual([]);
  });
});
