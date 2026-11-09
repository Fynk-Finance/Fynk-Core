// Nuevo movimiento manual (SCRUM-29, SCRUM-32): a gasto in Efectivo, an ingreso with its
// category, the checks, and edit and delete from the detail of a manual movement. Since the
// team decision of 5 Nov 2026: disconnected accounts, "Tu efectivo es $X", and a note that says
// which balance the movement changes.
import { fireEvent, screen } from '@testing-library/react-native';

import type { Account, Transaction } from '@shared/domain/types';
import { createFixedClock } from '@shared/testing';
import type { dialog } from '@shared/ui';

import type { ManualInput } from '../domain/manual';
import { createTestModule, renderScreens } from '../testing/renderScreen';
import { createAllTransactionsScreen } from './AllTransactionsScreen';
import { createManualTransactionSheet } from './ManualTransactionSheet';
import { DETAIL_ROUTE, NEW_TRANSACTION_ROUTE, TRANSACTIONS_ROUTE } from './routes';
import { createTransactionDetailScreen } from './TransactionDetailScreen';

// Tuesday 22 Sep 2026, 9:00 in Bogotá.
const clock = createFixedClock('2026-09-22T14:00:00Z');
const accounts = [
  { id: 'acc-ahorros', kind: 'savings', displayName: 'Bancolombia · Ahorros' },
  { id: 'acc-cash', kind: 'cash', displayName: 'Efectivo' },
  { id: 'acc-cdt', kind: 'cdt', displayName: 'Banco Demo · CDT' },
] as Account[];
const disconnected = [
  { id: 'acc-old', kind: 'savings', displayName: 'Banco Demo · Ahorros', status: 'revoked' },
] as Account[];

type Buttons = Parameters<typeof dialog.show>[2];

async function setup(
  opts: {
    accounts?: Account[];
    disconnectedAccounts?: Account[];
    initial?: string;
    initialParams?: object;
    add?: (input: ManualInput) => Promise<Transaction>;
    ensureCash?: () => Promise<string>;
    cashShortOf?: (error: unknown) => number | null;
  } = {},
) {
  const m = await createTestModule();
  const useAccounts = () => ({
    data: {
      accounts: opts.accounts ?? accounts,
      disconnectedAccounts: opts.disconnectedAccounts ?? [],
    },
  });
  const ask = jest.fn((_t: string, _m?: string, buttons?: Buttons) => {
    buttons?.find((b) => b.style === 'destructive')?.onPress?.();
  });
  await renderScreens({
    screens: {
      [TRANSACTIONS_ROUTE]: createAllTransactionsScreen({
        hooks: m.hooks,
        useAccounts,
        refresh: async () => undefined,
        clock,
      }),
      [NEW_TRANSACTION_ROUTE]: createManualTransactionSheet({
        hooks: m.hooks,
        useAccounts,
        add: opts.add ?? ((input) => m.manual.addManualTransaction(input)),
        update: (id, input) => m.manual.updateManualTransaction(id, input),
        ...(opts.cashShortOf ? { cashShortOf: opts.cashShortOf } : {}),
        ...(opts.ensureCash ? { ensureCash: opts.ensureCash } : {}),
        clock,
      }),
      [DETAIL_ROUTE]: createTransactionDetailScreen({
        hooks: m.hooks,
        useAccounts,
        deleteManual: (id) => m.manual.deleteManualTransaction(id),
        ask,
      }),
    },
    initial: opts.initial ?? NEW_TRANSACTION_ROUTE,
    ...(opts.initialParams ? { initialParams: opts.initialParams } : {}),
  });
  return { ...m, ask };
}

