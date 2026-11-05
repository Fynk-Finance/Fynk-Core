// Step 2 · Cuentas (SCRUM-69): the connected accounts with their count, "Agregar otra cuenta"
// opening Conectar banco inside the setup, the cash field, "Total registrado", and "Continuar"
// saving the cash before the next step. M5's and M6's parts are simple stand-ins here.
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text, TextInput, View } from 'react-native';

import type { MoneyMinor } from '@shared/domain/types';
import { createAppEvents } from '@shared/events/appEvents';
import { createFixedClock, createInMemoryVault, type InMemoryVault } from '@shared/testing';

import type { AccountsOverview } from '@modules/accounts';

import { onboardingMigrations } from '../adapters/vault/migrations';
import { createVaultProgressStore } from '../adapters/vault/vaultProgressStore';
import { createOnboardingService, type OnboardingService } from '../application/onboardingService';
import { initialProgress } from '../domain/progress';
import { cash, isConnected, savings, wallet } from '../testing/accounts';
import { createAccountsStep } from './AccountsStepScreen';
import { createOnboardingNavigator, placeholderSteps } from './OnboardingNavigator';
import { CONNECT_BANK_ROUTE } from './routes';
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

const NOW = '2026-11-05T15:00:00.000Z';
const copy = onboardingStrings;

/** The design: Banco Demo $3.200.000, Billetera Demo $4.600.000 and $600.000 in cash. */
const DESIGN: AccountsOverview = {
  accounts: [savings, wallet, cash],
  balanceTotalMinor: 840_000_000,
  connectedCount: 2,
};
const EMPTY: AccountsOverview = { accounts: [], balanceTotalMinor: 0, connectedCount: 0 };

// Stand-in for M5's ConnectBankButton: it navigates to the same route.
function FakeConnectButton() {
  const navigation = useNavigation();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => navigation.navigate(CONNECT_BANK_ROUTE as never)}
    >
      <Text>Agregar otra cuenta</Text>
    </Pressable>
  );
}

function FakeConnectBank() {
  const navigation = useNavigation();
  return (
    <View testID="bank.connect">
      <Pressable accessibilityRole="button" onPress={() => navigation.goBack()}>
        <Text>Volver</Text>
      </Pressable>
    </View>
  );
}

let vault: InMemoryVault;
let service: OnboardingService;

async function openAccountsStep(
  overview: AccountsOverview | undefined,
  setCash: (amountMinor: MoneyMinor) => Promise<void> = jest.fn(async () => undefined),
) {
  vault = await createInMemoryVault();
  vault.registerMigrations('onboarding', onboardingMigrations);
  await vault.migrate();
  const store = createVaultProgressStore(vault.db);
  await store.save({ ...initialProgress, step: 'accounts', completed: ['name'] }, NOW);
  service = createOnboardingService({
    store: () => store,
    clock: createFixedClock(NOW),
    events: createAppEvents(),
  });
  await service.load();
  const accounts = createAccountsStep({
    useAccounts: () => ({ data: overview }),
    isConnected,
    setCash,
    renderLinkList: (items) => (
      <View testID="bank.linkList">
        {items.map((item) => (
          <Text key={item.id}>{item.displayName}</Text>
        ))}
      </View>
    ),
    renderConnectButton: () => <FakeConnectButton />,
    // Stand-in for M6's CashInput: whole pesos in, centavos out.
    renderCashInput: ({ value, onChange, error, testID }) => (
      <View>
        <TextInput
          testID={testID}
          value={value === null ? '' : String(value / 100)}
          onChangeText={(text) => onChange(text ? Number(text) * 100 : null)}
        />
        {error ? <Text>{error}</Text> : null}
      </View>
    ),
  });
  const Flow = createOnboardingNavigator(
    service,
    { ...placeholderSteps, accounts },
    FakeConnectBank,
  );
  await render(
    <NavigationContainer>
      <Flow />
    </NavigationContainer>,
  );
  await act(async () => {});
}

const saved = () => createVaultProgressStore(vault.db).load();
const cashField = () => screen.getByTestId('onboarding.accounts.cash');
const total = () => screen.getByTestId('onboarding.accounts.total');
const continueButton = () => screen.getByRole('button', { name: copy.step.continue });

afterEach(() => {
  service.dispose();
  vault.close();
});

