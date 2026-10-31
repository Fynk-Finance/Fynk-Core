// "Generar un código nuevo": the fresh login gate, the new code and the commit on confirm.
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert, Text } from 'react-native';

import { ThemeProvider, type ThemePreference } from '@shared/ui';

import type { NewRecoveryCode } from '../application/lockController';
import type { PreparedRecoveryCode } from '../application/recoveryCode';
import { createNewRecoveryCodeScreen } from './NewRecoveryCodeScreen';
import { vaultStrings } from './strings.es-CO';

const t = vaultStrings.recovery;
const noStore = { load: async () => 'system' as const, save: async () => undefined };
const Stack = createNativeStackNavigator();

const Home = () => <Text testID="home">home</Text>;

async function open(
  prepareNewRecoveryCode: () => Promise<NewRecoveryCode>,
  preference: ThemePreference = 'light',
) {
  const copyText = jest.fn(async (_text: string) => true);
  const NewRecoveryCodeScreen = createNewRecoveryCodeScreen({
    controller: { prepareNewRecoveryCode },
    copyText,
  });
  const ref = createNavigationContainerRef();
  await render(
    <ThemeProvider initialPreference={preference} store={noStore}>
      <NavigationContainer ref={ref}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="home" component={Home} />
          <Stack.Screen name="vault.RecoveryCode" component={NewRecoveryCodeScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeProvider>,
  );
  // Pushed over Home, as the row of Seguridad does.
  await act(async () => ref.navigate('vault.RecoveryCode' as never));
  return { copyText };
}

function ready() {
  const commit = jest.fn(async () => undefined);
  const prepared: PreparedRecoveryCode = {
    groups: ['0A1B2', 'C3D4E', 'F5G6H', 'J7K8M', 'N9P0QR'],
    lastGroup: 'N9P0QR',
    commit,
  };
  const prepare = jest.fn(async (): Promise<NewRecoveryCode> => ({ status: 'ready', prepared }));
  return { prepare, commit };
}

let alert: jest.SpyInstance;
beforeEach(() => {
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

it('prepares the code once on open and shows it, with nothing uploaded yet', async () => {
  const { prepare, commit } = ready();
  await open(prepare);
  await waitFor(() =>
    expect(screen.getByTestId('vault.recovery.group.4')).toHaveTextContent('N9P0QR'),
  );
  expect(prepare).toHaveBeenCalledTimes(1);
  expect(commit).not.toHaveBeenCalled();
});

it('shows a preparing state while the password step and the key derivation run', async () => {
  let release!: (value: NewRecoveryCode) => void;
  const pending = new Promise<NewRecoveryCode>((resolve) => {
    release = resolve;
  });
  await open(() => pending);
  expect(screen.getByTestId('vault.recovery.preparing')).toBeOnTheScreen();
  expect(screen.getByText(t.newCode.preparing)).toBeOnTheScreen();
  const { prepare } = ready();
  const result = await prepare();
  await act(async () => release(result));
  expect(screen.queryByTestId('vault.recovery.preparing')).toBeNull();
});

it('commits and goes back when the last group is confirmed', async () => {
  const { prepare, commit } = ready();
  await open(prepare);
  await waitFor(() => expect(screen.getByTestId('vault.recovery')).toBeOnTheScreen());
  await fireEvent.press(screen.getByRole('button', { name: t.saved }));
  await fireEvent.changeText(screen.getByTestId('vault.recovery.confirmInput'), 'n9p0qr');
  await fireEvent.press(screen.getByRole('button', { name: t.confirm }));
  expect(commit).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(screen.queryByTestId('vault.recovery')).toBeNull());
  expect(screen.getByTestId('home')).toBeOnTheScreen();
});

it('stays on the screen and uploads nothing on a wrong last group', async () => {
  const { prepare, commit } = ready();
  await open(prepare);
  await waitFor(() => expect(screen.getByTestId('vault.recovery')).toBeOnTheScreen());
  await fireEvent.press(screen.getByRole('button', { name: t.saved }));
  await fireEvent.changeText(screen.getByTestId('vault.recovery.confirmInput'), 'ZZZZZZ');
  await fireEvent.press(screen.getByRole('button', { name: t.confirm }));
  expect(screen.getByText(t.errors.mismatch)).toBeOnTheScreen();
  expect(commit).not.toHaveBeenCalled();
  expect(screen.getByTestId('vault.recovery')).toBeOnTheScreen();
});

it('goes back, without a message, when the password step is cancelled', async () => {
  await open(async () => ({ status: 'cancelled' }));
  await waitFor(() => expect(screen.queryByTestId('vault.recovery.preparing')).toBeNull());
  expect(alert).not.toHaveBeenCalled();
  expect(screen.queryByTestId('vault.recovery')).toBeNull();
});

it('goes back and says so when the code cannot be prepared', async () => {
  await open(async () => ({ status: 'failed' }));
  await waitFor(() =>
    expect(alert).toHaveBeenCalledWith(t.newCode.failedTitle, t.newCode.failedMessage),
  );
  expect(screen.queryByTestId('vault.recovery.preparing')).toBeNull();
});

it('closes with the close button and uploads nothing', async () => {
  const { prepare, commit } = ready();
  await open(prepare);
  await waitFor(() => expect(screen.getByTestId('vault.recovery')).toBeOnTheScreen());
  await fireEvent.press(screen.getByRole('button', { name: t.close }));
  await waitFor(() => expect(screen.queryByTestId('vault.recovery')).toBeNull());
  expect(commit).not.toHaveBeenCalled();
});

it.each(['light', 'dark'] as const)('draws in the %s theme', async (preference) => {
  const { prepare } = ready();
  await open(prepare, preference);
  await waitFor(() => expect(screen.getByTestId('vault.recovery.card')).toBeOnTheScreen());
});
