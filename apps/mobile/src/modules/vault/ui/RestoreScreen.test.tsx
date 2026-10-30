// Restore screen: every state, in light and dark.
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ThemeProvider, useTheme, type ThemePreference } from '@shared/ui';

import type { RestoreFailure } from '../application/restoreWithCode';
import { RestoreScreen } from './RestoreScreen';
import { vaultStrings } from './strings.es-CO';

const t = vaultStrings.restore;
const noStore = { load: async () => 'system' as const, save: async () => undefined };

function Probe() {
  const { colors } = useTheme();
  return <Text testID="probe.background">{colors.background}</Text>;
}

async function renderScreen(
  props: { restoring?: boolean; error?: RestoreFailure } = {},
  preference: ThemePreference = 'light',
) {
  const onRestore = jest.fn();
  const onSignOut = jest.fn();
  await render(
    <ThemeProvider initialPreference={preference} store={noStore}>
      <Probe />
      <RestoreScreen
        restoring={props.restoring ?? false}
        error={props.error}
        onRestore={onRestore}
        onSignOut={onSignOut}
      />
    </ThemeProvider>,
  );
  return { onRestore, onSignOut };
}

const openCode = async () => fireEvent.press(screen.getByTestId('vault.restore.codeOption'));
const submitWith = async (text: string) => {
  await fireEvent.changeText(screen.getByTestId('vault.restore.codeInput'), text);
  await fireEvent.press(screen.getByTestId('vault.restore.submit'));
};

describe.each(['light', 'dark'] as const)('in %s', (theme) => {
  it('shows the title, the text, the code option and the sign out link', async () => {
    await renderScreen({}, theme);
    expect(screen.getByRole('header', { name: t.title })).toBeOnTheScreen();
    expect(screen.getByText(t.message)).toBeOnTheScreen();
    expect(screen.getByText(t.codeOption)).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: t.signOut })).toBeOnTheScreen();
    // The input waits for the option. The other two options arrive in the next branch.
    expect(screen.queryByTestId('vault.restore.codeInput')).toBeNull();
    expect(screen.queryByText('Aprobar desde mi otro teléfono')).toBeNull();
    expect(screen.queryByText('No tengo ninguno de los dos')).toBeNull();
  });

  it('opens the input with the code settings and sends what was typed', async () => {
    const { onRestore } = await renderScreen({}, theme);
    await openCode();
    const input = screen.getByTestId('vault.restore.codeInput');
    expect(input.props.autoCapitalize).toBe('characters');
    expect(input.props.autoCorrect).toBe(false);
    expect(input.props.accessibilityLabel).toBe(t.inputLabel);
    // Empty: nothing to send.
    await fireEvent.press(screen.getByTestId('vault.restore.submit'));
    expect(onRestore).not.toHaveBeenCalled();
    await submitWith('abcde fghjk');
    expect(onRestore).toHaveBeenCalledWith('abcde fghjk');
  });

  it.each(['invalid', 'wrongCode', 'tooMany', 'noBackup', 'removed', 'offline', 'failed'] as const)(
    'shows the %s error under the input',
    async (error) => {
      await renderScreen({ error }, theme);
      await openCode();
      await submitWith('x');
      expect(screen.getByTestId('vault.restore.error')).toHaveTextContent(t.errors[error]);
    },
  );

  it('clears the error when the code is edited', async () => {
    await renderScreen({ error: 'wrongCode' }, theme);
    await openCode();
    await submitWith('x');
    expect(screen.getByTestId('vault.restore.error')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId('vault.restore.codeInput'), 'xy');
    expect(screen.queryByTestId('vault.restore.error')).toBeNull();
  });

  it('shows the spinner and no form while restoring', async () => {
    const { onSignOut } = await renderScreen({ restoring: true }, theme);
    expect(screen.getByText(t.restoring)).toBeOnTheScreen();
    expect(screen.getByLabelText(t.restoring)).toBeOnTheScreen();
    expect(screen.queryByTestId('vault.restore.codeOption')).toBeNull();
    expect(screen.queryByTestId('vault.restore.submit')).toBeNull();
    await fireEvent.press(screen.getByTestId('vault.restore.signOut'));
    expect(onSignOut).not.toHaveBeenCalled();
  });

  it('signs out from the link', async () => {
    const { onSignOut } = await renderScreen({}, theme);
    await fireEvent.press(screen.getByRole('link', { name: t.signOut }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });
});

it('uses a different background in dark than in light', async () => {
  await renderScreen({}, 'light');
  const light = String(screen.getByTestId('probe.background').props.children);
  await screen.unmount();
  await renderScreen({}, 'dark');
  expect(String(screen.getByTestId('probe.background').props.children)).not.toBe(light);
});
