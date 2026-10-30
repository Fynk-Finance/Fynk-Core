import type { BackupRecord } from '@shared/ports/backup';

import {
  BackupEnvelopeError,
  MAX_CIPHERTEXT_BYTES,
  backupRecordId,
  openRecord,
  sealRecord,
  type SealedBackupRecord,
} from './backupEnvelope';
import { deriveBackupKey, recordAad, seal as rawSeal, VaultCryptoError } from './crypto';

const KEY = deriveBackupKey(Uint8Array.from({ length: 32 }, (_, i) => i));
const OTHER_KEY = deriveBackupKey(Uint8Array.from({ length: 32 }, (_, i) => 255 - i));
const NONCE = Uint8Array.from({ length: 12 }, (_, i) => i + 1);
const USER = 'user-a';
const COLLECTION = 'savings.goals';
const UUID_ID = '7D9C1B2E-4F3A-4E8B-A1C5-0B6D8E2F3A41';

const record: BackupRecord<unknown> = {
  id: 'goal-1',
  version: 3,
  deleted: false,
  data: { name: 'Viaje a Cartagena', target: 150000000 },
};

const seal = (r: BackupRecord<unknown> = record, collection = COLLECTION) =>
  sealRecord({ backupKey: KEY, userId: USER, collection, record: r, nonce: NONCE });

const open = (s: SealedBackupRecord, over: Partial<Parameters<typeof openRecord>[0]> = {}) =>
  openRecord({ backupKey: KEY, userId: USER, ...s, ...over });

