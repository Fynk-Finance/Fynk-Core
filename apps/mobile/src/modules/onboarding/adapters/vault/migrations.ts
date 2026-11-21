// Vault tables of the onboarding module (M3 prompt, Technical design). Registered with
// registerVaultMigrations('onboarding', ...). Never edit a released migration: add a new one.
import type { VaultMigration } from '@shared/ports';

export const onboardingMigrations: VaultMigration[] = [
  {
    version: 1,
    // One row: the progress of the person who owns this vault. The step lists are JSON arrays
    // of step ids.
    up: `
      CREATE TABLE onboarding_progress (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        step TEXT NOT NULL,
        completed_steps TEXT NOT NULL,
        skipped_steps TEXT NOT NULL,
        finished_at TEXT,
        updated_at TEXT NOT NULL
      );
    `,
  },
];
