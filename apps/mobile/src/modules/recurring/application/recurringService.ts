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
import type { YearMonth } from '../domain/types';
import type { RecurringStore } from './ports';

export interface RecurringServiceDeps {
  /** The vault store. Throws VaultLockedError while the vault is locked. */
  store: () => RecurringStore;
  clock: Clock;
  newId: () => Id;
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
      const id = deps.newId();
      await deps.store().save({
        id,
        ...editable(input),
        status: 'active',
        usage: null,
        merchantKey: null,
        source: 'manual',
        createdAt: deps.clock.now().toISOString(),
      });
      changed();
      return id;
    },

    async update(id, input) {
      const store = deps.store();
      const current = await store.get(id);
      if (!current) throw new RecurringNotFoundError();
      await store.save({ ...current, ...editable(input) });
      changed();
    },

    async remove(id) {
      await deps.store().remove(id);
      changed();
    },

    async fixedExpensesThisMonth() {
      return fixedExpensesInMonth(await active(), bogotaMonth(deps.clock.now()));
    },

    async subscriptionsSummary() {
      return subscriptionsSummary(await active(), bogotaMonth(deps.clock.now()));
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
