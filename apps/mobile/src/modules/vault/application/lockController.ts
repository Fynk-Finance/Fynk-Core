// Lock states of the vault: who may open it and when. No React here; the UI subscribes.
// Opening needs the DEK (Keychain copy A) AND a fresh Keycloak login, or the password again.
// Never log the DEK or anything about it.
import type { Clock } from '@shared/domain/types';

import { isFreshLogin, shouldLock } from '../domain/lockPolicy';
import { VaultNotEncryptedError, type BiometricPrompt, type DekStore } from './ports';
import type { Vault } from './vault';

export type LockError = 'notEncrypted' | 'keychain' | 'offline' | 'unknown';

/** Messages for the lock screen. `biometricsOff`: the phone's biometrics changed, copy B was deleted. */
export type LockNotice = 'biometricsOff' | 'biometricFailed';

export interface LockState {
  status: 'locked' | 'unlocking' | 'unlocked' | 'pendingDevice' | 'error';
  error?: LockError;
  /** Locked only: copy B exists and the phone has biometrics, so the button may show. */
  biometric?: boolean;
  notice?: LockNotice;
}

export type EnableBiometricsResult = 'enabled' | 'cancelled' | 'failed';

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
  /** Texts of the system biometric prompt. */
  biometricPrompt: BiometricPrompt;
}

export interface LockController {
  getState(): LockState;
  subscribe(listener: () => void): () => void;
  /** Opens the vault when the key and a fresh login allow it, or sets up the first phone. */
  unlock(): Promise<void>;
  /** Asks Keycloak for the password again, then opens. */
  unlockWithPassword(): Promise<void>;
  lock(): Promise<void>;
  /** Opens with copy B behind the system prompt. Cancel keeps it locked without an error. */
  unlockWithBiometrics(): Promise<void>;
  /** Opens the prompt once per lock, when copy B exists. The lock screen calls it on show. */
  autoPromptBiometric(): Promise<void>;
  /** The phone has biometrics and copy B exists. Never prompts. */
  biometricStatus(): Promise<{ supported: boolean; enabled: boolean }>;
  /** Turns biometrics on: needs a login of the last 5 minutes, else the password again first. */
  enableBiometrics(): Promise<EnableBiometricsResult>;
  /** Turns biometrics off by deleting copy B. */
  disableBiometrics(): Promise<void>;
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
  // The biometric prompt opens by itself once per lock, never in a loop.
  let autoPrompted = false;
  const listeners = new Set<() => void>();

  const set = (next: LockState) => {
    state = next;
    listeners.forEach((l) => l());
  };

  async function biometricReady(): Promise<boolean> {
    try {
      return (await dekStore.biometricsAvailable()) && (await dekStore.hasBiometric());
    } catch {
      return false;
    }
  }

  async function locked(notice?: LockNotice): Promise<LockState> {
    const biometric = await biometricReady();
    return { status: 'locked', ...(biometric && { biometric }), ...(notice && { notice }) };
  }

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
    set(await locked());
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
        set({ status: 'locked', error: 'unknown', biometric: state.biometric });
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
    async unlockWithBiometrics() {
      if (state.status === 'unlocking' || state.status === 'unlocked') return;
      set({ status: 'unlocking' });
      const result = await dekStore.readBiometric(deps.biometricPrompt);
      if (result.status === 'ok') return openWith(result.dek);
      if (result.status === 'invalidated') {
        // Never readable again: delete it so the setting reads off and the password is needed.
        try {
          await dekStore.removeBiometric();
        } catch {
          // The next read reports the same and tries again.
        }
        set(await locked('biometricsOff'));
        return;
      }
      set(await locked(result.status === 'failed' ? 'biometricFailed' : undefined));
    },
    async autoPromptBiometric() {
      if (inFlight) await inFlight;
      if (autoPrompted || state.status !== 'locked' || !state.biometric) return;
      autoPrompted = true;
      await controller.unlockWithBiometrics();
    },
    async biometricStatus() {
      const supported = await dekStore.biometricsAvailable().catch(() => false);
      const enabled = supported && (await dekStore.hasBiometric().catch(() => false));
      return { supported, enabled };
    },
    async enableBiometrics() {
      if (!(await dekStore.biometricsAvailable().catch(() => false))) return 'failed';
      if (!isFreshLogin(identity.lastLoginAt(), clock.now())) {
        const result = await identity.reauthenticate();
        if (result !== 'ok') return result === 'cancelled' ? 'cancelled' : 'failed';
      }
      try {
        const dek = await dekStore.read();
        if (!dek) return 'failed';
        const written = await dekStore.writeBiometric(dek, deps.biometricPrompt);
        return written === 'ok' ? 'enabled' : 'cancelled';
      } catch {
        return 'failed';
      }
    },
    async disableBiometrics() {
      await dekStore.removeBiometric();
    },
    async lock() {
      generation += 1;
      const mine = generation;
      autoPrompted = false;
      await vault.close();
      // Locked at once; the button is added when the copy B lookup answers.
      set(LOCKED);
      const next = await locked();
      if (next.biometric && state === LOCKED && mine === generation) set(next);
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
      autoPrompted = false;
      backgroundSince = null;
      set(LOCKED);
    },
  };
  return controller;
}
