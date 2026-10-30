// Fixed expenses and subscriptions the person keeps in the vault (SCRUM-54): add, edit, delete,
// and the monthly totals of Billetera and onboarding. Every number comes from the pure functions
// in domain/; this file only reads and writes.
import type { Clock, Id, MoneyMinor } from '@shared/domain/types';

import {
  fixedExpensesInMonth,
  subscriptionsSummary,
  type SubscriptionsSummary,
} from '../domain/amounts';
import { isValidRecurring, type RecurringInput, type StoredRecurringItem } from '../domain/item';
import type { Usage, YearMonth } from '../domain/types';
import type { RecurringStore } from './ports';
import type { ReminderScheduler } from './reminders';

export interface RecurringServiceDeps {
  /** The vault store. Throws VaultLockedError while the vault is locked. */
  store: () => RecurringStore;
  clock: Clock;
  newId: () => Id;
  /** Payment and renewal reminders (SCRUM-57). Without it, nothing is scheduled. */
  reminders?: ReminderScheduler;
}

export interface RecurringService {
  /** Active items, oldest first. */
  list(): Promise<StoredRecurringItem[]>;
  get(id: Id): Promise<StoredRecurringItem | null>;
  /** Returns the new id. Throws InvalidRecurringError when the form is not valid. */
  create(input: RecurringInput): Promise<Id>;
  update(id: Id, input: RecurringInput): Promise<void>;
  remove(id: Id): Promise<void>;
  /** "Gastos fijos de este mes" of Billetera: every active item, counted in the current month. */
  fixedExpensesThisMonth(): Promise<MoneyMinor>;
  subscriptionsSummary(): Promise<SubscriptionsSummary>;
  /** "¿Cuánto la usas?" of a subscription (SCRUM-56), from its detail; null clears it. */
  setUsage(id: Id, usage: Usage | null): Promise<void>;
  /** The reminder switch of an item (SCRUM-57). */
  setReminder(id: Id, enabled: boolean): Promise<void>;
  /**
   * "Ya la cancelé" (SCRUM-58): the person cancelled it outside Fynk. It stops counting in
   * Billetera and its reminder goes; the item stays in the vault as a record.
   */
  cancel(id: Id): Promise<void>;
  /** "No es una suscripción": it becomes a fixed expense and loses its usage mark. */
  markNotSubscription(id: Id): Promise<void>;
  /** Schedules the next reminder of every item again: when the vault opens and after a sync. */
  refreshReminders(): Promise<void>;
  /** Called after every change. Returns a function that unsubscribes. */
  subscribe(listener: () => void): () => void;
}

export class InvalidRecurringError extends Error {
  constructor() {
    super('The recurring item is not valid');
    this.name = 'InvalidRecurringError';
  }
}

export class RecurringNotFoundError extends Error {
  constructor() {
    super('The recurring item does not exist');
    this.name = 'RecurringNotFoundError';
  }
}

// America/Bogota is UTC-5 all year (Colombia has no daylight saving time).
const BOGOTA_OFFSET_MS = -5 * 60 * 60 * 1000;

/** The calendar month in Bogotá. */
export function bogotaMonth(now: Date): YearMonth {
  const local = new Date(now.getTime() + BOGOTA_OFFSET_MS);
  return { year: local.getUTCFullYear(), month: local.getUTCMonth() + 1 };
}

export function createRecurringService(deps: RecurringServiceDeps): RecurringService {
  const listeners = new Set<() => void>();
  const changed = () => {
    for (const listener of [...listeners]) listener();
  };
  // A reminder that cannot be scheduled never blocks saving: the next refresh tries again.
  const remind = async (task: (r: ReminderScheduler) => Promise<void>) => {
    if (deps.reminders) await task(deps.reminders).catch(() => undefined);
  };
  /** Changes one stored item, then tells the listeners and plans its reminder again. */
  const patch = async (id: Id, change: (item: StoredRecurringItem) => StoredRecurringItem) => {
    const store = deps.store();
    const current = await store.get(id);
    if (!current) throw new RecurringNotFoundError();
    const item = change(current);
    await store.save(item);
    changed();
    await remind((r) => r.plan(item));
  };
  const active = async () => (await deps.store().list()).filter((i) => i.status === 'active');

  const editable = (input: RecurringInput) => {
    if (!isValidRecurring(input)) throw new InvalidRecurringError();
    return {
      kind: input.kind,
      name: input.name.trim(),
      amountMinor: input.amountMinor,
      schedule: input.schedule,
      categoryId: input.categoryId,
      accountId: input.accountId ?? null,
      reminderEnabled: input.reminderEnabled ?? true,
    };
  };

  return {
    list: active,

    async get(id) {
      return deps.store().get(id);
    },

    async create(input) {
      const item: StoredRecurringItem = {
        id: deps.newId(),
        ...editable(input),
        status: 'active',
        usage: input.kind === 'subscription' ? (input.usage ?? null) : null,
        merchantKey: null,
        source: 'manual',
        createdAt: deps.clock.now().toISOString(),
      };
      await deps.store().save(item);
      changed();
      await remind((r) => r.plan(item));
      return item.id;
    },

    async update(id, input) {
      const store = deps.store();
      const current = await store.get(id);
      if (!current) throw new RecurringNotFoundError();
      const usage = input.usage === undefined ? current.usage : input.usage;
      const item: StoredRecurringItem = {
        ...current,
        ...editable(input),
        usage: input.kind === 'subscription' ? usage : null,
      };
      await store.save(item);
      changed();
      await remind((r) => r.plan(item));
    },

    async remove(id) {
      await deps.store().remove(id);
      changed();
      await remind((r) => r.cancel(id));
    },

    async setUsage(id, usage) {
      await patch(id, (item) => ({ ...item, usage: item.kind === 'subscription' ? usage : null }));
    },

    async setReminder(id, enabled) {
      await patch(id, (item) => ({ ...item, reminderEnabled: enabled }));
    },

    async cancel(id) {
      const store = deps.store();
      const current = await store.get(id);
      if (!current) throw new RecurringNotFoundError();
      await store.markCancelled(id, deps.clock.now().toISOString());
      changed();
      await remind((r) => r.cancel(id));
    },

    async markNotSubscription(id) {
      await patch(id, (item) => ({ ...item, kind: 'fixed', usage: null }));
    },

    async fixedExpensesThisMonth() {
      return fixedExpensesInMonth(await active(), bogotaMonth(deps.clock.now()));
    },

    async subscriptionsSummary() {
      return subscriptionsSummary(await active(), bogotaMonth(deps.clock.now()));
    },

    async refreshReminders() {
      if (!deps.reminders) return;
      for (const item of await deps.store().list()) await remind((r) => r.plan(item));
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
