// Ports of the vault engine. The adapters are in adapters/.
import type { SealedBackupRecord } from '../domain/backupEnvelope';
import type { RECOVERY_KDF } from '../domain/recoveryKey';

export type Row = Record<string, unknown>;

/** The encrypted SQLite file. The engine never knows which library is behind it. */
export interface VaultDriver {
  /** Opens (or creates) the file with a SQLCipher key in the `x'<64 hex>'` form. */
  open(key: string): Promise<void>;
  /** Runs one statement, or a script of several when no params are given. */
  execute(sql: string, params?: unknown[]): Promise<Row[]>;
  close(): Promise<void>;
  /** Deletes the file. Safe to call when it does not exist or is not open. */
  deleteFile(): Promise<void>;
}

/** Texts of the system biometric prompt. They come from the strings file of the module. */
export interface BiometricPrompt {
  title: string;
  subtitle: string;
  cancel: string;
}

/**
 * Result of reading copy B. `invalidated` means the phone's fingerprints or faces changed (or the
 * key is gone), so the copy can never be read again. `failed` is any other error and can be retried.
 */
export type BiometricRead =
  | { status: 'ok'; dek: Uint8Array }
  | { status: 'cancelled' }
  | { status: 'invalidated' }
  | { status: 'failed' };

/** Copies A and B of the DEK (see M02, key hierarchy). */
export interface DekStore {
  read(): Promise<Uint8Array | null>;
  write(dek: Uint8Array): Promise<void>;
  /** Removes copy A only. */
  remove(): Promise<void>;
  /** Removes copy A and copy B. */
  removeAll(): Promise<void>;
  /** True when the phone has usable biometrics (fingerprint or face enrolled). Never prompts. */
  biometricsAvailable(): Promise<boolean>;
  /** True when copy B exists. Never prompts. This is the "biometrics enabled" setting. */
  hasBiometric(): Promise<boolean>;
  /** Writes copy B, bound to the phone's current biometric set. May show the system prompt. */
  writeBiometric(dek: Uint8Array, prompt: BiometricPrompt): Promise<'ok' | 'cancelled'>;
  /** Reads copy B behind the system prompt. Never throws; the result says what happened. */
  readBiometric(prompt: BiometricPrompt): Promise<BiometricRead>;
  /** Removes copy B only. */
  removeBiometric(): Promise<void>;
}

/** Thrown when the build has no SQLCipher: the vault must never write plaintext. */
export class VaultNotEncryptedError extends Error {
  constructor(message = 'The database engine has no SQLCipher; refusing to store data') {
    super(message);
    this.name = 'VaultNotEncryptedError';
  }
}

/**
 * Argon2id cost, stored beside the wrapped DEK so a new phone derives the same key. The contract
 * fixes the values (BackupKdfParams), so the type is the domain constant's.
 */
export type KdfParams = typeof RECOVERY_KDF;

/**
 * Argon2id of the canonical recovery code (26 characters) with the salt. Returns the 32 byte
 * recovery key. The parameters are fixed by the domain (RECOVERY_KDF).
 */
export type RecoveryKdf = (code: string, salt: Uint8Array) => Promise<Uint8Array>;

/** Random bytes from the OS source. Domain and application code never call a random source. */
export type RandomBytes = (n: number) => Uint8Array;

/** What PUT /backup/recovery-key stores. Bytes here; base64 only in the adapter. */
export interface RecoveryKeyUpload {
  wrappedDek: Uint8Array;
  nonce: Uint8Array;
  salt: Uint8Array;
  kdfParams: KdfParams;
  deviceProofHash: Uint8Array;
}

/** What GET /backup/recovery-key returns. The proof hash is never returned. */
export interface StoredRecoveryKey {
  wrappedDek: Uint8Array;
  nonce: Uint8Array;
  salt: Uint8Array;
  kdfParams: KdfParams;
  createdAt: string;
}

export interface RecoveryKeyApi {
  /** Null when the person has no recovery key (404 recovery_key_not_found). */
  get(): Promise<StoredRecoveryKey | null>;
  /** Replaces any previous recovery key: the old code stops working. */
  put(upload: RecoveryKeyUpload): Promise<void>;
}

/** `offline`: no connection. `notActive`: this phone is not an active device. */
export type RecoveryErrorKind = 'offline' | 'notActive' | 'unknown';

/** Carries only a kind: no key, code or payload ever goes into an error. */
export class RecoveryError extends Error {
  readonly kind: RecoveryErrorKind;
  constructor(kind: RecoveryErrorKind) {
    super(`recovery key request failed: ${kind}`);
    this.name = 'RecoveryError';
    this.kind = kind;
  }
}

export const isRecoveryError = (e: unknown, kind?: RecoveryErrorKind): e is RecoveryError =>
  e instanceof RecoveryError && (kind === undefined || e.kind === kind);
/** Why a backup call failed. `noKey`: the backup key or the account id is not available. */
export type BackupErrorKind = 'stale' | 'notActive' | 'quota' | 'offline' | 'noKey' | 'unknown';

/** Carries only a kind: nothing about the records may travel in an error. */
export class BackupError extends Error {
  constructor(readonly kind: BackupErrorKind) {
    super(`backup failed: ${kind}`);
    this.name = 'BackupError';
  }
}

export function isBackupError(value: unknown, kind?: BackupErrorKind): value is BackupError {
  return value instanceof BackupError && (kind === undefined || value.kind === kind);
}

/** PUT and GET /backup/records, with the binary fields already decoded. */
export interface BackupRecordsApiPort {
  /** At most 200 records. Atomic: all stored or none (`stale` when one is behind the server). */
  put(records: SealedBackupRecord[]): Promise<void>;
  /** One page. Pass the previous `nextCursor`, or null for the first page. */
  list(
    cursor: string | null,
  ): Promise<{ records: SealedBackupRecord[]; nextCursor: string | null }>;
}
