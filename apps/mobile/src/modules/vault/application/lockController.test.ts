// Lock states: first phone, fresh login, password, pending device, errors, sign out, background.
import { createAppEvents, type AppEvent } from '@shared/events/appEvents';
import { createFixedClock } from '@shared/testing';

import { createLockController, type LockController, type LockIdentity } from './lockController';
import {
  RecoveryError,
  VaultNotEncryptedError,
  type BiometricRead,
  type DekStore,
  type StoredRecoveryKey,
} from './ports';
import type { PreparedRecoveryCode } from './recoveryCode';
import type { Vault } from './vault';

const START = '2026-11-03T15:00:00Z';
const MIN = 60 * 1000;
const DEK = Uint8Array.from({ length: 32 }, (_, i) => i + 1);
const PROMPT = { title: 'T', subtitle: 'S', cancel: 'C' };
const ACTIVE = { id: 'd1', status: 'active' } as const;

function setup(
  options: {
    dek?: Uint8Array | null;
    loginAgoMs?: number | null;
    device?: Awaited<ReturnType<LockIdentity['currentDevice']>> | 'offline';
    openError?: Error;
    reauth?: Awaited<ReturnType<LockIdentity['reauthenticate']>>;
    /** Copy B: the DEK it holds, or null for none. */
    copyB?: Uint8Array | null;
    biometrics?: boolean;
    read?: BiometricRead;
    write?: 'ok' | 'cancelled' | Error;
    /** What the server holds. Default `exists`: the account already has its recovery code. */
    recoveryKey?: 'exists' | 'missing' | 'offline';
    prepareError?: Error;
    commit?: Error;
  } = {},
) {
  const clock = createFixedClock(START);
  const events = createAppEvents();
  const emitted: AppEvent['type'][] = [];
  events.on('vault.unlocked', () => emitted.push('vault.unlocked'));
  events.on('vault.locked', () => emitted.push('vault.locked'));

  let stored: Uint8Array | null = options.dek === undefined ? DEK : options.dek;
  let copyB: Uint8Array | null = options.copyB ?? null;
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
      copyB = null;
    }),
    biometricsAvailable: jest.fn(async () => options.biometrics ?? true),
    hasBiometric: jest.fn(async () => copyB !== null),
    writeBiometric: jest.fn(async (dek) => {
      if (options.write instanceof Error) throw options.write;
      if (options.write === 'cancelled') return 'cancelled';
      copyB = dek;
      return 'ok';
    }),
    readBiometric: jest.fn(async () => options.read ?? ({ status: 'ok', dek: copyB! } as const)),
    removeBiometric: jest.fn(async () => {
      copyB = null;
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

  let recoveryKey = options.recoveryKey ?? 'exists';
  const storedKey: StoredRecoveryKey = {
    wrappedDek: new Uint8Array(48),
    nonce: new Uint8Array(12),
    salt: new Uint8Array(16),
    kdfParams: { memoryKiB: 65536, iterations: 3, parallelism: 1 },
    createdAt: START,
  };
  const recoveryGet = jest.fn(async () => {
    if (recoveryKey === 'offline') throw new RecoveryError('offline');
    return recoveryKey === 'exists' ? storedKey : null;
  });
  let codes = 0;
  const commits: jest.Mock[] = [];
  const prepare = jest.fn(async (_dek: Uint8Array): Promise<PreparedRecoveryCode> => {
    if (options.prepareError) throw options.prepareError;
    codes += 1;
    const commit = jest.fn(async () => {
      if (options.commit) throw options.commit;
      recoveryKey = 'exists';
    });
    commits.push(commit);
    return {
      groups: ['AAAAA', 'BBBBB', 'CCCCC', 'DDDDD', `EEEE${codes}X`],
      lastGroup: `EEEE${codes}X`,
      commit,
    };
  });

  let nowMs = 1_000_000;
  const newDek = jest.fn(() => Uint8Array.from({ length: 32 }, () => 7));
  const controller: LockController = createLockController({
    vault,
    dekStore,
    newDek,
    identity,
    clock,
    nowMs: () => nowMs,
    biometricPrompt: PROMPT,
    recoveryKey: { get: recoveryGet },
    recoveryCode: { prepare },
  });
  return {
    controller,
    recoveryGet,
    prepare,
    commits,
    setRecoveryKey: (next: 'exists' | 'missing' | 'offline') => {
      recoveryKey = next;
    },
    vault,
    dekStore,
    identity,
    newDek,
    emitted,
    storedDek: () => stored,
    copyB: () => copyB,
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

/** A pending GET /backup/recovery-key that the test answers by hand. */
function deferredKey() {
  let resolve!: (key: StoredRecoveryKey | null) => void;
  const promise = new Promise<StoredRecoveryKey | null>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('first phone of the account', () => {
  it('creates a DEK, writes copy A, opens, emits vault.unlocked and shows the recovery code', async () => {
    const t = setup({ dek: null, recoveryKey: 'missing' });
    await t.controller.unlock();
    expect(t.recoveryGet).toHaveBeenCalledTimes(1);
    expect(t.vault.wipe).toHaveBeenCalledTimes(1);
    expect(t.newDek).toHaveBeenCalledTimes(1);
    expect(t.dekStore.write).toHaveBeenCalledWith(Uint8Array.from({ length: 32 }, () => 7));
    expect(t.vault.open).toHaveBeenCalledWith(t.storedDek());
    expect(t.prepare).toHaveBeenCalledWith(Uint8Array.from({ length: 32 }, () => 7));
    expect(t.controller.getState()).toEqual({
      status: 'recoveryCode',
      recovery: { groups: ['AAAAA', 'BBBBB', 'CCCCC', 'DDDDD', 'EEEE1X'] },
    });
    expect(t.emitted).toEqual(['vault.unlocked']);
    // Nothing is uploaded until the person confirms.
    expect(t.commits[0]).not.toHaveBeenCalled();
  });

  it('asks the server before making a key, and never makes one for an account with a backup', async () => {
    const t = setup({ dek: null, recoveryKey: 'exists' });
    await t.controller.unlock();
    expect(t.controller.getState()).toEqual({ status: 'pendingDevice' });
    expect(t.vault.wipe).not.toHaveBeenCalled();
    expect(t.newDek).not.toHaveBeenCalled();
    expect(t.dekStore.write).not.toHaveBeenCalled();
    expect(t.vault.open).not.toHaveBeenCalled();
  });

  it('makes no key when it cannot ask the server, and retries', async () => {
    const t = setup({ dek: null, recoveryKey: 'offline' });
    await t.controller.unlock();
    expect(t.controller.getState()).toEqual({ status: 'error', error: 'offline' });
    expect(t.newDek).not.toHaveBeenCalled();
    expect(t.vault.wipe).not.toHaveBeenCalled();

    t.setRecoveryKey('missing');
    await t.controller.unlock();
    expect(t.controller.getState().status).toBe('recoveryCode');
  });

  it('stays unlocked when preparing the code fails (the next unlock offers it again)', async () => {
    const t = setup({ dek: null, recoveryKey: 'missing', prepareError: new Error('argon2') });
    await t.controller.unlock();
    expect(t.controller.getState()).toEqual({ status: 'unlocked' });
    expect(t.storedDek()).not.toBeNull();
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
    const t = setup({ dek: null, device: 'offline', recoveryKey: 'missing' });
    await t.controller.unlock();
    expect(t.controller.getState()).toEqual({ status: 'error', error: 'offline' });
    expect(t.newDek).not.toHaveBeenCalled();

    t.setDevice(ACTIVE);
    await t.controller.unlock();
    expect(t.controller.getState().status).toBe('recoveryCode');
  });

  it('reports a keychain error when copy A cannot be written', async () => {
    const t = setup({ dek: null, recoveryKey: 'missing' });
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
    const t = setup({ dek: null, device: 'offline', reauth: 'ok', recoveryKey: 'missing' });
    await t.controller.unlock();
    t.setDevice(ACTIVE);
    await t.controller.unlockWithPassword();
    expect(t.controller.getState().status).toBe('recoveryCode');
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

describe('biometric unlock (copy B)', () => {
  const STALE = 6 * MIN;

  it('shows the button when copy B exists and the phone has biometrics', async () => {
    const t = setup({ copyB: DEK, loginAgoMs: STALE });
    await t.controller.unlock();
    expect(t.controller.getState()).toEqual({ status: 'locked', biometric: true });
    expect(t.dekStore.readBiometric).not.toHaveBeenCalled();
  });

  it('hides the button without copy B or without biometric hardware', async () => {
    const a = setup({ loginAgoMs: STALE });
    await a.controller.unlock();
    expect(a.controller.getState().biometric).toBeUndefined();
    const b = setup({ copyB: DEK, biometrics: false, loginAgoMs: STALE });
    await b.controller.unlock();
    expect(b.controller.getState().biometric).toBeUndefined();
  });

  it('opens the vault with the DEK of copy B', async () => {
    const t = setup({ copyB: DEK, loginAgoMs: STALE });
    await t.controller.unlock();
    await t.controller.unlockWithBiometrics();
    expect(t.dekStore.readBiometric).toHaveBeenCalledWith(PROMPT);
    expect(t.vault.open).toHaveBeenCalledWith(DEK);
    expect(t.controller.getState()).toEqual({ status: 'unlocked' });
  });

  it('stays locked without an error when the person cancels', async () => {
    const t = setup({ copyB: DEK, loginAgoMs: STALE, read: { status: 'cancelled' } });
    await t.controller.unlock();
    await t.controller.unlockWithBiometrics();
    expect(t.vault.open).not.toHaveBeenCalled();
    expect(t.controller.getState()).toEqual({ status: 'locked', biometric: true });
  });

  it('copy B disappears after an enrollment change: deleted, notice, password needed', async () => {
    const t = setup({ copyB: DEK, loginAgoMs: STALE, read: { status: 'invalidated' } });
    await t.controller.unlock();
    await t.controller.unlockWithBiometrics();
    expect(t.copyB()).toBeNull();
    expect(t.vault.open).not.toHaveBeenCalled();
    expect(t.controller.getState()).toEqual({ status: 'locked', notice: 'biometricsOff' });
    expect((await t.controller.biometricStatus()).enabled).toBe(false);
    await t.controller.unlockWithPassword();
    expect(t.controller.getState()).toEqual({ status: 'unlocked' });
  });

  it('keeps copy B and allows a retry after another error', async () => {
    const t = setup({ copyB: DEK, loginAgoMs: STALE, read: { status: 'failed' } });
    await t.controller.unlock();
    await t.controller.unlockWithBiometrics();
    expect(t.copyB()).toEqual(DEK);
    expect(t.controller.getState()).toEqual({
      status: 'locked',
      biometric: true,
      notice: 'biometricFailed',
    });
  });

  it('prompts by itself once per lock, not in a loop', async () => {
    const t = setup({ copyB: DEK, loginAgoMs: STALE, read: { status: 'cancelled' } });
    await t.controller.unlock();
    await t.controller.autoPromptBiometric();
    await t.controller.autoPromptBiometric();
    expect(t.dekStore.readBiometric).toHaveBeenCalledTimes(1);
    await t.controller.unlockWithBiometrics();
    expect(t.dekStore.readBiometric).toHaveBeenCalledTimes(2);
    await t.controller.lock();
    await t.controller.autoPromptBiometric();
    expect(t.dekStore.readBiometric).toHaveBeenCalledTimes(3);
  });

  it('does not prompt by itself without copy B', async () => {
    const t = setup({ loginAgoMs: STALE });
    await t.controller.unlock();
    await t.controller.autoPromptBiometric();
    expect(t.dekStore.readBiometric).not.toHaveBeenCalled();
  });

  it('keeps the password path when copy B exists', async () => {
    const t = setup({ copyB: DEK, loginAgoMs: STALE });
    await t.controller.unlock();
    await t.controller.unlockWithPassword();
    expect(t.identity.reauthenticate).toHaveBeenCalledTimes(1);
    expect(t.controller.getState()).toEqual({ status: 'unlocked' });
  });

  it('lock keeps the button when copy B exists', async () => {
    const t = setup({ copyB: DEK });
    await t.controller.unlock();
    await t.controller.lock();
    expect(t.controller.getState()).toEqual({ status: 'locked', biometric: true });
  });

  it('removeAll (wipe) clears copy B', async () => {
    const t = setup({ copyB: DEK });
    await t.dekStore.removeAll();
    expect(t.copyB()).toBeNull();
  });
});

describe('turning biometrics on and off', () => {
  it('writes copy B from copy A after a fresh login, without asking for the password', async () => {
    const t = setup({ loginAgoMs: 4 * MIN });
    expect(await t.controller.enableBiometrics()).toBe('enabled');
    expect(t.identity.reauthenticate).not.toHaveBeenCalled();
    expect(t.copyB()).toEqual(DEK);
    expect(await t.controller.biometricStatus()).toEqual({ supported: true, enabled: true });
  });

  it('asks for the password first when the login is older than 5 minutes', async () => {
    const t = setup({ loginAgoMs: 6 * MIN });
    expect(await t.controller.enableBiometrics()).toBe('enabled');
    expect(t.identity.reauthenticate).toHaveBeenCalledTimes(1);
    expect(t.copyB()).toEqual(DEK);
  });

  it.each([
    ['cancelled', 'cancelled'],
    ['failed', 'failed'],
  ] as const)('writes nothing when the password step is %s', async (reauth, expected) => {
    const t = setup({ loginAgoMs: null, reauth });
    expect(await t.controller.enableBiometrics()).toBe(expected);
    expect(t.dekStore.writeBiometric).not.toHaveBeenCalled();
  });

  it('writes nothing without biometric hardware', async () => {
    const t = setup({ biometrics: false });
    expect(await t.controller.enableBiometrics()).toBe('failed');
    expect(t.dekStore.writeBiometric).not.toHaveBeenCalled();
  });

  it('reports cancelled or failed from the write', async () => {
    expect(await setup({ write: 'cancelled' }).controller.enableBiometrics()).toBe('cancelled');
    expect(await setup({ write: new Error('x') }).controller.enableBiometrics()).toBe('failed');
  });

  it('turning off removes copy B', async () => {
    const t = setup({ copyB: DEK });
    await t.controller.disableBiometrics();
    expect(t.copyB()).toBeNull();
  });
});

describe('recovery code after an open', () => {
  it('asks the server once and stays unlocked when the key exists', async () => {
    const t = setup({ loginAgoMs: 0 });
    await t.controller.unlock();
    expect(t.recoveryGet).toHaveBeenCalledTimes(1);
    expect(t.prepare).not.toHaveBeenCalled();
    expect(t.controller.getState()).toEqual({ status: 'unlocked' });
  });

  it('shows a new code when the server has none (the app died before "Ya lo guardé")', async () => {
    const t = setup({ recoveryKey: 'missing' });
    await t.controller.unlock();
    expect(t.vault.open).toHaveBeenCalledWith(DEK);
    expect(t.prepare).toHaveBeenCalledWith(DEK);
    expect(t.controller.getState().status).toBe('recoveryCode');
    expect(t.controller.getState().recovery?.groups).toHaveLength(5);
  });

  it('does the same after the password and after biometrics', async () => {
    const pw = setup({ loginAgoMs: 60 * MIN, recoveryKey: 'missing' });
    await pw.controller.unlock();
    await pw.controller.unlockWithPassword();
    expect(pw.controller.getState().status).toBe('recoveryCode');

    const bio = setup({ loginAgoMs: 60 * MIN, copyB: DEK, recoveryKey: 'missing' });
    await bio.controller.unlock();
    await bio.controller.unlockWithBiometrics();
    expect(bio.controller.getState().status).toBe('recoveryCode');
  });

  it('stays unlocked when the network fails, and checks again on the next unlock', async () => {
    const t = setup({ recoveryKey: 'offline' });
    await t.controller.unlock();
    expect(t.controller.getState()).toEqual({ status: 'unlocked' });
    expect(t.prepare).not.toHaveBeenCalled();

    await t.controller.lock();
    t.setRecoveryKey('missing');
    await t.controller.unlock();
    expect(t.controller.getState().status).toBe('recoveryCode');
  });

  it('does not ask for a device that is not active', async () => {
    const t = setup({ recoveryKey: 'missing', device: { id: 'd1', status: 'pending' } });
    await t.controller.unlock();
    expect(t.recoveryGet).not.toHaveBeenCalled();
    expect(t.controller.getState()).toEqual({ status: 'unlocked' });
  });

  it('does not ask again on a plain return to the foreground', async () => {
    const t = setup();
    await t.controller.unlock();
    t.controller.appBackgrounded();
    t.advance(60 * 1000);
    await t.controller.appForegrounded();
    expect(t.recoveryGet).toHaveBeenCalledTimes(1);
  });

  it('opens at once: the tabs do not wait for the server', async () => {
    const t = setup({ recoveryKey: 'missing' });
    const answer = deferredKey();
    t.recoveryGet.mockImplementationOnce(() => answer.promise);
    const unlocking = t.controller.unlock();
    await new Promise<void>((r) => setImmediate(() => r()));
    expect(t.controller.getState()).toEqual({ status: 'unlocked' });
    answer.resolve(null);
    await unlocking;
    expect(t.controller.getState().status).toBe('recoveryCode');
  });

  it('drops the code when the app locks before the check answers', async () => {
    const t = setup({ recoveryKey: 'missing' });
    const answer = deferredKey();
    t.recoveryGet.mockImplementationOnce(() => answer.promise);
    const unlocking = t.controller.unlock();
    await new Promise<void>((r) => setImmediate(() => r()));
    await t.controller.lock();
    answer.resolve(null);
    await unlocking;
    expect(t.controller.getState().status).toBe('locked');
  });

  it('does not run unlock again while the code is shown', async () => {
    const t = setup({ recoveryKey: 'missing' });
    await t.controller.unlock();
    await t.controller.unlock();
    await t.controller.unlockWithPassword();
    await t.controller.unlockWithBiometrics();
    expect(t.prepare).toHaveBeenCalledTimes(1);
    expect(t.controller.getState().status).toBe('recoveryCode');
  });
});

describe('confirmRecoveryCode', () => {
  async function shown() {
    const t = setup({ dek: null, recoveryKey: 'missing' });
    await t.controller.unlock();
    return t;
  }

  it('commits and unlocks when the last group matches, forgiving slips', async () => {
    const t = await shown();
    expect(await t.controller.confirmRecoveryCode(' eeee1x ')).toBe('ok');
    expect(t.commits[0]).toHaveBeenCalledTimes(1);
    expect(t.controller.getState()).toEqual({ status: 'unlocked' });
  });

  it('answers mismatch, uploads nothing and keeps the code on screen', async () => {
    const t = await shown();
    expect(await t.controller.confirmRecoveryCode('ZZZZZZ')).toBe('mismatch');
    expect(t.commits[0]).not.toHaveBeenCalled();
    expect(t.controller.getState().status).toBe('recoveryCode');
  });

  it('answers offline or failed when the upload fails, and the same code can be retried', async () => {
    const offline = setup({
      dek: null,
      recoveryKey: 'missing',
      commit: new RecoveryError('offline'),
    });
    await offline.controller.unlock();
    expect(await offline.controller.confirmRecoveryCode('EEEE1X')).toBe('offline');
    expect(offline.controller.getState().status).toBe('recoveryCode');

    const failed = setup({
      dek: null,
      recoveryKey: 'missing',
      commit: new RecoveryError('unknown'),
    });
    await failed.controller.unlock();
    expect(await failed.controller.confirmRecoveryCode('EEEE1X')).toBe('failed');
    expect(failed.controller.getState().status).toBe('recoveryCode');
  });

  it('fails when no code is shown', async () => {
    const t = setup();
    await t.controller.unlock();
    expect(await t.controller.confirmRecoveryCode('EEEE1X')).toBe('failed');
  });

  it('forgets the code when the app locks', async () => {
    const t = await shown();
    await t.controller.lock();
    expect(t.controller.getState().recovery).toBeUndefined();
    expect(await t.controller.confirmRecoveryCode('EEEE1X')).toBe('failed');
  });
});

describe('prepareNewRecoveryCode', () => {
  it('prepares a code from the DEK in copy A with a fresh login, and uploads nothing', async () => {
    const t = setup({ loginAgoMs: 2 * MIN });
    await t.controller.unlock();
    const result = await t.controller.prepareNewRecoveryCode();
    expect(t.identity.reauthenticate).not.toHaveBeenCalled();
    expect(result.status).toBe('ready');
    expect(t.prepare).toHaveBeenCalledWith(DEK);
    expect(t.commits[0]).not.toHaveBeenCalled();
  });

  it('asks for the password first when the login is older than 5 minutes', async () => {
    const t = setup({ loginAgoMs: 0, reauth: 'ok' });
    await t.controller.unlock();
    (t.identity.lastLoginAt as jest.Mock).mockReturnValue(new Date(0));
    const result = await t.controller.prepareNewRecoveryCode();
    expect(t.identity.reauthenticate).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('ready');
  });

  it.each([
    ['cancelled', 'cancelled'],
    ['failed', 'failed'],
  ] as const)('prepares nothing when the password step ends %s', async (reauth, status) => {
    const t = setup({ loginAgoMs: 0, reauth });
    await t.controller.unlock();
    (t.identity.lastLoginAt as jest.Mock).mockReturnValue(null);
    expect(await t.controller.prepareNewRecoveryCode()).toEqual({ status });
    expect(t.prepare).not.toHaveBeenCalled();
  });

  it('fails when copy A is missing or preparing throws', async () => {
    const t = setup({ loginAgoMs: 0 });
    await t.controller.unlock();
    (t.dekStore.read as jest.Mock).mockResolvedValueOnce(null);
    expect(await t.controller.prepareNewRecoveryCode()).toEqual({ status: 'failed' });
    t.prepare.mockRejectedValueOnce(new Error('argon2'));
    expect(await t.controller.prepareNewRecoveryCode()).toEqual({ status: 'failed' });
  });
});
