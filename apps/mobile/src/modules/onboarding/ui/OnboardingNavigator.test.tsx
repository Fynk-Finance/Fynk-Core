// SCRUM-69 through the screens, on a real SQLite vault (sql.js): Aviso, the step bar, skipping a
// step or the whole setup, going back, and reopening on the saved step.
import { NavigationContainer } from '@react-navigation/native';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { createAppEvents } from '@shared/events/appEvents';
import { createFixedClock, createInMemoryVault, type InMemoryVault } from '@shared/testing';

import { onboardingMigrations } from '../adapters/vault/migrations';
import { createVaultProgressStore } from '../adapters/vault/vaultProgressStore';
import { createOnboardingService, type OnboardingService } from '../application/onboardingService';
import { initialProgress, type OnboardingProgress } from '../domain/progress';
import { createOnboardingNavigator, initialStateFor } from './OnboardingNavigator';
import { onboardingStrings } from './strings.es-CO';
import { createUseOnboardingGate } from './useOnboardingGate';

jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual<{ default: unknown }>('react-native-reanimated');
  return {
    __esModule: true,
    ...actual,
    default: actual.default,
    useReducedMotion: jest.fn(() => true),
  };
});

const reduceMotion = useReducedMotion as jest.Mock;
const NOW = '2026-10-29T15:00:00.000Z';
const copy = onboardingStrings;

let vault: InMemoryVault;
let service: OnboardingService;

async function openOn(progress: OnboardingProgress | null) {
  vault = await createInMemoryVault();
  vault.registerMigrations('onboarding', onboardingMigrations);
  await vault.migrate();
  const store = createVaultProgressStore(vault.db);
  if (progress) await store.save(progress, NOW);
  service = createOnboardingService({
    store: () => store,
    clock: createFixedClock(NOW),
    events: createAppEvents(),
  });
  await service.load();
  const Flow = createOnboardingNavigator(service);
  await render(
    <NavigationContainer>
      <Flow />
    </NavigationContainer>,
  );
  await act(async () => {});
}

const saved = () => createVaultProgressStore(vault.db).load();
const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));

beforeEach(() => reduceMotion.mockReturnValue(true));

afterEach(() => {
  service.dispose();
  vault.close();
});

describe('Aviso', () => {
  it('shows the design copy with four steps', async () => {
    await openOn(null);
    expect(screen.getByText('4 pasos')).toBeTruthy();
    expect(screen.getByText(copy.intro.minutes)).toBeTruthy();
    expect(screen.getByRole('header', { name: copy.intro.title })).toBeTruthy();
    expect(screen.getByText(copy.intro.text)).toBeTruthy();
  });

  it('"Comenzar configuración" opens step 1 of 4 and saves it', async () => {
    await openOn(null);
    await press(copy.intro.start);
    await waitFor(() => expect(screen.getByText('Paso 1 de 4')).toBeTruthy());
    expect((await saved())?.step).toBe('name');
  });

  it('"Omitir por ahora" shows the warning first', async () => {
    await openOn(null);
    await press(copy.intro.skip);
    expect(await screen.findByRole('header', { name: copy.skip.title })).toBeTruthy();
    for (const item of Object.values(copy.skip.pending)) {
      expect(screen.getByText(item)).toBeTruthy();
    }
    expect(screen.getByText(copy.skip.later)).toBeTruthy();
    expect((await saved())?.finishedAt ?? null).toBeNull();
  });
});

describe('Omitir (warning)', () => {
  it('"Omitir de todos modos" ends the setup and closes the gate', async () => {
    await openOn(null);
    await press(copy.intro.skip);
    await press(copy.skip.skipAnyway);

    expect(await saved()).toEqual({
      ...initialProgress,
      skipped: ['name', 'accounts', 'goals', 'recurring'],
      finishedAt: NOW,
    });
    // Rendered last: renderHook replaces the screen under test.
    const gate = await renderHook(createUseOnboardingGate(service));
    expect(gate.result.current).toBe(false);
  });

  it('"Seguir configurando" goes back without ending the setup', async () => {
    await openOn(null);
    await press(copy.intro.skip);
    await press(copy.skip.keepGoing);
    await waitFor(() => expect(screen.queryByTestId('onboarding.skip')).toBeNull());
    expect((await saved())?.finishedAt ?? null).toBeNull();
  });
});

