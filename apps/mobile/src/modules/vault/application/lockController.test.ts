// Lock states: first phone, fresh login, password, pending device, errors, sign out, background.
import { createAppEvents, type AppEvent } from '@shared/events/appEvents';
import { createFixedClock } from '@shared/testing';

import { createLockController, type LockController, type LockIdentity } from './lockController';
import { VaultNotEncryptedError, type DekStore } from './ports';
import type { Vault } from './vault';

const START = '2026-11-03T15:00:00Z';
const MIN = 60 * 1000;
const DEK = Uint8Array.from({ length: 32 }, (_, i) => i + 1);
const ACTIVE = { id: 'd1', status: 'active' } as const;

function setup(
  options: {
    dek?: Uint8Array | null;
    loginAgoMs?: number | null;
    device?: Awaited<ReturnType<LockIdentity['currentDevice']>> | 'offline';
    openError?: Error;
    reauth?: Awaited<ReturnType<LockIdentity['reauthenticate']>>;
  } = {},
) {
  const clock = createFixedClock(START);
  const events = createAppEvents();
  const emitted: AppEvent['type'][] = [];
  events.on('vault.unlocked', () => emitted.push('vault.unlocked'));
  events.on('vault.locked', () => emitted.push('vault.locked'));

  let stored: Uint8Array | null = options.dek === undefined ? DEK : options.dek;
  let opened = false;
  let openError = options.openError;
  const dekStore: DekStore = {
    read: jest.fn(async () => stored),
    write: jest.fn(async (dek) => {
      stored = dek;
    }),
    remove: jest.fn(async () => undefined),
    removeAll: jest.fn(async () => {
      stored = null;
    }),
  };
  const vault = {
    open: jest.fn(async () => {
      if (openError) throw openError;
      opened = true;
      events.emit({ type: 'vault.unlocked' });
    }),
    close: jest.fn(async () => {
      if (!opened) return;
      opened = false;
      events.emit({ type: 'vault.locked' });
    }),
    wipe: jest.fn(async () => {
      opened = false;
    }),
  } satisfies Pick<Vault, 'open' | 'close' | 'wipe'>;

  let device = options.device === undefined ? ACTIVE : options.device;
  const loginAgo = options.loginAgoMs === undefined ? 0 : options.loginAgoMs;
  const sessionListeners = new Set<(s: { status: string }) => void>();
  const identity: LockIdentity = {
    lastLoginAt: jest.fn(() =>
      loginAgo === null ? null : new Date(clock.now().getTime() - loginAgo),
    ),
    reauthenticate: jest.fn(async () => options.reauth ?? 'ok'),
    currentDevice: jest.fn(async () => {
      if (device === 'offline') throw new Error('network');
      return device;
    }),
    onSessionChange: (listener) => {
      sessionListeners.add(listener);
      return () => sessionListeners.delete(listener);
    },
  };

  let nowMs = 1_000_000;
  const newDek = jest.fn(() => Uint8Array.from({ length: 32 }, () => 7));
  const controller: LockController = createLockController({
    vault,
    dekStore,
    newDek,
    identity,
    clock,
    nowMs: () => nowMs,
  });
  return {
    controller,
    vault,
    dekStore,
    identity,
    newDek,
    emitted,
    storedDek: () => stored,
    setDevice: (next: typeof device) => {
      device = next;
    },
    clearOpenError: () => {
      openError = undefined;
    },
    advance: (ms: number) => {
      nowMs += ms;
    },
    emitSession: (status: string) => sessionListeners.forEach((l) => l({ status })),
  };
}

