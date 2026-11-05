// Inversión: own CDTs, the same Explorar for everyone, the calculator, the reference and the
// disclaimer (HU-049).
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { Linking } from 'react-native';

import type { Account } from '@shared/domain';
import { createFixedClock } from '@shared/testing';

import { setInvestmentDeps } from '../application/hooks';
import type { MarketPort } from '../application/ports';
import type { CdtProduct } from '../domain/investment';
import { renderScreens } from '../testing/renderScreen';
import { createInvestmentScreen } from './InvestmentScreen';
import { investmentStrings as s } from './strings.es-CO';

const products: CdtProduct[] = [
  {
    id: 'cdt-demo-90',
    name: 'CDT Digital Banco Demo 90 Días',
    issuer: 'Banco Demo',
    termDays: 90,
    rateEaBps: 1015,
    minAmountMinor: 50_000_000,
    risk: 'low',
    simulated: true,
  },
  {
    id: 'cdt-demo-180',
    name: 'CDT Digital Banco Demo 180 Días',
    issuer: 'Banco Demo',
    termDays: 180,
    rateEaBps: 1050,
    minAmountMinor: 50_000_000,
    risk: 'low',
    simulated: true,
  },
  {
    id: 'cdt-demo-360',
    name: 'CDT Digital Banco Demo 360 Días',
    issuer: 'Banco Demo',
    termDays: 360,
    rateEaBps: 1085,
    minAmountMinor: 100_000_000,
    risk: 'low',
    simulated: true,
  },
];

const market: MarketPort = {
  getCdtProducts: async () => products,
  getCdtReference: async () => ({
    termDays: 360,
    rateEaBps: 985,
    week: '2026-10-19',
    sourceUrl: 'u',
    stale: false,
  }),
  getQuotes: async () => [
    {
      symbol: 'AAPL',
      name: 'Apple',
      lastPriceCents: 22_750,
      dayChangeBps: 125,
      at: '2026-10-28T19:59:00Z',
    },
  ],
};

const cdtAccount = (balanceMinor: number): Account => ({
  id: 'acc-cdt',
  provider: 'banco-demo',
  providerAccountId: 'p',
  linkId: 'l',
  kind: 'cdt',
  displayName: 'CDT Banco Demo',
  last4: '7701',
  currency: 'COP',
  balanceMinor,
  availableMinor: null,
  creditLimitMinor: null,
  paymentDueOn: null,
  status: 'active',
  isSimulated: true,
  lastSyncedAt: null,
  cdt: { rateEaBps: 1050, termDays: 180, openedOn: '2026-08-27', maturesOn: '2027-02-27' },
});

const Investment = createInvestmentScreen(() => 'Laura Gómez');
const screens = { Inversion: Investment };

function install(accounts: Account[]) {
  setInvestmentDeps({
    accounts: { getCdtAccounts: async () => accounts },
    market,
    clock: createFixedClock('2026-10-28T17:00:00Z'),
    portalUrl: 'https://bancodemo.example/portal/actions',
  });
}

afterEach(async () => {
  await act(async () => new Promise((resolve) => setTimeout(resolve, 20)));
  setInvestmentDeps(null);
  jest.restoreAllMocks();
});

it('shows the own CDT with amount, rate, term and maturity, and the tiles', async () => {
  install([cdtAccount(200_000_000)]);
  await renderScreens({ screens, initial: 'Inversion' });
  const row = await screen.findByTestId('investment.holding.acc-cdt');
  expect(within(row).getByText('6 meses · vence 27 feb')).toBeOnTheScreen();
  expect(within(row).getByText('10,50 % E.A.')).toBeOnTheScreen();
  expect(within(row).getByText('Simulado')).toBeOnTheScreen();
  expect(screen.getByTestId('investment.total')).toHaveTextContent('$2.000.000');
  expect(
    within(screen.getByTestId('investment.tile.rate')).getByText('10,50 % E.A.'),
  ).toBeOnTheScreen();
  expect(
    within(screen.getByTestId('investment.tile.maturity')).getByText('27 feb'),
  ).toBeOnTheScreen();
  expect(screen.queryByText(/Aporte mensual/)).toBeNull();
});

