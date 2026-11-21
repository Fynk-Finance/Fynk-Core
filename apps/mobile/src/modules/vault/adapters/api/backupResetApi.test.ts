import { createApiClient } from '@shared/api';

import { isResetError } from '../../application/ports';
import { createBackupResetApi } from './backupResetApi';

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
  return { api: createBackupResetApi({ deviceId: () => deviceId, client }), seen, fetch };
}

async function kindOf(call: Promise<unknown>): Promise<string | undefined> {
  try {
    await call;
  } catch (e) {
    return isResetError(e) ? e.kind : 'not a ResetError';
  }
  return undefined;
}

describe('reset', () => {
  it('posts with X-Device-Id and no body, and accepts 204', async () => {
    const { api, seen } = setup(() => new Response(null, { status: 204 }));
    await expect(api.reset()).resolves.toBeUndefined();
    expect(seen).toHaveLength(1);
    expect(seen[0]!.method).toBe('POST');
    expect(seen[0]!.url).toBe('https://api.test/v1/backup/reset');
    expect(seen[0]!.headers.get('X-Device-Id')).toBe('dev-1');
    expect(await seen[0]!.text()).toBe('');
  });

  it.each([
    [403, 'reset_not_allowed', 'notAllowed'],
    [403, 'device_not_active', 'notActive'],
    [401, 'unauthorized', 'unknown'],
    [500, 'internal', 'unknown'],
  ])('maps %i %s to %s', async (status, code, kind) => {
    const { api } = setup(() => problem(status, code));
    expect(await kindOf(api.reset())).toBe(kind);
  });

  it('maps a failed connection to offline', async () => {
    const { api } = setup(() => {
      throw new TypeError('offline');
    });
    expect(await kindOf(api.reset())).toBe('offline');
  });

  it('calls nothing without a registered device', async () => {
    const { api, fetch } = setup(() => new Response(null, { status: 204 }), null);
    expect(await kindOf(api.reset())).toBe('notActive');
    expect(fetch).not.toHaveBeenCalled();
  });
});
