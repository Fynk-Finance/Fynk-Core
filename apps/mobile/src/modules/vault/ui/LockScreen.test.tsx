// Lock screen: the Login header, the password button and every state, in light and dark.
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ThemeProvider, useTheme, type ThemePreference } from '@shared/ui';

import type { LockState } from '../application/lockController';
import { LockScreen } from './LockScreen';
import { vaultStrings } from './strings.es-CO';

const t = vaultStrings.lock;
const noStore = { load: async () => 'system' as const, save: async () => undefined };

function Probe() {
  const { colors } = useTheme();
  return (
    <>
      <Text testID="probe.primary">{colors.primary}</Text>
      <Text testID="probe.background">{colors.background}</Text>
    </>
  );
}

async function renderScreen(state: LockState, preference: ThemePreference = 'light') {
  const onPassword = jest.fn();
  const onBiometric = jest.fn();
  const onRetry = jest.fn();
  await render(
    <ThemeProvider initialPreference={preference} store={noStore}>
      <Probe />
      <LockScreen
        state={state}
        onPassword={onPassword}
        onBiometric={onBiometric}
        onRetry={onRetry}
      />
    </ThemeProvider>,
  );
  return { onPassword, onBiometric, onRetry };
}

const probe = (id: string) => String(screen.getByTestId(`probe.${id}`).props.children);

it('shows the Fynk logo, the title and the subtitle', async () => {
  await renderScreen({ status: 'locked' });
  expect(screen.getByLabelText('Fynk')).toBeOnTheScreen();
  expect(screen.getByRole('header', { name: t.title })).toBeOnTheScreen();
  expect(screen.getByText(t.subtitle)).toBeOnTheScreen();
});

it('asks for the password with an accessible button', async () => {
  const { onPassword } = await renderScreen({ status: 'locked' });
  const button = screen.getByRole('button', { name: t.password });
  expect(button.props.accessibilityHint).toBe(t.passwordHint);
  await fireEvent.press(button);
  expect(onPassword).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId('vault.lock.error')).toBeNull();
});

it('says the password could not be verified', async () => {
  await renderScreen({ status: 'locked', error: 'unknown' });
  expect(screen.getByText(t.passwordFailed)).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: t.password })).toBeOnTheScreen();
});

it('shows a spinner and no button while unlocking', async () => {
  await renderScreen({ status: 'unlocking' });
  expect(screen.getByLabelText(t.unlocking)).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: t.password })).toBeNull();
});

it('explains that this phone waits for approval', async () => {
  await renderScreen({ status: 'pendingDevice' });
  expect(screen.getByText(t.pendingTitle)).toBeOnTheScreen();
  expect(screen.getByText(t.pendingMessage)).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: t.password })).toBeNull();
});

it.each(['offline', 'keychain', 'unknown'] as const)(
  'shows the %s error with a retry button',
  async (error) => {
    const { onRetry } = await renderScreen({ status: 'error', error });
    expect(screen.getByText(t.errors[error])).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  },
);

it('shows the not encrypted error without a retry button', async () => {
  await renderScreen({ status: 'error', error: 'notEncrypted' });
  expect(screen.getByText(t.errors.notEncrypted)).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
});

it.each(['light', 'dark'] as const)('draws with the %s theme colors', async (preference) => {
  await renderScreen({ status: 'locked' }, preference);
  expect(screen.getByTestId('vault.lock')).toHaveStyle({ backgroundColor: probe('primary') });
  expect(screen.getByText(t.subtitle)).toBeOnTheScreen();
});

it('uses different background colors in light and dark', async () => {
  await renderScreen({ status: 'locked' }, 'light');
  const light = probe('background');
  await screen.unmount();
  await renderScreen({ status: 'locked' }, 'dark');
  expect(probe('background')).not.toBe(light);
});

describe('biometric button', () => {
  it('is not there without copy B', async () => {
    await renderScreen({ status: 'locked' });
    expect(screen.queryByRole('button', { name: t.biometric })).toBeNull();
    expect(screen.queryByText(t.orWith)).toBeNull();
  });

  it('shows next to the password button when copy B exists, and presses', async () => {
    const { onBiometric, onPassword } = await renderScreen({ status: 'locked', biometric: true });
    const button = screen.getByRole('button', { name: t.biometric });
    expect(button.props.accessibilityHint).toBe(t.biometricHint);
    expect(screen.getByRole('button', { name: t.password })).toBeOnTheScreen();
    await fireEvent.press(button);
    expect(onBiometric).toHaveBeenCalledTimes(1);
    expect(onPassword).not.toHaveBeenCalled();
  });

  it.each(['biometricsOff', 'biometricFailed'] as const)('shows the %s notice', async (notice) => {
    await renderScreen({ status: 'locked', notice });
    expect(screen.getByText(t.notices[notice])).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: t.password })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: t.biometric })).toBeNull();
  });

  it.each(['light', 'dark'] as const)('draws in the %s theme', async (preference) => {
    await renderScreen({ status: 'locked', biometric: true }, preference);
    expect(screen.getByTestId('vault.lock')).toHaveStyle({ backgroundColor: probe('primary') });
    expect(screen.getByRole('button', { name: t.biometric })).toBeOnTheScreen();
  });
});
