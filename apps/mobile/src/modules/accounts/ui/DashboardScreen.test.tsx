// Dashboard card and Detalle de cuentas (HU-012 SCRUM-26, HU-014 SCRUM-28): balance total,
// "N cuentas conectadas", Ingresos and Gastos, one row per account with only 4 digits, the
// cash row, no CDTs, the Simulado badge, "Cómo se calcula", and both themes.
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ThemeProvider, type ThemePreference } from '@shared/ui';

import type { AccountsOverview } from '../application/accountsService';
import { connectedAccountsSummary, isActive, sortAccounts } from '../domain/netWorth';
import { account, card, cash, cdt, savings, wallet } from '../testing/fixtures';
import { ACCOUNT_DETAIL_ROUTE } from './AccountDetailScreen';
import { dragIntent } from './AccountsPanel';
import { createDashboardScreen } from './DashboardScreen';

const noStore = { load: async () => 'system' as const, save: async () => undefined };
const Stack = createNativeStackNavigator();

const overviewOf = (accounts = [savings, wallet, cash, card, cdt]): AccountsOverview => {
  const { count, totalMinor } = connectedAccountsSummary(accounts);
  return {
    accounts: sortAccounts(accounts.filter(isActive)),
    balanceTotalMinor: totalMinor,
    connectedCount: count,
  };
};

function Target({ route }: { route: { name: string; params?: { accountId?: string } } }) {
  return <Text>{`arrived:${route.name}:${route.params?.accountId ?? ''}`}</Text>;
}

async function renderDashboard(
  opts: {
    overview?: AccountsOverview;
    isError?: boolean;
    theme?: ThemePreference;
    name?: string | null;
  } = {},
) {
  const refetch = jest.fn();
  const Dashboard = createDashboardScreen({
    useAccounts: () =>
      ({
        data: opts.isError ? undefined : (opts.overview ?? overviewOf()),
        isError: !!opts.isError,
        refetch,
      }) as never,
    useMonthSummary: () => ({ incomeMinor: 520_000_000, spendingMinor: 231_040_000 }),
    useUnreadCount: () => 0,
    useDisplayName: () => (opts.name === undefined ? 'Laura Gómez' : opts.name),
    accountRoute: 'identity.Account',
    notificationsRoute: 'notifications.Inbox',
  });
  await render(
    <GestureHandlerRootView>
      <ThemeProvider initialPreference={opts.theme ?? 'light'} store={noStore}>
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Dashboard" component={Dashboard} />
            <Stack.Screen name="identity.Account" component={Target} />
            <Stack.Screen name="notifications.Inbox" component={Target} />
            <Stack.Screen name={ACCOUNT_DETAIL_ROUTE} component={Target} />
          </Stack.Navigator>
        </NavigationContainer>
      </ThemeProvider>
    </GestureHandlerRootView>,
  );
  return { refetch };
}

const openDetails = () => fireEvent.press(screen.getByLabelText('Ver detalle de cuentas'));

describe('Dashboard balance card', () => {
  it('shows the balance total: accounts, wallet and cash minus the card, without the CDT', async () => {
    await renderDashboard();
    // 3.200.000 + 4.600.000 + 600.000 − 500.000
    expect(screen.getByTestId('accounts.total')).toHaveTextContent('$7.900.000');
    expect(screen.getByText('Balance total')).toBeTruthy();
  });

  it('counts connected accounts without cash and CDTs', async () => {
    await renderDashboard();
    expect(screen.getByText('COP · 3 cuentas conectadas')).toBeTruthy();
  });

  it('says "1 cuenta conectada" in singular', async () => {
    await renderDashboard({ overview: overviewOf([savings, cash]) });
    expect(screen.getByText('COP · 1 cuenta conectada')).toBeTruthy();
  });

  it('shows Ingresos and Gastos of the month', async () => {
    await renderDashboard();
    expect(screen.getByLabelText('Ingresos')).toHaveTextContent(/Ingresos.*\$5\.200\.000/);
    expect(screen.getByLabelText('Gastos')).toHaveTextContent(/Gastos.*\$2\.310\.400/);
  });

  it('explains how the total is calculated', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await renderDashboard();
    await fireEvent.press(screen.getByLabelText('Balance total. Cómo se calcula'));
    expect(alert).toHaveBeenCalledWith(
      'Cómo se calcula',
      expect.stringMatching(/restamos lo que debes en tus tarjetas de crédito.*CDT no se suman/),
      expect.anything(),
    );
    alert.mockRestore();
  });

  it('greets the person by name', async () => {
    await renderDashboard();
    expect(screen.getByText('Laura Gómez')).toBeTruthy();
  });

  it('greets "Invitado" without a name', async () => {
    await renderDashboard({ name: null });
    expect(screen.getByText('Invitado')).toBeTruthy();
  });

  it('opens Mi cuenta from the avatar', async () => {
    await renderDashboard();
    await fireEvent.press(screen.getByLabelText(/Mi cuenta/));
    expect(await screen.findByText('arrived:identity.Account:')).toBeTruthy();
  });

  it('offers to retry when the accounts cannot load', async () => {
    const { refetch } = await renderDashboard({ isError: true });
    expect(screen.getByText('No pudimos cargar tus cuentas.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Reintentar'));
    expect(refetch).toHaveBeenCalled();
  });

  it('renders in the dark theme', async () => {
    await renderDashboard({ theme: 'dark' });
    expect(screen.getByTestId('accounts.total')).toHaveTextContent('$7.900.000');
  });
});

