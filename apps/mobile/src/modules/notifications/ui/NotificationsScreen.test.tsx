// Notificaciones (SCRUM-70): Hoy and Esta semana, unread counter, "Marcar como leídas", rows that
// open their link, the empty state, both themes, and the bell counter.
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { VaultLockedError, type NotifyInput } from '@shared/ports';
import { createFixedClock, createInMemoryVault, type InMemoryVault } from '@shared/testing';
import { ThemeProvider, useTheme, type ThemePreference } from '@shared/ui';

import { notificationsMigrations } from '../adapters/vault/migrations';
import { createVaultInboxStore } from '../adapters/vault/vaultInboxStore';
import {
  createNotificationService,
  type NotificationService,
} from '../application/notificationService';
import { createNotificationsScreen } from './NotificationsScreen';
import { notificationsStrings } from './strings.es-CO';
import { useUnreadCount } from './useInbox';

const t = notificationsStrings.inbox;
const noStore = { load: async () => 'system' as const, save: async () => undefined };
const Stack = createNativeStackNavigator();

// Wednesday 28 Oct 2026 in Bogotá.
const clock = createFixedClock('2026-10-28T15:00:00Z');

const n = (kind: NotifyInput['kind'], title: string, body: string, link: string): NotifyInput => ({
  kind,
  title,
  body,
  deepLink: link,
  dedupeKey: title,
});

// The rows of the design, oldest first, with the time they arrived.
const designRows: [string, NotifyInput][] = [
  [
    '2026-10-24T15:00:00Z',
    n(
      'subscription_renewal',
      'Streaming de video',
      'Se renueva el 28 sep por $38.900.',
      'fynk://billetera',
    ),
  ],
  [
    '2026-10-25T18:00:00Z',
    n('sync_result', 'Nu Bank sincronizada', 'Tus movimientos están al día.', 'fynk://cuentas'),
  ],
  [
    '2026-10-26T20:00:00Z',
    n('goal_milestone', 'Viaje a Cartagena', 'Llegaste al 64 % de tu meta.', 'fynk://metas/g1'),
  ],
  [
    '2026-10-28T12:30:00Z',
    n(
      'recommendation',
      'Nueva recomendación',
      'Podrías ahorrar $56.800 al mes en suscripciones.',
      'fynk://recomendaciones',
    ),
  ],
  [
    '2026-10-28T13:05:00Z',
    n(
      'income_received',
      'Salario recibido',
      'Entraron +$5.200.000 a Bancolombia.',
      'fynk://dashboard',
    ),
  ],
  [
    '2026-10-28T14:12:00Z',
    n(
      'payment_due',
      'Servicios públicos',
      'Vence en 2 días: $186.000.',
      'fynk://billetera/recurrentes/r1',
    ),
  ],
];

let vault: InMemoryVault;
let service: NotificationService;

async function seedDesign() {
  for (const [at, input] of designRows) {
    clock.set(at);
    await service.notify(input);
  }
  // The week's rows were already read in the design.
  const items = await service.list();
  for (const item of items.filter(
    (i) => Date.parse(i.createdAt) < Date.parse('2026-10-27T00:00:00Z'),
  )) {
    await service.markRead(item.id);
  }
  clock.set('2026-10-28T15:00:00Z');
}

function ProbeBackground() {
  return <Text testID="probe.background">{useTheme().colors.background}</Text>;
}

async function renderScreen(
  options: { service?: NotificationService; preference?: ThemePreference } = {},
) {
  const openLink = jest.fn(async (_url: string) => undefined);
  const Inbox = createNotificationsScreen({ service: options.service ?? service, clock, openLink });
  await render(
    <ThemeProvider initialPreference={options.preference ?? 'light'} store={noStore}>
      <ProbeBackground />
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="notifications.Inbox" component={Inbox} />
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeProvider>,
  );
  return { openLink };
}

beforeEach(async () => {
  clock.set('2026-10-28T15:00:00Z');
  vault = await createInMemoryVault();
  vault.registerMigrations('notifications', notificationsMigrations);
  await vault.migrate();
  let id = 0;
  service = createNotificationService({
    store: () => createVaultInboxStore(vault.db),
    clock,
    newId: () => `n${++id}`,
  });
});

afterEach(() => vault.close());

