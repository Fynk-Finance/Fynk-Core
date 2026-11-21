// The vault gate: closed without a session, open while the vault is locked, closed once unlocked.
import { act, renderHook } from '@testing-library/react-native';

import type { LockController, LockState } from '../application/lockController';
import { createUseVaultGate } from './useVaultGate';

function setup(sessionStatus: string) {
  let lock: LockState = { status: 'locked' };
  const listeners = new Set<() => void>();
  const stopSession = jest.fn();
  const stopAppState = jest.fn();
  const controller = {
    getState: () => lock,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    unlock: jest.fn(async () => undefined),
    start: jest.fn(() => stopSession),
  } as unknown as LockController;
  const watchAppState = jest.fn(() => stopAppState);
  let session = sessionStatus;
  const useVaultGate = createUseVaultGate({
    controller,
    useSession: () => ({ status: session }),
    watchAppState,
  });
  const setLock = (next: LockState) =>
    act(async () => {
      lock = next;
      listeners.forEach((l) => l());
    });
  return {
    controller,
    useVaultGate,
    watchAppState,
    stopSession,
    stopAppState,
    setLock,
    setSession: (next: string) => {
      session = next;
    },
  };
}

it('is closed and does not unlock while signed out or restoring', async () => {
  const t = setup('signedOut');
  const { result, rerender } = await renderHook(() => t.useVaultGate());
  expect(result.current).toBe(false);
  t.setSession('restoring');
  await rerender({});
  expect(result.current).toBe(false);
  expect(t.controller.unlock).not.toHaveBeenCalled();
});

it('is open while locked and starts one unlock when the session is signed in', async () => {
  const t = setup('signedIn');
  const { result, rerender } = await renderHook(() => t.useVaultGate());
  expect(result.current).toBe(true);
  await rerender({});
  expect(t.controller.unlock).toHaveBeenCalledTimes(1);
});

it('stays open in the unlocking, pending, recovery code and error states', async () => {
  const t = setup('signedIn');
  const { result } = await renderHook(() => t.useVaultGate());
  for (const state of [
    { status: 'unlocking' },
    { status: 'pendingDevice' },
    // The vault is already open while the recovery code is shown, but the flow must stay up.
    {
      status: 'recoveryCode',
      recovery: { groups: ['AAAAA', 'BBBBB', 'CCCCC', 'DDDDD', 'EEEEEE'] },
    },
    { status: 'error', error: 'offline' },
  ] as LockState[]) {
    await t.setLock(state);
    expect(result.current).toBe(true);
  }
});

it('closes once the vault is unlocked and opens again when it locks', async () => {
  const t = setup('signedIn');
  const { result } = await renderHook(() => t.useVaultGate());
  await t.setLock({ status: 'unlocked' });
  expect(result.current).toBe(false);
  await t.setLock({ status: 'locked' });
  expect(result.current).toBe(true);
});

it('unlocks again after a new sign in', async () => {
  const t = setup('signedOut');
  const { rerender } = await renderHook(() => t.useVaultGate());
  t.setSession('signedIn');
  await rerender({});
  expect(t.controller.unlock).toHaveBeenCalledTimes(1);
});

it('watches sign out and the app state, and stops on unmount', async () => {
  const t = setup('signedIn');
  const { unmount } = await renderHook(() => t.useVaultGate());
  expect(t.controller.start).toHaveBeenCalledTimes(1);
  expect(t.watchAppState).toHaveBeenCalledWith(t.controller);
  await unmount();
  expect(t.stopSession).toHaveBeenCalledTimes(1);
  expect(t.stopAppState).toHaveBeenCalledTimes(1);
});
