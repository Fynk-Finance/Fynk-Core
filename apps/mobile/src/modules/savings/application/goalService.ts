// Savings goals the person keeps in the vault (SCRUM-51): create, edit, delete, and the numbers
// of Metas, the Dashboard carousel and onboarding step 4. Every number comes from the pure
// functions in domain/; this file only reads and writes. Fynk never moves money.
import type { Clock, Id, IsoDate, MoneyMinor } from '@shared/domain/types';

import {
  byDeadline,
  summarizeGoal,
  validateGoal,
  type GoalInput,
  type GoalSummary,
} from '../domain/goal';
import { goalsMonthlyTotal } from '../domain/goals';
import type { GoalStore } from './ports';

export interface GoalServiceDeps {
  /** The vault store. Throws VaultLockedError while the vault is locked. */
  store: () => GoalStore;
  clock: Clock;
  newId: () => Id;
  /**
   * Runs before a goal is deleted, so its linked movements stop pointing to it (SCRUM-52:
   * contributionService.unlinkGoal). A failure stops the delete.
   */
  beforeRemove?: (goalId: Id) => Promise<void>;
}

export interface GoalService {
  /** Goals with their numbers, nearest deadline first ("Próximas metas · Por fecha límite"). */
  list(): Promise<GoalSummary[]>;
  get(id: Id): Promise<GoalSummary | null>;
  /** Returns the new id. Throws InvalidGoalError when the form is not valid. */
  create(input: GoalInput): Promise<Id>;
  update(id: Id, input: GoalInput): Promise<void>;
  remove(id: Id): Promise<void>;
  /** "2 metas $840.000/mes": suggested monthly amounts of the goals not reached yet. */
  monthlyTotal(): Promise<MoneyMinor>;
  /** Today's date in Bogotá, for the form's live suggested amount. */
  today(): IsoDate;
  /** Called after every change. Returns a function that unsubscribes. */
  subscribe(listener: () => void): () => void;
  /** Tells the subscribers that saved amounts changed: a contribution was added or undone. */
  notifyChanged(): void;
}

export class InvalidGoalError extends Error {
  constructor() {
    super('The savings goal is not valid');
    this.name = 'InvalidGoalError';
  }
}

export class GoalNotFoundError extends Error {
  constructor() {
    super('The savings goal does not exist');
    this.name = 'GoalNotFoundError';
  }
}

// America/Bogota is UTC-5 all year (Colombia has no daylight saving time).
const BOGOTA_OFFSET_MS = -5 * 60 * 60 * 1000;

export function bogotaToday(now: Date): IsoDate {
  return new Date(now.getTime() + BOGOTA_OFFSET_MS).toISOString().slice(0, 10);
}

export function createGoalService(deps: GoalServiceDeps): GoalService {
  const listeners = new Set<() => void>();
  const changed = () => {
    for (const listener of [...listeners]) listener();
  };
  const today = () => bogotaToday(deps.clock.now());

  /** With `keptDeadline`, an old goal may keep a deadline month that already passed. */
  const editable = (input: GoalInput, keptDeadline?: string): GoalInput => {
    const errors = validateGoal(input, today());
    if (errors.deadline === 'deadline_past' && input.deadline === keptDeadline)
      delete errors.deadline;
    if (Object.keys(errors).length > 0) throw new InvalidGoalError();
    return {
      name: input.name.trim(),
      category: input.category,
      targetMinor: input.targetMinor,
      deadline: input.deadline,
    };
  };

  const list = async () => {
    const store = deps.store();
    const [goals, saved] = await Promise.all([store.list(), store.savedByGoal()]);
    const day = today();
    return [...goals].sort(byDeadline).map((g) => summarizeGoal(g, saved.get(g.id) ?? 0, day));
  };

  return {
    list,

    async get(id) {
      return (await list()).find((g) => g.id === id) ?? null;
    },

    async create(input) {
      const id = deps.newId();
      await deps
        .store()
        .save({ id, ...editable(input), createdAt: deps.clock.now().toISOString() });
      changed();
      return id;
    },

    async update(id, input) {
      const store = deps.store();
      const current = await store.get(id);
      if (!current) throw new GoalNotFoundError();
      await store.save({ ...current, ...editable(input, current.deadline) });
      changed();
    },

    async remove(id) {
      await deps.beforeRemove?.(id);
      await deps.store().remove(id);
      changed();
    },

    async monthlyTotal() {
      const goals = await list();
      return goalsMonthlyTotal(goals.filter((g) => !g.done).map((g) => g.suggestedMonthlyMinor));
    },

    today,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    notifyChanged: changed,
  };
}
