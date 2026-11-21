// Typed API errors. Every failed call becomes an ApiError with the stable `code` of the
// problem JSON (RFC 9457) the API sent, so modules branch on codes, never on text.
import type { components } from './schema.gen';

export type Problem = components['schemas']['Problem'];

export interface ApiErrorInit {
  status: number;
  code: string;
  title: string;
  type?: string;
  detail?: string;
  requestId?: string | null;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly title: string;
  readonly type: string;
  readonly detail: string | undefined;
  readonly requestId: string | null;

  constructor(init: ApiErrorInit) {
    super(`${init.status} ${init.code}: ${init.title}`);
    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code;
    this.title = init.title;
    this.type = init.type ?? `/problems/${init.code}`;
    this.detail = init.detail;
    this.requestId = init.requestId ?? null;
  }

  /** The request never reached the API (no connection, DNS, timeout). */
  static network(): ApiError {
    return new ApiError({ status: 0, code: 'network_error', title: 'Network error' });
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

export function isProblem(body: unknown): body is Problem {
  if (typeof body !== 'object' || body === null) return false;
  const p = body as Record<string, unknown>;
  return typeof p.code === 'string' && typeof p.title === 'string' && typeof p.status === 'number';
}

/** Builds the ApiError of a failed response from its parsed body. */
export function toApiError(response: Response, body: unknown): ApiError {
  const requestId = response.headers.get('X-Request-Id');
  if (isProblem(body)) {
    return new ApiError({
      status: response.status,
      code: body.code,
      title: body.title,
      type: body.type,
      detail: body.detail,
      requestId,
    });
  }
  return new ApiError({
    status: response.status,
    code: `http_${response.status}`,
    title: response.statusText || 'HTTP error',
    requestId,
  });
}
