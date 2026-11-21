// Vault tables of the vault module itself. Registered once where the vault is built.
import type { VaultMigration } from '@shared/ports/vault';

export const vaultMigrations: VaultMigration[] = [
  {
    version: 1,
    // Records changed since their last upload. `record_id` is the owning module's own id and
    // `seq` grows with every mark, so an upload clears only the marks it saw.
    up: `CREATE TABLE vault_backup_dirty (
      collection TEXT NOT NULL,
      record_id TEXT NOT NULL,
      seq INTEGER NOT NULL,
      PRIMARY KEY (collection, record_id)
    )`,
  },
  {
    version: 2,
    // Small flags of the vault itself. `restore_pending`: a restore from the backup started on
    // this phone and did not finish, so the next open runs it again.
    up: `CREATE TABLE vault_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`,
  },
];
