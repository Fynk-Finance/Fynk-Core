// Detalle de suscripción (SCRUM-58 without the merchant catalog; SCRUM-56 usage; SCRUM-57
// reminder): amount, periodicity and renewal, the usage chips, the reminder switch, "Ya la
// cancelé" after a confirmation, "No es una suscripción", "Editar", a missing item, dark theme.
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert, Text } from 'react-native';

import { createFixedClock, createInMemoryVault, type InMemoryVault } from '@shared/testing';
import { ThemeProvider, type ThemePreference } from '@shared/ui';

import { recurringMigrations } from '../adapters/vault/migrations';
import { createVaultRecurringStore } from '../adapters/vault/vaultRecurringStore';
import { createRecurringService, type RecurringService } from '../application/recurringService';
import { RECURRING_FORM_ROUTE } from './RecurringFormScreen';
import {
  SUBSCRIPTION_DETAIL_ROUTE,
  createSubscriptionDetailScreen,
} from './SubscriptionDetailScreen';

const noStore = { load: async () => 'system' as const, save: async () => undefined };
const Stack = createNativeStackNavigator();
const clock = createFixedClock('2026-10-24T15:00:00Z');

let vault: InMemoryVault;
let service: RecurringService;
let id: string;

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
  id = await service.create({
    kind: 'subscription',
    name: 'Streaming de video',
    amountMinor: 3_890_000,
    schedule: { periodicity: 'monthly', anchorDay: 28 },
    categoryId: 'subscriptions',
  });
});

afterEach(() => vault.close());

function Billetera() {
  return <Text>Billetera</Text>;
}

function Target({ route }: { route: { name: string; params?: { id?: string } } }) {
  return <Text>{`arrived:${route.name}:${route.params?.id ?? ''}`}</Text>;
}

async function renderDetail(itemId = id, preference: ThemePreference = 'light') {
  const Detail = createSubscriptionDetailScreen({ service, today: () => '2026-10-24' });
  await render(
    <ThemeProvider initialPreference={preference} store={noStore}>
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{ headerShown: false }}
          initialRouteName={SUBSCRIPTION_DETAIL_ROUTE}
        >
          <Stack.Screen name="Billetera" component={Billetera} />
          <Stack.Screen
            name={SUBSCRIPTION_DETAIL_ROUTE}
            component={Detail}
            initialParams={{ id: itemId }}
          />
          <Stack.Screen name={RECURRING_FORM_ROUTE} component={Target} />
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeProvider>,
  );
}

/** Opens Billetera, then the detail on top, so "back" has somewhere to go. */
async function openFromBilletera(itemId = id) {
  const Detail = createSubscriptionDetailScreen({ service, today: () => '2026-10-24' });
  function Home({ navigation }: { navigation: { navigate: (r: string, p: object) => void } }) {
    return (
      <Text onPress={() => navigation.navigate(SUBSCRIPTION_DETAIL_ROUTE, { id: itemId })}>
        Billetera
      </Text>
    );
  }
  await render(
    <ThemeProvider initialPreference="light" store={noStore}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Billetera" component={Home} />
          <Stack.Screen name={SUBSCRIPTION_DETAIL_ROUTE} component={Detail} />
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeProvider>,
  );
  await fireEvent.press(screen.getByText('Billetera'));
  await screen.findByTestId('recurring.subscription.summary');
}

describe('SubscriptionDetailScreen', () => {
  it('shows the amount, periodicity and next renewal', async () => {
    await renderDetail();
    expect(await screen.findByTestId('recurring.subscription.summary')).toHaveTextContent(
      /\$38\.900.*Mensual.*Se renueva el 28 oct/,
    );
    expect(screen.getByText('Streaming de video')).toBeTruthy();
  });

  it('marks "Casi nunca" and clears it with a second tap', async () => {
    await renderDetail();
    await fireEvent.press(await screen.findByTestId('recurring.subscription.usage.low'));
    await waitFor(async () => expect((await service.get(id))?.usage).toBe('low'));
    await fireEvent.press(screen.getByTestId('recurring.subscription.usage.low'));
    await waitFor(async () => expect((await service.get(id))?.usage).toBeNull());
  });

  it('turns the renewal reminder off', async () => {
    await renderDetail();
    await fireEvent(
      await screen.findByTestId('recurring.subscription.reminder'),
      'valueChange',
      false,
    );
    await waitFor(async () => expect((await service.get(id))?.reminderEnabled).toBe(false));
    expect(await screen.findByText('Desactivado')).toBeTruthy();
  });

  it('says how to cancel it, and that Fynk cancels nothing', async () => {
    await renderDetail();
    expect(await screen.findByText(/Fynk no cancela nada por ti/)).toBeTruthy();
  });

  it('"Ya la cancelé" asks first, then stops counting it and goes back', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    await openFromBilletera();
    await fireEvent.press(screen.getByTestId('recurring.subscription.cancelled'));
    expect(alert).toHaveBeenCalledWith(
      '¿Ya cancelaste Streaming de video?',
      'Dejará de contar en tus gastos y no te recordaremos su renovación.',
      expect.any(Array),
    );
    alert.mock.calls[0]![2]!.find((b) => b.text === 'Sí, ya la cancelé')!.onPress!();
    await waitFor(async () => expect(await service.list()).toEqual([]));
    expect(await screen.findByText('Billetera')).toBeTruthy();
    alert.mockRestore();
  });

  it('"No es una suscripción" turns it into a fixed expense', async () => {
    await openFromBilletera();
    await fireEvent.press(screen.getByTestId('recurring.subscription.notSubscription'));
    await waitFor(async () => expect((await service.get(id))?.kind).toBe('fixed'));
  });

  it('"Editar" opens the form with the item', async () => {
    await renderDetail();
    await fireEvent.press(await screen.findByTestId('recurring.subscription.edit'));
    expect(await screen.findByText(`arrived:${RECURRING_FORM_ROUTE}:${id}`)).toBeTruthy();
  });

  it('says when the item does not exist', async () => {
    await renderDetail('nope');
    expect(await screen.findByText('Esta suscripción ya no existe.')).toBeTruthy();
  });

  it('renders in the dark theme', async () => {
    await renderDetail(id, 'dark');
    expect(await screen.findByTestId('recurring.subscription.summary')).toBeTruthy();
  });
});
