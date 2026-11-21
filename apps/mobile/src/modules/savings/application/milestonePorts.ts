// Port of the milestone notices (SCRUM-53). The vault adapter is
// adapters/vault/vaultMilestoneStore.ts.
import type { Id, IsoDateTime } from '@shared/domain/types';

import type { Milestone } from '../domain/goals';

export interface MilestoneStore {
  /** Milestones the goal already reached. */
  noticed(goalId: Id): Promise<Milestone[]>;
  record(goalId: Id, milestones: readonly Milestone[], at: IsoDateTime): Promise<void>;
}