describe('first phone of the account', () => {
  it('creates a DEK, writes copy A, opens and emits vault.unlocked', async () => {
    const t = setup({ dek: null });
    await t.controller.unlock();
    expect(t.vault.wipe).toHaveBeenCalledTimes(1);
    expect(t.newDek).toHaveBeenCalledTimes(1);
    expect(t.dekStore.write).toHaveBeenCalledWith(Uint8Array.from({ length: 32 }, () => 7));
    expect(t.vault.open).toHaveBeenCalledWith(t.storedDek());
    expect(t.controller.getState()).toEqual({ status: 'unlocked' });
    expect(t.emitted).toEqual(['vault.unlocked']);
  });

  it('never makes a key for a phone the API does not know or just removed', async () => {
    const t = setup({ dek: null, device: null });
    await t.controller.unlock();
    expect(t.controller.getState()).toEqual({ status: 'error', error: 'unknown' });
    expect(t.vault.wipe).not.toHaveBeenCalled();
    expect(t.newDek).not.toHaveBeenCalled();
    expect(t.dekStore.write).not.toHaveBeenCalled();
    expect(t.vault.open).not.toHaveBeenCalled();
  });

  it('waits for approval when this phone is pending', async () => {
    const t = setup({ dek: null, device: { id: 'd1', status: 'pending' } });
    await t.controller.unlock();
    expect(t.controller.getState()).toEqual({ status: 'pendingDevice' });
    expect(t.newDek).not.toHaveBeenCalled();
    expect(t.vault.open).not.toHaveBeenCalled();
  });

  it('reports offline when the device cannot be read, and retries', async () => {
    const t = setup({ dek: null, device: 'offline' });
    await t.controller.unlock();
    expect(t.controller.getState()).toEqual({ status: 'error', error: 'offline' });
    expect(t.newDek).not.toHaveBeenCalled();

    t.setDevice(ACTIVE);
    await t.controller.unlock();
    expect(t.controller.getState().status).toBe('unlocked');
  });

  it('reports a keychain error when copy A cannot be written', async () => {
    const t = setup({ dek: null });
    (t.dekStore.write as jest.Mock).mockRejectedValueOnce(new Error('keychain write failed'));
    await t.controller.unlock();
    expect(t.controller.getState()).toEqual({ status: 'error', error: 'keychain' });
    expect(t.vault.open).not.toHaveBeenCalled();
  });
});

describe('phone that already has a key', () => {
  it('opens with copy A after a fresh login', async () => {
    const t = setup({ loginAgoMs: 4 * MIN });
    await t.controller.unlock();
    expect(t.vault.open).toHaveBeenCalledWith(DEK);
    expect(t.vault.wipe).not.toHaveBeenCalled();
    expect(t.controller.getState()).toEqual({ status: 'unlocked' });
  });

  it('stays locked when the login is older than 5 minutes', async () => {
    const t = setup({ loginAgoMs: 6 * MIN });
    await t.controller.unlock();
    expect(t.vault.open).not.toHaveBeenCalled();
    expect(t.controller.getState()).toEqual({ status: 'locked' });
  });

  it('stays locked when there is no login date', async () => {
    const t = setup({ loginAgoMs: null });
    await t.controller.unlock();
    expect(t.controller.getState()).toEqual({ status: 'locked' });
  });

  it('reports a keychain error when copy A cannot be read', async () => {
    const t = setup();
    (t.dekStore.read as jest.Mock).mockRejectedValueOnce(new Error('keychain'));
    await t.controller.unlock();
    expect(t.controller.getState()).toEqual({ status: 'error', error: 'keychain' });
  });

  it('runs one unlock at a time', async () => {
    const t = setup();
    await Promise.all([t.controller.unlock(), t.controller.unlock()]);
    expect(t.vault.open).toHaveBeenCalledTimes(1);
  });

  it('does nothing when already unlocked', async () => {
    const t = setup();
    await t.controller.unlock();
    await t.controller.unlock();
    expect(t.vault.open).toHaveBeenCalledTimes(1);
  });
});

describe('unlockWithPassword', () => {
  it('opens with copy A after Keycloak confirms', async () => {
    const t = setup({ loginAgoMs: 60 * MIN, reauth: 'ok' });
    await t.controller.unlock();
    expect(t.controller.getState().status).toBe('locked');
    await t.controller.unlockWithPassword();
    expect(t.identity.reauthenticate).toHaveBeenCalledTimes(1);
    expect(t.vault.open).toHaveBeenCalledWith(DEK);
    expect(t.controller.getState()).toEqual({ status: 'unlocked' });
  });

  it('stays locked, without an error, when the person cancels', async () => {
    const t = setup({ loginAgoMs: 60 * MIN, reauth: 'cancelled' });
    await t.controller.unlock();
    await t.controller.unlockWithPassword();
    expect(t.vault.open).not.toHaveBeenCalled();
    expect(t.controller.getState()).toEqual({ status: 'locked' });
  });

  it('stays locked with an error when the login fails', async () => {
    const t = setup({ loginAgoMs: 60 * MIN, reauth: 'failed' });
    await t.controller.unlock();
    await t.controller.unlockWithPassword();
    expect(t.vault.open).not.toHaveBeenCalled();
    expect(t.controller.getState()).toEqual({ status: 'locked', error: 'unknown' });
  });

  it('sets up the phone when there is no key yet', async () => {
    const t = setup({ dek: null, device: 'offline', reauth: 'ok' });
    await t.controller.unlock();
    t.setDevice(ACTIVE);
    await t.controller.unlockWithPassword();
    expect(t.controller.getState().status).toBe('unlocked');
  });
});

