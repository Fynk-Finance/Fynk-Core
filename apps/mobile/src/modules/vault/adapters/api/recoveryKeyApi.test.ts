import { createApiClient } from '@shared/api';

import { isRecoveryError, type RecoveryKeyUpload } from '../../application/ports';
import { createRecoveryKeyApi } from './recoveryKeyApi';

const bytes = (length: number, start: number) => Uint8Array.from({ length }, (_, i) => start + i);
const stored = {
  wrappedDek: 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8gISIjJCUmJygpKissLS4v',
  nonce: 'AAECAwQFBgcICQoL',
  salt: 'AAECAwQFBgcICQoLDA0ODw==',
  kdf: 'argon2id',
  kdfParams: { memoryKiB: 65536, iterations: 3, parallelism: 1 },
  createdAt: '2026-10-27T14:03:11Z',
};
const upload: RecoveryKeyUpload = {
  wrappedDek: bytes(48, 0),
  nonce: bytes(12, 0),
  salt: bytes(16, 0),
  kdfParams: { memoryKiB: 65536, iterations: 3, parallelism: 1 },
  deviceProofHash: bytes(32, 1),
};

const json = (status: number, b: unknown) =>
  new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });
const problem = (status: number, code: string) =>
  new Response(JSON.stringify({ type: `/problems/${code}`, title: 'Problem', status, code }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  });

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
  return { api: createRecoveryKeyApi({ deviceId: () => deviceId, client }), seen, fetch };
}

async function kindOf(call: Promise<unknown>): Promise<string | undefined> {
  try {
    await call;
  } catch (e) {
    return isRecoveryError(e) ? e.kind : 'not a RecoveryError';
  }
  return undefined;
}

describe('get', () => {
  it('sends X-Device-Id and returns the bytes decoded', async () => {
    const { api, seen } = setup(() => json(200, stored));
    const key = await api.get();
    expect(seen[0]!.method).toBe('GET');
    expect(seen[0]!.url).toBe('https://api.test/v1/backup/recovery-key');
    expect(seen[0]!.headers.get('X-Device-Id')).toBe('dev-1');
    expect(key).toEqual({
      wrappedDek: bytes(48, 0),
      nonce: bytes(12, 0),
      salt: bytes(16, 0),
      kdfParams: { memoryKiB: 65536, iterations: 3, parallelism: 1 },
      createdAt: '2026-10-27T14:03:11Z',
    });
  });

  it('returns null on 404 recovery_key_not_found', async () => {
    const { api } = setup(() => problem(404, 'recovery_key_not_found'));
    expect(await api.get()).toBeNull();
  });

  it('maps a failed connection, an inactive device and other problems', async () => {
    const down = setup(() => {
      throw new TypeError('offline');
    });
    expect(await kindOf(down.api.get())).toBe('offline');
    expect(await kindOf(setup(() => problem(403, 'device_not_active')).api.get())).toBe(
      'notActive',
    );
    expect(await kindOf(setup(() => problem(500, 'internal')).api.get())).toBe('unknown');
  });

  it('fails as unknown when the server sends a malformed base64 field', async () => {
    const { api } = setup(() => json(200, { ...stored, salt: 'not base64!' }));
    expect(await kindOf(api.get())).toBe('unknown');
  });

  it('does not call the API without a registered device', async () => {
    const { api, fetch } = setup(() => json(200, stored), null);
    expect(await kindOf(api.get())).toBe('notActive');
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('put', () => {
  it('sends the body of the contract in base64 and accepts 204', async () => {
    const { api, seen } = setup(() => new Response(null, { status: 204 }));
    await api.put(upload);
    expect(seen[0]!.method).toBe('PUT');
    expect(seen[0]!.url).toBe('https://api.test/v1/backup/recovery-key');
    expect(seen[0]!.headers.get('X-Device-Id')).toBe('dev-1');
    expect(await seen[0]!.json()).toEqual({
      wrappedDek: stored.wrappedDek,
      nonce: stored.nonce,
      salt: stored.salt,
      kdf: 'argon2id',
      kdfParams: { memoryKiB: 65536, iterations: 3, parallelism: 1 },
      deviceProofHash: 'AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA=',
    });
  });

  it('maps errors to a RecoveryError kind', async () => {
    const down = setup(() => {
      throw new TypeError('offline');
    });
    expect(await kindOf(down.api.put(upload))).toBe('offline');
    expect(await kindOf(setup(() => problem(403, 'device_not_active')).api.put(upload))).toBe(
      'notActive',
    );
    expect(await kindOf(setup(() => problem(400, 'invalid_request')).api.put(upload))).toBe(
      'unknown',
    );
  });
});

describe('activate', () => {
  it('posts the proof in base64 with X-Device-Id and accepts 204', async () => {
    const { api, seen } = setup(() => new Response(null, { status: 204 }));
    await api.activate(bytes(32, 1));
    expect(seen[0]!.method).toBe('POST');
    expect(seen[0]!.url).toBe('https://api.test/v1/backup/recovery-key/activate');
    expect(seen[0]!.headers.get('X-Device-Id')).toBe('dev-1');
    expect(await seen[0]!.json()).toEqual({
      deviceProof: 'AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA=',
    });
  });

  it.each([
    [422, 'proof_mismatch', 'mismatch'],
    [429, 'too_many_attempts', 'tooMany'],
    [410, 'device_removed', 'removed'],
    [404, 'recovery_key_not_found', 'noKey'],
    [403, 'device_not_active', 'notActive'],
    [500, 'internal', 'unknown'],
  ])('maps %i %s to %s', async (status, code, kind) => {
    const { api } = setup(() => problem(status, code));
    expect(await kindOf(api.activate(bytes(32, 1)))).toBe(kind);
  });

  it('maps a failed connection to offline and calls nothing without a device', async () => {
    const down = setup(() => {
      throw new TypeError('offline');
    });
    expect(await kindOf(down.api.activate(bytes(32, 1)))).toBe('offline');
    const none = setup(() => new Response(null, { status: 204 }), null);
    expect(await kindOf(none.api.activate(bytes(32, 1)))).toBe('notActive');
    expect(none.fetch).not.toHaveBeenCalled();
  });
});
