// The goal form (SCRUM-51): create with the live suggested amount of OnbMetas, the field errors,
// edit, delete after the confirmation, and both themes.
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert, Text } from 'react-native';

import { createFixedClock, createInMemoryVault, type InMemoryVault } from '@shared/testing';
import { ThemeProvider, type ThemePreference } from '@shared/ui';

import { savingsMigrations } from '../adapters/vault/migrations';
import { createVaultGoalStore } from '../adapters/vault/vaultGoalStore';
import { createGoalService, type GoalService } from '../application/goalService';
import { GOAL_FORM_ROUTE, createGoalFormScreen } from './GoalFormScreen';

const noStore = { load: async () => 'system' as const, save: async () => undefined };
const Stack = createNativeStackNavigator();
// 28 Oct 2026 in Bogotá.
const clock = createFixedClock('2026-10-28T15:00:00Z');

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

function Home() {
  return <Text>Metas</Text>;
}

async function renderForm(params?: { id: string }, preference: ThemePreference = 'light') {
  const Form = createGoalFormScreen({ service });
  await render(
    <ThemeProvider initialPreference={preference} store={noStore}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={GOAL_FORM_ROUTE}>
          <Stack.Screen name="home" component={Home} />
          <Stack.Screen name={GOAL_FORM_ROUTE} component={Form} initialParams={params} />
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeProvider>,
  );
}

/** Moves the deadline with the chevrons from its start (Apr 2027) to Jun 2027. */
async function toJune2027() {
  await fireEvent.press(screen.getByTestId('savings.form.deadline.next'));
  await fireEvent.press(screen.getByTestId('savings.form.deadline.next'));
}

describe('GoalFormScreen', () => {
  it('creates the OnbMetas goal and shows "8 meses para llegar a $5.000.000 · $625.000"', async () => {
    await renderForm();
    expect(screen.getByText('Nueva meta')).toBeTruthy();
    expect(screen.getByTestId('savings.form.deadline')).toHaveTextContent('Abr 2027');
    await fireEvent.changeText(screen.getByTestId('savings.form.name'), 'Viaje a Cartagena');
    await fireEvent.press(screen.getByTestId('savings.form.category.travel'));
    await fireEvent.changeText(screen.getByTestId('savings.form.target'), '5.000.000');
    await toJune2027();
    expect(screen.getByTestId('savings.form.deadline')).toHaveTextContent('Jun 2027');
    expect(screen.getByTestId('savings.form.suggested')).toHaveTextContent(
      /Aporte mensual sugerido.*8 meses para llegar a \$5\.000\.000.*\$625\.000/,
    );

    await fireEvent.press(screen.getByTestId('savings.form.save'));
    await waitFor(async () => expect(await service.list()).toHaveLength(1));
    expect((await service.list())[0]).toMatchObject({
      name: 'Viaje a Cartagena',
      category: 'travel',
      targetMinor: 500_000_000,
      deadline: '2027-06',
      suggestedMonthlyMinor: 62_500_000,
    });
  });

  it('shows the field errors and saves nothing', async () => {
    await renderForm();
    await fireEvent.press(screen.getByTestId('savings.form.save'));
    expect(await screen.findByText('Escribe un nombre.')).toBeTruthy();
    expect(screen.getByText('Escribe un monto mayor a $0.')).toBeTruthy();
    expect(await service.list()).toEqual([]);
  });

  it('never steps before the current month', async () => {
    await renderForm();
    for (let i = 0; i < 8; i++)
      await fireEvent.press(screen.getByTestId('savings.form.deadline.previous'));
    expect(screen.getByTestId('savings.form.deadline')).toHaveTextContent('Oct 2026');
  });

  it('asks for the amount before suggesting a monthly contribution', async () => {
    await renderForm();
    expect(screen.getByTestId('savings.form.suggested')).toHaveTextContent(
      /Escribe el monto objetivo para calcularlo\./,
    );
  });

  it('edits a goal it opens with its id', async () => {
    const id = await service.create({
      name: 'Fondo de emergencia',
      category: 'emergency',
      targetMinor: 300_000_000,
      deadline: '2027-12',
    });
    await renderForm({ id });
    expect(await screen.findByDisplayValue('Fondo de emergencia')).toBeTruthy();
    expect(screen.getByText('Editar meta')).toBeTruthy();
    expect(screen.getByTestId('savings.form.suggested')).toHaveTextContent(/\$215\.000/);
    await fireEvent.changeText(screen.getByTestId('savings.form.target'), '$3.500.000');
    await fireEvent.press(screen.getByTestId('savings.form.save'));
    await waitFor(async () => expect((await service.get(id))?.targetMinor).toBe(350_000_000));
  });

  it('deletes after the confirmation', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    const id = await service.create({
      name: 'Viaje a Cartagena',
      category: 'travel',
      targetMinor: 500_000_000,
      deadline: '2027-06',
    });
    await renderForm({ id });
    await screen.findByDisplayValue('Viaje a Cartagena');
    await fireEvent.press(screen.getByTestId('savings.form.delete'));
    expect(alert).toHaveBeenCalledWith(
      '¿Eliminar Viaje a Cartagena?',
      'Se borran la meta y los aportes que registraste. Tu dinero no se mueve.',
      expect.any(Array),
    );
    const buttons = alert.mock.calls[0]![2]!;
    buttons.find((b) => b.text === 'Eliminar')!.onPress!();
    await waitFor(async () => expect(await service.list()).toEqual([]));
    alert.mockRestore();
  });

  it('renders in the dark theme', async () => {
    await renderForm(undefined, 'dark');
    expect(screen.getByTestId('savings.form')).toBeTruthy();
    expect(screen.getByText('Aporte mensual sugerido')).toBeTruthy();
  });
});