describe('backupRecordId', () => {
  it('keeps a UUID of any version, lowercased', () => {
    expect(backupRecordId(COLLECTION, UUID_ID)).toBe('7d9c1b2e-4f3a-4e8b-a1c5-0b6d8e2f3a41');
    expect(backupRecordId(COLLECTION, '00000000-0000-1000-8000-000000000000')).toBe(
      '00000000-0000-1000-8000-000000000000',
    );
  });

  // Vectors computed outside the code with node:crypto: sha256("<collection>|<id>"), first 16
  // bytes, byte 6 high nibble 8, byte 8 top bits 10.
  it.each([
    ['analytics.caps', 'settings', '3a6b3a0b-e97a-833b-88d9-60b20063a110'],
    ['savings.goals', 'goal-1', '2b569669-d5f0-8b3a-b165-8f2782d6635b'],
    ['recurring.items', '01HZX3Q9V5K2M8N4P6R7S8T9UV', 'fc8360d7-9c9c-8003-b6a6-2c5fa9100c36'],
  ])('maps %s / %s to a fixed UUID', (collection, id, expected) => {
    expect(backupRecordId(collection, id)).toBe(expected);
    expect(expected).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('depends on the collection and is stable', () => {
    expect(backupRecordId('a.b', 'x')).not.toBe(backupRecordId('a.c', 'x'));
    expect(backupRecordId('a.b', 'x')).toBe(backupRecordId('a.b', 'x'));
  });

  it('does not treat a near-UUID as a UUID', () => {
    const id = backupRecordId(COLLECTION, '7d9c1b2e-4f3a-4e8b-a1c5-0b6d8e2f3a4');
    expect(id).not.toBe('7d9c1b2e-4f3a-4e8b-a1c5-0b6d8e2f3a4');
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8/);
  });
});

describe('sealRecord and openRecord', () => {
  it('round trips a record and keeps its original id', () => {
    const sealed = seal();
    expect(sealed).toMatchObject({
      collection: COLLECTION,
      recordId: backupRecordId(COLLECTION, 'goal-1'),
      version: 3,
      deleted: false,
    });
    expect(sealed.nonce).toEqual(NONCE);
    expect(open(sealed)).toEqual(record);
  });

  it('round trips a tombstone with no data', () => {
    const tombstone = { id: UUID_ID, version: 4, deleted: true, data: { secret: 'x' } };
    const sealed = seal(tombstone);
    expect(sealed.recordId).toBe(UUID_ID.toLowerCase());
    expect(open(sealed)).toEqual({ id: UUID_ID, version: 4, deleted: true, data: null });
  });

  it('never puts the plaintext in the ciphertext', () => {
    const sealed = seal();
    const utf8 = (text: string) => new TextEncoder().encode(text);
    // Latin-1 string of the bytes, so a plain substring search finds a byte sequence.
    const asText = (bytes: Uint8Array) => Array.from(bytes, (b) => String.fromCharCode(b)).join('');
    const haystack = asText(sealed.ciphertext);
    const plaintext = JSON.stringify({ id: record.id, data: record.data });
    expect(haystack.includes(asText(utf8(plaintext)))).toBe(false);
    expect(haystack.includes('Cartagena')).toBe(false);
    expect(haystack.includes('goal-1')).toBe(false);
    // Same size as the plaintext plus the 16 byte tag.
    expect(sealed.ciphertext.length).toBe(utf8(plaintext).length + 16);
  });

  it('does not change the nonce it was given', () => {
    const nonce = NONCE.slice();
    const sealed = sealRecord({
      backupKey: KEY,
      userId: USER,
      collection: COLLECTION,
      record,
      nonce,
    });
    nonce.fill(0);
    expect(sealed.nonce).toEqual(NONCE);
  });

  it('fails when a ciphertext byte changes', () => {
    const sealed = seal();
    for (const i of [0, sealed.ciphertext.length - 1]) {
      const ciphertext = sealed.ciphertext.slice();
      ciphertext[i] = ciphertext[i]! ^ 1;
      expect(() => open(sealed, { ciphertext })).toThrow(VaultCryptoError);
    }
  });

  it('fails when the nonce, the key or an AAD part changes', () => {
    const sealed = seal();
    const nonce = sealed.nonce.slice();
    nonce[0] = nonce[0]! ^ 1;
    expect(() => open(sealed, { nonce })).toThrow(VaultCryptoError);
    expect(() => open(sealed, { backupKey: OTHER_KEY })).toThrow(VaultCryptoError);
    expect(() => open(sealed, { userId: 'user-b' })).toThrow(VaultCryptoError);
    expect(() => open(sealed, { collection: 'savings.contributions' })).toThrow(VaultCryptoError);
    expect(() => open(sealed, { recordId: backupRecordId(COLLECTION, 'goal-2') })).toThrow(
      VaultCryptoError,
    );
    expect(() => open(sealed, { version: 4 })).toThrow(VaultCryptoError);
  });

  it('fails when the deleted flag disagrees with the content', () => {
    expect(() => open(seal(), { deleted: true })).toThrow(VaultCryptoError);
    const tombstone = seal({ ...record, deleted: true });
    expect(() => open(tombstone, { deleted: false })).toThrow(VaultCryptoError);
  });

  it('fails when the id inside does not map back to the record id', () => {
    // Sealed honestly for another record id, with the AAD of the id it is presented under.
    const sealed = seal();
    const other = backupRecordId(COLLECTION, 'goal-2');
    const forged = sealRecordWithId(other);
    expect(() => open(forged)).toThrow(VaultCryptoError);
    expect(open(sealed).id).toBe('goal-1');
  });

  it('rejects a bad key or nonce length', () => {
    expect(() =>
      sealRecord({
        backupKey: new Uint8Array(16),
        userId: USER,
        collection: COLLECTION,
        record,
        nonce: NONCE,
      }),
    ).toThrow(VaultCryptoError);
    expect(() =>
      sealRecord({
        backupKey: KEY,
        userId: USER,
        collection: COLLECTION,
        record,
        nonce: new Uint8Array(8),
      }),
    ).toThrow(VaultCryptoError);
  });

  it('refuses a live record without data', () => {
    expect(() => seal({ id: 'a', version: 1, deleted: false, data: null })).toThrow(
      BackupEnvelopeError,
    );
  });

  describe('size limit', () => {
    // JSON overhead of {"id":"a","data":"..."} is 19 bytes, the tag 16.
    const withCiphertextSize = (size: number): BackupRecord<unknown> => ({
      id: 'a',
      version: 1,
      deleted: false,
      data: 'x'.repeat(size - 16 - '{"id":"a","data":""}'.length),
    });

    it('accepts exactly 64 KiB of ciphertext', () => {
      expect(seal(withCiphertextSize(MAX_CIPHERTEXT_BYTES)).ciphertext.length).toBe(65536);
    });

    it('throws a typed error, without the data in its message, one byte over', () => {
      const big = withCiphertextSize(MAX_CIPHERTEXT_BYTES + 1);
      let error: unknown;
      try {
        seal(big);
      } catch (e) {
        error = e;
      }
      expect(error).toBeInstanceOf(BackupEnvelopeError);
      expect((error as BackupEnvelopeError).kind).toBe('too_large');
      expect((error as Error).message).not.toContain('xxxx');
    });
  });
});

// A record whose plaintext carries a different id than the one in the envelope.
function sealRecordWithId(recordId: string): SealedBackupRecord {
  const real = sealRecord({
    backupKey: KEY,
    userId: USER,
    collection: COLLECTION,
    record: { ...record, id: 'goal-1' },
    nonce: NONCE,
  });
  // Present it under another id by re-sealing with the AAD of that id.
  const plaintext = new TextEncoder().encode(JSON.stringify({ id: 'goal-1', data: record.data }));
  return {
    ...real,
    recordId,
    ciphertext: rawSeal(KEY, NONCE, plaintext, recordAad(USER, COLLECTION, recordId, 3)),
  };
}