describe('Detalle de cuentas', () => {
  it('is hidden until the tab is pressed, and the tab hides it again', async () => {
    await renderDashboard();
    expect(screen.queryByTestId('accounts.panel')).toBeNull();
    await openDetails();
    expect(screen.getByTestId('accounts.panel')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Ocultar detalle de cuentas'));
    expect(screen.queryByTestId('accounts.panel')).toBeNull();
  });

  it('lists each account with entity, type, masked number and balance', async () => {
    await renderDashboard();
    await openDetails();
    expect(screen.getByTestId('accounts.row.acc-ahorros')).toHaveTextContent(
      /Banco Demo.*Simulado.*Cuenta de ahorros · •• 4821.*\$3\.200\.000/,
    );
    expect(screen.getByTestId('accounts.row.acc-wallet')).toHaveTextContent(
      /Billetera Demo.*Billetera digital · •• 9104.*\$4\.600\.000/,
    );
    expect(screen.getByTestId('accounts.row.acc-card')).toHaveTextContent(
      /Tarjeta de crédito · •• 3312.*−\$500\.000/,
    );
  });

  it('shows cash as "Efectivo · Registrado manualmente" without the Simulado badge', async () => {
    await renderDashboard();
    await openDetails();
    const row = screen.getByTestId('accounts.row.acc-cash');
    expect(row).toHaveTextContent(/^Efectivo\s*Registrado manualmente\s*\$600\.000$/);
  });

  it('opens Detalle de cuenta from a row', async () => {
    await renderDashboard();
    await openDetails();
    await fireEvent.press(screen.getByTestId('accounts.row.acc-wallet'));
    expect(await screen.findByText('arrived:accounts.AccountDetail:acc-wallet')).toBeTruthy();
  });

  it('leaves out CDTs (HU-014, no investment data)', async () => {
    await renderDashboard();
    await openDetails();
    expect(screen.queryByTestId('accounts.row.acc-cdt')).toBeNull();
  });

  it('never shows more than the last 4 digits', async () => {
    const leaky = account({ id: 'acc-leaky', providerAccountId: 'leaky', last4: '1234567890' });
    await renderDashboard({ overview: overviewOf([leaky]) });
    await openDetails();
    const row = screen.getByTestId('accounts.row.acc-leaky');
    expect(row).toHaveTextContent(/•• 7890/);
    // Neither the text nor any accessibility label carries the rest of the number.
    expect(JSON.stringify(screen.toJSON())).not.toMatch(/123456/);
  });

  it('says so when there are no accounts', async () => {
    await renderDashboard({ overview: overviewOf([]) });
    await openDetails();
    expect(screen.getByText('Aún no tienes cuentas conectadas.')).toBeTruthy();
  });
});

describe('dragIntent (drag on the tab)', () => {
  it('opens on a drag down and closes on a drag up', () => {
    expect(dragIntent(40, false)).toBe('open');
    expect(dragIntent(-40, true)).toBe('close');
  });

  it('ignores short drags and drags the wrong way', () => {
    expect(dragIntent(10, false)).toBeNull();
    expect(dragIntent(-40, false)).toBeNull();
    expect(dragIntent(40, true)).toBeNull();
  });
});
