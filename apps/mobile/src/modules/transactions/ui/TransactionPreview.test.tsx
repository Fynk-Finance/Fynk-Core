// The Dashboard preview and the list of Detalle de cuenta (HU-015 SCRUM-29): latest movements,
// "Ver todo", rows of one account only, the count, open and close.
import { fireEvent, screen, within } from '@testing-library/react-native';

import type { Account } from '@shared/domain/types';

import { bankTx, hourlyTxs } from '../testing/fixtures';
import { createTestModule, renderScreens, RouteProbe } from '../testing/renderScreen';
import { TRANSACTIONS_ROUTE } from './AllTransactionsScreen';
import { createTransactionList } from './TransactionList';
import { createTransactionPreview } from './TransactionPreview';

const accounts = [
  { id: 'acc-ahorros', kind: 'savings', displayName: 'Bancolombia · Ahorros' },
  { id: 'acc-card', kind: 'credit_card', displayName: 'Nu Bank · Tarjeta' },
] as Account[];

describe('TransactionPreview', () => {
  it('shows the 3 latest movements with account kind and date, and opens Movimientos', async () => {
    const m = await createTestModule();
    await m.seed([
      ...hourlyTxs(5, '2026-09-21T20:00:00Z'),
      bankTx({
        id: 'salary',
        bookedAt: '2026-09-22T13:00:00Z',
        amountMinor: 520_000_000,
        merchantRaw: null,
        description: 'Salario',
      }),
      bankTx({ id: 'card', accountId: 'acc-card', bookedAt: '2026-09-22T12:00:00Z' }),
    ]);
    const Preview = createTransactionPreview({
      hooks: m.hooks,
      useAccounts: () => ({ data: { accounts } }),
    });
    await renderScreens({
      screens: { Home: Preview, [TRANSACTIONS_ROUTE]: RouteProbe },
      initial: 'Home',
    });

    expect(await screen.findByText('Salario')).toBeTruthy();
    expect(screen.getByText('Cuenta de ahorros · 22 sep')).toBeTruthy();
    expect(screen.getByText('Tarjeta de crédito · 22 sep')).toBeTruthy();
    expect(screen.getByTestId('transactions.row.tx-000')).toBeTruthy();
    expect(screen.queryByTestId('transactions.row.tx-001')).toBeNull();
    expect(screen.getByText('+$5.200.000')).toHaveStyle({ color: '#1F93C2' });

    await fireEvent.press(screen.getByText('Ver todo'));
    expect(await screen.findByTestId('probe.route')).toHaveTextContent('transactions.All {}');
  });

  // A revoked bank link moves its accounts to disconnectedAccounts (M6, HU-008).
  it('keeps the account kind of a movement whose bank link was revoked', async () => {
    const m = await createTestModule();
    await m.seed([bankTx({ id: 'old', bookedAt: '2026-10-26T15:00:00Z' })]);
    const Preview = createTransactionPreview({
      hooks: m.hooks,
      useAccounts: () => ({ data: { accounts: [], disconnectedAccounts: accounts } }),
    });
    await renderScreens({ screens: { Home: Preview }, initial: 'Home' });
    expect(await screen.findByText('Cuenta de ahorros · 26 oct')).toBeTruthy();
  });

  it('says there are no movements yet', async () => {
    const m = await createTestModule();
    const Preview = createTransactionPreview({ hooks: m.hooks, useAccounts: () => ({}) });
    await renderScreens({ screens: { Home: Preview }, initial: 'Home' });
    expect(await screen.findByText('Aún no tienes movimientos.')).toBeTruthy();
  });

  // QA review 2026-11-07, V10 (SCRUM-85): a grayscale illustration above the message, centered in
  // the free space of the page.
  it.each(['light', 'dark'] as const)(
    'centers a still illustration above the message in the free space, in %s',
    async (preference) => {
      const m = await createTestModule();
      const Preview = createTransactionPreview({ hooks: m.hooks, useAccounts: () => ({}) });
      await renderScreens({ screens: { Home: Preview }, initial: 'Home', preference });
      const empty = await screen.findByTestId('transactions.preview.empty');
      expect(screen.getByTestId('transactions.preview')).toHaveStyle({ flexGrow: 1 });
      expect(empty).toHaveStyle({ flexGrow: 1, justifyContent: 'center', alignItems: 'center' });
      const art = screen.getByTestId('transactions.preview.emptyArt', {
        includeHiddenElements: true,
      });
      // Above the message, and silent for screen readers: the message says it all.
      const tree = JSON.stringify(screen.toJSON());
      expect(tree.indexOf('transactions.preview.emptyArt')).toBeLessThan(
        tree.indexOf('Aún no tienes movimientos.'),
      );
      expect(within(empty).getByText('Aún no tienes movimientos.')).toBeTruthy();
      expect(screen.queryByTestId('transactions.preview.emptyArt')).toBeNull();
      expect(art).toBeTruthy();
    },
  );

  it('keeps its natural height when there are movements', async () => {
    const m = await createTestModule();
    await m.seed([bankTx({ id: 'one', bookedAt: '2026-10-26T15:00:00Z' })]);
    const Preview = createTransactionPreview({ hooks: m.hooks, useAccounts: () => ({}) });
    await renderScreens({ screens: { Home: Preview }, initial: 'Home' });
    await screen.findByTestId('transactions.row.one');
    expect(screen.getByTestId('transactions.preview')).not.toHaveStyle({ flexGrow: 1 });
  });
});

