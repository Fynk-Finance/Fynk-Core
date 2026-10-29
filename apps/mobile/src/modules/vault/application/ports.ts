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

/** Copies A and B of the DEK (see M02, key hierarchy). */
export interface DekStore {
  read(): Promise<Uint8Array | null>;
  write(dek: Uint8Array): Promise<void>;
  /** Removes copy A only. */
  remove(): Promise<void>;
  /** Removes copy A and copy B. */
  removeAll(): Promise<void>;
}

/** Thrown when the build has no SQLCipher: the vault must never write plaintext. */
export class VaultNotEncryptedError extends Error {
  constructor(message = 'The database engine has no SQLCipher; refusing to store data') {
    super(message);
    this.name = 'VaultNotEncryptedError';
  }
}
