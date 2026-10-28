import type { ApiHooks } from '@shared/api';

import type { SessionService } from './sessionService';

/** The hooks M0's API client calls on every request (configureApiHooks). */
export function createApiHooks(session: SessionService, deviceId: () => string | null): ApiHooks {
  return {
    getAccessToken: () => session.getAccessToken(),
    refreshAccessToken: () => session.refreshAccessToken(),
    getDeviceId: deviceId,
  };
}
