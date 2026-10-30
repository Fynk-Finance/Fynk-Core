// Metas de ahorro (SCRUM-51, design Metas): several goals by deadline with the numbers of the
// design, expanding a goal, editing it, "Nueva meta", the stats card, "Metas cumplidas", the
// empty state and both themes.
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import type { MoneyMinor } from '@shared/domain/types';
import { createFixedClock, createInMemoryVault, type InMemoryVault } from '@shared/testing';
import { ThemeProvider, type ThemePreference } from '@shared/ui';

import { savingsMigrations } from '../adapters/vault/migrations';
import { createVaultGoalStore } from '../adapters/vault/vaultGoalStore';
import { createGoalService, type GoalService } from '../application/goalService';
import type { GoalInput } from '../domain/goal';
import { GOAL_FORM_ROUTE } from './GoalFormScreen';
import { METAS_ROUTE, createMetasScreen } from './MetasScreen';

const noStore = { load: async () => 'system' as const, save: async () => undefined };
const Stack = createNativeStackNavigator();
// 28 Oct 2026 in Bogotá.
const clock = createFixedClock('2026-10-28T15:00:00Z');
const pesos = (n: number) => n * 100;

let vault: InMemoryVault;
let service: GoalService;

beforeEach(async () => {
  vault = await createInMemoryVault();
  vault.registerMigrations('savings', savingsMigrations);
  await vault.migrate();
  let n = 0;
  service = createGoalService({
    store: () => createVaultGoalStore(vault.db),
    clock,
    newId: () => `g${++n}`,
  });
});

afterEach(() => vault.close());

const goal = (name: string, category: GoalInput['category'], target: number, deadline: string) =>
  ({ name, category, targetMinor: pesos(target), deadline }) satisfies GoalInput;

/** The four goals of the design's "Próximas metas", with their saved amounts. */
async function addDesignGoals() {
  const ids = [
    await service.create(goal('Viaje a Cartagena', 'travel', 5_000_000, '2027-06')),
    await service.create(goal('Regalos de Navidad', 'other', 800_000, '2026-12')),
    await service.create(goal('Fondo de emergencia', 'emergency', 10_000_000, '2027-12')),
  ];
  const saved = [3_200_000, 520_000, 4_860_000];
  for (const [i, id] of ids.entries()) await contribute(id, saved[i]!, '2026-10-05', `c${i}`);
  return ids;
}

async function contribute(goalId: string, amount: number, on: string, id: string) {
  await vault.db.execute(
    `INSERT INTO savings_contributions (id, goal_id, amount_minor, contributed_on, source)
     VALUES (?, ?, ?, ?, 'manual')`,
    [id, goalId, pesos(amount), on],
  );
}

function Target({ route }: { route: { name: string; params?: { id?: string } } }) {
  return <Text>{`arrived:${route.name}:${route.params?.id ?? ''}`}</Text>;
}

async function renderMetas(
  preference: ThemePreference = 'light',
  income: MoneyMinor | null = null,
) {
  const Metas = createMetasScreen({ service, monthlyIncome: async () => income });
  await render(
    <ThemeProvider initialPreference={preference} store={noStore}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name={METAS_ROUTE} component={Metas} />
          <Stack.Screen name={GOAL_FORM_ROUTE} component={Target} />
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeProvider>,
  );
}

