// Dashboard card and Detalle de cuentas (HU-012 SCRUM-26, HU-014 SCRUM-28): balance total,
// "N cuentas conectadas", Ingresos and Gastos, one row per account with only 4 digits, the
// cash row, no CDTs, the Simulado badge, "Cómo se calcula", the chart icon that opens
// Estadísticas (M10), and both themes.
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { Alert, BackHandler, Text } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ThemeProvider, type ThemePreference } from '@shared/ui';

import type { AccountsOverview } from '../application/accountsService';
import type { MonthSummary } from '../domain/dashboard';
import { connectedAccountsSummary, isActive, sortAccounts } from '../domain/netWorth';
import { account, card, cash, cdt, savings, wallet } from '../testing/fixtures';
import { ACCOUNT_DETAIL_ROUTE } from './AccountDetailScreen';
import { dragIntent } from './AccountsPanel';
import { DashboardBalanceCard } from './DashboardBalanceCard';
import { CARD_OPEN, collapse, HEADER_CHROME, type CollapseState } from './dashboardCollapse';
import { createDashboardScreen } from './DashboardScreen';

const noStore = { load: async () => 'system' as const, save: async () => undefined };
const Stack = createNativeStackNavigator();

const overviewOf = (accounts = [savings, wallet, cash, card, cdt]): AccountsOverview => {
  const { count, totalMinor } = connectedAccountsSummary(accounts);
  return {
    accounts: sortAccounts(accounts.filter(isActive)),
    disconnectedAccounts: [],
    balanceTotalMinor: totalMinor,
    connectedCount: count,
  };
};

function Target({
  route,
}: {
  route: { name: string; params?: { accountId?: string; kind?: string } };
}) {
  const param = route.params?.accountId ?? route.params?.kind ?? '';
  return <Text>{`arrived:${route.name}:${param}`}</Text>;
}

