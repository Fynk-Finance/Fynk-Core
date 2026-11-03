import { bankTx } from '../testing/fixtures';
import { emptyManualDraft, manualDraftFrom, manualDraftToInput } from './manualDraft';

// Tuesday 22 Sep 2026, 9:00 in Bogotá.
const now = new Date('2026-09-22T14:00:00Z');
const draft = {
  ...emptyManualDraft('acc-cash'),
  amountText: '25.000',
  description: ' Almuerzo ',
};

describe('manualDraftToInput', () => {
  it('saves today at the current time, without the extra spaces', () => {
    expect(manualDraftToInput(draft, now)).toEqual({
      input: {
        accountId: 'acc-cash',
        kind: 'expense',
        amountMinor: 2_500_000,
        bookedAt: '2026-09-22T14:00:00.000Z',
        description: 'Almuerzo',
      },
      errors: [],
    });
  });

  it('places yesterday and other days at noon in Bogotá, and keeps the picked category', () => {
    expect(manualDraftToInput({ ...draft, day: 'yesterday' }, now).input?.bookedAt).toBe(
      '2026-09-21T17:00:00.000Z',
    );
    const other = manualDraftToInput(
      { ...draft, day: 'other', dayText: '05/09/2026', categoryId: 'restaurants', kind: 'income' },
      now,
    );
    expect(other.input).toMatchObject({
      bookedAt: '2026-09-05T17:00:00.000Z',
      categoryId: 'restaurants',
      kind: 'income',
    });
  });

  it('keeps the time of an edited movement when its day does not change', () => {
    const result = manualDraftToInput(
      { ...draft, day: 'other', dayText: '05/09/2026' },
      now,
      '2026-09-05T23:10:00.000Z',
    );
    expect(result.input?.bookedAt).toBe('2026-09-05T23:10:00.000Z');
  });

  it('says what is missing or wrong, and refuses days in the future', () => {
    expect(
      manualDraftToInput(
        { ...emptyManualDraft(null), amountText: '0', day: 'other', dayText: '23/09/2026' },
        now,
      ).errors,
    ).toEqual(['amount', 'account', 'description', 'day']);
    expect(manualDraftToInput({ ...draft, amountText: 'mucho' }, now).errors).toEqual(['amount']);
  });
});

describe('manualDraftFrom', () => {
  it('fills the sheet with a movement to edit', () => {
    const tx = bankTx({
      id: 'm',
      source: 'manual',
      providerTxId: null,
      accountId: 'acc-cash',
      bookedAt: '2026-09-21T17:00:00.000Z',
      amountMinor: -2_500_000,
      description: 'Almuerzo',
      categoryId: 'restaurants',
      categorySource: 'rule',
    });
    expect(manualDraftFrom(tx, now)).toEqual({
      kind: 'expense',
      amountText: '25.000',
      accountId: 'acc-cash',
      day: 'yesterday',
      dayText: '21/09/2026',
      description: 'Almuerzo',
      categoryId: null,
    });
    expect(manualDraftFrom({ ...tx, categorySource: 'user' }, now).categoryId).toBe('restaurants');
  });
});
