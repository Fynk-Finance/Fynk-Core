// SCRUM-53: notices at 50 %, 75 % and 100 %, once each (M8 prompt test: 49, 51, 49, 51).
import { planMilestones } from './milestones';

describe('planMilestones', () => {
  it('notices 50 % when 64 % is reached', () => {
    expect(planMilestones(64, [])).toEqual({ record: [50], notify: 50 });
  });

  it('notices nothing below 50 %', () => {
    expect(planMilestones(49, [])).toEqual({ record: [], notify: null });
  });

  it('notices 50 % once when progress goes 49, 51, 49, 51', () => {
    const noticed: (50 | 75 | 100)[] = [];
    const notices = [49, 51, 49, 51].map((percent) => {
      const plan = planMilestones(percent, noticed);
      noticed.push(...plan.record);
      return plan.notify;
    });
    expect(notices).toEqual([null, 50, null, null]);
  });

  it('gives one notice, for the highest, when a contribution jumps two milestones', () => {
    expect(planMilestones(80, [])).toEqual({ record: [50, 75], notify: 75 });
    expect(planMilestones(100, [50])).toEqual({ record: [75, 100], notify: 100 });
  });

  it('notices 100 % after 75 %', () => {
    expect(planMilestones(100, [50, 75])).toEqual({ record: [100], notify: 100 });
  });
});
