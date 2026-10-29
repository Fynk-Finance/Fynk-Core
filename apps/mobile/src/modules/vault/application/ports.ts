// Ports of the vault engine. The adapters are in adapters/.
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
