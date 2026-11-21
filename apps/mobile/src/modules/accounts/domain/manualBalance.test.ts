// Manual movements change the balance of cash and of disconnected accounts, never of a
// connected one (team decision of 5 Nov 2026).
import { account, card, cash, cdt, savings } from '../testing/fixtures';
import {
  balanceOwner,
  InsufficientCashError,
  manualBalanceUpdates,
  netDeltas,
} from './manualBalance';

const revoked = account({ id: 'acc-old', providerAccountId: 'acc-old-1', status: 'revoked' });
const closed = account({ id: 'acc-closed', providerAccountId: 'acc-closed-1', status: 'closed' });
const revokedCard = { ...card, status: 'revoked' as const };

describe('balanceOwner', () => {
  it('keeps the balance of cash and of disconnected bank accounts', () => {
    expect(balanceOwner(cash)).toBe('cash');
    expect(balanceOwner(revoked)).toBe('disconnected');
    expect(balanceOwner(closed)).toBe('disconnected');
    expect(balanceOwner(revokedCard)).toBe('disconnected');
  });

  it('leaves connected accounts, CDTs and removed cash alone', () => {
    expect(balanceOwner(savings)).toBeNull();
    expect(balanceOwner(card)).toBeNull();
    expect(balanceOwner({ ...cdt, status: 'revoked' })).toBeNull();
    expect(balanceOwner({ ...cash, status: 'closed' })).toBeNull();
  });
});

describe('netDeltas', () => {
  it('applies a new movement', () => {
    expect(netDeltas({ before: null, after: { accountId: 'a', amountMinor: -3_000_000 } })).toEqual(
      new Map([['a', -3_000_000]]),
    );
  });

  it('takes back a deleted movement', () => {
    expect(netDeltas({ before: { accountId: 'a', amountMinor: -3_000_000 }, after: null })).toEqual(
      new Map([['a', 3_000_000]]),
    );
  });

  it('gives one difference for an edit in the same account, and nothing when it does not change', () => {
    const before = { accountId: 'a', amountMinor: -3_000_000 };
    expect(netDeltas({ before, after: { accountId: 'a', amountMinor: -2_000_000 } })).toEqual(
      new Map([['a', 1_000_000]]),
    );
    expect(netDeltas({ before, after: before })).toEqual(new Map());
  });

  it('moves the effect when the account changes', () => {
    expect(
      netDeltas({
        before: { accountId: 'a', amountMinor: -3_000_000 },
        after: { accountId: 'b', amountMinor: -3_000_000 },
      }),
    ).toEqual(
      new Map([
        ['a', 3_000_000],
        ['b', -3_000_000],
      ]),
    );
  });
});

describe('manualBalanceUpdates', () => {
  const accounts = [savings, cash, revoked, revokedCard];

  it('subtracts a Gasto from cash and adds an Ingreso', () => {
    expect(
      manualBalanceUpdates(accounts, {
        before: null,
        after: { accountId: cash.id, amountMinor: -3_000_000 },
      }),
    ).toEqual([{ account: cash, balanceMinor: 57_000_000, availableMinor: null }]);
    expect(
      manualBalanceUpdates(accounts, {
        before: null,
        after: { accountId: cash.id, amountMinor: 5_000_000 },
      }),
    ).toEqual([{ account: cash, balanceMinor: 65_000_000, availableMinor: null }]);
  });

  it('changes the balance and the available amount of a disconnected account', () => {
    expect(
      manualBalanceUpdates(accounts, {
        before: null,
        after: { accountId: revoked.id, amountMinor: -10_000_000 },
      }),
    ).toEqual([{ account: revoked, balanceMinor: 310_000_000, availableMinor: 310_000_000 }]);
  });

  it('raises the debt of a disconnected card on a Gasto and frees credit', () => {
    const [update] = manualBalanceUpdates(accounts, {
      before: null,
      after: { accountId: revokedCard.id, amountMinor: -10_000_000 },
    });
    expect(update).toEqual({
      account: revokedCard,
      balanceMinor: revokedCard.balanceMinor + 10_000_000,
      availableMinor: revokedCard.availableMinor! - 10_000_000,
    });
  });

  it('never changes a connected account or an unknown one', () => {
    expect(
      manualBalanceUpdates(accounts, {
        before: { accountId: 'gone', amountMinor: -1_000_000 },
        after: { accountId: savings.id, amountMinor: -10_000_000 },
      }),
    ).toEqual([]);
  });

  it('moves a Gasto from cash to a disconnected account', () => {
    expect(
      manualBalanceUpdates(accounts, {
        before: { accountId: cash.id, amountMinor: -3_000_000 },
        after: { accountId: revoked.id, amountMinor: -3_000_000 },
      }),
    ).toEqual([
      { account: cash, balanceMinor: 63_000_000, availableMinor: null },
      { account: revoked, balanceMinor: 317_000_000, availableMinor: 317_000_000 },
    ]);
  });

  it('refuses a Gasto bigger than the cash and says how much cash there is', () => {
    const run = () =>
      manualBalanceUpdates(accounts, {
        before: null,
        after: { accountId: cash.id, amountMinor: -60_000_001 },
      });
    expect(run).toThrow(InsufficientCashError);
    try {
      run();
    } catch (e) {
      expect((e as InsufficientCashError).cashMinor).toBe(60_000_000);
    }
  });

  it('allows spending all the cash, down to $0', () => {
    expect(
      manualBalanceUpdates(accounts, {
        before: null,
        after: { accountId: cash.id, amountMinor: -60_000_000 },
      })[0]?.balanceMinor,
    ).toBe(0);
  });

  it('counts the old amount back when an edit makes a Gasto bigger', () => {
    // $100.000 already spent of $700.000; editing it to $700.000 leaves $0.
    expect(
      manualBalanceUpdates([{ ...cash, balanceMinor: 60_000_000 }], {
        before: { accountId: cash.id, amountMinor: -10_000_000 },
        after: { accountId: cash.id, amountMinor: -70_000_000 },
      })[0]?.balanceMinor,
    ).toBe(0);
  });
});
