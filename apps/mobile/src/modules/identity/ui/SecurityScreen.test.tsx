// Seguridad: change password, linked devices, close sessions, both themes.
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert, Text } from 'react-native';

import { ThemeProvider, useTheme, uiStrings, type ThemePreference } from '@shared/ui';
import { createFixedClock } from '@shared/testing';

import type { LinkedDeviceItem } from '../domain/deviceList';
import type { Profile } from '../domain/profile';
import { DevicesError, type LinkedDevicesApiPort } from '../application/ports';
import type { ChangePasswordResult } from '../application/sessionService';
import { createSecurityScreen } from './SecurityScreen';
import { identityStrings } from './strings.es-CO';

const t = identityStrings.security;
const noStore = { load: async () => 'system' as const, save: async () => undefined };

const NOW = '2026-10-27T15:00:00Z';
const ago = (days: number) => new Date(Date.parse(NOW) - days * 86_400_000).toISOString();

const profile: Profile = {
  id: 'sub-1',
  email: 'la•••@correo.com',
  emailVerified: true,
  createdAt: '2026-01-01T00:00:00Z',
  passwordUpdatedAt: ago(90),
};

const thisPhone: LinkedDeviceItem = {
  id: 'dev-this',
  name: 'iPhone 15',
  platform: 'ios',
  status: 'active',
  current: true,
  lastSeenAt: NOW,
};
const tablet: LinkedDeviceItem = {
  id: 'dev-tab',
  name: 'Galaxy Tab S9',
  platform: 'android',
  status: 'active',
  current: false,
  lastSeenAt: ago(21),
};
const pendingPhone: LinkedDeviceItem = {
  id: 'dev-pending',
  name: 'Pixel 8',
  platform: 'android',
  status: 'pending',
  current: false,
  lastSeenAt: ago(2),
};

function ProbeColors() {
  const { colors } = useTheme();
  return <Text testID="probe.background">{colors.background}</Text>;
}

const Stack = createNativeStackNavigator();

interface Options {
  profile?: () => Promise<Profile>;
  list?: LinkedDevicesApiPort['list'];
  remove?: LinkedDevicesApiPort['remove'];
  signOutOthers?: LinkedDevicesApiPort['signOutOthers'];
  changePassword?: () => Promise<ChangePasswordResult>;
  preference?: ThemePreference;
}

async function renderScreen(options: Options = {}) {
  const devices = {
    list: jest.fn(options.list ?? (async () => [thisPhone, tablet])),
    remove: jest.fn(options.remove ?? (async () => undefined)),
    signOutOthers: jest.fn(options.signOutOthers ?? (async () => undefined)),
  };
  const getProfile = jest.fn(options.profile ?? (async () => profile));
  const changePassword = jest.fn(options.changePassword ?? (async () => 'changed' as const));
  const sync = jest.fn(async () => undefined);
  const signOut = jest.fn(async () => undefined);
  const Security = createSecurityScreen({
    profile: { getProfile },
    devices,
    clock: createFixedClock(NOW),
    changePassword,
    deviceId: () => 'dev-this',
    sync,
    signOut,
  });
  const client = new QueryClient({
    defaultOptions: {
      queries: { retryDelay: 0, gcTime: Infinity },
      mutations: { gcTime: Infinity },
    },
  });
  await render(
    <ThemeProvider initialPreference={options.preference ?? 'light'} store={noStore}>
      <QueryClientProvider client={client}>
        <ProbeColors />
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="identity.Security" component={Security} />
          </Stack.Navigator>
        </NavigationContainer>
      </QueryClientProvider>
    </ThemeProvider>,
  );
  await waitFor(() => expect(screen.queryByLabelText(uiStrings.loading)).toBeNull());
  return { devices, getProfile, changePassword, sync, signOut };
}

// Lets a refetch that is still settling finish inside act.
afterEach(async () => {
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
  jest.restoreAllMocks();
});

const spyAlert = () => jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
const alertButtons = (alert: jest.SpyInstance, style: string) =>
  (alert.mock.calls[0]?.[2] ?? []).find((b: { style?: string }) => b.style === style);

