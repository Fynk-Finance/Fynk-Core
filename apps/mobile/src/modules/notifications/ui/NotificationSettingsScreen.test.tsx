// Ajustes de notificaciones (SCRUM-70): one switch per kind, "Permitir notificaciones", the
// payment reminder lead time, new devices always on, and both themes.
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { createFixedClock, createInMemoryVault, type InMemoryVault } from '@shared/testing';
import { ThemeProvider, useTheme, type ThemePreference } from '@shared/ui';

import { notificationsMigrations } from '../adapters/vault/migrations';
import { createVaultInboxStore } from '../adapters/vault/vaultInboxStore';
import {
  createNotificationService,
  type NotificationService,
} from '../application/notificationService';
import { createNotificationSettingsScreen } from './NotificationSettingsScreen';

const noStore = { load: async () => 'system' as const, save: async () => undefined };
const Stack = createNativeStackNavigator();

let vault: InMemoryVault;
let service: NotificationService;

function ProbeBackground() {
  return <Text testID="probe.background">{useTheme().colors.background}</Text>;
}

async function renderScreen(
  svc: NotificationService = service,
  preference: ThemePreference = 'light',
) {
  const Settings = createNotificationSettingsScreen({ service: svc });
  await render(
    <ThemeProvider initialPreference={preference} store={noStore}>
      <ProbeBackground />
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="notifications.Settings" component={Settings} />
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeProvider>,
  );
  await screen.findByTestId('notifications.settings.allowAll');
}

const checked = (testID: string) =>
  screen.getByTestId(testID).props.accessibilityState?.checked as boolean | undefined;

beforeEach(async () => {
  vault = await createInMemoryVault();
  vault.registerMigrations('notifications', notificationsMigrations);
  await vault.migrate();
  service = createNotificationService({
    store: () => createVaultInboxStore(vault.db),
    clock: createFixedClock('2026-10-28T15:00:00Z'),
    newId: () => 'n',
  });
});

afterEach(() => vault.close());

describe('Ajustes de notificaciones', () => {
  it('shows the sections and rows with their Spanish copy', async () => {
    await renderScreen();
    for (const text of [
      'Elige qué avisos quieres recibir.',
      'Permitir notificaciones',
      'Pagos y gastos fijos',
      'Recordatorio de pagos',
      'Cobro de suscripciones',
      'Aumentos de precio',
      'Movimientos y saldos',
      'Ingresos recibidos',
      'Sincronización',
      'Topes de gasto',
      'Metas y recomendaciones',
      'Avance de metas',
      'Cuando llegues al 50, 75 y 100 %',
      'Nuevas recomendaciones',
      'Nuevos dispositivos',
    ]) {
      expect(screen.getByText(text)).toBeTruthy();
    }
    // Not kinds of the shared contract yet: left out until the team adds them.
    expect(screen.queryByText('Gastos grandes')).toBeNull();
    expect(screen.queryByText('Saldo bajo')).toBeNull();
  });

  it('turns a kind off and keeps it off', async () => {
    await renderScreen();
    expect(checked('notifications.settings.sync')).toBe(true);
    fireEvent.press(screen.getByTestId('notifications.settings.sync'));
    await waitFor(async () => expect(await service.isEnabled('sync_result')).toBe(false));
    expect(checked('notifications.settings.sync')).toBe(false);
  });

  it('turns both cap notices off with the "Topes de gasto" switch', async () => {
    await renderScreen();
    fireEvent.press(screen.getByTestId('notifications.settings.caps'));
    await waitFor(async () => {
      expect(await service.isEnabled('cap_warning')).toBe(false);
      expect(await service.isEnabled('cap_reached')).toBe(false);
    });
  });

  it('keeps new devices always on: its switch cannot be used', async () => {
    await renderScreen();
    const devices = screen.getByTestId('notifications.settings.devices');
    expect(checked('notifications.settings.devices')).toBe(true);
    expect(devices.props.accessibilityState?.disabled).toBe(true);
  });

  it('chooses when to remind a payment: 2 days before by default', async () => {
    await renderScreen();
    expect(
      screen.getByTestId('notifications.settings.lead.2').props.accessibilityState?.selected,
    ).toBe(true);
    fireEvent.press(screen.getByText('El mismo día'));
    await waitFor(async () => expect(await service.paymentLeadDays()).toBe(0));
    expect(
      screen.getByTestId('notifications.settings.lead.0').props.accessibilityState?.selected,
    ).toBe(true);
  });

  it('hides the lead time chips while payment reminders are off', async () => {
    await renderScreen();
    fireEvent.press(screen.getByTestId('notifications.settings.payments'));
    await waitFor(() => expect(screen.queryByText('1 día antes')).toBeNull());
  });

  it('"Permitir notificaciones" off silences everything and dims the rows', async () => {
    await renderScreen();
    fireEvent.press(screen.getByTestId('notifications.settings.allowAll'));
    await waitFor(async () => expect(await service.isEnabled('payment_due')).toBe(false));
    expect(checked('notifications.settings.allowAll')).toBe(false);
    expect(await service.isEnabled('device_approval')).toBe(true);
  });

  it('shows an error with a retry when the settings cannot be read', async () => {
    const broken = { ...service, settings: jest.fn().mockRejectedValue(new Error('disk')) };
    const Settings = createNotificationSettingsScreen({ service: broken });
    await render(
      <ThemeProvider initialPreference="light" store={noStore}>
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="notifications.Settings" component={Settings} />
          </Stack.Navigator>
        </NavigationContainer>
      </ThemeProvider>,
    );
    expect(await screen.findByText('No pudimos cargar tus ajustes.')).toBeTruthy();
  });

  it('renders in the dark theme', async () => {
    await renderScreen(service, 'dark');
    expect(screen.getByTestId('probe.background')).toHaveTextContent('#13212D');
  });
});
