import { createApiClient } from '@shared/api';

import { toBase64 } from '../../domain/base64';
import { isApprovalError, type ApprovalGrant } from '../../application/ports';
import { createDeviceApprovalsApi } from './deviceApprovalsApi';

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
  return { api: createDeviceApprovalsApi(() => deviceId, client), seen };
}

const bytes = (length: number, start = 0) => Uint8Array.from({ length }, (_, i) => start + i);
const ID = '4a6e8c10-2b3d-4f5a-8c7e-9d1b3f5a7c20';
const request = {
  id: ID,
  status: 'pending',
  createdAt: '2026-10-27T14:03:11Z',
  expiresAt: '2026-10-27T14:13:11Z',
};
const grant: ApprovalGrant = {
  ephemeralPublicKey: bytes(32),
  wrappedDek: bytes(48),
  nonce: bytes(12),
};

async function kindOf(call: Promise<unknown>): Promise<string | undefined> {
  try {
    await call;
  } catch (e) {
    return isApprovalError(e) ? e.kind : 'not an ApprovalError';
  }
  return undefined;
}

describe('create', () => {
  it('posts with the device id and the idempotency key, no body', async () => {
    const { api, seen } = setup(() => json(201, request));
    expect(await api.create('key-1')).toEqual(request);
    expect(seen[0]!.method).toBe('POST');
    expect(seen[0]!.url).toBe('https://api.test/v1/device-approvals');
    expect(seen[0]!.headers.get('X-Device-Id')).toBe('dev-1');
    expect(seen[0]!.headers.get('Idempotency-Key')).toBe('key-1');
    expect(await seen[0]!.text()).toBe('');
  });

  it('maps device_already_active', async () => {
    const { api } = setup(() => problem(409, 'device_already_active'));
    expect(await kindOf(api.create('k'))).toBe('alreadyActive');
  });
});

describe('get', () => {
  it('reads a pending request without a grant', async () => {
    const { api, seen } = setup(() => json(200, { id: ID, status: 'pending', expiresAt: 'x' }));
    expect(await api.get(ID)).toEqual({ id: ID, status: 'pending', expiresAt: 'x' });
    expect(seen[0]!.url).toBe(`https://api.test/v1/device-approvals/${ID}`);
    expect(seen[0]!.headers.get('X-Device-Id')).toBe('dev-1');
  });

  it('decodes the grant of an approved request', async () => {
    const { api } = setup(() =>
      json(200, {
        id: ID,
        status: 'approved',
        expiresAt: 'x',
        ephemeralPublicKey: toBase64(grant.ephemeralPublicKey),
        wrappedDek: toBase64(grant.wrappedDek),
        nonce: toBase64(grant.nonce),
      }),
    );
    expect(await api.get(ID)).toEqual({ id: ID, status: 'approved', expiresAt: 'x', grant });
  });

  it('drops a grant with a field of the wrong size or not base64', async () => {
    const { api } = setup(() =>
      json(200, {
        id: ID,
        status: 'approved',
        expiresAt: 'x',
        ephemeralPublicKey: toBase64(bytes(31)),
        wrappedDek: toBase64(grant.wrappedDek),
        nonce: '***',
      }),
    );
    expect((await api.get(ID)).grant).toBeUndefined();
  });

  it('maps 404 to notFound', async () => {
    const { api } = setup(() => problem(404, 'approval_not_found'));
    expect(await kindOf(api.get(ID))).toBe('notFound');
  });
});

describe('listPending', () => {
  const wire = {
    id: ID,
    deviceName: 'Pixel de Camila',
    platform: 'android',
    newDevicePublicKey: toBase64(bytes(32, 1)),
    createdAt: 'a',
    expiresAt: 'b',
  };

  it('decodes the public keys', async () => {
    const { api, seen } = setup(() => json(200, { approvals: [wire] }));
    expect(await api.listPending()).toEqual([
      {
        id: ID,
        deviceName: 'Pixel de Camila',
        platform: 'android',
        newDevicePublicKey: bytes(32, 1),
        createdAt: 'a',
        expiresAt: 'b',
      },
    ]);
    expect(seen[0]!.method).toBe('GET');
    expect(seen[0]!.url).toBe('https://api.test/v1/device-approvals/pending');
    expect(seen[0]!.headers.get('X-Device-Id')).toBe('dev-1');
  });

  it('skips a request whose key is not 32 bytes', async () => {
    const bad = { ...wire, id: 'other', newDevicePublicKey: toBase64(bytes(16)) };
    const { api } = setup(() => json(200, { approvals: [bad, wire] }));
    expect((await api.listPending()).map((a) => a.id)).toEqual([ID]);
  });

  it('maps device_not_active', async () => {
    const { api } = setup(() => problem(403, 'device_not_active'));
    expect(await kindOf(api.listPending())).toBe('notActive');
  });
});

describe('approve', () => {
  it('sends the grant as base64', async () => {
    const { api, seen } = setup(() => json(200, { ...request, status: 'approved' }));
    expect((await api.approve(ID, grant)).status).toBe('approved');
    expect(seen[0]!.method).toBe('POST');
    expect(seen[0]!.url).toBe(`https://api.test/v1/device-approvals/${ID}/approve`);
    expect(seen[0]!.headers.get('X-Device-Id')).toBe('dev-1');
    expect(await seen[0]!.json()).toEqual({
      ephemeralPublicKey: toBase64(grant.ephemeralPublicKey),
      wrappedDek: toBase64(grant.wrappedDek),
      nonce: toBase64(grant.nonce),
    });
  });

  it.each([
    [404, 'approval_not_found', 'notFound'],
    [409, 'approval_not_pending', 'notPending'],
    [410, 'approval_expired', 'expired'],
    [403, 'device_not_active', 'notActive'],
    [500, 'internal_error', 'unknown'],
  ])('maps %s %s to %s', async (status, code, kind) => {
    const { api } = setup(() => problem(status, code));
    expect(await kindOf(api.approve(ID, grant))).toBe(kind);
  });
});

describe('reject', () => {
  it('posts to reject', async () => {
    const { api, seen } = setup(() => json(200, { ...request, status: 'rejected' }));
    expect((await api.reject(ID)).status).toBe('rejected');
    expect(seen[0]!.url).toBe(`https://api.test/v1/device-approvals/${ID}/reject`);
  });

  it('maps 410 to expired', async () => {
    const { api } = setup(() => problem(410, 'approval_expired'));
    expect(await kindOf(api.reject(ID))).toBe('expired');
  });
});

describe('errors', () => {
  it('maps a network failure to offline', async () => {
    const client = createApiClient({
      baseUrl: 'https://api.test/v1',
      hooks: () => ({}),
      fetch: async () => {
        throw new TypeError('Network request failed');
      },
    });
    const api = createDeviceApprovalsApi(() => 'dev-1', client);
    expect(await kindOf(api.listPending())).toBe('offline');
  });

  it('fails with notActive and sends nothing when the phone has no device id', async () => {
    const { api, seen } = setup(() => json(200, { approvals: [] }), null);
    expect(await kindOf(api.listPending())).toBe('notActive');
    expect(await kindOf(api.create('k'))).toBe('notActive');
    expect(seen).toHaveLength(0);
  });
});
