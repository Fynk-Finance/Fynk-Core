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
    confirmRecoveryCode: jest.fn(async () => 'ok' as const),
    restoreWithCode: jest.fn(async () => 'restored' as const),
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
  const Flow = createVaultFlow(controller, {
    copyText: jest.fn(async () => undefined),
    signOut: jest.fn(),
  });
  await render(<Flow />);
  await fireEvent.press(screen.getByRole('button', { name: t.password }));
  expect(controller.unlockWithPassword).toHaveBeenCalledTimes(1);
});

it('follows the controller state', async () => {
  const { controller, set } = fakeController();
  const Flow = createVaultFlow(controller, {
    copyText: jest.fn(async () => undefined),
    signOut: jest.fn(),
  });
  await render(<Flow />);

  await set({ status: 'unlocking' });
  expect(screen.getByTestId('vault.lock.unlocking')).toBeOnTheScreen();

  await set({ status: 'pendingDevice' });
  expect(screen.getByTestId('vault.restore')).toBeOnTheScreen();

  await set({ status: 'restoring' });
  expect(screen.getByText(vaultStrings.restore.restoring)).toBeOnTheScreen();

  await set({ status: 'error', error: 'offline' });
  expect(screen.getByText(t.errors.offline)).toBeOnTheScreen();
});

it('retries the unlock from the error state', async () => {
  const { controller } = fakeController({ status: 'error', error: 'offline' });
  const Flow = createVaultFlow(controller, {
    copyText: jest.fn(async () => undefined),
    signOut: jest.fn(),
  });
  await render(<Flow />);
  await fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
  expect(controller.unlock).toHaveBeenCalledTimes(1);
});

it('opens the biometric prompt once when it shows, and again from the button', async () => {
  const { controller } = fakeController({ status: 'locked', biometric: true });
  const Flow = createVaultFlow(controller, {
    copyText: jest.fn(async () => undefined),
    signOut: jest.fn(),
  });
  await render(<Flow />);
  expect(controller.autoPromptBiometric).toHaveBeenCalledTimes(1);
  expect(controller.unlockWithBiometrics).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: vaultStrings.lock.biometric }));
  expect(controller.unlockWithBiometrics).toHaveBeenCalledTimes(1);
});

it('opens the prompt when the button arrives after the lock, not before', async () => {
  // lock() shows `locked` at once and adds the button when the copy B lookup answers.
  const { controller, set } = fakeController({ status: 'unlocked' });
  const Flow = createVaultFlow(controller, {
    copyText: jest.fn(async () => undefined),
    signOut: jest.fn(),
  });
  await render(<Flow />);
  await set({ status: 'locked' });
  expect(controller.autoPromptBiometric).not.toHaveBeenCalled();
  await set({ status: 'locked', biometric: true });
  expect(controller.autoPromptBiometric).toHaveBeenCalledTimes(1);
});

describe('recovery code', () => {
  const recovery = { groups: ['0A1B2', 'C3D4E', 'F5G6H', 'J7K8M', 'N9P0QR'] };
  const r = vaultStrings.recovery;

  it('shows the recovery code screen instead of the lock screen', async () => {
    const { controller } = fakeController({ status: 'recoveryCode', recovery });
    const Flow = createVaultFlow(controller, {
      copyText: jest.fn(async () => true),
      signOut: jest.fn(),
    });
    await render(<Flow />);
    expect(screen.getByRole('header', { name: r.title })).toBeOnTheScreen();
    expect(screen.getByTestId('vault.recovery.group.0')).toHaveTextContent('0A1B2');
    expect(screen.queryByTestId('vault.lock')).toBeNull();
  });

  it('confirms through the controller and copies through the clipboard', async () => {
    const { controller } = fakeController({ status: 'recoveryCode', recovery });
    const copyText = jest.fn(async (_text: string) => true);
    const Flow = createVaultFlow(controller, { copyText, signOut: jest.fn() });
    await render(<Flow />);
    await fireEvent.press(screen.getByRole('button', { name: r.copy }));
    expect(copyText).toHaveBeenCalledWith('0A1B2 C3D4E F5G6H J7K8M N9P0QR');
    await fireEvent.press(screen.getByRole('button', { name: r.saved }));
    await fireEvent.changeText(screen.getByTestId('vault.recovery.confirmInput'), 'N9P0QR');
    await fireEvent.press(screen.getByRole('button', { name: r.confirm }));
    expect(controller.confirmRecoveryCode).toHaveBeenCalledWith('N9P0QR');
  });

  it('goes back to the lock screen when the state leaves recoveryCode', async () => {
    const { controller, set } = fakeController({ status: 'recoveryCode', recovery });
    const Flow = createVaultFlow(controller, {
      copyText: jest.fn(async () => true),
      signOut: jest.fn(),
    });
    await render(<Flow />);
    await set({ status: 'locked' });
    expect(screen.getByTestId('vault.lock')).toBeOnTheScreen();
  });
});

describe('restore on a new phone', () => {
  const r = vaultStrings.restore;
  const deps = (signOut = jest.fn(async () => undefined)) => ({
    copyText: jest.fn(async () => true),
    signOut,
  });

  it('restores through the controller and signs out from the link', async () => {
    const { controller } = fakeController({ status: 'pendingDevice' });
    const signOut = jest.fn(async () => undefined);
    const Flow = createVaultFlow(controller, deps(signOut));
    await render(<Flow />);
    await fireEvent.press(screen.getByTestId('vault.restore.codeOption'));
    await fireEvent.changeText(screen.getByTestId('vault.restore.codeInput'), 'abcde fghjk');
    await fireEvent.press(screen.getByTestId('vault.restore.submit'));
    expect(controller.restoreWithCode).toHaveBeenCalledWith('abcde fghjk');
    await fireEvent.press(screen.getByRole('link', { name: r.signOut }));
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('shows the error of the last try', async () => {
    const { controller } = fakeController({ status: 'pendingDevice', restoreError: 'wrongCode' });
    const Flow = createVaultFlow(controller, deps());
    await render(<Flow />);
    await fireEvent.press(screen.getByTestId('vault.restore.codeOption'));
    await fireEvent.changeText(screen.getByTestId('vault.restore.codeInput'), 'x');
    await fireEvent.press(screen.getByTestId('vault.restore.submit'));
    expect(screen.getByTestId('vault.restore.error')).toHaveTextContent(r.errors.wrongCode);
  });
});
