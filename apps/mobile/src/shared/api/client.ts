// Fynk API client (owned by M0), typed from the contract with openapi-typescript + openapi-fetch.
//
// Every request gets:
//   * Authorization: Bearer <token>, when a token exists;
//   * X-Device-Id, when the device is registered;
//   * X-Request-Id, a fresh id per attempt.
// On 401 the client asks for a token refresh once (M1 provides the hook) and retries once.
//
// Usage:
//   const health = await unwrap(api.GET('/bank/health'));
import createClient, { type Client } from 'openapi-fetch';

import { apiConfig } from './config';
import { ApiError, toApiError } from './errors';
import type { paths } from './schema.gen';

export interface ApiHooks {
  /** Current access token, or null when signed out. */
  getAccessToken(): string | null | Promise<string | null>;
  /** Refreshes the access token. Resolves true when a new token is available. */
  refreshAccessToken(): Promise<boolean>;
  /** Id of this device once registered, or null. */
  getDeviceId(): string | null | Promise<string | null>;
}

export interface ApiClientOptions {
  baseUrl: string;
  /** Read on every request, so hooks installed later (by M1) are used. */
  hooks: () => Partial<ApiHooks>;
  fetch?: (input: Request) => Promise<Response>;
  newRequestId?: () => string;
}

export type ApiClient = Client<paths>;

export function newRequestId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid.replace(/-/g, '');
  let id = '';
  for (let i = 0; i < 32; i++) id += Math.floor(Math.random() * 16).toString(16);
  return id;
}

/** The fetch used by the client: adds headers, retries once after a token refresh. */
export function createAuthFetch(options: ApiClientOptions): (input: Request) => Promise<Response> {
  const baseFetch = options.fetch ?? ((input: Request) => globalThis.fetch(input));
  const makeId = options.newRequestId ?? newRequestId;
  let refreshing: Promise<boolean> | null = null;

  // One refresh at a time: concurrent 401s wait for the same refresh.
  const refresh = (): Promise<boolean> => {
    const hook = options.hooks().refreshAccessToken;
    if (!hook) return Promise.resolve(false);
    refreshing ??= hook()
      .catch(() => false)
      .finally(() => {
        refreshing = null;
      });
    return refreshing;
  };

  const send = async (request: Request): Promise<Response> => {
    const hooks = options.hooks();
    const [token, deviceId] = await Promise.all([hooks.getAccessToken?.(), hooks.getDeviceId?.()]);
    const headers = new Headers(request.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (deviceId) headers.set('X-Device-Id', deviceId);
    headers.set('X-Request-Id', makeId());
    try {
      return await baseFetch(new Request(request, { headers }));
    } catch {
      throw ApiError.network();
    }
  };

  return async (request) => {
    const retry = request.clone(); // the body of the first attempt is consumed
    const first = await send(request);
    if (first.status !== 401) return first;
    if (!(await refresh())) return first;
    return send(retry);
  };
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  return createClient<paths>({ baseUrl: options.baseUrl, fetch: createAuthFetch(options) });
}

type ApiResult<T> = { data?: T; error?: unknown; response: Response };

/** Returns the data of a successful call, or throws the call's ApiError. */
export async function unwrap<T>(call: Promise<ApiResult<T>>): Promise<T> {
  const { data, error, response } = await call;
  if (!response.ok) throw toApiError(response, error);
  return data as T;
}

let installedHooks: Partial<ApiHooks> = {};

/** M1 installs its token and device hooks here once at startup. */
export function configureApiHooks(hooks: Partial<ApiHooks>): void {
  installedHooks = { ...installedHooks, ...hooks };
}

/** The app-wide client. Tests build their own with createApiClient. */
export const api: ApiClient = createApiClient({
  baseUrl: apiConfig.baseUrl,
  hooks: () => installedHooks,
});
