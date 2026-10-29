// Mi cuenta: header, basic information, the module's rows, navigation, sign out, both themes.
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert, Text } from 'react-native';

import { ApiError } from '@shared/api';
import { APPEARANCE_ROUTE } from '@shared/navigation';
import { ThemeProvider, useTheme, uiStrings, type ThemePreference } from '@shared/ui';

import type { ProfilePort } from '../application/ports';
import type { Profile } from '../domain/profile';
import { createMiCuentaScreen } from './MiCuentaScreen';
import { identityStrings } from './strings.es-CO';

const t = identityStrings.miCuenta;
const noStore = { load: async () => 'system' as const, save: async () => undefined };

const profile: Profile = {
  id: 'sub-1',
  email: 'la•••@correo.com',
  firstName: 'Laura',
  lastName: 'Gómez',
  emailVerified: true,
  createdAt: '2026-11-01T03:00:00Z',
};

// The primary color of the active theme, read the way the app reads it.
function ProbeColors() {
  const { colors } = useTheme();
  return (
    <>
      <Text testID="probe.primary">{colors.primary}</Text>
      <Text testID="probe.background">{colors.background}</Text>
    </>
  );
}

const Stack = createNativeStackNavigator();

async function renderScreen(
  getProfile: ProfilePort['getProfile'],
  preference: ThemePreference = 'light',
) {
  const signOut = jest.fn(async () => undefined);
  const MiCuenta = createMiCuentaScreen({ profile: { getProfile }, signOut });
  const client = new QueryClient({
    defaultOptions: { queries: { retryDelay: 0, gcTime: Infinity } },
  });
  const Target = ({ route }: { route: { name: string } }) => <Text>{`arrived:${route.name}`}</Text>;
  await render(
    <ThemeProvider initialPreference={preference} store={noStore}>
      <QueryClientProvider client={client}>
        <ProbeColors />
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="identity.Account" component={MiCuenta} />
            <Stack.Screen name="identity.Security" component={Target} />
            <Stack.Screen name={APPEARANCE_ROUTE} component={Target} />
          </Stack.Navigator>
        </NavigationContainer>
      </QueryClientProvider>
    </ThemeProvider>,
  );
  await flush();
  return { signOut };
}

// Waits until the query leaves the loading state.
const flush = () => waitFor(() => expect(screen.queryByLabelText(uiStrings.loading)).toBeNull());

afterEach(() => jest.restoreAllMocks());

it('shows the name, the masked email, the member month and the verified pill', async () => {
  await renderScreen(async () => profile);
  expect(screen.getByText('Laura Gómez')).toBeOnTheScreen();
  expect(screen.getByText('LG')).toBeOnTheScreen();
  expect(screen.getByText('la•••@correo.com')).toBeOnTheScreen();
  // 03:00 UTC on 1 November is still October in Bogota.
  expect(screen.getByText('octubre de 2026')).toBeOnTheScreen();
  expect(screen.getByLabelText(t.verifiedHint)).toBeOnTheScreen();
  expect(screen.getByText(t.verified)).toBeOnTheScreen();
});

it('hides the pill when the email is not verified', async () => {
  await renderScreen(async () => ({ ...profile, emailVerified: false }));
  expect(screen.queryByText(t.verified)).toBeNull();
});

it('uses a neutral name and avatar when the profile has no name', async () => {
  await renderScreen(async () => ({ ...profile, firstName: undefined, lastName: undefined }));
  expect(screen.getByText(t.fallbackName)).toBeOnTheScreen();
  expect(screen.queryByText('LA')).toBeNull();
  expect(screen.getByTestId('identity.miCuenta.avatar')).toBeOnTheScreen();
});

it('lists Seguridad, Apariencia and Cerrar sesión in that order', async () => {
  await renderScreen(async () => profile);
  const ids = screen
    .getAllByTestId(/^identity\.miCuenta\.row\./)
    .map((row) => row.props.testID as string);
  expect(ids).toEqual([
    'identity.miCuenta.row.security',
    'identity.miCuenta.row.appearance',
    'identity.miCuenta.row.signOut',
  ]);
  expect(screen.getByRole('button', { name: /^Seguridad\./ })).toBeOnTheScreen();
  expect(screen.queryByText('Notificaciones')).toBeNull();
});

it('opens Seguridad', async () => {
  await renderScreen(async () => profile);
  await fireEvent.press(screen.getByRole('button', { name: /^Seguridad\./ }));
  expect(await screen.findByText('arrived:identity.Security')).toBeOnTheScreen();
});

it('opens Apariencia', async () => {
  await renderScreen(async () => profile);
  await fireEvent.press(screen.getByRole('button', { name: /^Apariencia\./ }));
  expect(await screen.findByText(`arrived:${APPEARANCE_ROUTE}`)).toBeOnTheScreen();
});

it('asks before signing out and signs out only on confirm', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const { signOut } = await renderScreen(async () => profile);

  await fireEvent.press(screen.getByRole('button', { name: /^Cerrar sesión\./ }));
  expect(alert).toHaveBeenCalledTimes(1);
  expect(signOut).not.toHaveBeenCalled();

  const buttons = alert.mock.calls[0]?.[2] ?? [];
  buttons.find((b) => b.style === 'cancel')?.onPress?.();
  expect(signOut).not.toHaveBeenCalled();

  buttons.find((b) => b.style === 'destructive')?.onPress?.();
  expect(signOut).toHaveBeenCalledTimes(1);
});

it('signs out when the account no longer exists', async () => {
  const { signOut } = await renderScreen(async () => {
    throw new ApiError({ status: 404, code: 'profile_not_found', title: 'Profile not found' });
  });
  expect(signOut).toHaveBeenCalledTimes(1);
});

it('shows an error with retry when the profile service is down', async () => {
  const down = new ApiError({ status: 503, code: 'identity_admin_unavailable', title: 'down' });
  // The hook tries twice before it shows the error.
  const getProfile = jest
    .fn<Promise<Profile>, []>()
    .mockRejectedValueOnce(down)
    .mockRejectedValueOnce(down)
    .mockResolvedValue(profile);
  const { signOut } = await renderScreen(getProfile);
  expect(screen.getByText(t.retryFailed)).toBeOnTheScreen();
  expect(signOut).not.toHaveBeenCalled();

  await fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
  expect(await screen.findByText('Laura Gómez')).toBeOnTheScreen();
});

const probe = (id: string) => String(screen.getByTestId(`probe.${id}`).props.children);

it.each(['light', 'dark'] as const)('renders in %s with the theme colors', async (preference) => {
  await renderScreen(async () => profile, preference);
  expect(screen.getByText('LG')).toHaveStyle({ color: probe('primary') });
  expect(screen.getByText(t.basicInfo)).toBeOnTheScreen();
});

it('uses different colors in light and dark', async () => {
  await renderScreen(async () => profile, 'light');
  const light = probe('background');
  await screen.unmount();
  await renderScreen(async () => profile, 'dark');
  expect(probe('background')).not.toBe(light);
});
