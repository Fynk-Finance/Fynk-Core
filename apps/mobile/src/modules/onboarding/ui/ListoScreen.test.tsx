// Listo (SCRUM-69) on the real navigator and vault: the design's summary, pending parts, the
// recovery code row opening M2's screen, and "Ir a mi dashboard" ending the setup. The numbers of
// M6, M8, M9 and M2 are given by a stand-in `loadSummary`.
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { createAppEvents } from '@shared/events/appEvents';
import { createFixedClock, createInMemoryVault, type InMemoryVault } from '@shared/testing';

import { onboardingMigrations } from '../adapters/vault/migrations';
import { createVaultProgressStore } from '../adapters/vault/vaultProgressStore';
import { createOnboardingService, type OnboardingService } from '../application/onboardingService';
import { initialProgress } from '../domain/progress';
import type { SummaryInput } from '../domain/summary';
import { placeholderSteps } from '../testing/placeholderSteps';
import { createListoScreen } from './ListoScreen';
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

const reduceMotion = useReducedMotion as jest.Mock;
const NOW = '2026-11-06T15:00:00.000Z';
const copy = onboardingStrings.listo;

/** The design: 2 accounts and cash, $8.400.000; 2 goals, $840.000/mes; 4 payments, $1.453.900. */
const DESIGN: SummaryInput = {
  accounts: { count: 2, totalMinor: 840_000_000 },
  cashMinor: 60_000_000,
  goals: { count: 2, monthlyMinor: 84_000_000 },
  recurring: { count: 4, monthlyMinor: 145_390_000 },
  recoveryCode: 'saved',
};

let vault: InMemoryVault;
let service: OnboardingService;

// Stand-in for M2's "Generar un código nuevo": it saves the code and goes back.
let codeSaved: () => void = () => undefined;
function FakeRecoveryCode() {
  const navigation = useNavigation();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        codeSaved();
        navigation.goBack();
      }}
    >
      <Text>Ya lo guardé</Text>
    </Pressable>
  );
}

async function openListo(
  load: () => Promise<SummaryInput>,
  name: string | null = 'Laura Gómez Ruiz',
) {
  vault = await createInMemoryVault();
  vault.registerMigrations('onboarding', onboardingMigrations);
  await vault.migrate();
  const store = createVaultProgressStore(vault.db);
  await store.save({ ...initialProgress, step: 'done', completed: ['name'] }, NOW);
  service = createOnboardingService({
    store: () => store,
    clock: createFixedClock(NOW),
    events: createAppEvents(),
  });
  await service.load();
  const done = createListoScreen({ loadSummary: load, useDisplayName: () => name });
  const Flow = createOnboardingNavigator(
    service,
    { ...placeholderSteps, done },
    undefined,
    FakeRecoveryCode,
  );
  await render(
    <NavigationContainer>
      <Flow />
    </NavigationContainer>,
  );
  await act(async () => {});
}

const saved = () => createVaultProgressStore(vault.db).load();

beforeEach(() => reduceMotion.mockReturnValue(true));

afterEach(() => {
  service.dispose();
  vault.close();
});

describe('Listo', () => {
  it('greets by the first name and shows the design summary with its totals', async () => {
    await openListo(async () => DESIGN);
    expect(screen.getByRole('header', { name: '¡Todo listo, Laura!' })).toBeTruthy();
    expect(screen.getByText(copy.subtitle)).toBeTruthy();
    expect(screen.getByRole('header', { name: copy.heading })).toBeTruthy();
    for (const text of [
      copy.verified,
      '3 registradas',
      '$8.400.000',
      '2 metas',
      '$840.000/mes',
      '4 pagos',
      '$1.453.900/mes',
      copy.saved,
    ]) {
      expect(screen.getByText(text)).toBeTruthy();
    }
    expect(screen.getAllByLabelText(new RegExp(`${copy.completed}$`))).toHaveLength(5);
  });

  it('says "¡Todo listo!" when the person gave no name', async () => {
    await openListo(async () => DESIGN, null);
    expect(screen.getByRole('header', { name: '¡Todo listo!' })).toBeTruthy();
  });

  it('shows the parts with nothing registered as pending', async () => {
    await openListo(async () => ({
      ...DESIGN,
      goals: { count: 0, monthlyMinor: 0 },
      recurring: { count: 0, monthlyMinor: 0 },
    }));
    expect(screen.getAllByText(copy.pending)).toHaveLength(2);
    expect(screen.getAllByLabelText(new RegExp(`${copy.completed}$`))).toHaveLength(3);
  });

  it('opens "Generar un código nuevo" from a pending recovery code and shows it saved on return', async () => {
    let status: SummaryInput['recoveryCode'] = 'pending';
    codeSaved = () => {
      status = 'saved';
    };
    await openListo(async () => ({ ...DESIGN, recoveryCode: status }));
    fireEvent.press(screen.getByRole('button', { name: new RegExp(copy.rows.recoveryCode) }));
    fireEvent.press(await screen.findByRole('button', { name: 'Ya lo guardé' }));
    await waitFor(() => expect(screen.getByText(copy.saved)).toBeTruthy());
  });

  it('leaves out the recovery code row when M2 has no answer', async () => {
    await openListo(async () => ({ ...DESIGN, recoveryCode: 'unavailable' }));
    expect(screen.queryByText(copy.rows.recoveryCode)).toBeNull();
  });

  it('"Ir a mi dashboard" ends the setup', async () => {
    await openListo(async () => DESIGN);
    fireEvent.press(screen.getByRole('button', { name: copy.cta }));
    await waitFor(async () => expect((await saved())?.finishedAt).toBe(NOW));
  });

  it('still lets the person finish when the summary cannot be read', async () => {
    await openListo(async () => {
      throw new Error('vault locked');
    });
    expect(await screen.findByText(copy.notLoaded)).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: copy.cta }));
    await waitFor(async () => expect((await saved())?.finishedAt).toBe(NOW));
  });

  it('has no back button', async () => {
    await openListo(async () => DESIGN);
    expect(screen.queryByRole('button', { name: 'Volver' })).toBeNull();
  });

  it('throws the burst around the check when motion is allowed', async () => {
    reduceMotion.mockReturnValue(false);
    await openListo(async () => DESIGN);
    expect(screen.getByTestId('onboarding.listo.burst')).toBeTruthy();
    expect(screen.getByText('3 registradas')).toBeTruthy();
  });

  it('draws no burst with Reduce Motion', async () => {
    await openListo(async () => DESIGN);
    expect(screen.queryByTestId('onboarding.listo.burst')).toBeNull();
  });
});
