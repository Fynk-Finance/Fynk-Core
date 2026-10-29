// SCRUM-70: "El usuario puede activar o desactivar cada tipo de aviso desde Mi cuenta".
// The settings of the service on a real SQLite vault (sql.js), with the module's migrations.
import type { NotifyInput } from '@shared/ports';
import { createFixedClock, createInMemoryVault, type InMemoryVault } from '@shared/testing';

import { notificationsMigrations } from '../adapters/vault/migrations';
import { createVaultInboxStore } from '../adapters/vault/vaultInboxStore';
import { createNotificationService, type NotificationService } from './notificationService';
import type { LocalNotificationRequest, LocalNotifier } from './ports';

const notice = (kind: NotifyInput['kind'], key: string): NotifyInput => ({
  kind,
  title: key,
  body: '',
  deepLink: 'fynk://dashboard',
  dedupeKey: key,
});

let vault: InMemoryVault;
let service: NotificationService;
let notifier: jest.Mocked<LocalNotifier>;
const clock = createFixedClock('2026-10-26T15:00:00Z');

beforeEach(async () => {
  vault = await createInMemoryVault();
  vault.registerMigrations('notifications', notificationsMigrations);
  await vault.migrate();
  let n = 0;
  let os = 0;
  notifier = {
    permission: jest.fn(async () => 'granted' as const),
    askPermission: jest.fn(async () => true),
    schedule: jest.fn(async (_r: LocalNotificationRequest) => `os-${++os}`),
    cancel: jest.fn(async (_osId: string) => undefined),
  };
  service = createNotificationService({
    store: () => createVaultInboxStore(vault.db),
    clock,
    newId: () => `n${++n}`,
    notifier,
  });
});

afterEach(() => vault.close());

describe('settings', () => {
  it('starts with everything on and reminders 2 days before payments', async () => {
    const s = await service.settings();
    expect(s.allowAll).toBe(true);
    expect(Object.values(s.kinds).every(Boolean)).toBe(true);
    expect(s.paymentLeadDays).toBe(2);
    expect(await service.paymentLeadDays()).toBe(2);
  });

  it('keeps each switch the person turns off', async () => {
    await service.setEnabled('sync_result', false);
    await service.setEnabled('cap_warning', false);
    const s = await service.settings();
    expect(s.kinds.sync_result).toBe(false);
    expect(s.kinds.cap_warning).toBe(false);
    expect(s.kinds.payment_due).toBe(true);
  });

  it('"Permitir notificaciones" off silences every kind but new devices, and keeps the switches', async () => {
    await service.setEnabled('sync_result', false);
    await service.setAllowAll(false);

    await service.notify(notice('payment_due', 'p'));
    await service.notify(notice('device_approval', 'd'));
    expect((await service.list()).map((i) => i.kind)).toEqual(['device_approval']);
    expect(await service.isEnabled('payment_due')).toBe(false);

    await service.setAllowAll(true);
    const s = await service.settings();
    expect(s.allowAll).toBe(true);
    expect(s.kinds.sync_result).toBe(false); // the person's own choice is kept
    expect(await service.isEnabled('payment_due')).toBe(true);
  });

  it('"Permitir notificaciones" off cancels the pending reminders on the phone', async () => {
    await service.schedule({
      ...notice('payment_due', 'p'),
      id: 'reminder:r1',
      fireAt: '2026-10-28T14:00:00Z',
    });
    await service.setAllowAll(false);
    expect(notifier.cancel).toHaveBeenCalledWith('os-1');

    await service.setAllowAll(true);
    clock.set('2026-10-30T12:00:00Z');
    expect(await service.deliverDue()).toBe(0);
  });

  it('keeps the lead time chosen for payment reminders', async () => {
    await service.setPaymentLeadDays(0);
    expect(await service.paymentLeadDays()).toBe(0);
    await service.setPaymentLeadDays(1);
    expect((await service.settings()).paymentLeadDays).toBe(1);
  });

  it('never turns off new devices', async () => {
    await service.setEnabled('device_approval', false);
    expect((await service.settings()).kinds.device_approval).toBe(true);
  });

  it('tells the modules that schedule reminders when a setting changes (M9 reschedules)', async () => {
    const listener = jest.fn();
    const unsubscribe = service.onSettingsChanged(listener);
    await service.setPaymentLeadDays(1);
    await service.setEnabled('payment_due', true);
    await service.setAllowAll(true);
    expect(listener).toHaveBeenCalledTimes(3);
    unsubscribe();
    await service.setPaymentLeadDays(2);
    expect(listener).toHaveBeenCalledTimes(3);
  });
});
