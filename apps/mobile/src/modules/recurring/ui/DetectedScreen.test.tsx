// Detectamos pagos recurrentes (SCRUM-55) on a real vault: each proposal with its kind, amount
// and next charge; "Confirmar" adds it, "Descartar" hides it, nothing is added without the
// person; the empty state; dark theme. And the Billetera banner that opens the screen.
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type { CategoryId, Transaction } from '@shared/domain/types';
import { createFixedClock, createInMemoryVault, type InMemoryVault } from '@shared/testing';
import { ThemeProvider, type ThemePreference } from '@shared/ui';

import { recurringMigrations } from '../adapters/vault/migrations';
import { createVaultProposalStore } from '../adapters/vault/vaultProposalStore';
import { createVaultRecurringStore } from '../adapters/vault/vaultRecurringStore';
import { createDetectionService, type DetectionService } from '../application/detectionService';
import { createRecurringService, type RecurringService } from '../application/recurringService';
import { createBilleteraScreen } from './BilleteraScreen';
import { DETECTED_ROUTE, createDetectedScreen } from './DetectedScreen';

const noStore = { load: async () => 'system' as const, save: async () => undefined };
const Stack = createNativeStackNavigator();
const clock = createFixedClock('2026-10-28T15:00:00Z');

let n = 0;
const tx = (merchantKey: string, day: string, amount: number, categoryId: CategoryId) => {
  n += 1;
  return {
    id: `t${n}`,
    accountId: 'acc-card',
    providerTxId: `t${n}`,
    source: 'bank',
    bookedAt: `${day}T14:00:00Z`,
    amountMinor: -amount * 100,
    description: merchantKey.toUpperCase(),
    merchantRaw: merchantKey.toUpperCase(),
    merchantKey,
    categoryId,
    categorySource: 'bank',
    status: 'booked',
    goalId: null,
  } satisfies Transaction;
};
const months = ['2026-07', '2026-08', '2026-09', '2026-10'];
const movements = [
  ...months.map((m) => tx('streaming musica', `${m}-07`, 16_900, 'subscriptions')),
  ...months.map((m) => tx('inmobiliaria', `${m}-01`, 1_400_000, 'rent')),
];

let vault: InMemoryVault;
let service: RecurringService;
let detection: DetectionService;

beforeEach(async () => {
  vault = await createInMemoryVault();
  vault.registerMigrations('recurring', recurringMigrations);
  await vault.migrate();
  let id = 0;
  service = createRecurringService({
    store: () => createVaultRecurringStore(vault.db),
    clock,
    newId: () => `r${++id}`,
  });
  detection = createDetectionService({
    proposals: () => createVaultProposalStore(vault.db),
    items: () => createVaultRecurringStore(vault.db).list(),
    listMovements: async () => movements,
    catalog: () => null,
    recurring: service,
    clock,
    onChange: () => service.notifyChanged(),
  });
});

afterEach(() => vault.close());

async function renderDetected(preference: ThemePreference = 'light') {
  const Detected = createDetectedScreen({ detection, subscribe: service.subscribe });
  await render(
    <ThemeProvider initialPreference={preference} store={noStore}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name={DETECTED_ROUTE} component={Detected} />
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeProvider>,
  );
}

describe('Detectamos pagos recurrentes', () => {
  it('shows each proposal with its kind, amount, periodicity and next charge', async () => {
    await detection.run();
    await renderDetected();
    const music = await screen.findByTestId('recurring.detected.streaming musica');
    expect(music).toHaveTextContent(/Suscripción.*Mensual.*Próximo cobro 7 nov.*\$16\.900/);
    expect(screen.getByTestId('recurring.detected.inmobiliaria')).toHaveTextContent(
      /Gasto fijo.*Mensual.*Próximo cobro 1 nov.*\$1\.400\.000/,
    );
    // Nothing is added without the person.
    expect(await service.list()).toEqual([]);
  });

  it('"Confirmar" adds the item and the card goes away', async () => {
    await detection.run();
    await renderDetected();
    await fireEvent.press(await screen.findByTestId('recurring.detected.streaming musica.confirm'));
    await waitFor(() =>
      expect(screen.queryByTestId('recurring.detected.streaming musica')).toBeNull(),
    );
    expect(await service.list()).toMatchObject([
      { merchantKey: 'streaming musica', source: 'detected', kind: 'subscription' },
    ]);
  });

  it('"Descartar" hides it and adds nothing', async () => {
    await detection.run();
    await renderDetected();
    await fireEvent.press(await screen.findByTestId('recurring.detected.inmobiliaria.dismiss'));
    await waitFor(() => expect(screen.queryByTestId('recurring.detected.inmobiliaria')).toBeNull());
    expect(await service.list()).toEqual([]);
    expect(await detection.run()).toBe(0);
  });

  it('has an empty state, and renders in dark theme', async () => {
    await renderDetected('dark');
    expect(await screen.findByText('No hay pagos por revisar')).toBeTruthy();
  });
});

describe('Billetera banner', () => {
  it('"Detectamos 2 pagos recurrentes" opens the screen, and it goes when none is left', async () => {
    await detection.run();
    const Billetera = createBilleteraScreen({
      service,
      clock,
      useUnreadCount: () => 0,
      accountRoute: 'identity.Account',
      notificationsRoute: 'notifications.Inbox',
      statisticsRoute: 'analytics.Spending',
      recommendationsRoute: 'Recomendaciones',
      pendingProposals: async () => (await detection.pending()).length,
      detectedRoute: DETECTED_ROUTE,
    });
    const Detected = createDetectedScreen({ detection, subscribe: service.subscribe });
    await render(
      <ThemeProvider initialPreference="light" store={noStore}>
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Billetera" component={Billetera} />
            <Stack.Screen name={DETECTED_ROUTE} component={Detected} />
          </Stack.Navigator>
        </NavigationContainer>
      </ThemeProvider>,
    );
    const banner = await screen.findByTestId('recurring.billetera.detected');
    expect(banner).toHaveTextContent(/Detectamos 2 pagos recurrentes.*Revisar/);
    await fireEvent.press(banner);
    expect(await screen.findByTestId('recurring.detected')).toBeTruthy();

    await detection.dismiss('inmobiliaria');
    await detection.dismiss('streaming musica');
    await waitFor(() => expect(screen.queryByTestId('recurring.billetera.detected')).toBeNull());
  });
});
