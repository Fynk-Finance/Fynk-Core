// Onboarding step 4, "Crea tus metas" (design OnbMetas), on a real vault: a new card open when
// there are no goals, saving it, the collapsed "Viaje · $5.000.000" card, editing and deleting
// one, "Agregar otra meta", the live suggested amount, the errors and dark theme.
import { fireEvent, render, screen } from '@testing-library/react-native';

import { createFixedClock, createInMemoryVault, type InMemoryVault } from '@shared/testing';
import { ThemeProvider, type ThemePreference } from '@shared/ui';

import { savingsMigrations } from '../adapters/vault/migrations';
import { createVaultGoalStore } from '../adapters/vault/vaultGoalStore';
import { createGoalService, type GoalService } from '../application/goalService';
import { createGoalsSetup } from './GoalsSetup';

const noStore = { load: async () => 'system' as const, save: async () => undefined };
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

async function renderSetup(preference: ThemePreference = 'light') {
  const GoalsSetup = createGoalsSetup({ service });
  await render(
    <ThemeProvider initialPreference={preference} store={noStore}>
      <GoalsSetup />
    </ThemeProvider>,
  );
}

async function fillTrip(prefix = 'savings.setup.new') {
  await fireEvent.changeText(await screen.findByTestId(`${prefix}.name`), 'Viaje a Cartagena');
  // The categories are a dropdown (QA review 2026-11-07, V11): open it, then pick.
  await fireEvent.press(screen.getByTestId(`${prefix}.category`));
  await fireEvent.press(screen.getByTestId(`${prefix}.category.travel`));
  await fireEvent.changeText(screen.getByTestId(`${prefix}.target`), '5.000.000');
  // The form starts 6 months ahead (Apr 2027); two more give the design's Jun 2027, "8 meses · $625.000".
  for (let i = 0; i < 2; i++) await fireEvent.press(screen.getByTestId(`${prefix}.deadline.next`));
}

describe('Crea tus metas (onboarding step 4)', () => {
  it('opens a new goal with the live suggested amount of the design, and saves it', async () => {
    await renderSetup();
    await fillTrip();
    expect(screen.getByTestId('savings.setup.new.suggested')).toHaveTextContent(
      /8 meses para llegar a \$5\.000\.000.*\$625\.000/,
    );
    await fireEvent.press(screen.getByTestId('savings.setup.new.save'));
    const card = await screen.findByTestId('savings.setup.g1');
    expect(card).toHaveTextContent(/Viaje a Cartagena.*Viaje · \$5\.000\.000/);
    expect(screen.queryByTestId('savings.setup.new')).toBeNull();
    expect(screen.getByTestId('savings.setup.add')).toHaveTextContent('Agregar otra meta');
    expect(await service.list()).toMatchObject([
      { name: 'Viaje a Cartagena', targetMinor: pesos(5_000_000), deadline: '2027-06' },
    ]);
  });

  it('shows the errors and saves nothing when the goal is not valid', async () => {
    await renderSetup();
    await fireEvent.press(await screen.findByTestId('savings.setup.new.save'));
    expect(await screen.findByText('Escribe un nombre.')).toBeTruthy();
    expect(screen.getByText('Escribe un monto mayor a $0.')).toBeTruthy();
    expect(await service.list()).toEqual([]);
    expect(screen.getByTestId('savings.setup.new')).toBeTruthy();
  });

  it('opens a saved goal to edit it, and deletes it', async () => {
    await service.create({
      name: 'Fondo de emergencia',
      category: 'emergency',
      targetMinor: pesos(3_000_000),
      deadline: '2027-12',
    });
    await renderSetup();
    const card = await screen.findByTestId('savings.setup.g1');
    expect(card).toHaveTextContent(/Fondo de emergencia · \$3\.000\.000/);
    expect(screen.queryByTestId('savings.setup.new')).toBeNull();

    await fireEvent.press(screen.getByTestId('savings.setup.g1.toggle'));
    await fireEvent.changeText(screen.getByTestId('savings.setup.g1.name'), 'Colchón');
    await fireEvent.press(screen.getByTestId('savings.setup.g1.save'));
    expect(await screen.findByText('Colchón')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('savings.setup.g1.toggle'));
    await fireEvent.press(screen.getByTestId('savings.setup.g1.delete'));
    expect(await screen.findByTestId('savings.setup.new')).toBeTruthy();
    expect(await service.list()).toEqual([]);
  });

  it('"Agregar otra meta" opens a new card, in dark theme', async () => {
    await service.create({
      name: 'Fondo de emergencia',
      category: 'emergency',
      targetMinor: pesos(3_000_000),
      deadline: '2027-12',
    });
    await renderSetup('dark');
    await fireEvent.press(await screen.findByTestId('savings.setup.add'));
    await fillTrip();
    await fireEvent.press(screen.getByTestId('savings.setup.new.save'));
    expect(await screen.findByTestId('savings.setup.g2')).toBeTruthy();
    expect(await service.list()).toHaveLength(2);
  });
});
