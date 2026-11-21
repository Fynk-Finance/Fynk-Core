// Milestone notices of a savings goal (SCRUM-53: "Avisos en 50 %, 75 % y 100 %"). Pure.
import { MILESTONES, type Milestone } from './goals';

export interface MilestonePlan {
  /** Milestones reached for the first time: they are stored so they never notify again. */
  record: Milestone[];
  /** The one notice to show: the highest of them, or null. */
  notify: Milestone | null;
}

/**
 * What to do when a goal is at `percent` and `noticed` milestones were reached before. Each
 * milestone counts once: progress that goes 49, 51, 49, 51 notices 50 % a single time. A jump
 * over two milestones (40 % to 80 %) gives one notice, for the highest (75 %).
 */
export function planMilestones(percent: number, noticed: readonly Milestone[]): MilestonePlan {
  const record = MILESTONES.filter((m) => percent >= m && !noticed.includes(m));
  return { record, notify: record.length > 0 ? record[record.length - 1]! : null };
}
