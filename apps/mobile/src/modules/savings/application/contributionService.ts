// Contributions to savings goals (SCRUM-52): a manual record with amount and day, or a synced
// movement linked to the goal, and "Deshacer". Fynk never moves money: nothing here talks to a
// bank, it only records money the person already set aside. Linking a movement marks it in M7
// ("Aporte a plan de ahorro"); undoing it clears the mark.
import type { Clock, Id, Transaction } from '@shared/domain/types';

import {
  contributionFromMovement,
  validateContribution,
  type Contribution,
  type ContributionInput,
} from '../domain/contribution';
import { bogotaToday } from './goalService';
import type { ContributionStore, MovementGoalLinker } from './contributionPorts';
import type { GoalStore } from './ports';

export interface ContributionServiceDeps {
  /** The vault stores. Throw VaultLockedError while the vault is locked. */
  store: () => ContributionStore;
  goals: () => GoalStore;
  clock: Clock;
  newId: () => Id;
  /** M7's setTransactionGoal. Until M7 exports it, movements cannot be linked. */
  movements?: MovementGoalLinker;
  /** Saved amounts changed: Metas and the carousel reload (goalService.notifyChanged). */
  onChange: () => void;
}

export interface ContributionService {
  /** Contributions of a goal, newest day first. */
  list(goalId: Id): Promise<Contribution[]>;
  /** "Abonar": a manual record. Returns its id. Throws InvalidContributionError. */
  add(goalId: Id, input: ContributionInput): Promise<Id>;
  /**
   * "Vincular un movimiento": an outflow that is booked and not linked yet counts for the goal,
   * and M7 marks it. Throws MovementNotEligibleError, MovementAlreadyLinkedError or
   * MovementsUnavailableError.
   */
  linkMovement(
    goalId: Id,
    tx: Pick<Transaction, 'id' | 'amountMinor' | 'bookedAt' | 'status' | 'goalId'>,
  ): Promise<Id>;
  /** "Deshacer": the contribution stops counting, and a linked movement is freed. */
  undo(contributionId: Id): Promise<void>;
  /** Before a goal is deleted: frees every movement linked to it. */
  unlinkGoal(goalId: Id): Promise<void>;
}

export class InvalidContributionError extends Error {
  constructor() {
    super('The contribution is not valid');
    this.name = 'InvalidContributionError';
  }
}

export class GoalNotFoundForContributionError extends Error {
  constructor() {
    super('The savings goal of the contribution does not exist');
    this.name = 'GoalNotFoundForContributionError';
  }
}

export class MovementNotEligibleError extends Error {
  constructor() {
    super('Only a booked outflow that is not linked yet can be a contribution');
    this.name = 'MovementNotEligibleError';
  }
}

export class MovementAlreadyLinkedError extends Error {
  constructor() {
    super('The movement already counts for a savings goal');
    this.name = 'MovementAlreadyLinkedError';
  }
}

export class MovementsUnavailableError extends Error {
  constructor() {
    super('Movements cannot be linked until M7 exports setTransactionGoal');
    this.name = 'MovementsUnavailableError';
  }
}

export function createContributionService(deps: ContributionServiceDeps): ContributionService {
  const today = () => bogotaToday(deps.clock.now());

  const ensureGoal = async (goalId: Id) => {
    if (!(await deps.goals().get(goalId))) throw new GoalNotFoundForContributionError();
  };

  return {
    async list(goalId) {
      return deps.store().list(goalId);
    },

    async add(goalId, input) {
      if (Object.keys(validateContribution(input, today())).length > 0)
        throw new InvalidContributionError();
      await ensureGoal(goalId);
      const id = deps.newId();
      const note = input.note?.trim() || null;
      await deps.store().add({
        id,
        goalId,
        amountMinor: input.amountMinor,
        contributedOn: input.contributedOn,
        source: 'manual',
        transactionId: null,
        note,
      });
      deps.onChange();
      return id;
    },

    async linkMovement(goalId, tx) {
      const movements = deps.movements;
      if (!movements) throw new MovementsUnavailableError();
      const input = contributionFromMovement(tx);
      if (!input) throw new MovementNotEligibleError();
      await ensureGoal(goalId);
      const id = deps.newId();
      const store = deps.store();
      await store.add({
        id,
        goalId,
        ...input,
        source: 'movement',
        transactionId: tx.id,
        note: null,
      });
      try {
        await movements.setTransactionGoal(tx.id, goalId);
      } catch (error) {
        // M7 did not take the mark: the contribution must not count either.
        await store.markDeleted(id, deps.clock.now().toISOString());
        throw error;
      }
      deps.onChange();
      return id;
    },

    async undo(contributionId) {
      const store = deps.store();
      const contribution = await store.get(contributionId);
      if (!contribution) return;
      await store.markDeleted(contributionId, deps.clock.now().toISOString());
      if (contribution.transactionId && deps.movements)
        await deps.movements.setTransactionGoal(contribution.transactionId, null);
      deps.onChange();
    },

    async unlinkGoal(goalId) {
      if (!deps.movements) return;
      for (const txId of await deps.store().linkedTransactionIds(goalId))
        await deps.movements.setTransactionGoal(txId, null);
    },
  };
}
