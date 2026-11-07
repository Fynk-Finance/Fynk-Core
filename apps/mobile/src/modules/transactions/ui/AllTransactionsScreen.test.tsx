// Movimientos (HU-015 SCRUM-29): date, amount and description, newest first, "Cargar 20 más",
// the summary line, pull to refresh with a sync, empty state, both themes.
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import type { Account } from '@shared/domain/types';
import { createFixedClock } from '@shared/testing';

import { bankTx, hourlyTxs } from '../testing/fixtures';
import { createTestModule, renderScreens } from '../testing/renderScreen';
import { createAllTransactionsScreen, TRANSACTIONS_ROUTE } from './AllTransactionsScreen';
import { SEARCH_DEBOUNCE_MS } from './useDebounced';

// Tuesday 22 Sep 2026, 9:00 in Bogotá.
const clock = createFixedClock('2026-09-22T14:00:00Z');

const accounts = [
  { id: 'acc-ahorros', kind: 'savings', displayName: 'Bancolombia · Ahorros' },
  { id: 'acc-cash', kind: 'cash', displayName: 'Efectivo' },
] as Account[];

async function setup(
  opts: { preference?: 'light' | 'dark'; refresh?: jest.Mock; disconnected?: boolean } = {},
) {
  const m = await createTestModule();
  const refresh = opts.refresh ?? jest.fn(async () => undefined);
  const Screen = createAllTransactionsScreen({
    hooks: m.hooks,
    // disconnected: the bank link was revoked, so M6 lists its accounts apart (HU-008).
    useAccounts: () => ({
      data: opts.disconnected ? { accounts: [], disconnectedAccounts: accounts } : { accounts },
    }),
    refresh,
    clock,
  });
  const render = () =>
    renderScreens({
      screens: { [TRANSACTIONS_ROUTE]: Screen },
      initial: TRANSACTIONS_ROUTE,
      preference: opts.preference,
    });
  return { ...m, refresh, render };
}

