// SCRUM-52: the rules of a manual contribution and of a movement linked as a contribution.
import { contributionFromMovement, validateContribution } from './contribution';

const TODAY = '2026-10-28';

describe('validateContribution', () => {
  it('accepts $100.000 today with a note', () => {
    expect(
      validateContribution(
        { amountMinor: 10_000_000, contributedOn: TODAY, note: 'Prima de octubre' },
        TODAY,
      ),
    ).toEqual({});
  });

  it('accepts an earlier day', () => {
    expect(validateContribution({ amountMinor: 1, contributedOn: '2026-09-30' }, TODAY)).toEqual(
      {},
    );
  });

  it('rejects no amount, a future day and a long note', () => {
    expect(
      validateContribution(
        { amountMinor: 0, contributedOn: '2026-10-29', note: 'x'.repeat(81) },
        TODAY,
      ),
    ).toEqual({ amount: 'amount_required', date: 'date_future', note: 'note_too_long' });
  });

  it('rejects a huge amount and a day that does not exist', () => {
    expect(
      validateContribution({ amountMinor: 200_000_000_000, contributedOn: '2026-02-30' }, TODAY),
    ).toEqual({ amount: 'amount_too_large', date: 'date_invalid' });
  });
});

describe('contributionFromMovement', () => {
  const tx = {
    id: 't1',
    amountMinor: -30_000_000,
    bookedAt: '2026-10-01T03:00:00Z',
    status: 'booked' as const,
    goalId: null,
  };

  it('takes the money that left the account, on its day in Bogotá', () => {
    // 03:00 UTC on 1 Oct is still 30 Sep in Bogotá.
    expect(contributionFromMovement(tx)).toEqual({
      amountMinor: 30_000_000,
      contributedOn: '2026-09-30',
    });
  });

  it('refuses money that came in, a pending movement and one already linked', () => {
    expect(contributionFromMovement({ ...tx, amountMinor: 30_000_000 })).toBeNull();
    expect(contributionFromMovement({ ...tx, status: 'pending' })).toBeNull();
    expect(contributionFromMovement({ ...tx, goalId: 'g9' })).toBeNull();
  });
});
