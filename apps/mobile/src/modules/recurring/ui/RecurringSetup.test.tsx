// Onboarding step 5, "Gastos recurrentes" (design OnbGastos), on a real vault: the design's four
// items with "4 gastos" and "Total mensual · Te avisaremos de 2 pagos · $1.453.900", a new card
// open when there are none, editing and deleting one, the errors and dark theme.
import { fireEvent, render, screen, within } from '@testing-library/react-native';

import { createFixedClock, createInMemoryVault, type InMemoryVault } from '@shared/testing';
import { ThemeProvider, type ThemePreference } from '@shared/ui';

import { recurringMigrations } from '../adapters/vault/migrations';
import { createVaultRecurringStore } from '../adapters/vault/vaultRecurringStore';
import { createRecurringService, type RecurringService } from '../application/recurringService';
import type { RecurringInput } from '../domain/item';
import { createRecurringSetup } from './RecurringSetup';

const noStore = { load: async () => 'system' as const, save: async () => undefined };
const clock = createFixedClock('2026-10-28T15:00:00Z');
const pesos = (n: number) => n * 100;

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

const monthly = (
  name: string,
  categoryId: RecurringInput['categoryId'],
  amount: number,
  day: number,
  reminderEnabled: boolean,
  kind: RecurringInput['kind'] = 'fixed',
): RecurringInput => ({
  kind,
  name,
  categoryId,
  amountMinor: pesos(amount),
  schedule: { periodicity: 'monthly', anchorDay: day },
  reminderEnabled,
});

async function addDesignItems() {
  await service.create(monthly('Arriendo', 'rent', 1_200_000, 5, true));
  await service.create(monthly('Internet y celular', 'telecom', 95_000, 12, true));
  await service.create(monthly('Streaming', 'subscriptions', 38_900, 18, false, 'subscription'));
  await service.create(monthly('Gimnasio', 'gym', 120_000, 1, false));
}

async function renderSetup(preference: ThemePreference = 'light') {
  const RecurringSetup = createRecurringSetup({ service });
  await render(
    <ThemeProvider initialPreference={preference} store={noStore}>
      <RecurringSetup />
    </ThemeProvider>,
  );
}

describe('Gastos recurrentes (onboarding step 5)', () => {
  it('shows the design: 4 gastos, each card and Total mensual de $1.453.900', async () => {
    await addDesignItems();
    await renderSetup();
    const setup = await screen.findByTestId('recurring.setup');
    expect(setup).toHaveTextContent(/Tus gastos recurrentes.*4 gastos/);
    // The app names the category with the shared labels: "Arriendo" where the design says
    // "Vivienda".
    expect(screen.getByTestId('recurring.setup.r1')).toHaveTextContent(
      /Arriendo.*Arriendo · día 5.*\$1\.200\.000/,
    );
    expect(screen.getByTestId('recurring.setup.total')).toHaveTextContent(
      /Total mensual.*Te avisaremos de 2 pagos.*\$1\.453\.900/,
    );
    expect(screen.queryByTestId('recurring.setup.new')).toBeNull();
  });

  it('opens a new item when there are none, saves it and updates the total', async () => {
    await renderSetup();
    await fireEvent.changeText(await screen.findByTestId('recurring.setup.new.name'), 'Arriendo');
    // The categories are a dropdown (QA review 2026-11-07, V11): open it, then pick.
    await fireEvent.press(screen.getByTestId('recurring.setup.new.category'));
    await fireEvent.press(screen.getByTestId('recurring.setup.new.category.rent'));
    await fireEvent.changeText(screen.getByTestId('recurring.setup.new.amount'), '1.200.000');
    await fireEvent.changeText(screen.getByTestId('recurring.setup.new.day'), '5');
    await fireEvent.press(screen.getByTestId('recurring.setup.new.save'));
    expect(await screen.findByTestId('recurring.setup.r1')).toHaveTextContent(/Arriendo/);
    expect(screen.getByTestId('recurring.setup')).toHaveTextContent(/1 gasto/);
    expect(screen.getByTestId('recurring.setup.total')).toHaveTextContent(/\$1\.200\.000/);
    expect(screen.getByTestId('recurring.setup.add')).toHaveTextContent('Agregar gasto recurrente');
  });

  it('shows the errors and saves nothing when the item is not valid', async () => {
    await renderSetup();
    await fireEvent.press(await screen.findByTestId('recurring.setup.new.save'));
    expect(await screen.findByText('Escribe un nombre.')).toBeTruthy();
    expect(await service.list()).toEqual([]);
  });

  it('edits and deletes an item, in dark theme', async () => {
    await addDesignItems();
    await renderSetup('dark');
    await fireEvent.press(await screen.findByTestId('recurring.setup.r4.toggle'));
    await fireEvent.changeText(screen.getByTestId('recurring.setup.r4.amount'), '130.000');
    await fireEvent.press(screen.getByTestId('recurring.setup.r4.save'));
    const gym = await screen.findByTestId('recurring.setup.r4');
    expect(within(gym).getByText('$130.000')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('recurring.setup.r4.toggle'));
    await fireEvent.press(screen.getByTestId('recurring.setup.r4.delete'));
    expect(await screen.findByText('3 gastos')).toBeTruthy();
    expect(screen.queryByTestId('recurring.setup.r4')).toBeNull();
  });
});