describe('steps', () => {
  it('the header "Omitir" skips only this step', async () => {
    await openOn({ ...initialProgress, step: 'name' });
    await press('Omitir');
    await waitFor(() => expect(screen.getByText('Paso 2 de 4')).toBeTruthy());
    expect(await saved()).toMatchObject({ step: 'accounts', skipped: ['name'], finishedAt: null });
  });

  it('skipping the last step after skipping all others shows the warning', async () => {
    await openOn({ ...initialProgress, step: 'recurring', skipped: ['name', 'accounts', 'goals'] });
    await press('Omitir');
    expect(await screen.findByRole('header', { name: copy.skip.title })).toBeTruthy();
    expect((await saved())?.finishedAt ?? null).toBeNull();
  });

  it('"Continuar" opens the next step', async () => {
    await openOn({ ...initialProgress, step: 'accounts' });
    await press(copy.step.continue);
    await waitFor(() => expect(screen.getByText('Paso 3 de 4')).toBeTruthy());
    expect(await saved()).toMatchObject({ step: 'goals', completed: ['accounts'] });
  });

  it('"Terminar configuración" on the last step ends the setup', async () => {
    await openOn({ ...initialProgress, step: 'recurring', completed: ['name'] });
    await press(copy.step.finish);
    await waitFor(async () => expect((await saved())?.finishedAt).toBe(NOW));
  });

  it('the back button returns to the previous step and saves it', async () => {
    await openOn({ ...initialProgress, step: 'goals' });
    expect(screen.getByText('Paso 3 de 4')).toBeTruthy();
    const backButtons = screen.getAllByRole('button', { name: 'Volver' });
    await fireEvent.press(backButtons[backButtons.length - 1]!);
    await waitFor(async () => expect((await saved())?.step).toBe('accounts'));
  });
});

describe('resume', () => {
  it('reopens on the saved step with the earlier screens behind it', async () => {
    await openOn({ ...initialProgress, step: 'recurring', completed: ['name'] });
    expect(screen.getByText('Paso 4 de 4')).toBeTruthy();
    expect(initialStateFor('recurring')).toEqual({
      index: 4,
      routes: [
        { name: 'onboarding.Intro' },
        { name: 'onboarding.Name' },
        { name: 'onboarding.Accounts' },
        { name: 'onboarding.Goals' },
        { name: 'onboarding.Recurring' },
      ],
    });
  });
});

describe('before the progress is read', () => {
  it('draws only the background while the vault is locked', async () => {
    vault = await createInMemoryVault();
    service = createOnboardingService({
      store: () => {
        throw new (jest.requireActual('@shared/ports').VaultLockedError)();
      },
      clock: createFixedClock(NOW),
      events: createAppEvents(),
    });
    const Flow = createOnboardingNavigator(service);
    await render(<Flow />);
    await act(async () => {});
    expect(screen.getByTestId('onboarding.loading')).toBeTruthy();
    expect((await renderHook(createUseOnboardingGate(service))).result.current).toBe(true);
  });

  it('offers a retry when the progress cannot be read', async () => {
    vault = await createInMemoryVault();
    const load = jest.fn().mockRejectedValue(new Error('disk'));
    service = createOnboardingService({
      store: () => ({ load, save: jest.fn() }),
      clock: createFixedClock(NOW),
      events: createAppEvents(),
    });
    const Flow = createOnboardingNavigator(service);
    await render(<Flow />);
    await act(async () => {});
    await press('Reintentar');
    expect(load).toHaveBeenCalledTimes(2);
  });
});
