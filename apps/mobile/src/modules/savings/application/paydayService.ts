// The payday reminder of a goal (M8 prompt, from Recomendaciones "Programar"). Keeps one reminder
// per goal in the vault and schedules its next one with M12, at 9:00 Bogotá time on the salary
// day: "Hoy es día de pago: aparta $300.000 para Viaje a Cartagena". M12 notifications fire once,
// so the next month is scheduled again whenever the vault opens. Fynk never moves money.
import { formatCop } from '@shared/domain/money';
import type { Clock, Id, MoneyMinor } from '@shared/domain/types';
import type { NotificationsPort } from '@shared/ports';

import type { GoalSummary } from '../domain/goal';
import { nextPaydayAt, validatePayday, type PaydayInput } from '../domain/payday';
import { paydayStrings as t } from '../ui/strings.es-CO';
import type { PaydayReminder, PaydayStore } from './paydayPorts';

/** One pending notification per goal: scheduling again with this id replaces it. */
export const paydayReminderId = (goalId: Id) => `savings.payday.${goalId}`;

export class InvalidPaydayError extends Error {
  constructor() {
    super('The payday reminder is not valid');
    this.name = 'InvalidPaydayError';
  }
}

export interface PaydayDeps {
  store: () => PaydayStore;
  /** The goals with their summary: a reached or deleted goal gets no reminder. */
  goals: () => Promise<GoalSummary[]>;
  notifications: Pick<NotificationsPort, 'schedule' | 'cancel'>;
  clock: Clock;
}

export interface PaydayService {
  get(goalId: Id): Promise<PaydayReminder | null>;
  /** Saves the reminder and schedules the next one. Throws InvalidPaydayError. */
  save(goalId: Id, input: PaydayInput): Promise<void>;
  remove(goalId: Id): Promise<void>;
  /** Schedules the next reminder of every goal again, and drops those of reached goals. */
  refresh(): Promise<void>;
}

export function createPaydayService(deps: PaydayDeps): PaydayService {
  const schedule = async (goal: GoalSummary, amountMinor: MoneyMinor, day: number) => {
    const id = paydayReminderId(goal.id);
    const fireAt = nextPaydayAt(day, deps.clock.now());
    await deps.notifications.schedule({
      id,
      fireAt,
      kind: 'recommendation',
      title: t.noticeTitle,
      body: t.noticeBody(formatCop(amountMinor), goal.name),
      deepLink: 'fynk://metas',
      // One notice per goal and month, even if it is scheduled again.
      dedupeKey: `${id}.${fireAt.slice(0, 7)}`,
    });
  };

  return {
    get: (goalId) => deps.store().get(goalId),

    async save(goalId, input) {
      if (validatePayday(input).length > 0) throw new InvalidPaydayError();
      const goal = (await deps.goals()).find((g) => g.id === goalId && !g.done);
      if (!goal) throw new InvalidPaydayError();
      await deps.store().save({
        goalId,
        amountMinor: input.amountMinor,
        day: input.day,
        updatedAt: deps.clock.now().toISOString(),
      });
      await schedule(goal, input.amountMinor, input.day);
    },

    async remove(goalId) {
      await deps.store().remove(goalId);
      await deps.notifications.cancel(paydayReminderId(goalId));
    },

    async refresh() {
      const goals = new Map((await deps.goals()).map((g) => [g.id, g]));
      for (const r of await deps.store().list()) {
        const goal = goals.get(r.goalId);
        if (!goal || goal.done) {
          await deps.store().remove(r.goalId);
          await deps.notifications.cancel(paydayReminderId(r.goalId));
        } else {
          await schedule(goal, r.amountMinor, r.day);
        }
      }
    },
  };
}
