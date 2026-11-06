// Listo's rows (SCRUM-69) on the design's data: Banco Demo $3.200.000, Billetera Demo $4.600.000
// and $600.000 in cash; two goals for $840.000 a month; four payments for $1.453.900 a month.
import { formatCop } from '@shared/domain/money';

import { summaryRows, type SummaryInput, type SummaryRow } from './summary';

const DESIGN: SummaryInput = {
  accounts: { count: 2, totalMinor: 840_000_000 },
  cashMinor: 60_000_000,
  goals: { count: 2, monthlyMinor: 84_000_000 },
  recurring: { count: 4, monthlyMinor: 145_390_000 },
  recoveryCode: 'saved',
};

const NOTHING: SummaryInput = {
  accounts: { count: 0, totalMinor: 0 },
  cashMinor: null,
  goals: { count: 0, monthlyMinor: 0 },
  recurring: { count: 0, monthlyMinor: 0 },
  recoveryCode: 'pending',
};

const row = (rows: SummaryRow[], id: SummaryRow['id']) => rows.find((r) => r.id === id);

const counted = (rows: SummaryRow[], id: 'accounts' | 'goals' | 'recurring') => {
  const r = row(rows, id);
  if (!r || !('count' in r)) throw new Error(`no ${id} row`);
  return [r.count, formatCop(r.totalMinor), r.done] as const;
};

describe('summaryRows', () => {
  it('gives the design numbers: 3 registradas $8.400.000, 2 metas $840.000, 4 pagos $1.453.900', () => {
    const rows = summaryRows(DESIGN);
    expect(counted(rows, 'accounts')).toEqual([3, '$8.400.000', true]);
    expect(counted(rows, 'goals')).toEqual([2, '$840.000', true]);
    expect(counted(rows, 'recurring')).toEqual([4, '$1.453.900', true]);
  });

  it('keeps the design order with the recovery code last', () => {
    expect(summaryRows(DESIGN).map((r) => r.id)).toEqual([
      'email',
      'accounts',
      'goals',
      'recurring',
      'recoveryCode',
    ]);
  });

  it('shows the email as verified even when nothing else was registered', () => {
    expect(row(summaryRows(NOTHING), 'email')?.done).toBe(true);
  });

  it('leaves every part with nothing registered pending', () => {
    const rows = summaryRows(NOTHING);
    expect(counted(rows, 'accounts')).toEqual([0, '$0', false]);
    expect(counted(rows, 'goals')).toEqual([0, '$0', false]);
    expect(counted(rows, 'recurring')).toEqual([0, '$0', false]);
    expect(row(rows, 'recoveryCode')?.done).toBe(false);
  });

  it('counts the cash as one registered account, and only when it is above zero', () => {
    const cashOnly = { ...NOTHING, accounts: { count: 0, totalMinor: 60_000_000 } };
    expect(counted(summaryRows({ ...cashOnly, cashMinor: 60_000_000 }), 'accounts')).toEqual([
      1,
      '$600.000',
      true,
    ]);
    expect(counted(summaryRows({ ...DESIGN, cashMinor: 0 }), 'accounts')[0]).toBe(2);
  });

  it('leaves out the recovery code row when M2 has no answer', () => {
    const rows = summaryRows({ ...DESIGN, recoveryCode: 'unavailable' });
    expect(row(rows, 'recoveryCode')).toBeUndefined();
  });
});
