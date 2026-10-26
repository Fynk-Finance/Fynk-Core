import { appEvents, createAppEvents, type AppEvent } from './appEvents';

describe('appEvents', () => {
  it('delivers an event to the listeners of its type only', () => {
    const bus = createAppEvents();
    const unlocked = jest.fn();
    const changed = jest.fn();
    bus.on('vault.unlocked', unlocked);
    bus.on('transactions.changed', changed);

    bus.emit({ type: 'transactions.changed', ids: ['t1', 't2'] });

    expect(changed).toHaveBeenCalledWith({ type: 'transactions.changed', ids: ['t1', 't2'] });
    expect(unlocked).not.toHaveBeenCalled();
  });

  it('gives each listener the narrowed payload of its type', () => {
    const bus = createAppEvents();
    const seen: string[] = [];
    bus.on('sync.failed', (e) => seen.push(`${e.linkId}:${e.code}`));

    bus.emit({
      type: 'sync.failed',
      at: '2026-10-25T14:03:00Z',
      linkId: 'l1',
      code: 'consent_revoked',
    });

    expect(seen).toEqual(['l1:consent_revoked']);
  });

  it('calls every listener in subscription order', () => {
    const bus = createAppEvents();
    const order: number[] = [];
    bus.on('vault.locked', () => order.push(1));
    bus.on('vault.locked', () => order.push(2));

    bus.emit({ type: 'vault.locked' });

    expect(order).toEqual([1, 2]);
  });

  it('stops calling a listener after it unsubscribes', () => {
    const bus = createAppEvents();
    const fn = jest.fn();
    const off = bus.on('recurring.detected', fn);

    bus.emit({ type: 'recurring.detected', count: 8 });
    off();
    off(); // unsubscribing twice is harmless
    bus.emit({ type: 'recurring.detected', count: 9 });

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not skip a listener when another one unsubscribes during emit', () => {
    const bus = createAppEvents();
    const second = jest.fn();
    const off = bus.on('goal.progress', () => off());
    bus.on('goal.progress', second);

    bus.emit({ type: 'goal.progress', goalId: 'g1', percent: 64 });

    expect(second).toHaveBeenCalledTimes(1);
  });

  it('keeps calling the other listeners when one throws, and reports the error', () => {
    const onError = jest.fn();
    const bus = createAppEvents(onError);
    const after = jest.fn();
    const boom = new Error('boom');
    bus.on('vault.unlocked', () => {
      throw boom;
    });
    bus.on('vault.unlocked', after);
    const event: AppEvent = { type: 'vault.unlocked' };

    bus.emit(event);

    expect(after).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(boom, event);
  });

  it('reports listener errors with the event type only by default', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const bus = createAppEvents();
    bus.on('vault.locked', () => {
      throw new Error('boom');
    });

    bus.emit({ type: 'vault.locked' });

    expect(spy).toHaveBeenCalledWith(
      '[appEvents] a listener of "vault.locked" failed',
      expect.any(Error),
    );
    spy.mockRestore();
  });

  it('exports a shared app-wide bus', () => {
    const fn = jest.fn();
    const off = appEvents.on('vault.locked', fn);
    appEvents.emit({ type: 'vault.locked' });
    off();
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
