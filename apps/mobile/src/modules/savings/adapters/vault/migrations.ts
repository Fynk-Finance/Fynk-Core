// Vault tables of the savings module (M8 prompt, Technical design). Registered with
// registerVaultMigrations('savings', ...). Never edit a released migration: add a new one.
// Contributions are created by SCRUM-52; the table is here so the saved amount of every goal
// is the sum of its contributions from the start. The reminders table comes with SCRUM-53.
import type { VaultMigration } from '@shared/ports';

export const savingsMigrations: VaultMigration[] = [
  {
    version: 1,
    up: `
      CREATE TABLE savings_goals (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL
          CHECK (category IN ('travel', 'emergency', 'education', 'home', 'vehicle', 'other')),
        target_minor INTEGER NOT NULL CHECK (target_minor > 0),
        deadline_month TEXT NOT NULL,
        created_at TEXT NOT NULL,
        archived_at TEXT
      );
      CREATE TABLE savings_contributions (
        id TEXT PRIMARY KEY,
        goal_id TEXT NOT NULL REFERENCES savings_goals (id),
        amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
        contributed_on TEXT NOT NULL,
        source TEXT NOT NULL CHECK (source IN ('manual', 'movement')),
        transaction_id TEXT,
        note TEXT,
        deleted_at TEXT
      );
      CREATE INDEX savings_contributions_goal ON savings_contributions (goal_id);
      -- A movement counts for one goal at most (M8 prompt: linking it twice is rejected).
      CREATE UNIQUE INDEX savings_contributions_transaction
        ON savings_contributions (transaction_id)
        WHERE transaction_id IS NOT NULL AND deleted_at IS NULL;
    `,
  },
  {
    // SCRUM-53: the milestones (50, 75, 100) each goal already reached, so each one is noticed
    // once, and a big contribution that jumps two of them gives a single notice.
    version: 2,
    up: `
      CREATE TABLE savings_milestones (
        goal_id TEXT NOT NULL REFERENCES savings_goals (id),
        milestone INTEGER NOT NULL CHECK (milestone IN (50, 75, 100)),
        reached_at TEXT NOT NULL,
        PRIMARY KEY (goal_id, milestone)
      );
    `,
  },
];
