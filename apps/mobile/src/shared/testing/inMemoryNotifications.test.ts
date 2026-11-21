import type { NotifyInput } from '../ports/notifications';
import { createInMemoryNotifications } from './inMemoryNotifications';

const due: NotifyInput = {
  kind: 'payment_due',
  title: 'Servicios públicos',
  body: 'Vence en 2 días: $186.000.',
  deepLink: 'fynk://billetera/recurrentes/r1',
  dedupeKey: 'payment_due:r1:2026-10-26',
};

describe('createInMemoryNotifications', () => {
  it('adds a notify call to the inbox at the current time', async () => {
    const n = createInMemoryNotifications(() => '2026-10-24T13:00:00.000Z');

    await n.notify(due);

    expect(n.inbox()).toEqual([{ ...due, receivedAt: '2026-10-24T13:00:00.000Z' }]);
  });

  it('never shows the same dedupe key twice', async () => {
    const n = createInMemoryNotifications();

    await n.notify(due);
    await n.notify({ ...due, body: 'otro texto' });

    expect(n.inbox()).toHaveLength(1);
  });

  it('fires scheduled notifications when due, in time order', async () => {
    const n = createInMemoryNotifications();
    await n.schedule({ ...due, id: 'b', dedupeKey: 'b', fireAt: '2026-10-26T14:00:00Z' });
    await n.schedule({ ...due, id: 'a', dedupeKey: 'a', fireAt: '2026-10-26T13:00:00Z' });
    await n.schedule({ ...due, id: 'c', dedupeKey: 'c', fireAt: '2026-10-27T13:00:00Z' });

    n.fireDue('2026-10-26T15:00:00Z');

    expect(n.inbox().map((e) => e.dedupeKey)).toEqual(['a', 'b']);
    expect(n.inbox()[0]?.receivedAt).toBe('2026-10-26T13:00:00Z');
    expect(n.scheduled().map((s) => s.id)).toEqual(['c']);
  });

  it('replaces a schedule with the same id and cancels by id', async () => {
    const n = createInMemoryNotifications();
    await n.schedule({ ...due, id: 'r1', fireAt: '2026-10-26T13:00:00Z' });
    await n.schedule({ ...due, id: 'r1', fireAt: '2026-10-27T13:00:00Z' });
    expect(n.scheduled()).toHaveLength(1);
    expect(n.scheduled()[0]?.fireAt).toBe('2026-10-27T13:00:00Z');

    await n.cancel('r1');
    n.fireDue('2026-12-31T00:00:00Z');

    expect(n.inbox()).toEqual([]);
  });

  it('drops notifications of a disabled kind', async () => {
    const n = createInMemoryNotifications();
    n.setEnabled('payment_due', false);

    expect(await n.isEnabled('payment_due')).toBe(false);
    expect(await n.isEnabled('cap_warning')).toBe(true);
    await n.notify(due);
    expect(n.inbox()).toEqual([]);

    n.setEnabled('payment_due', true);
    await n.notify(due);
    expect(n.inbox()).toHaveLength(1);
  });
});
