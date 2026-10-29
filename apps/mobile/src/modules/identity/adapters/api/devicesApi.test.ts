import { createApiClient } from '@shared/api';

import { isDevicesError } from '../../application/ports';
import { createDevicesApi } from './devicesApi';

const device = {
  id: 'dev-1',
  name: 'Pixel 8',
  platform: 'android',
  status: 'active',
  current: true,
  createdAt: '2026-10-27T14:03:11Z',
  lastSeenAt: '2026-10-27T14:03:11Z',
};
const body = {
  name: 'Pixel 8',
  platform: 'android',
  publicKey: 'AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA=',
} as const;

const json = (status: number, b: unknown) =>
  new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });
const problem = (status: number, code: string) =>
  json(status, { type: `/problems/${code}`, title: 'Problem', status, code });

function setup(handler: (req: Request) => Response | Promise<Response>) {
  const seen: Request[] = [];
  const fetch = jest.fn(async (req: Request) => {
    seen.push(req);
    return handler(req);
  });
  const client = createApiClient({ baseUrl: 'https://api.test/v1', hooks: () => ({}), fetch });
  return { api: createDevicesApi(client), seen };
}

/** The kind of the DevicesError a call throws. */
async function kindOf(call: Promise<unknown>): Promise<string | undefined> {
  try {
    await call;
  } catch (e) {
    return isDevicesError(e) ? e.kind : 'not a DevicesError';
  }
  return undefined;
}

describe('register', () => {
  it('sends the body and the Idempotency-Key, and returns the device for 201 and 200', async () => {
    for (const status of [201, 200]) {
      const { api, seen } = setup(() => json(status, device));
      const result = await api.register(body, 'key-1');
      expect(result).toEqual({
        id: 'dev-1',
        name: 'Pixel 8',
        platform: 'android',
        status: 'active',
      });
      expect(seen[0]!.method).toBe('POST');
      expect(seen[0]!.url).toBe('https://api.test/v1/devices');
      expect(seen[0]!.headers.get('Idempotency-Key')).toBe('key-1');
      expect(await seen[0]!.json()).toEqual(body);
    }
  });

  it('maps device_key_removed to keyRemoved', async () => {
    const { api } = setup(() => problem(409, 'device_key_removed'));
    expect(await kindOf(api.register(body, 'k'))).toBe('keyRemoved');
  });

  it('maps other problems to other', async () => {
    const { api } = setup(() => problem(400, 'invalid_device'));
    expect(await kindOf(api.register(body, 'k'))).toBe('other');
  });

  it('maps a failed connection to network', async () => {
    const { api } = setup(() => {
      throw new TypeError('offline');
    });
    expect(await kindOf(api.register(body, 'k'))).toBe('network');
  });
});

describe('current', () => {
  it('sends the stored device id and returns the device', async () => {
    const { api, seen } = setup(() => json(200, device));
    expect(await api.current('dev-1')).toMatchObject({ id: 'dev-1' });
    expect(seen[0]!.url).toBe('https://api.test/v1/devices/current');
    expect(seen[0]!.headers.get('X-Device-Id')).toBe('dev-1');
  });

  it('maps 410 to removed and 404 to notFound', async () => {
    const gone = setup(() => problem(410, 'device_removed'));
    expect(await kindOf(gone.api.current('d'))).toBe('removed');
    const missing = setup(() => problem(404, 'device_not_found'));
    expect(await kindOf(missing.api.current('d'))).toBe('notFound');
  });
});

describe('list', () => {
  const pending = {
    ...device,
    id: 'dev-2',
    name: 'iPhone',
    platform: 'ios',
    status: 'pending',
    current: false,
  };

  it('returns the items with current and lastSeenAt and sends the device id', async () => {
    const { api, seen } = setup(() => json(200, { items: [device, pending] }));
    const items = await api.list('dev-1');
    expect(items).toEqual([
      {
        id: 'dev-1',
        name: 'Pixel 8',
        platform: 'android',
        status: 'active',
        current: true,
        lastSeenAt: '2026-10-27T14:03:11Z',
      },
      {
        id: 'dev-2',
        name: 'iPhone',
        platform: 'ios',
        status: 'pending',
        current: false,
        lastSeenAt: '2026-10-27T14:03:11Z',
      },
    ]);
    expect(seen[0]!.method).toBe('GET');
    expect(seen[0]!.url).toBe('https://api.test/v1/devices');
    expect(seen[0]!.headers.get('X-Device-Id')).toBe('dev-1');
  });

  it('works without a device id and maps a failed connection to network', async () => {
    const ok = setup(() => json(200, { items: [] }));
    expect(await ok.api.list(null)).toEqual([]);
    expect(ok.seen[0]!.headers.get('X-Device-Id')).toBeNull();
    const down = setup(() => {
      throw new TypeError('offline');
    });
    expect(await kindOf(down.api.list(null))).toBe('network');
  });
});

describe('remove', () => {
  it('deletes the device by id', async () => {
    const { api, seen } = setup(() => new Response(null, { status: 204 }));
    await api.remove('dev-2');
    expect(seen[0]!.method).toBe('DELETE');
    expect(seen[0]!.url).toBe('https://api.test/v1/devices/dev-2');
  });

  it('counts a 404 device_not_found as already removed', async () => {
    const { api } = setup(() => problem(404, 'device_not_found'));
    await expect(api.remove('dev-2')).resolves.toBeUndefined();
  });

  it('throws for other problems', async () => {
    const { api } = setup(() => problem(500, 'internal'));
    expect(await kindOf(api.remove('dev-2'))).toBe('other');
  });
});

describe('signOutOthers', () => {
  it('posts with the calling device id', async () => {
    const { api, seen } = setup(() => new Response(null, { status: 204 }));
    await api.signOutOthers('dev-1');
    expect(seen[0]!.method).toBe('POST');
    expect(seen[0]!.url).toBe('https://api.test/v1/devices/sign-out-others');
    expect(seen[0]!.headers.get('X-Device-Id')).toBe('dev-1');
  });

  it('maps 410 to removed and 404 to notFound', async () => {
    const gone = setup(() => problem(410, 'device_removed'));
    expect(await kindOf(gone.api.signOutOthers('d'))).toBe('removed');
    const missing = setup(() => problem(404, 'device_not_found'));
    expect(await kindOf(missing.api.signOutOthers('d'))).toBe('notFound');
  });
});
