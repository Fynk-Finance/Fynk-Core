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
  /**
   * Makes this pending phone active, with the proof derived from the DEK (HU-045). Answers also
   * when the phone is already active. Throws RecoveryError: `mismatch`, `tooMany`, `removed`, `noKey`.
   */
  activate(proof: Uint8Array): Promise<void>;
}

/**
 * `offline`: no connection. `notActive`: this phone is not an active device. Of the activation:
 * `mismatch` (422), `tooMany` (429), `removed` (410) and `noKey` (404).
 */
export type RecoveryErrorKind =
  'offline' | 'notActive' | 'mismatch' | 'tooMany' | 'removed' | 'noKey' | 'unknown';

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

/**
 * Why a device approval call failed. `notFound`: the request does not exist or is not yours.
 * `notPending`: it was already approved or rejected. `expired`: more than 10 minutes old.
 * `alreadyActive`: this phone needs no approval. `notActive`: this phone may not approve.
 */
export type ApprovalErrorKind =
  'notFound' | 'notPending' | 'expired' | 'alreadyActive' | 'notActive' | 'offline' | 'unknown';

/** Carries only a kind: no key, grant or device name may travel in an error. */
export class ApprovalError extends Error {
  constructor(readonly kind: ApprovalErrorKind) {
    super(`device approval failed: ${kind}`);
    this.name = 'ApprovalError';
  }
}

export function isApprovalError(value: unknown, kind?: ApprovalErrorKind): value is ApprovalError {
  return value instanceof ApprovalError && (kind === undefined || value.kind === kind);
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';

/** An approval request as the create, approve and reject calls answer it. */
export interface ApprovalRequest {
  id: string;
  status: ApprovalStatus;
  createdAt: string;
  expiresAt: string;
}

/** A request waiting for this (old) phone. */
export interface PendingApproval {
  id: string;
  deviceName: string;
  platform: 'ios' | 'android';
  /** X25519 public key of the new phone, 32 bytes. */
  newDevicePublicKey: Uint8Array;
  createdAt: string;
  expiresAt: string;
}

/** What the old phone hands the new one: the sealed DEK and the key to open it. */
export interface ApprovalGrant {
  /** 32 bytes. */
  ephemeralPublicKey: Uint8Array;
  /** 48 bytes: the DEK and the GCM tag. */
  wrappedDek: Uint8Array;
  /** 12 bytes. */
  nonce: Uint8Array;
}

/** `grant` shows once, when the new phone first reads an approved request. */
export interface ApprovalState {
  id: string;
  status: ApprovalStatus;
  expiresAt: string;
  grant?: ApprovalGrant;
}

/** The /device-approvals calls, with the binary fields already decoded. */
export interface DeviceApprovalsApiPort {
  /** New (pending) phone: asks the active phones to approve it. */
  create(idempotencyKey: string): Promise<ApprovalRequest>;
  /** New phone: the state of its request. The grant comes back once. */
  get(id: string): Promise<ApprovalState>;
  /** Old (active) phone: the open requests, newest first. */
  listPending(): Promise<PendingApproval[]>;
  /** Old phone: stores the grant and activates the new phone. */
  approve(id: string, grant: ApprovalGrant): Promise<ApprovalRequest>;
  /** Old phone: refuses. The new phone stays pending. */
  reject(id: string): Promise<ApprovalRequest>;
}