it('shows the header, the password row with its age and the device section', async () => {
  await renderScreen();
  expect(screen.getByText(t.title)).toBeOnTheScreen();
  expect(screen.getByText(t.subtitle)).toBeOnTheScreen();
  expect(screen.getByText(t.password)).toBeOnTheScreen();
  expect(screen.getByText(t.changePassword)).toBeOnTheScreen();
  expect(screen.getByText('Actualizada hace 3 meses')).toBeOnTheScreen();
  expect(screen.getByText(t.devices)).toBeOnTheScreen();
  expect(screen.getByText('2 sesiones')).toBeOnTheScreen();
  expect(screen.getByText(t.footer)).toBeOnTheScreen();
  // M2 draws "Desbloqueo"; this screen does not.
  expect(screen.queryByText('Desbloqueo')).toBeNull();
});

it('shows no age when the profile has no passwordUpdatedAt', async () => {
  await renderScreen({ profile: async () => ({ ...profile, passwordUpdatedAt: undefined }) });
  expect(screen.getByText(t.changePassword)).toBeOnTheScreen();
  expect(screen.queryByText(/^Actualizada/)).toBeNull();
});

it('lists this phone first with its badge and without Cerrar, and no place', async () => {
  await renderScreen({ list: async () => [tablet, thisPhone] });
  const ids = screen
    .getAllByTestId(/^identity\.security\.device\.[^.]+$/)
    .map((row) => row.props.testID as string);
  expect(ids).toEqual(['identity.security.device.dev-this', 'identity.security.device.dev-tab']);
  expect(screen.getByText(t.thisDevice)).toBeOnTheScreen();
  expect(screen.getByText(t.activeNow)).toBeOnTheScreen();
  expect(screen.getByText('Hace 3 semanas')).toBeOnTheScreen();
  expect(screen.queryByTestId('identity.security.device.dev-this.close')).toBeNull();
  expect(screen.getByTestId('identity.security.device.dev-tab.close')).toBeOnTheScreen();
  expect(screen.queryByText(/·/)).toBeNull();
});

it('marks a pending device with Pendiente', async () => {
  await renderScreen({ list: async () => [thisPhone, pendingPhone] });
  expect(screen.getByText(t.pending)).toBeOnTheScreen();
  expect(screen.getByText('Hace 2 días')).toBeOnTheScreen();
});

it('uses a singular count for one session', async () => {
  await renderScreen({ list: async () => [thisPhone] });
  expect(screen.getByText('1 sesión')).toBeOnTheScreen();
});

it('asks before closing a device, then removes it and loads the list again', async () => {
  const alert = spyAlert();
  const { devices } = await renderScreen();
  await fireEvent.press(screen.getByTestId('identity.security.device.dev-tab.close'));
  expect(alert).toHaveBeenCalledTimes(1);
  expect(alert.mock.calls[0]?.[0]).toContain('Galaxy Tab S9');
  expect(devices.remove).not.toHaveBeenCalled();

  await act(async () => alertButtons(alert, 'destructive').onPress());
  expect(devices.remove).toHaveBeenCalledWith('dev-tab');
  await waitFor(() => expect(devices.list).toHaveBeenCalledTimes(2));
});

it('does not remove a device when the person cancels', async () => {
  const alert = spyAlert();
  const { devices } = await renderScreen();
  await fireEvent.press(screen.getByTestId('identity.security.device.dev-tab.close'));
  alertButtons(alert, 'cancel').onPress?.();
  expect(devices.remove).not.toHaveBeenCalled();
});

it('shows an error alert when closing a device fails', async () => {
  const alert = spyAlert();
  await renderScreen({
    remove: async () => {
      throw new DevicesError('network');
    },
  });
  await fireEvent.press(screen.getByTestId('identity.security.device.dev-tab.close'));
  await act(async () => alertButtons(alert, 'destructive').onPress());
  await waitFor(() => expect(alert).toHaveBeenCalledTimes(2));
  expect(alert.mock.calls[1]?.[0]).toBe(t.actionFailed.title);
  expect(screen.getByText('Galaxy Tab S9')).toBeOnTheScreen();
});

it('asks before closing the other sessions, then closes them', async () => {
  const alert = spyAlert();
  const { devices } = await renderScreen();
  await fireEvent.press(screen.getByRole('button', { name: t.closeAll }));
  expect(alert).toHaveBeenCalledTimes(1);
  expect(devices.signOutOthers).not.toHaveBeenCalled();

  await act(async () => alertButtons(alert, 'destructive').onPress());
  expect(devices.signOutOthers).toHaveBeenCalledWith('dev-this');
  await waitFor(() => expect(devices.list).toHaveBeenCalledTimes(2));
  // The buttons are enabled again once the action and the reload are over.
  await waitFor(() => expect(screen.getByRole('button', { name: t.closeAll })).toBeEnabled());
});

