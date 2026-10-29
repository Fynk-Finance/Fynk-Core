// Ties the device to the session: register after every sign in, forget on sign out.
import type { DeviceService } from './deviceService';
import type { SessionService } from './sessionService';

/** Returns the unsubscribe function. Errors of the device service are swallowed. */
export function syncDeviceWithSession(session: SessionService, device: DeviceService): () => void {
  let previous = session.getState().status;
  if (previous === 'signedIn') device.sync().catch(() => undefined);
  return session.subscribe(() => {
    const status = session.getState().status;
    if (status === previous) return;
    const before = previous;
    previous = status;
    if (status === 'signedIn') device.sync().catch(() => undefined);
    else if (before === 'signedIn' && status === 'signedOut') {
      device.forget().catch(() => undefined);
    }
  });
}
