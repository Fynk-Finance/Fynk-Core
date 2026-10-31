// The recovery key (RK) wraps the DEK so a new phone can open it with the recovery code (HU-045).
// RK = Argon2id(code, salt). The Argon2 password is the canonical 26 character code from
// encodeRecoveryCode, as a UTF-8 string: no spaces and no lowercase, so the phone that made the
// code and the phone that types it derive the same key. Pure: salt, nonce and DEK are parameters.
import { open, seal } from './crypto';

/** Exactly the contract's BackupKdfParams. They are stored beside the wrapped DEK. */
export const RECOVERY_KDF = { memoryKiB: 65536, iterations: 3, parallelism: 1 } as const;
export const SALT_LENGTH = 16;
export const RECOVERY_AAD = 'fynk/recovery/v1';

const aad = () => new TextEncoder().encode(RECOVERY_AAD);

/** The 32 byte DEK sealed under RK: 48 bytes with the tag. */
export const wrapDek = (rk: Uint8Array, nonce: Uint8Array, dek: Uint8Array): Uint8Array =>
  seal(rk, nonce, dek, aad());

/** Reverses wrapDek. A wrong key (a mistyped code), nonce or a changed byte throws VaultCryptoError. */
export const unwrapDek = (rk: Uint8Array, nonce: Uint8Array, wrapped: Uint8Array): Uint8Array =>
  open(rk, nonce, wrapped, aad());