describe('Metas', () => {
  it('lists the goals by deadline with the numbers of the design', async () => {
    await addDesignGoals();
    await renderMetas();
    const list = await screen.findByTestId('savings.metas.upcoming');
    expect(list).toHaveTextContent(
      /Próximas metas.*Por fecha límite.*Regalos de Navidad.*Viaje a Cartagena.*Fondo de emergencia/,
    );
    expect(screen.getByTestId('savings.goal.g2')).toHaveTextContent(
      /Regalos de Navidad.*Otro · Dic 2026.*\$520\.000.*de \$800\.000.*Faltan 2 meses.*65%/,
    );
    expect(screen.getByTestId('savings.goal.g1')).toHaveTextContent(
      /Viaje · Jun 2027.*\$3\.200\.000.*de \$5\.000\.000.*Faltan 8 meses.*64%/,
    );
    expect(screen.getByTestId('savings.goal.g3')).toHaveTextContent(/Faltan 14 meses.*48%/);
    expect(screen.getByText('3 activas')).toBeTruthy();
  });

  it('expands a goal to "Aporte sugerido $140.000/mes" and "Te falta $280.000"', async () => {
    await addDesignGoals();
    await renderMetas();
    expect(screen.queryByTestId('savings.goal.g2.body')).toBeNull();
    await fireEvent.press(await screen.findByTestId('savings.goal.g2.head'));
    expect(screen.getByTestId('savings.goal.g2.body')).toHaveTextContent(
      /Aporte sugerido.*\$140\.000.*\/mes.*Te falta.*\$280\.000/,
    );
    // Only one goal is open at a time; tapping it again closes it.
    await fireEvent.press(screen.getByTestId('savings.goal.g1.head'));
    expect(screen.queryByTestId('savings.goal.g2.body')).toBeNull();
    await fireEvent.press(screen.getByTestId('savings.goal.g1.head'));
    expect(screen.queryByTestId('savings.goal.g1.body')).toBeNull();
  });

  it('"Editar meta" opens the form with the goal', async () => {
    await addDesignGoals();
    await renderMetas();
    await fireEvent.press(await screen.findByTestId('savings.goal.g1.head'));
    await fireEvent.press(screen.getByTestId('savings.goal.g1.edit'));
    expect(await screen.findByText(`arrived:${GOAL_FORM_ROUTE}:g1`)).toBeTruthy();
  });

  it('"Nueva meta" opens the empty form', async () => {
    await addDesignGoals();
    await renderMetas();
    await fireEvent.press(await screen.findByTestId('savings.metas.fab'));
    expect(await screen.findByText(`arrived:${GOAL_FORM_ROUTE}:`)).toBeTruthy();
  });

  it('shows Ahorrado, Abonado este mes and Cumplidas', async () => {
    const [trip] = await addDesignGoals();
    await contribute(trip!, 100_000, '2026-09-30', 'last-month');
    await renderMetas();
    expect(await screen.findByTestId('savings.metas.stats')).toHaveTextContent(
      /Ahorrado.*\$8\.680\.000.*Abonado este mes.*\+\$8\.580\.000.*Cumplidas.*0/,
    );
  });

  it('shows "23 % de tus ingresos" when M10 gives the income', async () => {
    await service.create(goal('Viaje a Cartagena', 'travel', 5_000_000, '2027-06'));
    await renderMetas('light', pesos(2_720_000));
    expect(await screen.findByTestId('savings.metas.stats')).toHaveTextContent(
      /23 %.*de tus ingresos va a tus metas.*\$625\.000 al mes de \$2\.720\.000/,
    );
  });

  it('without the income it says how much goes to the goals each month', async () => {
    await service.create(goal('Viaje a Cartagena', 'travel', 5_000_000, '2027-06'));
    await renderMetas();
    expect(await screen.findByTestId('savings.metas.stats')).toHaveTextContent(
      /\$625\.000 al mes van a tus metas/,
    );
  });

  it('moves a reached goal to "Metas cumplidas" with the month it was reached', async () => {
    const phone = await service.create(goal('Celular nuevo', 'other', 1_800_000, '2026-12'));
    await contribute(phone, 1_800_000, '2026-08-20', 'phone');
    await service.create(goal('Viaje a Cartagena', 'travel', 5_000_000, '2027-06'));
    await renderMetas();
    const done = await screen.findByTestId('savings.metas.done');
    expect(done).toHaveTextContent(
      /Metas cumplidas.*1 meta.*Has ahorrado \$1\.800\.000 en metas cumplidas/,
    );
    expect(screen.getByTestId(`savings.done.${phone}`)).toHaveTextContent(
      /Celular nuevo.*Otro · Cumplida en ago 2026.*\$1\.800\.000/,
    );
    expect(screen.getByTestId('savings.metas.upcoming')).not.toHaveTextContent(/Celular/);
    expect(screen.getByText('1 activa')).toBeTruthy();
  });

  it('shows the empty state, whose button opens the form', async () => {
    await renderMetas();
    expect(await screen.findByText('Aún no tienes metas')).toBeTruthy();
    await fireEvent.press(screen.getByText('Crear meta'));
    expect(await screen.findByText(`arrived:${GOAL_FORM_ROUTE}:`)).toBeTruthy();
  });

  it('shows a new goal as soon as it is created', async () => {
    await renderMetas();
    await screen.findByText('Aún no tienes metas');
    await service.create(goal('Viaje a Cartagena', 'travel', 5_000_000, '2027-06'));
    await waitFor(() => expect(screen.getByTestId('savings.goal.g1')).toBeTruthy());
  });

  it('renders in the dark theme', async () => {
    await addDesignGoals();
    await renderMetas('dark');
    expect(await screen.findByTestId('savings.metas.stats')).toBeTruthy();
    expect(screen.getByText('Metas de ahorro')).toBeTruthy();
  });
});
