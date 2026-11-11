// Filtros (HU-016 SCRUM-30): filters by date, amount, kind, account and category from the
// sheet, the badge with the active filters, the filter of Estadísticas, and wrong input.
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import type { Account } from '@shared/domain/types';
import { createFixedClock } from '@shared/testing';

import { bankTx } from '../testing/fixtures';
import { createTestModule, renderScreens } from '../testing/renderScreen';
import { createAllTransactionsScreen } from './AllTransactionsScreen';
import { createFiltersSheet } from './FiltersSheet';
import { FILTERS_ROUTE, TRANSACTIONS_ROUTE } from './routes';

// Tuesday 22 Sep 2026 in Bogotá.
const clock = createFixedClock('2026-09-22T14:00:00Z');
const accounts = [
  { id: 'acc-ahorros', kind: 'savings', displayName: 'Bancolombia · Ahorros' },
  { id: 'acc-wallet', kind: 'wallet', displayName: 'Billetera Demo · Billetera' },
] as Account[];

async function setup(initialParams?: object) {
  const m = await createTestModule();
  await m.seed([
    bankTx({
      id: 'salary',
      bookedAt: '2026-09-15T15:00:00Z',
      amountMinor: 520_000_000,
      merchantRaw: 'Salario',
      categoryId: 'salary',
    }),
    bankTx({
      id: 'market',
      bookedAt: '2026-09-14T15:00:00Z',
      amountMinor: -18_430_000,
      merchantRaw: 'Supermercado',
      categoryId: 'groceries',
    }),
    bankTx({
      id: 'aug',
      bookedAt: '2026-08-20T15:00:00Z',
      amountMinor: -7_200_000,
      merchantRaw: 'Restaurante',
      categoryId: 'restaurants',
    }),
    bankTx({
      id: 'bus',
      accountId: 'acc-wallet',
      bookedAt: '2026-08-19T15:00:00Z',
      amountMinor: -650_000,
      merchantRaw: 'Transmilenio',
      categoryId: 'transport',
    }),
  ]);
  const useAccounts = () => ({ data: { accounts } });
  await renderScreens({
    screens: {
      [TRANSACTIONS_ROUTE]: createAllTransactionsScreen({
        hooks: m.hooks,
        useAccounts,
        refresh: async () => undefined,
        clock,
      }),
      [FILTERS_ROUTE]: createFiltersSheet({ useAccounts, clock }),
    },
    initial: TRANSACTIONS_ROUTE,
    initialParams,
  });
  await screen.findByTestId('transactions.summary');
  return m;
}

describe('Filtros', () => {
  it('applies kind and a date preset, and shows how many filters are on', async () => {
    await setup();
    await fireEvent.press(screen.getByLabelText('Filtros'));
    await fireEvent.press(await screen.findByText('Gastos'));
    await fireEvent.press(screen.getByText('Mes anterior'));
    await fireEvent.press(screen.getByText('Aplicar'));

    expect(await screen.findByText('Restaurante')).toBeTruthy();
    expect(screen.getByText('Transmilenio')).toBeTruthy();
    expect(screen.queryByText('Salario')).toBeNull();
    expect(screen.queryByText('Supermercado')).toBeNull();
    expect(screen.getByTestId('transactions.filtersBadge')).toHaveTextContent('2');
    expect(screen.getByLabelText('Filtros, 2 activos')).toBeTruthy();
    expect(screen.getByTestId('transactions.summary')).toHaveTextContent(/Mostrando 2 de 2/);
  });

  it('filters by amount, account and category, and keeps the choices when opened again', async () => {
    await setup();
    await fireEvent.press(screen.getByLabelText('Filtros'));
    // Typed without dots, shown in COP format (SCRUM-97).
    await fireEvent.changeText(await screen.findByLabelText('Mínimo'), '50000');
    await fireEvent.changeText(screen.getByLabelText('Máximo'), '200000');
    expect(screen.getByLabelText('Mínimo')).toHaveDisplayValue('50.000');
    expect(screen.getByLabelText('Máximo')).toHaveDisplayValue('200.000');
    await fireEvent.press(screen.getByText('Bancolombia · Ahorros'));
    await fireEvent.press(screen.getByText('Mercado'));
    await fireEvent.press(screen.getByText('Restaurantes'));
    await fireEvent.press(screen.getByText('Aplicar'));

    expect(await screen.findByText('Supermercado')).toBeTruthy();
    expect(screen.getByText('Restaurante')).toBeTruthy();
    expect(screen.queryByText('Transmilenio')).toBeNull();
    expect(screen.queryByText('Salario')).toBeNull();

    await fireEvent.press(screen.getByLabelText('Filtros, 3 activos'));
    expect(await screen.findByDisplayValue('50.000')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mercado' })).toBeSelected();
  });

  it('says what is wrong and does not apply', async () => {
    await setup();
    await fireEvent.press(screen.getByLabelText('Filtros'));
    await fireEvent.press(await screen.findByText('Personalizado'));
    await fireEvent.changeText(screen.getByLabelText('Desde'), '31/02/2026');
    await fireEvent.changeText(screen.getByLabelText('Mínimo'), '500.000');
    await fireEvent.changeText(screen.getByLabelText('Máximo'), '100.000');
    await fireEvent.press(screen.getByText('Aplicar'));

    expect(screen.getByText('Escribe la fecha como dd/mm/aaaa.')).toBeTruthy();
    expect(screen.getByText('El monto mínimo es mayor que el máximo.')).toBeTruthy();
    expect(screen.getByTestId('transactions.filters')).toBeTruthy();
  });

  it('clears every filter', async () => {
    await setup({ filter: { kind: 'income' } });
    expect(screen.queryByText('Supermercado')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Filtros, 1 activo'));
    await fireEvent.press(await screen.findByText('Limpiar'));
    await fireEvent.press(screen.getByText('Aplicar'));
    expect(await screen.findByText('Supermercado')).toBeTruthy();
    await waitFor(() => expect(screen.queryByTestId('transactions.filtersBadge')).toBeNull());
  });

  it('opens with the category and month that Estadísticas sends', async () => {
    await setup({ categoryId: 'restaurants', from: '2026-08-01', to: '2026-08-31' });
    expect(await screen.findByText('Restaurante')).toBeTruthy();
    expect(screen.queryByText('Transmilenio')).toBeNull();
    expect(screen.getByTestId('transactions.filtersBadge')).toHaveTextContent('2');
  });
});
