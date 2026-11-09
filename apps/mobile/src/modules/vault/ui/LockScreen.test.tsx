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
  const onUseOtherAccount = jest.fn();
  await render(
    <ThemeProvider initialPreference={preference} store={noStore}>
      <Probe />
      <LockScreen
        state={state}
        onPassword={onPassword}
        onBiometric={onBiometric}
        onRetry={onRetry}
        onUseOtherAccount={onUseOtherAccount}
      />
    </ThemeProvider>,
  );
  return { onPassword, onBiometric, onRetry, onUseOtherAccount };
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

describe('layout of Login.html', () => {
  it.each(['light', 'dark'] as const)(
    'fills the space below the header in the %s theme',
    async (preference) => {
      await renderScreen({ status: 'locked' }, preference);
      expect(screen.getByTestId('vault.lock.lime')).toHaveStyle({ flex: 1 });
      expect(screen.getByTestId('vault.lock.sheet')).toHaveStyle({
        flex: 1,
        paddingTop: 36,
        paddingHorizontal: 24,
      });
      expect(screen.getByTestId('vault.lock.otherAccount')).toHaveStyle({
        alignSelf: 'center',
        paddingTop: 16,
      });
    },
  );
});

describe('illustration', () => {
  const states: [string, LockState][] = [
    ['locked', { status: 'locked' }],
    ['unlocking', { status: 'unlocking' }],
    ['error', { status: 'error', error: 'unknown' }],
  ];

  it.each(
    (['light', 'dark'] as const).flatMap((preference) =>
      states.map(([name, state]) => [preference, name, state] as const),
    ),
  )('shows as an image in the %s theme when %s', async (preference, _name, state) => {
    await renderScreen(state, preference);
    expect(screen.getByRole('image', { name: t.illustration })).toBeOnTheScreen();
  });

  it('takes the free height and stretches to the sheet width', async () => {
    await renderScreen({ status: 'locked' });
    expect(screen.getByTestId('vault.lock.illustration')).toHaveStyle({
      flex: 1,
      alignSelf: 'stretch',
    });
  });
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

describe('use another account link', () => {
  it('shows when locked, with the hint, and presses', async () => {
    const { onUseOtherAccount } = await renderScreen({ status: 'locked' });
    const link = screen.getByRole('link', { name: t.useOtherAccount });
    expect(link.props.accessibilityHint).toBe(t.useOtherAccountHint);
    await fireEvent.press(link);
    expect(onUseOtherAccount).toHaveBeenCalledTimes(1);
  });

  it.each(['offline', 'keychain', 'notEncrypted', 'unknown'] as const)(
    'shows in the %s error state so a person is never stuck',
    async (error) => {
      const { onUseOtherAccount } = await renderScreen({ status: 'error', error });
      await fireEvent.press(screen.getByTestId('vault.lock.otherAccount'));
      expect(onUseOtherAccount).toHaveBeenCalledTimes(1);
    },
  );

  it('is hidden while unlocking', async () => {
    await renderScreen({ status: 'unlocking' });
    expect(screen.queryByTestId('vault.lock.otherAccount')).toBeNull();
  });

  it.each(['light', 'dark'] as const)('renders in the %s theme', async (preference) => {
    await renderScreen({ status: 'locked' }, preference);
    expect(screen.getByRole('link', { name: t.useOtherAccount })).toBeOnTheScreen();
  });
});

it('explains an account change without saying the password failed', async () => {
  await renderScreen({ status: 'locked', notice: 'otherAccount' });
  expect(screen.getByText(t.notices.otherAccount)).toBeOnTheScreen();
  expect(screen.queryByText(t.passwordFailed)).toBeNull();
});