describe('Cuentas', () => {
  it('shows step 2 of 4 with the connected accounts and the total of the design', async () => {
    await openAccountsStep(DESIGN);
    expect(screen.getByText('Paso 2 de 4')).toBeTruthy();
    expect(screen.getByRole('header', { name: copy.steps.accounts.title })).toBeTruthy();
    expect(screen.getByRole('header', { name: copy.accounts.banks })).toBeTruthy();
    expect(screen.getByTestId('onboarding.accounts.count')).toHaveTextContent('2 conectadas');
    expect(screen.getByText('Banco Demo · Ahorros')).toBeTruthy();
    expect(screen.getByText('Billetera Demo')).toBeTruthy();
    expect(screen.getByRole('header', { name: copy.accounts.cash })).toBeTruthy();
    expect(total()).toHaveTextContent('Total registrado2 cuentas + efectivo$8.400.000');
  });

  it('starts the cash field with the saved cash', async () => {
    await openAccountsStep(DESIGN);
    expect(cashField()).toHaveDisplayValue('600000');
  });

  it('updates "Total registrado" while the cash is typed', async () => {
    await openAccountsStep(DESIGN);
    await fireEvent.changeText(cashField(), '1000000');
    expect(total()).toHaveTextContent('Total registrado2 cuentas + efectivo$8.800.000');
    await fireEvent.changeText(cashField(), '');
    expect(total()).toHaveTextContent('Total registrado2 cuentas$7.800.000');
  });

  it('"Continuar" saves a new cash amount, then opens step 3', async () => {
    const setCash = jest.fn(async () => undefined);
    await openAccountsStep(DESIGN, setCash);
    await fireEvent.changeText(cashField(), '1000000');
    await fireEvent.press(continueButton());

    expect(setCash).toHaveBeenCalledWith(100_000_000);
    await waitFor(() => expect(screen.getByText('Paso 3 de 4')).toBeTruthy());
    expect(await saved()).toMatchObject({ step: 'goals', completed: ['name', 'accounts'] });
  });

  it('"Continuar" does not save the cash when it did not change', async () => {
    const setCash = jest.fn(async () => undefined);
    await openAccountsStep(DESIGN, setCash);
    await fireEvent.press(continueButton());

    await waitFor(() => expect(screen.getByText('Paso 3 de 4')).toBeTruthy());
    expect(setCash).not.toHaveBeenCalled();
  });

  it('can go on with no account and no cash', async () => {
    const setCash = jest.fn(async () => undefined);
    await openAccountsStep(EMPTY, setCash);
    expect(screen.getByTestId('onboarding.accounts.count')).toHaveTextContent('0 conectadas');
    expect(screen.queryByTestId('bank.linkList')).toBeNull();
    expect(total()).toHaveTextContent('Total registrado0 cuentas$0');
    expect(continueButton()).toBeEnabled();

    await fireEvent.press(continueButton());
    await waitFor(() => expect(screen.getByText('Paso 3 de 4')).toBeTruthy());
    expect(setCash).not.toHaveBeenCalled();
  });

  it('stays on the step and explains when the cash cannot be saved', async () => {
    const setCash = jest.fn(async () => {
      throw new Error('vault locked');
    });
    await openAccountsStep(EMPTY, setCash);
    await fireEvent.changeText(cashField(), '600000');
    await fireEvent.press(continueButton());

    expect(await screen.findByText(copy.accounts.cashNotSaved)).toBeTruthy();
    expect(screen.getByText('Paso 2 de 4')).toBeTruthy();
    expect(await saved()).toMatchObject({ step: 'accounts', completed: ['name'] });
  });

  it('hides the count until the accounts are read', async () => {
    await openAccountsStep(undefined);
    expect(screen.queryByTestId('onboarding.accounts.count')).toBeNull();
  });

  it('"Agregar otra cuenta" opens Conectar banco inside the setup, and back returns', async () => {
    await openAccountsStep(DESIGN);
    await fireEvent.press(screen.getByRole('button', { name: 'Agregar otra cuenta' }));
    expect(await screen.findByTestId('bank.connect')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Volver' }));
    await waitFor(() => expect(screen.queryByTestId('bank.connect')).toBeNull());
    expect(screen.getByText('Paso 2 de 4')).toBeTruthy();
    expect(await saved()).toMatchObject({ step: 'accounts' });
  });
});
