import { draftFrom, draftToFilter, EMPTY_DRAFT, toggle } from './filterDraft';

// Tuesday 22 Sep 2026 in Bogotá.
const now = new Date('2026-09-22T14:00:00Z');

describe('draftToFilter', () => {
  it('gives no filter for an empty sheet', () => {
    expect(draftToFilter(EMPTY_DRAFT, now)).toEqual({ filter: {}, errors: [] });
  });

  it('turns every field into the filter', () => {
    expect(
      draftToFilter(
        {
          kind: 'expense',
          dates: 'last_month',
          fromText: '',
          toText: '',
          minText: '20.000',
          maxText: '$1.500.000',
          accountIds: ['acc-1'],
          categoryIds: ['groceries'],
        },
        now,
      ),
    ).toEqual({
      filter: {
        kind: 'expense',
        from: '2026-08-01',
        to: '2026-08-31',
        minAmountMinor: 2_000_000,
        maxAmountMinor: 150_000_000,
        accountIds: ['acc-1'],
        categoryIds: ['groceries'],
      },
      errors: [],
    });
  });

  it('reads a custom range and accepts an open end', () => {
    const draft = { ...EMPTY_DRAFT, dates: 'custom' as const, fromText: '01/09/2026' };
    expect(draftToFilter(draft, now)).toEqual({ filter: { from: '2026-09-01' }, errors: [] });
  });

  it('says which field is wrong', () => {
    expect(
      draftToFilter(
        { ...EMPTY_DRAFT, dates: 'custom', fromText: '31/02/2026', minText: 'mucho' },
        now,
      ).errors,
    ).toEqual(['from', 'min']);
    expect(
      draftToFilter(
        {
          ...EMPTY_DRAFT,
          dates: 'custom',
          fromText: '30/09/2026',
          toText: '01/09/2026',
          minText: '500',
          maxText: '100',
        },
        now,
      ).errors,
    ).toEqual(['dates', 'amounts']);
  });
});

describe('draftFrom', () => {
  it('fills the sheet from the filter in use and recognizes the presets', () => {
    expect(
      draftFrom(
        { from: '2026-09-01', to: '2026-09-22', minAmountMinor: 2_000_000, kind: 'income' },
        now,
      ),
    ).toEqual({
      ...EMPTY_DRAFT,
      kind: 'income',
      dates: 'this_month',
      fromText: '01/09/2026',
      toText: '22/09/2026',
      minText: '20.000',
    });
    expect(draftFrom({ from: '2026-09-05' }, now).dates).toBe('custom');
  });

  it('goes back to the same filter', () => {
    const filter = { from: '2026-09-05', to: '2026-09-10', maxAmountMinor: 9_900_000 };
    expect(draftToFilter(draftFrom(filter, now), now).filter).toEqual(filter);
  });
});

describe('toggle', () => {
  it('adds and removes a value', () => {
    expect(toggle(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggle(['a', 'b'], 'a')).toEqual(['b']);
  });
});
