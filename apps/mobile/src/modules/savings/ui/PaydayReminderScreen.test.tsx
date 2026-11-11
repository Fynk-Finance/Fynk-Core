// Recordatorio de día de pago (M8 prompt, Recomendaciones "Programar") on a real vault: the
// amount from Recomendaciones and the day from the salary M10 found, "Programar recordatorio",
// editing and removing it, the errors, dark theme, and Metas opening it from M11's params.
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import {
  createFixedClock,
  createInMemoryNotifications,
  createInMemoryVault,
  type InMemoryVault,
} from '@shared/testing';
import { ThemeProvider, type ThemePreference } from '@shared/ui';

import { savingsMigrations } from '../adapters/vault/migrations';
import { createVaultGoalStore } from '../adapters/vault/vaultGoalStore';
import { createVaultPaydayStore } from '../adapters/vault/vaultPaydayStore';
import { createGoalService, type GoalService } from '../application/goalService';
import { createPaydayService, type PaydayService } from '../application/paydayService';
import { METAS_ROUTE, createMetasScreen } from './MetasScreen';
import { PAYDAY_REMINDER_ROUTE, createPaydayReminderScreen } from './PaydayReminderScreen';

const noStore = { load: async () => 'system' as const, save: async () => undefined };
const Stack = createNativeStackNavigator();
const clock = createFixedClock('2026-10-28T15:00:00Z');
const pesos = (n: number) => n * 100;

let vault: InMemoryVault;
let goals: GoalService;
let payday: PaydayService;
let notifications: ReturnType<typeof createInMemoryNotifications>;
let goalId: string;

beforeEach(async () => {
  vault = await createInMemoryVault();
  vault.registerMigrations('savings', savingsMigrations);
  await vault.migrate();
  let n = 0;
  goals = createGoalService({
    store: () => createVaultGoalStore(vault.db),
    clock,
    newId: () => `g${++n}`,
  });
  notifications = createInMemoryNotifications();
  payday = createPaydayService({
    store: () => createVaultPaydayStore(vault.db),
    goals: () => goals.list(),
    notifications,
    clock,
  });
  goalId = await goals.create({
    name: 'Viaje a Cartagena',
    category: 'travel',
    targetMinor: pesos(5_000_000),
    deadline: '2027-06',
  });
});

afterEach(() => vault.close());

function Home() {
  return <Text>Recomendaciones</Text>;
}

async function renderReminder(
  params: { goalId: string; amountMinor?: number },
  preference: ThemePreference = 'light',
) {
  const Reminder = createPaydayReminderScreen({
    goals,
    payday,
    salaryDay: async () => 30,
    homeRoute: 'Home',
  });
  await render(
    <ThemeProvider initialPreference={preference} store={noStore}>
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{ headerShown: false }}
          initialRouteName={PAYDAY_REMINDER_ROUTE}
        >
          <Stack.Screen name="Home" component={Home} />
          <Stack.Screen name={PAYDAY_REMINDER_ROUTE} component={Reminder} initialParams={params} />
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeProvider>,
  );
}

describe('Recordatorio de día de pago', () => {
  it('takes the amount from Recomendaciones and the day from the salary', async () => {
    await renderReminder({ goalId, amountMinor: pesos(300_000) });
    expect(await screen.findByDisplayValue('300.000')).toBeTruthy();
    expect(screen.getByDisplayValue('30')).toBeTruthy();
    expect(screen.getByText('Tomado de tu nómina: llega el día 30.')).toBeTruthy();
    expect(screen.getByText('Fynk no mueve tu dinero: es solo un recordatorio.')).toBeTruthy();
  });

  it('"Programar recordatorio" schedules the monthly reminder', async () => {
    await renderReminder({ goalId, amountMinor: pesos(300_000) });
    await fireEvent.press(await screen.findByTestId('savings.payday.save'));
    await waitFor(() => expect(notifications.scheduled()).toHaveLength(1));
    // Opened by a deep link, it goes home instead of back.
    expect(await screen.findByText('Recomendaciones')).toBeTruthy();
    expect(notifications.scheduled()[0]).toMatchObject({
      fireAt: '2026-10-30T14:00:00.000Z',
      body: 'Hoy es día de pago: aparta $300.000 para Viaje a Cartagena.',
    });
  });

  // SCRUM-97: the amount reads $ 450.000 while it is typed.
  it('shows a typed amount in COP format and schedules it', async () => {
    await renderReminder({ goalId, amountMinor: pesos(300_000) });
    await fireEvent.changeText(await screen.findByTestId('savings.payday.amount'), '450000');
    expect(screen.getByTestId('savings.payday.amount')).toHaveDisplayValue('450.000');
    await fireEvent.press(screen.getByTestId('savings.payday.save'));
    await waitFor(() => expect(notifications.scheduled()).toHaveLength(1));
    expect(notifications.scheduled()[0]?.body).toBe(
      'Hoy es día de pago: aparta $450.000 para Viaje a Cartagena.',
    );
  });

  it('shows the errors of a bad amount and day, and saves nothing', async () => {
    await renderReminder({ goalId, amountMinor: pesos(300_000) });
    await fireEvent.changeText(await screen.findByTestId('savings.payday.amount'), '0');
    await fireEvent.changeText(screen.getByTestId('savings.payday.day'), '40');
    await fireEvent.press(screen.getByTestId('savings.payday.save'));
    expect(await screen.findByText('Escribe un monto mayor a $0.')).toBeTruthy();
    expect(screen.getByText('Escribe un día entre 1 y 31.')).toBeTruthy();
    expect(notifications.scheduled()).toEqual([]);
  });

  it('a saved reminder can be edited or removed, in dark theme', async () => {
    await payday.save(goalId, { amountMinor: pesos(250_000), day: 15 });
    await renderReminder({ goalId }, 'dark');
    expect(await screen.findByDisplayValue('250.000')).toBeTruthy();
    expect(screen.getByDisplayValue('15')).toBeTruthy();
    expect(screen.getByText('Guardar cambios')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('savings.payday.remove'));
    await waitFor(() => expect(notifications.scheduled()).toEqual([]));
    expect(await payday.get(goalId)).toBeNull();
  });
});

describe('from Recomendaciones', () => {
  it('Metas opened with { goalId, paydayAmountMinor } pushes the reminder of that goal', async () => {
    const Metas = createMetasScreen({
      service: goals,
      monthlyIncome: async () => null,
      contributions: { add: async () => 'c1', undo: async () => undefined },
    });
    const Reminder = createPaydayReminderScreen({ goals, payday, salaryDay: async () => null });
    await render(
      <ThemeProvider initialPreference="light" store={noStore}>
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen
              name={METAS_ROUTE}
              component={Metas}
              initialParams={{ goalId, paydayAmountMinor: pesos(300_000) }}
            />
            <Stack.Screen name={PAYDAY_REMINDER_ROUTE} component={Reminder} />
          </Stack.Navigator>
        </NavigationContainer>
      </ThemeProvider>,
    );
    expect(await screen.findByTestId('savings.payday')).toBeTruthy();
    expect(await screen.findByDisplayValue('300.000')).toBeTruthy();
  });
});
