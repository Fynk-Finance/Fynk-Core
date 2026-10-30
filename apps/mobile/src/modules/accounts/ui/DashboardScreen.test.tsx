// Dashboard balance card (HU-014 SCRUM-28): balance total without CDTs, "N cuentas conectadas",
// Ingresos and Gastos, "Cómo se calcula", the greeting, errors and both themes.
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, Text } from 'react-native';

import { ThemeProvider, type ThemePreference } from '@shared/ui';

import type { AccountsOverview } from '../application/accountsService';
import { connectedAccountsSummary, isActive, sortAccounts } from '../domain/netWorth';
import { card, cash, cdt, savings, wallet } from '../testing/fixtures';
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

function Target({ route }: { route: { name: string } }) {
  return <Text>{`arrived:${route.name}`}</Text>;
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
    <ThemeProvider initialPreference={opts.theme ?? 'light'} store={noStore}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Dashboard" component={Dashboard} />
          <Stack.Screen name="identity.Account" component={Target} />
          <Stack.Screen name="notifications.Inbox" component={Target} />
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeProvider>,
  );
  return { refetch };
}

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
    expect(await screen.findByText('arrived:identity.Account')).toBeTruthy();
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