describe('TransactionList', () => {
  it('lists only the movements of the filter with the count, and opens and closes', async () => {
    const m = await createTestModule();
    await m.seed([
      bankTx({
        id: 'nomina',
        bookedAt: '2026-10-25T15:00:00Z',
        amountMinor: 420_000_000,
        merchantRaw: 'Nómina',
        categoryId: 'salary',
      }),
      bankTx({
        id: 'super',
        bookedAt: '2026-10-24T15:00:00Z',
        merchantRaw: 'Supermercado',
        categoryId: 'groceries',
      }),
      bankTx({ id: 'other', accountId: 'acc-card', bookedAt: '2026-10-24T16:00:00Z' }),
    ]);
    const List = createTransactionList({ hooks: m.hooks });
    await renderScreens({
      screens: { Home: () => <List filter={{ accountIds: ['acc-ahorros'] }} /> },
      initial: 'Home',
    });

    expect(await screen.findByText('Nómina')).toBeTruthy();
    expect(screen.getByText('25 oct · Salario')).toBeTruthy();
    expect(screen.getByText('24 oct · Mercado')).toBeTruthy();
    expect(screen.queryByTestId('transactions.row.other')).toBeNull();
    // Money in is lime in Detalle de cuenta.
    expect(screen.getByText('+$4.200.000')).toHaveStyle({ color: '#4F7A0B' });
    expect(await screen.findByLabelText('Movimientos, 2 movimientos')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Movimientos, 2 movimientos'));
    expect(screen.queryByText('Nómina')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Movimientos, 2 movimientos'));
    expect(screen.getByText('Nómina')).toBeTruthy();
  });

  it('loads 20 more for an account with many movements', async () => {
    const m = await createTestModule();
    await m.seed(hourlyTxs(25, '2026-10-24T15:00:00Z'));
    const List = createTransactionList({ hooks: m.hooks });
    await renderScreens({
      screens: { Home: () => <List filter={{ accountIds: ['acc-ahorros'] }} /> },
      initial: 'Home',
    });
    await screen.findByTestId('transactions.row.tx-019');
    expect(screen.queryByTestId('transactions.row.tx-020')).toBeNull();
    await fireEvent.press(screen.getByText('Cargar 20 más'));
    expect(await screen.findByTestId('transactions.row.tx-024')).toBeTruthy();
    expect(screen.queryByText('Cargar 20 más')).toBeNull();
  });
});
