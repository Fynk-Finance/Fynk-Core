// BackupRecordsApiPort over the shared API client (PUT and GET /backup/records).
import { api, isApiError, unwrap, type ApiClient } from '@shared/api';

import type { SealedBackupRecord } from '../../domain/backupEnvelope';
import { fromBase64, toBase64 } from '../../domain/base64';
import { BackupError, type BackupRecordsApiPort } from '../../application/ports';

/** The API caps a page at 500 records. */
const PAGE_LIMIT = 500;

function toBackupError(e: unknown): BackupError {
  if (!isApiError(e)) return new BackupError('unknown');
  if (e.code === 'network_error') return new BackupError('offline');
  if (e.code === 'stale_version') return new BackupError('stale');
  if (e.code === 'device_not_active') return new BackupError('notActive');
  if (e.code === 'quota_exceeded') return new BackupError('quota');
  return new BackupError('unknown');
}

// A field that is not base64 becomes empty bytes: opening the record then fails and the
// restore skips it, instead of one bad record stopping the whole download.
const decode = (text: string) => fromBase64(text) ?? new Uint8Array(0);

/** `deviceId` is read on every call: the phone may register after the app starts. */
export function createBackupRecordsApi(
  deviceId: () => string | null,
  client: ApiClient = api,
): BackupRecordsApiPort {
  // Without a registered device the API would answer 403 anyway.
  const header = () => {
    const id = deviceId();
    if (!id) throw new BackupError('notActive');
    return { 'X-Device-Id': id };
  };

  return {
    async put(records) {
      try {
        await unwrap(
          client.PUT('/backup/records', {
            body: {
              records: records.map((r) => ({
                collection: r.collection,
                recordId: r.recordId,
                version: r.version,
                deleted: r.deleted,
                nonce: toBase64(r.nonce),
                ciphertext: toBase64(r.ciphertext),
              })),
            },
            params: { header: header() },
          }),
        );
      } catch (e) {
        throw e instanceof BackupError ? e : toBackupError(e);
      }
    },
    async list(cursor) {
      try {
        const page = await unwrap(
          client.GET('/backup/records', {
            params: {
              header: header(),
              query: { limit: PAGE_LIMIT, ...(cursor ? { updatedAfter: cursor } : {}) },
            },
          }),
        );
        const records: SealedBackupRecord[] = page.records.map((r) => ({
          collection: r.collection,
          recordId: r.recordId,
          version: r.version,
          deleted: r.deleted,
          nonce: decode(r.nonce),
          ciphertext: decode(r.ciphertext),
        }));
        return { records, nextCursor: page.nextCursor };
      } catch (e) {
        throw e instanceof BackupError ? e : toBackupError(e);
      }
    },
  };
}
