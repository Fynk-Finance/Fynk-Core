// Reference numbers of the design (shared contracts, section 7) and the M8 prompt.
import { formatCop } from '@shared/domain/money';

import {
  goalsMonthlyTotal,
  monthsLeft,
  pace,
  progressPercent,
  reachedMilestones,
  remaining,
  shareOfIncome,
  suggestedMonthly,
} from './goals';

const pesos = (n: number) => n * 100;
const TODAY = '2026-10-28';

describe('monthsLeft', () => {
  it('counts the months after the current one up to the deadline month', () => {
    expect(monthsLeft(TODAY, '2027-06')).toBe(8);
    expect(monthsLeft(TODAY, '2026-12')).toBe(2); // "Faltan 2 meses"
    expect(monthsLeft('2026-10-01', '2026-11')).toBe(1);
  });

  it('is at least 1 for this month or a past deadline', () => {
    expect(monthsLeft(TODAY, '2026-10')).toBe(1);
    expect(monthsLeft(TODAY, '2026-03')).toBe(1);
  });

  it('crosses the year correctly', () => {
    expect(monthsLeft('2026-12-31', '2027-01')).toBe(1);
  });

  it('rejects a value that is not a month', () => {
    expect(() => monthsLeft(TODAY, 'junio')).toThrow(RangeError);
  });
});

describe('suggestedMonthly', () => {
  it('gives $625.000 for $5.000.000 in 8 months', () => {
    expect(formatCop(suggestedMonthly(pesos(5_000_000), 0, 8))).toBe('$625.000');
  });

  it('gives $215.000 for $3.000.000 in 14 months (214.285,71 rounded up to the next $1.000)', () => {
    expect(formatCop(suggestedMonthly(pesos(3_000_000), 0, 14))).toBe('$215.000');
  });

  it('gives "$140.000/mes" for the Metas goal: 800.000 target, 520.000 saved, 2 months', () => {
    expect(formatCop(suggestedMonthly(pesos(800_000), pesos(520_000), 2))).toBe('$140.000');
  });

  it('is 0 once the goal is reached', () => {
    expect(suggestedMonthly(pesos(800_000), pesos(900_000), 2)).toBe(0);
  });

  it('always lands on whole thousands of pesos', () => {
    expect(suggestedMonthly(pesos(1_000_001), 0, 3)).toBe(pesos(334_000));
  });
});

describe('progress and remaining', () => {
  it('gives 64 % for 3.200.000 of 5.000.000 and 65 % for 520.000 of 800.000', () => {
    expect(progressPercent(pesos(5_000_000), pesos(3_200_000))).toBe(64);
    expect(progressPercent(pesos(800_000), pesos(520_000))).toBe(65);
  });

  it('only says 100 % when the goal is complete, and never more', () => {
    expect(progressPercent(pesos(1_000_000), pesos(999_999))).toBe(99);
    expect(progressPercent(pesos(1_000_000), pesos(1_500_000))).toBe(100);
  });

  it('gives "Te falta $280.000" for the Metas goal, and never a negative amount', () => {
    expect(formatCop(remaining(pesos(800_000), pesos(520_000)))).toBe('$280.000');
    expect(remaining(pesos(800_000), pesos(900_000))).toBe(0);
  });
});

describe('pace (Vas a tiempo / Te faltan $X al mes)', () => {
  const goal = {
    target: pesos(800_000),
    saved: pesos(520_000),
    createdOn: '2026-05-01',
    deadline: '2026-12',
    today: TODAY,
  };

  it('is on track when the last 3 months average at least the suggested $140.000', () => {
    const contributions = [
      { amountMinor: pesos(150_000), contributedOn: '2026-08-05' },
      { amountMinor: pesos(140_000), contributedOn: '2026-09-05' },
      { amountMinor: pesos(130_000), contributedOn: '2026-10-05' },
      { amountMinor: pesos(100_000), contributedOn: '2026-07-05' }, // outside the window
    ];
    expect(pace({ ...goal, contributions })).toEqual({ status: 'on_track' });
  });

  it('says how much more a month is needed when the average falls short', () => {
    const contributions = [
      { amountMinor: pesos(100_000), contributedOn: '2026-08-05' },
      { amountMinor: pesos(100_000), contributedOn: '2026-09-05' },
      { amountMinor: pesos(100_000), contributedOn: '2026-10-05' },
    ];
    expect(pace({ ...goal, contributions })).toEqual({
      status: 'behind',
      missingMonthlyMinor: pesos(40_000),
    });
  });

  it('averages over the months since creation when the goal is younger than 3 months', () => {
    const young = { ...goal, createdOn: '2026-10-01' };
    const contributions = [{ amountMinor: pesos(140_000), contributedOn: '2026-10-02' }];
    expect(pace({ ...young, contributions })).toEqual({ status: 'on_track' });
  });

  it('is done when the goal is reached', () => {
    expect(pace({ ...goal, saved: pesos(800_000), contributions: [] })).toEqual({ status: 'done' });
  });
});

describe('reachedMilestones', () => {
  it('gives 50 % at 64 %, and 50, 75 and 100 at completion', () => {
    expect(reachedMilestones('g1', 64)).toEqual([{ milestone: 50, dedupeKey: 'goal:g1:50' }]);
    expect(reachedMilestones('g1', 100).map((m) => m.milestone)).toEqual([50, 75, 100]);
    expect(reachedMilestones('g1', 49)).toEqual([]);
  });

  it('keeps the same dedupe key when progress goes 49, 51, 49, 51, so M12 notifies once', () => {
    const keys = [49, 51, 49, 51].flatMap((p) =>
      reachedMilestones('g1', p).map((m) => m.dedupeKey),
    );
    expect(new Set(keys)).toEqual(new Set(['goal:g1:50']));
  });
});

describe('totals', () => {
  it('gives "2 metas $840.000/mes" for 625.000 + 215.000', () => {
    expect(formatCop(goalsMonthlyTotal([pesos(625_000), pesos(215_000)]))).toBe('$840.000');
  });

  it('gives 23 % for 1.309.000 a month of 5.580.000 income', () => {
    expect(shareOfIncome(pesos(1_309_000), pesos(5_580_000))).toBe(23);
  });

  it('has no share without income', () => {
    expect(shareOfIncome(pesos(1_309_000), 0)).toBeNull();
  });
});
