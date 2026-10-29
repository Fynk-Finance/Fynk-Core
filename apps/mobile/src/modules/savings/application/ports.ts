// Ports of the savings module. The vault adapter implements GoalStore
// (adapters/vault/vaultGoalStore.ts).
import type { Id, MoneyMinor } from '@shared/domain/types';

import type { Goal } from '../domain/goal';

export interface GoalStore {
  /** Goals that are not archived, in no particular order. */
  list(): Promise<Goal[]>;
  get(id: Id): Promise<Goal | null>;
  /** Inserts, or replaces the editable fields of a goal with the same id. */
  save(goal: Goal): Promise<void>;
  /** Deletes the goal and its contributions. */
  remove(id: Id): Promise<void>;
  /** Saved amount of each goal: the sum of its contributions that are not deleted. */
  savedByGoal(): Promise<Map<Id, MoneyMinor>>;
}
