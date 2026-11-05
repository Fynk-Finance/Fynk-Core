// "Cómo cancelarla" in Detalle de suscripción with the shared merchant catalog (SCRUM-58): the
// merchant's steps and "Abrir página de cancelación" in the browser; the general text when the
// merchant is not in the catalog. Fynk never cancels anything.
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { createFixedClock, createInMemoryVault, type InMemoryVault } from '@shared/testing';
import { ThemeProvider, type ThemePreference } from '@shared/ui';

import { recurringMigrations } from '../adapters/vault/migrations';
import { createVaultRecurringStore } from '../adapters/vault/vaultRecurringStore';
import { createRecurringService, type RecurringService } from '../application/recurringService';
import { findMerchant, type CatalogEntry } from '../domain/catalog';
import {
  SUBSCRIPTION_DETAIL_ROUTE,
  createSubscriptionDetailScreen,
} from './SubscriptionDetailScreen';

const noStore = { load: async () => 'system' as const, save: async () => undefined };
const Stack = createNativeStackNavigator();
const clock = createFixedClock('2026-11-05T15:00:00Z');
const netflix: CatalogEntry = {
  key: 'netflix',
  displayName: 'Netflix',
  category: 'subscriptions',
  isSubscription: true,
  matchPatterns: ['netflix'],
  cancelUrl: 'https://www.netflix.com/cancelplan',
  cancelSteps: ['Entra a netflix.com e inicia sesión.', 'Abre Cuenta y elige Cancelar membresía.'],
};

let vault: InMemoryVault;
let service: RecurringService;
let opened: string[];

beforeEach(async () => {
  vault = await createInMemoryVault();
  vault.registerMigrations('recurring', recurringMigrations);
  await vault.migrate();
  service = createRecurringService({
    store: () => createVaultRecurringStore(vault.db),
    clock,
    newId: () => 'r1',
  });
  opened = [];
});

afterEach(() => vault.close());

async function renderDetail(merchantKey: string | null, preference: ThemePreference = 'light') {
  const input = {
    kind: 'subscription' as const,
    name: 'Netflix',
    amountMinor: 3_890_000,
    schedule: { periodicity: 'monthly' as const, anchorDay: 28 },
    categoryId: 'subscriptions' as const,
  };
  const id = merchantKey
    ? await service.create(input, { merchantKey })
    : await service.create(input);
  const Detail = createSubscriptionDetailScreen({
    service,
    today: () => '2026-11-05',
    catalog: (key) => findMerchant([netflix], key),
    openUrl: async (url) => {
      opened.push(url);
    },
  });
  await render(
    <ThemeProvider initialPreference={preference} store={noStore}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen
            name={SUBSCRIPTION_DETAIL_ROUTE}
            component={Detail}
            initialParams={{ id }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeProvider>,
  );
}

describe('Cómo cancelarla', () => {
  it('shows the merchant steps and opens its official page in the browser', async () => {
    await renderDetail('cargo netflix com');
    const guide = await screen.findByTestId('recurring.subscription.cancelGuide');
    expect(guide).toHaveTextContent(
      /1\. Entra a netflix\.com e inicia sesión\..*2\. Abre Cuenta y elige Cancelar membresía\./,
    );
    expect(guide).toHaveTextContent(/Fynk no cancela nada por ti/);
    await fireEvent.press(screen.getByTestId('recurring.subscription.cancelPage'));
    expect(opened).toEqual(['https://www.netflix.com/cancelplan']);
  });

  it('shows the general text when the merchant is not in the catalog, in dark theme', async () => {
    await renderDetail(null, 'dark');
    const guide = await screen.findByTestId('recurring.subscription.cancelGuide');
    expect(guide).toHaveTextContent(/Entra a la app o página del servicio/);
    expect(screen.queryByTestId('recurring.subscription.cancelPage')).toBeNull();
  });
});
