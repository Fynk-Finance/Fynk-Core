// Nuevo movimiento manual (SCRUM-29, SCRUM-32): a gasto in Efectivo, an ingreso with its
// category, the checks, and edit and delete from the detail of a manual movement.
import { fireEvent, screen } from '@testing-library/react-native';
import type { Alert } from 'react-native';

import type { Account } from '@shared/domain/types';
import { createFixedClock } from '@shared/testing';

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

type Buttons = Parameters<typeof Alert.alert>[2];

async function setup(opts: { accounts?: Account[]; initial?: string } = {}) {
  const m = await createTestModule();
  const useAccounts = () => ({ data: { accounts: opts.accounts ?? accounts } });
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
        add: (input) => m.manual.addManualTransaction(input),
        update: (id, input) => m.manual.updateManualTransaction(id, input),
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
    await fireEvent.press(screen.getByText('Otros ingresos'));
    await fireEvent.press(screen.getByText('Guardar'));

    const [tx] = await m.service.getTransactionsBetween('2026-09-21', '2026-09-21');
    expect(tx).toMatchObject({
      accountId: 'acc-ahorros',
      amountMinor: 12_000_000,
      categoryId: 'income_other',
      categorySource: 'user',
    });
  });

  it('says what is missing and saves nothing', async () => {
    const m = await setup();
    await fireEvent.press(await screen.findByText('Guardar'));
    expect(screen.getByText('Escribe el monto en pesos, mayor que cero.')).toBeTruthy();
    expect(screen.getByText('Escribe una descripción.')).toBeTruthy();
    expect(await m.service.getTransactionsBetween('2026-01-01', '2026-12-31')).toEqual([]);
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
