// Ports of the contributions (SCRUM-52). The vault adapter implements ContributionStore
// (adapters/vault/vaultContributionStore.ts); M7 will provide MovementGoalLinker.
import type { Id, IsoDateTime } from '@shared/domain/types';

import type { Contribution } from '../domain/contribution';

export interface ContributionStore {
  /** Contributions of a goal that are not deleted, newest day first. */
  list(goalId: Id): Promise<Contribution[]>;
  /** A contribution that is not deleted. */
  get(id: Id): Promise<Contribution | null>;
  /** Throws MovementAlreadyLinkedError when the movement already counts for a goal. */
  add(contribution: Contribution): Promise<void>;
  /** Marks it deleted ("Deshacer"): it stops counting, and the row stays as a record. */
  markDeleted(id: Id, at: IsoDateTime): Promise<void>;
  /** Movements linked to the goal by contributions that are not deleted. */
  linkedTransactionIds(goalId: Id): Promise<Id[]>;
}

/**
 * M7's `setTransactionGoal(id, goalId)`: marks a movement as a contribution to a goal ("Aporte a
 * plan de ahorro" in Movimientos), or clears it with null. M7 does not export it yet.
 */
export interface MovementGoalLinker {
  setTransactionGoal(transactionId: Id, goalId: Id | null): Promise<void>;
}
