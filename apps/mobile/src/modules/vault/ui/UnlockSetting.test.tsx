// UnlockSetting: the "Desbloqueo" card, built on a real lock controller with fake ports.
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { createFixedClock } from '@shared/testing';
import { ThemeProvider, useTheme, type ThemePreference } from '@shared/ui';

import { createLockController, type LockIdentity } from '../application/lockController';
import type { DekStore } from '../application/ports';
import { vaultStrings } from './strings.es-CO';
import { createUnlockSetting } from './UnlockSetting';

const t = vaultStrings.biometric;
const MIN = 60 * 1000;
const DEK = Uint8Array.from({ length: 32 }, (_, i) => i + 1);
const noStore = { load: async () => 'system' as const, save: async () => undefined };

function Probe() {
  const { colors } = useTheme();
  return <Text testID="probe.surface">{colors.surfaceBlue}</Text>;
}

async function renderSetting(
  options: {
    biometrics?: boolean;
    copyB?: boolean;
    loginAgoMs?: number | null;
    reauth?: 'ok' | 'cancelled' | 'failed';
    write?: 'ok' | 'cancelled' | Error;
    preference?: ThemePreference;
  } = {},
) {
  const clock = createFixedClock('2026-11-03T15:00:00Z');
  let copyB: Uint8Array | null = options.copyB ? DEK : null;
  const dekStore: DekStore = {
    read: jest.fn(async () => DEK),
    write: jest.fn(async () => undefined),
    remove: jest.fn(async () => undefined),
    removeAll: jest.fn(async () => undefined),
    biometricsAvailable: jest.fn(async () => options.biometrics ?? true),
    hasBiometric: jest.fn(async () => copyB !== null),
    writeBiometric: jest.fn(async (dek) => {
      if (options.write instanceof Error) throw options.write;
      if (options.write === 'cancelled') return 'cancelled';
      copyB = dek;
      return 'ok';
    }),
    readBiometric: jest.fn(async () => ({ status: 'invalidated' }) as const),
    removeBiometric: jest.fn(async () => {
      copyB = null;
    }),
  };
  const loginAgo = options.loginAgoMs === undefined ? 0 : options.loginAgoMs;
  const identity: LockIdentity = {
    lastLoginAt: () => (loginAgo === null ? null : new Date(clock.now().getTime() - loginAgo)),
    reauthenticate: jest.fn(async () => options.reauth ?? 'ok'),
    currentDevice: jest.fn(async () => ({ id: 'd1', status: 'active' as const })),
    onSessionChange: () => () => undefined,
  };
  const controller = createLockController({
    vault: { open: jest.fn(), close: jest.fn(), wipe: jest.fn() },
    dekStore,
    newDek: () => DEK,
    identity,
    clock,
    nowMs: () => 0,
    biometricPrompt: t.prompt,
    backupEnabled: () => true,
    recoveryKey: { get: jest.fn() },
    recoveryCode: { prepare: jest.fn() },
    restoreWithCode: { restore: jest.fn(), resumePending: jest.fn() },
    restoreWithApproval: { start: jest.fn(), check: jest.fn() },
    resetBackup: { reset: jest.fn() },
  });
  const UnlockSetting = createUnlockSetting(controller);
  await render(
    <ThemeProvider initialPreference={options.preference ?? 'light'} store={noStore}>
      <Probe />
      <UnlockSetting />
    </ThemeProvider>,
  );
  await act(async () => undefined);
  return { dekStore, identity, copyB: () => copyB };
}

const toggle = () => screen.getByRole('switch', { name: t.switchLabel });

it('is hidden on a phone without biometric hardware', async () => {
  await renderSetting({ biometrics: false });
  expect(screen.queryByTestId('vault.unlockSetting')).toBeNull();
  expect(screen.queryByRole('switch')).toBeNull();
});

it('shows the card of CfgSeguridad, off when copy B does not exist', async () => {
  await renderSetting();
  expect(screen.getByRole('header', { name: t.card })).toBeOnTheScreen();
  expect(screen.getByText(t.switchHint)).toBeOnTheScreen();
  expect(toggle().props.accessibilityState.checked).toBe(false);
});

it('reads on when copy B exists', async () => {
  await renderSetting({ copyB: true });
  expect(toggle().props.accessibilityState.checked).toBe(true);
});

it('turning on with a fresh login writes copy B without asking for the password', async () => {
  const t1 = await renderSetting({ loginAgoMs: 2 * MIN });
  await fireEvent.press(toggle());
  expect(t1.identity.reauthenticate).not.toHaveBeenCalled();
  expect(t1.copyB()).toEqual(DEK);
  expect(toggle().props.accessibilityState.checked).toBe(true);
});

it('turning on with a stale login asks for the password first, then writes', async () => {
  const t1 = await renderSetting({ loginAgoMs: 6 * MIN });
  await fireEvent.press(toggle());
  expect(t1.identity.reauthenticate).toHaveBeenCalledTimes(1);
  expect(t1.copyB()).toEqual(DEK);
  expect(toggle().props.accessibilityState.checked).toBe(true);
});

it.each(['cancelled', 'failed'] as const)(
  'writes nothing when the password step ends %s',
  async (reauth) => {
    const t1 = await renderSetting({ loginAgoMs: null, reauth });
    await fireEvent.press(toggle());
    expect(t1.dekStore.writeBiometric).not.toHaveBeenCalled();
    expect(toggle().props.accessibilityState.checked).toBe(false);
    expect(screen.queryByTestId('vault.unlockSetting.error') !== null).toBe(reauth === 'failed');
  },
);

it('says so when copy B could not be written, and stays off', async () => {
  await renderSetting({ write: new Error('x') });
  await fireEvent.press(toggle());
  expect(screen.getByText(t.failed)).toBeOnTheScreen();
  expect(toggle().props.accessibilityState.checked).toBe(false);
});

it('stays off without an error when the person cancels the prompt', async () => {
  await renderSetting({ write: 'cancelled' });
  await fireEvent.press(toggle());
  expect(screen.queryByTestId('vault.unlockSetting.error')).toBeNull();
  expect(toggle().props.accessibilityState.checked).toBe(false);
});

it('turning off removes copy B', async () => {
  const t1 = await renderSetting({ copyB: true });
  await fireEvent.press(toggle());
  expect(t1.copyB()).toBeNull();
  expect(toggle().props.accessibilityState.checked).toBe(false);
});

it.each(['light', 'dark'] as const)('draws in the %s theme', async (preference) => {
  await renderSetting({ preference });
  expect(screen.getByText(t.card)).toBeOnTheScreen();
  expect(toggle()).toBeOnTheScreen();
});

it('uses different surface colors in light and dark', async () => {
  await renderSetting({ preference: 'light' });
  const light = String(screen.getByTestId('probe.surface').props.children);
  await screen.unmount();
  await renderSetting({ preference: 'dark' });
  expect(String(screen.getByTestId('probe.surface').props.children)).not.toBe(light);
});
