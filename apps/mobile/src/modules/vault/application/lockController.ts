// Lock states of the vault: who may open it and when. No React here; the UI subscribes.
// Opening needs the DEK (Keychain copy A) AND a fresh Keycloak login, or the password again.
// Never log the DEK or anything about it.
import type { Clock } from '@shared/domain/types';

import { isFreshLogin, shouldLock } from '../domain/lockPolicy';
import { VaultNotEncryptedError, type DekStore } from './ports';
import type { Vault } from './vault';

export type LockError = 'notEncrypted' | 'keychain' | 'offline' | 'unknown';

export interface LockState {
  status: 'locked' | 'unlocking' | 'unlocked' | 'pendingDevice' | 'error';
  error?: LockError;
}

/** What the controller needs from identity (M1). The wiring passes lazy calls. */
export interface LockIdentity {
  lastLoginAt(): Date | null;
  reauthenticate(): Promise<'ok' | 'cancelled' | 'failed'>;
  currentDevice(): Promise<{ id: string; status: 'active' | 'pending' } | null>;
  /** Calls the listener on every session change. Returns the unsubscribe. */
  onSessionChange(listener: (state: { status: string }) => void): () => void;
}

export interface LockControllerDeps {
  vault: Pick<Vault, 'open' | 'close' | 'wipe'>;
  dekStore: DekStore;
  newDek: () => Uint8Array;
  identity: LockIdentity;
  clock: Clock;
  /** Milliseconds, for the background timer. */
  nowMs: () => number;
}

export interface LockController {
  getState(): LockState;
  subscribe(listener: () => void): () => void;
  /** Opens the vault when the key and a fresh login allow it, or sets up the first phone. */
  unlock(): Promise<void>;
  /** Asks Keycloak for the password again, then opens. */
  unlockWithPassword(): Promise<void>;
  lock(): Promise<void>;
  /** Locks on sign out. Returns the unsubscribe. */
  start(): () => void;
  /** AppState wiring: the app left the foreground. */
  appBackgrounded(): void;
  /** AppState wiring: the app is active again. Locks after more than 5 minutes away. */
  appForegrounded(): Promise<void>;
  /** Back to locked without touching the vault (after wipe). */
  reset(): void;
}

const LOCKED: LockState = { status: 'locked' };
const keychainError: LockState = { status: 'error', error: 'keychain' };

export function createLockController(deps: LockControllerDeps): LockController {
  const { vault, dekStore, identity, clock } = deps;
  let state: LockState = LOCKED;
  let backgroundSince: number | null = null;
  // Bumped by lock and reset, so an open that finishes afterwards is closed again.
  let generation = 0;
  let inFlight: Promise<void> | null = null;
  const listeners = new Set<() => void>();

  const set = (next: LockState) => {
    state = next;
    listeners.forEach((l) => l());
  };

  async function openWith(dek: Uint8Array): Promise<void> {
    const mine = generation;
    set({ status: 'unlocking' });
    try {
      await vault.open(dek);
    } catch (error) {
      // A wrong key or a corrupt file is reported as unknown. Neither is retried automatically.
      set({
        status: 'error',
        error: error instanceof VaultNotEncryptedError ? 'notEncrypted' : 'unknown',
      });
      return;
    }
    if (mine !== generation) {
      await vault.close();
      return;
    }
    set({ status: 'unlocked' });
  }

  async function setUpFirstPhone(): Promise<void> {
    let device: Awaited<ReturnType<LockIdentity['currentDevice']>>;
    try {
      device = await identity.currentDevice();
    } catch {
      set({ status: 'error', error: 'offline' });
      return;
    }
    if (device?.status === 'pending') {
      // The restore from another phone arrives in a later PR.
      set({ status: 'pendingDevice' });
      return;
    }
    if (device?.status !== 'active') {
      // Not registered, unknown to the API or just removed: never make a key for it.
      set({ status: 'error', error: 'unknown' });
      return;
    }
    // First phone of the account. A later PR asks the server whether a recovery key already
    // exists and shows the recovery code here.
    let fresh: Uint8Array;
    try {
      // A left-over file cannot be read without its key.
      await vault.wipe();
      fresh = deps.newDek();
      await dekStore.write(fresh);
    } catch {
      set(keychainError);
      return;
    }
    await openWith(fresh);
  }

  async function run(): Promise<void> {
    set({ status: 'unlocking' });
    let dek: Uint8Array | null;
    try {
      dek = await dekStore.read();
    } catch {
      set(keychainError);
      return;
    }
    if (!dek) return setUpFirstPhone();
    if (isFreshLogin(identity.lastLoginAt(), clock.now())) return openWith(dek);
    set(LOCKED);
  }

  const controller: LockController = {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    unlock() {
      if (state.status === 'unlocked') return Promise.resolve();
      if (state.status === 'error' && state.error === 'notEncrypted') return Promise.resolve();
      inFlight ??= run().finally(() => {
        inFlight = null;
      });
      return inFlight;
    },
    async unlockWithPassword() {
      if (state.status === 'unlocking' || state.status === 'unlocked') return;
      const result = await identity.reauthenticate();
      if (result === 'cancelled') return;
      if (result === 'failed') {
        set({ status: 'locked', error: 'unknown' });
        return;
      }
      let dek: Uint8Array | null;
      try {
        dek = await dekStore.read();
      } catch {
        set(keychainError);
        return;
      }
      // No key: this phone is not set up yet, so the normal flow decides what to do.
      if (!dek) return controller.unlock();
      await openWith(dek);
    },
    async lock() {
      generation += 1;
      await vault.close();
      set(LOCKED);
    },
    start() {
      return identity.onSessionChange((session) => {
        if (session.status === 'signedOut') void controller.lock();
      });
    },
    appBackgrounded() {
      backgroundSince ??= deps.nowMs();
    },
    async appForegrounded() {
      const since = backgroundSince;
      backgroundSince = null;
      if (since !== null && state.status === 'unlocked' && shouldLock(since, deps.nowMs())) {
        await controller.lock();
      }
    },
    reset() {
      generation += 1;
      backgroundSince = null;
      set(LOCKED);
    },
  };
  return controller;
}
