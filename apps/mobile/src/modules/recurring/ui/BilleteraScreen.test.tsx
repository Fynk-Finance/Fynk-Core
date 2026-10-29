// Billetera (SCRUM-54 "En Billetera"): "Gastos fijos de este mes", the recurring cards of the
// design with their schedule and next charge, "+ Agregar", editing a card, empty state, themes.
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { createFixedClock, createInMemoryVault, type InMemoryVault } from '@shared/testing';
import { ThemeProvider, type ThemePreference } from '@shared/ui';

import { recurringMigrations } from '../adapters/vault/migrations';
import { createVaultRecurringStore } from '../adapters/vault/vaultRecurringStore';
import { createRecurringService, type RecurringService } from '../application/recurringService';
import type { RecurringInput } from '../domain/item';
import { MON_TO_FRI, WEEKDAY } from '../domain/types';
import { bogotaToday, createBilleteraScreen } from './BilleteraScreen';
import { RECURRING_FORM_ROUTE } from './RecurringFormScreen';

const noStore = { load: async () => 'system' as const, save: async () => undefined };
const Stack = createNativeStackNavigator();
// Saturday 24 Oct 2026, 10:00 in Bogotá.
const clock = createFixedClock('2026-10-24T15:00:00Z');

const pesos = (n: number) => n * 100;
const monthly = (name: string, amount: number, day: number, over: Partial<RecurringInput> = {}) =>
  ({
    kind: 'fixed',
    name,
    amountMinor: pesos(amount),
    schedule: { periodicity: 'monthly', anchorDay: day },
    categoryId: 'rent',
    ...over,
  }) as RecurringInput;

const billetera: RecurringInput[] = [
  monthly('Arriendo', 1_400_000, 1),
  monthly('Servicios públicos', 186_000, 26, { categoryId: 'utilities' }),
  {
    ...monthly('Gimnasio', 22_250, 1, { categoryId: 'gym' }),
    schedule: { periodicity: 'weekly', weekdaysMask: WEEKDAY.mon },
  },
  {
    ...monthly('Transporte', 6_500, 1, { categoryId: 'transport' }),
    schedule: { periodicity: 'daily', weekdaysMask: MON_TO_FRI },
  },
  ...[
    ['Streaming de video', 38_900, 28],
    ['Streaming de series', 32_900, 2],
    ['Música', 16_900, 7],
    ['Almacenamiento', 23_900, 15],
  ].map(([n, a, d]) =>
    monthly(n as string, a as number, d as number, {
      kind: 'subscription',
      categoryId: 'subscriptions',
    }),
  ),
];

let vault: InMemoryVault;
let service: RecurringService;

beforeEach(async () => {
  vault = await createInMemoryVault();
  vault.registerMigrations('recurring', recurringMigrations);
  await vault.migrate();
  let n = 0;
  service = createRecurringService({
    store: () => createVaultRecurringStore(vault.db),
    clock,
    newId: () => `r${++n}`,
  });
});

afterEach(() => vault.close());

function Target({ route }: { route: { name: string; params?: { id?: string } } }) {
  return <Text>{`arrived:${route.name}:${route.params?.id ?? ''}`}</Text>;
}

async function renderBilletera(preference: ThemePreference = 'light', unread = 0) {
  const Billetera = createBilleteraScreen({
    service,
    clock,
    useUnreadCount: () => unread,
    accountRoute: 'identity.Account',
    notificationsRoute: 'notifications.Inbox',
  });
  await render(
    <ThemeProvider initialPreference={preference} store={noStore}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Billetera" component={Billetera} />
          <Stack.Screen name={RECURRING_FORM_ROUTE} component={Target} />
          <Stack.Screen name="notifications.Inbox" component={Target} />
          <Stack.Screen name="identity.Account" component={Target} />
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeProvider>,
  );
}

async function addAll() {
  for (const item of billetera) await service.create(item);
}

describe('Billetera', () => {
  it('shows "Gastos fijos de este mes $1.930.600", as in the design', async () => {
    await addAll();
    await renderBilletera();
    expect(await screen.findByTestId('recurring.billetera.total')).toHaveTextContent('$1.930.600');
    expect(screen.getByText('Gastos fijos de este mes')).toBeTruthy();
  });

  it('shows each card with its amount, periodicity, schedule and next charge', async () => {
    await addAll();
    await renderBilletera();
    await screen.findByTestId('recurring.billetera.grid');
    expect(screen.getByTestId('recurring.card.r1')).toHaveTextContent(
      /Arriendo.*\$1\.400\.000.*Mensual.*Día 1.*Pagado/,
    );
    expect(screen.getByTestId('recurring.card.r2')).toHaveTextContent(
      /Servicios públicos.*\$186\.000.*Mensual.*Día 26.*En 2 días/,
    );
    expect(screen.getByTestId('recurring.card.r3')).toHaveTextContent(
      /Gimnasio.*\$22\.250.*Semanal.*Cada lunes.*En 2 días/,
    );
    expect(screen.getByTestId('recurring.card.r4')).toHaveTextContent(
      /Transporte.*\$6\.500.*Diario.*Lun a vie.*En 2 días/,
    );
  });

  it('"+ Agregar" opens the form', async () => {
    await addAll();
    await renderBilletera();
    await fireEvent.press(await screen.findByText('+ Agregar'));
    expect(await screen.findByText(`arrived:${RECURRING_FORM_ROUTE}:`)).toBeTruthy();
  });

  it('tapping a card opens the form to edit it', async () => {
    await addAll();
    await renderBilletera();
    await fireEvent.press(await screen.findByTestId('recurring.card.r2'));
    expect(await screen.findByText(`arrived:${RECURRING_FORM_ROUTE}:r2`)).toBeTruthy();
  });

  it('shows a new item as soon as it is added', async () => {
    await renderBilletera();
    expect(await screen.findByText('Aún no tienes gastos recurrentes')).toBeTruthy();
    await service.create(billetera[0]!);
    await waitFor(() => expect(screen.getByTestId('recurring.card.r1')).toBeTruthy());
  });

  it('the empty state also opens the form', async () => {
    await renderBilletera();
    await fireEvent.press(await screen.findByText('Agregar gasto'));
    expect(await screen.findByText(`arrived:${RECURRING_FORM_ROUTE}:`)).toBeTruthy();
  });

  it('the bell shows unread notifications and opens them', async () => {
    await renderBilletera('light', 2);
    expect(await screen.findByTestId('header-unread-dot')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('header-bell'));
    expect(await screen.findByText('arrived:notifications.Inbox:')).toBeTruthy();
  });

  it('renders in the dark theme', async () => {
    await addAll();
    await renderBilletera('dark');
    expect(await screen.findByTestId('recurring.billetera.total')).toHaveTextContent('$1.930.600');
  });
});

describe('bogotaToday', () => {
  it('is still the previous day at 02:00 UTC', () => {
    expect(bogotaToday(new Date('2026-10-25T02:00:00Z'))).toBe('2026-10-24');
  });
});
