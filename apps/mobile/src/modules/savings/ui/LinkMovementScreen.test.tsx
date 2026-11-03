// "Vincular un movimiento" (SCRUM-52 "Asociar un movimiento sincronizado"): the outflows of the
// last 60 days, linking one counts it for the goal and marks it in M7, a movement already linked
// is refused, the empty list, the Bogotá day of a movement, and the dark theme.
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import type { Transaction } from '@shared/domain/types';
import { createFixedClock, createInMemoryVault, type InMemoryVault } from '@shared/testing';
import { ThemeProvider, type ThemePreference } from '@shared/ui';

import { savingsMigrations } from '../adapters/vault/migrations';
import { createVaultContributionStore } from '../adapters/vault/vaultContributionStore';
import { createVaultGoalStore } from '../adapters/vault/vaultGoalStore';
import {
  createContributionService,
  type ContributionService,
} from '../application/contributionService';
import { createGoalService, type GoalService } from '../application/goalService';
import { LINK_MOVEMENT_ROUTE, bookedDay, createLinkMovementScreen } from './LinkMovementScreen';

const noStore = { load: async () => 'system' as const, save: async () => undefined };
const Stack = createNativeStackNavigator();
const clock = createFixedClock('2026-10-28T15:00:00Z');
const pesos = (n: number) => n * 100;

const tx = (id: string, description: string, amount: number, bookedAt: string) =>
  ({
    id,
    accountId: 'a1',
    providerTxId: id,
    source: 'bank',
    bookedAt,
    amountMinor: pesos(amount),
    description,
    merchantRaw: null,
    merchantKey: null,
    categoryId: 'transfers',
    categorySource: 'bank',
    status: 'booked',
    goalId: null,
  }) as Transaction;

let vault: InMemoryVault;
let goals: GoalService;
let contributions: ContributionService;
let inM7: Transaction[];
let marks: Map<string, string | null>;
let goalId: string;

beforeEach(async () => {
  vault = await createInMemoryVault();
  vault.registerMigrations('savings', savingsMigrations);
  await vault.migrate();
  marks = new Map();
  inM7 = [
    tx('t1', 'Transferencia a Ahorros', -300_000, '2026-10-20T17:00:00Z'),
    tx('t2', 'Pago Nequi', -50_000, '2026-10-10T17:00:00Z'),
    tx('t3', 'Nómina', 5_000_000, '2026-10-15T17:00:00Z'),
  ];
  goals = createGoalService({
    store: () => createVaultGoalStore(vault.db),
    clock,
    newId: () => 'g1',
  });
  let c = 0;
  contributions = createContributionService({
    store: () => createVaultContributionStore(vault.db),
    goals: () => createVaultGoalStore(vault.db),
    clock,
    newId: () => `c${++c}`,
    movements: {
      setTransactionGoal: async (id, goal) => {
        marks.set(id, goal);
        inM7 = inM7.map((m) => (m.id === id ? { ...m, goalId: goal } : m));
      },
    },
    listMovements: async () => inM7,
    onChange: () => goals.notifyChanged(),
  });
  goalId = await goals.create({
    name: 'Viaje a Cartagena',
    category: 'travel',
    targetMinor: pesos(5_000_000),
    deadline: '2027-06',
  });
});

afterEach(() => vault.close());

async function renderLink(preference: ThemePreference = 'light') {
  const Link = createLinkMovementScreen({ goals, contributions });
  function Metas({ navigation }: { navigation: { navigate: (r: string, p: object) => void } }) {
    return <Text onPress={() => navigation.navigate(LINK_MOVEMENT_ROUTE, { goalId })}>Metas</Text>;
  }
  await render(
    <ThemeProvider initialPreference={preference} store={noStore}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Metas" component={Metas} />
          <Stack.Screen name={LINK_MOVEMENT_ROUTE} component={Link} />
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeProvider>,
  );
  await fireEvent.press(screen.getByText('Metas'));
  await screen.findByTestId('savings.link');
}

describe('LinkMovementScreen', () => {
  it('lists the outflows of the last 60 days, newest first, without money that came in', async () => {
    await renderLink();
    expect(await screen.findByTestId('savings.link.t1')).toHaveTextContent(
      /Transferencia a Ahorros.*20 oct.*[−-]\$300\.000/,
    );
    expect(screen.getByTestId('savings.link.t2')).toHaveTextContent(/Pago Nequi.*10 oct/);
    expect(screen.queryByTestId('savings.link.t3')).toBeNull();
    expect(screen.getByText(/aporte a Viaje a Cartagena/)).toBeTruthy();
  });

  it('linking a movement counts it for the goal, marks it in M7 and goes back', async () => {
    await renderLink();
    await fireEvent.press(await screen.findByTestId('savings.link.t1'));
    await waitFor(async () => expect((await goals.get(goalId))?.savedMinor).toBe(pesos(300_000)));
    expect(marks.get('t1')).toBe(goalId);
    expect(await screen.findByText('Metas')).toBeTruthy();
  });

  it('a movement that already counts for a goal is not offered again', async () => {
    await contributions.linkMovement(goalId, inM7[0]!);
    await renderLink();
    await screen.findByTestId('savings.link.t2');
    expect(screen.queryByTestId('savings.link.t1')).toBeNull();
  });

  it('says when there is nothing to link', async () => {
    inM7 = [];
    await renderLink();
    expect(
      await screen.findByText('No hay salidas para vincular en los últimos 60 días.'),
    ).toBeTruthy();
  });

  it('renders in the dark theme', async () => {
    await renderLink('dark');
    expect(await screen.findByTestId('savings.link.t1')).toBeTruthy();
  });
});

describe('bookedDay', () => {
  it('uses the day in Bogotá: 03:00 UTC on 1 Nov is still 31 oct', () => {
    expect(bookedDay('2026-11-01T03:00:00Z')).toBe('31 oct');
  });
});
