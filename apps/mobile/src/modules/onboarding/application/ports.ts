// What the onboarding use cases need from the outside.
import type { IsoDateTime } from '@shared/domain/types';

import type { PersonName } from '../domain/name';
import type { OnboardingProgress } from '../domain/progress';

/**
 * The name kept by identity (M1), through the API contract. Both calls throw an ApiError:
 * `invalid_profile` when the API refuses the name, a network error when it cannot be reached.
 */
export interface NamePort {
  /** The saved name, empty when the person has none yet. */
  getName(): Promise<{ firstName?: string; lastName?: string }>;
  saveName(name: PersonName): Promise<void>;
}

/** The saved progress in the vault. Every call throws VaultLockedError while it is locked. */
export interface ProgressStore {
  /** Null before the person opened the setup for the first time. */
  load(): Promise<OnboardingProgress | null>;
  save(progress: OnboardingProgress, updatedAt: IsoDateTime): Promise<void>;
}
