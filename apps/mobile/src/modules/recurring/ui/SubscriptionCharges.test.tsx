// Detalle de suscripción with M6 and M7: the account or card it is charged to and its last
// charges, each one opening its movement (M9 prompt: "show the account or card it is charged
// to and link to its movements").
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import type { Account, Transaction } from '@shared/domain/types';
import { createFixedClock, createInMemoryVault, type InMemoryVault } from '@shared/testing';
import { ThemeProvider } from '@shared/ui';

import { recurringMigrations } from '../adapters/vault/migrations';
import { createVaultRecurringStore } from '../adapters/vault/vaultRecurringStore';
import { createRecurringService, type RecurringService } from '../application/recurringService';
import {
  SUBSCRIPTION_DETAIL_ROUTE,
  createSubscriptionDetailScreen,
} from './SubscriptionDetailScreen';

const noStore = { load: async () => 'system' as const, save: async () => undefined };
const Stack = createNativeStackNavigator();
const clock = createFixedClock('2026-10-24T15:00:00Z');
const card = { id: 'acc-card', kind: 'credit_card', last4: '4821' } as Account;

const charge = (id: string, bookedAt: string): Transaction => ({
  id,
  accountId: 'acc-card',
  providerTxId: id,
  source: 'bank',
  bookedAt,
  amountMinor: -3_890_000,
  description: 'STREAMING VIDEO',
  merchantRaw: 'STREAMING VIDEO',
  merchantKey: 'streaming video',
  categoryId: 'subscriptions',
  categorySource: 'bank',
  status: 'booked',
  goalId: null,
});

let vault: InMemoryVault;
let service: RecurringService;
let id: string;
let windows: [string, string][];

beforeEach(async () => {
  vault = await createInMemoryVault();
  vault.registerMigrations('recurring', recurringMigrations);
  await vault.migrate();
  service = createRecurringService({
    store: () => createVaultRecurringStore(vault.db),
    clock,
    newId: () => 'r1',
  });
  id = await service.create({
    kind: 'subscription',
    name: 'Streaming de video',
    amountMinor: 3_890_000,
    schedule: { periodicity: 'monthly', anchorDay: 28 },
    categoryId: 'subscriptions',
    accountId: 'acc-card',
  });
  windows = [];
});

afterEach(() => vault.close());

function Movement({ route }: { route: { params?: { id?: string } } }) {
  return <Text>{`movement:${route.params?.id ?? ''}`}</Text>;
}

async function renderDetail() {
  const Detail = createSubscriptionDetailScreen({
    service,
    today: () => '2026-10-24',
    accounts: async () => [card],
    listMovements: async (from, to) => {
      windows.push([from, to]);
      // 28 sep at 02:00 UTC is still 27 sep in Bogotá.
      return [charge('t1', '2026-08-28T14:00:00Z'), charge('t2', '2026-09-28T02:00:00Z')];
    },
    transactionRoute: 'transactions.Detail',
  });
  await render(
    <ThemeProvider initialPreference="light" store={noStore}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen
            name={SUBSCRIPTION_DETAIL_ROUTE}
            component={Detail}
            initialParams={{ id }}
          />
          <Stack.Screen name="transactions.Detail" component={Movement} />
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeProvider>,
  );
}

const setMerchant = () =>
  vault.db.execute(`UPDATE recurring_items SET merchant_key = 'streaming video' WHERE id = ?`, [
    id,
  ]);

describe('account and last charges', () => {
  it('shows the card it is charged to with its last 4 digits only', async () => {
    await renderDetail();
    expect(await screen.findByText('Tarjeta de crédito •• 4821')).toBeTruthy();
  });

  it('lists the charges of a detected subscription, newest first, in Bogotá days', async () => {
    await setMerchant();
    await renderDetail();
    const rows = await screen.findAllByTestId(/recurring\.subscription\.charge\./);
    expect(rows.map((r) => r.props.testID)).toEqual([
      'recurring.subscription.charge.t2',
      'recurring.subscription.charge.t1',
    ]);
    expect(screen.getByText('27 sep')).toBeTruthy();
    expect(windows).toEqual([['2025-10-24', '2026-10-24']]);
  });

  it('opens the movement of a charge', async () => {
    await setMerchant();
    await renderDetail();
    await fireEvent.press(await screen.findByTestId('recurring.subscription.charge.t1'));
    expect(await screen.findByText('movement:t1')).toBeTruthy();
  });

  it('explains why a subscription typed by hand has no charges', async () => {
    await renderDetail();
    expect(
      await screen.findByText(
        'Los cobros aparecen cuando la suscripción viene de un pago detectado.',
      ),
    ).toBeTruthy();
  });
});
