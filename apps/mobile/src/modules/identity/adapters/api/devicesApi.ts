// DevicesApiPort and LinkedDevicesApiPort over the shared API client (POST /devices,
// GET /devices, GET /devices/current, DELETE /devices/{id}, POST /devices/sign-out-others).
import { api, isApiError, unwrap, type ApiClient } from '@shared/api';

import {
  DevicesError,
  isDevicesError,
  type DevicesApiPort,
  type LinkedDevice,
  type LinkedDevicesApiPort,
} from '../../application/ports';

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

export function createDevicesApi(client: ApiClient = api): DevicesApiPort & LinkedDevicesApiPort {
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
    async list(deviceId) {
      try {
        const { items } = await unwrap(
          client.GET('/devices', {
            params: { header: deviceId ? { 'X-Device-Id': deviceId } : {} },
          }),
        );
        return items.map((d) => ({
          id: d.id,
          name: d.name,
          platform: d.platform,
          status: d.status,
          current: d.current,
          lastSeenAt: d.lastSeenAt,
        }));
      } catch (e) {
        throw toDevicesError(e);
      }
    },
    async remove(id) {
      try {
        await unwrap(client.DELETE('/devices/{deviceId}', { params: { path: { deviceId: id } } }));
      } catch (e) {
        // Already gone is what the person asked for.
        if (isDevicesError(toDevicesError(e), 'notFound')) return;
        throw toDevicesError(e);
      }
    },
    async signOutOthers(deviceId) {
      try {
        await unwrap(
          client.POST('/devices/sign-out-others', {
            params: { header: { 'X-Device-Id': deviceId } },
          }),
        );
      } catch (e) {
        throw toDevicesError(e);
      }
    },
  };
}
