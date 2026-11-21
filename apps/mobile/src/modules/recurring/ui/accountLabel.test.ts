// "Tarjeta de crédito" in Billetera, "Tarjeta de crédito •• 4821" in Detalle, never more digits.
import type { Account } from '@shared/domain/types';

import { accountKind, accountWithNumber } from './accountLabel';

const card = { id: 'a', kind: 'credit_card', last4: '4821' } as Account;

describe('account labels', () => {
  it('names the kind, and the last 4 digits in the detail', () => {
    expect(accountKind(card)).toBe('Tarjeta de crédito');
    expect(accountWithNumber(card)).toBe('Tarjeta de crédito •• 4821');
    expect(accountWithNumber({ ...card, kind: 'savings', last4: null })).toBe('Cuenta de ahorros');
    expect(accountWithNumber({ ...card, last4: '5555 4444 3333 4821' })).toBe(
      'Tarjeta de crédito •• 4821',
    );
    expect(accountKind(null)).toBeNull();
  });
});
