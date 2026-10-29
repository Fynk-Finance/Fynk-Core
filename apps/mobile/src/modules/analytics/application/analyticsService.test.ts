import { createAppEvents } from '@shared/events/appEvents';

import { setupAnalytics as setup } from '../testing/harness';
import { DESIGN_TODAY } from '../testing/designFixture';
import { cop, tx } from '../testing/txFactory';
import { CAPS_BACKUP_COLLECTION, InvalidCapError } from './analyticsService';
import { subscribeAnalyticsEvents } from './events';

describe('analytics service', () => {
  it('gives the opportunities and the snapshot from the same inputs', async () => {
    const { service } = await setup();
    const { snapshot, opportunities } = await service.getReport();
    expect(snapshot.opportunities.map((o) => o.factKey)).toEqual(
      opportunities.map((o) => o.factKey),
    );
    expect(snapshot.periodEnd).toBe(DESIGN_TODAY);
  });

  it('creates, edits and deletes a cap in the vault and marks the backup dirty (HU-043)', async () => {
    const { service, backup, vault } = await setup();
    const cap = await service.saveCap({
      categoryId: 'restaurants',
      period: 'week',
      capMinor: cop(200_000),
    });
    expect(await service.listCapStatuses()).toHaveLength(1);

    await service.saveCap({
      id: cap.id,
      categoryId: 'restaurants',
      period: 'month',
      capMinor: cop(600_000),
    });
    const [edited] = await service.listCapStatuses();
    expect(edited?.cap).toMatchObject({ id: cap.id, period: 'month', capMinor: cop(600_000) });
    expect(edited?.cap.createdAt).toBe(cap.createdAt);

    await service.deleteCap(cap.id);
    expect(await service.listCapStatuses()).toEqual([]);
    expect(backup.dirty(CAPS_BACKUP_COLLECTION)).toEqual([cap.id]);

    const [row] = await vault.db.query<{ version: number; deleted_at: string | null }>(
      'SELECT version, deleted_at FROM analytics_caps WHERE id = ?',
      [cap.id],
    );
    expect(row?.version).toBe(3);
    expect(row?.deleted_at).not.toBeNull();
  });

  it('rejects a cap of zero or a negative cap', async () => {
    const { service } = await setup();
    await expect(
      service.saveCap({ categoryId: 'restaurants', period: 'week', capMinor: 0 }),
    ).rejects.toBeInstanceOf(InvalidCapError);
  });

  it('keeps "Antojos" at $20.000 by default and lets the user change it', async () => {
    const { service, backup } = await setup();
    expect(await service.getTreatsThreshold()).toBe(cop(20_000));
    await service.setTreatsThreshold(cop(15_000));
    expect(await service.getTreatsThreshold()).toBe(cop(15_000));
    expect(backup.dirty(CAPS_BACKUP_COLLECTION)).toEqual(['settings']);
  });

  it('notifies at 80 % and at 100 %, once each, and again next week', async () => {
    const txs = [tx('2026-10-26', -160_000, 'restaurants')];
    const { service, notifications, clock, txs: live } = await setup(txs);
    await service.saveCap({ categoryId: 'restaurants', period: 'week', capMinor: cop(200_000) });
    expect(notifications.inbox().map((n) => [n.kind, n.title, n.body])).toEqual([
      ['cap_warning', 'Restaurantes', 'Llevas el 80 % de tu tope semanal ($160.000 de $200.000).'],
    ]);

    expect(await service.evaluateCaps()).toBe(0);

    live.push(tx('2026-10-27', -40_000, 'restaurants'));
    expect(await service.evaluateCaps()).toBe(1);
    expect(notifications.inbox().at(-1)?.body).toBe(
      'Llegaste a tu tope de Restaurantes esta semana.',
    );
    expect(await service.evaluateCaps()).toBe(0);

    clock.set('2026-11-03T17:00:00Z');
    live.push(tx('2026-11-03', -170_000, 'restaurants'));
    expect(await service.evaluateCaps()).toBe(1);
    expect(notifications.inbox()).toHaveLength(3);
    expect(notifications.inbox().every((n) => n.deepLink === 'fynk://analisis/topes')).toBe(true);
  });

  it('does not show an alert the user turned off', async () => {
    const { service, notifications } = await setup([tx('2026-10-26', -190_000, 'restaurants')]);
    notifications.setEnabled('cap_warning', false);
    await service.saveCap({ categoryId: 'restaurants', period: 'week', capMinor: cop(200_000) });
    expect(notifications.inbox()).toEqual([]);
  });

  it('backs up caps and settings and restores them on a new phone', async () => {
    const first = await setup();
    await first.service.saveCap({ categoryId: 'treats', period: 'month', capMinor: cop(100_000) });
    await first.service.setTreatsThreshold(cop(25_000));
    const exported = await first.backup.exportAll();

    const second = await setup();
    await second.backup.importAll(exported);
    const [status] = await second.service.listCapStatuses();
    expect(status?.cap).toMatchObject({
      categoryId: 'treats',
      period: 'month',
      capMinor: cop(100_000),
    });
    expect(await second.service.getTreatsThreshold()).toBe(cop(25_000));
  });

  it('evaluates caps on sync, on changed movements and on unlock', async () => {
    const events = createAppEvents();
    const evaluateCaps = jest.fn().mockResolvedValue(0);
    const changed = jest.fn();
    const off = subscribeAnalyticsEvents(events, { evaluateCaps }, changed);
    events.emit({ type: 'vault.unlocked' });
    events.emit({ type: 'transactions.changed', ids: ['x'] });
    events.emit({
      type: 'sync.completed',
      at: '',
      linkIds: [],
      newTransactionIds: [],
      changedAccountIds: [],
    });
    expect(evaluateCaps).toHaveBeenCalledTimes(3);
    expect(changed).toHaveBeenCalledTimes(3);
    off();
    events.emit({ type: 'vault.unlocked' });
    expect(evaluateCaps).toHaveBeenCalledTimes(3);
  });
});
