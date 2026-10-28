// DevicesApiPort over the shared API client (POST /devices, GET /devices/current).
import { api, isApiError, unwrap, type ApiClient } from '@shared/api';

import { DevicesError, type DevicesApiPort, type LinkedDevice } from '../../application/ports';

function toDevicesError(e: unknown): DevicesError {
  if (!isApiError(e)) return new DevicesError('other');
  if (e.code === 'network_error') return new DevicesError('network');
  if (e.code === 'device_removed') return new DevicesError('removed');
  if (e.code === 'device_not_found') return new DevicesError('notFound');
  if (e.code === 'device_key_removed') return new DevicesError('keyRemoved');
  return new DevicesError('other');
}

const toLinkedDevice = (d: LinkedDevice): LinkedDevice => ({
  id: d.id,
  name: d.name,
  platform: d.platform,
  status: d.status,
});

export function createDevicesApi(client: ApiClient = api): DevicesApiPort {
  return {
    async register(body, idempotencyKey) {
      try {
        const device = await unwrap(
          client.POST('/devices', {
            body,
            params: { header: { 'Idempotency-Key': idempotencyKey } },
          }),
        );
        return toLinkedDevice(device);
      } catch (e) {
        throw toDevicesError(e);
      }
    },
    async current(deviceId) {
      try {
        const device = await unwrap(
          client.GET('/devices/current', { params: { header: { 'X-Device-Id': deviceId } } }),
        );
        return toLinkedDevice(device);
      } catch (e) {
        throw toDevicesError(e);
      }
    },
  };
}
