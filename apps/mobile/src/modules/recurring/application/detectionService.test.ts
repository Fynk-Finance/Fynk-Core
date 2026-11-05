// SCRUM-55 after a sync, on a real SQLite vault (sql.js) with the module's migrations: the
// proposals are kept, the person confirms or dismisses each one, and nothing is confirmed by
// itself.
import type { CategoryId, Transaction } from '@shared/domain/types';
import { createFixedClock, createInMemoryVault, type InMemoryVault } from '@shared/testing';

import { recurringMigrations } from '../adapters/vault/migrations';
import { createVaultProposalStore } from '../adapters/vault/vaultProposalStore';
import { createVaultRecurringStore } from '../adapters/vault/vaultRecurringStore';
import {
  DETECTION_WINDOW_DAYS,
  ProposalNotFoundError,
  createDetectionService,
  type DetectionService,
} from './detectionService';
import { createRecurringService, type RecurringService } from './recurringService';

const pesos = (n: number) => n * 100;
const clock = createFixedClock('2026-10-28T15:00:00Z');

let n = 0;
const tx = (
  merchantKey: string,
  day: string,
  amount: number,
  categoryId: CategoryId = 'subscriptions',
): Transaction => {
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
    categoryId,
    categorySource: 'bank',
    status: 'booked',
    goalId: null,
  };
};

/** Four monthly charges of a music service and one coffee. */
const months = ['2026-07-07', '2026-08-07', '2026-09-07', '2026-10-07'];
let movements: Transaction[] = [];
const music = (amount = 16_900) => months.map((d) => tx('streaming musica', d, amount));

let vault: InMemoryVault;
let recurring: RecurringService;
let detection: DetectionService;
let detected: number[];
let windows: [string, string][];

beforeEach(async () => {
  clock.set('2026-10-28T15:00:00Z');
  vault = await createInMemoryVault();
  vault.registerMigrations('recurring', recurringMigrations);
  await vault.migrate();
  movements = [...music(), tx('cafe', '2026-10-01', 9_000, 'groceries')];
  detected = [];
  windows = [];
  let id = 0;
  recurring = createRecurringService({
    store: () => createVaultRecurringStore(vault.db),
    clock,
    newId: () => `r${++id}`,
  });
  detection = createDetectionService({
    proposals: () => createVaultProposalStore(vault.db),
    items: () => createVaultRecurringStore(vault.db).list(),
    listMovements: async (from, to) => {
      windows.push([from, to]);
      return movements;
    },
    catalog: () => null,
    recurring,
    clock,
    onDetected: (count) => detected.push(count),
  });
});

afterEach(() => vault.close());

describe('detection after a sync', () => {
  it('reads the outflows of the last 12 months and keeps the proposals', async () => {
    expect(await detection.run()).toBe(1);
    expect(windows).toEqual([['2025-10-28', '2026-10-28']]);
    expect(DETECTION_WINDOW_DAYS).toBe(365);
    const [p] = await detection.pending();
    expect(p).toMatchObject({
      merchantKey: 'streaming musica',
      kind: 'subscription',
      amountMinor: pesos(16_900),
      nextChargeOn: '2026-11-07',
    });
    expect(await detection.pending()).toHaveLength(1);
  });

  it('never confirms by itself', async () => {
    await detection.run();
    expect(await recurring.list()).toEqual([]);
  });

  it('counts only new proposals, so the screen opens once per proposal', async () => {
    await detection.run();
    await detection.run();
    expect(detected).toEqual([1, 0]);
  });

  it('drops a pending proposal that is no longer detected', async () => {
    await detection.run();
    movements = [];
    await detection.run();
    expect(await detection.pending()).toEqual([]);
  });
});

describe('confirm', () => {
  it('creates a detected item with the proposal, and it is not proposed again', async () => {
    await detection.run();
    const id = await detection.confirm('streaming musica', { name: 'Música' });
    expect(await recurring.get(id)).toMatchObject({
      name: 'Música',
      kind: 'subscription',
      amountMinor: pesos(16_900),
      schedule: { periodicity: 'monthly', anchorDay: 7 },
      accountId: 'acc-card',
      merchantKey: 'streaming musica',
      source: 'detected',
    });
    expect(await detection.pending()).toEqual([]);
    expect(await detection.run()).toBe(0);
  });

  it('a confirmed merchant is not proposed again after its item is deleted', async () => {
    await detection.run();
    const id = await detection.confirm('streaming musica');
    await recurring.remove(id);
    expect(await detection.run()).toBe(0);
  });

  it('the person can change the amount', async () => {
    await detection.run();
    const id = await detection.confirm('streaming musica', { amountMinor: pesos(18_900) });
    expect((await recurring.get(id))?.amountMinor).toBe(pesos(18_900));
  });

  it('refuses a proposal that does not exist', async () => {
    await expect(detection.confirm('nope')).rejects.toBeInstanceOf(ProposalNotFoundError);
    await expect(detection.dismiss('nope')).rejects.toBeInstanceOf(ProposalNotFoundError);
  });
});

describe('dismiss', () => {
  it('is not proposed again while the amount stays', async () => {
    await detection.run();
    await detection.dismiss('streaming musica');
    expect(await detection.run()).toBe(0);
    expect(await detection.pending()).toEqual([]);
  });

  it('comes back when the amount changes by more than 30 %', async () => {
    await detection.run();
    await detection.dismiss('streaming musica');
    movements = music(23_900);
    expect(await detection.run()).toBe(1);
    expect((await detection.pending())[0]?.amountMinor).toBe(pesos(23_900));
  });
});
