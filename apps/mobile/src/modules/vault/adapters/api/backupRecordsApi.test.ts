import { createApiClient } from '@shared/api';

import { isBackupError } from '../../application/ports';
import type { SealedBackupRecord } from '../../domain/backupEnvelope';
import { createBackupRecordsApi } from './backupRecordsApi';

const json = (status: number, b: unknown) =>
  new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });
const problem = (status: number, code: string) =>
  json(status, { type: `/problems/${code}`, title: 'Problem', status, code });

function setup(
  handler: (req: Request) => Response | Promise<Response>,
  deviceId: string | null = 'dev-1',
) {
  const seen: Request[] = [];
  const fetch = jest.fn(async (req: Request) => {
    seen.push(req);
    return handler(req);
  });
  const client = createApiClient({ baseUrl: 'https://api.test/v1', hooks: () => ({}), fetch });
  return { api: createBackupRecordsApi(() => deviceId, client), seen };
}

const record: SealedBackupRecord = {
  collection: 'savings.goals',
  recordId: '7d9c1b2e-4f3a-4e8b-a1c5-0b6d8e2f3a41',
  version: 3,
  deleted: false,
  nonce: Uint8Array.from({ length: 12 }, (_, i) => i),
  ciphertext: new TextEncoder().encode('sealed-bytes-of-a-record'),
};
const wire = {
  collection: 'savings.goals',
  recordId: '7d9c1b2e-4f3a-4e8b-a1c5-0b6d8e2f3a41',
  version: 3,
  deleted: false,
  nonce: 'AAECAwQFBgcICQoL',
  ciphertext: 'c2VhbGVkLWJ5dGVzLW9mLWEtcmVjb3Jk',
};

async function kindOf(call: Promise<unknown>): Promise<string | undefined> {
  try {
    await call;
  } catch (e) {
    return isBackupError(e) ? e.kind : 'not a BackupError';
  }
  return undefined;
}

describe('put', () => {
  it('sends the records with base64 fields and the X-Device-Id header', async () => {
    const { api, seen } = setup(() => json(200, { accepted: 1 }));
    await api.put([record]);
    expect(seen[0]!.method).toBe('PUT');
    expect(seen[0]!.url).toBe('https://api.test/v1/backup/records');
    expect(seen[0]!.headers.get('X-Device-Id')).toBe('dev-1');
    expect(await seen[0]!.json()).toEqual({ records: [wire] });
  });

  it.each([
    [409, 'stale_version', 'stale'],
    [403, 'device_not_active', 'notActive'],
    [413, 'quota_exceeded', 'quota'],
    [400, 'invalid_request', 'unknown'],
    [500, 'internal_error', 'unknown'],
  ])('maps %i %s to the kind %s', async (status, code, kind) => {
    const { api } = setup(() => problem(status, code));
    expect(await kindOf(api.put([record]))).toBe(kind);
  });

  it('maps a network failure to offline', async () => {
    const { api } = setup(() => {
      throw new TypeError('Network request failed');
    });
    expect(await kindOf(api.put([record]))).toBe('offline');
  });

  it('refuses without calling the API when the phone has no registered device', async () => {
    const { api, seen } = setup(() => json(200, { accepted: 1 }), null);
    expect(await kindOf(api.put([record]))).toBe('notActive');
    expect(seen).toHaveLength(0);
  });
});

describe('list', () => {
  it('asks for the first page with the biggest limit and decodes the records', async () => {
    const { api, seen } = setup(() =>
      json(200, { records: [{ ...wire, updatedAt: '2026-10-27T14:03:11Z' }], nextCursor: 'c1' }),
    );
    const page = await api.list(null);
    const url = new URL(seen[0]!.url);
    expect(seen[0]!.method).toBe('GET');
    expect(url.pathname).toBe('/v1/backup/records');
    expect(url.searchParams.get('limit')).toBe('500');
    expect(url.searchParams.has('updatedAfter')).toBe(false);
    expect(seen[0]!.headers.get('X-Device-Id')).toBe('dev-1');
    expect(page.nextCursor).toBe('c1');
    expect(page.records).toEqual([record]);
  });

  it('passes the cursor as updatedAfter', async () => {
    const { api, seen } = setup(() => json(200, { records: [], nextCursor: null }));
    expect(await api.list('c1')).toEqual({ records: [], nextCursor: null });
    expect(new URL(seen[0]!.url).searchParams.get('updatedAfter')).toBe('c1');
  });

  it('keeps a record with a broken base64 field as empty bytes, so the restore skips it', async () => {
    const { api } = setup(() =>
      json(200, { records: [{ ...wire, nonce: '!!', updatedAt: 'x' }], nextCursor: null }),
    );
    const page = await api.list(null);
    expect(page.records[0]!.nonce).toEqual(new Uint8Array(0));
  });

  it('maps errors like put', async () => {
    expect(await kindOf(setup(() => problem(403, 'device_not_active')).api.list(null))).toBe(
      'notActive',
    );
    expect(
      await kindOf(
        setup(() => {
          throw new TypeError('offline');
        }).api.list(null),
      ),
    ).toBe('offline');
  });
});
