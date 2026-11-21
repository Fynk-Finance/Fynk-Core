// The linked devices of Seguridad: the list and the two ways to close sessions.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { sortDevices } from '../domain/deviceList';
import { DevicesError, isDevicesError, type LinkedDevicesApiPort } from './ports';

export const DEVICES_QUERY_KEY = ['identity', 'devices'] as const;

export interface LinkedDevicesDeps {
  api: LinkedDevicesApiPort;
  /** Id of this phone, or null before it is registered. */
  deviceId: () => string | null;
  /** The device service's sync: registers again after a 404 and signs out after a 410. */
  sync: () => Promise<void>;
}

/** `done`, `failed` (show an error, keep the list) or `removed` (this phone was removed). */
export type DeviceActionResult = 'done' | 'failed' | 'removed';

export function useLinkedDevices({ api, deviceId, sync }: LinkedDevicesDeps) {
  const client = useQueryClient();

  const query = useQuery({
    queryKey: DEVICES_QUERY_KEY,
    queryFn: async () => sortDevices(await api.list(deviceId())),
    retry: (failures) => failures < 1,
    // Dropped as soon as no screen shows it: nothing clears the cache on sign out yet, and the
    // list belongs to the account that opened it.
    gcTime: 0,
  });

  const refresh = () => client.invalidateQueries({ queryKey: DEVICES_QUERY_KEY });

  const removeMutation = useMutation({
    mutationFn: async (id: string): Promise<DeviceActionResult> => {
      try {
        await api.remove(id);
        return 'done';
      } catch (e) {
        return isDevicesError(e, 'removed') ? 'removed' : 'failed';
      }
    },
    onSettled: refresh,
  });

  const signOutOthersMutation = useMutation({
    mutationFn: async (): Promise<DeviceActionResult> => {
      try {
        let id = deviceId();
        if (!id) {
          await sync();
          id = deviceId();
        }
        if (!id) throw new DevicesError('other');
        await api.signOutOthers(id);
        return 'done';
      } catch (e) {
        if (isDevicesError(e, 'removed') || isDevicesError(e, 'notFound')) {
          // The device service signs out and wipes (410) or registers this phone again (404).
          await sync().catch(() => undefined);
          return e.kind === 'removed' ? 'removed' : 'failed';
        }
        return 'failed';
      }
    },
    onSettled: refresh,
  });

  return {
    query,
    remove: (id: string) => removeMutation.mutateAsync(id),
    signOutOthers: () => signOutOthersMutation.mutateAsync(),
    /** An action is running; the screen disables its buttons. */
    busy: removeMutation.isPending || signOutOthersMutation.isPending,
    refresh,
  };
}
