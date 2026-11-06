// Steps 3 · Metas and 4 · Gastos recurrentes (SCRUM-69): the step frame around M8's GoalsSetup
// and M9's RecurringSetup, on a real SQLite vault (sql.js). The other modules' parts are simple
// stand-ins here; M8 and M9 test their own.
import { NavigationContainer } from '@react-navigation/native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { createAppEvents } from '@shared/events/appEvents';
import { createFixedClock, createInMemoryVault, type InMemoryVault } from '@shared/testing';

import { onboardingMigrations } from '../adapters/vault/migrations';
import { createVaultProgressStore } from '../adapters/vault/vaultProgressStore';
import { createOnboardingService, type OnboardingService } from '../application/onboardingService';
import { initialProgress } from '../domain/progress';
import type { StepId } from '../domain/steps';
import { placeholderSteps } from '../testing/placeholderSteps';
import { createEmbeddedStep } from './EmbeddedStep';
import { createOnboardingNavigator } from './OnboardingNavigator';
import { onboardingStrings } from './strings.es-CO';

jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual<{ default: unknown }>('react-native-reanimated');
  return {
    __esModule: true,
    ...actual,
    default: actual.default,
    useReducedMotion: jest.fn(() => true),
  };
});

const NOW = '2026-11-06T15:00:00.000Z';
const copy = onboardingStrings;

let vault: InMemoryVault;
let service: OnboardingService;

async function openOn(step: StepId) {
  vault = await createInMemoryVault();
  vault.registerMigrations('onboarding', onboardingMigrations);
  await vault.migrate();
  const store = createVaultProgressStore(vault.db);
  await store.save({ ...initialProgress, step, completed: ['name', 'accounts'] }, NOW);
  service = createOnboardingService({
    store: () => store,
    clock: createFixedClock(NOW),
    events: createAppEvents(),
  });
  await service.load();
  const Flow = createOnboardingNavigator(service, {
    ...placeholderSteps,
    goals: createEmbeddedStep('goals', () => <Text>GoalsSetup</Text>),
    recurring: createEmbeddedStep('recurring', () => <Text>RecurringSetup</Text>),
  });
  await render(
    <NavigationContainer>
      <Flow />
    </NavigationContainer>,
  );
  await act(async () => {});
}

const saved = () => createVaultProgressStore(vault.db).load();
const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));

afterEach(() => {
  service.dispose();
  vault.close();
});

describe('Metas', () => {
  it('shows step 3 of 4 with the goals setup of M8', async () => {
    await openOn('goals');
    expect(screen.getByText('Paso 3 de 4')).toBeTruthy();
    expect(screen.getByRole('header', { name: copy.steps.goals.title })).toBeTruthy();
    expect(screen.getByText(copy.steps.goals.subtitle)).toBeTruthy();
    expect(screen.getByText('GoalsSetup')).toBeTruthy();
  });

  it('"Continuar" opens step 4 and counts Metas as done', async () => {
    await openOn('goals');
    await press(copy.step.continue);
    await waitFor(() => expect(screen.getByText('Paso 4 de 4')).toBeTruthy());
    expect(screen.getByText('RecurringSetup')).toBeTruthy();
    const progress = await saved();
    expect(progress?.step).toBe('recurring');
    expect(progress?.completed).toContain('goals');
  });

  it('"Omitir" leaves Metas pending and opens step 4', async () => {
    await openOn('goals');
    await press('Omitir');
    await waitFor(() => expect(screen.getByText('Paso 4 de 4')).toBeTruthy());
    expect((await saved())?.skipped).toEqual(['goals']);
  });
});

describe('Gastos recurrentes', () => {
  it('shows step 4 of 4 with the recurring setup of M9 and "Terminar configuración"', async () => {
    await openOn('recurring');
    expect(screen.getByText('Paso 4 de 4')).toBeTruthy();
    expect(screen.getByRole('header', { name: copy.steps.recurring.title })).toBeTruthy();
    expect(screen.getByText('RecurringSetup')).toBeTruthy();
    expect(screen.getByRole('button', { name: copy.step.finish })).toBeTruthy();
  });

  it('back returns to Metas', async () => {
    await openOn('recurring');
    // The screens behind keep their own back button: press the one on top.
    const backButtons = screen.getAllByRole('button', { name: 'Volver' });
    await fireEvent.press(backButtons[backButtons.length - 1]!);
    await waitFor(() => expect(screen.getByText('Paso 3 de 4')).toBeTruthy());
    expect((await saved())?.step).toBe('goals');
  });
});
