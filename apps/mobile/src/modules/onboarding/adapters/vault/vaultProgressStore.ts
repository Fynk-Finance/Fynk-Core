// ProgressStore on the SQLCipher vault (table in ./migrations.ts). A step id this build does not
// know (one removed in a later design) is dropped on read, and an unknown current step falls back
// to Aviso, so an old saved setup never breaks the app.
import type { VaultDb } from '@shared/ports';

import type { OnboardingProgress, WizardStep } from '../../domain/progress';
import { isStepId, type StepId } from '../../domain/steps';
import type { ProgressStore } from '../../application/ports';

interface Row {
  step: string;
  completed_steps: string;
  skipped_steps: string;
  finished_at: string | null;
}

function stepList(json: string): StepId[] {
  try {
    const value: unknown = JSON.parse(json);
    return Array.isArray(value) ? value.filter(isStepId) : [];
  } catch {
    return [];
  }
}

const wizardStep = (value: string): WizardStep => (isStepId(value) ? value : 'intro');

export function createVaultProgressStore(db: VaultDb): ProgressStore {
  return {
    async load() {
      const [row] = await db.query<Row>(
        `SELECT step, completed_steps, skipped_steps, finished_at
           FROM onboarding_progress WHERE id = 1`,
      );
      if (!row) return null;
      return {
        step: wizardStep(row.step),
        completed: stepList(row.completed_steps),
        skipped: stepList(row.skipped_steps),
        finishedAt: row.finished_at,
      };
    },

    async save(progress: OnboardingProgress, updatedAt) {
      await db.execute(
        `INSERT INTO onboarding_progress
           (id, step, completed_steps, skipped_steps, finished_at, updated_at)
         VALUES (1, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET
           step = excluded.step,
           completed_steps = excluded.completed_steps,
           skipped_steps = excluded.skipped_steps,
           finished_at = excluded.finished_at,
           updated_at = excluded.updated_at`,
        [
          progress.step,
          JSON.stringify(progress.completed),
          JSON.stringify(progress.skipped),
          progress.finishedAt,
          updatedAt,
        ],
      );
    },
  };
}
