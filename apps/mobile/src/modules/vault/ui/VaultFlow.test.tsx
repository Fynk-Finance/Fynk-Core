// VaultFlow: the lock screen driven by the lock controller.
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import type { LockController, LockState } from '../application/lockController';
import { vaultStrings } from './strings.es-CO';
import { createVaultFlow } from './VaultFlow';

const t = vaultStrings.lock;

function fakeController(initial: LockState = { status: 'locked' }) {
  let state = initial;
  const listeners = new Set<() => void>();
  const controller = {
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    unlock: jest.fn(async () => undefined),
    unlockWithPassword: jest.fn(async () => undefined),
    unlockWithBiometrics: jest.fn(async () => undefined),
    autoPromptBiometric: jest.fn(async () => undefined),
  } as unknown as LockController;
  const set = (next: LockState) =>
    act(async () => {
      state = next;
      listeners.forEach((l) => l());
    });
  return { controller, set };
}

it('asks Keycloak for the password when the button is pressed', async () => {
  const { controller } = fakeController();
  const Flow = createVaultFlow(controller);
  await render(<Flow />);
  await fireEvent.press(screen.getByRole('button', { name: t.password }));
  expect(controller.unlockWithPassword).toHaveBeenCalledTimes(1);
});

it('follows the controller state', async () => {
  const { controller, set } = fakeController();
  const Flow = createVaultFlow(controller);
  await render(<Flow />);

  await set({ status: 'unlocking' });
  expect(screen.getByTestId('vault.lock.unlocking')).toBeOnTheScreen();

  await set({ status: 'pendingDevice' });
  expect(screen.getByText(t.pendingTitle)).toBeOnTheScreen();

  await set({ status: 'error', error: 'offline' });
  expect(screen.getByText(t.errors.offline)).toBeOnTheScreen();
});

it('retries the unlock from the error state', async () => {
  const { controller } = fakeController({ status: 'error', error: 'offline' });
  const Flow = createVaultFlow(controller);
  await render(<Flow />);
  await fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
  expect(controller.unlock).toHaveBeenCalledTimes(1);
});

it('opens the biometric prompt once when it shows, and again from the button', async () => {
  const { controller } = fakeController({ status: 'locked', biometric: true });
  const Flow = createVaultFlow(controller);
  await render(<Flow />);
  expect(controller.autoPromptBiometric).toHaveBeenCalledTimes(1);
  expect(controller.unlockWithBiometrics).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: vaultStrings.lock.biometric }));
  expect(controller.unlockWithBiometrics).toHaveBeenCalledTimes(1);
});

it('opens the prompt when the button arrives after the lock, not before', async () => {
  // lock() shows `locked` at once and adds the button when the copy B lookup answers.
  const { controller, set } = fakeController({ status: 'unlocked' });
  const Flow = createVaultFlow(controller);
  await render(<Flow />);
  await set({ status: 'locked' });
  expect(controller.autoPromptBiometric).not.toHaveBeenCalled();
  await set({ status: 'locked', biometric: true });
  expect(controller.autoPromptBiometric).toHaveBeenCalledTimes(1);
});
