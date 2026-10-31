// BackupResetApi over the shared API client (POST /backup/reset). No body, no secret on the wire.
import { api, isApiError, unwrap, type ApiClient } from '@shared/api';

import { ResetError, type BackupResetApi } from '../../application/ports';

export interface BackupResetApiDeps {
  /** The registered device of this phone, sent as X-Device-Id. */
  deviceId: () => string | null;
  client?: ApiClient;
}

function toResetError(e: unknown): ResetError {
  if (!isApiError(e)) return new ResetError('unknown');
  if (e.code === 'network_error') return new ResetError('offline');
  if (e.code === 'reset_not_allowed') return new ResetError('notAllowed');
  if (e.code === 'device_not_active') return new ResetError('notActive');
  return new ResetError('unknown');
}

export function createBackupResetApi({
  deviceId,
  client = api,
}: BackupResetApiDeps): BackupResetApi {
  return {
    async reset() {
      // Without a registered device the API would answer 400; say so before calling.
      const id = deviceId();
      if (!id) throw new ResetError('notActive');
      try {
        await unwrap(client.POST('/backup/reset', { params: { header: { 'X-Device-Id': id } } }));
      } catch (e) {
        throw toResetError(e);
      }
    },
  };
}
