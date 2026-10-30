import { createAppEvents } from '@shared/events/appEvents';
import { createInMemoryNotifications } from '@shared/testing';

import { vaultStrings } from '../ui/strings.es-CO';
import {
  APPROVE_DEVICE_DEEP_LINK,
  MIN_CHECK_INTERVAL_MS,
  createApprovalNotifier,
} from './approvalNotifier';
import { ApprovalError, type PendingApproval } from './ports';

const request = (
  id: string,
  deviceName = 'Pixel de Camila',
): PendingApproval & { code: string } => ({
  id,
  deviceName,
  platform: 'android',
  newDevicePublicKey: new Uint8Array(32),
  createdAt: 'a',
  expiresAt: 'b',
  code: '123456',
});

function setup(listPending: () => Promise<(PendingApproval & { code: string })[]>) {
  const events = createAppEvents();
  const notifications = createInMemoryNotifications();
  const service = { listPending: jest.fn(listPending) };
  let now = 1_000_000;
  let foreground: () => void = () => undefined;
  const unwatch = jest.fn();
  const notifier = createApprovalNotifier({
    service,
    notifications,
    events,
    watchForeground: (listener) => {
      foreground = listener;
      return unwatch;
    },
    nowMs: () => now,
    text: vaultStrings.approve.notification,
  });
  const stop = notifier.start();
  return {
    events,
    notifications,
    service,
    stop,
    unwatch,
    foreground: () => foreground(),
    advance: (ms: number) => {
      now += ms;
    },
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

it('notifies once per request when the vault unlocks', async () => {
  const t = setup(async () => [request('r1'), request('r2', 'iPhone de Luis')]);
  t.events.emit({ type: 'vault.unlocked' });
  await flush();
  const inbox = t.notifications.inbox();
  expect(inbox.map((n) => n.dedupeKey)).toEqual(['device-approval:r1', 'device-approval:r2']);
  expect(inbox[0]).toMatchObject({
    kind: 'device_approval',
    title: 'Nuevo dispositivo',
    body: 'Pixel de Camila quiere acceder a tu cuenta. Revisa el código antes de aprobar.',
    deepLink: APPROVE_DEVICE_DEEP_LINK,
  });
  expect(APPROVE_DEVICE_DEEP_LINK).toBe('fynk://boveda/aprobar');
});

it('does not repeat a request it already announced', async () => {
  const t = setup(async () => [request('r1')]);
  t.events.emit({ type: 'vault.unlocked' });
  await flush();
  t.advance(MIN_CHECK_INTERVAL_MS);
  t.foreground();
  await flush();
  expect(t.service.listPending).toHaveBeenCalledTimes(2);
  expect(t.notifications.inbox()).toHaveLength(1);
});

describe('on return to the foreground', () => {
  it('checks again after a minute while unlocked', async () => {
    const t = setup(async () => []);
    t.events.emit({ type: 'vault.unlocked' });
    t.advance(MIN_CHECK_INTERVAL_MS);
    t.foreground();
    await flush();
    expect(t.service.listPending).toHaveBeenCalledTimes(2);
  });

  it('checks at most once per minute', async () => {
    const t = setup(async () => []);
    t.events.emit({ type: 'vault.unlocked' });
    t.advance(MIN_CHECK_INTERVAL_MS - 1);
    t.foreground();
    await flush();
    expect(t.service.listPending).toHaveBeenCalledTimes(1);
  });

  it('does nothing while the vault is locked', async () => {
    const t = setup(async () => []);
    t.foreground();
    t.events.emit({ type: 'vault.unlocked' });
    t.events.emit({ type: 'vault.locked' });
    t.advance(MIN_CHECK_INTERVAL_MS * 5);
    t.foreground();
    await flush();
    expect(t.service.listPending).toHaveBeenCalledTimes(1);
  });
});

it('does not notify when the vault locks while the list loads', async () => {
  let release: (v: (PendingApproval & { code: string })[]) => void = () => undefined;
  const t = setup(() => new Promise((resolve) => (release = resolve)));
  t.events.emit({ type: 'vault.unlocked' });
  t.events.emit({ type: 'vault.locked' });
  release([request('r1')]);
  await flush();
  expect(t.notifications.inbox()).toHaveLength(0);
});

it('swallows errors from the API and from the inbox', async () => {
  const t = setup(async () => {
    throw new ApprovalError('offline');
  });
  t.events.emit({ type: 'vault.unlocked' });
  await flush();
  expect(t.notifications.inbox()).toHaveLength(0);

  const broken = setup(async () => [request('r1')]);
  jest.spyOn(broken.notifications, 'notify').mockRejectedValue(new Error('vault is locked'));
  broken.events.emit({ type: 'vault.unlocked' });
  await flush();
  expect(broken.notifications.inbox()).toHaveLength(0);
});

it('stops listening after the unsubscribe', async () => {
  const t = setup(async () => [request('r1')]);
  t.stop();
  t.events.emit({ type: 'vault.unlocked' });
  await flush();
  expect(t.service.listPending).not.toHaveBeenCalled();
  expect(t.unwatch).toHaveBeenCalled();
});
