// SCRUM-61 on screen, on a real vault: the red "Subió" chip next to the subscription in
// Billetera, and in Detalle "Pasó de $32.900 a $36.900: +$4.000 al mes." until "Entendido".
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type { Transaction } from '@shared/domain/types';
import {
  createFixedClock,
  createInMemoryNotifications,
  createInMemoryVault,
  type InMemoryVault,
} from '@shared/testing';
import { ThemeProvider, type ThemePreference } from '@shared/ui';

import { recurringMigrations } from '../adapters/vault/migrations';
import { createVaultPriceAlertStore } from '../adapters/vault/vaultPriceAlertStore';
import { createVaultRecurringStore } from '../adapters/vault/vaultRecurringStore';
import { createPriceAlertService, type PriceAlertService } from '../application/priceAlertService';
import { createRecurringService, type RecurringService } from '../application/recurringService';
import { createBilleteraScreen } from './BilleteraScreen';
import {
  SUBSCRIPTION_DETAIL_ROUTE,
  createSubscriptionDetailScreen,
} from './SubscriptionDetailScreen';

const noStore = { load: async () => 'system' as const, save: async () => undefined };
const Stack = createNativeStackNavigator();
const clock = createFixedClock('2026-10-28T15:00:00Z');

const charge = (id: string, day: string, amount: number): Transaction => ({
  id,
  accountId: 'acc-card',
  providerTxId: id,
  source: 'bank',
  bookedAt: `${day}T14:00:00Z`,
  amountMinor: -amount * 100,
  description: 'STREAMING SERIES',
  merchantRaw: 'STREAMING SERIES',
  merchantKey: 'streaming series',
  categoryId: 'subscriptions',
  categorySource: 'bank',
  status: 'booked',
  goalId: null,
});
const movements = [charge('t1', '2026-09-02', 32_900), charge('t2', '2026-10-02', 36_900)];

let vault: InMemoryVault;
let service: RecurringService;
let alerts: PriceAlertService;
let itemId: string;

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
  alerts = createPriceAlertService({
    store: () => createVaultPriceAlertStore(vault.db),
    items: () => service.list(),
    listMovements: async () => movements,
    notifications: createInMemoryNotifications(),
    clock,
    newId: () => `a${++n}`,
    onChange: () => service.notifyChanged(),
  });
  itemId = await service.create(
    {
      kind: 'subscription',
      name: 'Streaming de series',
      amountMinor: 3_690_000,
      schedule: { periodicity: 'monthly', anchorDay: 2 },
      categoryId: 'subscriptions',
    },
    { merchantKey: 'streaming series' },
  );
  await alerts.check();
});

afterEach(() => vault.close());

async function renderApp(preference: ThemePreference = 'light') {
  const Billetera = createBilleteraScreen({
    service,
    clock,
    useUnreadCount: () => 0,
    accountRoute: 'identity.Account',
    notificationsRoute: 'notifications.Inbox',
    statisticsRoute: 'analytics.Spending',
    recommendationsRoute: 'Recomendaciones',
    priceUpItems: async () => new Set((await alerts.openByItem()).keys()),
  });
  const Detail = createSubscriptionDetailScreen({
    service,
    today: () => '2026-10-28',
    priceAlerts: alerts,
  });
  await render(
    <ThemeProvider initialPreference={preference} store={noStore}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Billetera" component={Billetera} />
          <Stack.Screen name={SUBSCRIPTION_DETAIL_ROUTE} component={Detail} />
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeProvider>,
  );
}

describe('price increase on screen', () => {
  it('Billetera shows the red "Subió" chip next to the subscription', async () => {
    await renderApp();
    const row = await screen.findByTestId(`recurring.subscription.${itemId}`);
    await waitFor(() => expect(row).toHaveTextContent(/Streaming de series.*Subió/));
  });

  it('Detalle shows before, after and the monthly difference; "Entendido" clears it', async () => {
    await renderApp('dark');
    await fireEvent.press(await screen.findByTestId(`recurring.subscription.${itemId}`));
    const card = await screen.findByTestId('recurring.subscription.priceUp');
    expect(card).toHaveTextContent(
      /Subió de precio.*Pasó de \$32\.900 a \$36\.900: \+\$4\.000 al mes\./,
    );
    await fireEvent.press(screen.getByTestId('recurring.subscription.priceUp.dismiss'));
    await waitFor(() => expect(screen.queryByTestId('recurring.subscription.priceUp')).toBeNull());
    expect((await alerts.openByItem()).size).toBe(0);
  });
});
