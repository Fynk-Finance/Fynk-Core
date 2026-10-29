// Step 1 · Nombre (SCRUM-69): "Continuar" only for a valid name, the name saved with PATCH /me
// before the next step, and the field filled with the saved name.
import { NavigationContainer } from '@react-navigation/native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { ApiError } from '@shared/api';
import { createAppEvents } from '@shared/events/appEvents';
import { createFixedClock, createInMemoryVault, type InMemoryVault } from '@shared/testing';

import { onboardingMigrations } from '../adapters/vault/migrations';
import { createVaultProgressStore } from '../adapters/vault/vaultProgressStore';
import { createOnboardingService, type OnboardingService } from '../application/onboardingService';
import type { NamePort } from '../application/ports';
import { initialProgress } from '../domain/progress';
import { createNameStep } from './NameStepScreen';
import { createOnboardingNavigator, placeholderSteps } from './OnboardingNavigator';
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

const NOW = '2026-10-29T15:00:00.000Z';
const copy = onboardingStrings;

let vault: InMemoryVault;
let service: OnboardingService;

function fakeNames(saved: { firstName?: string; lastName?: string } = {}) {
  return {
    getName: jest.fn<ReturnType<NamePort['getName']>, []>(async () => saved),
    saveName: jest.fn<ReturnType<NamePort['saveName']>, Parameters<NamePort['saveName']>>(
      async () => undefined,
    ),
  };
}

async function openNameStep(names: NamePort) {
  vault = await createInMemoryVault();
  vault.registerMigrations('onboarding', onboardingMigrations);
  await vault.migrate();
  const store = createVaultProgressStore(vault.db);
  await store.save({ ...initialProgress, step: 'name' }, NOW);
  service = createOnboardingService({
    store: () => store,
    clock: createFixedClock(NOW),
    events: createAppEvents(),
  });
  await service.load();
  const Flow = createOnboardingNavigator(service, {
    ...placeholderSteps,
    name: createNameStep(names),
  });
  await render(
    <NavigationContainer>
      <Flow />
    </NavigationContainer>,
  );
  await act(async () => {});
}

const saved = () => createVaultProgressStore(vault.db).load();
const field = () => screen.getByTestId('onboarding.name.field');
const continueButton = () => screen.getByRole('button', { name: copy.step.continue });

afterEach(() => {
  service.dispose();
  vault.close();
});

describe('Nombre', () => {
  it('shows step 1 of 4 with the design copy', async () => {
    await openNameStep(fakeNames());
    expect(screen.getByText('Paso 1 de 4')).toBeTruthy();
    expect(screen.getByRole('header', { name: copy.steps.name.title })).toBeTruthy();
    expect(screen.getByText(copy.steps.name.subtitle)).toBeTruthy();
    expect(screen.getByText(copy.name.hint)).toBeTruthy();
    expect(screen.getByText(copy.name.label)).toBeTruthy();
  });

  it('keeps "Continuar" disabled until a name is typed', async () => {
    await openNameStep(fakeNames());
    expect(continueButton()).toBeDisabled();
    await fireEvent.changeText(field(), 'Laura');
    expect(continueButton()).toBeEnabled();
  });

  it('greets with the first word typed', async () => {
    await openNameStep(fakeNames());
    expect(screen.queryByTestId('onboarding.name.greeting')).toBeNull();
    await fireEvent.changeText(field(), 'Laura Gómez');
    expect(screen.getByTestId('onboarding.name.greeting')).toHaveTextContent('Hola, Laura!');
  });

  it('saves the first word as the first name and the rest as the last name, then goes on', async () => {
    const names = fakeNames();
    await openNameStep(names);
    await fireEvent.changeText(field(), '  Laura Gómez Ruiz ');
    await fireEvent.press(continueButton());

    expect(names.saveName).toHaveBeenCalledWith({ firstName: 'Laura', lastName: 'Gómez Ruiz' });
    await waitFor(() => expect(screen.getByText('Paso 2 de 4')).toBeTruthy());
    expect(await saved()).toMatchObject({ step: 'accounts', completed: ['name'] });
  });

  it('explains a name the API would refuse and does not save it', async () => {
    const names = fakeNames();
    await openNameStep(names);
    await fireEvent.changeText(field(), 'Laura2');
    expect(screen.getByText(copy.name.errors.invalid)).toBeTruthy();
    expect(continueButton()).toBeDisabled();
    await fireEvent(field(), 'submitEditing');
    expect(names.saveName).not.toHaveBeenCalled();
  });

  it('stays on the step when the name cannot be saved', async () => {
    const names = fakeNames();
    names.saveName.mockRejectedValue(ApiError.network());
    await openNameStep(names);
    await fireEvent.changeText(field(), 'Laura');
    await fireEvent.press(continueButton());

    expect(await screen.findByText(copy.name.errors.notSaved)).toBeTruthy();
    expect(await saved()).toMatchObject({ step: 'name', completed: [] });
  });

  it('shows the name rule when the API answers invalid_profile', async () => {
    const names = fakeNames();
    names.saveName.mockRejectedValue(
      new ApiError({ status: 400, code: 'invalid_profile', title: 'Invalid profile' }),
    );
    await openNameStep(names);
    await fireEvent.changeText(field(), 'Laura');
    await fireEvent.press(continueButton());
    expect(await screen.findByText(copy.name.errors.invalid)).toBeTruthy();
  });

  it('starts with the saved name', async () => {
    await openNameStep(fakeNames({ firstName: 'Laura', lastName: 'Gómez' }));
    expect(field().props.value).toBe('Laura Gómez');
    expect(continueButton()).toBeEnabled();
  });

  it('never replaces what the person already typed with the saved name', async () => {
    let answer: (value: { firstName?: string }) => void = () => undefined;
    const names = fakeNames();
    names.getName.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    await openNameStep(names);
    await fireEvent.changeText(field(), 'Camila');
    await act(async () => answer({ firstName: 'Laura' }));
    expect(field().props.value).toBe('Camila');
  });

  it('can be skipped from the header', async () => {
    const names = fakeNames();
    await openNameStep(names);
    await fireEvent.press(screen.getByRole('button', { name: 'Omitir' }));
    await waitFor(async () =>
      expect(await saved()).toMatchObject({ step: 'accounts', skipped: ['name'] }),
    );
    expect(names.saveName).not.toHaveBeenCalled();
  });
});
