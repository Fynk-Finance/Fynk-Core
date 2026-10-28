import type { DeviceService } from './deviceService';
import { syncDeviceWithSession } from './deviceSessionSync';
import type { SessionService, SessionState } from './sessionService';

function fakeSession(status: SessionState['status']) {
  let state: SessionState = { status, busy: false, error: null };
  const listeners = new Set<() => void>();
  return {
    session: {
      getState: () => state,
      subscribe: (l: () => void) => {
        listeners.add(l);
        return () => listeners.delete(l);
      },
    } as unknown as SessionService,
    set(next: Partial<SessionState>) {
      state = { ...state, ...next };
      listeners.forEach((l) => l());
    },
  };
}

function fakeDevice() {
  return {
    deviceId: () => null,
    sync: jest.fn(async () => undefined),
    forget: jest.fn(async () => undefined),
  } satisfies DeviceService;
}

it('syncs on each transition into signedIn and forgets on signedIn to signedOut', () => {
  const { session, set } = fakeSession('restoring');
  const device = fakeDevice();
  syncDeviceWithSession(session, device);
  expect(device.sync).not.toHaveBeenCalled();

  set({ busy: true }); // not a status change
  set({ status: 'signedIn', busy: false });
  expect(device.sync).toHaveBeenCalledTimes(1);

  set({ error: 'network' }); // still signedIn
  expect(device.sync).toHaveBeenCalledTimes(1);

  set({ status: 'signedOut' });
  expect(device.forget).toHaveBeenCalledTimes(1);

  set({ status: 'signedIn' });
  expect(device.sync).toHaveBeenCalledTimes(2);
});

it('does not forget when restore ends signed out', () => {
  const { session, set } = fakeSession('restoring');
  const device = fakeDevice();
  syncDeviceWithSession(session, device);
  set({ status: 'signedOut' });
  expect(device.forget).not.toHaveBeenCalled();
});

it('syncs at once when the session is already signed in, and swallows errors', async () => {
  const { session } = fakeSession('signedIn');
  const device = fakeDevice();
  device.sync.mockRejectedValueOnce(new Error('boom'));
  syncDeviceWithSession(session, device);
  expect(device.sync).toHaveBeenCalledTimes(1);
  await Promise.resolve();
});