it('shows the empty state without CDTs', async () => {
  install([]);
  await renderScreens({ screens, initial: 'Inversion' });
  expect(await screen.findByText(s.holdings.empty)).toBeOnTheScreen();
});

const catalogIds = () =>
  screen.getAllByTestId(/^investment\.product\./).map((n) => String(n.props.testID));

it('shows the same Explorar list to users with very different balances', async () => {
  install([cdtAccount(50_000_000_000)]);
  const { client } = await renderScreens({ screens, initial: 'Inversion' });
  await screen.findByTestId('investment.holding.acc-cdt');
  await screen.findByTestId('investment.product.cdt-demo-90');
  const rich = catalogIds();

  // Another user, without any CDT: the own section changes, Explorar does not.
  await act(async () => install([]));
  await act(async () => client.invalidateQueries());
  await screen.findByText(s.holdings.empty);
  expect(catalogIds()).toEqual(rich);
  // Neutral default order: by name.
  expect(rich).toEqual([
    'investment.product.cdt-demo-180',
    'investment.product.cdt-demo-360',
    'investment.product.cdt-demo-90',
  ]);
});

it('orders and filters only as the person chooses', async () => {
  install([]);
  await renderScreens({ screens, initial: 'Inversion' });
  await screen.findByTestId('investment.product.cdt-demo-90');
  await fireEvent.press(screen.getByTestId('investment.sort.rate'));
  expect(screen.getAllByTestId(/^investment\.product\./).map((n) => n.props.testID)).toEqual([
    'investment.product.cdt-demo-360',
    'investment.product.cdt-demo-180',
    'investment.product.cdt-demo-90',
  ]);
  await fireEvent.press(screen.getByTestId('investment.term.180'));
  expect(screen.getAllByTestId(/^investment\.product\./)).toHaveLength(1);
  await fireEvent.press(screen.getByTestId('investment.risk.high'));
  expect(screen.getByText(s.explore.empty)).toBeOnTheScreen();
});

it('calculates the interest of what the person types: $50.471', async () => {
  install([cdtAccount(200_000_000)]);
  await renderScreens({ screens, initial: 'Inversion' });
  const amount = await screen.findByTestId('investment.calculator.amount');
  // Never prefilled from the balance.
  expect(amount.props.value).toBe('');
  await fireEvent.changeText(amount, '1.000.000');
  await fireEvent.press(screen.getByTestId('investment.product.cdt-demo-180'));
  expect(screen.getByTestId('investment.calculator.result')).toHaveTextContent(
    'Recibirías aproximadamente $50.471 en intereses.',
  );
});

it('opens the Banco Demo portal for "+ Invertir"', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  install([]);
  await renderScreens({ screens, initial: 'Inversion' });
  await fireEvent.press(await screen.findByText(s.holdings.invest));
  expect(open).toHaveBeenCalledWith('https://bancodemo.example/portal/actions');
});

it('shows the reference rate and the stock reference prices', async () => {
  install([]);
  await renderScreens({ screens, initial: 'Inversion' });
  expect(await screen.findByTestId('investment.reference')).toHaveTextContent(
    'Tasa promedio CDT a 360 días en Colombia: 9,85 % E.A. (Banco de la República, semana del 19 oct 2026).',
  );
  await fireEvent.press(screen.getByText('Acciones'));
  expect(await screen.findByText('US$227,50')).toBeOnTheScreen();
  expect(screen.getByText('+1,25 %')).toBeOnTheScreen();
  expect(screen.getByText(s.explore.stocksNote)).toBeOnTheScreen();
});

it('always shows the disclaimer, even before the module is configured, in dark', async () => {
  await renderScreens({ screens, initial: 'Inversion', preference: 'dark' });
  expect(await screen.findByTestId('investment.disclaimer')).toHaveTextContent(s.disclaimer);
});
