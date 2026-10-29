// Access to M2's vault (merged in #105): the notifications tables live in the SQLCipher vault and
// are created when it opens. While it is locked, getVaultDb throws VaultLockedError.
export { getVaultDb, registerVaultMigrations } from '@modules/vault';
