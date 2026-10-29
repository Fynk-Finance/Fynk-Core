// What the onboarding use cases need from the outside.
import type { IsoDateTime } from '@shared/domain/types';

import type { OnboardingProgress } from '../domain/progress';

/** The saved progress in the vault. Every call throws VaultLockedError while it is locked. */
export interface ProgressStore {
  /** Null before the person opened the setup for the first time. */
  load(): Promise<OnboardingProgress | null>;
  save(progress: OnboardingProgress, updatedAt: IsoDateTime): Promise<void>;
}
