// Screens of M10: Estadísticas (with Tendencias and Ingresos recurrentes), Topes and the cap form.
import { act, fireEvent, screen } from '@testing-library/react-native';

import { setAnalyticsService } from '../application/hooks';
import { setupAnalytics } from '../testing/harness';
import { renderScreens, RouteProbe } from '../testing/renderScreen';
import { cop, tx } from '../testing/txFactory';
import { CapFormScreen } from './CapFormScreen';
import { CapsScreen } from './CapsScreen';
import { SpendingScreen } from './SpendingScreen';

// Estadísticas reference month, plus a salary that repeats.
const octoberTxs = [
  tx('2026-10-01', -1_400_000, 'rent'),
  tx('2026-10-05', -627_000, 'groceries'),
  tx('2026-10-06', -418_000, 'transport'),
  tx('2026-10-07', -313_400, 'cinema'),
  tx('2026-10-08', -278_600, 'utilities'),
  tx('2026-10-09', -445_400, 'other'),
  tx('2026-09-15', -100_000, 'restaurants'),
  tx('2026-08-30', 5_580_000, 'salary', { merchant: 'NOMINA EMPRESA DEMO' }),
  tx('2026-09-30', 5_580_000, 'salary', { merchant: 'NOMINA EMPRESA DEMO' }),
];

const screens = {
  'analytics.Spending': SpendingScreen,
  'analytics.Caps': CapsScreen,
  'analytics.CapForm': CapFormScreen,
  'transactions.All': RouteProbe,
};

afterEach(async () => {
  // Money queries use gcTime 0: let their removal timers run inside act before the next test.
  await act(async () => new Promise((resolve) => setTimeout(resolve, 20)));
  setAnalyticsService(null);
});

describe('Estadísticas', () => {
  it('shows the design numbers of the last 30 days (HU-021)', async () => {
    const h = await setupAnalytics(octoberTxs);
    setAnalyticsService(h.service);
    await renderScreens({ screens, initial: 'analytics.Spending' });
    expect(await screen.findByTestId('analytics.statistics.dailyAverage')).toHaveTextContent(
      'Promedio diario$116.080Últimos 30 días',
    );
    expect(screen.getByTestId('analytics.statistics.spent')).toHaveTextContent('$3.482.400');
    expect(screen.getByTestId('analytics.statistics.income')).toHaveTextContent('$5.580.000');
    expect(screen.getByTestId('analytics.statistics.balance')).toHaveTextContent(
      'Balance +$2.097.600',
    );
    expect(screen.getByTestId('analytics.total')).toHaveTextContent('$3.482.400');
    expect(screen.getByText('40 %')).toBeOnTheScreen();
    expect(screen.getByTestId('analytics.statistics.highest')).toHaveTextContent(
      'Gasto más alto$1.400.000COMERCIO RENT · 1 oct',
    );
    expect(screen.getByTestId('analytics.statistics.chart')).toHaveProp(
      'accessibilityLabel',
      'Gasto acumulado en últimos 30 días: $3.482.400. Ingresos: $5.580.000. 3382 % más que el mes anterior',
    );
  });

  it('changes the period and opens the movements of a category filtered', async () => {
    const h = await setupAnalytics(octoberTxs);
    setAnalyticsService(h.service);
    await renderScreens({ screens, initial: 'analytics.Spending' });
    await screen.findByTestId('analytics.statistics.dailyAverage');
    await fireEvent.press(screen.getByTestId('analytics.statistics.period-year'));
    expect(await screen.findByText('Gastaste en el último año')).toBeOnTheScreen();
    await fireEvent.press(await screen.findByTestId('analytics.category.restaurants'));
    expect(await screen.findByTestId('probe.route')).toHaveTextContent(
      'transactions.All {"categoryId":"restaurants","from":"2025-10-29","to":"2026-10-28"}',
    );
  });

  it('works in dark with the same numbers', async () => {
    const h = await setupAnalytics(octoberTxs);
    setAnalyticsService(h.service);
    await renderScreens({ screens, initial: 'analytics.Spending', preference: 'dark' });
    // The card is drawn before the numbers load: wait for the balance itself.
    expect(await screen.findByText('Balance +$2.097.600')).toBeOnTheScreen();
  });

  it('shows the weekday bars, where the person spends the most, and opens Topes', async () => {
    const h = await setupAnalytics(octoberTxs);
    setAnalyticsService(h.service);
    await renderScreens({ screens, initial: 'analytics.Spending' });
    // Thursday 1 October carries the rent, so Thursdays stand out.
    expect(await screen.findByTestId('analytics.statistics.weekdayPeak')).toHaveTextContent(
      /^Los jueves gastas en promedio/,
    );
    // Rent and utilities are fixed bills: Billetera shows them, not "Dónde más gastas".
    expect(screen.getByTestId('analytics.statistics.place.1')).toHaveTextContent(
      '1COMERCIO GROCERIES1 compra · Mercado$627.000',
    );
    await fireEvent.press(screen.getByTestId('analytics.statistics.caps'));
    expect(await screen.findByText('Aún no tienes topes.')).toBeOnTheScreen();
  });

  it('shows the trend with the month over month change', async () => {
    const h = await setupAnalytics(octoberTxs);
    setAnalyticsService(h.service);
    await renderScreens({ screens, initial: 'analytics.Spending' });
    expect(await screen.findByTestId('analytics.trend.last')).toHaveTextContent('$3.482.400');
    expect(screen.getByTestId('analytics.trend.change')).toHaveTextContent(
      '+3382 % frente al mes anterior',
    );
  });

  it('lists the recurring income with its usual day', async () => {
    const h = await setupAnalytics(octoberTxs);
    setAnalyticsService(h.service);
    await renderScreens({ screens, initial: 'analytics.Spending' });
    expect(await screen.findByText('NOMINA EMPRESA DEMO')).toBeOnTheScreen();
    expect(
      screen.getByText('Mensual · Suele llegar el día 30 · Estimado al mes'),
    ).toBeOnTheScreen();
  });

  it('shows the empty state while the module is not configured, in dark too', async () => {
    await renderScreens({ screens, initial: 'analytics.Spending', preference: 'dark' });
    expect(await screen.findAllByText('No hay gastos en este periodo.')).not.toHaveLength(0);
  });
});

