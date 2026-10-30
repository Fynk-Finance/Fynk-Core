// From what the bank returned to the shared Account and Transaction (00-shared-contracts.md,
// section 2). Ids are stable, so a second sync updates the same rows (no duplicates).
import { accountIdOf, toAccount, toTransaction, transactionIdOf } from './syncMapping';

const context = { provider: 'banco-demo', linkId: 'link-1', syncedAt: '2026-10-29T15:00:00.000Z' };

const remoteSavings = {
  providerAccountId: 'acc-1',
  kind: 'savings' as const,
  displayName: 'Banco Demo · Ahorros',
  last4: '4321',
  currency: 'COP' as const,
  balanceMinor: 320_000_000,
  status: 'active' as const,
  isSimulated: true,
};

it('gives each bank account the same id on every sync, and different ids to different accounts', () => {
  expect(accountIdOf('banco-demo', 'acc-1')).toBe(accountIdOf('banco-demo', 'acc-1'));
  expect(accountIdOf('banco-demo', 'acc-1')).not.toBe(accountIdOf('banco-demo', 'acc-2'));
  expect(accountIdOf('banco-demo', 'acc-1')).not.toBe(accountIdOf('billetera-demo', 'acc-1'));
  expect(accountIdOf('banco-demo', 'acc-1')).toMatch(/^bank_[A-Za-z0-9_-]{22}$/);
});

it('keeps two parts apart in the id: "a" + "b:c" is not "a:b" + "c"', () => {
  expect(accountIdOf('a', 'b:c')).not.toBe(accountIdOf('a:b', 'c'));
});

it('maps a savings account with its link and the time of the sync', () => {
  expect(toAccount(remoteSavings, context)).toEqual({
    id: accountIdOf('banco-demo', 'acc-1'),
    provider: 'banco-demo',
    providerAccountId: 'acc-1',
    linkId: 'link-1',
    kind: 'savings',
    displayName: 'Banco Demo · Ahorros',
    last4: '4321',
    currency: 'COP',
    balanceMinor: 320_000_000,
    availableMinor: null,
    creditLimitMinor: null,
    paymentDueOn: null,
    status: 'active',
    isSimulated: true,
    lastSyncedAt: '2026-10-29T15:00:00.000Z',
    cdt: null,
  });
});

it('keeps the card and CDT details the bank sent', () => {
  const card = toAccount(
    {
      ...remoteSavings,
      providerAccountId: 'card-1',
      kind: 'credit_card',
      balanceMinor: 18_430_000,
      availableMinor: 481_570_000,
      creditLimitMinor: 500_000_000,
      paymentDueOn: '2026-11-05',
    },
    context,
  );
  expect(card).toMatchObject({
    kind: 'credit_card',
    availableMinor: 481_570_000,
    creditLimitMinor: 500_000_000,
    paymentDueOn: '2026-11-05',
  });
  const cdtDetails = {
    rateEaBps: 1050,
    termDays: 360,
    openedOn: '2026-01-10',
    maturesOn: '2027-01-05',
  };
  expect(toAccount({ ...remoteSavings, kind: 'cdt', cdt: cdtDetails }, context).cdt).toEqual(
    cdtDetails,
  );
});

it('refuses a provider Fynk does not know', () => {
  expect(() => toAccount(remoteSavings, { ...context, provider: 'some-bank' })).toThrow(
    'some-bank',
  );
});

it('maps a movement with its merchant key, left as other for M7 to categorize', () => {
  const accountId = accountIdOf('banco-demo', 'acc-1');
  expect(
    toTransaction(
      {
        providerTxId: 'tx-1',
        bookedAt: '2026-10-20T15:00:00Z',
        amountMinor: -18_430_000,
        description: 'Compra Supermercado Éxito',
        merchantRaw: 'ÉXITO BOGOTÁ 1234',
        bankCategory: 'groceries',
        status: 'booked',
      },
      accountId,
    ),
  ).toEqual({
    id: transactionIdOf(accountId, 'tx-1'),
    accountId,
    providerTxId: 'tx-1',
    source: 'bank',
    bookedAt: '2026-10-20T15:00:00Z',
    amountMinor: -18_430_000,
    description: 'Compra Supermercado Éxito',
    merchantRaw: 'ÉXITO BOGOTÁ 1234',
    merchantKey: 'exito',
    categoryId: 'other',
    categorySource: 'rule',
    status: 'booked',
    goalId: null,
  });
});

it('leaves the merchant empty when the bank sent none', () => {
  const tx = toTransaction(
    {
      providerTxId: 'tx-2',
      bookedAt: '2026-10-21T15:00:00Z',
      amountMinor: 520_000_000,
      description: 'Nómina',
      status: 'pending',
    },
    'acc',
  );
  expect(tx).toMatchObject({ merchantRaw: null, merchantKey: null, status: 'pending' });
});
