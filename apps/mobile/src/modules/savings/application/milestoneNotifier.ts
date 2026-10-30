// Milestone notices of savings goals (SCRUM-53): when a goal reaches 50 %, 75 % or 100 %, one
// notice goes to Notificaciones through M12 ("Viaje a Cartagena · Llegaste al 64 % de tu meta.").
// Checked with the app open only: when the vault opens and after every change of the goals.
import { formatCop } from '@shared/domain/money';
import type { Clock } from '@shared/domain/types';
import type { NotificationsPort } from '@shared/ports';

import type { GoalSummary } from '../domain/goal';
import { planMilestones } from '../domain/milestones';
import { savingsStrings } from '../ui/strings.es-CO';
import type { MilestoneStore } from './milestonePorts';

const t = savingsStrings.milestones;

/** Metas, where the goal is. */
export const MILESTONE_LINK = 'fynk://metas';

export interface MilestoneNotifierDeps {
  goals: () => Promise<GoalSummary[]>;
  store: () => MilestoneStore;
  notifications: Pick<NotificationsPort, 'notify'>;
  clock: Clock;
}

export function createMilestoneNotifier(deps: MilestoneNotifierDeps) {
  return {
    /** Notices the milestones reached since the last check, one per goal at most. */
    async check(): Promise<void> {
      const store = deps.store();
      for (const goal of await deps.goals()) {
        const plan = planMilestones(goal.percent, await store.noticed(goal.id));
        if (plan.record.length === 0) continue;
        // Notice first: if storing fails, the next check tries again and M12's dedupe key keeps
        // it from showing twice.
        if (plan.notify !== null)
          await deps.notifications.notify({
            kind: 'goal_milestone',
            title: goal.name,
            body:
              plan.notify === 100 ? t.done(formatCop(goal.targetMinor)) : t.reached(goal.percent),
            deepLink: MILESTONE_LINK,
            dedupeKey: `goal:${goal.id}:${plan.notify}`,
          });
        await store.record(goal.id, plan.record, deps.clock.now().toISOString());
      }
    },
  };
}