describe('Movimientos', () => {
  it('shows each day with its net and each movement with title, category, account and amount', async () => {
    const m = await setup();
    await m.seed([
      bankTx({
        id: 'salary',
        bookedAt: '2026-09-22T13:00:00Z',
        amountMinor: 520_000_000,
        description: 'Salario',
        merchantRaw: null,
        categoryId: 'salary',
      }),
      bankTx({
        id: 'shop',
        accountId: 'acc-cash',
        bookedAt: '2026-09-22T12:00:00Z',
        amountMinor: -2_010_000,
        merchantRaw: 'Tienda de barrio',
        categoryId: 'groceries',
      }),
      bankTx({ id: 'sunday', bookedAt: '2026-09-20T18:00:00Z', amountMinor: -30_000_000 }),
    ]);
    await m.render();

    expect(await screen.findByText('Hoy · 22 sep')).toBeTruthy();
    expect(screen.getByText('dom 20 sep')).toBeTruthy();
    expect(screen.getByText('+$5.179.900')).toBeTruthy();
    expect(screen.getByText('Salario')).toBeTruthy();
    expect(screen.getByText('Salario · Bancolombia')).toBeTruthy();
    expect(screen.getByText('Tienda de barrio')).toBeTruthy();
    expect(screen.getByText('Mercado · Efectivo')).toBeTruthy();
    expect(screen.getByText('+$5.200.000')).toBeTruthy();
    expect(screen.getByText('−$20.100')).toBeTruthy();
    expect(screen.getByLabelText('Ver detalle de Tienda de barrio, -$20.100')).toBeTruthy();
    expect(screen.getByTestId('transactions.summary')).toHaveTextContent(
      'Mostrando 3 de 3 · +$5.200.000 · −$320.100',
    );
  });

  it('keeps the entity of a movement whose bank link was revoked', async () => {
    const m = await setup({ disconnected: true });
    await m.seed([
      bankTx({
        id: 'salary',
        bookedAt: '2026-09-22T13:00:00Z',
        amountMinor: 520_000_000,
        description: 'Salario',
        merchantRaw: null,
        categoryId: 'salary',
      }),
    ]);
    await m.render();
    expect(await screen.findByText('Salario · Bancolombia')).toBeTruthy();
  });

  it('shows the newest 20 first and loads 20 more until there are none', async () => {
    const m = await setup();
    const txs = hourlyTxs(45, '2026-09-22T13:00:00Z');
    await m.seed(txs);
    await m.render();

    // The list is virtualized, so the summary line tells how many rows are loaded.
    const summary = () => screen.getByTestId('transactions.summary');
    await screen.findByTestId('transactions.row.tx-000');
    await waitFor(() => expect(summary()).toHaveTextContent(/Mostrando 20 de 45/));

    await fireEvent.press(screen.getByText('Cargar 20 más'));
    await waitFor(() => expect(summary()).toHaveTextContent(/Mostrando 40 de 45/));
    await fireEvent.press(screen.getByText('Cargar 20 más'));
    await waitFor(() => expect(summary()).toHaveTextContent(/Mostrando 45 de 45/));
    expect(screen.queryByText('Cargar 20 más')).toBeNull();
  });

  it('starts a sync on pull to refresh and shows what it brought', async () => {
    let m: Awaited<ReturnType<typeof setup>>;
    const refresh = jest.fn(async () => {
      await m.seed([bankTx({ id: 'new', bookedAt: '2026-09-22T13:30:00Z', merchantRaw: 'Nuevo' })]);
    });
    m = await setup({ refresh });
    await m.seed([bankTx({ id: 'old', bookedAt: '2026-09-21T13:00:00Z' })]);
    await m.render();
    await screen.findByTestId('transactions.row.old');

    const { refreshControl } = screen.getByTestId('transactions.list').props as {
      refreshControl: { props: { onRefresh: () => void } };
    };
    await act(async () => refreshControl.props.onRefresh());
    await waitFor(() => expect(screen.getByText('Nuevo')).toBeTruthy());
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('refreshes when another module changes movements', async () => {
    const m = await setup();
    await m.render();
    await screen.findByText('Aún no tienes movimientos');
    await m.seed([bankTx({ id: 'a', bookedAt: '2026-09-22T13:00:00Z', merchantRaw: 'Llegó' })]);
    await act(async () => m.events.emit({ type: 'transactions.changed', ids: ['a'] }));
    expect(await screen.findByText('Llegó')).toBeTruthy();
  });

  it('uses the dark colors in dark mode', async () => {
    const m = await setup({ preference: 'dark' });
    await m.seed([bankTx({ id: 'a', bookedAt: '2026-09-22T13:00:00Z', merchantRaw: 'Café' })]);
    await m.render();
    const title = await screen.findByText('Movimientos');
    expect(title).toHaveStyle({ color: '#E8F1F6' });
    expect(screen.getByTestId('transactions.all')).toHaveStyle({ backgroundColor: '#13212D' });
  });
});

describe('Buscar por nombre (HU-017)', () => {
  // The search waits for a pause in typing: let that timer run inside act.
  const type = async (text: string) => {
    await fireEvent.changeText(screen.getByLabelText('Buscar por nombre'), text);
    await act(async () => new Promise((r) => setTimeout(r, SEARCH_DEBOUNCE_MS + 50)));
  };

  it('finds movements as the person types, without case or accents', async () => {
    const m = await setup();
    await m.seed([
      bankTx({ id: 'super', bookedAt: '2026-09-22T13:00:00Z', merchantRaw: 'Supermercado' }),
      bankTx({
        id: 'cafe',
        bookedAt: '2026-09-21T13:00:00Z',
        description: 'Café Señor',
        merchantRaw: 'Café Señor',
      }),
    ]);
    await m.render();
    await screen.findByText('Café Señor');

    // Wait for the result itself, not for the old rows to go: in between the list loads.
    const slow = { timeout: 5000 };
    await type('SUPERMÉRC');
    await waitFor(
      () =>
        expect(screen.getByTestId('transactions.summary')).toHaveTextContent(/Mostrando 1 de 1/),
      slow,
    );
    expect(await screen.findByText('Supermercado', {}, slow)).toBeTruthy();
    expect(screen.queryByText('Café Señor')).toBeNull();

    await type('netflix');
    expect(await screen.findByText('No encontramos movimientos', {}, slow)).toBeTruthy();

    await type('');
    expect(await screen.findByText('Café Señor', {}, slow)).toBeTruthy();
  });
});
