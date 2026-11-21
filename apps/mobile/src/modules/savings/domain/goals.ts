// Rules of the savings goals (M8 prompt, "Rules"; SCRUM-51 and SCRUM-53). Pure: the caller
// passes today's date in Bogotá. Money is integer centavos. Fynk never moves money: these
// numbers only describe the person's own plan.
import type { Id, IsoDate, MoneyMinor } from '@shared/domain/types';

export type GoalCategory = 'travel' | 'emergency' | 'education' | 'home' | 'vehicle' | 'other';

export interface Contribution {
  amountMinor: MoneyMinor;
  contributedOn: IsoDate;
}

/** A calendar month as 'YYYY-MM'. */
export type YearMonthText = string;

/** $1.000 in centavos: suggested amounts are rounded up to it. */
const THOUSAND_PESOS: MoneyMinor = 100_000;

const MONTH = /^(\d{4})-(\d{2})/;

/** Months since year 0, from 'YYYY-MM' or 'YYYY-MM-DD'. */
function monthIndex(value: string): number {
  const m = MONTH.exec(value);
  if (!m) throw new RangeError(`Not a month: ${value}`);
  return Number(m[1]) * 12 + Number(m[2]) - 1;
}

const ceilTo = (value: number, step: number) => Math.ceil(value / step) * step;

/**
 * Calendar months after the current one, up to and including the deadline month. October 2026
 * to June 2027 gives 8, October to December 2026 gives 2. At least 1, also for a past deadline.
 */
export function monthsLeft(today: IsoDate, deadline: YearMonthText): number {
  return Math.max(1, monthIndex(deadline) - monthIndex(today));
}

/** What is still missing ("Te falta $280.000"). Never negative. */
export function remaining(target: MoneyMinor, saved: MoneyMinor): MoneyMinor {
  return Math.max(0, target - saved);
}

/**
 * "Aporte mensual sugerido": the missing amount over the months left, rounded up to the next
 * $1.000. $5.000.000 in 8 months gives $625.000, $3.000.000 in 14 months gives $215.000.
 */
export function suggestedMonthly(
  target: MoneyMinor,
  saved: MoneyMinor,
  months: number,
): MoneyMinor {
  const missing = remaining(target, saved);
  if (missing === 0) return 0;
  return ceilTo(Math.ceil(missing / Math.max(1, months)), THOUSAND_PESOS);
}

/** Integer percent saved, never above 100: 3.200.000 of 5.000.000 gives 64. */
export function progressPercent(target: MoneyMinor, saved: MoneyMinor): number {
  if (target <= 0) return 100;
  return Math.min(100, Math.floor((Math.max(0, saved) * 100) / target));
}

export type Pace =
  | { status: 'done' }
  | { status: 'on_track' }
  /** "Te faltan $X al mes para llegar": X rounded up to the next $1.000. */
  | { status: 'behind'; missingMonthlyMinor: MoneyMinor };

/**
 * Whether the person's pace reaches the goal: the average of the contributions of the last 3
 * months (or of the months since the goal was created, if fewer) is at least the suggested
 * monthly amount. The current month counts as one of them.
 */
export function pace(input: {
  target: MoneyMinor;
  saved: MoneyMinor;
  contributions: readonly Contribution[];
  createdOn: IsoDate;
  deadline: YearMonthText;
  today: IsoDate;
}): Pace {
  const { target, saved, today } = input;
  if (remaining(target, saved) === 0) return { status: 'done' };

  const current = monthIndex(today);
  const months = Math.min(3, Math.max(1, current - monthIndex(input.createdOn) + 1));
  const from = current - months + 1;
  const inWindow = input.contributions.filter((c) => {
    const m = monthIndex(c.contributedOn);
    return m >= from && m <= current;
  });
  const average = inWindow.reduce((sum, c) => sum + c.amountMinor, 0) / months;
  const suggested = suggestedMonthly(target, saved, monthsLeft(today, input.deadline));
  if (average >= suggested) return { status: 'on_track' };
  return { status: 'behind', missingMonthlyMinor: ceilTo(suggested - average, THOUSAND_PESOS) };
}

export const MILESTONES = [50, 75, 100] as const;
export type Milestone = (typeof MILESTONES)[number];

/**
 * Milestones the goal has reached, each with the dedupe key of its notification. M12 shows a key
 * only once, so progress that goes 49, 51, 49, 51 notifies the 50 % milestone a single time.
 */
export function reachedMilestones(
  goalId: Id,
  percent: number,
): { milestone: Milestone; dedupeKey: string }[] {
  return MILESTONES.filter((m) => percent >= m).map((milestone) => ({
    milestone,
    dedupeKey: `goal:${goalId}:${milestone}`,
  }));
}

/** "2 metas $840.000/mes": the sum of the suggested monthly amounts (used by onboarding, M3). */
export function goalsMonthlyTotal(suggested: readonly MoneyMinor[]): MoneyMinor {
  return suggested.reduce((sum, s) => sum + s, 0);
}

/** Share of the monthly income that goes to goals, rounded to a whole percent (23 %). */
export function shareOfIncome(goalsMonthly: MoneyMinor, monthlyIncome: MoneyMinor): number | null {
  if (monthlyIncome <= 0) return null;
  return Math.round((goalsMonthly * 100) / monthlyIncome);
}