describe('Topes', () => {
  it('creates a cap from Recomendaciones with the category and amount prefilled', async () => {
    const h = await setupAnalytics([tx('2026-10-26', -160_000, 'restaurants')]);
    setAnalyticsService(h.service);
    await renderScreens({
      screens,
      initial: 'analytics.CapForm',
      initialParams: { categoryId: 'restaurants', suggestedMinor: cop(200_000) },
    });
    expect(await screen.findByDisplayValue('$200.000')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('analytics.capForm.save'));
    // Saved: the form closes on Topes, which shows the new cap.
    expect(await screen.findByText('Cerca del tope')).toBeOnTheScreen();
    const [status] = await h.service.listCapStatuses();
    expect(status).toMatchObject({ percent: 80, state: 'warning' });
    expect(h.notifications.inbox()).toHaveLength(1);
  });

  it('asks for the "Antojos" threshold and keeps $20.000 by default', async () => {
    const h = await setupAnalytics([]);
    setAnalyticsService(h.service);
    await renderScreens({ screens, initial: 'analytics.CapForm' });
    await fireEvent.press(await screen.findByTestId('analytics.capForm.category.treats'));
    expect(await screen.findByDisplayValue('$20.000')).toBeOnTheScreen();
  });

  it('lists caps with progress and state', async () => {
    const h = await setupAnalytics([tx('2026-10-27', -250_000, 'restaurants')]);
    setAnalyticsService(h.service);
    await h.service.saveCap({ categoryId: 'restaurants', period: 'week', capMinor: cop(200_000) });
    await renderScreens({ screens, initial: 'analytics.Caps' });
    expect(await screen.findByText('Tope alcanzado')).toBeOnTheScreen();
    expect(screen.getByText('$250.000 de $200.000 · 125 %')).toBeOnTheScreen();
  });
});