async function renderDashboard(
  opts: {
    overview?: AccountsOverview;
    isError?: boolean;
    theme?: ThemePreference;
    name?: string | null;
    withMovements?: boolean;
    withGoals?: boolean;
    summary?: MonthSummary | null;
    refresh?: () => Promise<unknown>;
  } = {},
) {
  const refetch = jest.fn(async () => undefined);
  const Dashboard = createDashboardScreen({
    useAccounts: () =>
      ({
        data: opts.isError ? undefined : (opts.overview ?? overviewOf()),
        isError: !!opts.isError,
        refetch,
      }) as never,
    useMonthSummary: () =>
      opts.summary === undefined
        ? { incomeMinor: 520_000_000, spendingMinor: 231_040_000 }
        : opts.summary,
    useUnreadCount: () => 0,
    useDisplayName: () => (opts.name === undefined ? 'Laura Gómez' : opts.name),
    accountRoute: 'identity.Account',
    notificationsRoute: 'notifications.Inbox',
    statisticsRoute: 'analytics.Spending',
    connectRoute: () => 'bank.Connect',
    ...(opts.refresh ? { refresh: opts.refresh } : {}),
    ...(opts.withGoals ? { renderGoals: () => <Text>goals of M8</Text> } : {}),
    ...(opts.withMovements
      ? {
          renderMovements: () => <Text>movements of M7</Text>,
          newMovementRoute: () => 'transactions.New',
        }
      : {}),
  });
  await render(
    <GestureHandlerRootView>
      <ThemeProvider initialPreference={opts.theme ?? 'light'} store={noStore}>
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Dashboard" component={Dashboard} />
            <Stack.Screen name="identity.Account" component={Target} />
            <Stack.Screen name="notifications.Inbox" component={Target} />
            <Stack.Screen name="analytics.Spending" component={Target} />
            <Stack.Screen name={ACCOUNT_DETAIL_ROUTE} component={Target} />
            <Stack.Screen name="transactions.New" component={Target} />
            <Stack.Screen name="bank.Connect" component={Target} />
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

  it('shows placeholders, not $0, while Ingresos and Gastos are loading', async () => {
    await renderDashboard({ summary: null });
    expect(screen.getByLabelText('Ingresos')).not.toHaveTextContent(/\$/);
    expect(screen.getByLabelText('Gastos')).not.toHaveTextContent(/\$/);
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

  it('opens Estadísticas from the chart icon next to the bell', async () => {
    await renderDashboard();
    await fireEvent.press(screen.getByRole('button', { name: 'Estadísticas' }));
    expect(await screen.findByText('arrived:analytics.Spending:')).toBeTruthy();
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
    expect(screen.getByRole('button', { name: 'Estadísticas' })).toBeTruthy();
  });
});

describe('Detalle de cuentas', () => {
  it('is hidden until the tab is pressed, and the tab hides it again', async () => {
    await renderDashboard();
    expect(screen.queryByTestId('accounts.panel')).toBeNull();
    await openDetails();
    expect(screen.getByTestId('accounts.panel')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Ocultar detalle de cuentas'));
    // It folds first (G3), then leaves.
    await waitFor(() => expect(screen.queryByTestId('accounts.panel')).toBeNull());
  });

  // QA review 2026-11-07, V3 (SCRUM-78): the tab hangs below the header, open or closed, in the
  // header's own blue (light #2FA8D8, dark #428FAF), so it reads as part of the card.
  it.each([
    ['light', '#2FA8D8'],
    ['dark', '#428FAF'],
  ] as const)('hangs below the header in its color, in the %s theme', async (theme, blue) => {
    await renderDashboard({ theme });
    const tab = () => screen.getByTestId('accounts.detailsTab');
    // react-native-svg keeps a fill as { type: 0, payload: <ARGB number> }.
    const shape = () => screen.getByTestId('accounts.detailsTab.shape');
    const fill = { type: 0, payload: 0xff000000 + parseInt(blue.slice(1), 16) };
    expect(tab()).toHaveStyle({ marginTop: -1 });
    expect(shape().props.fill).toEqual(fill);
    await openDetails();
    expect(tab()).toHaveStyle({ marginTop: -1 });
    expect(shape().props.fill).toEqual(fill);
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

  // QA review 2026-11-07, V5 (SCRUM-80): a ghost of the account card invites to connect one.
  it('shows a ghost card that opens M5 when there are no accounts', async () => {
    await renderDashboard({ overview: overviewOf([]) });
    await openDetails();
    const connect = screen.getByRole('button', { name: 'Conectar cuenta' });
    expect(connect.props.accessibilityHint).toBe('Aún no tienes cuentas conectadas.');
    await fireEvent.press(connect);
    expect(await screen.findByText('arrived:bank.Connect:')).toBeTruthy();
  });

  it('keeps the ghost card below cash while no bank account is connected', async () => {
    await renderDashboard({ overview: overviewOf([cash]) });
    await openDetails();
    expect(screen.getByTestId('accounts.row.acc-cash')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Conectar cuenta' })).toBeTruthy();
  });

  it('has no ghost card once an account is connected', async () => {
    await renderDashboard();
    await openDetails();
    expect(screen.queryByRole('button', { name: 'Conectar cuenta' })).toBeNull();
  });
});

// QA review 2026-11-07, G3 (SCRUM-90): the header stays over the page and shrinks while it scrolls.
describe('Dashboard scroll', () => {
  it('keeps the header over the page and starts the page right under it', async () => {
    await renderDashboard({ withMovements: true });
    expect(screen.getByTestId('accounts.dashboard.header')).toHaveStyle({
      position: 'absolute',
      top: 0,
    });
    // Header chrome, the 206 px card and the tab's 23 px below it.
    expect(screen.getByTestId('accounts.dashboard.spacer')).toHaveStyle({
      height: HEADER_CHROME + CARD_OPEN + 23,
    });
  });

  // Jest cannot send scroll events to Reanimated's handler, so the card gets the state that a
  // scroll gives (the scroll itself is covered in dashboardCollapse.test.ts).
  it.each([
    [0, CARD_OPEN, 1, 0],
    [40, CARD_OPEN - 40, null, null],
    [1000, 69, 0, 1],
  ])('after a %p px scroll the card is %p px high', async (scrollY, height, full, compact) => {
    const state = collapse({ scrollY, cardClosed: 69, panelHeight: 0, panelOpen: 0 });
    await render(
      <ThemeProvider initialPreference="light" store={noStore}>
        <DashboardBalanceCard
          totalMinor={790_000_000}
          connectedCount={3}
          summary={null}
          collapse={{ value: state } as SharedValue<CollapseState>}
        />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('accounts.balanceCard')).toHaveStyle({ height });
    const compactLine = screen.getByTestId('accounts.balanceCard.compact', {
      includeHiddenElements: true,
    });
    expect(compactLine).toHaveTextContent(/Balance total.*\$7\.900\.000/);
    if (compact !== null) expect(compactLine).toHaveStyle({ opacity: compact });
    if (full !== null)
      expect(screen.getByTestId('accounts.balanceCard.full')).toHaveStyle({ opacity: full });
  });

  it('keeps the movements in the one page scroll, with no scroll of their own', async () => {
    await renderDashboard({ withMovements: true });
    const scroll = screen.getByTestId('accounts.dashboard.scroll');
    expect(within(scroll).getByText('movements of M7')).toBeTruthy();
  });
});

// QA review 2026-11-07, V2 (SCRUM-77): "Planes de ahorro" between the header and Movimientos.
describe('Planes de ahorro (M8)', () => {
  it('shows the goals of M8 above the movements', async () => {
    await renderDashboard({ withGoals: true, withMovements: true });
    const text = JSON.stringify(screen.toJSON());
    expect(screen.getByText('goals of M8')).toBeTruthy();
    expect(text.indexOf('goals of M8')).toBeLessThan(text.indexOf('movements of M7'));
  });
});

describe('Movimientos and the FAB (M7)', () => {
  const fab = () => screen.getByRole('button', { name: 'Registrar gasto o ingreso' });

  it('shows the movements of M7', async () => {
    await renderDashboard({ withMovements: true });
    expect(screen.getByText('movements of M7')).toBeTruthy();
  });

  // QA review 2026-11-07, F5 (SCRUM-95): the FAB offers Ingreso or Gasto, each opens M7's sheet.
  it('offers Ingreso and Gasto, and the plus turns into a close mark', async () => {
    await renderDashboard({ withMovements: true });
    expect(screen.queryByRole('button', { name: 'Registrar ingreso' })).toBeNull();
    expect(fab()).toBeCollapsed();
    await fireEvent.press(fab());
    expect(fab()).toBeExpanded();
    expect(screen.getByRole('button', { name: 'Registrar ingreso' })).toHaveTextContent('Ingreso');
    expect(screen.getByRole('button', { name: 'Registrar gasto' })).toHaveTextContent('Gasto');
  });

  it.each([
    ['Registrar ingreso', 'income'],
    ['Registrar gasto', 'expense'],
  ])('"%s" opens the sheet on %s', async (label, kind) => {
    await renderDashboard({ withMovements: true });
    await fireEvent.press(fab());
    await fireEvent.press(screen.getByRole('button', { name: label }));
    expect(await screen.findByText(`arrived:transactions.New:${kind}`)).toBeTruthy();
  });

  it('closes the menu from the scrim and from the FAB', async () => {
    await renderDashboard({ withMovements: true });
    await fireEvent.press(fab());
    await fireEvent.press(screen.getByRole('button', { name: 'Cerrar menú' }));
    expect(screen.queryByRole('button', { name: 'Registrar ingreso' })).toBeNull();
    await fireEvent.press(fab());
    await fireEvent.press(fab());
    expect(screen.queryByRole('button', { name: 'Registrar ingreso' })).toBeNull();
    expect(fab()).toBeCollapsed();
  });

  it('closes the menu with the system back button', async () => {
    type Handler = Parameters<typeof BackHandler.addEventListener>[1];
    const listeners: Handler[] = [];
    const add = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_e, handler) => {
      listeners.push(handler);
      return { remove: () => listeners.splice(listeners.indexOf(handler), 1) };
    });
    await renderDashboard({ withMovements: true });
    await fireEvent.press(fab());
    let handled = false;
    await act(async () => {
      handled = !!listeners.at(-1)?.({} as never);
    });
    expect(handled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Registrar ingreso' })).toBeNull();
    add.mockRestore();
  });

  // QA review 2026-11-07, V1 (SCRUM-76): the tab bar sits below the page, so the FAB is placed
  // from the page's bottom edge, at most 12 px above the bar.
  it('sits 12 px above the tab bar, at the right edge', async () => {
    await renderDashboard({ withMovements: true });
    expect(screen.getByTestId('accounts.dashboard.fab')).toHaveStyle({ right: 16, bottom: 12 });
  });

  it('has no FAB until M7 gives its sheet', async () => {
    await renderDashboard();
    expect(screen.queryByLabelText('Registrar gasto o ingreso')).toBeNull();
  });
});

// HU-011 (SCRUM-25): pull to refresh asks M5 for a sync, then reads the accounts again.
describe('Dashboard pull to refresh', () => {
  const refreshControl = () =>
    (
      screen.getByTestId('accounts.dashboard.scroll').props as {
        refreshControl?: { props: { onRefresh: () => void } };
      }
    ).refreshControl;

  it('syncs and then reads the accounts again', async () => {
    const calls: string[] = [];
    const refresh = jest.fn(async () => void calls.push('sync'));
    const { refetch } = await renderDashboard({ refresh });
    refetch.mockImplementation(async () => void calls.push('refetch'));
    await act(async () => refreshControl()!.props.onRefresh());
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(['sync', 'refetch']);
  });

  it('still reads the accounts when the sync fails', async () => {
    const refresh = jest.fn(() => Promise.reject(new Error('offline')));
    const { refetch } = await renderDashboard({ refresh });
    await act(async () => refreshControl()!.props.onRefresh());
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('has no pull to refresh without M5', async () => {
    await renderDashboard();
    expect(refreshControl()).toBeUndefined();
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
