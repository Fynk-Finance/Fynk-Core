// "Planes de ahorro" of the Dashboard (SCRUM-51: "Disponible ... desde el Dashboard"): cards with
// the numbers of the design, only goals not reached, "Ver todos" and a card open Metas, the card
// to create the first goal, and both themes.
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { createFixedClock, createInMemoryVault, type InMemoryVault } from '@shared/testing';
import { ThemeProvider, type ThemePreference } from '@shared/ui';

import { savingsMigrations } from '../adapters/vault/migrations';
import { createVaultGoalStore } from '../adapters/vault/vaultGoalStore';
import { createGoalService, type GoalService } from '../application/goalService';
import { GOAL_FORM_ROUTE } from './GoalFormScreen';
import { createGoalsCarousel } from './GoalsCarousel';
import { METAS_ROUTE } from './MetasScreen';

const noStore = { load: async () => 'system' as const, save: async () => undefined };
const Stack = createNativeStackNavigator();
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

async function addGoal(name: string, target: number, saved: number, deadline = '2027-06') {
  const id = await service.create({
    name,
    category: 'travel',
    targetMinor: pesos(target),
    deadline,
  });
  if (saved > 0)
    await vault.db.execute(
      `INSERT INTO savings_contributions (id, goal_id, amount_minor, contributed_on, source)
       VALUES (?, ?, ?, '2026-10-01', 'manual')`,
      [`c-${id}`, id, pesos(saved)],
    );
  return id;
}

function Target({ route }: { route: { name: string } }) {
  return <Text>{`arrived:${route.name}`}</Text>;
}

async function renderCarousel(preference: ThemePreference = 'light') {
  const Carousel = createGoalsCarousel({ service });
  const Home = () => <Carousel />;
  await render(
    <ThemeProvider initialPreference={preference} store={noStore}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="home" component={Home} />
          <Stack.Screen name={METAS_ROUTE} component={Target} />
          <Stack.Screen name={GOAL_FORM_ROUTE} component={Target} />
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeProvider>,
  );
}

describe('GoalsCarousel', () => {
  it('shows "Viaje a Cartagena · $3.200.000 · 64%", as in the Dashboard design', async () => {
    await addGoal('Viaje a Cartagena', 5_000_000, 3_200_000);
    await renderCarousel();
    expect(await screen.findByTestId('savings.carousel.g1')).toHaveTextContent(
      /Viaje a Cartagena.*\$3\.200\.000.*64%/,
    );
    expect(screen.getByText('Planes de ahorro')).toBeTruthy();
  });

  it('leaves out the goals already reached', async () => {
    await addGoal('Viaje a Cartagena', 5_000_000, 3_200_000);
    await addGoal('Celular nuevo', 1_800_000, 1_800_000, '2026-12');
    await renderCarousel();
    await screen.findByTestId('savings.carousel.g1');
    expect(screen.queryByTestId('savings.carousel.g2')).toBeNull();
  });

  it('"Ver todos" opens Metas', async () => {
    await addGoal('Viaje a Cartagena', 5_000_000, 0);
    await renderCarousel();
    await fireEvent.press(await screen.findByText('Ver todos'));
    expect(await screen.findByText(`arrived:${METAS_ROUTE}`)).toBeTruthy();
  });

  it('a card opens Metas', async () => {
    await addGoal('Viaje a Cartagena', 5_000_000, 0);
    await renderCarousel();
    await fireEvent.press(await screen.findByTestId('savings.carousel.g1'));
    expect(await screen.findByText(`arrived:${METAS_ROUTE}`)).toBeTruthy();
  });

  // QA review 2026-11-07, V2 (SCRUM-77): the empty card is a still ghost of a goal card.
  it('without goals, shows a ghost card whose button creates the first one', async () => {
    await renderCarousel();
    expect(await screen.findByTestId('savings.carousel.new')).toHaveStyle({
      width: '100%',
      height: 112,
      borderRadius: 18,
    });
    const create = screen.getByRole('button', { name: 'Crear meta' });
    expect(create.props.accessibilityHint).toBe('Aún no tienes metas');
    await fireEvent.press(create);
    expect(await screen.findByText(`arrived:${GOAL_FORM_ROUTE}`)).toBeTruthy();
  });

  it('shows the ghost card when every goal is reached', async () => {
    await addGoal('Viaje a Cartagena', 1_000_000, 1_000_000);
    await renderCarousel();
    expect(await screen.findByTestId('savings.carousel.new')).toBeTruthy();
    expect(screen.queryByTestId('savings.carousel.g1')).toBeNull();
  });

  it('renders in the dark theme', async () => {
    await addGoal('Viaje a Cartagena', 5_000_000, 3_200_000);
    await renderCarousel('dark');
    expect(await screen.findByTestId('savings.carousel.g1')).toBeTruthy();
  });
});
