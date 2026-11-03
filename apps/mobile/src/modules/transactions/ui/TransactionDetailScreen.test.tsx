// Detalle de movimiento (HU-015 fecha, monto y descripción; HU-018 modificación manual e
// historial): its data, "Cambiar categoría" with "¿Aplicar a todos…?", the history, both themes.
import { act, fireEvent, screen } from '@testing-library/react-native';
import type { Alert } from 'react-native';

import type { Account } from '@shared/domain/types';
import { createFixedClock } from '@shared/testing';

import { bankTx } from '../testing/fixtures';
import { createTestModule, renderScreens } from '../testing/renderScreen';
import { createAllTransactionsScreen } from './AllTransactionsScreen';
import { createCategoryPickerSheet } from './CategoryPickerSheet';
import { dateTimeLabel } from './labels';
import { CATEGORY_ROUTE, DETAIL_ROUTE, TRANSACTIONS_ROUTE } from './routes';
import { createTransactionDetailScreen } from './TransactionDetailScreen';

const clock = createFixedClock('2026-09-22T14:00:00Z');
const accounts = [
  { id: 'acc-ahorros', kind: 'savings', displayName: 'Bancolombia · Ahorros' },
] as Account[];

type Buttons = Parameters<typeof Alert.alert>[2];

async function setup(answer: 'Solo este' | 'Aplicar a todos' = 'Solo este') {
  const m = await createTestModule();
  await m.seed([
    bankTx({
      id: 'c1',
      bookedAt: '2026-09-21T14:03:00Z',
      description: 'COMPRA POS JUAN VALDEZ',
      merchantRaw: 'Juan Valdez',
      merchantKey: 'juan valdez',
      amountMinor: -980_000,
      categoryId: 'other',
    }),
    bankTx({
      id: 'c2',
      bookedAt: '2026-09-20T14:03:00Z',
      merchantRaw: 'Juan Valdez',
      merchantKey: 'juan valdez',
      categoryId: 'other',
    }),
  ]);
  const ask = jest.fn((_title: string, _message?: string, buttons?: Buttons) => {
    buttons?.find((b) => b.text === answer)?.onPress?.();
  });
  const useAccounts = () => ({ data: { accounts } });
  await renderScreens({
    screens: {
      [TRANSACTIONS_ROUTE]: createAllTransactionsScreen({
        hooks: m.hooks,
        useAccounts,
        refresh: async () => undefined,
        clock,
      }),
      [DETAIL_ROUTE]: createTransactionDetailScreen({ hooks: m.hooks, useAccounts }),
      [CATEGORY_ROUTE]: createCategoryPickerSheet({
        hooks: m.hooks,
        changeCategory: (id, categoryId, opts) => m.categories.changeCategory(id, categoryId, opts),
        ask,
      }),
    },
    initial: TRANSACTIONS_ROUTE,
  });
  await fireEvent.press(await screen.findByLabelText('Ver detalle de Juan Valdez, -$9.800'));
  await screen.findByTestId('transactions.detail.amount');
  return { ...m, ask };
}

describe('Detalle de movimiento', () => {
  it('opens from a row and shows amount, date and time, account, description and merchant', async () => {
    await setup();
    expect(screen.getByTestId('transactions.detail.amount')).toHaveTextContent('−$9.800');
    expect(screen.getByText('lunes 21 sep 2026 · 9:03 a. m.')).toBeTruthy();
    expect(screen.getByText('Bancolombia · Cuenta de ahorros')).toBeTruthy();
    expect(screen.getByText('COMPRA POS JUAN VALDEZ')).toBeTruthy();
    expect(screen.getByText('Aplicado')).toBeTruthy();
    expect(screen.getByTestId('transactions.detail.category')).toHaveTextContent('Otros');
  });

  it('changes only this movement and shows the history line', async () => {
    const m = await setup('Solo este');
    await fireEvent.press(screen.getByText('Cambiar categoría'));
    await fireEvent.press(await screen.findByTestId('transactions.category.restaurants'));

    expect(m.ask).toHaveBeenCalledWith(
      '¿Aplicar a todos los movimientos de Juan Valdez?',
      expect.any(String),
      expect.any(Array),
    );
    expect(await screen.findByText('Cambiaste de Otros a Restaurantes el 21 sep')).toBeTruthy();
    expect(screen.getByTestId('transactions.detail.category')).toHaveTextContent('Restaurantes');
    expect((await m.service.getTransaction('c2'))?.categoryId).toBe('other');
  });

  it('applies the category to every movement of the merchant', async () => {
    const m = await setup('Aplicar a todos');
    await fireEvent.press(screen.getByText('Cambiar categoría'));
    await fireEvent.press(await screen.findByTestId('transactions.category.restaurants'));
    await screen.findByText('Cambiaste de Otros a Restaurantes el 21 sep');
    expect((await m.service.getTransaction('c2'))?.categoryId).toBe('restaurants');
  });

  it('says when the movement is gone', async () => {
    const m = await setup();
    await act(async () => {
      await m.vault.db.execute("DELETE FROM transactions_transactions WHERE id = 'c1'");
      m.events.emit({ type: 'transactions.changed', ids: ['c1'] });
    });
    expect(await screen.findByText('Este movimiento ya no está')).toBeTruthy();
  });
});

describe('dateTimeLabel', () => {
  it('writes the Bogotá date and a 12 hour time', () => {
    expect(dateTimeLabel('2026-09-22T05:00:00Z')).toBe('martes 22 sep 2026 · 12:00 a. m.');
    expect(dateTimeLabel('2026-09-22T19:45:00Z')).toBe('martes 22 sep 2026 · 2:45 p. m.');
  });
});
