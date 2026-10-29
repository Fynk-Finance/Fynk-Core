// Access to M2's vault. M2 has not merged registerVaultMigrations and getVaultDb into develop
// yet, so until then the vault reads as locked and migrations are kept for M2 to apply.
// When M2 merges, this file becomes:
//   export { getVaultDb, registerVaultMigrations } from '@modules/vault';
import { VaultLockedError, type GetVaultDb, type RegisterVaultMigrations } from '@shared/ports';

export const getVaultDb: GetVaultDb = () => {
  throw new VaultLockedError('The vault module (M2) is not available yet');
};

export const registerVaultMigrations: RegisterVaultMigrations = () => undefined;
