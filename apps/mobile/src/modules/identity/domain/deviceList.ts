// The list of linked devices on Seguridad. Pure: no I/O, no clock.
import type { IsoDateTime } from '@shared/domain/types';

import type { DevicePlatform } from './device';

/** A device of `GET /devices`. */
export interface LinkedDeviceItem {
  id: string;
  name: string;
  platform: DevicePlatform;
  status: 'active' | 'pending';
  /** True for the phone that asked. */
  current: boolean;
  lastSeenAt: IsoDateTime;
}

const seen = (d: LinkedDeviceItem): number => {
  const time = Date.parse(d.lastSeenAt);
  return Number.isNaN(time) ? -Infinity : time;
};

/** This phone first, then the most recently seen. A date that does not parse goes last. */
export function sortDevices(devices: readonly LinkedDeviceItem[]): LinkedDeviceItem[] {
  return [...devices].sort((a, b) => {
    if (a.current !== b.current) return a.current ? -1 : 1;
    const diff = seen(b) - seen(a);
    return diff === 0 || Number.isNaN(diff) ? 0 : diff;
  });
}

/** Devices the person can close from this phone: every one except this phone. */
export function otherDevices(devices: readonly LinkedDeviceItem[]): LinkedDeviceItem[] {
  return devices.filter((d) => !d.current);
}

/** "1 sesión", "3 sesiones". */
export function sessionsLabel(count: number): string {
  return `${count} ${count === 1 ? 'sesión' : 'sesiones'}`;
}