it('hides "Cerrar todas las demás sesiones" when this phone is the only one', async () => {
  await renderScreen({ list: async () => [thisPhone] });
  expect(screen.queryByText(t.closeAll)).toBeNull();
  expect(screen.getByText(t.footer)).toBeOnTheScreen();
});

it('syncs the device when closing the others says this phone is unknown', async () => {
  const alert = spyAlert();
  const { sync } = await renderScreen({
    signOutOthers: async () => {
      throw new DevicesError('notFound');
    },
  });
  await fireEvent.press(screen.getByRole('button', { name: t.closeAll }));
  await act(async () => alertButtons(alert, 'destructive').onPress());
  await waitFor(() => expect(sync).toHaveBeenCalledTimes(1));
});

it('changes the password, then loads the profile and the devices again', async () => {
  const alert = spyAlert();
  const { changePassword, getProfile, devices } = await renderScreen();
  await fireEvent.press(screen.getByTestId('identity.security.changePassword'));
  expect(changePassword).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(getProfile).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(devices.list).toHaveBeenCalledTimes(2));
  expect(alert).not.toHaveBeenCalled();
});

it('disables the password row while Keycloak is open', async () => {
  let finish!: (r: ChangePasswordResult) => void;
  const { changePassword } = await renderScreen({
    changePassword: () => new Promise((resolve) => (finish = resolve)),
  });
  await fireEvent.press(screen.getByTestId('identity.security.changePassword'));
  await fireEvent.press(screen.getByTestId('identity.security.changePassword'));
  expect(changePassword).toHaveBeenCalledTimes(1);
  await act(async () => finish('cancelled'));
  await waitFor(() =>
    expect(screen.getByTestId('identity.security.changePassword')).toBeOnTheScreen(),
  );
});

it('says nothing when the person cancels, and alerts when the change fails', async () => {
  const cancelled = spyAlert();
  await renderScreen({ changePassword: async () => 'cancelled' });
  await fireEvent.press(screen.getByTestId('identity.security.changePassword'));
  await waitFor(() => expect(cancelled).not.toHaveBeenCalled());
  await screen.unmount();
  jest.restoreAllMocks();

  const failed = spyAlert();
  await renderScreen({ changePassword: async () => 'failed' });
  await fireEvent.press(screen.getByTestId('identity.security.changePassword'));
  await waitFor(() =>
    expect(failed).toHaveBeenCalledWith(t.changeFailed.title, t.changeFailed.message),
  );
});

it('shows an error with retry when the devices do not load', async () => {
  const down = new DevicesError('network');
  const list = jest
    .fn<Promise<LinkedDeviceItem[]>, [string | null]>()
    .mockRejectedValueOnce(down)
    .mockRejectedValueOnce(down)
    .mockResolvedValue([thisPhone, tablet]);
  await renderScreen({ list });
  expect(screen.getByText(t.loadFailed)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
  expect(await screen.findByText('Galaxy Tab S9')).toBeOnTheScreen();
});

it('goes back with the back button', async () => {
  await renderScreen();
  expect(screen.getByRole('button', { name: t.back })).toBeOnTheScreen();
});

it('labels the rows for screen readers', async () => {
  await renderScreen({ list: async () => [thisPhone, pendingPhone] });
  expect(screen.getByLabelText('Cambiar contraseña. Actualizada hace 3 meses')).toBeOnTheScreen();
  expect(screen.getByLabelText('iPhone 15. Activo ahora. Este dispositivo')).toBeOnTheScreen();
  expect(screen.getByLabelText('Pixel 8. Hace 2 días. Pendiente')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: t.closeDevice('Pixel 8') })).toBeOnTheScreen();
});

const background = () => String(screen.getByTestId('probe.background').props.children);

it.each(['light', 'dark'] as const)('renders in %s', async (preference) => {
  await renderScreen({ preference });
  expect(screen.getByText(t.title)).toBeOnTheScreen();
  expect(screen.getByText('Galaxy Tab S9')).toBeOnTheScreen();
});

it('uses different colors in light and dark', async () => {
  await renderScreen({ preference: 'light' });
  const light = background();
  await screen.unmount();
  await renderScreen({ preference: 'dark' });
  expect(background()).not.toBe(light);
});