describe('Notificaciones', () => {
  it('groups the design rows in Hoy and Esta semana with their times', async () => {
    await seedDesign();
    await renderScreen();

    const today = await screen.findByTestId('notifications.section.today');
    expect(screen.getByText('Hoy')).toBeTruthy();
    expect(screen.getByText('Esta semana')).toBeTruthy();
    expect(screen.queryByText('Antes')).toBeNull();
    expect(today).toHaveTextContent(
      /Servicios públicos.*9:12.*Salario recibido.*8:05.*Nueva recomendación.*7:30/,
    );
    expect(screen.getByTestId('notifications.section.thisWeek')).toHaveTextContent(
      /Viaje a Cartagena.*Lun.*Nu Bank sincronizada.*Dom.*Streaming de video.*Sáb/,
    );
  });

  it('shows the unread counter and a lime dot only on unread rows', async () => {
    await seedDesign();
    await renderScreen();

    expect(await screen.findByText('3 sin leer')).toBeTruthy();
    expect(screen.getAllByTestId(/^notifications\.row\..*\.unread$/)).toHaveLength(3);
  });

  it('"Marcar como leídas" clears the counter and the dots', async () => {
    await seedDesign();
    await renderScreen();

    fireEvent.press(await screen.findByText(t.markAllRead));
    await waitFor(() => expect(screen.getByText('0 sin leer')).toBeTruthy());
    expect(screen.queryAllByTestId(/\.unread$/)).toHaveLength(0);
    expect(screen.queryByText(t.markAllRead)).toBeNull();
    expect(await service.unreadCount()).toBe(0);
  });

  it('tapping a row marks it read and opens its link', async () => {
    await seedDesign();
    const { openLink } = await renderScreen();

    fireEvent.press(await screen.findByText('Servicios públicos'));
    await waitFor(() => expect(openLink).toHaveBeenCalledWith('fynk://billetera/recurrentes/r1'));
    await waitFor(() => expect(screen.getByText('2 sin leer')).toBeTruthy());
  });

  it('shows a reminder that fired while the app was closed', async () => {
    await service.schedule({
      ...n('payment_due', 'Arriendo', 'Vence en 2 días: $1.400.000.', 'fynk://billetera'),
      id: 'reminder:rent',
      fireAt: '2026-10-28T14:00:00Z',
    });
    await renderScreen();

    expect(await screen.findByText('Arriendo')).toBeTruthy();
    expect(screen.getByText('1 sin leer')).toBeTruthy();
  });

  it('shows the empty state when there is nothing', async () => {
    await renderScreen();
    expect(await screen.findByText(t.empty)).toBeTruthy();
    expect(screen.queryByText(t.markAllRead)).toBeNull();
  });

  it('reads a locked vault as an empty inbox', async () => {
    const locked = createNotificationService({
      store: () => {
        throw new VaultLockedError();
      },
      clock,
      newId: () => 'x',
    });
    await renderScreen({ service: locked });
    expect(await screen.findByText(t.empty)).toBeTruthy();
  });

  it('shows an error with a retry when the inbox cannot be read', async () => {
    const broken = { ...service, list: jest.fn().mockRejectedValue(new Error('disk')) };
    await renderScreen({ service: broken });
    expect(await screen.findByText(t.error)).toBeTruthy();
  });

  it('renders in the dark theme', async () => {
    await seedDesign();
    await renderScreen({ preference: 'dark' });
    expect(await screen.findByText('3 sin leer')).toBeTruthy();
    expect(screen.getByTestId('probe.background')).toHaveTextContent('#13212D');
  });
});

describe('useUnreadCount (the bell)', () => {
  it('follows new notifications and "Marcar como leídas"', async () => {
    const { result } = await renderHook(() => useUnreadCount(service));
    await waitFor(() => expect(result.current).toBe(0));

    await act(() => service.notify(designRows[5]![1]));
    await waitFor(() => expect(result.current).toBe(1));

    await act(() => service.markAllRead());
    await waitFor(() => expect(result.current).toBe(0));
  });

  it('is 0 while the vault is locked', async () => {
    const locked = createNotificationService({
      store: () => {
        throw new VaultLockedError();
      },
      clock,
      newId: () => 'x',
    });
    const { result } = await renderHook(() => useUnreadCount(locked));
    await waitFor(() => expect(result.current).toBe(0));
  });
});
