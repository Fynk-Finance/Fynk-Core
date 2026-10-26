import { createApiClient, createAuthFetch, unwrap, type ApiHooks } from './client';
import { ApiError, isApiError } from './errors';

const BASE = 'https://api.test/v1';

type Handler = (req: Request) => Response | Promise<Response>;

function fakeFetch(...handlers: Handler[]) {
  const seen: Request[] = [];
  const fn = jest.fn(async (req: Request) => {
    seen.push(req);
    const handler = handlers[Math.min(seen.length - 1, handlers.length - 1)];
    if (!handler) throw new Error('no handler');
    return handler(req);
  });
  return { fn, seen };
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

const problem = (status: number, code: string, headers: Record<string, string> = {}) =>
  new Response(
    JSON.stringify({ type: `/problems/${code}`, title: 'Problem', status, code, detail: 'd' }),
    { status, headers: { 'Content-Type': 'application/problem+json', ...headers } },
  );

function client(fetch: (r: Request) => Promise<Response>, hooks: Partial<ApiHooks> = {}) {
  let n = 0;
  return createApiClient({
    baseUrl: BASE,
    hooks: () => hooks,
    fetch,
    newRequestId: () => `req-${++n}`,
  });
}

describe('api client', () => {
  it('calls the base URL with the token, device id and a request id', async () => {
    const { fn, seen } = fakeFetch(() => json(200, { module: 'bank', status: 'stub' }));
    const api = client(fn, { getAccessToken: () => 'tok', getDeviceId: async () => 'dev-1' });

    const data = await unwrap(api.GET('/bank/health'));

    expect(data).toEqual({ module: 'bank', status: 'stub' });
    const req = seen[0]!;
    expect(req.url).toBe(`${BASE}/bank/health`);
    expect(req.headers.get('Authorization')).toBe('Bearer tok');
    expect(req.headers.get('X-Device-Id')).toBe('dev-1');
    expect(req.headers.get('X-Request-Id')).toBe('req-1');
  });

  it('sends no Authorization or device header when there is none', async () => {
    const { fn, seen } = fakeFetch(() => json(200, { module: 'bank', status: 'stub' }));
    await unwrap(client(fn, { getAccessToken: () => null }).GET('/bank/health'));

    expect(seen[0]!.headers.has('Authorization')).toBe(false);
    expect(seen[0]!.headers.has('X-Device-Id')).toBe(false);
  });

  it('refreshes the token once on 401 and retries once with the new token', async () => {
    let token = 'old';
    const refreshAccessToken = jest.fn(async () => {
      token = 'new';
      return true;
    });
    const { fn, seen } = fakeFetch(
      () => problem(401, 'unauthorized'),
      () => json(200, { module: 'bank', status: 'stub' }),
    );
    const api = client(fn, { getAccessToken: () => token, refreshAccessToken });

    await expect(unwrap(api.GET('/bank/health'))).resolves.toEqual({
      module: 'bank',
      status: 'stub',
    });

    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(seen.map((r) => r.headers.get('Authorization'))).toEqual(['Bearer old', 'Bearer new']);
    expect(seen.map((r) => r.headers.get('X-Request-Id'))).toEqual(['req-1', 'req-2']);
  });

  it('retries only once when the second answer is also 401', async () => {
    const refreshAccessToken = jest.fn(async () => true);
    const { fn } = fakeFetch(() => problem(401, 'unauthorized'));
    const api = client(fn, { getAccessToken: () => 't', refreshAccessToken });

    await expect(unwrap(api.GET('/bank/health'))).rejects.toMatchObject({
      status: 401,
      code: 'unauthorized',
    });
    expect(fn).toHaveBeenCalledTimes(2);
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
  });

  it('does not retry when the refresh fails or there is no refresh hook', async () => {
    for (const hooks of [
      { refreshAccessToken: async () => false },
      { refreshAccessToken: async () => Promise.reject(new Error('offline')) },
      {},
    ] as Partial<ApiHooks>[]) {
      const { fn } = fakeFetch(() => problem(401, 'unauthorized'));
      await expect(unwrap(client(fn, hooks).GET('/bank/health'))).rejects.toBeInstanceOf(ApiError);
      expect(fn).toHaveBeenCalledTimes(1);
    }
  });

  it('keeps the request body for the retry', async () => {
    const body = JSON.stringify({ text: 'hola' });
    const doFetch = createAuthFetch({
      baseUrl: BASE,
      hooks: () => ({ refreshAccessToken: async () => true }),
      fetch: fakeFetch(
        () => problem(401, 'unauthorized'),
        async (req) => json(200, { echoed: await req.text() }),
      ).fn,
    });

    const res = await doFetch(new Request(`${BASE}/x`, { method: 'POST', body }));

    expect(await res.json()).toEqual({ echoed: body });
  });

  it('refreshes once for concurrent 401s', async () => {
    let calls = 0;
    const refreshAccessToken = jest.fn(
      () => new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 10)),
    );
    const fn = async () => (++calls <= 2 ? problem(401, 'unauthorized') : json(200, {}));
    const doFetch = createAuthFetch({
      baseUrl: BASE,
      hooks: () => ({ refreshAccessToken }),
      fetch: fn,
    });

    const results = await Promise.all([
      doFetch(new Request(`${BASE}/a`)),
      doFetch(new Request(`${BASE}/b`)),
    ]);

    expect(results.map((r) => r.status)).toEqual([200, 200]);
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
  });

  it('maps problem JSON to a typed ApiError with the request id', async () => {
    const { fn } = fakeFetch(() => problem(409, 'consent_revoked', { 'X-Request-Id': 'srv-9' }));

    const error = await unwrap(client(fn).GET('/bank/health')).catch((e: unknown) => e);

    expect(isApiError(error)).toBe(true);
    expect(error).toMatchObject({
      status: 409,
      code: 'consent_revoked',
      type: '/problems/consent_revoked',
      title: 'Problem',
      detail: 'd',
      requestId: 'srv-9',
    });
  });

  it('maps a non-problem error to an http_<status> code', async () => {
    const { fn } = fakeFetch(
      () => new Response('upstream down', { status: 502, statusText: 'Bad Gateway' }),
    );

    await expect(unwrap(client(fn).GET('/bank/health'))).rejects.toMatchObject({
      status: 502,
      code: 'http_502',
      requestId: null,
    });
  });

  it('turns a failed connection into a network_error ApiError', async () => {
    const fn = async () => {
      throw new TypeError('Network request failed');
    };

    await expect(unwrap(client(fn).GET('/bank/health'))).rejects.toMatchObject({
      status: 0,
      code: 'network_error',
    });
  });
});

describe('app-wide api client', () => {
  it('uses the hooks M1 installs with configureApiHooks', async () => {
    jest.resetModules();
    const seen: Request[] = [];
    const spy = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      seen.push(input as Request);
      return json(200, { module: 'identity', status: 'stub' });
    });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('./client') as typeof import('./client');

    mod.configureApiHooks({ getAccessToken: () => 'from-m1', getDeviceId: () => 'dev-9' });
    await mod.unwrap(mod.api.GET('/identity/health'));

    expect(seen[0]!.url).toBe('http://localhost:4010/identity/health');
    expect(seen[0]!.headers.get('Authorization')).toBe('Bearer from-m1');
    expect(seen[0]!.headers.get('X-Device-Id')).toBe('dev-9');
    spy.mockRestore();
  });
});