describe('Registrar movimiento', () => {
  it('registers a gasto in Efectivo for today, categorized from its description', async () => {
    const m = await setup();
    expect(await screen.findByText('Registrar movimiento')).toBeTruthy();
    expect(screen.queryByText('Banco Demo · CDT')).toBeNull();
    expect(screen.getByRole('button', { name: 'Efectivo' })).toBeSelected();

    await fireEvent.changeText(screen.getByLabelText('Monto'), '25.000');
    await fireEvent.changeText(screen.getByLabelText('Descripción'), 'Almuerzo');
    await fireEvent.press(screen.getByText('Guardar'));

    const [tx] = await m.service.getTransactionsBetween('2026-09-22', '2026-09-22');
    expect(tx).toMatchObject({
      accountId: 'acc-cash',
      source: 'manual',
      amountMinor: -2_500_000,
      bookedAt: '2026-09-22T14:00:00.000Z',
      description: 'Almuerzo',
      categoryId: 'restaurants',
    });
  });

  it('registers an ingreso in a bank account with the category the person picks', async () => {
    const m = await setup();
    await fireEvent.press(await screen.findByText('Ingreso'));
    await fireEvent.changeText(screen.getByLabelText('Monto'), '120.000');
    await fireEvent.press(screen.getByText('Bancolombia · Cuenta de ahorros'));
    await fireEvent.press(screen.getByText('Ayer'));
    await fireEvent.changeText(screen.getByLabelText('Descripción'), 'Venta bicicleta');
    // The categories are a dropdown (QA review 2026-11-07, V11): open it, then pick.
    await fireEvent.press(screen.getByRole('button', { name: 'Categoría: Automática' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Otros ingresos' }));
    await fireEvent.press(screen.getByText('Guardar'));

    const [tx] = await m.service.getTransactionsBetween('2026-09-21', '2026-09-21');
    expect(tx).toMatchObject({
      accountId: 'acc-ahorros',
      amountMinor: 12_000_000,
      categoryId: 'income_other',
      categorySource: 'user',
    });
  });

  // QA review 2026-11-07, V11: one field instead of 21 chips.
  it('keeps the categories folded in a dropdown until it is opened', async () => {
    await setup();
    const field = await screen.findByRole('button', { name: 'Categoría: Automática' });
    expect(screen.queryByRole('radio', { name: 'Mercado' })).toBeNull();
    await fireEvent.press(field);
    expect(screen.getByRole('radio', { name: 'Automática' })).toBeChecked();
    await fireEvent.press(screen.getByRole('radio', { name: 'Mercado' }));
    expect(screen.getByRole('button', { name: 'Categoría: Mercado' })).not.toBeExpanded();
  });

  it('says what is missing and saves nothing', async () => {
    const m = await setup();
    await fireEvent.press(await screen.findByText('Guardar'));
    expect(screen.getByText('Escribe el monto en pesos, mayor que cero.')).toBeTruthy();
    expect(screen.getByText('Escribe una descripción.')).toBeTruthy();
    expect(await m.service.getTransactionsBetween('2026-01-01', '2026-12-31')).toEqual([]);
  });

  // QA review 2026-11-07, F5 (SCRUM-95): the Dashboard + offers Ingreso or Gasto.
  it.each([
    ['income', 'Ingreso'],
    ['expense', 'Gasto'],
  ] as const)('opens on %s when the Dashboard asks for it', async (kind, label) => {
    await setup({ initialParams: { kind } });
    expect(await screen.findByRole('radio', { name: label })).toBeSelected();
  });

  // F5: someone who skipped cash in onboarding can still add money.
  it('offers Efectivo without a cash account, and M6 creates it on save', async () => {
    const add = jest.fn(async (input: ManualInput) => ({ id: 'tx-1', ...input }) as never);
    const ensureCash = jest.fn(async () => 'acc-new-cash');
    await setup({ accounts: [accounts[0]!], ensureCash, add, initialParams: { kind: 'income' } });
    const cash = await screen.findByRole('button', { name: 'Efectivo' });
    expect(cash).toBeSelected();
    expect(screen.getByText('Actualiza tu efectivo. No mueve dinero.')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Monto'), '50.000');
    await fireEvent.changeText(screen.getByLabelText('Descripción'), 'Regalo');
    await fireEvent.press(screen.getByText('Guardar'));
    expect(ensureCash).toHaveBeenCalledTimes(1);
    expect(add).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: 'acc-new-cash', amountMinor: 5_000_000 }),
    );
  });

  it('keeps Efectivo picked once M6 created it and refused a bigger Gasto', async () => {
    let list: Account[] = [accounts[0]!];
    const ensureCash = jest.fn(async () => {
      list = [accounts[0]!, accounts[1]!];
      return 'acc-cash';
    });
    const add = jest.fn(async () => {
      throw new Error('short');
    });
    const m = await createTestModule();
    const useAccounts = () => ({ data: { accounts: list } });
    const Sheet = createManualTransactionSheet({
      hooks: m.hooks,
      useAccounts,
      add,
      update: (id, input) => m.manual.updateManualTransaction(id, input),
      cashShortOf: () => 0,
      ensureCash,
      clock,
    });
    await renderScreens({
      screens: { [NEW_TRANSACTION_ROUTE]: Sheet },
      initial: NEW_TRANSACTION_ROUTE,
    });
    await fireEvent.changeText(await screen.findByLabelText('Monto'), '10.000');
    await fireEvent.changeText(screen.getByLabelText('Descripción'), 'Taxi');
    await fireEvent.press(screen.getByText('Guardar'));
    expect(await screen.findByText('Tu efectivo es $0')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Monto'), '0');
    const chips = screen.getAllByRole('button', { name: 'Efectivo' });
    expect(chips).toHaveLength(1);
    expect(chips[0]).toBeSelected();
  });

  it('offers Efectivo with no accounts at all, instead of a dead end', async () => {
    await setup({ accounts: [], ensureCash: async () => 'acc-new-cash' });
    expect(await screen.findByRole('button', { name: 'Efectivo' })).toBeSelected();
    expect(screen.queryByText('Primero registra tu efectivo o conecta una cuenta')).toBeNull();
  });

  it('does not create cash when another account is picked', async () => {
    const ensureCash = jest.fn(async () => 'acc-new-cash');
    const m = await setup({ accounts: [accounts[0]!], ensureCash });
    await fireEvent.press(await screen.findByText('Bancolombia · Cuenta de ahorros'));
    await fireEvent.changeText(screen.getByLabelText('Monto'), '10.000');
    await fireEvent.changeText(screen.getByLabelText('Descripción'), 'Taxi');
    await fireEvent.press(screen.getByText('Guardar'));
    expect(ensureCash).not.toHaveBeenCalled();
    const [tx] = await m.service.getTransactionsBetween('2026-09-22', '2026-09-22');
    expect(tx).toMatchObject({ accountId: 'acc-ahorros' });
  });

  it('asks to register cash or connect an account first', async () => {
    await setup({ accounts: [] });
    expect(
      await screen.findByText('Primero registra tu efectivo o conecta una cuenta'),
    ).toBeTruthy();
  });
});

describe('Editar and Eliminar of a manual movement', () => {
  async function openDetail() {
    const m = await setup({ initial: TRANSACTIONS_ROUTE });
    await m.manual.addManualTransaction({
      accountId: 'acc-cash',
      kind: 'expense',
      amountMinor: 2_500_000,
      bookedAt: '2026-09-21T17:00:00Z',
      description: 'Almuerzo',
    });
    await fireEvent.press(await screen.findByLabelText('Ver detalle de Almuerzo, -$25.000'));
    await screen.findByText('Registrado manualmente');
    return m;
  }

  it('edits it from its detail', async () => {
    const m = await openDetail();
    await fireEvent.press(screen.getByText('Editar'));
    expect(await screen.findByText('Editar movimiento')).toBeTruthy();
    expect(screen.getByDisplayValue('25.000')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Monto'), '30.000');
    await fireEvent.press(screen.getByText('Guardar'));
    expect(await screen.findByText('−$30.000')).toBeTruthy();
    expect((await m.service.getTransaction('manual-1'))?.bookedAt).toBe('2026-09-21T17:00:00.000Z');
  });

  it('deletes it after asking', async () => {
    const m = await openDetail();
    await fireEvent.press(screen.getByText('Eliminar'));
    expect(m.ask).toHaveBeenCalledWith(
      '¿Eliminar este movimiento?',
      expect.any(String),
      expect.any(Array),
    );
    expect(await screen.findByText('Aún no tienes movimientos')).toBeTruthy();
    expect(await m.service.getTransaction('manual-1')).toBeNull();
  });
});

describe('balances (team decision of 5 Nov 2026)', () => {
  it('offers disconnected accounts after the connected ones, marked "Desconectada"', async () => {
    await setup({ disconnectedAccounts: disconnected });
    expect(
      await screen.findByRole('button', { name: 'Banco Demo · Cuenta de ahorros · Desconectada' }),
    ).toBeTruthy();
  });

  it('says which balance the movement changes, for the account picked', async () => {
    await setup({ disconnectedAccounts: disconnected });
    expect(await screen.findByText('Actualiza tu efectivo. No mueve dinero.')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Bancolombia · Cuenta de ahorros' }));
    expect(
      screen.getByText(
        'Es un registro: no mueve dinero. Tu banco actualiza el saldo al sincronizar.',
      ),
    ).toBeTruthy();

    await fireEvent.press(
      screen.getByRole('button', { name: 'Banco Demo · Cuenta de ahorros · Desconectada' }),
    );
    expect(
      screen.getByText('Actualiza el saldo de esta cuenta desconectada. No mueve dinero.'),
    ).toBeTruthy();
  });

  it('says how much cash there is when the Gasto is bigger, and stays open', async () => {
    const short = new Error('InsufficientCashError');
    await setup({
      add: () => Promise.reject(short),
      cashShortOf: (e) => (e === short ? 3_000_000 : null),
    });
    await fireEvent.changeText(await screen.findByLabelText('Monto'), '50.000');
    await fireEvent.changeText(screen.getByLabelText('Descripción'), 'Mercado');
    await fireEvent.press(screen.getByText('Guardar'));

    expect(await screen.findByText('Tu efectivo es $30.000')).toBeTruthy();
    expect(screen.queryByText('No pudimos guardar el movimiento. Intenta de nuevo.')).toBeNull();
    expect(screen.getByText('Registrar movimiento')).toBeTruthy();
  });
});
