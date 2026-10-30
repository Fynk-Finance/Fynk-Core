// "Mis cuentas" in Billetera and Mi cuenta (HU-019 SCRUM-33, HU-020 SCRUM-34): one card per
// account without CDTs, card credit data, wallets, only 4 digits, opening Detalle de cuenta,
// "+ Conectar", empty state, no React Query, and both themes.
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ComponentType } from 'react';
import { Text } from 'react-native';

import type { Account } from '@shared/domain/types';
import { ThemeProvider, type ThemePreference } from '@shared/ui';

import { sortAccounts } from '../domain/netWorth';
import { account, card, cash, cdt, savings, wallet } from '../testing/fixtures';
import { ACCOUNT_DETAIL_ROUTE } from './AccountDetailScreen';
import {
  createMisCuentasBilletera,
  createMisCuentasMiCuenta,
  type MisCuentasDeps,
} from './MisCuentas';

const noStore = { load: async () => 'system' as const, save: async () => undefined };
const Stack = createNativeStackNavigator();

function Target({ route }: { route: { name: string; params?: { accountId?: string } } }) {
  return <Text>{`arrived:${route.name}:${route.params?.accountId ?? ''}`}</Text>;
}

const depsOf = (accounts: Account[] | null): MisCuentasDeps => ({
  useAccounts: () => ({
    data: accounts
      ? { accounts: sortAccounts(accounts), balanceTotalMinor: 0, connectedCount: 0 }
      : undefined,
    isPending: accounts === null,
  }),
});

async function renderSection(
  create: (deps: MisCuentasDeps) => ComponentType,
  opts: { accounts?: Account[] | null; theme?: ThemePreference; withQuery?: boolean } = {},
) {
  const Section = create(
    depsOf(opts.accounts === undefined ? [savings, wallet, card, cdt, cash] : opts.accounts),
  );
  const tree = (
    <ThemeProvider initialPreference={opts.theme ?? 'light'} store={noStore}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Host" component={Section} />
          <Stack.Screen name={ACCOUNT_DETAIL_ROUTE} component={Target} />
          <Stack.Screen name="bank.Connect" component={Target} />
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeProvider>
  );
  await render(
    opts.withQuery === false ? (
      tree
    ) : (
      <QueryClientProvider client={new QueryClient()}>{tree}</QueryClientProvider>
    ),
  );
}

const cardOf = (id: string) => screen.getByTestId(`accounts.misCuentas.card.${id}`);

describe('Mis cuentas in Billetera', () => {
  it('shows one card per account with entity, short type and amount, without CDTs', async () => {
    await renderSection(createMisCuentasBilletera);
    expect(screen.getByText('Mis cuentas')).toBeTruthy();
    expect(cardOf('acc-ahorros')).toHaveTextContent(/BD.*Banco Demo · Ahorros.*\$3\.200\.000/);
    expect(cardOf('acc-cash')).toHaveTextContent(/Efectivo · Manual.*\$600\.000/);
    expect(cardOf('acc-card')).toHaveTextContent(/Banco Demo · Crédito.*−\$500\.000/);
    expect(screen.queryByTestId('accounts.misCuentas.card.acc-cdt')).toBeNull();
  });

  it('shows each wallet with its balance (HU-020)', async () => {
    await renderSection(createMisCuentasBilletera);
    expect(cardOf('acc-wallet')).toHaveTextContent(/Billetera Demo · Digital.*\$4\.600\.000/);
  });

  it('names the account and says Simulado to screen readers', async () => {
    await renderSection(createMisCuentasBilletera);
    expect(
      screen.getByLabelText('Ver cuenta Banco Demo. Ahorros, $3.200.000, Simulado'),
    ).toBeTruthy();
    expect(screen.getByLabelText('Ver cuenta Efectivo. Manual, $600.000')).toBeTruthy();
  });

  it('opens Detalle de cuenta from a card', async () => {
    await renderSection(createMisCuentasBilletera);
    await fireEvent.press(cardOf('acc-wallet'));
    expect(await screen.findByText('arrived:accounts.AccountDetail:acc-wallet')).toBeTruthy();
  });

  it('opens M5 from "+ Conectar"', async () => {
    await renderSection(createMisCuentasBilletera);
    await fireEvent.press(screen.getByText('+ Conectar'));
    expect(await screen.findByText('arrived:bank.Connect:')).toBeTruthy();
  });

  it('says so when there are no accounts, and keeps "+ Conectar"', async () => {
    await renderSection(createMisCuentasBilletera, { accounts: [] });
    expect(screen.getByText('Aún no tienes cuentas conectadas.')).toBeTruthy();
    expect(screen.getByText('+ Conectar')).toBeTruthy();
  });

  it('renders nothing without React Query, so other modules keep their tests', async () => {
    await renderSection(createMisCuentasBilletera, { withQuery: false });
    expect(screen.queryByText('Mis cuentas')).toBeNull();
  });

  it('renders in the dark theme', async () => {
    await renderSection(createMisCuentasBilletera, { theme: 'dark' });
    expect(cardOf('acc-ahorros')).toHaveTextContent(/\$3\.200\.000/);
  });
});

describe('Mis cuentas in Mi cuenta', () => {
  it('shows entity, Activa, Simulado, type with the last 4 digits and the balance', async () => {
    await renderSection(createMisCuentasMiCuenta);
    expect(cardOf('acc-ahorros')).toHaveTextContent(
      /Banco Demo.*Activa.*Simulado.*Cuenta de ahorros · •• 4821.*Saldo disponible.*\$3\.200\.000/,
    );
    expect(screen.queryByText('+ Conectar')).toBeNull();
  });

  it('shows cupo disponible, cupo total and the payment date of a card (HU-019)', async () => {
    await renderSection(createMisCuentasMiCuenta);
    expect(cardOf('acc-card')).toHaveTextContent(
      /Tarjeta de crédito · •• 3312.*Cupo disponible.*\$4\.500\.000.*Cupo total \$5\.000\.000 · Pago el 5 nov/,
    );
  });

  it('never shows more than the last 4 digits', async () => {
    const leaky = account({ id: 'acc-leaky', providerAccountId: 'leaky', last4: '1234567890' });
    await renderSection(createMisCuentasMiCuenta, { accounts: [leaky] });
    expect(cardOf('acc-leaky')).toHaveTextContent(/•• 7890/);
    expect(JSON.stringify(screen.toJSON())).not.toMatch(/123456/);
  });

  it('opens Detalle de cuenta from a card', async () => {
    await renderSection(createMisCuentasMiCuenta);
    await fireEvent.press(cardOf('acc-card'));
    expect(await screen.findByText('arrived:accounts.AccountDetail:acc-card')).toBeTruthy();
  });

  it('shows a placeholder while the accounts load', async () => {
    await renderSection(createMisCuentasMiCuenta, { accounts: null });
    expect(screen.getByText('Mis cuentas')).toBeTruthy();
    expect(screen.queryByTestId('accounts.misCuentas.card.acc-ahorros')).toBeNull();
  });

  it('renders in the dark theme', async () => {
    await renderSection(createMisCuentasMiCuenta, { theme: 'dark' });
    expect(cardOf('acc-wallet')).toHaveTextContent(/\$4\.600\.000/);
  });
});