describe('open errors', () => {
  it('reports notEncrypted and never retries it by itself', async () => {
    const t = setup({ openError: new VaultNotEncryptedError() });
    await t.controller.unlock();
    expect(t.controller.getState()).toEqual({ status: 'error', error: 'notEncrypted' });

    t.clearOpenError();
    await t.controller.unlock();
    expect(t.vault.open).toHaveBeenCalledTimes(1);
    expect(t.controller.getState().error).toBe('notEncrypted');
  });

  it('reports any other open failure as unknown and allows a retry', async () => {
    const t = setup({ openError: new Error('file is not a database') });
    await t.controller.unlock();
    expect(t.controller.getState()).toEqual({ status: 'error', error: 'unknown' });

    t.clearOpenError();
    await t.controller.unlock();
    expect(t.controller.getState().status).toBe('unlocked');
  });
});

describe('locking', () => {
  it('locks on sign out', async () => {
    const t = setup();
    const stop = t.controller.start();
    await t.controller.unlock();
    t.emitSession('signedIn');
    expect(t.controller.getState().status).toBe('unlocked');

    t.emitSession('signedOut');
    await Promise.resolve();
    await Promise.resolve();
    expect(t.controller.getState()).toEqual({ status: 'locked' });
    expect(t.emitted).toEqual(['vault.unlocked', 'vault.locked']);

    stop();
    await t.controller.unlock();
    t.emitSession('signedOut');
    expect(t.controller.getState().status).toBe('unlocked');
  });

  it('locks after more than 5 minutes in the background', async () => {
    const t = setup();
    await t.controller.unlock();
    t.controller.appBackgrounded();
    t.advance(5 * MIN + 1);
    await t.controller.appForegrounded();
    expect(t.controller.getState()).toEqual({ status: 'locked' });
    expect(t.vault.close).toHaveBeenCalled();
  });

  it('does not lock after 5 minutes or less', async () => {
    const t = setup();
    await t.controller.unlock();
    t.controller.appBackgrounded();
    t.advance(5 * MIN);
    await t.controller.appForegrounded();
    expect(t.controller.getState().status).toBe('unlocked');
  });

  it('counts from the first background event when inactive follows background', async () => {
    const t = setup();
    await t.controller.unlock();
    t.controller.appBackgrounded();
    t.advance(4 * MIN);
    t.controller.appBackgrounded();
    t.advance(2 * MIN);
    await t.controller.appForegrounded();
    expect(t.controller.getState().status).toBe('locked');
  });

  it('ignores a foreground event that has no background before it', async () => {
    const t = setup();
    await t.controller.unlock();
    t.advance(60 * MIN);
    await t.controller.appForegrounded();
    expect(t.controller.getState().status).toBe('unlocked');
  });

  it('closes the vault when a lock happens while it is still opening', async () => {
    const t = setup();
    let release!: () => void;
    (t.vault.open as jest.Mock).mockImplementationOnce(
      () => new Promise<void>((resolve) => (release = () => resolve())),
    );
    const pending = t.controller.unlock();
    await new Promise<void>((r) => setImmediate(() => r()));
    await t.controller.lock();
    release();
    await pending;
    expect(t.vault.close).toHaveBeenCalledTimes(2);
    expect(t.controller.getState()).toEqual({ status: 'locked' });
  });

  it('goes back to locked after a wipe (reset)', async () => {
    const t = setup();
    await t.controller.unlock();
    t.controller.reset();
    expect(t.controller.getState()).toEqual({ status: 'locked' });
  });

  it('tells subscribers about every change', async () => {
    const t = setup();
    const seen: string[] = [];
    const stop = t.controller.subscribe(() => seen.push(t.controller.getState().status));
    await t.controller.unlock();
    stop();
    await t.controller.lock();
    expect(seen).toEqual(['unlocking', 'unlocking', 'unlocked']);
  });
});
