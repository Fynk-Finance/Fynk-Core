// The recurring form (SCRUM-54): add, edit and delete, with the field errors, in both themes.
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert, Text } from 'react-native';

import { createFixedClock, createInMemoryVault, type InMemoryVault } from '@shared/testing';
import { ThemeProvider, type ThemePreference } from '@shared/ui';

import { recurringMigrations } from '../adapters/vault/migrations';
import { createVaultRecurringStore } from '../adapters/vault/vaultRecurringStore';
import { createRecurringService, type RecurringService } from '../application/recurringService';
import { WEEKDAY } from '../domain/types';
import { RECURRING_FORM_ROUTE, createRecurringFormScreen } from './RecurringFormScreen';

const noStore = { load: async () => 'system' as const, save: async () => undefined };
const Stack = createNativeStackNavigator();
const clock = createFixedClock('2026-10-28T15:00:00Z');

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

function Home() {
  return <Text>Billetera</Text>;
}

async function renderForm(params?: { id: string }, preference: ThemePreference = 'light') {
  const Form = createRecurringFormScreen({ service });
  await render(
    <ThemeProvider initialPreference={preference} store={noStore}>
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{ headerShown: false }}
          initialRouteName={RECURRING_FORM_ROUTE}
        >
          <Stack.Screen name="home" component={Home} />
          <Stack.Screen name={RECURRING_FORM_ROUTE} component={Form} initialParams={params} />
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeProvider>,
  );
}

describe('RecurringFormScreen', () => {
  it('adds a monthly fixed expense', async () => {
    await renderForm();
    expect(screen.getByText('Nuevo gasto recurrente')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('recurring.form.name'), 'Arriendo');
    await fireEvent.press(screen.getByTestId('recurring.form.category.rent'));
    await fireEvent.changeText(screen.getByTestId('recurring.form.amount'), '1.400.000');
    await fireEvent.changeText(screen.getByTestId('recurring.form.day'), '1');
    await fireEvent.press(screen.getByTestId('recurring.form.save'));

    await waitFor(async () => expect(await service.list()).toHaveLength(1));
    expect((await service.list())[0]).toMatchObject({
      name: 'Arriendo',
      categoryId: 'rent',
      amountMinor: 140_000_000,
      schedule: { periodicity: 'monthly', anchorDay: 1 },
    });
  });

  it('shows the field errors and saves nothing', async () => {
    await renderForm();
    await fireEvent.press(screen.getByTestId('recurring.form.save'));
    expect(await screen.findByText('Escribe un nombre.')).toBeTruthy();
    expect(screen.getByText('Escribe un monto mayor a $0.')).toBeTruthy();
    expect(screen.getByText('Escribe un día del 1 al 31.')).toBeTruthy();
    expect(await service.list()).toEqual([]);
  });

  it('adds a weekly subscription on the chosen day', async () => {
    await renderForm();
    await fireEvent.changeText(screen.getByTestId('recurring.form.name'), 'Clases');
    await fireEvent.changeText(screen.getByTestId('recurring.form.amount'), '50000');
    await fireEvent.press(screen.getByText('Semanal'));
    await fireEvent.press(screen.getByTestId('recurring.form.weekday.3')); // Wednesday
    await fireEvent.press(screen.getByText('Suscripción'));
    await fireEvent.press(screen.getByTestId('recurring.form.save'));

    await waitFor(async () => expect(await service.list()).toHaveLength(1));
    expect((await service.list())[0]).toMatchObject({
      kind: 'subscription',
      schedule: { periodicity: 'weekly', weekdaysMask: WEEKDAY.wed },
    });
  });

  it('edits an item it opens with its id', async () => {
    const id = await service.create({
      kind: 'fixed',
      name: 'Gimnasio',
      amountMinor: 2_225_000,
      schedule: { periodicity: 'weekly', weekdaysMask: WEEKDAY.mon },
      categoryId: 'gym',
    });
    await renderForm({ id });
    expect(await screen.findByDisplayValue('Gimnasio')).toBeTruthy();
    expect(screen.getByText('Editar gasto recurrente')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('recurring.form.amount'), '$25.000');
    await fireEvent.press(screen.getByTestId('recurring.form.save'));
    await waitFor(async () => expect((await service.get(id))?.amountMinor).toBe(2_500_000));
  });

  it('marks how much a subscription is used, only for subscriptions (SCRUM-56)', async () => {
    const id = await service.create({
      kind: 'subscription',
      name: 'Streaming de series',
      amountMinor: 3_290_000,
      schedule: { periodicity: 'monthly', anchorDay: 2 },
      categoryId: 'subscriptions',
    });
    await renderForm({ id });
    expect(await screen.findByText('¿Cuánto la usas?')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('recurring.form.usage.low'));
    await fireEvent.press(screen.getByTestId('recurring.form.save'));
    await waitFor(async () => expect((await service.get(id))?.usage).toBe('low'));
  });

  it('a fixed expense does not ask how much it is used', async () => {
    await renderForm();
    expect(screen.queryByText('¿Cuánto la usas?')).toBeNull();
  });

  it('deletes after the confirmation', async () => {
    const id = await service.create({
      kind: 'fixed',
      name: 'Arriendo',
      amountMinor: 140_000_000,
      schedule: { periodicity: 'monthly', anchorDay: 1 },
      categoryId: 'rent',
    });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.text === 'Eliminar')?.onPress?.();
    });
    await renderForm({ id });
    await fireEvent.press(await screen.findByTestId('recurring.form.delete'));
    expect(alert.mock.calls[0]?.[0]).toBe('¿Eliminar Arriendo?');
    await waitFor(async () => expect(await service.list()).toEqual([]));
    alert.mockRestore();
  });

  it('renders in the dark theme', async () => {
    await renderForm(undefined, 'dark');
    expect(screen.getByText('Nuevo gasto recurrente')).toBeTruthy();
  });
});
