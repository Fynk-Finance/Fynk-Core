// Pure encryption of one backup record: the bytes the API stores. Keys and nonces are
// parameters. Nothing here reads or logs the data: errors carry only a kind.
import { sha256 } from '@noble/hashes/sha2.js';
import type { BackupRecord } from '@shared/ports/backup';

import { open, recordAad, seal, VaultCryptoError } from './crypto';

/** The API accepts at most 64 KiB of ciphertext (with its tag) per record. */
export const MAX_CIPHERTEXT_BYTES = 65536;

export class BackupEnvelopeError extends Error {
  constructor(readonly kind: 'too_large' | 'invalid_record') {
    super(`backup record rejected: ${kind}`);
    this.name = 'BackupEnvelopeError';
  }
}

/** What goes to the API and comes back: everything except the plaintext. */
export interface SealedBackupRecord {
  collection: string;
  recordId: string;
  version: number;
  deleted: boolean;
  nonce: Uint8Array;
  ciphertext: Uint8Array;
}

const utf8 = (text: string) => new TextEncoder().encode(text);
const hex = (byte: number) => byte.toString(16).padStart(2, '0');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The API wants a UUID as record id, but modules use their own ids ('settings', a ULID...).
 * A UUID keeps its value (lowercased). Anything else maps to a stable UUID built from
 * sha256("<collection>|<id>"), with version 8 and the RFC 4122 variant.
 */
export function backupRecordId(collection: string, id: string): string {
  if (UUID.test(id)) return id.toLowerCase();
  const bytes = sha256(utf8(`${collection}|${id}`)).slice(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x80;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const h = Array.from(bytes, hex).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export interface SealRecordInput {
  backupKey: Uint8Array;
  userId: string;
  collection: string;
  record: BackupRecord<unknown>;
  nonce: Uint8Array;
}

export function sealRecord({
  backupKey,
  userId,
  collection,
  record,
  nonce,
}: SealRecordInput): SealedBackupRecord {
  // A live record without data could not be told from a tombstone on restore.
  if (!record.deleted && (record.data === null || record.data === undefined)) {
    throw new BackupEnvelopeError('invalid_record');
  }
  const recordId = backupRecordId(collection, record.id);
  const plaintext = utf8(
    JSON.stringify({ id: record.id, data: record.deleted ? null : record.data }),
  );
  const aad = recordAad(userId, collection, recordId, record.version);
  const ciphertext = seal(backupKey, nonce, plaintext, aad);
  if (ciphertext.length > MAX_CIPHERTEXT_BYTES) throw new BackupEnvelopeError('too_large');
  return {
    collection,
    recordId,
    version: record.version,
    deleted: record.deleted,
    nonce: nonce.slice(),
    ciphertext,
  };
}

export interface OpenRecordInput {
  backupKey: Uint8Array;
  userId: string;
  collection: string;
  recordId: string;
  version: number;
  deleted: boolean;
  nonce: Uint8Array;
  ciphertext: Uint8Array;
}

/** Throws VaultCryptoError when anything was changed, or the record does not match its id. */
export function openRecord({
  backupKey,
  userId,
  collection,
  recordId,
  version,
  deleted,
  nonce,
  ciphertext,
}: OpenRecordInput): BackupRecord<unknown> {
  const plaintext = open(
    backupKey,
    nonce,
    ciphertext,
    recordAad(userId, collection, recordId, version),
  );
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(plaintext));
  } catch {
    throw new VaultCryptoError('record content is not valid');
  }
  const { id, data } = (parsed ?? {}) as { id?: unknown; data?: unknown };
  if (typeof id !== 'string' || id === '' || backupRecordId(collection, id) !== recordId) {
    throw new VaultCryptoError('record content does not match its id');
  }
  // The deleted flag is not part of the AAD, so the content must agree with it: a server that
  // flips it could otherwise delete (or resurrect) a record.
  const isTombstone = data === null || data === undefined;
  if (deleted !== isTombstone) {
    throw new VaultCryptoError('record content does not match its state');
  }
  return { id, version, deleted, data: deleted ? null : data };
}
